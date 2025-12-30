from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.land_management import (
    FloodMonitoringStation,
    FieldFloodRisk,
    FloodRiskLevel,
)
from app.models.field import Field
from app.models.user import User
from app.schemas.land_management import (
    FloodMonitoringStationCreate,
    FloodMonitoringStationUpdate,
    FloodMonitoringStationResponse,
    FieldFloodRiskCreate,
    FieldFloodRiskUpdate,
    FieldFloodRiskResponse,
    FloodWarningStatus,
)
from app.services.flood_api import FloodAPIService
from app.utils.auth import get_current_user, require_admin
from app.utils.crud import get_or_404

router = APIRouter()


def enrich_station(station: FloodMonitoringStation, db: Session) -> FloodMonitoringStationResponse:
    """Add computed fields to a station response."""
    response = FloodMonitoringStationResponse.model_validate(station)

    # Count linked fields
    response.linked_field_count = db.query(FieldFloodRisk).filter(
        FieldFloodRisk.monitoring_station_id == station.id
    ).count()

    # Determine current status based on last reading
    if station.last_reading is not None:
        response.current_status = FloodAPIService.determine_warning_level(
            station.last_reading,
            warning_threshold=station.warning_threshold_meters,
            severe_threshold=station.severe_threshold_meters
        )

    return response


def enrich_field_risk(risk: FieldFloodRisk, db: Session) -> FieldFloodRiskResponse:
    """Add computed fields to a field flood risk response."""
    response = FieldFloodRiskResponse.model_validate(risk)

    # Get field name
    field = db.query(Field).filter(Field.id == risk.field_id).first()
    if field:
        response.field_name = field.name

    # Get station info and current level
    station = db.query(FloodMonitoringStation).filter(
        FloodMonitoringStation.id == risk.monitoring_station_id
    ).first()

    if station:
        response.station_name = station.station_name
        response.current_level = station.last_reading

        if station.last_reading is not None:
            response.current_status = FloodAPIService.determine_warning_level(
                station.last_reading,
                warning_threshold=station.warning_threshold_meters,
                severe_threshold=station.severe_threshold_meters
            )

    return response


# ============================================================================
# Station CRUD
# ============================================================================

@router.get("/stations", response_model=List[FloodMonitoringStationResponse])
def list_stations(
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """List all configured monitoring stations."""
    query = db.query(FloodMonitoringStation)

    if active_only:
        query = query.filter(FloodMonitoringStation.is_active == True)

    stations = query.order_by(FloodMonitoringStation.station_name).all()
    return [enrich_station(s, db) for s in stations]


@router.post("/stations", response_model=FloodMonitoringStationResponse, status_code=status.HTTP_201_CREATED)
def add_station(
    station_data: FloodMonitoringStationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Add a new monitoring station to track."""
    # Check if station already exists
    existing = db.query(FloodMonitoringStation).filter(
        FloodMonitoringStation.station_id == station_data.station_id
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Station is already being monitored"
        )

    station = FloodMonitoringStation(
        **station_data.model_dump(),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(station)
    db.commit()
    db.refresh(station)
    return enrich_station(station, db)


@router.get("/stations/{station_id}", response_model=FloodMonitoringStationResponse)
def get_station(
    station_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get a monitoring station."""
    station = db.query(FloodMonitoringStation).filter(
        FloodMonitoringStation.id == station_id
    ).first()

    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    return enrich_station(station, db)


@router.put("/stations/{station_id}", response_model=FloodMonitoringStationResponse)
def update_station(
    station_id: int,
    station_data: FloodMonitoringStationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update a monitoring station."""
    station = db.query(FloodMonitoringStation).filter(
        FloodMonitoringStation.id == station_id
    ).first()

    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    for key, value in station_data.model_dump(exclude_unset=True).items():
        setattr(station, key, value)

    station.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(station)
    return enrich_station(station, db)


@router.delete("/stations/{station_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_station(
    station_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete a monitoring station."""
    station = db.query(FloodMonitoringStation).filter(
        FloodMonitoringStation.id == station_id
    ).first()

    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    db.delete(station)
    db.commit()


# ============================================================================
# Field Flood Risk Links
# ============================================================================

@router.get("/field-risks", response_model=List[FieldFloodRiskResponse])
def list_field_flood_risks(
    field_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """List all field flood risk configurations."""
    query = db.query(FieldFloodRisk)

    if field_id:
        query = query.filter(FieldFloodRisk.field_id == field_id)

    risks = query.all()
    return [enrich_field_risk(r, db) for r in risks]


@router.post("/field-risks", response_model=FieldFloodRiskResponse, status_code=status.HTTP_201_CREATED)
def add_field_flood_risk(
    risk_data: FieldFloodRiskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Link a field to a monitoring station for flood risk tracking."""
    # Verify field and station exist
    field = get_or_404(db, Field, risk_data.field_id)
    station = get_or_404(db, FloodMonitoringStation, risk_data.monitoring_station_id)

    # Check if link already exists
    existing = db.query(FieldFloodRisk).filter(
        FieldFloodRisk.field_id == risk_data.field_id,
        FieldFloodRisk.monitoring_station_id == risk_data.monitoring_station_id
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Field is already linked to this monitoring station"
        )

    risk = FieldFloodRisk(
        **risk_data.model_dump(),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(risk)
    db.commit()
    db.refresh(risk)
    return enrich_field_risk(risk, db)


@router.put("/field-risks/{risk_id}", response_model=FieldFloodRiskResponse)
def update_field_flood_risk(
    risk_id: int,
    risk_data: FieldFloodRiskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update a field flood risk configuration."""
    risk = db.query(FieldFloodRisk).filter(FieldFloodRisk.id == risk_id).first()

    if not risk:
        raise HTTPException(status_code=404, detail="Field flood risk not found")

    for key, value in risk_data.model_dump(exclude_unset=True).items():
        setattr(risk, key, value)

    risk.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(risk)
    return enrich_field_risk(risk, db)


@router.delete("/field-risks/{risk_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_field_flood_risk(
    risk_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Remove field flood risk configuration."""
    risk = db.query(FieldFloodRisk).filter(FieldFloodRisk.id == risk_id).first()

    if not risk:
        raise HTTPException(status_code=404, detail="Field flood risk not found")

    db.delete(risk)
    db.commit()


# ============================================================================
# Current Status & Warnings
# ============================================================================

@router.get("/current", response_model=FloodWarningStatus)
def get_current_warnings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get current flood warning status across all monitored fields."""
    # Get all field-station links with their current readings
    risks = db.query(FieldFloodRisk).options(
        joinedload(FieldFloodRisk.monitoring_station)
    ).all()

    warnings = []
    has_warnings = False
    has_severe = False
    last_updated = None

    for risk in risks:
        station = risk.monitoring_station
        if not station or not station.is_active:
            continue

        response = enrich_field_risk(risk, db)

        # Track last updated time
        if station.last_fetched:
            if last_updated is None or station.last_fetched > last_updated:
                last_updated = station.last_fetched

        # Check for warnings
        if response.current_status in ["warning", "severe"]:
            warnings.append(response)
            has_warnings = True
            if response.current_status == "severe":
                has_severe = True

    return FloodWarningStatus(
        has_warnings=has_warnings,
        has_severe_warnings=has_severe,
        warnings=warnings,
        last_updated=last_updated
    )


@router.get("/field/{field_id}", response_model=List[FieldFloodRiskResponse])
def get_field_flood_risks(
    field_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get flood risk information for a specific field."""
    field = get_or_404(db, Field, field_id)

    risks = db.query(FieldFloodRisk).filter(
        FieldFloodRisk.field_id == field_id
    ).all()

    return [enrich_field_risk(r, db) for r in risks]


@router.post("/fetch", response_model=dict)
def refresh_readings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Trigger a refresh of all station readings from the Environment Agency API."""
    stations = db.query(FloodMonitoringStation).filter(
        FloodMonitoringStation.is_active == True
    ).all()

    updated_count = 0
    error_count = 0

    for station in stations:
        try:
            reading = FloodAPIService.get_latest_reading_sync(station.station_id)
            if reading and reading.get("value") is not None:
                station.last_reading = reading["value"]
                if reading.get("date_time"):
                    try:
                        # Parse ISO format datetime
                        dt_str = reading["date_time"]
                        if dt_str.endswith("Z"):
                            dt_str = dt_str[:-1]
                        station.last_reading_time = datetime.fromisoformat(dt_str)
                    except (ValueError, TypeError):
                        pass
                station.last_fetched = datetime.utcnow()
                station.updated_at = datetime.utcnow()
                updated_count += 1
        except Exception as e:
            error_count += 1

    db.commit()

    return {
        "message": f"Refreshed {updated_count} stations, {error_count} errors",
        "updated": updated_count,
        "errors": error_count
    }


# ============================================================================
# Environment Agency API Search
# ============================================================================

@router.get("/search-stations")
async def search_ea_stations(
    search: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    dist_km: float = 10.0,
    current_user: User = Depends(require_admin)
):
    """
    Search Environment Agency monitoring stations.

    Use this to find stations to add for monitoring.
    Either provide a search term OR lat/lon coordinates.
    """
    if not search and (lat is None or lon is None):
        raise HTTPException(
            status_code=400,
            detail="Provide either a search term or lat/lon coordinates"
        )

    stations = await FloodAPIService.search_stations(
        search_term=search,
        lat=lat,
        lon=lon,
        dist_km=dist_km
    )

    return {"stations": stations}


@router.get("/station-info/{station_id}")
async def get_ea_station_info(
    station_id: str,
    current_user: User = Depends(require_admin)
):
    """Get detailed information about an Environment Agency station."""
    info = await FloodAPIService.get_station_info(station_id)
    if not info:
        raise HTTPException(status_code=404, detail="Station not found")

    # Also get latest reading
    reading = await FloodAPIService.get_latest_reading(station_id)

    return {
        "station": info,
        "latest_reading": reading
    }


@router.get("/station-history/{station_id}")
async def get_ea_station_history(
    station_id: str,
    hours: int = 24,
    current_user: User = Depends(require_admin)
):
    """Get reading history for an Environment Agency station."""
    if hours < 1 or hours > 168:  # Max 1 week
        raise HTTPException(status_code=400, detail="Hours must be between 1 and 168")

    readings = await FloodAPIService.get_readings_history(station_id, hours)

    return {"readings": readings}

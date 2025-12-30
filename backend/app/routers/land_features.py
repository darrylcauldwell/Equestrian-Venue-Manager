from typing import List, Optional
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.database import get_db
from app.models.land_management import (
    LandFeature,
    FeatureMaintenanceLog,
    GrantFeatureLink,
    Grant,
    LandFeatureType,
    FeatureCondition,
    WaterSourceType,
    MaintenanceType,
)
from app.models.field import Field
from app.models.user import User
from app.schemas.land_management import (
    LandFeatureCreate,
    LandFeatureUpdate,
    LandFeatureResponse,
    LandFeatureDetailResponse,
    FeatureMaintenanceLogCreate,
    FeatureMaintenanceLogResponse,
    WaterTroughStatus,
    RecordFillRequest,
    FenceStatus,
    RecordFenceCheckRequest,
    MaintenanceDueItem,
    MaintenanceDueReport,
    LandManagementEnums,
    GrantResponse,
)
from app.utils.auth import get_current_user, require_admin
from app.utils.crud import get_or_404

router = APIRouter()


def feature_query(db: Session):
    """Create a query with eager loading for features."""
    return db.query(LandFeature).options(
        joinedload(LandFeature.field),
        joinedload(LandFeature.maintenance_logs),
        joinedload(LandFeature.grant_links),
    )


def enrich_feature(feature: LandFeature) -> LandFeatureResponse:
    """Add computed fields to a feature response."""
    response = LandFeatureResponse.model_validate(feature)

    # Add field name
    if feature.field:
        response.field_name = feature.field.name

    # Calculate days until maintenance
    if feature.next_maintenance_due:
        delta = (feature.next_maintenance_due - date.today()).days
        response.days_until_maintenance = delta
        response.maintenance_overdue = delta < 0

    return response


def enrich_feature_detail(feature: LandFeature, db: Session) -> LandFeatureDetailResponse:
    """Add detailed information to a feature response."""
    response = LandFeatureDetailResponse.model_validate(feature)

    # Add field name
    if feature.field:
        response.field_name = feature.field.name

    # Calculate days until maintenance
    if feature.next_maintenance_due:
        delta = (feature.next_maintenance_due - date.today()).days
        response.days_until_maintenance = delta
        response.maintenance_overdue = delta < 0

    # Recent maintenance logs
    recent_logs = db.query(FeatureMaintenanceLog).filter(
        FeatureMaintenanceLog.feature_id == feature.id
    ).order_by(FeatureMaintenanceLog.maintenance_date.desc()).limit(10).all()

    response.recent_maintenance = []
    for log in recent_logs:
        log_response = FeatureMaintenanceLogResponse.model_validate(log)
        if log.performed_by:
            log_response.performed_by_name = log.performed_by.name
        response.recent_maintenance.append(log_response)

    # Linked grants
    response.linked_grants = []
    for link in (feature.grant_links or []):
        grant = db.query(Grant).filter(Grant.id == link.grant_id).first()
        if grant:
            response.linked_grants.append(GrantResponse.model_validate(grant))

    return response


# ============================================================================
# Feature CRUD
# ============================================================================

@router.get("/", response_model=List[LandFeatureResponse])
def list_features(
    feature_type: Optional[LandFeatureType] = None,
    field_id: Optional[int] = None,
    condition: Optional[FeatureCondition] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """List all land features with optional filtering."""
    query = feature_query(db)

    if feature_type:
        query = query.filter(LandFeature.feature_type == feature_type)
    if field_id:
        query = query.filter(LandFeature.field_id == field_id)
    if condition:
        query = query.filter(LandFeature.current_condition == condition)
    if active_only:
        query = query.filter(LandFeature.is_active == True)

    features = query.order_by(LandFeature.name).all()
    return [enrich_feature(f) for f in features]


@router.post("/", response_model=LandFeatureResponse, status_code=status.HTTP_201_CREATED)
def create_feature(
    feature_data: LandFeatureCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create a new land feature."""
    # Calculate initial next_maintenance_due if frequency provided
    next_due = None
    if feature_data.maintenance_frequency_days:
        next_due = date.today() + timedelta(days=feature_data.maintenance_frequency_days)

    feature = LandFeature(
        **feature_data.model_dump(),
        next_maintenance_due=next_due,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(feature)
    db.commit()
    db.refresh(feature)
    return enrich_feature(feature)


@router.get("/{feature_id}", response_model=LandFeatureDetailResponse)
def get_feature(
    feature_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get a feature with full details."""
    feature = feature_query(db).filter(LandFeature.id == feature_id).first()
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")
    return enrich_feature_detail(feature, db)


@router.put("/{feature_id}", response_model=LandFeatureResponse)
def update_feature(
    feature_id: int,
    feature_data: LandFeatureUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update a land feature."""
    feature = db.query(LandFeature).filter(LandFeature.id == feature_id).first()
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")

    for key, value in feature_data.model_dump(exclude_unset=True).items():
        setattr(feature, key, value)

    feature.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(feature)
    return enrich_feature(feature)


@router.delete("/{feature_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_feature(
    feature_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete a land feature."""
    feature = db.query(LandFeature).filter(LandFeature.id == feature_id).first()
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")

    db.delete(feature)
    db.commit()


# ============================================================================
# Maintenance Logging
# ============================================================================

@router.post("/{feature_id}/maintenance", response_model=FeatureMaintenanceLogResponse, status_code=status.HTTP_201_CREATED)
def log_maintenance(
    feature_id: int,
    log_data: FeatureMaintenanceLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Log a maintenance activity for a feature."""
    feature = db.query(LandFeature).filter(LandFeature.id == feature_id).first()
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")

    # Create log entry
    log = FeatureMaintenanceLog(
        feature_id=feature_id,
        performed_by_id=current_user.id,
        **log_data.model_dump(),
        created_at=datetime.utcnow()
    )
    db.add(log)

    # Update feature
    feature.last_maintenance_date = log_data.maintenance_date
    feature.last_inspection_date = log_data.maintenance_date
    if log_data.condition_after:
        feature.current_condition = log_data.condition_after

    # Recalculate next maintenance due
    if feature.maintenance_frequency_days:
        feature.next_maintenance_due = log_data.maintenance_date + timedelta(
            days=feature.maintenance_frequency_days
        )

    feature.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(log)

    response = FeatureMaintenanceLogResponse.model_validate(log)
    response.performed_by_name = current_user.name
    return response


@router.get("/{feature_id}/maintenance", response_model=List[FeatureMaintenanceLogResponse])
def get_maintenance_history(
    feature_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get maintenance history for a feature."""
    feature = get_or_404(db, LandFeature, feature_id)

    logs = db.query(FeatureMaintenanceLog).options(
        joinedload(FeatureMaintenanceLog.performed_by)
    ).filter(
        FeatureMaintenanceLog.feature_id == feature_id
    ).order_by(FeatureMaintenanceLog.maintenance_date.desc()).limit(limit).all()

    result = []
    for log in logs:
        response = FeatureMaintenanceLogResponse.model_validate(log)
        if log.performed_by:
            response.performed_by_name = log.performed_by.name
        result.append(response)

    return result


@router.get("/maintenance/due", response_model=MaintenanceDueReport)
def get_maintenance_due(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get all features with maintenance due or overdue."""
    today = date.today()
    week_ahead = today + timedelta(days=7)
    month_ahead = today + timedelta(days=30)

    features = db.query(LandFeature).options(
        joinedload(LandFeature.field)
    ).filter(
        LandFeature.is_active == True,
        LandFeature.next_maintenance_due.isnot(None)
    ).all()

    overdue = []
    due_this_week = []
    due_this_month = []

    for f in features:
        if not f.next_maintenance_due:
            continue

        item = MaintenanceDueItem(
            feature_id=f.id,
            feature_name=f.name,
            feature_type=f.feature_type,
            field_name=f.field.name if f.field else None,
            next_maintenance_due=f.next_maintenance_due,
            days_overdue=max(0, (today - f.next_maintenance_due).days),
            current_condition=f.current_condition,
            last_maintenance_date=f.last_maintenance_date
        )

        if f.next_maintenance_due < today:
            overdue.append(item)
        elif f.next_maintenance_due <= week_ahead:
            due_this_week.append(item)
        elif f.next_maintenance_due <= month_ahead:
            due_this_month.append(item)

    # Sort by urgency
    overdue.sort(key=lambda x: x.days_overdue, reverse=True)
    due_this_week.sort(key=lambda x: x.next_maintenance_due)
    due_this_month.sort(key=lambda x: x.next_maintenance_due)

    return MaintenanceDueReport(
        overdue=overdue,
        due_this_week=due_this_week,
        due_this_month=due_this_month
    )


# ============================================================================
# Water Trough Management
# ============================================================================

@router.get("/water-troughs/status", response_model=List[WaterTroughStatus])
def get_water_trough_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get status of all water troughs, highlighting those needing fill."""
    troughs = db.query(LandFeature).options(
        joinedload(LandFeature.field)
    ).filter(
        LandFeature.feature_type == LandFeatureType.WATER_TROUGH,
        LandFeature.is_active == True
    ).order_by(LandFeature.name).all()

    today = date.today()
    result = []

    for t in troughs:
        days_since = None
        needs_fill = False

        if t.last_fill_date:
            days_since = (today - t.last_fill_date).days
            # Mark as needing fill if overdue based on frequency
            if t.fill_frequency_days and days_since >= t.fill_frequency_days:
                needs_fill = True
        elif t.water_source_type == WaterSourceType.MANUAL_FILL:
            # Never filled but is manual = definitely needs fill
            needs_fill = True

        result.append(WaterTroughStatus(
            id=t.id,
            name=t.name,
            field_id=t.field_id,
            field_name=t.field.name if t.field else None,
            water_source_type=t.water_source_type or WaterSourceType.MANUAL_FILL,
            fill_frequency_days=t.fill_frequency_days,
            last_fill_date=t.last_fill_date,
            days_since_fill=days_since,
            needs_fill=needs_fill,
            current_condition=t.current_condition
        ))

    # Sort: needing fill first, then by days since last fill
    result.sort(key=lambda x: (not x.needs_fill, -(x.days_since_fill or 0)))
    return result


@router.post("/{feature_id}/record-fill", response_model=LandFeatureResponse)
def record_water_fill(
    feature_id: int,
    fill_data: RecordFillRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Record that a water trough has been filled."""
    feature = db.query(LandFeature).filter(LandFeature.id == feature_id).first()
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")

    if feature.feature_type != LandFeatureType.WATER_TROUGH:
        raise HTTPException(status_code=400, detail="Feature is not a water trough")

    fill_date = fill_data.fill_date or date.today()
    feature.last_fill_date = fill_date
    feature.updated_at = datetime.utcnow()

    # Log as maintenance
    log = FeatureMaintenanceLog(
        feature_id=feature_id,
        maintenance_date=fill_date,
        maintenance_type=MaintenanceType.FILL,
        description="Water trough filled",
        performed_by_id=current_user.id,
        notes=fill_data.notes,
        created_at=datetime.utcnow()
    )
    db.add(log)

    db.commit()
    db.refresh(feature)
    return enrich_feature(feature)


# ============================================================================
# Fence Status & Inspection
# ============================================================================

@router.get("/fences/status", response_model=List[FenceStatus])
def get_fence_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get status of all fences including electric fence checks."""
    fence_types = [
        LandFeatureType.BOUNDARY_FENCE,
        LandFeatureType.ELECTRIC_FENCE,
        LandFeatureType.POST_AND_RAIL
    ]

    fences = db.query(LandFeature).options(
        joinedload(LandFeature.field)
    ).filter(
        LandFeature.feature_type.in_(fence_types),
        LandFeature.is_active == True
    ).order_by(LandFeature.name).all()

    today = date.today()
    result = []

    for f in fences:
        is_electric = f.feature_type == LandFeatureType.ELECTRIC_FENCE
        voltage_check_overdue = False

        if is_electric and f.electric_fence_voltage_check_date:
            # Electric fences should be checked weekly
            days_since_check = (today - f.electric_fence_voltage_check_date).days
            voltage_check_overdue = days_since_check >= 7

        result.append(FenceStatus(
            id=f.id,
            name=f.name,
            feature_type=f.feature_type,
            field_id=f.field_id,
            field_name=f.field.name if f.field else None,
            current_condition=f.current_condition,
            last_inspection_date=f.last_inspection_date,
            next_maintenance_due=f.next_maintenance_due,
            is_electric=is_electric,
            electric_fence_working=f.electric_fence_working if is_electric else True,
            electric_fence_voltage=f.electric_fence_voltage if is_electric else None,
            voltage_check_date=f.electric_fence_voltage_check_date if is_electric else None,
            voltage_check_overdue=voltage_check_overdue
        ))

    # Sort: problems first (not working, check overdue)
    result.sort(key=lambda x: (
        x.electric_fence_working,
        not x.voltage_check_overdue,
        x.name
    ))

    return result


@router.post("/{feature_id}/fence-check", response_model=LandFeatureResponse)
def record_fence_check(
    feature_id: int,
    check_data: RecordFenceCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Record a fence inspection/check."""
    feature = db.query(LandFeature).filter(LandFeature.id == feature_id).first()
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")

    fence_types = [
        LandFeatureType.BOUNDARY_FENCE,
        LandFeatureType.ELECTRIC_FENCE,
        LandFeatureType.POST_AND_RAIL
    ]
    if feature.feature_type not in fence_types:
        raise HTTPException(status_code=400, detail="Feature is not a fence")

    check_date = check_data.check_date or date.today()
    feature.last_inspection_date = check_date
    feature.current_condition = check_data.condition

    # Electric fence specific
    if feature.feature_type == LandFeatureType.ELECTRIC_FENCE:
        if check_data.electric_working is not None:
            feature.electric_fence_working = check_data.electric_working
        if check_data.voltage is not None:
            feature.electric_fence_voltage = check_data.voltage
        feature.electric_fence_voltage_check_date = check_date

    feature.updated_at = datetime.utcnow()

    # Log as maintenance
    description = f"Fence inspection - Condition: {check_data.condition.value}"
    if feature.feature_type == LandFeatureType.ELECTRIC_FENCE:
        description += f", Working: {check_data.electric_working}"
        if check_data.voltage:
            description += f", Voltage: {check_data.voltage}V"

    log = FeatureMaintenanceLog(
        feature_id=feature_id,
        maintenance_date=check_date,
        maintenance_type=MaintenanceType.INSPECTION if feature.feature_type != LandFeatureType.ELECTRIC_FENCE else MaintenanceType.VOLTAGE_CHECK,
        description=description,
        condition_after=check_data.condition,
        performed_by_id=current_user.id,
        notes=check_data.notes,
        created_at=datetime.utcnow()
    )
    db.add(log)

    db.commit()
    db.refresh(feature)
    return enrich_feature(feature)


# ============================================================================
# Enums
# ============================================================================

@router.get("/enums/all", response_model=LandManagementEnums)
def get_all_enums():
    """Get all land management enums for frontend dropdowns."""
    from app.models.land_management import (
        GrantSchemeType, GrantStatus, GrantPaymentStatus,
        LandFeatureType, FeatureCondition, WaterSourceType,
        MaintenanceType, FloodRiskLevel, SuggestionType, SuggestionPriority
    )

    def enum_to_list(enum_class):
        return [
            {"value": e.value, "label": e.value.replace("_", " ").title()}
            for e in enum_class
        ]

    return LandManagementEnums(
        grant_scheme_types=enum_to_list(GrantSchemeType),
        grant_statuses=enum_to_list(GrantStatus),
        payment_statuses=enum_to_list(GrantPaymentStatus),
        feature_types=enum_to_list(LandFeatureType),
        feature_conditions=enum_to_list(FeatureCondition),
        water_source_types=enum_to_list(WaterSourceType),
        maintenance_types=enum_to_list(MaintenanceType),
        flood_risk_levels=enum_to_list(FloodRiskLevel),
        suggestion_types=enum_to_list(SuggestionType),
        suggestion_priorities=enum_to_list(SuggestionPriority),
    )


@router.get("/enums/feature-types")
def get_feature_types():
    """Get all land feature types."""
    return [
        {"value": t.value, "label": t.value.replace("_", " ").title()}
        for t in LandFeatureType
    ]


@router.get("/enums/conditions")
def get_conditions():
    """Get all feature conditions."""
    return [
        {"value": c.value, "label": c.value.title()}
        for c in FeatureCondition
    ]

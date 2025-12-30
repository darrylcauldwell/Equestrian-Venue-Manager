from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract

from app.database import get_db
from app.models.horse import Horse
from app.models.stable import Stable
from app.models.health_record import (
    FarrierRecord,
    DentistRecord,
    VaccinationRecord,
    WormingRecord,
    WeightRecord,
    BodyConditionRecord,
    Saddle,
    SaddleFitRecord,
    PhysioRecord,
)
from app.models.emergency_contact import EmergencyContact, ContactType
from app.models.user import User, UserRole
from app.schemas.health_record import (
    FarrierRecordCreate,
    FarrierRecordUpdate,
    FarrierRecordResponse,
    DentistRecordCreate,
    DentistRecordUpdate,
    DentistRecordResponse,
    VaccinationRecordCreate,
    VaccinationRecordUpdate,
    VaccinationRecordResponse,
    WormingRecordCreate,
    WormingRecordUpdate,
    WormingRecordResponse,
    WeightRecordCreate,
    WeightRecordUpdate,
    WeightRecordResponse,
    BodyConditionRecordCreate,
    BodyConditionRecordUpdate,
    BodyConditionRecordResponse,
    SaddleCreate,
    SaddleUpdate,
    SaddleResponse,
    SaddleFitRecordCreate,
    SaddleFitRecordUpdate,
    SaddleFitRecordResponse,
    PhysioRecordCreate,
    PhysioRecordUpdate,
    PhysioRecordResponse,
    HealthRecordsSummary,
    BulkWormCountCreate,
    BulkWormCountResult,
    HorseWormCountStatus,
    WormingReportResponse,
    WormingYearSummary,
    WormCountByCategory,
    WormingTrendPoint,
    VaccinationAlert,
)
from app.schemas.emergency_contact import (
    EmergencyContactCreate,
    EmergencyContactUpdate,
    EmergencyContactResponse,
    EmergencyContactSummary,
)
from app.utils.auth import get_current_user

router = APIRouter()


def get_horse_with_access(
    horse_id: int,
    current_user: User,
    db: Session,
    allow_staff: bool = True
) -> Horse:
    """Get horse and verify user has access to it."""
    horse = db.query(Horse).filter(Horse.id == horse_id).first()
    if not horse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Horse not found"
        )

    # Owner always has access
    if horse.owner_id == current_user.id:
        return horse

    # Admin can view/edit all horses
    if allow_staff and current_user.role == UserRole.ADMIN:
        return horse

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not authorized to access this horse's records"
    )


# ============== Health Records Summary ==============

@router.get("/{horse_id}/summary", response_model=HealthRecordsSummary)
def get_health_summary(
    horse_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get complete health records summary for a horse."""
    horse = get_horse_with_access(horse_id, current_user, db)

    farrier_records = db.query(FarrierRecord).filter(
        FarrierRecord.horse_id == horse_id
    ).order_by(FarrierRecord.visit_date.desc()).all()

    dentist_records = db.query(DentistRecord).filter(
        DentistRecord.horse_id == horse_id
    ).order_by(DentistRecord.visit_date.desc()).all()

    vaccination_records = db.query(VaccinationRecord).filter(
        VaccinationRecord.horse_id == horse_id
    ).order_by(VaccinationRecord.vaccination_date.desc()).all()

    worming_records = db.query(WormingRecord).filter(
        WormingRecord.horse_id == horse_id
    ).order_by(WormingRecord.treatment_date.desc()).all()

    weight_records = db.query(WeightRecord).filter(
        WeightRecord.horse_id == horse_id
    ).order_by(WeightRecord.record_date.desc()).all()

    body_condition_records = db.query(BodyConditionRecord).filter(
        BodyConditionRecord.horse_id == horse_id
    ).order_by(BodyConditionRecord.record_date.desc()).all()

    saddle_fit_records = db.query(SaddleFitRecord).filter(
        SaddleFitRecord.horse_id == horse_id
    ).order_by(SaddleFitRecord.check_date.desc()).all()

    physio_records = db.query(PhysioRecord).filter(
        PhysioRecord.horse_id == horse_id
    ).order_by(PhysioRecord.session_date.desc()).all()

    # Get next due dates (most recent record with next_due set)
    next_farrier = farrier_records[0].next_due if farrier_records and farrier_records[0].next_due else None
    next_dentist = dentist_records[0].next_due if dentist_records and dentist_records[0].next_due else None
    next_vaccination = vaccination_records[0].next_due if vaccination_records and vaccination_records[0].next_due else None
    next_worming = worming_records[0].next_due if worming_records and worming_records[0].next_due else None
    next_saddle_check = saddle_fit_records[0].next_check_due if saddle_fit_records and saddle_fit_records[0].next_check_due else None
    next_physio = physio_records[0].next_session_due if physio_records and physio_records[0].next_session_due else None

    # Get latest weight and BCS
    latest_weight = weight_records[0] if weight_records else None
    latest_bcs = body_condition_records[0] if body_condition_records else None

    return HealthRecordsSummary(
        horse_id=horse.id,
        horse_name=horse.name,
        farrier_records=farrier_records,
        dentist_records=dentist_records,
        vaccination_records=vaccination_records,
        worming_records=worming_records,
        weight_records=weight_records,
        body_condition_records=body_condition_records,
        saddle_fit_records=saddle_fit_records,
        physio_records=physio_records,
        next_farrier_due=next_farrier,
        next_dentist_due=next_dentist,
        next_vaccination_due=next_vaccination,
        next_worming_due=next_worming,
        next_saddle_check_due=next_saddle_check,
        next_physio_due=next_physio,
        latest_weight=latest_weight,
        latest_bcs=latest_bcs,
    )


# ============== Vaccination Alerts ==============

@router.get("/vaccinations/upcoming", response_model=List[VaccinationAlert])
def get_upcoming_vaccinations(
    days_ahead: int = Query(default=14, ge=1, le=90, description="Days ahead to check"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get upcoming and overdue vaccinations for the current user's horses."""
    today = date.today()

    # Get horses based on user role
    if current_user.role == UserRole.ADMIN:
        # Admin sees all active horses
        horses = db.query(Horse).filter(
            (Horse.livery_end_date == None) | (Horse.livery_end_date >= today)
        ).all()
    else:
        # Livery user sees only their horses
        horses = db.query(Horse).filter(Horse.owner_id == current_user.id).all()

    alerts = []
    for horse in horses:
        # Get the most recent vaccination record for each vaccine type
        vaccine_types_seen = set()
        records = db.query(VaccinationRecord).filter(
            VaccinationRecord.horse_id == horse.id,
            VaccinationRecord.next_due.isnot(None)
        ).order_by(VaccinationRecord.vaccination_date.desc()).all()

        for record in records:
            # Only check the latest record for each vaccine type
            if record.vaccine_type.value in vaccine_types_seen:
                continue
            vaccine_types_seen.add(record.vaccine_type.value)

            days_until = (record.next_due - today).days
            is_overdue = days_until < 0

            # Include if overdue or due within days_ahead
            if days_until <= days_ahead:
                alerts.append(VaccinationAlert(
                    horse_id=horse.id,
                    horse_name=horse.name,
                    vaccine_type=record.vaccine_type.value,
                    vaccine_name=record.vaccine_name,
                    last_vaccination_date=record.vaccination_date,
                    next_due=record.next_due,
                    days_until_due=days_until,
                    is_overdue=is_overdue,
                ))

    # Sort by days_until_due (overdue first, then nearest due)
    alerts.sort(key=lambda x: x.days_until_due)
    return alerts


# ============== Farrier Records ==============

@router.get("/{horse_id}/farrier", response_model=List[FarrierRecordResponse])
def list_farrier_records(
    horse_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all farrier records for a horse."""
    horse = get_horse_with_access(horse_id, current_user, db)
    return db.query(FarrierRecord).filter(
        FarrierRecord.horse_id == horse_id
    ).order_by(FarrierRecord.visit_date.desc()).all()


@router.post("/{horse_id}/farrier", response_model=FarrierRecordResponse, status_code=status.HTTP_201_CREATED)
def create_farrier_record(
    horse_id: int,
    record_data: FarrierRecordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new farrier record."""
    horse = get_horse_with_access(horse_id, current_user, db)
    record = FarrierRecord(horse_id=horse_id, **record_data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.put("/{horse_id}/farrier/{record_id}", response_model=FarrierRecordResponse)
def update_farrier_record(
    horse_id: int,
    record_id: int,
    record_data: FarrierRecordUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a farrier record."""
    horse = get_horse_with_access(horse_id, current_user, db)
    record = db.query(FarrierRecord).filter(
        FarrierRecord.id == record_id,
        FarrierRecord.horse_id == horse_id
    ).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    update_data = record_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)
    return record


@router.delete("/{horse_id}/farrier/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_farrier_record(
    horse_id: int,
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a farrier record."""
    horse = get_horse_with_access(horse_id, current_user, db)
    record = db.query(FarrierRecord).filter(
        FarrierRecord.id == record_id,
        FarrierRecord.horse_id == horse_id
    ).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    db.delete(record)
    db.commit()


# ============== Dentist Records ==============

@router.get("/{horse_id}/dentist", response_model=List[DentistRecordResponse])
def list_dentist_records(
    horse_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all dentist records for a horse."""
    horse = get_horse_with_access(horse_id, current_user, db)
    return db.query(DentistRecord).filter(
        DentistRecord.horse_id == horse_id
    ).order_by(DentistRecord.visit_date.desc()).all()


@router.post("/{horse_id}/dentist", response_model=DentistRecordResponse, status_code=status.HTTP_201_CREATED)
def create_dentist_record(
    horse_id: int,
    record_data: DentistRecordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new dentist record."""
    horse = get_horse_with_access(horse_id, current_user, db)
    record = DentistRecord(horse_id=horse_id, **record_data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.put("/{horse_id}/dentist/{record_id}", response_model=DentistRecordResponse)
def update_dentist_record(
    horse_id: int,
    record_id: int,
    record_data: DentistRecordUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a dentist record."""
    horse = get_horse_with_access(horse_id, current_user, db)
    record = db.query(DentistRecord).filter(
        DentistRecord.id == record_id,
        DentistRecord.horse_id == horse_id
    ).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    update_data = record_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)
    return record


@router.delete("/{horse_id}/dentist/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dentist_record(
    horse_id: int,
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a dentist record."""
    horse = get_horse_with_access(horse_id, current_user, db)
    record = db.query(DentistRecord).filter(
        DentistRecord.id == record_id,
        DentistRecord.horse_id == horse_id
    ).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    db.delete(record)
    db.commit()


# ============== Vaccination Records ==============

@router.get("/{horse_id}/vaccination", response_model=List[VaccinationRecordResponse])
def list_vaccination_records(
    horse_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all vaccination records for a horse."""
    horse = get_horse_with_access(horse_id, current_user, db)
    return db.query(VaccinationRecord).filter(
        VaccinationRecord.horse_id == horse_id
    ).order_by(VaccinationRecord.vaccination_date.desc()).all()


@router.post("/{horse_id}/vaccination", response_model=VaccinationRecordResponse, status_code=status.HTTP_201_CREATED)
def create_vaccination_record(
    horse_id: int,
    record_data: VaccinationRecordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new vaccination record."""
    horse = get_horse_with_access(horse_id, current_user, db)
    record = VaccinationRecord(horse_id=horse_id, **record_data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.put("/{horse_id}/vaccination/{record_id}", response_model=VaccinationRecordResponse)
def update_vaccination_record(
    horse_id: int,
    record_id: int,
    record_data: VaccinationRecordUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a vaccination record."""
    horse = get_horse_with_access(horse_id, current_user, db)
    record = db.query(VaccinationRecord).filter(
        VaccinationRecord.id == record_id,
        VaccinationRecord.horse_id == horse_id
    ).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    update_data = record_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)
    return record


@router.delete("/{horse_id}/vaccination/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vaccination_record(
    horse_id: int,
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a vaccination record."""
    horse = get_horse_with_access(horse_id, current_user, db)
    record = db.query(VaccinationRecord).filter(
        VaccinationRecord.id == record_id,
        VaccinationRecord.horse_id == horse_id
    ).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    db.delete(record)
    db.commit()


# ============== Worming Records ==============

@router.get("/{horse_id}/worming", response_model=List[WormingRecordResponse])
def list_worming_records(
    horse_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all worming records for a horse."""
    horse = get_horse_with_access(horse_id, current_user, db)
    return db.query(WormingRecord).filter(
        WormingRecord.horse_id == horse_id
    ).order_by(WormingRecord.treatment_date.desc()).all()


@router.post("/{horse_id}/worming", response_model=WormingRecordResponse, status_code=status.HTTP_201_CREATED)
def create_worming_record(
    horse_id: int,
    record_data: WormingRecordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new worming record."""
    horse = get_horse_with_access(horse_id, current_user, db)
    record = WormingRecord(horse_id=horse_id, **record_data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.put("/{horse_id}/worming/{record_id}", response_model=WormingRecordResponse)
def update_worming_record(
    horse_id: int,
    record_id: int,
    record_data: WormingRecordUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a worming record."""
    horse = get_horse_with_access(horse_id, current_user, db)
    record = db.query(WormingRecord).filter(
        WormingRecord.id == record_id,
        WormingRecord.horse_id == horse_id
    ).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    update_data = record_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)
    return record


@router.delete("/{horse_id}/worming/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_worming_record(
    horse_id: int,
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a worming record."""
    horse = get_horse_with_access(horse_id, current_user, db)
    record = db.query(WormingRecord).filter(
        WormingRecord.id == record_id,
        WormingRecord.horse_id == horse_id
    ).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    db.delete(record)
    db.commit()


# ============== Weight Records ==============

@router.get("/{horse_id}/weight", response_model=List[WeightRecordResponse])
def list_weight_records(
    horse_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all weight records for a horse."""
    horse = get_horse_with_access(horse_id, current_user, db)
    return db.query(WeightRecord).filter(
        WeightRecord.horse_id == horse_id
    ).order_by(WeightRecord.record_date.desc()).all()


@router.post("/{horse_id}/weight", response_model=WeightRecordResponse, status_code=status.HTTP_201_CREATED)
def create_weight_record(
    horse_id: int,
    record_data: WeightRecordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new weight record."""
    horse = get_horse_with_access(horse_id, current_user, db)
    record = WeightRecord(horse_id=horse_id, **record_data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.put("/{horse_id}/weight/{record_id}", response_model=WeightRecordResponse)
def update_weight_record(
    horse_id: int,
    record_id: int,
    record_data: WeightRecordUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a weight record."""
    horse = get_horse_with_access(horse_id, current_user, db)
    record = db.query(WeightRecord).filter(
        WeightRecord.id == record_id,
        WeightRecord.horse_id == horse_id
    ).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    update_data = record_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)
    return record


@router.delete("/{horse_id}/weight/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_weight_record(
    horse_id: int,
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a weight record."""
    horse = get_horse_with_access(horse_id, current_user, db)
    record = db.query(WeightRecord).filter(
        WeightRecord.id == record_id,
        WeightRecord.horse_id == horse_id
    ).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    db.delete(record)
    db.commit()


# ============== Body Condition Records ==============

@router.get("/{horse_id}/body-condition", response_model=List[BodyConditionRecordResponse])
def list_body_condition_records(
    horse_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all body condition records for a horse."""
    horse = get_horse_with_access(horse_id, current_user, db)
    return db.query(BodyConditionRecord).filter(
        BodyConditionRecord.horse_id == horse_id
    ).order_by(BodyConditionRecord.record_date.desc()).all()


@router.post("/{horse_id}/body-condition", response_model=BodyConditionRecordResponse, status_code=status.HTTP_201_CREATED)
def create_body_condition_record(
    horse_id: int,
    record_data: BodyConditionRecordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new body condition record."""
    horse = get_horse_with_access(horse_id, current_user, db)
    # Validate score is 1-9
    if record_data.score < 1 or record_data.score > 9:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Body condition score must be between 1 and 9 (Henneke scale)"
        )
    record = BodyConditionRecord(horse_id=horse_id, **record_data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.put("/{horse_id}/body-condition/{record_id}", response_model=BodyConditionRecordResponse)
def update_body_condition_record(
    horse_id: int,
    record_id: int,
    record_data: BodyConditionRecordUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a body condition record."""
    horse = get_horse_with_access(horse_id, current_user, db)
    record = db.query(BodyConditionRecord).filter(
        BodyConditionRecord.id == record_id,
        BodyConditionRecord.horse_id == horse_id
    ).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    update_data = record_data.model_dump(exclude_unset=True)
    # Validate score if provided
    if "score" in update_data and (update_data["score"] < 1 or update_data["score"] > 9):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Body condition score must be between 1 and 9 (Henneke scale)"
        )
    for field, value in update_data.items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)
    return record


@router.delete("/{horse_id}/body-condition/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_body_condition_record(
    horse_id: int,
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a body condition record."""
    horse = get_horse_with_access(horse_id, current_user, db)
    record = db.query(BodyConditionRecord).filter(
        BodyConditionRecord.id == record_id,
        BodyConditionRecord.horse_id == horse_id
    ).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    db.delete(record)
    db.commit()


# ============== Saddles ==============

@router.get("/{horse_id}/saddles", response_model=List[SaddleResponse])
def list_saddles(
    horse_id: int,
    include_inactive: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all saddles for a horse."""
    horse = get_horse_with_access(horse_id, current_user, db)
    query = db.query(Saddle).filter(Saddle.horse_id == horse_id)
    if not include_inactive:
        query = query.filter(Saddle.is_active == 1)
    return query.order_by(Saddle.name).all()


@router.get("/{horse_id}/saddles/{saddle_id}", response_model=SaddleResponse)
def get_saddle(
    horse_id: int,
    saddle_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific saddle."""
    horse = get_horse_with_access(horse_id, current_user, db)
    saddle = db.query(Saddle).filter(
        Saddle.id == saddle_id,
        Saddle.horse_id == horse_id
    ).first()
    if not saddle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saddle not found")
    return saddle


@router.post("/{horse_id}/saddles", response_model=SaddleResponse, status_code=status.HTTP_201_CREATED)
def create_saddle(
    horse_id: int,
    saddle_data: SaddleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new saddle for a horse."""
    horse = get_horse_with_access(horse_id, current_user, db)
    # Validate saddle_type
    valid_types = ["gp", "dressage", "jump", "endurance", "other"]
    if saddle_data.saddle_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Saddle type must be one of: {', '.join(valid_types)}"
        )
    saddle = Saddle(horse_id=horse_id, **saddle_data.model_dump())
    db.add(saddle)
    db.commit()
    db.refresh(saddle)
    return saddle


@router.put("/{horse_id}/saddles/{saddle_id}", response_model=SaddleResponse)
def update_saddle(
    horse_id: int,
    saddle_id: int,
    saddle_data: SaddleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a saddle."""
    horse = get_horse_with_access(horse_id, current_user, db)
    saddle = db.query(Saddle).filter(
        Saddle.id == saddle_id,
        Saddle.horse_id == horse_id
    ).first()
    if not saddle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saddle not found")

    update_data = saddle_data.model_dump(exclude_unset=True)
    # Validate saddle_type if provided
    valid_types = ["gp", "dressage", "jump", "endurance", "other"]
    if "saddle_type" in update_data and update_data["saddle_type"] not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Saddle type must be one of: {', '.join(valid_types)}"
        )
    for field, value in update_data.items():
        setattr(saddle, field, value)

    db.commit()
    db.refresh(saddle)
    return saddle


@router.delete("/{horse_id}/saddles/{saddle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saddle(
    horse_id: int,
    saddle_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a saddle. Will set saddle_id to null on related fit records."""
    horse = get_horse_with_access(horse_id, current_user, db)
    saddle = db.query(Saddle).filter(
        Saddle.id == saddle_id,
        Saddle.horse_id == horse_id
    ).first()
    if not saddle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saddle not found")

    db.delete(saddle)
    db.commit()


# ============== Saddle Fit Records ==============

@router.get("/{horse_id}/saddle-fit", response_model=List[SaddleFitRecordResponse])
def list_saddle_fit_records(
    horse_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all saddle fit records for a horse."""
    horse = get_horse_with_access(horse_id, current_user, db)
    return db.query(SaddleFitRecord).options(
        joinedload(SaddleFitRecord.saddle)
    ).filter(
        SaddleFitRecord.horse_id == horse_id
    ).order_by(SaddleFitRecord.check_date.desc()).all()


@router.post("/{horse_id}/saddle-fit", response_model=SaddleFitRecordResponse, status_code=status.HTTP_201_CREATED)
def create_saddle_fit_record(
    horse_id: int,
    record_data: SaddleFitRecordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new saddle fit record."""
    horse = get_horse_with_access(horse_id, current_user, db)
    # Validate fit_status
    valid_statuses = ["good", "needs_adjustment", "needs_replacing"]
    if record_data.fit_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Fit status must be one of: {', '.join(valid_statuses)}"
        )
    record = SaddleFitRecord(horse_id=horse_id, **record_data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.put("/{horse_id}/saddle-fit/{record_id}", response_model=SaddleFitRecordResponse)
def update_saddle_fit_record(
    horse_id: int,
    record_id: int,
    record_data: SaddleFitRecordUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a saddle fit record."""
    horse = get_horse_with_access(horse_id, current_user, db)
    record = db.query(SaddleFitRecord).filter(
        SaddleFitRecord.id == record_id,
        SaddleFitRecord.horse_id == horse_id
    ).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    update_data = record_data.model_dump(exclude_unset=True)
    # Validate fit_status if provided
    valid_statuses = ["good", "needs_adjustment", "needs_replacing"]
    if "fit_status" in update_data and update_data["fit_status"] not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Fit status must be one of: {', '.join(valid_statuses)}"
        )
    for field, value in update_data.items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)
    return record


@router.delete("/{horse_id}/saddle-fit/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saddle_fit_record(
    horse_id: int,
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a saddle fit record."""
    horse = get_horse_with_access(horse_id, current_user, db)
    record = db.query(SaddleFitRecord).filter(
        SaddleFitRecord.id == record_id,
        SaddleFitRecord.horse_id == horse_id
    ).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    db.delete(record)
    db.commit()


# ============== Physio Records ==============

@router.get("/{horse_id}/physio", response_model=List[PhysioRecordResponse])
def list_physio_records(
    horse_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all physio records for a horse."""
    horse = get_horse_with_access(horse_id, current_user, db)
    return db.query(PhysioRecord).filter(
        PhysioRecord.horse_id == horse_id
    ).order_by(PhysioRecord.session_date.desc()).all()


@router.post("/{horse_id}/physio", response_model=PhysioRecordResponse, status_code=status.HTTP_201_CREATED)
def create_physio_record(
    horse_id: int,
    record_data: PhysioRecordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new physio record."""
    horse = get_horse_with_access(horse_id, current_user, db)
    record = PhysioRecord(horse_id=horse_id, **record_data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.put("/{horse_id}/physio/{record_id}", response_model=PhysioRecordResponse)
def update_physio_record(
    horse_id: int,
    record_id: int,
    record_data: PhysioRecordUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a physio record."""
    horse = get_horse_with_access(horse_id, current_user, db)
    record = db.query(PhysioRecord).filter(
        PhysioRecord.id == record_id,
        PhysioRecord.horse_id == horse_id
    ).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    update_data = record_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)
    return record


@router.delete("/{horse_id}/physio/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_physio_record(
    horse_id: int,
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a physio record."""
    horse = get_horse_with_access(horse_id, current_user, db)
    record = db.query(PhysioRecord).filter(
        PhysioRecord.id == record_id,
        PhysioRecord.horse_id == horse_id
    ).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    db.delete(record)
    db.commit()


# ============== Admin Worming Management ==============

# EPG thresholds for categorization
EPG_LOW = 200  # 0-200 EPG = Low (no treatment needed)
EPG_MODERATE = 500  # 201-500 EPG = Moderate (monitor)
EPG_HIGH = 1000  # 501-1000 EPG = High (treatment recommended)
# >1000 = Very High (urgent treatment)


def categorize_epg(epg: Optional[int]) -> str:
    """Categorize EPG result."""
    if epg is None:
        return "not_tested"
    if epg <= EPG_LOW:
        return "low"
    if epg <= EPG_MODERATE:
        return "moderate"
    if epg <= EPG_HIGH:
        return "high"
    return "very_high"


@router.get("/worming/horses", response_model=List[HorseWormCountStatus])
def get_horses_worm_count_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all active horses with their latest worm count status for bulk entry."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    # Get all horses with their owners and stables
    # Filter out horses that have left (livery_end_date in the past)
    horses = db.query(Horse).options(
        joinedload(Horse.owner),
        joinedload(Horse.stable)
    ).filter(
        (Horse.livery_end_date == None) | (Horse.livery_end_date >= date.today())
    ).order_by(Horse.name).all()

    result = []
    for horse in horses:
        # Get latest worming record for this horse
        latest_record = db.query(WormingRecord).filter(
            WormingRecord.horse_id == horse.id
        ).order_by(WormingRecord.treatment_date.desc()).first()

        # Get latest worm count (might be different from latest treatment)
        latest_count = db.query(WormingRecord).filter(
            WormingRecord.horse_id == horse.id,
            WormingRecord.worm_count_date.isnot(None)
        ).order_by(WormingRecord.worm_count_date.desc()).first()

        result.append(HorseWormCountStatus(
            horse_id=horse.id,
            horse_name=horse.name,
            owner_name=horse.owner.name if horse.owner else "Unknown",
            stable_name=horse.stable.name if horse.stable else None,
            last_count_date=latest_count.worm_count_date if latest_count else None,
            last_count_result=latest_count.worm_count_result if latest_count else None,
            last_treatment_date=latest_record.treatment_date if latest_record else None,
            last_product=latest_record.product if latest_record else None,
        ))

    return result


@router.post("/worming/bulk", response_model=BulkWormCountResult)
def bulk_create_worm_counts(
    data: BulkWormCountCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bulk create worm count records for multiple horses."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    created = 0
    updated = 0
    skipped = 0

    for entry in data.entries:
        # Skip entries with no result
        if entry.worm_count_result is None:
            skipped += 1
            continue

        # Verify horse exists
        horse = db.query(Horse).filter(Horse.id == entry.horse_id).first()
        if not horse:
            skipped += 1
            continue

        # Check if there's already a record for this horse on this date
        existing = db.query(WormingRecord).filter(
            WormingRecord.horse_id == entry.horse_id,
            WormingRecord.worm_count_date == data.worm_count_date
        ).first()

        if existing:
            # Update existing record
            existing.worm_count_result = entry.worm_count_result
            if entry.cost is not None:
                existing.cost = entry.cost
            if entry.notes:
                existing.notes = entry.notes
            updated += 1
        else:
            # Create new record (worm count only, no treatment)
            record = WormingRecord(
                horse_id=entry.horse_id,
                treatment_date=data.worm_count_date,  # Use count date as treatment date
                product="Worm Count Test",  # Placeholder product name
                worm_count_date=data.worm_count_date,
                worm_count_result=entry.worm_count_result,
                cost=entry.cost,
                notes=entry.notes,
            )
            db.add(record)
            created += 1

    db.commit()
    return BulkWormCountResult(created=created, updated=updated, skipped=skipped)


@router.get("/worming/report", response_model=WormingReportResponse)
def get_worming_report(
    years: int = Query(default=3, ge=1, le=5, description="Number of years to include in report"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get worming report with trends and statistics."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    current_year = date.today().year

    def get_year_summary(year: int) -> WormingYearSummary:
        """Get summary for a specific year."""
        records = db.query(WormingRecord).filter(
            extract('year', WormingRecord.worm_count_date) == year,
            WormingRecord.worm_count_result.isnot(None)
        ).all()

        if not records:
            return WormingYearSummary(
                year=year,
                total_counts=0,
                average_epg=None,
                horses_tested=0,
                categories=[]
            )

        # Calculate statistics
        epg_values = [r.worm_count_result for r in records]
        horse_ids = set(r.horse_id for r in records)
        avg_epg = sum(epg_values) / len(epg_values) if epg_values else None

        # Categorize results
        cat_counts = {"low": 0, "moderate": 0, "high": 0, "very_high": 0}
        for epg in epg_values:
            cat = categorize_epg(epg)
            if cat in cat_counts:
                cat_counts[cat] += 1

        total = len(epg_values)
        categories = [
            WormCountByCategory(
                category="low",
                min_epg=0,
                max_epg=EPG_LOW,
                count=cat_counts["low"],
                percentage=round(cat_counts["low"] / total * 100, 1) if total > 0 else 0
            ),
            WormCountByCategory(
                category="moderate",
                min_epg=EPG_LOW + 1,
                max_epg=EPG_MODERATE,
                count=cat_counts["moderate"],
                percentage=round(cat_counts["moderate"] / total * 100, 1) if total > 0 else 0
            ),
            WormCountByCategory(
                category="high",
                min_epg=EPG_MODERATE + 1,
                max_epg=EPG_HIGH,
                count=cat_counts["high"],
                percentage=round(cat_counts["high"] / total * 100, 1) if total > 0 else 0
            ),
            WormCountByCategory(
                category="very_high",
                min_epg=EPG_HIGH + 1,
                max_epg=None,
                count=cat_counts["very_high"],
                percentage=round(cat_counts["very_high"] / total * 100, 1) if total > 0 else 0
            ),
        ]

        return WormingYearSummary(
            year=year,
            total_counts=total,
            average_epg=round(avg_epg, 1) if avg_epg else None,
            horses_tested=len(horse_ids),
            categories=categories
        )

    # Get current year summary
    current_year_summary = get_year_summary(current_year)

    # Get previous years
    previous_years = [get_year_summary(current_year - i) for i in range(1, years)]

    # Calculate half-yearly trends for the past few years
    trends = []
    for year in range(current_year - years + 1, current_year + 1):
        for half in [1, 2]:
            if half == 1:
                start_month, end_month = 1, 6
                period = f"{year}-H1"
            else:
                start_month, end_month = 7, 12
                period = f"{year}-H2"

            # Skip future periods
            if year == current_year and half == 2 and date.today().month <= 6:
                continue

            records = db.query(WormingRecord).filter(
                extract('year', WormingRecord.worm_count_date) == year,
                extract('month', WormingRecord.worm_count_date) >= start_month,
                extract('month', WormingRecord.worm_count_date) <= end_month,
                WormingRecord.worm_count_result.isnot(None)
            ).all()

            if records:
                epg_values = [r.worm_count_result for r in records]
                avg = sum(epg_values) / len(epg_values)
                cat_counts = {"low": 0, "moderate": 0, "high": 0}
                for epg in epg_values:
                    cat = categorize_epg(epg)
                    if cat == "low":
                        cat_counts["low"] += 1
                    elif cat == "moderate":
                        cat_counts["moderate"] += 1
                    else:  # high or very_high
                        cat_counts["high"] += 1

                trends.append(WormingTrendPoint(
                    period=period,
                    average_epg=round(avg, 1),
                    count=len(records),
                    low_count=cat_counts["low"],
                    moderate_count=cat_counts["moderate"],
                    high_count=cat_counts["high"]
                ))

    # Get horses needing treatment (high EPG in latest count)
    horses_needing_treatment = []
    horses = db.query(Horse).filter(
        (Horse.livery_end_date == None) | (Horse.livery_end_date >= date.today())
    ).all()
    for horse in horses:
        latest_count = db.query(WormingRecord).filter(
            WormingRecord.horse_id == horse.id,
            WormingRecord.worm_count_result.isnot(None)
        ).order_by(WormingRecord.worm_count_date.desc()).first()

        if latest_count and latest_count.worm_count_result > EPG_MODERATE:
            owner = db.query(User).filter(User.id == horse.owner_id).first()
            stable = db.query(Stable).filter(Stable.id == horse.stable_id).first() if horse.stable_id else None
            horses_needing_treatment.append(HorseWormCountStatus(
                horse_id=horse.id,
                horse_name=horse.name,
                owner_name=owner.name if owner else "Unknown",
                stable_name=stable.name if stable else None,
                last_count_date=latest_count.worm_count_date,
                last_count_result=latest_count.worm_count_result,
                last_treatment_date=latest_count.treatment_date,
                last_product=latest_count.product,
            ))

    return WormingReportResponse(
        current_year=current_year_summary,
        previous_years=previous_years,
        trends=trends,
        horses_needing_treatment=horses_needing_treatment
    )


# ============== Emergency Contacts ==============

def enrich_contact(contact: EmergencyContact, db: Session) -> EmergencyContactResponse:
    """Add created_by_name to contact response."""
    response = EmergencyContactResponse.model_validate(contact)
    if contact.created_by:
        response.created_by_name = contact.created_by.name
    return response


@router.get("/{horse_id}/emergency-contacts", response_model=list[EmergencyContactResponse])
def list_emergency_contacts(
    horse_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all emergency contacts for a horse."""
    horse = get_horse_with_access(horse_id, current_user, db)
    contacts = db.query(EmergencyContact).filter(
        EmergencyContact.horse_id == horse_id
    ).order_by(EmergencyContact.contact_type, EmergencyContact.is_primary.desc()).all()
    return [enrich_contact(c, db) for c in contacts]


@router.get("/{horse_id}/emergency-contacts/summary", response_model=EmergencyContactSummary)
def get_emergency_contacts_summary(
    horse_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get emergency contacts summary with primary contacts for each type."""
    horse = get_horse_with_access(horse_id, current_user, db)
    contacts = db.query(EmergencyContact).filter(
        EmergencyContact.horse_id == horse_id
    ).all()

    # Find primary contacts by type
    primary_vet = next((c for c in contacts if c.contact_type == ContactType.VET and c.is_primary), None)
    backup_vet = next((c for c in contacts if c.contact_type == ContactType.VET_BACKUP), None)
    primary_farrier = next((c for c in contacts if c.contact_type == ContactType.FARRIER and c.is_primary), None)
    backup_owner = next((c for c in contacts if c.contact_type == ContactType.OWNER_BACKUP), None)

    return EmergencyContactSummary(
        horse_id=horse.id,
        horse_name=horse.name,
        primary_vet=enrich_contact(primary_vet, db) if primary_vet else None,
        backup_vet=enrich_contact(backup_vet, db) if backup_vet else None,
        primary_farrier=enrich_contact(primary_farrier, db) if primary_farrier else None,
        backup_owner=enrich_contact(backup_owner, db) if backup_owner else None,
        all_contacts=[enrich_contact(c, db) for c in contacts]
    )


@router.post("/{horse_id}/emergency-contacts", response_model=EmergencyContactResponse, status_code=status.HTTP_201_CREATED)
def create_emergency_contact(
    horse_id: int,
    contact_data: EmergencyContactCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new emergency contact for a horse."""
    horse = get_horse_with_access(horse_id, current_user, db)

    # If setting as primary, unset other primary contacts of same type
    if contact_data.is_primary:
        db.query(EmergencyContact).filter(
            EmergencyContact.horse_id == horse_id,
            EmergencyContact.contact_type == contact_data.contact_type,
            EmergencyContact.is_primary == True
        ).update({"is_primary": False})

    contact = EmergencyContact(
        horse_id=horse_id,
        created_by_id=current_user.id,
        **contact_data.model_dump()
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return enrich_contact(contact, db)


@router.put("/{horse_id}/emergency-contacts/{contact_id}", response_model=EmergencyContactResponse)
def update_emergency_contact(
    horse_id: int,
    contact_id: int,
    contact_data: EmergencyContactUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an emergency contact."""
    horse = get_horse_with_access(horse_id, current_user, db)
    contact = db.query(EmergencyContact).filter(
        EmergencyContact.id == contact_id,
        EmergencyContact.horse_id == horse_id
    ).first()
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")

    update_data = contact_data.model_dump(exclude_unset=True)

    # If setting as primary, unset other primary contacts of same type
    if update_data.get("is_primary") == True:
        contact_type = update_data.get("contact_type", contact.contact_type)
        db.query(EmergencyContact).filter(
            EmergencyContact.horse_id == horse_id,
            EmergencyContact.contact_type == contact_type,
            EmergencyContact.is_primary == True,
            EmergencyContact.id != contact_id
        ).update({"is_primary": False})

    for field, value in update_data.items():
        setattr(contact, field, value)

    db.commit()
    db.refresh(contact)
    return enrich_contact(contact, db)


@router.delete("/{horse_id}/emergency-contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_emergency_contact(
    horse_id: int,
    contact_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an emergency contact."""
    horse = get_horse_with_access(horse_id, current_user, db)
    contact = db.query(EmergencyContact).filter(
        EmergencyContact.id == contact_id,
        EmergencyContact.horse_id == horse_id
    ).first()
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")

    db.delete(contact)
    db.commit()


@router.put("/{horse_id}/emergency-contacts/{contact_id}/set-primary", response_model=EmergencyContactResponse)
def set_primary_emergency_contact(
    horse_id: int,
    contact_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Set an emergency contact as the primary contact for its type."""
    horse = get_horse_with_access(horse_id, current_user, db)
    contact = db.query(EmergencyContact).filter(
        EmergencyContact.id == contact_id,
        EmergencyContact.horse_id == horse_id
    ).first()
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")

    # Unset other primary contacts of same type
    db.query(EmergencyContact).filter(
        EmergencyContact.horse_id == horse_id,
        EmergencyContact.contact_type == contact.contact_type,
        EmergencyContact.is_primary == True
    ).update({"is_primary": False})

    # Set this contact as primary
    contact.is_primary = True
    db.commit()
    db.refresh(contact)
    return enrich_contact(contact, db)

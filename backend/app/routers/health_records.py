from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.horse import Horse
from app.models.health_record import (
    FarrierRecord,
    DentistRecord,
    VaccinationRecord,
    WormingRecord,
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
    HealthRecordsSummary,
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

    # Get next due dates (most recent record with next_due set)
    next_farrier = farrier_records[0].next_due if farrier_records and farrier_records[0].next_due else None
    next_dentist = dentist_records[0].next_due if dentist_records and dentist_records[0].next_due else None
    next_vaccination = vaccination_records[0].next_due if vaccination_records and vaccination_records[0].next_due else None
    next_worming = worming_records[0].next_due if worming_records and worming_records[0].next_due else None

    return HealthRecordsSummary(
        horse_id=horse.id,
        horse_name=horse.name,
        farrier_records=farrier_records,
        dentist_records=dentist_records,
        vaccination_records=vaccination_records,
        worming_records=worming_records,
        next_farrier_due=next_farrier,
        next_dentist_due=next_dentist,
        next_vaccination_due=next_vaccination,
        next_worming_due=next_worming,
    )


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

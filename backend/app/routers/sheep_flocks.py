"""
Sheep Flock Management API endpoints.

Manages sheep flocks for worm control grazing and their field assignments.
"""
from datetime import date, datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.field import Field
from app.models.land_management import SheepFlock, SheepFlockFieldAssignment
from app.schemas.land_management import (
    SheepFlockCreate, SheepFlockUpdate, SheepFlockResponse,
    SheepFlockFieldAssignmentCreate, SheepFlockFieldAssignmentResponse,
    SheepFlockWithHistory
)
from app.utils.auth import require_roles

router = APIRouter(prefix="/sheep-flocks", tags=["sheep-flocks"])


# ============== Sheep Flock CRUD ==============

@router.get("/", response_model=List[SheepFlockResponse])
async def list_sheep_flocks(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "staff"]))
):
    """List all sheep flocks."""
    query = db.query(SheepFlock)
    if not include_inactive:
        query = query.filter(SheepFlock.is_active == True)
    flocks = query.order_by(SheepFlock.name).all()

    result = []
    for flock in flocks:
        # Get current field assignment
        current_assignment = db.query(SheepFlockFieldAssignment).filter(
            SheepFlockFieldAssignment.flock_id == flock.id,
            SheepFlockFieldAssignment.end_date.is_(None)
        ).first()

        result.append(SheepFlockResponse(
            id=flock.id,
            name=flock.name,
            count=flock.count,
            breed=flock.breed,
            notes=flock.notes,
            is_active=flock.is_active,
            created_at=flock.created_at,
            updated_at=flock.updated_at,
            current_field_id=current_assignment.field_id if current_assignment else None,
            current_field_name=current_assignment.field.name if current_assignment and current_assignment.field else None
        ))

    return result


@router.post("/", response_model=SheepFlockResponse)
async def create_sheep_flock(
    flock_data: SheepFlockCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Create a new sheep flock."""
    flock = SheepFlock(
        name=flock_data.name,
        count=flock_data.count,
        breed=flock_data.breed,
        notes=flock_data.notes
    )
    db.add(flock)
    db.commit()
    db.refresh(flock)

    return SheepFlockResponse(
        id=flock.id,
        name=flock.name,
        count=flock.count,
        breed=flock.breed,
        notes=flock.notes,
        is_active=flock.is_active,
        created_at=flock.created_at,
        updated_at=flock.updated_at,
        current_field_id=None,
        current_field_name=None
    )


@router.get("/{flock_id}", response_model=SheepFlockWithHistory)
async def get_sheep_flock(
    flock_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "staff"]))
):
    """Get a sheep flock with its assignment history."""
    flock = db.query(SheepFlock).filter(SheepFlock.id == flock_id).first()
    if not flock:
        raise HTTPException(status_code=404, detail="Sheep flock not found")

    # Get all assignments, newest first
    assignments = db.query(SheepFlockFieldAssignment).filter(
        SheepFlockFieldAssignment.flock_id == flock_id
    ).order_by(SheepFlockFieldAssignment.start_date.desc()).all()

    # Current assignment is the one without end_date
    current_assignment = next((a for a in assignments if a.end_date is None), None)

    return SheepFlockWithHistory(
        id=flock.id,
        name=flock.name,
        count=flock.count,
        breed=flock.breed,
        notes=flock.notes,
        is_active=flock.is_active,
        created_at=flock.created_at,
        updated_at=flock.updated_at,
        current_field_id=current_assignment.field_id if current_assignment else None,
        current_field_name=current_assignment.field.name if current_assignment and current_assignment.field else None,
        assignment_history=[_assignment_to_response(a) for a in assignments]
    )


@router.put("/{flock_id}", response_model=SheepFlockResponse)
async def update_sheep_flock(
    flock_id: int,
    update: SheepFlockUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Update a sheep flock."""
    flock = db.query(SheepFlock).filter(SheepFlock.id == flock_id).first()
    if not flock:
        raise HTTPException(status_code=404, detail="Sheep flock not found")

    update_data = update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(flock, key, value)

    db.commit()
    db.refresh(flock)

    # Get current assignment
    current_assignment = db.query(SheepFlockFieldAssignment).filter(
        SheepFlockFieldAssignment.flock_id == flock.id,
        SheepFlockFieldAssignment.end_date.is_(None)
    ).first()

    return SheepFlockResponse(
        id=flock.id,
        name=flock.name,
        count=flock.count,
        breed=flock.breed,
        notes=flock.notes,
        is_active=flock.is_active,
        created_at=flock.created_at,
        updated_at=flock.updated_at,
        current_field_id=current_assignment.field_id if current_assignment else None,
        current_field_name=current_assignment.field.name if current_assignment and current_assignment.field else None
    )


@router.delete("/{flock_id}")
async def delete_sheep_flock(
    flock_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Soft delete a sheep flock (sets is_active=False)."""
    flock = db.query(SheepFlock).filter(SheepFlock.id == flock_id).first()
    if not flock:
        raise HTTPException(status_code=404, detail="Sheep flock not found")

    flock.is_active = False

    # Also end any current assignment
    current_assignment = db.query(SheepFlockFieldAssignment).filter(
        SheepFlockFieldAssignment.flock_id == flock_id,
        SheepFlockFieldAssignment.end_date.is_(None)
    ).first()
    if current_assignment:
        current_assignment.end_date = date.today()

    db.commit()

    return {"message": "Sheep flock deactivated"}


# ============== Field Assignments ==============

@router.post("/{flock_id}/assign-field", response_model=SheepFlockFieldAssignmentResponse)
async def assign_flock_to_field(
    flock_id: int,
    assignment_data: SheepFlockFieldAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "staff"]))
):
    """
    Assign a sheep flock to a field.

    If the flock already has a field assignment, it will be ended
    and a new assignment created. This creates automatic history.
    """
    flock = db.query(SheepFlock).filter(SheepFlock.id == flock_id).first()
    if not flock:
        raise HTTPException(status_code=404, detail="Sheep flock not found")
    if not flock.is_active:
        raise HTTPException(status_code=400, detail="Cannot assign inactive flock")

    # Verify field exists
    field = db.query(Field).filter(Field.id == assignment_data.field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    if not field.is_active:
        raise HTTPException(status_code=400, detail="Field is not active")
    if field.is_resting:
        raise HTTPException(status_code=400, detail="Field is currently resting")

    start_date = assignment_data.start_date or date.today()

    # End any current assignment
    current_assignment = db.query(SheepFlockFieldAssignment).filter(
        SheepFlockFieldAssignment.flock_id == flock_id,
        SheepFlockFieldAssignment.end_date.is_(None)
    ).first()

    if current_assignment:
        # End the current assignment the day before the new one starts
        end_date = start_date - timedelta(days=1) if start_date > current_assignment.start_date else current_assignment.start_date
        current_assignment.end_date = end_date

    # Create new assignment
    new_assignment = SheepFlockFieldAssignment(
        flock_id=flock_id,
        field_id=assignment_data.field_id,
        start_date=start_date,
        assigned_by_id=current_user.id,
        notes=assignment_data.notes
    )
    db.add(new_assignment)

    db.commit()
    db.refresh(new_assignment)

    return _assignment_to_response(new_assignment)


@router.delete("/{flock_id}/field-assignment")
async def remove_flock_from_field(
    flock_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "staff"]))
):
    """
    Remove a sheep flock from their current field (ends assignment).

    This does NOT delete the assignment, just sets the end_date.
    """
    flock = db.query(SheepFlock).filter(SheepFlock.id == flock_id).first()
    if not flock:
        raise HTTPException(status_code=404, detail="Sheep flock not found")

    current_assignment = db.query(SheepFlockFieldAssignment).filter(
        SheepFlockFieldAssignment.flock_id == flock_id,
        SheepFlockFieldAssignment.end_date.is_(None)
    ).first()

    if not current_assignment:
        raise HTTPException(status_code=404, detail="Flock has no current field assignment")

    current_assignment.end_date = date.today()

    db.commit()

    return {"message": "Field assignment ended"}


@router.get("/{flock_id}/current-assignment", response_model=Optional[SheepFlockFieldAssignmentResponse])
async def get_flock_current_assignment(
    flock_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "staff"]))
):
    """Get current field assignment for a sheep flock."""
    flock = db.query(SheepFlock).filter(SheepFlock.id == flock_id).first()
    if not flock:
        raise HTTPException(status_code=404, detail="Sheep flock not found")

    current_assignment = db.query(SheepFlockFieldAssignment).filter(
        SheepFlockFieldAssignment.flock_id == flock_id,
        SheepFlockFieldAssignment.end_date.is_(None)
    ).first()

    if not current_assignment:
        return None

    return _assignment_to_response(current_assignment)


@router.get("/{flock_id}/assignment-history", response_model=List[SheepFlockFieldAssignmentResponse])
async def get_flock_assignment_history(
    flock_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "staff"]))
):
    """Get full assignment history for a sheep flock."""
    flock = db.query(SheepFlock).filter(SheepFlock.id == flock_id).first()
    if not flock:
        raise HTTPException(status_code=404, detail="Sheep flock not found")

    assignments = db.query(SheepFlockFieldAssignment).filter(
        SheepFlockFieldAssignment.flock_id == flock_id
    ).order_by(SheepFlockFieldAssignment.start_date.desc()).all()

    return [_assignment_to_response(a) for a in assignments]


def _assignment_to_response(assignment: SheepFlockFieldAssignment) -> SheepFlockFieldAssignmentResponse:
    """Convert SheepFlockFieldAssignment to response schema."""
    return SheepFlockFieldAssignmentResponse(
        id=assignment.id,
        flock_id=assignment.flock_id,
        field_id=assignment.field_id,
        start_date=assignment.start_date,
        end_date=assignment.end_date,
        assigned_by_id=assignment.assigned_by_id,
        notes=assignment.notes,
        created_at=assignment.created_at,
        flock_name=assignment.flock.name if assignment.flock else None,
        field_name=assignment.field.name if assignment.field else None,
        assigned_by_name=assignment.assigned_by.name if assignment.assigned_by else None
    )

from typing import List
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.horse import Horse
from app.models.stable import Stable
from app.models.feed import (
    FeedRequirement,
    FeedAddition,
    FeedSupplyAlert,
    AdditionStatus,
)
from app.models.user import User, UserRole
from app.utils.auth import has_staff_access
from app.schemas.feed import (
    FeedRequirementCreate,
    FeedRequirementUpdate,
    FeedRequirementResponse,
    FeedAdditionCreate,
    FeedAdditionUpdate,
    FeedAdditionResponse,
    FeedSupplyAlertCreate,
    FeedSupplyAlertUpdate,
    FeedSupplyAlertResponse,
    FeedSummary,
    RehabFeedMedication,
)
from app.models.medication_log import RehabProgram, RehabPhase, RehabTask, RehabStatus
from app.utils.auth import get_current_user
from app.services.health_task_generator import HealthTaskGenerator

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

    # Users with staff access can view/edit all horses' feed data
    if allow_staff and has_staff_access(current_user):
        return horse

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not authorized to access this horse's feed records"
    )


# ============== Feed Summary ==============

@router.get("/{horse_id}/feed/summary", response_model=FeedSummary)
def get_feed_summary(
    horse_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get complete feed summary for a horse."""
    horse = get_horse_with_access(horse_id, current_user, db)

    feed_requirement = db.query(FeedRequirement).filter(
        FeedRequirement.horse_id == horse_id
    ).first()

    today = date.today()
    active_additions = db.query(FeedAddition).filter(
        FeedAddition.horse_id == horse_id,
        FeedAddition.status == AdditionStatus.APPROVED,
        FeedAddition.is_active == True,
        FeedAddition.start_date <= today,
        (FeedAddition.end_date >= today) | (FeedAddition.end_date == None)
    ).all()

    pending_additions = db.query(FeedAddition).filter(
        FeedAddition.horse_id == horse_id,
        FeedAddition.status == AdditionStatus.PENDING
    ).all()

    unresolved_alerts = db.query(FeedSupplyAlert).filter(
        FeedSupplyAlert.horse_id == horse_id,
        FeedSupplyAlert.is_resolved == False
    ).all()

    # Get feed-based medications from active rehab programs
    rehab_medications = []
    active_programs = db.query(RehabProgram).filter(
        RehabProgram.horse_id == horse_id,
        RehabProgram.status == RehabStatus.ACTIVE
    ).all()

    for program in active_programs:
        feed_tasks = db.query(RehabTask).join(RehabPhase).filter(
            RehabPhase.program_id == program.id,
            RehabTask.is_feed_based == True
        ).all()

        for task in feed_tasks:
            rehab_medications.append(RehabFeedMedication(
                task_id=task.id,
                program_id=program.id,
                program_name=program.name,
                task_type=task.task_type,
                description=task.description,
                feed_time=task.feed_time,
                instructions=task.instructions,
                frequency=task.frequency.value if task.frequency else "daily"
            ))

    return FeedSummary(
        horse_id=horse.id,
        horse_name=horse.name,
        feed_requirement=feed_requirement,
        active_additions=active_additions,
        pending_additions=pending_additions,
        unresolved_alerts=unresolved_alerts,
        rehab_medications=rehab_medications,
    )


# ============== Feed Requirements ==============

@router.get("/{horse_id}/feed", response_model=FeedRequirementResponse)
def get_feed_requirement(
    horse_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get feed requirements for a horse."""
    horse = get_horse_with_access(horse_id, current_user, db)

    feed_req = db.query(FeedRequirement).filter(
        FeedRequirement.horse_id == horse_id
    ).first()

    if not feed_req:
        # Create empty feed requirement if none exists
        feed_req = FeedRequirement(horse_id=horse_id)
        db.add(feed_req)
        db.commit()
        db.refresh(feed_req)

    return feed_req


@router.put("/{horse_id}/feed", response_model=FeedRequirementResponse)
def update_feed_requirement(
    horse_id: int,
    data: FeedRequirementUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update feed requirements for a horse."""
    horse = get_horse_with_access(horse_id, current_user, db)

    feed_req = db.query(FeedRequirement).filter(
        FeedRequirement.horse_id == horse_id
    ).first()

    if not feed_req:
        feed_req = FeedRequirement(horse_id=horse_id)
        db.add(feed_req)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(feed_req, field, value)

    feed_req.updated_by_id = current_user.id
    db.commit()
    db.refresh(feed_req)
    return feed_req


# ============== Feed Additions ==============

@router.get("/{horse_id}/feed/additions", response_model=List[FeedAdditionResponse])
def list_feed_additions(
    horse_id: int,
    active_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all feed additions for a horse."""
    horse = get_horse_with_access(horse_id, current_user, db)

    query = db.query(FeedAddition).filter(FeedAddition.horse_id == horse_id)

    if active_only:
        today = date.today()
        query = query.filter(
            FeedAddition.status == AdditionStatus.APPROVED,
            FeedAddition.is_active == True,
            FeedAddition.start_date <= today,
            (FeedAddition.end_date >= today) | (FeedAddition.end_date == None)
        )

    additions = query.order_by(FeedAddition.created_at.desc()).all()

    # Add requester name
    for addition in additions:
        if addition.requested_by:
            addition.requested_by_name = addition.requested_by.name

    return additions


@router.post("/{horse_id}/feed/additions", response_model=FeedAdditionResponse, status_code=status.HTTP_201_CREATED)
def create_feed_addition(
    horse_id: int,
    data: FeedAdditionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Request a new feed addition."""
    horse = get_horse_with_access(horse_id, current_user, db)

    # Admin can auto-approve their own additions
    initial_status = AdditionStatus.PENDING
    approved_by_id = None
    if current_user.role == UserRole.ADMIN:
        initial_status = AdditionStatus.APPROVED
        approved_by_id = current_user.id

    addition = FeedAddition(
        horse_id=horse_id,
        requested_by_id=current_user.id,
        status=initial_status,
        approved_by_id=approved_by_id,
        **data.model_dump()
    )
    db.add(addition)
    db.commit()
    db.refresh(addition)

    # Auto-generate medication tasks if approved and starts today or earlier
    if initial_status == AdditionStatus.APPROVED:
        today = date.today()
        if addition.start_date <= today and (addition.end_date is None or addition.end_date >= today):
            generator = HealthTaskGenerator(db, current_user.id)
            generator.generate_medication_tasks(today)
            db.commit()

    addition.requested_by_name = current_user.name
    return addition


@router.put("/{horse_id}/feed/additions/{addition_id}", response_model=FeedAdditionResponse)
def update_feed_addition(
    horse_id: int,
    addition_id: int,
    data: FeedAdditionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a feed addition."""
    horse = get_horse_with_access(horse_id, current_user, db)

    addition = db.query(FeedAddition).filter(
        FeedAddition.id == addition_id,
        FeedAddition.horse_id == horse_id
    ).first()

    if not addition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Addition not found")

    # Only owner or admin can update
    if addition.requested_by_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    update_data = data.model_dump(exclude_unset=True)

    # Track if we're approving this addition
    is_approving = (
        'status' in update_data and
        update_data['status'] == AdditionStatus.APPROVED and
        addition.status != AdditionStatus.APPROVED
    )

    # If approving, set approved_by
    if is_approving:
        if current_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can approve additions")
        addition.approved_by_id = current_user.id

    for field, value in update_data.items():
        setattr(addition, field, value)

    db.commit()
    db.refresh(addition)

    # Auto-generate medication tasks if just approved and active today
    if is_approving:
        today = date.today()
        if addition.start_date <= today and (addition.end_date is None or addition.end_date >= today):
            generator = HealthTaskGenerator(db, current_user.id)
            generator.generate_medication_tasks(today)
            db.commit()

    return addition


@router.delete("/{horse_id}/feed/additions/{addition_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_feed_addition(
    horse_id: int,
    addition_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a feed addition."""
    horse = get_horse_with_access(horse_id, current_user, db)

    addition = db.query(FeedAddition).filter(
        FeedAddition.id == addition_id,
        FeedAddition.horse_id == horse_id
    ).first()

    if not addition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Addition not found")

    # Only owner or admin can delete
    if addition.requested_by_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    db.delete(addition)
    db.commit()


# ============== Feed Supply Alerts ==============

@router.get("/{horse_id}/feed/alerts", response_model=List[FeedSupplyAlertResponse])
def list_feed_alerts(
    horse_id: int,
    unresolved_only: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List feed supply alerts for a horse."""
    horse = get_horse_with_access(horse_id, current_user, db)

    query = db.query(FeedSupplyAlert).filter(FeedSupplyAlert.horse_id == horse_id)

    if unresolved_only:
        query = query.filter(FeedSupplyAlert.is_resolved == False)

    alerts = query.order_by(FeedSupplyAlert.created_at.desc()).all()

    for alert in alerts:
        if alert.created_by:
            alert.created_by_name = alert.created_by.name
        alert.horse_name = horse.name

    return alerts


@router.post("/{horse_id}/feed/alerts", response_model=FeedSupplyAlertResponse, status_code=status.HTTP_201_CREATED)
def create_feed_alert(
    horse_id: int,
    data: FeedSupplyAlertCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a feed supply alert (yard staff only)."""
    # Only users with staff access can create alerts
    if not has_staff_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only yard staff can create supply alerts"
        )

    horse = db.query(Horse).filter(Horse.id == horse_id).first()
    if not horse:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Horse not found")

    alert = FeedSupplyAlert(
        horse_id=horse_id,
        created_by_id=current_user.id,
        **data.model_dump()
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    alert.created_by_name = current_user.name
    alert.horse_name = horse.name
    return alert


@router.put("/{horse_id}/feed/alerts/{alert_id}", response_model=FeedSupplyAlertResponse)
def update_feed_alert(
    horse_id: int,
    alert_id: int,
    data: FeedSupplyAlertUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update or resolve a feed supply alert."""
    horse = get_horse_with_access(horse_id, current_user, db)

    alert = db.query(FeedSupplyAlert).filter(
        FeedSupplyAlert.id == alert_id,
        FeedSupplyAlert.horse_id == horse_id
    ).first()

    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    update_data = data.model_dump(exclude_unset=True)

    # If resolving, set resolved fields
    if 'is_resolved' in update_data and update_data['is_resolved'] and not alert.is_resolved:
        alert.resolved_by_id = current_user.id
        alert.resolved_at = datetime.utcnow()

    for field, value in update_data.items():
        setattr(alert, field, value)

    db.commit()
    db.refresh(alert)

    alert.horse_name = horse.name
    return alert


@router.delete("/{horse_id}/feed/alerts/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_feed_alert(
    horse_id: int,
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a feed supply alert (yard staff only)."""
    if not has_staff_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only yard staff can delete supply alerts"
        )

    alert = db.query(FeedSupplyAlert).filter(
        FeedSupplyAlert.id == alert_id,
        FeedSupplyAlert.horse_id == horse_id
    ).first()

    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    db.delete(alert)
    db.commit()


# ============== All Alerts (for staff dashboard) ==============

@router.get("/alerts/all", response_model=List[FeedSupplyAlertResponse])
def list_all_alerts(
    unresolved_only: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all feed supply alerts across all horses (yard staff only)."""
    if not has_staff_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only yard staff can view all alerts"
        )

    query = db.query(FeedSupplyAlert)

    if unresolved_only:
        query = query.filter(FeedSupplyAlert.is_resolved == False)

    alerts = query.order_by(FeedSupplyAlert.created_at.desc()).all()

    for alert in alerts:
        if alert.created_by:
            alert.created_by_name = alert.created_by.name
        if alert.horse:
            alert.horse_name = alert.horse.name

    return alerts


@router.get("/alerts/my-horses", response_model=List[FeedSupplyAlertResponse])
def list_my_horse_alerts(
    unresolved_only: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List feed supply alerts for horses owned by the current user."""
    # Get horse IDs owned by this user
    horse_ids = [h.id for h in db.query(Horse).filter(Horse.owner_id == current_user.id).all()]

    if not horse_ids:
        return []

    query = db.query(FeedSupplyAlert).filter(FeedSupplyAlert.horse_id.in_(horse_ids))

    if unresolved_only:
        query = query.filter(FeedSupplyAlert.is_resolved == False)

    alerts = query.order_by(FeedSupplyAlert.created_at.desc()).all()

    for alert in alerts:
        if alert.created_by:
            alert.created_by_name = alert.created_by.name
        if alert.horse:
            alert.horse_name = alert.horse.name

    return alerts


# ============== Feed Schedule (all horses for staff) ==============

@router.get("/schedule/all", response_model=List[FeedSummary])
def get_all_feed_schedules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get feed schedules for all horses (yard staff), ordered by stable sequence for feed prep."""
    if not has_staff_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only yard staff can view all feed schedules"
        )

    # Load horses with their stable relationships, ordered by stable sequence
    # Horses with stables come first (ordered by stable sequence), then horses without stables
    horses = db.query(Horse).options(
        joinedload(Horse.stable)
    ).outerjoin(Stable).order_by(
        Stable.sequence.asc().nullslast(),
        Horse.name.asc()
    ).all()

    today = date.today()
    results = []

    for horse in horses:
        feed_requirement = db.query(FeedRequirement).filter(
            FeedRequirement.horse_id == horse.id
        ).first()

        active_additions = db.query(FeedAddition).filter(
            FeedAddition.horse_id == horse.id,
            FeedAddition.status == AdditionStatus.APPROVED,
            FeedAddition.is_active == True,
            FeedAddition.start_date <= today,
            (FeedAddition.end_date >= today) | (FeedAddition.end_date == None)
        ).all()

        pending_additions = db.query(FeedAddition).filter(
            FeedAddition.horse_id == horse.id,
            FeedAddition.status == AdditionStatus.PENDING
        ).all()

        unresolved_alerts = db.query(FeedSupplyAlert).filter(
            FeedSupplyAlert.horse_id == horse.id,
            FeedSupplyAlert.is_resolved == False
        ).all()

        # Get feed-based medications from active rehab programs
        rehab_medications = []
        active_programs = db.query(RehabProgram).filter(
            RehabProgram.horse_id == horse.id,
            RehabProgram.status == RehabStatus.ACTIVE
        ).all()

        for program in active_programs:
            # Get feed-based tasks from the program's phases
            feed_tasks = db.query(RehabTask).join(RehabPhase).filter(
                RehabPhase.program_id == program.id,
                RehabTask.is_feed_based == True
            ).all()

            for task in feed_tasks:
                rehab_medications.append(RehabFeedMedication(
                    task_id=task.id,
                    program_id=program.id,
                    program_name=program.name,
                    task_type=task.task_type,
                    description=task.description,
                    feed_time=task.feed_time,
                    instructions=task.instructions,
                    frequency=task.frequency.value if task.frequency else "daily"
                ))

        results.append(FeedSummary(
            horse_id=horse.id,
            horse_name=horse.name,
            stable_id=horse.stable_id,
            stable_name=horse.stable.name if horse.stable else None,
            stable_sequence=horse.stable.sequence if horse.stable else None,
            feed_requirement=feed_requirement,
            active_additions=active_additions,
            pending_additions=pending_additions,
            unresolved_alerts=unresolved_alerts,
            rehab_medications=rehab_medications,
        ))

    return results

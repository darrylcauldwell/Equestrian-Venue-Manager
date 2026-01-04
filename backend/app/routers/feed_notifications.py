from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.database import get_db
from app.models.user import User, UserRole
from app.models.horse import Horse
from app.models.feed import (
    FeedChangeNotification,
    FeedChangeAcknowledgement,
    FeedChangeType,
)
from app.schemas.feed import (
    FeedChangeNotificationResponse,
    FeedNotificationHistoryResponse,
    AcknowledgementDetail,
)
from app.utils.auth import get_current_user, require_admin

router = APIRouter()


def create_feed_notification(
    db: Session,
    change_type: FeedChangeType,
    horse_id: int,
    description: str,
    created_by_id: int,
    details: dict = None
) -> FeedChangeNotification:
    """Helper function to create a feed change notification."""
    notification = FeedChangeNotification(
        change_type=change_type,
        horse_id=horse_id,
        description=description,
        details=details,
        created_by_id=created_by_id,
    )
    db.add(notification)
    db.flush()  # Get the ID without committing
    return notification


@router.get("/pending", response_model=List[FeedChangeNotificationResponse])
def get_pending_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get unacknowledged feed notifications for the current user.

    Only returns notifications for users who are yard staff.
    """
    # Only yard staff need to see feed notifications
    if not current_user.is_yard_staff and current_user.role != UserRole.ADMIN:
        return []

    # Find notification IDs this user has already acknowledged
    acknowledged_ids = db.query(FeedChangeAcknowledgement.notification_id).filter(
        FeedChangeAcknowledgement.user_id == current_user.id
    ).subquery()

    # Get notifications that haven't been acknowledged
    notifications = db.query(FeedChangeNotification).filter(
        ~FeedChangeNotification.id.in_(acknowledged_ids)
    ).order_by(FeedChangeNotification.created_at.desc()).all()

    # Build response with horse and user names
    results = []
    for notif in notifications:
        horse = db.query(Horse).filter(Horse.id == notif.horse_id).first()
        creator = db.query(User).filter(User.id == notif.created_by_id).first()

        results.append(FeedChangeNotificationResponse(
            id=notif.id,
            change_type=notif.change_type,
            horse_id=notif.horse_id,
            horse_name=horse.name if horse else "Unknown",
            description=notif.description,
            details=notif.details,
            created_by_id=notif.created_by_id,
            created_by_name=creator.name if creator else "Unknown",
            created_at=notif.created_at,
        ))

    return results


@router.post("/{notification_id}/acknowledge")
def acknowledge_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Acknowledge a feed notification."""
    notification = db.query(FeedChangeNotification).filter(
        FeedChangeNotification.id == notification_id
    ).first()

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )

    # Check if already acknowledged
    existing = db.query(FeedChangeAcknowledgement).filter(
        FeedChangeAcknowledgement.notification_id == notification_id,
        FeedChangeAcknowledgement.user_id == current_user.id
    ).first()

    if existing:
        return {"message": "Already acknowledged", "acknowledged_at": existing.acknowledged_at}

    # Create acknowledgement
    ack = FeedChangeAcknowledgement(
        notification_id=notification_id,
        user_id=current_user.id,
    )
    db.add(ack)
    db.commit()

    return {"message": "Acknowledged successfully", "acknowledged_at": ack.acknowledged_at}


@router.get("/history", response_model=List[FeedNotificationHistoryResponse])
def get_notification_history(
    horse_id: Optional[int] = Query(None, description="Filter by horse"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    change_type: Optional[FeedChangeType] = Query(None, description="Filter by change type"),
    limit: int = Query(50, ge=1, le=200, description="Max results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get notification history with acknowledgement status (admin only)."""
    # Get total yard staff count (for acknowledgement stats)
    total_staff = db.query(User).filter(
        User.is_yard_staff == True,
        User.is_active == True
    ).count()

    # Build query with filters
    query = db.query(FeedChangeNotification)

    if horse_id:
        query = query.filter(FeedChangeNotification.horse_id == horse_id)
    if start_date:
        query = query.filter(FeedChangeNotification.created_at >= start_date)
    if end_date:
        query = query.filter(FeedChangeNotification.created_at <= end_date)
    if change_type:
        query = query.filter(FeedChangeNotification.change_type == change_type)

    # Order by most recent and apply pagination
    notifications = query.order_by(
        FeedChangeNotification.created_at.desc()
    ).offset(offset).limit(limit).all()

    # Get all yard staff for acknowledgement tracking
    yard_staff = db.query(User).filter(
        User.is_yard_staff == True,
        User.is_active == True
    ).all()
    staff_map = {s.id: s.name for s in yard_staff}

    # Build response
    results = []
    for notif in notifications:
        horse = db.query(Horse).filter(Horse.id == notif.horse_id).first()
        creator = db.query(User).filter(User.id == notif.created_by_id).first()

        # Get acknowledgements for this notification
        acks = db.query(FeedChangeAcknowledgement).filter(
            FeedChangeAcknowledgement.notification_id == notif.id
        ).all()
        ack_map = {a.user_id: a.acknowledged_at for a in acks}

        # Build acknowledgement details for all staff
        acknowledgements = []
        for staff_id, staff_name in staff_map.items():
            acknowledgements.append(AcknowledgementDetail(
                user_id=staff_id,
                user_name=staff_name,
                acknowledged_at=ack_map.get(staff_id),
            ))

        # Sort: acknowledged first, then by name
        acknowledgements.sort(key=lambda x: (x.acknowledged_at is None, x.user_name))

        results.append(FeedNotificationHistoryResponse(
            id=notif.id,
            change_type=notif.change_type,
            horse_id=notif.horse_id,
            horse_name=horse.name if horse else "Unknown",
            description=notif.description,
            details=notif.details,
            created_by_id=notif.created_by_id,
            created_by_name=creator.name if creator else "Unknown",
            created_at=notif.created_at,
            total_staff=total_staff,
            acknowledged_count=len([a for a in acks if a.user_id in staff_map]),
            acknowledgements=acknowledgements,
        ))

    return results

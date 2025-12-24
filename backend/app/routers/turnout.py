from typing import List, Optional
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.turnout import TurnoutRequest, TurnoutStatus, TurnoutType
from app.models.horse import Horse
from app.models.user import User, UserRole
from app.utils.auth import get_current_user, has_staff_access
from app.schemas.turnout import (
    TurnoutRequestCreate,
    TurnoutRequestUpdate,
    TurnoutReviewRequest,
    TurnoutRequestResponse,
    DailyTurnoutSummary,
    TurnoutEnums,
)

router = APIRouter()


def enrich_turnout_request(request: TurnoutRequest) -> TurnoutRequestResponse:
    """Add related names to turnout request response."""
    response = TurnoutRequestResponse.model_validate(request)

    if request.horse:
        response.horse_name = request.horse.name
        if request.horse.stable:
            response.stable_name = request.horse.stable.name
    if request.requested_by:
        response.requested_by_name = request.requested_by.name
    if request.reviewed_by:
        response.reviewed_by_name = request.reviewed_by.name

    return response


# ============== Livery Endpoints ==============

@router.get("/my", response_model=List[TurnoutRequestResponse])
def get_my_turnout_requests(
    upcoming_only: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get turnout requests for the current user's horses."""
    # Get user's horse IDs
    horse_ids = [h.id for h in db.query(Horse).filter(Horse.owner_id == current_user.id).all()]

    if not horse_ids:
        return []

    query = db.query(TurnoutRequest).options(
        joinedload(TurnoutRequest.horse),
        joinedload(TurnoutRequest.requested_by),
        joinedload(TurnoutRequest.reviewed_by),
    ).filter(TurnoutRequest.horse_id.in_(horse_ids))

    if upcoming_only:
        query = query.filter(TurnoutRequest.request_date >= date.today())

    requests = query.order_by(TurnoutRequest.request_date.asc()).all()

    return [enrich_turnout_request(r) for r in requests]


@router.post("/", response_model=TurnoutRequestResponse, status_code=status.HTTP_201_CREATED)
def create_turnout_request(
    data: TurnoutRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new turnout request."""
    # Verify horse exists and user owns it (or is staff)
    horse = db.query(Horse).filter(Horse.id == data.horse_id).first()
    if not horse:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Horse not found")

    if horse.owner_id != current_user.id and not has_staff_access(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Check for existing request on same date
    existing = db.query(TurnoutRequest).filter(
        TurnoutRequest.horse_id == data.horse_id,
        TurnoutRequest.request_date == data.request_date,
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A turnout request already exists for this horse on this date"
        )

    # Staff can auto-approve their own requests
    initial_status = TurnoutStatus.PENDING
    reviewed_by_id = None
    reviewed_at = None

    if has_staff_access(current_user):
        initial_status = TurnoutStatus.APPROVED
        reviewed_by_id = current_user.id
        reviewed_at = datetime.utcnow()

    request = TurnoutRequest(
        horse_id=data.horse_id,
        requested_by_id=current_user.id,
        request_date=data.request_date,
        turnout_type=data.turnout_type,
        field_preference=data.field_preference,
        notes=data.notes,
        status=initial_status,
        reviewed_by_id=reviewed_by_id,
        reviewed_at=reviewed_at,
    )

    db.add(request)
    db.commit()
    db.refresh(request)

    # Load relationships
    db.refresh(request, ["horse", "requested_by", "reviewed_by"])

    return enrich_turnout_request(request)


@router.put("/{request_id}", response_model=TurnoutRequestResponse)
def update_turnout_request(
    request_id: int,
    data: TurnoutRequestUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a turnout request (owner or staff only)."""
    request = db.query(TurnoutRequest).options(
        joinedload(TurnoutRequest.horse),
    ).filter(TurnoutRequest.id == request_id).first()

    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    # Only owner or staff can update
    if request.requested_by_id != current_user.id and not has_staff_access(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Can only update pending requests (unless staff)
    if request.status != TurnoutStatus.PENDING and not has_staff_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only update pending requests"
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(request, field, value)

    db.commit()
    db.refresh(request, ["horse", "requested_by", "reviewed_by"])

    return enrich_turnout_request(request)


@router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_turnout_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a turnout request (owner or staff only).

    Staff can always delete. Livery users cannot delete if:
    - The request is for today and staff have triggered the cutoff
    """
    request = db.query(TurnoutRequest).filter(TurnoutRequest.id == request_id).first()

    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    # Only owner or staff can delete
    if request.requested_by_id != current_user.id and not has_staff_access(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Staff can always delete
    if has_staff_access(current_user):
        db.delete(request)
        db.commit()
        return

    # For livery users, check cutoff
    from app.routers.settings import get_or_create_settings
    settings = get_or_create_settings(db)
    today = date.today()

    # Check if cutoff is active for today and request is for today
    if settings.turnout_cutoff_date == today and request.request_date == today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cancellation cutoff has been triggered for today. Please contact staff."
        )

    db.delete(request)
    db.commit()


# ============== Staff Endpoints ==============

@router.get("/pending", response_model=List[TurnoutRequestResponse])
def get_pending_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all pending turnout requests (staff only)."""
    if not has_staff_access(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Staff access required")

    requests = db.query(TurnoutRequest).options(
        joinedload(TurnoutRequest.horse).joinedload(Horse.stable),
        joinedload(TurnoutRequest.requested_by),
    ).filter(
        TurnoutRequest.status == TurnoutStatus.PENDING,
        TurnoutRequest.request_date >= date.today(),
    ).order_by(
        TurnoutRequest.request_date.asc(),
        TurnoutRequest.created_at.asc()
    ).all()

    return [enrich_turnout_request(r) for r in requests]


@router.post("/{request_id}/review", response_model=TurnoutRequestResponse)
def review_turnout_request(
    request_id: int,
    data: TurnoutReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve or decline a turnout request (staff only)."""
    if not has_staff_access(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Staff access required")

    request = db.query(TurnoutRequest).options(
        joinedload(TurnoutRequest.horse).joinedload(Horse.stable),
        joinedload(TurnoutRequest.requested_by),
    ).filter(TurnoutRequest.id == request_id).first()

    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    request.status = data.status
    request.response_message = data.response_message
    request.reviewed_by_id = current_user.id
    request.reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(request, ["reviewed_by"])

    return enrich_turnout_request(request)


@router.get("/daily/{target_date}", response_model=DailyTurnoutSummary)
def get_daily_turnout_summary(
    target_date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get daily turnout summary for staff (who's going out, who's staying in)."""
    if not has_staff_access(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Staff access required")

    # Get all requests for this date
    requests = db.query(TurnoutRequest).options(
        joinedload(TurnoutRequest.horse).joinedload(Horse.stable),
        joinedload(TurnoutRequest.requested_by),
        joinedload(TurnoutRequest.reviewed_by),
    ).filter(
        TurnoutRequest.request_date == target_date
    ).all()

    turning_out = []
    staying_in = []
    pending = []

    for r in requests:
        enriched = enrich_turnout_request(r)
        if r.status == TurnoutStatus.PENDING:
            pending.append(enriched)
        elif r.status == TurnoutStatus.APPROVED:
            if r.turnout_type == TurnoutType.OUT:
                turning_out.append(enriched)
            else:
                staying_in.append(enriched)

    # Get all horses without requests for this date
    horse_ids_with_requests = [r.horse_id for r in requests]
    horses_no_request = db.query(Horse).options(
        joinedload(Horse.stable),
        joinedload(Horse.owner),
    ).filter(
        ~Horse.id.in_(horse_ids_with_requests) if horse_ids_with_requests else True
    ).all()

    no_request_horses = [
        {
            "id": h.id,
            "name": h.name,
            "stable_name": h.stable.name if h.stable else None,
            "owner_name": h.owner.name if h.owner else None,
        }
        for h in horses_no_request
    ]

    return DailyTurnoutSummary(
        date=target_date,
        turning_out=turning_out,
        staying_in=staying_in,
        pending=pending,
        no_request_horses=no_request_horses,
    )


@router.get("/all", response_model=List[TurnoutRequestResponse])
def get_all_requests(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    status_filter: Optional[TurnoutStatus] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all turnout requests with filters (staff only)."""
    if not has_staff_access(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Staff access required")

    query = db.query(TurnoutRequest).options(
        joinedload(TurnoutRequest.horse).joinedload(Horse.stable),
        joinedload(TurnoutRequest.requested_by),
        joinedload(TurnoutRequest.reviewed_by),
    )

    if from_date:
        query = query.filter(TurnoutRequest.request_date >= from_date)
    if to_date:
        query = query.filter(TurnoutRequest.request_date <= to_date)
    if status_filter:
        query = query.filter(TurnoutRequest.status == status_filter)

    requests = query.order_by(
        TurnoutRequest.request_date.asc(),
        TurnoutRequest.created_at.asc()
    ).all()

    return [enrich_turnout_request(r) for r in requests]


# ============== Enums ==============

@router.get("/enums", response_model=TurnoutEnums)
def get_turnout_enums():
    """Get enum values for turnout requests."""
    return TurnoutEnums(
        statuses=[
            {"value": s.value, "label": s.value.replace("_", " ").title()}
            for s in TurnoutStatus
        ],
        types=[
            {"value": TurnoutType.OUT.value, "label": "Turn Out"},
            {"value": TurnoutType.IN.value, "label": "Stay In"},
        ],
    )

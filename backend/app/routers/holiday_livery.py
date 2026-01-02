"""
Holiday Livery Router

Endpoints for public holiday livery requests and admin management.
"""

import secrets
import string
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.database import get_db
from app.models.user import User, UserRole
from app.models.horse import Horse
from app.models.stable import Stable
from app.models.livery_package import LiveryPackage, BillingType
from app.models.holiday_livery import HolidayLiveryRequest, HolidayLiveryStatus
from app.models.account import LedgerEntry, TransactionType
from app.utils.auth import get_current_user, get_password_hash
from app.schemas.holiday_livery import (
    HolidayLiveryRequestCreate,
    HolidayLiveryApproval,
    HolidayLiveryRejection,
    HolidayLiveryRequestResponse,
    HolidayLiveryRequestSummary,
    HolidayLiveryPublicResponse,
)

router = APIRouter(prefix="/holiday-livery", tags=["holiday-livery"])


def generate_temp_password(length: int = 12) -> str:
    """Generate a secure temporary password."""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require admin role."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


def enrich_response(request: HolidayLiveryRequest) -> HolidayLiveryRequestResponse:
    """Convert model to response with related names."""
    return HolidayLiveryRequestResponse(
        id=request.id,
        guest_name=request.guest_name,
        guest_email=request.guest_email,
        guest_phone=request.guest_phone,
        horse_name=request.horse_name,
        horse_breed=request.horse_breed,
        horse_age=request.horse_age,
        horse_colour=request.horse_colour,
        horse_gender=request.horse_gender,
        special_requirements=request.special_requirements,
        requested_arrival=request.requested_arrival,
        requested_departure=request.requested_departure,
        requested_nights=request.requested_nights,
        message=request.message,
        status=request.status.value,
        admin_notes=request.admin_notes,
        rejection_reason=request.rejection_reason,
        confirmed_arrival=request.confirmed_arrival,
        confirmed_departure=request.confirmed_departure,
        confirmed_nights=request.confirmed_nights,
        assigned_stable_id=request.assigned_stable_id,
        assigned_stable_name=request.assigned_stable.name if request.assigned_stable else None,
        created_user_id=request.created_user_id,
        created_user_name=request.created_user.name if request.created_user else None,
        created_horse_id=request.created_horse_id,
        created_horse_name=request.created_horse.name if request.created_horse else None,
        processed_by_id=request.processed_by_id,
        processed_by_name=request.processed_by.name if request.processed_by else None,
        processed_at=request.processed_at,
        created_at=request.created_at,
        updated_at=request.updated_at,
    )


# ============================================================================
# Public Endpoints
# ============================================================================

@router.post("/request", response_model=HolidayLiveryPublicResponse)
def submit_holiday_livery_request(
    request_data: HolidayLiveryRequestCreate,
    db: Session = Depends(get_db)
):
    """
    Submit a public request for holiday livery.

    No authentication required. The request will be reviewed by admin.
    """
    # Create the request
    request = HolidayLiveryRequest(
        guest_name=request_data.guest_name,
        guest_email=request_data.guest_email,
        guest_phone=request_data.guest_phone,
        horse_name=request_data.horse_name,
        horse_breed=request_data.horse_breed,
        horse_age=request_data.horse_age,
        horse_colour=request_data.horse_colour,
        horse_gender=request_data.horse_gender,
        special_requirements=request_data.special_requirements,
        requested_arrival=request_data.requested_arrival,
        requested_departure=request_data.requested_departure,
        message=request_data.message,
        status=HolidayLiveryStatus.PENDING,
    )

    db.add(request)
    db.commit()
    db.refresh(request)

    return HolidayLiveryPublicResponse(
        id=request.id,
        message="Your holiday livery request has been submitted. We will review it and contact you shortly.",
        status=request.status.value,
        requested_arrival=request.requested_arrival,
        requested_departure=request.requested_departure,
    )


# ============================================================================
# Admin Endpoints
# ============================================================================

@router.get("/requests", response_model=List[HolidayLiveryRequestSummary])
def list_holiday_livery_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """List all holiday livery requests (admin only)."""
    query = db.query(HolidayLiveryRequest)

    if status_filter:
        try:
            status_enum = HolidayLiveryStatus(status_filter)
            query = query.filter(HolidayLiveryRequest.status == status_enum)
        except ValueError:
            pass  # Invalid status, ignore filter

    requests = query.order_by(desc(HolidayLiveryRequest.created_at)).all()

    return [
        HolidayLiveryRequestSummary(
            id=r.id,
            guest_name=r.guest_name,
            guest_email=r.guest_email,
            horse_name=r.horse_name,
            requested_arrival=r.requested_arrival,
            requested_departure=r.requested_departure,
            requested_nights=r.requested_nights,
            status=r.status.value,
            created_at=r.created_at,
        )
        for r in requests
    ]


@router.get("/requests/{request_id}", response_model=HolidayLiveryRequestResponse)
def get_holiday_livery_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get details of a holiday livery request (admin only)."""
    request = db.query(HolidayLiveryRequest).filter(
        HolidayLiveryRequest.id == request_id
    ).first()

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Holiday livery request not found"
        )

    return enrich_response(request)


@router.post("/requests/{request_id}/approve", response_model=HolidayLiveryRequestResponse)
def approve_holiday_livery_request(
    request_id: int,
    approval: HolidayLiveryApproval,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Approve a holiday livery request (admin only).

    This will:
    1. Create a user account (or use existing if email matches)
    2. Create a horse record with livery dates
    3. Assign the stable
    4. Update the request status
    """
    request = db.query(HolidayLiveryRequest).filter(
        HolidayLiveryRequest.id == request_id
    ).first()

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Holiday livery request not found"
        )

    if request.status != HolidayLiveryStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve request with status '{request.status.value}'"
        )

    # Validate stable exists
    stable = db.query(Stable).filter(Stable.id == approval.assigned_stable_id).first()
    if not stable:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected stable not found"
        )

    # Find or create the holiday livery package
    holiday_package = db.query(LiveryPackage).filter(
        LiveryPackage.billing_type == BillingType.WEEKLY,
        LiveryPackage.is_active == True
    ).first()

    if not holiday_package:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active holiday livery package found. Please create one first."
        )

    # Check if user already exists with this email
    existing_user = db.query(User).filter(User.email == request.guest_email).first()

    if existing_user:
        user = existing_user
        temp_password = None
    else:
        # Create new user account
        temp_password = generate_temp_password()

        # Generate username from email (case-insensitive check)
        base_username = request.guest_email.split('@')[0].lower()
        username = base_username
        counter = 1
        while db.query(User).filter(func.lower(User.username) == username).first():
            username = f"{base_username}{counter}"
            counter += 1

        user = User(
            username=username,
            email=request.guest_email,
            name=request.guest_name,
            phone=request.guest_phone,
            password_hash=get_password_hash(temp_password),
            role=UserRole.LIVERY,
            is_active=True,
            must_change_password=True,
        )
        db.add(user)
        db.flush()

    # Create horse record
    horse = Horse(
        owner_id=user.id,
        name=request.horse_name,
        colour=request.horse_colour,
        stable_id=stable.id,
        livery_package_id=holiday_package.id,
        livery_start_date=approval.confirmed_arrival,
        livery_end_date=approval.confirmed_departure,
        handling_notes=request.special_requirements,
    )
    db.add(horse)
    db.flush()

    # Update the request
    request.status = HolidayLiveryStatus.APPROVED
    request.confirmed_arrival = approval.confirmed_arrival
    request.confirmed_departure = approval.confirmed_departure
    request.assigned_stable_id = stable.id
    request.admin_notes = approval.admin_notes
    request.created_user_id = user.id
    request.created_horse_id = horse.id
    request.processed_by_id = current_user.id
    request.processed_at = datetime.utcnow()

    # Create ledger entry for the holiday livery charge
    if holiday_package.weekly_price:
        num_nights = (approval.confirmed_departure - approval.confirmed_arrival).days
        daily_rate = float(holiday_package.weekly_price) / 7
        total_charge = daily_rate * num_nights
        if total_charge > 0:
            description = f"Holiday Livery: {request.horse_name}"
            description += f" ({approval.confirmed_arrival.strftime('%d %b')} - {approval.confirmed_departure.strftime('%d %b')}, {num_nights} nights)"

            ledger_entry = LedgerEntry(
                user_id=user.id,
                transaction_type=TransactionType.PACKAGE_CHARGE,
                amount=total_charge,
                description=description,
                created_by_id=current_user.id,
            )
            db.add(ledger_entry)

    db.commit()
    db.refresh(request)

    # Credentials stored in admin notes for WhatsApp communication
    if temp_password:
        request.admin_notes = (
            f"{request.admin_notes or ''}\n\n"
            f"[AUTO] New account created:\n"
            f"Username: {user.username}\n"
            f"Temp Password: {temp_password}"
        ).strip()
        db.commit()

    return enrich_response(request)


@router.post("/requests/{request_id}/reject", response_model=HolidayLiveryRequestResponse)
def reject_holiday_livery_request(
    request_id: int,
    rejection: HolidayLiveryRejection,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Reject a holiday livery request (admin only)."""
    request = db.query(HolidayLiveryRequest).filter(
        HolidayLiveryRequest.id == request_id
    ).first()

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Holiday livery request not found"
        )

    if request.status != HolidayLiveryStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject request with status '{request.status.value}'"
        )

    request.status = HolidayLiveryStatus.REJECTED
    request.rejection_reason = rejection.rejection_reason
    request.admin_notes = rejection.admin_notes
    request.processed_by_id = current_user.id
    request.processed_at = datetime.utcnow()

    db.commit()
    db.refresh(request)

    return enrich_response(request)


@router.post("/requests/{request_id}/cancel", response_model=HolidayLiveryRequestResponse)
def cancel_holiday_livery_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Cancel a holiday livery request (admin only)."""
    request = db.query(HolidayLiveryRequest).filter(
        HolidayLiveryRequest.id == request_id
    ).first()

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Holiday livery request not found"
        )

    if request.status == HolidayLiveryStatus.CANCELLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request is already cancelled"
        )

    request.status = HolidayLiveryStatus.CANCELLED
    request.processed_by_id = current_user.id
    request.processed_at = datetime.utcnow()

    db.commit()
    db.refresh(request)

    return enrich_response(request)


@router.get("/stats")
def get_holiday_livery_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get statistics on holiday livery requests (admin only)."""
    total = db.query(HolidayLiveryRequest).count()
    pending = db.query(HolidayLiveryRequest).filter(
        HolidayLiveryRequest.status == HolidayLiveryStatus.PENDING
    ).count()
    approved = db.query(HolidayLiveryRequest).filter(
        HolidayLiveryRequest.status == HolidayLiveryStatus.APPROVED
    ).count()
    rejected = db.query(HolidayLiveryRequest).filter(
        HolidayLiveryRequest.status == HolidayLiveryStatus.REJECTED
    ).count()

    return {
        "total": total,
        "pending": pending,
        "approved": approved,
        "rejected": rejected,
    }

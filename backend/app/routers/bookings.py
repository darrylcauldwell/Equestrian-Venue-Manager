from typing import List, Optional, Union
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from app.database import get_db
from app.models.arena import Arena
from app.models.booking import Booking, BookingType, BookingStatus, PaymentStatus
from app.models.user import User, UserRole
from app.models.horse import Horse
from app.models.settings import SiteSettings
from app.schemas.booking import (
    BookingCreate,
    BookingUpdate,
    BookingResponse,
    BookingPublicResponse,
    GuestBookingCreate,
    BlockSlotCreate,
    ArenaUsageReport,
    PeriodUsageReport,
    ArenaUsageSummary,
    BookingTypeUsage,
)
from app.utils.auth import get_current_user, require_staff_or_admin, has_staff_access

router = APIRouter()


def check_booking_conflict(
    db: Session,
    arena_id: int,
    start_time: datetime,
    end_time: datetime,
    exclude_booking_id: Optional[int] = None
) -> bool:
    """
    Check if a time slot conflicts with existing CONFIRMED bookings.
    Pending and cancelled bookings do not block slots.
    """
    query = db.query(Booking).filter(
        Booking.arena_id == arena_id,
        Booking.booking_status == BookingStatus.CONFIRMED,  # Only confirmed bookings block
        or_(
            and_(Booking.start_time <= start_time, Booking.end_time > start_time),
            and_(Booking.start_time < end_time, Booking.end_time >= end_time),
            and_(Booking.start_time >= start_time, Booking.end_time <= end_time)
        )
    )
    if exclude_booking_id:
        query = query.filter(Booking.id != exclude_booking_id)
    return query.first() is not None


def get_booking_response(
    booking: Booking,
    account_created: bool = False,
    temporary_password: Optional[str] = None,
    username: Optional[str] = None
) -> BookingResponse:
    return BookingResponse(
        id=booking.id,
        arena_id=booking.arena_id,
        user_id=booking.user_id,
        horse_id=booking.horse_id,
        title=booking.title,
        description=booking.description,
        start_time=booking.start_time,
        end_time=booking.end_time,
        booking_type=booking.booking_type,
        booking_status=booking.booking_status,
        open_to_share=booking.open_to_share,
        payment_status=booking.payment_status,
        created_at=booking.created_at,
        user_name=booking.user.name if booking.user else booking.guest_name,
        arena_name=booking.arena.name if booking.arena else None,
        horse_name=booking.horse.name if booking.horse else None,
        guest_name=booking.guest_name,
        guest_email=booking.guest_email,
        account_created=account_created,
        temporary_password=temporary_password,
        username=username
    )


def validate_livery_booking_rules(
    db: Session,
    user: User,
    horse_id: int,
    start_time: datetime,
    end_time: datetime,
    exclude_booking_id: Optional[int] = None
) -> BookingStatus:
    """
    Validate livery booking against configured rules.
    Returns CONFIRMED if within allowance, PENDING if over allowance.
    Raises HTTPException for hard violations (invalid horse, duration, timing).
    Rules only apply if limits are actually set (non-null values).
    """
    settings = db.query(SiteSettings).first()
    if not settings:
        # No settings configured, just validate horse ownership
        horse = db.query(Horse).filter(Horse.id == horse_id, Horse.owner_id == user.id).first()
        if not horse:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid horse selection - horse not found or not owned by you"
            )
        return BookingStatus.CONFIRMED

    # Verify the horse belongs to this user (HARD RULE - always reject)
    horse = db.query(Horse).filter(Horse.id == horse_id, Horse.owner_id == user.id).first()
    if not horse:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid horse selection - horse not found or not owned by you"
        )

    now = datetime.utcnow()
    booking_hours = (end_time - start_time).total_seconds() / 3600

    # HARD RULE: Max booking duration (single booking too long)
    if settings.livery_max_booking_hours:
        max_hours = float(settings.livery_max_booking_hours)
        if booking_hours > max_hours:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Booking duration ({booking_hours:.1f}h) exceeds maximum allowed ({max_hours}h)"
            )

    # HARD RULE: Minimum advance notice
    if settings.livery_min_advance_hours:
        hours_until_start = (start_time - now).total_seconds() / 3600
        if hours_until_start < settings.livery_min_advance_hours:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Bookings must be made at least {settings.livery_min_advance_hours} hours in advance"
            )

    # HARD RULE: Maximum advance booking
    if settings.livery_max_advance_days:
        days_ahead = (start_time.date() - now.date()).days
        if days_ahead > settings.livery_max_advance_days:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot book more than {settings.livery_max_advance_days} days in advance"
            )

    # SOFT RULES - over allowance results in PENDING status (not rejection)
    is_over_allowance = False

    # Get all future CONFIRMED bookings for this horse (pending ones don't count against allowance)
    base_query = db.query(Booking).filter(
        Booking.horse_id == horse_id,
        Booking.booking_type == BookingType.LIVERY,
        Booking.booking_status == BookingStatus.CONFIRMED,
        Booking.end_time > now
    )
    if exclude_booking_id:
        base_query = base_query.filter(Booking.id != exclude_booking_id)

    # Rule: Max future hours per horse
    if settings.livery_max_future_hours_per_horse:
        future_bookings = base_query.all()
        total_future_hours = sum(
            (b.end_time - b.start_time).total_seconds() / 3600
            for b in future_bookings
        )
        max_future = float(settings.livery_max_future_hours_per_horse)
        if total_future_hours + booking_hours > max_future:
            is_over_allowance = True

    # Rule: Max daily hours per horse
    if settings.livery_max_daily_hours_per_horse and not is_over_allowance:
        booking_date = start_time.date()
        day_start = datetime.combine(booking_date, datetime.min.time())
        day_end = datetime.combine(booking_date, datetime.max.time())

        daily_bookings = db.query(Booking).filter(
            Booking.horse_id == horse_id,
            Booking.booking_type == BookingType.LIVERY,
            Booking.booking_status == BookingStatus.CONFIRMED,
            Booking.start_time >= day_start,
            Booking.start_time <= day_end
        )
        if exclude_booking_id:
            daily_bookings = daily_bookings.filter(Booking.id != exclude_booking_id)

        daily_hours = sum(
            (b.end_time - b.start_time).total_seconds() / 3600
            for b in daily_bookings.all()
        )
        max_daily = float(settings.livery_max_daily_hours_per_horse)
        if daily_hours + booking_hours > max_daily:
            is_over_allowance = True

    # Rule: Max weekly hours per horse
    if settings.livery_max_weekly_hours_per_horse and not is_over_allowance:
        # Get start of week (Monday)
        week_start = start_time.date() - relativedelta(days=start_time.weekday())
        week_end = week_start + relativedelta(days=7)

        weekly_bookings = db.query(Booking).filter(
            Booking.horse_id == horse_id,
            Booking.booking_type == BookingType.LIVERY,
            Booking.booking_status == BookingStatus.CONFIRMED,
            Booking.start_time >= datetime.combine(week_start, datetime.min.time()),
            Booking.start_time < datetime.combine(week_end, datetime.min.time())
        )
        if exclude_booking_id:
            weekly_bookings = weekly_bookings.filter(Booking.id != exclude_booking_id)

        weekly_hours = sum(
            (b.end_time - b.start_time).total_seconds() / 3600
            for b in weekly_bookings.all()
        )
        max_weekly = float(settings.livery_max_weekly_hours_per_horse)
        if weekly_hours + booking_hours > max_weekly:
            is_over_allowance = True

    return BookingStatus.PENDING if is_over_allowance else BookingStatus.CONFIRMED


# Public endpoint - list bookings for calendar (no auth required)
@router.get("/public", response_model=List[BookingPublicResponse])
def list_public_bookings(
    arena_id: Optional[int] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db)
):
    """List bookings visible to anonymous users - only shows that slots are booked, no details"""
    query = db.query(Booking).filter(
        Booking.booking_status != BookingStatus.CANCELLED  # Don't show cancelled bookings
    )

    if arena_id:
        query = query.filter(Booking.arena_id == arena_id)
    if start_date:
        query = query.filter(Booking.end_time >= start_date)
    if end_date:
        query = query.filter(Booking.start_time <= end_date)

    bookings = query.all()

    result = []
    for booking in bookings:
        if booking.booking_type == BookingType.EVENT:
            # Events are visible with title
            result.append(BookingPublicResponse(
                id=booking.id,
                arena_id=booking.arena_id,
                start_time=booking.start_time,
                end_time=booking.end_time,
                booking_type=booking.booking_type,
                booking_status=booking.booking_status,
                open_to_share=booking.open_to_share,
                title=booking.title
            ))
        else:
            # Other bookings just show as "Booked" (or "Pending" for pending livery bookings)
            title = "Pending" if booking.booking_status == BookingStatus.PENDING else "Booked"
            result.append(BookingPublicResponse(
                id=booking.id,
                arena_id=booking.arena_id,
                start_time=booking.start_time,
                end_time=booking.end_time,
                booking_type=booking.booking_type,
                booking_status=booking.booking_status,
                open_to_share=booking.open_to_share,
                title=title
            ))

    return result


# Public endpoint - guest booking (no auth required)
@router.post("/guest", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
def create_guest_booking(
    booking_data: GuestBookingCreate,
    db: Session = Depends(get_db)
):
    """Create a booking for anonymous/guest users with contact details.

    Automatically creates a PUBLIC user account if one doesn't exist,
    allowing the user to log in and view their bookings.
    """
    import secrets
    from passlib.context import CryptContext

    arena = db.query(Arena).filter(Arena.id == booking_data.arena_id).first()
    if not arena:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Arena not found"
        )
    if not arena.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Arena is not available for booking"
        )

    if booking_data.start_time >= booking_data.end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End time must be after start time"
        )

    if check_booking_conflict(db, booking_data.arena_id, booking_data.start_time, booking_data.end_time):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Time slot is already booked"
        )

    # Check if user with this email already exists
    account_created = False
    temp_password = None
    username = None
    user_id = None

    existing_user = db.query(User).filter(User.email == booking_data.guest_email).first()
    if existing_user:
        # Link booking to existing user
        user_id = existing_user.id
        username = existing_user.username
    else:
        # Create new PUBLIC user account
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

        # Generate unique username from email (case-insensitive check)
        base_username = booking_data.guest_email.split('@')[0].lower()
        # Remove any non-alphanumeric characters
        base_username = ''.join(c for c in base_username if c.isalnum())
        username = base_username
        counter = 1
        while db.query(User).filter(func.lower(User.username) == username).first():
            username = f"{base_username}{counter}"
            counter += 1

        # Generate temporary password
        temp_password = secrets.token_urlsafe(8)

        new_user = User(
            username=username,
            email=booking_data.guest_email,
            name=booking_data.guest_name,
            phone=booking_data.guest_phone,
            password_hash=pwd_context.hash(temp_password),
            role=UserRole.PUBLIC,
            must_change_password=True
        )
        db.add(new_user)
        db.flush()  # Get the ID without committing
        user_id = new_user.id
        account_created = True

    booking = Booking(
        arena_id=booking_data.arena_id,
        user_id=user_id,
        title=booking_data.title,
        description=booking_data.description,
        start_time=booking_data.start_time,
        end_time=booking_data.end_time,
        booking_type=BookingType.PUBLIC,
        payment_status=PaymentStatus.PENDING,  # Guest bookings require payment
        guest_name=booking_data.guest_name,
        guest_email=booking_data.guest_email,
        guest_phone=booking_data.guest_phone
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return get_booking_response(
        booking,
        account_created=account_created,
        temporary_password=temp_password,
        username=username
    )


# Staff endpoint - block arena slots
@router.post("/block", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
def block_arena_slot(
    block_data: BlockSlotCreate,
    current_user: User = Depends(require_staff_or_admin),
    db: Session = Depends(get_db)
):
    """Block an arena slot (maintenance, event, etc.) - staff/admin only"""
    arena = db.query(Arena).filter(Arena.id == block_data.arena_id).first()
    if not arena:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Arena not found"
        )

    if block_data.start_time >= block_data.end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End time must be after start time"
        )

    if check_booking_conflict(db, block_data.arena_id, block_data.start_time, block_data.end_time):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Time slot is already booked"
        )

    booking = Booking(
        arena_id=block_data.arena_id,
        user_id=current_user.id,
        title=block_data.title,
        description=block_data.description,
        start_time=block_data.start_time,
        end_time=block_data.end_time,
        booking_type=block_data.booking_type,
        payment_status=PaymentStatus.NOT_REQUIRED
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return get_booking_response(booking)


@router.get("/", response_model=List[Union[BookingResponse, BookingPublicResponse]])
def list_bookings(
    arena_id: Optional[int] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    include_cancelled: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Booking)

    # By default, exclude cancelled bookings (unless admin wants to see them)
    if not include_cancelled or not has_staff_access(current_user):
        query = query.filter(Booking.booking_status != BookingStatus.CANCELLED)

    if arena_id:
        query = query.filter(Booking.arena_id == arena_id)
    if start_date:
        query = query.filter(Booking.end_time >= start_date)
    if end_date:
        query = query.filter(Booking.start_time <= end_date)

    bookings = query.all()

    # Yard staff can see all booking details
    if has_staff_access(current_user):
        return [get_booking_response(b) for b in bookings]

    result = []
    for booking in bookings:
        if booking.booking_type == BookingType.EVENT:
            result.append(get_booking_response(booking))
        elif current_user.role == UserRole.LIVERY and booking.booking_type == BookingType.LIVERY:
            result.append(get_booking_response(booking))
        elif booking.user_id == current_user.id:
            result.append(get_booking_response(booking))
        else:
            title = "Pending" if booking.booking_status == BookingStatus.PENDING else "Booked"
            if booking.booking_type == BookingType.EVENT:
                title = booking.title
            result.append(BookingPublicResponse(
                id=booking.id,
                arena_id=booking.arena_id,
                start_time=booking.start_time,
                end_time=booking.end_time,
                booking_type=booking.booking_type,
                booking_status=booking.booking_status,
                open_to_share=booking.open_to_share,
                title=title
            ))

    return result


@router.get("/{booking_id}", response_model=BookingResponse)
def get_booking(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )

    # Yard staff can view any booking
    if not has_staff_access(current_user):
        if booking.user_id != current_user.id:
            if not (current_user.role == UserRole.LIVERY and booking.booking_type == BookingType.LIVERY):
                if booking.booking_type != BookingType.EVENT:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Not authorized to view this booking"
                    )

    return get_booking_response(booking)


@router.post("/", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
def create_booking(
    booking_data: BookingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    arena = db.query(Arena).filter(Arena.id == booking_data.arena_id).first()
    if not arena:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Arena not found"
        )
    if not arena.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Arena is not available for booking"
        )

    if booking_data.start_time >= booking_data.end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End time must be after start time"
        )

    if check_booking_conflict(db, booking_data.arena_id, booking_data.start_time, booking_data.end_time):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Time slot is already booked"
        )

    if booking_data.booking_type:
        if booking_data.booking_type in [BookingType.MAINTENANCE, BookingType.EVENT, BookingType.TRAINING_CLINIC]:
            if not has_staff_access(current_user):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only yard staff can create maintenance, event, or training clinic bookings"
                )
        booking_type = booking_data.booking_type
    else:
        booking_type = BookingType.LIVERY if current_user.role == UserRole.LIVERY else BookingType.PUBLIC

    # For livery bookings, validate against booking rules
    horse_id = None
    booking_status = BookingStatus.CONFIRMED  # Default status
    if booking_type == BookingType.LIVERY:
        if not booking_data.horse_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Livery bookings must specify which horse the booking is for"
            )
        horse_id = booking_data.horse_id
        booking_status = validate_livery_booking_rules(
            db, current_user, horse_id,
            booking_data.start_time, booking_data.end_time
        )

    # Yard staff bookings, or livery bookings, don't require payment
    if booking_type == BookingType.LIVERY or has_staff_access(current_user):
        payment_status = PaymentStatus.NOT_REQUIRED
    else:
        payment_status = PaymentStatus.PENDING

    booking = Booking(
        arena_id=booking_data.arena_id,
        user_id=current_user.id,
        horse_id=horse_id,
        title=booking_data.title,
        description=booking_data.description,
        start_time=booking_data.start_time,
        end_time=booking_data.end_time,
        booking_type=booking_type,
        booking_status=booking_status,
        open_to_share=booking_data.open_to_share,
        payment_status=payment_status
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return get_booking_response(booking)


@router.put("/{booking_id}", response_model=BookingResponse)
def update_booking(
    booking_id: int,
    booking_data: BookingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )

    # Yard staff can update any booking
    if not has_staff_access(current_user):
        if booking.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this booking"
            )

    new_start = booking_data.start_time or booking.start_time
    new_end = booking_data.end_time or booking.end_time

    if new_start >= new_end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End time must be after start time"
        )

    if booking_data.start_time or booking_data.end_time:
        if check_booking_conflict(db, booking.arena_id, new_start, new_end, booking_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Time slot is already booked"
            )

        # Re-validate livery booking rules if times changed
        if booking.booking_type == BookingType.LIVERY and booking.horse_id:
            new_status = validate_livery_booking_rules(
                db, booking.user, booking.horse_id,
                new_start, new_end, booking_id
            )
            booking.booking_status = new_status

    update_data = booking_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(booking, field, value)

    db.commit()
    db.refresh(booking)
    return get_booking_response(booking)


@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_booking(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )

    # Yard staff can delete any booking
    if not has_staff_access(current_user):
        if booking.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this booking"
            )

    db.delete(booking)
    db.commit()


# ============== Arena Usage Report ==============

BOOKING_TYPE_LABELS = {
    BookingType.PUBLIC: "Private/External Booking",
    BookingType.LIVERY: "Livery Usage",
    BookingType.EVENT: "Events",
    BookingType.MAINTENANCE: "Maintenance",
    BookingType.TRAINING_CLINIC: "Training Clinics",
}


def calculate_usage_for_period(
    db: Session,
    start_date: datetime,
    end_date: datetime,
    period_label: str
) -> PeriodUsageReport:
    """Calculate arena usage statistics for a given period."""
    arenas = db.query(Arena).filter(Arena.is_active == True).all()

    arena_summaries = []
    total_hours = 0.0

    for arena in arenas:
        # Get all bookings for this arena in the period
        bookings = db.query(Booking).filter(
            Booking.arena_id == arena.id,
            Booking.start_time >= start_date,
            Booking.end_time <= end_date
        ).all()

        # Calculate hours by booking type
        usage_by_type = {}
        arena_total = 0.0

        for booking in bookings:
            duration_hours = (booking.end_time - booking.start_time).total_seconds() / 3600
            booking_type = booking.booking_type.value

            if booking_type not in usage_by_type:
                usage_by_type[booking_type] = {"hours": 0.0, "count": 0}

            usage_by_type[booking_type]["hours"] += duration_hours
            usage_by_type[booking_type]["count"] += 1
            arena_total += duration_hours

        # Convert to list of BookingTypeUsage
        usage_list = []
        for bt in BookingType:
            if bt.value in usage_by_type:
                usage_list.append(BookingTypeUsage(
                    booking_type=bt.value,
                    label=BOOKING_TYPE_LABELS.get(bt, bt.value.title()),
                    total_hours=round(usage_by_type[bt.value]["hours"], 2),
                    booking_count=usage_by_type[bt.value]["count"]
                ))
            else:
                usage_list.append(BookingTypeUsage(
                    booking_type=bt.value,
                    label=BOOKING_TYPE_LABELS.get(bt, bt.value.title()),
                    total_hours=0.0,
                    booking_count=0
                ))

        arena_summaries.append(ArenaUsageSummary(
            arena_id=arena.id,
            arena_name=arena.name,
            total_hours=round(arena_total, 2),
            usage_by_type=usage_list
        ))

        total_hours += arena_total

    return PeriodUsageReport(
        period_label=period_label,
        start_date=start_date,
        end_date=end_date,
        total_hours=round(total_hours, 2),
        arena_summaries=arena_summaries
    )


@router.get("/reports/usage", response_model=ArenaUsageReport)
def get_arena_usage_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get arena usage report for previous month, quarter, and year (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    today = date.today()

    # Previous month
    prev_month_end = today.replace(day=1) - relativedelta(days=1)
    prev_month_start = prev_month_end.replace(day=1)
    prev_month_label = prev_month_start.strftime("%B %Y")

    # Previous quarter
    current_quarter = (today.month - 1) // 3
    prev_quarter_end_month = current_quarter * 3
    if prev_quarter_end_month == 0:
        prev_quarter_end = date(today.year - 1, 12, 31)
        prev_quarter_start = date(today.year - 1, 10, 1)
    else:
        prev_quarter_end = date(today.year, prev_quarter_end_month, 1) - relativedelta(days=1)
        prev_quarter_start = prev_quarter_end - relativedelta(months=2)
        prev_quarter_start = prev_quarter_start.replace(day=1)

    quarter_names = {1: "Q1", 4: "Q2", 7: "Q3", 10: "Q4"}
    prev_quarter_label = f"{quarter_names.get(prev_quarter_start.month, 'Q?')} {prev_quarter_start.year}"

    # Previous year
    prev_year_start = date(today.year - 1, 1, 1)
    prev_year_end = date(today.year - 1, 12, 31)
    prev_year_label = str(today.year - 1)

    # Convert dates to datetime for query
    prev_month_report = calculate_usage_for_period(
        db,
        datetime.combine(prev_month_start, datetime.min.time()),
        datetime.combine(prev_month_end, datetime.max.time()),
        prev_month_label
    )

    prev_quarter_report = calculate_usage_for_period(
        db,
        datetime.combine(prev_quarter_start, datetime.min.time()),
        datetime.combine(prev_quarter_end, datetime.max.time()),
        prev_quarter_label
    )

    prev_year_report = calculate_usage_for_period(
        db,
        datetime.combine(prev_year_start, datetime.min.time()),
        datetime.combine(prev_year_end, datetime.max.time()),
        prev_year_label
    )

    return ArenaUsageReport(
        previous_month=prev_month_report,
        previous_quarter=prev_quarter_report,
        previous_year=prev_year_report
    )


# ============== Pending Booking Auto-Confirm ==============

@router.post("/process-pending", status_code=status.HTTP_200_OK)
def process_pending_bookings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Process pending livery bookings and auto-confirm those that can be allocated.
    Bookings for tomorrow or earlier with no confirmed booking conflict are auto-confirmed.
    Can be called manually by admin or triggered by a scheduled job.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    tomorrow = date.today() + relativedelta(days=1)
    tomorrow_end = datetime.combine(tomorrow, datetime.max.time())

    # Find all pending bookings for tomorrow or earlier
    pending_bookings = db.query(Booking).filter(
        Booking.booking_status == BookingStatus.PENDING,
        Booking.start_time <= tomorrow_end
    ).order_by(Booking.created_at.asc()).all()  # First-come, first-served

    confirmed_count = 0
    for booking in pending_bookings:
        # Check if there's a confirmed booking that conflicts
        conflict = db.query(Booking).filter(
            Booking.arena_id == booking.arena_id,
            Booking.booking_status == BookingStatus.CONFIRMED,
            Booking.id != booking.id,
            or_(
                and_(Booking.start_time <= booking.start_time, Booking.end_time > booking.start_time),
                and_(Booking.start_time < booking.end_time, Booking.end_time >= booking.end_time),
                and_(Booking.start_time >= booking.start_time, Booking.end_time <= booking.end_time)
            )
        ).first()

        if not conflict:
            # No conflict - auto-confirm
            booking.booking_status = BookingStatus.CONFIRMED
            confirmed_count += 1

    db.commit()

    return {
        "processed": len(pending_bookings),
        "confirmed": confirmed_count,
        "message": f"Processed {len(pending_bookings)} pending booking(s), confirmed {confirmed_count}"
    }


@router.put("/{booking_id}/cancel", response_model=BookingResponse)
def cancel_booking(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel a booking (sets status to cancelled instead of deleting)."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )

    # Admin can cancel any booking, users can cancel their own
    if not has_staff_access(current_user):
        if booking.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to cancel this booking"
            )

    booking.booking_status = BookingStatus.CANCELLED
    db.commit()
    db.refresh(booking)

    return get_booking_response(booking)

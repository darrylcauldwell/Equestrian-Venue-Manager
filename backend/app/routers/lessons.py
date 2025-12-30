"""
Router for ad-hoc lesson booking feature.
"""
from datetime import datetime, date, time, timedelta
from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.coach import (
    CoachProfile, CoachRecurringSchedule, CoachAvailabilitySlot,
    LessonRequest, AvailabilityMode, BookingMode, LessonRequestStatus
)
from app.models.clinic import Discipline
from app.models.booking import PaymentStatus, Booking, BookingType, BookingStatus
from app.models.horse import Horse
from app.models.arena import Arena
from app.models.account import LedgerEntry, TransactionType
from app.schemas.coach import (
    EnumInfo, LessonEnums,
    CoachProfileCreate, CoachProfileUpdate, CoachProfileAdminUpdate,
    CoachProfileResponse, CoachProfileListResponse,
    RecurringScheduleCreate, RecurringScheduleResponse,
    AvailabilitySlotCreate, AvailabilitySlotResponse,
    LessonRequestCreate, LessonBookCreate, LessonRequestResponse,
    CoachAcceptLesson, CoachDeclineLesson, CoachCancelLesson, CoachBookLesson,
    CoachAvailabilityResponse
)
from app.utils.auth import get_current_user, get_current_user_optional

router = APIRouter()


# ============== Helper Functions ==============

def require_coach(user: User):
    """Require user to have COACH role."""
    if user.role != UserRole.COACH and user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Coach access required")


def require_admin(user: User):
    """Require user to have ADMIN role."""
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")


def calculate_price(coach_profile: CoachProfile, user: Optional[User] = None) -> tuple:
    """Calculate lesson price based on user role. Guests pay standard rate."""
    coach_fee = Decimal(str(coach_profile.coach_fee))

    # Livery users get reduced venue fee, guests pay standard rate
    if user and user.role == UserRole.LIVERY:
        venue_fee = Decimal(str(coach_profile.livery_venue_fee or 0))
    else:
        venue_fee = Decimal(str(coach_profile.venue_fee or 0))

    total_price = coach_fee + venue_fee
    return coach_fee, venue_fee, total_price


def build_coach_response(
    profile: CoachProfile,
    include_availability: bool = False,
    arena_lookup: Optional[dict] = None
) -> dict:
    """Build response dict for a coach profile."""
    coach_fee = Decimal(str(profile.coach_fee))
    venue_fee = Decimal(str(profile.venue_fee or 0))
    livery_venue_fee = Decimal(str(profile.livery_venue_fee or 0))

    # Get arena name if we have arena_id and a lookup dict
    arena_name = None
    if profile.arena_id and arena_lookup:
        arena_name = arena_lookup.get(profile.arena_id)

    response = {
        "id": profile.id,
        "user_id": profile.user_id,
        "disciplines": profile.disciplines,
        "arena_id": profile.arena_id,
        "teaching_description": profile.teaching_description,
        "bio": profile.bio,
        "availability_mode": profile.availability_mode,
        "booking_mode": profile.booking_mode,
        "lesson_duration_minutes": profile.lesson_duration_minutes,
        "coach_fee": coach_fee,
        "venue_fee": venue_fee,
        "livery_venue_fee": livery_venue_fee,
        "is_active": profile.is_active,
        "approved_by_id": profile.approved_by_id,
        "approved_at": profile.approved_at,
        "created_at": profile.created_at,
        "updated_at": profile.updated_at,
        "coach_name": profile.user.name if profile.user else None,
        "coach_email": profile.user.email if profile.user else None,
        "total_price": coach_fee + venue_fee,
        "livery_total_price": coach_fee + livery_venue_fee,
        "arena_name": arena_name,
    }

    if include_availability:
        response["recurring_schedules"] = [
            RecurringScheduleResponse.model_validate(s)
            for s in profile.recurring_schedules if s.is_active
        ]
        response["availability_slots"] = [
            AvailabilitySlotResponse.model_validate(s)
            for s in profile.availability_slots if not s.is_booked and s.slot_date >= date.today()
        ]

    return response


def build_lesson_response(lesson: LessonRequest) -> dict:
    """Build response dict for a lesson request."""
    # Determine user name - use guest_name if no user
    user_name = None
    if lesson.user:
        user_name = lesson.user.name
    elif lesson.guest_name:
        user_name = lesson.guest_name

    return {
        "id": lesson.id,
        "coach_profile_id": lesson.coach_profile_id,
        "user_id": lesson.user_id,
        "horse_id": lesson.horse_id,
        "requested_date": lesson.requested_date,
        "requested_time": lesson.requested_time,
        "alternative_dates": lesson.alternative_dates,
        "discipline": lesson.discipline.value if lesson.discipline else None,
        "notes": lesson.notes,
        "coach_fee": lesson.coach_fee,
        "venue_fee": lesson.venue_fee,
        "total_price": lesson.total_price,
        "confirmed_date": lesson.confirmed_date,
        "confirmed_start_time": lesson.confirmed_start_time,
        "confirmed_end_time": lesson.confirmed_end_time,
        "arena_id": lesson.arena_id,
        "status": lesson.status,
        "coach_response": lesson.coach_response,
        "declined_reason": lesson.declined_reason,
        "payment_status": lesson.payment_status,
        "payment_ref": lesson.payment_ref,
        "created_at": lesson.created_at,
        "updated_at": lesson.updated_at,
        "responded_at": lesson.responded_at,
        # Guest fields
        "guest_name": lesson.guest_name,
        "guest_email": lesson.guest_email,
        "guest_phone": lesson.guest_phone,
        # Computed fields
        "coach_name": lesson.coach_profile.user.name if lesson.coach_profile and lesson.coach_profile.user else None,
        "user_name": user_name,
        "horse_name": lesson.horse.name if lesson.horse else None,
        "arena_name": lesson.arena.name if lesson.arena else None,
    }


# ============== Label Maps ==============

DISCIPLINE_LABELS = {
    Discipline.DRESSAGE: "Dressage",
    Discipline.SHOW_JUMPING: "Show Jumping",
    Discipline.CROSS_COUNTRY: "Cross Country",
    Discipline.EVENTING: "Eventing",
    Discipline.FLATWORK: "Flatwork",
    Discipline.POLEWORK: "Polework",
    Discipline.HACKING: "Hacking",
    Discipline.GROUNDWORK: "Groundwork",
    Discipline.LUNGING: "Lunging",
    Discipline.NATURAL_HORSEMANSHIP: "Natural Horsemanship",
    Discipline.OTHER: "Other",
}

AVAILABILITY_MODE_LABELS = {
    AvailabilityMode.RECURRING: "Weekly Schedule",
    AvailabilityMode.SPECIFIC: "Specific Slots",
    AvailabilityMode.ALWAYS: "Always Available",
}

BOOKING_MODE_LABELS = {
    BookingMode.AUTO_ACCEPT: "Book Directly",
    BookingMode.REQUEST_FIRST: "Request First",
}

STATUS_LABELS = {
    LessonRequestStatus.PENDING: "Pending",
    LessonRequestStatus.ACCEPTED: "Accepted",
    LessonRequestStatus.DECLINED: "Declined",
    LessonRequestStatus.CONFIRMED: "Confirmed",
    LessonRequestStatus.CANCELLED: "Cancelled",
    LessonRequestStatus.COMPLETED: "Completed",
}


# ============== Enum Routes ==============

@router.get("/enums", response_model=LessonEnums)
def get_enums():
    """Get enum options for forms."""
    return LessonEnums(
        disciplines=[
            EnumInfo(value=d.value, label=DISCIPLINE_LABELS.get(d, d.value.title()))
            for d in Discipline
        ],
        availability_modes=[
            EnumInfo(value=m.value, label=AVAILABILITY_MODE_LABELS.get(m, m.value.title()))
            for m in AvailabilityMode
        ],
        booking_modes=[
            EnumInfo(value=m.value, label=BOOKING_MODE_LABELS.get(m, m.value.title()))
            for m in BookingMode
        ],
        statuses=[
            EnumInfo(value=s.value, label=STATUS_LABELS.get(s, s.value.title()))
            for s in LessonRequestStatus
        ],
    )


# ============== Public Routes - Browse Coaches ==============

@router.get("/coaches", response_model=List[CoachProfileListResponse])
def list_available_coaches(
    discipline: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List active coach profiles for public browsing."""
    query = db.query(CoachProfile).filter(CoachProfile.is_active == True)

    profiles = query.all()

    # Filter by discipline if specified
    if discipline:
        profiles = [
            p for p in profiles
            if p.disciplines and discipline in p.disciplines
        ]

    # Build arena lookup for names
    all_arenas = db.query(Arena).filter(Arena.is_active == True).all()
    arena_lookup = {a.id: a.name for a in all_arenas}

    return [build_coach_response(p, arena_lookup=arena_lookup) for p in profiles]


@router.get("/coaches/{coach_id}", response_model=CoachProfileResponse)
def get_coach_details(
    coach_id: int,
    db: Session = Depends(get_db)
):
    """Get detailed coach profile."""
    profile = db.query(CoachProfile).filter(
        CoachProfile.id == coach_id,
        CoachProfile.is_active == True
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Coach not found")

    # Build arena lookup for names
    all_arenas = db.query(Arena).filter(Arena.is_active == True).all()
    arena_lookup = {a.id: a.name for a in all_arenas}

    return build_coach_response(profile, include_availability=True, arena_lookup=arena_lookup)


@router.get("/coaches/{coach_id}/availability", response_model=CoachAvailabilityResponse)
def get_coach_availability(
    coach_id: int,
    from_date: date = Query(..., description="Start date for availability"),
    to_date: date = Query(..., description="End date for availability"),
    db: Session = Depends(get_db)
):
    """Get coach availability for a date range."""
    profile = db.query(CoachProfile).filter(
        CoachProfile.id == coach_id,
        CoachProfile.is_active == True
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Coach not found")

    recurring = [
        RecurringScheduleResponse.model_validate(s)
        for s in profile.recurring_schedules if s.is_active
    ]

    # Get specific slots in date range
    available_slots = [
        AvailabilitySlotResponse.model_validate(s)
        for s in profile.availability_slots
        if not s.is_booked and from_date <= s.slot_date <= to_date
    ]

    # Generate slots from recurring schedule
    generated_slots = []
    if profile.availability_mode == AvailabilityMode.RECURRING:
        current = from_date
        while current <= to_date:
            day_of_week = current.weekday()
            for schedule in profile.recurring_schedules:
                if schedule.is_active and schedule.day_of_week == day_of_week:
                    # Check if this slot is already booked via lesson request
                    existing = db.query(LessonRequest).filter(
                        LessonRequest.coach_profile_id == coach_id,
                        LessonRequest.confirmed_date == current,
                        LessonRequest.status.in_([
                            LessonRequestStatus.ACCEPTED,
                            LessonRequestStatus.CONFIRMED
                        ])
                    ).first()

                    if not existing:
                        generated_slots.append(AvailabilitySlotResponse(
                            id=0,  # Generated, not stored
                            slot_date=current,
                            start_time=schedule.start_time,
                            end_time=schedule.end_time,
                            is_booked=False,
                            created_at=datetime.utcnow()
                        ))
            current += timedelta(days=1)

    return CoachAvailabilityResponse(
        coach_profile_id=coach_id,
        availability_mode=profile.availability_mode,
        booking_mode=profile.booking_mode,
        lesson_duration_minutes=profile.lesson_duration_minutes,
        recurring_schedules=recurring,
        available_slots=available_slots,
        generated_slots=generated_slots
    )


# ============== User Routes - Lesson Requests ==============

@router.post("/book", response_model=LessonRequestResponse)
def book_lesson(
    data: LessonBookCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Book a lesson directly (for auto-accept coaches). Supports guest bookings."""
    # Validate guest booking has required fields
    if not current_user:
        if not data.guest_name or not data.guest_email:
            raise HTTPException(
                status_code=400,
                detail="Guest bookings require name and email"
            )

    profile = db.query(CoachProfile).filter(
        CoachProfile.id == data.coach_profile_id,
        CoachProfile.is_active == True
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Coach not found")

    if profile.booking_mode != BookingMode.AUTO_ACCEPT:
        raise HTTPException(
            status_code=400,
            detail="This coach requires requests. Use /request endpoint instead."
        )

    # Calculate price (guests pay standard rate)
    coach_fee, venue_fee, total_price = calculate_price(profile, current_user)

    # Calculate end time based on lesson duration
    start_dt = datetime.combine(data.requested_date, data.requested_time)
    end_dt = start_dt + timedelta(minutes=profile.lesson_duration_minutes)
    end_time = end_dt.time()

    # Create lesson request as accepted
    lesson = LessonRequest(
        coach_profile_id=data.coach_profile_id,
        user_id=current_user.id if current_user else None,
        horse_id=data.horse_id if current_user else None,  # Guests can't select horses
        guest_name=data.guest_name if not current_user else None,
        guest_email=data.guest_email if not current_user else None,
        guest_phone=data.guest_phone if not current_user else None,
        requested_date=data.requested_date,
        requested_time=data.requested_time,
        discipline=data.discipline,
        notes=data.notes,
        coach_fee=coach_fee,
        venue_fee=venue_fee,
        total_price=total_price,
        confirmed_date=data.requested_date,
        confirmed_start_time=data.requested_time,
        confirmed_end_time=end_time,
        arena_id=data.arena_id,
        status=LessonRequestStatus.ACCEPTED,
        responded_at=datetime.utcnow()
    )

    db.add(lesson)
    db.flush()

    # If booking a specific slot, mark it as booked
    if data.slot_id:
        slot = db.query(CoachAvailabilitySlot).filter(
            CoachAvailabilitySlot.id == data.slot_id,
            CoachAvailabilitySlot.coach_profile_id == data.coach_profile_id
        ).first()
        if slot:
            slot.is_booked = True

    # If arena is specified, create a blocking booking
    if data.arena_id:
        coach_user = db.query(User).filter(User.id == profile.user_id).first()
        student_name = current_user.name if current_user else data.guest_name

        booking = Booking(
            arena_id=data.arena_id,
            user_id=current_user.id if current_user else None,
            horse_id=data.horse_id if current_user else None,
            title=f"Lesson: {student_name} with {coach_user.name if coach_user else 'Coach'}",
            description=f"Ad-hoc lesson booking. Discipline: {data.discipline.value if data.discipline else 'General'}",
            start_time=start_dt,
            end_time=end_dt,
            booking_type=BookingType.LESSON,
            booking_status=BookingStatus.CONFIRMED,
            payment_status=PaymentStatus.PENDING,
            guest_name=data.guest_name if not current_user else None,
            guest_email=data.guest_email if not current_user else None,
            guest_phone=data.guest_phone if not current_user else None,
        )
        db.add(booking)
        db.flush()

        # Link the booking to the lesson
        lesson.booking_id = booking.id

    db.commit()
    db.refresh(lesson)

    return build_lesson_response(lesson)


@router.post("/request", response_model=LessonRequestResponse)
def request_lesson(
    data: LessonRequestCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Request a lesson (for request-first coaches). Supports guest requests."""
    # Validate guest booking has required fields
    if not current_user:
        if not data.guest_name or not data.guest_email:
            raise HTTPException(
                status_code=400,
                detail="Guest requests require name and email"
            )

    profile = db.query(CoachProfile).filter(
        CoachProfile.id == data.coach_profile_id,
        CoachProfile.is_active == True
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Coach not found")

    # Calculate price (guests pay standard rate)
    coach_fee, venue_fee, total_price = calculate_price(profile, current_user)

    # Create lesson request as pending
    lesson = LessonRequest(
        coach_profile_id=data.coach_profile_id,
        user_id=current_user.id if current_user else None,
        horse_id=data.horse_id if current_user else None,  # Guests can't select horses
        guest_name=data.guest_name if not current_user else None,
        guest_email=data.guest_email if not current_user else None,
        guest_phone=data.guest_phone if not current_user else None,
        requested_date=data.requested_date,
        requested_time=data.requested_time,
        alternative_dates=data.alternative_dates,
        discipline=data.discipline,
        notes=data.notes,
        coach_fee=coach_fee,
        venue_fee=venue_fee,
        total_price=total_price,
        status=LessonRequestStatus.PENDING
    )

    db.add(lesson)
    db.commit()
    db.refresh(lesson)

    return build_lesson_response(lesson)


@router.get("/my-lessons", response_model=List[LessonRequestResponse])
def list_my_lessons(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List current user's lesson bookings and requests."""
    query = db.query(LessonRequest).filter(
        LessonRequest.user_id == current_user.id
    )

    if status:
        query = query.filter(LessonRequest.status == status)

    lessons = query.order_by(LessonRequest.created_at.desc()).all()

    return [build_lesson_response(l) for l in lessons]


@router.delete("/my-lessons/{lesson_id}")
def cancel_my_lesson(
    lesson_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel a lesson request/booking."""
    lesson = db.query(LessonRequest).filter(
        LessonRequest.id == lesson_id,
        LessonRequest.user_id == current_user.id
    ).first()

    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    if lesson.status in [LessonRequestStatus.CONFIRMED, LessonRequestStatus.COMPLETED]:
        raise HTTPException(
            status_code=400,
            detail="Cannot cancel confirmed or completed lessons"
        )

    lesson.status = LessonRequestStatus.CANCELLED

    # Also cancel the linked booking if exists
    if lesson.booking_id:
        booking = db.query(Booking).filter(Booking.id == lesson.booking_id).first()
        if booking:
            booking.booking_status = BookingStatus.CANCELLED

    db.commit()

    return {"message": "Lesson cancelled successfully"}


# ============== Coach Routes - Profile Management ==============

@router.get("/my-profile", response_model=CoachProfileResponse)
def get_my_coach_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current coach's profile."""
    require_coach(current_user)

    profile = db.query(CoachProfile).filter(
        CoachProfile.user_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Coach profile not found. Create one first.")

    return build_coach_response(profile, include_availability=True)


@router.post("/my-profile", response_model=CoachProfileResponse)
def create_coach_profile(
    data: CoachProfileCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a coach profile."""
    require_coach(current_user)

    # Check if profile already exists
    existing = db.query(CoachProfile).filter(
        CoachProfile.user_id == current_user.id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Coach profile already exists")

    profile = CoachProfile(
        user_id=current_user.id,
        disciplines=data.disciplines,
        teaching_description=data.teaching_description,
        bio=data.bio,
        availability_mode=data.availability_mode,
        booking_mode=data.booking_mode,
        lesson_duration_minutes=data.lesson_duration_minutes,
        coach_fee=data.coach_fee,
        is_active=False  # Requires admin approval
    )

    db.add(profile)
    db.commit()
    db.refresh(profile)

    return build_coach_response(profile)


@router.put("/my-profile", response_model=CoachProfileResponse)
def update_coach_profile(
    data: CoachProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update coach profile."""
    require_coach(current_user)

    profile = db.query(CoachProfile).filter(
        CoachProfile.user_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Coach profile not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    profile.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(profile)

    return build_coach_response(profile, include_availability=True)


# ============== Coach Routes - Availability Management ==============

@router.get("/my-profile/recurring", response_model=List[RecurringScheduleResponse])
def list_my_recurring_schedule(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List coach's recurring schedule."""
    require_coach(current_user)

    profile = db.query(CoachProfile).filter(
        CoachProfile.user_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Coach profile not found")

    return [RecurringScheduleResponse.model_validate(s) for s in profile.recurring_schedules]


@router.post("/my-profile/recurring", response_model=RecurringScheduleResponse)
def add_recurring_schedule(
    data: RecurringScheduleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a recurring schedule slot."""
    require_coach(current_user)

    profile = db.query(CoachProfile).filter(
        CoachProfile.user_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Coach profile not found")

    schedule = CoachRecurringSchedule(
        coach_profile_id=profile.id,
        day_of_week=data.day_of_week,
        start_time=data.start_time,
        end_time=data.end_time
    )

    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    return RecurringScheduleResponse.model_validate(schedule)


@router.delete("/my-profile/recurring/{schedule_id}")
def remove_recurring_schedule(
    schedule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a recurring schedule slot."""
    require_coach(current_user)

    profile = db.query(CoachProfile).filter(
        CoachProfile.user_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Coach profile not found")

    schedule = db.query(CoachRecurringSchedule).filter(
        CoachRecurringSchedule.id == schedule_id,
        CoachRecurringSchedule.coach_profile_id == profile.id
    ).first()

    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    db.delete(schedule)
    db.commit()

    return {"message": "Schedule removed successfully"}


@router.get("/my-profile/slots", response_model=List[AvailabilitySlotResponse])
def list_my_availability_slots(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List coach's specific availability slots."""
    require_coach(current_user)

    profile = db.query(CoachProfile).filter(
        CoachProfile.user_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Coach profile not found")

    slots = db.query(CoachAvailabilitySlot).filter(
        CoachAvailabilitySlot.coach_profile_id == profile.id,
        CoachAvailabilitySlot.slot_date >= date.today()
    ).order_by(CoachAvailabilitySlot.slot_date, CoachAvailabilitySlot.start_time).all()

    return [AvailabilitySlotResponse.model_validate(s) for s in slots]


@router.post("/my-profile/slots", response_model=AvailabilitySlotResponse)
def add_availability_slot(
    data: AvailabilitySlotCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a specific availability slot."""
    require_coach(current_user)

    profile = db.query(CoachProfile).filter(
        CoachProfile.user_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Coach profile not found")

    slot = CoachAvailabilitySlot(
        coach_profile_id=profile.id,
        slot_date=data.slot_date,
        start_time=data.start_time,
        end_time=data.end_time
    )

    db.add(slot)
    db.commit()
    db.refresh(slot)

    return AvailabilitySlotResponse.model_validate(slot)


@router.delete("/my-profile/slots/{slot_id}")
def remove_availability_slot(
    slot_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a specific availability slot."""
    require_coach(current_user)

    profile = db.query(CoachProfile).filter(
        CoachProfile.user_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Coach profile not found")

    slot = db.query(CoachAvailabilitySlot).filter(
        CoachAvailabilitySlot.id == slot_id,
        CoachAvailabilitySlot.coach_profile_id == profile.id
    ).first()

    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    if slot.is_booked:
        raise HTTPException(status_code=400, detail="Cannot remove a booked slot")

    db.delete(slot)
    db.commit()

    return {"message": "Slot removed successfully"}


# ============== Coach Routes - Handle Requests ==============

@router.get("/incoming", response_model=List[LessonRequestResponse])
def list_incoming_requests(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List incoming lesson requests for coach."""
    require_coach(current_user)

    profile = db.query(CoachProfile).filter(
        CoachProfile.user_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Coach profile not found")

    query = db.query(LessonRequest).filter(
        LessonRequest.coach_profile_id == profile.id
    )

    if status:
        query = query.filter(LessonRequest.status == status)

    lessons = query.order_by(LessonRequest.created_at.desc()).all()

    return [build_lesson_response(l) for l in lessons]


@router.put("/{lesson_id}/accept", response_model=LessonRequestResponse)
def accept_lesson_request(
    lesson_id: int,
    data: CoachAcceptLesson,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Accept a lesson request."""
    require_coach(current_user)

    profile = db.query(CoachProfile).filter(
        CoachProfile.user_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Coach profile not found")

    lesson = db.query(LessonRequest).filter(
        LessonRequest.id == lesson_id,
        LessonRequest.coach_profile_id == profile.id
    ).first()

    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson request not found")

    if lesson.status != LessonRequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only accept pending requests")

    # Go straight to CONFIRMED (no separate payment step)
    lesson.status = LessonRequestStatus.CONFIRMED
    lesson.payment_status = PaymentStatus.NOT_REQUIRED
    lesson.confirmed_date = data.confirmed_date
    lesson.confirmed_start_time = data.confirmed_start_time
    lesson.confirmed_end_time = data.confirmed_end_time
    lesson.arena_id = data.arena_id
    lesson.coach_response = data.coach_response
    lesson.responded_at = datetime.utcnow()

    # If arena is specified, create a blocking booking
    if data.arena_id:
        # Get user and coach names for the booking title
        student = db.query(User).filter(User.id == lesson.user_id).first()
        coach_user = db.query(User).filter(User.id == profile.user_id).first()

        # Create datetime from date and time
        start_datetime = datetime.combine(data.confirmed_date, data.confirmed_start_time)
        end_datetime = datetime.combine(data.confirmed_date, data.confirmed_end_time)

        booking = Booking(
            arena_id=data.arena_id,
            user_id=lesson.user_id,
            horse_id=lesson.horse_id,
            title=f"Lesson: {student.name if student else 'Student'} with {coach_user.name if coach_user else 'Coach'}",
            description=f"Ad-hoc lesson booking. Discipline: {lesson.discipline.value if lesson.discipline else 'General'}",
            start_time=start_datetime,
            end_time=end_datetime,
            booking_type=BookingType.LESSON,
            booking_status=BookingStatus.CONFIRMED,
            payment_status=PaymentStatus.PENDING,
        )
        db.add(booking)
        db.flush()

        # Link the booking to the lesson
        lesson.booking_id = booking.id

    db.commit()
    db.refresh(lesson)

    return build_lesson_response(lesson)


@router.put("/{lesson_id}/decline", response_model=LessonRequestResponse)
def decline_lesson_request(
    lesson_id: int,
    data: CoachDeclineLesson,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Decline a lesson request."""
    require_coach(current_user)

    profile = db.query(CoachProfile).filter(
        CoachProfile.user_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Coach profile not found")

    lesson = db.query(LessonRequest).filter(
        LessonRequest.id == lesson_id,
        LessonRequest.coach_profile_id == profile.id
    ).first()

    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson request not found")

    if lesson.status != LessonRequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only decline pending requests")

    lesson.status = LessonRequestStatus.DECLINED
    lesson.declined_reason = data.declined_reason
    lesson.responded_at = datetime.utcnow()

    db.commit()
    db.refresh(lesson)

    return build_lesson_response(lesson)


@router.put("/{lesson_id}/cancel", response_model=LessonRequestResponse)
def cancel_lesson_as_coach(
    lesson_id: int,
    data: CoachCancelLesson,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel a lesson as coach (with reason)."""
    require_coach(current_user)

    profile = db.query(CoachProfile).filter(
        CoachProfile.user_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Coach profile not found")

    lesson = db.query(LessonRequest).filter(
        LessonRequest.id == lesson_id,
        LessonRequest.coach_profile_id == profile.id
    ).first()

    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    if lesson.status == LessonRequestStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Cannot cancel completed lessons")

    if lesson.status == LessonRequestStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Lesson already cancelled")

    lesson.status = LessonRequestStatus.CANCELLED
    lesson.declined_reason = data.cancellation_reason
    lesson.responded_at = datetime.utcnow()

    # Also cancel the linked booking if exists
    if lesson.booking_id:
        booking = db.query(Booking).filter(Booking.id == lesson.booking_id).first()
        if booking:
            booking.booking_status = BookingStatus.CANCELLED

    db.commit()
    db.refresh(lesson)

    return build_lesson_response(lesson)


class StudentInfo(BaseModel):
    """Basic user info for coach booking dropdown."""
    id: int
    name: str
    email: str
    role: str


@router.get("/students", response_model=List[StudentInfo])
def list_students_for_booking(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get list of users that a coach can book lessons for.
    Returns users who have previously booked with this coach, plus all livery users.
    """
    require_coach(current_user)

    profile = db.query(CoachProfile).filter(
        CoachProfile.user_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Coach profile not found")

    # Get users who have had lessons with this coach
    previous_students = db.query(User).join(
        LessonRequest, LessonRequest.user_id == User.id
    ).filter(
        LessonRequest.coach_profile_id == profile.id,
        User.id != current_user.id
    ).distinct().all()

    # Also get all livery and public users (potential students)
    all_users = db.query(User).filter(
        User.id != current_user.id,
        User.is_active == True,
        User.role.in_([UserRole.LIVERY, UserRole.PUBLIC])
    ).all()

    # Combine and deduplicate
    user_ids = set()
    students = []
    for user in previous_students + all_users:
        if user.id not in user_ids:
            user_ids.add(user.id)
            students.append(StudentInfo(
                id=user.id,
                name=user.name,
                email=user.email,
                role=user.role.value
            ))

    # Sort by name
    students.sort(key=lambda x: x.name)

    return students


@router.post("/coach-book", response_model=LessonRequestResponse)
def coach_book_lesson(
    data: CoachBookLesson,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Allow a coach to book a lesson on behalf of a student.
    Useful for scheduling follow-up lessons after a session.
    """
    require_coach(current_user)

    profile = db.query(CoachProfile).filter(
        CoachProfile.user_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Coach profile not found")

    if not profile.is_active:
        raise HTTPException(status_code=400, detail="Your coach profile is not active")

    # Validate: must have either user_id or guest details
    if not data.user_id and not data.guest_name:
        raise HTTPException(
            status_code=400,
            detail="Must provide either a user ID or guest name"
        )

    # If user_id provided, verify the user exists
    student = None
    if data.user_id:
        student = db.query(User).filter(User.id == data.user_id).first()
        if not student:
            raise HTTPException(status_code=404, detail="Student user not found")

    # Calculate price (use livery rate if student is livery, else standard rate)
    coach_fee = Decimal(str(profile.coach_fee))
    if student and student.role == UserRole.LIVERY:
        venue_fee = Decimal(str(profile.livery_venue_fee or 0))
    else:
        venue_fee = Decimal(str(profile.venue_fee or 0))
    total_price = coach_fee + venue_fee

    # Create the lesson as confirmed (coach is booking it directly)
    lesson = LessonRequest(
        coach_profile_id=profile.id,
        user_id=data.user_id,
        horse_id=data.horse_id,
        guest_name=data.guest_name if not data.user_id else None,
        guest_email=data.guest_email if not data.user_id else None,
        guest_phone=data.guest_phone if not data.user_id else None,
        requested_date=data.booking_date,
        requested_time=data.start_time,
        discipline=data.discipline,
        notes=data.notes,
        coach_fee=coach_fee,
        venue_fee=venue_fee,
        total_price=total_price,
        confirmed_date=data.booking_date,
        confirmed_start_time=data.start_time,
        confirmed_end_time=data.end_time,
        arena_id=data.arena_id,
        status=LessonRequestStatus.ACCEPTED,  # Coach-booked lessons are automatically accepted
        responded_at=datetime.utcnow()
    )

    db.add(lesson)
    db.flush()

    # If arena is specified, create a blocking booking
    if data.arena_id:
        student_name = student.name if student else data.guest_name

        start_datetime = datetime.combine(data.booking_date, data.start_time)
        end_datetime = datetime.combine(data.booking_date, data.end_time)

        booking = Booking(
            arena_id=data.arena_id,
            user_id=data.user_id,
            horse_id=data.horse_id,
            title=f"Lesson: {student_name} with {current_user.name}",
            description=f"Ad-hoc lesson booked by coach. Discipline: {data.discipline.value if data.discipline else 'General'}",
            start_time=start_datetime,
            end_time=end_datetime,
            booking_type=BookingType.LESSON,
            booking_status=BookingStatus.CONFIRMED,
            payment_status=PaymentStatus.PENDING,
            guest_name=data.guest_name if not data.user_id else None,
            guest_email=data.guest_email if not data.user_id else None,
            guest_phone=data.guest_phone if not data.user_id else None,
        )
        db.add(booking)
        db.flush()

        # Link the booking to the lesson
        lesson.booking_id = booking.id

    db.commit()
    db.refresh(lesson)

    return build_lesson_response(lesson)


# ============== Admin Routes ==============

@router.get("/admin/profiles", response_model=List[CoachProfileResponse])
def list_all_coach_profiles(
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all coach profiles (admin only)."""
    require_admin(current_user)

    query = db.query(CoachProfile)

    if is_active is not None:
        query = query.filter(CoachProfile.is_active == is_active)

    profiles = query.all()

    return [build_coach_response(p, include_availability=True) for p in profiles]


@router.put("/admin/profiles/{profile_id}", response_model=CoachProfileResponse)
def update_coach_profile_admin(
    profile_id: int,
    data: CoachProfileAdminUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update coach profile (admin only) - set venue fees, activate/deactivate."""
    require_admin(current_user)

    profile = db.query(CoachProfile).filter(CoachProfile.id == profile_id).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Coach profile not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    profile.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(profile)

    return build_coach_response(profile, include_availability=True)


@router.put("/admin/profiles/{profile_id}/approve", response_model=CoachProfileResponse)
def approve_coach_profile(
    profile_id: int,
    venue_fee: float = Query(..., description="Standard venue fee"),
    livery_venue_fee: float = Query(0, description="Venue fee for livery users"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve a coach profile and set venue fees."""
    require_admin(current_user)

    profile = db.query(CoachProfile).filter(CoachProfile.id == profile_id).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Coach profile not found")

    profile.venue_fee = Decimal(str(venue_fee))
    profile.livery_venue_fee = Decimal(str(livery_venue_fee))
    profile.is_active = True
    profile.approved_by_id = current_user.id
    profile.approved_at = datetime.utcnow()
    profile.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(profile)

    return build_coach_response(profile, include_availability=True)


@router.get("/admin/requests", response_model=List[LessonRequestResponse])
def list_all_lesson_requests(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all lesson requests (admin only)."""
    require_admin(current_user)

    query = db.query(LessonRequest)

    if status:
        query = query.filter(LessonRequest.status == status)

    lessons = query.order_by(LessonRequest.created_at.desc()).all()

    return [build_lesson_response(l) for l in lessons]


class AdminAcceptLesson(BaseModel):
    """Data for admin accepting a lesson."""
    confirmed_date: date
    confirmed_start_time: time
    confirmed_end_time: time
    arena_id: Optional[int] = None
    admin_notes: Optional[str] = None


class AdminDeclineLesson(BaseModel):
    """Data for admin declining a lesson."""
    declined_reason: str


@router.put("/admin/requests/{lesson_id}/accept", response_model=LessonRequestResponse)
def admin_accept_lesson(
    lesson_id: int,
    data: AdminAcceptLesson,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Accept a lesson request as admin (bypass coach workflow)."""
    require_admin(current_user)

    lesson = db.query(LessonRequest).filter(LessonRequest.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson request not found")

    if lesson.status not in [LessonRequestStatus.PENDING, LessonRequestStatus.ACCEPTED]:
        raise HTTPException(status_code=400, detail=f"Cannot accept lesson with status {lesson.status}")

    # Go straight to CONFIRMED
    lesson.status = LessonRequestStatus.CONFIRMED
    lesson.payment_status = PaymentStatus.NOT_REQUIRED
    lesson.confirmed_date = data.confirmed_date
    lesson.confirmed_start_time = data.confirmed_start_time
    lesson.confirmed_end_time = data.confirmed_end_time
    lesson.arena_id = data.arena_id
    lesson.coach_response = data.admin_notes
    lesson.responded_at = datetime.utcnow()

    # If arena is specified, create a blocking booking
    if data.arena_id:
        profile = lesson.coach_profile
        student = db.query(User).filter(User.id == lesson.user_id).first() if lesson.user_id else None
        coach_user = db.query(User).filter(User.id == profile.user_id).first() if profile else None

        student_name = student.name if student else lesson.guest_name or "Student"
        coach_name = coach_user.name if coach_user else "Coach"

        start_datetime = datetime.combine(data.confirmed_date, data.confirmed_start_time)
        end_datetime = datetime.combine(data.confirmed_date, data.confirmed_end_time)

        booking = Booking(
            arena_id=data.arena_id,
            user_id=lesson.user_id,
            horse_id=lesson.horse_id,
            title=f"Lesson: {student_name} with {coach_name}",
            description=f"Lesson confirmed by admin. Discipline: {lesson.discipline.value if lesson.discipline else 'General'}",
            start_time=start_datetime,
            end_time=end_datetime,
            booking_type=BookingType.LESSON,
            booking_status=BookingStatus.CONFIRMED,
            payment_status=PaymentStatus.PENDING,
            guest_name=lesson.guest_name if not lesson.user_id else None,
            guest_email=lesson.guest_email if not lesson.user_id else None,
            guest_phone=lesson.guest_phone if not lesson.user_id else None,
        )
        db.add(booking)
        db.flush()
        lesson.booking_id = booking.id

    db.commit()
    db.refresh(lesson)

    return build_lesson_response(lesson)


@router.put("/admin/requests/{lesson_id}/decline", response_model=LessonRequestResponse)
def admin_decline_lesson(
    lesson_id: int,
    data: AdminDeclineLesson,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Decline a lesson request as admin."""
    require_admin(current_user)

    lesson = db.query(LessonRequest).filter(LessonRequest.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson request not found")

    if lesson.status != LessonRequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only decline pending requests")

    lesson.status = LessonRequestStatus.DECLINED
    lesson.declined_reason = data.declined_reason
    lesson.responded_at = datetime.utcnow()

    db.commit()
    db.refresh(lesson)

    return build_lesson_response(lesson)


@router.put("/admin/requests/{lesson_id}/complete", response_model=LessonRequestResponse)
def admin_complete_lesson(
    lesson_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a lesson as complete (admin only)."""
    require_admin(current_user)

    lesson = db.query(LessonRequest).filter(LessonRequest.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson request not found")

    if lesson.status not in [LessonRequestStatus.ACCEPTED, LessonRequestStatus.CONFIRMED]:
        raise HTTPException(status_code=400, detail="Can only complete accepted or confirmed lessons")

    lesson.status = LessonRequestStatus.COMPLETED

    # Create ledger entry for livery users (user_id is set)
    # Guest bookings (user_id is null) pay via Stripe at booking time
    if lesson.user_id and lesson.total_price and lesson.total_price > 0:
        # Get coach name for description
        coach_name = "Coach"
        if lesson.coach_profile and lesson.coach_profile.user:
            coach_name = lesson.coach_profile.user.name

        # Get horse name if available
        horse_info = ""
        if lesson.horse:
            horse_info = f" ({lesson.horse.name})"

        description = f"Lesson with {coach_name}{horse_info}"
        if lesson.confirmed_date:
            description += f" on {lesson.confirmed_date.strftime('%d %b')}"

        ledger_entry = LedgerEntry(
            user_id=lesson.user_id,
            transaction_type=TransactionType.SERVICE_CHARGE,
            amount=lesson.total_price,
            description=description,
            created_by_id=current_user.id,
        )
        db.add(ledger_entry)

    db.commit()
    db.refresh(lesson)

    return build_lesson_response(lesson)


@router.put("/admin/requests/{lesson_id}/cancel", response_model=LessonRequestResponse)
def admin_cancel_lesson(
    lesson_id: int,
    reason: str = Query(..., description="Cancellation reason"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel a lesson request (admin only)."""
    require_admin(current_user)

    lesson = db.query(LessonRequest).filter(LessonRequest.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson request not found")

    if lesson.status in [LessonRequestStatus.COMPLETED, LessonRequestStatus.CANCELLED]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel lesson with status {lesson.status}")

    lesson.status = LessonRequestStatus.CANCELLED
    lesson.declined_reason = reason
    lesson.responded_at = datetime.utcnow()

    # Also cancel the linked booking if exists
    if lesson.booking_id:
        booking = db.query(Booking).filter(Booking.id == lesson.booking_id).first()
        if booking:
            booking.booking_status = BookingStatus.CANCELLED

    db.commit()
    db.refresh(lesson)

    return build_lesson_response(lesson)


# ============== Calendar Availability (Public) ==============

class CalendarAvailabilitySlot(BaseModel):
    """Coach availability slot for calendar display."""
    coach_profile_id: int
    coach_name: str
    slot_date: date
    start_time: time
    end_time: time
    is_recurring: bool  # True if generated from recurring schedule


class CalendarAvailabilityResponse(BaseModel):
    """Response with all coach availability for calendar display."""
    slots: List[CalendarAvailabilitySlot]


@router.get("/calendar-availability", response_model=CalendarAvailabilityResponse)
def get_calendar_availability(
    from_date: date = Query(..., description="Start date for availability"),
    to_date: date = Query(..., description="End date for availability"),
    db: Session = Depends(get_db)
):
    """
    Get all active coach availability for calendar display.
    This is a public endpoint that returns availability for visualization
    on the arena calendar (non-blocking indicator).
    """
    # Get all active coach profiles
    profiles = db.query(CoachProfile).filter(CoachProfile.is_active == True).all()

    slots = []

    for profile in profiles:
        coach_name = profile.user.name if profile.user else "Unknown Coach"

        # Handle different availability modes
        if profile.availability_mode == AvailabilityMode.RECURRING:
            # Generate slots from recurring schedules
            current = from_date
            while current <= to_date:
                day_of_week = current.weekday()
                for schedule in profile.recurring_schedules:
                    if schedule.is_active and schedule.day_of_week == day_of_week:
                        slots.append(CalendarAvailabilitySlot(
                            coach_profile_id=profile.id,
                            coach_name=coach_name,
                            slot_date=current,
                            start_time=schedule.start_time,
                            end_time=schedule.end_time,
                            is_recurring=True
                        ))
                current += timedelta(days=1)

        elif profile.availability_mode == AvailabilityMode.SPECIFIC:
            # Get specific slots in date range
            for slot in profile.availability_slots:
                if not slot.is_booked and from_date <= slot.slot_date <= to_date:
                    slots.append(CalendarAvailabilitySlot(
                        coach_profile_id=profile.id,
                        coach_name=coach_name,
                        slot_date=slot.slot_date,
                        start_time=slot.start_time,
                        end_time=slot.end_time,
                        is_recurring=False
                    ))

        # Note: ALWAYS mode doesn't create specific calendar indicators
        # since the coach is available anytime

    return CalendarAvailabilityResponse(slots=slots)


# ============== Combined Availability for Booking ==============

class ArenaBookingInfo(BaseModel):
    """Arena booking info for availability display."""
    arena_id: int
    arena_name: str
    start_time: time
    end_time: time
    booking_type: str


class TimeSlotAvailability(BaseModel):
    """A time slot showing coach availability and arena conflicts."""
    slot_date: date
    start_time: time
    end_time: time
    is_coach_available: bool
    arena_bookings: List[ArenaBookingInfo]  # Which arenas are booked at this time


class CombinedAvailabilityResponse(BaseModel):
    """Response showing coach availability with arena booking overlay."""
    coach_profile_id: int
    coach_name: str
    lesson_duration_minutes: int
    availability_mode: str
    arenas: List[dict]  # List of {id, name} for all arenas
    time_slots: List[TimeSlotAvailability]


@router.get("/coaches/{coach_id}/combined-availability", response_model=CombinedAvailabilityResponse)
def get_combined_availability(
    coach_id: int,
    from_date: date = Query(..., description="Start date"),
    to_date: date = Query(..., description="End date"),
    db: Session = Depends(get_db)
):
    """
    Get coach availability combined with arena booking information.
    This helps users see when both coach AND arenas are available.
    """
    # Get coach profile
    profile = db.query(CoachProfile).filter(
        CoachProfile.id == coach_id,
        CoachProfile.is_active == True
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Coach not found")

    coach_name = profile.user.name if profile.user else "Unknown"

    # Get the coach's arena (single arena)
    coach_arena = None
    if profile.arena_id:
        coach_arena = db.query(Arena).filter(
            Arena.id == profile.arena_id,
            Arena.is_active == True
        ).first()

    # If coach has a specific arena, use only that one; otherwise show all
    if coach_arena:
        arenas_list = [{"id": coach_arena.id, "name": coach_arena.name}]
        arenas_lookup = {coach_arena.id: coach_arena.name}
    else:
        all_arenas = db.query(Arena).filter(Arena.is_active == True).all()
        arenas_list = [{"id": a.id, "name": a.name} for a in all_arenas]
        arenas_lookup = {a.id: a.name for a in all_arenas}

    # Get all bookings in the date range - filter to coach's arena only
    from_datetime = datetime.combine(from_date, time(0, 0))
    to_datetime = datetime.combine(to_date, time(23, 59))

    # Only get bookings for the coach's arena
    booking_query = db.query(Booking).filter(
        Booking.start_time >= from_datetime,
        Booking.end_time <= to_datetime,
        Booking.booking_status != BookingStatus.CANCELLED
    )
    if coach_arena:
        booking_query = booking_query.filter(Booking.arena_id == coach_arena.id)

    arena_bookings = booking_query.all()

    # Build time slots
    time_slots = []

    current_date = from_date
    while current_date <= to_date:
        day_of_week = current_date.weekday()

        # Determine coach availability for this day
        coach_times = []  # List of (start_time, end_time) tuples

        if profile.availability_mode == AvailabilityMode.ALWAYS:
            # Coach is always available - use standard hours
            coach_times.append((time(8, 0), time(20, 0)))

        elif profile.availability_mode == AvailabilityMode.RECURRING:
            for schedule in profile.recurring_schedules:
                if schedule.is_active and schedule.day_of_week == day_of_week:
                    coach_times.append((schedule.start_time, schedule.end_time))

        elif profile.availability_mode == AvailabilityMode.SPECIFIC:
            for slot in profile.availability_slots:
                if not slot.is_booked and slot.slot_date == current_date:
                    coach_times.append((slot.start_time, slot.end_time))

        # Generate time slots for each coach availability window
        for coach_start, coach_end in coach_times:
            # Create slots based on lesson duration
            slot_start = coach_start
            duration = timedelta(minutes=profile.lesson_duration_minutes)

            while True:
                slot_start_dt = datetime.combine(current_date, slot_start)
                slot_end_dt = slot_start_dt + duration
                slot_end = slot_end_dt.time()

                if slot_end > coach_end:
                    break

                # Find arena bookings that conflict with this slot
                conflicting_bookings = []
                for booking in arena_bookings:
                    booking_start = booking.start_time
                    booking_end = booking.end_time

                    # Check if booking overlaps with this slot
                    if (booking_start < slot_end_dt and booking_end > slot_start_dt):
                        arena_name = arenas_lookup.get(booking.arena_id)
                        if arena_name:
                            conflicting_bookings.append(ArenaBookingInfo(
                                arena_id=booking.arena_id,
                                arena_name=arena_name,
                                start_time=booking_start.time(),
                                end_time=booking_end.time(),
                                booking_type=booking.booking_type.value if booking.booking_type else "unknown"
                            ))

                time_slots.append(TimeSlotAvailability(
                    slot_date=current_date,
                    start_time=slot_start,
                    end_time=slot_end,
                    is_coach_available=True,
                    arena_bookings=conflicting_bookings
                ))

                # Move to next slot
                slot_start = slot_end

        current_date += timedelta(days=1)

    return CombinedAvailabilityResponse(
        coach_profile_id=profile.id,
        coach_name=coach_name,
        lesson_duration_minutes=profile.lesson_duration_minutes,
        availability_mode=profile.availability_mode.value,
        arenas=arenas_list,
        time_slots=time_slots
    )

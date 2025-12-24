"""
Pydantic schemas for ad-hoc lessons feature.
"""
from datetime import date, time, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel

from app.models.coach import AvailabilityMode, BookingMode, LessonRequestStatus
from app.models.clinic import Discipline
from app.models.booking import PaymentStatus


# ============== Enum Info ==============

class EnumInfo(BaseModel):
    value: str
    label: str


class LessonEnums(BaseModel):
    disciplines: List[EnumInfo]
    availability_modes: List[EnumInfo]
    booking_modes: List[EnumInfo]
    statuses: List[EnumInfo]


# ============== Recurring Schedule ==============

class RecurringScheduleBase(BaseModel):
    day_of_week: int  # 0-6 (Monday-Sunday)
    start_time: time
    end_time: time


class RecurringScheduleCreate(RecurringScheduleBase):
    pass


class RecurringScheduleResponse(RecurringScheduleBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True


# ============== Availability Slot ==============

class AvailabilitySlotBase(BaseModel):
    slot_date: date
    start_time: time
    end_time: time


class AvailabilitySlotCreate(AvailabilitySlotBase):
    pass


class AvailabilitySlotResponse(AvailabilitySlotBase):
    id: int
    is_booked: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============== Coach Profile ==============

class CoachProfileBase(BaseModel):
    disciplines: Optional[List[str]] = None  # List of discipline values
    arena_id: Optional[int] = None  # Arena where coach offers lessons
    teaching_description: Optional[str] = None
    bio: Optional[str] = None
    availability_mode: AvailabilityMode = AvailabilityMode.ALWAYS
    booking_mode: BookingMode = BookingMode.REQUEST_FIRST
    lesson_duration_minutes: int = 45
    coach_fee: Decimal


class CoachProfileCreate(CoachProfileBase):
    pass


class CoachProfileUpdate(BaseModel):
    disciplines: Optional[List[str]] = None
    arena_id: Optional[int] = None
    teaching_description: Optional[str] = None
    bio: Optional[str] = None
    availability_mode: Optional[AvailabilityMode] = None
    booking_mode: Optional[BookingMode] = None
    lesson_duration_minutes: Optional[int] = None
    coach_fee: Optional[Decimal] = None


class CoachProfileAdminUpdate(BaseModel):
    """Admin sets venue fees and approves profiles."""
    venue_fee: Optional[Decimal] = None
    livery_venue_fee: Optional[Decimal] = None
    is_active: Optional[bool] = None


class CoachProfileResponse(BaseModel):
    id: int
    user_id: int
    disciplines: Optional[List[str]] = None
    arena_id: Optional[int] = None
    teaching_description: Optional[str] = None
    bio: Optional[str] = None
    availability_mode: AvailabilityMode
    booking_mode: BookingMode
    lesson_duration_minutes: int
    coach_fee: Decimal
    venue_fee: Optional[Decimal] = None
    livery_venue_fee: Optional[Decimal] = None
    is_active: bool
    approved_by_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    # Computed fields (added by router)
    coach_name: Optional[str] = None
    coach_email: Optional[str] = None
    total_price: Optional[Decimal] = None  # coach_fee + venue_fee
    livery_total_price: Optional[Decimal] = None  # coach_fee + livery_venue_fee
    # Arena name for display
    arena_name: Optional[str] = None
    # Include availability info
    recurring_schedules: Optional[List[RecurringScheduleResponse]] = None
    availability_slots: Optional[List[AvailabilitySlotResponse]] = None

    class Config:
        from_attributes = True


class CoachProfileListResponse(BaseModel):
    """Simplified response for listing coaches."""
    id: int
    user_id: int
    disciplines: Optional[List[str]] = None
    arena_id: Optional[int] = None
    teaching_description: Optional[str] = None
    availability_mode: AvailabilityMode
    booking_mode: BookingMode
    lesson_duration_minutes: int
    coach_fee: Decimal
    venue_fee: Optional[Decimal] = None
    livery_venue_fee: Optional[Decimal] = None
    is_active: bool
    coach_name: str
    total_price: Optional[Decimal] = None
    livery_total_price: Optional[Decimal] = None
    arena_name: Optional[str] = None

    class Config:
        from_attributes = True


# ============== Lesson Request ==============

class LessonRequestCreate(BaseModel):
    coach_profile_id: int
    horse_id: Optional[int] = None
    requested_date: date
    requested_time: Optional[time] = None
    alternative_dates: Optional[str] = None
    discipline: Optional[Discipline] = None
    notes: Optional[str] = None
    # Guest booking fields
    guest_name: Optional[str] = None
    guest_email: Optional[str] = None
    guest_phone: Optional[str] = None


class LessonBookCreate(BaseModel):
    """For direct booking (auto-accept coaches)."""
    coach_profile_id: int
    slot_id: Optional[int] = None  # If booking a specific slot
    arena_id: Optional[int] = None  # Arena for the lesson
    horse_id: Optional[int] = None
    requested_date: date
    requested_time: time
    discipline: Optional[Discipline] = None
    notes: Optional[str] = None
    # Guest booking fields
    guest_name: Optional[str] = None
    guest_email: Optional[str] = None
    guest_phone: Optional[str] = None


class CoachAcceptLesson(BaseModel):
    confirmed_date: date
    confirmed_start_time: time
    confirmed_end_time: time
    arena_id: Optional[int] = None
    coach_response: Optional[str] = None


class CoachDeclineLesson(BaseModel):
    declined_reason: str


class CoachCancelLesson(BaseModel):
    cancellation_reason: str


class CoachBookLesson(BaseModel):
    """For coaches to book lessons on behalf of students."""
    user_id: Optional[int] = None  # Existing user (student)
    horse_id: Optional[int] = None
    arena_id: Optional[int] = None
    booking_date: date
    start_time: time
    end_time: time
    discipline: Optional[Discipline] = None
    notes: Optional[str] = None
    # Guest booking fields (if not an existing user)
    guest_name: Optional[str] = None
    guest_email: Optional[str] = None
    guest_phone: Optional[str] = None


class LessonRequestResponse(BaseModel):
    id: int
    coach_profile_id: int
    user_id: Optional[int] = None  # Nullable for guest bookings
    horse_id: Optional[int] = None
    requested_date: date
    requested_time: Optional[time] = None
    alternative_dates: Optional[str] = None
    discipline: Optional[str] = None
    notes: Optional[str] = None
    coach_fee: Decimal
    venue_fee: Decimal
    venue_fee_waived: bool = False
    total_price: Decimal
    confirmed_date: Optional[date] = None
    confirmed_start_time: Optional[time] = None
    confirmed_end_time: Optional[time] = None
    arena_id: Optional[int] = None
    status: LessonRequestStatus
    coach_response: Optional[str] = None
    declined_reason: Optional[str] = None
    payment_status: PaymentStatus
    payment_ref: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    responded_at: Optional[datetime] = None
    # Guest booking fields
    guest_name: Optional[str] = None
    guest_email: Optional[str] = None
    guest_phone: Optional[str] = None
    # Computed fields
    coach_name: Optional[str] = None
    user_name: Optional[str] = None
    horse_name: Optional[str] = None
    arena_name: Optional[str] = None

    class Config:
        from_attributes = True


# ============== Availability Response ==============

class CoachAvailabilityResponse(BaseModel):
    """Response for GET /coaches/{id}/availability."""
    coach_profile_id: int
    availability_mode: AvailabilityMode
    booking_mode: BookingMode
    lesson_duration_minutes: int
    # Recurring schedules (if mode is RECURRING)
    recurring_schedules: List[RecurringScheduleResponse] = []
    # Specific slots (if mode is SPECIFIC)
    available_slots: List[AvailabilitySlotResponse] = []
    # Generated time slots based on recurring schedule for requested date range
    generated_slots: List[AvailabilitySlotResponse] = []

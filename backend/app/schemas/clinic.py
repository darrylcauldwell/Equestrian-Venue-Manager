from datetime import datetime, date, time
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, EmailStr

from app.models.clinic import Discipline, LessonFormat, ClinicStatus


# ============== Clinic Request Schemas ==============

class ClinicRequestBase(BaseModel):
    coach_name: str
    coach_email: EmailStr
    coach_phone: Optional[str] = None
    coach_bio: Optional[str] = None
    discipline: Discipline
    title: Optional[str] = None
    description: Optional[str] = None
    proposed_date: date
    proposed_end_date: Optional[date] = None
    proposed_start_time: Optional[time] = None
    proposed_end_time: Optional[time] = None
    arena_required: Optional[str] = None
    lesson_format: LessonFormat = LessonFormat.GROUP
    lesson_duration_minutes: Optional[int] = None
    max_participants: Optional[int] = None
    max_group_size: Optional[int] = None  # Max riders per group slot
    # Fee structure - Coach sets their rate, Admin adds venue fee
    coach_fee_private: Optional[Decimal] = None  # Coach rate for private lesson
    coach_fee_group: Optional[Decimal] = None  # Coach rate per person for group
    venue_fee_private: Optional[Decimal] = None  # Venue fee for private (calculated from arena price)
    venue_fee_group: Optional[Decimal] = None  # Venue fee per person for group (calculated from arena price)
    venue_fee_waived: bool = False  # Admin can waive venue fees for entire clinic
    livery_venue_fee_private: Optional[Decimal] = 0  # Reduced venue fee for livery users
    livery_venue_fee_group: Optional[Decimal] = 0  # Reduced venue fee for livery users
    special_requirements: Optional[str] = None


class ClinicRequestCreate(ClinicRequestBase):
    """Public form for coaches to submit clinic requests."""
    pass


class ClinicRequestUpdate(BaseModel):
    """For coaches to update pending requests."""
    coach_name: Optional[str] = None
    coach_email: Optional[EmailStr] = None
    coach_phone: Optional[str] = None
    coach_bio: Optional[str] = None
    discipline: Optional[Discipline] = None
    title: Optional[str] = None
    description: Optional[str] = None
    proposed_date: Optional[date] = None
    proposed_end_date: Optional[date] = None
    proposed_start_time: Optional[time] = None
    proposed_end_time: Optional[time] = None
    arena_required: Optional[str] = None
    lesson_format: Optional[LessonFormat] = None
    lesson_duration_minutes: Optional[int] = None
    max_participants: Optional[int] = None
    max_group_size: Optional[int] = None
    # Fee structure
    coach_fee_private: Optional[Decimal] = None
    coach_fee_group: Optional[Decimal] = None
    venue_fee_private: Optional[Decimal] = None
    venue_fee_group: Optional[Decimal] = None
    livery_venue_fee_private: Optional[Decimal] = None
    livery_venue_fee_group: Optional[Decimal] = None
    special_requirements: Optional[str] = None


class ClinicRequestResponse(ClinicRequestBase):
    id: int
    status: ClinicStatus
    proposed_by_id: Optional[int] = None
    reviewed_by_id: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    booking_id: Optional[int] = None
    notice_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    proposed_by_name: Optional[str] = None
    reviewed_by_name: Optional[str] = None
    participant_count: Optional[int] = None

    class Config:
        from_attributes = True


# ============== Slot Schemas ==============

class ClinicSlotBase(BaseModel):
    slot_date: date
    start_time: time
    end_time: time
    group_name: Optional[str] = None
    description: Optional[str] = None
    arena_id: Optional[int] = None
    is_group_slot: bool = False  # True for group lessons (multiple riders)
    max_participants: Optional[int] = None
    venue_fee_waived: bool = False
    sequence: int = 0


class ClinicSlotCreate(ClinicSlotBase):
    pass


class ClinicSlotUpdate(BaseModel):
    slot_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    group_name: Optional[str] = None
    description: Optional[str] = None
    arena_id: Optional[int] = None
    is_group_slot: Optional[bool] = None
    max_participants: Optional[int] = None
    venue_fee_waived: Optional[bool] = None
    sequence: Optional[int] = None


class ClinicSlotResponse(ClinicSlotBase):
    id: int
    clinic_id: int
    created_at: datetime
    updated_at: datetime
    arena_name: Optional[str] = None
    participant_count: int = 0

    class Config:
        from_attributes = True


# ============== Participant Schemas ==============

class ClinicParticipantBase(BaseModel):
    horse_id: Optional[int] = None
    participant_name: Optional[str] = None
    participant_email: Optional[EmailStr] = None
    participant_phone: str  # Required for SMS notifications
    lesson_time: Optional[time] = None
    notes: Optional[str] = None


class ClinicParticipantCreate(BaseModel):
    """Registration for a clinic - phone required for notifications."""
    horse_id: Optional[int] = None
    participant_name: Optional[str] = None
    participant_email: Optional[EmailStr] = None
    participant_phone: str  # Required for SMS notifications
    lesson_time: Optional[time] = None
    preferred_lesson_type: Optional[str] = None  # 'private' or 'group'
    notes: Optional[str] = None  # General notes and grouping preferences


class ClinicParticipantUpdate(BaseModel):
    slot_id: Optional[int] = None
    is_confirmed: Optional[bool] = None
    notes: Optional[str] = None


class ClinicParticipantResponse(BaseModel):
    id: int
    clinic_id: int
    user_id: Optional[int] = None
    slot_id: Optional[int] = None
    horse_id: Optional[int] = None
    participant_name: Optional[str] = None
    participant_email: Optional[str] = None
    participant_phone: Optional[str] = None
    lesson_time: Optional[time] = None
    preferred_lesson_type: Optional[str] = None
    notes: Optional[str] = None
    is_confirmed: bool
    slot_notified_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    user_name: Optional[str] = None
    horse_name: Optional[str] = None
    # Slot info when assigned
    slot_start_time: Optional[time] = None
    slot_end_time: Optional[time] = None
    slot_group_name: Optional[str] = None
    slot_arena_name: Optional[str] = None

    class Config:
        from_attributes = True


# ============== Slot with Participants ==============

class ClinicSlotWithParticipants(ClinicSlotResponse):
    participants: List[ClinicParticipantResponse] = []


# ============== Detail Response ==============

class ClinicRequestDetailResponse(ClinicRequestResponse):
    participants: List[ClinicParticipantResponse] = []
    slots: List[ClinicSlotWithParticipants] = []

    class Config:
        from_attributes = True


# ============== List Schemas ==============

class ClinicRequestsListResponse(BaseModel):
    pending: List[ClinicRequestResponse]
    approved: List[ClinicRequestResponse]
    past: List[ClinicRequestResponse]


class PublicClinicsResponse(BaseModel):
    upcoming: List[ClinicRequestResponse]
    past: List[ClinicRequestResponse]


# ============== Social Media Schemas ==============

class SocialShareLinks(BaseModel):
    facebook: str
    twitter: str
    whatsapp: str
    copy_text: str


# ============== Conflict Check ==============

class ConflictInfo(BaseModel):
    has_conflicts: bool
    conflicting_bookings: List[dict] = []


# ============== Enum Info ==============

class EnumInfo(BaseModel):
    value: str
    label: str


class ClinicEnums(BaseModel):
    disciplines: List[EnumInfo]
    lesson_formats: List[EnumInfo]
    statuses: List[EnumInfo]

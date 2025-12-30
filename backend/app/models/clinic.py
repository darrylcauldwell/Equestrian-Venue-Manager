import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Date, Time, ForeignKey, Numeric
from sqlalchemy.orm import relationship

from app.database import Base, EnumColumn


class Discipline(str, enum.Enum):
    DRESSAGE = "dressage"
    SHOW_JUMPING = "show_jumping"
    CROSS_COUNTRY = "cross_country"
    EVENTING = "eventing"
    FLATWORK = "flatwork"
    POLEWORK = "polework"
    HACKING = "hacking"
    GROUNDWORK = "groundwork"
    LUNGING = "lunging"
    NATURAL_HORSEMANSHIP = "natural_horsemanship"
    OTHER = "other"


class LessonFormat(str, enum.Enum):
    PRIVATE = "private"
    SEMI_PRIVATE = "semi_private"
    GROUP = "group"
    MIXED = "mixed"


class ClinicStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CHANGES_REQUESTED = "changes_requested"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class ClinicRequest(Base):
    """Coach request for a training clinic."""
    __tablename__ = "clinic_requests"

    id = Column(Integer, primary_key=True, index=True)

    # Coach information
    coach_name = Column(String(200), nullable=False)
    coach_email = Column(String(255), nullable=False)
    coach_phone = Column(String(50), nullable=True)
    coach_bio = Column(Text, nullable=True)

    # Clinic details
    discipline = EnumColumn(Discipline, nullable=False)
    title = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)

    # Dates and times
    proposed_date = Column(Date, nullable=False)
    proposed_end_date = Column(Date, nullable=True)  # For multiple days
    proposed_start_time = Column(Time, nullable=True)
    proposed_end_time = Column(Time, nullable=True)

    # Arena requirements
    arena_required = Column(String(100), nullable=True)  # indoor, outdoor, both

    # Lesson details
    lesson_format = EnumColumn(LessonFormat, default=LessonFormat.GROUP)
    lesson_duration_minutes = Column(Integer, nullable=True)
    max_participants = Column(Integer, nullable=True)
    max_group_size = Column(Integer, nullable=True)  # Max riders per group slot

    # Fee structure - Coach sets their rate, Admin adds venue fee
    coach_fee_private = Column(Numeric(10, 2), nullable=True)  # Coach rate for private lesson
    coach_fee_group = Column(Numeric(10, 2), nullable=True)  # Coach rate per person for group
    venue_fee_private = Column(Numeric(10, 2), nullable=True)  # Venue fee for private (calculated from arena price)
    venue_fee_group = Column(Numeric(10, 2), nullable=True)  # Venue fee per person for group (calculated from arena price)
    venue_fee_waived = Column(Boolean, default=False)  # Admin can waive venue fees for entire clinic
    livery_venue_fee_private = Column(Numeric(10, 2), default=0)  # Reduced venue fee for livery users
    livery_venue_fee_group = Column(Numeric(10, 2), default=0)  # Reduced venue fee for livery users

    # Special requirements
    special_requirements = Column(Text, nullable=True)

    # Proposer (if submitted by registered coach)
    proposed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Status and approval
    status = EnumColumn(ClinicStatus, default=ClinicStatus.PENDING)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)

    # If approved, link to created booking/notice
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True)
    notice_id = Column(Integer, ForeignKey("notices.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    proposed_by = relationship("User", foreign_keys=[proposed_by_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])
    booking = relationship("Booking", foreign_keys=[booking_id])
    notice = relationship("Notice", foreign_keys=[notice_id])
    participants = relationship("ClinicParticipant", back_populates="clinic", cascade="all, delete-orphan")
    slots = relationship("ClinicSlot", back_populates="clinic", cascade="all, delete-orphan", order_by="ClinicSlot.slot_date, ClinicSlot.start_time")


class ClinicSlot(Base):
    """Time slots for a clinic - created by admin for scheduling."""
    __tablename__ = "clinic_slots"

    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey("clinic_requests.id", ondelete="CASCADE"), nullable=False)

    # Slot timing
    slot_date = Column(Date, nullable=False)  # For multi-day clinics
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)

    # Group info (e.g., "Group A", "Novice", "Advanced")
    group_name = Column(String(100), nullable=True)
    description = Column(String(255), nullable=True)

    # Arena assignment
    arena_id = Column(Integer, ForeignKey("arenas.id"), nullable=True)

    # Group vs Individual slot
    is_group_slot = Column(Boolean, default=False)  # True for group lessons (multiple riders)
    max_participants = Column(Integer, nullable=True)  # Max riders for this slot

    # Venue fee per slot (can be waived individually per slot)
    venue_fee_waived = Column(Boolean, default=False)  # Admin can waive venue fee for this specific slot

    # Sequence for ordering
    sequence = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    clinic = relationship("ClinicRequest", back_populates="slots")
    arena = relationship("Arena")
    participants = relationship("ClinicParticipant", back_populates="slot")


class ClinicParticipant(Base):
    """Participants registered for a clinic."""
    __tablename__ = "clinic_participants"

    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey("clinic_requests.id", ondelete="CASCADE"), nullable=False)

    # Assigned slot (set by admin)
    slot_id = Column(Integer, ForeignKey("clinic_slots.id", ondelete="SET NULL"), nullable=True)

    # Participant info (can be user or external)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    horse_id = Column(Integer, ForeignKey("horses.id"), nullable=True)

    # For external participants
    participant_name = Column(String(200), nullable=True)
    participant_email = Column(String(255), nullable=True)
    participant_phone = Column(String(50), nullable=True)

    # Booking details
    lesson_time = Column(Time, nullable=True)  # Preferred time
    preferred_lesson_type = Column(String(20), nullable=True)  # 'private' or 'group'
    notes = Column(Text, nullable=True)  # General notes and grouping preferences
    is_confirmed = Column(Boolean, default=False)

    # Notification tracking
    slot_notified_at = Column(DateTime, nullable=True)  # When in-app slot notification was sent
    sms_notified_at = Column(DateTime, nullable=True)  # When SMS was sent

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    clinic = relationship("ClinicRequest", back_populates="participants")
    slot = relationship("ClinicSlot", back_populates="participants")
    user = relationship("User")
    horse = relationship("Horse")

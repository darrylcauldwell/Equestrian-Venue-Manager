"""
Ad-hoc lesson booking models for coach profiles and lesson requests.
"""
import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, ForeignKey, Date, Time,
    DateTime, Numeric, JSON
)
from sqlalchemy.orm import relationship
from app.database import Base, EnumColumn
from app.models.clinic import Discipline
from app.models.booking import PaymentStatus


class AvailabilityMode(str, enum.Enum):
    """How a coach indicates their availability."""
    RECURRING = "recurring"      # Weekly schedule (e.g., Tuesdays 10am-4pm)
    SPECIFIC = "specific"        # Specific date/time slots added manually
    ALWAYS = "always"            # Accept any request


class BookingMode(str, enum.Enum):
    """How lessons are booked with this coach."""
    AUTO_ACCEPT = "auto_accept"      # Users book directly into available slots
    REQUEST_FIRST = "request_first"  # Users request, coach reviews and accepts/declines


class LessonRequestStatus(str, enum.Enum):
    """Status of a lesson request."""
    PENDING = "pending"          # Awaiting coach response
    ACCEPTED = "accepted"        # Coach accepted, awaiting payment
    DECLINED = "declined"        # Coach declined
    CONFIRMED = "confirmed"      # Payment complete
    CANCELLED = "cancelled"      # Cancelled by user or coach
    COMPLETED = "completed"      # Lesson delivered


class CoachProfile(Base):
    """
    Profile for coaches offering ad-hoc lessons.
    Linked to User with role=COACH.
    """
    __tablename__ = "coach_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    # What they teach
    disciplines = Column(JSON, nullable=True)  # List of Discipline enum values
    teaching_description = Column(Text, nullable=True)
    bio = Column(Text, nullable=True)

    # Where they teach (single arena)
    arena_id = Column(Integer, ForeignKey("arenas.id"), nullable=True)  # Arena where coach offers lessons

    # Availability & booking settings
    availability_mode = EnumColumn(AvailabilityMode, default=AvailabilityMode.ALWAYS)
    booking_mode = EnumColumn(BookingMode, default=BookingMode.REQUEST_FIRST)
    lesson_duration_minutes = Column(Integer, default=45)

    # Pricing (coach sets their fee, admin sets venue fees)
    coach_fee = Column(Numeric(10, 2), nullable=False)
    venue_fee = Column(Numeric(10, 2), nullable=True)  # Standard venue fee (admin sets)
    livery_venue_fee = Column(Numeric(10, 2), default=0)  # Reduced venue fee for livery users

    # Status (requires admin approval)
    is_active = Column(Boolean, default=False)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="coach_profile")
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    arena = relationship("Arena", foreign_keys=[arena_id])
    recurring_schedules = relationship(
        "CoachRecurringSchedule",
        back_populates="coach_profile",
        cascade="all, delete-orphan"
    )
    availability_slots = relationship(
        "CoachAvailabilitySlot",
        back_populates="coach_profile",
        cascade="all, delete-orphan"
    )
    lesson_requests = relationship("LessonRequest", back_populates="coach_profile")


class CoachRecurringSchedule(Base):
    """
    Weekly recurring availability for coaches.
    E.g., "Available every Tuesday 10am-4pm"
    """
    __tablename__ = "coach_recurring_schedules"

    id = Column(Integer, primary_key=True, index=True)
    coach_profile_id = Column(
        Integer,
        ForeignKey("coach_profiles.id", ondelete="CASCADE"),
        nullable=False
    )

    day_of_week = Column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)

    is_active = Column(Boolean, default=True)

    # Relationships
    coach_profile = relationship("CoachProfile", back_populates="recurring_schedules")


class CoachAvailabilitySlot(Base):
    """
    Specific date/time slots that coach manually adds.
    Used when availability_mode = SPECIFIC.
    """
    __tablename__ = "coach_availability_slots"

    id = Column(Integer, primary_key=True, index=True)
    coach_profile_id = Column(
        Integer,
        ForeignKey("coach_profiles.id", ondelete="CASCADE"),
        nullable=False
    )

    slot_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)

    is_booked = Column(Boolean, default=False)  # Mark as taken when lesson confirmed

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    coach_profile = relationship("CoachProfile", back_populates="availability_slots")


class LessonRequest(Base):
    """
    Ad-hoc lesson booking request from user to coach.
    """
    __tablename__ = "lesson_requests"

    id = Column(Integer, primary_key=True, index=True)

    # Coach and user
    coach_profile_id = Column(Integer, ForeignKey("coach_profiles.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Nullable for guest bookings
    horse_id = Column(Integer, ForeignKey("horses.id"), nullable=True)

    # Guest booking fields (for unauthenticated users)
    guest_name = Column(String(100), nullable=True)
    guest_email = Column(String(255), nullable=True)
    guest_phone = Column(String(20), nullable=True)

    # Requested timing
    requested_date = Column(Date, nullable=False)
    requested_time = Column(Time, nullable=True)  # Preferred time
    alternative_dates = Column(Text, nullable=True)  # User can suggest alternatives

    # Lesson details
    discipline = EnumColumn(Discipline, nullable=True)
    notes = Column(Text, nullable=True)  # User's goals/requirements

    # Pricing (captured at request time based on user role)
    coach_fee = Column(Numeric(10, 2), nullable=False)
    venue_fee = Column(Numeric(10, 2), nullable=False)
    venue_fee_waived = Column(Boolean, default=False)  # Admin can waive venue fee
    total_price = Column(Numeric(10, 2), nullable=False)

    # Confirmed slot details (set when coach accepts or auto-accept)
    confirmed_date = Column(Date, nullable=True)
    confirmed_start_time = Column(Time, nullable=True)
    confirmed_end_time = Column(Time, nullable=True)
    arena_id = Column(Integer, ForeignKey("arenas.id"), nullable=True)

    # Link to arena booking (created when lesson is confirmed with arena)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True)

    # Status
    status = EnumColumn(LessonRequestStatus, default=LessonRequestStatus.PENDING)
    coach_response = Column(Text, nullable=True)  # Coach's message when accepting
    declined_reason = Column(Text, nullable=True)

    # Payment
    payment_status = EnumColumn(PaymentStatus, default=PaymentStatus.PENDING)
    payment_ref = Column(String(100), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    responded_at = Column(DateTime, nullable=True)

    # Relationships
    coach_profile = relationship("CoachProfile", back_populates="lesson_requests")
    user = relationship("User", foreign_keys=[user_id])
    horse = relationship("Horse")
    arena = relationship("Arena")
    booking = relationship("Booking")

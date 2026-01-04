import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Date, Time, ForeignKey, Enum, Numeric
from sqlalchemy.orm import relationship

from app.database import Base, EnumColumn


class ShiftType(str, enum.Enum):
    MORNING = "morning"
    AFTERNOON = "afternoon"
    FULL_DAY = "full_day"


class ShiftRole(str, enum.Enum):
    YARD_DUTIES = "yard_duties"
    OFFICE = "office"
    EVENTS = "events"
    TEACHING = "teaching"
    MAINTENANCE = "maintenance"
    OTHER = "other"


class TimesheetStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"


class WorkType(str, enum.Enum):
    YARD_DUTIES = "yard_duties"
    YARD_MAINTENANCE = "yard_maintenance"
    OFFICE = "office"
    EVENTS = "events"
    OTHER = "other"


class LeaveType(str, enum.Enum):
    ANNUAL = "annual"
    UNPAID = "unpaid"
    TOIL = "toil"  # Time off in lieu
    EXTENDED = "extended"  # Extended leave (university, travel, sabbatical)


class LeaveStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class DayStatusType(str, enum.Enum):
    UNAVAILABLE = "unavailable"  # Not working/not scheduled
    ABSENT = "absent"  # Off for the day (sick, gift day, etc.)


class Shift(Base):
    """Scheduled work shifts for staff members."""
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    shift_type = EnumColumn(ShiftType, default=ShiftType.FULL_DAY,
        nullable=False
    )
    role = EnumColumn(ShiftRole, default=ShiftRole.YARD_DUTIES
    )
    notes = Column(Text, nullable=True)

    # Who created this shift
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    staff = relationship("User", foreign_keys=[staff_id])
    created_by = relationship("User", foreign_keys=[created_by_id])


class StaffDayStatus(Base):
    """Day status for staff (unavailable/absent) set by admin."""
    __tablename__ = "staff_day_statuses"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    status_type = EnumColumn(DayStatusType, nullable=False)
    notes = Column(Text, nullable=True)  # Optional reason/note

    # Who set this status
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    staff = relationship("User", foreign_keys=[staff_id])
    created_by = relationship("User", foreign_keys=[created_by_id])


class Timesheet(Base):
    """Actual hours worked by staff members."""
    __tablename__ = "timesheets"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    clock_in = Column(Time, nullable=False)
    clock_out = Column(Time, nullable=True)
    lunch_start = Column(Time, nullable=True)
    lunch_end = Column(Time, nullable=True)
    break_minutes = Column(Integer, default=0)
    work_type = EnumColumn(WorkType, default=WorkType.YARD_DUTIES
    )
    notes = Column(Text, nullable=True)

    # Who logged this entry (null = staff logged themselves, populated = admin logged for them)
    logged_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Status tracking
    status = EnumColumn(TimesheetStatus, default=TimesheetStatus.DRAFT
    )
    submitted_at = Column(DateTime, nullable=True)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    staff = relationship("User", foreign_keys=[staff_id])
    logged_by = relationship("User", foreign_keys=[logged_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])


class HolidayRequest(Base):
    """Holiday/leave requests from staff."""
    __tablename__ = "holiday_requests"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    leave_type = EnumColumn(LeaveType, default=LeaveType.ANNUAL
    )
    days_requested = Column(Numeric(4, 1), nullable=False)  # Allow half days
    reason = Column(Text, nullable=True)

    # Status tracking
    status = EnumColumn(LeaveStatus, default=LeaveStatus.PENDING
    )
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approval_date = Column(DateTime, nullable=True)
    approval_notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    staff = relationship("User", foreign_keys=[staff_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])


class UnplannedAbsence(Base):
    """Unplanned absence records for staff (sickness, no-show, emergency, etc.)."""
    __tablename__ = "unplanned_absences"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    reported_time = Column(Time, nullable=True)
    reported_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reason = Column(String(100), nullable=True)  # e.g., "sickness", "emergency", "no contact"
    expected_return = Column(Date, nullable=True)
    actual_return = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)

    # Documentation (for longer absences)
    has_fit_note = Column(Boolean, default=False)
    fit_note_start = Column(Date, nullable=True)
    fit_note_end = Column(Date, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    staff = relationship("User", foreign_keys=[staff_id])
    reported_to = relationship("User", foreign_keys=[reported_to_id])


class PayrollAdjustmentType(str, enum.Enum):
    ONEOFF = "oneoff"  # One-off payment (bonus, extra work, etc.)
    TIP = "tip"  # Tips from livery owners


class PayrollAdjustment(Base):
    """One-off payments and tips for staff payroll."""
    __tablename__ = "payroll_adjustments"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    adjustment_type = EnumColumn(PayrollAdjustmentType, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    description = Column(String(255), nullable=False)
    payment_date = Column(Date, nullable=False)  # When this should be paid
    taxable = Column(Boolean, default=True)  # Tips are tax-free (False), bonuses taxable (True)
    notes = Column(Text, nullable=True)

    # Who created this adjustment (null for tips from livery owners)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Link to thanks message if this was created from a tip
    thanks_id = Column(Integer, ForeignKey("staff_thanks.id"), nullable=True)

    # Relationships
    staff = relationship("User", foreign_keys=[staff_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    thanks = relationship("StaffThanks", back_populates="payroll_adjustment")


class StaffThanks(Base):
    """Thank you messages from livery owners to staff, optionally with tips."""
    __tablename__ = "staff_thanks"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Recipient
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Livery owner
    message = Column(Text, nullable=False)  # Thank you message

    # Optional tip
    tip_amount = Column(Numeric(10, 2), nullable=True)
    tip_payment_intent_id = Column(String(255), nullable=True)  # Stripe PaymentIntent ID
    tip_paid = Column(Boolean, default=False)  # Whether tip payment completed

    # Notification tracking
    read_at = Column(DateTime, nullable=True)  # When staff read the notification

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    staff = relationship("User", foreign_keys=[staff_id])
    sender = relationship("User", foreign_keys=[sender_id])
    payroll_adjustment = relationship("PayrollAdjustment", back_populates="thanks", uselist=False)

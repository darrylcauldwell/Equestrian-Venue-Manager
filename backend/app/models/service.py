import enum
from datetime import datetime
from decimal import Decimal
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Numeric, Date
from sqlalchemy.orm import relationship
from app.database import Base, EnumColumn


class ServiceCategory(str, enum.Enum):
    EXERCISE = "exercise"
    SCHOOLING = "schooling"
    GROOMING = "grooming"
    THIRD_PARTY = "third_party"
    REHAB = "rehab"


class RecurringPattern(str, enum.Enum):
    NONE = "none"
    DAILY = "daily"
    WEEKDAYS = "weekdays"  # Mon-Fri
    CUSTOM = "custom"  # Specific days


class RequestStatus(str, enum.Enum):
    PENDING = "pending"
    QUOTED = "quoted"  # Admin has provided a cost estimate
    APPROVED = "approved"  # Livery has accepted the quote
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ChargeStatus(str, enum.Enum):
    PENDING = "pending"
    CHARGED = "charged"
    WAIVED = "waived"


class PreferredTime(str, enum.Enum):
    MORNING = "morning"
    AFTERNOON = "afternoon"
    EVENING = "evening"
    ANY = "any"


class Service(Base):
    """Catalog of available services."""
    __tablename__ = "services"

    id = Column(String(50), primary_key=True)
    category = EnumColumn(ServiceCategory, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    price_gbp = Column(Numeric(10, 2), nullable=False)
    requires_approval = Column(Boolean, default=False, nullable=False)
    approval_reason = Column(Text, nullable=True)
    advance_notice_hours = Column(Integer, default=24, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_insurance_claimable = Column(Boolean, default=False, nullable=False)  # Default for service requests
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    requests = relationship("ServiceRequest", back_populates="service")


class ServiceRequest(Base):
    """Service requests from livery clients."""
    __tablename__ = "service_requests"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(String(50), ForeignKey("services.id"), nullable=False)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False)
    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    requested_date = Column(Date, nullable=False)
    preferred_time = EnumColumn(PreferredTime, default=PreferredTime.ANY, nullable=False)
    status = EnumColumn(RequestStatus, default=RequestStatus.PENDING, nullable=False)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    scheduled_datetime = Column(DateTime, nullable=True)
    completed_datetime = Column(DateTime, nullable=True)
    completed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
    special_instructions = Column(Text, nullable=True)

    # Quote fields (for cost estimation workflow)
    quote_amount = Column(Numeric(10, 2), nullable=True)  # Estimated cost from admin
    quote_notes = Column(Text, nullable=True)  # Admin notes on the quote
    quoted_at = Column(DateTime, nullable=True)  # When the quote was provided
    quoted_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    charge_amount = Column(Numeric(10, 2), nullable=True)
    charge_status = EnumColumn(ChargeStatus, default=ChargeStatus.PENDING, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Insurance claim tracking
    insurance_claimable = Column(Boolean, default=False, nullable=False)  # Flag for insurance reimbursement

    # Rehab-specific fields (nullable for non-rehab requests)
    rehab_program_id = Column(Integer, ForeignKey("rehab_programs.id", ondelete="SET NULL"), nullable=True)
    rehab_task_id = Column(Integer, ForeignKey("rehab_tasks.id", ondelete="SET NULL"), nullable=True)

    # Recurring request fields
    recurring_pattern = EnumColumn(RecurringPattern, default=RecurringPattern.NONE, nullable=False)
    recurring_days = Column(Text, nullable=True)  # JSON array for custom days e.g. ["monday","wednesday"]
    recurring_end_date = Column(Date, nullable=True)
    recurring_series_id = Column(Integer, nullable=True)  # Groups recurring requests together

    # Relationships
    service = relationship("Service", back_populates="requests")
    horse = relationship("Horse", back_populates="service_requests")
    requested_by = relationship("User", foreign_keys=[requested_by_id], backref="service_requests")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id], backref="assigned_requests")
    completed_by = relationship("User", foreign_keys=[completed_by_id], backref="completed_requests")
    quoted_by = relationship("User", foreign_keys=[quoted_by_id], backref="quoted_requests")
    yard_task = relationship("YardTask", back_populates="service_request", uselist=False)
    rehab_program = relationship("RehabProgram", backref="service_requests")
    rehab_task = relationship("RehabTask", backref="service_requests")

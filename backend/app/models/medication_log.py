import enum
from datetime import datetime, date, time
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Date, Time, Enum, Text, Numeric, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base, EnumColumn
from app.models.feed import FeedTime


class MedicationAdminLog(Base):
    """Daily log of medication administration - tracks actual giving of medications."""
    __tablename__ = "medication_admin_logs"

    id = Column(Integer, primary_key=True, index=True)
    feed_addition_id = Column(Integer, ForeignKey("feed_additions.id", ondelete="CASCADE"), nullable=False)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False)

    admin_date = Column(Date, nullable=False)
    feed_time = EnumColumn(FeedTime, nullable=False
    )  # morning/evening

    # Status
    was_given = Column(Boolean, nullable=False)  # True = given, False = skipped/refused
    skip_reason = Column(Text, nullable=True)  # If not given, why?

    # Sign-off
    given_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    given_at = Column(DateTime, default=datetime.utcnow)

    notes = Column(Text, nullable=True)

    # Relationships
    feed_addition = relationship("FeedAddition")
    horse = relationship("Horse")
    given_by = relationship("User")

    # Unique constraint - one log per medication per feed time per day
    __table_args__ = (
        UniqueConstraint('feed_addition_id', 'admin_date', 'feed_time', name='unique_med_admin'),
    )


class HealingStatus(str, enum.Enum):
    IMPROVING = "improving"
    STABLE = "stable"
    WORSENING = "worsening"
    INFECTED = "infected"
    HEALED = "healed"


class WoundCareLog(Base):
    """Wound care and treatment tracking."""
    __tablename__ = "wound_care_logs"

    id = Column(Integer, primary_key=True, index=True)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False)

    # Wound identification
    wound_name = Column(String(100), nullable=False)  # e.g., "Left hind leg cut"
    wound_location = Column(String(100), nullable=True)
    wound_description = Column(Text, nullable=True)

    # Treatment entry date
    treatment_date = Column(Date, nullable=False)
    treatment_time = Column(Time, nullable=True)

    # Treatment details
    treatment_given = Column(Text, nullable=False)  # What was done
    products_used = Column(Text, nullable=True)  # Products/medications applied

    # Assessment
    healing_assessment = EnumColumn(HealingStatus, nullable=True
    )
    assessment_notes = Column(Text, nullable=True)

    # Next treatment
    next_treatment_due = Column(Date, nullable=True)

    # Sign-off
    treated_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Is this wound case now resolved?
    is_resolved = Column(Boolean, default=False)
    resolved_date = Column(Date, nullable=True)

    # Relationships
    horse = relationship("Horse")
    treated_by = relationship("User")


class AppetiteStatus(str, enum.Enum):
    NORMAL = "normal"
    REDUCED = "reduced"
    NOT_EATING = "not_eating"
    INCREASED = "increased"


class DemeanorStatus(str, enum.Enum):
    BRIGHT = "bright"
    QUIET = "quiet"
    LETHARGIC = "lethargic"
    AGITATED = "agitated"


class HealthObservation(Base):
    """Daily health observations (temperature, general condition)."""
    __tablename__ = "health_observations"

    id = Column(Integer, primary_key=True, index=True)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False)

    observation_date = Column(Date, nullable=False)
    observation_time = Column(Time, nullable=True)

    # Temperature (optional - Celsius)
    temperature = Column(Numeric(4, 1), nullable=True)  # e.g., 37.5

    # General observations
    appetite = EnumColumn(AppetiteStatus, nullable=True
    )
    demeanor = EnumColumn(DemeanorStatus, nullable=True
    )
    droppings_normal = Column(Boolean, nullable=True)

    # Concerns
    concerns = Column(Text, nullable=True)
    action_taken = Column(Text, nullable=True)
    vet_notified = Column(Boolean, default=False)

    # Sign-off
    observed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    horse = relationship("Horse")
    observed_by = relationship("User")


# ============== Rehab Program Models ==============

class RehabStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class RehabProgram(Base):
    """A rehabilitation/recovery program for a horse with multiple phases."""
    __tablename__ = "rehab_programs"

    id = Column(Integer, primary_key=True, index=True)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(200), nullable=False)  # e.g., "Post-surgery recovery"
    description = Column(Text, nullable=True)
    reason = Column(Text, nullable=True)  # Injury/condition being rehabbed

    # Vet/professional who prescribed
    prescribed_by = Column(String(150), nullable=True)
    prescription_date = Column(Date, nullable=True)

    # Program dates
    start_date = Column(Date, nullable=False)
    expected_end_date = Column(Date, nullable=True)
    actual_end_date = Column(Date, nullable=True)

    # Status
    status = EnumColumn(RehabStatus, default=RehabStatus.DRAFT
    )
    current_phase = Column(Integer, default=1)

    # Notes
    notes = Column(Text, nullable=True)

    # Staff management - when True, all tasks handled by staff (no assistance requests needed)
    staff_managed = Column(Boolean, default=False, nullable=False)

    # Weekly care price - charged when staff_managed is True (for rehab livery billing)
    weekly_care_price = Column(Numeric(10, 2), nullable=True)

    # Tracking
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    horse = relationship("Horse")
    created_by = relationship("User")
    phases = relationship("RehabPhase", back_populates="program", cascade="all, delete-orphan", order_by="RehabPhase.phase_number")


class RehabPhase(Base):
    """A phase within a rehab program with specific duration and tasks."""
    __tablename__ = "rehab_phases"

    id = Column(Integer, primary_key=True, index=True)
    program_id = Column(Integer, ForeignKey("rehab_programs.id", ondelete="CASCADE"), nullable=False)

    phase_number = Column(Integer, nullable=False)
    name = Column(String(100), nullable=False)  # e.g., "Week 1-2: Walk only"
    description = Column(Text, nullable=True)

    # Duration
    duration_days = Column(Integer, nullable=False)  # e.g., 7 for one week
    start_day = Column(Integer, nullable=False)  # Day in program this phase starts (1-indexed)

    # Phase status
    is_completed = Column(Boolean, default=False)
    completed_date = Column(Date, nullable=True)
    completion_notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    program = relationship("RehabProgram", back_populates="phases")
    tasks = relationship("RehabTask", back_populates="phase", cascade="all, delete-orphan")


class TaskFrequency(str, enum.Enum):
    DAILY = "daily"
    TWICE_DAILY = "twice_daily"  # morning and evening
    EVERY_OTHER_DAY = "every_other_day"
    WEEKLY = "weekly"
    AS_NEEDED = "as_needed"


class RehabTask(Base):
    """A specific task within a rehab phase."""
    __tablename__ = "rehab_tasks"

    id = Column(Integer, primary_key=True, index=True)
    phase_id = Column(Integer, ForeignKey("rehab_phases.id", ondelete="CASCADE"), nullable=False)

    task_type = Column(String(50), nullable=False)  # walk, trot, raised_poles, ice, poultice, etc.
    description = Column(String(500), nullable=False)  # e.g., "Walk in hand for 5 minutes"
    duration_minutes = Column(Integer, nullable=True)  # If time-based
    frequency = EnumColumn(TaskFrequency, default=TaskFrequency.DAILY
    )

    # Special instructions
    instructions = Column(Text, nullable=True)
    equipment_needed = Column(String(200), nullable=True)  # e.g., "boots, lunge line"

    # Feed-based medication fields
    is_feed_based = Column(Boolean, default=False, nullable=False)  # If True, shows in feed schedule instead of yard tasks
    feed_time = Column(String(20), nullable=True)  # morning, evening, both - only used when is_feed_based=True

    # Order for display
    sequence = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    phase = relationship("RehabPhase", back_populates="tasks")


class RehabTaskLog(Base):
    """Log of completed rehab tasks."""
    __tablename__ = "rehab_task_logs"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("rehab_tasks.id", ondelete="CASCADE"), nullable=False)
    program_id = Column(Integer, ForeignKey("rehab_programs.id", ondelete="CASCADE"), nullable=False)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False)

    log_date = Column(Date, nullable=False)
    feed_time = EnumColumn(FeedTime, nullable=True
    )  # morning/evening if twice daily

    # Status
    was_completed = Column(Boolean, nullable=False)
    skip_reason = Column(Text, nullable=True)

    # Actual values (may differ from prescribed)
    actual_duration_minutes = Column(Integer, nullable=True)

    # Observations
    horse_response = Column(Text, nullable=True)  # How did horse cope?
    concerns = Column(Text, nullable=True)
    vet_notified = Column(Boolean, default=False)

    # Clinical observations (for vet communication)
    lameness_score = Column(Integer, nullable=True)  # AAEP scale: 0=sound, 5=non-weight bearing
    physical_observations = Column(Text, nullable=True)  # Swelling, heat, filling, etc.

    # Sign-off
    completed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    completed_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    task = relationship("RehabTask")
    program = relationship("RehabProgram")
    horse = relationship("Horse")
    completed_by = relationship("User")

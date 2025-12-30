import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Date, ForeignKey, Numeric
from sqlalchemy.orm import relationship

from app.database import Base, EnumColumn


class TaskCategory(str, enum.Enum):
    MAINTENANCE = "maintenance"
    REPAIRS = "repairs"
    CLEANING = "cleaning"
    FEEDING = "feeding"
    TURNOUT = "turnout"
    HEALTH = "health"
    ADMIN = "admin"
    SAFETY = "safety"
    LIVERY_SERVICE = "livery_service"
    OTHER = "other"


class TaskPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TaskStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class RecurrenceType(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    CUSTOM = "custom"


class AssignmentType(str, enum.Enum):
    SPECIFIC = "specific"  # Assigned to a specific person
    POOL = "pool"  # Available for any staff working that day to pick up
    BACKLOG = "backlog"  # Not time-sensitive, can be done when time permits


class HealthTaskType(str, enum.Enum):
    """Discriminator for health-related task sub-types."""
    MEDICATION = "medication"  # From FeedAddition (medication administration)
    WOUND_CARE = "wound_care"  # From WoundCareLog (wound treatment)
    HEALTH_CHECK = "health_check"  # Daily health observation per horse
    REHAB_EXERCISE = "rehab_exercise"  # From RehabTask (return-to-work exercises)


class YardTask(Base):
    """Represents a task or job that needs to be done at the yard."""
    __tablename__ = "yard_tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    category = EnumColumn(TaskCategory, nullable=False)
    priority = EnumColumn(TaskPriority, default=TaskPriority.MEDIUM)
    location = Column(String(200), nullable=True)

    # Who reported it
    reported_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reported_date = Column(DateTime, default=datetime.utcnow)

    # Assignment
    assignment_type = EnumColumn(AssignmentType, default=AssignmentType.BACKLOG)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    scheduled_date = Column(Date, nullable=True)  # For specific/pool tasks - which day

    # Status
    status = EnumColumn(TaskStatus, default=TaskStatus.OPEN)
    completed_date = Column(DateTime, nullable=True)
    completed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    completion_notes = Column(Text, nullable=True)

    # Budget - estimated cost to complete (for tasks requiring purchases)
    estimated_cost = Column(Numeric(10, 2), nullable=True)

    # Maintenance day grouping
    is_maintenance_day_task = Column(Boolean, default=False)  # Group with other maintenance day tasks

    # For recurring tasks
    is_recurring = Column(Boolean, default=False)
    recurrence_type = EnumColumn(RecurrenceType, nullable=True)
    recurrence_days = Column(String(50), nullable=True)  # e.g., "mon,wed,fri" or "1,15" for monthly
    parent_task_id = Column(Integer, ForeignKey("yard_tasks.id"), nullable=True)

    # Link to livery service request (auto-created when scheduling a service)
    service_request_id = Column(Integer, ForeignKey("service_requests.id"), nullable=True, unique=True)

    # Health task fields - for integrating medication, wound care, health checks, and rehab exercises
    health_task_type = EnumColumn(HealthTaskType, nullable=True)  # Only set for health-related tasks
    horse_id = Column(Integer, ForeignKey("horses.id"), nullable=True)  # The horse this task relates to
    feed_addition_id = Column(Integer, ForeignKey("feed_additions.id"), nullable=True)  # For medication tasks
    wound_care_log_id = Column(Integer, ForeignKey("wound_care_logs.id"), nullable=True)  # For wound tasks
    rehab_task_id = Column(Integer, ForeignKey("rehab_tasks.id"), nullable=True)  # For rehab exercise tasks
    rehab_program_id = Column(Integer, ForeignKey("rehab_programs.id"), nullable=True)  # Parent rehab program
    feed_time = Column(String(20), nullable=True)  # 'morning' or 'evening' for medication/rehab tasks
    health_record_id = Column(Integer, nullable=True)  # ID of created health record on completion
    health_record_type = Column(String(50), nullable=True)  # 'medication_log', 'wound_log', 'observation', 'rehab_log'

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    reported_by = relationship("User", foreign_keys=[reported_by_id])
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    completed_by = relationship("User", foreign_keys=[completed_by_id])
    parent_task = relationship("YardTask", remote_side=[id], foreign_keys=[parent_task_id])
    comments = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan")
    service_request = relationship("ServiceRequest", back_populates="yard_task")
    # Health task relationships
    horse = relationship("Horse", foreign_keys=[horse_id])
    feed_addition = relationship("FeedAddition", foreign_keys=[feed_addition_id])
    wound_care_log = relationship("WoundCareLog", foreign_keys=[wound_care_log_id])
    rehab_task = relationship("RehabTask", foreign_keys=[rehab_task_id])
    rehab_program = relationship("RehabProgram", foreign_keys=[rehab_program_id])


class TaskComment(Base):
    """Comments/updates on a task."""
    __tablename__ = "task_comments"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("yard_tasks.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    task = relationship("YardTask", back_populates="comments")
    user = relationship("User")

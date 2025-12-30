from datetime import datetime, date, time
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel

from app.models.task import TaskCategory, TaskPriority, TaskStatus, RecurrenceType, AssignmentType, HealthTaskType
from app.schemas.medication_log import HealingStatus, AppetiteStatus, DemeanorStatus


# ============== Comment Schemas ==============

class TaskCommentBase(BaseModel):
    content: str


class TaskCommentCreate(TaskCommentBase):
    pass


class TaskCommentResponse(TaskCommentBase):
    id: int
    task_id: int
    user_id: int
    created_at: datetime
    user_name: Optional[str] = None

    class Config:
        from_attributes = True


# ============== Task Schemas ==============

class YardTaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    category: TaskCategory
    priority: TaskPriority = TaskPriority.MEDIUM
    location: Optional[str] = None
    scheduled_date: Optional[date] = None


class YardTaskCreate(YardTaskBase):
    assignment_type: AssignmentType = AssignmentType.BACKLOG
    assigned_to_id: Optional[int] = None
    estimated_cost: Optional[Decimal] = None
    is_maintenance_day_task: bool = False
    is_recurring: bool = False
    recurrence_type: Optional[RecurrenceType] = None
    recurrence_days: Optional[str] = None


class YardTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[TaskCategory] = None
    priority: Optional[TaskPriority] = None
    location: Optional[str] = None
    assignment_type: Optional[AssignmentType] = None
    assigned_to_id: Optional[int] = None
    scheduled_date: Optional[date] = None
    estimated_cost: Optional[Decimal] = None
    is_maintenance_day_task: Optional[bool] = None
    status: Optional[TaskStatus] = None
    completion_notes: Optional[str] = None


class YardTaskResponse(YardTaskBase):
    id: int
    reported_by_id: int
    reported_date: datetime
    assignment_type: AssignmentType
    assigned_to_id: Optional[int] = None
    status: TaskStatus
    completed_date: Optional[datetime] = None
    completed_by_id: Optional[int] = None
    completion_notes: Optional[str] = None
    estimated_cost: Optional[Decimal] = None
    is_maintenance_day_task: bool = False
    is_recurring: bool
    recurrence_type: Optional[RecurrenceType] = None
    recurrence_days: Optional[str] = None
    parent_task_id: Optional[int] = None
    service_request_id: Optional[int] = None  # Link to livery service request
    service_billable_amount: Optional[Decimal] = None  # Billable amount from linked service
    created_at: datetime
    updated_at: datetime
    reported_by_name: Optional[str] = None
    assigned_to_name: Optional[str] = None
    completed_by_name: Optional[str] = None
    comment_count: Optional[int] = None
    # Health task fields
    health_task_type: Optional[HealthTaskType] = None
    horse_id: Optional[int] = None
    horse_name: Optional[str] = None
    feed_addition_id: Optional[int] = None
    wound_care_log_id: Optional[int] = None
    rehab_task_id: Optional[int] = None
    rehab_program_id: Optional[int] = None
    feed_time: Optional[str] = None
    health_record_id: Optional[int] = None
    health_record_type: Optional[str] = None
    # Additional health info for display
    medication_name: Optional[str] = None
    medication_dosage: Optional[str] = None
    wound_name: Optional[str] = None
    wound_location: Optional[str] = None
    rehab_program_name: Optional[str] = None
    rehab_task_description: Optional[str] = None

    class Config:
        from_attributes = True


class YardTaskDetailResponse(YardTaskResponse):
    comments: List[TaskCommentResponse] = []

    class Config:
        from_attributes = True


# ============== List Schemas ==============

class TasksListResponse(BaseModel):
    open_tasks: List[YardTaskResponse]
    my_tasks: List[YardTaskResponse]
    today_tasks: List[YardTaskResponse]
    pool_tasks: List[YardTaskResponse]  # Tasks available for anyone working today
    backlog_tasks: List[YardTaskResponse]  # Tasks not assigned to a specific day
    completed_tasks: List[YardTaskResponse]
    scheduled_tasks: List[YardTaskResponse]  # Tasks scheduled for future dates


class TasksSummary(BaseModel):
    total_open: int
    urgent_count: int
    high_priority_count: int
    overdue_count: int
    my_assigned_count: int
    today_count: int


class TaskEnumInfo(BaseModel):
    value: str
    label: str


class TaskEnums(BaseModel):
    categories: List[TaskEnumInfo]
    priorities: List[TaskEnumInfo]
    statuses: List[TaskEnumInfo]
    recurrence_types: List[TaskEnumInfo]
    assignment_types: List[TaskEnumInfo]


# ============== Bulk Operations ==============

class MaintenanceDayAssign(BaseModel):
    """Assign multiple backlog tasks to a person for a maintenance day."""
    task_ids: List[int]
    assigned_to_id: int
    scheduled_date: date


# ============== Health Task Completion Schemas ==============

class MedicationTaskCompletion(BaseModel):
    """Completion data for medication administration tasks."""
    was_given: bool
    skip_reason: Optional[str] = None
    notes: Optional[str] = None


class WoundCareTaskCompletion(BaseModel):
    """Completion data for wound care tasks."""
    treatment_given: str
    products_used: Optional[str] = None
    healing_assessment: HealingStatus
    assessment_notes: Optional[str] = None
    next_treatment_due: Optional[date] = None
    is_healed: bool = False


class HealthObservationTaskCompletion(BaseModel):
    """Completion data for daily health check tasks."""
    observation_time: Optional[time] = None
    temperature: Optional[float] = None
    appetite: AppetiteStatus
    demeanor: DemeanorStatus
    droppings_normal: bool
    concerns: Optional[str] = None
    action_taken: Optional[str] = None
    vet_notified: bool = False


class RehabExerciseTaskCompletion(BaseModel):
    """Completion data for rehab exercise tasks."""
    was_completed: bool
    skip_reason: Optional[str] = None
    actual_duration_minutes: Optional[int] = None
    horse_response: Optional[str] = None
    concerns: Optional[str] = None
    vet_notified: bool = False
    lameness_score: Optional[int] = None  # AAEP scale: 0=sound, 5=non-weight bearing
    physical_observations: Optional[str] = None  # Swelling, heat, filling, etc.


class HealthTaskCompletion(BaseModel):
    """Union type for completing any health task."""
    medication: Optional[MedicationTaskCompletion] = None
    wound_care: Optional[WoundCareTaskCompletion] = None
    health_observation: Optional[HealthObservationTaskCompletion] = None
    rehab_exercise: Optional[RehabExerciseTaskCompletion] = None


# ============== Health Task Generation ==============

class HealthTaskGenerationResult(BaseModel):
    """Result of health task generation."""
    date: date
    medication: int
    wound_care: int
    health_check: int
    rehab_exercise: int
    total: int

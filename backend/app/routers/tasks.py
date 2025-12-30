from typing import List, Optional
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.database import get_db
from app.models.task import (
    YardTask, TaskComment,
    TaskCategory, TaskPriority, TaskStatus, RecurrenceType, AssignmentType, HealthTaskType
)
from app.models.user import User, UserRole
from app.models.service import ServiceRequest
from app.models.medication_log import (
    MedicationAdminLog, WoundCareLog, HealthObservation, RehabTaskLog,
    HealingStatus, AppetiteStatus, DemeanorStatus
)
from app.models.feed import FeedTime
from app.schemas.task import (
    YardTaskCreate, YardTaskUpdate, YardTaskResponse, YardTaskDetailResponse,
    TaskCommentCreate, TaskCommentResponse,
    TasksListResponse, TasksSummary, TaskEnums, TaskEnumInfo, MaintenanceDayAssign,
    HealthTaskCompletion, HealthTaskGenerationResult
)
from app.utils.auth import get_current_user, has_staff_access
from app.services.health_task_generator import HealthTaskGenerator

router = APIRouter()


CATEGORY_LABELS = {
    TaskCategory.MAINTENANCE: "Maintenance",
    TaskCategory.REPAIRS: "Repairs",
    TaskCategory.CLEANING: "Cleaning",
    TaskCategory.FEEDING: "Feeding",
    TaskCategory.TURNOUT: "Turnout",
    TaskCategory.HEALTH: "Health Check",
    TaskCategory.ADMIN: "Admin",
    TaskCategory.SAFETY: "Safety",
    TaskCategory.LIVERY_SERVICE: "Livery Service",
    TaskCategory.OTHER: "Other",
}

PRIORITY_LABELS = {
    TaskPriority.LOW: "Low",
    TaskPriority.MEDIUM: "Medium",
    TaskPriority.HIGH: "High",
    TaskPriority.URGENT: "Urgent",
}

STATUS_LABELS = {
    TaskStatus.OPEN: "Open",
    TaskStatus.IN_PROGRESS: "In Progress",
    TaskStatus.COMPLETED: "Completed",
    TaskStatus.CANCELLED: "Cancelled",
}

RECURRENCE_LABELS = {
    RecurrenceType.DAILY: "Daily",
    RecurrenceType.WEEKLY: "Weekly",
    RecurrenceType.MONTHLY: "Monthly",
    RecurrenceType.CUSTOM: "Custom",
}

ASSIGNMENT_TYPE_LABELS = {
    AssignmentType.SPECIFIC: "Assigned to Person",
    AssignmentType.POOL: "Available for Today's Staff",
    AssignmentType.BACKLOG: "To Schedule",
}


def enrich_task(task: YardTask) -> dict:
    """Add computed fields to task response."""
    result = {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "category": task.category,
        "priority": task.priority,
        "location": task.location,
        "reported_by_id": task.reported_by_id,
        "reported_date": task.reported_date,
        "assignment_type": task.assignment_type or AssignmentType.BACKLOG,
        "assigned_to_id": task.assigned_to_id,
        "scheduled_date": task.scheduled_date,
        "status": task.status,
        "completed_date": task.completed_date,
        "completed_by_id": task.completed_by_id,
        "completion_notes": task.completion_notes,
        "estimated_cost": task.estimated_cost,
        "is_maintenance_day_task": task.is_maintenance_day_task,
        "is_recurring": task.is_recurring,
        "recurrence_type": task.recurrence_type,
        "recurrence_days": task.recurrence_days,
        "parent_task_id": task.parent_task_id,
        "service_request_id": task.service_request_id,
        "service_billable_amount": None,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
        "reported_by_name": task.reported_by.name if task.reported_by else None,
        "assigned_to_name": task.assigned_to.name if task.assigned_to else None,
        "completed_by_name": task.completed_by.name if task.completed_by else None,
        "comment_count": len(task.comments) if task.comments else 0,
        # Health task fields
        "health_task_type": task.health_task_type,
        "horse_id": task.horse_id,
        "horse_name": task.horse.name if task.horse else None,
        "feed_addition_id": task.feed_addition_id,
        "wound_care_log_id": task.wound_care_log_id,
        "rehab_task_id": task.rehab_task_id,
        "rehab_program_id": task.rehab_program_id,
        "feed_time": task.feed_time,
        "health_record_id": task.health_record_id,
        "health_record_type": task.health_record_type,
    }

    # Add additional health info for display
    if task.health_task_type == HealthTaskType.MEDICATION and task.feed_addition:
        result["medication_name"] = task.feed_addition.name
        result["medication_dosage"] = task.feed_addition.dosage
    elif task.health_task_type == HealthTaskType.WOUND_CARE and task.wound_care_log:
        result["wound_name"] = task.wound_care_log.wound_name
        result["wound_location"] = task.wound_care_log.wound_location
    elif task.health_task_type == HealthTaskType.REHAB_EXERCISE:
        if task.rehab_program:
            result["rehab_program_name"] = task.rehab_program.name
        if task.rehab_task:
            result["rehab_task_description"] = task.rehab_task.description

    # Add billable amount from linked service request
    if task.service_request:
        # Use charge_amount if set, otherwise use service catalog price
        if task.service_request.charge_amount is not None:
            result["service_billable_amount"] = task.service_request.charge_amount
        elif task.service_request.service:
            result["service_billable_amount"] = task.service_request.service.price_gbp

    return result


def enrich_comment(comment: TaskComment) -> dict:
    """Add computed fields to comment response."""
    return {
        "id": comment.id,
        "task_id": comment.task_id,
        "user_id": comment.user_id,
        "content": comment.content,
        "created_at": comment.created_at,
        "user_name": comment.user.name if comment.user else None,
    }


@router.get("/enums", response_model=TaskEnums)
def get_enums():
    """Get enum options for forms."""
    return TaskEnums(
        categories=[
            TaskEnumInfo(value=c.value, label=CATEGORY_LABELS.get(c, c.value.title()))
            for c in TaskCategory
        ],
        priorities=[
            TaskEnumInfo(value=p.value, label=PRIORITY_LABELS.get(p, p.value.title()))
            for p in TaskPriority
        ],
        statuses=[
            TaskEnumInfo(value=s.value, label=STATUS_LABELS.get(s, s.value.title()))
            for s in TaskStatus
        ],
        recurrence_types=[
            TaskEnumInfo(value=r.value, label=RECURRENCE_LABELS.get(r, r.value.title()))
            for r in RecurrenceType
        ],
        assignment_types=[
            TaskEnumInfo(value=a.value, label=ASSIGNMENT_TYPE_LABELS.get(a, a.value.title()))
            for a in AssignmentType
        ],
    )


@router.get("/summary", response_model=TasksSummary)
def get_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get task summary counts."""
    today = date.today()

    total_open = db.query(YardTask).filter(
        YardTask.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS])
    ).count()

    urgent_count = db.query(YardTask).filter(
        YardTask.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS]),
        YardTask.priority == TaskPriority.URGENT
    ).count()

    high_priority_count = db.query(YardTask).filter(
        YardTask.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS]),
        YardTask.priority == TaskPriority.HIGH
    ).count()

    overdue_count = db.query(YardTask).filter(
        YardTask.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS]),
        YardTask.scheduled_date < today
    ).count()

    my_assigned_count = db.query(YardTask).filter(
        YardTask.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS]),
        YardTask.assigned_to_id == current_user.id
    ).count()

    today_count = db.query(YardTask).filter(
        YardTask.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS]),
        YardTask.scheduled_date == today
    ).count()

    return TasksSummary(
        total_open=total_open,
        urgent_count=urgent_count,
        high_priority_count=high_priority_count,
        overdue_count=overdue_count,
        my_assigned_count=my_assigned_count,
        today_count=today_count,
    )


@router.get("/", response_model=TasksListResponse)
def list_tasks(
    category: Optional[TaskCategory] = None,
    priority: Optional[TaskPriority] = None,
    status_filter: Optional[TaskStatus] = None,
    assigned_to_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all tasks organized by category.

    Filters:
    - category: Filter by task category
    - priority: Filter by priority level
    - status_filter: Filter by task status
    - assigned_to_id: Filter by assigned user ID (use -1 for unassigned/pool tasks)
    """
    today = date.today()

    # Rollover overdue tasks: move uncompleted tasks back to backlog (To Schedule)
    overdue_tasks = db.query(YardTask).filter(
        YardTask.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS]),
        YardTask.scheduled_date < today,
        YardTask.assignment_type.in_([AssignmentType.SPECIFIC, AssignmentType.POOL])
    ).all()

    for task in overdue_tasks:
        task.scheduled_date = None  # Clear schedule
        task.assignment_type = AssignmentType.BACKLOG  # Return to backlog for rescheduling
        task.assigned_to_id = None  # Clear assignment
        task.is_maintenance_day_task = False  # No longer part of a maintenance day

    if overdue_tasks:
        db.commit()

    # Base query with eager loading for relationships
    base_query = db.query(YardTask).options(
        joinedload(YardTask.reported_by),
        joinedload(YardTask.assigned_to),
        joinedload(YardTask.completed_by),
        joinedload(YardTask.comments),
        # Health task relationships
        joinedload(YardTask.horse),
        joinedload(YardTask.feed_addition),
        joinedload(YardTask.wound_care_log),
        joinedload(YardTask.rehab_task),
        joinedload(YardTask.rehab_program),
        # Service request relationship (for billable amount)
        joinedload(YardTask.service_request).joinedload(ServiceRequest.service)
    )

    if category:
        base_query = base_query.filter(YardTask.category == category)
    if priority:
        base_query = base_query.filter(YardTask.priority == priority)
    if assigned_to_id is not None:
        if assigned_to_id == -1:
            # Special value: show unassigned tasks (pool or no assignment)
            base_query = base_query.filter(YardTask.assigned_to_id.is_(None))
        else:
            base_query = base_query.filter(YardTask.assigned_to_id == assigned_to_id)

    # Open tasks (not completed/cancelled)
    open_query = base_query.filter(
        YardTask.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS])
    )
    if status_filter:
        open_query = open_query.filter(YardTask.status == status_filter)

    open_tasks = open_query.order_by(
        YardTask.priority.desc(),
        YardTask.scheduled_date.asc().nullslast(),
        YardTask.reported_date.desc()
    ).all()

    # My tasks (specifically assigned to me - not pool tasks)
    my_tasks = base_query.filter(
        YardTask.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS]),
        YardTask.assigned_to_id == current_user.id,
        YardTask.assignment_type == AssignmentType.SPECIFIC
    ).order_by(
        YardTask.priority.desc(),
        YardTask.scheduled_date.asc().nullslast()
    ).all()

    # Today's tasks (specific assignments for today)
    today_tasks = base_query.filter(
        YardTask.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS]),
        YardTask.scheduled_date == today,
        YardTask.assignment_type == AssignmentType.SPECIFIC
    ).order_by(YardTask.priority.desc()).all()

    # Pool tasks - available for any staff working today
    pool_tasks = base_query.filter(
        YardTask.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS]),
        YardTask.assignment_type == AssignmentType.POOL,
        YardTask.scheduled_date == today
    ).order_by(YardTask.priority.desc()).all()

    # Backlog tasks - not time-sensitive
    backlog_tasks = base_query.filter(
        YardTask.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS]),
        YardTask.assignment_type == AssignmentType.BACKLOG
    ).order_by(YardTask.priority.desc(), YardTask.reported_date.asc()).all()

    # Completed today - for daily review
    completed_tasks = base_query.filter(
        YardTask.status == TaskStatus.COMPLETED,
        func.date(YardTask.completed_date) == today
    ).order_by(YardTask.completed_date.desc()).all()

    # Scheduled tasks - future scheduled dates only (today is shown in Today tabs)
    # Include both SPECIFIC (assigned) and POOL (unassigned) tasks
    scheduled_tasks = base_query.filter(
        YardTask.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS]),
        YardTask.assignment_type.in_([AssignmentType.SPECIFIC, AssignmentType.POOL]),
        YardTask.scheduled_date > today
    ).order_by(YardTask.scheduled_date.asc(), YardTask.priority.desc()).all()

    return TasksListResponse(
        open_tasks=[enrich_task(t) for t in open_tasks],
        my_tasks=[enrich_task(t) for t in my_tasks],
        today_tasks=[enrich_task(t) for t in today_tasks],
        pool_tasks=[enrich_task(t) for t in pool_tasks],
        backlog_tasks=[enrich_task(t) for t in backlog_tasks],
        completed_tasks=[enrich_task(t) for t in completed_tasks],
        scheduled_tasks=[enrich_task(t) for t in scheduled_tasks],
    )


@router.get("/{task_id}", response_model=YardTaskDetailResponse)
def get_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed task information including comments."""
    task = db.query(YardTask).options(
        joinedload(YardTask.reported_by),
        joinedload(YardTask.assigned_to),
        joinedload(YardTask.completed_by),
        joinedload(YardTask.comments).joinedload(TaskComment.user)
    ).filter(YardTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    result = enrich_task(task)
    result["comments"] = [
        enrich_comment(c) for c in sorted(task.comments, key=lambda x: x.created_at)
    ]

    return result


@router.post("/", response_model=YardTaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    data: YardTaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new task. Any authenticated user can report a task."""
    task = YardTask(
        **data.model_dump(),
        reported_by_id=current_user.id,
        status=TaskStatus.OPEN
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    return enrich_task(task)


@router.put("/{task_id}", response_model=YardTaskResponse)
def update_task(
    task_id: int,
    data: YardTaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a task (staff or task reporter)."""
    task = db.query(YardTask).filter(YardTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    is_admin = current_user.role == UserRole.ADMIN
    is_reporter = task.reported_by_id == current_user.id
    is_assigned = task.assigned_to_id == current_user.id

    if not (is_admin or is_reporter or is_assigned):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update this task"
        )

    # Only admin/staff can reassign or change priority
    is_staff = has_staff_access(current_user)
    if not is_staff:
        if data.assigned_to_id is not None and data.assigned_to_id != task.assigned_to_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin or staff can assign tasks"
            )
        if data.priority is not None and data.priority != task.priority:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin or staff can change priority"
            )

    update_data = data.model_dump(exclude_unset=True)

    # Handle status change to completed
    if data.status == TaskStatus.COMPLETED and task.status != TaskStatus.COMPLETED:
        update_data["completed_date"] = datetime.utcnow()
        update_data["completed_by_id"] = current_user.id

    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)

    return enrich_task(task)


@router.put("/{task_id}/assign", response_model=YardTaskResponse)
def assign_task(
    task_id: int,
    user_id: Optional[int] = None,
    to_pool: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Assign a task to a user or staff pool (admin/staff only).

    If user_id is provided, assigns to that specific person and sets assignment_type to SPECIFIC.
    If to_pool=True (and no user_id), assigns to the staff pool for the scheduled date.
    If neither, clears assignment (back to unassigned).
    """
    if not has_staff_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yard staff access required"
        )

    task = db.query(YardTask).filter(YardTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    if user_id is not None:
        # Assign to specific person
        task.assigned_to_id = user_id
        task.assignment_type = AssignmentType.SPECIFIC
    elif to_pool:
        # Assign to staff pool (anyone working that day)
        task.assigned_to_id = None
        task.assignment_type = AssignmentType.POOL
        # If no scheduled date, set to today
        if not task.scheduled_date:
            task.scheduled_date = date.today()
    else:
        # Clear assignment
        task.assigned_to_id = None

    db.commit()
    db.refresh(task)

    return enrich_task(task)


@router.put("/{task_id}/complete", response_model=YardTaskResponse)
def complete_task(
    task_id: int,
    notes: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a task as completed. Any staff can complete pool tasks.
    If the task is linked to a livery service request, auto-complete that too."""
    task = db.query(YardTask).filter(YardTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    is_admin = current_user.role == UserRole.ADMIN
    is_staff = has_staff_access(current_user)
    is_assigned = task.assigned_to_id == current_user.id
    is_pool_task = task.assignment_type == AssignmentType.POOL

    # Allow: admin, assigned user, or any staff for pool/backlog tasks
    if not (is_admin or is_assigned or (is_staff and (is_pool_task or task.assignment_type == AssignmentType.BACKLOG))):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot complete this task"
        )

    task.status = TaskStatus.COMPLETED
    task.completed_date = datetime.utcnow()
    task.completed_by_id = current_user.id
    if notes:
        task.completion_notes = notes

    # Auto-complete linked service request if present
    if task.service_request_id:
        from app.models.service import ServiceRequest, RequestStatus, ChargeStatus
        service_request = db.query(ServiceRequest).filter(
            ServiceRequest.id == task.service_request_id
        ).first()
        if service_request and service_request.status == RequestStatus.SCHEDULED:
            service_request.status = RequestStatus.COMPLETED
            service_request.completed_datetime = datetime.utcnow()
            service_request.completed_by_id = current_user.id
            if notes:
                service_request.notes = notes

    db.commit()
    db.refresh(task)

    return enrich_task(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel a task (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    task = db.query(YardTask).filter(YardTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    task.status = TaskStatus.CANCELLED
    db.commit()


@router.put("/{task_id}/reopen", response_model=YardTaskResponse)
def reopen_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reopen a completed task (admin or assigned staff only)."""
    if not has_staff_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff access required to reopen tasks"
        )

    task = db.query(YardTask).filter(YardTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    # Only admin or the assigned staff member can reopen
    is_admin = current_user.role == UserRole.ADMIN
    is_assigned = task.assigned_to_id == current_user.id
    if not is_admin and not is_assigned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or assigned staff can reopen this task"
        )

    if task.status != TaskStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only completed tasks can be reopened"
        )

    task.status = TaskStatus.OPEN
    task.completed_date = None
    task.completed_by_id = None
    task.completion_notes = None

    db.commit()
    db.refresh(task)

    return enrich_task(task)


@router.put("/{task_id}/unschedule", response_model=YardTaskResponse)
def unschedule_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a task from its scheduled day and return to backlog (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    task = db.query(YardTask).filter(YardTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    task.scheduled_date = None
    task.assignment_type = AssignmentType.BACKLOG
    task.assigned_to_id = None
    task.is_maintenance_day_task = False

    db.commit()
    db.refresh(task)

    return enrich_task(task)


@router.put("/{task_id}/reassign", response_model=YardTaskResponse)
def reassign_task(
    task_id: int,
    assigned_to_id: Optional[int] = None,
    assignment_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reassign a task to a specific person or pool (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    task = db.query(YardTask).filter(YardTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    if assigned_to_id is not None:
        # Verify user exists
        user = db.query(User).filter(User.id == assigned_to_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        task.assigned_to_id = assigned_to_id
        task.assignment_type = AssignmentType.SPECIFIC
    elif assignment_type == 'pool':
        task.assigned_to_id = None
        task.assignment_type = AssignmentType.POOL

    db.commit()
    db.refresh(task)

    return enrich_task(task)


# ============== Bulk Operations ==============

@router.post("/bulk/maintenance-day", response_model=List[YardTaskResponse])
def assign_maintenance_day(
    data: MaintenanceDayAssign,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Assign multiple backlog tasks to a person for a maintenance day (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    # Verify assigned user exists and is staff
    assigned_user = db.query(User).filter(User.id == data.assigned_to_id).first()
    if not assigned_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned user not found"
        )
    # Allow staff role, yard_staff flag, or admin
    if not assigned_user.is_yard_staff and assigned_user.role not in [UserRole.ADMIN, UserRole.STAFF]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only assign to staff members"
        )

    # Get and update all specified tasks
    tasks = db.query(YardTask).filter(
        YardTask.id.in_(data.task_ids),
        YardTask.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS])
    ).all()

    if len(tasks) != len(data.task_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Some tasks not found or already completed"
        )

    for task in tasks:
        task.assigned_to_id = data.assigned_to_id
        task.scheduled_date = data.scheduled_date
        task.assignment_type = AssignmentType.SPECIFIC
        task.is_maintenance_day_task = True

    # Also create a maintenance shift if one doesn't exist for this person/date
    from app.models.staff_management import Shift, ShiftType, ShiftRole
    existing_shift = db.query(Shift).filter(
        Shift.staff_id == data.assigned_to_id,
        Shift.date == data.scheduled_date
    ).first()

    if not existing_shift:
        shift = Shift(
            staff_id=data.assigned_to_id,
            date=data.scheduled_date,
            shift_type=ShiftType.FULL_DAY,
            role=ShiftRole.MAINTENANCE,
            notes=f"Maintenance day - {len(tasks)} task(s) assigned",
            created_by_id=current_user.id
        )
        db.add(shift)

    db.commit()

    # Refresh and return
    for task in tasks:
        db.refresh(task)

    return [enrich_task(t) for t in tasks]


# ============== Comment Routes ==============

@router.post("/{task_id}/comments", response_model=TaskCommentResponse, status_code=status.HTTP_201_CREATED)
def add_comment(
    task_id: int,
    data: TaskCommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a comment to a task."""
    task = db.query(YardTask).filter(YardTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    comment = TaskComment(
        task_id=task_id,
        user_id=current_user.id,
        content=data.content
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return enrich_comment(comment)


@router.delete("/{task_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    task_id: int,
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a comment (own comment or staff)."""
    comment = db.query(TaskComment).filter(
        TaskComment.id == comment_id,
        TaskComment.task_id == task_id
    ).first()
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )

    is_admin = current_user.role == UserRole.ADMIN
    is_own = comment.user_id == current_user.id

    if not (is_own or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete this comment"
        )

    db.delete(comment)
    db.commit()


# ============== Health Task Routes ==============

@router.post("/generate-health-tasks/{target_date}", response_model=HealthTaskGenerationResult)
def generate_health_tasks(
    target_date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate health tasks for a specific date (admin only).

    Creates yard tasks from:
    - Active medication prescriptions (FeedAddition)
    - Wound care with treatment due
    - Daily health checks for each livery horse
    - Active rehab program exercises
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required to generate health tasks"
        )

    generator = HealthTaskGenerator(db, current_user.id)
    result = generator.generate_all_for_date(target_date)

    return HealthTaskGenerationResult(
        date=target_date,
        medication=result["medication"],
        wound_care=result["wound_care"],
        health_check=result["health_check"],
        rehab_exercise=result["rehab_exercise"],
        total=result["total"]
    )


@router.put("/{task_id}/complete-health", response_model=YardTaskResponse)
def complete_health_task(
    task_id: int,
    completion_data: HealthTaskCompletion = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Complete a health task and create the corresponding health record.

    This endpoint handles completion of medication, wound care, health check,
    and rehab exercise tasks. It creates the appropriate health record
    (MedicationAdminLog, WoundCareLog, HealthObservation, or RehabTaskLog)
    and links it to the completed task.
    """
    task = db.query(YardTask).options(
        joinedload(YardTask.horse),
        joinedload(YardTask.feed_addition),
        joinedload(YardTask.wound_care_log),
        joinedload(YardTask.rehab_task),
        joinedload(YardTask.rehab_program)
    ).filter(YardTask.id == task_id).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    if not task.health_task_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This is not a health task"
        )

    # Check permission
    is_admin = current_user.role == UserRole.ADMIN
    is_staff = has_staff_access(current_user)
    is_assigned = task.assigned_to_id == current_user.id
    is_pool_task = task.assignment_type == AssignmentType.POOL

    if not (is_admin or is_assigned or (is_staff and (is_pool_task or task.assignment_type == AssignmentType.BACKLOG))):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot complete this task"
        )

    # Create appropriate health record based on task type
    health_record_id = None
    health_record_type = None

    if task.health_task_type == HealthTaskType.MEDICATION:
        if not completion_data.medication:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Medication completion data required"
            )
        med_data = completion_data.medication

        # Map feed_time string to FeedTime enum
        feed_time_enum = FeedTime.MORNING if task.feed_time == 'morning' else FeedTime.EVENING

        log = MedicationAdminLog(
            feed_addition_id=task.feed_addition_id,
            horse_id=task.horse_id,
            admin_date=task.scheduled_date,
            feed_time=feed_time_enum,
            was_given=med_data.was_given,
            skip_reason=med_data.skip_reason,
            given_by_id=current_user.id,
            notes=med_data.notes
        )
        db.add(log)
        db.flush()
        health_record_id = log.id
        health_record_type = "medication_log"

    elif task.health_task_type == HealthTaskType.WOUND_CARE:
        if not completion_data.wound_care:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Wound care completion data required"
            )
        wound_data = completion_data.wound_care

        # Create new wound care log entry as treatment follow-up
        log = WoundCareLog(
            horse_id=task.horse_id,
            wound_name=task.wound_care_log.wound_name if task.wound_care_log else "Unknown",
            wound_location=task.wound_care_log.wound_location if task.wound_care_log else None,
            treatment_date=task.scheduled_date,
            treatment_given=wound_data.treatment_given,
            products_used=wound_data.products_used,
            healing_assessment=wound_data.healing_assessment,
            assessment_notes=wound_data.assessment_notes,
            next_treatment_due=wound_data.next_treatment_due,
            treated_by_id=current_user.id,
            is_resolved=wound_data.is_healed,
            resolved_date=task.scheduled_date if wound_data.is_healed else None
        )
        db.add(log)
        db.flush()
        health_record_id = log.id
        health_record_type = "wound_log"

        # If marked as healed, also update the original wound record
        if wound_data.is_healed and task.wound_care_log:
            task.wound_care_log.is_resolved = True
            task.wound_care_log.resolved_date = task.scheduled_date

    elif task.health_task_type == HealthTaskType.HEALTH_CHECK:
        if not completion_data.health_observation:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Health observation completion data required"
            )
        obs_data = completion_data.health_observation

        observation = HealthObservation(
            horse_id=task.horse_id,
            observation_date=task.scheduled_date,
            observation_time=obs_data.observation_time,
            temperature=obs_data.temperature,
            appetite=obs_data.appetite,
            demeanor=obs_data.demeanor,
            droppings_normal=obs_data.droppings_normal,
            concerns=obs_data.concerns,
            action_taken=obs_data.action_taken,
            vet_notified=obs_data.vet_notified,
            observed_by_id=current_user.id
        )
        db.add(observation)
        db.flush()
        health_record_id = observation.id
        health_record_type = "observation"

    elif task.health_task_type == HealthTaskType.REHAB_EXERCISE:
        if not completion_data.rehab_exercise:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Rehab exercise completion data required"
            )
        rehab_data = completion_data.rehab_exercise

        # Map feed_time string to FeedTime enum if present
        feed_time_enum = None
        if task.feed_time:
            feed_time_enum = FeedTime.MORNING if task.feed_time == 'morning' else FeedTime.EVENING

        log = RehabTaskLog(
            task_id=task.rehab_task_id,
            program_id=task.rehab_program_id,
            horse_id=task.horse_id,
            log_date=task.scheduled_date,
            feed_time=feed_time_enum,
            was_completed=rehab_data.was_completed,
            skip_reason=rehab_data.skip_reason,
            actual_duration_minutes=rehab_data.actual_duration_minutes,
            horse_response=rehab_data.horse_response,
            concerns=rehab_data.concerns,
            vet_notified=rehab_data.vet_notified,
            completed_by_id=current_user.id
        )
        db.add(log)
        db.flush()
        health_record_id = log.id
        health_record_type = "rehab_log"

    # Mark task as complete
    task.status = TaskStatus.COMPLETED
    task.completed_date = datetime.utcnow()
    task.completed_by_id = current_user.id
    task.health_record_id = health_record_id
    task.health_record_type = health_record_type

    db.commit()
    db.refresh(task)

    return enrich_task(task)


@router.get("/health-tasks/{target_date}", response_model=List[YardTaskResponse])
def get_health_tasks_for_date(
    target_date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all health tasks for a specific date."""
    if not has_staff_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff access required"
        )

    tasks = db.query(YardTask).options(
        joinedload(YardTask.reported_by),
        joinedload(YardTask.assigned_to),
        joinedload(YardTask.completed_by),
        joinedload(YardTask.comments),
        joinedload(YardTask.horse),
        joinedload(YardTask.feed_addition),
        joinedload(YardTask.wound_care_log),
        joinedload(YardTask.rehab_task),
        joinedload(YardTask.rehab_program)
    ).filter(
        YardTask.health_task_type.isnot(None),
        YardTask.scheduled_date == target_date
    ).order_by(
        YardTask.priority.desc(),
        YardTask.health_task_type
    ).all()

    return [enrich_task(t) for t in tasks]

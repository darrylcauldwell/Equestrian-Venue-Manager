from typing import List
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from dateutil.relativedelta import relativedelta

from app.database import get_db
from app.models.compliance import ComplianceItem, ComplianceHistory
from app.models.task import YardTask, TaskCategory, TaskPriority, TaskStatus, AssignmentType
from app.models.user import User, UserRole
from app.schemas.compliance import (
    ComplianceItemCreate, ComplianceItemUpdate, ComplianceItemResponse,
    ComplianceHistoryCreate, ComplianceHistoryResponse,
    ComplianceDashboard
)
from app.utils.auth import get_current_user
from app.utils.crud import CRUDFactory, require_admin

router = APIRouter()


def require_admin_dep(current_user: User = Depends(get_current_user)) -> User:
    """Dependency version of require_admin for non-CRUD endpoints."""
    require_admin(current_user, "access compliance")
    return current_user


def create_compliance_task(db: Session, item: ComplianceItem) -> YardTask | None:
    """Create a backlog task for a compliance item that is due or due soon.

    Returns the created task or None if a task already exists.
    """
    if not item.next_due_date:
        return None

    # Check if a task already exists for this compliance item (by checking title pattern)
    task_title = f"[Compliance] {item.name}"
    existing_task = db.query(YardTask).filter(
        YardTask.title == task_title,
        YardTask.status.in_([TaskStatus.OPEN, TaskStatus.IN_PROGRESS])
    ).first()

    if existing_task:
        return None  # Task already exists

    # Determine priority based on how soon/overdue
    now = datetime.utcnow()
    days_until_due = (item.next_due_date - now).days

    if days_until_due < 0:
        priority = TaskPriority.URGENT
    elif days_until_due <= 7:
        priority = TaskPriority.HIGH
    elif days_until_due <= 14:
        priority = TaskPriority.MEDIUM
    else:
        priority = TaskPriority.LOW

    # Create task description
    due_text = "OVERDUE" if days_until_due < 0 else f"Due in {days_until_due} days"
    description = f"{item.description or ''}\n\n" if item.description else ""
    description += f"Due Date: {item.next_due_date.strftime('%d %b %Y')}\n"
    description += f"Status: {due_text}\n"
    if item.provider:
        description += f"Provider: {item.provider}\n"
    if item.reference_number:
        description += f"Reference: {item.reference_number}"

    # Create task in backlog
    task = YardTask(
        title=task_title,
        description=description.strip(),
        category=TaskCategory.ADMIN,
        priority=priority,
        assignment_type=AssignmentType.BACKLOG,
        status=TaskStatus.OPEN,
        reported_by_id=item.responsible_user_id,
        reported_date=datetime.utcnow(),
    )
    db.add(task)
    return task


def sync_compliance_tasks(db: Session) -> int:
    """Check all compliance items and create tasks for those due/due soon.

    Returns the number of tasks created.
    """
    items = db.query(ComplianceItem).filter(ComplianceItem.is_active == True).all()
    now = datetime.utcnow()
    tasks_created = 0

    for item in items:
        if not item.next_due_date:
            continue

        days_until_due = (item.next_due_date - now).days

        # Create task if due within reminder period or overdue
        if days_until_due <= item.reminder_days_before:
            task = create_compliance_task(db, item)
            if task:
                tasks_created += 1

    if tasks_created > 0:
        db.commit()

    return tasks_created


def item_to_response(item: ComplianceItem) -> ComplianceItemResponse:
    """Convert a ComplianceItem to response format with computed fields."""
    now = datetime.utcnow()
    is_overdue = False
    days_until_due = None

    if item.next_due_date:
        days_until_due = (item.next_due_date - now).days
        is_overdue = days_until_due < 0

    return ComplianceItemResponse(
        id=item.id,
        name=item.name,
        category=item.category,
        description=item.description,
        reference_number=item.reference_number,
        provider=item.provider,
        renewal_frequency_months=item.renewal_frequency_months,
        last_completed_date=item.last_completed_date,
        next_due_date=item.next_due_date,
        reminder_days_before=item.reminder_days_before,
        responsible_user_id=item.responsible_user_id,
        responsible_user_name=item.responsible_user.name if item.responsible_user else None,
        certificate_url=item.certificate_url,
        notes=item.notes,
        is_active=item.is_active,
        is_overdue=is_overdue,
        days_until_due=days_until_due,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def delete_compliance_history(db: Session, item: ComplianceItem) -> None:
    """Pre-delete hook to remove history records."""
    db.query(ComplianceHistory).filter(
        ComplianceHistory.compliance_item_id == item.id
    ).delete()


# CRUD factory for compliance items
crud = CRUDFactory(
    model=ComplianceItem,
    name="compliance item",
    response_transform=item_to_response
)


@router.get("/dashboard", response_model=ComplianceDashboard)
def get_compliance_dashboard(
    current_user: User = Depends(require_admin_dep),
    db: Session = Depends(get_db)
):
    """Get compliance dashboard with summary counts and lists.

    Also syncs compliance tasks - creates backlog tasks for items that are due soon.
    """
    # Sync compliance tasks (creates tasks for due/due soon items)
    sync_compliance_tasks(db)

    items = db.query(ComplianceItem).filter(ComplianceItem.is_active == True).all()
    now = datetime.utcnow()

    overdue_items = []
    due_soon_items = []
    up_to_date_count = 0

    for item in items:
        response = item_to_response(item)
        if response.is_overdue:
            overdue_items.append(response)
        elif response.days_until_due is not None and response.days_until_due <= item.reminder_days_before:
            due_soon_items.append(response)
        else:
            up_to_date_count += 1

    return ComplianceDashboard(
        total_items=len(items),
        overdue_count=len(overdue_items),
        due_soon_count=len(due_soon_items),
        up_to_date_count=up_to_date_count,
        overdue_items=sorted(overdue_items, key=lambda x: x.days_until_due or 0),
        due_soon_items=sorted(due_soon_items, key=lambda x: x.days_until_due or 0),
    )


@router.get("/items", response_model=List[ComplianceItemResponse])
def list_compliance_items(
    active_only: bool = True,
    category: str = None,
    current_user: User = Depends(require_admin_dep),
    db: Session = Depends(get_db)
):
    """List all compliance items."""
    query = db.query(ComplianceItem)

    if active_only:
        query = query.filter(ComplianceItem.is_active == True)

    if category:
        query = query.filter(ComplianceItem.category == category)

    items = query.order_by(ComplianceItem.next_due_date.asc().nullslast()).all()
    return [item_to_response(item) for item in items]


@router.get("/items/{item_id}", response_model=ComplianceItemResponse)
def get_compliance_item(
    item_id: int,
    current_user: User = Depends(require_admin_dep),
    db: Session = Depends(get_db)
):
    """Get a specific compliance item."""
    return crud.get(db, item_id)


@router.post("/items", response_model=ComplianceItemResponse, status_code=status.HTTP_201_CREATED)
def create_compliance_item(
    item_data: ComplianceItemCreate,
    current_user: User = Depends(require_admin_dep),
    db: Session = Depends(get_db)
):
    """Create a new compliance item."""
    return crud.create(db, item_data)


@router.put("/items/{item_id}", response_model=ComplianceItemResponse)
def update_compliance_item(
    item_id: int,
    item_data: ComplianceItemUpdate,
    current_user: User = Depends(require_admin_dep),
    db: Session = Depends(get_db)
):
    """Update a compliance item."""
    return crud.update(db, item_id, item_data)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_compliance_item(
    item_id: int,
    current_user: User = Depends(require_admin_dep),
    db: Session = Depends(get_db)
):
    """Delete a compliance item and its history."""
    crud.delete(db, item_id, pre_delete_check=delete_compliance_history)


@router.post("/items/{item_id}/complete", response_model=ComplianceItemResponse)
def complete_compliance_item(
    item_id: int,
    completion_data: ComplianceHistoryCreate,
    current_user: User = Depends(require_admin_dep),
    db: Session = Depends(get_db)
):
    """Mark a compliance item as completed and create history record."""
    item = crud.get_or_404(db, item_id)

    # Create history record
    history = ComplianceHistory(
        compliance_item_id=item_id,
        completed_date=completion_data.completed_date,
        completed_by_id=current_user.id,
        certificate_url=completion_data.certificate_url,
        notes=completion_data.notes,
        cost=completion_data.cost,
    )
    db.add(history)

    # Update item
    item.last_completed_date = completion_data.completed_date
    item.certificate_url = completion_data.certificate_url or item.certificate_url

    # Calculate next due date
    if item.renewal_frequency_months:
        item.next_due_date = completion_data.completed_date + relativedelta(months=item.renewal_frequency_months)

    db.commit()
    db.refresh(item)
    return item_to_response(item)


@router.get("/items/{item_id}/history", response_model=List[ComplianceHistoryResponse])
def get_compliance_history(
    item_id: int,
    current_user: User = Depends(require_admin_dep),
    db: Session = Depends(get_db)
):
    """Get completion history for a compliance item."""
    crud.get_or_404(db, item_id)  # Verify item exists

    history = db.query(ComplianceHistory).filter(
        ComplianceHistory.compliance_item_id == item_id
    ).order_by(ComplianceHistory.completed_date.desc()).all()

    return [
        ComplianceHistoryResponse(
            id=h.id,
            compliance_item_id=h.compliance_item_id,
            completed_date=h.completed_date,
            completed_by_id=h.completed_by_id,
            completed_by_name=h.completed_by.name if h.completed_by else None,
            certificate_url=h.certificate_url,
            notes=h.notes,
            cost=h.cost,
            created_at=h.created_at,
        )
        for h in history
    ]

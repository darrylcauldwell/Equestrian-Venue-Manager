from typing import List, Optional
from datetime import datetime, date, timedelta
import json
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_

from app.database import get_db
from app.models.horse import Horse
from app.models.service import (
    Service,
    ServiceRequest,
    ServiceCategory,
    RequestStatus,
    ChargeStatus,
    RecurringPattern,
)
from app.models.user import User, UserRole
from app.models.medication_log import RehabProgram, RehabPhase, RehabTask, RehabStatus
from app.schemas.service import (
    ServiceCreate,
    ServiceUpdate,
    ServiceResponse,
    ServiceRequestCreate,
    ServiceRequestUpdate,
    ServiceRequestSchedule,
    ServiceRequestComplete,
    ServiceRequestQuote,
    ServiceRequestResponse,
    MyServiceRequestsSummary,
    StaffServiceRequestsSummary,
    RehabAssistanceRequestCreate,
    InsuranceToggle,
    InsuranceStatement,
    InsuranceClaimItem,
)
from app.models.service import PreferredTime
from app.models.settings import SiteSettings
from app.models.account import LedgerEntry, TransactionType
from app.models.livery_package import LiveryPackage
from app.utils.auth import get_current_user, has_staff_access
from app.utils.crud import CRUDFactory, require_admin, get_or_404
from app.utils.pdf_generator import generate_insurance_statement_pdf

router = APIRouter()


def check_service_requests(db: Session, service: Service) -> None:
    """Pre-delete check for existing service requests."""
    request_count = db.query(ServiceRequest).filter(
        ServiceRequest.service_id == service.id
    ).count()
    if request_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete service with {request_count} existing requests. Deactivate it instead."
        )


# CRUD factory for services (uses string ID)
service_crud = CRUDFactory(model=Service, name="service")


def service_request_query(db: Session):
    """Create a query with eager loading for service requests."""
    return db.query(ServiceRequest).options(
        joinedload(ServiceRequest.service),
        joinedload(ServiceRequest.horse),
        joinedload(ServiceRequest.requested_by),
        joinedload(ServiceRequest.assigned_to),
        joinedload(ServiceRequest.quoted_by),
        joinedload(ServiceRequest.rehab_program),
        joinedload(ServiceRequest.rehab_task)
    )


def enrich_service_request(request: ServiceRequest) -> ServiceRequestResponse:
    """Add related entity names to a service request."""
    response = ServiceRequestResponse.model_validate(request)
    if request.service:
        response.service_name = request.service.name
        response.service_category = request.service.category.value
        response.service_price = request.service.price_gbp
    if request.horse:
        response.horse_name = request.horse.name
    if request.requested_by:
        response.requested_by_name = request.requested_by.name
    if request.assigned_to:
        response.assigned_to_name = request.assigned_to.name
    if request.quoted_by:
        response.quoted_by_name = request.quoted_by.name
    # Rehab-specific enrichment
    if request.rehab_program:
        response.rehab_program_name = request.rehab_program.name
    if request.rehab_task:
        response.rehab_task_description = request.rehab_task.description
    return response


# ============== Service Catalog ==============

@router.get("/", response_model=List[ServiceResponse])
def list_services(
    category: Optional[ServiceCategory] = None,
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    """List all available services."""
    query = db.query(Service)

    if category:
        query = query.filter(Service.category == category)

    if active_only:
        query = query.filter(Service.is_active == True)

    return query.order_by(Service.category, Service.name).all()


@router.get("/{service_id}", response_model=ServiceResponse)
def get_service(
    service_id: str,
    db: Session = Depends(get_db)
):
    """Get a specific service by ID."""
    return get_or_404(db, Service, service_id, "Service not found")


@router.post("/", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
def create_service(
    data: ServiceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new service (admin only)."""
    require_admin(current_user, "create services")

    existing = db.query(Service).filter(Service.id == data.id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Service ID already exists")

    return service_crud.create(db, data)


@router.put("/{service_id}", response_model=ServiceResponse)
def update_service(
    service_id: str,
    data: ServiceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a service (admin only)."""
    return service_crud.update_admin_only(db, service_id, data, current_user)


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(
    service_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a service (admin only). Only services with no requests can be deleted."""
    service_crud.delete_admin_only(
        db, service_id, current_user,
        pre_delete_check=check_service_requests
    )


# ============== Service Requests ==============

@router.get("/requests/assigned", response_model=List[ServiceRequestResponse])
def get_assigned_service_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get service requests assigned to the current user (for staff)."""
    requests = service_request_query(db).filter(
        ServiceRequest.assigned_to_id == current_user.id,
        ServiceRequest.status == RequestStatus.SCHEDULED
    ).order_by(ServiceRequest.scheduled_datetime).all()

    return [enrich_service_request(r) for r in requests]


@router.get("/requests/my", response_model=MyServiceRequestsSummary)
def get_my_service_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's service requests."""
    # Pending = awaiting admin quote
    pending = service_request_query(db).filter(
        ServiceRequest.requested_by_id == current_user.id,
        ServiceRequest.status == RequestStatus.PENDING
    ).order_by(ServiceRequest.requested_date).all()

    # Quoted = have quote, awaiting user approval
    quoted = service_request_query(db).filter(
        ServiceRequest.requested_by_id == current_user.id,
        ServiceRequest.status == RequestStatus.QUOTED
    ).order_by(ServiceRequest.requested_date).all()

    # Scheduled = approved and scheduled (includes APPROVED waiting to be scheduled)
    scheduled = service_request_query(db).filter(
        ServiceRequest.requested_by_id == current_user.id,
        ServiceRequest.status.in_([RequestStatus.APPROVED, RequestStatus.SCHEDULED])
    ).order_by(ServiceRequest.scheduled_datetime).all()

    completed = service_request_query(db).filter(
        ServiceRequest.requested_by_id == current_user.id,
        ServiceRequest.status == RequestStatus.COMPLETED
    ).order_by(ServiceRequest.completed_datetime.desc()).limit(20).all()

    return MyServiceRequestsSummary(
        pending_requests=[enrich_service_request(r) for r in pending],
        quoted_requests=[enrich_service_request(r) for r in quoted],
        scheduled_requests=[enrich_service_request(r) for r in scheduled],
        completed_requests=[enrich_service_request(r) for r in completed],
    )


@router.get("/requests/staff", response_model=StaffServiceRequestsSummary)
def get_staff_service_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get service requests for staff dashboard."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can access this endpoint"
        )

    # Requests needing a quote (rehab assistance or zero-price services that are pending)
    pending_approval = service_request_query(db).join(Service).filter(
        ServiceRequest.status == RequestStatus.PENDING,
        or_(
            Service.category == ServiceCategory.REHAB,
            Service.price_gbp == 0
        )
    ).order_by(ServiceRequest.requested_date).all()

    # Requests ready to schedule:
    # - Approved requests (quote accepted)
    # - OR pending standard service requests (have catalog price, no quote needed)
    pending_scheduling = service_request_query(db).join(Service).filter(
        or_(
            ServiceRequest.status == RequestStatus.APPROVED,
            and_(
                ServiceRequest.status == RequestStatus.PENDING,
                Service.category != ServiceCategory.REHAB,
                Service.price_gbp > 0
            )
        ),
        ServiceRequest.scheduled_datetime == None
    ).order_by(ServiceRequest.requested_date).all()

    # Today's scheduled requests
    today = date.today()
    scheduled_today = service_request_query(db).filter(
        ServiceRequest.status == RequestStatus.SCHEDULED,
        ServiceRequest.scheduled_datetime >= datetime.combine(today, datetime.min.time()),
        ServiceRequest.scheduled_datetime < datetime.combine(today, datetime.max.time())
    ).order_by(ServiceRequest.scheduled_datetime).all()

    # Recently completed (last 20)
    completed = service_request_query(db).filter(
        ServiceRequest.status == RequestStatus.COMPLETED
    ).order_by(ServiceRequest.completed_datetime.desc()).limit(20).all()

    return StaffServiceRequestsSummary(
        pending_approval=[enrich_service_request(r) for r in pending_approval],
        pending_scheduling=[enrich_service_request(r) for r in pending_scheduling],
        scheduled_today=[enrich_service_request(r) for r in scheduled_today],
        completed=[enrich_service_request(r) for r in completed],
    )


@router.get("/requests/all", response_model=List[ServiceRequestResponse])
def list_all_requests(
    status_filter: Optional[RequestStatus] = None,
    horse_id: Optional[int] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all service requests (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can view all requests"
        )

    query = service_request_query(db)

    if status_filter:
        query = query.filter(ServiceRequest.status == status_filter)
    if horse_id:
        query = query.filter(ServiceRequest.horse_id == horse_id)
    if from_date:
        query = query.filter(ServiceRequest.requested_date >= from_date)
    if to_date:
        query = query.filter(ServiceRequest.requested_date <= to_date)

    requests = query.order_by(ServiceRequest.created_at.desc()).limit(100).all()
    return [enrich_service_request(r) for r in requests]


@router.post("/requests", response_model=ServiceRequestResponse, status_code=status.HTTP_201_CREATED)
def create_service_request(
    data: ServiceRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new service request."""
    # Verify service exists
    service = db.query(Service).filter(
        Service.id == data.service_id,
        Service.is_active == True
    ).first()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found or inactive")

    # Verify horse belongs to user (or staff can request for any horse)
    horse = db.query(Horse).filter(Horse.id == data.horse_id).first()
    if not horse:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Horse not found")

    if horse.owner_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only request services for your own horses"
        )

    # Check advance notice
    days_notice = (data.requested_date - date.today()).days
    hours_notice = days_notice * 24
    if hours_notice < service.advance_notice_hours:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This service requires at least {service.advance_notice_hours} hours advance notice"
        )

    # Set initial status
    initial_status = RequestStatus.PENDING
    if not service.requires_approval:
        initial_status = RequestStatus.APPROVED

    # Admin requests can be auto-approved
    if current_user.role == UserRole.ADMIN:
        initial_status = RequestStatus.APPROVED

    request = ServiceRequest(
        service_id=data.service_id,
        horse_id=data.horse_id,
        requested_by_id=current_user.id,
        requested_date=data.requested_date,
        preferred_time=data.preferred_time,
        special_instructions=data.special_instructions,
        status=initial_status,
        charge_amount=service.price_gbp,
    )
    db.add(request)
    db.commit()
    db.refresh(request)

    return enrich_service_request(request)


@router.post("/requests/rehab", response_model=List[ServiceRequestResponse], status_code=status.HTTP_201_CREATED)
def create_rehab_assistance_request(
    data: RehabAssistanceRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a rehab assistance request for staff to help with rehab tasks.

    Supports:
    - Per-day requests: Staff handles all tasks for a specific date (rehab_task_id=None)
    - Per-task requests: Staff handles a specific exercise (rehab_task_id set)
    - Date range: Creates requests for each day from start_date to end_date
    """
    # Verify horse exists and belongs to user
    horse = db.query(Horse).filter(Horse.id == data.horse_id).first()
    if not horse:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Horse not found")

    if horse.owner_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only request assistance for your own horses"
        )

    # Verify rehab program exists and is active
    program = db.query(RehabProgram).filter(
        RehabProgram.id == data.rehab_program_id,
        RehabProgram.horse_id == data.horse_id
    ).first()
    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rehab program not found for this horse")

    if program.status != RehabStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only request assistance for active rehab programs"
        )

    # Get or create the rehab assistance service
    rehab_service = db.query(Service).filter(
        Service.id == "rehab-assistance"
    ).first()

    if not rehab_service:
        # Create the rehab assistance service if it doesn't exist
        rehab_service = Service(
            id="rehab-assistance",
            category=ServiceCategory.REHAB,
            name="Rehab Task Assistance",
            description="Staff assistance with horse rehabilitation exercises and tasks",
            price_gbp=0,  # No charge for rehab assistance by default
            requires_approval=False,
            advance_notice_hours=0,  # Allow same-day requests
            is_active=True
        )
        db.add(rehab_service)
        db.commit()
        db.refresh(rehab_service)

    # Validate date range
    if data.end_date < data.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date must be on or after start date"
        )

    # Limit to 90 days maximum
    max_days = 90
    days_requested = (data.end_date - data.start_date).days + 1
    if days_requested > max_days:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot request assistance for more than {max_days} days"
        )

    # Generate dates for each day in the range
    request_dates = []
    current_date = data.start_date
    while current_date <= data.end_date:
        request_dates.append(current_date)
        current_date += timedelta(days=1)

    # Generate a series ID if multiple days
    series_id = None
    if len(request_dates) > 1:
        series_id = int(datetime.utcnow().timestamp())

    # Create service requests for each date
    created_requests = []
    for req_date in request_dates:
        special_instructions = f"Rehab assistance for {program.name}: cover all tasks for the day"

        if data.special_instructions:
            special_instructions += f"\n\nNotes: {data.special_instructions}"

        service_request = ServiceRequest(
            service_id=rehab_service.id,
            horse_id=data.horse_id,
            requested_by_id=current_user.id,
            requested_date=req_date,
            preferred_time=PreferredTime.ANY,
            special_instructions=special_instructions,
            status=RequestStatus.PENDING,
            charge_amount=None,
            rehab_program_id=data.rehab_program_id,
            recurring_pattern=RecurringPattern.DAILY if len(request_dates) > 1 else RecurringPattern.NONE,
            recurring_end_date=data.end_date if len(request_dates) > 1 else None,
            recurring_series_id=series_id,
        )
        db.add(service_request)
        created_requests.append(service_request)

    db.commit()

    # Refresh and enrich all created requests
    for req in created_requests:
        db.refresh(req)

    # Re-query with eager loading
    request_ids = [r.id for r in created_requests]
    enriched_requests = service_request_query(db).filter(
        ServiceRequest.id.in_(request_ids)
    ).all()

    return [enrich_service_request(r) for r in enriched_requests]


@router.delete("/requests/series/{series_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_recurring_series(
    series_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel all pending/scheduled requests in a recurring series."""
    requests = db.query(ServiceRequest).filter(
        ServiceRequest.recurring_series_id == series_id,
        ServiceRequest.status.in_([RequestStatus.PENDING, RequestStatus.APPROVED, RequestStatus.SCHEDULED])
    ).all()

    if not requests:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active requests found in this series")

    # Check authorization - must own the requests or be admin
    if requests[0].requested_by_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    for req in requests:
        req.status = RequestStatus.CANCELLED

    db.commit()


@router.get("/requests/{request_id}", response_model=ServiceRequestResponse)
def get_service_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific service request."""
    request = service_request_query(db).filter(ServiceRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    # Only owner or admin can view
    if request.requested_by_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    return enrich_service_request(request)


@router.put("/requests/{request_id}/quote", response_model=ServiceRequestResponse)
def quote_service_request(
    request_id: int,
    data: ServiceRequestQuote,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Provide a cost estimate for a pending service request (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can provide quotes")

    request = service_request_query(db).filter(ServiceRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    if request.status != RequestStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request is not pending")

    request.status = RequestStatus.QUOTED
    request.quote_amount = data.quote_amount
    request.quote_notes = data.quote_notes
    request.quoted_at = datetime.utcnow()
    request.quoted_by_id = current_user.id
    db.commit()
    db.refresh(request)

    return enrich_service_request(request)


@router.put("/requests/{request_id}/accept-quote", response_model=ServiceRequestResponse)
def accept_quote(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Accept a quoted service request (livery user or admin)."""
    request = service_request_query(db).filter(ServiceRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    # Only the requester or admin can accept
    if request.requested_by_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    if request.status != RequestStatus.QUOTED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request does not have a quote to accept")

    request.status = RequestStatus.APPROVED
    request.charge_amount = request.quote_amount  # Transfer quote to charge
    db.commit()
    db.refresh(request)

    return enrich_service_request(request)


@router.put("/requests/{request_id}/reject-quote", response_model=ServiceRequestResponse)
def reject_quote(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reject a quoted service request (livery user or admin)."""
    request = service_request_query(db).filter(ServiceRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    # Only the requester or admin can reject
    if request.requested_by_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    if request.status != RequestStatus.QUOTED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request does not have a quote to reject")

    request.status = RequestStatus.CANCELLED
    db.commit()
    db.refresh(request)

    return enrich_service_request(request)


@router.put("/requests/{request_id}/approve", response_model=ServiceRequestResponse)
def approve_service_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve a pending service request without quote (admin only, for non-billable services)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can approve requests")

    request = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    if request.status != RequestStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request is not pending")

    request.status = RequestStatus.APPROVED
    db.commit()
    db.refresh(request)

    return enrich_service_request(request)


@router.put("/requests/{request_id}/schedule", response_model=ServiceRequestResponse)
def schedule_service_request(
    request_id: int,
    data: ServiceRequestSchedule,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Schedule a service request (admin only).
    Creates a linked YardTask for the assigned staff member."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can schedule requests")

    request = service_request_query(db).filter(ServiceRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    if request.status not in [RequestStatus.PENDING, RequestStatus.APPROVED]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request cannot be scheduled")

    # Verify assigned user exists and is staff
    assigned_user = db.query(User).filter(User.id == data.assigned_to_id).first()
    if not assigned_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assigned user not found")
    if not assigned_user.is_yard_staff and assigned_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Can only assign to staff members")

    request.status = RequestStatus.SCHEDULED
    request.assigned_to_id = data.assigned_to_id
    request.scheduled_datetime = data.scheduled_datetime
    if data.notes:
        request.notes = data.notes

    # Create a linked YardTask for the assigned staff member
    from app.models.task import YardTask, TaskCategory, TaskPriority, TaskStatus, AssignmentType

    # Build task title and description from service request details
    service_name = request.service.name if request.service else "Service"
    horse_name = request.horse.name if request.horse else "Horse"
    task_title = f"{service_name} for {horse_name}"
    task_description = f"Livery service request from {request.requested_by.name if request.requested_by else 'client'}."
    if request.special_instructions:
        task_description += f"\n\nSpecial instructions: {request.special_instructions}"
    if data.notes:
        task_description += f"\n\nNotes: {data.notes}"

    yard_task = YardTask(
        title=task_title,
        description=task_description,
        category=TaskCategory.LIVERY_SERVICE,
        priority=TaskPriority.MEDIUM,
        reported_by_id=current_user.id,
        assignment_type=AssignmentType.SPECIFIC,
        assigned_to_id=data.assigned_to_id,
        scheduled_date=data.scheduled_datetime.date(),
        status=TaskStatus.OPEN,
        service_request_id=request_id,
    )
    db.add(yard_task)

    db.commit()
    db.refresh(request)

    return enrich_service_request(request)


@router.put("/requests/{request_id}/complete", response_model=ServiceRequestResponse)
def complete_service_request(
    request_id: int,
    data: ServiceRequestComplete,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Complete a service request (admin or assigned staff)."""
    request = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    # Check permission: admin can complete any, staff can complete their assigned requests
    is_admin = current_user.role == UserRole.ADMIN
    is_assigned_staff = has_staff_access(current_user) and request.assigned_to_id == current_user.id

    if not (is_admin or is_assigned_staff):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin or assigned staff can complete requests")

    if request.status != RequestStatus.SCHEDULED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request must be scheduled to complete")

    request.status = RequestStatus.COMPLETED
    request.completed_datetime = datetime.utcnow()
    request.completed_by_id = current_user.id

    if data.notes:
        request.notes = data.notes
    if data.charge_amount is not None:
        request.charge_amount = data.charge_amount
    request.charge_status = data.charge_status

    # Auto-set insurance_claimable from the service's default if not already set
    if request.service and request.service.is_insurance_claimable:
        request.insurance_claimable = True

    # Create ledger entry for the charge if there's a charge amount
    final_charge = data.charge_amount if data.charge_amount is not None else request.charge_amount
    if final_charge and final_charge > 0:
        # Build description
        service_name = request.service.name if request.service else "Service"
        horse_name = request.horse.name if request.horse else "Unknown"
        description = f"{service_name} for {horse_name}"
        if request.special_instructions:
            description += f" - {request.special_instructions[:50]}"

        ledger_entry = LedgerEntry(
            user_id=request.requested_by_id,
            transaction_type=TransactionType.SERVICE_CHARGE,
            amount=final_charge,
            description=description,
            service_request_id=request.id,
            created_by_id=current_user.id,
        )
        db.add(ledger_entry)

    db.commit()
    db.refresh(request)

    return enrich_service_request(request)


@router.put("/requests/{request_id}/cancel", response_model=ServiceRequestResponse)
def cancel_service_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel a service request."""
    request = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    # Only owner or admin can cancel
    if request.requested_by_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    if request.status in [RequestStatus.COMPLETED, RequestStatus.CANCELLED]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request cannot be cancelled")

    request.status = RequestStatus.CANCELLED
    db.commit()
    db.refresh(request)

    return enrich_service_request(request)


@router.delete("/requests/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a service request (only pending requests)."""
    request = db.query(ServiceRequest).filter(ServiceRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    # Only owner or admin can delete
    if request.requested_by_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Can only delete pending requests
    if request.status not in [RequestStatus.PENDING, RequestStatus.CANCELLED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending or cancelled requests can be deleted"
        )

    db.delete(request)
    db.commit()


# =====================
# Insurance Claim Endpoints
# =====================

@router.put("/requests/{request_id}/insurance", response_model=ServiceRequestResponse)
def toggle_insurance_claimable(
    request_id: int,
    data: InsuranceToggle,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Toggle the insurance_claimable flag on a service request."""
    request = service_request_query(db).filter(ServiceRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    # Only owner or admin can toggle
    if request.requested_by_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    request.insurance_claimable = data.insurance_claimable
    db.commit()
    db.refresh(request)

    return enrich_service_request(request)


@router.get("/requests/insurance/my-claims", response_model=List[ServiceRequestResponse])
def get_my_insurance_claims(
    horse_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all completed rehab services that could be insurance claimable.

    Returns:
    - All completed services where category is 'rehab'
    - Plus any other completed services already marked as insurance_claimable
    The frontend shows checkboxes based on the insurance_claimable flag.
    """
    from sqlalchemy import or_

    query = service_request_query(db).filter(
        ServiceRequest.requested_by_id == current_user.id,
        ServiceRequest.status == RequestStatus.COMPLETED,
        or_(
            Service.category == ServiceCategory.REHAB,
            ServiceRequest.insurance_claimable == True
        )
    )

    if horse_id:
        query = query.filter(ServiceRequest.horse_id == horse_id)
    if start_date:
        query = query.filter(ServiceRequest.requested_date >= start_date)
    if end_date:
        query = query.filter(ServiceRequest.requested_date <= end_date)

    requests = query.order_by(ServiceRequest.requested_date.desc()).all()
    return [enrich_service_request(r) for r in requests]


@router.get("/requests/insurance/statement", response_model=InsuranceStatement)
def generate_insurance_statement(
    horse_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate an insurance statement for completed claimable requests and livery charges."""
    from decimal import Decimal
    from sqlalchemy import func

    # Default date range: last 90 days
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=90)

    # 1. Get insurance-claimable service requests
    query = service_request_query(db).filter(
        ServiceRequest.requested_by_id == current_user.id,
        ServiceRequest.insurance_claimable == True,
        ServiceRequest.status == RequestStatus.COMPLETED,
        ServiceRequest.requested_date >= start_date,
        ServiceRequest.requested_date <= end_date
    )

    if horse_id:
        query = query.filter(ServiceRequest.horse_id == horse_id)
        horse = db.query(Horse).filter(Horse.id == horse_id).first()
        horse_name = horse.name if horse else None
    else:
        horse_name = None

    requests = query.order_by(ServiceRequest.requested_date.asc()).all()

    items = []
    total = Decimal("0.00")

    for req in requests:
        amount = req.charge_amount or Decimal("0.00")
        total += amount

        # Build description from special instructions or service category
        description = req.special_instructions or ""
        if req.rehab_program_id:
            description = f"Rehabilitation assistance - {description}" if description else "Rehabilitation assistance"

        items.append(InsuranceClaimItem(
            service_date=req.requested_date,
            service_name=req.service.name if req.service else "Service",
            horse_name=req.horse.name if req.horse else "Unknown",
            description=description[:200] if description else req.service.name if req.service else "Service",
            amount=amount,
            service_request_id=req.id,
            item_type="service"
        ))

    # 2. Get livery charges from insurance-claimable packages
    livery_query = db.query(LedgerEntry).join(
        LiveryPackage, LedgerEntry.livery_package_id == LiveryPackage.id
    ).filter(
        LedgerEntry.user_id == current_user.id,
        LedgerEntry.transaction_type == TransactionType.PACKAGE_CHARGE,
        LedgerEntry.amount > 0,  # Only charges, not credits
        LiveryPackage.is_insurance_claimable == True,
        func.date(LedgerEntry.transaction_date) >= start_date,
        func.date(LedgerEntry.transaction_date) <= end_date
    )

    if horse_id:
        # Get horses owned by user to filter by specific horse
        user_horses = db.query(Horse).filter(Horse.owner_id == current_user.id).all()
        horse_package_ids = [h.livery_package_id for h in user_horses if h.id == horse_id and h.livery_package_id]
        if horse_package_ids:
            livery_query = livery_query.filter(LedgerEntry.livery_package_id.in_(horse_package_ids))

    livery_entries = livery_query.order_by(LedgerEntry.transaction_date.asc()).all()

    for entry in livery_entries:
        amount = entry.amount
        total += amount

        # Determine horse name from the ledger entry description or package
        entry_horse_name = "Unknown"
        if horse_name:
            entry_horse_name = horse_name
        elif entry.livery_package:
            # Try to find horse with this package
            package_horse = db.query(Horse).filter(
                Horse.owner_id == current_user.id,
                Horse.livery_package_id == entry.livery_package_id
            ).first()
            if package_horse:
                entry_horse_name = package_horse.name

        # Use period dates if available
        service_date = entry.period_start.date() if entry.period_start else entry.transaction_date.date()

        items.append(InsuranceClaimItem(
            service_date=service_date,
            service_name="Livery - " + (entry.livery_package.name if entry.livery_package else "Package"),
            horse_name=entry_horse_name,
            description=entry.description[:200] if entry.description else "Livery charges",
            amount=amount,
            ledger_entry_id=entry.id,
            item_type="livery"
        ))

    # Sort all items by date
    items.sort(key=lambda x: x.service_date)

    return InsuranceStatement(
        statement_date=date.today(),
        period_start=start_date,
        period_end=end_date,
        horse_id=horse_id,
        horse_name=horse_name,
        owner_name=current_user.name,
        owner_email=current_user.email,
        items=items,
        total_amount=total,
        item_count=len(items)
    )


@router.get("/requests/insurance/statement/pdf")
def download_insurance_statement_pdf(
    horse_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate and download an insurance statement PDF."""
    from decimal import Decimal
    from sqlalchemy import func

    # Default date range: last 90 days
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=90)

    items = []
    total = Decimal("0.00")

    # 1. Get completed service requests marked as insurance claimable
    query = service_request_query(db).filter(
        ServiceRequest.requested_by_id == current_user.id,
        ServiceRequest.insurance_claimable == True,
        ServiceRequest.status == RequestStatus.COMPLETED,
        ServiceRequest.requested_date >= start_date,
        ServiceRequest.requested_date <= end_date
    )

    if horse_id:
        query = query.filter(ServiceRequest.horse_id == horse_id)
        horse = db.query(Horse).filter(Horse.id == horse_id).first()
        horse_name = horse.name if horse else None
    else:
        horse_name = None

    requests = query.order_by(ServiceRequest.requested_date.asc()).all()

    for req in requests:
        amount = req.charge_amount or Decimal("0.00")
        total += amount

        # Build description from special instructions or service category
        description = req.special_instructions or ""
        if req.rehab_program_id:
            description = f"Rehabilitation assistance - {description}" if description else "Rehabilitation assistance"

        items.append({
            'service_date': req.requested_date,
            'service_name': req.service.name if req.service else "Service",
            'horse_name': req.horse.name if req.horse else "Unknown",
            'description': description[:200] if description else req.service.name if req.service else "Service",
            'amount': amount
        })

    # 2. Get livery charges from insurance-claimable packages
    livery_query = db.query(LedgerEntry).join(
        LiveryPackage, LedgerEntry.livery_package_id == LiveryPackage.id
    ).filter(
        LedgerEntry.user_id == current_user.id,
        LedgerEntry.transaction_type == TransactionType.PACKAGE_CHARGE,
        LedgerEntry.amount > 0,  # Only charges, not credits
        LiveryPackage.is_insurance_claimable == True,
        func.date(LedgerEntry.transaction_date) >= start_date,
        func.date(LedgerEntry.transaction_date) <= end_date
    )

    if horse_id:
        # Get horses owned by user to filter by specific horse
        user_horses = db.query(Horse).filter(Horse.owner_id == current_user.id).all()
        horse_package_ids = [h.livery_package_id for h in user_horses if h.id == horse_id and h.livery_package_id]
        if horse_package_ids:
            livery_query = livery_query.filter(LedgerEntry.livery_package_id.in_(horse_package_ids))

    livery_entries = livery_query.order_by(LedgerEntry.transaction_date.asc()).all()

    for entry in livery_entries:
        amount = entry.amount
        total += amount

        # Determine horse name from the ledger entry description or package
        entry_horse_name = "Unknown"
        if horse_name:
            entry_horse_name = horse_name
        elif entry.livery_package:
            # Try to find horse with this package
            package_horse = db.query(Horse).filter(
                Horse.owner_id == current_user.id,
                Horse.livery_package_id == entry.livery_package_id
            ).first()
            if package_horse:
                entry_horse_name = package_horse.name

        # Use period dates if available
        service_date = entry.period_start.date() if entry.period_start else entry.transaction_date.date()

        items.append({
            'service_date': service_date,
            'service_name': "Livery - " + (entry.livery_package.name if entry.livery_package else "Package"),
            'horse_name': entry_horse_name,
            'description': entry.description[:200] if entry.description else "Livery charges",
            'amount': amount
        })

    if not items:
        raise HTTPException(
            status_code=404,
            detail="No insurance-claimable services found for the selected period"
        )

    # Sort all items by date
    items.sort(key=lambda x: x['service_date'])

    # Get venue settings
    settings = db.query(SiteSettings).first()
    venue_name = settings.venue_name if settings else "Equestrian Venue"
    venue_phone = settings.contact_phone if settings else ""
    venue_email = settings.contact_email if settings else ""

    # Build venue address
    if settings:
        address_parts = []
        if settings.address_street:
            address_parts.append(settings.address_street)
        if settings.address_town:
            address_parts.append(settings.address_town)
        if settings.address_county:
            address_parts.append(settings.address_county)
        if settings.address_postcode:
            address_parts.append(settings.address_postcode)
        venue_address = "\n".join(address_parts)
    else:
        venue_address = ""

    # Generate statement number based on month
    statement_number = f"INS-{start_date.strftime('%Y%m')}-{current_user.id}"

    # Generate PDF
    pdf_bytes = generate_insurance_statement_pdf(
        statement_number=statement_number,
        statement_date=date.today(),
        period_start=start_date,
        period_end=end_date,
        customer_name=current_user.name,
        customer_email=current_user.email,
        horse_name=horse_name,
        line_items=items,
        total_amount=total,
        venue_name=venue_name,
        venue_address=venue_address,
        venue_phone=venue_phone,
        venue_email=venue_email
    )

    # Return PDF response
    filename = f"insurance-statement-{start_date.strftime('%Y-%m')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

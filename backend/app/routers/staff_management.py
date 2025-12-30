import logging
from typing import Optional
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

logger = logging.getLogger(__name__)

from app.database import get_db
from app.models.staff_management import (
    Shift, Timesheet, HolidayRequest, UnplannedAbsence,
    ShiftType, ShiftRole, WorkType, TimesheetStatus, LeaveType, LeaveStatus
)
from app.models.user import User, UserRole, StaffType
from app.utils.auth import has_staff_access
from app.schemas.staff_management import (
    ShiftCreate, ShiftUpdate, ShiftResponse, ShiftsListResponse,
    TimesheetCreate, TimesheetUpdate, TimesheetResponse, TimesheetsListResponse,
    AdminTimesheetCreate,
    HolidayRequestCreate, HolidayRequestUpdate, HolidayRequestResponse, HolidayRequestsListResponse,
    UnplannedAbsenceCreate, UnplannedAbsenceUpdate, UnplannedAbsenceResponse, UnplannedAbsenceListResponse,
    StaffSummary, ManagerDashboard, StaffManagementEnums, EnumInfo,
    StaffLeaveSummary, AllStaffLeaveSummary
)
from app.utils.auth import get_current_user

router = APIRouter()


# Label mappings
SHIFT_TYPE_LABELS = {
    ShiftType.MORNING: "Morning",
    ShiftType.AFTERNOON: "Afternoon",
    ShiftType.FULL_DAY: "Full Day",
}

SHIFT_ROLE_LABELS = {
    ShiftRole.YARD_DUTIES: "Yard Duties",
    ShiftRole.OFFICE: "Office",
    ShiftRole.EVENTS: "Events",
    ShiftRole.TEACHING: "Teaching",
    ShiftRole.MAINTENANCE: "Maintenance",
    ShiftRole.OTHER: "Other",
}

WORK_TYPE_LABELS = {
    WorkType.YARD_DUTIES: "Yard Duties",
    WorkType.YARD_MAINTENANCE: "Yard Maintenance",
    WorkType.OFFICE: "Office Work",
    WorkType.EVENTS: "Events",
    WorkType.OTHER: "Other",
}

TIMESHEET_STATUS_LABELS = {
    TimesheetStatus.DRAFT: "Draft",
    TimesheetStatus.SUBMITTED: "Submitted",
    TimesheetStatus.APPROVED: "Approved",
    TimesheetStatus.REJECTED: "Rejected",
}

LEAVE_TYPE_LABELS = {
    LeaveType.ANNUAL: "Annual Leave",
    LeaveType.UNPAID: "Unpaid Leave",
    LeaveType.TOIL: "Time Off In Lieu",
    LeaveType.EXTENDED: "Extended Leave",
}

LEAVE_STATUS_LABELS = {
    LeaveStatus.PENDING: "Pending",
    LeaveStatus.APPROVED: "Approved",
    LeaveStatus.REJECTED: "Rejected",
    LeaveStatus.CANCELLED: "Cancelled",
}

STAFF_TYPE_LABELS = {
    StaffType.REGULAR: "Regular Staff",
    StaffType.CASUAL: "Casual/Zero Hours",
    StaffType.ON_CALL: "On-Call Only",
}


def require_staff(current_user: User):
    """Require user to have yard staff access (admin or is_yard_staff flag)."""
    if not has_staff_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yard staff access required"
        )


def require_manager(current_user: User):
    """Require user to be admin."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager access required"
        )


def calculate_hours(clock_in, clock_out, break_minutes: int = 0) -> float:
    """Calculate total hours worked."""
    if not clock_out:
        return 0.0
    # Convert times to datetime for calculation
    base_date = date.today()
    dt_in = datetime.combine(base_date, clock_in)
    dt_out = datetime.combine(base_date, clock_out)
    # Handle overnight shifts
    if dt_out < dt_in:
        dt_out += timedelta(days=1)
    total_minutes = (dt_out - dt_in).total_seconds() / 60 - break_minutes
    return round(total_minutes / 60, 2)


def enrich_shift(shift: Shift) -> dict:
    """Add computed fields to shift response."""
    return {
        "id": shift.id,
        "staff_id": shift.staff_id,
        "date": shift.date,
        "shift_type": shift.shift_type,
        "role": shift.role,
        "notes": shift.notes,
        "created_by_id": shift.created_by_id,
        "created_at": shift.created_at,
        "updated_at": shift.updated_at,
        "staff_name": shift.staff.name if shift.staff else None,
        "created_by_name": shift.created_by.name if shift.created_by else None,
    }


def enrich_timesheet(timesheet: Timesheet) -> dict:
    """Add computed fields to timesheet response."""
    # Calculate lunch duration if both times are set
    lunch_minutes = 0
    if timesheet.lunch_start and timesheet.lunch_end:
        lunch_dt = datetime.combine(date.today(), timesheet.lunch_end) - datetime.combine(date.today(), timesheet.lunch_start)
        lunch_minutes = int(lunch_dt.total_seconds() / 60)

    total_break = timesheet.break_minutes + lunch_minutes

    return {
        "id": timesheet.id,
        "staff_id": timesheet.staff_id,
        "date": timesheet.date,
        "clock_in": timesheet.clock_in,
        "clock_out": timesheet.clock_out,
        "lunch_start": timesheet.lunch_start,
        "lunch_end": timesheet.lunch_end,
        "break_minutes": timesheet.break_minutes,
        "work_type": timesheet.work_type,
        "notes": timesheet.notes,
        "logged_by_id": timesheet.logged_by_id,
        "status": timesheet.status,
        "submitted_at": timesheet.submitted_at,
        "approved_by_id": timesheet.approved_by_id,
        "approved_at": timesheet.approved_at,
        "rejection_reason": timesheet.rejection_reason,
        "created_at": timesheet.created_at,
        "updated_at": timesheet.updated_at,
        "staff_name": timesheet.staff.name if timesheet.staff else None,
        "logged_by_name": timesheet.logged_by.name if timesheet.logged_by else None,
        "approved_by_name": timesheet.approved_by.name if timesheet.approved_by else None,
        "total_hours": calculate_hours(timesheet.clock_in, timesheet.clock_out, total_break),
    }


def enrich_holiday(request: HolidayRequest) -> dict:
    """Add computed fields to holiday request response."""
    return {
        "id": request.id,
        "staff_id": request.staff_id,
        "start_date": request.start_date,
        "end_date": request.end_date,
        "leave_type": request.leave_type,
        "days_requested": request.days_requested,
        "reason": request.reason,
        "status": request.status,
        "approved_by_id": request.approved_by_id,
        "approval_date": request.approval_date,
        "approval_notes": request.approval_notes,
        "created_at": request.created_at,
        "updated_at": request.updated_at,
        "staff_name": request.staff.name if request.staff else None,
        "approved_by_name": request.approved_by.name if request.approved_by else None,
    }


def enrich_unplanned_absence(record: UnplannedAbsence) -> dict:
    """Add computed fields to unplanned absence response."""
    return {
        "id": record.id,
        "staff_id": record.staff_id,
        "date": record.date,
        "reported_time": record.reported_time,
        "reported_to_id": record.reported_to_id,
        "reason": record.reason,
        "expected_return": record.expected_return,
        "actual_return": record.actual_return,
        "notes": record.notes,
        "has_fit_note": record.has_fit_note,
        "fit_note_start": record.fit_note_start,
        "fit_note_end": record.fit_note_end,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
        "staff_name": record.staff.name if record.staff else None,
        "reported_to_name": record.reported_to.name if record.reported_to else None,
    }


# ============== Enum Routes ==============

@router.get("/enums", response_model=StaffManagementEnums)
def get_enums():
    """Get enum options for forms."""
    return StaffManagementEnums(
        shift_types=[
            EnumInfo(value=t.value, label=SHIFT_TYPE_LABELS.get(t, t.value.title()))
            for t in ShiftType
        ],
        shift_roles=[
            EnumInfo(value=r.value, label=SHIFT_ROLE_LABELS.get(r, r.value.title()))
            for r in ShiftRole
        ],
        work_types=[
            EnumInfo(value=w.value, label=WORK_TYPE_LABELS.get(w, w.value.title()))
            for w in WorkType
        ],
        timesheet_statuses=[
            EnumInfo(value=s.value, label=TIMESHEET_STATUS_LABELS.get(s, s.value.title()))
            for s in TimesheetStatus
        ],
        leave_types=[
            EnumInfo(value=t.value, label=LEAVE_TYPE_LABELS.get(t, t.value.title()))
            for t in LeaveType
        ],
        leave_statuses=[
            EnumInfo(value=s.value, label=LEAVE_STATUS_LABELS.get(s, s.value.title()))
            for s in LeaveStatus
        ],
        staff_types=[
            EnumInfo(value=t.value, label=STAFF_TYPE_LABELS.get(t, t.value.title()))
            for t in StaffType
        ],
    )


# ============== Dashboard Routes ==============

@router.get("/dashboard", response_model=ManagerDashboard)
def get_manager_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get manager dashboard summary."""
    require_manager(current_user)
    today = date.today()

    pending_timesheets = db.query(Timesheet).filter(
        Timesheet.status == TimesheetStatus.SUBMITTED
    ).count()

    pending_holidays = db.query(HolidayRequest).filter(
        HolidayRequest.status == LeaveStatus.PENDING
    ).count()

    # Staff on approved leave today
    staff_on_leave = db.query(HolidayRequest).filter(
        HolidayRequest.status == LeaveStatus.APPROVED,
        HolidayRequest.start_date <= today,
        HolidayRequest.end_date >= today
    ).count()

    # Staff with unplanned absence today (no actual return date yet)
    staff_absent = db.query(UnplannedAbsence).filter(
        UnplannedAbsence.date <= today,
        UnplannedAbsence.actual_return.is_(None)
    ).count()

    shifts_today = db.query(Shift).filter(Shift.date == today).count()

    return ManagerDashboard(
        pending_timesheets=pending_timesheets,
        pending_holiday_requests=pending_holidays,
        staff_on_leave_today=staff_on_leave,
        staff_absent_today=staff_absent,
        shifts_today=shifts_today,
    )


# ============== Shift Routes ==============

@router.get("/shifts", response_model=ShiftsListResponse)
def list_shifts(
    staff_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List shifts (staff see own, managers see all)."""
    logger.info(f"list_shifts called: staff_id={staff_id}, start_date={start_date}, end_date={end_date}, user={current_user.username}")
    require_staff(current_user)

    query = db.query(Shift).options(
        joinedload(Shift.staff),
        joinedload(Shift.created_by)
    )

    # Filter by staff_id if provided (admin can see all)
    if staff_id:
        query = query.filter(Shift.staff_id == staff_id)

    if start_date:
        query = query.filter(Shift.date >= start_date)
    if end_date:
        query = query.filter(Shift.date <= end_date)

    shifts = query.order_by(Shift.date, Shift.shift_type).all()
    logger.info(f"list_shifts returning {len(shifts)} shifts")

    return ShiftsListResponse(
        shifts=[enrich_shift(s) for s in shifts],
        total=len(shifts)
    )


@router.post("/shifts", response_model=ShiftResponse, status_code=status.HTTP_201_CREATED)
def create_shift(
    data: ShiftCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a shift (manager only)."""
    require_manager(current_user)

    shift = Shift(
        **data.model_dump(),
        created_by_id=current_user.id
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)

    return enrich_shift(shift)


@router.put("/shifts/{shift_id}", response_model=ShiftResponse)
def update_shift(
    shift_id: int,
    data: ShiftUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a shift (manager only)."""
    require_manager(current_user)

    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(shift, field, value)

    db.commit()
    db.refresh(shift)

    return enrich_shift(shift)


@router.delete("/shifts/{shift_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shift(
    shift_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a shift (manager only)."""
    require_manager(current_user)

    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    db.delete(shift)
    db.commit()


# ============== Timesheet Routes ==============

@router.get("/timesheets", response_model=TimesheetsListResponse)
def list_timesheets(
    staff_id: Optional[int] = None,
    status_filter: Optional[TimesheetStatus] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List timesheets (staff see own, admin sees all)."""
    require_staff(current_user)

    query = db.query(Timesheet).options(
        joinedload(Timesheet.staff),
        joinedload(Timesheet.approved_by)
    )

    # Non-admin staff can only see their own timesheets, admin can see all
    if current_user.role != UserRole.ADMIN:
        query = query.filter(Timesheet.staff_id == current_user.id)
    elif staff_id:
        # Admin filtering by specific staff member
        query = query.filter(Timesheet.staff_id == staff_id)

    if status_filter:
        query = query.filter(Timesheet.status == status_filter)
    if start_date:
        query = query.filter(Timesheet.date >= start_date)
    if end_date:
        query = query.filter(Timesheet.date <= end_date)

    timesheets = query.order_by(Timesheet.date.desc()).all()

    return TimesheetsListResponse(
        timesheets=[enrich_timesheet(t) for t in timesheets],
        total=len(timesheets)
    )


@router.post("/timesheets", response_model=TimesheetResponse, status_code=status.HTTP_201_CREATED)
def create_timesheet(
    data: TimesheetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a timesheet entry (staff creates their own)."""
    require_staff(current_user)

    timesheet = Timesheet(
        **data.model_dump(),
        staff_id=current_user.id,
        status=TimesheetStatus.DRAFT
    )
    db.add(timesheet)
    db.commit()
    db.refresh(timesheet)

    return enrich_timesheet(timesheet)


@router.put("/timesheets/{timesheet_id}", response_model=TimesheetResponse)
def update_timesheet(
    timesheet_id: int,
    data: TimesheetUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a timesheet (own draft only)."""
    require_staff(current_user)

    timesheet = db.query(Timesheet).filter(Timesheet.id == timesheet_id).first()
    if not timesheet:
        raise HTTPException(status_code=404, detail="Timesheet not found")

    # Only own timesheets in draft or rejected status
    if timesheet.staff_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot edit others' timesheets")
    if timesheet.status not in [TimesheetStatus.DRAFT, TimesheetStatus.REJECTED]:
        raise HTTPException(status_code=400, detail="Can only edit draft or rejected timesheets")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(timesheet, field, value)

    # If editing a rejected timesheet, reset to draft for resubmission
    if timesheet.status == TimesheetStatus.REJECTED:
        timesheet.status = TimesheetStatus.DRAFT
        timesheet.rejection_reason = None

    db.commit()
    db.refresh(timesheet)

    return enrich_timesheet(timesheet)


@router.put("/timesheets/{timesheet_id}/submit", response_model=TimesheetResponse)
def submit_timesheet(
    timesheet_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit a timesheet for approval."""
    require_staff(current_user)

    timesheet = db.query(Timesheet).filter(Timesheet.id == timesheet_id).first()
    if not timesheet:
        raise HTTPException(status_code=404, detail="Timesheet not found")

    if timesheet.staff_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot submit others' timesheets")
    if timesheet.status != TimesheetStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Can only submit draft timesheets")
    if not timesheet.clock_out:
        raise HTTPException(status_code=400, detail="Must clock out before submitting")

    timesheet.status = TimesheetStatus.SUBMITTED
    timesheet.submitted_at = datetime.utcnow()
    db.commit()
    db.refresh(timesheet)

    return enrich_timesheet(timesheet)


@router.put("/timesheets/{timesheet_id}/approve", response_model=TimesheetResponse)
def approve_timesheet(
    timesheet_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve a submitted timesheet (manager only)."""
    require_manager(current_user)

    timesheet = db.query(Timesheet).filter(Timesheet.id == timesheet_id).first()
    if not timesheet:
        raise HTTPException(status_code=404, detail="Timesheet not found")

    if timesheet.status != TimesheetStatus.SUBMITTED:
        raise HTTPException(status_code=400, detail="Can only approve submitted timesheets")

    timesheet.status = TimesheetStatus.APPROVED
    timesheet.approved_by_id = current_user.id
    timesheet.approved_at = datetime.utcnow()
    db.commit()
    db.refresh(timesheet)

    return enrich_timesheet(timesheet)


@router.put("/timesheets/{timesheet_id}/reject", response_model=TimesheetResponse)
def reject_timesheet(
    timesheet_id: int,
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reject a submitted timesheet (manager only)."""
    require_manager(current_user)

    timesheet = db.query(Timesheet).filter(Timesheet.id == timesheet_id).first()
    if not timesheet:
        raise HTTPException(status_code=404, detail="Timesheet not found")

    if timesheet.status != TimesheetStatus.SUBMITTED:
        raise HTTPException(status_code=400, detail="Can only reject submitted timesheets")

    timesheet.status = TimesheetStatus.REJECTED
    timesheet.approved_by_id = current_user.id
    timesheet.approved_at = datetime.utcnow()
    timesheet.rejection_reason = reason
    db.commit()
    db.refresh(timesheet)

    return enrich_timesheet(timesheet)


@router.post("/timesheets/admin", response_model=TimesheetResponse, status_code=status.HTTP_201_CREATED)
def admin_create_timesheet(
    data: AdminTimesheetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin can create timesheet entries for staff who forgot to log their hours."""
    require_manager(current_user)

    # Verify the staff member exists and is yard staff
    staff = db.query(User).filter(User.id == data.staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    if not has_staff_access(staff):
        raise HTTPException(status_code=400, detail="User is not a staff member")

    timesheet = Timesheet(
        staff_id=data.staff_id,
        date=data.date,
        clock_in=data.clock_in,
        clock_out=data.clock_out,
        lunch_start=data.lunch_start,
        lunch_end=data.lunch_end,
        break_minutes=data.break_minutes,
        work_type=data.work_type,
        notes=data.notes,
        logged_by_id=current_user.id,  # Track who logged this
        status=TimesheetStatus.SUBMITTED,  # Admin-created entries go straight to submitted
        submitted_at=datetime.utcnow(),
    )
    db.add(timesheet)
    db.commit()
    db.refresh(timesheet)

    return enrich_timesheet(timesheet)


# ============== Holiday Request Routes ==============

@router.get("/holidays", response_model=HolidayRequestsListResponse)
def list_holiday_requests(
    staff_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List holiday requests (staff see own, admin sees all)."""
    require_staff(current_user)

    query = db.query(HolidayRequest).options(
        joinedload(HolidayRequest.staff),
        joinedload(HolidayRequest.approved_by)
    )

    # Non-admin staff can only see their own holiday requests, admin can see all
    if current_user.role != UserRole.ADMIN:
        query = query.filter(HolidayRequest.staff_id == current_user.id)
    elif staff_id:
        # Admin filtering by specific staff member
        query = query.filter(HolidayRequest.staff_id == staff_id)

    pending = query.filter(HolidayRequest.status == LeaveStatus.PENDING).order_by(
        HolidayRequest.start_date
    ).all()

    approved = query.filter(HolidayRequest.status == LeaveStatus.APPROVED).order_by(
        HolidayRequest.start_date.desc()
    ).limit(20).all()

    rejected = query.filter(HolidayRequest.status == LeaveStatus.REJECTED).order_by(
        HolidayRequest.created_at.desc()
    ).limit(10).all()

    return HolidayRequestsListResponse(
        pending=[enrich_holiday(r) for r in pending],
        approved=[enrich_holiday(r) for r in approved],
        rejected=[enrich_holiday(r) for r in rejected],
    )


@router.post("/holidays", response_model=HolidayRequestResponse, status_code=status.HTTP_201_CREATED)
def create_holiday_request(
    data: HolidayRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a holiday request."""
    require_staff(current_user)

    request = HolidayRequest(
        **data.model_dump(),
        staff_id=current_user.id,
        status=LeaveStatus.PENDING
    )
    db.add(request)
    db.commit()
    db.refresh(request)

    return enrich_holiday(request)


@router.put("/holidays/{request_id}", response_model=HolidayRequestResponse)
def update_holiday_request(
    request_id: int,
    data: HolidayRequestUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a pending holiday request (own only)."""
    require_staff(current_user)

    request = db.query(HolidayRequest).filter(HolidayRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Holiday request not found")

    if request.staff_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot edit others' requests")
    if request.status != LeaveStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only edit pending requests")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(request, field, value)

    db.commit()
    db.refresh(request)

    return enrich_holiday(request)


@router.put("/holidays/{request_id}/approve", response_model=HolidayRequestResponse)
def approve_holiday_request(
    request_id: int,
    notes: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve a holiday request (manager only)."""
    require_manager(current_user)

    request = db.query(HolidayRequest).filter(HolidayRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Holiday request not found")

    if request.status != LeaveStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only approve pending requests")

    request.status = LeaveStatus.APPROVED
    request.approved_by_id = current_user.id
    request.approval_date = datetime.utcnow()
    request.approval_notes = notes
    db.commit()
    db.refresh(request)

    return enrich_holiday(request)


@router.put("/holidays/{request_id}/reject", response_model=HolidayRequestResponse)
def reject_holiday_request(
    request_id: int,
    notes: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reject a holiday request (manager only)."""
    require_manager(current_user)

    request = db.query(HolidayRequest).filter(HolidayRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Holiday request not found")

    if request.status != LeaveStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only reject pending requests")

    request.status = LeaveStatus.REJECTED
    request.approved_by_id = current_user.id
    request.approval_date = datetime.utcnow()
    request.approval_notes = notes
    db.commit()
    db.refresh(request)

    return enrich_holiday(request)


@router.delete("/holidays/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_holiday_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel a holiday request (own pending only, or manager can cancel any)."""
    require_staff(current_user)

    request = db.query(HolidayRequest).filter(HolidayRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Holiday request not found")

    is_own = request.staff_id == current_user.id

    if not is_own:
        raise HTTPException(status_code=403, detail="Cannot cancel others' requests")

    if request.status != LeaveStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only cancel pending requests")

    request.status = LeaveStatus.CANCELLED
    db.commit()


# ============== Unplanned Absence Routes ==============

@router.get("/absences", response_model=UnplannedAbsenceListResponse)
def list_unplanned_absences(
    staff_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List unplanned absence records (staff see own, admin sees all)."""
    require_staff(current_user)

    query = db.query(UnplannedAbsence).options(
        joinedload(UnplannedAbsence.staff),
        joinedload(UnplannedAbsence.reported_to)
    )

    # Non-admin staff can only see their own absence records, admin can see all
    if current_user.role != UserRole.ADMIN:
        query = query.filter(UnplannedAbsence.staff_id == current_user.id)
    elif staff_id:
        # Admin filtering by specific staff member
        query = query.filter(UnplannedAbsence.staff_id == staff_id)

    if start_date:
        query = query.filter(UnplannedAbsence.date >= start_date)
    if end_date:
        query = query.filter(UnplannedAbsence.date <= end_date)

    records = query.order_by(UnplannedAbsence.date.desc()).all()

    return UnplannedAbsenceListResponse(
        records=[enrich_unplanned_absence(r) for r in records],
        total=len(records)
    )


@router.post("/absences", response_model=UnplannedAbsenceResponse, status_code=status.HTTP_201_CREATED)
def record_unplanned_absence(
    data: UnplannedAbsenceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Record unplanned absence (admin only - after phone call or other comms from staff)."""
    require_manager(current_user)

    record = UnplannedAbsence(
        **data.model_dump(),
        reported_to_id=current_user.id
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return enrich_unplanned_absence(record)


@router.put("/absences/{record_id}", response_model=UnplannedAbsenceResponse)
def update_unplanned_absence(
    record_id: int,
    data: UnplannedAbsenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an unplanned absence record (admin only)."""
    require_manager(current_user)

    record = db.query(UnplannedAbsence).filter(UnplannedAbsence.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Unplanned absence record not found")

    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)

    return enrich_unplanned_absence(record)


# ============== Staff Leave Summary (viewable by all staff) ==============

@router.get("/leave-summary", response_model=AllStaffLeaveSummary)
def get_all_staff_leave_summary(
    year: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get leave summary for all staff - viewable by staff and admin."""
    require_staff(current_user)

    if year is None:
        year = date.today().year

    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)

    # Get all users with yard staff access (admin or is_yard_staff flag)
    staff_users = db.query(User).filter(
        (User.role == UserRole.ADMIN) | (User.is_yard_staff == True),
        User.is_active == True
    ).all()

    summaries = []
    for user in staff_users:
        # Calculate annual leave taken (approved holiday requests this year)
        annual_leave_taken = db.query(func.coalesce(func.sum(HolidayRequest.days_requested), 0)).filter(
            HolidayRequest.staff_id == user.id,
            HolidayRequest.status == LeaveStatus.APPROVED,
            HolidayRequest.leave_type == LeaveType.ANNUAL,
            HolidayRequest.start_date >= year_start,
            HolidayRequest.start_date <= year_end
        ).scalar() or 0

        # Calculate pending annual leave requests
        annual_leave_pending = db.query(func.coalesce(func.sum(HolidayRequest.days_requested), 0)).filter(
            HolidayRequest.staff_id == user.id,
            HolidayRequest.status == LeaveStatus.PENDING,
            HolidayRequest.leave_type == LeaveType.ANNUAL,
            HolidayRequest.start_date >= year_start,
            HolidayRequest.start_date <= year_end
        ).scalar() or 0

        # Count unplanned absences this year
        unplanned_absences = db.query(UnplannedAbsence).filter(
            UnplannedAbsence.staff_id == user.id,
            UnplannedAbsence.date >= year_start,
            UnplannedAbsence.date <= year_end
        ).count()

        # Determine entitlement based on staff type
        # Casual and on-call staff typically don't have annual leave entitlement
        staff_type = user.staff_type.value if user.staff_type else "regular"
        is_regular = user.staff_type in [None, StaffType.REGULAR]

        if is_regular:
            entitlement = user.annual_leave_entitlement or 28
            remaining = float(entitlement - float(annual_leave_taken))
        else:
            # Casual/on-call staff - no fixed entitlement
            entitlement = None
            remaining = None

        summaries.append(StaffLeaveSummary(
            staff_id=user.id,
            staff_name=user.name,
            staff_type=staff_type,
            annual_leave_entitlement=entitlement,
            annual_leave_taken=float(annual_leave_taken),
            annual_leave_remaining=remaining,
            annual_leave_pending=float(annual_leave_pending),
            unplanned_absences_this_year=unplanned_absences
        ))

    return AllStaffLeaveSummary(
        year=year,
        staff_summaries=summaries
    )

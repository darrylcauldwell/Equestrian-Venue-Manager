import logging
from typing import Optional
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_

logger = logging.getLogger(__name__)

from calendar import monthrange
from app.database import get_db
from app.models.staff_management import (
    Shift, Timesheet, HolidayRequest, UnplannedAbsence, PayrollAdjustment, StaffThanks, StaffDayStatus,
    ShiftType, ShiftRole, WorkType, TimesheetStatus, LeaveType, LeaveStatus, PayrollAdjustmentType, DayStatusType
)
from app.models.staff_profile import StaffProfile, HourlyRateHistory
from app.models.user import User, UserRole, StaffType
from app.models.settings import SiteSettings
from app.utils.auth import has_staff_access
from app.schemas.staff_management import (
    ShiftCreate, ShiftUpdate, ShiftResponse, ShiftsListResponse,
    TimesheetCreate, TimesheetUpdate, TimesheetResponse, TimesheetsListResponse,
    AdminTimesheetCreate,
    HolidayRequestCreate, HolidayRequestUpdate, HolidayRequestResponse, HolidayRequestsListResponse,
    UnplannedAbsenceCreate, UnplannedAbsenceUpdate, UnplannedAbsenceResponse, UnplannedAbsenceListResponse,
    StaffSummary, ManagerDashboard, StaffManagementEnums, EnumInfo,
    StaffLeaveSummary, AllStaffLeaveSummary,
    PayrollAdjustmentCreate, PayrollAdjustmentResponse, PayrollAdjustmentListResponse,
    PayrollAdjustmentSummary, StaffPayrollPeriod, PayrollSummaryResponse,
    StaffThanksCreate, StaffThanksResponse, StaffThanksListResponse, StaffThanksUnreadCount,
    DayStatusCreate, DayStatusResponse, DayStatusListResponse
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

DAY_STATUS_LABELS = {
    DayStatusType.UNAVAILABLE: "Unavailable",
    DayStatusType.ABSENT: "Day Off",  # Ad-hoc day off from manager
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
    # Convert times to datetime for calculation, truncating seconds
    base_date = date.today()
    dt_in = datetime.combine(base_date, clock_in.replace(second=0, microsecond=0))
    dt_out = datetime.combine(base_date, clock_out.replace(second=0, microsecond=0))
    # Handle overnight shifts
    if dt_out < dt_in:
        dt_out += timedelta(days=1)
    total_minutes = (dt_out - dt_in).total_seconds() / 60 - break_minutes
    return round(total_minutes / 60, 2)


def get_rate_for_date(db: Session, staff_id: int, work_date: date) -> float:
    """Get the hourly rate that was effective on a given date.

    Looks up the rate history to find the most recent rate that was
    effective on or before the work date.
    """
    rate_entry = db.query(HourlyRateHistory).filter(
        HourlyRateHistory.staff_id == staff_id,
        HourlyRateHistory.effective_date <= work_date
    ).order_by(HourlyRateHistory.effective_date.desc()).first()

    if rate_entry:
        return float(rate_entry.hourly_rate)

    # Fallback to current profile rate if no history exists
    profile = db.query(StaffProfile).filter(StaffProfile.user_id == staff_id).first()
    if profile and profile.hourly_rate:
        return float(profile.hourly_rate)

    return 0.0


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
        lunch_start = timesheet.lunch_start.replace(second=0, microsecond=0)
        lunch_end = timesheet.lunch_end.replace(second=0, microsecond=0)
        lunch_dt = datetime.combine(date.today(), lunch_end) - datetime.combine(date.today(), lunch_start)
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
        day_status_types=[
            EnumInfo(value=d.value, label=DAY_STATUS_LABELS.get(d, d.value.title()))
            for d in DayStatusType
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

    # Staff with unplanned absence today (no actual return date yet,
    # and expected return hasn't passed)
    staff_absent = db.query(UnplannedAbsence).filter(
        UnplannedAbsence.date <= today,
        UnplannedAbsence.actual_return.is_(None),
        or_(
            UnplannedAbsence.expected_return.is_(None),
            UnplannedAbsence.expected_return > today
        )
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
    """Create a holiday request. Admin can create for any staff member and auto-approve."""
    require_staff(current_user)

    # Determine staff_id and status based on user role
    is_admin = current_user.role in ["admin", "coach"]

    if data.staff_id and is_admin:
        # Admin creating leave for a staff member - verify staff exists
        staff = db.query(User).filter(User.id == data.staff_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff member not found")
        target_staff_id = data.staff_id
        # Admin-created leave is auto-approved
        leave_status = LeaveStatus.APPROVED
        approved_by_id = current_user.id
        approval_date = datetime.utcnow()
    else:
        # Staff creating their own request
        target_staff_id = current_user.id
        leave_status = LeaveStatus.PENDING
        approved_by_id = None
        approval_date = None

    # Create the request (exclude staff_id from data as we set it manually)
    request_data = data.model_dump(exclude={'staff_id'})
    request = HolidayRequest(
        **request_data,
        staff_id=target_staff_id,
        status=leave_status,
        approved_by_id=approved_by_id,
        approval_date=approval_date
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
    """Update a holiday request. Staff can edit own pending requests. Admin can edit any request."""
    require_staff(current_user)

    request = db.query(HolidayRequest).filter(HolidayRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Holiday request not found")

    is_admin = current_user.role in ["admin", "coach"]
    is_own = request.staff_id == current_user.id

    if is_admin:
        # Admin can edit any request (pending or approved)
        pass
    elif is_own:
        # Staff can only edit their own pending requests
        if request.status != LeaveStatus.PENDING:
            raise HTTPException(status_code=400, detail="Can only edit pending requests")
    else:
        raise HTTPException(status_code=403, detail="Cannot edit others' requests")

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
    """Cancel a holiday request (own pending only, or admin can cancel any status)."""
    require_staff(current_user)

    request = db.query(HolidayRequest).filter(HolidayRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Holiday request not found")

    is_own = request.staff_id == current_user.id
    is_admin = current_user.role in [UserRole.ADMIN, UserRole.COACH]

    # Admin can cancel any holiday regardless of status
    if is_admin:
        request.status = LeaveStatus.CANCELLED
        db.commit()
        return

    # Staff can only cancel their own pending requests
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


@router.delete("/absences/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_unplanned_absence(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an unplanned absence record (admin only)."""
    require_manager(current_user)

    record = db.query(UnplannedAbsence).filter(UnplannedAbsence.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Unplanned absence record not found")

    db.delete(record)
    db.commit()


# ============== Staff Leave Summary (viewable by all staff) ==============

def get_leave_year_dates(year: int, start_month: int) -> tuple:
    """Get leave year start and end dates based on start month.

    Args:
        year: The year to calculate for (represents the year the leave year starts in)
        start_month: Month when leave year starts (1=January, 4=April, etc.)

    Returns:
        Tuple of (start_date, end_date)
    """
    if start_month == 1:
        # Calendar year: Jan 1 - Dec 31 of the same year
        return date(year, 1, 1), date(year, 12, 31)
    else:
        # e.g., April start: Apr 1 year -> Mar 31 year+1
        start_date = date(year, start_month, 1)
        # End date is day before start_month in the next year
        end_date = date(year + 1, start_month, 1) - timedelta(days=1)
        return start_date, end_date


def calculate_prorata_entitlement(
    full_entitlement: int,
    leave_year_start: date,
    leave_year_end: date,
    staff_start_date: Optional[date],
    staff_leaving_date: Optional[date]
) -> float:
    """Calculate pro-rata entitlement based on service within leave year.

    Args:
        full_entitlement: Full annual leave entitlement (days)
        leave_year_start: Start date of the leave year
        leave_year_end: End date of the leave year
        staff_start_date: Date staff member started employment
        staff_leaving_date: Date staff member is leaving (or None)

    Returns:
        Pro-rata entitlement rounded to 1 decimal place
    """
    # Determine effective start (later of leave year start or staff start)
    effective_start = leave_year_start
    if staff_start_date and staff_start_date > leave_year_start:
        effective_start = staff_start_date

    # Determine effective end (earlier of leave year end or leaving date)
    effective_end = leave_year_end
    if staff_leaving_date and staff_leaving_date < leave_year_end:
        effective_end = staff_leaving_date

    # If staff not active during this leave year
    if effective_start > effective_end:
        return 0.0

    # Calculate days worked vs total days in year
    total_days_in_year = (leave_year_end - leave_year_start).days + 1
    days_worked = (effective_end - effective_start).days + 1

    # Pro-rata calculation
    prorata = (days_worked / total_days_in_year) * full_entitlement
    return round(prorata, 1)  # Round to 1 decimal for half-days


# ============== Day Status Endpoints (Unavailable/Absent) ==============

def enrich_day_status(status: StaffDayStatus) -> dict:
    """Add staff name to day status for response."""
    data = {
        "id": status.id,
        "staff_id": status.staff_id,
        "date": status.date,
        "status_type": status.status_type,
        "notes": status.notes,
        "created_by_id": status.created_by_id,
        "created_at": status.created_at,
        "staff_name": status.staff.name if status.staff else None,
    }
    return data


@router.get("/day-statuses", response_model=DayStatusListResponse)
def list_day_statuses(
    staff_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List day statuses (unavailable/absent) with optional filters."""
    require_staff(current_user)

    query = db.query(StaffDayStatus).options(joinedload(StaffDayStatus.staff))

    if staff_id:
        query = query.filter(StaffDayStatus.staff_id == staff_id)
    if start_date:
        query = query.filter(StaffDayStatus.date >= start_date)
    if end_date:
        query = query.filter(StaffDayStatus.date <= end_date)

    statuses = query.order_by(StaffDayStatus.date.desc()).all()

    return DayStatusListResponse(
        statuses=[DayStatusResponse(**enrich_day_status(s)) for s in statuses]
    )


@router.post("/day-statuses", response_model=DayStatusResponse, status_code=status.HTTP_201_CREATED)
def create_day_status(
    data: DayStatusCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a day status (unavailable/absent) for a staff member. Admin only."""
    require_manager(current_user)

    # Check if status already exists for this staff/date
    existing = db.query(StaffDayStatus).filter(
        StaffDayStatus.staff_id == data.staff_id,
        StaffDayStatus.date == data.date
    ).first()

    if existing:
        # Update existing instead of creating duplicate
        existing.status_type = data.status_type
        existing.notes = data.notes
        db.commit()
        db.refresh(existing)
        return DayStatusResponse(**enrich_day_status(existing))

    day_status = StaffDayStatus(
        staff_id=data.staff_id,
        date=data.date,
        status_type=data.status_type,
        notes=data.notes,
        created_by_id=current_user.id,
    )
    db.add(day_status)
    db.commit()
    db.refresh(day_status)

    return DayStatusResponse(**enrich_day_status(day_status))


@router.delete("/day-statuses/{status_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_day_status(
    status_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a day status. Admin only."""
    require_manager(current_user)

    day_status = db.query(StaffDayStatus).filter(StaffDayStatus.id == status_id).first()
    if not day_status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Day status not found"
        )

    db.delete(day_status)
    db.commit()


@router.delete("/day-statuses/by-staff-date", status_code=status.HTTP_204_NO_CONTENT)
def delete_day_status_by_staff_date(
    staff_id: int,
    date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a day status by staff ID and date. Admin only."""
    require_manager(current_user)

    day_status = db.query(StaffDayStatus).filter(
        StaffDayStatus.staff_id == staff_id,
        StaffDayStatus.date == date
    ).first()

    if day_status:
        db.delete(day_status)
        db.commit()


@router.get("/leave-summary", response_model=AllStaffLeaveSummary)
def get_all_staff_leave_summary(
    year: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get leave summary for all staff - viewable by staff and admin."""
    require_staff(current_user)

    # Get leave year configuration from settings
    settings = db.query(SiteSettings).first()
    leave_year_start_month = settings.leave_year_start_month if settings else 1

    # Determine which leave year to show
    today = date.today()
    if year is None:
        # Default to current leave year
        if leave_year_start_month == 1:
            year = today.year
        else:
            # For non-calendar year, determine which leave year we're in
            if today.month >= leave_year_start_month:
                year = today.year
            else:
                year = today.year - 1

    # Calculate leave year boundaries
    year_start, year_end = get_leave_year_dates(year, leave_year_start_month)

    # Get all users with yard staff access (admin or is_yard_staff flag)
    staff_users = db.query(User).outerjoin(
        StaffProfile, User.id == StaffProfile.user_id
    ).filter(
        (User.role == UserRole.ADMIN) | (User.is_yard_staff == True),
        User.is_active == True
    ).all()

    summaries = []
    for user in staff_users:
        # Get staff start date from profile
        profile = db.query(StaffProfile).filter(StaffProfile.user_id == user.id).first()
        staff_start_date = profile.start_date if profile else None

        # Calculate annual leave taken (approved holiday requests this leave year)
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

        # Calculate upcoming approved leave (approved but not yet taken - future dates)
        annual_leave_upcoming = db.query(func.coalesce(func.sum(HolidayRequest.days_requested), 0)).filter(
            HolidayRequest.staff_id == user.id,
            HolidayRequest.status == LeaveStatus.APPROVED,
            HolidayRequest.leave_type == LeaveType.ANNUAL,
            HolidayRequest.start_date > today,  # Only future dates
            HolidayRequest.start_date >= year_start,
            HolidayRequest.start_date <= year_end
        ).scalar() or 0

        # Count unplanned absences this leave year
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
            full_entitlement = user.annual_leave_entitlement or 23
            # Calculate pro-rata entitlement
            prorata = calculate_prorata_entitlement(
                full_entitlement,
                year_start,
                year_end,
                staff_start_date,
                user.leaving_date
            )
            remaining = float(prorata - float(annual_leave_taken))
        else:
            # Casual/on-call staff - no fixed entitlement
            full_entitlement = None
            prorata = None
            remaining = None

        summaries.append(StaffLeaveSummary(
            staff_id=user.id,
            staff_name=user.name,
            staff_type=staff_type,
            annual_leave_entitlement=full_entitlement,
            prorata_entitlement=prorata,
            annual_leave_taken=float(annual_leave_taken),
            annual_leave_remaining=remaining,
            annual_leave_pending=float(annual_leave_pending),
            annual_leave_upcoming=float(annual_leave_upcoming),
            unplanned_absences_this_year=unplanned_absences
        ))

    return AllStaffLeaveSummary(
        year=year,
        leave_year_start=year_start.isoformat(),
        leave_year_end=year_end.isoformat(),
        staff_summaries=summaries
    )


# ============== Payroll Endpoints ==============

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require admin role for payroll operations."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


@router.get("/payroll-summary", response_model=PayrollSummaryResponse)
def get_payroll_summary(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get payroll summary for a date range (admin only).

    Shows approved hours, hourly rates, adjustments, and calculated pay for all staff.
    """
    today = date.today()

    # Default to current month if not provided
    if not start_date:
        start_date = date(today.year, today.month, 1)
    if not end_date:
        _, last_day = monthrange(today.year, today.month)
        end_date = date(today.year, today.month, last_day)

    if end_date < start_date:
        raise HTTPException(status_code=400, detail="end_date must be on or after start_date")

    period_start = start_date
    period_end = end_date
    period_label = f"{period_start.strftime('%-d %b %Y')} - {period_end.strftime('%-d %b %Y')}"

    # Get all staff users
    staff_users = db.query(User).filter(
        (User.role == UserRole.STAFF) | (User.is_yard_staff == True),
        User.is_active == True
    ).all()

    staff_summaries = []
    total_hours = 0.0
    total_base_pay = 0.0
    total_holiday_hours = 0.0
    total_holiday_pay = 0.0
    total_adjustments_amount = 0.0
    total_pay_amount = 0.0

    for user in staff_users:
        # Get staff profile for current hourly rate (for display)
        profile = db.query(StaffProfile).filter(StaffProfile.user_id == user.id).first()
        current_hourly_rate = float(profile.hourly_rate) if profile and profile.hourly_rate else 0.0
        staff_type = user.staff_type.value if user.staff_type else None

        # Calculate approved hours and base pay (using rate effective on each timesheet date)
        timesheets = db.query(Timesheet).filter(
            Timesheet.staff_id == user.id,
            Timesheet.status == TimesheetStatus.APPROVED,
            Timesheet.date >= period_start,
            Timesheet.date <= period_end
        ).all()

        approved_hours = 0.0
        base_pay = 0.0
        for ts in timesheets:
            if ts.clock_out:
                hours = calculate_hours(ts.clock_in, ts.clock_out, ts.break_minutes)
                # Use the rate effective on the timesheet date
                rate_for_date = get_rate_for_date(db, user.id, ts.date)
                approved_hours += hours
                base_pay += hours * rate_for_date

        timesheet_count = len(timesheets)

        # Get adjustments for this period
        adjustments = db.query(PayrollAdjustment).filter(
            PayrollAdjustment.staff_id == user.id,
            PayrollAdjustment.payment_date >= period_start,
            PayrollAdjustment.payment_date <= period_end
        ).all()

        oneoff_total = sum(float(a.amount) for a in adjustments if a.adjustment_type == PayrollAdjustmentType.ONEOFF)
        tips_total = sum(float(a.amount) for a in adjustments if a.adjustment_type == PayrollAdjustmentType.TIP)
        taxable_adj = sum(float(a.amount) for a in adjustments if a.taxable)
        non_taxable_adj = sum(float(a.amount) for a in adjustments if not a.taxable)

        adjustment_summary = PayrollAdjustmentSummary(
            oneoff_total=oneoff_total,
            tips_total=tips_total,
            taxable_adjustments=taxable_adj,
            non_taxable_adjustments=non_taxable_adj
        )

        # Calculate approved annual leave (holiday) pay for this period
        holidays = db.query(HolidayRequest).filter(
            HolidayRequest.staff_id == user.id,
            HolidayRequest.leave_type == LeaveType.ANNUAL,
            HolidayRequest.status == LeaveStatus.APPROVED,
            HolidayRequest.start_date <= period_end,
            HolidayRequest.end_date >= period_start
        ).all()

        holiday_days = 0.0
        for h in holidays:
            if h.start_date >= period_start and h.end_date <= period_end:
                # Fully within period
                holiday_days += float(h.days_requested)
            else:
                # Partially overlapping - pro-rate
                total_calendar_days = (h.end_date - h.start_date).days + 1
                overlap_start = max(h.start_date, period_start)
                overlap_end = min(h.end_date, period_end)
                overlap_days = (overlap_end - overlap_start).days + 1
                holiday_days += float(h.days_requested) * (overlap_days / total_calendar_days)

        holiday_hours = round(holiday_days * 8, 2)
        holiday_pay = round(holiday_hours * current_hourly_rate, 2)

        staff_total_pay = base_pay + oneoff_total + tips_total + holiday_pay
        taxable_pay = base_pay + taxable_adj + holiday_pay
        non_taxable_pay = non_taxable_adj

        staff_summaries.append(StaffPayrollPeriod(
            staff_id=user.id,
            staff_name=user.name,
            staff_type=staff_type,
            hourly_rate=current_hourly_rate,
            approved_hours=approved_hours,
            timesheet_count=timesheet_count,
            base_pay=base_pay,
            holiday_days=holiday_days,
            holiday_hours=holiday_hours,
            holiday_pay=holiday_pay,
            adjustments=adjustment_summary,
            total_pay=staff_total_pay,
            taxable_pay=taxable_pay,
            non_taxable_pay=non_taxable_pay
        ))

        total_hours += approved_hours
        total_base_pay += base_pay
        total_holiday_hours += holiday_hours
        total_holiday_pay += holiday_pay
        total_adjustments_amount += oneoff_total + tips_total
        total_pay_amount += staff_total_pay

    return PayrollSummaryResponse(
        period_start=period_start,
        period_end=period_end,
        period_label=period_label,
        staff_summaries=staff_summaries,
        total_approved_hours=total_hours,
        total_base_pay=total_base_pay,
        total_holiday_hours=total_holiday_hours,
        total_holiday_pay=total_holiday_pay,
        total_adjustments=total_adjustments_amount,
        total_pay=total_pay_amount
    )


@router.post("/payroll-adjustments", response_model=PayrollAdjustmentResponse, status_code=status.HTTP_201_CREATED)
def create_payroll_adjustment(
    data: PayrollAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create a payroll adjustment (one-off payment or tip)."""
    # Verify staff exists
    staff = db.query(User).filter(User.id == data.staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")

    adjustment = PayrollAdjustment(
        staff_id=data.staff_id,
        adjustment_type=PayrollAdjustmentType(data.adjustment_type),
        amount=data.amount,
        description=data.description,
        payment_date=data.payment_date,
        taxable=data.taxable,
        notes=data.notes,
        created_by_id=current_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(adjustment)
    db.commit()
    db.refresh(adjustment)

    return PayrollAdjustmentResponse(
        id=adjustment.id,
        staff_id=adjustment.staff_id,
        adjustment_type=adjustment.adjustment_type.value,
        amount=float(adjustment.amount),
        description=adjustment.description,
        payment_date=adjustment.payment_date,
        taxable=adjustment.taxable,
        notes=adjustment.notes,
        created_by_id=adjustment.created_by_id,
        created_at=adjustment.created_at,
        updated_at=adjustment.updated_at,
        staff_name=staff.name,
        created_by_name=current_user.name
    )


@router.get("/payroll-adjustments", response_model=PayrollAdjustmentListResponse)
def list_payroll_adjustments(
    staff_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    adjustment_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """List payroll adjustments with optional filters."""
    query = db.query(PayrollAdjustment)

    if staff_id:
        query = query.filter(PayrollAdjustment.staff_id == staff_id)
    if start_date:
        query = query.filter(PayrollAdjustment.payment_date >= start_date)
    if end_date:
        query = query.filter(PayrollAdjustment.payment_date <= end_date)
    if adjustment_type:
        query = query.filter(PayrollAdjustment.adjustment_type == PayrollAdjustmentType(adjustment_type))

    query = query.order_by(PayrollAdjustment.payment_date.desc())
    adjustments = query.all()

    # Enrich with names
    results = []
    for adj in adjustments:
        staff = db.query(User).filter(User.id == adj.staff_id).first()
        created_by = db.query(User).filter(User.id == adj.created_by_id).first() if adj.created_by_id else None

        results.append(PayrollAdjustmentResponse(
            id=adj.id,
            staff_id=adj.staff_id,
            adjustment_type=adj.adjustment_type.value,
            amount=float(adj.amount),
            description=adj.description,
            payment_date=adj.payment_date,
            taxable=adj.taxable,
            notes=adj.notes,
            created_by_id=adj.created_by_id,
            created_at=adj.created_at,
            updated_at=adj.updated_at,
            staff_name=staff.name if staff else None,
            created_by_name=created_by.name if created_by else None
        ))

    return PayrollAdjustmentListResponse(
        adjustments=results,
        total=len(results)
    )


@router.delete("/payroll-adjustments/{adjustment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payroll_adjustment(
    adjustment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete a payroll adjustment."""
    adjustment = db.query(PayrollAdjustment).filter(PayrollAdjustment.id == adjustment_id).first()
    if not adjustment:
        raise HTTPException(status_code=404, detail="Adjustment not found")

    db.delete(adjustment)
    db.commit()
    return None


# ============== Staff Thanks Endpoints ==============

def require_livery(current_user: User):
    """Require user to be a livery owner."""
    if current_user.role != UserRole.LIVERY and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Livery owner access required"
        )
    return current_user


@router.get("/thanks/staff-list", response_model=list)
def get_staff_for_thanks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of staff members that can receive thanks (for livery owners)."""
    require_livery(current_user)

    # Get all users who are yard staff
    staff = db.query(User).filter(
        User.is_yard_staff == True,
        User.is_active == True
    ).all()

    return [{"id": s.id, "name": s.name} for s in staff]


@router.post("/thanks", response_model=StaffThanksResponse)
def send_thanks(
    thanks_data: StaffThanksCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send a thank you message to a staff member, optionally with a tip.

    If a tip is included, tip_paid will be False until payment is completed via Stripe.
    """
    require_livery(current_user)

    # Verify the recipient is a valid staff member
    recipient = db.query(User).filter(
        User.id == thanks_data.staff_id,
        User.is_yard_staff == True,
        User.is_active == True
    ).first()

    if not recipient:
        raise HTTPException(status_code=404, detail="Staff member not found")

    # Create the thanks record
    # If there's a tip, it starts as unpaid until Stripe payment completes
    thanks = StaffThanks(
        staff_id=thanks_data.staff_id,
        sender_id=current_user.id,
        message=thanks_data.message,
        tip_amount=thanks_data.tip_amount if thanks_data.tip_amount and thanks_data.tip_amount > 0 else None,
        tip_paid=thanks_data.tip_amount is None or thanks_data.tip_amount <= 0  # No tip = "paid"
    )
    db.add(thanks)
    db.commit()
    db.refresh(thanks)

    return StaffThanksResponse(
        id=thanks.id,
        staff_id=thanks.staff_id,
        sender_id=thanks.sender_id,
        message=thanks.message,
        tip_amount=float(thanks.tip_amount) if thanks.tip_amount else None,
        tip_paid=thanks.tip_paid,
        read_at=thanks.read_at,
        created_at=thanks.created_at,
        staff_name=recipient.name,
        sender_name=current_user.name
    )


class TipCheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


@router.post("/thanks/{thanks_id}/pay-tip", response_model=TipCheckoutResponse)
def create_tip_checkout(
    thanks_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a Stripe checkout session to pay a tip."""
    from app.models.settings import SiteSettings
    from app.config import get_app_config

    require_livery(current_user)

    # Get the thanks record
    thanks = db.query(StaffThanks).filter(
        StaffThanks.id == thanks_id,
        StaffThanks.sender_id == current_user.id
    ).first()

    if not thanks:
        raise HTTPException(status_code=404, detail="Thanks message not found")

    if not thanks.tip_amount or thanks.tip_amount <= 0:
        raise HTTPException(status_code=400, detail="No tip to pay")

    if thanks.tip_paid:
        raise HTTPException(status_code=400, detail="Tip already paid")

    # Get Stripe configuration
    site_settings = db.query(SiteSettings).first()
    if not site_settings or not site_settings.stripe_enabled or not site_settings.stripe_secret_key:
        raise HTTPException(
            status_code=503,
            detail="Payment processing is not configured"
        )

    # Get recipient name
    recipient = db.query(User).filter(User.id == thanks.staff_id).first()
    recipient_name = recipient.name if recipient else "Staff Member"

    # Import and configure Stripe
    try:
        import stripe
        stripe.api_key = site_settings.stripe_secret_key
    except ImportError:
        raise HTTPException(status_code=503, detail="Stripe not available")

    # Get frontend URL
    app_config = get_app_config(db)
    frontend_url = app_config['frontend_url']

    # Convert to pence
    amount_pence = int(float(thanks.tip_amount) * 100)

    try:
        # Create Stripe checkout session
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'gbp',
                    'product_data': {
                        'name': f'Tip for {recipient_name}',
                        'description': f'Thank you tip',
                    },
                    'unit_amount': amount_pence,
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{frontend_url}/book/send-thanks?tip_success=true&thanks_id={thanks.id}",
            cancel_url=f"{frontend_url}/book/send-thanks?tip_cancelled=true&thanks_id={thanks.id}",
            metadata={
                'thanks_id': str(thanks.id),
                'type': 'staff_tip',
            },
            expires_at=int((datetime.utcnow().timestamp()) + 1800),  # 30 minutes
        )

        # Store the session ID
        thanks.tip_payment_intent_id = checkout_session.id
        db.commit()

        return TipCheckoutResponse(
            checkout_url=checkout_session.url,
            session_id=checkout_session.id
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Payment error: {str(e)}")


@router.post("/thanks/{thanks_id}/verify-tip")
def verify_tip_payment(
    thanks_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Verify tip payment status with Stripe (for cases where webhook didn't fire)."""
    from app.models.settings import SiteSettings

    require_livery(current_user)

    thanks = db.query(StaffThanks).filter(
        StaffThanks.id == thanks_id,
        StaffThanks.sender_id == current_user.id
    ).first()

    if not thanks:
        raise HTTPException(status_code=404, detail="Thanks message not found")

    if thanks.tip_paid:
        return {"status": "paid", "thanks_id": thanks.id}

    if not thanks.tip_payment_intent_id:
        raise HTTPException(status_code=400, detail="No payment session found")

    # Get Stripe configuration
    site_settings = db.query(SiteSettings).first()
    if not site_settings or not site_settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Payment processing not configured")

    try:
        import stripe
        stripe.api_key = site_settings.stripe_secret_key

        # Check the checkout session status
        session = stripe.checkout.Session.retrieve(thanks.tip_payment_intent_id)

        if session.payment_status == 'paid' and not thanks.tip_paid:
            # Mark as paid and create payroll adjustment
            thanks.tip_paid = True
            thanks.tip_payment_intent_id = session.payment_intent

            # Create payroll adjustment for the staff member
            sender = db.query(User).filter(User.id == thanks.sender_id).first()
            adjustment = PayrollAdjustment(
                staff_id=thanks.staff_id,
                adjustment_type=PayrollAdjustmentType.TIP,
                amount=thanks.tip_amount,
                description=f"Tip from {sender.name if sender else 'Livery Owner'}",
                payment_date=date.today(),
                taxable=False,
                notes=thanks.message[:200] if thanks.message else None,
                created_by_id=thanks.sender_id,
                thanks_id=thanks.id
            )
            db.add(adjustment)
            db.commit()

            return {"status": "paid", "thanks_id": thanks.id}

        return {"status": "pending", "thanks_id": thanks.id}

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Verification error: {str(e)}")


@router.get("/thanks/my-received", response_model=StaffThanksListResponse)
def get_my_received_thanks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all thanks messages received by the current staff member."""
    require_staff(current_user)

    thanks_list = db.query(StaffThanks).filter(
        StaffThanks.staff_id == current_user.id
    ).order_by(StaffThanks.created_at.desc()).all()

    results = []
    for thanks in thanks_list:
        sender = db.query(User).filter(User.id == thanks.sender_id).first()
        results.append(StaffThanksResponse(
            id=thanks.id,
            staff_id=thanks.staff_id,
            sender_id=thanks.sender_id,
            message=thanks.message,
            tip_amount=float(thanks.tip_amount) if thanks.tip_amount else None,
            tip_paid=thanks.tip_paid,
            read_at=thanks.read_at,
            created_at=thanks.created_at,
            staff_name=current_user.name,
            sender_name=sender.name if sender else "Unknown"
        ))

    unread_count = sum(1 for t in thanks_list if t.read_at is None)

    return StaffThanksListResponse(
        thanks=results,
        total=len(results),
        unread_count=unread_count
    )


@router.get("/thanks/unread-count", response_model=StaffThanksUnreadCount)
def get_unread_thanks_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get count of unread thanks messages for notification badge."""
    require_staff(current_user)

    count = db.query(StaffThanks).filter(
        StaffThanks.staff_id == current_user.id,
        StaffThanks.read_at == None
    ).count()

    return StaffThanksUnreadCount(unread_count=count)


@router.post("/thanks/{thanks_id}/mark-read", response_model=StaffThanksResponse)
def mark_thanks_as_read(
    thanks_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a thanks message as read."""
    require_staff(current_user)

    thanks = db.query(StaffThanks).filter(
        StaffThanks.id == thanks_id,
        StaffThanks.staff_id == current_user.id
    ).first()

    if not thanks:
        raise HTTPException(status_code=404, detail="Thanks message not found")

    if thanks.read_at is None:
        thanks.read_at = datetime.utcnow()
        db.commit()
        db.refresh(thanks)

    sender = db.query(User).filter(User.id == thanks.sender_id).first()

    return StaffThanksResponse(
        id=thanks.id,
        staff_id=thanks.staff_id,
        sender_id=thanks.sender_id,
        message=thanks.message,
        tip_amount=float(thanks.tip_amount) if thanks.tip_amount else None,
        tip_paid=thanks.tip_paid,
        read_at=thanks.read_at,
        created_at=thanks.created_at,
        staff_name=current_user.name,
        sender_name=sender.name if sender else "Unknown"
    )


@router.post("/thanks/mark-all-read")
def mark_all_thanks_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark all thanks messages as read."""
    require_staff(current_user)

    db.query(StaffThanks).filter(
        StaffThanks.staff_id == current_user.id,
        StaffThanks.read_at == None
    ).update({"read_at": datetime.utcnow()})
    db.commit()

    return {"message": "All thanks marked as read"}


@router.get("/thanks/my-sent", response_model=StaffThanksListResponse)
def get_my_sent_thanks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all thanks messages sent by the current livery owner."""
    require_livery(current_user)

    thanks_list = db.query(StaffThanks).filter(
        StaffThanks.sender_id == current_user.id
    ).order_by(StaffThanks.created_at.desc()).all()

    results = []
    for thanks in thanks_list:
        staff = db.query(User).filter(User.id == thanks.staff_id).first()
        results.append(StaffThanksResponse(
            id=thanks.id,
            staff_id=thanks.staff_id,
            sender_id=thanks.sender_id,
            message=thanks.message,
            tip_amount=float(thanks.tip_amount) if thanks.tip_amount else None,
            tip_paid=thanks.tip_paid,
            read_at=thanks.read_at,
            created_at=thanks.created_at,
            staff_name=staff.name if staff else "Unknown",
            sender_name=current_user.name
        ))

    return StaffThanksListResponse(
        thanks=results,
        total=len(results),
        unread_count=0  # Sent thanks don't have unread status
    )

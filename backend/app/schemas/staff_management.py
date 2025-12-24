from datetime import datetime, date, time
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel

from app.models.staff_management import ShiftType, ShiftRole, WorkType, TimesheetStatus, LeaveType, LeaveStatus


# ============== Shift Schemas ==============

class ShiftBase(BaseModel):
    date: date
    shift_type: ShiftType = ShiftType.FULL_DAY
    role: ShiftRole = ShiftRole.YARD_DUTIES
    notes: Optional[str] = None


class ShiftCreate(ShiftBase):
    staff_id: int


class ShiftUpdate(BaseModel):
    date: Optional[date] = None
    shift_type: Optional[ShiftType] = None
    role: Optional[ShiftRole] = None
    notes: Optional[str] = None


class ShiftResponse(ShiftBase):
    id: int
    staff_id: int
    created_by_id: int
    created_at: datetime
    updated_at: datetime
    staff_name: Optional[str] = None
    created_by_name: Optional[str] = None

    class Config:
        from_attributes = True


# ============== Timesheet Schemas ==============

class TimesheetBase(BaseModel):
    date: date
    clock_in: time
    clock_out: Optional[time] = None
    lunch_start: Optional[time] = None
    lunch_end: Optional[time] = None
    break_minutes: int = 0
    work_type: WorkType = WorkType.YARD_DUTIES
    notes: Optional[str] = None


class TimesheetCreate(TimesheetBase):
    pass


class AdminTimesheetCreate(TimesheetBase):
    """Admin can create timesheets for staff who forgot to log their hours."""
    staff_id: int


class TimesheetUpdate(BaseModel):
    clock_in: Optional[time] = None
    clock_out: Optional[time] = None
    lunch_start: Optional[time] = None
    lunch_end: Optional[time] = None
    break_minutes: Optional[int] = None
    work_type: Optional[WorkType] = None
    notes: Optional[str] = None


class TimesheetResponse(TimesheetBase):
    id: int
    staff_id: int
    status: TimesheetStatus
    logged_by_id: Optional[int] = None
    submitted_at: Optional[datetime] = None
    approved_by_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    staff_name: Optional[str] = None
    logged_by_name: Optional[str] = None
    approved_by_name: Optional[str] = None
    total_hours: Optional[float] = None  # Computed field

    class Config:
        from_attributes = True


# ============== Holiday Request Schemas ==============

class HolidayRequestBase(BaseModel):
    start_date: date
    end_date: date
    leave_type: LeaveType = LeaveType.ANNUAL
    days_requested: Decimal
    reason: Optional[str] = None


class HolidayRequestCreate(HolidayRequestBase):
    pass


class HolidayRequestUpdate(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    leave_type: Optional[LeaveType] = None
    days_requested: Optional[Decimal] = None
    reason: Optional[str] = None


class HolidayRequestResponse(HolidayRequestBase):
    id: int
    staff_id: int
    status: LeaveStatus
    approved_by_id: Optional[int] = None
    approval_date: Optional[datetime] = None
    approval_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    staff_name: Optional[str] = None
    approved_by_name: Optional[str] = None

    class Config:
        from_attributes = True


# ============== Unplanned Absence Schemas ==============

class UnplannedAbsenceBase(BaseModel):
    date: date
    reported_time: Optional[time] = None
    reason: Optional[str] = None  # e.g., "sickness", "emergency", "no contact"
    expected_return: Optional[date] = None
    notes: Optional[str] = None


class UnplannedAbsenceCreate(UnplannedAbsenceBase):
    staff_id: int


class UnplannedAbsenceUpdate(BaseModel):
    reason: Optional[str] = None
    expected_return: Optional[date] = None
    actual_return: Optional[date] = None
    notes: Optional[str] = None
    has_fit_note: Optional[bool] = None
    fit_note_start: Optional[date] = None
    fit_note_end: Optional[date] = None


class UnplannedAbsenceResponse(UnplannedAbsenceBase):
    id: int
    staff_id: int
    reported_to_id: Optional[int] = None
    actual_return: Optional[date] = None
    has_fit_note: bool
    fit_note_start: Optional[date] = None
    fit_note_end: Optional[date] = None
    created_at: datetime
    updated_at: datetime
    staff_name: Optional[str] = None
    reported_to_name: Optional[str] = None

    class Config:
        from_attributes = True


# ============== List Schemas ==============

class ShiftsListResponse(BaseModel):
    shifts: List[ShiftResponse]
    total: int


class TimesheetsListResponse(BaseModel):
    timesheets: List[TimesheetResponse]
    total: int


class HolidayRequestsListResponse(BaseModel):
    pending: List[HolidayRequestResponse]
    approved: List[HolidayRequestResponse]
    rejected: List[HolidayRequestResponse]


class UnplannedAbsenceListResponse(BaseModel):
    records: List[UnplannedAbsenceResponse]
    total: int


# ============== Summary Schemas ==============

class StaffSummary(BaseModel):
    staff_id: int
    staff_name: str
    shifts_this_week: int
    hours_this_week: float
    pending_timesheets: int
    pending_holiday_requests: int
    unplanned_absences_this_month: int


class ManagerDashboard(BaseModel):
    pending_timesheets: int
    pending_holiday_requests: int
    staff_on_leave_today: int
    staff_absent_today: int
    shifts_today: int


# ============== Staff Leave Summary (viewable by all staff) ==============

class StaffLeaveSummary(BaseModel):
    """Leave summary for a single staff member."""
    staff_id: int
    staff_name: str
    staff_type: Optional[str] = None  # regular, casual, on_call
    annual_leave_entitlement: Optional[int] = None  # None for casual/on_call
    annual_leave_taken: float  # Days taken this year
    annual_leave_remaining: Optional[float] = None  # None for casual/on_call
    annual_leave_pending: float  # Days in pending requests
    unplanned_absences_this_year: int


class AllStaffLeaveSummary(BaseModel):
    """Leave summary for all staff - viewable by staff and admin."""
    year: int
    staff_summaries: List[StaffLeaveSummary]


# ============== Enum Info ==============

class EnumInfo(BaseModel):
    value: str
    label: str


class StaffManagementEnums(BaseModel):
    shift_types: List[EnumInfo]
    shift_roles: List[EnumInfo]
    work_types: List[EnumInfo]
    timesheet_statuses: List[EnumInfo]
    leave_types: List[EnumInfo]
    leave_statuses: List[EnumInfo]
    staff_types: List[EnumInfo]

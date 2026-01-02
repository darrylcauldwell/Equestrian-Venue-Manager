from datetime import datetime, date, time
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

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

    model_config = ConfigDict(from_attributes=True)


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

    model_config = ConfigDict(from_attributes=True)


# ============== Holiday Request Schemas ==============

class HolidayRequestBase(BaseModel):
    start_date: date
    end_date: date
    leave_type: LeaveType = LeaveType.ANNUAL
    days_requested: Decimal
    reason: Optional[str] = None


class HolidayRequestCreate(HolidayRequestBase):
    staff_id: Optional[int] = None  # Admin can specify staff_id, otherwise uses current user


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

    model_config = ConfigDict(from_attributes=True)


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

    model_config = ConfigDict(from_attributes=True)


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
    annual_leave_entitlement: Optional[int] = None  # Full entitlement (None for casual/on_call)
    prorata_entitlement: Optional[float] = None  # Pro-rata based on start/leaving date
    annual_leave_taken: float  # Days taken this year
    annual_leave_remaining: Optional[float] = None  # Based on pro-rata entitlement (None for casual/on_call)
    annual_leave_pending: float  # Days in pending requests
    annual_leave_upcoming: float  # Days approved but not yet taken (future dates)
    unplanned_absences_this_year: int


class AllStaffLeaveSummary(BaseModel):
    """Leave summary for all staff - viewable by staff and admin."""
    year: int
    leave_year_start: str  # ISO date string for leave year start
    leave_year_end: str  # ISO date string for leave year end
    staff_summaries: List[StaffLeaveSummary]


# ============== Payroll Adjustment Schemas ==============

class PayrollAdjustmentCreate(BaseModel):
    """Create a payroll adjustment (one-off or tip)."""
    staff_id: int
    adjustment_type: str  # oneoff, tip
    amount: float
    description: str
    payment_date: date
    taxable: bool = True  # Tips are tax-free (False)
    notes: Optional[str] = None


class PayrollAdjustmentResponse(BaseModel):
    """Payroll adjustment response."""
    id: int
    staff_id: int
    adjustment_type: str
    amount: float
    description: str
    payment_date: date
    taxable: bool
    notes: Optional[str] = None
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    staff_name: Optional[str] = None
    created_by_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PayrollAdjustmentListResponse(BaseModel):
    """List of payroll adjustments."""
    adjustments: List[PayrollAdjustmentResponse]
    total: int


# ============== Payroll Summary Schemas ==============

class PayrollAdjustmentSummary(BaseModel):
    """Summary of adjustments for payroll period."""
    oneoff_total: float
    tips_total: float
    taxable_adjustments: float
    non_taxable_adjustments: float


class StaffPayrollPeriod(BaseModel):
    """Payroll for a single staff member in a period."""
    staff_id: int
    staff_name: str
    staff_type: Optional[str] = None  # regular, casual, on_call
    hourly_rate: Optional[float] = None
    approved_hours: float
    timesheet_count: int
    base_pay: float  # approved_hours * hourly_rate
    adjustments: PayrollAdjustmentSummary
    total_pay: float  # base_pay + all adjustments
    taxable_pay: float  # base_pay + taxable adjustments
    non_taxable_pay: float  # tips


class PayrollSummaryResponse(BaseModel):
    """Payroll summary for all staff in a period - admin only."""
    period_type: str  # "week" or "month"
    period_start: date
    period_end: date
    period_label: str  # e.g., "Week 1, Jan 2025" or "January 2025"
    staff_summaries: List[StaffPayrollPeriod]
    total_approved_hours: float
    total_base_pay: float
    total_adjustments: float
    total_pay: float


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


# ============== Staff Thanks Schemas ==============

class StaffThanksCreate(BaseModel):
    """Create a thank you message to staff, optionally with a tip."""
    staff_id: int
    message: str
    tip_amount: Optional[float] = None  # Optional tip in GBP


class StaffThanksResponse(BaseModel):
    """Staff thanks response."""
    id: int
    staff_id: int
    sender_id: int
    message: str
    tip_amount: Optional[float] = None
    tip_paid: bool
    read_at: Optional[datetime] = None
    created_at: datetime
    staff_name: Optional[str] = None
    sender_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class StaffThanksListResponse(BaseModel):
    """List of thanks messages."""
    thanks: List[StaffThanksResponse]
    total: int
    unread_count: int


class StaffThanksUnreadCount(BaseModel):
    """Count of unread thanks messages for notifications."""
    unread_count: int


class TipPaymentIntentResponse(BaseModel):
    """Response with Stripe PaymentIntent for processing tip."""
    thanks_id: int
    client_secret: str
    amount: float

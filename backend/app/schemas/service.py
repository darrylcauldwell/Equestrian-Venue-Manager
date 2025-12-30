from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel
from app.models.service import ServiceCategory, RequestStatus, ChargeStatus, PreferredTime, RecurringPattern


# Service Schemas (catalog)
class ServiceCreate(BaseModel):
    id: str
    category: ServiceCategory
    name: str
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    price_gbp: Decimal
    requires_approval: bool = False
    approval_reason: Optional[str] = None
    advance_notice_hours: int = 24
    is_active: bool = True
    is_insurance_claimable: bool = False
    notes: Optional[str] = None


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    price_gbp: Optional[Decimal] = None
    requires_approval: Optional[bool] = None
    approval_reason: Optional[str] = None
    advance_notice_hours: Optional[int] = None
    is_active: Optional[bool] = None
    is_insurance_claimable: Optional[bool] = None
    notes: Optional[str] = None


class ServiceResponse(BaseModel):
    id: str
    category: ServiceCategory
    name: str
    description: Optional[str]
    duration_minutes: Optional[int]
    price_gbp: Decimal
    requires_approval: bool
    approval_reason: Optional[str]
    advance_notice_hours: int
    is_active: bool
    is_insurance_claimable: bool
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Service Request Schemas
class ServiceRequestCreate(BaseModel):
    service_id: str
    horse_id: int
    requested_date: date
    preferred_time: PreferredTime = PreferredTime.ANY
    special_instructions: Optional[str] = None


class ServiceRequestUpdate(BaseModel):
    requested_date: Optional[date] = None
    preferred_time: Optional[PreferredTime] = None
    special_instructions: Optional[str] = None
    status: Optional[RequestStatus] = None
    assigned_to_id: Optional[int] = None
    scheduled_datetime: Optional[datetime] = None
    notes: Optional[str] = None
    charge_amount: Optional[Decimal] = None
    charge_status: Optional[ChargeStatus] = None


class ServiceRequestSchedule(BaseModel):
    assigned_to_id: int
    scheduled_datetime: datetime
    notes: Optional[str] = None


class ServiceRequestComplete(BaseModel):
    notes: Optional[str] = None
    charge_amount: Optional[Decimal] = None
    charge_status: ChargeStatus = ChargeStatus.PENDING


class ServiceRequestQuote(BaseModel):
    """Admin provides a cost estimate for a service request."""
    quote_amount: Decimal
    quote_notes: Optional[str] = None


class ServiceRequestResponse(BaseModel):
    id: int
    service_id: str
    horse_id: int
    requested_by_id: int
    requested_date: date
    preferred_time: PreferredTime
    status: RequestStatus
    assigned_to_id: Optional[int]
    scheduled_datetime: Optional[datetime]
    completed_datetime: Optional[datetime]
    completed_by_id: Optional[int]
    notes: Optional[str]
    special_instructions: Optional[str]
    # Quote fields
    quote_amount: Optional[Decimal] = None
    quote_notes: Optional[str] = None
    quoted_at: Optional[datetime] = None
    quoted_by_id: Optional[int] = None
    quoted_by_name: Optional[str] = None  # Extended field
    # Charge fields
    charge_amount: Optional[Decimal]
    charge_status: ChargeStatus
    # Insurance tracking
    insurance_claimable: bool = False
    created_at: datetime
    updated_at: datetime
    # Rehab-specific fields
    rehab_program_id: Optional[int] = None
    rehab_task_id: Optional[int] = None
    # Recurring fields
    recurring_pattern: RecurringPattern = RecurringPattern.NONE
    recurring_days: Optional[str] = None
    recurring_end_date: Optional[date] = None
    recurring_series_id: Optional[int] = None
    # Extended fields populated by API
    service_name: Optional[str] = None
    service_category: Optional[str] = None
    service_price: Optional[Decimal] = None
    horse_name: Optional[str] = None
    requested_by_name: Optional[str] = None
    assigned_to_name: Optional[str] = None
    # Rehab extended fields
    rehab_program_name: Optional[str] = None
    rehab_task_description: Optional[str] = None

    class Config:
        from_attributes = True


# Rehab Assistance Request Schemas
class RehabAssistanceRequestCreate(BaseModel):
    """Create a rehab assistance request for staff to help with rehab tasks."""
    horse_id: int
    rehab_program_id: int
    start_date: date  # First day of assistance
    end_date: date  # Last day of assistance (same as start_date for single day)
    special_instructions: Optional[str] = None


# Summary for livery clients
class MyServiceRequestsSummary(BaseModel):
    pending_requests: List[ServiceRequestResponse]  # Awaiting admin quote
    quoted_requests: List[ServiceRequestResponse]   # Have quote, awaiting approval
    scheduled_requests: List[ServiceRequestResponse]
    completed_requests: List[ServiceRequestResponse]

    class Config:
        from_attributes = True


# Staff view
class StaffServiceRequestsSummary(BaseModel):
    pending_approval: List[ServiceRequestResponse]
    pending_scheduling: List[ServiceRequestResponse]
    scheduled_today: List[ServiceRequestResponse]
    completed: List[ServiceRequestResponse]

    class Config:
        from_attributes = True


# Insurance claim schemas
class InsuranceClaimItem(BaseModel):
    """Individual item in an insurance statement."""
    service_date: date
    service_name: str
    horse_name: str
    description: str
    amount: Decimal
    service_request_id: Optional[int] = None  # For service requests
    ledger_entry_id: Optional[int] = None  # For livery package charges
    item_type: str = "service"  # "service" or "livery"


class InsuranceStatement(BaseModel):
    """Insurance statement for reimbursement claims."""
    statement_date: date
    period_start: date
    period_end: date
    horse_id: Optional[int] = None
    horse_name: Optional[str] = None
    owner_name: str
    owner_email: str
    items: List[InsuranceClaimItem]
    total_amount: Decimal
    item_count: int


class InsuranceToggle(BaseModel):
    """Toggle insurance_claimable flag on a service request."""
    insurance_claimable: bool

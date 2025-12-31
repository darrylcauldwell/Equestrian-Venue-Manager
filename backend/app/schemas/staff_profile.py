from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


# ============== Staff Profile Schemas ==============

class StaffProfileBase(BaseModel):
    """Base fields for staff profile."""
    # Personal information
    date_of_birth: Optional[date] = None
    bio: Optional[str] = None

    # Employment information
    start_date: Optional[date] = None
    job_title: Optional[str] = None

    # Personal contact details
    personal_email: Optional[str] = None
    personal_phone: Optional[str] = None

    # Home address
    address_street: Optional[str] = None
    address_town: Optional[str] = None
    address_county: Optional[str] = None
    address_postcode: Optional[str] = None

    # Emergency contact
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None

    # Qualifications (JSON array stored as text)
    qualifications: Optional[str] = None

    # DBS/Background check
    dbs_check_date: Optional[date] = None
    dbs_certificate_number: Optional[str] = None

    # Payroll information (mandatory for accountant)
    national_insurance_number: Optional[str] = None  # Format: AB123456C
    bank_account_number: Optional[str] = None  # 8-digit account number
    bank_sort_code: Optional[str] = None  # Format: 12-34-56 or 123456
    bank_account_name: Optional[str] = None  # Name on bank account

    # Tax information (optional)
    tax_code: Optional[str] = None  # e.g., 1257L, BR, 0T
    student_loan_plan: Optional[str] = None  # plan_1, plan_2, plan_4, postgrad, none

    # P45 from previous employer (optional)
    p45_date_left_previous: Optional[date] = None
    p45_tax_paid_previous: Optional[float] = None
    p45_pay_to_date_previous: Optional[float] = None


class StaffProfileCreate(StaffProfileBase):
    """Schema for creating a staff profile."""
    user_id: int


class StaffProfileUpdate(BaseModel):
    """Schema for updating a staff profile (all fields optional)."""
    # Personal information
    date_of_birth: Optional[date] = None
    bio: Optional[str] = None

    # Employment information
    start_date: Optional[date] = None
    job_title: Optional[str] = None

    # Personal contact details
    personal_email: Optional[str] = None
    personal_phone: Optional[str] = None

    # Home address
    address_street: Optional[str] = None
    address_town: Optional[str] = None
    address_county: Optional[str] = None
    address_postcode: Optional[str] = None

    # Emergency contact
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None

    # Qualifications
    qualifications: Optional[str] = None

    # DBS/Background check
    dbs_check_date: Optional[date] = None
    dbs_certificate_number: Optional[str] = None

    # Payroll information
    national_insurance_number: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_sort_code: Optional[str] = None
    bank_account_name: Optional[str] = None

    # Tax information
    tax_code: Optional[str] = None
    student_loan_plan: Optional[str] = None

    # P45 from previous employer
    p45_date_left_previous: Optional[date] = None
    p45_tax_paid_previous: Optional[float] = None
    p45_pay_to_date_previous: Optional[float] = None


class StaffProfileSelfUpdate(BaseModel):
    """Schema for staff updating their own profile (limited fields)."""
    # Personal information
    bio: Optional[str] = None

    # Personal contact details
    personal_email: Optional[str] = None
    personal_phone: Optional[str] = None

    # Home address
    address_street: Optional[str] = None
    address_town: Optional[str] = None
    address_county: Optional[str] = None
    address_postcode: Optional[str] = None

    # Emergency contact
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None


class StaffProfileAdminUpdate(StaffProfileUpdate):
    """Schema for admin updating a staff profile (includes admin-only fields)."""
    notes: Optional[str] = None
    hourly_rate: Optional[float] = None  # Admin-only, for payroll
    # Employment fields (stored on User model, not StaffProfile)
    staff_type: Optional[str] = None  # regular, casual, on_call
    annual_leave_entitlement: Optional[int] = None  # Days per year (for regular staff)
    leaving_date: Optional[date] = None  # Date when staff member leaves


class StaffProfileResponse(StaffProfileBase):
    """Full staff profile response."""
    id: int
    user_id: int
    notes: Optional[str] = None
    hourly_rate: Optional[float] = None  # Admin-only, for payroll
    annual_leave_entitlement: Optional[int] = None  # Days per year (from User model)
    leaving_date: Optional[date] = None  # Date when staff member leaves
    created_at: datetime
    updated_at: datetime

    # User info (populated from relationship)
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_role: Optional[str] = None
    is_yard_staff: Optional[bool] = None
    staff_type: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class StaffProfileSelfResponse(StaffProfileBase):
    """Staff profile response for self-service (excludes admin notes)."""
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    # User info (populated from relationship)
    user_name: Optional[str] = None
    user_email: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ============== Milestone Schemas ==============

class StaffMilestone(BaseModel):
    """Upcoming birthday or work anniversary."""
    user_id: int
    user_name: str
    milestone_type: str  # "birthday" or "anniversary"
    milestone_date: date
    years: Optional[int] = None  # Years of service for anniversaries
    days_until: int


class StaffMilestonesResponse(BaseModel):
    """Response with upcoming milestones."""
    birthdays: List[StaffMilestone]
    anniversaries: List[StaffMilestone]
    has_upcoming: bool


# ============== List Schemas ==============

class StaffProfileListResponse(BaseModel):
    """List of staff profiles."""
    profiles: List[StaffProfileResponse]
    total: int


class StaffProfileSummary(BaseModel):
    """Summary for staff list view."""
    id: int
    user_id: int
    user_name: str
    job_title: Optional[str] = None
    start_date: Optional[date] = None
    user_role: Optional[str] = None
    is_yard_staff: bool = False
    has_dbs_check: bool = False
    dbs_expiring_soon: bool = False
    missing_payroll_fields: List[str] = []  # List of missing payroll field names

    model_config = ConfigDict(from_attributes=True)


# ============== Combined User + Profile Creation ==============

class StaffMemberCreate(StaffProfileBase):
    """Schema for creating a new staff member (user + profile in one step)."""
    # User account fields
    username: str
    email: Optional[str] = None
    name: str
    phone: Optional[str] = None

    # Required profile fields (override optional from base)
    date_of_birth: date  # Required for staff
    start_date: date  # Required for employment records
    job_title: str  # Required for role identification
    emergency_contact_name: str  # Required for health & safety
    emergency_contact_phone: str  # Required for health & safety

    # Employment type and leave entitlement (stored on User model)
    staff_type: Optional[str] = None  # regular, casual, on_call (defaults to regular)
    annual_leave_entitlement: Optional[int] = None  # Days per year (defaults to 28)

    # Payroll fields (optional - can be added later)
    national_insurance_number: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_sort_code: Optional[str] = None
    bank_account_name: Optional[str] = None

    # Admin notes (optional)
    notes: Optional[str] = None


class StaffMemberCreateResponse(BaseModel):
    """Response after creating a new staff member."""
    profile: StaffProfileResponse
    temporary_password: str
    message: str = "Staff member created successfully"

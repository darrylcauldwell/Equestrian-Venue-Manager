"""
Seed Data Validator

Validates seed_data.json structure and content before database import.
Collects ALL validation errors before failing, providing a complete report.
"""

from typing import Any, Dict, List, Optional, Set, Union
from pydantic import BaseModel, Field, field_validator, model_validator
from enum import Enum


class ValidationError:
    """Represents a single validation error."""

    def __init__(self, section: str, index: int, field: str, message: str):
        self.section = section
        self.index = index
        self.field = field
        self.message = message

    def __str__(self) -> str:
        return f"{self.section}[{self.index}].{self.field}: {self.message}"


class ValidationResult:
    """Collects validation errors and provides reporting."""

    def __init__(self):
        self.errors: List[ValidationError] = []
        self.warnings: List[str] = []

    def add_error(self, section: str, index: int, field: str, message: str):
        self.errors.append(ValidationError(section, index, field, message))

    def add_warning(self, message: str):
        self.warnings.append(message)

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0

    def get_report(self) -> str:
        lines = []
        if self.errors:
            lines.append(f"=== VALIDATION ERRORS ({len(self.errors)}) ===")
            for error in self.errors:
                lines.append(f"  - {error}")
        if self.warnings:
            lines.append(f"\n=== WARNINGS ({len(self.warnings)}) ===")
            for warning in self.warnings:
                lines.append(f"  - {warning}")
        if not self.errors:
            lines.append("=== VALIDATION PASSED ===")
        return "\n".join(lines)


# ============================================================================
# Seed Data Schemas
# These schemas validate the seed data format, which differs from API schemas:
# - Uses name references instead of IDs (e.g., "owner_username" instead of "owner_id")
# - Uses relative dates (e.g., "days_from_now": 7 instead of "date": "2024-01-15")
# ============================================================================

class SeedUserSchema(BaseModel):
    username: str
    name: str
    email: str
    password: str
    role: str
    phone: Optional[str] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None

    @field_validator('role')
    @classmethod
    def validate_role(cls, v):
        valid_roles = {'admin', 'coach', 'livery', 'staff', 'public'}
        if v not in valid_roles:
            raise ValueError(f"Invalid role: {v}. Must be one of {valid_roles}")
        return v


class SeedHorseSchema(BaseModel):
    name: str
    owner_username: str
    breed: Optional[str] = None
    color: Optional[str] = None
    age: Optional[int] = None
    height_hands: Optional[float] = None
    microchip_number: Optional[str] = None
    passport_number: Optional[str] = None
    dietary_requirements: Optional[str] = None
    medical_history: Optional[str] = None
    temperament_notes: Optional[str] = None
    turnout_preferences: Optional[str] = None
    emergency_care_consent: Optional[bool] = None
    is_active: Optional[bool] = True


class SeedArenaSchema(BaseModel):
    name: str
    surface_type: Optional[str] = None
    dimensions: Optional[str] = None
    lighting: Optional[bool] = None
    is_indoor: Optional[bool] = None
    is_active: Optional[bool] = True


class SeedLiveryPackageSchema(BaseModel):
    name: str
    description: Optional[str] = None
    price_display: Optional[str] = None
    monthly_price: Optional[float] = None
    weekly_price: Optional[float] = None
    billing_type: Optional[str] = "monthly"
    features: Optional[List[str]] = None
    additional_note: Optional[str] = None
    is_featured: Optional[bool] = False
    display_order: Optional[int] = None
    is_insurance_claimable: Optional[bool] = False


class SeedBookingSchema(BaseModel):
    arena_name: str
    user_username: str
    title: str
    booking_type: str
    booking_status: Optional[str] = "confirmed"
    days_from_now: Optional[int] = None
    hour: Optional[int] = None
    duration_hours: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None

    @model_validator(mode='after')
    def validate_dates(self):
        has_relative = self.days_from_now is not None
        has_absolute = self.start_time is not None
        if not has_relative and not has_absolute:
            raise ValueError("Must provide either 'days_from_now' or 'start_time'")
        return self


class SeedClinicSchema(BaseModel):
    proposed_by_username: str
    title: str
    description: str
    arena_name: str
    coach_name: str
    lesson_format: str
    max_participants: int
    status: str
    days_from_now: int
    hour: int
    duration_hours: int
    max_group_size: Optional[int] = None
    lesson_duration_minutes: Optional[int] = None
    coach_fee_private: Optional[float] = None
    coach_fee_group: Optional[float] = None
    venue_fee_private: Optional[float] = None
    venue_fee_group: Optional[float] = None
    livery_venue_fee_private: Optional[float] = None
    livery_venue_fee_group: Optional[float] = None
    admin_notes: Optional[str] = None

    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        valid_statuses = {'pending', 'approved', 'rejected', 'changes_requested', 'cancelled', 'completed'}
        if v not in valid_statuses:
            raise ValueError(f"Invalid clinic status: {v}")
        return v


class SeedServiceSchema(BaseModel):
    id: str
    name: str
    category: str
    description: Optional[str] = None
    price_gbp: Optional[float] = None
    duration_minutes: Optional[int] = None
    requires_approval: Optional[bool] = False
    approval_reason: Optional[str] = None
    advance_notice_hours: Optional[int] = None
    is_active: Optional[bool] = True
    is_insurance_claimable: Optional[bool] = False
    notes: Optional[str] = None

    @field_validator('category')
    @classmethod
    def validate_category(cls, v):
        valid_categories = {'exercise', 'schooling', 'grooming', 'third_party', 'rehab'}
        if v not in valid_categories:
            raise ValueError(f"Invalid service category: {v}. Must be one of {valid_categories}")
        return v


class SeedServiceRequestSchema(BaseModel):
    service_id: str
    horse_name: str
    owner_username: str
    days_from_now: int
    preferred_time: Optional[str] = "any"
    status: Optional[str] = "pending"
    special_instructions: Optional[str] = None
    charge_amount: Optional[float] = None
    assigned_to_username: Optional[str] = None
    scheduled_hour: Optional[int] = None
    completed_by_username: Optional[str] = None
    notes: Optional[str] = None
    recurring_pattern: Optional[str] = "none"
    recurring_series_id: Optional[int] = None
    recurring_end_days_from_now: Optional[int] = None

    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        valid_statuses = {'pending', 'quoted', 'approved', 'scheduled', 'in_progress', 'completed', 'cancelled'}
        if v not in valid_statuses:
            raise ValueError(f"Invalid service request status: {v}")
        return v

    @field_validator('recurring_pattern')
    @classmethod
    def validate_recurring_pattern(cls, v):
        valid_patterns = {'none', 'daily', 'weekdays', 'custom'}
        if v not in valid_patterns:
            raise ValueError(f"Invalid recurring pattern: {v}")
        return v


class SeedYardTaskSchema(BaseModel):
    title: str
    description: Optional[str] = None
    category: str
    priority: Optional[str] = "medium"
    status: Optional[str] = "open"
    location: Optional[str] = None
    horse_name: Optional[str] = None
    assigned_to_username: Optional[str] = None
    reported_by_username: Optional[str] = None
    assignment_type: Optional[str] = None
    days_from_now: Optional[int] = None

    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        valid_statuses = {'open', 'in_progress', 'completed', 'cancelled'}
        if v not in valid_statuses:
            raise ValueError(f"Invalid task status: {v}")
        return v


class SeedHolidayRequestSchema(BaseModel):
    staff_username: str
    start_date_days_from_now: int
    end_date_days_from_now: int
    days_requested: int
    leave_type: Optional[str] = "annual"
    status: Optional[str] = "pending"
    reason: Optional[str] = None
    approved_by_username: Optional[str] = None
    approval_notes: Optional[str] = None

    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        valid_statuses = {'pending', 'approved', 'rejected', 'cancelled'}
        if v not in valid_statuses:
            raise ValueError(f"Invalid holiday request status: {v}")
        return v


class SeedInvoiceSchema(BaseModel):
    user_username: str
    period_start_months_ago: int
    status: str
    subtotal: float
    payments_received: float
    balance_due: float
    created_by_username: str
    notes: Optional[str] = None
    line_items: List[Dict[str, Any]]

    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        valid_statuses = {'draft', 'issued', 'paid', 'cancelled', 'overdue'}
        if v not in valid_statuses:
            raise ValueError(f"Invalid invoice status: {v}")
        return v


class SeedShiftSchema(BaseModel):
    staff_username: str
    days_from_now: int
    shift_type: str
    role: str
    created_by_username: str
    notes: Optional[str] = None

    @field_validator('shift_type')
    @classmethod
    def validate_shift_type(cls, v):
        valid_types = {'morning', 'afternoon', 'full_day'}
        if v not in valid_types:
            raise ValueError(f"Invalid shift type: {v}")
        return v


class SeedEmergencyContactSchema(BaseModel):
    horse_name: str
    owner_username: str
    contact_type: str
    name: str
    phone: str
    phone_alt: Optional[str] = None
    email: Optional[str] = None
    practice_name: Optional[str] = None
    address: Optional[str] = None
    available_24h: bool = False
    is_primary: bool = False
    notes: Optional[str] = None

    @field_validator('contact_type')
    @classmethod
    def validate_contact_type(cls, v):
        valid_types = {'vet', 'farrier', 'emergency', 'insurance', 'family', 'owner_backup', 'other'}
        if v not in valid_types:
            raise ValueError(f"Invalid contact_type: {v}")
        return v


class SeedProfessionalSchema(BaseModel):
    business_name: str
    category: str
    phone: str
    email: Optional[str] = None
    booking_notes: Optional[str] = None

    @field_validator('category')
    @classmethod
    def validate_category(cls, v):
        valid_categories = {
            'farrier', 'vet', 'equine_dentist', 'dentist', 'physiotherapist', 'chiropractor',
            'saddler', 'nutritionist', 'behaviourist', 'instructor', 'feed_store', 'other'
        }
        if v not in valid_categories:
            raise ValueError(f"Invalid category: {v}")
        return v


class SeedFeedScheduleSchema(BaseModel):
    horse_name: str
    owner_username: str
    morning_feed: str
    evening_feed: str
    supplements: Optional[str] = None
    special_instructions: Optional[str] = None
    supply_status: Optional[str] = None

    @field_validator('supply_status')
    @classmethod
    def validate_supply_status(cls, v):
        if v is not None:
            valid_statuses = {'adequate', 'low', 'order_needed'}
            if v not in valid_statuses:
                raise ValueError(f"Invalid supply_status: {v}")
        return v


class SeedHealthObservationSchema(BaseModel):
    horse_name: str
    owner_username: str
    days_ago: int
    temperature: Optional[float] = None
    appetite: Optional[str] = None
    demeanor: Optional[str] = None
    droppings_normal: bool = True
    concerns: Optional[str] = None
    action_taken: Optional[str] = None
    vet_notified: bool = False
    observed_by_username: str


class SeedWoundCareLogSchema(BaseModel):
    horse_name: str
    owner_username: str
    wound_name: str
    wound_location: str
    wound_description: Optional[str] = None
    days_ago: int
    treatment_given: str
    products_used: Optional[str] = None
    healing_assessment: str
    assessment_notes: Optional[str] = None
    next_treatment_days: Optional[int] = None
    treated_by_username: str
    is_resolved: bool = False

    @field_validator('healing_assessment')
    @classmethod
    def validate_healing_assessment(cls, v):
        valid_assessments = {'improving', 'stable', 'deteriorating', 'infected'}
        if v not in valid_assessments:
            raise ValueError(f"Invalid healing_assessment: {v}")
        return v


class SeedVaccinationRecordSchema(BaseModel):
    horse_name: str
    owner_username: str
    days_ago: int
    vaccine_type: str
    vaccine_name: str
    batch_number: Optional[str] = None
    administered_by: str
    next_due_months: Optional[int] = None
    notes: Optional[str] = None


class SeedWormingRecordSchema(BaseModel):
    horse_name: str
    owner_username: str
    days_ago: int
    product: str
    worm_count_days_ago: Optional[int] = None
    worm_count_result: Optional[int] = None
    next_due_weeks: Optional[int] = None
    notes: Optional[str] = None


class SeedDentistRecordSchema(BaseModel):
    horse_name: str
    owner_username: str
    days_ago: int
    dentist_name: str
    treatment: str
    cost: Optional[float] = None
    next_due_months: Optional[int] = None
    notes: Optional[str] = None


class SeedFarrierRecordSchema(BaseModel):
    horse_name: str
    owner_username: str
    days_ago: int
    farrier_name: str
    work_done: str
    cost: Optional[float] = None
    next_due_weeks: Optional[int] = None
    notes: Optional[str] = None


class SeedFeedAdditionSchema(BaseModel):
    horse_name: str
    owner_username: str
    name: str
    dosage: str
    feed_time: str
    start_days_ago: int
    end_days_from_now: Optional[int] = None
    reason: str
    status: str
    requested_by_username: str
    approved_by_username: Optional[str] = None

    @field_validator('feed_time')
    @classmethod
    def validate_feed_time(cls, v):
        valid_times = {'morning', 'evening', 'both'}
        if v not in valid_times:
            raise ValueError(f"Invalid feed_time: {v}")
        return v

    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        valid_statuses = {'pending', 'approved', 'rejected', 'active', 'expired'}
        if v not in valid_statuses:
            raise ValueError(f"Invalid status: {v}")
        return v


class SeedHorseCompanionSchema(BaseModel):
    horse_name: str
    owner_username: str
    companion_name: str
    companion_owner_username: str
    relationship_type: str
    notes: Optional[str] = None

    @field_validator('relationship_type')
    @classmethod
    def validate_relationship_type(cls, v):
        valid_relationships = {'bonded', 'preferred', 'friendly', 'compatible', 'neutral', 'incompatible'}
        if v not in valid_relationships:
            raise ValueError(f"Invalid relationship_type: {v}")
        return v


class SeedNoticeSchema(BaseModel):
    author_username: str
    title: str
    content: str
    category: str
    priority: str
    is_pinned: bool = False

    @field_validator('category')
    @classmethod
    def validate_category(cls, v):
        valid_categories = {'general', 'urgent', 'event', 'maintenance', 'reminder', 'announcement'}
        if v not in valid_categories:
            raise ValueError(f"Invalid category: {v}")
        return v

    @field_validator('priority')
    @classmethod
    def validate_priority(cls, v):
        valid_priorities = {'low', 'normal', 'medium', 'high'}
        if v not in valid_priorities:
            raise ValueError(f"Invalid priority: {v}")
        return v


class SeedFieldSchema(BaseModel):
    name: str
    size_acres: float
    surface_type: Optional[str] = None
    has_shelter: bool = False
    has_water: bool = False
    has_electric_fence: bool = False
    max_occupancy: Optional[int] = None
    is_active: bool = True
    maintenance_notes: Optional[str] = None


class SeedTurnoutRequestSchema(BaseModel):
    horse_name: str
    owner_username: str
    turnout_type: str
    days_from_now: int
    field_preference: Optional[str] = None
    notes: Optional[str] = None
    status: str
    reviewed_by_username: Optional[str] = None
    response_message: Optional[str] = None

    @field_validator('turnout_type')
    @classmethod
    def validate_turnout_type(cls, v):
        valid_types = {'out', 'in', 'change'}
        if v not in valid_types:
            raise ValueError(f"Invalid turnout_type: {v}")
        return v

    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        valid_statuses = {'pending', 'approved', 'rejected', 'declined', 'completed'}
        if v not in valid_statuses:
            raise ValueError(f"Invalid status: {v}")
        return v


class SeedHolidayLiveryRequestSchema(BaseModel):
    guest_name: str
    guest_email: str
    guest_phone: Optional[str] = None
    horse_name: str
    horse_breed: Optional[str] = None
    horse_age: Optional[int] = None
    horse_colour: Optional[str] = None
    horse_gender: Optional[str] = None
    special_requirements: Optional[str] = None
    requested_arrival_days_from_now: int
    requested_departure_days_from_now: int
    message: Optional[str] = None
    status: str
    admin_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    confirmed_arrival_days_from_now: Optional[int] = None
    confirmed_departure_days_from_now: Optional[int] = None
    assigned_stable_name: Optional[str] = None
    processed_by_username: Optional[str] = None

    @field_validator('status')
    @classmethod
    def validate_status(cls, v):
        valid_statuses = {'pending', 'approved', 'rejected', 'cancelled'}
        if v not in valid_statuses:
            raise ValueError(f"Invalid status: {v}")
        return v

    @field_validator('horse_gender')
    @classmethod
    def validate_gender(cls, v):
        if v is None:
            return v
        valid_genders = {'mare', 'gelding', 'stallion', 'colt', 'filly'}
        if v.lower() not in valid_genders:
            raise ValueError(f"Invalid horse_gender: {v}")
        return v


class SeedStableBlockSchema(BaseModel):
    name: str
    sequence: int
    is_active: bool = True
    stables: List[Dict[str, Any]]


class SeedStaffProfileSchema(BaseModel):
    """Schema for staff profile seed data validation."""
    username: str  # Reference to user
    date_of_birth: Optional[str] = None
    bio: Optional[str] = None
    start_date: Optional[str] = None
    job_title: Optional[str] = None
    personal_email: Optional[str] = None
    personal_phone: Optional[str] = None
    address_street: Optional[str] = None
    address_town: Optional[str] = None
    address_county: Optional[str] = None
    address_postcode: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None
    qualifications: Optional[str] = None  # Comma-separated string
    dbs_check_date: Optional[str] = None
    dbs_certificate_number: Optional[str] = None
    notes: Optional[str] = None


class SeedCoachProfileSchema(BaseModel):
    username: str
    disciplines: List[str]
    teaching_description: str
    bio: str
    availability_mode: str
    booking_mode: str
    lesson_duration_minutes: int
    coach_fee: float
    venue_fee: float
    livery_venue_fee: int
    is_active: bool
    approved_by_username: str
    recurring_schedules: List[Dict[str, Any]]


class SeedLessonRequestSchema(BaseModel):
    coach_username: str
    user_username: Optional[str] = None
    horse_name: Optional[str] = None
    discipline: str
    days_from_now: int
    requested_time: str
    notes: Optional[str] = None
    coach_fee: float
    venue_fee: float
    total_price: float
    status: str
    payment_status: str


class SeedRehabProgramSchema(BaseModel):
    horse_name: str
    owner_username: str
    name: str
    description: str
    reason: str
    prescribed_by: str
    start_days_ago: int
    duration_weeks: int
    status: str
    current_phase: int
    created_by_username: str
    notes: Optional[str] = None
    phases: List[Dict[str, Any]]


class SeedTimesheetSchema(BaseModel):
    staff_username: str
    days_ago: int
    clock_in: str
    clock_out: str
    break_minutes: int
    work_type: str
    notes: Optional[str] = None
    status: str
    hours_since_submitted: Optional[int] = None


class SeedUnplannedAbsenceSchema(BaseModel):
    staff_username: str
    days_ago: int
    reason: str
    notes: Optional[str] = None


class SeedLedgerEntrySchema(BaseModel):
    user_username: str
    transaction_type: str
    amount: float
    description: str
    days_ago: int
    created_by_username: str
    reference: Optional[str] = None
    notes: Optional[str] = None

    @field_validator('transaction_type')
    @classmethod
    def validate_transaction_type(cls, v):
        # Must match TransactionType enum in app/models/account.py
        valid_types = {
            'package_charge', 'service_charge', 'payment', 'credit', 'adjustment'
        }
        if v not in valid_types:
            raise ValueError(f"Invalid transaction_type: {v}")
        return v


class SeedComplianceItemSchema(BaseModel):
    name: str
    category: str
    description: str
    provider: Optional[str] = None
    reference_number: Optional[str] = None
    renewal_frequency_months: int
    reminder_days_before: int
    days_until_due: int

    @field_validator('category')
    @classmethod
    def validate_category(cls, v):
        valid_categories = {
            'health_safety', 'insurance', 'licensing', 'environmental',
            'employment', 'data_protection', 'welfare', 'maintenance',
            'fire_safety', 'legal', 'training', 'electrical', 'first_aid', 'equipment'
        }
        if v not in valid_categories:
            raise ValueError(f"Invalid category: {v}")
        return v


class SeedSiteSettingsSchema(BaseModel):
    """Site settings is a single dict object, not a list."""
    venue_name: str
    venue_tagline: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address_street: Optional[str] = None
    address_town: Optional[str] = None
    address_county: Optional[str] = None
    address_postcode: Optional[str] = None
    gate_code: Optional[str] = None
    key_safe_code: Optional[str] = None

    class Config:
        extra = 'allow'  # Allow extra fields not defined here


# ============================================================================
# Main Validation Function
# ============================================================================

# Mapping of seed data sections to their schemas
SECTION_SCHEMAS = {
    'users': SeedUserSchema,
    'horses': SeedHorseSchema,
    'arenas': SeedArenaSchema,
    'livery_packages': SeedLiveryPackageSchema,
    'bookings': SeedBookingSchema,
    'clinics': SeedClinicSchema,
    'services': SeedServiceSchema,
    'service_requests': SeedServiceRequestSchema,
    'yard_tasks': SeedYardTaskSchema,
    'holiday_requests': SeedHolidayRequestSchema,
    'invoices': SeedInvoiceSchema,
    'shifts': SeedShiftSchema,
    # Health & Care Records
    'emergency_contacts': SeedEmergencyContactSchema,
    'health_observations': SeedHealthObservationSchema,
    'wound_care_logs': SeedWoundCareLogSchema,
    'vaccination_records': SeedVaccinationRecordSchema,
    'worming_records': SeedWormingRecordSchema,
    'dentist_records': SeedDentistRecordSchema,
    'farrier_records': SeedFarrierRecordSchema,
    # Feeding & Care
    'feed_schedules': SeedFeedScheduleSchema,
    'feed_additions': SeedFeedAdditionSchema,
    'horse_companions': SeedHorseCompanionSchema,
    # Facilities & Operations
    'professionals': SeedProfessionalSchema,
    'notices': SeedNoticeSchema,
    'fields': SeedFieldSchema,
    'turnout_requests': SeedTurnoutRequestSchema,
    'holiday_livery_requests': SeedHolidayLiveryRequestSchema,
    'stable_blocks': SeedStableBlockSchema,
    # Training & Lessons
    'coach_profiles': SeedCoachProfileSchema,
    'lesson_requests': SeedLessonRequestSchema,
    'rehab_programs': SeedRehabProgramSchema,
    # Staff & Admin
    'staff_profiles': SeedStaffProfileSchema,
    'timesheets': SeedTimesheetSchema,
    'unplanned_absences': SeedUnplannedAbsenceSchema,
    'ledger_entries': SeedLedgerEntrySchema,
    'compliance_items': SeedComplianceItemSchema,
    # Settings (single object, not list)
    'site_settings': SeedSiteSettingsSchema,
}


def validate_seed_data(data: Dict[str, Any]) -> ValidationResult:
    """
    Validate seed data against schemas.

    Collects ALL validation errors before returning, allowing users
    to see all issues at once rather than fixing one at a time.

    Args:
        data: The seed data dictionary

    Returns:
        ValidationResult with all errors and warnings
    """
    result = ValidationResult()

    # Track referenced entities for cross-reference validation
    usernames: Set[str] = set()
    horse_names: Set[str] = set()
    arena_names: Set[str] = set()
    service_ids: Set[str] = set()

    # First pass: collect all entity names/IDs
    for user in data.get('users', []):
        if 'username' in user:
            usernames.add(user['username'])

    for horse in data.get('horses', []):
        if 'name' in horse:
            horse_names.add(horse['name'])

    for arena in data.get('arenas', []):
        if 'name' in arena:
            arena_names.add(arena['name'])

    for service in data.get('services', []):
        if 'id' in service:
            service_ids.add(service['id'])

    # Second pass: validate each section
    for section, schema in SECTION_SCHEMAS.items():
        section_data = data.get(section)

        # Skip if section doesn't exist
        if section_data is None:
            continue

        # Handle dict sections (like site_settings) - single object
        if isinstance(section_data, dict):
            try:
                schema.model_validate(section_data)
            except Exception as e:
                if hasattr(e, 'errors'):
                    for err in e.errors():
                        field = '.'.join(str(loc) for loc in err['loc'])
                        result.add_error(section, 0, field, err['msg'])
                else:
                    result.add_error(section, 0, '_', str(e))

        # Handle list sections - array of items
        elif isinstance(section_data, list):
            for idx, item in enumerate(section_data):
                # Skip comment entries (used for organizing seed data)
                if isinstance(item, dict) and '_comment' in item:
                    continue
                try:
                    schema.model_validate(item)
                except Exception as e:
                    # Parse Pydantic validation errors
                    error_msg = str(e)
                    if hasattr(e, 'errors'):
                        for err in e.errors():
                            field = '.'.join(str(loc) for loc in err['loc'])
                            result.add_error(section, idx, field, err['msg'])
                    else:
                        result.add_error(section, idx, '_', error_msg)

    # Third pass: validate cross-references
    for idx, horse in enumerate(data.get('horses', [])):
        owner = horse.get('owner_username')
        if owner and owner not in usernames:
            result.add_error('horses', idx, 'owner_username',
                           f"Unknown user: '{owner}'")

    for idx, booking in enumerate(data.get('bookings', [])):
        arena = booking.get('arena_name')
        if arena and arena not in arena_names:
            result.add_error('bookings', idx, 'arena_name',
                           f"Unknown arena: '{arena}'")
        user = booking.get('user_username')
        if user and user not in usernames:
            result.add_error('bookings', idx, 'user_username',
                           f"Unknown user: '{user}'")

    for idx, clinic in enumerate(data.get('clinics', [])):
        arena = clinic.get('arena_name')
        if arena and arena not in arena_names:
            result.add_error('clinics', idx, 'arena_name',
                           f"Unknown arena: '{arena}'")
        proposer = clinic.get('proposed_by_username')
        if proposer and proposer not in usernames:
            result.add_error('clinics', idx, 'proposed_by_username',
                           f"Unknown user: '{proposer}'")

    for idx, request in enumerate(data.get('service_requests', [])):
        service = request.get('service_id')
        if service and service not in service_ids:
            result.add_error('service_requests', idx, 'service_id',
                           f"Unknown service: '{service}'")
        horse = request.get('horse_name')
        if horse and horse not in horse_names:
            result.add_error('service_requests', idx, 'horse_name',
                           f"Unknown horse: '{horse}'")
        owner = request.get('owner_username')
        if owner and owner not in usernames:
            result.add_error('service_requests', idx, 'owner_username',
                           f"Unknown user: '{owner}'")

    for idx, task in enumerate(data.get('yard_tasks', [])):
        horse = task.get('horse_name')
        if horse and horse not in horse_names:
            result.add_error('yard_tasks', idx, 'horse_name',
                           f"Unknown horse: '{horse}'")
        assignee = task.get('assigned_to_username')
        if assignee and assignee not in usernames:
            result.add_error('yard_tasks', idx, 'assigned_to_username',
                           f"Unknown user: '{assignee}'")
        reporter = task.get('reported_by_username')
        if reporter and reporter not in usernames:
            result.add_error('yard_tasks', idx, 'reported_by_username',
                           f"Unknown user: '{reporter}'")

    for idx, request in enumerate(data.get('holiday_requests', [])):
        staff = request.get('staff_username')
        if staff and staff not in usernames:
            result.add_error('holiday_requests', idx, 'staff_username',
                           f"Unknown user: '{staff}'")

    for idx, invoice in enumerate(data.get('invoices', [])):
        user = invoice.get('user_username')
        if user and user not in usernames:
            result.add_error('invoices', idx, 'user_username',
                           f"Unknown user: '{user}'")
        creator = invoice.get('created_by_username')
        if creator and creator not in usernames:
            result.add_error('invoices', idx, 'created_by_username',
                           f"Unknown user: '{creator}'")

    for idx, shift in enumerate(data.get('shifts', [])):
        # Skip comment entries
        if isinstance(shift, dict) and '_comment' in shift:
            continue
        staff = shift.get('staff_username')
        if staff and staff not in usernames:
            result.add_error('shifts', idx, 'staff_username',
                           f"Unknown user: '{staff}'")
        creator = shift.get('created_by_username')
        if creator and creator not in usernames:
            result.add_error('shifts', idx, 'created_by_username',
                           f"Unknown user: '{creator}'")

    # Add warnings for sections without schemas (not validated but tracked)
    unvalidated_sections = set(data.keys()) - set(SECTION_SCHEMAS.keys())
    for section in unvalidated_sections:
        if data.get(section):
            result.add_warning(f"Section '{section}' has no validation schema (skipped)")

    return result


class SeedValidationError(Exception):
    """Raised when seed data validation fails."""

    def __init__(self, result: ValidationResult):
        self.result = result
        super().__init__(result.get_report())

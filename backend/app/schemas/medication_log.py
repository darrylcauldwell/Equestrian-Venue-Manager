from datetime import datetime, date, time
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, field_validator
from enum import Enum


# ============== Enums ==============

class HealingStatus(str, Enum):
    IMPROVING = "improving"
    STABLE = "stable"
    WORSENING = "worsening"
    INFECTED = "infected"
    HEALED = "healed"


class AppetiteStatus(str, Enum):
    NORMAL = "normal"
    REDUCED = "reduced"
    NOT_EATING = "not_eating"
    INCREASED = "increased"


class DemeanorStatus(str, Enum):
    BRIGHT = "bright"
    QUIET = "quiet"
    LETHARGIC = "lethargic"
    AGITATED = "agitated"


class RehabStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TaskFrequency(str, Enum):
    DAILY = "daily"
    TWICE_DAILY = "twice_daily"
    EVERY_OTHER_DAY = "every_other_day"
    WEEKLY = "weekly"
    AS_NEEDED = "as_needed"


# ============== Medication Admin Log ==============

class MedicationAdminLogCreate(BaseModel):
    feed_addition_id: int
    horse_id: int
    admin_date: date
    feed_time: str  # "morning" or "evening"
    was_given: bool
    skip_reason: Optional[str] = None
    notes: Optional[str] = None


class MedicationAdminLogResponse(BaseModel):
    id: int
    feed_addition_id: int
    horse_id: int
    admin_date: date
    feed_time: str
    was_given: bool
    skip_reason: Optional[str]
    given_by_id: int
    given_at: Optional[datetime]
    notes: Optional[str]
    # Nested info
    horse_name: Optional[str] = None
    medication_name: Optional[str] = None
    dosage: Optional[str] = None
    given_by_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class MedicationDueItem(BaseModel):
    """A medication that needs to be administered."""
    id: int  # Unique identifier for this due item
    feed_addition_id: int
    horse_id: int
    horse_name: str
    stable_name: Optional[str] = None
    item_name: str  # Medication/supplement name
    quantity: Optional[str] = None  # Dosage amount
    instructions: Optional[str] = None
    feed_time: str  # morning, evening, both
    was_given: Optional[bool] = None  # None=pending, True=given, False=skipped
    skip_reason: Optional[str] = None
    given_by_name: Optional[str] = None


# ============== Wound Care Log ==============

class WoundCareLogCreate(BaseModel):
    wound_name: str
    wound_location: Optional[str] = None
    wound_description: Optional[str] = None
    treatment_date: date
    treatment_time: Optional[time] = None
    treatment_given: str
    products_used: Optional[str] = None
    healing_assessment: Optional[HealingStatus] = None
    assessment_notes: Optional[str] = None
    next_treatment_due: Optional[date] = None


class WoundCareLogUpdate(BaseModel):
    wound_name: Optional[str] = None
    wound_location: Optional[str] = None
    wound_description: Optional[str] = None
    treatment_given: Optional[str] = None
    products_used: Optional[str] = None
    healing_assessment: Optional[HealingStatus] = None
    assessment_notes: Optional[str] = None
    next_treatment_due: Optional[date] = None
    is_resolved: Optional[bool] = None
    resolved_date: Optional[date] = None


class WoundCareLogResponse(BaseModel):
    id: int
    horse_id: int
    wound_name: str
    wound_location: Optional[str]
    wound_description: Optional[str]
    treatment_date: date
    treatment_time: Optional[time]
    treatment_given: str
    products_used: Optional[str]
    healing_assessment: Optional[HealingStatus]
    assessment_notes: Optional[str]
    next_treatment_due: Optional[date]
    treated_by_id: int
    created_at: Optional[datetime]
    is_resolved: bool
    resolved_date: Optional[date]
    # Nested
    horse_name: Optional[str] = None
    treated_by_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ActiveWoundSummary(BaseModel):
    """Summary of an active wound case."""
    id: int
    horse_id: int
    horse_name: str
    wound_name: str
    wound_location: Optional[str]
    healing_assessment: Optional[HealingStatus]
    next_treatment_due: Optional[date]
    last_treatment_date: date
    treatment_count: int = 1


# ============== Health Observation ==============

class HealthObservationCreate(BaseModel):
    observation_date: date
    observation_time: Optional[time] = None
    temperature: Optional[float] = None
    appetite: Optional[AppetiteStatus] = None
    demeanor: Optional[DemeanorStatus] = None
    droppings_normal: Optional[bool] = None
    concerns: Optional[str] = None
    action_taken: Optional[str] = None
    vet_notified: bool = False


class HealthObservationResponse(BaseModel):
    id: int
    horse_id: int
    observation_date: date
    observation_time: Optional[time]
    temperature: Optional[float]
    appetite: Optional[AppetiteStatus]
    demeanor: Optional[DemeanorStatus]
    droppings_normal: Optional[bool]
    concerns: Optional[str]
    action_taken: Optional[str]
    vet_notified: bool
    observed_by_id: int
    created_at: Optional[datetime]
    # Nested
    horse_name: Optional[str] = None
    observed_by_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ============== Rehab Program ==============

class RehabTaskCreate(BaseModel):
    task_type: str  # walk, trot, raised_poles, ice, poultice, etc.
    description: str
    duration_minutes: Optional[int] = None
    frequency: TaskFrequency = TaskFrequency.DAILY
    instructions: Optional[str] = None
    equipment_needed: Optional[str] = None
    is_feed_based: bool = False  # If True, shows in feed schedule instead of yard tasks
    feed_time: Optional[str] = None  # morning, evening, both - only used when is_feed_based=True
    sequence: int = 0

    @field_validator('instructions', 'equipment_needed', 'feed_time', mode='before')
    @classmethod
    def empty_string_to_none(cls, v):
        if v == '':
            return None
        return v


class RehabTaskResponse(BaseModel):
    id: int
    phase_id: int
    task_type: str
    description: str
    duration_minutes: Optional[int]
    frequency: TaskFrequency
    instructions: Optional[str]
    equipment_needed: Optional[str]
    is_feed_based: bool = False
    feed_time: Optional[str] = None
    sequence: int
    created_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class RehabPhaseCreate(BaseModel):
    phase_number: int
    name: str
    description: Optional[str] = None
    duration_days: int
    start_day: int
    tasks: List[RehabTaskCreate] = []

    @field_validator('description', mode='before')
    @classmethod
    def empty_string_to_none(cls, v):
        if v == '':
            return None
        return v


class RehabPhaseResponse(BaseModel):
    id: int
    program_id: int
    phase_number: int
    name: str
    description: Optional[str]
    duration_days: int
    start_day: int
    is_completed: bool
    completed_date: Optional[date]
    completion_notes: Optional[str]
    created_at: Optional[datetime]
    tasks: List[RehabTaskResponse] = []

    model_config = ConfigDict(from_attributes=True)


class RehabProgramCreate(BaseModel):
    horse_id: int
    name: str
    description: Optional[str] = None
    reason: Optional[str] = None
    prescribed_by: Optional[str] = None
    prescription_date: Optional[date] = None
    start_date: date
    expected_end_date: Optional[date] = None
    notes: Optional[str] = None
    staff_managed: bool = False  # When True, all tasks handled by staff
    weekly_care_price: Optional[float] = None  # Weekly supplement charge for staff-managed care
    phases: List[RehabPhaseCreate] = []

    @field_validator('prescription_date', 'expected_end_date', mode='before')
    @classmethod
    def empty_string_to_none_date(cls, v):
        if v == '':
            return None
        return v

    @field_validator('description', 'reason', 'prescribed_by', 'notes', mode='before')
    @classmethod
    def empty_string_to_none_str(cls, v):
        if v == '':
            return None
        return v


class RehabProgramUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    reason: Optional[str] = None
    prescribed_by: Optional[str] = None
    prescription_date: Optional[date] = None
    start_date: Optional[date] = None
    expected_end_date: Optional[date] = None
    status: Optional[RehabStatus] = None
    current_phase: Optional[int] = None
    notes: Optional[str] = None
    staff_managed: Optional[bool] = None
    weekly_care_price: Optional[float] = None
    actual_end_date: Optional[date] = None


class RehabProgramResponse(BaseModel):
    id: int
    horse_id: int
    name: str
    description: Optional[str]
    reason: Optional[str]
    prescribed_by: Optional[str]
    prescription_date: Optional[date]
    start_date: date
    expected_end_date: Optional[date]
    actual_end_date: Optional[date]
    status: RehabStatus
    current_phase: int
    notes: Optional[str]
    staff_managed: bool = False
    weekly_care_price: Optional[float] = None
    created_by_id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    # Nested
    horse_name: Optional[str] = None
    created_by_name: Optional[str] = None
    phases: List[RehabPhaseResponse] = []

    model_config = ConfigDict(from_attributes=True)


class RehabProgramSummary(BaseModel):
    """Summary for list views."""
    id: int
    horse_id: int
    horse_name: str
    name: str
    status: RehabStatus
    start_date: date
    expected_end_date: Optional[date]
    current_phase: int
    total_phases: int
    completed_phases: int
    staff_managed: bool = False
    weekly_care_price: Optional[float] = None


# ============== Rehab Task Log ==============

class RehabTaskLogCreate(BaseModel):
    task_id: int
    program_id: int
    horse_id: int
    log_date: date
    feed_time: Optional[str] = None
    was_completed: bool
    skip_reason: Optional[str] = None
    actual_duration_minutes: Optional[int] = None
    horse_response: Optional[str] = None
    concerns: Optional[str] = None
    vet_notified: bool = False
    lameness_score: Optional[int] = None  # AAEP scale: 0=sound, 5=non-weight bearing
    physical_observations: Optional[str] = None  # Swelling, heat, filling, etc.


class RehabTaskLogResponse(BaseModel):
    id: int
    task_id: int
    program_id: int
    horse_id: int
    log_date: date
    feed_time: Optional[str]
    was_completed: bool
    skip_reason: Optional[str]
    actual_duration_minutes: Optional[int]
    horse_response: Optional[str]
    concerns: Optional[str]
    vet_notified: bool
    lameness_score: Optional[int] = None
    physical_observations: Optional[str] = None
    completed_by_id: int
    completed_at: Optional[datetime]
    # Nested
    task_description: Optional[str] = None
    completed_by_name: Optional[str] = None
    # Attribution fields for livery feedback
    completed_by_role: Optional[str] = None  # 'livery', 'staff', 'admin'
    completed_via: Optional[str] = None  # 'direct', 'yard_tasks', 'service_request'

    model_config = ConfigDict(from_attributes=True)


class DailyRehabTask(BaseModel):
    """A rehab task due for today."""
    task_id: int
    program_id: int
    horse_id: int
    horse_name: str
    program_name: str
    phase_name: str
    task_type: str
    description: str
    duration_minutes: Optional[int]
    frequency: TaskFrequency
    instructions: Optional[str]
    equipment_needed: Optional[str]
    is_logged: bool = False
    log_id: Optional[int] = None

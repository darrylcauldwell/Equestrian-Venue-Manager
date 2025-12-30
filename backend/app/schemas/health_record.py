from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel
from app.models.health_record import VaccineType


# Farrier Records
class FarrierRecordCreate(BaseModel):
    visit_date: date
    farrier_name: Optional[str] = None
    work_done: str
    cost: Optional[Decimal] = None
    next_due: Optional[date] = None
    notes: Optional[str] = None


class FarrierRecordUpdate(BaseModel):
    visit_date: Optional[date] = None
    farrier_name: Optional[str] = None
    work_done: Optional[str] = None
    cost: Optional[Decimal] = None
    next_due: Optional[date] = None
    notes: Optional[str] = None


class FarrierRecordResponse(BaseModel):
    id: int
    horse_id: int
    visit_date: date
    farrier_name: Optional[str]
    work_done: str
    cost: Optional[Decimal]
    next_due: Optional[date]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Dentist Records
class DentistRecordCreate(BaseModel):
    visit_date: date
    dentist_name: Optional[str] = None
    treatment: str
    cost: Optional[Decimal] = None
    next_due: Optional[date] = None
    notes: Optional[str] = None


class DentistRecordUpdate(BaseModel):
    visit_date: Optional[date] = None
    dentist_name: Optional[str] = None
    treatment: Optional[str] = None
    cost: Optional[Decimal] = None
    next_due: Optional[date] = None
    notes: Optional[str] = None


class DentistRecordResponse(BaseModel):
    id: int
    horse_id: int
    visit_date: date
    dentist_name: Optional[str]
    treatment: str
    cost: Optional[Decimal]
    next_due: Optional[date]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Vaccination Records
class VaccinationRecordCreate(BaseModel):
    vaccination_date: date
    vaccine_type: VaccineType
    vaccine_name: Optional[str] = None
    batch_number: Optional[str] = None
    administered_by: Optional[str] = None
    next_due: Optional[date] = None
    notes: Optional[str] = None


class VaccinationRecordUpdate(BaseModel):
    vaccination_date: Optional[date] = None
    vaccine_type: Optional[VaccineType] = None
    vaccine_name: Optional[str] = None
    batch_number: Optional[str] = None
    administered_by: Optional[str] = None
    next_due: Optional[date] = None
    notes: Optional[str] = None


class VaccinationRecordResponse(BaseModel):
    id: int
    horse_id: int
    vaccination_date: date
    vaccine_type: VaccineType
    vaccine_name: Optional[str]
    batch_number: Optional[str]
    administered_by: Optional[str]
    next_due: Optional[date]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Worming Records
class WormingRecordCreate(BaseModel):
    treatment_date: date
    product: str
    worm_count_date: Optional[date] = None
    worm_count_result: Optional[int] = None
    cost: Optional[Decimal] = None
    next_due: Optional[date] = None
    notes: Optional[str] = None


class WormingRecordUpdate(BaseModel):
    treatment_date: Optional[date] = None
    product: Optional[str] = None
    worm_count_date: Optional[date] = None
    worm_count_result: Optional[int] = None
    cost: Optional[Decimal] = None
    next_due: Optional[date] = None
    notes: Optional[str] = None


class WormingRecordResponse(BaseModel):
    id: int
    horse_id: int
    treatment_date: date
    product: str
    worm_count_date: Optional[date]
    worm_count_result: Optional[int]
    cost: Optional[Decimal]
    next_due: Optional[date]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Weight Records
class WeightRecordCreate(BaseModel):
    record_date: date
    weight_kg: Decimal
    unit_entered: str = "kg"  # "kg" or "lbs"
    method: Optional[str] = None
    notes: Optional[str] = None


class WeightRecordUpdate(BaseModel):
    record_date: Optional[date] = None
    weight_kg: Optional[Decimal] = None
    unit_entered: Optional[str] = None
    method: Optional[str] = None
    notes: Optional[str] = None


class WeightRecordResponse(BaseModel):
    id: int
    horse_id: int
    record_date: date
    weight_kg: Decimal
    unit_entered: str
    method: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Body Condition Records
class BodyConditionRecordCreate(BaseModel):
    record_date: date
    score: int  # 1-9 Henneke scale
    assessed_by: Optional[str] = None
    notes: Optional[str] = None


class BodyConditionRecordUpdate(BaseModel):
    record_date: Optional[date] = None
    score: Optional[int] = None
    assessed_by: Optional[str] = None
    notes: Optional[str] = None


class BodyConditionRecordResponse(BaseModel):
    id: int
    horse_id: int
    record_date: date
    score: int
    assessed_by: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Saddle Records
class SaddleCreate(BaseModel):
    name: str  # e.g., "My Dressage Saddle", "Brown GP"
    saddle_type: str  # "gp", "dressage", "jump", "endurance", "other"
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    purchase_date: Optional[date] = None
    is_active: int = 1  # 1 = active, 0 = retired/sold
    notes: Optional[str] = None


class SaddleUpdate(BaseModel):
    name: Optional[str] = None
    saddle_type: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    purchase_date: Optional[date] = None
    is_active: Optional[int] = None
    notes: Optional[str] = None


class SaddleResponse(BaseModel):
    id: int
    horse_id: int
    name: str
    saddle_type: str
    brand: Optional[str]
    model: Optional[str]
    serial_number: Optional[str]
    purchase_date: Optional[date]
    is_active: int
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Saddle Fit Records
class SaddleFitRecordCreate(BaseModel):
    saddle_id: Optional[int] = None  # Link to specific saddle
    check_date: date
    fitter_name: Optional[str] = None
    saddle_type: Optional[str] = None  # Legacy field for backwards compatibility
    fit_status: str  # "good", "needs_adjustment", "needs_replacing"
    adjustments_made: Optional[str] = None
    next_check_due: Optional[date] = None
    cost: Optional[Decimal] = None
    notes: Optional[str] = None


class SaddleFitRecordUpdate(BaseModel):
    saddle_id: Optional[int] = None
    check_date: Optional[date] = None
    fitter_name: Optional[str] = None
    saddle_type: Optional[str] = None
    fit_status: Optional[str] = None
    adjustments_made: Optional[str] = None
    next_check_due: Optional[date] = None
    cost: Optional[Decimal] = None
    notes: Optional[str] = None


class SaddleFitRecordResponse(BaseModel):
    id: int
    horse_id: int
    saddle_id: Optional[int]
    check_date: date
    fitter_name: Optional[str]
    saddle_type: Optional[str]
    fit_status: str
    adjustments_made: Optional[str]
    next_check_due: Optional[date]
    cost: Optional[Decimal]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    saddle: Optional[SaddleResponse] = None

    class Config:
        from_attributes = True


# Physio Records
class PhysioRecordCreate(BaseModel):
    session_date: date
    practitioner_name: Optional[str] = None
    treatment_type: str  # e.g., "massage", "stretching", "laser", "ultrasound"
    areas_treated: Optional[str] = None
    findings: Optional[str] = None
    treatment_notes: Optional[str] = None
    recommendations: Optional[str] = None
    next_session_due: Optional[date] = None
    cost: Optional[Decimal] = None


class PhysioRecordUpdate(BaseModel):
    session_date: Optional[date] = None
    practitioner_name: Optional[str] = None
    treatment_type: Optional[str] = None
    areas_treated: Optional[str] = None
    findings: Optional[str] = None
    treatment_notes: Optional[str] = None
    recommendations: Optional[str] = None
    next_session_due: Optional[date] = None
    cost: Optional[Decimal] = None


class PhysioRecordResponse(BaseModel):
    id: int
    horse_id: int
    session_date: date
    practitioner_name: Optional[str]
    treatment_type: str
    areas_treated: Optional[str]
    findings: Optional[str]
    treatment_notes: Optional[str]
    recommendations: Optional[str]
    next_session_due: Optional[date]
    cost: Optional[Decimal]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Summary response for all health records
class HealthRecordsSummary(BaseModel):
    horse_id: int
    horse_name: str
    farrier_records: list[FarrierRecordResponse]
    dentist_records: list[DentistRecordResponse]
    vaccination_records: list[VaccinationRecordResponse]
    worming_records: list[WormingRecordResponse]
    weight_records: list[WeightRecordResponse]
    body_condition_records: list[BodyConditionRecordResponse]
    saddle_fit_records: list[SaddleFitRecordResponse]
    physio_records: list[PhysioRecordResponse]
    next_farrier_due: Optional[date] = None
    next_dentist_due: Optional[date] = None
    next_vaccination_due: Optional[date] = None
    next_worming_due: Optional[date] = None
    next_saddle_check_due: Optional[date] = None
    next_physio_due: Optional[date] = None
    latest_weight: Optional[WeightRecordResponse] = None
    latest_bcs: Optional[BodyConditionRecordResponse] = None

    class Config:
        from_attributes = True


# Bulk Worm Count Entry
class BulkWormCountEntry(BaseModel):
    """Single horse worm count entry for bulk update."""
    horse_id: int
    worm_count_result: Optional[int] = None  # EPG value, None if not tested
    cost: Optional[Decimal] = None  # Cost of test/treatment
    notes: Optional[str] = None


class BulkWormCountCreate(BaseModel):
    """Bulk worm count submission for multiple horses."""
    worm_count_date: date
    entries: list[BulkWormCountEntry]


class BulkWormCountResult(BaseModel):
    """Result of bulk worm count operation."""
    created: int
    updated: int
    skipped: int


# Worm Count for display in bulk entry form
class HorseWormCountStatus(BaseModel):
    """Horse with latest worm count info for bulk entry form."""
    horse_id: int
    horse_name: str
    owner_name: str
    stable_name: Optional[str] = None
    last_count_date: Optional[date] = None
    last_count_result: Optional[int] = None
    last_treatment_date: Optional[date] = None
    last_product: Optional[str] = None

    class Config:
        from_attributes = True


# Worming Reports
class WormCountByCategory(BaseModel):
    """Count of horses in each EPG category."""
    category: str  # 'low', 'moderate', 'high', 'very_high'
    min_epg: int
    max_epg: Optional[int]
    count: int
    percentage: float


class WormingYearSummary(BaseModel):
    """Summary of worming data for a year."""
    year: int
    total_counts: int
    average_epg: Optional[float]
    horses_tested: int
    categories: list[WormCountByCategory]


class WormingTrendPoint(BaseModel):
    """Single point in worming trend data."""
    period: str  # e.g., "2024-Q1", "2024-H1", "Jan 2024"
    average_epg: Optional[float]
    count: int
    low_count: int
    moderate_count: int
    high_count: int


class WormingReportResponse(BaseModel):
    """Full worming report with current status and trends."""
    current_year: WormingYearSummary
    previous_years: list[WormingYearSummary]
    trends: list[WormingTrendPoint]
    horses_needing_treatment: list[HorseWormCountStatus]  # High EPG horses


# Vaccination Alerts
class VaccinationAlert(BaseModel):
    """Alert for an upcoming or overdue vaccination."""
    horse_id: int
    horse_name: str
    vaccine_type: str
    vaccine_name: Optional[str]
    last_vaccination_date: date
    next_due: date
    days_until_due: int  # Negative if overdue
    is_overdue: bool

    class Config:
        from_attributes = True

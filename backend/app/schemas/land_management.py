from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, ConfigDict

from app.models.land_management import (
    GrantSchemeType,
    GrantStatus,
    GrantPaymentStatus,
    LandFeatureType,
    FeatureCondition,
    WaterSourceType,
    MaintenanceType,
    FloodRiskLevel,
    SuggestionType,
    SuggestionPriority,
)


# ============================================================================
# Grant Schemas
# ============================================================================

class GrantBase(BaseModel):
    name: str
    scheme_type: GrantSchemeType
    reference_number: Optional[str] = None
    application_date: Optional[date] = None
    submission_deadline: Optional[date] = None
    decision_date: Optional[date] = None
    agreement_start_date: Optional[date] = None
    agreement_end_date: Optional[date] = None
    total_value: Optional[Decimal] = None
    annual_payment: Optional[Decimal] = None
    scheme_provider: Optional[str] = None
    next_inspection_date: Optional[date] = None
    inspection_notes: Optional[str] = None
    compliance_requirements: Optional[List[str]] = None
    documents: Optional[List[dict]] = None
    notes: Optional[str] = None


class GrantCreate(GrantBase):
    status: Optional[GrantStatus] = GrantStatus.DRAFT


class GrantUpdate(BaseModel):
    name: Optional[str] = None
    scheme_type: Optional[GrantSchemeType] = None
    status: Optional[GrantStatus] = None
    reference_number: Optional[str] = None
    application_date: Optional[date] = None
    submission_deadline: Optional[date] = None
    decision_date: Optional[date] = None
    agreement_start_date: Optional[date] = None
    agreement_end_date: Optional[date] = None
    total_value: Optional[Decimal] = None
    annual_payment: Optional[Decimal] = None
    scheme_provider: Optional[str] = None
    next_inspection_date: Optional[date] = None
    inspection_notes: Optional[str] = None
    compliance_requirements: Optional[List[str]] = None
    documents: Optional[List[dict]] = None
    notes: Optional[str] = None


class GrantResponse(GrantBase):
    id: int
    status: GrantStatus
    created_at: datetime
    updated_at: datetime
    field_count: int = 0
    feature_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class GrantDetailResponse(GrantResponse):
    linked_fields: List["GrantFieldLinkResponse"] = []
    linked_features: List["GrantFeatureLinkResponse"] = []
    payment_schedules: List["GrantPaymentScheduleResponse"] = []


# ============================================================================
# Grant Payment Schedule Schemas
# ============================================================================

class GrantPaymentScheduleBase(BaseModel):
    due_date: date
    amount: Decimal
    reference: Optional[str] = None
    notes: Optional[str] = None


class GrantPaymentScheduleCreate(GrantPaymentScheduleBase):
    pass


class GrantPaymentScheduleUpdate(BaseModel):
    due_date: Optional[date] = None
    amount: Optional[Decimal] = None
    status: Optional[GrantPaymentStatus] = None
    received_date: Optional[date] = None
    reference: Optional[str] = None
    notes: Optional[str] = None


class GrantPaymentScheduleResponse(GrantPaymentScheduleBase):
    id: int
    grant_id: int
    status: GrantPaymentStatus
    received_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Grant Link Schemas
# ============================================================================

class GrantFieldLinkBase(BaseModel):
    notes: Optional[str] = None


class GrantFieldLinkCreate(GrantFieldLinkBase):
    field_id: int


class GrantFieldLinkResponse(GrantFieldLinkBase):
    id: int
    grant_id: int
    field_id: int
    field_name: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GrantFeatureLinkBase(BaseModel):
    notes: Optional[str] = None


class GrantFeatureLinkCreate(GrantFeatureLinkBase):
    feature_id: int


class GrantFeatureLinkResponse(GrantFeatureLinkBase):
    id: int
    grant_id: int
    feature_id: int
    feature_name: Optional[str] = None
    feature_type: Optional[LandFeatureType] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Land Feature Schemas
# ============================================================================

class LandFeatureBase(BaseModel):
    feature_type: LandFeatureType
    name: str
    description: Optional[str] = None
    field_id: Optional[int] = None
    location_description: Optional[str] = None
    length_meters: Optional[float] = None
    area_sqm: Optional[float] = None
    maintenance_frequency_days: Optional[int] = None
    notes: Optional[str] = None
    # Tree-specific
    tpo_protected: bool = False
    tpo_reference: Optional[str] = None
    tree_species: Optional[str] = None
    # Hedgerow-specific
    hedgerow_species_mix: Optional[str] = None
    # Fence-specific
    fence_type: Optional[str] = None
    fence_height_cm: Optional[int] = None
    # Water trough-specific
    water_source_type: Optional[WaterSourceType] = None
    fill_frequency_days: Optional[int] = None


class LandFeatureCreate(LandFeatureBase):
    current_condition: Optional[FeatureCondition] = FeatureCondition.GOOD


class LandFeatureUpdate(BaseModel):
    feature_type: Optional[LandFeatureType] = None
    name: Optional[str] = None
    description: Optional[str] = None
    field_id: Optional[int] = None
    location_description: Optional[str] = None
    length_meters: Optional[float] = None
    area_sqm: Optional[float] = None
    current_condition: Optional[FeatureCondition] = None
    maintenance_frequency_days: Optional[int] = None
    next_maintenance_due: Optional[date] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None
    # Tree-specific
    tpo_protected: Optional[bool] = None
    tpo_reference: Optional[str] = None
    tree_species: Optional[str] = None
    # Hedgerow-specific
    hedgerow_species_mix: Optional[str] = None
    # Fence-specific
    fence_type: Optional[str] = None
    fence_height_cm: Optional[int] = None
    # Water trough-specific
    water_source_type: Optional[WaterSourceType] = None
    fill_frequency_days: Optional[int] = None
    # Electric fence-specific
    electric_fence_working: Optional[bool] = None
    electric_fence_voltage: Optional[float] = None


class LandFeatureResponse(LandFeatureBase):
    id: int
    current_condition: FeatureCondition
    last_inspection_date: Optional[date] = None
    last_maintenance_date: Optional[date] = None
    next_maintenance_due: Optional[date] = None
    is_active: bool
    # Electric fence-specific
    electric_fence_voltage_check_date: Optional[date] = None
    electric_fence_working: bool = True
    electric_fence_voltage: Optional[float] = None
    # Water trough-specific
    last_fill_date: Optional[date] = None
    # Derived
    field_name: Optional[str] = None
    days_until_maintenance: Optional[int] = None
    maintenance_overdue: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LandFeatureDetailResponse(LandFeatureResponse):
    recent_maintenance: List["FeatureMaintenanceLogResponse"] = []
    linked_grants: List[GrantResponse] = []


# ============================================================================
# Feature Maintenance Log Schemas
# ============================================================================

class FeatureMaintenanceLogBase(BaseModel):
    maintenance_date: date
    maintenance_type: MaintenanceType
    description: Optional[str] = None
    condition_before: Optional[FeatureCondition] = None
    condition_after: Optional[FeatureCondition] = None
    contractor_name: Optional[str] = None
    cost: Optional[Decimal] = None
    photos: Optional[List[str]] = None
    notes: Optional[str] = None


class FeatureMaintenanceLogCreate(FeatureMaintenanceLogBase):
    pass


class FeatureMaintenanceLogResponse(FeatureMaintenanceLogBase):
    id: int
    feature_id: int
    performed_by_id: Optional[int] = None
    performed_by_name: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Water Trough Schemas
# ============================================================================

class WaterTroughStatus(BaseModel):
    id: int
    name: str
    field_id: Optional[int] = None
    field_name: Optional[str] = None
    water_source_type: WaterSourceType
    fill_frequency_days: Optional[int] = None
    last_fill_date: Optional[date] = None
    days_since_fill: Optional[int] = None
    needs_fill: bool = False
    current_condition: FeatureCondition


class RecordFillRequest(BaseModel):
    fill_date: Optional[date] = None
    notes: Optional[str] = None


# ============================================================================
# Fence Status Schemas
# ============================================================================

class FenceStatus(BaseModel):
    id: int
    name: str
    feature_type: LandFeatureType
    field_id: Optional[int] = None
    field_name: Optional[str] = None
    current_condition: FeatureCondition
    last_inspection_date: Optional[date] = None
    next_maintenance_due: Optional[date] = None
    # Electric fence specific
    is_electric: bool = False
    electric_fence_working: bool = True
    electric_fence_voltage: Optional[float] = None
    voltage_check_date: Optional[date] = None
    voltage_check_overdue: bool = False


class RecordFenceCheckRequest(BaseModel):
    check_date: Optional[date] = None
    condition: FeatureCondition
    electric_working: Optional[bool] = None
    voltage: Optional[float] = None
    notes: Optional[str] = None


# ============================================================================
# Flood Monitoring Schemas
# ============================================================================

class FloodMonitoringStationBase(BaseModel):
    station_id: str
    station_name: str
    river_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    warning_threshold_meters: Optional[float] = None
    severe_threshold_meters: Optional[float] = None
    notes: Optional[str] = None


class FloodMonitoringStationCreate(FloodMonitoringStationBase):
    pass


class FloodMonitoringStationUpdate(BaseModel):
    station_name: Optional[str] = None
    river_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    warning_threshold_meters: Optional[float] = None
    severe_threshold_meters: Optional[float] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class FloodMonitoringStationResponse(FloodMonitoringStationBase):
    id: int
    last_reading: Optional[float] = None
    last_reading_time: Optional[datetime] = None
    last_fetched: Optional[datetime] = None
    is_active: bool
    # Derived fields
    current_status: Optional[str] = None  # 'normal', 'warning', 'severe'
    linked_field_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FieldFloodRiskBase(BaseModel):
    distance_km: Optional[float] = None
    risk_level_override: Optional[FloodRiskLevel] = None
    evacuation_notes: Optional[str] = None


class FieldFloodRiskCreate(FieldFloodRiskBase):
    field_id: int
    monitoring_station_id: int


class FieldFloodRiskUpdate(BaseModel):
    distance_km: Optional[float] = None
    risk_level_override: Optional[FloodRiskLevel] = None
    flood_history: Optional[List[dict]] = None
    evacuation_notes: Optional[str] = None


class FieldFloodRiskResponse(FieldFloodRiskBase):
    id: int
    field_id: int
    monitoring_station_id: int
    flood_history: Optional[List[dict]] = None
    # Enriched
    field_name: Optional[str] = None
    station_name: Optional[str] = None
    current_level: Optional[float] = None
    current_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StationWarningAlert(BaseModel):
    """Alert for a station that has exceeded warning thresholds (no field link required)"""
    station_id: int
    ea_station_id: str
    station_name: str
    river_name: Optional[str] = None
    current_level: Optional[float] = None
    warning_threshold: Optional[float] = None
    severe_threshold: Optional[float] = None
    current_status: str  # 'normal', 'warning', 'severe'
    last_reading_time: Optional[datetime] = None


class FloodWarningStatus(BaseModel):
    """Current flood warning status across all monitored stations"""
    has_warnings: bool = False
    has_severe_warnings: bool = False
    warnings: List[FieldFloodRiskResponse] = []  # Legacy: field-linked warnings
    station_alerts: List[StationWarningAlert] = []  # New: all station alerts
    last_updated: Optional[datetime] = None


# ============================================================================
# Field Usage Analytics Schemas
# ============================================================================

class FieldUsageAnalyticsResponse(BaseModel):
    id: int
    field_id: int
    field_name: Optional[str] = None
    year: int
    month: int
    month_name: Optional[str] = None
    total_days_used: int
    total_horse_days: int
    average_horses_per_day: Optional[float] = None
    usage_percentage: Optional[float] = None
    condition_at_start: Optional[FeatureCondition] = None
    condition_at_end: Optional[FeatureCondition] = None
    condition_trend: Optional[str] = None
    rest_days_taken: int
    calculated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class YearlyFieldAnalytics(BaseModel):
    field_id: int
    field_name: str
    year: int
    total_days_used: int
    total_horse_days: int
    average_monthly_usage: float
    condition_start_of_year: Optional[FeatureCondition] = None
    condition_end_of_year: Optional[FeatureCondition] = None
    total_rest_days: int
    months: List[FieldUsageAnalyticsResponse]


class YearlyAnalyticsSummary(BaseModel):
    year: int
    fields: List[YearlyFieldAnalytics]
    total_field_days_used: int
    busiest_field: Optional[str] = None
    least_used_field: Optional[str] = None


# ============================================================================
# Field Rotation Suggestion Schemas
# ============================================================================

class FieldRotationSuggestionBase(BaseModel):
    suggested_date: date
    suggestion_type: SuggestionType
    priority: SuggestionPriority = SuggestionPriority.MEDIUM
    reason: str
    notes: Optional[str] = None


class FieldRotationSuggestionCreate(FieldRotationSuggestionBase):
    field_id: int


class FieldRotationSuggestionResponse(FieldRotationSuggestionBase):
    id: int
    field_id: int
    field_name: Optional[str] = None
    acknowledged: bool
    acknowledged_by_id: Optional[int] = None
    acknowledged_by_name: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AcknowledgeSuggestionRequest(BaseModel):
    notes: Optional[str] = None


# ============================================================================
# Dashboard / Summary Schemas
# ============================================================================

class LandManagementDashboard(BaseModel):
    # Grants summary
    active_grants: int = 0
    grants_with_deadlines: int = 0
    total_grant_value: Decimal = Decimal("0.00")
    upcoming_inspections: List[GrantResponse] = []
    upcoming_payments: List[GrantPaymentScheduleResponse] = []

    # Features summary
    total_features: int = 0
    maintenance_due: int = 0
    maintenance_overdue: int = 0
    features_needing_attention: List[LandFeatureResponse] = []

    # Water troughs
    troughs_needing_fill: List[WaterTroughStatus] = []

    # Fences
    electric_fences_not_working: List[FenceStatus] = []
    voltage_checks_due: List[FenceStatus] = []

    # Flood warnings
    flood_warning_status: FloodWarningStatus = FloodWarningStatus()

    # Rotation suggestions
    pending_suggestions: List[FieldRotationSuggestionResponse] = []


class MaintenanceDueItem(BaseModel):
    feature_id: int
    feature_name: str
    feature_type: LandFeatureType
    field_name: Optional[str] = None
    next_maintenance_due: date
    days_overdue: int = 0
    current_condition: FeatureCondition
    last_maintenance_date: Optional[date] = None


class MaintenanceDueReport(BaseModel):
    overdue: List[MaintenanceDueItem]
    due_this_week: List[MaintenanceDueItem]
    due_this_month: List[MaintenanceDueItem]


# ============================================================================
# Enum Lists for Frontend
# ============================================================================

class LandManagementEnums(BaseModel):
    grant_scheme_types: List[dict]
    grant_statuses: List[dict]
    payment_statuses: List[dict]
    feature_types: List[dict]
    feature_conditions: List[dict]
    water_source_types: List[dict]
    maintenance_types: List[dict]
    flood_risk_levels: List[dict]
    suggestion_types: List[dict]
    suggestion_priorities: List[dict]


# ============================================================================
# Sheep Flock Schemas
# ============================================================================

class SheepFlockBase(BaseModel):
    name: str
    count: int
    breed: Optional[str] = None
    notes: Optional[str] = None


class SheepFlockCreate(SheepFlockBase):
    pass


class SheepFlockUpdate(BaseModel):
    name: Optional[str] = None
    count: Optional[int] = None
    breed: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class SheepFlockResponse(SheepFlockBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    # Derived
    current_field_id: Optional[int] = None
    current_field_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SheepFlockFieldAssignmentCreate(BaseModel):
    field_id: int
    start_date: Optional[date] = None  # Defaults to today
    notes: Optional[str] = None


class SheepFlockFieldAssignmentResponse(BaseModel):
    id: int
    flock_id: int
    field_id: Optional[int]
    start_date: date
    end_date: Optional[date]
    assigned_by_id: int
    notes: Optional[str]
    created_at: datetime
    # Nested
    flock_name: Optional[str] = None
    field_name: Optional[str] = None
    assigned_by_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SheepFlockWithHistory(SheepFlockResponse):
    assignment_history: List[SheepFlockFieldAssignmentResponse] = []


# Update forward references
GrantDetailResponse.model_rebuild()
LandFeatureDetailResponse.model_rebuild()

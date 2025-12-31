from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from decimal import Decimal
from enum import Enum


class FieldCondition(str, Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    RESTING = "resting"


class CompanionRelationship(str, Enum):
    PREFERRED = "preferred"
    COMPATIBLE = "compatible"
    INCOMPATIBLE = "incompatible"


# ============== Field ==============

class FieldCreate(BaseModel):
    name: str
    description: Optional[str] = None
    max_horses: Optional[int] = None
    size_acres: Optional[Decimal] = None
    current_condition: FieldCondition = FieldCondition.GOOD
    condition_notes: Optional[str] = None
    has_shelter: bool = False
    has_water: bool = False
    is_electric_fenced: bool = False
    display_order: int = 0


class FieldUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    max_horses: Optional[int] = None
    size_acres: Optional[Decimal] = None
    has_shelter: Optional[bool] = None
    has_water: Optional[bool] = None
    is_electric_fenced: Optional[bool] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class FieldConditionUpdate(BaseModel):
    current_condition: FieldCondition
    condition_notes: Optional[str] = None


class FieldRestRequest(BaseModel):
    rest_start_date: date
    rest_end_date: Optional[date] = None
    reason: Optional[str] = None


class FieldResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    max_horses: Optional[int]
    size_acres: Optional[Decimal]
    current_condition: FieldCondition
    condition_notes: Optional[str]
    last_condition_update: Optional[datetime]
    is_resting: bool
    rest_start_date: Optional[date]
    rest_end_date: Optional[date]
    has_shelter: bool
    has_water: bool
    is_electric_fenced: bool
    is_active: bool
    display_order: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class FieldSummary(BaseModel):
    """Summary for quick display."""
    id: int
    name: str
    current_condition: FieldCondition
    is_resting: bool
    max_horses: Optional[int]
    current_horse_count: int = 0


# ============== Horse Companion ==============

class HorseCompanionCreate(BaseModel):
    companion_horse_id: int
    relationship_type: CompanionRelationship
    notes: Optional[str] = None


class HorseCompanionResponse(BaseModel):
    id: int
    horse_id: int
    companion_horse_id: int
    relationship_type: CompanionRelationship
    notes: Optional[str]
    created_by_id: int
    created_at: Optional[datetime]
    # Nested
    horse_name: Optional[str] = None
    companion_name: Optional[str] = None
    created_by_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class HorseCompanionSummary(BaseModel):
    """Companion info for a horse."""
    companion_horse_id: int
    companion_name: str
    relationship_type: CompanionRelationship


# ============== Turnout Group ==============

class TurnoutGroupHorseCreate(BaseModel):
    horse_id: int


class TurnoutGroupHorseResponse(BaseModel):
    id: int
    group_id: int
    horse_id: int
    turned_out_at: Optional[datetime]
    brought_in_at: Optional[datetime]
    turned_out_by_id: Optional[int]
    brought_in_by_id: Optional[int]
    # Nested
    horse_name: Optional[str] = None
    turned_out_by_name: Optional[str] = None
    brought_in_by_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TurnoutGroupCreate(BaseModel):
    turnout_date: date
    field_id: int
    horse_ids: List[int] = []
    notes: Optional[str] = None


class TurnoutGroupUpdate(BaseModel):
    field_id: Optional[int] = None
    notes: Optional[str] = None


class TurnoutGroupResponse(BaseModel):
    id: int
    turnout_date: date
    field_id: int
    notes: Optional[str]
    assigned_by_id: int
    created_at: Optional[datetime]
    # Nested
    field_name: Optional[str] = None
    assigned_by_name: Optional[str] = None
    horses: List[TurnoutGroupHorseResponse] = []

    model_config = ConfigDict(from_attributes=True)


class DailyTurnoutSummary(BaseModel):
    """Summary of turnout for a day."""
    date: date
    groups: List[TurnoutGroupResponse]
    total_horses: int
    turned_out_count: int
    brought_in_count: int


# ============== Field Usage Log ==============

class FieldUsageLogCreate(BaseModel):
    field_id: int
    usage_date: date
    condition_start: Optional[FieldCondition] = None
    condition_end: Optional[FieldCondition] = None
    notes: Optional[str] = None
    horse_ids: List[int] = []


class FieldUsageLogResponse(BaseModel):
    id: int
    field_id: int
    usage_date: date
    condition_start: Optional[FieldCondition]
    condition_end: Optional[FieldCondition]
    notes: Optional[str]
    logged_by_id: Optional[int]
    created_at: Optional[datetime]
    # Nested
    field_name: Optional[str] = None
    logged_by_name: Optional[str] = None
    horse_names: List[str] = []

    model_config = ConfigDict(from_attributes=True)


# ============== Field Rotation Report ==============

class FieldRotationEntry(BaseModel):
    """Entry in rotation report showing when field was last used."""
    field_id: int
    field_name: str
    current_condition: FieldCondition
    is_resting: bool
    last_used_date: Optional[date]
    days_since_use: Optional[int]
    usage_count_last_7_days: int
    usage_count_last_30_days: int


class FieldRotationReport(BaseModel):
    """Report showing field usage and rotation status."""
    generated_at: datetime
    fields: List[FieldRotationEntry]

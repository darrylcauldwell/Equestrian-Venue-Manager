from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel
from app.models.feed import FeedTime, SupplyStatus, AdditionStatus


# Feed Requirement Schemas
class FeedRequirementCreate(BaseModel):
    morning_feed: Optional[str] = None
    evening_feed: Optional[str] = None
    supplements: Optional[str] = None
    special_instructions: Optional[str] = None


class FeedRequirementUpdate(BaseModel):
    morning_feed: Optional[str] = None
    evening_feed: Optional[str] = None
    supplements: Optional[str] = None
    special_instructions: Optional[str] = None
    supply_status: Optional[SupplyStatus] = None
    supply_notes: Optional[str] = None


class FeedRequirementResponse(BaseModel):
    id: int
    horse_id: int
    morning_feed: Optional[str]
    evening_feed: Optional[str]
    supplements: Optional[str]
    special_instructions: Optional[str]
    supply_status: SupplyStatus
    supply_notes: Optional[str]
    updated_at: datetime
    updated_by_id: Optional[int]

    class Config:
        from_attributes = True


# Feed Addition Schemas
class FeedAdditionCreate(BaseModel):
    name: str
    dosage: str
    feed_time: FeedTime = FeedTime.BOTH
    start_date: date
    end_date: Optional[date] = None
    reason: Optional[str] = None


class FeedAdditionUpdate(BaseModel):
    name: Optional[str] = None
    dosage: Optional[str] = None
    feed_time: Optional[FeedTime] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    reason: Optional[str] = None
    status: Optional[AdditionStatus] = None
    is_active: Optional[bool] = None


class FeedAdditionResponse(BaseModel):
    id: int
    horse_id: int
    name: str
    dosage: str
    feed_time: FeedTime
    start_date: date
    end_date: Optional[date]
    reason: Optional[str]
    status: AdditionStatus
    is_active: bool
    requested_by_id: int
    approved_by_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    requested_by_name: Optional[str] = None

    class Config:
        from_attributes = True


# Feed Supply Alert Schemas
class FeedSupplyAlertCreate(BaseModel):
    item: str
    notes: Optional[str] = None


class FeedSupplyAlertUpdate(BaseModel):
    item: Optional[str] = None
    notes: Optional[str] = None
    is_resolved: Optional[bool] = None


class FeedSupplyAlertResponse(BaseModel):
    id: int
    horse_id: int
    item: str
    notes: Optional[str]
    is_resolved: bool
    created_by_id: int
    resolved_by_id: Optional[int]
    created_at: datetime
    resolved_at: Optional[datetime]
    created_by_name: Optional[str] = None
    horse_name: Optional[str] = None

    class Config:
        from_attributes = True


# Rehab feed medication (for displaying in feed schedule)
class RehabFeedMedication(BaseModel):
    task_id: int
    program_id: int
    program_name: str
    task_type: str
    description: str
    feed_time: Optional[str] = None  # morning, evening, both
    instructions: Optional[str] = None
    frequency: str  # daily, twice_daily, etc.

    class Config:
        from_attributes = True


# Summary response
class FeedSummary(BaseModel):
    horse_id: int
    horse_name: str
    stable_id: Optional[int] = None
    stable_name: Optional[str] = None
    stable_sequence: Optional[int] = None
    feed_requirement: Optional[FeedRequirementResponse]
    active_additions: List[FeedAdditionResponse]
    pending_additions: List[FeedAdditionResponse]
    unresolved_alerts: List[FeedSupplyAlertResponse]
    rehab_medications: List[RehabFeedMedication] = []  # Feed-based medications from active rehab programs

    class Config:
        from_attributes = True

from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

from app.models.turnout import TurnoutStatus, TurnoutType


class TurnoutRequestBase(BaseModel):
    request_date: date
    turnout_type: TurnoutType = TurnoutType.OUT
    field_preference: Optional[str] = None
    notes: Optional[str] = None


class TurnoutRequestCreate(TurnoutRequestBase):
    horse_id: int


class TurnoutRequestUpdate(BaseModel):
    turnout_type: Optional[TurnoutType] = None
    field_preference: Optional[str] = None
    notes: Optional[str] = None


class TurnoutReviewRequest(BaseModel):
    status: TurnoutStatus
    response_message: Optional[str] = None


class TurnoutRequestResponse(TurnoutRequestBase):
    id: int
    horse_id: int
    requested_by_id: int
    status: TurnoutStatus
    reviewed_by_id: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    response_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Enriched fields
    horse_name: Optional[str] = None
    requested_by_name: Optional[str] = None
    reviewed_by_name: Optional[str] = None
    stable_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DailyTurnoutSummary(BaseModel):
    date: date
    turning_out: List[TurnoutRequestResponse]
    staying_in: List[TurnoutRequestResponse]
    pending: List[TurnoutRequestResponse]
    # Horses with no requests (default behavior)
    no_request_horses: List[dict]  # Simple horse info


class TurnoutEnums(BaseModel):
    statuses: List[dict]
    types: List[dict]

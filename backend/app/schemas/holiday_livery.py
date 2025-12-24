"""
Schemas for Holiday Livery Requests
"""

from datetime import date, datetime
from typing import Optional, Literal
from pydantic import BaseModel, EmailStr, field_validator


# Status types
HolidayLiveryStatusStr = Literal["pending", "approved", "rejected", "cancelled"]


class HolidayLiveryRequestCreate(BaseModel):
    """Public form to request holiday livery."""
    guest_name: str
    guest_email: EmailStr
    guest_phone: Optional[str] = None

    horse_name: str
    horse_breed: Optional[str] = None
    horse_age: Optional[int] = None
    horse_colour: Optional[str] = None
    horse_gender: Optional[str] = None
    special_requirements: Optional[str] = None

    requested_arrival: date
    requested_departure: date
    message: Optional[str] = None

    @field_validator('requested_departure')
    @classmethod
    def departure_after_arrival(cls, v, info):
        if 'requested_arrival' in info.data and v <= info.data['requested_arrival']:
            raise ValueError('Departure date must be after arrival date')
        return v


class HolidayLiveryApproval(BaseModel):
    """Admin approval of a holiday livery request."""
    confirmed_arrival: date
    confirmed_departure: date
    assigned_stable_id: int
    admin_notes: Optional[str] = None

    @field_validator('confirmed_departure')
    @classmethod
    def departure_after_arrival(cls, v, info):
        if 'confirmed_arrival' in info.data and v <= info.data['confirmed_arrival']:
            raise ValueError('Departure date must be after arrival date')
        return v


class HolidayLiveryRejection(BaseModel):
    """Admin rejection of a holiday livery request."""
    rejection_reason: str
    admin_notes: Optional[str] = None


class HolidayLiveryRequestResponse(BaseModel):
    """Response for a holiday livery request."""
    id: int
    guest_name: str
    guest_email: str
    guest_phone: Optional[str]

    horse_name: str
    horse_breed: Optional[str]
    horse_age: Optional[int]
    horse_colour: Optional[str]
    horse_gender: Optional[str]
    special_requirements: Optional[str]

    requested_arrival: date
    requested_departure: date
    requested_nights: int
    message: Optional[str]

    status: str
    admin_notes: Optional[str]
    rejection_reason: Optional[str]

    confirmed_arrival: Optional[date]
    confirmed_departure: Optional[date]
    confirmed_nights: int

    assigned_stable_id: Optional[int]
    assigned_stable_name: Optional[str] = None

    created_user_id: Optional[int]
    created_user_name: Optional[str] = None
    created_horse_id: Optional[int]
    created_horse_name: Optional[str] = None

    processed_by_id: Optional[int]
    processed_by_name: Optional[str] = None
    processed_at: Optional[datetime]

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class HolidayLiveryRequestSummary(BaseModel):
    """Summary view for lists."""
    id: int
    guest_name: str
    guest_email: str
    horse_name: str
    requested_arrival: date
    requested_departure: date
    requested_nights: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class HolidayLiveryPublicResponse(BaseModel):
    """Response shown to public users after submitting request."""
    id: int
    message: str
    status: str
    requested_arrival: date
    requested_departure: date

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr
from app.models.booking import BookingType, BookingStatus, PaymentStatus


class BookingCreate(BaseModel):
    arena_id: int
    horse_id: Optional[int] = None  # Required for livery bookings
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    booking_type: Optional[BookingType] = None
    open_to_share: bool = False


class BookingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    open_to_share: Optional[bool] = None


class BookingResponse(BaseModel):
    id: int
    arena_id: int
    user_id: Optional[int]
    horse_id: Optional[int] = None
    title: str
    description: Optional[str]
    start_time: datetime
    end_time: datetime
    booking_type: BookingType
    booking_status: BookingStatus = BookingStatus.CONFIRMED
    open_to_share: bool = False
    payment_status: PaymentStatus
    created_at: datetime
    user_name: Optional[str] = None
    arena_name: Optional[str] = None
    horse_name: Optional[str] = None
    guest_name: Optional[str] = None
    guest_email: Optional[str] = None
    # Account creation info (for guest bookings)
    account_created: bool = False
    temporary_password: Optional[str] = None
    username: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class BookingPublicResponse(BaseModel):
    id: int
    arena_id: int
    start_time: datetime
    end_time: datetime
    booking_type: BookingType
    booking_status: BookingStatus = BookingStatus.CONFIRMED
    open_to_share: bool = False
    title: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class GuestBookingCreate(BaseModel):
    arena_id: int
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    guest_name: str
    guest_email: EmailStr
    guest_phone: Optional[str] = None


class BlockSlotCreate(BaseModel):
    arena_id: int
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    booking_type: BookingType = BookingType.MAINTENANCE


# Arena Usage Report Schemas
class BookingTypeUsage(BaseModel):
    booking_type: str
    label: str
    total_hours: float
    booking_count: int


class ArenaUsageSummary(BaseModel):
    arena_id: int
    arena_name: str
    total_hours: float
    usage_by_type: list[BookingTypeUsage]


class PeriodUsageReport(BaseModel):
    period_label: str
    start_date: datetime
    end_date: datetime
    total_hours: float
    arena_summaries: list[ArenaUsageSummary]


class ArenaUsageReport(BaseModel):
    previous_month: PeriodUsageReport
    previous_quarter: PeriodUsageReport
    previous_year: PeriodUsageReport

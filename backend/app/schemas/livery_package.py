from typing import Optional, List, Literal
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel

# Billing type literal for schema validation
BillingTypeStr = Literal["monthly", "weekly"]


class LiveryPackageCreate(BaseModel):
    name: str
    price_display: str  # e.g., "£165/week", "from £250/week"
    monthly_price: Optional[Decimal] = None  # For monthly billing type
    weekly_price: Optional[Decimal] = None  # For weekly billing type (holiday livery)
    billing_type: BillingTypeStr = "monthly"
    description: Optional[str] = None
    features: Optional[List[str]] = None
    additional_note: Optional[str] = None
    is_featured: bool = False
    display_order: int = 0
    is_active: bool = True
    is_insurance_claimable: bool = False  # For rehab livery packages


class LiveryPackageUpdate(BaseModel):
    name: Optional[str] = None
    price_display: Optional[str] = None
    monthly_price: Optional[Decimal] = None
    weekly_price: Optional[Decimal] = None
    billing_type: Optional[BillingTypeStr] = None
    description: Optional[str] = None
    features: Optional[List[str]] = None
    additional_note: Optional[str] = None
    is_featured: Optional[bool] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None
    is_insurance_claimable: Optional[bool] = None


class LiveryPackageResponse(BaseModel):
    id: int
    name: str
    price_display: str
    monthly_price: Optional[Decimal]
    weekly_price: Optional[Decimal]
    billing_type: str
    description: Optional[str]
    features: Optional[List[str]]
    additional_note: Optional[str]
    is_featured: bool
    display_order: int
    is_active: bool
    is_insurance_claimable: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

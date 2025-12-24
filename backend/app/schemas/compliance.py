from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel
from enum import Enum


class ComplianceCategory(str, Enum):
    INSURANCE = "insurance"
    FIRE_SAFETY = "fire_safety"
    ELECTRICAL = "electrical"
    EQUIPMENT = "equipment"
    FIRST_AID = "first_aid"
    HEALTH_SAFETY = "health_safety"
    OTHER = "other"


# ============== Compliance Item Schemas ==============

class ComplianceItemCreate(BaseModel):
    name: str
    category: ComplianceCategory
    description: Optional[str] = None
    reference_number: Optional[str] = None
    provider: Optional[str] = None
    renewal_frequency_months: int = 12
    next_due_date: Optional[datetime] = None
    reminder_days_before: int = 30
    responsible_user_id: Optional[int] = None
    notes: Optional[str] = None


class ComplianceItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[ComplianceCategory] = None
    description: Optional[str] = None
    reference_number: Optional[str] = None
    provider: Optional[str] = None
    renewal_frequency_months: Optional[int] = None
    next_due_date: Optional[datetime] = None
    reminder_days_before: Optional[int] = None
    responsible_user_id: Optional[int] = None
    certificate_url: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class ComplianceItemResponse(BaseModel):
    id: int
    name: str
    category: str
    description: Optional[str] = None
    reference_number: Optional[str] = None
    provider: Optional[str] = None
    renewal_frequency_months: int
    last_completed_date: Optional[datetime] = None
    next_due_date: Optional[datetime] = None
    reminder_days_before: int
    responsible_user_id: Optional[int] = None
    responsible_user_name: Optional[str] = None
    certificate_url: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool
    is_overdue: bool = False
    days_until_due: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============== Compliance History Schemas ==============

class ComplianceHistoryCreate(BaseModel):
    completed_date: datetime
    certificate_url: Optional[str] = None
    notes: Optional[str] = None
    cost: Optional[Decimal] = None


class ComplianceHistoryResponse(BaseModel):
    id: int
    compliance_item_id: int
    completed_date: datetime
    completed_by_id: Optional[int] = None
    completed_by_name: Optional[str] = None
    certificate_url: Optional[str] = None
    notes: Optional[str] = None
    cost: Optional[Decimal] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============== Dashboard Schemas ==============

class ComplianceDashboard(BaseModel):
    total_items: int
    overdue_count: int
    due_soon_count: int  # Due within reminder period
    up_to_date_count: int
    overdue_items: List[ComplianceItemResponse]
    due_soon_items: List[ComplianceItemResponse]

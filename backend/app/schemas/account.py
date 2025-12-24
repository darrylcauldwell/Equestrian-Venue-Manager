from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel

from app.models.account import TransactionType


class LedgerEntryBase(BaseModel):
    transaction_type: TransactionType
    amount: Decimal
    description: str
    notes: Optional[str] = None
    service_request_id: Optional[int] = None
    livery_package_id: Optional[int] = None
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None


class LedgerEntryCreate(LedgerEntryBase):
    user_id: int
    transaction_date: Optional[datetime] = None


class LedgerEntryResponse(LedgerEntryBase):
    id: int
    user_id: int
    transaction_date: datetime
    created_by_id: int
    created_at: datetime

    # Enriched fields
    user_name: Optional[str] = None
    created_by_name: Optional[str] = None
    service_description: Optional[str] = None
    package_name: Optional[str] = None

    class Config:
        from_attributes = True


class AccountBalance(BaseModel):
    user_id: int
    user_name: str
    balance: Decimal  # Positive = owes money, Negative = credit
    total_charges: Decimal
    total_payments: Decimal


class AccountSummary(BaseModel):
    balance: AccountBalance
    recent_transactions: List[LedgerEntryResponse]
    pending_service_charges: int  # Service requests not yet billed
    last_invoice_date: Optional[date] = None  # End date of last issued invoice
    current_period_start: Optional[date] = None  # Start of current billing period


class UserAccountSummary(BaseModel):
    user_id: int
    user_name: str
    balance: Decimal
    transaction_count: int


class TransactionEnums(BaseModel):
    types: List[dict]

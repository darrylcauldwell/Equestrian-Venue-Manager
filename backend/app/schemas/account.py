from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel

from app.models.account import TransactionType, PaymentMethod


class LedgerEntryBase(BaseModel):
    transaction_type: TransactionType
    amount: Decimal
    description: str
    notes: Optional[str] = None
    service_request_id: Optional[int] = None
    livery_package_id: Optional[int] = None
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    payment_method: Optional[PaymentMethod] = None
    payment_reference: Optional[str] = None


class LedgerEntryCreate(LedgerEntryBase):
    user_id: int
    transaction_date: Optional[datetime] = None


class LedgerEntryUpdate(BaseModel):
    """Schema for updating a transaction (limited fields)"""
    description: Optional[str] = None
    notes: Optional[str] = None
    payment_method: Optional[PaymentMethod] = None
    payment_reference: Optional[str] = None


class VoidTransactionRequest(BaseModel):
    """Request to void a transaction"""
    reason: str


class LedgerEntryResponse(LedgerEntryBase):
    id: int
    user_id: int
    transaction_date: datetime
    created_by_id: int
    created_at: datetime

    # Payment fields
    receipt_number: Optional[str] = None

    # Void tracking
    voided: bool = False
    voided_at: Optional[datetime] = None
    voided_by_id: Optional[int] = None
    void_reason: Optional[str] = None
    original_entry_id: Optional[int] = None

    # Enriched fields
    user_name: Optional[str] = None
    created_by_name: Optional[str] = None
    voided_by_name: Optional[str] = None
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
    payment_methods: List[dict] = []


# ============== Statement Schemas ==============

class StatementRequest(BaseModel):
    from_date: date
    to_date: date


class EmailStatementRequest(StatementRequest):
    custom_message: Optional[str] = None


# ============== Payment Recording Schemas ==============

class RecordPayment(BaseModel):
    """Schema for recording a payment with receipt generation"""
    user_id: int
    amount: Decimal  # Always positive, will be stored as negative
    payment_method: PaymentMethod
    payment_reference: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    transaction_date: Optional[datetime] = None


class PaymentResponse(LedgerEntryResponse):
    """Response for recorded payment including receipt number"""
    receipt_number: str


# ============== Report Schemas ==============

class AgedDebtItem(BaseModel):
    user_id: int
    user_name: str
    user_email: Optional[str] = None
    current: Decimal = Decimal("0.00")       # Not yet due
    month_1: Decimal = Decimal("0.00")       # 1 month overdue
    month_2: Decimal = Decimal("0.00")       # 2 months overdue
    month_3_plus: Decimal = Decimal("0.00")  # 3+ months overdue
    total: Decimal = Decimal("0.00")
    last_payment_date: Optional[date] = None


class AgedDebtReport(BaseModel):
    as_of_date: date
    accounts: List[AgedDebtItem]
    totals: AgedDebtItem


class IncomeByType(BaseModel):
    transaction_type: str
    type_label: str
    amount: Decimal
    count: int


class MonthlyIncome(BaseModel):
    year: int
    month: int
    month_label: str
    total: Decimal
    by_type: List[IncomeByType]


class IncomeSummaryReport(BaseModel):
    from_date: date
    to_date: date
    total_income: Decimal
    total_charges: Decimal
    total_payments: Decimal
    by_type: List[IncomeByType]
    by_month: List[MonthlyIncome]

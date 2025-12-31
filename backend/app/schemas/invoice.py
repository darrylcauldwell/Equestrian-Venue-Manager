from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, ConfigDict
from enum import Enum


class InvoiceStatus(str, Enum):
    DRAFT = "draft"
    ISSUED = "issued"
    PAID = "paid"
    CANCELLED = "cancelled"
    OVERDUE = "overdue"


class InvoiceLineItemCreate(BaseModel):
    description: str
    quantity: Decimal = Decimal("1")
    unit_price: Decimal
    amount: Decimal
    category: Optional[str] = None
    item_date_start: Optional[date] = None
    item_date_end: Optional[date] = None
    ledger_entry_id: Optional[int] = None


class InvoiceLineItemResponse(BaseModel):
    id: int
    invoice_id: int
    ledger_entry_id: Optional[int]
    description: str
    quantity: Decimal
    unit_price: Decimal
    amount: Decimal
    category: Optional[str]
    item_date_start: Optional[date]
    item_date_end: Optional[date]

    model_config = ConfigDict(from_attributes=True)


class InvoiceGenerateRequest(BaseModel):
    """Request to generate an invoice for a user."""
    user_id: int
    period_start: date
    period_end: date
    due_date: date
    notes: Optional[str] = None
    # If true, automatically pull items from ledger entries
    auto_populate: bool = True
    # Optional manual line items
    line_items: List[InvoiceLineItemCreate] = []


class InvoiceCreate(BaseModel):
    user_id: int
    period_start: date
    period_end: date
    due_date: date
    notes: Optional[str] = None
    line_items: List[InvoiceLineItemCreate] = []


class InvoiceUpdate(BaseModel):
    due_date: Optional[date] = None
    notes: Optional[str] = None
    status: Optional[InvoiceStatus] = None


class InvoiceResponse(BaseModel):
    id: int
    user_id: int
    invoice_number: str
    period_start: date
    period_end: date
    subtotal: Decimal
    payments_received: Decimal
    balance_due: Decimal
    status: InvoiceStatus
    issue_date: Optional[date]
    due_date: Optional[date]
    paid_date: Optional[date]
    pdf_filename: Optional[str]
    notes: Optional[str]
    created_by_id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    # Nested
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    created_by_name: Optional[str] = None
    line_items: List[InvoiceLineItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class InvoiceSummary(BaseModel):
    """Summary for list views."""
    id: int
    invoice_number: str
    user_id: int
    user_name: str
    period_start: date
    period_end: date
    subtotal: Decimal
    balance_due: Decimal
    status: InvoiceStatus
    issue_date: Optional[date]
    due_date: Optional[date]


class MyInvoiceSummary(BaseModel):
    """Summary for livery user's own invoices."""
    id: int
    invoice_number: str
    period_start: date
    period_end: date
    subtotal: Decimal
    balance_due: Decimal
    status: InvoiceStatus
    issue_date: Optional[date]
    due_date: Optional[date]
    has_pdf: bool

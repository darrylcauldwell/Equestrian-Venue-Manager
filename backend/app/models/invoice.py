import enum
from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Date, Text, Numeric
from sqlalchemy.orm import relationship
from app.database import Base, EnumColumn


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    ISSUED = "issued"
    PAID = "paid"
    CANCELLED = "cancelled"
    OVERDUE = "overdue"


class Invoice(Base):
    """Invoice for a user covering a billing period."""
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Invoice number - unique identifier (e.g., "INV-2024-0001")
    invoice_number = Column(String(20), unique=True, nullable=False, index=True)

    # Billing period
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)

    # Amounts
    subtotal = Column(Numeric(10, 2), nullable=False, default=0)
    payments_received = Column(Numeric(10, 2), nullable=False, default=0)
    balance_due = Column(Numeric(10, 2), nullable=False, default=0)

    # Status and dates
    status = EnumColumn(InvoiceStatus, default=InvoiceStatus.DRAFT, nullable=False)
    issue_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    paid_date = Column(Date, nullable=True)

    # PDF storage
    pdf_filename = Column(String(255), nullable=True)

    # Notes
    notes = Column(Text, nullable=True)

    # Tracking
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    line_items = relationship("InvoiceLineItem", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceLineItem(Base):
    """Individual line item on an invoice."""
    __tablename__ = "invoice_line_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)

    # Optional link to ledger entry
    ledger_entry_id = Column(Integer, ForeignKey("ledger_entries.id"), nullable=True)

    # Item details
    description = Column(String(500), nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False, default=1)
    unit_price = Column(Numeric(10, 2), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)  # quantity * unit_price

    # For categorization
    category = Column(String(50), nullable=True)  # livery, service, booking, etc.

    # Date range (for recurring items like livery)
    item_date_start = Column(Date, nullable=True)
    item_date_end = Column(Date, nullable=True)

    # Relationships
    invoice = relationship("Invoice", back_populates="line_items")
    ledger_entry = relationship("LedgerEntry")

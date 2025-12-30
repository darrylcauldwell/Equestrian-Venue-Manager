import enum
from datetime import datetime
from decimal import Decimal
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Numeric, Boolean
from sqlalchemy.orm import relationship

from app.database import Base, EnumColumn


class TransactionType(str, enum.Enum):
    PACKAGE_CHARGE = "package_charge"      # Monthly livery package fee
    SERVICE_CHARGE = "service_charge"      # Ad-hoc service charge
    PAYMENT = "payment"                    # Payment received
    CREDIT = "credit"                      # Credit/refund applied
    ADJUSTMENT = "adjustment"              # Manual adjustment


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"
    CARD = "card"
    CHEQUE = "cheque"
    DIRECT_DEBIT = "direct_debit"
    OTHER = "other"


class LedgerEntry(Base):
    """
    Tracks all financial transactions for livery clients.
    Positive amounts = charges (money owed)
    Negative amounts = payments/credits (money received/credited)
    """
    __tablename__ = "ledger_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Transaction details
    transaction_type = EnumColumn(TransactionType, nullable=False
    )
    amount = Column(Numeric(10, 2), nullable=False)  # Positive = charge, Negative = payment
    description = Column(String(500), nullable=False)
    notes = Column(Text)  # Internal notes

    # Related entities (optional - for linking to source)
    service_request_id = Column(Integer, ForeignKey("service_requests.id"), nullable=True)
    livery_package_id = Column(Integer, ForeignKey("livery_packages.id"), nullable=True)

    # Billing period (for package charges)
    period_start = Column(DateTime, nullable=True)
    period_end = Column(DateTime, nullable=True)

    # Payment details (for payment/credit transactions)
    payment_method = EnumColumn(PaymentMethod, nullable=True)
    payment_reference = Column(String(100), nullable=True)  # Bank ref, cheque number, etc.
    receipt_number = Column(String(20), unique=True, nullable=True)  # Auto-generated for payments

    # Void tracking
    voided = Column(Boolean, default=False, nullable=False)
    voided_at = Column(DateTime, nullable=True)
    voided_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    void_reason = Column(Text, nullable=True)
    original_entry_id = Column(Integer, ForeignKey("ledger_entries.id"), nullable=True)  # For reversal entries

    # Tracking
    transaction_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="ledger_entries")
    created_by = relationship("User", foreign_keys=[created_by_id])
    voided_by = relationship("User", foreign_keys=[voided_by_id])
    original_entry = relationship("LedgerEntry", remote_side="LedgerEntry.id", foreign_keys=[original_entry_id])
    service_request = relationship("ServiceRequest", backref="ledger_entries")
    livery_package = relationship("LiveryPackage", backref="ledger_entries")

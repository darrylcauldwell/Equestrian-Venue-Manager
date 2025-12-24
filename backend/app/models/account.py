import enum
from datetime import datetime
from decimal import Decimal
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Numeric, Enum
from sqlalchemy.orm import relationship

from app.database import Base, EnumColumn


class TransactionType(str, enum.Enum):
    PACKAGE_CHARGE = "package_charge"      # Monthly livery package fee
    SERVICE_CHARGE = "service_charge"      # Ad-hoc service charge
    PAYMENT = "payment"                    # Payment received
    CREDIT = "credit"                      # Credit/refund applied
    ADJUSTMENT = "adjustment"              # Manual adjustment


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

    # Tracking
    transaction_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="ledger_entries")
    created_by = relationship("User", foreign_keys=[created_by_id])
    service_request = relationship("ServiceRequest", backref="ledger_entries")
    livery_package = relationship("LiveryPackage", backref="ledger_entries")

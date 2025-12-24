from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, Text, Numeric, Boolean, DateTime, Enum
from app.database import Base, EnumColumn


class BillingType(str, PyEnum):
    """How a livery package is billed."""
    MONTHLY = "monthly"  # Traditional livery - monthly price, pro-rata by days in month
    WEEKLY = "weekly"    # Holiday livery - weekly price, charged per day (weekly_price / 7)


class LiveryPackage(Base):
    """Livery packages displayed on the public Livery Services page."""
    __tablename__ = "livery_packages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    price_display = Column(String(50), nullable=False)  # e.g., "£165/week", "from £250/week"
    monthly_price = Column(Numeric(10, 2), nullable=True)  # For monthly billing type
    weekly_price = Column(Numeric(10, 2), nullable=True)  # For weekly billing type (holiday livery)
    billing_type = EnumColumn(BillingType, default=BillingType.MONTHLY,
        nullable=False
    )
    description = Column(Text, nullable=True)
    features = Column(Text, nullable=True)  # JSON array of feature strings
    additional_note = Column(Text, nullable=True)
    is_featured = Column(Boolean, default=False, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_insurance_claimable = Column(Boolean, default=False, nullable=False)  # For rehab livery packages
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

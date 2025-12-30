from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from app.database import Base


class ComplianceItem(Base):
    """Compliance items to track for the venue (insurance, fire safety, PAT testing, etc.)."""
    __tablename__ = "compliance_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False)  # insurance, fire_safety, electrical, equipment, first_aid, health_safety, other
    description = Column(Text, nullable=True)
    reference_number = Column(String(100), nullable=True)  # Policy number, certificate number, etc.
    provider = Column(String(200), nullable=True)  # Insurance company, contractor name, etc.
    renewal_frequency_months = Column(Integer, nullable=False, default=12)  # How often renewal is needed
    last_completed_date = Column(DateTime, nullable=True)
    next_due_date = Column(DateTime, nullable=True)
    reminder_days_before = Column(Integer, default=30)  # Days before due to send reminder
    responsible_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    certificate_url = Column(String(500), nullable=True)  # URL to uploaded certificate/proof
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    responsible_user = relationship("User", foreign_keys=[responsible_user_id])
    history = relationship("ComplianceHistory", back_populates="compliance_item", order_by="desc(ComplianceHistory.completed_date)")


class ComplianceHistory(Base):
    """History of compliance completions/renewals."""
    __tablename__ = "compliance_history"

    id = Column(Integer, primary_key=True, index=True)
    compliance_item_id = Column(Integer, ForeignKey("compliance_items.id", ondelete="CASCADE"), nullable=False)
    completed_date = Column(DateTime, nullable=False)
    completed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    certificate_url = Column(String(500), nullable=True)  # Certificate for this completion
    notes = Column(Text, nullable=True)
    cost = Column(Numeric(10, 2), nullable=True)  # Cost of renewal
    created_at = Column(DateTime, default=datetime.utcnow)

    compliance_item = relationship("ComplianceItem", back_populates="history")
    completed_by = relationship("User", foreign_keys=[completed_by_id])

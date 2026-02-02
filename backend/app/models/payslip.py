import enum
from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base, EnumColumn


class PayslipDocumentType(str, enum.Enum):
    PAYSLIP = "payslip"
    ANNUAL_SUMMARY = "annual_summary"


class Payslip(Base):
    """Uploaded payslip PDF documents for staff members."""
    __tablename__ = "payslips"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    document_type = EnumColumn(PayslipDocumentType, nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)  # 1-12 for payslips, 0 for annual_summary
    pdf_filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=True)
    notes = Column(String(500), nullable=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    staff = relationship("User", foreign_keys=[staff_id])
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])

    __table_args__ = (
        UniqueConstraint('staff_id', 'document_type', 'year', 'month',
                         name='uq_payslip_staff_type_period'),
    )

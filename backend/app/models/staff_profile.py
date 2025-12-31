from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import relationship

from app.database import Base


class StaffProfile(Base):
    """Extended profile information for staff members."""
    __tablename__ = "staff_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    # Personal information
    date_of_birth = Column(Date, nullable=True)
    bio = Column(Text, nullable=True)

    # Employment information
    start_date = Column(Date, nullable=True)
    job_title = Column(String(100), nullable=True)
    hourly_rate = Column(Numeric(10, 2), nullable=True)  # Admin-only, for payroll

    # Payroll information (mandatory for payroll processing)
    national_insurance_number = Column(String(13), nullable=True)  # Format: AB123456C
    bank_account_number = Column(String(8), nullable=True)  # 8-digit account number
    bank_sort_code = Column(String(8), nullable=True)  # Format: 12-34-56 or 123456
    bank_account_name = Column(String(100), nullable=True)  # Name on bank account

    # Tax information (optional)
    tax_code = Column(String(10), nullable=True)  # e.g., 1257L, BR, 0T
    student_loan_plan = Column(String(20), nullable=True)  # plan_1, plan_2, plan_4, postgrad, none

    # P45 from previous employer (optional)
    p45_date_left_previous = Column(Date, nullable=True)
    p45_tax_paid_previous = Column(Numeric(10, 2), nullable=True)
    p45_pay_to_date_previous = Column(Numeric(10, 2), nullable=True)

    # Personal contact details (different from work contact on User)
    personal_email = Column(String(255), nullable=True)
    personal_phone = Column(String(20), nullable=True)

    # Home address
    address_street = Column(String(200), nullable=True)
    address_town = Column(String(100), nullable=True)
    address_county = Column(String(100), nullable=True)
    address_postcode = Column(String(10), nullable=True)

    # Emergency contact
    emergency_contact_name = Column(String(100), nullable=True)
    emergency_contact_phone = Column(String(20), nullable=True)
    emergency_contact_relationship = Column(String(50), nullable=True)

    # Qualifications and certifications (stored as JSON array)
    qualifications = Column(Text, nullable=True)  # JSON array of qualification strings

    # DBS/Background check
    dbs_check_date = Column(Date, nullable=True)
    dbs_certificate_number = Column(String(50), nullable=True)

    # Admin notes (only visible to admins)
    notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="staff_profile")

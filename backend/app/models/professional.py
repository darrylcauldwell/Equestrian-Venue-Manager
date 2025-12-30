import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from app.database import Base, EnumColumn


class ProfessionalCategory(str, enum.Enum):
    FARRIER = "farrier"
    VET = "vet"
    DENTIST = "dentist"
    PHYSIO = "physio"
    CHIROPRACTOR = "chiropractor"
    SADDLER = "saddler"
    NUTRITIONIST = "nutritionist"
    INSTRUCTOR = "instructor"
    TRANSPORTER = "transporter"
    FEED_STORE = "feed_store"
    OTHER = "other"


class Professional(Base):
    """Directory of equine professionals and service providers."""
    __tablename__ = "professionals"

    id = Column(Integer, primary_key=True, index=True)
    category = EnumColumn(ProfessionalCategory, nullable=False)
    business_name = Column(String(150), nullable=False)
    contact_name = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    mobile = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    coverage_area = Column(String(200), nullable=True)  # e.g., "Within 30 miles of yard"
    services = Column(Text, nullable=True)  # Description of services offered
    specialties = Column(Text, nullable=True)  # Any specializations
    qualifications = Column(Text, nullable=True)  # Professional qualifications
    typical_rates = Column(Text, nullable=True)  # Price guidance
    booking_notes = Column(Text, nullable=True)  # How to book, lead times, etc.
    yard_recommended = Column(Boolean, default=False, nullable=False)  # Yard's preferred provider
    yard_notes = Column(Text, nullable=True)  # Internal notes from yard
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

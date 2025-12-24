import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from app.database import Base, EnumColumn


class ContactType(str, enum.Enum):
    VET = "vet"
    VET_BACKUP = "vet_backup"
    FARRIER = "farrier"
    FARRIER_BACKUP = "farrier_backup"
    OWNER_BACKUP = "owner_backup"
    INSURANCE = "insurance"
    OTHER = "other"


class EmergencyContact(Base):
    """Horse-specific emergency contacts"""
    __tablename__ = "emergency_contacts"

    id = Column(Integer, primary_key=True, index=True)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False)

    # Contact type and details
    contact_type = EnumColumn(ContactType, nullable=False)
    name = Column(String(150), nullable=False)
    phone = Column(String(20), nullable=False)
    phone_alt = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)

    # For vets/farriers - practice details
    practice_name = Column(String(150), nullable=True)
    address = Column(Text, nullable=True)

    # Availability
    available_24h = Column(Boolean, default=False, nullable=False)
    availability_notes = Column(Text, nullable=True)  # e.g., "Call mobile after 6pm"

    # Primary contact flag for this type
    is_primary = Column(Boolean, default=False, nullable=False)

    notes = Column(Text, nullable=True)

    # Tracking
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    horse = relationship("Horse", back_populates="emergency_contacts")
    created_by = relationship("User")

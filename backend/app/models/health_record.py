import enum
from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.orm import relationship
from app.database import Base, EnumColumn


class VaccineType(str, enum.Enum):
    FLU = "flu"
    TETANUS = "tetanus"
    FLU_TETANUS = "flu_tetanus"
    OTHER = "other"


class FarrierRecord(Base):
    __tablename__ = "farrier_records"

    id = Column(Integer, primary_key=True, index=True)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False)
    visit_date = Column(Date, nullable=False)
    farrier_name = Column(String(100), nullable=True)
    work_done = Column(Text, nullable=False)
    cost = Column(Numeric(10, 2), nullable=True)
    next_due = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    horse = relationship("Horse", back_populates="farrier_records")


class DentistRecord(Base):
    __tablename__ = "dentist_records"

    id = Column(Integer, primary_key=True, index=True)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False)
    visit_date = Column(Date, nullable=False)
    dentist_name = Column(String(100), nullable=True)
    treatment = Column(Text, nullable=False)
    cost = Column(Numeric(10, 2), nullable=True)
    next_due = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    horse = relationship("Horse", back_populates="dentist_records")


class VaccinationRecord(Base):
    __tablename__ = "vaccination_records"

    id = Column(Integer, primary_key=True, index=True)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False)
    vaccination_date = Column(Date, nullable=False)
    vaccine_type = EnumColumn(VaccineType, nullable=False)
    vaccine_name = Column(String(100), nullable=True)
    batch_number = Column(String(50), nullable=True)
    administered_by = Column(String(100), nullable=True)
    next_due = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    horse = relationship("Horse", back_populates="vaccination_records")


class WormingRecord(Base):
    __tablename__ = "worming_records"

    id = Column(Integer, primary_key=True, index=True)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False)
    treatment_date = Column(Date, nullable=False)
    product = Column(String(100), nullable=False)
    worm_count_date = Column(Date, nullable=True)
    worm_count_result = Column(Integer, nullable=True)  # EPG result
    next_due = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    horse = relationship("Horse", back_populates="worming_records")

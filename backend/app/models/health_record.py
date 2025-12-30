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
    cost = Column(Numeric(10, 2), nullable=True)  # Cost of treatment/medication
    next_due = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    horse = relationship("Horse", back_populates="worming_records")


class WeightRecord(Base):
    __tablename__ = "weight_records"

    id = Column(Integer, primary_key=True, index=True)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False)
    record_date = Column(Date, nullable=False)
    weight_kg = Column(Numeric(6, 2), nullable=False)  # Always stored in kg
    unit_entered = Column(String(10), default="kg")  # "kg" or "lbs" - what user entered
    method = Column(String(50), nullable=True)  # e.g., "weigh tape", "scales", "estimated"
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    horse = relationship("Horse", back_populates="weight_records")


class BodyConditionRecord(Base):
    __tablename__ = "body_condition_records"

    id = Column(Integer, primary_key=True, index=True)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False)
    record_date = Column(Date, nullable=False)
    score = Column(Integer, nullable=False)  # 1-9 Henneke scale
    assessed_by = Column(String(100), nullable=True)  # Who assessed
    notes = Column(Text, nullable=True)  # Areas of concern, fat deposits, etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    horse = relationship("Horse", back_populates="body_condition_records")


class Saddle(Base):
    """Individual saddle belonging to a horse."""
    __tablename__ = "saddles"

    id = Column(Integer, primary_key=True, index=True)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)  # e.g., "My Dressage Saddle", "Brown GP"
    saddle_type = Column(String(50), nullable=False)  # "gp", "dressage", "jump", "endurance", "other"
    brand = Column(String(100), nullable=True)  # e.g., "Albion", "Stubben", "Pessoa"
    model = Column(String(100), nullable=True)  # e.g., "K2", "Genesis"
    serial_number = Column(String(100), nullable=True)
    purchase_date = Column(Date, nullable=True)
    is_active = Column(Integer, default=1, nullable=False)  # 1 = active, 0 = retired/sold
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    horse = relationship("Horse", back_populates="saddles")
    fit_records = relationship("SaddleFitRecord", back_populates="saddle")


class SaddleFitRecord(Base):
    __tablename__ = "saddle_fit_records"

    id = Column(Integer, primary_key=True, index=True)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False)
    saddle_id = Column(Integer, ForeignKey("saddles.id", ondelete="SET NULL"), nullable=True)  # Link to specific saddle
    check_date = Column(Date, nullable=False)
    fitter_name = Column(String(100), nullable=True)
    saddle_type = Column(String(100), nullable=True)  # Legacy field - kept for backwards compatibility
    fit_status = Column(String(50), nullable=False)  # "good", "needs_adjustment", "needs_replacing"
    adjustments_made = Column(Text, nullable=True)  # What was done
    next_check_due = Column(Date, nullable=True)
    cost = Column(Numeric(10, 2), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    horse = relationship("Horse", back_populates="saddle_fit_records")
    saddle = relationship("Saddle", back_populates="fit_records")


class PhysioRecord(Base):
    """Physiotherapy session record for a horse."""
    __tablename__ = "physio_records"

    id = Column(Integer, primary_key=True, index=True)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False)
    session_date = Column(Date, nullable=False)
    practitioner_name = Column(String(100), nullable=True)
    treatment_type = Column(String(100), nullable=False)  # e.g., "massage", "stretching", "laser", "ultrasound"
    areas_treated = Column(Text, nullable=True)  # e.g., "back, hindquarters"
    findings = Column(Text, nullable=True)  # What was found during assessment
    treatment_notes = Column(Text, nullable=True)  # Details of treatment given
    recommendations = Column(Text, nullable=True)  # Follow-up recommendations
    next_session_due = Column(Date, nullable=True)
    cost = Column(Numeric(10, 2), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    horse = relationship("Horse", back_populates="physio_records")

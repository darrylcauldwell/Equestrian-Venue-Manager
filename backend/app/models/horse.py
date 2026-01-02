from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Date, Text
from sqlalchemy.orm import relationship
from app.database import Base


class Horse(Base):
    __tablename__ = "horses"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    stable_id = Column(Integer, ForeignKey("stables.id"), nullable=True)
    name = Column(String(100), nullable=False)  # Stable name / nickname
    passport_name = Column(String(200), nullable=True)  # Official registered passport name
    colour = Column(String(50), nullable=True)
    birth_year = Column(Integer, nullable=True)
    feed_notes = Column(String(500), nullable=True)  # Quick reference for feed info

    # Livery package assignment
    livery_package_id = Column(Integer, ForeignKey("livery_packages.id"), nullable=True)
    livery_start_date = Column(Date, nullable=True)  # When livery started (for pro-rata)
    livery_end_date = Column(Date, nullable=True)  # When leaving (for pro-rata final month)

    # Personality traits - Farrier
    farrier_friendly = Column(Boolean, default=True, nullable=False)
    farrier_notes = Column(String(500), nullable=True)

    # Personality traits - Dentist
    dentist_friendly = Column(Boolean, default=True, nullable=False)
    needs_sedation_dentist = Column(Boolean, default=False, nullable=False)
    dentist_notes = Column(String(500), nullable=True)

    # Personality traits - Clipping
    clipping_friendly = Column(Boolean, default=True, nullable=False)
    needs_sedation_clipping = Column(Boolean, default=False, nullable=False)
    clipping_notes = Column(String(500), nullable=True)

    # Personality traits - General handling
    kicks = Column(Boolean, default=False, nullable=False)
    bites = Column(Boolean, default=False, nullable=False)
    handling_notes = Column(String(500), nullable=True)

    # Personality traits - Loading & Catching
    loads_well = Column(Boolean, default=True, nullable=False)
    loading_notes = Column(String(500), nullable=True)
    difficult_to_catch = Column(Boolean, default=False, nullable=False)
    catching_notes = Column(String(500), nullable=True)

    # Personality traits - Vet
    vet_friendly = Column(Boolean, default=True, nullable=False)
    needle_shy = Column(Boolean, default=False, nullable=False)
    vet_notes = Column(String(500), nullable=True)  # Bad for mouth/legs, bargy, etc.

    # Personality traits - Tying & Sedation risks
    can_be_tied = Column(Boolean, default=True, nullable=False)
    tying_notes = Column(String(500), nullable=True)
    has_sedation_risk = Column(Boolean, default=False, nullable=False)  # Has gone down during sedation
    sedation_notes = Column(String(500), nullable=True)

    # Personality traits - Headshyness
    headshy = Column(Boolean, default=False, nullable=False)
    headshy_notes = Column(String(500), nullable=True)

    # Turnout preferences
    turnout_alone = Column(Boolean, default=False, nullable=False)  # Must go out alone
    turnout_notes = Column(Text, nullable=True)

    # Field assignment status
    box_rest = Column(Boolean, default=False, nullable=False)  # Horse on box rest (no field turnout)

    owner = relationship("User", back_populates="horses")
    stable = relationship("Stable", back_populates="horses")
    livery_package = relationship("LiveryPackage", backref="horses")
    farrier_records = relationship("FarrierRecord", back_populates="horse", cascade="all, delete-orphan")
    dentist_records = relationship("DentistRecord", back_populates="horse", cascade="all, delete-orphan")
    vaccination_records = relationship("VaccinationRecord", back_populates="horse", cascade="all, delete-orphan")
    worming_records = relationship("WormingRecord", back_populates="horse", cascade="all, delete-orphan")
    weight_records = relationship("WeightRecord", back_populates="horse", cascade="all, delete-orphan")
    body_condition_records = relationship("BodyConditionRecord", back_populates="horse", cascade="all, delete-orphan")
    saddles = relationship("Saddle", back_populates="horse", cascade="all, delete-orphan")
    saddle_fit_records = relationship("SaddleFitRecord", back_populates="horse", cascade="all, delete-orphan")
    physio_records = relationship("PhysioRecord", back_populates="horse", cascade="all, delete-orphan")
    feed_requirement = relationship("FeedRequirement", back_populates="horse", uselist=False, cascade="all, delete-orphan")
    feed_additions = relationship("FeedAddition", back_populates="horse", cascade="all, delete-orphan")
    feed_alerts = relationship("FeedSupplyAlert", back_populates="horse", cascade="all, delete-orphan")
    service_requests = relationship("ServiceRequest", back_populates="horse", cascade="all, delete-orphan")
    turnout_requests = relationship("TurnoutRequest", back_populates="horse", cascade="all, delete-orphan")
    emergency_contacts = relationship("EmergencyContact", back_populates="horse", cascade="all, delete-orphan")

import enum
from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Date, Text, Numeric, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base, EnumColumn


class FieldCondition(str, enum.Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    RESTING = "resting"


class Field(Base):
    """A paddock/field for turnout."""
    __tablename__ = "fields"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    # Capacity and size
    max_horses = Column(Integer, nullable=True)
    size_acres = Column(Numeric(5, 2), nullable=True)

    # Condition tracking
    current_condition = EnumColumn(FieldCondition, default=FieldCondition.GOOD)
    condition_notes = Column(Text, nullable=True)
    last_condition_update = Column(DateTime, nullable=True)

    # Rest tracking
    is_resting = Column(Boolean, default=False)
    rest_start_date = Column(Date, nullable=True)
    rest_end_date = Column(Date, nullable=True)

    # Features
    has_shelter = Column(Boolean, default=False)
    has_water = Column(Boolean, default=False)
    is_electric_fenced = Column(Boolean, default=False)

    is_active = Column(Boolean, default=True)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FieldUsageLog(Base):
    """Track which horses went in which field each day."""
    __tablename__ = "field_usage_logs"

    id = Column(Integer, primary_key=True, index=True)
    field_id = Column(Integer, ForeignKey("fields.id"), nullable=False)
    usage_date = Column(Date, nullable=False)

    # Condition at start/end of day
    condition_start = EnumColumn(FieldCondition, nullable=True)
    condition_end = EnumColumn(FieldCondition, nullable=True)

    notes = Column(Text, nullable=True)
    logged_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    field = relationship("Field")
    logged_by = relationship("User")
    horses = relationship("FieldUsageHorse", back_populates="usage_log", cascade="all, delete-orphan")


class FieldUsageHorse(Base):
    """Horses that were in a field on a given day."""
    __tablename__ = "field_usage_horses"

    id = Column(Integer, primary_key=True, index=True)
    usage_log_id = Column(Integer, ForeignKey("field_usage_logs.id", ondelete="CASCADE"), nullable=False)
    horse_id = Column(Integer, ForeignKey("horses.id"), nullable=False)

    usage_log = relationship("FieldUsageLog", back_populates="horses")
    horse = relationship("Horse")


class CompanionRelationship(str, enum.Enum):
    PREFERRED = "preferred"      # Best friends, should go together
    COMPATIBLE = "compatible"    # Can go together fine
    INCOMPATIBLE = "incompatible"  # Must NOT go together


class HorseCompanion(Base):
    """Tracks companion relationships between horses."""
    __tablename__ = "horse_companions"

    id = Column(Integer, primary_key=True, index=True)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False)
    companion_horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False)

    # Relationship type
    relationship_type = EnumColumn(CompanionRelationship, nullable=False)
    notes = Column(Text, nullable=True)

    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    horse = relationship("Horse", foreign_keys=[horse_id])
    companion = relationship("Horse", foreign_keys=[companion_horse_id])
    created_by = relationship("User")

    # Unique constraint - one relationship per pair
    __table_args__ = (
        UniqueConstraint('horse_id', 'companion_horse_id', name='unique_horse_companion'),
    )


class TurnoutGroup(Base):
    """Daily assignment of horses to fields."""
    __tablename__ = "turnout_groups"

    id = Column(Integer, primary_key=True, index=True)
    turnout_date = Column(Date, nullable=False)
    field_id = Column(Integer, ForeignKey("fields.id"), nullable=False)

    notes = Column(Text, nullable=True)
    assigned_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    field = relationship("Field")
    assigned_by = relationship("User")
    horses = relationship("TurnoutGroupHorse", back_populates="group", cascade="all, delete-orphan")


class TurnoutGroupHorse(Base):
    """Horses assigned to a turnout group for a day."""
    __tablename__ = "turnout_group_horses"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("turnout_groups.id", ondelete="CASCADE"), nullable=False)
    horse_id = Column(Integer, ForeignKey("horses.id"), nullable=False)

    # Status tracking
    turned_out_at = Column(DateTime, nullable=True)
    brought_in_at = Column(DateTime, nullable=True)
    turned_out_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    brought_in_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    group = relationship("TurnoutGroup", back_populates="horses")
    horse = relationship("Horse")
    turned_out_by = relationship("User", foreign_keys=[turned_out_by_id])
    brought_in_by = relationship("User", foreign_keys=[brought_in_by_id])


class HorseFieldAssignment(Base):
    """Permanent field assignment for livery horses with history tracking.

    When a horse's field changes, the current assignment's end_date is set
    and a new assignment record is created. NULL end_date = current assignment.
    """
    __tablename__ = "horse_field_assignments"

    id = Column(Integer, primary_key=True, index=True)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False, index=True)
    field_id = Column(Integer, ForeignKey("fields.id", ondelete="SET NULL"), nullable=True, index=True)

    # Assignment period
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)  # NULL = current assignment

    # Audit
    assigned_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    horse = relationship("Horse", backref="field_assignments")
    field = relationship("Field")
    assigned_by = relationship("User")

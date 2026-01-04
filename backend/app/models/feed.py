import enum
from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Text, Boolean, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base, EnumColumn


class FeedTime(str, enum.Enum):
    MORNING = "morning"
    EVENING = "evening"
    BOTH = "both"


class SupplyStatus(str, enum.Enum):
    ADEQUATE = "adequate"
    LOW = "low"
    CRITICAL = "critical"


class AdditionStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"


class FeedRequirement(Base):
    """Regular daily feed requirements for a horse."""
    __tablename__ = "feed_requirements"

    id = Column(Integer, primary_key=True, index=True)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False, unique=True)
    morning_feed = Column(Text, nullable=True)
    evening_feed = Column(Text, nullable=True)
    supplements = Column(Text, nullable=True)
    special_instructions = Column(Text, nullable=True)
    supply_status = EnumColumn(SupplyStatus, default=SupplyStatus.ADEQUATE, nullable=False)
    supply_notes = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    horse = relationship("Horse", back_populates="feed_requirement")
    updated_by = relationship("User", foreign_keys=[updated_by_id])


class FeedAddition(Base):
    """Temporary feed additions (medications, supplements) with start/end dates."""
    __tablename__ = "feed_additions"

    id = Column(Integer, primary_key=True, index=True)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)  # Medication/supplement name
    dosage = Column(String(100), nullable=False)  # Amount per feed
    feed_time = EnumColumn(FeedTime, default=FeedTime.BOTH, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)  # Null means ongoing
    reason = Column(Text, nullable=True)
    status = EnumColumn(AdditionStatus, default=AdditionStatus.PENDING, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    horse = relationship("Horse", back_populates="feed_additions")
    requested_by = relationship("User", foreign_keys=[requested_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])


class FeedSupplyAlert(Base):
    """Alerts when feed supplies are running low."""
    __tablename__ = "feed_supply_alerts"

    id = Column(Integer, primary_key=True, index=True)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False)
    item = Column(String(100), nullable=False)  # What's running low
    notes = Column(Text, nullable=True)
    is_resolved = Column(Boolean, default=False, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    resolved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    horse = relationship("Horse", back_populates="feed_alerts")
    created_by = relationship("User", foreign_keys=[created_by_id])
    resolved_by = relationship("User", foreign_keys=[resolved_by_id])


class FeedChangeType(str, enum.Enum):
    """Types of feed changes that trigger notifications."""
    REQUIREMENT_CREATED = "requirement_created"
    REQUIREMENT_UPDATED = "requirement_updated"
    REQUIREMENT_DELETED = "requirement_deleted"
    ADDITION_CREATED = "addition_created"
    ADDITION_UPDATED = "addition_updated"
    ADDITION_DELETED = "addition_deleted"
    SUPPLY_ALERT = "supply_alert"


class FeedChangeNotification(Base):
    """Records feed changes that need staff acknowledgement."""
    __tablename__ = "feed_change_notifications"

    id = Column(Integer, primary_key=True, index=True)
    change_type = EnumColumn(FeedChangeType, nullable=False)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False)
    description = Column(Text, nullable=False)  # Human-readable change description
    details = Column(JSON, nullable=True)  # Store before/after values for audit
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    horse = relationship("Horse")
    created_by = relationship("User", foreign_keys=[created_by_id])
    acknowledgements = relationship("FeedChangeAcknowledgement", back_populates="notification", cascade="all, delete-orphan")


class FeedChangeAcknowledgement(Base):
    """Records staff acknowledgement of feed changes."""
    __tablename__ = "feed_change_acknowledgements"

    id = Column(Integer, primary_key=True, index=True)
    notification_id = Column(Integer, ForeignKey("feed_change_notifications.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    acknowledged_at = Column(DateTime, default=datetime.utcnow)

    notification = relationship("FeedChangeNotification", back_populates="acknowledgements")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint('notification_id', 'user_id', name='uq_notification_user'),
    )

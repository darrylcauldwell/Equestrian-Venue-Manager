import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database import Base, EnumColumn


class NoticeCategory(str, enum.Enum):
    GENERAL = "general"
    EVENT = "event"
    MAINTENANCE = "maintenance"
    HEALTH = "health"
    URGENT = "urgent"
    SOCIAL = "social"


class NoticePriority(str, enum.Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"


class Notice(Base):
    """Noticeboard posts for the yard community."""
    __tablename__ = "notices"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    category = EnumColumn(NoticeCategory, default=NoticeCategory.GENERAL, nullable=False)
    priority = EnumColumn(NoticePriority, default=NoticePriority.NORMAL, nullable=False)
    is_pinned = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    created_by = relationship("User", backref="notices")

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


class Backup(Base):
    """Records of database backups."""
    __tablename__ = "backups"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    backup_date = Column(DateTime, default=datetime.utcnow)
    file_size = Column(Integer, nullable=True)  # Size in bytes
    entity_counts = Column(JSON, nullable=True)  # {"users": 10, "horses": 25, ...}
    storage_location = Column(String(50), default="local")  # "local" or "s3"
    s3_url = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_by = relationship("User", foreign_keys=[created_by_id])


class BackupSchedule(Base):
    """Configuration for automated backups."""
    __tablename__ = "backup_schedules"

    id = Column(Integer, primary_key=True, index=True)
    is_enabled = Column(Boolean, default=False)
    frequency = Column(String(20), default="daily")  # "daily", "weekly", "monthly"
    retention_days = Column(Integer, default=30)  # How long to keep backups
    last_run = Column(DateTime, nullable=True)
    next_run = Column(DateTime, nullable=True)
    s3_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

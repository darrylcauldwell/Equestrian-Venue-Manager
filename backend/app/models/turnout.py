import enum
from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, Boolean, Enum
from sqlalchemy.orm import relationship

from app.database import Base, EnumColumn


class TurnoutStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    DECLINED = "declined"


class TurnoutType(str, enum.Enum):
    OUT = "out"  # Horse to be turned out
    IN = "in"    # Horse to stay in


class TurnoutRequest(Base):
    __tablename__ = "turnout_requests"

    id = Column(Integer, primary_key=True, index=True)
    horse_id = Column(Integer, ForeignKey("horses.id", ondelete="CASCADE"), nullable=False)
    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Request details
    request_date = Column(Date, nullable=False)  # The date for turnout
    turnout_type = EnumColumn(TurnoutType, default=TurnoutType.OUT
    )
    field_preference = Column(String(100))  # Optional: preferred field/paddock
    notes = Column(Text)  # Livery notes about the request

    # Approval
    status = EnumColumn(TurnoutStatus, default=TurnoutStatus.PENDING
    )
    reviewed_by_id = Column(Integer, ForeignKey("users.id"))
    reviewed_at = Column(DateTime)
    response_message = Column(Text)  # Staff message when approving/declining

    # Tracking
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    horse = relationship("Horse", back_populates="turnout_requests")
    requested_by = relationship("User", foreign_keys=[requested_by_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])

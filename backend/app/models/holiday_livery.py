"""
Holiday Livery Request Model

Handles public requests for short-term holiday livery bookings.
"""

from datetime import datetime, date
from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, Text, Date, DateTime, Enum, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database import Base, EnumColumn


class HolidayLiveryStatus(str, PyEnum):
    """Status of a holiday livery request."""
    PENDING = "pending"           # Awaiting admin review
    APPROVED = "approved"         # Approved - user account and horse created
    REJECTED = "rejected"         # Rejected by admin
    CANCELLED = "cancelled"       # Cancelled by requester or admin


class HolidayLiveryRequest(Base):
    """
    Public request for holiday livery accommodation.

    Flow:
    1. Public user submits request with horse details and desired dates
    2. Admin reviews, assigns stable, sets final dates
    3. On approval:
       - User account created (if not existing)
       - Horse record created with livery dates
       - Stable assigned
    4. User can then log in, view billing, book services, etc.
    """
    __tablename__ = "holiday_livery_requests"

    id = Column(Integer, primary_key=True, index=True)

    # Requester details (may become a user on approval)
    guest_name = Column(String(100), nullable=False)
    guest_email = Column(String(255), nullable=False, index=True)
    guest_phone = Column(String(50), nullable=True)

    # Horse details
    horse_name = Column(String(100), nullable=False)
    horse_breed = Column(String(100), nullable=True)
    horse_age = Column(Integer, nullable=True)  # Age in years
    horse_colour = Column(String(50), nullable=True)
    horse_gender = Column(String(20), nullable=True)  # e.g., "gelding", "mare", "stallion"
    special_requirements = Column(Text, nullable=True)  # Dietary, medical, handling notes

    # Requested dates
    requested_arrival = Column(Date, nullable=False)
    requested_departure = Column(Date, nullable=False)

    # Request message/notes from guest
    message = Column(Text, nullable=True)

    # Status
    status = EnumColumn(HolidayLiveryStatus, default=HolidayLiveryStatus.PENDING,
        nullable=False,
        index=True
    )

    # Admin processing
    admin_notes = Column(Text, nullable=True)  # Internal notes for admin
    rejection_reason = Column(Text, nullable=True)  # Shown to guest on rejection

    # Final dates (may differ from requested)
    confirmed_arrival = Column(Date, nullable=True)
    confirmed_departure = Column(Date, nullable=True)

    # Assigned stable (on approval)
    assigned_stable_id = Column(Integer, ForeignKey("stables.id"), nullable=True)
    assigned_stable = relationship("Stable", foreign_keys=[assigned_stable_id])

    # Created entities (on approval)
    created_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_user = relationship("User", foreign_keys=[created_user_id])

    created_horse_id = Column(Integer, ForeignKey("horses.id"), nullable=True)
    created_horse = relationship("Horse", foreign_keys=[created_horse_id])

    # Processing admin
    processed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    processed_by = relationship("User", foreign_keys=[processed_by_id])
    processed_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def requested_nights(self) -> int:
        """Calculate number of nights for the requested stay."""
        if self.requested_arrival and self.requested_departure:
            return (self.requested_departure - self.requested_arrival).days
        return 0

    @property
    def confirmed_nights(self) -> int:
        """Calculate number of nights for the confirmed stay."""
        if self.confirmed_arrival and self.confirmed_departure:
            return (self.confirmed_departure - self.confirmed_arrival).days
        return 0

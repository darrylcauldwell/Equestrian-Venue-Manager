import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app.database import Base, EnumColumn


class BookingType(str, enum.Enum):
    PUBLIC = "public"
    LIVERY = "livery"
    EVENT = "event"
    MAINTENANCE = "maintenance"
    TRAINING_CLINIC = "training_clinic"
    LESSON = "lesson"


class BookingStatus(str, enum.Enum):
    CONFIRMED = "confirmed"  # Within allowance, confirmed immediately
    PENDING = "pending"  # Over allowance, waiting for auto-confirmation
    CANCELLED = "cancelled"  # Cancelled by user or admin


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    NOT_REQUIRED = "not_required"


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    arena_id = Column(Integer, ForeignKey("arenas.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Nullable for guest bookings
    horse_id = Column(Integer, ForeignKey("horses.id"), nullable=True)  # For livery bookings - which horse this is for
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    booking_type = EnumColumn(BookingType, default=BookingType.PUBLIC, nullable=False)
    booking_status = EnumColumn(BookingStatus, default=BookingStatus.CONFIRMED, nullable=False)  # For livery pending bookings
    open_to_share = Column(Boolean, default=False, nullable=False)  # Livery bookings can be marked as open to share
    payment_ref = Column(String(100), nullable=True)
    payment_status = EnumColumn(PaymentStatus, default=PaymentStatus.PENDING, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Guest booking fields (for anonymous users)
    guest_name = Column(String(100), nullable=True)
    guest_email = Column(String(255), nullable=True)
    guest_phone = Column(String(20), nullable=True)

    arena = relationship("Arena", back_populates="bookings")
    user = relationship("User", back_populates="bookings")
    horse = relationship("Horse")

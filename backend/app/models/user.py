import enum
from datetime import datetime, date
from sqlalchemy import Column, Integer, String, DateTime, Date, Boolean
from sqlalchemy.orm import relationship
from app.database import Base, EnumColumn


class UserRole(str, enum.Enum):
    PUBLIC = "public"
    LIVERY = "livery"  # Livery client - can book arenas free, manage horses
    STAFF = "staff"  # Yard staff - can perform yard duties, timesheets, tasks
    COACH = "coach"  # Can propose training clinics
    ADMIN = "admin"  # Full system access (inherits all staff capabilities)


class StaffType(str, enum.Enum):
    REGULAR = "regular"  # Normal staff with regular shifts/hours
    CASUAL = "casual"  # Called in as needed, no guaranteed hours
    ON_CALL = "on_call"  # Available for emergencies and cover only


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    # Address fields
    address_street = Column(String(200), nullable=True)
    address_town = Column(String(100), nullable=True)
    address_county = Column(String(100), nullable=True)
    address_postcode = Column(String(10), nullable=True)
    password_hash = Column(String(255), nullable=False)
    role = EnumColumn(UserRole, default=UserRole.PUBLIC, nullable=False)
    must_change_password = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Staff capabilities - allows any user to also function as yard staff
    is_yard_staff = Column(Boolean, default=False, nullable=False)  # Can perform staff duties
    staff_type = EnumColumn(StaffType, nullable=True)  # regular, casual, on_call
    annual_leave_entitlement = Column(Integer, default=23, nullable=True)  # Days per year (for regular staff)
    leaving_date = Column(Date, nullable=True)  # Date when staff member leaves (for pro-rata calculation)

    bookings = relationship("Booking", back_populates="user")
    horses = relationship("Horse", back_populates="owner")
    coach_profile = relationship(
        "CoachProfile",
        back_populates="user",
        uselist=False,
        foreign_keys="CoachProfile.user_id"
    )
    staff_profile = relationship(
        "StaffProfile",
        back_populates="user",
        uselist=False,
        foreign_keys="StaffProfile.user_id"
    )

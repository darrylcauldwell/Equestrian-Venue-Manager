from sqlalchemy import Column, Integer, String, Boolean, Text, Numeric
from sqlalchemy.orm import relationship
from app.database import Base


class Arena(Base):
    __tablename__ = "arenas"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    # Extended properties
    size = Column(String(50), nullable=True)  # e.g., "20x40", "60x40"
    surface_type = Column(String(50), nullable=True)  # e.g., "sand", "rubber", "grass"
    price_per_hour = Column(Numeric(10, 2), nullable=True)  # Price for public bookings
    has_lights = Column(Boolean, default=False, nullable=False)  # Arena has lighting
    jumps_type = Column(String(50), nullable=True)  # e.g., "show_jumps", "working_hunter", "cross_country"
    free_for_livery = Column(Boolean, default=False, nullable=False)  # Free for livery clients
    image_url = Column(String(500), nullable=True)  # Photo URL for the arena

    bookings = relationship("Booking", back_populates="arena")

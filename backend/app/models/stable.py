from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class StableBlock(Base):
    """A block/section of stables (e.g., 'Front Block', 'Brown Block')."""
    __tablename__ = "stable_blocks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # e.g., "Front Block", "Brown Block"
    sequence = Column(Integer, default=0, nullable=False)  # Display order for blocks
    is_active = Column(Boolean, default=True, nullable=False)

    stables = relationship("Stable", back_populates="block", order_by="Stable.number")


class Stable(Base):
    """Individual stable within a block."""
    __tablename__ = "stables"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # Display name (e.g., "Front Block 1")
    block_id = Column(Integer, ForeignKey("stable_blocks.id"), nullable=True)  # Which block it belongs to
    number = Column(Integer, nullable=True)  # Number within block (1, 2, 3...)
    sequence = Column(Integer, default=0, nullable=False)  # Global display order for feed bucket preparation
    is_active = Column(Boolean, default=True, nullable=False)

    block = relationship("StableBlock", back_populates="stables")
    horses = relationship("Horse", back_populates="stable")

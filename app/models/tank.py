"""
Tank Model
Vessel tanks - fuel, ballast, slop, bilge etc.
"""
from sqlalchemy import Column, String, DateTime, Boolean, Enum, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.database import Base


class TankType(str, enum.Enum):
    FUEL_OIL = "fuel_oil"
    DIESEL_OIL = "diesel_oil"
    LUBRICATING_OIL = "lubricating_oil"
    BALLAST = "ballast"
    SLOP = "slop"
    BILGE = "bilge"
    CARGO = "cargo"
    FRESH_WATER = "fresh_water"
    OTHER = "other"


class Tank(Base):
    __tablename__ = "tanks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vessel_id = Column(UUID(as_uuid=True), ForeignKey("vessels.id"), nullable=False)
    name = Column(String(100), nullable=False)
    tank_type = Column(Enum(TankType), nullable=False)
    capacity_m3 = Column(Float, nullable=False)
    frame_from = Column(String(10), nullable=True)
    frame_to = Column(String(10), nullable=True)
    position = Column(String(20), nullable=True)  # port, starboard, center
    is_active = Column(Boolean, default=True)
    external_system_id = Column(String(100), nullable=True)  # ID in Valmarine/Kongsberg/NAPA
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    vessel = relationship("Vessel", back_populates="tanks")

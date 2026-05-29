"""
Vessel Model
Stores vessel particulars required for ORB
"""
from sqlalchemy import Column, String, DateTime, Boolean, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.database import Base


class VesselType(str, enum.Enum):
    OIL_TANKER = "oil_tanker"
    BULK_CARRIER = "bulk_carrier"
    GENERAL_CARGO = "general_cargo"
    CONTAINER = "container"
    OTHER = "other"


class ORBMode(str, enum.Enum):
    PART1 = "part1"
    PART2 = "part2"
    BOTH = "both"


class Vessel(Base):
    __tablename__ = "vessels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    imo_number = Column(String(20), unique=True, nullable=False)
    mmsi = Column(String(20), nullable=True)
    call_sign = Column(String(20), nullable=True)
    flag_state = Column(String(50), nullable=False)
    vessel_type = Column(Enum(VesselType), nullable=False)
    gross_tonnage = Column(String(20), nullable=True)
    deadweight = Column(String(20), nullable=True)
    year_built = Column(String(4), nullable=True)
    owner = Column(String(100), nullable=True)
    operator = Column(String(100), nullable=True)
    orb_mode = Column(Enum(ORBMode), default=ORBMode.PART1, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tanks = relationship("Tank", back_populates="vessel")
    orb_part1_entries = relationship("ORBPart1Entry", back_populates="vessel")
    orb_part2_entries = relationship("ORBPart2Entry", back_populates="vessel")

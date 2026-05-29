"""
Vessel Model
Stores vessel particulars required for ORB

MARPOL ORB Mode Logic:
- Part I only  : Passenger, Bulk Carrier, General Cargo, Container, Other
- Part I + II  : Oil Tanker, Product Tanker, Chemical Tanker, Oil Barge
- Part II only : Not applicable — tankers always carry Part I as well
"""
from sqlalchemy import Column, String, DateTime, Boolean, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.database import Base


class VesselType(str, enum.Enum):
    OIL_TANKER          = "oil_tanker"
    PRODUCT_TANKER      = "product_tanker"
    CHEMICAL_TANKER     = "chemical_tanker"
    OIL_BARGE           = "oil_barge"
    BULK_CARRIER        = "bulk_carrier"
    GENERAL_CARGO       = "general_cargo"
    CONTAINER           = "container"
    PASSENGER           = "passenger"
    OTHER               = "other"


# Vessel types that require ORB Part II (MARPOL Annex I, Reg 36)
PART2_VESSEL_TYPES = {
    VesselType.OIL_TANKER,
    VesselType.PRODUCT_TANKER,
    VesselType.CHEMICAL_TANKER,
    VesselType.OIL_BARGE,
}


class ORBMode(str, enum.Enum):
    PART1 = "part1"   # Machinery space only
    BOTH  = "both"    # Part I + Part II (tankers)


def get_orb_mode(vessel_type: VesselType) -> ORBMode:
    """Determine correct ORB mode based on vessel type per MARPOL."""
    if vessel_type in PART2_VESSEL_TYPES:
        return ORBMode.BOTH
    return ORBMode.PART1


class Vessel(Base):
    __tablename__ = "vessels"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name            = Column(String(100), nullable=False)
    imo_number      = Column(String(20), unique=True, nullable=False)
    mmsi            = Column(String(20), nullable=True)
    call_sign       = Column(String(20), nullable=True)
    flag_state      = Column(String(50), nullable=False)
    vessel_type     = Column(Enum(VesselType), nullable=False)
    gross_tonnage   = Column(String(20), nullable=True)
    deadweight      = Column(String(20), nullable=True)
    year_built      = Column(String(4), nullable=True)
    owner           = Column(String(100), nullable=True)
    operator        = Column(String(100), nullable=True)
    orb_mode        = Column(Enum(ORBMode), default=ORBMode.PART1, nullable=False)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tanks               = relationship("Tank", back_populates="vessel")
    orb_part1_entries   = relationship("ORBPart1Entry", back_populates="vessel")
    orb_part2_entries   = relationship("ORBPart2Entry", back_populates="vessel")

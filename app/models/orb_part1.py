"""
ORB Part I Model - Machinery Space Operations
MARPOL Annex I, Regulation 17, Resolution MEPC.312(74)
"""
from sqlalchemy import Column, String, DateTime, Boolean, Enum, Float, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.database import Base


class OperationCodeP1(str, enum.Enum):
    A = "A"  # Ballasting of fuel oil tanks
    B = "B"  # Cleaning of fuel oil tanks
    C = "C"  # Discharge of dirty ballast
    D = "D"  # Cleaning of bilge water
    E = "E"  # Discharge of bilge water
    F = "F"  # Condition of OWS/ODM equipment
    G = "G"  # Accidental/other discharge
    H = "H"  # Bunkering
    I = "I"  # Additional operational procedures


class DischargeMethod(str, enum.Enum):
    INTO_SEA             = "into_sea"
    TO_RECEPTION         = "to_reception_facility"
    INCINERATED          = "incinerated"
    TRANSFERRED          = "transferred"


class ShipStatus(str, enum.Enum):
    EN_ROUTE    = "en_route"
    APPROACHING = "approaching"
    AT_ANCHOR   = "at_anchor"
    IN_PORT     = "in_port"
    MANEUVERING = "maneuvering"
    UNKNOWN     = "unknown"


class ORBPart1Entry(Base):
    __tablename__ = "orb_part1_entries"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vessel_id        = Column(UUID(as_uuid=True), ForeignKey("vessels.id"), nullable=False)
    officer_id       = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_by       = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    operation_code   = Column(Enum(OperationCodeP1), nullable=False)
    operation_date   = Column(DateTime, nullable=False)
    ship_status      = Column(Enum(ShipStatus), default=ShipStatus.UNKNOWN)
    position_lat     = Column(Float, nullable=True)
    position_lon     = Column(Float, nullable=True)
    position_source  = Column(String(20), nullable=True)  # gps, manual, google_maps
    port_name        = Column(String(100), nullable=True)
    tank_id          = Column(UUID(as_uuid=True), ForeignKey("tanks.id"), nullable=True)
    quantity_m3      = Column(Float, nullable=True)
    volume_before_m3 = Column(Float, nullable=True)   # tank volume before operation
    volume_after_m3  = Column(Float, nullable=True)   # tank volume after operation
    discharge_method = Column(Enum(DischargeMethod), nullable=True)
    ows_rate         = Column(Float, nullable=True)
    oil_content_ppm  = Column(Float, nullable=True)
    in_special_area  = Column(Boolean, default=False)  # MARPOL special area flag
    special_area_name= Column(String(100), nullable=True)
    remarks          = Column(Text, nullable=True)
    is_deleted       = Column(Boolean, default=False)
    created_at       = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    vessel = relationship("Vessel", back_populates="orb_part1_entries")

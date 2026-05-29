"""
ORB Part I Model - Machinery Space Operations
MARPOL Annex I, Regulation 17, Resolution MEPC.312(74)

Extended operations beyond strict MARPOL codes to support
practical ship operations:
- Tank-to-tank transfer (internal transfers within machinery space)
- Loading/discharging of fuel (mapped to Code H)
"""
from sqlalchemy import Column, String, DateTime, Boolean, Enum, Float, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.database import Base


class OperationCodeP1(str, enum.Enum):
    A = "A"   # Ballasting of fuel oil tanks
    B = "B"   # Cleaning of fuel oil tanks
    C = "C"   # Discharge of dirty ballast
    D = "D"   # Cleaning of bilge water
    E = "E"   # Discharge of bilge water
    F = "F"   # Condition of OWS/ODM equipment
    G = "G"   # Accidental/other discharge
    H = "H"   # Bunkering / Loading / Discharging fuel
    I = "I"   # Additional operational procedures
    T = "T"   # Internal tank-to-tank transfer (operational, recorded under I)


class OperationType(str, enum.Enum):
    # Derived from MARPOL codes but more specific for the UI
    BALLASTING          = "ballasting"
    DEBALLASTING        = "deballasting"
    TANK_CLEANING       = "tank_cleaning"
    BILGE_CLEANING      = "bilge_cleaning"
    BILGE_DISCHARGE     = "bilge_discharge"
    OWS_CONDITION       = "ows_condition"
    ACCIDENTAL          = "accidental"
    BUNKERING           = "bunkering"           # Loading fuel from bunker barge
    LOADING             = "loading"             # Loading fuel/oil into tank
    DISCHARGING         = "discharging"         # Discharging fuel/oil from tank
    TRANSFER            = "transfer"            # Tank-to-tank internal transfer
    ADDITIONAL          = "additional"


class ShipStatus(str, enum.Enum):
    EN_ROUTE    = "en_route"
    APPROACHING = "approaching"
    AT_ANCHOR   = "at_anchor"
    IN_PORT     = "in_port"
    MANEUVERING = "maneuvering"
    UNKNOWN     = "unknown"


class DischargeMethod(str, enum.Enum):
    INTO_SEA        = "into_sea"
    TO_RECEPTION    = "to_reception_facility"
    INCINERATED     = "incinerated"
    TRANSFERRED     = "transferred"


class ORBPart1Entry(Base):
    __tablename__ = "orb_part1_entries"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vessel_id           = Column(UUID(as_uuid=True), ForeignKey("vessels.id"), nullable=False)
    officer_id          = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_by          = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    operation_code      = Column(Enum(OperationCodeP1), nullable=False)
    operation_type      = Column(Enum(OperationType), nullable=True)
    operation_date      = Column(DateTime, nullable=False)
    ship_status         = Column(Enum(ShipStatus), default=ShipStatus.UNKNOWN)

    # Position
    position_lat        = Column(Float, nullable=True)
    position_lon        = Column(Float, nullable=True)
    position_source     = Column(String(20), nullable=True)
    port_name           = Column(String(100), nullable=True)

    # Primary tank
    tank_id             = Column(UUID(as_uuid=True), ForeignKey("tanks.id"), nullable=True)
    quantity_m3         = Column(Float, nullable=True)
    volume_before_m3    = Column(Float, nullable=True)
    volume_after_m3     = Column(Float, nullable=True)

    # Transfer destination tank (for tank-to-tank transfers)
    tank_to_id          = Column(UUID(as_uuid=True), ForeignKey("tanks.id"), nullable=True)
    volume_to_before_m3 = Column(Float, nullable=True)
    volume_to_after_m3  = Column(Float, nullable=True)

    # Discharge/OWS fields
    discharge_method    = Column(Enum(DischargeMethod), nullable=True)
    ows_rate            = Column(Float, nullable=True)
    oil_content_ppm     = Column(Float, nullable=True)

    # Environmental
    in_special_area     = Column(Boolean, default=False)
    special_area_name   = Column(String(100), nullable=True)

    # Bunkering specific
    bunker_supplier     = Column(String(100), nullable=True)
    bunker_grade        = Column(String(50), nullable=True)    # HFO, VLSFO, MGO, etc.
    bunker_density      = Column(Float, nullable=True)         # kg/m³
    bunker_mass_mt      = Column(Float, nullable=True)         # metric tons

    remarks             = Column(Text, nullable=True)
    is_deleted          = Column(Boolean, default=False)
    created_at          = Column(DateTime, default=datetime.utcnow)
    updated_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    vessel  = relationship("Vessel", back_populates="orb_part1_entries")

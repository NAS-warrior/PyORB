"""
ORB Part II Model - Cargo/Ballast Operations
MARPOL Annex I, Regulations 36 & 37
"""
from sqlalchemy import Column, String, DateTime, Boolean, Enum, Float, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.database import Base


class OperationCodeP2(str, enum.Enum):
    A = "A"  # Loading of oil cargo
    B = "B"  # Internal transfer of oil cargo
    C = "C"  # Unloading of oil cargo
    D = "D"  # Ballasting of cargo tanks
    E = "E"  # Cleaning of cargo tanks
    F = "F"  # Discharge of ballast water
    G = "G"  # Accidental/other discharge


class ORBPart2Entry(Base):
    __tablename__ = "orb_part2_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vessel_id = Column(UUID(as_uuid=True), ForeignKey("vessels.id"), nullable=False)
    officer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    operation_code = Column(Enum(OperationCodeP2), nullable=False)
    operation_date = Column(DateTime, nullable=False)
    position_lat = Column(Float, nullable=True)
    position_lon = Column(Float, nullable=True)
    port_name = Column(String(100), nullable=True)
    tank_id = Column(UUID(as_uuid=True), ForeignKey("tanks.id"), nullable=True)
    cargo_type = Column(String(100), nullable=True)
    quantity_m3 = Column(Float, nullable=True)
    remarks = Column(Text, nullable=True)
    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    vessel = relationship("Vessel", back_populates="orb_part2_entries")

"""
Tank Model
Vessel tanks with volume tracking and par level alarms
"""
from sqlalchemy import Column, String, DateTime, Boolean, Enum, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.database import Base


class TankType(str, enum.Enum):
    FUEL_OIL        = "fuel_oil"
    DIESEL_OIL      = "diesel_oil"
    LUBRICATING_OIL = "lubricating_oil"
    BALLAST         = "ballast"
    SLOP            = "slop"
    BILGE           = "bilge"
    CARGO           = "cargo"
    FRESH_WATER     = "fresh_water"
    OTHER           = "other"


class Tank(Base):
    __tablename__ = "tanks"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vessel_id           = Column(UUID(as_uuid=True), ForeignKey("vessels.id"), nullable=False)
    name                = Column(String(100), nullable=False)
    tank_type           = Column(Enum(TankType), nullable=False)
    capacity_m3         = Column(Float, nullable=False)
    current_volume_m3   = Column(Float, default=0.0, nullable=False)   # tracked volume
    frame_from          = Column(String(10), nullable=True)
    frame_to            = Column(String(10), nullable=True)
    position            = Column(String(20), nullable=True)
    external_system_id  = Column(String(100), nullable=True)
    # Par level alarms
    alarm_high_pct      = Column(Float, default=90.0, nullable=True)   # % — warn when above
    alarm_low_pct       = Column(Float, default=10.0, nullable=True)   # % — warn when below
    alarm_enabled       = Column(Boolean, default=False)
    is_active           = Column(Boolean, default=True)
    created_at          = Column(DateTime, default=datetime.utcnow)
    updated_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    vessel = relationship("Vessel", back_populates="tanks")

    @property
    def fill_pct(self) -> float:
        if self.capacity_m3 <= 0:
            return 0.0
        return round((self.current_volume_m3 / self.capacity_m3) * 100, 1)

    @property
    def available_m3(self) -> float:
        return round(self.capacity_m3 - self.current_volume_m3, 3)

    @property
    def alarm_high(self) -> bool:
        if not self.alarm_enabled or not self.alarm_high_pct:
            return False
        return self.fill_pct >= self.alarm_high_pct

    @property
    def alarm_low(self) -> bool:
        if not self.alarm_enabled or not self.alarm_low_pct:
            return False
        return self.fill_pct <= self.alarm_low_pct

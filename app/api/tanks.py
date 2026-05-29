"""
PyORB Tanks API
Tank management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.database import get_db
from app.api.deps import require_read, require_write, require_admin
from app.models.tank import Tank, TankType
from app.models.user import User
from app.services.audit_service import log_action
from app.models.audit_log import AuditAction

router = APIRouter()


class TankCreate(BaseModel):
    vessel_id: str
    name: str
    tank_type: TankType
    capacity_m3: float
    frame_from: Optional[str] = None
    frame_to: Optional[str] = None
    position: Optional[str] = None
    external_system_id: Optional[str] = None


class TankUpdate(BaseModel):
    name: Optional[str] = None
    tank_type: Optional[TankType] = None
    capacity_m3: Optional[float] = None
    frame_from: Optional[str] = None
    frame_to: Optional[str] = None
    position: Optional[str] = None
    external_system_id: Optional[str] = None
    is_active: Optional[bool] = None
    alarm_high_pct: Optional[float] = None
    alarm_low_pct: Optional[float] = None
    alarm_enabled: Optional[bool] = None


class TankResponse(BaseModel):
    id: str
    vessel_id: str
    name: str
    tank_type: str
    capacity_m3: float
    current_volume_m3: float = 0.0
    fill_pct: float = 0.0
    available_m3: float = 0.0
    frame_from: Optional[str]
    frame_to: Optional[str]
    position: Optional[str]
    external_system_id: Optional[str]
    is_active: bool
    alarm_high_pct: Optional[float] = 90.0
    alarm_low_pct: Optional[float] = 10.0
    alarm_enabled: bool = False


@router.get("/", response_model=List[TankResponse])
async def list_tanks(
    tank_type: Optional[TankType] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_read)
):
    """List all tanks, optionally filtered by type."""
    query = db.query(Tank).filter(Tank.is_active == True)
    if tank_type:
        query = query.filter(Tank.tank_type == tank_type)
    tanks = query.order_by(Tank.name).all()
    return [TankResponse(
        id=str(t.id), vessel_id=str(t.vessel_id), name=t.name,
        tank_type=t.tank_type.value, capacity_m3=t.capacity_m3,
        current_volume_m3=t.current_volume_m3 or 0.0,
        fill_pct=t.fill_pct,
        available_m3=t.available_m3,
        frame_from=t.frame_from, frame_to=t.frame_to, position=t.position,
        external_system_id=t.external_system_id, is_active=t.is_active,
        alarm_high_pct=t.alarm_high_pct,
        alarm_low_pct=t.alarm_low_pct,
        alarm_enabled=t.alarm_enabled or False
    ) for t in tanks]


@router.post("/", response_model=TankResponse, status_code=status.HTTP_201_CREATED)
async def create_tank(
    data: TankCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create a new tank (Admin only)."""
    tank = Tank(**data.model_dump())
    db.add(tank)
    db.commit()
    db.refresh(tank)
    log_action(db=db, action=AuditAction.CREATE, table_name="tanks",
               user=current_user, record_id=tank.id,
               new_values=data.model_dump(), description=f"Created tank {tank.name}")
    return TankResponse(
        id=str(tank.id), vessel_id=str(tank.vessel_id), name=tank.name,
        tank_type=tank.tank_type.value, capacity_m3=tank.capacity_m3,
        frame_from=tank.frame_from, frame_to=tank.frame_to, position=tank.position,
        external_system_id=tank.external_system_id, is_active=tank.is_active
    )


@router.put("/{tank_id}", response_model=TankResponse)
async def update_tank(
    tank_id: str,
    data: TankUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update tank details (Admin only)."""
    tank = db.query(Tank).filter(Tank.id == tank_id).first()
    if not tank:
        raise HTTPException(status_code=404, detail="Tank not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(tank, field, value)
    db.commit()
    db.refresh(tank)
    log_action(db=db, action=AuditAction.UPDATE, table_name="tanks",
               user=current_user, record_id=tank.id,
               new_values=data.model_dump(exclude_none=True),
               description=f"Updated tank {tank.name}")
    return TankResponse(
        id=str(tank.id), vessel_id=str(tank.vessel_id), name=tank.name,
        tank_type=tank.tank_type.value, capacity_m3=tank.capacity_m3,
        frame_from=tank.frame_from, frame_to=tank.frame_to, position=tank.position,
        external_system_id=tank.external_system_id, is_active=tank.is_active
    )


@router.delete("/{tank_id}")
async def deactivate_tank(
    tank_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Deactivate a tank — soft delete only (Admin only)."""
    tank = db.query(Tank).filter(Tank.id == tank_id).first()
    if not tank:
        raise HTTPException(status_code=404, detail="Tank not found")
    tank.is_active = False
    db.commit()
    log_action(db=db, action=AuditAction.DELETE, table_name="tanks",
               user=current_user, record_id=tank.id,
               description=f"Deactivated tank {tank.name}")
    return {"message": f"Tank {tank.name} deactivated"}


@router.put("/{tank_id}/alarms")
async def update_tank_alarms(
    tank_id: str,
    alarm_high_pct: float = 90.0,
    alarm_low_pct: float = 10.0,
    alarm_enabled: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update par level alarm settings for a tank."""
    from app.models.tank import Tank as TankModel
    tank = db.query(TankModel).filter(TankModel.id == tank_id).first()
    if not tank:
        raise HTTPException(status_code=404, detail="Tank not found")
    tank.alarm_high_pct = alarm_high_pct
    tank.alarm_low_pct = alarm_low_pct
    tank.alarm_enabled = alarm_enabled
    db.commit()
    return {"message": "Alarm settings updated"}

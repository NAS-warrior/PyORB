"""
PyORB Vessel API
Vessel setup and configuration endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.api.deps import require_read, require_admin
from app.models.vessel import Vessel, VesselType, ORBMode
from app.models.user import User
from app.services.audit_service import log_action
from app.models.audit_log import AuditAction

router = APIRouter()


class VesselCreate(BaseModel):
    name: str
    imo_number: str
    mmsi: Optional[str] = None
    call_sign: Optional[str] = None
    flag_state: str
    vessel_type: VesselType
    gross_tonnage: Optional[str] = None
    deadweight: Optional[str] = None
    year_built: Optional[str] = None
    owner: Optional[str] = None
    operator: Optional[str] = None
    orb_mode: ORBMode = ORBMode.PART1


class VesselUpdate(BaseModel):
    name: Optional[str] = None
    flag_state: Optional[str] = None
    owner: Optional[str] = None
    operator: Optional[str] = None
    orb_mode: Optional[ORBMode] = None


class VesselResponse(BaseModel):
    id: str
    name: str
    imo_number: str
    mmsi: Optional[str]
    call_sign: Optional[str]
    flag_state: str
    vessel_type: str
    gross_tonnage: Optional[str]
    deadweight: Optional[str]
    year_built: Optional[str]
    owner: Optional[str]
    operator: Optional[str]
    orb_mode: str

    class Config:
        from_attributes = True


@router.get("/", response_model=VesselResponse)
async def get_vessel(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_read)
):
    """Get vessel particulars."""
    vessel = db.query(Vessel).filter(Vessel.is_active == True).first()
    if not vessel:
        raise HTTPException(status_code=404, detail="Vessel not configured yet")
    return VesselResponse(
        id=str(vessel.id),
        name=vessel.name,
        imo_number=vessel.imo_number,
        mmsi=vessel.mmsi,
        call_sign=vessel.call_sign,
        flag_state=vessel.flag_state,
        vessel_type=vessel.vessel_type.value,
        gross_tonnage=vessel.gross_tonnage,
        deadweight=vessel.deadweight,
        year_built=vessel.year_built,
        owner=vessel.owner,
        operator=vessel.operator,
        orb_mode=vessel.orb_mode.value
    )


@router.post("/", response_model=VesselResponse, status_code=status.HTTP_201_CREATED)
async def create_vessel(
    data: VesselCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create vessel configuration (Admin only)."""
    existing = db.query(Vessel).filter(Vessel.imo_number == data.imo_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Vessel with this IMO number already exists")
    vessel = Vessel(**data.model_dump())
    db.add(vessel)
    db.commit()
    db.refresh(vessel)
    log_action(db=db, action=AuditAction.CREATE, table_name="vessels",
               user=current_user, record_id=vessel.id,
               new_values=data.model_dump(), description=f"Created vessel {vessel.name}")
    return VesselResponse(
        id=str(vessel.id), name=vessel.name, imo_number=vessel.imo_number,
        mmsi=vessel.mmsi, call_sign=vessel.call_sign, flag_state=vessel.flag_state,
        vessel_type=vessel.vessel_type.value, gross_tonnage=vessel.gross_tonnage,
        deadweight=vessel.deadweight, year_built=vessel.year_built,
        owner=vessel.owner, operator=vessel.operator, orb_mode=vessel.orb_mode.value
    )


@router.put("/{vessel_id}", response_model=VesselResponse)
async def update_vessel(
    vessel_id: str,
    data: VesselUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update vessel particulars (Admin only)."""
    vessel = db.query(Vessel).filter(Vessel.id == vessel_id).first()
    if not vessel:
        raise HTTPException(status_code=404, detail="Vessel not found")
    old_values = {c.name: str(getattr(vessel, c.name)) for c in vessel.__table__.columns}
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(vessel, field, value)
    db.commit()
    db.refresh(vessel)
    log_action(db=db, action=AuditAction.UPDATE, table_name="vessels",
               user=current_user, record_id=vessel.id,
               old_values=old_values, new_values=data.model_dump(exclude_none=True),
               description=f"Updated vessel {vessel.name}")
    return VesselResponse(
        id=str(vessel.id), name=vessel.name, imo_number=vessel.imo_number,
        mmsi=vessel.mmsi, call_sign=vessel.call_sign, flag_state=vessel.flag_state,
        vessel_type=vessel.vessel_type.value, gross_tonnage=vessel.gross_tonnage,
        deadweight=vessel.deadweight, year_built=vessel.year_built,
        owner=vessel.owner, operator=vessel.operator, orb_mode=vessel.orb_mode.value
    )

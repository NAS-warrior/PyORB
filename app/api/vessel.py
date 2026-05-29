"""
PyORB Vessel API
Vessel setup — ORB mode auto-assigned based on vessel type per MARPOL
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.api.deps import require_read, require_admin
from app.models.vessel import Vessel, VesselType, ORBMode, get_orb_mode, PART2_VESSEL_TYPES
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


class VesselUpdate(BaseModel):
    name: Optional[str] = None
    flag_state: Optional[str] = None
    vessel_type: Optional[VesselType] = None
    gross_tonnage: Optional[str] = None
    deadweight: Optional[str] = None
    year_built: Optional[str] = None
    owner: Optional[str] = None
    operator: Optional[str] = None


class VesselResponse(BaseModel):
    id: str
    name: str
    imo_number: str
    mmsi: Optional[str]
    call_sign: Optional[str]
    flag_state: str
    vessel_type: str
    vessel_type_label: str
    gross_tonnage: Optional[str]
    deadweight: Optional[str]
    year_built: Optional[str]
    owner: Optional[str]
    operator: Optional[str]
    orb_mode: str
    orb_mode_label: str
    requires_part2: bool

    class Config:
        from_attributes = True


VESSEL_TYPE_LABELS = {
    "oil_tanker": "Oil Tanker",
    "product_tanker": "Product Tanker",
    "chemical_tanker": "Chemical Tanker",
    "oil_barge": "Oil Barge",
    "bulk_carrier": "Bulk Carrier",
    "general_cargo": "General Cargo",
    "container": "Container Ship",
    "passenger": "Passenger Ship",
    "other": "Other",
}

ORB_MODE_LABELS = {
    "part1": "Part I — Machinery Space Only",
    "both": "Part I + Part II — Tanker Operations",
}


def vessel_to_response(v: Vessel) -> VesselResponse:
    return VesselResponse(
        id=str(v.id),
        name=v.name,
        imo_number=v.imo_number,
        mmsi=v.mmsi,
        call_sign=v.call_sign,
        flag_state=v.flag_state,
        vessel_type=v.vessel_type.value,
        vessel_type_label=VESSEL_TYPE_LABELS.get(v.vessel_type.value, v.vessel_type.value),
        gross_tonnage=v.gross_tonnage,
        deadweight=v.deadweight,
        year_built=v.year_built,
        owner=v.owner,
        operator=v.operator,
        orb_mode=v.orb_mode.value,
        orb_mode_label=ORB_MODE_LABELS.get(v.orb_mode.value, v.orb_mode.value),
        requires_part2=v.vessel_type in PART2_VESSEL_TYPES
    )


@router.get("/", response_model=VesselResponse)
async def get_vessel(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_read)
):
    vessel = db.query(Vessel).filter(Vessel.is_active == True).first()
    if not vessel:
        raise HTTPException(status_code=404, detail="Vessel not configured yet")
    return vessel_to_response(vessel)


@router.post("/", response_model=VesselResponse, status_code=status.HTTP_201_CREATED)
async def create_vessel(
    data: VesselCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    existing = db.query(Vessel).filter(Vessel.imo_number == data.imo_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Vessel with this IMO number already exists")

    # Auto-assign ORB mode based on vessel type
    orb_mode = get_orb_mode(data.vessel_type)

    vessel = Vessel(
        name=data.name,
        imo_number=data.imo_number,
        mmsi=data.mmsi,
        call_sign=data.call_sign,
        flag_state=data.flag_state,
        vessel_type=data.vessel_type,
        gross_tonnage=data.gross_tonnage,
        deadweight=data.deadweight,
        year_built=data.year_built,
        owner=data.owner,
        operator=data.operator,
        orb_mode=orb_mode
    )
    db.add(vessel)
    db.commit()
    db.refresh(vessel)
    log_action(db=db, action=AuditAction.CREATE, table_name="vessels",
               user=current_user, record_id=vessel.id,
               description=f"Created vessel {vessel.name} — ORB mode: {orb_mode.value}")
    return vessel_to_response(vessel)


@router.put("/{vessel_id}", response_model=VesselResponse)
async def update_vessel(
    vessel_id: str,
    data: VesselUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    vessel = db.query(Vessel).filter(Vessel.id == vessel_id).first()
    if not vessel:
        raise HTTPException(status_code=404, detail="Vessel not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(vessel, field, value)

    # Recalculate ORB mode if vessel type changed
    if data.vessel_type:
        vessel.orb_mode = get_orb_mode(data.vessel_type)

    db.commit()
    db.refresh(vessel)
    log_action(db=db, action=AuditAction.UPDATE, table_name="vessels",
               user=current_user, record_id=vessel.id,
               description=f"Updated vessel {vessel.name}")
    return vessel_to_response(vessel)

"""
PyORB ORB Entries API
Part I and Part II entry submission with full validation
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel, validator
from typing import Optional, List
from datetime import datetime
from app.database import get_db
from app.api.deps import require_read, require_write
from app.models.user import User
from app.models.tank import Tank
from app.models.orb_part1 import ORBPart1Entry, OperationCodeP1, ShipStatus
from app.models.orb_part2 import ORBPart2Entry, OperationCodeP2
from app.models.vessel import Vessel, PART2_VESSEL_TYPES
from app.services.audit_service import log_action
from app.models.audit_log import AuditAction
from loguru import logger

router = APIRouter()

# ── Validation helpers ────────────────────────────────────────────────────────

# Operations that ADD volume to tank
VOLUME_ADD_OPS_P1 = {'A', 'H'}   # Ballasting FO tanks, Bunkering
VOLUME_ADD_OPS_P2 = {'A', 'D'}   # Loading cargo, Ballasting cargo tanks

# Operations that REMOVE volume from tank
VOLUME_REMOVE_OPS_P1 = {'C', 'E', 'G'}  # Discharge dirty ballast, discharge bilge, accidental
VOLUME_REMOVE_OPS_P2 = {'C', 'F', 'G'}  # Unloading cargo, discharge ballast, accidental

# Codes requiring PPM reading
REQUIRES_PPM = {'E', 'F'}

# Codes requiring remarks
REQUIRES_REMARKS = {'G'}

# Codes blocked in port for overboard discharge
PORT_BLOCK_CODES = {'E'}  # Bilge discharge requires OWS and PPM in port

# MARPOL Special Areas — discharge restrictions
SPECIAL_AREAS = [
    "Mediterranean Sea", "Baltic Sea", "Black Sea", "Red Sea",
    "Gulfs Area", "Gulf of Aden", "Antarctic Area", "North West European Waters",
    "Oman Area of Arabian Sea", "Southern South African Waters"
]


def validate_volume(tank: Tank, quantity_m3: float, operation: str, part: str) -> dict:
    """
    Validate quantity against tank capacity and current volume.
    Returns {'valid': bool, 'error': str|None, 'warning': str|None}
    """
    if quantity_m3 is None or quantity_m3 <= 0:
        return {'valid': True, 'error': None, 'warning': None}

    add_ops = VOLUME_ADD_OPS_P1 if part == 'p1' else VOLUME_ADD_OPS_P2
    rem_ops = VOLUME_REMOVE_OPS_P1 if part == 'p1' else VOLUME_REMOVE_OPS_P2

    if operation in add_ops:
        # Check capacity
        available = tank.capacity_m3 - tank.current_volume_m3
        if quantity_m3 > available:
            return {
                'valid': False,
                'error': (f"Cannot add {quantity_m3:.2f} m³ to {tank.name}. "
                         f"Available capacity: {available:.2f} m³ "
                         f"(current: {tank.current_volume_m3:.2f} / capacity: {tank.capacity_m3:.2f} m³)"),
                'warning': None
            }
        # Check high alarm
        new_vol = tank.current_volume_m3 + quantity_m3
        new_pct = (new_vol / tank.capacity_m3) * 100
        if tank.alarm_enabled and tank.alarm_high_pct and new_pct >= tank.alarm_high_pct:
            return {
                'valid': True, 'error': None,
                'warning': (f"Warning: {tank.name} will reach {new_pct:.1f}% "
                           f"which exceeds the alarm threshold of {tank.alarm_high_pct}%")
            }

    elif operation in rem_ops:
        # Check available volume
        if quantity_m3 > tank.current_volume_m3:
            return {
                'valid': False,
                'error': (f"Cannot remove {quantity_m3:.2f} m³ from {tank.name}. "
                         f"Current volume: {tank.current_volume_m3:.2f} m³"),
                'warning': None
            }
        # Check low alarm
        new_vol = tank.current_volume_m3 - quantity_m3
        new_pct = (new_vol / tank.capacity_m3) * 100
        if tank.alarm_enabled and tank.alarm_low_pct and new_pct <= tank.alarm_low_pct:
            return {
                'valid': True, 'error': None,
                'warning': (f"Warning: {tank.name} will reach {new_pct:.1f}% "
                           f"which is below the alarm threshold of {tank.alarm_low_pct}%")
            }

    return {'valid': True, 'error': None, 'warning': None}


# ── Schemas ───────────────────────────────────────────────────────────────────

class ORBPart1Create(BaseModel):
    vessel_id: str
    officer_id: str
    operation_code: str
    operation_date: str
    ship_status: Optional[str] = "unknown"
    position_lat: Optional[float] = None
    position_lon: Optional[float] = None
    position_source: Optional[str] = "manual"
    port_name: Optional[str] = None
    tank_id: Optional[str] = None
    quantity_m3: Optional[float] = None
    discharge_method: Optional[str] = None
    ows_rate: Optional[float] = None
    oil_content_ppm: Optional[float] = None
    in_special_area: Optional[bool] = False
    special_area_name: Optional[str] = None
    remarks: Optional[str] = None


class ORBPart2Create(BaseModel):
    vessel_id: str
    officer_id: str
    operation_code: str
    operation_date: str
    ship_status: Optional[str] = "unknown"
    position_lat: Optional[float] = None
    position_lon: Optional[float] = None
    position_source: Optional[str] = "manual"
    port_name: Optional[str] = None
    tank_id: Optional[str] = None
    cargo_type: Optional[str] = None
    quantity_m3: Optional[float] = None
    in_special_area: Optional[bool] = False
    special_area_name: Optional[str] = None
    remarks: Optional[str] = None


class ValidationRequest(BaseModel):
    tank_id: str
    operation_code: str
    quantity_m3: Optional[float] = None
    part: str = "p1"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/validate")
async def validate_entry(
    data: ValidationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_write)
):
    """Pre-validate an entry before submission — returns errors and warnings."""
    tank = db.query(Tank).filter(Tank.id == data.tank_id, Tank.is_active == True).first()
    if not tank:
        raise HTTPException(status_code=404, detail="Tank not found")

    errors = []
    warnings = []

    # Volume validation
    if data.quantity_m3:
        vol_check = validate_volume(tank, data.quantity_m3, data.operation_code, data.part)
        if not vol_check['valid']:
            errors.append(vol_check['error'])
        if vol_check['warning']:
            warnings.append(vol_check['warning'])

    # PPM required for discharge codes
    if data.operation_code in REQUIRES_PPM and data.part == 'p1':
        warnings.append(f"Code {data.operation_code} requires an OWS rate and PPM reading from the ODM")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "tank": {
            "name": tank.name,
            "current_volume_m3": tank.current_volume_m3,
            "capacity_m3": tank.capacity_m3,
            "fill_pct": tank.fill_pct,
            "available_m3": tank.available_m3
        }
    }


@router.post("/part1", status_code=status.HTTP_201_CREATED)
async def create_part1_entry(
    data: ORBPart1Create,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_write)
):
    """Submit an ORB Part I entry with full validation."""
    # Validate operation code
    try:
        op_code = OperationCodeP1(data.operation_code)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid operation code: {data.operation_code}")

    # Validate remarks for Code G
    if data.operation_code == 'G' and not data.remarks:
        raise HTTPException(status_code=400, detail="Code G (accidental discharge) requires remarks explaining the circumstances")

    # PPM required for Code E
    if data.operation_code == 'E' and data.oil_content_ppm is None:
        raise HTTPException(status_code=400, detail="Code E (discharge of bilge water) requires PPM reading from ODM")

    tank = None
    if data.tank_id:
        tank = db.query(Tank).filter(Tank.id == data.tank_id, Tank.is_active == True).first()
        if not tank:
            raise HTTPException(status_code=404, detail="Tank not found")

        # Volume validation
        if data.quantity_m3:
            vol_check = validate_volume(tank, data.quantity_m3, data.operation_code, 'p1')
            if not vol_check['valid']:
                raise HTTPException(status_code=400, detail=vol_check['error'])

    # Parse date
    try:
        op_date = datetime.fromisoformat(data.operation_date.replace('Z', '+00:00'))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid operation date format")

    # Create entry
    entry = ORBPart1Entry(
        vessel_id=data.vessel_id,
        officer_id=data.officer_id,
        created_by=str(current_user.id),
        operation_code=op_code,
        operation_date=op_date,
        ship_status=data.ship_status,
        position_lat=data.position_lat,
        position_lon=data.position_lon,
        position_source=data.position_source,
        port_name=data.port_name,
        tank_id=data.tank_id,
        quantity_m3=data.quantity_m3,
        volume_before_m3=tank.current_volume_m3 if tank else None,
        discharge_method=data.discharge_method,
        ows_rate=data.ows_rate,
        oil_content_ppm=data.oil_content_ppm,
        in_special_area=data.in_special_area,
        special_area_name=data.special_area_name,
        remarks=data.remarks,
    )
    db.add(entry)

    # Update tank volume
    if tank and data.quantity_m3:
        if data.operation_code in VOLUME_ADD_OPS_P1:
            tank.current_volume_m3 = min(
                tank.current_volume_m3 + data.quantity_m3, tank.capacity_m3
            )
        elif data.operation_code in VOLUME_REMOVE_OPS_P1:
            tank.current_volume_m3 = max(
                tank.current_volume_m3 - data.quantity_m3, 0
            )
        entry.volume_after_m3 = tank.current_volume_m3

    db.commit()
    db.refresh(entry)

    log_action(db=db, action=AuditAction.CREATE, table_name="orb_part1_entries",
               user=current_user, record_id=entry.id,
               description=f"ORB Part I Code {data.operation_code} — {tank.name if tank else 'no tank'}")

    return {"id": str(entry.id), "message": "ORB Part I entry recorded successfully"}


@router.get("/part1")
async def list_part1_entries(
    vessel_id: Optional[str] = None,
    tank_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_read)
):
    """List ORB Part I entries with optional filters."""
    query = db.query(ORBPart1Entry).filter(ORBPart1Entry.is_deleted == False)
    if vessel_id:
        query = query.filter(ORBPart1Entry.vessel_id == vessel_id)
    if tank_id:
        query = query.filter(ORBPart1Entry.tank_id == tank_id)
    entries = query.order_by(desc(ORBPart1Entry.operation_date)).offset(offset).limit(limit).all()

    result = []
    for e in entries:
        tank = db.query(Tank).filter(Tank.id == e.tank_id).first() if e.tank_id else None
        officer = db.query(User).filter(User.id == e.officer_id).first()
        result.append({
            "id": str(e.id),
            "operation_code": e.operation_code.value,
            "operation_date": e.operation_date.isoformat(),
            "tank_name": tank.name if tank else "-",
            "tank_type": tank.tank_type.value if tank else "-",
            "quantity_m3": e.quantity_m3,
            "volume_before_m3": e.volume_before_m3,
            "volume_after_m3": e.volume_after_m3,
            "oil_content_ppm": e.oil_content_ppm,
            "port_name": e.port_name,
            "position_lat": e.position_lat,
            "position_lon": e.position_lon,
            "ship_status": e.ship_status,
            "in_special_area": e.in_special_area,
            "special_area_name": e.special_area_name,
            "officer": officer.full_name if officer else "-",
            "remarks": e.remarks,
        })
    return result


@router.get("/tank/{tank_id}/history")
async def tank_history(
    tank_id: str,
    limit: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_read)
):
    """Get volume history for a tank — used for the capacity graph."""
    entries = db.query(ORBPart1Entry).filter(
        ORBPart1Entry.tank_id == tank_id,
        ORBPart1Entry.is_deleted == False,
        ORBPart1Entry.volume_after_m3 != None
    ).order_by(ORBPart1Entry.operation_date).limit(limit).all()

    tank = db.query(Tank).filter(Tank.id == tank_id).first()
    if not tank:
        raise HTTPException(status_code=404, detail="Tank not found")

    history = [{
        "date": e.operation_date.isoformat(),
        "volume_m3": e.volume_after_m3,
        "fill_pct": round((e.volume_after_m3 / tank.capacity_m3) * 100, 1) if tank.capacity_m3 else 0,
        "operation_code": e.operation_code.value,
    } for e in entries]

    return {
        "tank_id": tank_id,
        "tank_name": tank.name,
        "capacity_m3": tank.capacity_m3,
        "current_volume_m3": tank.current_volume_m3,
        "fill_pct": tank.fill_pct,
        "available_m3": tank.available_m3,
        "alarm_high_pct": tank.alarm_high_pct,
        "alarm_low_pct": tank.alarm_low_pct,
        "alarm_enabled": tank.alarm_enabled,
        "alarm_high": tank.alarm_high,
        "alarm_low": tank.alarm_low,
        "history": history
    }

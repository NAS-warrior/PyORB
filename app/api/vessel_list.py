"""
Vessel List API — returns all vessels for the selector
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.database import get_db
from app.api.deps import require_read, require_admin
from app.models.vessel import Vessel, VesselType, ORBMode, get_orb_mode, PART2_VESSEL_TYPES
from app.models.user import User
from app.api.vessel import vessel_to_response, VesselCreate, VesselResponse

router = APIRouter()


@router.get("/", response_model=List[VesselResponse])
async def list_all_vessels(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_read)
):
    """List all configured vessels."""
    vessels = db.query(Vessel).filter(Vessel.is_active == True).order_by(Vessel.name).all()
    return [vessel_to_response(v) for v in vessels]


@router.get("/{vessel_id}", response_model=VesselResponse)
async def get_vessel_by_id(
    vessel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_read)
):
    """Get a specific vessel by ID."""
    vessel = db.query(Vessel).filter(Vessel.id == vessel_id, Vessel.is_active == True).first()
    if not vessel:
        raise HTTPException(status_code=404, detail="Vessel not found")
    return vessel_to_response(vessel)

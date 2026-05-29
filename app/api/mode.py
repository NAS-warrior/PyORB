"""
PyORB Mode Switching API
Allows licensed users to switch between DORB-Ship and DORB-Control
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db, switch_mode, get_db_status
from app.api.deps import require_admin
from app.models.user import User
from app.config import settings, AppMode
from app.services.audit_service import log_action
from app.models.audit_log import AuditAction
from loguru import logger

router = APIRouter()


class ModeSwitchRequest(BaseModel):
    target_mode: str   # "ship" or "control"
    license_key: str   # License key for the target mode


class ModeStatusResponse(BaseModel):
    current_mode: str
    mode_label: str
    available_modes: list
    ship_db_status: str
    control_db_status: str
    ship_licensed: bool
    control_licensed: bool


@router.get("/status", response_model=ModeStatusResponse)
async def get_mode_status(
    current_user: User = Depends(require_admin)
):
    """Get current mode and database status."""
    db_status = get_db_status()
    return ModeStatusResponse(
        current_mode=settings.app_mode.value,
        mode_label=settings.mode_label,
        available_modes=[m.value for m in settings.available_modes()],
        ship_db_status=db_status["ship"],
        control_db_status=db_status["control"],
        ship_licensed=settings.is_ship_licensed(),
        control_licensed=settings.is_control_licensed()
    )


@router.post("/switch")
async def switch_operational_mode(
    request: ModeSwitchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Switch between DORB-Ship and DORB-Control modes.
    Requires admin role and a valid license key for the target mode.
    Each mode uses its own separate database.
    """
    # Validate target mode
    try:
        target = AppMode(request.target_mode)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid mode. Must be 'ship' or 'control'"
        )

    # Check not already in target mode
    if settings.app_mode == target:
        raise HTTPException(
            status_code=400,
            detail=f"Already in {settings.mode_label} mode"
        )

    # Validate license key for target mode
    if target == AppMode.SHIP:
        if not request.license_key.startswith("SHIP-"):
            raise HTTPException(
                status_code=403,
                detail="Invalid DORB-Ship license key"
            )
        settings.license_ship = request.license_key
        if not settings.is_ship_licensed():
            raise HTTPException(
                status_code=403,
                detail="DORB-Ship license key is not valid"
            )

    elif target == AppMode.CONTROL:
        if not request.license_key.startswith("CTRL-"):
            raise HTTPException(
                status_code=403,
                detail="Invalid DORB-Control license key"
            )
        settings.license_control = request.license_key
        if not settings.is_control_licensed():
            raise HTTPException(
                status_code=403,
                detail="DORB-Control license key is not valid"
            )

    # Perform the switch
    old_mode = settings.app_mode.value
    success = switch_mode(target)
    if not success:
        raise HTTPException(
            status_code=503,
            detail=f"Cannot switch to {target.value} mode — database not available or not configured"
        )

    # Log the mode switch
    log_action(
        db=db,
        action=AuditAction.UPDATE,
        table_name="system",
        user=current_user,
        description=f"Mode switched from {old_mode} to {target.value} by {current_user.username}",
        new_values={"mode": target.value, "switched_by": current_user.username}
    )

    logger.warning(
        f"MODE SWITCH: {old_mode} → {target.value} "
        f"by user {current_user.username} ({current_user.full_name})"
    )

    return {
        "success": True,
        "previous_mode": old_mode,
        "current_mode": target.value,
        "mode_label": settings.mode_label,
        "message": f"Switched to {settings.mode_label}. Page will reload."
    }

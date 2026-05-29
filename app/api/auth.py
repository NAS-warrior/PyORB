"""
PyORB Authentication API
Login, token, current user endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import timedelta

from app.database import get_db
from app.services.auth_service import authenticate_user, create_access_token
from app.services.audit_service import log_action
from app.models.audit_log import AuditAction
from app.api.deps import get_current_active_user
from app.models.user import User, UserRole
from app.config import settings

router = APIRouter()


class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict


class UserResponse(BaseModel):
    id: str
    username: str
    full_name: str
    role: str
    rank: Optional[str]

    class Config:
        from_attributes = True


@router.post("/token", response_model=Token)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login and receive JWT access token."""
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=settings.jwt_expire_minutes)
    )
    log_action(
        db=db,
        action=AuditAction.LOGIN,
        table_name="users",
        user=user,
        record_id=user.id,
        description=f"User {user.username} logged in",
        ip_address=request.client.host
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role.value,
            "rank": user.rank
        }
    }


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_active_user)):
    """Get current logged in user details."""
    return UserResponse(
        id=str(current_user.id),
        username=current_user.username,
        full_name=current_user.full_name,
        role=current_user.role.value,
        rank=current_user.rank
    )

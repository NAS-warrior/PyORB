"""
PyORB Users API
User management endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from app.database import get_db
from app.api.deps import require_read, require_admin, get_current_active_user
from app.models.user import User, UserRole
from app.services.auth_service import create_user, hash_password
from app.services.audit_service import log_action
from app.models.audit_log import AuditAction

router = APIRouter()


class UserCreate(BaseModel):
    username: str
    full_name: str
    password: str
    role: UserRole = UserRole.VIEWER
    rank: Optional[str] = None
    email: Optional[str] = None
    certificate_number: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    rank: Optional[str] = None
    email: Optional[str] = None
    certificate_number: Optional[str] = None
    is_active: Optional[bool] = None


class PasswordChange(BaseModel):
    new_password: str


class UserResponse(BaseModel):
    id: str
    username: str
    full_name: str
    role: str
    rank: Optional[str]
    email: Optional[str]
    certificate_number: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True


@router.get("/", response_model=List[UserResponse])
async def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_read)
):
    """List all users."""
    users = db.query(User).order_by(User.full_name).all()
    return [UserResponse(
        id=str(u.id), username=u.username, full_name=u.full_name,
        role=u.role.value, rank=u.rank, email=u.email,
        certificate_number=u.certificate_number, is_active=u.is_active
    ) for u in users]


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_new_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create a new user (Admin only)."""
    existing = db.query(User).filter(User.username == data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    user = create_user(
        db=db, username=data.username, full_name=data.full_name,
        password=data.password, role=data.role, rank=data.rank,
        email=data.email, certificate_number=data.certificate_number
    )
    log_action(db=db, action=AuditAction.CREATE, table_name="users",
               user=current_user, record_id=user.id,
               new_values={"username": data.username, "role": data.role.value},
               description=f"Created user {data.username}")
    return UserResponse(
        id=str(user.id), username=user.username, full_name=user.full_name,
        role=user.role.value, rank=user.rank, email=user.email,
        certificate_number=user.certificate_number, is_active=user.is_active
    )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update user details (Admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    log_action(db=db, action=AuditAction.UPDATE, table_name="users",
               user=current_user, record_id=user.id,
               new_values=data.model_dump(exclude_none=True),
               description=f"Updated user {user.username}")
    return UserResponse(
        id=str(user.id), username=user.username, full_name=user.full_name,
        role=user.role.value, rank=user.rank, email=user.email,
        certificate_number=user.certificate_number, is_active=user.is_active
    )


@router.put("/{user_id}/password")
async def change_password(
    user_id: str,
    data: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Change user password (Admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = hash_password(data.new_password)
    db.commit()
    log_action(db=db, action=AuditAction.UPDATE, table_name="users",
               user=current_user, record_id=user.id,
               description=f"Password changed for user {user.username}")
    return {"message": "Password updated successfully"}

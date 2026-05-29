"""
PyORB Authentication Service
JWT token generation, password hashing, user verification
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.config import settings
from loguru import logger

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.jwt_expire_minutes))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    user = db.query(User).filter(User.username == username, User.is_active == True).first()
    if not user or not verify_password(password, user.hashed_password):
        logger.warning(f"Failed login attempt for username: {username}")
        return None
    user.last_login = datetime.utcnow()
    db.commit()
    logger.info(f"User {username} logged in successfully")
    return user


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def create_user(db: Session, username: str, full_name: str, password: str,
                role: UserRole = UserRole.VIEWER, rank: str = None,
                email: str = None, certificate_number: str = None) -> User:
    user = User(
        username=username,
        full_name=full_name,
        email=email,
        rank=rank,
        certificate_number=certificate_number,
        role=role,
        hashed_password=hash_password(password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info(f"Created user: {username} with role: {role}")
    return user


# Role permission checks
ROLE_PERMISSIONS = {
    UserRole.ADMIN: ["read", "write", "export", "admin"],
    UserRole.CHIEF_ENGINEER: ["read", "write", "export"],
    UserRole.SECOND_ENGINEER: ["read", "write"],
    UserRole.THIRD_ENGINEER: ["read", "write"],
    UserRole.OFFICER: ["read", "write"],
    UserRole.MASTER: ["read", "export"],
    UserRole.SHORE_OFFICE: ["read", "export"],
    UserRole.PORT_AUTHORITY: ["read"],
    UserRole.VIEWER: ["read"],
}


def has_permission(user: User, permission: str) -> bool:
    return permission in ROLE_PERMISSIONS.get(user.role, [])

"""
User Model
Crew members and their access roles
"""
from sqlalchemy import Column, String, DateTime, Boolean, Enum
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
import enum

from app.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    CHIEF_ENGINEER = "chief_engineer"
    SECOND_ENGINEER = "second_engineer"
    THIRD_ENGINEER = "third_engineer"
    OFFICER = "officer"
    MASTER = "master"
    SHORE_OFFICE = "shore_office"
    PORT_AUTHORITY = "port_authority"
    VIEWER = "viewer"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=True)
    full_name = Column(String(100), nullable=False)
    rank = Column(String(50), nullable=True)
    certificate_number = Column(String(50), nullable=True)
    role = Column(Enum(UserRole), default=UserRole.VIEWER, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

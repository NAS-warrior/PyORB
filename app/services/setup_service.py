"""
PyORB Setup Service
Creates the initial admin user if no users exist
"""
from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.services.auth_service import create_user
from loguru import logger


def create_initial_admin(db: Session, username: str = "admin",
                         password: str = "admin", full_name: str = "System Administrator"):
    """
    Create the initial admin user on first run.
    Called during startup if no users exist.
    """
    existing = db.query(User).first()
    if existing:
        logger.info("Users already exist, skipping initial admin creation")
        return None

    admin = create_user(
        db=db,
        username=username,
        full_name=full_name,
        password=password,
        role=UserRole.ADMIN,
        rank="Administrator"
    )
    logger.warning(f"Created initial admin user: {username} / {password}")
    logger.warning("IMPORTANT: Change the admin password immediately after first login!")
    return admin

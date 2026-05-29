"""
PyORB Setup Service
Creates the initial admin user if no users exist
"""
from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.services.auth_service import create_user
from loguru import logger


def create_initial_admin(db: Session):
    """
    Create the initial admin user on first run.
    Called during startup if no users exist.
    """
    try:
        existing = db.query(User).first()
        if existing:
            logger.info("Users already exist, skipping initial admin creation")
            return None

        # Use a simple short password to avoid bcrypt 72-byte limit
        admin = create_user(
            db=db,
            username="admin",
            full_name="System Administrator",
            password="admin123",
            role=UserRole.ADMIN,
            rank="Administrator"
        )
        logger.warning("=" * 50)
        logger.warning("Initial admin user created:")
        logger.warning("  Username : admin")
        logger.warning("  Password : admin123")
        logger.warning("CHANGE THIS PASSWORD IMMEDIATELY!")
        logger.warning("=" * 50)
        return admin
    except Exception as e:
        logger.error(f"Failed to create initial admin: {e}")
        db.rollback()
        return None

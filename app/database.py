"""
PyORB Dual-Database Manager
DORB-Ship  → pyorb_ship    database
DORB-Control → pyorb_control database

Both databases share the same schema.
The active database is determined by APP_MODE in .env.
Mode can be switched at runtime by a licensed admin user.
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from app.config import settings, AppMode
from loguru import logger
from typing import Generator

Base = declarative_base()

# ── Engine pool — one engine per database ─────────────────────────────────────

def _make_engine(url: str, pool_size: int = 10):
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=pool_size,
        max_overflow=20,
        echo=settings.debug
    )


# Ship engine — always initialized
try:
    ship_engine = _make_engine(settings.get_ship_db_url())
    ShipSession = sessionmaker(autocommit=False, autoflush=False, bind=ship_engine)
    logger.info(f"DORB-Ship DB engine ready: {settings.ship_db_name}")
except Exception as e:
    ship_engine = None
    ShipSession = None
    logger.warning(f"DORB-Ship DB not available: {e}")

# Control engine — initialized only if control DB is configured
try:
    control_engine = _make_engine(settings.get_control_db_url(), pool_size=20)
    ControlSession = sessionmaker(autocommit=False, autoflush=False, bind=control_engine)
    logger.info(f"DORB-Control DB engine ready: {settings.control_db_name}")
except Exception as e:
    control_engine = None
    ControlSession = None
    logger.warning(f"DORB-Control DB not available: {e}")


# ── Active session — returns session for the current mode ─────────────────────

def get_active_engine():
    if settings.app_mode == AppMode.CONTROL:
        if control_engine is None:
            raise RuntimeError("DORB-Control database is not configured or unavailable")
        return control_engine
    if ship_engine is None:
        raise RuntimeError("DORB-Ship database is not configured or unavailable")
    return ship_engine


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency — yields a DB session for the active mode."""
    if settings.app_mode == AppMode.CONTROL:
        if ControlSession is None:
            raise RuntimeError("DORB-Control database not available")
        db = ControlSession()
    else:
        if ShipSession is None:
            raise RuntimeError("DORB-Ship database not available")
        db = ShipSession()
    try:
        yield db
    finally:
        db.close()


def get_ship_db() -> Generator[Session, None, None]:
    """Explicit ship DB session — used for sync operations in control mode."""
    if ShipSession is None:
        raise RuntimeError("DORB-Ship database not available")
    db = ShipSession()
    try:
        yield db
    finally:
        db.close()


def get_control_db() -> Generator[Session, None, None]:
    """Explicit control DB session."""
    if ControlSession is None:
        raise RuntimeError("DORB-Control database not available")
    db = ControlSession()
    try:
        yield db
    finally:
        db.close()


# ── Schema initialization ─────────────────────────────────────────────────────

def init_db():
    """Initialize tables on the active mode database."""
    from app.models import vessel, user, tank, orb_part1, orb_part2, audit_log

    engine = get_active_engine()
    Base.metadata.create_all(bind=engine)
    logger.info(f"Schema initialized on {settings.mode_label} database")

    # Create initial admin if no users exist
    if settings.app_mode == AppMode.SHIP and ShipSession:
        db = ShipSession()
        try:
            from app.services.setup_service import create_initial_admin
            create_initial_admin(db)
        finally:
            db.close()


def init_both_dbs():
    """Initialize schema on both databases (used during full setup)."""
    from app.models import vessel, user, tank, orb_part1, orb_part2, audit_log

    if ship_engine:
        Base.metadata.create_all(bind=ship_engine)
        logger.info(f"Schema initialized: DORB-Ship ({settings.ship_db_name})")

    if control_engine:
        Base.metadata.create_all(bind=control_engine)
        logger.info(f"Schema initialized: DORB-Control ({settings.control_db_name})")


def switch_mode(new_mode: AppMode) -> bool:
    """
    Switch the active mode at runtime.
    Returns True if switch was successful.
    Caller must verify the user holds a valid license for the target mode.
    """
    if new_mode == AppMode.CONTROL and control_engine is None:
        logger.error("Cannot switch to DORB-Control: database not configured")
        return False
    if new_mode == AppMode.SHIP and ship_engine is None:
        logger.error("Cannot switch to DORB-Ship: database not configured")
        return False

    settings.app_mode = new_mode
    logger.info(f"Mode switched to {settings.mode_label}")
    return True


def get_db_status() -> dict:
    """Return connectivity status of both databases."""
    def check(engine):
        if engine is None:
            return "not_configured"
        try:
            with engine.connect() as conn:
                conn.execute(__import__('sqlalchemy').text("SELECT 1"))
            return "online"
        except Exception as e:
            return f"error: {str(e)[:60]}"

    return {
        "ship":    check(ship_engine),
        "control": check(control_engine),
        "active":  settings.app_mode.value,
    }

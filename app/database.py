"""
PyORB Database Connection
PostgreSQL via SQLAlchemy - internal access only
"""
from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings
from loguru import logger

DATABASE_URL = settings.get_database_url()

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=settings.debug
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency for FastAPI routes - provides DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables."""
    from app.models import vessel, user, tank, orb_part1, orb_part2, audit_log
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized")

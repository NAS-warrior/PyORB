"""
PyORB — Oil Record Book System
Dual-mode: DORB-Ship | DORB-Control
"""
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from loguru import logger
from pathlib import Path
import uvicorn

from app.config import settings
from app.database import init_db, get_db_status
from app.api import auth, vessel, users, tanks, mode

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(
    title=f"PyORB — {settings.mode_label}",
    description="MARPOL Annex I Compliant Oil Record Book System",
    version=settings.app_version,
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

# API Routers
app.include_router(auth.router,   prefix="/api/auth",   tags=["Authentication"])
app.include_router(vessel.router, prefix="/api/vessel", tags=["Vessel"])
app.include_router(users.router,  prefix="/api/users",  tags=["Users"])
app.include_router(tanks.router,  prefix="/api/tanks",  tags=["Tanks"])
app.include_router(mode.router,   prefix="/api/mode",   tags=["Mode"])


@app.on_event("startup")
async def startup_event():
    logger.info(f"Starting PyORB v{settings.app_version} — {settings.mode_label}")
    try:
        init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.error(f"DB init error: {e}")
    db_status = get_db_status()
    logger.info(f"DB status: Ship={db_status['ship']} Control={db_status['control']}")
    logger.info(f"Active mode: {settings.mode_label}")


@app.get("/health")
async def health_check():
    db_status = get_db_status()
    return {
        "status": "ok",
        "version": settings.app_version,
        "mode": settings.app_mode.value,
        "mode_label": settings.mode_label,
        "db_ship": db_status["ship"],
        "db_control": db_status["control"]
    }


@app.get("/api/appinfo")
async def app_info():
    """Public endpoint — returns current mode info for the UI topbar."""
    return {
        "mode": settings.app_mode.value,
        "mode_label": settings.mode_label,
        "mode_color": settings.mode_color,
        "app_version": settings.app_version,
        "ship_licensed": settings.is_ship_licensed(),
        "control_licensed": settings.is_control_licensed(),
    }


@app.get("/")
async def root():
    return FileResponse(str(BASE_DIR / "templates" / "dashboard.html"), media_type="text/html")


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.debug
    )

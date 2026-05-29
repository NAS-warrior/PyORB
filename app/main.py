"""
PyORB - Oil Record Book System
Main FastAPI Application Entry Point
MARPOL Annex I Compliant
"""
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger
from pathlib import Path
import uvicorn

from app.config import settings
from app.database import init_db
from app.api import auth, vessel, users, tanks

# Base directory of the project
BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(
    title="PyORB - Oil Record Book System",
    description="MARPOL Annex I Compliant Oil Record Book Management System",
    version=settings.app_version,
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files & templates using absolute paths
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")

# API Routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(vessel.router, prefix="/api/vessel", tags=["Vessel"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(tanks.router, prefix="/api/tanks", tags=["Tanks"])


@app.on_event("startup")
async def startup_event():
    logger.info(f"Starting PyORB v{settings.app_version}")
    try:
        init_db()
        logger.info("PyORB started successfully")
    except Exception as e:
        logger.error(f"Startup error: {e}")


@app.get("/")
async def root(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": settings.app_version, "app": settings.app_name}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}")
    return JSONResponse(status_code=500, content={"detail": str(exc)})


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.debug
    )

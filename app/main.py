"""
PyORB - Oil Record Book System
Main FastAPI Application Entry Point
MARPOL Annex I Compliant
"""
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from loguru import logger
import uvicorn

from app.config import settings
from app.database import init_db
from app.api import auth, vessel, users, tanks

app = FastAPI(
    title="PyORB - Oil Record Book System",
    description="MARPOL Annex I Compliant Oil Record Book Management System",
    version=settings.app_version,
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# CORS - restrict to local network only
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://127.0.0.1", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files & templates
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

# Include API routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(vessel.router, prefix="/api/vessel", tags=["Vessel"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(tanks.router, prefix="/api/tanks", tags=["Tanks"])


@app.on_event("startup")
async def startup_event():
    logger.info(f"Starting PyORB v{settings.app_version}")
    init_db()
    logger.info("PyORB started successfully")


@app.get("/")
async def root(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": settings.app_version, "app": settings.app_name}


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.debug
    )

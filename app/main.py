"""
PyORB - Oil Record Book System
"""
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from loguru import logger
from pathlib import Path
import uvicorn

from app.config import settings
from app.database import init_db
from app.api import auth, vessel, users, tanks

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(
    title="PyORB",
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


@app.on_event("startup")
async def startup_event():
    logger.info(f"Starting PyORB v{settings.app_version}")
    try:
        init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.error(f"DB init error: {e}")
    logger.info("PyORB startup complete")


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": settings.app_version}


@app.get("/")
async def root():
    # Serve HTML directly as a file - no Jinja2 needed
    html_file = BASE_DIR / "templates" / "dashboard.html"
    return FileResponse(str(html_file), media_type="text/html")


app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(vessel.router, prefix="/api/vessel", tags=["Vessel"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(tanks.router, prefix="/api/tanks", tags=["Tanks"])


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.debug
    )

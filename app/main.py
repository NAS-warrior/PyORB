"""
PyORB - Oil Record Book System
Main FastAPI Application Entry Point
"""
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
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

# Mount static files
try:
    app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
    logger.info(f"Static files mounted from {BASE_DIR / 'static'}")
except Exception as e:
    logger.error(f"Static files error: {e}")

# Templates
try:
    templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))
    logger.info(f"Templates loaded from {BASE_DIR / 'templates'}")
except Exception as e:
    logger.error(f"Templates error: {e}")
    templates = None

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
        logger.info("Database initialized")
    except Exception as e:
        logger.error(f"DB init error: {e}")
    logger.info("PyORB startup complete")


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": settings.app_version}


@app.get("/test")
async def test():
    return HTMLResponse("<h1>PyORB is running</h1>")


@app.get("/")
async def root(request: Request):
    try:
        if templates is None:
            return HTMLResponse("<h1>Templates not loaded</h1>")
        return templates.TemplateResponse("dashboard.html", {"request": request})
    except Exception as e:
        logger.error(f"Root route error: {e}")
        return JSONResponse(status_code=500, content={"detail": str(e), "type": type(e).__name__})


if __name__ == "__main__":
    uvicorn.run("app.main:app", host=settings.app_host, port=settings.app_port, reload=settings.debug)

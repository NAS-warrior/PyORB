"""
PyORB - Oil Record Book System
"""
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from loguru import logger
from pathlib import Path
import traceback
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
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

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


@app.get("/")
async def root(request: Request):
    try:
        return templates.TemplateResponse("dashboard.html", {"request": request})
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"Root route full traceback:\n{tb}")
        return JSONResponse(
            status_code=500,
            content={"detail": str(e), "type": type(e).__name__, "traceback": tb}
        )


if __name__ == "__main__":
    uvicorn.run("app.main:app", host=settings.app_host, port=settings.app_port, reload=settings.debug)

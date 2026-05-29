"""
PyORB Application Configuration
Supports dual-mode operation: DORB-Ship and DORB-Control
Each mode uses its own independent database
"""
from pydantic_settings import BaseSettings
from typing import Optional
from enum import Enum


class AppMode(str, Enum):
    SHIP    = "ship"      # DORB-Ship — single vessel onboard operation
    CONTROL = "control"   # DORB-Control — superintendent fleet management


class Settings(BaseSettings):
    # Application
    app_name: str = "PyORB"
    app_version: str = "1.0.0"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    debug: bool = False
    app_mode: AppMode = AppMode.SHIP

    # License keys — controls which modes can be activated
    license_ship: Optional[str] = None
    license_control: Optional[str] = None

    # Security
    secret_key: str = "change-this-secret-key"
    jwt_secret: str = "change-this-jwt-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480

    # DORB-Ship database
    ship_db_host: str = "localhost"
    ship_db_port: int = 5432
    ship_db_name: str = "pyorb_ship"
    ship_db_user: str = "pyorb_ship_user"
    ship_db_password: str = ""

    # DORB-Control database
    control_db_host: str = "localhost"
    control_db_port: int = 5432
    control_db_name: str = "pyorb_control"
    control_db_user: str = "pyorb_control_user"
    control_db_password: str = ""

    # Exports
    export_path: str = "./exports"

    # External integrations
    valmarine_api_url: Optional[str] = None
    valmarine_api_key: Optional[str] = None
    kongsberg_api_url: Optional[str] = None
    kongsberg_api_key: Optional[str] = None
    napa_api_url: Optional[str] = None
    napa_api_key: Optional[str] = None

    # Logging
    log_level: str = "INFO"
    log_file: str = "./logs/pyorb.log"

    class Config:
        env_file = ".env"
        case_sensitive = False

    def get_ship_db_url(self) -> str:
        return (f"postgresql://{self.ship_db_user}:{self.ship_db_password}"
                f"@{self.ship_db_host}:{self.ship_db_port}/{self.ship_db_name}")

    def get_control_db_url(self) -> str:
        return (f"postgresql://{self.control_db_user}:{self.control_db_password}"
                f"@{self.control_db_host}:{self.control_db_port}/{self.control_db_name}")

    def get_active_db_url(self) -> str:
        """Return the database URL for the currently active mode."""
        if self.app_mode == AppMode.CONTROL:
            return self.get_control_db_url()
        return self.get_ship_db_url()

    def is_ship_licensed(self) -> bool:
        """Check if DORB-Ship license is present and valid."""
        if not self.license_ship:
            return False
        # Phase 6: validate against license server or embedded validation
        # For now: any non-empty key enables the mode
        return self.license_ship.startswith("SHIP-")

    def is_control_licensed(self) -> bool:
        """Check if DORB-Control license is present and valid."""
        if not self.license_control:
            return False
        return self.license_control.startswith("CTRL-")

    def available_modes(self) -> list:
        """Return list of modes the current license allows."""
        modes = []
        # Ship mode is always available without license (dev/trial)
        if self.is_ship_licensed() or not self.license_ship:
            modes.append(AppMode.SHIP)
        if self.is_control_licensed():
            modes.append(AppMode.CONTROL)
        return modes

    @property
    def mode_label(self) -> str:
        if self.app_mode == AppMode.CONTROL:
            return "DORB-Control"
        return "DORB-Ship"

    @property
    def mode_color(self) -> str:
        if self.app_mode == AppMode.CONTROL:
            return "#6b21a8"  # purple for control
        return "#1a3a5c"      # navy for ship


settings = Settings()

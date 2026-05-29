"""
PyORB Application Configuration
Loads settings from environment variables / .env file
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    app_name: str = "PyORB"
    app_version: str = "1.0.0"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    debug: bool = False
    secret_key: str = "change-this-secret-key"

    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "pyorb"
    db_user: str = "pyorb_user"
    db_password: str = ""
    database_url: Optional[str] = None

    jwt_secret: str = "change-this-jwt-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480

    export_path: str = "./exports"

    valmarine_api_url: Optional[str] = None
    valmarine_api_key: Optional[str] = None
    kongsberg_api_url: Optional[str] = None
    kongsberg_api_key: Optional[str] = None
    napa_api_url: Optional[str] = None
    napa_api_key: Optional[str] = None

    log_level: str = "INFO"
    log_file: str = "./logs/pyorb.log"

    class Config:
        env_file = ".env"
        case_sensitive = False

    def get_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        return f"postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"


settings = Settings()

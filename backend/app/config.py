from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    database_url: str = "postgresql://evm:evm_password@localhost:5432/evm_db"
    secret_key: str = "dev-secret-key-change-in-production"
    algorithm: str = "HS256"

    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    frontend_url: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


def get_app_config(db) -> dict:
    """Get application configuration from database with fallback to environment variables."""
    from app.models.settings import SiteSettings

    env_settings = get_settings()

    try:
        site_settings = db.query(SiteSettings).first()
        if site_settings:
            return {
                'access_token_expire_minutes': site_settings.access_token_expire_minutes or env_settings.access_token_expire_minutes,
                'refresh_token_expire_days': site_settings.refresh_token_expire_days or env_settings.refresh_token_expire_days,
                'frontend_url': site_settings.frontend_url or env_settings.frontend_url,
            }
    except Exception:
        pass

    return {
        'access_token_expire_minutes': env_settings.access_token_expire_minutes,
        'refresh_token_expire_days': env_settings.refresh_token_expire_days,
        'frontend_url': env_settings.frontend_url,
    }

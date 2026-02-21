"""SalesForge settings — loaded from .env via pydantic-settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    anthropic_api_key: str = ""
    linkup_api_key: str = ""
    database_url: str = "sqlite+aiosqlite:///./salesforge.db"
    stripe_api_key: str = ""
    elevenlabs_api_key: str = ""
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60


settings = Settings()

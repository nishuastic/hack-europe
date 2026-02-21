"""Stick settings — loaded from .env via pydantic-settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    anthropic_api_key: str = ""
    linkup_api_key: str = ""
    database_url: str = "sqlite+aiosqlite:///./salesforge.db"
    stripe_api_key: str = ""
    elevenlabs_api_key: str = ""


settings = Settings()

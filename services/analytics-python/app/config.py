"""LeetRank analytics-python settings."""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    port: int = 4016
    database_url: str = "postgresql://leetrank:leetrank-dev@localhost:5432/leetrank"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "dev-secret-change-me"
    log_level: str = "info"
    cors_allowed_origins: str = "*"


@lru_cache
def get_settings() -> Settings:
    return Settings()

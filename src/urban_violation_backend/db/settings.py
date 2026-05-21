"""Database runtime settings and environment parsing."""

from __future__ import annotations

from enum import Enum
import os

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator


class PlatformStateBackend(str, Enum):
    """Supported mutable-state persistence backends."""

    FILE = "file"
    DATABASE = "database"


class DatabaseRuntimeSettings(BaseModel):
    """Validated runtime configuration for state backend selection."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    platform_state_backend: PlatformStateBackend = PlatformStateBackend.FILE
    database_url: str | None = None
    platform_db_auto_migrate: bool = False

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: str | None) -> str | None:
        """Normalize optional URL and reject blank values."""
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @property
    def database_enabled(self) -> bool:
        """Return whether the database-backed mode was selected."""
        return self.platform_state_backend == PlatformStateBackend.DATABASE

    def require_database_url(self) -> str:
        """Return DATABASE_URL or raise a clear configuration error."""
        if self.database_url is None:
            raise ValueError("DATABASE_URL is required when PLATFORM_STATE_BACKEND=database")
        return self.database_url

    @classmethod
    def from_env(cls) -> "DatabaseRuntimeSettings":
        """Build validated settings from process environment variables."""
        backend_raw = (os.environ.get("PLATFORM_STATE_BACKEND", "file") or "file").strip().lower()
        auto_migrate_raw = (os.environ.get("PLATFORM_DB_AUTO_MIGRATE", "0") or "0").strip().lower()
        database_url = os.environ.get("DATABASE_URL")

        auto_migrate = auto_migrate_raw in {"1", "true", "yes", "on"}
        payload = {
            "platform_state_backend": backend_raw,
            "database_url": database_url,
            "platform_db_auto_migrate": auto_migrate,
        }
        try:
            return cls.model_validate(payload)
        except ValidationError as exc:
            raise ValueError(f"Invalid database runtime settings: {exc}") from exc

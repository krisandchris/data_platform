"""Database foundation package for TASK-019 migration phases."""

from urban_violation_backend.db.engine import (
    build_engine,
    build_session_factory,
    redact_database_url,
)
from urban_violation_backend.db.foundation import (
    DatabaseBackedPlatformStateStore,
    DatabaseFoundationRegistryRepository,
    DatabaseLabelConfigRepository,
    FoundationRegistryRepositoryProtocol,
)
from urban_violation_backend.db.migrations import run_migrations_to_head
from urban_violation_backend.db.settings import DatabaseRuntimeSettings, PlatformStateBackend

__all__ = [
    "DatabaseBackedPlatformStateStore",
    "DatabaseFoundationRegistryRepository",
    "DatabaseLabelConfigRepository",
    "DatabaseRuntimeSettings",
    "FoundationRegistryRepositoryProtocol",
    "PlatformStateBackend",
    "build_engine",
    "build_session_factory",
    "redact_database_url",
    "run_migrations_to_head",
]

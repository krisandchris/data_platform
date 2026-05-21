"""Alembic migration helpers for application startup wiring."""

from __future__ import annotations

from alembic import command
from alembic.config import Config

from urban_violation_backend.db.engine import alembic_ini_path


def run_migrations_to_head(database_url: str) -> None:
    """Upgrade database schema to the latest Alembic head revision."""
    cfg = Config(str(alembic_ini_path()))
    cfg.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(cfg, "head")

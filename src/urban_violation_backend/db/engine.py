"""SQLAlchemy engine and session-factory helpers."""

from __future__ import annotations

from collections.abc import Callable
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from sqlalchemy import Engine, create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker


SessionFactory = sessionmaker[Session]


def build_engine(database_url: str) -> Engine:
    """Create a SQLAlchemy engine for the configured database URL."""
    return create_engine(database_url, pool_pre_ping=True)


def build_session_factory(engine: Engine) -> SessionFactory:
    """Create a new session factory bound to the provided engine."""
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


@contextmanager
def session_scope(factory: Callable[[], Session]) -> Iterator[Session]:
    """Open one transactional session scope with rollback-on-error."""
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def redact_database_url(database_url: str) -> str:
    """Return a log-safe URL with password redacted."""
    parsed = make_url(database_url)
    return parsed.render_as_string(hide_password=True)


def alembic_ini_path() -> Path:
    """Resolve repository-local Alembic ini path from this package."""
    return Path(__file__).resolve().parents[3] / "alembic.ini"

"""Declarative metadata base for Urban Violation backend database tables."""

from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all backend ORM mappings."""

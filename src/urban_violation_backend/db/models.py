"""ORM table definitions for Phase 3 PostgreSQL foundation domains."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from urban_violation_backend.db.base import Base


class PlatformUserRow(Base):
    """Durable user account rows."""

    __tablename__ = "platform_users"

    user_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PlatformRoleBindingRow(Base):
    """Durable RBAC role-binding rows."""

    __tablename__ = "platform_role_bindings"

    binding_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(64), nullable=False)
    scope_type: Mapped[str] = mapped_column(String(32), nullable=False)
    scope_id: Mapped[str] = mapped_column(String(180), nullable=False)
    created_by: Mapped[str] = mapped_column(String(80), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class PlatformSessionRow(Base):
    """Durable auth-session rows."""

    __tablename__ = "platform_sessions"

    session_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)
    auth_mode: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class DatasetTypeRegistryRow(Base):
    """Dataset type registry rows."""

    __tablename__ = "dataset_types"

    dataset_type: Mapped[str] = mapped_column(String(80), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    field_schema_version: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class DatasetBatchRow(Base):
    """Dataset batch registry rows (summary metadata payload)."""

    __tablename__ = "dataset_batches"

    dataset_id: Mapped[str] = mapped_column(String(160), primary_key=True)
    dataset_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    summary_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ImportJobRow(Base):
    """Import-job metadata rows."""

    __tablename__ = "import_jobs"

    job_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    dataset_id: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    job_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class LabelConfigRow(Base):
    """Stored label-config version rows."""

    __tablename__ = "label_configs"
    __table_args__ = (
        UniqueConstraint("dataset_id", "content_hash", name="uq_label_configs_dataset_hash"),
    )

    config_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    dataset_id: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    schema_version: Mapped[str] = mapped_column(String(80), nullable=False)
    version: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    content_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    validation_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    config_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)


class LabelConfigActiveRow(Base):
    """Active label-config pointer per dataset type."""

    __tablename__ = "label_config_active"

    dataset_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    config_id: Mapped[str] = mapped_column(String(120), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class AuditEventRow(Base):
    """Append-only audit events."""

    __tablename__ = "audit_events"

    event_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    actor_user_id: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    actor_roles: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    entity: Mapped[str] = mapped_column(String(120), nullable=False)
    dataset_id: Mapped[str | None] = mapped_column(String(160), nullable=True, index=True)
    sample_id: Mapped[str | None] = mapped_column(String(160), nullable=True)
    details: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    before_payload: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    after_payload: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

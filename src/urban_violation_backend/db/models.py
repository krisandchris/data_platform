"""ORM table definitions for TASK-019 PostgreSQL foundation and QC state."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Integer, JSON, String, Text, UniqueConstraint
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


class QcAssignmentRow(Base):
    """One active batch assignment row per dataset batch."""

    __tablename__ = "qc_assignments"

    dataset_id: Mapped[str] = mapped_column(String(160), primary_key=True)
    assignment_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class QcTaskRow(Base):
    """Per-sample QC task rows."""

    __tablename__ = "qc_tasks"

    dataset_id: Mapped[str] = mapped_column(String(160), primary_key=True)
    task_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    sample_id: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    task_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    task_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class QcLeaseRow(Base):
    """Sample lease rows."""

    __tablename__ = "qc_leases"

    dataset_id: Mapped[str] = mapped_column(String(160), primary_key=True)
    lease_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    sample_id: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    lease_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    lease_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class QcDraftRow(Base):
    """User draft rows for one dataset/sample."""

    __tablename__ = "qc_drafts"

    dataset_id: Mapped[str] = mapped_column(String(160), primary_key=True)
    sample_id: Mapped[str] = mapped_column(String(160), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    draft_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)


class QcBatchDraftRow(Base):
    """Batch-level draft manifest rows."""

    __tablename__ = "qc_batch_drafts"

    dataset_id: Mapped[str] = mapped_column(String(160), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    draft_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class QcSubmissionRow(Base):
    """Immutable label edit submission rows."""

    __tablename__ = "qc_submissions"

    submission_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    dataset_id: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    sample_id: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    submission_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)


class AnnotationSnapshotRow(Base):
    """Stored annotation snapshot rows."""

    __tablename__ = "annotation_snapshots"

    snapshot_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    dataset_id: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    sample_id: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    snapshot_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    payload_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    source_submission_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    label_config_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    label_config_version: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    snapshot_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)


class ModificationEventRow(Base):
    """Normalized QC modification event rows."""

    __tablename__ = "modification_events"
    __table_args__ = (
        UniqueConstraint("dataset_id", "event_key", name="uq_modification_events_dataset_event_key"),
    )

    event_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    event_key: Mapped[str] = mapped_column(String(255), nullable=False)
    dataset_id: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    sample_id: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    submission_id: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    event_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)


class SamplePoolItemRow(Base):
    """Correction sample pool rows."""

    __tablename__ = "sample_pool_items"

    item_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    item_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    dataset_id: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    item_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)


class ExportJobRow(Base):
    """Export job metadata rows with filesystem artifact pointers."""

    __tablename__ = "export_jobs"

    export_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    export_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)


class EvaluationRunRow(Base):
    """Evaluation run metadata rows."""

    __tablename__ = "evaluation_runs"

    evaluation_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    dataset_id: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    evaluation_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)

"""TASK-019 Phase 3 foundation tables"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260522_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "platform_users",
        sa.Column("user_id", sa.String(length=80), primary_key=True, nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "platform_role_bindings",
        sa.Column("binding_id", sa.String(length=80), primary_key=True, nullable=False),
        sa.Column("user_id", sa.String(length=80), nullable=False),
        sa.Column("role", sa.String(length=64), nullable=False),
        sa.Column("scope_type", sa.String(length=32), nullable=False),
        sa.Column("scope_id", sa.String(length=180), nullable=False),
        sa.Column("created_by", sa.String(length=80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_platform_role_bindings_user_id",
        "platform_role_bindings",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "platform_sessions",
        sa.Column("session_id", sa.String(length=80), primary_key=True, nullable=False),
        sa.Column("user_id", sa.String(length=80), nullable=False),
        sa.Column("token", sa.String(length=512), nullable=False),
        sa.Column("auth_mode", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("token", name="uq_platform_sessions_token"),
    )
    op.create_index("ix_platform_sessions_user_id", "platform_sessions", ["user_id"], unique=False)

    op.create_table(
        "dataset_types",
        sa.Column("dataset_type", sa.String(length=80), primary_key=True, nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("field_schema_version", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "dataset_batches",
        sa.Column("dataset_id", sa.String(length=160), primary_key=True, nullable=False),
        sa.Column("dataset_type", sa.String(length=80), nullable=False),
        sa.Column("summary_payload", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_dataset_batches_dataset_type", "dataset_batches", ["dataset_type"], unique=False)

    op.create_table(
        "import_jobs",
        sa.Column("job_id", sa.String(length=80), primary_key=True, nullable=False),
        sa.Column("dataset_id", sa.String(length=160), nullable=False),
        sa.Column("job_payload", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_import_jobs_dataset_id", "import_jobs", ["dataset_id"], unique=False)

    op.create_table(
        "label_configs",
        sa.Column("config_id", sa.String(length=120), primary_key=True, nullable=False),
        sa.Column("dataset_id", sa.String(length=80), nullable=False),
        sa.Column("schema_version", sa.String(length=80), nullable=False),
        sa.Column("version", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("content_hash", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("validation_payload", sa.JSON(), nullable=False),
        sa.Column("config_payload", sa.JSON(), nullable=False),
        sa.UniqueConstraint("dataset_id", "content_hash", name="uq_label_configs_dataset_hash"),
    )
    op.create_index("ix_label_configs_dataset_id", "label_configs", ["dataset_id"], unique=False)

    op.create_table(
        "label_config_active",
        sa.Column("dataset_id", sa.String(length=80), primary_key=True, nullable=False),
        sa.Column("config_id", sa.String(length=120), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "audit_events",
        sa.Column("event_id", sa.String(length=80), primary_key=True, nullable=False),
        sa.Column("actor_user_id", sa.String(length=80), nullable=False),
        sa.Column("actor_roles", sa.JSON(), nullable=False),
        sa.Column("action", sa.String(length=120), nullable=False),
        sa.Column("entity", sa.String(length=120), nullable=False),
        sa.Column("dataset_id", sa.String(length=160), nullable=True),
        sa.Column("sample_id", sa.String(length=160), nullable=True),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("before_payload", sa.JSON(), nullable=True),
        sa.Column("after_payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_audit_events_actor_user_id", "audit_events", ["actor_user_id"], unique=False)
    op.create_index("ix_audit_events_created_at", "audit_events", ["created_at"], unique=False)
    op.create_index("ix_audit_events_dataset_id", "audit_events", ["dataset_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_audit_events_dataset_id", table_name="audit_events")
    op.drop_index("ix_audit_events_created_at", table_name="audit_events")
    op.drop_index("ix_audit_events_actor_user_id", table_name="audit_events")
    op.drop_table("audit_events")

    op.drop_table("label_config_active")
    op.drop_index("ix_label_configs_dataset_id", table_name="label_configs")
    op.drop_table("label_configs")

    op.drop_index("ix_import_jobs_dataset_id", table_name="import_jobs")
    op.drop_table("import_jobs")

    op.drop_index("ix_dataset_batches_dataset_type", table_name="dataset_batches")
    op.drop_table("dataset_batches")

    op.drop_table("dataset_types")

    op.drop_index("ix_platform_sessions_user_id", table_name="platform_sessions")
    op.drop_table("platform_sessions")

    op.drop_index("ix_platform_role_bindings_user_id", table_name="platform_role_bindings")
    op.drop_table("platform_role_bindings")

    op.drop_table("platform_users")

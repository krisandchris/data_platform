"""TASK-019 Phase 4 QC/review durable state tables."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260522_0002"
down_revision = "20260522_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "qc_assignments",
        sa.Column("dataset_id", sa.String(length=160), primary_key=True, nullable=False),
        sa.Column("assignment_payload", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "qc_tasks",
        sa.Column("dataset_id", sa.String(length=160), primary_key=True, nullable=False),
        sa.Column("task_id", sa.String(length=120), primary_key=True, nullable=False),
        sa.Column("sample_id", sa.String(length=160), nullable=False),
        sa.Column("task_order", sa.Integer(), nullable=False),
        sa.Column("task_payload", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_qc_tasks_dataset_id", "qc_tasks", ["dataset_id"], unique=False)
    op.create_index("ix_qc_tasks_sample_id", "qc_tasks", ["sample_id"], unique=False)

    op.create_table(
        "qc_leases",
        sa.Column("dataset_id", sa.String(length=160), primary_key=True, nullable=False),
        sa.Column("lease_id", sa.String(length=120), primary_key=True, nullable=False),
        sa.Column("sample_id", sa.String(length=160), nullable=False),
        sa.Column("user_id", sa.String(length=80), nullable=False),
        sa.Column("lease_order", sa.Integer(), nullable=False),
        sa.Column("lease_payload", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_qc_leases_dataset_id", "qc_leases", ["dataset_id"], unique=False)
    op.create_index("ix_qc_leases_sample_id", "qc_leases", ["sample_id"], unique=False)
    op.create_index("ix_qc_leases_user_id", "qc_leases", ["user_id"], unique=False)

    op.create_table(
        "qc_drafts",
        sa.Column("dataset_id", sa.String(length=160), primary_key=True, nullable=False),
        sa.Column("sample_id", sa.String(length=160), primary_key=True, nullable=False),
        sa.Column("user_id", sa.String(length=80), primary_key=True, nullable=False),
        sa.Column("draft_payload", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_qc_drafts_dataset_id", "qc_drafts", ["dataset_id"], unique=False)
    op.create_index("ix_qc_drafts_updated_at", "qc_drafts", ["updated_at"], unique=False)

    op.create_table(
        "qc_batch_drafts",
        sa.Column("dataset_id", sa.String(length=160), primary_key=True, nullable=False),
        sa.Column("user_id", sa.String(length=80), primary_key=True, nullable=False),
        sa.Column("draft_payload", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_qc_batch_drafts_dataset_id", "qc_batch_drafts", ["dataset_id"], unique=False)

    op.create_table(
        "qc_submissions",
        sa.Column("submission_id", sa.String(length=120), primary_key=True, nullable=False),
        sa.Column("dataset_id", sa.String(length=160), nullable=False),
        sa.Column("sample_id", sa.String(length=160), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("submission_payload", sa.JSON(), nullable=False),
    )
    op.create_index("ix_qc_submissions_created_at", "qc_submissions", ["created_at"], unique=False)
    op.create_index("ix_qc_submissions_dataset_id", "qc_submissions", ["dataset_id"], unique=False)
    op.create_index("ix_qc_submissions_sample_id", "qc_submissions", ["sample_id"], unique=False)

    op.create_table(
        "annotation_snapshots",
        sa.Column("snapshot_id", sa.String(length=120), primary_key=True, nullable=False),
        sa.Column("dataset_id", sa.String(length=160), nullable=False),
        sa.Column("sample_id", sa.String(length=160), nullable=False),
        sa.Column("snapshot_type", sa.String(length=32), nullable=False),
        sa.Column("payload_hash", sa.String(length=128), nullable=False),
        sa.Column("source_submission_id", sa.String(length=120), nullable=True),
        sa.Column("label_config_id", sa.String(length=120), nullable=True),
        sa.Column("label_config_version", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("snapshot_payload", sa.JSON(), nullable=False),
    )
    op.create_index("ix_annotation_snapshots_created_at", "annotation_snapshots", ["created_at"], unique=False)
    op.create_index("ix_annotation_snapshots_dataset_id", "annotation_snapshots", ["dataset_id"], unique=False)
    op.create_index("ix_annotation_snapshots_sample_id", "annotation_snapshots", ["sample_id"], unique=False)
    op.create_index(
        "ix_annotation_snapshots_snapshot_type",
        "annotation_snapshots",
        ["snapshot_type"],
        unique=False,
    )
    op.create_index(
        "ix_annotation_snapshots_source_submission_id",
        "annotation_snapshots",
        ["source_submission_id"],
        unique=False,
    )

    op.create_table(
        "modification_events",
        sa.Column("event_id", sa.String(length=120), primary_key=True, nullable=False),
        sa.Column("event_key", sa.String(length=255), nullable=False),
        sa.Column("dataset_id", sa.String(length=160), nullable=False),
        sa.Column("sample_id", sa.String(length=160), nullable=False),
        sa.Column("submission_id", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("event_payload", sa.JSON(), nullable=False),
        sa.UniqueConstraint(
            "dataset_id",
            "event_key",
            name="uq_modification_events_dataset_event_key",
        ),
    )
    op.create_index("ix_modification_events_created_at", "modification_events", ["created_at"], unique=False)
    op.create_index("ix_modification_events_dataset_id", "modification_events", ["dataset_id"], unique=False)
    op.create_index("ix_modification_events_sample_id", "modification_events", ["sample_id"], unique=False)
    op.create_index(
        "ix_modification_events_submission_id",
        "modification_events",
        ["submission_id"],
        unique=False,
    )

    op.create_table(
        "sample_pool_items",
        sa.Column("item_id", sa.String(length=120), primary_key=True, nullable=False),
        sa.Column("item_key", sa.String(length=255), nullable=False),
        sa.Column("dataset_id", sa.String(length=160), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("item_payload", sa.JSON(), nullable=False),
        sa.UniqueConstraint("item_key", name="uq_sample_pool_items_item_key"),
    )
    op.create_index("ix_sample_pool_items_dataset_id", "sample_pool_items", ["dataset_id"], unique=False)
    op.create_index("ix_sample_pool_items_status", "sample_pool_items", ["status"], unique=False)
    op.create_index("ix_sample_pool_items_updated_at", "sample_pool_items", ["updated_at"], unique=False)

    op.create_table(
        "export_jobs",
        sa.Column("export_id", sa.String(length=120), primary_key=True, nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("export_payload", sa.JSON(), nullable=False),
    )
    op.create_index("ix_export_jobs_created_at", "export_jobs", ["created_at"], unique=False)
    op.create_index("ix_export_jobs_status", "export_jobs", ["status"], unique=False)

    op.create_table(
        "evaluation_runs",
        sa.Column("evaluation_id", sa.String(length=120), primary_key=True, nullable=False),
        sa.Column("dataset_id", sa.String(length=160), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("evaluation_payload", sa.JSON(), nullable=False),
    )
    op.create_index("ix_evaluation_runs_created_at", "evaluation_runs", ["created_at"], unique=False)
    op.create_index("ix_evaluation_runs_dataset_id", "evaluation_runs", ["dataset_id"], unique=False)
    op.create_index("ix_evaluation_runs_status", "evaluation_runs", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_evaluation_runs_status", table_name="evaluation_runs")
    op.drop_index("ix_evaluation_runs_dataset_id", table_name="evaluation_runs")
    op.drop_index("ix_evaluation_runs_created_at", table_name="evaluation_runs")
    op.drop_table("evaluation_runs")

    op.drop_index("ix_export_jobs_status", table_name="export_jobs")
    op.drop_index("ix_export_jobs_created_at", table_name="export_jobs")
    op.drop_table("export_jobs")

    op.drop_index("ix_sample_pool_items_updated_at", table_name="sample_pool_items")
    op.drop_index("ix_sample_pool_items_status", table_name="sample_pool_items")
    op.drop_index("ix_sample_pool_items_dataset_id", table_name="sample_pool_items")
    op.drop_table("sample_pool_items")

    op.drop_index("ix_modification_events_submission_id", table_name="modification_events")
    op.drop_index("ix_modification_events_sample_id", table_name="modification_events")
    op.drop_index("ix_modification_events_dataset_id", table_name="modification_events")
    op.drop_index("ix_modification_events_created_at", table_name="modification_events")
    op.drop_table("modification_events")

    op.drop_index("ix_annotation_snapshots_source_submission_id", table_name="annotation_snapshots")
    op.drop_index("ix_annotation_snapshots_snapshot_type", table_name="annotation_snapshots")
    op.drop_index("ix_annotation_snapshots_sample_id", table_name="annotation_snapshots")
    op.drop_index("ix_annotation_snapshots_dataset_id", table_name="annotation_snapshots")
    op.drop_index("ix_annotation_snapshots_created_at", table_name="annotation_snapshots")
    op.drop_table("annotation_snapshots")

    op.drop_index("ix_qc_submissions_sample_id", table_name="qc_submissions")
    op.drop_index("ix_qc_submissions_dataset_id", table_name="qc_submissions")
    op.drop_index("ix_qc_submissions_created_at", table_name="qc_submissions")
    op.drop_table("qc_submissions")

    op.drop_index("ix_qc_batch_drafts_dataset_id", table_name="qc_batch_drafts")
    op.drop_table("qc_batch_drafts")

    op.drop_index("ix_qc_drafts_updated_at", table_name="qc_drafts")
    op.drop_index("ix_qc_drafts_dataset_id", table_name="qc_drafts")
    op.drop_table("qc_drafts")

    op.drop_index("ix_qc_leases_user_id", table_name="qc_leases")
    op.drop_index("ix_qc_leases_sample_id", table_name="qc_leases")
    op.drop_index("ix_qc_leases_dataset_id", table_name="qc_leases")
    op.drop_table("qc_leases")

    op.drop_index("ix_qc_tasks_sample_id", table_name="qc_tasks")
    op.drop_index("ix_qc_tasks_dataset_id", table_name="qc_tasks")
    op.drop_table("qc_tasks")

    op.drop_table("qc_assignments")

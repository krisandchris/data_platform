from __future__ import annotations

from datetime import datetime, timedelta, timezone
import os
from pathlib import Path

import pytest

from urban_violation_backend.db import DatabaseBackedPlatformStateStore, build_engine, build_session_factory, run_migrations_to_head
from urban_violation_backend.schemas import (
    AnnotationSnapshot,
    AnnotationSnapshotType,
    BatchAssignmentStatus,
    BatchQcAssignment,
    CorrectionSamplePoolItem,
    EvaluationMetrics,
    EvaluationRun,
    EvaluationRunStatus,
    ExportFormat,
    ExportJob,
    ExportJobStatus,
    ExportSourceFilters,
    ExportSourceType,
    LabelEditDraft,
    LabelEditSubmission,
    LeaseStatus,
    QcTask,
    QcTaskStatus,
    SampleLease,
    SamplePoolItemStatus,
)


DATASET_ID = "urban_violation__phase4"
SAMPLE_ID = "000142_0_1762483003246"


def _database_url(tmp_path: Path) -> str:
    return os.environ.get("TEST_DATABASE_URL", f"sqlite+pysqlite:///{tmp_path / 'task019_phase4_qc_state.db'}")


def _build_store(tmp_path: Path) -> DatabaseBackedPlatformStateStore:
    db_url = _database_url(tmp_path)
    run_migrations_to_head(db_url)
    session_factory = build_session_factory(build_engine(db_url))
    return DatabaseBackedPlatformStateStore(tmp_path / "platform_state", session_factory)


def test_db_qc_state_contract_restart_persistence_roundtrip(tmp_path: Path) -> None:
    ts = datetime.now(timezone.utc)
    store = _build_store(tmp_path)

    assignment = BatchQcAssignment(
        assignment_id="asg-1",
        qc_queue_id="qcq-1",
        dataset_id=DATASET_ID,
        assignee_user_id="annotator_p4",
        assigned_by="platform_admin",
        status=BatchAssignmentStatus.ASSIGNED,
        assigned_at=ts,
    )
    task = QcTask(
        task_id="task-1",
        qc_queue_id="qcq-1",
        dataset_id=DATASET_ID,
        sample_id=SAMPLE_ID,
        status=QcTaskStatus.QUEUED,
    )
    lease = SampleLease(
        lease_id="lease-1",
        dataset_id=DATASET_ID,
        sample_id=SAMPLE_ID,
        task_id="task-1",
        user_id="annotator_p4",
        status=LeaseStatus.ACTIVE,
        acquired_at=ts,
        expires_at=ts + timedelta(minutes=30),
        heartbeat_at=ts,
    )
    draft = LabelEditDraft(
        draft_id="draft-1",
        dataset_id=DATASET_ID,
        sample_id=SAMPLE_ID,
        user_id="annotator_p4",
        task_id="task-1",
        lease_id="lease-1",
        base_revision=0,
        operations=[{"scope": "stage1", "field": "scene_elements", "op": "replace", "after": ["road"]}],
        created_at=ts,
        updated_at=ts,
    )
    submission = LabelEditSubmission(
        submission_id="sub-1",
        dataset_id=DATASET_ID,
        sample_id=SAMPLE_ID,
        user_id="annotator_p4",
        task_id="task-1",
        lease_id="lease-1",
        base_revision=0,
        operations=draft.operations,
        created_at=ts,
    )
    snapshot = AnnotationSnapshot(
        snapshot_id="snap-1",
        dataset_id=DATASET_ID,
        sample_id=SAMPLE_ID,
        snapshot_type=AnnotationSnapshotType.BASELINE,
        payload_hash="hash-1",
        created_by="annotator_p4",
        created_at=ts,
        payload={"ok": True},
    )
    pool_item = CorrectionSamplePoolItem(
        item_id="pool-1",
        item_key=f"{DATASET_ID}:{SAMPLE_ID}",
        dataset_id=DATASET_ID,
        dataset_type="urban_violation",
        sample_id=SAMPLE_ID,
        confirmed_snapshot_id="snap-confirmed-1",
        source_submission_id="sub-1",
        event_ids=[],
        event_count=0,
        changed_field_count=0,
        event_types=[],
        attribution_codes=[],
        status=SamplePoolItemStatus.ACTIVE,
        created_at=ts,
        updated_at=ts,
    )
    export = ExportJob(
        export_id="exp-1",
        format=ExportFormat.COCO_JSON,
        source_type=ExportSourceType.CORRECTION_SAMPLE_POOL,
        filters=ExportSourceFilters(dataset_id=DATASET_ID),
        status=ExportJobStatus.COMPLETED,
        item_count=1,
        created_by="platform_admin",
        created_at=ts,
    )
    evaluation = EvaluationRun(
        evaluation_id="eval-1",
        dataset_id=DATASET_ID,
        dataset_type="urban_violation",
        model_version="model-v1",
        metrics=EvaluationMetrics(mAP=0.81),
        created_by="platform_admin",
        created_at=ts,
        status=EvaluationRunStatus.COMPLETED,
    )

    store.save_assignment(assignment)
    store.save_tasks(DATASET_ID, [task])
    store.save_leases(DATASET_ID, [lease])
    store.save_draft(draft)
    store.save_batch_draft(DATASET_ID, "annotator_p4", {"entries": [{"sample_id": SAMPLE_ID, "dirty": True}]})
    store.save_submission(submission)
    store.save_annotation_snapshot(snapshot)
    store.upsert_sample_pool_item(pool_item)
    store.save_export_job(export)
    store.save_evaluation(evaluation)

    restarted = _build_store(tmp_path)
    assert restarted.get_assignment(DATASET_ID) is not None
    assert len(restarted.list_tasks(DATASET_ID)) == 1
    assert len(restarted.list_leases(DATASET_ID)) == 1
    assert restarted.get_draft(DATASET_ID, SAMPLE_ID, "annotator_p4") is not None
    assert restarted.get_batch_draft(DATASET_ID, "annotator_p4") is not None
    assert len(restarted.list_submissions(DATASET_ID, SAMPLE_ID)) == 1
    assert len(restarted.list_annotation_snapshots(DATASET_ID, sample_id=SAMPLE_ID)) == 1
    assert restarted.get_sample_pool_item_by_key(f"{DATASET_ID}:{SAMPLE_ID}") is not None
    assert restarted.get_export_job("exp-1") is not None
    assert restarted.get_evaluation(DATASET_ID, "eval-1") is not None


def test_db_qc_state_contract_file_backed_regression_safety_in_db_mode(tmp_path: Path) -> None:
    store = _build_store(tmp_path)
    ts = datetime.now(timezone.utc)

    store.save_tasks(
        DATASET_ID,
        [
            QcTask(
                task_id="task-safe",
                qc_queue_id="qcq-safe",
                dataset_id=DATASET_ID,
                sample_id=SAMPLE_ID,
                status=QcTaskStatus.QUEUED,
            )
        ],
    )
    store.save_leases(
        DATASET_ID,
        [
            SampleLease(
                lease_id="lease-safe",
                dataset_id=DATASET_ID,
                sample_id=SAMPLE_ID,
                task_id="task-safe",
                user_id="annotator_safe",
                status=LeaseStatus.ACTIVE,
                acquired_at=ts,
                expires_at=ts + timedelta(minutes=30),
                heartbeat_at=ts,
            )
        ],
    )

    qc_dir = tmp_path / "platform_state" / "qc" / DATASET_ID
    assert (qc_dir / "tasks.json").is_file()
    assert (qc_dir / "leases.json").is_file()


def test_db_qc_state_postgres_only_gate() -> None:
    if "TEST_DATABASE_URL" not in os.environ:
        pytest.skip("PostgreSQL-only checks require TEST_DATABASE_URL.")
    assert "postgres" in os.environ["TEST_DATABASE_URL"].lower()

"""Focused backend tests for TASK-019 Phase 4 DB-backed QC/review state."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

from urban_violation_backend.db import (
    DatabaseBackedPlatformStateStore,
    build_engine,
    build_session_factory,
    run_migrations_to_head,
)
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
    ModificationEvent,
    ModificationEventType,
    QcTask,
    QcTaskStatus,
    SampleLease,
    SamplePoolItemStatus,
)


def _sqlite_database_url(tmp_path: Path, name: str = "qc_state.db") -> str:
    return f"sqlite+pysqlite:///{(tmp_path / name).resolve()}"


def _build_store(tmp_path: Path) -> DatabaseBackedPlatformStateStore:
    database_url = _sqlite_database_url(tmp_path)
    run_migrations_to_head(database_url)
    session_factory = build_session_factory(build_engine(database_url))
    return DatabaseBackedPlatformStateStore(tmp_path / "platform_state", session_factory)


def test_db_qc_state_roundtrip_persists_across_store_recreation(tmp_path: Path) -> None:
    store = _build_store(tmp_path)
    dataset_id = "urban_violation__batch_a"
    ts = datetime.now(timezone.utc)

    assignment = BatchQcAssignment(
        assignment_id="assign_1",
        qc_queue_id="queue_1",
        dataset_id=dataset_id,
        assignee_user_id="annotator_1",
        assigned_by="lead_1",
        status=BatchAssignmentStatus.ASSIGNED,
        assigned_at=ts,
    )
    store.save_assignment(assignment)

    tasks = [
        QcTask(
            task_id="task_1",
            qc_queue_id="queue_1",
            dataset_id=dataset_id,
            sample_id="sample_1",
            status=QcTaskStatus.QUEUED,
        ),
        QcTask(
            task_id="task_2",
            qc_queue_id="queue_1",
            dataset_id=dataset_id,
            sample_id="sample_2",
            status=QcTaskStatus.IN_PROGRESS,
            assignee_user_id="annotator_1",
            claimed_at=ts,
        ),
    ]
    store.save_tasks(dataset_id, tasks)

    leases = [
        SampleLease(
            lease_id="lease_1",
            dataset_id=dataset_id,
            sample_id="sample_1",
            task_id="task_1",
            user_id="annotator_1",
            status=LeaseStatus.ACTIVE,
            acquired_at=ts,
            expires_at=ts + timedelta(minutes=30),
            heartbeat_at=ts,
        )
    ]
    store.save_leases(dataset_id, leases)

    draft = LabelEditDraft(
        draft_id="draft_1",
        dataset_id=dataset_id,
        sample_id="sample_1",
        user_id="annotator_1",
        task_id="task_1",
        lease_id="lease_1",
        base_revision=0,
        operations=[{"scope": "stage2", "field": "judge_decision", "op": "replace", "after": "accept"}],
        created_at=ts,
        updated_at=ts,
    )
    store.save_draft(draft)
    batch_payload = {"entries": [{"sample_id": "sample_1", "dirty": True}]}
    store.save_batch_draft(dataset_id, "annotator_1", batch_payload)

    submission = LabelEditSubmission(
        submission_id="submission_1",
        dataset_id=dataset_id,
        sample_id="sample_1",
        user_id="annotator_1",
        task_id="task_1",
        lease_id="lease_1",
        base_revision=0,
        operations=[{"scope": "stage2", "field": "judge_decision", "op": "replace", "after": "accept"}],
        created_at=ts,
    )
    store.save_submission(submission)

    baseline_snapshot = AnnotationSnapshot(
        snapshot_id="snapshot_1",
        dataset_id=dataset_id,
        sample_id="sample_1",
        snapshot_type=AnnotationSnapshotType.BASELINE,
        payload_hash="payload-hash-1",
        created_by="annotator_1",
        created_at=ts,
        payload={"judge_decision": "reject"},
    )
    assert store.save_annotation_snapshot(baseline_snapshot).snapshot_id == "snapshot_1"
    assert store.save_annotation_snapshot(baseline_snapshot).snapshot_id == "snapshot_1"

    event = ModificationEvent(
        event_id="event_1",
        event_key="submission_1#sample_1#judge_decision",
        dataset_id=dataset_id,
        sample_id="sample_1",
        reviewer_id="reviewer_1",
        submission_id="submission_1",
        event_type=ModificationEventType.CANDIDATE_CATEGORY_CHANGE,
        target_id="candidate:c1",
        field="sample_category",
        before="negative",
        after="positive",
        attribution_code="policy",
        attribution_label="Policy",
        attribution_weight=1.0,
        created_at=ts,
    )
    inserted = store.save_modification_events(dataset_id, [event, event])
    assert [row.event_id for row in inserted] == ["event_1"]

    pool_item = CorrectionSamplePoolItem(
        item_id="pool_1",
        item_key=f"{dataset_id}:sample_1",
        dataset_id=dataset_id,
        dataset_type="urban_violation",
        sample_id="sample_1",
        confirmed_snapshot_id="snapshot_confirmed_1",
        source_submission_id="submission_1",
        event_ids=["event_1"],
        event_count=1,
        changed_field_count=1,
        event_types=[ModificationEventType.CANDIDATE_CATEGORY_CHANGE],
        attribution_codes=["policy"],
        status=SamplePoolItemStatus.ACTIVE,
        created_at=ts,
        updated_at=ts,
    )
    store.upsert_sample_pool_item(pool_item)

    export_job = ExportJob(
        export_id="export_1",
        format=ExportFormat.COCO_JSON,
        source_type=ExportSourceType.CORRECTION_SAMPLE_POOL,
        filters=ExportSourceFilters(dataset_id=dataset_id),
        status=ExportJobStatus.QUEUED,
        item_count=1,
        created_by="lead_1",
        created_at=ts,
    )
    store.save_export_job(export_job)

    evaluation = EvaluationRun(
        evaluation_id="eval_1",
        dataset_id=dataset_id,
        dataset_type="urban_violation",
        model_version="model_v1",
        metrics=EvaluationMetrics(mAP=0.8),
        created_by="lead_1",
        created_at=ts,
        status=EvaluationRunStatus.COMPLETED,
    )
    store.save_evaluation(evaluation)

    recreated = _build_store(tmp_path)
    assert recreated.get_assignment(dataset_id) is not None
    assert [row.task_id for row in recreated.list_tasks(dataset_id)] == ["task_1", "task_2"]
    assert [row.lease_id for row in recreated.list_leases(dataset_id)] == ["lease_1"]
    assert recreated.get_draft(dataset_id, "sample_1", "annotator_1") is not None
    assert recreated.get_batch_draft(dataset_id, "annotator_1") == batch_payload
    assert [row.submission_id for row in recreated.list_submissions(dataset_id, "sample_1")] == ["submission_1"]
    assert len(recreated.list_annotation_snapshots(dataset_id, sample_id="sample_1")) == 1
    assert [row.event_id for row in recreated.list_modification_events(dataset_id)] == ["event_1"]
    assert recreated.get_sample_pool_item_by_key(f"{dataset_id}:sample_1") is not None
    assert recreated.get_export_job("export_1") is not None
    assert recreated.get_evaluation(dataset_id, "eval_1") is not None
    assert recreated.get_evaluation_by_id("eval_1") is not None


def test_db_qc_state_dataset_cleanup_and_sample_pool_removal(tmp_path: Path) -> None:
    store = _build_store(tmp_path)
    ts = datetime.now(timezone.utc)
    dataset_keep = "urban_violation__batch_keep"
    dataset_drop = "urban_violation__batch_drop"

    store.save_assignment(
        BatchQcAssignment(
            assignment_id="assignment_drop",
            qc_queue_id="queue_drop",
            dataset_id=dataset_drop,
            assignee_user_id="annotator_1",
            assigned_by="lead_1",
            status=BatchAssignmentStatus.ASSIGNED,
            assigned_at=ts,
        )
    )
    store.save_tasks(
        dataset_drop,
        [
            QcTask(
                task_id="task_drop",
                qc_queue_id="queue_drop",
                dataset_id=dataset_drop,
                sample_id="sample_drop",
                status=QcTaskStatus.QUEUED,
            )
        ],
    )
    store.save_evaluation(
        EvaluationRun(
            evaluation_id="eval_drop",
            dataset_id=dataset_drop,
            dataset_type="urban_violation",
            model_version="model_v1",
            metrics=EvaluationMetrics(mAP=0.5),
            created_by="lead_1",
            created_at=ts,
        )
    )
    store.save_evaluation(
        EvaluationRun(
            evaluation_id="eval_keep",
            dataset_id=dataset_keep,
            dataset_type="urban_violation",
            model_version="model_v2",
            metrics=EvaluationMetrics(mAP=0.9),
            created_by="lead_1",
            created_at=ts + timedelta(seconds=1),
        )
    )
    store.upsert_sample_pool_item(
        CorrectionSamplePoolItem(
            item_id="pool_drop",
            item_key=f"{dataset_drop}:sample_drop",
            dataset_id=dataset_drop,
            dataset_type="urban_violation",
            sample_id="sample_drop",
            confirmed_snapshot_id="snapshot_drop",
            event_ids=[],
            event_count=0,
            changed_field_count=0,
            event_types=[],
            attribution_codes=[],
            status=SamplePoolItemStatus.ACTIVE,
            created_at=ts,
            updated_at=ts,
        )
    )
    store.upsert_sample_pool_item(
        CorrectionSamplePoolItem(
            item_id="pool_keep",
            item_key=f"{dataset_keep}:sample_keep",
            dataset_id=dataset_keep,
            dataset_type="urban_violation",
            sample_id="sample_keep",
            confirmed_snapshot_id="snapshot_keep",
            event_ids=[],
            event_count=0,
            changed_field_count=0,
            event_types=[],
            attribution_codes=[],
            status=SamplePoolItemStatus.ACTIVE,
            created_at=ts,
            updated_at=ts,
        )
    )

    store.clear_qc_dataset_state(dataset_drop)
    assert store.get_assignment(dataset_drop) is None
    assert store.list_tasks(dataset_drop) == []
    assert store.get_evaluation(dataset_drop, "eval_drop") is None
    assert store.get_evaluation(dataset_keep, "eval_keep") is not None

    removed_count = store.remove_sample_pool_items_for_dataset(dataset_drop)
    assert removed_count == 1
    assert store.get_sample_pool_item("pool_drop") is None
    assert store.get_sample_pool_item("pool_keep") is not None

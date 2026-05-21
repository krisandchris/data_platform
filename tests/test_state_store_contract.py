from __future__ import annotations

from datetime import datetime, timedelta, timezone

from urban_violation_backend.schemas import (
    AnnotationSnapshot,
    AnnotationSnapshotType,
    AuditEvent,
    AuthSession,
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
    RoleBinding,
    RoleScopeType,
    SampleLease,
    SamplePoolItemStatus,
    UserAccount,
    UserRole,
)
from urban_violation_backend.state_store import PlatformStateStore


def _now() -> datetime:
    return datetime.now(timezone.utc)


def test_platform_state_store_contract_baseline(tmp_path):
    store = PlatformStateStore(tmp_path / "platform_state")
    ts = _now()

    users = [
        UserAccount(
            user_id="u1",
            display_name="User 1",
            email="u1@example.local",
            password_hash="hash",
            created_at=ts,
            updated_at=ts,
        )
    ]
    store.save_users(users)
    assert [u.user_id for u in store.list_users()] == ["u1"]

    role_bindings = [
        RoleBinding(
            binding_id="rb1",
            user_id="u1",
            role=UserRole.ANNOTATOR,
            scope_type=RoleScopeType.DATASET_BATCH,
            scope_id="ds1",
            created_by="admin",
            created_at=ts,
        )
    ]
    store.save_role_bindings(role_bindings)
    assert [r.binding_id for r in store.list_role_bindings()] == ["rb1"]

    sessions = [
        AuthSession(
            session_id="s1",
            user_id="u1",
            token="tkn",
            auth_mode="password",
            created_at=ts,
            expires_at=ts + timedelta(hours=1),
        )
    ]
    store.save_sessions(sessions)
    assert [s.session_id for s in store.list_sessions()] == ["s1"]

    audit = AuditEvent(
        event_id="ae1",
        actor_user_id="admin",
        actor_roles=[UserRole.PLATFORM_ADMIN],
        action="create",
        entity="user",
        created_at=ts,
    )
    store.append_audit_event(audit)
    assert [e.event_id for e in store.list_audit_events()] == ["ae1"]

    assignment = BatchQcAssignment(
        assignment_id="a1",
        qc_queue_id="q1",
        dataset_id="ds1",
        assignee_user_id="u1",
        assigned_by="admin",
        status=BatchAssignmentStatus.ASSIGNED,
        assigned_at=ts,
    )
    store.save_assignment(assignment)
    assert store.get_assignment("ds1").assignment_id == "a1"

    task = QcTask(
        task_id="t1",
        qc_queue_id="q1",
        dataset_id="ds1",
        sample_id="sample-1",
        status=QcTaskStatus.QUEUED,
    )
    store.save_tasks("ds1", [task])
    assert [t.task_id for t in store.list_tasks("ds1")] == ["t1"]

    lease = SampleLease(
        lease_id="l1",
        dataset_id="ds1",
        sample_id="sample-1",
        task_id="t1",
        user_id="u1",
        status=LeaseStatus.ACTIVE,
        acquired_at=ts,
        expires_at=ts + timedelta(minutes=30),
        heartbeat_at=ts,
    )
    store.save_leases("ds1", [lease])
    assert [l.lease_id for l in store.list_leases("ds1")] == ["l1"]

    draft = LabelEditDraft(
        draft_id="d1",
        dataset_id="ds1",
        sample_id="sample-1",
        user_id="u1",
        task_id="t1",
        lease_id="l1",
        base_revision=0,
        operations=[{"scope": "stage1", "field": "scene_elements", "op": "replace", "after": ["road"]}],
        created_at=ts,
        updated_at=ts,
    )
    store.save_draft(draft)
    assert store.get_draft("ds1", "sample-1", "u1").draft_id == "d1"
    assert [d.draft_id for d in store.list_drafts_for_user("ds1", "u1")] == ["d1"]

    batch_payload = {"entries": [{"sample_id": "sample-1", "dirty": True}]}
    store.save_batch_draft("ds1", "u1", batch_payload)
    assert store.get_batch_draft("ds1", "u1") == batch_payload

    submission = LabelEditSubmission(
        submission_id="sub1",
        dataset_id="ds1",
        sample_id="sample-1",
        user_id="u1",
        task_id="t1",
        lease_id="l1",
        base_revision=0,
        operations=[{"scope": "stage1", "field": "scene_elements", "op": "replace", "after": ["road"]}],
        created_at=ts,
    )
    store.save_submission(submission)
    assert [s.submission_id for s in store.list_submissions("ds1", "sample-1")] == ["sub1"]
    assert store.get_submission("ds1", "sample-1", "sub1").submission_id == "sub1"

    baseline_snapshot = AnnotationSnapshot(
        snapshot_id="snap1",
        dataset_id="ds1",
        sample_id="sample-1",
        snapshot_type=AnnotationSnapshotType.BASELINE,
        payload_hash="hash-1",
        created_by="u1",
        created_at=ts,
        payload={"ok": True},
    )
    saved_once = store.save_annotation_snapshot(baseline_snapshot)
    saved_twice = store.save_annotation_snapshot(baseline_snapshot)
    assert saved_once.snapshot_id == saved_twice.snapshot_id
    assert len(store.list_annotation_snapshots("ds1", sample_id="sample-1")) == 1

    evt = ModificationEvent(
        event_id="m1",
        event_key="sub1#candidate:C1#confidence",
        dataset_id="ds1",
        sample_id="sample-1",
        reviewer_id="qc1",
        submission_id="sub1",
        event_type=ModificationEventType.CANDIDATE_CATEGORY_CHANGE,
        target_id="candidate:C1",
        field="sample_category",
        before="negative samples",
        after="positive samples",
        attribution_code="policy",
        attribution_label="Policy",
        attribution_weight=1.0,
        created_at=ts,
    )
    inserted = store.save_modification_events("ds1", [evt, evt])
    assert [e.event_id for e in inserted] == ["m1"]
    assert [e.event_id for e in store.list_modification_events("ds1", submission_id="sub1")] == ["m1"]

    pool_item = CorrectionSamplePoolItem(
        item_id="p1",
        item_key="ds1:sample-1",
        dataset_id="ds1",
        dataset_type="urban_violation",
        sample_id="sample-1",
        confirmed_snapshot_id="snap-confirmed",
        source_submission_id="sub1",
        event_ids=["m1"],
        event_count=1,
        changed_field_count=1,
        event_types=[ModificationEventType.CANDIDATE_CATEGORY_CHANGE],
        attribution_codes=["policy"],
        status=SamplePoolItemStatus.ACTIVE,
        created_at=ts,
        updated_at=ts,
    )
    store.upsert_sample_pool_item(pool_item)
    assert store.get_sample_pool_item("p1").sample_id == "sample-1"
    assert store.get_sample_pool_item_by_key("ds1:sample-1").item_id == "p1"

    updated_pool_item = pool_item.model_copy(update={"updated_at": ts + timedelta(minutes=1), "event_count": 2})
    merged = store.upsert_sample_pool_item(updated_pool_item)
    assert merged.item_id == "p1"
    assert store.get_sample_pool_item("p1").event_count == 2

    removed = store.soft_remove_sample_pool_item("p1", removed_at=ts + timedelta(minutes=2))
    assert removed is not None
    assert removed.status == SamplePoolItemStatus.REMOVED

    export_job = ExportJob(
        export_id="e1",
        format=ExportFormat.COCO_JSON,
        source_type=ExportSourceType.CORRECTION_SAMPLE_POOL,
        filters=ExportSourceFilters(dataset_id="ds1"),
        status=ExportJobStatus.QUEUED,
        item_count=1,
        created_by="admin",
        created_at=ts,
    )
    store.save_export_job(export_job)
    assert store.get_export_job("e1").status == ExportJobStatus.QUEUED

    export_done = export_job.model_copy(update={"status": ExportJobStatus.COMPLETED})
    store.save_export_job(export_done)
    assert store.get_export_job("e1").status == ExportJobStatus.COMPLETED

    evaluation = EvaluationRun(
        evaluation_id="ev1",
        dataset_id="ds1",
        dataset_type="urban_violation",
        model_version="m1",
        metrics=EvaluationMetrics(mAP=0.7),
        created_by="admin",
        created_at=ts,
        status=EvaluationRunStatus.COMPLETED,
    )
    store.save_evaluation(evaluation)
    assert store.get_evaluation("ds1", "ev1").metrics.mAP == 0.7
    assert store.get_evaluation_by_id("ev1").dataset_id == "ds1"
    assert [row.evaluation_id for row in store.list_all_evaluations()] == ["ev1"]

    store.delete_draft("ds1", "sample-1", "u1")
    assert store.get_draft("ds1", "sample-1", "u1") is None

    store.clear_assignment("ds1")
    assert store.get_assignment("ds1") is None

    removed_count = store.remove_sample_pool_items_for_dataset("ds1")
    assert removed_count == 1
    assert store.list_sample_pool_items() == []

    store.clear_qc_dataset_state("ds1")
    assert store.list_tasks("ds1") == []
    assert store.list_leases("ds1") == []

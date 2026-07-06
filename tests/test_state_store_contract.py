from __future__ import annotations

from datetime import datetime, timedelta, timezone

from urban_violation_backend.schemas import (
    AuthSession,
    BatchAssignmentStatus,
    BatchQcAssignment,
    LabelEditDraft,
    LabelEditSubmission,
    LeaseStatus,
    QcTask,
    QcTaskStatus,
    RoleBinding,
    RoleScopeType,
    SampleLease,
    UserAccount,
    UserRole,
)
from urban_violation_backend.state_store import PlatformStateStore


def _now() -> datetime:
    return datetime.now(timezone.utc)


def test_platform_state_store_retained_offline_contract(tmp_path):
    store = PlatformStateStore(tmp_path / "platform_state")
    ts = _now()

    user = UserAccount(
        user_id="offline_reviewer",
        display_name="Offline Reviewer",
        email="offline_reviewer@offline.local",
        password_hash="hash",
        created_at=ts,
        updated_at=ts,
    )
    store.save_users([user])
    assert [item.user_id for item in store.list_users()] == ["offline_reviewer"]

    binding = RoleBinding(
        binding_id="rb1",
        user_id="offline_reviewer",
        role=UserRole.QC_LEAD,
        scope_type=RoleScopeType.DATASET_BATCH,
        scope_id="ds1",
        created_by="offline_single_user",
        created_at=ts,
    )
    store.save_role_bindings([binding])
    assert store.list_role_bindings()[0].binding_id == "rb1"

    session = AuthSession(
        session_id="s1",
        user_id="offline_reviewer",
        token="tkn",
        auth_mode="offline_single_user",
        created_at=ts,
        expires_at=ts + timedelta(hours=1),
    )
    store.save_sessions([session])
    assert store.list_sessions()[0].session_id == "s1"

    assignment = BatchQcAssignment(
        assignment_id="a1",
        qc_queue_id="q1",
        dataset_id="ds1",
        assignee_user_id="offline_reviewer",
        assigned_by="offline_reviewer",
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
    assert store.list_tasks("ds1")[0].task_id == "t1"

    lease = SampleLease(
        lease_id="l1",
        dataset_id="ds1",
        sample_id="sample-1",
        task_id="t1",
        user_id="offline_reviewer",
        status=LeaseStatus.ACTIVE,
        acquired_at=ts,
        expires_at=ts + timedelta(minutes=30),
        heartbeat_at=ts,
    )
    store.save_leases("ds1", [lease])
    assert store.list_leases("ds1")[0].lease_id == "l1"

    operations = [{"scope": "stage1", "field": "scene_elements", "op": "replace", "after": ["road"]}]
    draft = LabelEditDraft(
        draft_id="d1",
        dataset_id="ds1",
        sample_id="sample-1",
        user_id="offline_reviewer",
        task_id="t1",
        lease_id="l1",
        base_revision=0,
        operations=operations,
        created_at=ts,
        updated_at=ts,
    )
    store.save_draft(draft)
    assert store.get_draft("ds1", "sample-1", "offline_reviewer").draft_id == "d1"
    assert store.list_drafts_for_user("ds1", "offline_reviewer")[0].draft_id == "d1"

    batch_payload = {"entries": [{"sample_id": "sample-1", "dirty": False, "saved": True}]}
    store.save_batch_draft("ds1", "offline_reviewer", batch_payload)
    assert store.get_batch_draft("ds1", "offline_reviewer") == batch_payload

    submission = LabelEditSubmission(
        submission_id="sub1",
        dataset_id="ds1",
        sample_id="sample-1",
        user_id="offline_reviewer",
        task_id="t1",
        lease_id="l1",
        base_revision=0,
        operations=operations,
        created_at=ts,
    )
    store.save_submission(submission)
    assert store.list_submissions("ds1", "sample-1")[0].submission_id == "sub1"
    assert store.get_submission("ds1", "sample-1", "sub1").submission_id == "sub1"

    restarted = PlatformStateStore(tmp_path / "platform_state")
    assert restarted.get_assignment("ds1").assignment_id == "a1"
    assert restarted.get_batch_draft("ds1", "offline_reviewer") == batch_payload
    assert restarted.list_submissions("ds1", "sample-1")[0].submission_id == "sub1"

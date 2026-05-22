"""Focused tests for Phase 6 file-state import command."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
from pathlib import Path

from fastapi.testclient import TestClient

from urban_violation_backend.api_schemas import DatasetSummaryResponse
from urban_violation_backend.app import create_app
from urban_violation_backend.db import (
    DatabaseBackedPlatformStateStore,
    DatabaseFoundationRegistryRepository,
    build_engine,
    build_session_factory,
    run_migrations_to_head,
)
from urban_violation_backend.labels import FileBackedLabelConfigRepository, validate_label_config
from urban_violation_backend.migrate_state import ImportFileStateArgs, main as migrate_state_main, run_import_file_state
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
    ImportJob,
    ImportJobState,
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


def _sqlite_database_url(tmp_path: Path, name: str = "phase6.db") -> str:
    return f"sqlite+pysqlite:///{(tmp_path / name).resolve()}"


def _json_file_hash(path: Path) -> str:
    """Return a stable structural hash string for JSON files."""
    if not path.is_file():
        return "<missing>"
    return json.dumps(json.loads(path.read_text(encoding="utf-8")), ensure_ascii=False, sort_keys=True)


def _jsonl_file_hash(path: Path) -> str:
    """Return a stable structural hash string for JSONL files."""
    if not path.is_file():
        return "<missing>"
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    return json.dumps(rows, ensure_ascii=False, sort_keys=True)


def _label_payload(dataset_type: str = "urban_violation") -> dict:
    return {
        "schema_version": "2026-05-22",
        "dataset_type": dataset_type,
        "version": "v1",
        "fields": [
            {
                "field": "violation_category",
                "mode": "closed_enum",
                "label_zh": "Violation Category",
                "allow_custom": False,
                "options": [
                    {
                        "code": "illegal_parking",
                        "label_zh": "Illegal Parking",
                        "sort_order": 0,
                    }
                ],
            },
            {
                "field": "scene_elements",
                "mode": "open_tags",
                "label_zh": "Scene Elements",
                "allow_custom": True,
                "options": [{"code": "road", "label_zh": "Road", "sort_order": 0}],
            },
        ],
    }


def _seed_registry_files(label_root: Path, now: datetime) -> None:
    dataset_types = {
        "dataset_types": [
            {
                "dataset_type": "urban_violation",
                "display_name": "Urban Violation",
                "field_schema_version": "2026-05-22",
                "status": "active",
            }
        ]
    }
    (label_root / "dataset_types.json").write_text(
        json.dumps(dataset_types, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    summary = DatasetSummaryResponse(
        dataset_id="urban_violation__batch_a",
        dataset_type="urban_violation",
        display_name="Urban Violation",
        field_schema_version="2026-05-22",
        active_label_config_version=None,
        batch_key="batch_a",
        lifecycle_status="registered",
        active_import_job_id="job_a",
        qc_queue_id="qc_a",
        legacy_dataset_id=None,
        source_mode="local_directory",
        source_uri="/srv/urban/source/batch_a",
        source_structure="images_only",
        source_file_count=2,
        name="batch_a",
        total_assets=2,
        stage1_count=0,
        stage2_success_count=0,
        stage2_failure_count=0,
        reviewed_count=0,
        created_at=now,
        fact_verification_count=0,
        candidate_count=0,
        judge_decision_distribution=[],
        category_distribution=[],
        verification_distribution=[],
        confidence_distribution=[],
        visibility_distribution=[],
        sample_category_distribution=[],
    )
    job = ImportJob(
        job_id="job_a",
        dataset_id="urban_violation__batch_a",
        dataset_type="urban_violation",
        batch_key="batch_a",
        source_mode="local_directory",
        source_uri="/srv/urban/source/batch_a",
        source_structure="images_only",
        state=ImportJobState.IMPORTED,
        expected_assets=2,
        imported_assets=2,
        failure_count=0,
        requested_sample_ids=["sample_1", "sample_2"],
    )
    batches = {
        "batches": [
            {
                "summary": summary.model_dump(mode="json"),
                "import_job": job.model_dump(mode="json"),
            }
        ]
    }
    (label_root / "batches.json").write_text(
        json.dumps(batches, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _seed_label_configs(label_root: Path) -> None:
    repo = FileBackedLabelConfigRepository(label_root)
    report, config = validate_label_config("urban_violation", _label_payload())
    assert report.valid and config is not None
    repo.save(
        dataset_id="urban_violation",
        file_name="urban_violation.v1.json",
        report=report,
        config=config,
        activate=True,
    )


def _seed_platform_state(state_root: Path, now: datetime) -> None:
    store = PlatformStateStore(state_root)
    dataset_id = "urban_violation__batch_a"

    store.save_users(
        [
            UserAccount(
                user_id="annotator_a",
                display_name="Annotator A",
                email="annotator_a@example.local",
                password_hash="hash-a",
                created_at=now,
                updated_at=now,
            )
        ]
    )
    store.save_role_bindings(
        [
            RoleBinding(
                binding_id="rb_a",
                user_id="annotator_a",
                role=UserRole.ANNOTATOR,
                scope_type=RoleScopeType.DATASET_BATCH,
                scope_id=dataset_id,
                created_by="platform_admin",
                created_at=now,
            )
        ]
    )
    store.save_sessions(
        [
            AuthSession(
                session_id="sess_a",
                user_id="annotator_a",
                token="token_a",
                auth_mode="session",
                created_at=now,
                expires_at=now + timedelta(hours=1),
            )
        ]
    )
    store.append_audit_event(
        AuditEvent(
            event_id="audit_a",
            actor_user_id="annotator_a",
            actor_roles=[UserRole.ANNOTATOR],
            action="qc.submit",
            entity="qc_submission",
            dataset_id=dataset_id,
            sample_id="sample_1",
            created_at=now,
        )
    )

    store.save_assignment(
        BatchQcAssignment(
            assignment_id="asgmt_a",
            qc_queue_id="qc_a",
            dataset_id=dataset_id,
            assignee_user_id="annotator_a",
            assigned_by="platform_admin",
            status=BatchAssignmentStatus.ASSIGNED,
            assigned_at=now,
        )
    )
    store.save_tasks(
        dataset_id,
        [
            QcTask(
                task_id="task_1",
                qc_queue_id="qc_a",
                dataset_id=dataset_id,
                sample_id="sample_1",
                status=QcTaskStatus.ASSIGNED,
                assignee_user_id="annotator_a",
                claimed_at=now,
            )
        ],
    )
    store.save_leases(
        dataset_id,
        [
            SampleLease(
                lease_id="lease_1",
                dataset_id=dataset_id,
                sample_id="sample_1",
                task_id="task_1",
                user_id="annotator_a",
                status=LeaseStatus.ACTIVE,
                acquired_at=now,
                expires_at=now + timedelta(minutes=10),
                heartbeat_at=now,
            )
        ],
    )

    store.save_draft(
        LabelEditDraft(
            draft_id="draft_1",
            dataset_id=dataset_id,
            sample_id="sample_1",
            user_id="annotator_a",
            task_id="task_1",
            lease_id="lease_1",
            base_revision=1,
            operations=[{"op": "set", "field": "violation_category"}],
            created_at=now,
            updated_at=now,
        )
    )
    store.save_batch_draft(
        dataset_id,
        "annotator_a",
        {"samples": [{"sample_id": "sample_1", "dirty": False}]},
    )

    submission = LabelEditSubmission(
        submission_id="sub_1",
        dataset_id=dataset_id,
        sample_id="sample_1",
        user_id="annotator_a",
        task_id="task_1",
        lease_id="lease_1",
        base_revision=1,
        operations=[{"op": "set", "field": "violation_category"}],
        created_at=now,
    )
    store.save_submission(submission)

    snapshot = AnnotationSnapshot(
        snapshot_id="snap_1",
        dataset_id=dataset_id,
        sample_id="sample_1",
        snapshot_type=AnnotationSnapshotType.CONFIRMED,
        source_submission_id="sub_1",
        payload_hash="sha256:abc",
        created_by="qc_lead_a",
        created_at=now,
        payload={"relations": []},
    )
    store.save_annotation_snapshot(snapshot)

    store.save_modification_events(
        dataset_id,
        [
            ModificationEvent(
                event_id="evt_1",
                event_key="sub_1:sample_1:0",
                dataset_id=dataset_id,
                sample_id="sample_1",
                reviewer_id="annotator_a",
                submission_id="sub_1",
                event_type=ModificationEventType.CANDIDATE_ADD,
                target_id="candidate_1",
                field="violation_category",
                before=None,
                after=["illegal_parking"],
                attribution_code="human:add",
                attribution_label="Human Add",
                attribution_weight=1.0,
                created_at=now,
            )
        ],
    )

    store.upsert_sample_pool_item(
        CorrectionSamplePoolItem(
            item_id="pool_1",
            item_key=f"{dataset_id}:sample_1:snap_1",
            dataset_id=dataset_id,
            dataset_type="urban_violation",
            sample_id="sample_1",
            confirmed_snapshot_id="snap_1",
            source_submission_id="sub_1",
            event_ids=["evt_1"],
            event_count=1,
            changed_field_count=1,
            event_types=[ModificationEventType.CANDIDATE_ADD],
            attribution_codes=["human:add"],
            status=SamplePoolItemStatus.ACTIVE,
            created_at=now,
            updated_at=now,
        )
    )

    store.save_export_job(
        ExportJob(
            export_id="exp_1",
            format=ExportFormat.COCO_JSON,
            source_type=ExportSourceType.CORRECTION_SAMPLE_POOL,
            filters=ExportSourceFilters(dataset_id=dataset_id),
            status=ExportJobStatus.COMPLETED,
            item_count=1,
            artifact_path="/srv/urban-platform/runtime/platform_state/exports/artifacts/exp_1.json",
            artifact_name="exp_1.json",
            artifact_size=123,
            artifact_content_type="application/json",
            created_by="platform_admin",
            created_at=now,
            completed_at=now,
        )
    )

    store.save_evaluation(
        EvaluationRun(
            evaluation_id="eval_1",
            dataset_id=dataset_id,
            dataset_type="urban_violation",
            model_version="model-a",
            source_export_id="exp_1",
            metrics=EvaluationMetrics(mAP=0.5, precision=0.6, recall=0.7, f1=0.65),
            changed_sample_ids=["sample_1"],
            created_by="platform_admin",
            created_at=now,
            status=EvaluationRunStatus.COMPLETED,
        )
    )


def _build_import_args(
    *,
    state_root: Path,
    label_root: Path,
    dataset_root: Path,
    database_url: str,
    dry_run: bool,
) -> ImportFileStateArgs:
    return ImportFileStateArgs(
        platform_state_root=state_root,
        label_config_store_root=label_root,
        dataset_root=dataset_root,
        database_url=database_url,
        dry_run=dry_run,
    )


def test_import_file_state_empty_dry_run(tmp_path: Path) -> None:
    state_root = tmp_path / "platform_state"
    label_root = tmp_path / "label_state"
    dataset_root = tmp_path / "dataset"
    state_root.mkdir(parents=True)
    label_root.mkdir(parents=True)
    dataset_root.mkdir(parents=True)

    database_url = _sqlite_database_url(tmp_path, "empty.db")
    run_migrations_to_head(database_url)

    report, exit_code = run_import_file_state(
        _build_import_args(
            state_root=state_root,
            label_root=label_root,
            dataset_root=dataset_root,
            database_url=database_url,
            dry_run=True,
        )
    )

    assert exit_code == 0
    assert report.total_source == 0
    assert report.total_inserted == 0
    assert report.total_conflicts == 0


def test_import_file_state_apply_then_idempotent(tmp_path: Path) -> None:
    state_root = tmp_path / "platform_state"
    label_root = tmp_path / "label_state"
    dataset_root = tmp_path / "dataset"
    state_root.mkdir(parents=True)
    label_root.mkdir(parents=True)
    dataset_root.mkdir(parents=True)

    now = datetime.now(timezone.utc)
    _seed_platform_state(state_root, now)
    _seed_registry_files(label_root, now)
    _seed_label_configs(label_root)

    database_url = _sqlite_database_url(tmp_path, "apply.db")
    run_migrations_to_head(database_url)

    apply_report, apply_exit = run_import_file_state(
        _build_import_args(
            state_root=state_root,
            label_root=label_root,
            dataset_root=dataset_root,
            database_url=database_url,
            dry_run=False,
        )
    )
    assert apply_exit == 0
    assert apply_report.total_inserted > 0
    assert apply_report.total_conflicts == 0

    verify_store = DatabaseBackedPlatformStateStore(state_root, build_session_factory(build_engine(database_url)))
    assert verify_store.get_assignment("urban_violation__batch_a") is not None
    assert verify_store.get_submission("urban_violation__batch_a", "sample_1", "sub_1") is not None
    assert verify_store.get_export_job("exp_1") is not None
    assert verify_store.get_evaluation("urban_violation__batch_a", "eval_1") is not None

    registry_repo = DatabaseFoundationRegistryRepository(build_session_factory(build_engine(database_url)))
    assert len(registry_repo.load_registered_batches()) == 1

    second_report, second_exit = run_import_file_state(
        _build_import_args(
            state_root=state_root,
            label_root=label_root,
            dataset_root=dataset_root,
            database_url=database_url,
            dry_run=False,
        )
    )
    assert second_exit == 0
    assert second_report.total_inserted == 0
    assert second_report.total_matched > 0
    assert second_report.total_conflicts == 0


def test_import_file_state_conflict_reports_without_overwrite(tmp_path: Path) -> None:
    state_root = tmp_path / "platform_state"
    label_root = tmp_path / "label_state"
    dataset_root = tmp_path / "dataset"
    state_root.mkdir(parents=True)
    label_root.mkdir(parents=True)
    dataset_root.mkdir(parents=True)

    now = datetime.now(timezone.utc)
    _seed_platform_state(state_root, now)
    _seed_registry_files(label_root, now)
    _seed_label_configs(label_root)

    database_url = _sqlite_database_url(tmp_path, "conflict.db")
    run_migrations_to_head(database_url)

    first_report, first_exit = run_import_file_state(
        _build_import_args(
            state_root=state_root,
            label_root=label_root,
            dataset_root=dataset_root,
            database_url=database_url,
            dry_run=False,
        )
    )
    assert first_exit == 0
    assert first_report.total_conflicts == 0

    session_factory = build_session_factory(build_engine(database_url))
    store = DatabaseBackedPlatformStateStore(state_root, session_factory)
    users = store.list_users()
    assert len(users) == 1
    modified = users[0].model_copy(update={"display_name": "Changed In DB"})
    store.save_users([modified])

    conflict_report, conflict_exit = run_import_file_state(
        _build_import_args(
            state_root=state_root,
            label_root=label_root,
            dataset_root=dataset_root,
            database_url=database_url,
            dry_run=False,
        )
    )
    assert conflict_exit == 3
    assert conflict_report.domain("users").conflicts == 1
    assert "annotator_a" in conflict_report.domain("users").conflict_ids

    # No silent overwrite: conflicting row in DB remains untouched.
    reloaded = DatabaseBackedPlatformStateStore(state_root, build_session_factory(build_engine(database_url)))
    assert reloaded.list_users()[0].display_name == "Changed In DB"


def test_import_file_state_cli_writes_report(tmp_path: Path) -> None:
    state_root = tmp_path / "platform_state"
    label_root = tmp_path / "label_state"
    dataset_root = tmp_path / "dataset"
    state_root.mkdir(parents=True)
    label_root.mkdir(parents=True)
    dataset_root.mkdir(parents=True)

    report_path = tmp_path / "reports" / "phase6-import.json"
    database_url = _sqlite_database_url(tmp_path, "cli.db")

    exit_code = migrate_state_main(
        [
            "import-file-state",
            "--platform-state-root",
            str(state_root),
            "--label-config-store-root",
            str(label_root),
            "--dataset-root",
            str(dataset_root),
            "--database-url",
            database_url,
            "--dry-run",
            "--report",
            str(report_path),
            "--run-migrations",
        ]
    )

    assert exit_code == 0
    payload = json.loads(report_path.read_text(encoding="utf-8"))
    assert payload["status"] == "ok"
    assert payload["dry_run"] is True
    assert payload["summary"]["inserted"] == 0
    assert "raw_dataset_files" in payload["filesystem_only_domains"]


def test_import_file_state_dry_run_does_not_mutate_source_files(tmp_path: Path) -> None:
    state_root = tmp_path / "platform_state"
    label_root = tmp_path / "label_state"
    dataset_root = tmp_path / "dataset"
    state_root.mkdir(parents=True)
    label_root.mkdir(parents=True)
    dataset_root.mkdir(parents=True)

    now = datetime.now(timezone.utc)
    _seed_platform_state(state_root, now)
    _seed_registry_files(label_root, now)
    _seed_label_configs(label_root)

    users_before = _json_file_hash(state_root / "users.json")
    audit_before = _jsonl_file_hash(state_root / "audit_events.jsonl")
    active_config_before = _json_file_hash(label_root / "urban_violation" / "label_configs" / "active.json")
    database_url = _sqlite_database_url(tmp_path, "dry-run.db")
    run_migrations_to_head(database_url)

    report, exit_code = run_import_file_state(
        _build_import_args(
            state_root=state_root,
            label_root=label_root,
            dataset_root=dataset_root,
            database_url=database_url,
            dry_run=True,
        )
    )

    assert exit_code == 0
    assert report.total_source > 0
    assert report.total_inserted > 0
    assert _json_file_hash(state_root / "users.json") == users_before
    assert _jsonl_file_hash(state_root / "audit_events.jsonl") == audit_before
    assert _json_file_hash(label_root / "urban_violation" / "label_configs" / "active.json") == active_config_before
    assert DatabaseBackedPlatformStateStore(state_root, build_session_factory(build_engine(database_url))).list_users() == []


def test_import_file_state_post_import_api_reads_and_continued_writes(tmp_path: Path) -> None:
    state_root = tmp_path / "platform_state"
    label_root = tmp_path / "label_state"
    dataset_root = tmp_path / "dataset"
    state_root.mkdir(parents=True)
    label_root.mkdir(parents=True)
    dataset_root.mkdir(parents=True)

    now = datetime.now(timezone.utc)
    _seed_platform_state(state_root, now)
    _seed_registry_files(label_root, now)
    _seed_label_configs(label_root)

    database_url = _sqlite_database_url(tmp_path, "api.db")
    run_migrations_to_head(database_url)
    report, exit_code = run_import_file_state(
        _build_import_args(
            state_root=state_root,
            label_root=label_root,
            dataset_root=dataset_root,
            database_url=database_url,
            dry_run=False,
        )
    )
    assert exit_code == 0
    assert report.total_conflicts == 0

    with TestClient(
        create_app(
            label_config_store_root=label_root,
            platform_state_root=state_root,
            platform_state_backend="database",
            database_url=database_url,
            platform_db_auto_migrate=False,
            enable_fixture_batch=False,
        )
    ) as client:
        users = client.get("/api/users", headers={"X-User-Id": "platform_admin", "X-User-Role": "platform_admin"})
        assert users.status_code == 200
        assert any(item["user_id"] == "annotator_a" for item in users.json())

        created = client.post(
            "/api/users",
            json={
                "user_id": "post_import_writer",
                "display_name": "Post Import Writer",
                "email": "post_import_writer@example.local",
                "password": "StrongPassw0rd!",
            },
            headers={"X-User-Id": "platform_admin", "X-User-Role": "platform_admin"},
        )
        assert created.status_code == 201

        users_after = client.get(
            "/api/users",
            headers={"X-User-Id": "platform_admin", "X-User-Role": "platform_admin"},
        )
        assert users_after.status_code == 200
        assert any(item["user_id"] == "post_import_writer" for item in users_after.json())

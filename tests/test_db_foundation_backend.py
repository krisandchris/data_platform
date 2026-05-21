"""Focused backend tests for TASK-019 Phase 3 database foundation."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from urban_violation_backend.api_schemas import DatasetSummaryResponse, DatasetTypeCreateRequest
from urban_violation_backend.db import (
    DatabaseBackedPlatformStateStore,
    DatabaseFoundationRegistryRepository,
    DatabaseLabelConfigRepository,
    build_engine,
    build_session_factory,
    run_migrations_to_head,
)
from urban_violation_backend.labels import LabelConfigVersionConflictError, validate_label_config
from urban_violation_backend.schemas import (
    AuditEvent,
    AuthSession,
    ImportJob,
    ImportJobState,
    RoleBinding,
    RoleScopeType,
    UserAccount,
    UserRole,
)
from urban_violation_backend.service import build_fixture_service


def _sqlite_database_url(tmp_path: Path, name: str = "state.db") -> str:
    return f"sqlite+pysqlite:///{(tmp_path / name).resolve()}"


def _build_label_payload(dataset_type: str = "urban_violation") -> dict:
    return {
        "schema_version": "2026-05-18",
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


def _build_summary(ts: datetime) -> DatasetSummaryResponse:
    return DatasetSummaryResponse(
        dataset_id="urban_violation__batch_a",
        dataset_type="urban_violation",
        display_name="Urban Violation",
        field_schema_version="2026-05-18",
        active_label_config_version=None,
        batch_key="batch_a",
        lifecycle_status="registered",
        active_import_job_id="job_1",
        qc_queue_id=None,
        legacy_dataset_id=None,
        source_mode="local_directory",
        source_uri="/tmp/source",
        source_structure="images_only",
        source_file_count=10,
        name="batch_a",
        total_assets=10,
        stage1_count=0,
        stage2_success_count=0,
        stage2_failure_count=0,
        reviewed_count=0,
        created_at=ts,
        fact_verification_count=0,
        candidate_count=0,
        judge_decision_distribution=[],
        category_distribution=[],
        verification_distribution=[],
        confidence_distribution=[],
        visibility_distribution=[],
        sample_category_distribution=[],
    )


def _build_job() -> ImportJob:
    return ImportJob(
        job_id="job_1",
        dataset_id="urban_violation__batch_a",
        dataset_type="urban_violation",
        batch_key="batch_a",
        source_mode="local_directory",
        source_uri="/tmp/source",
        source_structure="images_only",
        state=ImportJobState.DRAFT,
        expected_assets=10,
        imported_assets=0,
        failure_count=0,
        requested_sample_ids=[],
        validation_errors=[],
        warnings=[],
    )


def test_db_foundation_state_store_identity_and_audit(tmp_path: Path) -> None:
    database_url = _sqlite_database_url(tmp_path)
    run_migrations_to_head(database_url)
    session_factory = build_session_factory(build_engine(database_url))
    store = DatabaseBackedPlatformStateStore(tmp_path / "platform_state", session_factory)

    now = datetime.now(timezone.utc)
    users = [
        UserAccount(
            user_id="u1",
            display_name="User 1",
            email="u1@example.local",
            password_hash="hash",
            status="active",
            created_at=now,
            updated_at=now,
            last_seen_at=now,
        )
    ]
    store.save_users(users)
    assert [row.user_id for row in store.list_users()] == ["u1"]

    bindings = [
        RoleBinding(
            binding_id="rb1",
            user_id="u1",
            role=UserRole.ANNOTATOR,
            scope_type=RoleScopeType.DATASET_BATCH,
            scope_id="urban_violation__batch_a",
            created_by="admin",
            created_at=now,
        )
    ]
    store.save_role_bindings(bindings)
    assert [row.binding_id for row in store.list_role_bindings()] == ["rb1"]

    sessions = [
        AuthSession(
            session_id="sess1",
            user_id="u1",
            token="token-1",
            auth_mode="session",
            created_at=now,
            expires_at=now + timedelta(hours=2),
            revoked_at=None,
        )
    ]
    store.save_sessions(sessions)
    assert [row.session_id for row in store.list_sessions()] == ["sess1"]

    audit_event = AuditEvent(
        event_id="ae1",
        actor_user_id="u1",
        actor_roles=[UserRole.ANNOTATOR],
        action="test.action",
        entity="test_entity",
        created_at=now,
    )
    store.append_audit_event(audit_event)
    assert [row.event_id for row in store.list_audit_events()] == ["ae1"]

    # Non-migrated state still uses file-backed contract methods in this phase.
    assert store.list_tasks("urban_violation__batch_a") == []


def test_db_foundation_label_config_repository_contract(tmp_path: Path) -> None:
    database_url = _sqlite_database_url(tmp_path)
    run_migrations_to_head(database_url)
    session_factory = build_session_factory(build_engine(database_url))
    repo = DatabaseLabelConfigRepository(session_factory)

    report, config = validate_label_config("urban_violation", _build_label_payload())
    assert report.valid and config is not None

    first = repo.save(
        dataset_id="urban_violation",
        file_name="label_config.json",
        report=report,
        config=config,
        activate=False,
    )
    assert first.status == "active"
    assert repo.get_active("urban_violation").config_id == first.config_id

    second = repo.save(
        dataset_id="urban_violation",
        file_name="label_config_copy.json",
        report=report,
        config=config,
        activate=True,
    )
    assert second.config_id == first.config_id
    assert len(repo.list_configs("urban_violation")) == 1

    changed_payload = _build_label_payload()
    changed_payload["fields"][0]["label_zh"] = "Violation Category Changed"
    changed_report, changed_config = validate_label_config("urban_violation", changed_payload)
    assert changed_report.valid and changed_config is not None

    with pytest.raises(LabelConfigVersionConflictError):
        repo.save(
            dataset_id="urban_violation",
            file_name="label_config_conflict.json",
            report=changed_report,
            config=changed_config,
            activate=True,
        )


def test_db_foundation_registry_repository_roundtrip(tmp_path: Path) -> None:
    database_url = _sqlite_database_url(tmp_path)
    run_migrations_to_head(database_url)
    session_factory = build_session_factory(build_engine(database_url))
    repo = DatabaseFoundationRegistryRepository(session_factory)

    repo.save_dataset_type_registry(
        [
            {
                "dataset_type": "urban_violation",
                "display_name": "Urban Violation",
                "field_schema_version": "2026-05-18",
                "status": "active",
            }
        ]
    )
    dataset_types = repo.load_dataset_type_registry()
    assert dataset_types[0]["dataset_type"] == "urban_violation"

    summary = _build_summary(datetime.now(timezone.utc))
    job = _build_job()
    repo.save_registered_batches(
        [
            {
                "summary": summary.model_dump(mode="json"),
                "import_job": job.model_dump(mode="json"),
            }
        ]
    )

    loaded = repo.load_registered_batches()
    assert len(loaded) == 1
    loaded_summary = DatasetSummaryResponse.model_validate(loaded[0]["summary"])
    loaded_job = ImportJob.model_validate(loaded[0]["import_job"])
    assert loaded_summary.dataset_id == summary.dataset_id
    assert loaded_job.job_id == job.job_id


def test_build_fixture_service_database_mode_bootstrap(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    database_url = _sqlite_database_url(tmp_path, "service.db")
    monkeypatch.setenv("PLATFORM_STATE_BACKEND", "database")
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("PLATFORM_DB_AUTO_MIGRATE", "1")

    service = build_fixture_service(
        dataset_root=tmp_path / "dataset_root",
        label_config_store_root=tmp_path / "label_state",
        platform_state_root=tmp_path / "platform_state",
        enable_fixture_batch=False,
    )

    users = service._state_store.list_users()  # noqa: SLF001 - targeted backend wiring assertion.
    assert users
    assert users[0].user_id == "platform_admin"

    created = service.create_dataset_type(
        request=DatasetTypeCreateRequest(
            dataset_type="urban_violation_extra",
            display_name="Urban Violation Extra",
            field_schema_version="2026-05-18",
        )
    )
    assert created.dataset_type == "urban_violation_extra"

    service_reloaded = build_fixture_service(
        dataset_root=tmp_path / "dataset_root",
        label_config_store_root=tmp_path / "label_state",
        platform_state_root=tmp_path / "platform_state",
        enable_fixture_batch=False,
    )
    dataset_types = {row.dataset_type for row in service_reloaded.list_dataset_types()}
    assert "urban_violation_extra" in dataset_types

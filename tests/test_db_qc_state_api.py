from __future__ import annotations

import importlib
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from urban_violation_backend.app import create_app

from test_api import (
    BATCH_DATASET_ID,
    MULTI_CANDIDATE_SAMPLE_ID,
    SUCCESS_SAMPLE_ID,
    _acquire_lease,
    _activate_label_config,
    _admin_headers,
    _assign_batch,
    _build_batch_draft_entry,
    _build_valid_label_edit_payload,
    _create_evaluation,
    _create_user,
    _user_headers,
)

REQUIRED_ENV_TOKENS = ("PLATFORM_STATE_BACKEND", "DATABASE_URL")


def _supports_db_foundation() -> bool:
    package = importlib.import_module("urban_violation_backend")
    package_root = Path(package.__file__).resolve().parent
    for py_file in package_root.rglob("*.py"):
        try:
            content = py_file.read_text(encoding="utf-8")
        except OSError:
            continue
        if all(token in content for token in REQUIRED_ENV_TOKENS):
            return True
    return False


def _require_db_foundation() -> None:
    if not _supports_db_foundation():
        pytest.skip("DB foundation backend wiring not present on this branch yet.")


def _database_url(tmp_path: Path) -> str:
    return os.environ.get("TEST_DATABASE_URL", f"sqlite+pysqlite:///{tmp_path / 'task019_phase4_api.db'}")


@pytest.fixture
def db_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> tuple[Path, Path]:
    _require_db_foundation()
    monkeypatch.setenv("PLATFORM_STATE_BACKEND", "database")
    monkeypatch.setenv("DATABASE_URL", _database_url(tmp_path))
    monkeypatch.setenv("PLATFORM_DB_AUTO_MIGRATE", "1")
    return (tmp_path / "LABEL_CONFIG_STATE", tmp_path / "PLATFORM_STATE")


def _client(label_root: Path, state_root: Path) -> TestClient:
    return TestClient(create_app(label_config_store_root=label_root, platform_state_root=state_root))


def test_db_qc_state_api_restart_persistence_and_full_workflow(db_env: tuple[Path, Path]) -> None:
    label_root, state_root = db_env

    with _client(label_root, state_root) as client:
        _activate_label_config(client)
        _create_user(client, "annotator_phase4", role="annotator")
        _create_user(client, "qc_lead_phase4", role="qc_lead")
        _assign_batch(client, "annotator_phase4", dataset_id=BATCH_DATASET_ID)

        lease_id = _acquire_lease(
            client,
            "annotator_phase4",
            sample_id=MULTI_CANDIDATE_SAMPLE_ID,
            dataset_id=BATCH_DATASET_ID,
        )
        submit_payload = _build_valid_label_edit_payload()
        submit_payload["submit_action"] = "submit_changes"
        submit_payload["task_status"] = "annotation_submitted"
        submit_payload["lease_id"] = lease_id
        submit_payload["base_revision"] = 0
        submitted = client.post(
            f"/api/datasets/{BATCH_DATASET_ID}/samples/{MULTI_CANDIDATE_SAMPLE_ID}/label-edits",
            json=submit_payload,
            headers=_user_headers("annotator_phase4", "annotator"),
        )
        assert submitted.status_code == 200

        history = client.get(
            f"/api/datasets/{BATCH_DATASET_ID}/samples/{MULTI_CANDIDATE_SAMPLE_ID}/label-edits/history",
            headers=_admin_headers(),
        )
        assert history.status_code == 200
        submission_id = history.json()[-1]["submission_id"]

        confirmed = client.post(
            f"/api/datasets/{BATCH_DATASET_ID}/samples/{MULTI_CANDIDATE_SAMPLE_ID}/label-edits/{submission_id}/confirm",
            json={"attribution_code": "policy", "attribution_label": "Policy"},
            headers=_user_headers("qc_lead_phase4", "qc_lead"),
        )
        assert confirmed.status_code == 200

        eval_created = _create_evaluation(
            client,
            dataset_id=BATCH_DATASET_ID,
            model_version="phase4-eval",
            headers=_admin_headers(),
        )
        assert eval_created["dataset_id"] == BATCH_DATASET_ID

        export = client.post(
            "/api/exports",
            json={
                "format": "coco_json",
                "source_type": "correction_sample_pool",
                "filters": {"dataset_id": BATCH_DATASET_ID, "status": "active"},
            },
            headers=_admin_headers(),
        )
        assert export.status_code == 200

    with _client(label_root, state_root) as restarted:
        assignment = restarted.get(f"/api/datasets/{BATCH_DATASET_ID}/qc/assignment", headers=_admin_headers())
        assert assignment.status_code == 200
        assert assignment.json()["assignee_user_id"] == "annotator_phase4"

        snapshots = restarted.get(
            f"/api/datasets/{BATCH_DATASET_ID}/qc/annotation-snapshots",
            params={"sample_id": MULTI_CANDIDATE_SAMPLE_ID},
            headers=_admin_headers(),
        )
        assert snapshots.status_code == 200
        assert any(item["snapshot_type"] == "confirmed" for item in snapshots.json())

        sample_pool = restarted.get(
            "/api/sample-pool",
            params={"dataset_id": BATCH_DATASET_ID},
            headers=_admin_headers(),
        )
        assert sample_pool.status_code == 200
        assert sample_pool.json()["total"] >= 1

        exports = restarted.get("/api/exports", headers=_admin_headers())
        assert exports.status_code == 200
        assert any(
            item.get("source_type") == "correction_sample_pool"
            and item.get("filters", {}).get("dataset_id") == BATCH_DATASET_ID
            for item in exports.json()["items"]
        )

        evaluations = restarted.get(
            f"/api/datasets/{BATCH_DATASET_ID}/evaluations",
            headers=_admin_headers(),
        )
        assert evaluations.status_code == 200
        assert any(item["model_version"] == "phase4-eval" for item in evaluations.json())


def test_db_qc_state_api_duplicate_queue_generation_does_not_duplicate_tasks(db_env: tuple[Path, Path]) -> None:
    label_root, state_root = db_env

    with _client(label_root, state_root) as client:
        dataset_id = BATCH_DATASET_ID
        _activate_label_config(client)

        first = client.post(f"/api/datasets/{dataset_id}/qc/generate", headers=_admin_headers())
        second = client.post(f"/api/datasets/{dataset_id}/qc/generate", headers=_admin_headers())

        assert first.status_code in {200, 409}
        assert second.status_code in {200, 409}

        tasks = client.get(f"/api/datasets/{dataset_id}/qc/tasks", headers=_admin_headers())
        assert tasks.status_code == 200
        task_ids = [row["task_id"] for row in tasks.json()]
        assert len(task_ids) == len(set(task_ids))


def test_db_qc_state_api_assignment_transition_and_lease_conflicts(db_env: tuple[Path, Path]) -> None:
    label_root, state_root = db_env

    with _client(label_root, state_root) as client:
        _activate_label_config(client)
        _create_user(client, "annotator_owner_phase4", role="annotator")
        _create_user(client, "annotator_other_phase4", role="annotator")
        _create_user(client, "qc_lead_phase4_conflict", role="qc_lead")
        _assign_batch(client, "annotator_owner_phase4")

        owner_lease = _acquire_lease(client, "annotator_owner_phase4", sample_id=SUCCESS_SAMPLE_ID)

        reassigned = client.post(
            f"/api/datasets/{BATCH_DATASET_ID}/qc/assignment/reassign",
            json={"assignee_user_id": "annotator_other_phase4"},
            headers=_user_headers("qc_lead_phase4_conflict", "qc_lead"),
        )
        assert reassigned.status_code == 200

        stale_submit = _build_valid_label_edit_payload()
        stale_submit["submit_action"] = "save_draft"
        stale_submit["task_status"] = "annotation_draft"
        stale_submit["lease_id"] = owner_lease
        stale_submit["base_revision"] = 0
        denied = client.post(
            f"/api/datasets/{BATCH_DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits",
            json=stale_submit,
            headers=_user_headers("annotator_owner_phase4", "annotator"),
        )
        assert denied.status_code == 409
        assert denied.json()["code"] in {"batch_assigned_to_other_user", "lease_owned_by_other_user", "lease_required"}


def test_db_qc_state_api_autosave_then_submit_batch_is_consistent(db_env: tuple[Path, Path]) -> None:
    label_root, state_root = db_env

    with _client(label_root, state_root) as client:
        _activate_label_config(client)
        _create_user(client, "annotator_autosave_submit", role="annotator")
        _assign_batch(client, "annotator_autosave_submit")
        lease_id = _acquire_lease(client, "annotator_autosave_submit", sample_id=SUCCESS_SAMPLE_ID)

        autosave = client.post(
            f"/api/datasets/{BATCH_DATASET_ID}/label-edits/my-batch-draft/autosave",
            json={
                "entries": [
                    _build_batch_draft_entry(
                        sample_id=SUCCESS_SAMPLE_ID,
                        lease_id=lease_id,
                        base_revision=0,
                        dirty=True,
                        saved=False,
                    )
                ]
            },
            headers=_user_headers("annotator_autosave_submit", "annotator"),
        )
        assert autosave.status_code == 200

        submitted = client.post(
            f"/api/datasets/{BATCH_DATASET_ID}/label-edits/submit-batch",
            json={"unsaved_dirty_sample_ids": [], "validation_error_sample_ids": []},
            headers=_user_headers("annotator_autosave_submit", "annotator"),
        )
        assert submitted.status_code == 200
        assert submitted.json()["submitted"] is True

        assignment = client.get(f"/api/datasets/{BATCH_DATASET_ID}/qc/assignment", headers=_admin_headers())
        assert assignment.status_code == 200
        assert assignment.json()["status"] == "submitted"

        manifest = client.get(
            f"/api/datasets/{BATCH_DATASET_ID}/label-edits/my-batch-draft",
            headers=_user_headers("annotator_autosave_submit", "annotator"),
        )
        assert manifest.status_code == 200
        manifest_payload = manifest.json()
        assert manifest_payload["dataset_id"] == BATCH_DATASET_ID
        assert manifest_payload["sample_count"] == 0

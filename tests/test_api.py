"""Offline single-user API tests for import validation and QC workbench."""

from __future__ import annotations

import io
import json
import os
from pathlib import Path
from typing import Any
import zipfile

import pytest
from fastapi.testclient import TestClient

import urban_violation_backend.service as service_module
from urban_violation_backend.app import create_app
from urban_violation_backend.service import build_fixture_service

DATASET_TYPE = "urban_violation"
SAMPLE_ID = "s1"


def _minimal_label_config(version: str = "offline_labels_v1") -> dict[str, Any]:
    return {
        "schema_version": "label_config_v1",
        "dataset_type": DATASET_TYPE,
        "version": version,
        "fields": [
            {
                "field": "violation_category",
                "mode": "closed_enum",
                "label_zh": "违法类别",
                "allow_custom": False,
                "options": [{"code": "illegal_parking", "label_zh": "违停", "sort_order": 0}],
            },
            {
                "field": "scene_elements",
                "mode": "open_tags",
                "label_zh": "场景元素",
                "allow_custom": True,
                "options": [{"code": "road", "label_zh": "道路", "sort_order": 0}],
            },
        ],
    }


def _write_label_config(path: Path) -> Path:
    path.write_text(json.dumps(_minimal_label_config()), encoding="utf-8")
    return path


def _zip_bytes(entries: dict[str, bytes | str]) -> bytes:
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        for path, content in entries.items():
            zip_file.writestr(path, content)
    return archive.getvalue()


def _preannotated_zip_bytes(batch_key: str = "tiny") -> bytes:
    stage1_manifest = {
        "id": SAMPLE_ID,
        "request_path": "requests/s1.json",
        "response_path": "responses/s1.json",
        "parsed_path": "parsed/s1.json",
        "record_path": "records/s1.json",
    }
    stage2_manifest = {
        "id": SAMPLE_ID,
        "input_path": "inputs/s1.json",
        "request_path": "requests/s1.json",
        "response_path": "responses/s1.json",
        "parsed_path": "parsed/s1.json",
        "record_path": "records/s1.json",
    }
    stage1_parsed = {
        "environment_analysis": "road",
        "scene_elements": ["road"],
        "key_anchors": [],
        "key_relations": [
            {
                "subject": "car",
                "relation": "on",
                "object": "road",
                "description": "car on road",
                "bbox": [1, 2, 30, 40],
            }
        ],
    }
    stage2_parsed = {
        "sample_id": SAMPLE_ID,
        "fact_verifications": [
            {
                "relation_index": 0,
                "subject": "car",
                "relation": "on",
                "object": "road",
                "visibility_level": "clear",
                "information_loss_type": "none",
                "key_attributes_visible": [],
                "subject_visible": True,
                "subject_match": True,
                "bbox": [1, 2, 30, 40],
                "bbox_observation": "ok",
                "global_context_observation": "ok",
                "verification_result": "supported",
                "verification_confidence": 0.9,
            }
        ],
        "candidates": [
            {
                "violation_category": ["illegal_parking"],
                "evidence_relation_indices": [0],
                "evidence_reasoning": "reason",
                "relation_hint": "hint",
                "segmentation_targets": [],
                "confidence": 0.8,
                "sample_category": "positive samples",
            }
        ],
    }
    prefix = f"{batch_key}/"
    return _zip_bytes(
        {
            f"{prefix}images/s1.jpg": b"image",
            f"{prefix}stage1_run_test/meta/manifest.jsonl": json.dumps(stage1_manifest) + "\n",
            f"{prefix}stage1_run_test/parsed/s1.json": json.dumps(stage1_parsed),
            f"{prefix}stage1_run_test/records/s1.json": json.dumps(
                {"images": ["images/s1.jpg"], "metadata": {"judge_report": {"final_decision": "pass"}}}
            ),
            f"{prefix}stage2_run_test/meta/manifest.jsonl": json.dumps(stage2_manifest) + "\n",
            f"{prefix}stage2_run_test/parsed/s1.json": json.dumps(stage2_parsed),
        }
    )


@pytest.fixture
def offline_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> dict[str, Path]:
    label_config_path = _write_label_config(tmp_path / "label_config.json")
    state_root = tmp_path / "offline_state"
    monkeypatch.setenv("PLATFORM_AUTH_MODE", "offline_single_user")
    monkeypatch.setenv("OFFLINE_LABEL_CONFIG_PATH", str(label_config_path))
    monkeypatch.setenv("OFFLINE_STATE_ROOT", str(state_root))
    monkeypatch.delenv("OFFLINE_DATA_ROOT", raising=False)
    monkeypatch.delenv("PLATFORM_ENABLE_FIXTURE_BATCH", raising=False)
    monkeypatch.setattr(service_module, "DEFAULT_DATASET_ROOT", tmp_path / "missing_default_dataset")
    return {"label_config_path": label_config_path, "state_root": state_root}


def _client(paths: dict[str, Path]) -> TestClient:
    return TestClient(
        create_app(
            label_config_store_root=paths["state_root"] / "label_config_state",
            platform_state_root=paths["state_root"],
        )
    )


def _upload_preannotated_batch(client: TestClient, batch_key: str = "tiny") -> tuple[str, str]:
    response = client.post(
        f"/api/datasets/{DATASET_TYPE}/import-jobs/archive",
        params={"batch_key": batch_key, "archive_file_name": f"{batch_key}.zip"},
        content=_preannotated_zip_bytes(batch_key),
        headers={"content-type": "application/zip"},
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload["source_mode"] == "uploaded_package"
    assert payload["source_structure"] == "images_with_preannotations"
    assert payload["state"] == "Imported"
    assert payload["imported_assets"] == 1
    assert payload["validation_rows"][0]["status"] == "ready"
    return payload["dataset_id"], payload["job_id"]


def _draft_payload(lease_id: str) -> dict[str, Any]:
    return {
        "entries": [
            {
                "sample_id": SAMPLE_ID,
                "lease_id": lease_id,
                "base_revision": 0,
                "operations": [{"scope": "stage1", "field": "scene_elements", "op": "replace", "after": ["road"]}],
                "dirty": False,
                "saved": True,
                "validation": {
                    "valid": True,
                    "error_count": 0,
                    "warning_count": 0,
                    "errors": [],
                    "warnings": [],
                },
            }
        ]
    }


def test_offline_health_current_user_and_label_config(offline_env: dict[str, Path]) -> None:
    with _client(offline_env) as client:
        health = client.get("/health")
        assert health.status_code == 200
        assert health.json() == {
            "status": "ok",
            "dataset_id": DATASET_TYPE,
            "mode": "offline_single_user",
            "state_root": str(offline_env["state_root"].resolve()),
        }

        me = client.get("/api/me")
        assert me.status_code == 200
        assert me.json()["user_id"] == "offline_reviewer"
        assert {"label_edit:write", "label_edit:confirm", "batch_assignment:manage"} <= set(me.json()["permissions"])

        config = client.get(f"/api/datasets/{DATASET_TYPE}/label-config/active")
        assert config.status_code == 200
        assert config.json()["version"] == "offline_labels_v1"

        dataset_type = client.get(f"/api/dataset-types/{DATASET_TYPE}")
        assert dataset_type.status_code == 200
        assert dataset_type.json()["batch_count"] == 0
        assert dataset_type.json()["active_label_config_version"] == 1


def test_offline_without_data_root_does_not_create_project_state(offline_env: dict[str, Path]) -> None:
    service = build_fixture_service()

    assert service.list_datasets() == []
    assert service.get_dataset_type(DATASET_TYPE).batch_count == 0
    assert service._label_config_store_root == (offline_env["state_root"] / "label_config_state").resolve()  # noqa: SLF001
    assert not (offline_env["label_config_path"].parent / "dataset_batches.json").exists()
    assert not (offline_env["label_config_path"].parent / DATASET_TYPE).exists()


def test_offline_blocks_non_core_api_surface(offline_env: dict[str, Path]) -> None:
    blocked_paths = [
        "/api/rbac/catalog",
        "/api/users",
        "/api/role-bindings",
        "/api/audit-events",
        "/api/sample-pool",
        "/api/exports",
        "/api/datasets",
        f"/api/datasets/{DATASET_TYPE}/assets",
        f"/api/datasets/{DATASET_TYPE}/search",
        f"/api/datasets/{DATASET_TYPE}/exports",
    ]

    with _client(offline_env) as client:
        assert client.get("/api/me").status_code == 200
        assert [client.get(path).status_code for path in blocked_paths] == [404] * len(blocked_paths)


def test_archive_upload_rejects_zip_path_traversal(offline_env: dict[str, Path]) -> None:
    with _client(offline_env) as client:
        response = client.post(
            f"/api/datasets/{DATASET_TYPE}/import-jobs/archive",
            params={"batch_key": "bad_zip", "archive_file_name": "bad.zip"},
            content=_zip_bytes({"../evil.txt": b"bad"}),
            headers={"content-type": "application/zip"},
        )

    assert response.status_code == 400
    assert "unsafe path" in response.json()["detail"]
    assert not (offline_env["state_root"] / "import_uploads" / DATASET_TYPE / "evil.txt").exists()


def test_import_validation_qc_draft_submit_and_restart_recovery(offline_env: dict[str, Path]) -> None:
    with _client(offline_env) as client:
        dataset_id, job_id = _upload_preannotated_batch(client)

        scan = client.post(f"/api/datasets/{dataset_id}/import-jobs/{job_id}/scan")
        assert scan.status_code == 200
        assert scan.json()["state"] == "Scanning"

        validate = client.post(f"/api/datasets/{dataset_id}/import-jobs/{job_id}/validate")
        assert validate.status_code == 200
        assert validate.json()["state"] == "ValidationPassed"

        confirm = client.post(f"/api/datasets/{dataset_id}/import-jobs/{job_id}/confirm")
        assert confirm.status_code == 200
        assert confirm.json()["lifecycle_status"] == "preannotation_ready"

        generated = client.post(f"/api/datasets/{dataset_id}/qc/generate")
        assert generated.status_code == 200
        assert generated.json()["assignment"]["assignee_user_id"] == "offline_reviewer"

        queue = client.get(f"/api/datasets/{dataset_id}/qc")
        assert queue.status_code == 200
        assert queue.json()["total"] == 1

        review = client.get(f"/api/datasets/{dataset_id}/samples/{SAMPLE_ID}/review")
        assert review.status_code == 200
        assert review.json()["stage1"]["sample_id"] == SAMPLE_ID

        lease = client.post(f"/api/datasets/{dataset_id}/samples/{SAMPLE_ID}/lease")
        assert lease.status_code == 200
        lease_id = lease.json()["lease"]["lease_id"]

        draft = client.put(f"/api/datasets/{dataset_id}/label-edits/my-batch-draft", json=_draft_payload(lease_id))
        assert draft.status_code == 200
        assert draft.json()["saved_count"] == 1

        autosave = client.post(
            f"/api/datasets/{dataset_id}/label-edits/my-batch-draft/autosave",
            json=_draft_payload(lease_id),
        )
        assert autosave.status_code == 200

        submitted = client.post(
            f"/api/datasets/{dataset_id}/label-edits/submit-batch",
            json={"unsaved_dirty_sample_ids": [], "validation_error_sample_ids": []},
        )
        assert submitted.status_code == 200
        assert submitted.json()["submitted"] is True

    with _client(offline_env) as restarted:
        queue = restarted.get(f"/api/datasets/{dataset_id}/qc")
        assert queue.status_code == 200
        assert queue.json()["assignment"]["status"] == "submitted"
        assert queue.json()["items"][0]["latest_submission"]["operations"]

        draft = restarted.get(f"/api/datasets/{dataset_id}/label-edits/my-batch-draft")
        assert draft.status_code == 200
        assert draft.json()["sample_count"] == 0

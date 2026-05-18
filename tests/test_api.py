"""API runtime tests for the fixture-backed FastAPI service."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from urban_violation_backend.app import create_app


DATASET_ID = "urban_violation"
BATCH_DATASET_ID = "urban_violation__0508_fixture"
SUCCESS_SAMPLE_ID = "000142_0_1762483003246"
FAILURE_SAMPLE_ID = "001710_0_1763108687181"
IMPORT_JOB_ID = "fixture-import-urban-violation"
LABEL_CONFIG_PATH = Path(
    "/mnt/lc/LC/ares_xtws/0_train_data/data_platform/DATASET/urban_violation/label_config.json"
)


@pytest.fixture
def client() -> TestClient:
    """Return an isolated API client with clean in-memory state."""
    with TestClient(create_app()) as test_client:
        yield test_client


def _load_label_config_payload() -> dict[str, Any]:
    """Load the canonical label config JSON used by all lifecycle tests."""
    return json.loads(LABEL_CONFIG_PATH.read_text(encoding="utf-8"))


def _save_label_config(client: TestClient, activate: bool = False) -> dict[str, Any]:
    """Save one label config through the dataset-scoped API."""
    response = client.post(
        f"/api/datasets/{DATASET_ID}/label-configs",
        json={
            "file_name": LABEL_CONFIG_PATH.name,
            "config": _load_label_config_payload(),
            "activate": activate,
        },
    )
    assert response.status_code == 200
    return response.json()


def _activate_label_config(client: TestClient) -> dict[str, Any]:
    """Save and activate one label config version for positive flow tests."""
    saved = _save_label_config(client, activate=False)
    response = client.post(
        f"/api/datasets/{DATASET_ID}/label-configs/{saved['config_id']}/activate"
    )
    assert response.status_code == 200
    return response.json()


def _build_valid_label_edit_payload() -> dict[str, Any]:
    """Return a valid label-edit payload for relation/candidate/stage1 scopes."""
    return {
        "task_mode": "label_edit",
        "label_config_id": "label-config-test",
        "label_config_version": "urban_violation_labels_v1",
        "operations": [
            {
                "scope": "relation:R1",
                "field": "relation",
                "op": "replace",
                "before": "占据",
                "after": "靠近",
            },
            {
                "scope": "candidate:C1",
                "field": "confidence",
                "op": "replace",
                "before": 0.82,
                "after": 0.91,
            },
            {
                "scope": "candidate:C1",
                "field": "sample_category",
                "op": "replace",
                "before": "positive samples",
                "after": "positive samples",
            },
            {
                "scope": "stage1",
                "field": "scene_elements",
                "op": "replace",
                "after": ["人行道", "电动车"],
            },
        ],
    }


def test_health_and_dataset_summary(client: TestClient) -> None:
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json() == {"status": "ok", "dataset_id": DATASET_ID}

    datasets = client.get("/api/datasets")
    assert datasets.status_code == 200
    items = datasets.json()
    assert len(items) == 1
    assert items[0]["dataset_id"] == BATCH_DATASET_ID
    assert items[0]["dataset_type"] == DATASET_ID
    assert items[0]["batch_key"] == "0508_fixture"
    assert items[0]["legacy_dataset_id"] == DATASET_ID

    summary = client.get(f"/api/datasets/{DATASET_ID}/summary")
    assert summary.status_code == 200
    payload = summary.json()
    assert payload["dataset_id"] == BATCH_DATASET_ID
    assert payload["dataset_type"] == DATASET_ID
    assert payload["active_import_job_id"] == IMPORT_JOB_ID
    assert payload["total_assets"] == 797
    assert payload["stage1_count"] == 797
    assert payload["stage2_success_count"] == 780
    assert payload["stage2_failure_count"] == 19


def test_active_label_config_missing_returns_explicit_404(client: TestClient) -> None:
    active = client.get(f"/api/datasets/{DATASET_ID}/label-config/active")
    assert active.status_code == 404
    assert "Active label config not found" in active.json()["detail"]

    suggestions = client.get(
        f"/api/datasets/{DATASET_ID}/label-suggestions",
        params={"field": "segmentation_targets", "q": "电"},
    )
    assert suggestions.status_code == 404
    assert "Active label config not found" in suggestions.json()["detail"]


def test_validate_label_config_from_dataset_fixture(client: TestClient) -> None:
    response = client.post(
        f"/api/datasets/{DATASET_ID}/label-configs/validate",
        json={"file_name": LABEL_CONFIG_PATH.name, "config": _load_label_config_payload()},
    )
    assert response.status_code == 200

    payload = response.json()
    assert payload["valid"] is True
    assert payload["dataset_id"] == DATASET_ID
    assert payload["schema_version"] == "label_config_v1"
    assert payload["version"] == "urban_violation_labels_v1"
    assert payload["content_hash"].startswith("sha256:")
    assert payload["summary"]["field_count"] >= 8
    assert payload["summary"]["closed_enum_count"] == 6
    assert payload["summary"]["open_tags_count"] == 2
    assert payload["summary"]["option_count"] > 0
    assert payload["errors"] == []


def test_save_label_config_without_activate_keeps_dataset_unbound(client: TestClient) -> None:
    saved = _save_label_config(client, activate=False)
    assert saved["dataset_id"] == DATASET_ID
    assert saved["status"] == "draft"
    assert saved["activated_at"] is None
    assert saved["validation"]["valid"] is True

    active = client.get(f"/api/datasets/{DATASET_ID}/label-config/active")
    assert active.status_code == 404


def test_activate_label_config_and_suggestions(client: TestClient) -> None:
    activated = _activate_label_config(client)
    assert activated["status"] == "active"

    active = client.get(f"/api/datasets/{DATASET_ID}/label-config/active")
    assert active.status_code == 200
    active_payload = active.json()
    assert active_payload["config_id"] == activated["config_id"]
    assert active_payload["config"]["dataset_type"] == DATASET_ID

    suggestions = client.get(
        f"/api/datasets/{DATASET_ID}/label-suggestions",
        params={"field": "segmentation_targets", "q": "电"},
    )
    assert suggestions.status_code == 200
    suggestion_payload = suggestions.json()
    assert suggestion_payload["field"] == "segmentation_targets"
    assert suggestion_payload["mode"] == "open_tags"
    assert suggestion_payload["allow_custom"] is True
    assert any(option["code"] == "electric_vehicle" for option in suggestion_payload["suggestions"])


def test_save_with_activate_true_returns_active_version(client: TestClient) -> None:
    saved = _save_label_config(client, activate=True)
    assert saved["status"] == "active"
    assert saved["activated_at"] is not None

    active = client.get(f"/api/datasets/{DATASET_ID}/label-config/active")
    assert active.status_code == 200
    assert active.json()["config_id"] == saved["config_id"]


def test_invalid_config_rules_and_save_rejection(client: TestClient) -> None:
    invalid_payload = _load_label_config_payload()
    for field in invalid_payload["fields"]:
        if field["field"] == "scene_elements":
            field["mode"] = "closed_enum"
            field["allow_custom"] = False
            break

    validate_response = client.post(
        f"/api/datasets/{DATASET_ID}/label-configs/validate",
        json={"file_name": "invalid.json", "config": invalid_payload},
    )
    assert validate_response.status_code == 200
    validate_payload = validate_response.json()
    assert validate_payload["valid"] is False
    assert any("scene_elements" in issue["message"] for issue in validate_payload["errors"])

    save_response = client.post(
        f"/api/datasets/{DATASET_ID}/label-configs",
        json={"file_name": "invalid.json", "config": invalid_payload, "activate": False},
    )
    assert save_response.status_code == 422
    detail = save_response.json()["detail"]
    assert detail["valid"] is False


def test_unknown_label_field_returns_404_after_activation(client: TestClient) -> None:
    _activate_label_config(client)
    response = client.get(
        f"/api/datasets/{DATASET_ID}/label-suggestions",
        params={"field": "unknown_field"},
    )
    assert response.status_code == 404


def test_assets_list_filters(client: TestClient) -> None:
    all_assets = client.get(f"/api/datasets/{DATASET_ID}/assets")
    assert all_assets.status_code == 200
    all_payload = all_assets.json()
    assert all_payload["dataset_id"] == BATCH_DATASET_ID
    assert all_payload["dataset_type"] == DATASET_ID
    assert all_payload["total"] == 797

    success_filtered = client.get(
        f"/api/datasets/{DATASET_ID}/assets",
        params={"failure_status": "success"},
    )
    assert success_filtered.status_code == 200
    success_items = success_filtered.json()["items"]
    assert len(success_items) == 780
    assert SUCCESS_SAMPLE_ID in {item["sample_id"] for item in success_items}


def test_review_detail_for_success_sample(client: TestClient) -> None:
    response = client.get(f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/review")
    assert response.status_code == 200

    payload = response.json()
    assert payload["dataset_id"] == BATCH_DATASET_ID
    assert payload["dataset_type"] == DATASET_ID
    assert payload["sample_id"] == SUCCESS_SAMPLE_ID
    assert payload["stage2"] is not None
    assert payload["stage2_failure"] is None
    assert payload["asset"]["image_url"].startswith("/media/images/")
    assert "/mnt/" not in payload["asset"]["image_url"]


def test_failure_detail_for_stage2_failure_sample(client: TestClient) -> None:
    response = client.get(f"/api/datasets/{DATASET_ID}/samples/{FAILURE_SAMPLE_ID}/review")
    assert response.status_code == 200

    payload = response.json()
    assert payload["dataset_id"] == BATCH_DATASET_ID
    assert payload["sample_id"] == FAILURE_SAMPLE_ID
    assert payload["stage2"] is None
    assert payload["stage2_failure"] is not None
    assert payload["stage2_failure"]["error_type"] == "ValueError"


def test_label_edit_validate_success_and_no_persistence(client: TestClient) -> None:
    _activate_label_config(client)
    payload = _build_valid_label_edit_payload()
    response = client.post(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits/validate",
        json=payload,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is True
    assert body["checked_operation_count"] == len(payload["operations"])
    assert body["errors"] == []

    detail = client.get(f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/review")
    assert detail.status_code == 200
    detail_payload = detail.json()
    assert detail_payload["label_edit_state"] is None
    assert detail_payload["label_edit_history"] == []


def test_label_edit_validate_rejects_invalid_closed_enum(client: TestClient) -> None:
    _activate_label_config(client)
    payload = _build_valid_label_edit_payload()
    payload["operations"][0]["after"] = "not_in_active_config"

    response = client.post(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits/validate",
        json=payload,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is False
    assert any("active label config options" in issue["message"] for issue in body["errors"])


def test_label_edit_validate_rejects_confidence_out_of_range(client: TestClient) -> None:
    _activate_label_config(client)
    payload = _build_valid_label_edit_payload()
    payload["operations"][1]["after"] = 1.2

    response = client.post(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits/validate",
        json=payload,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is False
    assert any(issue["field"] == "confidence" for issue in body["errors"])


def test_label_edit_validate_rejects_invalid_bbox(client: TestClient) -> None:
    _activate_label_config(client)
    payload = _build_valid_label_edit_payload()
    payload["operations"].append(
        {
            "scope": "relation:R1",
            "field": "bbox",
            "op": "replace",
            "after": [1010, 5, 20, 10],
        }
    )

    response = client.post(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits/validate",
        json=payload,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is False
    assert any(issue["field"] == "bbox" for issue in body["errors"])


def test_label_edit_validate_allows_empty_segmentation_targets(client: TestClient) -> None:
    _activate_label_config(client)
    payload = _build_valid_label_edit_payload()
    payload["operations"] = [
        {
            "scope": "candidate:C1",
            "field": "segmentation_targets",
            "op": "replace",
            "before": ["行人"],
            "after": [],
        }
    ]

    response = client.post(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits/validate",
        json=payload,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is True
    assert body["errors"] == []


def test_label_edit_validate_accepts_candidate_delete_operation(client: TestClient) -> None:
    _activate_label_config(client)
    payload = _build_valid_label_edit_payload()
    payload["operations"] = [
        {
            "scope": "candidate:C1",
            "field": "candidate",
            "op": "delete_candidate",
            "before": {"id": "C1", "violation_category": "no violation"},
            "after": None,
        }
    ]

    response = client.post(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits/validate",
        json=payload,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is True
    assert body["checked_operation_count"] == 1


def test_label_edit_save_draft_persists_and_returns_in_review_detail(client: TestClient) -> None:
    _activate_label_config(client)
    payload = _build_valid_label_edit_payload()
    payload["submit_action"] = "save_draft"
    payload["task_status"] = "annotation_draft"

    submit = client.post(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits",
        json=payload,
    )
    assert submit.status_code == 200
    submit_body = submit.json()
    assert submit_body["saved"] is True
    assert submit_body["state"]["task_status"] == "annotation_draft"

    detail = client.get(f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/review")
    assert detail.status_code == 200
    detail_payload = detail.json()
    assert detail_payload["label_edit_state"] is not None
    assert detail_payload["label_edit_state"]["task_status"] == "annotation_draft"
    assert len(detail_payload["label_edit_history"]) == 1


def test_label_edit_submit_changes_reuses_validation_and_persists(client: TestClient) -> None:
    _activate_label_config(client)
    invalid_payload = _build_valid_label_edit_payload()
    invalid_payload["operations"][1]["after"] = 1.5
    invalid_payload["submit_action"] = "submit_changes"
    invalid_payload["task_status"] = "annotation_submitted"

    invalid_submit = client.post(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits",
        json=invalid_payload,
    )
    assert invalid_submit.status_code == 422
    invalid_detail = invalid_submit.json()["detail"]
    assert invalid_detail["valid"] is False

    valid_payload = _build_valid_label_edit_payload()
    valid_payload["submit_action"] = "submit_changes"
    valid_payload["task_status"] = "annotation_submitted"
    submit = client.post(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits",
        json=valid_payload,
    )
    assert submit.status_code == 200
    body = submit.json()
    assert body["state"]["task_status"] == "annotation_submitted"
    assert body["validation"] is not None
    assert body["validation"]["valid"] is True

    detail = client.get(f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/review")
    assert detail.status_code == 200
    assert detail.json()["label_edit_state"]["task_status"] == "annotation_submitted"


def test_review_submit_persists_in_fixture_session(client: TestClient) -> None:
    submit = client.post(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/review",
        json={
            "reviewer": "backend-agent",
            "decision": "approved",
            "notes": "Looks good",
            "corrected_categories": ["no violation"],
            "corrected_bboxes": [[10, 10, 20, 20]],
        },
    )
    assert submit.status_code == 200
    saved = submit.json()

    detail = client.get(f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/review")
    assert detail.status_code == 200
    detail_payload = detail.json()
    assert detail_payload["latest_review"] is not None
    assert detail_payload["latest_review"]["review_id"] == saved["review_id"]


def test_media_url_path_safety(client: TestClient) -> None:
    media_ok = client.get(f"/media/images/{SUCCESS_SAMPLE_ID}.jpg")
    assert media_ok.status_code == 200
    assert media_ok.headers["content-type"].startswith("image/")

    media_blocked = client.get("/media/images/..%2F..%2Fpyproject.toml")
    assert media_blocked.status_code == 404


def test_import_job_qc_search_and_export_endpoints(client: TestClient) -> None:
    jobs = client.get(f"/api/datasets/{DATASET_ID}/import-jobs")
    assert jobs.status_code == 200
    assert len(jobs.json()) >= 1

    import_job = client.get(f"/api/datasets/{DATASET_ID}/import-jobs/{IMPORT_JOB_ID}")
    assert import_job.status_code == 200
    import_payload = import_job.json()
    assert import_payload["dataset_id"] == BATCH_DATASET_ID
    assert import_payload["dataset_type"] == DATASET_ID
    assert import_payload["batch_key"] == "0508_fixture"

    create_job = client.post(
        f"/api/datasets/{DATASET_ID}/import-jobs",
        json={"requested_sample_ids": [SUCCESS_SAMPLE_ID, FAILURE_SAMPLE_ID]},
    )
    assert create_job.status_code == 201
    job_payload = create_job.json()
    created_job_id = job_payload["job_id"]
    assert job_payload["state"] == "Draft"

    scan_job = client.post(f"/api/datasets/{DATASET_ID}/import-jobs/{created_job_id}/scan")
    assert scan_job.status_code == 200
    assert scan_job.json()["state"] == "Scanning"

    validate_job = client.post(f"/api/datasets/{DATASET_ID}/import-jobs/{created_job_id}/validate")
    assert validate_job.status_code == 200
    validate_payload = validate_job.json()
    assert validate_payload["state"] == "ValidationPassed"
    assert validate_payload["failure_count"] == 19
    assert validate_payload["warning_count"] >= 1
    assert validate_payload["validation_errors"] == []

    confirm_job = client.post(f"/api/datasets/{DATASET_ID}/import-jobs/{created_job_id}/confirm")
    assert confirm_job.status_code == 200
    confirm_payload = confirm_job.json()
    assert confirm_payload["state"] == "Imported"
    assert confirm_payload["failure_count"] == 19
    assert confirm_payload["lifecycle_status"] in {
        "label_config_required",
        "qc_ready",
        "qc_in_progress",
        "qc_completed",
    }

    retry_job = client.post(f"/api/datasets/{DATASET_ID}/import-jobs/{created_job_id}/retry")
    assert retry_job.status_code == 200
    assert retry_job.json()["state"] == "Draft"

    qc = client.get(f"/api/datasets/{DATASET_ID}/qc")
    assert qc.status_code == 200
    qc_payload = qc.json()
    assert qc_payload["dataset_id"] == BATCH_DATASET_ID
    assert qc_payload["dataset_type"] == DATASET_ID
    assert qc_payload["total"] == 797
    assert qc_payload["items"][0]["dataset_id"] == BATCH_DATASET_ID
    assert qc_payload["items"][0]["qc_queue_id"].startswith("qcq_urban_violation_")

    search = client.get(
        f"/api/datasets/{DATASET_ID}/search",
        params={"q": "no violation"},
    )
    assert search.status_code == 200
    assert search.json()["total"] >= 1

    export = client.post(
        f"/api/datasets/{DATASET_ID}/exports",
        json={"sample_ids": [SUCCESS_SAMPLE_ID]},
    )
    assert export.status_code == 200
    export_payload = export.json()
    assert export_payload["sample_count"] == 1
    assert export_payload["sample_ids"] == [SUCCESS_SAMPLE_ID]


def test_asset_summary_and_extended_filters(client: TestClient) -> None:
    summary = client.get(f"/api/datasets/{DATASET_ID}/assets/summary")
    assert summary.status_code == 200
    payload = summary.json()
    assert payload["dataset_id"] == BATCH_DATASET_ID
    assert payload["dataset_type"] == DATASET_ID
    assert payload["metrics"]["total_assets"] == 797
    assert payload["metrics"]["stage2_failure_total"] == 17

    failed = client.get(
        f"/api/datasets/{DATASET_ID}/assets",
        params={"step2_status": "failure", "media_status": "valid"},
    )
    assert failed.status_code == 200
    failed_payload = failed.json()
    assert failed_payload["total"] == 17
    assert any(item["sample_id"] == FAILURE_SAMPLE_ID for item in failed_payload["items"])

    high_conf = client.get(
        f"/api/datasets/{DATASET_ID}/assets",
        params={"confidence_min": 0.9, "step2_status": "success"},
    )
    assert high_conf.status_code == 200
    assert high_conf.json()["total"] >= 1


def test_label_config_type_scope_with_batch_path(client: TestClient) -> None:
    saved = client.post(
        f"/api/datasets/{DATASET_ID}/label-configs",
        json={
            "file_name": LABEL_CONFIG_PATH.name,
            "config": _load_label_config_payload(),
            "activate": True,
        },
    )
    assert saved.status_code == 200
    saved_payload = saved.json()
    assert saved_payload["dataset_id"] == DATASET_ID

    # Batch path should resolve to same type-scoped active label config.
    active = client.get(f"/api/datasets/{BATCH_DATASET_ID}/label-config/active")
    assert active.status_code == 200
    active_payload = active.json()
    assert active_payload["dataset_id"] == BATCH_DATASET_ID
    assert active_payload["config_id"] == saved_payload["config_id"]

"""API runtime tests for the fixture-backed FastAPI service."""

from __future__ import annotations

from datetime import datetime, timezone
import io
import json
import os
from pathlib import Path
from typing import Any
import zipfile

import pytest
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[1]
RELATIVE_DATASET_ROOT = Path("DATASET")
DEFAULT_DATASET_ROOT_RELATIVE = RELATIVE_DATASET_ROOT / "urban_violation"
DATASET_0520_RELATIVE_PATH = RELATIVE_DATASET_ROOT / "urban_violation_0520"
DATASET_ROOT = PROJECT_ROOT / RELATIVE_DATASET_ROOT
DEFAULT_DATASET_ROOT = PROJECT_ROOT / DEFAULT_DATASET_ROOT_RELATIVE
LABEL_CONFIG_PATH = DEFAULT_DATASET_ROOT / "label_config.json"
DATASET_0520_PATH = PROJECT_ROOT / DATASET_0520_RELATIVE_PATH

os.environ.setdefault("DATASET_ROOT", str(DEFAULT_DATASET_ROOT_RELATIVE))
_effective_dataset_root = Path(os.environ["DATASET_ROOT"])
if not _effective_dataset_root.is_absolute():
    _effective_dataset_root = PROJECT_ROOT / _effective_dataset_root
if not _effective_dataset_root.exists():
    os.environ.setdefault("PLATFORM_ENABLE_FIXTURE_BATCH", "0")

import urban_violation_backend.app as app_module
from urban_violation_backend.app import create_app
from urban_violation_backend.service import build_fixture_service


DATASET_ID = "urban_violation"
BATCH_DATASET_ID = "urban_violation__0508_fixture"
SUCCESS_SAMPLE_ID = "000142_0_1762483003246"
FAILURE_SAMPLE_ID = "001710_0_1763108687181"
MULTI_CANDIDATE_SAMPLE_ID = "000122_0_1760525212732"
IMPORT_JOB_ID = "fixture-import-urban-violation"


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    """Return an isolated API client with clean in-memory state."""
    with TestClient(
        create_app(
            label_config_store_root=tmp_path / "LABEL_CONFIG_STATE",
            platform_state_root=tmp_path / "PLATFORM_STATE",
        )
    ) as test_client:
        yield test_client


def _load_label_config_payload() -> dict[str, Any]:
    """Load the canonical label config JSON used by all lifecycle tests."""
    return json.loads(LABEL_CONFIG_PATH.read_text(encoding="utf-8"))


def _modified_label_config_payload(*, version: str | None = None) -> dict[str, Any]:
    """Return a deterministic config variant with changed hash."""
    payload = json.loads(json.dumps(_load_label_config_payload(), ensure_ascii=False))
    if version is not None:
        payload["version"] = version
    fields = payload.get("fields", [])
    if fields:
        fields[0]["label_zh"] = f"{fields[0].get('label_zh', '')}#changed"
    return payload


def _label_config_version_number(version: str | None = None) -> int | None:
    """Return the trailing numeric version used by dataset-type summaries."""
    raw_version = str(version or _load_label_config_payload().get("version", ""))
    digits = ""
    for char in reversed(raw_version):
        if not char.isdigit():
            break
        digits = f"{char}{digits}"
    return int(digits) if digits else None


def _next_label_config_version() -> str:
    """Return a fixture-relative version string that is not the current fixture version."""
    current = str(_load_label_config_payload().get("version", "urban_violation_labels_v1"))
    digits = ""
    for char in reversed(current):
        if not char.isdigit():
            break
        digits = f"{char}{digits}"
    if not digits:
        return f"{current}_v2"
    return f"{current[: -len(digits)]}{int(digits) + 1}"


def _save_label_config(
    client: TestClient,
    activate: bool = False,
    save_as_new_version: bool = False,
) -> dict[str, Any]:
    """Save one label config through the dataset-scoped API."""
    response = client.post(
        f"/api/datasets/{DATASET_ID}/label-configs",
        json={
            "file_name": LABEL_CONFIG_PATH.name,
            "config": _load_label_config_payload(),
            "activate": activate,
            "save_as_new_version": save_as_new_version,
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
        "label_config_version": str(_load_label_config_payload().get("version", "urban_violation_labels_v1")),
        "operations": [
            {
                "scope": "relation:R1",
                "field": "relation",
                "op": "replace",
                "before": "occupying",
                "after": "near",
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


def _build_batch_draft_entry(
    *,
    sample_id: str,
    lease_id: str,
    base_revision: int = 0,
    operations: list[dict[str, Any]] | None = None,
    dirty: bool = False,
    saved: bool = True,
    validation_valid: bool = True,
) -> dict[str, Any]:
    """Build one batch-draft entry payload for save/autosave APIs."""
    return {
        "sample_id": sample_id,
        "lease_id": lease_id,
        "base_revision": base_revision,
        "operations": operations if operations is not None else _build_valid_label_edit_payload()["operations"],
        "dirty": dirty,
        "saved": saved,
        "validation": {
            "valid": validation_valid,
            "error_count": 0 if validation_valid else 1,
            "warning_count": 0,
            "errors": [] if validation_valid else [
                {
                    "operation_index": 0,
                    "scope": "candidate:C1",
                    "field": "confidence",
                    "code": "invalid_field_value",
                    "message": "confidence must be in [0, 1]",
                }
            ],
            "warnings": [],
        },
    }


def _admin_headers() -> dict[str, str]:
    return {"X-User-Id": "platform_admin", "X-User-Role": "platform_admin"}


def _user_headers(user_id: str, role: str) -> dict[str, str]:
    return {"X-User-Id": user_id, "X-User-Role": role}


def _build_zip_bytes(entries: dict[str, bytes]) -> bytes:
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        for path, content in entries.items():
            zip_file.writestr(path, content)
    return archive.getvalue()


def _create_user(client: TestClient, user_id: str, role: str = "annotator") -> None:
    response = client.post(
        "/api/users",
        json={
            "user_id": user_id,
            "display_name": user_id,
            "email": f"{user_id}@example.local",
            "password": "StrongPassw0rd!",
        },
        headers=_admin_headers(),
    )
    assert response.status_code == 201
    binding = client.post(
        "/api/role-bindings",
        json={
            "user_id": user_id,
            "role": role,
            "scope_type": "dataset_batch",
            "scope_id": BATCH_DATASET_ID,
        },
        headers=_admin_headers(),
    )
    assert binding.status_code == 201


def _assign_batch(client: TestClient, assignee_user_id: str, dataset_id: str = DATASET_ID) -> None:
    response = client.post(
        f"/api/datasets/{dataset_id}/qc/assignment",
        json={"assignee_user_id": assignee_user_id},
        headers=_admin_headers(),
    )
    assert response.status_code == 200


def _acquire_lease(
    client: TestClient,
    user_id: str,
    sample_id: str = SUCCESS_SAMPLE_ID,
    dataset_id: str = DATASET_ID,
) -> str:
    response = client.post(
        f"/api/datasets/{dataset_id}/samples/{sample_id}/lease",
        headers=_user_headers(user_id, "annotator"),
    )
    assert response.status_code == 200
    return response.json()["lease"]["lease_id"]


def _submit_and_confirm_changed_sample(
    client: TestClient,
    *,
    sample_id: str = MULTI_CANDIDATE_SAMPLE_ID,
) -> tuple[str, dict[str, Any]]:
    """Create one meaningful change and return submission id + active pool item."""
    _activate_label_config(client)
    _create_user(client, "annotator_a", role="annotator")
    _create_user(client, "qc_lead_a", role="qc_lead")
    _assign_batch(client, "annotator_a", dataset_id=BATCH_DATASET_ID)
    lease_id = _acquire_lease(
        client,
        "annotator_a",
        sample_id=sample_id,
        dataset_id=BATCH_DATASET_ID,
    )

    detail_response = client.get(
        f"/api/datasets/{BATCH_DATASET_ID}/samples/{sample_id}/review",
        headers=_admin_headers(),
    )
    assert detail_response.status_code == 200
    relation_before = detail_response.json()["stage1"]["key_relations"][0]

    submit = client.post(
        f"/api/datasets/{BATCH_DATASET_ID}/samples/{sample_id}/label-edits",
        json={
            "task_mode": "label_edit",
            "submit_action": "submit_changes",
            "task_status": "annotation_submitted",
            "lease_id": lease_id,
            "base_revision": 0,
            "operations": [
                {
                    "scope": "relation:R1",
                    "field": "description",
                    "op": "replace",
                    "before": relation_before["description"],
                    "after": f"{relation_before['description']}#phase3",
                }
            ],
        },
        headers=_user_headers("annotator_a", "annotator"),
    )
    assert submit.status_code == 200

    history = client.get(
        f"/api/datasets/{BATCH_DATASET_ID}/samples/{sample_id}/label-edits/history",
        headers=_user_headers("qc_lead_a", "qc_lead"),
    )
    assert history.status_code == 200
    submission_id = history.json()[-1]["submission_id"]

    confirmed = client.post(
        f"/api/datasets/{BATCH_DATASET_ID}/samples/{sample_id}/label-edits/{submission_id}/confirm",
        headers=_user_headers("qc_lead_a", "qc_lead"),
    )
    assert confirmed.status_code == 200

    pool = client.get(
        "/api/sample-pool",
        params={"dataset_id": BATCH_DATASET_ID, "sample_id": sample_id, "status": "active"},
        headers=_admin_headers(),
    )
    assert pool.status_code == 200
    payload = pool.json()
    assert payload["total"] == 1
    return submission_id, payload["items"][0]


def _create_evaluation(
    client: TestClient,
    *,
    dataset_id: str,
    model_version: str,
    metrics: dict[str, float] | None = None,
    category_metrics: dict[str, dict[str, float]] | None = None,
    changed_sample_ids: list[str] | None = None,
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    response = client.post(
        f"/api/datasets/{dataset_id}/evaluations",
        json={
            "model_version": model_version,
            "metrics": metrics,
            "category_metrics": category_metrics or {},
            "changed_sample_ids": changed_sample_ids or [],
            "notes": f"eval:{model_version}",
        },
        headers=headers or _admin_headers(),
    )
    assert response.status_code == 201
    return response.json()


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


def test_disable_fixture_batch_preserves_type_and_label_config(tmp_path: Path) -> None:
    with TestClient(
        create_app(
            dataset_root=tmp_path / "missing_dataset",
            label_config_store_root=tmp_path / "LABEL_CONFIG_STATE",
            platform_state_root=tmp_path / "PLATFORM_STATE",
            enable_fixture_batch=False,
        )
    ) as scoped_client:
        datasets = scoped_client.get("/api/datasets")
        assert datasets.status_code == 200
        assert datasets.json() == []

        fixture_summary = scoped_client.get(f"/api/datasets/{BATCH_DATASET_ID}/summary")
        assert fixture_summary.status_code == 404

        type_detail = scoped_client.get(f"/api/dataset-types/{DATASET_ID}")
        assert type_detail.status_code == 200
        type_payload = type_detail.json()
        assert type_payload["dataset_type"] == DATASET_ID
        assert type_payload["batch_count"] == 0
        assert type_payload["batches"] == []
        assert type_payload["active_label_config_version"] is None

        saved = scoped_client.post(
            f"/api/dataset-types/{DATASET_ID}/label-configs",
            json={
                "file_name": LABEL_CONFIG_PATH.name,
                "config": _load_label_config_payload(),
                "activate": True,
            },
            headers=_admin_headers(),
        )
        assert saved.status_code == 200

        active = scoped_client.get(f"/api/dataset-types/{DATASET_ID}/label-config/active")
        assert active.status_code == 200
        assert active.json()["config"]["dataset_type"] == DATASET_ID

        updated_type = scoped_client.get(f"/api/dataset-types/{DATASET_ID}")
        assert updated_type.status_code == 200
        assert updated_type.json()["active_label_config_version"] == _label_config_version_number()
        assert updated_type.json()["batch_count"] == 0


def test_dataset_type_registry_can_add_ares_detection(client: TestClient) -> None:
    type_list = client.get("/api/dataset-types")
    assert type_list.status_code == 200
    type_payload = type_list.json()
    assert type_payload[0]["dataset_type"] == DATASET_ID
    assert type_payload[0]["batch_count"] == 1
    assert type_payload[0]["batches"][0]["dataset_id"] == BATCH_DATASET_ID

    created = client.post(
        "/api/dataset-types",
        json={
            "dataset_type": "ares_detection",
            "display_name": "Ares Detection",
            "field_schema_version": "draft",
        },
    )
    assert created.status_code == 201
    created_payload = created.json()
    assert created_payload["dataset_type"] == "ares_detection"
    assert created_payload["batch_count"] == 0
    assert created_payload["batches"] == []

    listed = client.get("/api/dataset-types")
    assert listed.status_code == 200
    by_type = {item["dataset_type"]: item for item in listed.json()}
    assert set(by_type) == {DATASET_ID, "ares_detection"}
    assert by_type["ares_detection"]["batch_count"] == 0

    duplicate = client.post(
        "/api/dataset-types",
        json={"dataset_type": "ares_detection", "display_name": "Duplicate"},
    )
    assert duplicate.status_code == 409


def test_dataset_type_detail_urban_violation_includes_batches_and_active_label_config(
    client: TestClient,
) -> None:
    _activate_label_config(client)
    response = client.get(f"/api/dataset-types/{DATASET_ID}")
    assert response.status_code == 200
    payload = response.json()
    assert payload["dataset_type"] == DATASET_ID
    assert payload["batch_count"] >= 1
    assert payload["batches"]
    assert any(item["dataset_id"] == BATCH_DATASET_ID for item in payload["batches"])
    assert "active_label_config_version" in payload


def test_dataset_type_detail_for_created_empty_type_returns_zero_batches(client: TestClient) -> None:
    created = client.post(
        "/api/dataset-types",
        json={
            "dataset_type": "ares_detection",
            "display_name": "Ares Detection",
            "field_schema_version": "draft",
        },
    )
    assert created.status_code == 201

    detail = client.get("/api/dataset-types/ares_detection")
    assert detail.status_code == 200
    payload = detail.json()
    assert payload["dataset_type"] == "ares_detection"
    assert payload["batch_count"] == 0
    assert payload["batches"] == []


def test_dataset_type_detail_unknown_returns_404(client: TestClient) -> None:
    response = client.get("/api/dataset-types/not_exist")
    assert response.status_code == 404


def test_manual_batch_registration_supports_images_only_and_preannotation_counts(client: TestClient) -> None:
    created_type = client.post(
        "/api/dataset-types",
        json={"dataset_type": "ares_detection", "display_name": "Ares Detection"},
        headers=_admin_headers(),
    )
    assert created_type.status_code == 201

    images_only = client.post(
        "/api/datasets/ares_detection/import-jobs",
        json={
            "dataset_type": "ares_detection",
            "batch_key": "20260518_images",
            "batch_name": "2026-05-18 Images Only",
            "source_mode": "local_directory",
            "source_uri": "DATASET/ares_detection/20260518_images",
            "source_structure": "images_only",
            "source_file_count": 12,
            "image_count": 12,
        },
        headers=_admin_headers(),
    )
    assert images_only.status_code == 201
    images_payload = images_only.json()
    assert images_payload["dataset_id"] == "ares_detection__20260518_images"
    assert images_payload["source_structure"] == "images_only"
    assert images_payload["expected_assets"] == 12

    preannotated = client.post(
        "/api/datasets/ares_detection/import-jobs",
        json={
            "dataset_type": "ares_detection",
            "batch_key": "20260518_step",
            "batch_name": "2026-05-18 With STEP Outputs",
            "source_mode": "local_directory",
            "source_uri": "DATASET/ares_detection/20260518_step",
            "source_structure": "images_with_preannotations",
            "source_file_count": 32,
            "image_count": 10,
            "stage1_file_count": 10,
            "stage2_file_count": 10,
            "stage2_failure_file_count": 2,
        },
        headers=_admin_headers(),
    )
    assert preannotated.status_code == 201
    step_payload = preannotated.json()
    assert step_payload["dataset_id"] == "ares_detection__20260518_step"
    assert step_payload["stage2_success_count"] == 10
    assert step_payload["failure_count"] == 2

    listed = client.get("/api/dataset-types")
    by_type = {item["dataset_type"]: item for item in listed.json()}
    assert by_type["ares_detection"]["batch_count"] == 2
    assert {
        batch["dataset_id"]
        for batch in by_type["ares_detection"]["batches"]
    } == {"ares_detection__20260518_images", "ares_detection__20260518_step"}

    summary = client.get("/api/datasets/ares_detection__20260518_step/summary")
    assert summary.status_code == 200
    summary_payload = summary.json()
    assert summary_payload["total_assets"] == 10
    assert summary_payload["stage1_count"] == 10
    assert summary_payload["stage2_success_count"] == 10
    assert summary_payload["stage2_failure_count"] == 2

    validate = client.post(
        f"/api/datasets/ares_detection__20260518_images/import-jobs/{images_payload['job_id']}/validate",
        headers=_admin_headers(),
    )
    assert validate.status_code == 200
    validate_payload = validate.json()
    assert validate_payload["state"] == "ValidationPassed"
    assert validate_payload["warning_count"] == 1
    assert "pre-annotation is required" in validate_payload["warnings"][0]


def test_manual_batch_creation_ingests_accessible_source_directory(client: TestClient) -> None:
    created = client.post(
        "/api/datasets/urban_violation/import-jobs",
        json={
            "dataset_type": "urban_violation",
            "batch_key": "0518_imported",
            "batch_name": "2026-05-18 Imported Batch",
            "source_mode": "local_directory",
            "source_uri": "DATASET/urban",
            "source_structure": "images_with_preannotations",
            "source_file_count": 2393,
            "image_count": 797,
            "stage1_file_count": 797,
            "stage2_file_count": 780,
            "stage2_failure_file_count": 19,
        },
        headers=_admin_headers(),
    )
    assert created.status_code == 201
    job = created.json()
    assert job["dataset_id"] == "urban_violation__0518_imported"
    assert job["state"] == "Imported"
    assert job["imported_assets"] == 797
    assert job["stage1_file_count"] == 797
    assert job["stage2_file_count"] == 780
    assert job["stage2_failure_file_count"] == 19
    assert job["failure_count"] == 19
    assert len(job["validation_rows"]) == 797

    listed = client.get("/api/dataset-types")
    assert listed.status_code == 200
    urban_type = {item["dataset_type"]: item for item in listed.json()}["urban_violation"]
    batch = {
        item["dataset_id"]: item
        for item in urban_type["batches"]
    }["urban_violation__0518_imported"]
    assert batch["total_assets"] == 797
    assert batch["stage2_success_count"] == 780
    assert batch["stage2_failure_count"] == 19

    assets = client.get("/api/datasets/urban_violation__0518_imported/assets")
    assert assets.status_code == 200
    asset_payload = assets.json()
    assert asset_payload["total"] == 797
    first_asset = asset_payload["items"][0]
    assert first_asset["image_url"].startswith(
        "/api/datasets/urban_violation__0518_imported/media/images/"
    )

    detail = client.get(
        "/api/datasets/urban_violation__0518_imported/assets/000424_0_1762499124659",
        headers=_admin_headers(),
    )
    assert detail.status_code == 200
    detail_payload = detail.json()
    assert detail_payload["dataset_id"] == "urban_violation__0518_imported"
    assert detail_payload["stage1"]["sample_id"] == "000424_0_1762499124659"
    assert detail_payload["stage2"]["sample_id"] == "000424_0_1762499124659"

    image_response = client.get(first_asset["image_url"])
    assert image_response.status_code == 200


def test_archive_upload_registers_images_only_batch_under_platform_state(tmp_path: Path) -> None:
    store_root = tmp_path / "LABEL_CONFIG_STATE"
    state_root = tmp_path / "PLATFORM_STATE"
    archive_bytes = _build_zip_bytes(
        {
            "urban_violation_0520/images/000001.jpg": b"image-a",
            "urban_violation_0520/images/000002.png": b"image-b",
        }
    )

    with TestClient(
        create_app(label_config_store_root=store_root, platform_state_root=state_root)
    ) as scoped_client:
        created = scoped_client.post(
            "/api/datasets/urban_violation/import-jobs/archive",
            params={
                "batch_key": "urban_violation_0520",
                "batch_name": "Urban Violation 0520",
                "archive_file_name": "urban_violation_0520.zip",
            },
            content=archive_bytes,
            headers={**_admin_headers(), "content-type": "application/zip"},
        )
        assert created.status_code == 201
        payload = created.json()
        assert payload["dataset_id"] == "urban_violation__urban_violation_0520"
        assert payload["source_mode"] == "uploaded_package"
        assert payload["source_structure"] == "images_only"
        assert payload["state"] == "Imported"
        assert payload["imported_assets"] == 2
        assert payload["expected_assets"] == 2
        assert "import_uploads" in payload["source_uri"]

        source_root = state_root / "import_uploads" / "urban_violation" / "urban_violation_0520" / "source"
        assert (source_root / "images" / "000001.jpg").is_file()
        assert (source_root / "images" / "000002.png").is_file()

        assets = scoped_client.get("/api/datasets/urban_violation__urban_violation_0520/assets")
        assert assets.status_code == 200
        asset_payload = assets.json()
        assert asset_payload["total"] == 2
        assert all(
            item["image_url"].startswith(
                "/api/datasets/urban_violation__urban_violation_0520/media/images/"
            )
            for item in asset_payload["items"]
        )


def test_archive_upload_rejects_zip_path_traversal(tmp_path: Path) -> None:
    store_root = tmp_path / "LABEL_CONFIG_STATE"
    state_root = tmp_path / "PLATFORM_STATE"
    archive_bytes = _build_zip_bytes({"../evil.txt": b"bad"})

    with TestClient(
        create_app(label_config_store_root=store_root, platform_state_root=state_root)
    ) as scoped_client:
        created = scoped_client.post(
            "/api/datasets/urban_violation/import-jobs/archive",
            params={"batch_key": "bad_zip", "batch_name": "Bad Zip"},
            content=archive_bytes,
            headers={**_admin_headers(), "content-type": "application/zip"},
        )
        assert created.status_code == 400
        assert "unsafe path" in created.json()["detail"]

    assert not (state_root / "import_uploads" / "urban_violation" / "evil.txt").exists()


def test_preannotated_registered_batch_generates_batch_scoped_qc_queue(client: TestClient) -> None:
    created = client.post(
        "/api/datasets/urban_violation/import-jobs",
        json={
            "dataset_type": "urban_violation",
            "batch_key": "0518_qc",
            "batch_name": "2026-05-18 QC Batch",
            "source_mode": "local_directory",
            "source_uri": "DATASET/urban",
            "source_structure": "images_with_preannotations",
            "source_file_count": 2393,
            "image_count": 797,
            "stage1_file_count": 797,
            "stage2_file_count": 780,
            "stage2_failure_file_count": 19,
        },
        headers=_admin_headers(),
    )
    assert created.status_code == 201
    batch_id = created.json()["dataset_id"]
    sample_id = "000424_0_1762499124659"

    empty_queue = client.get(f"/api/datasets/{batch_id}/qc", headers=_admin_headers())
    assert empty_queue.status_code == 200
    assert empty_queue.json()["total"] == 0

    blocked_assignment = client.post(
        f"/api/datasets/{batch_id}/qc/assignment",
        json={"assignee_user_id": "platform_admin"},
        headers=_admin_headers(),
    )
    assert blocked_assignment.status_code == 409
    assert blocked_assignment.json()["code"] == "qc_queue_required"

    blocked_generate = client.post(f"/api/datasets/{batch_id}/qc/generate", headers=_admin_headers())
    assert blocked_generate.status_code == 409
    assert blocked_generate.json()["code"] == "label_config_required"

    _activate_label_config(client)
    ready_summary = client.get(f"/api/datasets/{batch_id}/summary", headers=_admin_headers())
    assert ready_summary.status_code == 200
    ready_payload = ready_summary.json()
    assert ready_payload["lifecycle_status"] == "preannotation_ready"
    assert ready_payload["qc_queue_id"] is None

    generated = client.post(f"/api/datasets/{batch_id}/qc/generate", headers=_admin_headers())
    assert generated.status_code == 200
    generated_payload = generated.json()
    assert generated_payload["dataset_id"] == batch_id
    assert generated_payload["qc_queue_id"] == "qcq_urban_violation_0518_qc"
    assert generated_payload["total"] == 797
    assert generated_payload["items"][0]["dataset_id"] == batch_id

    tasks = client.get(f"/api/datasets/{batch_id}/qc/tasks", headers=_admin_headers())
    assert tasks.status_code == 200
    task_payload = tasks.json()
    assert len(task_payload) == 797
    assert {task["dataset_id"] for task in task_payload} == {batch_id}
    assert {task["status"] for task in task_payload} == {"queued"}

    queued_summary = client.get(f"/api/datasets/{batch_id}/summary", headers=_admin_headers())
    assert queued_summary.status_code == 200
    assert queued_summary.json()["lifecycle_status"] == "qc_ready"
    assert queued_summary.json()["qc_queue_id"] == "qcq_urban_violation_0518_qc"

    assignment = client.post(
        f"/api/datasets/{batch_id}/qc/assignment",
        json={"assignee_user_id": "platform_admin"},
        headers=_admin_headers(),
    )
    assert assignment.status_code == 200
    assert assignment.json()["dataset_id"] == batch_id
    assert assignment.json()["qc_queue_id"] == "qcq_urban_violation_0518_qc"

    progress = client.get(f"/api/datasets/{batch_id}/qc/progress", headers=_admin_headers())
    assert progress.status_code == 200
    assert progress.json()["dataset_id"] == batch_id
    assert progress.json()["total_tasks"] == 797
    assert progress.json()["assignment"]["dataset_id"] == batch_id

    lease = client.post(
        f"/api/datasets/{batch_id}/samples/{sample_id}/lease",
        headers=_admin_headers(),
    )
    assert lease.status_code == 200
    lease_id = lease.json()["lease"]["lease_id"]
    assert lease.json()["lease"]["dataset_id"] == batch_id

    draft_payload = _build_valid_label_edit_payload()
    draft_payload["submit_action"] = "save_draft"
    draft_payload["task_status"] = "annotation_draft"
    draft_payload["lease_id"] = lease_id
    draft_payload["base_revision"] = 0
    draft = client.post(
        f"/api/datasets/{batch_id}/samples/{sample_id}/label-edits",
        json=draft_payload,
        headers=_admin_headers(),
    )
    assert draft.status_code == 200
    assert draft.json()["state"]["dataset_id"] == batch_id

    my_draft = client.get(
        f"/api/datasets/{batch_id}/samples/{sample_id}/label-edits/my-draft",
        headers=_admin_headers(),
    )
    assert my_draft.status_code == 200
    assert my_draft.json()["dataset_id"] == batch_id


def test_manual_batch_0520_preannotated_hydration_and_qc_queue_generation(client: TestClient) -> None:
    created = client.post(
        "/api/datasets/urban_violation/import-jobs",
        json={
            "dataset_type": "urban_violation",
            "batch_key": "urban_violation_0520",
            "batch_name": "Urban Violation 0520",
            "source_mode": "local_directory",
            "source_uri": "DATASET/urban_violation_0520",
            "source_structure": "images_with_preannotations",
            "source_file_count": 0,
            "image_count": 505,
            "stage1_file_count": 505,
            "stage2_file_count": 496,
            "stage2_failure_file_count": 8,
        },
        headers=_admin_headers(),
    )
    assert created.status_code == 201
    created_payload = created.json()
    assert created_payload["dataset_id"] == "urban_violation__urban_violation_0520"
    assert created_payload["state"] == "Imported"
    assert created_payload["imported_assets"] == 505
    assert created_payload["stage1_file_count"] == 505
    assert created_payload["stage2_file_count"] == 496
    assert created_payload["stage2_failure_file_count"] == 8
    assert any("stage2_missing" in warning for warning in created_payload["warnings"])

    source_dir = DATASET_0520_PATH.resolve()
    assert source_dir.is_dir()

    _activate_label_config(client)
    generated = client.post(
        "/api/datasets/urban_violation__urban_violation_0520/qc/generate",
        headers=_admin_headers(),
    )
    assert generated.status_code == 200
    payload = generated.json()
    assert payload["dataset_id"] == "urban_violation__urban_violation_0520"
    assert payload["total"] == 505
    assert any(item["stage2_status"] == "failure" for item in payload["items"])


def test_manual_batch_qc_generate_surfaces_hydration_error_details(tmp_path: Path) -> None:
    malformed_root = tmp_path / "malformed_0520"
    (malformed_root / "images").mkdir(parents=True, exist_ok=True)
    (malformed_root / "stage1_run_bad" / "meta").mkdir(parents=True, exist_ok=True)
    (malformed_root / "stage2_run_bad" / "meta").mkdir(parents=True, exist_ok=True)

    (malformed_root / "stage1_run_bad" / "meta" / "manifest.jsonl").write_text(
        '{"id":"sample_a","status":"failed","request_path":"requests/a.json"}\n',
        encoding="utf-8",
    )
    (malformed_root / "stage2_run_bad" / "meta" / "manifest.jsonl").write_text(
        (
            '{"id":"sample_a","input_path":"inputs/a.json","request_path":"requests/a.json",'
            '"response_path":"responses/a.json","parsed_path":"parsed/a.json","record_path":"records/a.json"}\n'
        ),
        encoding="utf-8",
    )

    with TestClient(
        create_app(
            label_config_store_root=tmp_path / "LABEL_CONFIG_STATE",
            platform_state_root=tmp_path / "PLATFORM_STATE",
        )
    ) as scoped_client:
        created = scoped_client.post(
            "/api/datasets/urban_violation/import-jobs",
            json={
                "dataset_type": "urban_violation",
                "batch_key": "bad_hydration",
                "batch_name": "Malformed Hydration",
                "source_mode": "local_directory",
                "source_uri": str(malformed_root),
                "source_structure": "images_with_preannotations",
                "source_file_count": 1,
                "image_count": 1,
                "stage1_file_count": 1,
                "stage2_file_count": 0,
                "stage2_failure_file_count": 0,
            },
            headers=_admin_headers(),
        )
        assert created.status_code == 201
        assert created.json()["dataset_id"] == "urban_violation__bad_hydration"

        generated = scoped_client.post(
            "/api/datasets/urban_violation__bad_hydration/qc/generate",
            headers=_admin_headers(),
        )
        assert generated.status_code == 409
        payload = generated.json()
        assert payload["code"] == "source_not_ingested"
        assert "Batch source hydration failed:" in payload["message"]
        assert "hydration_error" in payload["details"]


def test_manual_batch_registration_persists_across_app_restart(tmp_path: Path) -> None:
    store_root = tmp_path / "LABEL_CONFIG_STATE"
    state_root = tmp_path / "PLATFORM_STATE"
    with TestClient(
        create_app(label_config_store_root=store_root, platform_state_root=state_root)
    ) as first_client:
        created_type = first_client.post(
            "/api/dataset-types",
            json={"dataset_type": "ares_detection", "display_name": "Ares Detection"},
            headers=_admin_headers(),
        )
        assert created_type.status_code == 201
        created_batch = first_client.post(
            "/api/datasets/ares_detection/import-jobs",
            json={
                "dataset_type": "ares_detection",
                "batch_key": "20260518_images",
                "batch_name": "2026-05-18 Images Only",
                "source_mode": "local_directory",
                "source_uri": "DATASET/ares_detection/20260518_images",
                "source_structure": "images_only",
                "source_file_count": 12,
                "image_count": 12,
            },
            headers=_admin_headers(),
        )
        assert created_batch.status_code == 201

    assert (store_root / "dataset_batches.json").is_file()
    with TestClient(
        create_app(label_config_store_root=store_root, platform_state_root=state_root)
    ) as second_client:
        listed = second_client.get("/api/dataset-types")
        assert listed.status_code == 200
        by_type = {item["dataset_type"]: item for item in listed.json()}
        assert by_type["ares_detection"]["batch_count"] == 1
        batch = by_type["ares_detection"]["batches"][0]
        assert batch["dataset_id"] == "ares_detection__20260518_images"
        assert batch["source_structure"] == "images_only"
        assert batch["total_assets"] == 12


def test_new_dataset_type_can_own_label_config_independently(client: TestClient) -> None:
    created = client.post(
        "/api/dataset-types",
        json={"dataset_type": "ares_detection", "display_name": "Ares Detection"},
    )
    assert created.status_code == 201

    ares_config = {
        "schema_version": "label_config_v1",
        "dataset_type": "ares_detection",
        "version": "ares_detection_labels_v1",
        "fields": [
            {
                "field": "target_type",
                "mode": "closed_enum",
                "label_zh": "目标类型",
                "allow_custom": False,
                "options": [{"code": "vehicle", "label_zh": "车辆"}],
            },
            {
                "field": "scene_elements",
                "mode": "open_tags",
                "label_zh": "场景元素",
                "allow_custom": True,
                "options": [],
            },
            {
                "field": "segmentation_targets",
                "mode": "open_tags",
                "label_zh": "分割目标",
                "allow_custom": True,
                "options": [],
            },
        ],
    }
    saved = client.post(
        "/api/datasets/ares_detection/label-configs",
        json={"file_name": "ares_label_config.json", "config": ares_config, "activate": True},
    )
    assert saved.status_code == 200
    saved_payload = saved.json()
    assert saved_payload["dataset_id"] == "ares_detection"
    assert saved_payload["status"] == "active"

    urban_active = client.get(f"/api/datasets/{DATASET_ID}/label-config/active")
    assert urban_active.status_code == 404

    ares_active = client.get("/api/datasets/ares_detection/label-config/active")
    assert ares_active.status_code == 200
    assert ares_active.json()["config"]["dataset_type"] == "ares_detection"


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
    assert payload["version"] == _load_label_config_payload()["version"]
    assert payload["content_hash"].startswith("sha256:")
    assert payload["summary"]["field_count"] >= 8
    assert payload["summary"]["closed_enum_count"] >= 6
    assert payload["summary"]["open_tags_count"] >= 2
    assert payload["summary"]["option_count"] > 0
    assert payload["errors"] == []


def test_dataset_batch_delete_admin_cleans_runtime_state_and_keeps_source_data(tmp_path: Path) -> None:
    state_root = tmp_path / "PLATFORM_STATE"
    with TestClient(
        create_app(
            label_config_store_root=tmp_path / "LABEL_CONFIG_STATE",
            platform_state_root=state_root,
        )
    ) as scoped_client:
        created = scoped_client.post(
            "/api/datasets/urban_violation/import-jobs",
            json={
                "dataset_type": "urban_violation",
                "batch_key": "0520_delete",
                "batch_name": "2026-05-20 Delete Target",
                "source_mode": "local_directory",
                "source_uri": "DATASET/urban",
                "source_structure": "images_with_preannotations",
                "source_file_count": 2393,
                "image_count": 797,
                "stage1_file_count": 797,
                "stage2_file_count": 780,
                "stage2_failure_file_count": 19,
            },
            headers=_admin_headers(),
        )
        assert created.status_code == 201
        batch_id = created.json()["dataset_id"]
        sample_id = "000424_0_1762499124659"
        source_dir = (DATASET_ROOT / "urban").resolve()
        assert source_dir.is_dir()

        _activate_label_config(scoped_client)
        generated = scoped_client.post(f"/api/datasets/{batch_id}/qc/generate", headers=_admin_headers())
        assert generated.status_code == 200

        assigned = scoped_client.post(
            f"/api/datasets/{batch_id}/qc/assignment",
            json={"assignee_user_id": "platform_admin"},
            headers=_admin_headers(),
        )
        assert assigned.status_code == 200

        detail = scoped_client.get(
            f"/api/datasets/{batch_id}/samples/{sample_id}/review",
            headers=_admin_headers(),
        )
        assert detail.status_code == 200
        relation_before = detail.json()["stage1"]["key_relations"][0]

        lease = scoped_client.post(
            f"/api/datasets/{batch_id}/samples/{sample_id}/lease",
            headers=_admin_headers(),
        )
        assert lease.status_code == 200
        lease_id = lease.json()["lease"]["lease_id"]

        submit = scoped_client.post(
            f"/api/datasets/{batch_id}/samples/{sample_id}/label-edits",
            json={
                "task_mode": "label_edit",
                "submit_action": "submit_changes",
                "task_status": "annotation_submitted",
                "lease_id": lease_id,
                "base_revision": 0,
                "operations": [
                    {
                        "scope": "relation:R1",
                        "field": "description",
                        "op": "replace",
                        "before": relation_before["description"],
                        "after": f"{relation_before['description']}#delete",
                    }
                ],
            },
            headers=_admin_headers(),
        )
        assert submit.status_code == 200

        history = scoped_client.get(
            f"/api/datasets/{batch_id}/samples/{sample_id}/label-edits/history",
            headers=_admin_headers(),
        )
        assert history.status_code == 200
        submission_id = history.json()[-1]["submission_id"]

        confirmed = scoped_client.post(
            f"/api/datasets/{batch_id}/samples/{sample_id}/label-edits/{submission_id}/confirm",
            headers=_admin_headers(),
        )
        assert confirmed.status_code == 200

        evaluation = _create_evaluation(
            scoped_client,
            dataset_id=batch_id,
            model_version="delete-target-v1",
            changed_sample_ids=[sample_id],
        )
        assert evaluation["dataset_id"] == batch_id

        qc_dir = state_root / "qc" / batch_id
        assert qc_dir.is_dir()
        assert (qc_dir / "assignment.json").is_file()
        assert (qc_dir / "tasks.json").is_file()
        assert (qc_dir / "leases.json").is_file()
        assert (qc_dir / "submissions").is_dir()
        assert any((qc_dir / "submissions").iterdir())
        assert (qc_dir / "annotation_snapshots.jsonl").is_file()
        assert (qc_dir / "modification_events.jsonl").is_file()
        assert (qc_dir / "evaluations.json").is_file()

        sample_pool_path = state_root / "sample_pool" / "items.json"
        assert sample_pool_path.is_file()
        pool_rows_before = json.loads(sample_pool_path.read_text(encoding="utf-8"))
        assert any(row["dataset_id"] == batch_id for row in pool_rows_before)

        deleted = scoped_client.delete(f"/api/datasets/{batch_id}", headers=_admin_headers())
        assert deleted.status_code == 200
        deleted_payload = deleted.json()
        assert deleted_payload["deleted"] is True
        assert deleted_payload["dataset_id"] == batch_id
        assert deleted_payload["dataset_type"] == "urban_violation"
        assert deleted_payload["batch_key"] == "0520_delete"

        datasets = scoped_client.get("/api/datasets")
        assert datasets.status_code == 200
        dataset_ids = {item["dataset_id"] for item in datasets.json()}
        assert batch_id not in dataset_ids

        dataset_types = scoped_client.get("/api/dataset-types")
        assert dataset_types.status_code == 200
        urban = next(item for item in dataset_types.json() if item["dataset_type"] == "urban_violation")
        assert all(row["dataset_id"] != batch_id for row in urban["batches"])

        summary = scoped_client.get(f"/api/datasets/{batch_id}/summary")
        assert summary.status_code == 404

        assert not qc_dir.exists()
        pool_rows_after = json.loads(sample_pool_path.read_text(encoding="utf-8"))
        assert all(row["dataset_id"] != batch_id for row in pool_rows_after)

        audit = scoped_client.get(
            "/api/audit-events",
            params={"dataset_id": batch_id},
            headers=_admin_headers(),
        )
        assert audit.status_code == 200
        assert any(item["action"] == "dataset_batch.delete" for item in audit.json())
        assert source_dir.is_dir()


def test_dataset_batch_delete_requires_platform_admin_permission(client: TestClient) -> None:
    created = client.post(
        "/api/datasets/urban_violation/import-jobs",
        json={
            "dataset_type": "urban_violation",
            "batch_key": "0520_delete_perm",
            "batch_name": "2026-05-20 Permission Target",
            "source_mode": "local_directory",
            "source_uri": "DATASET/path_not_required_for_delete_permission",
            "source_structure": "images_only",
            "source_file_count": 1,
            "image_count": 1,
        },
        headers=_admin_headers(),
    )
    assert created.status_code == 201
    batch_id = created.json()["dataset_id"]

    for role in ("dataset_admin", "qc_lead", "annotator"):
        denied = client.delete(
            f"/api/datasets/{batch_id}",
            headers=_user_headers(f"{role}_delete", role),
        )
        assert denied.status_code == 403
        assert denied.json()["code"] == "forbidden"

    allowed = client.delete(f"/api/datasets/{batch_id}", headers=_admin_headers())
    assert allowed.status_code == 200
    assert allowed.json()["deleted"] is True


def test_dataset_batch_delete_rejects_fixture_dataset_type_and_missing(client: TestClient) -> None:
    created_type = client.post(
        "/api/dataset-types",
        json={
            "dataset_type": "ares_detection",
            "display_name": "Ares Detection",
            "field_schema_version": "draft",
        },
        headers=_admin_headers(),
    )
    assert created_type.status_code == 201

    fixture_batch = client.delete(f"/api/datasets/{BATCH_DATASET_ID}", headers=_admin_headers())
    assert fixture_batch.status_code == 409
    assert fixture_batch.json()["code"] == "dataset_batch_delete_forbidden"

    dataset_type = client.delete("/api/datasets/ares_detection", headers=_admin_headers())
    assert dataset_type.status_code == 409
    assert dataset_type.json()["code"] == "dataset_batch_delete_forbidden"

    missing = client.delete("/api/datasets/not_existing_batch", headers=_admin_headers())
    assert missing.status_code == 404


def test_save_label_config_without_activate_defaults_to_active(client: TestClient) -> None:
    saved = _save_label_config(client, activate=False)
    assert saved["dataset_id"] == DATASET_ID
    assert saved["status"] == "active"
    assert saved["activated_at"] is not None
    assert saved["validation"]["valid"] is True

    active = client.get(f"/api/datasets/{DATASET_ID}/label-config/active")
    assert active.status_code == 200
    assert active.json()["config_id"] == saved["config_id"]


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

    versions = client.get(f"/api/dataset-types/{DATASET_ID}/label-configs")
    assert versions.status_code == 200
    assert versions.json()[0]["config_id"] == saved["config_id"]

    reload_active = client.post(f"/api/dataset-types/{DATASET_ID}/label-config/active/reload")
    assert reload_active.status_code == 200
    assert reload_active.json()["config_id"] == saved["config_id"]


def test_label_config_save_idempotent_by_default(client: TestClient) -> None:
    first = _save_label_config(client, activate=False)
    second = _save_label_config(client, activate=False)
    assert second["config_id"] == first["config_id"]
    assert second["content_hash"] == first["content_hash"]

    versions = client.get(f"/api/dataset-types/{DATASET_ID}/label-configs")
    assert versions.status_code == 200
    assert len(versions.json()) == 1


def test_label_config_save_duplicate_with_activate_reuses_existing_and_activates(client: TestClient) -> None:
    first = _save_label_config(client, activate=False)
    second = _save_label_config(client, activate=True)
    assert second["config_id"] == first["config_id"]
    assert second["status"] == "active"
    assert second["activated_at"] is not None

    active = client.get(f"/api/datasets/{DATASET_ID}/label-config/active")
    assert active.status_code == 200
    assert active.json()["config_id"] == first["config_id"]

    versions = client.get(f"/api/dataset-types/{DATASET_ID}/label-configs")
    assert versions.status_code == 200
    assert len(versions.json()) == 1


def test_reload_active_does_not_create_new_label_config_version(client: TestClient) -> None:
    saved = _save_label_config(client, activate=True)
    before = client.get(f"/api/dataset-types/{DATASET_ID}/label-configs")
    assert before.status_code == 200
    before_ids = [item["config_id"] for item in before.json()]
    assert saved["config_id"] in before_ids

    reloaded = client.post(f"/api/dataset-types/{DATASET_ID}/label-config/active/reload")
    assert reloaded.status_code == 200
    assert reloaded.json()["config_id"] == saved["config_id"]

    after = client.get(f"/api/dataset-types/{DATASET_ID}/label-configs")
    assert after.status_code == 200
    after_ids = [item["config_id"] for item in after.json()]
    assert after_ids == before_ids


def test_label_config_save_as_new_version_cannot_bypass_same_hash_dedup(client: TestClient) -> None:
    first = _save_label_config(client, activate=False)
    second = _save_label_config(client, activate=False, save_as_new_version=True)
    assert second["config_id"] == first["config_id"]
    assert second["content_hash"] == first["content_hash"]

    versions = client.get(f"/api/dataset-types/{DATASET_ID}/label-configs")
    assert versions.status_code == 200
    assert len(versions.json()) == 1


def test_active_label_config_persists_across_app_restart(tmp_path: Path) -> None:
    store_root = tmp_path / "DATASET"
    with TestClient(create_app(label_config_store_root=store_root)) as first_client:
        saved = first_client.post(
            f"/api/dataset-types/{DATASET_ID}/label-configs",
            json={
                "file_name": LABEL_CONFIG_PATH.name,
                "config": _load_label_config_payload(),
                "activate": True,
            },
        )
        assert saved.status_code == 200
        saved_payload = saved.json()

    active_path = store_root / DATASET_ID / "label_configs" / "active.json"
    registry_path = store_root / DATASET_ID / "label_configs" / "registry.json"
    version_path = (
        store_root
        / DATASET_ID
        / "label_configs"
        / "versions"
        / f"{saved_payload['config_id']}.json"
    )
    assert active_path.is_file()
    assert registry_path.is_file()
    assert version_path.is_file()

    with TestClient(create_app(label_config_store_root=store_root)) as second_client:
        active = second_client.get(f"/api/dataset-types/{DATASET_ID}/label-config/active")
        assert active.status_code == 200
        assert active.json()["config_id"] == saved_payload["config_id"]

        reload_active = second_client.post(
            f"/api/dataset-types/{DATASET_ID}/label-config/active/reload"
        )
        assert reload_active.status_code == 200
        assert reload_active.json()["config_id"] == saved_payload["config_id"]


def test_label_config_save_idempotent_after_app_restart(tmp_path: Path) -> None:
    store_root = tmp_path / "DATASET"
    with TestClient(create_app(label_config_store_root=store_root)) as first_client:
        first = first_client.post(
            f"/api/dataset-types/{DATASET_ID}/label-configs",
            json={
                "file_name": LABEL_CONFIG_PATH.name,
                "config": _load_label_config_payload(),
                "activate": True,
            },
        )
        assert first.status_code == 200
        first_payload = first.json()

    with TestClient(create_app(label_config_store_root=store_root)) as second_client:
        second = second_client.post(
            f"/api/dataset-types/{DATASET_ID}/label-configs",
            json={
                "file_name": LABEL_CONFIG_PATH.name,
                "config": _load_label_config_payload(),
                "activate": False,
            },
        )
        assert second.status_code == 200
        second_payload = second.json()
        assert second_payload["config_id"] == first_payload["config_id"]
        assert second_payload["content_hash"] == first_payload["content_hash"]

        versions = second_client.get(f"/api/dataset-types/{DATASET_ID}/label-configs")
        assert versions.status_code == 200
        assert len(versions.json()) == 1


def test_label_config_same_version_different_content_returns_conflict(client: TestClient) -> None:
    first = _save_label_config(client, activate=True)
    conflict_response = client.post(
        f"/api/datasets/{DATASET_ID}/label-configs",
        json={
            "file_name": LABEL_CONFIG_PATH.name,
            "config": _modified_label_config_payload(version=first["version"]),
            "activate": True,
        },
    )
    assert conflict_response.status_code == 409
    conflict_payload = conflict_response.json()
    assert conflict_payload["code"] == "label_config_version_conflict"

    versions = client.get(f"/api/dataset-types/{DATASET_ID}/label-configs")
    assert versions.status_code == 200
    assert len(versions.json()) == 1
    active = client.get(f"/api/datasets/{DATASET_ID}/label-config/active")
    assert active.status_code == 200
    assert active.json()["config_id"] == first["config_id"]


def test_label_config_new_version_and_new_content_creates_new_active(client: TestClient) -> None:
    first = _save_label_config(client, activate=True)
    second = client.post(
        f"/api/datasets/{DATASET_ID}/label-configs",
        json={
            "file_name": LABEL_CONFIG_PATH.name,
            "config": _modified_label_config_payload(version=_next_label_config_version()),
            "activate": False,
        },
    )
    assert second.status_code == 200
    second_payload = second.json()
    assert second_payload["config_id"] != first["config_id"]
    assert second_payload["status"] == "active"

    versions = client.get(f"/api/dataset-types/{DATASET_ID}/label-configs")
    assert versions.status_code == 200
    by_id = {item["config_id"]: item for item in versions.json()}
    assert set(by_id) == {first["config_id"], second_payload["config_id"]}
    assert by_id[first["config_id"]]["status"] == "archived"
    assert by_id[second_payload["config_id"]]["status"] == "active"


def test_label_config_duplicate_same_hash_store_repair_exposes_single_canonical(tmp_path: Path) -> None:
    store_root = tmp_path / "LABEL_STATE"
    with TestClient(create_app(label_config_store_root=store_root)) as first_client:
        saved = first_client.post(
            f"/api/dataset-types/{DATASET_ID}/label-configs",
            json={
                "file_name": LABEL_CONFIG_PATH.name,
                "config": _load_label_config_payload(),
                "activate": True,
            },
        )
        assert saved.status_code == 200
        saved_payload = saved.json()

    versions_dir = store_root / DATASET_ID / "label_configs" / "versions"
    origin_file = versions_dir / f"{saved_payload['config_id']}.json"
    duplicate_file = versions_dir / "label-config-999.json"
    duplicate_payload = json.loads(origin_file.read_text(encoding="utf-8"))
    duplicate_payload["config_id"] = "label-config-999"
    duplicate_payload["status"] = "draft"
    duplicate_payload["created_at"] = datetime.now(timezone.utc).isoformat()
    duplicate_file.write_text(json.dumps(duplicate_payload, ensure_ascii=False, indent=2), encoding="utf-8")

    active_path = store_root / DATASET_ID / "label_configs" / "active.json"
    active_pointer = json.loads(active_path.read_text(encoding="utf-8"))
    active_pointer["config_id"] = "label-config-999"
    active_path.write_text(json.dumps(active_pointer, ensure_ascii=False, indent=2), encoding="utf-8")

    with TestClient(create_app(label_config_store_root=store_root)) as second_client:
        listed = second_client.get(f"/api/dataset-types/{DATASET_ID}/label-configs")
        assert listed.status_code == 200
        rows = listed.json()
        assert len(rows) == 1
        assert rows[0]["content_hash"] == saved_payload["content_hash"]
        active = second_client.get(f"/api/dataset-types/{DATASET_ID}/label-config/active")
        assert active.status_code == 200
        assert active.json()["config_id"] == rows[0]["config_id"]

    persisted_files = sorted(path.name for path in versions_dir.glob("*.json"))
    assert len(persisted_files) == 1


def test_default_runtime_label_config_root_does_not_fallback_to_dataset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LABEL_CONFIG_STORE_ROOT", raising=False)
    service = build_fixture_service(dataset_root=DEFAULT_DATASET_ROOT, label_config_store_root=None)
    store_root = service._label_config_store_root  # noqa: SLF001 - test inspects runtime wiring
    assert ".runtime/label_config_state" in str(store_root)
    assert "DATASET/urban_violation/label_configs" not in str(store_root)


def test_build_fixture_service_uses_dataset_root_env_when_not_explicit(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("DATASET_ROOT", str(DATASET_0520_PATH))
    service = build_fixture_service(label_config_store_root=tmp_path / "LABEL_CONFIG_STATE")
    assert service._dataset_root == DATASET_0520_PATH.resolve()  # noqa: SLF001 - runtime wiring assertion


def test_build_fixture_service_explicit_dataset_root_overrides_env(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("DATASET_ROOT", str(DATASET_0520_PATH))
    service = build_fixture_service(
        dataset_root=DEFAULT_DATASET_ROOT,
        label_config_store_root=tmp_path / "LABEL_CONFIG_STATE",
    )
    assert service._dataset_root == DEFAULT_DATASET_ROOT.resolve()  # noqa: SLF001 - runtime wiring assertion


def test_build_fixture_service_can_disable_fixture_batch_from_env(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("DATASET_ROOT", str(tmp_path / "missing_dataset"))
    monkeypatch.setenv("PLATFORM_ENABLE_FIXTURE_BATCH", "0")
    service = build_fixture_service(
        label_config_store_root=tmp_path / "LABEL_CONFIG_STATE",
        platform_state_root=tmp_path / "PLATFORM_STATE",
    )

    assert service.list_datasets() == []
    type_detail = service.get_dataset_type(DATASET_ID)
    assert type_detail.batch_count == 0
    assert type_detail.batches == []


def test_create_app_passes_explicit_dataset_root_over_env(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("DATASET_ROOT", str(DATASET_0520_PATH))
    captured_dataset_root: Path | None = None

    original_factory = app_module.build_fixture_service

    def _capturing_factory(*args: Any, **kwargs: Any) -> Any:
        nonlocal captured_dataset_root
        service = original_factory(*args, **kwargs)
        captured_dataset_root = service._dataset_root  # noqa: SLF001 - runtime wiring assertion
        return service

    monkeypatch.setattr(app_module, "build_fixture_service", _capturing_factory)
    create_app(
        dataset_root=DEFAULT_DATASET_ROOT,
        label_config_store_root=tmp_path / "LABEL_CONFIG_STATE",
        platform_state_root=tmp_path / "PLATFORM_STATE",
    )

    assert captured_dataset_root == DEFAULT_DATASET_ROOT.resolve()


def test_create_app_uses_dataset_root_env_when_not_explicit(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("DATASET_ROOT", str(DATASET_0520_PATH))
    captured_dataset_root: Path | None = None

    original_factory = app_module.build_fixture_service

    def _capturing_factory(*args: Any, **kwargs: Any) -> Any:
        nonlocal captured_dataset_root
        service = original_factory(*args, **kwargs)
        captured_dataset_root = service._dataset_root  # noqa: SLF001 - runtime wiring assertion
        return service

    monkeypatch.setattr(app_module, "build_fixture_service", _capturing_factory)
    create_app(
        label_config_store_root=tmp_path / "LABEL_CONFIG_STATE",
        platform_state_root=tmp_path / "PLATFORM_STATE",
    )

    assert captured_dataset_root == DATASET_0520_PATH.resolve()


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
    _create_user(client, "annotator_a")
    _assign_batch(client, "annotator_a")
    lease_id = _acquire_lease(client, "annotator_a")
    payload = _build_valid_label_edit_payload()
    payload["submit_action"] = "save_draft"
    payload["task_status"] = "annotation_draft"
    payload["lease_id"] = lease_id
    payload["base_revision"] = 0

    submit = client.post(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits",
        json=payload,
        headers=_user_headers("annotator_a", "annotator"),
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
    _create_user(client, "annotator_a")
    _assign_batch(client, "annotator_a")
    lease_id = _acquire_lease(client, "annotator_a")
    invalid_payload = _build_valid_label_edit_payload()
    invalid_payload["operations"][1]["after"] = 1.5
    invalid_payload["submit_action"] = "submit_changes"
    invalid_payload["task_status"] = "annotation_submitted"
    invalid_payload["lease_id"] = lease_id
    invalid_payload["base_revision"] = 0

    invalid_submit = client.post(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits",
        json=invalid_payload,
        headers=_user_headers("annotator_a", "annotator"),
    )
    assert invalid_submit.status_code == 422
    invalid_detail = invalid_submit.json()["detail"]
    assert invalid_detail["valid"] is False

    valid_payload = _build_valid_label_edit_payload()
    valid_payload["submit_action"] = "submit_changes"
    valid_payload["task_status"] = "annotation_submitted"
    valid_payload["lease_id"] = lease_id
    valid_payload["base_revision"] = 0
    submit = client.post(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits",
        json=valid_payload,
        headers=_user_headers("annotator_a", "annotator"),
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


def test_session_auth_401_structured_error(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("PLATFORM_AUTH_MODE", "session")
    monkeypatch.setenv("PLATFORM_DEV_ANON", "0")
    with TestClient(
        create_app(
            label_config_store_root=tmp_path / "LABEL_CONFIG_STATE",
            platform_state_root=tmp_path / "PLATFORM_STATE",
        )
    ) as strict_client:
        me = strict_client.get("/api/me")
        assert me.status_code == 401
        payload = me.json()
        assert payload["code"] == "unauthorized"
        assert "message" in payload

        login = strict_client.post(
            "/api/auth/login",
            json={"user_id": "platform_admin", "password": "admin123456"},
        )
        assert login.status_code == 200
        token = login.json()["token"]

        me_ok = strict_client.get("/api/me", headers={"X-Session-Token": token})
        assert me_ok.status_code == 200
        assert me_ok.json()["user_id"] == "platform_admin"


def test_account_me_rbac_audit_boundaries_for_core_roles(client: TestClient) -> None:
    annotator_headers = _user_headers("annotator_account", "annotator")
    annotator_me = client.get("/api/me", headers=annotator_headers)
    assert annotator_me.status_code == 200
    annotator_payload = annotator_me.json()
    assert annotator_payload["user_id"] == "annotator_account"
    assert annotator_payload["roles"][0]["role"] == "annotator"
    assert annotator_payload["roles"][0]["scope_type"] == "platform"
    assert annotator_payload["roles"][0]["scope_id"] == "*"
    assert "label_edit:write" in annotator_payload["permissions"]
    assert "users:manage" not in annotator_payload["permissions"]
    assert "roles:manage" not in annotator_payload["permissions"]
    assert "audit:read" not in annotator_payload["permissions"]
    annotator_catalog = client.get("/api/rbac/catalog", headers=annotator_headers)
    assert annotator_catalog.status_code == 200
    annotator_catalog_payload = annotator_catalog.json()
    role_map = {item["role"]: set(item["permissions"]) for item in annotator_catalog_payload["roles"]}
    expected_roles = {
        "platform_admin",
        "dataset_admin",
        "batch_manager",
        "annotator",
        "qc_lead",
        "auditor",
    }
    assert set(role_map) == expected_roles
    assert {"users:manage", "roles:manage"}.issubset(role_map["platform_admin"])
    assert set(annotator_catalog_payload["scope_types"]) == {
        "platform",
        "dataset_type",
        "dataset_batch",
    }
    assert client.get("/api/users", headers=annotator_headers).status_code == 403
    assert client.get("/api/role-bindings", headers=annotator_headers).status_code == 403
    full_audit = client.get("/api/audit-events", headers=annotator_headers)
    assert full_audit.status_code == 403
    own_audit = client.get(
        "/api/audit-events",
        params={"actor_user_id": "annotator_account"},
        headers=annotator_headers,
    )
    assert own_audit.status_code == 200

    admin_me = client.get("/api/me", headers=_admin_headers())
    assert admin_me.status_code == 200
    admin_permissions = set(admin_me.json()["permissions"])
    assert {"users:manage", "roles:manage", "audit:read"}.issubset(admin_permissions)
    admin_catalog = client.get("/api/rbac/catalog", headers=_admin_headers())
    assert admin_catalog.status_code == 200
    assert client.get("/api/users", headers=_admin_headers()).status_code == 200
    assert client.get("/api/role-bindings", headers=_admin_headers()).status_code == 200
    assert client.get("/api/audit-events", headers=_admin_headers()).status_code == 200

    auditor_headers = _user_headers("auditor_account", "auditor")
    auditor_me = client.get("/api/me", headers=auditor_headers)
    assert auditor_me.status_code == 200
    auditor_payload = auditor_me.json()
    auditor_permissions = set(auditor_payload["permissions"])
    assert auditor_payload["roles"][0]["role"] == "auditor"
    assert auditor_payload["roles"][0]["scope_type"] == "platform"
    assert "audit:read" in auditor_permissions
    assert "users:manage" not in auditor_permissions
    assert "roles:manage" not in auditor_permissions
    assert client.get("/api/audit-events", headers=auditor_headers).status_code == 200
    assert client.get("/api/users", headers=auditor_headers).status_code == 403
    assert client.get("/api/role-bindings", headers=auditor_headers).status_code == 403


def test_users_self_disable_forbidden_for_current_admin(client: TestClient) -> None:
    response = client.patch(
        "/api/users/platform_admin",
        json={"status": "disabled"},
        headers=_admin_headers(),
    )
    assert response.status_code == 409
    payload = response.json()
    assert payload["code"] == "self_disable_forbidden"


def test_role_binding_self_platform_admin_delete_forbidden(client: TestClient) -> None:
    bindings = client.get("/api/role-bindings", headers=_admin_headers())
    assert bindings.status_code == 200
    target = next(
        item
        for item in bindings.json()
        if item["user_id"] == "platform_admin"
        and item["role"] == "platform_admin"
        and item["scope_type"] == "platform"
        and item["scope_id"] == "*"
    )

    deleted = client.delete(
        f"/api/role-bindings/{target['binding_id']}",
        headers=_admin_headers(),
    )
    assert deleted.status_code == 409
    payload = deleted.json()
    assert payload["code"] == "self_binding_delete_forbidden"


def test_role_binding_duplicate_conflict_remains(client: TestClient) -> None:
    _create_user(client, "role_case_user", role="annotator")
    duplicate = client.post(
        "/api/role-bindings",
        json={
            "user_id": "role_case_user",
            "role": "annotator",
            "scope_type": "dataset_batch",
            "scope_id": BATCH_DATASET_ID,
        },
        headers=_admin_headers(),
    )
    assert duplicate.status_code == 409
    payload = duplicate.json()
    assert payload["code"] == "role_binding_conflict"


def test_qc_assignable_users_scoped_permissions_and_active_filter(client: TestClient) -> None:
    _create_user(client, "qc_lead_scope", role="qc_lead")
    _create_user(client, "annotator_active", role="annotator")
    disabled = client.post(
        "/api/users",
        json={
            "user_id": "annotator_disabled",
            "display_name": "annotator_disabled",
            "email": "annotator_disabled@example.local",
            "password": "StrongPassw0rd!",
            "status": "disabled",
        },
        headers=_admin_headers(),
    )
    assert disabled.status_code == 201

    # Scope-aware manager can read assignable users for this concrete batch.
    qc_lead_headers = _user_headers("qc_lead_scope", "qc_lead")
    assignable = client.get(
        f"/api/datasets/{BATCH_DATASET_ID}/qc/assignable-users",
        headers=qc_lead_headers,
    )
    assert assignable.status_code == 200
    rows = assignable.json()
    user_ids = {row["user_id"] for row in rows}
    assert "platform_admin" in user_ids
    assert "annotator_active" in user_ids
    assert "annotator_disabled" not in user_ids

    # Global user-management endpoint remains restricted.
    users_forbidden = client.get("/api/users", headers=qc_lead_headers)
    assert users_forbidden.status_code == 403

    # Assignment can still be performed with selected assignee id.
    assigned = client.post(
        f"/api/datasets/{BATCH_DATASET_ID}/qc/assignment",
        json={"assignee_user_id": "annotator_active"},
        headers=qc_lead_headers,
    )
    assert assigned.status_code == 200
    assert assigned.json()["assignee_user_id"] == "annotator_active"


def test_qc_assignable_users_forbidden_without_assignment_manage(client: TestClient) -> None:
    _create_user(client, "annotator_scope", role="annotator")
    denied = client.get(
        f"/api/datasets/{BATCH_DATASET_ID}/qc/assignable-users",
        headers=_user_headers("annotator_scope", "annotator"),
    )
    assert denied.status_code == 403


def test_batch_assignment_release_accepts_no_body(client: TestClient) -> None:
    _create_user(client, "qc_lead_release", role="qc_lead")
    _create_user(client, "annotator_release", role="annotator")
    qc_lead_headers = _user_headers("qc_lead_release", "qc_lead")

    assigned = client.post(
        f"/api/datasets/{BATCH_DATASET_ID}/qc/assignment",
        json={"assignee_user_id": "annotator_release"},
        headers=qc_lead_headers,
    )
    assert assigned.status_code == 200

    released = client.post(
        f"/api/datasets/{BATCH_DATASET_ID}/qc/assignment/release",
        headers=qc_lead_headers,
    )
    assert released.status_code == 200
    payload = released.json()
    assert payload["status"] == "revoked"


def test_rbac_forbidden_for_annotator_label_config_activate(client: TestClient) -> None:
    _create_user(client, "annotator_a", role="annotator")
    saved = _save_label_config(client, activate=False)
    forbidden_response = client.post(
        f"/api/datasets/{DATASET_ID}/label-configs/{saved['config_id']}/activate",
        headers=_user_headers("annotator_a", "annotator"),
    )
    assert forbidden_response.status_code == 403
    payload = forbidden_response.json()
    assert payload["code"] == "forbidden"


def test_batch_assignment_and_lease_conflict_codes(client: TestClient) -> None:
    _activate_label_config(client)
    _create_user(client, "annotator_a", role="annotator")
    _create_user(client, "annotator_b", role="annotator")
    _assign_batch(client, "annotator_a")

    duplicate_assign = client.post(
        f"/api/datasets/{DATASET_ID}/qc/assignment",
        json={"assignee_user_id": "annotator_b"},
        headers=_admin_headers(),
    )
    assert duplicate_assign.status_code == 409
    assert duplicate_assign.json()["code"] == "batch_assigned_to_other_user"

    lease_a = _acquire_lease(client, "annotator_a")
    lease_b = client.post(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/lease",
        headers=_user_headers("annotator_b", "annotator"),
    )
    assert lease_b.status_code == 409
    assert lease_b.json()["code"] in {"batch_assigned_to_other_user", "lease_owned_by_other_user"}

    wrong_submit = _build_valid_label_edit_payload()
    wrong_submit["submit_action"] = "save_draft"
    wrong_submit["task_status"] = "annotation_draft"
    wrong_submit["lease_id"] = lease_a
    wrong_submit["base_revision"] = 0
    denied = client.post(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits",
        json=wrong_submit,
        headers=_user_headers("annotator_b", "annotator"),
    )
    assert denied.status_code == 409
    assert denied.json()["code"] in {"batch_assigned_to_other_user", "lease_owned_by_other_user"}


def test_platform_admin_can_be_batch_assignee(client: TestClient) -> None:
    response = client.post(
        f"/api/datasets/{DATASET_ID}/qc/assignment",
        json={"assignee_user_id": "platform_admin"},
        headers=_admin_headers(),
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["assignee_user_id"] == "platform_admin"
    assert payload["status"] == "assigned"


def test_private_draft_confirm_return_audit_progress(client: TestClient) -> None:
    _activate_label_config(client)
    _create_user(client, "annotator_a", role="annotator")
    _create_user(client, "qc_lead_a", role="qc_lead")
    _assign_batch(client, "annotator_a")
    lease_id = _acquire_lease(client, "annotator_a")

    draft_payload = _build_valid_label_edit_payload()
    draft_payload["submit_action"] = "save_draft"
    draft_payload["task_status"] = "annotation_draft"
    draft_payload["lease_id"] = lease_id
    draft_payload["base_revision"] = 0
    saved = client.post(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits",
        json=draft_payload,
        headers=_user_headers("annotator_a", "annotator"),
    )
    assert saved.status_code == 200

    my_draft = client.get(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits/my-draft",
        headers=_user_headers("annotator_a", "annotator"),
    )
    assert my_draft.status_code == 200
    assert my_draft.json() is not None

    other_draft = client.get(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits/my-draft",
        headers=_user_headers("qc_lead_a", "qc_lead"),
    )
    assert other_draft.status_code == 200
    assert other_draft.json() is None

    submit_lease = _acquire_lease(client, "annotator_a")
    submit_payload = _build_valid_label_edit_payload()
    submit_payload["submit_action"] = "submit_changes"
    submit_payload["task_status"] = "annotation_submitted"
    submit_payload["lease_id"] = submit_lease
    submit_payload["base_revision"] = 1
    submitted = client.post(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits",
        json=submit_payload,
        headers=_user_headers("annotator_a", "annotator"),
    )
    assert submitted.status_code == 200

    history = client.get(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits/history",
        headers=_user_headers("qc_lead_a", "qc_lead"),
    )
    assert history.status_code == 200
    submission_id = history.json()[-1]["submission_id"]

    confirmed = client.post(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits/{submission_id}/confirm",
        headers=_user_headers("qc_lead_a", "qc_lead"),
    )
    assert confirmed.status_code == 200

    returned = client.post(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits/{submission_id}/return",
        headers=_user_headers("qc_lead_a", "qc_lead"),
    )
    assert returned.status_code == 200

    audit = client.get(
        "/api/audit-events",
        params={"dataset_id": BATCH_DATASET_ID},
        headers=_admin_headers(),
    )
    assert audit.status_code == 200
    actions = {item["action"] for item in audit.json()}
    assert "label_edit.submit" in actions
    assert "label_edit.confirm" in actions

    progress = client.get(
        f"/api/datasets/{DATASET_ID}/qc/progress",
        headers=_admin_headers(),
    )
    assert progress.status_code == 200
    assert progress.json()["dataset_id"] == BATCH_DATASET_ID


def test_batch_draft_get_returns_empty_summary_when_no_saved_entries(client: TestClient) -> None:
    _activate_label_config(client)
    _create_user(client, "annotator_batch_empty", role="annotator")
    _assign_batch(client, "annotator_batch_empty")

    response = client.get(
        f"/api/datasets/{DATASET_ID}/label-edits/my-batch-draft",
        headers=_user_headers("annotator_batch_empty", "annotator"),
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["dataset_id"] == BATCH_DATASET_ID
    assert payload["sample_count"] == 0
    assert payload["dirty_count"] == 0
    assert payload["saved_count"] == 0
    assert payload["validation_error_count"] == 0
    assert payload["entries"] == []


def test_batch_draft_put_saves_multiple_sample_entries(client: TestClient) -> None:
    _activate_label_config(client)
    _create_user(client, "annotator_batch_save", role="annotator")
    _assign_batch(client, "annotator_batch_save")
    lease_a = _acquire_lease(client, "annotator_batch_save", sample_id=SUCCESS_SAMPLE_ID)
    lease_b = _acquire_lease(client, "annotator_batch_save", sample_id=MULTI_CANDIDATE_SAMPLE_ID)

    response = client.put(
        f"/api/datasets/{DATASET_ID}/label-edits/my-batch-draft",
        json={
            "entries": [
                _build_batch_draft_entry(sample_id=SUCCESS_SAMPLE_ID, lease_id=lease_a, base_revision=0),
                _build_batch_draft_entry(sample_id=MULTI_CANDIDATE_SAMPLE_ID, lease_id=lease_b, base_revision=0),
            ]
        },
        headers=_user_headers("annotator_batch_save", "annotator"),
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["sample_count"] == 2
    assert payload["saved_count"] == 2
    assert payload["dirty_count"] == 0
    assert {item["sample_id"] for item in payload["entries"]} == {
        SUCCESS_SAMPLE_ID,
        MULTI_CANDIDATE_SAMPLE_ID,
    }

    check = client.get(
        f"/api/datasets/{DATASET_ID}/label-edits/my-batch-draft",
        headers=_user_headers("annotator_batch_save", "annotator"),
    )
    assert check.status_code == 200
    assert check.json()["sample_count"] == 2


def test_batch_draft_autosave_is_idempotent_for_same_payload(client: TestClient) -> None:
    _activate_label_config(client)
    _create_user(client, "annotator_batch_auto", role="annotator")
    _assign_batch(client, "annotator_batch_auto")
    lease_id = _acquire_lease(client, "annotator_batch_auto", sample_id=SUCCESS_SAMPLE_ID)
    payload = {
        "entries": [
            _build_batch_draft_entry(
                sample_id=SUCCESS_SAMPLE_ID,
                lease_id=lease_id,
                base_revision=0,
                dirty=True,
                saved=False,
            )
        ]
    }

    first = client.post(
        f"/api/datasets/{DATASET_ID}/label-edits/my-batch-draft/autosave",
        json=payload,
        headers=_user_headers("annotator_batch_auto", "annotator"),
    )
    second = client.post(
        f"/api/datasets/{DATASET_ID}/label-edits/my-batch-draft/autosave",
        json=payload,
        headers=_user_headers("annotator_batch_auto", "annotator"),
    )
    assert first.status_code == 200
    assert second.status_code == 200
    first_entry = first.json()["entries"][0]
    second_entry = second.json()["entries"][0]
    assert first_entry["sample_id"] == second_entry["sample_id"] == SUCCESS_SAMPLE_ID
    assert first_entry["draft_id"] == second_entry["draft_id"]
    assert first_entry["dirty"] is False
    assert first_entry["saved"] is True
    assert second_entry["dirty"] is False
    assert second_entry["saved"] is True
    assert second.json()["sample_count"] == 1
    assert second.json()["saved_count"] == 1
    assert second.json()["dirty_count"] == 0

    check = client.get(
        f"/api/datasets/{DATASET_ID}/label-edits/my-batch-draft",
        headers=_user_headers("annotator_batch_auto", "annotator"),
    )
    assert check.status_code == 200
    assert check.json()["saved_count"] == 1
    assert check.json()["dirty_count"] == 0
    assert check.json()["entries"][0]["saved"] is True
    assert check.json()["entries"][0]["dirty"] is False


def test_batch_draft_and_submit_batch_reject_non_assignee(client: TestClient) -> None:
    _activate_label_config(client)
    _create_user(client, "annotator_owner", role="annotator")
    _create_user(client, "annotator_other", role="annotator")
    _assign_batch(client, "annotator_owner")
    lease_id = _acquire_lease(client, "annotator_owner", sample_id=SUCCESS_SAMPLE_ID)

    denied_save = client.put(
        f"/api/datasets/{DATASET_ID}/label-edits/my-batch-draft",
        json={"entries": [_build_batch_draft_entry(sample_id=SUCCESS_SAMPLE_ID, lease_id=lease_id)]},
        headers=_user_headers("annotator_other", "annotator"),
    )
    assert denied_save.status_code == 409
    assert denied_save.json()["code"] == "batch_assigned_to_other_user"

    denied_submit = client.post(
        f"/api/datasets/{DATASET_ID}/label-edits/submit-batch",
        json={"unsaved_dirty_sample_ids": [], "validation_error_sample_ids": []},
        headers=_user_headers("annotator_other", "annotator"),
    )
    assert denied_submit.status_code == 409
    assert denied_submit.json()["code"] == "batch_assigned_to_other_user"


def test_submit_batch_blocked_when_server_validation_fails(client: TestClient) -> None:
    _activate_label_config(client)
    _create_user(client, "annotator_batch_invalid", role="annotator")
    _assign_batch(client, "annotator_batch_invalid")
    lease_id = _acquire_lease(client, "annotator_batch_invalid", sample_id=SUCCESS_SAMPLE_ID)
    invalid_ops = [
        {
            "scope": "candidate:C1",
            "field": "confidence",
            "op": "replace",
            "before": 0.82,
            "after": 1.5,
        }
    ]
    saved = client.put(
        f"/api/datasets/{DATASET_ID}/label-edits/my-batch-draft",
        json={
            "entries": [
                _build_batch_draft_entry(
                    sample_id=SUCCESS_SAMPLE_ID,
                    lease_id=lease_id,
                    base_revision=0,
                    operations=invalid_ops,
                    validation_valid=False,
                )
            ]
        },
        headers=_user_headers("annotator_batch_invalid", "annotator"),
    )
    assert saved.status_code == 200

    blocked = client.post(
        f"/api/datasets/{DATASET_ID}/label-edits/submit-batch",
        json={"unsaved_dirty_sample_ids": [], "validation_error_sample_ids": []},
        headers=_user_headers("annotator_batch_invalid", "annotator"),
    )
    assert blocked.status_code == 409
    payload = blocked.json()
    assert payload["code"] == "batch_submit_blocked_validation_errors"
    assert SUCCESS_SAMPLE_ID in payload["details"]["sample_ids"]


def test_submit_batch_without_active_label_config_returns_non_500(client: TestClient) -> None:
    _create_user(client, "annotator_no_active_cfg", role="annotator")
    _assign_batch(client, "annotator_no_active_cfg")
    lease_id = _acquire_lease(client, "annotator_no_active_cfg", sample_id=SUCCESS_SAMPLE_ID)

    saved = client.put(
        f"/api/datasets/{DATASET_ID}/label-edits/my-batch-draft",
        json={
            "entries": [
                _build_batch_draft_entry(
                    sample_id=SUCCESS_SAMPLE_ID,
                    lease_id=lease_id,
                    base_revision=0,
                )
            ]
        },
        headers=_user_headers("annotator_no_active_cfg", "annotator"),
    )
    assert saved.status_code == 200

    submitted = client.post(
        f"/api/datasets/{DATASET_ID}/label-edits/submit-batch",
        json={"unsaved_dirty_sample_ids": [], "validation_error_sample_ids": [], "notes": None},
        headers=_user_headers("annotator_no_active_cfg", "annotator"),
    )
    assert submitted.status_code == 404
    payload = submitted.json()
    assert "detail" in payload
    assert "Active label config not found" in payload["detail"]


def test_submit_batch_finalizes_assignment_and_multiple_sample_submissions(client: TestClient) -> None:
    _activate_label_config(client)
    _create_user(client, "annotator_batch_submit", role="annotator")
    _create_user(client, "qc_lead_batch_submit", role="qc_lead")
    _assign_batch(client, "annotator_batch_submit")
    lease_a = _acquire_lease(client, "annotator_batch_submit", sample_id=SUCCESS_SAMPLE_ID)
    lease_b = _acquire_lease(client, "annotator_batch_submit", sample_id=MULTI_CANDIDATE_SAMPLE_ID)

    saved = client.put(
        f"/api/datasets/{DATASET_ID}/label-edits/my-batch-draft",
        json={
            "entries": [
                _build_batch_draft_entry(sample_id=SUCCESS_SAMPLE_ID, lease_id=lease_a, base_revision=0),
                _build_batch_draft_entry(sample_id=MULTI_CANDIDATE_SAMPLE_ID, lease_id=lease_b, base_revision=0),
            ]
        },
        headers=_user_headers("annotator_batch_submit", "annotator"),
    )
    assert saved.status_code == 200

    submitted = client.post(
        f"/api/datasets/{DATASET_ID}/label-edits/submit-batch",
        json={"unsaved_dirty_sample_ids": [], "validation_error_sample_ids": []},
        headers=_user_headers("annotator_batch_submit", "annotator"),
    )
    assert submitted.status_code == 200
    submitted_payload = submitted.json()
    assert submitted_payload["submitted"] is True
    assert submitted_payload["status"] == "submitted"
    assert submitted_payload["submitted_sample_count"] == 2
    assert submitted_payload["released_lease_count"] >= 2

    assignment = client.get(
        f"/api/datasets/{DATASET_ID}/qc/assignment",
        headers=_admin_headers(),
    )
    assert assignment.status_code == 200
    assignment_payload = assignment.json()
    assert assignment_payload["status"] == "submitted"
    assert assignment_payload["submitted_at"] is not None

    tasks = client.get(
        f"/api/datasets/{DATASET_ID}/qc/tasks",
        headers=_admin_headers(),
    )
    assert tasks.status_code == 200
    task_by_sample = {item["sample_id"]: item for item in tasks.json()}
    assert task_by_sample[SUCCESS_SAMPLE_ID]["status"] == "submitted"
    assert task_by_sample[MULTI_CANDIDATE_SAMPLE_ID]["status"] == "submitted"
    assert task_by_sample[SUCCESS_SAMPLE_ID]["latest_submission_id"] is not None
    assert task_by_sample[MULTI_CANDIDATE_SAMPLE_ID]["latest_submission_id"] is not None

    qc = client.get(
        f"/api/datasets/{DATASET_ID}/qc",
        headers=_admin_headers(),
    )
    assert qc.status_code == 200
    qc_by_sample = {item["sample_id"]: item for item in qc.json()["items"]}
    assert qc_by_sample[SUCCESS_SAMPLE_ID]["latest_submission"]["submission_id"] == task_by_sample[SUCCESS_SAMPLE_ID]["latest_submission_id"]
    assert qc_by_sample[SUCCESS_SAMPLE_ID]["latest_submission"]["operations"]

    admin_detail = client.get(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/review",
        headers=_admin_headers(),
    )
    assert admin_detail.status_code == 200
    detail_payload = admin_detail.json()
    assert detail_payload["latest_submission"]["submission_id"] == task_by_sample[SUCCESS_SAMPLE_ID]["latest_submission_id"]
    assert detail_payload["latest_submission"]["operations"]
    assert detail_payload["my_draft"] is None

    audit = client.get(
        "/api/audit-events",
        params={"dataset_id": BATCH_DATASET_ID},
        headers=_admin_headers(),
    )
    assert audit.status_code == 200
    actions = [item["action"] for item in audit.json()]
    assert "label_edit.submit_batch" in actions
    assert sum(1 for action in actions if action == "label_edit.submit") >= 2


def test_qc_closed_loop_phase1_snapshots_events_and_stats_are_idempotent(tmp_path: Path) -> None:
    state_root = tmp_path / "PLATFORM_STATE"
    with TestClient(
        create_app(
            label_config_store_root=tmp_path / "LABEL_CONFIG_STATE",
            platform_state_root=state_root,
        )
    ) as client:
        _activate_label_config(client)
        _create_user(client, "annotator_a", role="annotator")
        _create_user(client, "qc_lead_a", role="qc_lead")
        _assign_batch(client, "annotator_a", dataset_id=BATCH_DATASET_ID)
        lease_id = _acquire_lease(
            client,
            "annotator_a",
            sample_id=MULTI_CANDIDATE_SAMPLE_ID,
            dataset_id=BATCH_DATASET_ID,
        )

        detail_response = client.get(
            f"/api/datasets/{BATCH_DATASET_ID}/samples/{MULTI_CANDIDATE_SAMPLE_ID}/review",
            headers=_admin_headers(),
        )
        assert detail_response.status_code == 200
        detail = detail_response.json()
        assert detail["stage2"] is not None
        assert len(detail["stage1"]["key_relations"]) >= 1
        assert len(detail["stage2"]["fact_verifications"]) >= 1
        assert len(detail["stage2"]["candidates"]) >= 2

        relation_before = detail["stage1"]["key_relations"][0]
        verification_before = detail["stage2"]["fact_verifications"][0]
        candidate_one = detail["stage2"]["candidates"][0]
        candidate_two = detail["stage2"]["candidates"][1]

        active_config = client.get(
            f"/api/datasets/{BATCH_DATASET_ID}/label-config/active",
            headers=_admin_headers(),
        )
        assert active_config.status_code == 200
        fields = active_config.json()["config"]["fields"]
        violation_field = next(field for field in fields if field["field"] == "violation_category")
        allowed_categories = [item["code"] for item in violation_field.get("options", [])]
        base_category = candidate_one["violation_category"][0]
        replacement_category = next(
            (item for item in allowed_categories if item != base_category),
            base_category,
        )
        visibility_choices = ["clear", "partial", "tiny", "blurry", "occluded"]
        replacement_visibility = next(
            (item for item in visibility_choices if item != verification_before["visibility_level"]),
            verification_before["visibility_level"],
        )

        bbox_before = relation_before["bbox"]
        shifted_bbox = [bbox_before[0], bbox_before[1], min(1000, bbox_before[2] + 1), bbox_before[3]]
        if shifted_bbox[2] <= shifted_bbox[0]:
            shifted_bbox[0] = max(0, shifted_bbox[0] - 1)
            shifted_bbox[2] = shifted_bbox[0] + 1

        submit_payload = {
            "task_mode": "label_edit",
            "submit_action": "submit_changes",
            "task_status": "annotation_submitted",
            "lease_id": lease_id,
            "base_revision": 0,
            "operations": [
                {
                    "scope": "relation:R1",
                    "field": "description",
                    "op": "replace",
                    "before": relation_before["description"],
                    "after": f"{relation_before['description']}#qc",
                },
                {
                    "scope": "relation:R1",
                    "field": "bbox",
                    "op": "replace",
                    "before": bbox_before,
                    "after": shifted_bbox,
                },
                {
                    "scope": "verification:R1",
                    "field": "visibility_level",
                    "op": "replace",
                    "before": verification_before["visibility_level"],
                    "after": replacement_visibility,
                },
                {
                    "scope": "verification:R1",
                    "field": "bbox_observation",
                    "op": "replace",
                    "before": verification_before["bbox_observation"],
                    "after": f"{verification_before['bbox_observation']}#edit",
                },
                {
                    "scope": "candidate:C1",
                    "field": "violation_category",
                    "op": "replace",
                    "before": candidate_one["violation_category"],
                    "after": [replacement_category],
                },
                {
                    "scope": "candidate:C1",
                    "field": "segmentation_targets",
                    "op": "replace",
                    "before": candidate_one["segmentation_targets"],
                    "after": [*candidate_one["segmentation_targets"], "新增目标"],
                },
                {
                    "scope": "candidate:C2",
                    "field": "candidate",
                    "op": "delete_candidate",
                    "before": candidate_two,
                    "after": None,
                },
                {
                    "scope": "candidate:C99",
                    "field": "candidate",
                    "op": "add_candidate",
                    "before": None,
                    "after": {
                        "violation_category": [replacement_category],
                        "evidence_relation_indices": candidate_two["evidence_relation_indices"],
                        "evidence_reasoning": f"{candidate_two['evidence_reasoning']}#new",
                        "relation_hint": candidate_two["relation_hint"],
                        "segmentation_targets": candidate_two["segmentation_targets"],
                        "confidence": candidate_two["confidence"],
                        "sample_category": candidate_two["sample_category"],
                    },
                },
            ],
        }

        submit = client.post(
            f"/api/datasets/{BATCH_DATASET_ID}/samples/{MULTI_CANDIDATE_SAMPLE_ID}/label-edits",
            json=submit_payload,
            headers=_user_headers("annotator_a", "annotator"),
        )
        assert submit.status_code == 200

        history = client.get(
            f"/api/datasets/{BATCH_DATASET_ID}/samples/{MULTI_CANDIDATE_SAMPLE_ID}/label-edits/history",
            headers=_user_headers("qc_lead_a", "qc_lead"),
        )
        assert history.status_code == 200
        submission_id = history.json()[-1]["submission_id"]

        confirmed = client.post(
            f"/api/datasets/{BATCH_DATASET_ID}/samples/{MULTI_CANDIDATE_SAMPLE_ID}/label-edits/{submission_id}/confirm",
            headers=_user_headers("qc_lead_a", "qc_lead"),
        )
        assert confirmed.status_code == 200

        snapshots = client.get(
            f"/api/datasets/{BATCH_DATASET_ID}/qc/annotation-snapshots",
            params={"sample_id": MULTI_CANDIDATE_SAMPLE_ID},
            headers=_admin_headers(),
        )
        assert snapshots.status_code == 200
        snapshot_payload = snapshots.json()
        assert {item["snapshot_type"] for item in snapshot_payload} >= {"baseline", "confirmed"}
        assert any(item["source_submission_id"] == submission_id for item in snapshot_payload)

        events = client.get(
            f"/api/datasets/{BATCH_DATASET_ID}/qc/modification-events",
            params={"sample_id": MULTI_CANDIDATE_SAMPLE_ID},
            headers=_admin_headers(),
        )
        assert events.status_code == 200
        event_payload = events.json()
        assert len(event_payload) > 0
        assert {item["dataset_id"] for item in event_payload} == {BATCH_DATASET_ID}
        event_types = {item["event_type"] for item in event_payload}
        assert {
            "relation_modify",
            "relation_bbox_adjust",
            "candidate_category_change",
            "candidate_delete",
            "candidate_add",
            "candidate_evidence_edit",
        }.issubset(event_types)

        stats_first = client.get(
            f"/api/datasets/{BATCH_DATASET_ID}/qc/modification-events/stats",
            headers=_admin_headers(),
        )
        assert stats_first.status_code == 200
        stats_payload = stats_first.json()
        assert stats_payload["dataset_id"] == BATCH_DATASET_ID
        assert stats_payload["total_events"] == len(event_payload)
        assert stats_payload["changed_sample_count"] >= 1
        assert any(item["sample_id"] == MULTI_CANDIDATE_SAMPLE_ID for item in stats_payload["changed_samples"])

        stats_second = client.get(
            f"/api/datasets/{BATCH_DATASET_ID}/qc/modification-events/stats",
            headers=_admin_headers(),
        )
        assert stats_second.status_code == 200
        assert stats_second.json()["total_events"] == stats_payload["total_events"]

        reconfirm = client.post(
            f"/api/datasets/{BATCH_DATASET_ID}/samples/{MULTI_CANDIDATE_SAMPLE_ID}/label-edits/{submission_id}/confirm",
            headers=_user_headers("qc_lead_a", "qc_lead"),
        )
        assert reconfirm.status_code == 409
        assert reconfirm.json()["code"] == "submission_not_submitted"

        events_after = client.get(
            f"/api/datasets/{BATCH_DATASET_ID}/qc/modification-events",
            params={"sample_id": MULTI_CANDIDATE_SAMPLE_ID},
            headers=_admin_headers(),
        )
        assert events_after.status_code == 200
        assert len(events_after.json()) == len(event_payload)

        pool_list = client.get(
            "/api/sample-pool",
            params={"dataset_id": BATCH_DATASET_ID},
            headers=_admin_headers(),
        )
        assert pool_list.status_code == 200
        pool_payload = pool_list.json()
        assert pool_payload["total"] == 1
        assert pool_payload["filters"]["dataset_id"] == BATCH_DATASET_ID
        pool_item = pool_payload["items"][0]
        assert pool_item["dataset_id"] == BATCH_DATASET_ID
        assert pool_item["dataset_type"] == DATASET_ID
        assert pool_item["sample_id"] == MULTI_CANDIDATE_SAMPLE_ID
        assert pool_item["source_submission_id"] == submission_id
        assert pool_item["event_count"] == len(event_payload)
        assert pool_item["changed_field_count"] > 0
        assert pool_item["status"] == "active"
        assert set(pool_item["event_types"]).issuperset(event_types)
        assert set(pool_item["attribution_codes"])
        assert pool_item["confirmed_snapshot_id"]

        by_sample = client.get(
            "/api/sample-pool",
            params={"dataset_id": BATCH_DATASET_ID, "sample_id": MULTI_CANDIDATE_SAMPLE_ID},
            headers=_admin_headers(),
        )
        assert by_sample.status_code == 200
        assert by_sample.json()["total"] == 1

        by_event_type = client.get(
            "/api/sample-pool",
            params={"dataset_id": BATCH_DATASET_ID, "event_type": "candidate_add"},
            headers=_admin_headers(),
        )
        assert by_event_type.status_code == 200
        assert by_event_type.json()["total"] == 1

        by_reviewer = client.get(
            "/api/sample-pool",
            params={"dataset_id": BATCH_DATASET_ID, "reviewer_id": "annotator_a"},
            headers=_admin_headers(),
        )
        assert by_reviewer.status_code == 200
        assert by_reviewer.json()["total"] == 1

        stats_pool = client.get("/api/sample-pool/stats", headers=_admin_headers())
        assert stats_pool.status_code == 200
        stats_pool_payload = stats_pool.json()
        assert stats_pool_payload["total_items"] == 1
        assert stats_pool_payload["active_items"] == 1
        assert any(row["dataset_id"] == BATCH_DATASET_ID for row in stats_pool_payload["by_dataset"])
        assert stats_pool_payload["recent_items"][0]["item_id"] == pool_item["item_id"]

        detail_pool = client.get(
            f"/api/sample-pool/items/{pool_item['item_id']}",
            headers=_admin_headers(),
        )
        assert detail_pool.status_code == 200
        detail_pool_payload = detail_pool.json()
        assert detail_pool_payload["item"]["item_id"] == pool_item["item_id"]
        assert detail_pool_payload["item"]["confirmed_snapshot_id"] == pool_item["confirmed_snapshot_id"]
        assert detail_pool_payload["snapshot"] is not None
        assert detail_pool_payload["snapshot"]["snapshot_id"] == pool_item["confirmed_snapshot_id"]
        assert len(detail_pool_payload["events"]) == len(event_payload)

        removed = client.delete(
            f"/api/sample-pool/items/{pool_item['item_id']}",
            headers=_admin_headers(),
        )
        assert removed.status_code == 200
        removed_payload = removed.json()
        assert removed_payload["status"] == "removed"

        active_after_remove = client.get(
            "/api/sample-pool",
            params={"dataset_id": BATCH_DATASET_ID, "status": "active"},
            headers=_admin_headers(),
        )
        assert active_after_remove.status_code == 200
        assert active_after_remove.json()["total"] == 0

        removed_list = client.get(
            "/api/sample-pool",
            params={"dataset_id": BATCH_DATASET_ID, "status": "removed"},
            headers=_admin_headers(),
        )
        assert removed_list.status_code == 200
        assert removed_list.json()["total"] == 1

        reactivated = client.post(
            "/api/sample-pool/items",
            json={
                "dataset_id": BATCH_DATASET_ID,
                "sample_id": MULTI_CANDIDATE_SAMPLE_ID,
                "source_submission_id": submission_id,
                "confirmed_snapshot_id": pool_item["confirmed_snapshot_id"],
            },
            headers=_admin_headers(),
        )
        assert reactivated.status_code == 200
        reactivated_payload = reactivated.json()
        assert reactivated_payload["item_id"] == pool_item["item_id"]
        assert reactivated_payload["status"] == "active"

        reactivated_again = client.post(
            "/api/sample-pool/items",
            json={
                "dataset_id": BATCH_DATASET_ID,
                "sample_id": MULTI_CANDIDATE_SAMPLE_ID,
                "source_submission_id": submission_id,
                "confirmed_snapshot_id": pool_item["confirmed_snapshot_id"],
            },
            headers=_admin_headers(),
        )
        assert reactivated_again.status_code == 200
        assert reactivated_again.json()["item_id"] == pool_item["item_id"]

        final_pool_list = client.get(
            "/api/sample-pool",
            params={"dataset_id": BATCH_DATASET_ID},
            headers=_admin_headers(),
        )
        assert final_pool_list.status_code == 200
        assert final_pool_list.json()["total"] == 1

        batch_state_dir = state_root / "qc" / BATCH_DATASET_ID
        legacy_state_dir = state_root / "qc" / DATASET_ID
        sample_pool_path = state_root / "sample_pool" / "items.json"
        assert (batch_state_dir / "modification_events.jsonl").is_file()
        assert (batch_state_dir / "annotation_snapshots.jsonl").is_file()
        assert sample_pool_path.is_file()
        assert not (legacy_state_dir / "modification_events.jsonl").exists()


def test_qc_confirmation_without_meaningful_events_does_not_enter_sample_pool(tmp_path: Path) -> None:
    state_root = tmp_path / "PLATFORM_STATE"
    with TestClient(
        create_app(
            label_config_store_root=tmp_path / "LABEL_CONFIG_STATE",
            platform_state_root=state_root,
        )
    ) as client:
        _activate_label_config(client)
        _create_user(client, "annotator_a", role="annotator")
        _create_user(client, "qc_lead_a", role="qc_lead")
        _assign_batch(client, "annotator_a", dataset_id=BATCH_DATASET_ID)
        lease_id = _acquire_lease(
            client,
            "annotator_a",
            sample_id=SUCCESS_SAMPLE_ID,
            dataset_id=BATCH_DATASET_ID,
        )

        detail_response = client.get(
            f"/api/datasets/{BATCH_DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/review",
            headers=_admin_headers(),
        )
        assert detail_response.status_code == 200
        relation_before = detail_response.json()["stage1"]["key_relations"][0]

        submit = client.post(
            f"/api/datasets/{BATCH_DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits",
            json={
                "task_mode": "label_edit",
                "submit_action": "submit_changes",
                "task_status": "annotation_submitted",
                "lease_id": lease_id,
                "base_revision": 0,
                "operations": [
                    {
                        "scope": "relation:R1",
                        "field": "description",
                        "op": "replace",
                        "before": relation_before["description"],
                        "after": relation_before["description"],
                    }
                ],
            },
            headers=_user_headers("annotator_a", "annotator"),
        )
        assert submit.status_code == 200

        history = client.get(
            f"/api/datasets/{BATCH_DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits/history",
            headers=_user_headers("qc_lead_a", "qc_lead"),
        )
        assert history.status_code == 200
        submission_id = history.json()[-1]["submission_id"]

        confirmed = client.post(
            f"/api/datasets/{BATCH_DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits/{submission_id}/confirm",
            headers=_user_headers("qc_lead_a", "qc_lead"),
        )
        assert confirmed.status_code == 200

        events = client.get(
            f"/api/datasets/{BATCH_DATASET_ID}/qc/modification-events",
            params={"sample_id": SUCCESS_SAMPLE_ID, "submission_id": submission_id},
            headers=_admin_headers(),
        )
        assert events.status_code == 200
        assert events.json() == []

        pool = client.get(
            "/api/sample-pool",
            params={"dataset_id": BATCH_DATASET_ID, "sample_id": SUCCESS_SAMPLE_ID},
            headers=_admin_headers(),
        )
        assert pool.status_code == 200
        assert pool.json()["total"] == 0

        stats = client.get("/api/sample-pool/stats", headers=_admin_headers())
        assert stats.status_code == 200
        assert stats.json()["total_items"] == 0


def test_qc_closed_loop_phase3_export_job_coco_and_download(tmp_path: Path) -> None:
    state_root = tmp_path / "PLATFORM_STATE"
    with TestClient(
        create_app(
            label_config_store_root=tmp_path / "LABEL_CONFIG_STATE",
            platform_state_root=state_root,
        )
    ) as client:
        _, pool_item = _submit_and_confirm_changed_sample(client, sample_id=MULTI_CANDIDATE_SAMPLE_ID)

        created = client.post(
            "/api/exports",
            json={
                "format": "coco_json",
                "source_type": "correction_sample_pool",
                "filters": {"dataset_id": BATCH_DATASET_ID, "status": "active"},
            },
            headers=_admin_headers(),
        )
        assert created.status_code == 200
        created_payload = created.json()
        assert created_payload["status"] == "completed"
        assert created_payload["format"] == "coco_json"
        assert created_payload["source_type"] == "correction_sample_pool"
        assert created_payload["item_count"] == 1
        assert created_payload["artifact_path"].startswith("exports/artifacts/")
        assert created_payload["artifact_name"].endswith(".coco.json")
        assert created_payload["artifact_size"] > 0
        assert created_payload["artifact_content_type"] == "application/json"
        assert created_payload["created_by"] == "platform_admin"
        assert created_payload["completed_at"] is not None

        artifact_path = state_root / created_payload["artifact_path"]
        assert artifact_path.is_file()
        assert "DATASET" not in str(artifact_path)

        list_all = client.get("/api/exports", headers=_admin_headers())
        assert list_all.status_code == 200
        list_payload = list_all.json()
        assert list_payload["total"] >= 1
        assert any(item["export_id"] == created_payload["export_id"] for item in list_payload["items"])

        list_completed = client.get(
            "/api/exports",
            params={"status": "completed", "source_type": "correction_sample_pool", "format": "coco_json"},
            headers=_admin_headers(),
        )
        assert list_completed.status_code == 200
        assert any(
            item["export_id"] == created_payload["export_id"] for item in list_completed.json()["items"]
        )

        detail = client.get(f"/api/exports/{created_payload['export_id']}", headers=_admin_headers())
        assert detail.status_code == 200
        detail_payload = detail.json()
        assert detail_payload["export_id"] == created_payload["export_id"]
        assert detail_payload["filters"]["dataset_id"] == BATCH_DATASET_ID

        download = client.get(
            f"/api/exports/{created_payload['export_id']}/download",
            headers=_admin_headers(),
        )
        assert download.status_code == 200
        assert download.headers["content-type"].startswith("application/json")
        coco_payload = json.loads(download.content.decode("utf-8"))
        assert set(coco_payload) >= {"info", "images", "annotations", "categories"}
        assert coco_payload["info"]["coordinate_space"] == "quantized_1000"
        assert len(coco_payload["images"]) >= 1
        assert len(coco_payload["categories"]) >= 1
        assert len(coco_payload["annotations"]) >= 1

        image_ids = {item["id"] for item in coco_payload["images"]}
        category_ids = {item["id"] for item in coco_payload["categories"]}
        first_annotation = coco_payload["annotations"][0]
        assert first_annotation["image_id"] in image_ids
        assert first_annotation["category_id"] in category_ids
        assert len(first_annotation["bbox"]) == 4
        assert first_annotation["bbox"][2] > 0
        assert first_annotation["bbox"][3] > 0

        cancelled_completed = client.post(
            f"/api/exports/{created_payload['export_id']}/cancel",
            headers=_admin_headers(),
        )
        assert cancelled_completed.status_code == 409
        assert cancelled_completed.json()["code"] == "export_not_cancellable"

        removed = client.delete(
            f"/api/sample-pool/items/{pool_item['item_id']}",
            headers=_admin_headers(),
        )
        assert removed.status_code == 200
        assert removed.json()["status"] == "removed"

        empty_export = client.post(
            "/api/exports",
            json={
                "format": "coco_json",
                "source_type": "correction_sample_pool",
                "filters": {"dataset_id": BATCH_DATASET_ID, "status": "active"},
            },
            headers=_admin_headers(),
        )
        assert empty_export.status_code == 409
        assert empty_export.json()["code"] == "export_source_empty"


def test_qc_closed_loop_phase3_export_cancel_queued_job(tmp_path: Path) -> None:
    state_root = tmp_path / "PLATFORM_STATE"
    with TestClient(
        create_app(
            label_config_store_root=tmp_path / "LABEL_CONFIG_STATE",
            platform_state_root=state_root,
        )
    ) as client:
        created_at = datetime.now(timezone.utc).isoformat()
        jobs_path = state_root / "exports" / "jobs.json"
        jobs_path.parent.mkdir(parents=True, exist_ok=True)
        jobs_path.write_text(
            json.dumps(
                [
                    {
                        "export_id": "exp_test_cancel_queued",
                        "format": "coco_json",
                        "source_type": "correction_sample_pool",
                        "filters": {"dataset_id": BATCH_DATASET_ID, "status": "active"},
                        "status": "queued",
                        "item_count": 0,
                        "artifact_path": None,
                        "artifact_name": None,
                        "artifact_size": None,
                        "artifact_content_type": None,
                        "created_by": "platform_admin",
                        "created_at": created_at,
                        "started_at": None,
                        "completed_at": None,
                        "cancelled_at": None,
                        "error_message": None,
                    }
                ],
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        cancel = client.post("/api/exports/exp_test_cancel_queued/cancel", headers=_admin_headers())
        assert cancel.status_code == 200
        payload = cancel.json()
        assert payload["status"] == "cancelled"
        assert payload["cancelled_at"] is not None


def test_qc_closed_loop_phase4_evaluation_apis(tmp_path: Path) -> None:
    state_root = tmp_path / "PLATFORM_STATE"
    with TestClient(
        create_app(
            label_config_store_root=tmp_path / "LABEL_CONFIG_STATE",
            platform_state_root=state_root,
        )
    ) as client:
        _create_user(client, "manager_a", role="batch_manager")
        created = _create_evaluation(
            client,
            dataset_id=DATASET_ID,
            model_version="uvp-v1",
            metrics={
                "mAP": 0.72,
                "precision": 0.81,
                "recall": 0.74,
                "f1": 0.77,
                "false_positive_rate": 0.19,
                "hard_sample_hit_rate": 0.66,
            },
            category_metrics={
                "illegal_parking": {"mAP": 0.71, "precision": 0.8, "recall": 0.73, "f1": 0.76},
                "helmet": {"mAP": 0.62, "precision": 0.74, "recall": 0.68, "f1": 0.71},
            },
            changed_sample_ids=[SUCCESS_SAMPLE_ID, MULTI_CANDIDATE_SAMPLE_ID],
            headers=_user_headers("manager_a", "batch_manager"),
        )
        assert created["dataset_id"] == BATCH_DATASET_ID
        assert created["dataset_type"] == DATASET_ID
        assert created["created_by"] == "manager_a"
        assert created["hard_sample_count"] == 2
        assert created["status"] == "completed"

        forbidden_create = client.post(
            f"/api/datasets/{BATCH_DATASET_ID}/evaluations",
            json={"model_version": "uvp-forbidden"},
            headers=_user_headers("annotator_readonly", "annotator"),
        )
        assert forbidden_create.status_code == 403

        created_second = _create_evaluation(
            client,
            dataset_id=BATCH_DATASET_ID,
            model_version="uvp-v2",
            metrics={
                "mAP": 0.78,
                "precision": 0.86,
                "recall": 0.8,
                "f1": 0.83,
                "false_positive_rate": 0.13,
                "hard_sample_hit_rate": 0.81,
            },
            category_metrics={
                "illegal_parking": {"mAP": 0.77, "precision": 0.85, "recall": 0.79, "f1": 0.82},
                "helmet": {"mAP": 0.7, "precision": 0.8, "recall": 0.75, "f1": 0.77},
            },
            changed_sample_ids=[MULTI_CANDIDATE_SAMPLE_ID, FAILURE_SAMPLE_ID],
        )
        assert created_second["dataset_id"] == BATCH_DATASET_ID
        assert created_second["hard_sample_count"] == 2

        listed = client.get(
            f"/api/datasets/{BATCH_DATASET_ID}/evaluations",
            headers=_admin_headers(),
        )
        assert listed.status_code == 200
        listed_payload = listed.json()
        assert len(listed_payload) == 2
        assert {item["evaluation_id"] for item in listed_payload} == {
            created["evaluation_id"],
            created_second["evaluation_id"],
        }

        detail = client.get(
            f"/api/datasets/{BATCH_DATASET_ID}/evaluations/{created['evaluation_id']}",
            headers=_admin_headers(),
        )
        assert detail.status_code == 200
        detail_payload = detail.json()
        assert detail_payload["evaluation_id"] == created["evaluation_id"]
        assert detail_payload["model_version"] == "uvp-v1"

        compared = client.get(
            "/api/evaluations/compare",
            params={"left_id": created["evaluation_id"], "right_id": created_second["evaluation_id"]},
            headers=_admin_headers(),
        )
        assert compared.status_code == 200
        compared_payload = compared.json()
        assert compared_payload["left"]["evaluation_id"] == created["evaluation_id"]
        assert compared_payload["right"]["evaluation_id"] == created_second["evaluation_id"]
        assert compared_payload["metric_delta"]["mAP"] == pytest.approx(0.06)
        assert compared_payload["metric_delta"]["hard_sample_hit_rate"] == pytest.approx(0.15)
        assert compared_payload["changed_samples"]["left_only"] == [SUCCESS_SAMPLE_ID]
        assert compared_payload["changed_samples"]["right_only"] == [FAILURE_SAMPLE_ID]
        assert compared_payload["changed_samples"]["intersection"] == [MULTI_CANDIDATE_SAMPLE_ID]
        assert any(
            row["category"] == "illegal_parking"
            and row["metric_delta"]["mAP"] == pytest.approx(0.06)
            for row in compared_payload["category_deltas"]
        )

        delta_samples = client.get(
            f"/api/evaluations/{created_second['evaluation_id']}/delta-samples",
            headers=_admin_headers(),
        )
        assert delta_samples.status_code == 200
        delta_payload = delta_samples.json()
        assert delta_payload["evaluation_id"] == created_second["evaluation_id"]
        assert delta_payload["dataset_id"] == BATCH_DATASET_ID
        assert delta_payload["total"] == 2
        assert {item["sample_id"] for item in delta_payload["samples"]} == {
            MULTI_CANDIDATE_SAMPLE_ID,
            FAILURE_SAMPLE_ID,
        }
        assert all(item["dataset_id"] == BATCH_DATASET_ID for item in delta_payload["samples"])
        assert all("/review?dataset_id=" in item["review_url"] for item in delta_payload["samples"])

        evaluations_path = state_root / "qc" / BATCH_DATASET_ID / "evaluations.json"
        legacy_path = state_root / "qc" / DATASET_ID / "evaluations.json"
        assert evaluations_path.is_file()
        assert not legacy_path.exists()


def test_qc_closed_loop_phase4_snapshots_diff_and_rollback_disabled(tmp_path: Path) -> None:
    state_root = tmp_path / "PLATFORM_STATE"
    with TestClient(
        create_app(
            label_config_store_root=tmp_path / "LABEL_CONFIG_STATE",
            platform_state_root=state_root,
        )
    ) as client:
        _submit_and_confirm_changed_sample(client, sample_id=MULTI_CANDIDATE_SAMPLE_ID)

        snapshots = client.get(
            f"/api/datasets/{DATASET_ID}/snapshots",
            headers=_admin_headers(),
        )
        assert snapshots.status_code == 200
        snapshot_rows = snapshots.json()
        assert len(snapshot_rows) >= 2
        assert {item["dataset_id"] for item in snapshot_rows} == {BATCH_DATASET_ID}
        sample_snapshots = [item for item in snapshot_rows if item["sample_id"] == MULTI_CANDIDATE_SAMPLE_ID]
        left = next(item for item in sample_snapshots if item["snapshot_type"] == "baseline")
        right = next(item for item in sample_snapshots if item["snapshot_type"] == "confirmed")

        diff = client.get(
            f"/api/datasets/{BATCH_DATASET_ID}/snapshots/diff",
            params={"left_snapshot_id": left["snapshot_id"], "right_snapshot_id": right["snapshot_id"]},
            headers=_admin_headers(),
        )
        assert diff.status_code == 200
        diff_payload = diff.json()
        assert diff_payload["dataset_id"] == BATCH_DATASET_ID
        assert diff_payload["left_snapshot"]["snapshot_id"] == left["snapshot_id"]
        assert diff_payload["right_snapshot"]["snapshot_id"] == right["snapshot_id"]
        assert diff_payload["operation_count"] >= 1
        assert diff_payload["changed_fields"]
        assert any(
            value.startswith("relation:") or value.startswith("verification:")
            for value in diff_payload["changed_relations"]
        )

        rollback_forbidden = client.post(
            f"/api/datasets/{BATCH_DATASET_ID}/snapshots/{right['snapshot_id']}/rollback",
            headers=_user_headers("annotator_a", "annotator"),
        )
        assert rollback_forbidden.status_code == 403

        rollback_disabled = client.post(
            f"/api/datasets/{BATCH_DATASET_ID}/snapshots/{right['snapshot_id']}/rollback",
            headers=_admin_headers(),
        )
        assert rollback_disabled.status_code == 501
        rollback_payload = rollback_disabled.json()
        assert rollback_payload["code"] == "rollback_disabled"
        assert "disabled pending exact restore validation" in rollback_payload["message"]

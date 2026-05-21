from __future__ import annotations

import importlib
import os
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from urban_violation_backend.app import create_app


DATASET_TYPE = "urban_violation"
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
        pytest.skip(
            "DB foundation backend wiring not present on this branch yet "
            "(expected after agent/TASK-019/backend/db-foundation integration)."
        )


def _database_url(tmp_path: Path) -> str:
    return os.environ.get("TEST_DATABASE_URL", f"sqlite+pysqlite:///{tmp_path / 'task019_phase3_api.db'}")


def _session_headers(client: TestClient) -> dict[str, str]:
    login = client.post(
        "/api/auth/login",
        json={"user_id": "platform_admin", "password": "admin123456"},
    )
    assert login.status_code == 200
    return {"X-Session-Token": login.json()["token"]}


def _label_config_payload() -> dict[str, Any]:
    return {
        "schema_version": "2026-05-22",
        "dataset_type": DATASET_TYPE,
        "version": "v-task019",
        "fields": [
            {
                "field": "violation_category",
                "mode": "closed_enum",
                "label_zh": "违规类型",
                "allow_custom": False,
                "options": [{"code": "illegal_parking", "label_zh": "违停", "sort_order": 0}],
            }
        ],
    }


@pytest.fixture
def db_client(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> TestClient:
    _require_db_foundation()
    monkeypatch.setenv("PLATFORM_STATE_BACKEND", "database")
    monkeypatch.setenv("DATABASE_URL", _database_url(tmp_path))
    monkeypatch.setenv("PLATFORM_DB_AUTO_MIGRATE", "1")
    monkeypatch.setenv("PLATFORM_AUTH_MODE", "session")
    monkeypatch.setenv("PLATFORM_DEV_ANON", "0")

    with TestClient(
        create_app(
            label_config_store_root=tmp_path / "label_config_state",
            platform_state_root=tmp_path / "platform_state",
        )
    ) as client:
        yield client


def test_db_mode_admin_bootstrap_and_session_login(db_client: TestClient) -> None:
    login = db_client.post(
        "/api/auth/login",
        json={"user_id": "platform_admin", "password": "admin123456"},
    )
    assert login.status_code == 200
    token = login.json()["token"]

    me = db_client.get("/api/me", headers={"X-Session-Token": token})
    assert me.status_code == 200
    payload = me.json()
    assert payload["user_id"] == "platform_admin"
    assert any(role["role"] == "platform_admin" for role in payload["roles"])


def test_db_mode_label_config_save_list_activate(db_client: TestClient) -> None:
    headers = _session_headers(db_client)
    saved = db_client.post(
        f"/api/datasets/{DATASET_TYPE}/label-configs",
        json={
            "file_name": "label_config.json",
            "config": _label_config_payload(),
            "activate": False,
        },
        headers=headers,
    )
    assert saved.status_code == 200
    config_id = saved.json()["config_id"]

    listed = db_client.get(f"/api/dataset-types/{DATASET_TYPE}/label-configs", headers=headers)
    assert listed.status_code == 200
    listed_payload = listed.json()
    assert isinstance(listed_payload, list)
    assert any(item["config_id"] == config_id for item in listed_payload)

    activated = db_client.post(
        f"/api/datasets/{DATASET_TYPE}/label-configs/{config_id}/activate",
        headers=headers,
    )
    assert activated.status_code == 200

    active = db_client.get(f"/api/datasets/{DATASET_TYPE}/label-config/active", headers=headers)
    assert active.status_code == 200
    assert active.json()["config_id"] == config_id


def test_db_mode_dataset_type_batch_registry_import_job_and_audit(db_client: TestClient) -> None:
    headers = _session_headers(db_client)
    created_type = db_client.post(
        "/api/dataset-types",
        json={"dataset_type": "ares_detection", "display_name": "Ares Detection"},
        headers=headers,
    )
    assert created_type.status_code == 201

    import_job = db_client.post(
        "/api/datasets/ares_detection/import-jobs",
        json={
            "dataset_type": "ares_detection",
            "batch_key": "task019db",
            "batch_name": "TASK-019 DB",
            "source_mode": "local_directory",
            "source_uri": "DATASET/ares_detection/20260518_images",
            "source_structure": "images_only",
            "source_file_count": 2,
            "image_count": 2,
        },
        headers=headers,
    )
    assert import_job.status_code == 201
    dataset_id = import_job.json()["dataset_id"]

    dataset_type_detail = db_client.get("/api/dataset-types/ares_detection", headers=headers)
    assert dataset_type_detail.status_code == 200
    assert dataset_type_detail.json()["batch_count"] >= 1

    audit = db_client.get("/api/audit-events", headers=headers)
    assert audit.status_code == 200
    assert isinstance(audit.json(), list)

    summary = db_client.get(f"/api/datasets/{dataset_id}/summary", headers=headers)
    assert summary.status_code == 200

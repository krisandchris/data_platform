from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from urban_violation_backend.app import create_app

from test_api import BATCH_DATASET_ID, _activate_label_config, _admin_headers


def _require_postgres_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL", "").strip()
    if not url:
        pytest.skip("PostgreSQL smoke test skipped: TEST_DATABASE_URL is not set.")
    if "postgres" not in url.lower():
        pytest.skip("PostgreSQL smoke test skipped: TEST_DATABASE_URL is not a PostgreSQL URL.")
    return url


def _require_redis_url() -> str:
    url = os.environ.get("TEST_REDIS_URL", "").strip()
    if not url:
        pytest.skip("Redis smoke test skipped: TEST_REDIS_URL is not set.")
    return url


def _postgres_client(tmp_path: Path, database_url: str) -> TestClient:
    return TestClient(
        create_app(
            label_config_store_root=tmp_path / "LABEL_CONFIG_STATE",
            platform_state_root=tmp_path / "PLATFORM_STATE",
            platform_state_backend="database",
            database_url=database_url,
            platform_db_auto_migrate=True,
        )
    )


def test_postgres_live_smoke_qc_state_roundtrip(tmp_path: Path) -> None:
    database_url = _require_postgres_url()

    with _postgres_client(tmp_path, database_url) as client:
        health = client.get("/healthz")
        assert health.status_code == 200

        _activate_label_config(client)
        generated = client.post(f"/api/datasets/{BATCH_DATASET_ID}/qc/generate", headers=_admin_headers())
        assert generated.status_code in {200, 409}

        tasks = client.get(f"/api/datasets/{BATCH_DATASET_ID}/qc/tasks", headers=_admin_headers())
        assert tasks.status_code == 200
        task_ids = [row["task_id"] for row in tasks.json()]
        assert len(task_ids) == len(set(task_ids))


def test_redis_live_smoke_runtime_gated(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    database_url = _require_postgres_url()
    redis_url = _require_redis_url()

    monkeypatch.setenv("REDIS_URL", redis_url)
    monkeypatch.setenv("PLATFORM_REDIS_URL", redis_url)
    monkeypatch.setenv("PLATFORM_REDIS_ENABLED", "1")

    with _postgres_client(tmp_path, database_url) as client:
        health = client.get("/healthz")
        assert health.status_code == 200

        jobs = client.get(f"/api/datasets/{BATCH_DATASET_ID}/import-jobs")
        assert jobs.status_code == 200

        progress = client.get(f"/api/datasets/{BATCH_DATASET_ID}/qc/progress", headers=_admin_headers())
        assert progress.status_code == 200
        assert progress.json()["dataset_id"] == BATCH_DATASET_ID

from __future__ import annotations

import importlib
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from urban_violation_backend.app import create_app


REQUIRED_ENV_TOKENS = ("PLATFORM_STATE_BACKEND", "DATABASE_URL")


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


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
    return os.environ.get("TEST_DATABASE_URL", f"sqlite+pysqlite:///{tmp_path / 'task019_phase3.db'}")


def test_db_foundation_env_selection_and_factory_bootstrap(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _require_db_foundation()

    db_url = _database_url(tmp_path)
    monkeypatch.setenv("PLATFORM_STATE_BACKEND", "database")
    monkeypatch.setenv("DATABASE_URL", db_url)

    # Keep migration bootstrap opt-in to avoid changing default file-backed behavior.
    monkeypatch.setenv("PLATFORM_DB_AUTO_MIGRATE", "0")
    service = importlib.import_module("urban_violation_backend.service").build_fixture_service(
        label_config_store_root=tmp_path / "label_config_state",
        platform_state_root=tmp_path / "platform_state",
    )
    assert service is not None


def test_db_foundation_auto_migrate_bootstrap_if_supported(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _require_db_foundation()

    db_url = _database_url(tmp_path)
    monkeypatch.setenv("PLATFORM_STATE_BACKEND", "database")
    monkeypatch.setenv("DATABASE_URL", db_url)
    monkeypatch.setenv("PLATFORM_DB_AUTO_MIGRATE", "1")

    # App startup should succeed on empty DB when auto-migrate support exists.
    with TestClient(
        create_app(
            label_config_store_root=tmp_path / "label_config_state",
            platform_state_root=tmp_path / "platform_state",
        )
    ) as client:
        response = client.get("/api/me")
    assert response.status_code in {200, 401}


def test_db_mode_requires_explicit_test_database_url_for_postgres_checks(tmp_path: Path) -> None:
    _require_db_foundation()

    if "TEST_DATABASE_URL" not in os.environ:
        pytest.skip("PostgreSQL-only checks require TEST_DATABASE_URL; running SQLite-compatible coverage only.")

    assert os.environ["TEST_DATABASE_URL"].strip()
    assert "postgres" in os.environ["TEST_DATABASE_URL"].lower()


def test_file_backed_mode_contracts_remain_default(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.delenv("PLATFORM_STATE_BACKEND", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("PLATFORM_DB_AUTO_MIGRATE", raising=False)

    service = importlib.import_module("urban_violation_backend.service").build_fixture_service(
        label_config_store_root=tmp_path / "label_config_state",
        platform_state_root=tmp_path / "platform_state",
    )
    assert service is not None
    assert (tmp_path / "platform_state").exists()

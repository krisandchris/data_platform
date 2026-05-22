from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from urban_violation_backend.app import create_app

from test_api import (
    BATCH_DATASET_ID,
    SUCCESS_SAMPLE_ID,
    _acquire_lease,
    _activate_label_config,
    _admin_headers,
    _assign_batch,
    _build_valid_label_edit_payload,
    _create_user,
    _user_headers,
)


def _sqlite_database_url(tmp_path: Path, name: str = "task019_phase6_import.db") -> str:
    return f"sqlite+pysqlite:///{(tmp_path / name).resolve()}"


def _json_file_hash(path: Path) -> str:
    if not path.exists():
        return "<missing>"
    return json.dumps(json.loads(path.read_text(encoding="utf-8")), ensure_ascii=False, sort_keys=True)


def _jsonl_file_hash(path: Path) -> str:
    if not path.exists():
        return "<missing>"
    lines = [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    parsed = [json.loads(line) for line in lines]
    return json.dumps(parsed, ensure_ascii=False, sort_keys=True)


def _find_migrate_module() -> str | None:
    candidates = [
        "urban_violation_backend.migrate_state",
        "urban_violation_backend.migration_state",
    ]
    for module_name in candidates:
        if importlib.util.find_spec(module_name) is not None:
            return module_name
    return None


def _require_import_tool() -> str:
    module_name = _find_migrate_module()
    if module_name is None:
        pytest.skip(
            "Phase 6 import module not present yet. Expected module: urban_violation_backend.migrate_state."
        )
    return module_name


def _run_import_command(
    *,
    module_name: str,
    database_url: str,
    platform_state_root: Path,
    label_config_store_root: Path,
    dataset_root: Path,
    report_path: Path,
    dry_run: bool,
) -> tuple[int, str, str]:
    cmd = [
        sys.executable,
        "-m",
        module_name,
        "import-file-state",
        "--platform-state-root",
        str(platform_state_root),
        "--label-config-store-root",
        str(label_config_store_root),
        "--dataset-root",
        str(dataset_root),
        "--report",
        str(report_path),
    ]
    if dry_run:
        cmd.append("--dry-run")

    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    completed = subprocess.run(cmd, env=env, capture_output=True, text=True)
    return completed.returncode, completed.stdout, completed.stderr


def _client(*, label_root: Path, state_root: Path) -> TestClient:
    return TestClient(create_app(label_config_store_root=label_root, platform_state_root=state_root))


def _client_db_mode(*, label_root: Path, state_root: Path, monkeypatch: pytest.MonkeyPatch, database_url: str) -> TestClient:
    monkeypatch.setenv("PLATFORM_STATE_BACKEND", "database")
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("PLATFORM_DB_AUTO_MIGRATE", "1")
    return TestClient(create_app(label_config_store_root=label_root, platform_state_root=state_root))


def _seed_representative_file_state(*, label_root: Path, state_root: Path) -> None:
    with _client(label_root=label_root, state_root=state_root) as client:
        _activate_label_config(client)
        _create_user(client, "annotator_phase6_import", role="annotator")
        _assign_batch(client, "annotator_phase6_import", dataset_id=BATCH_DATASET_ID)

        lease_id = _acquire_lease(client, "annotator_phase6_import", sample_id=SUCCESS_SAMPLE_ID, dataset_id=BATCH_DATASET_ID)
        payload = _build_valid_label_edit_payload()
        payload["submit_action"] = "save_draft"
        payload["task_status"] = "annotation_draft"
        payload["lease_id"] = lease_id
        payload["base_revision"] = 0
        saved = client.post(
            f"/api/datasets/{BATCH_DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits",
            json=payload,
            headers=_user_headers("annotator_phase6_import", "annotator"),
        )
        assert saved.status_code == 200

        listed = client.get(f"/api/datasets/{BATCH_DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/label-edits/history", headers=_admin_headers())
        assert listed.status_code == 200


def _load_report(path: Path) -> dict[str, Any]:
    assert path.is_file(), f"expected report file at {path}"
    return json.loads(path.read_text(encoding="utf-8"))


def _collect_numeric_entries(payload: Any, prefix: str = "") -> list[tuple[str, float]]:
    if isinstance(payload, dict):
        items: list[tuple[str, float]] = []
        for key, value in payload.items():
            child_prefix = f"{prefix}.{key}" if prefix else key
            items.extend(_collect_numeric_entries(value, child_prefix))
        return items
    if isinstance(payload, list):
        items: list[tuple[str, float]] = []
        for idx, value in enumerate(payload):
            child_prefix = f"{prefix}[{idx}]"
            items.extend(_collect_numeric_entries(value, child_prefix))
        return items
    if isinstance(payload, (int, float)):
        return [(prefix, float(payload))]
    return []


def _find_positive_metric(report: dict[str, Any], token: str) -> bool:
    token_lower = token.lower()
    for key_path, value in _collect_numeric_entries(report):
        if token_lower in key_path.lower() and value > 0:
            return True
    return False


def _assert_empty_report(report: dict[str, Any]) -> None:
    numeric_entries = _collect_numeric_entries(report)
    imported_like = [(k, v) for (k, v) in numeric_entries if any(t in k.lower() for t in ("import", "created", "inserted"))]
    assert imported_like, f"no import-like numeric metrics found in report: {json.dumps(report, ensure_ascii=False)}"
    assert all(v == 0 for _, v in imported_like), imported_like


def _assert_conflict_present(report: dict[str, Any]) -> None:
    numeric_entries = _collect_numeric_entries(report)
    conflict_like = [(k, v) for (k, v) in numeric_entries if "conflict" in k.lower()]
    assert conflict_like, f"no conflict metrics found in report: {json.dumps(report, ensure_ascii=False)}"
    assert any(v > 0 for _, v in conflict_like), conflict_like


def test_import_file_state_empty_report(tmp_path: Path) -> None:
    module_name = _require_import_tool()

    platform_state_root = tmp_path / "platform_state_empty"
    label_config_store_root = tmp_path / "label_state_empty"
    dataset_root = tmp_path / "DATASET" / "urban_violation"
    dataset_root.mkdir(parents=True, exist_ok=True)
    report_path = tmp_path / "import-empty-report.json"
    database_url = _sqlite_database_url(tmp_path, "empty.db")

    code, stdout, stderr = _run_import_command(
        module_name=module_name,
        database_url=database_url,
        platform_state_root=platform_state_root,
        label_config_store_root=label_config_store_root,
        dataset_root=dataset_root,
        report_path=report_path,
        dry_run=False,
    )
    assert code == 0, f"stdout={stdout}\nstderr={stderr}"

    report = _load_report(report_path)
    _assert_empty_report(report)


def test_import_file_state_representative_fixture(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    module_name = _require_import_tool()

    file_platform_root = tmp_path / "platform_state_file"
    file_label_root = tmp_path / "label_state_file"
    dataset_root = tmp_path / "DATASET" / "urban_violation"
    dataset_root.mkdir(parents=True, exist_ok=True)
    _seed_representative_file_state(label_root=file_label_root, state_root=file_platform_root)

    database_url = _sqlite_database_url(tmp_path, "fixture.db")
    report_path = tmp_path / "import-fixture-report.json"

    code, stdout, stderr = _run_import_command(
        module_name=module_name,
        database_url=database_url,
        platform_state_root=file_platform_root,
        label_config_store_root=file_label_root,
        dataset_root=dataset_root,
        report_path=report_path,
        dry_run=False,
    )
    assert code == 0, f"stdout={stdout}\nstderr={stderr}"

    report = _load_report(report_path)
    assert _find_positive_metric(report, "user")
    assert _find_positive_metric(report, "role")
    assert _find_positive_metric(report, "draft") or _find_positive_metric(report, "submission")

    with _client_db_mode(
        label_root=file_label_root,
        state_root=file_platform_root,
        monkeypatch=monkeypatch,
        database_url=database_url,
    ) as db_client:
        me = db_client.get("/api/me", headers=_admin_headers())
        assert me.status_code == 200

        assignment = db_client.get(f"/api/datasets/{BATCH_DATASET_ID}/qc/assignment", headers=_admin_headers())
        assert assignment.status_code in {200, 404}


def test_import_file_state_idempotent_repeated_import(tmp_path: Path) -> None:
    module_name = _require_import_tool()

    file_platform_root = tmp_path / "platform_state_file"
    file_label_root = tmp_path / "label_state_file"
    dataset_root = tmp_path / "DATASET" / "urban_violation"
    dataset_root.mkdir(parents=True, exist_ok=True)
    _seed_representative_file_state(label_root=file_label_root, state_root=file_platform_root)

    database_url = _sqlite_database_url(tmp_path, "idempotent.db")
    first_report = tmp_path / "import-first.json"
    second_report = tmp_path / "import-second.json"

    first = _run_import_command(
        module_name=module_name,
        database_url=database_url,
        platform_state_root=file_platform_root,
        label_config_store_root=file_label_root,
        dataset_root=dataset_root,
        report_path=first_report,
        dry_run=False,
    )
    assert first[0] == 0, f"stdout={first[1]}\nstderr={first[2]}"

    second = _run_import_command(
        module_name=module_name,
        database_url=database_url,
        platform_state_root=file_platform_root,
        label_config_store_root=file_label_root,
        dataset_root=dataset_root,
        report_path=second_report,
        dry_run=False,
    )
    assert second[0] == 0, f"stdout={second[1]}\nstderr={second[2]}"

    report2 = _load_report(second_report)
    numeric_entries = _collect_numeric_entries(report2)
    created_like = [(k, v) for (k, v) in numeric_entries if any(t in k.lower() for t in ("created", "inserted", "imported"))]
    assert created_like, f"no created/imported metrics found in report: {json.dumps(report2, ensure_ascii=False)}"
    assert all(v == 0 for _, v in created_like if "same_content" not in _.lower()), created_like


def test_import_file_state_conflict_same_id_different_content_without_overwrite(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module_name = _require_import_tool()

    file_platform_root = tmp_path / "platform_state_file"
    file_label_root = tmp_path / "label_state_file"
    dataset_root = tmp_path / "DATASET" / "urban_violation"
    dataset_root.mkdir(parents=True, exist_ok=True)
    _seed_representative_file_state(label_root=file_label_root, state_root=file_platform_root)

    database_url = _sqlite_database_url(tmp_path, "conflict.db")
    initial_report = tmp_path / "import-initial.json"
    conflict_report = tmp_path / "import-conflict.json"

    first = _run_import_command(
        module_name=module_name,
        database_url=database_url,
        platform_state_root=file_platform_root,
        label_config_store_root=file_label_root,
        dataset_root=dataset_root,
        report_path=initial_report,
        dry_run=False,
    )
    assert first[0] == 0, f"stdout={first[1]}\nstderr={first[2]}"

    users_path = file_platform_root / "users.json"
    users_payload = json.loads(users_path.read_text(encoding="utf-8"))
    for item in users_payload:
        if item.get("user_id") == "annotator_phase6_import":
            item["display_name"] = "Conflicting Display Name"
    users_path.write_text(json.dumps(users_payload, ensure_ascii=False, indent=2), encoding="utf-8")

    second = _run_import_command(
        module_name=module_name,
        database_url=database_url,
        platform_state_root=file_platform_root,
        label_config_store_root=file_label_root,
        dataset_root=dataset_root,
        report_path=conflict_report,
        dry_run=False,
    )
    assert second[0] == 0, f"stdout={second[1]}\nstderr={second[2]}"

    report = _load_report(conflict_report)
    _assert_conflict_present(report)

    with _client_db_mode(
        label_root=file_label_root,
        state_root=file_platform_root,
        monkeypatch=monkeypatch,
        database_url=database_url,
    ) as db_client:
        read_user = db_client.get("/api/users/annotator_phase6_import", headers=_admin_headers())
        assert read_user.status_code == 200
        assert read_user.json()["display_name"] != "Conflicting Display Name"


def test_import_file_state_dry_run_does_not_mutate(tmp_path: Path) -> None:
    module_name = _require_import_tool()

    file_platform_root = tmp_path / "platform_state_file"
    file_label_root = tmp_path / "label_state_file"
    dataset_root = tmp_path / "DATASET" / "urban_violation"
    dataset_root.mkdir(parents=True, exist_ok=True)
    _seed_representative_file_state(label_root=file_label_root, state_root=file_platform_root)

    database_url = _sqlite_database_url(tmp_path, "dryrun.db")
    apply_report = tmp_path / "import-apply.json"
    dry_run_report = tmp_path / "import-dryrun.json"

    applied = _run_import_command(
        module_name=module_name,
        database_url=database_url,
        platform_state_root=file_platform_root,
        label_config_store_root=file_label_root,
        dataset_root=dataset_root,
        report_path=apply_report,
        dry_run=False,
    )
    assert applied[0] == 0, f"stdout={applied[1]}\nstderr={applied[2]}"

    users_before = _json_file_hash(file_platform_root / "users.json")
    audit_before = _jsonl_file_hash(file_platform_root / "audit_events.jsonl")

    dry = _run_import_command(
        module_name=module_name,
        database_url=database_url,
        platform_state_root=file_platform_root,
        label_config_store_root=file_label_root,
        dataset_root=dataset_root,
        report_path=dry_run_report,
        dry_run=True,
    )
    assert dry[0] == 0, f"stdout={dry[1]}\nstderr={dry[2]}"

    users_after = _json_file_hash(file_platform_root / "users.json")
    audit_after = _jsonl_file_hash(file_platform_root / "audit_events.jsonl")
    assert users_before == users_after
    assert audit_before == audit_after


def test_import_file_state_post_import_reads_and_continued_writes(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module_name = _require_import_tool()

    file_platform_root = tmp_path / "platform_state_file"
    file_label_root = tmp_path / "label_state_file"
    dataset_root = tmp_path / "DATASET" / "urban_violation"
    dataset_root.mkdir(parents=True, exist_ok=True)
    _seed_representative_file_state(label_root=file_label_root, state_root=file_platform_root)

    database_url = _sqlite_database_url(tmp_path, "reads-writes.db")
    report_path = tmp_path / "import-reads-writes.json"

    imported = _run_import_command(
        module_name=module_name,
        database_url=database_url,
        platform_state_root=file_platform_root,
        label_config_store_root=file_label_root,
        dataset_root=dataset_root,
        report_path=report_path,
        dry_run=False,
    )
    assert imported[0] == 0, f"stdout={imported[1]}\nstderr={imported[2]}"

    with _client_db_mode(
        label_root=file_label_root,
        state_root=file_platform_root,
        monkeypatch=monkeypatch,
        database_url=database_url,
    ) as db_client:
        users = db_client.get("/api/users", headers=_admin_headers())
        assert users.status_code == 200
        assert any(item["user_id"] == "annotator_phase6_import" for item in users.json())

        create = db_client.post(
            "/api/users",
            json={
                "user_id": "post_import_writer",
                "display_name": "Post Import Writer",
                "roles": [{"role": "annotator"}],
            },
            headers=_admin_headers(),
        )
        assert create.status_code in {200, 201}

        listed = db_client.get("/api/users/post_import_writer", headers=_admin_headers())
        assert listed.status_code == 200
        assert listed.json()["user_id"] == "post_import_writer"

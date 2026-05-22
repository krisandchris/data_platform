"""Focused backend tests for TASK-019 Phase 5 Redis runtime coordination."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

import urban_violation_backend.app as app_module
from urban_violation_backend.app import create_app
from urban_violation_backend.runtime_coordination import (
    RedisRuntimeCoordinator,
    build_runtime_coordinator,
)
from urban_violation_backend.service import build_fixture_service


DATASET_ID = "urban_violation"
BATCH_DATASET_ID = "urban_violation__0508_fixture"
SUCCESS_SAMPLE_ID = "000142_0_1762483003246"


class FakeRedis:
    """Deterministic in-memory Redis subset with TTL support."""

    def __init__(self) -> None:
        self._now = 0
        self._store: dict[str, tuple[str, int | None]] = {}

    def advance(self, seconds: int) -> None:
        self._now += max(0, seconds)

    def set(
        self,
        name: str,
        value: str,
        ex: int | None = None,
        px: int | None = None,
        nx: bool = False,
        xx: bool = False,
    ) -> bool | None:
        self._purge(name)
        exists = name in self._store
        if nx and exists:
            return False
        if xx and not exists:
            return False
        ttl = ex
        if ttl is None and px is not None:
            ttl = max(1, int(px / 1000))
        expires_at = (self._now + int(ttl)) if ttl is not None else None
        self._store[name] = (value, expires_at)
        return True

    def get(self, name: str) -> bytes | None:
        self._purge(name)
        record = self._store.get(name)
        if record is None:
            return None
        return record[0].encode("utf-8")

    def delete(self, *names: str) -> int:
        deleted = 0
        for name in names:
            self._purge(name)
            if name in self._store:
                del self._store[name]
                deleted += 1
        return deleted

    def eval(self, script: str, numkeys: int, *keys_and_args: Any) -> int:
        assert numkeys == 1
        key = str(keys_and_args[0])
        self._purge(key)
        if key not in self._store:
            return 0

        expected = str(keys_and_args[1]) if len(keys_and_args) > 1 else ""
        current_value, expires_at = self._store[key]
        if current_value != expected:
            return 0

        if "EXPIRE" in script:
            ttl = int(keys_and_args[2])
            self._store[key] = (current_value, self._now + ttl)
            return 1
        if "DEL" in script:
            del self._store[key]
            return 1
        if expires_at is None:
            return 0
        return 1

    def scan_iter(self, match: str | None = None, count: int | None = None) -> list[str]:
        for key in list(self._store):
            self._purge(key)
        if match is None:
            return sorted(self._store)
        prefix = match.rstrip("*")
        return sorted([key for key in self._store if key.startswith(prefix)])

    def key_exists(self, key: str) -> bool:
        self._purge(key)
        return key in self._store

    def _purge(self, key: str) -> None:
        record = self._store.get(key)
        if record is None:
            return
        _, expires_at = record
        if expires_at is not None and expires_at <= self._now:
            del self._store[key]


@pytest.fixture
def redis_client() -> FakeRedis:
    return FakeRedis()


@pytest.fixture
def redis_api_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, redis_client: FakeRedis) -> TestClient:
    monkeypatch.setenv("PLATFORM_REDIS_ENABLED", "1")
    monkeypatch.setenv("REDIS_URL", "redis://fake-redis/0")

    original_factory = app_module.build_fixture_service

    def _factory(**kwargs: Any):
        return original_factory(**kwargs, redis_client=redis_client)

    monkeypatch.setattr(app_module, "build_fixture_service", _factory)
    with TestClient(
        create_app(
            label_config_store_root=tmp_path / "LABEL_CONFIG_STATE",
            platform_state_root=tmp_path / "PLATFORM_STATE",
        )
    ) as client:
        yield client


def _admin_headers() -> dict[str, str]:
    return {"X-User-Id": "platform_admin", "X-User-Role": "platform_admin"}


def _user_headers(user_id: str, role: str = "annotator") -> dict[str, str]:
    return {"X-User-Id": user_id, "X-User-Role": role}


def _create_user(client: TestClient, user_id: str, role: str = "annotator") -> None:
    created = client.post(
        "/api/users",
        json={
            "user_id": user_id,
            "display_name": user_id,
            "email": f"{user_id}@example.local",
            "password": "StrongPassw0rd!",
        },
        headers=_admin_headers(),
    )
    assert created.status_code == 201
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


def _assign_batch(client: TestClient, assignee_user_id: str) -> None:
    assigned = client.post(
        f"/api/datasets/{DATASET_ID}/qc/assignment",
        json={"assignee_user_id": assignee_user_id},
        headers=_admin_headers(),
    )
    assert assigned.status_code == 200


def test_runtime_coordinator_owner_checked_lease_and_ttl(redis_client: FakeRedis) -> None:
    coordinator = RedisRuntimeCoordinator(
        client=redis_client,
        lease_ttl_seconds=30,
        lock_ttl_seconds=10,
        import_progress_ttl_seconds=120,
        session_cache_ttl_seconds=60,
    )

    first = coordinator.acquire_sample_lease_lock(
        dataset_id=BATCH_DATASET_ID,
        sample_id=SUCCESS_SAMPLE_ID,
        lease_id="lease-a",
        user_id="annotator_a",
        ttl_seconds=10,
    )
    second = coordinator.acquire_sample_lease_lock(
        dataset_id=BATCH_DATASET_ID,
        sample_id=SUCCESS_SAMPLE_ID,
        lease_id="lease-b",
        user_id="annotator_b",
        ttl_seconds=10,
    )
    assert first is True
    assert second is False

    non_owner_heartbeat = coordinator.heartbeat_sample_lease_lock(
        dataset_id=BATCH_DATASET_ID,
        sample_id=SUCCESS_SAMPLE_ID,
        lease_id="lease-a",
        user_id="annotator_b",
        ttl_seconds=10,
    )
    assert non_owner_heartbeat is False

    owner_heartbeat = coordinator.heartbeat_sample_lease_lock(
        dataset_id=BATCH_DATASET_ID,
        sample_id=SUCCESS_SAMPLE_ID,
        lease_id="lease-a",
        user_id="annotator_a",
        ttl_seconds=10,
    )
    assert owner_heartbeat is True

    non_owner_release = coordinator.release_sample_lease_lock(
        dataset_id=BATCH_DATASET_ID,
        sample_id=SUCCESS_SAMPLE_ID,
        lease_id="lease-a",
        user_id="annotator_b",
    )
    assert non_owner_release is False

    redis_client.advance(11)
    acquired_after_ttl = coordinator.acquire_sample_lease_lock(
        dataset_id=BATCH_DATASET_ID,
        sample_id=SUCCESS_SAMPLE_ID,
        lease_id="lease-b",
        user_id="annotator_b",
        ttl_seconds=10,
    )
    assert acquired_after_ttl is True


def test_service_defaults_to_noop_when_redis_disabled(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PLATFORM_REDIS_ENABLED", raising=False)
    monkeypatch.delenv("REDIS_URL", raising=False)
    service = build_fixture_service(
        label_config_store_root=tmp_path / "label_state",
        platform_state_root=tmp_path / "platform_state",
    )
    assert service._runtime_coordinator.enabled is False  # noqa: SLF001


def test_lease_import_lock_and_progress_with_fake_redis(redis_api_client: TestClient, redis_client: FakeRedis) -> None:
    _create_user(redis_api_client, "annotator_a", role="annotator")
    _create_user(redis_api_client, "annotator_b", role="annotator")
    _assign_batch(redis_api_client, "annotator_a")

    lease = redis_api_client.post(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/lease",
        headers=_user_headers("annotator_a"),
    )
    assert lease.status_code == 200
    lease_id = lease.json()["lease"]["lease_id"]

    lease_key = f"uvp:lease:{BATCH_DATASET_ID}:{SUCCESS_SAMPLE_ID}"
    assert redis_client.key_exists(lease_key)

    heartbeat_denied = redis_api_client.post(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/lease/{lease_id}/heartbeat",
        headers=_user_headers("annotator_b"),
    )
    assert heartbeat_denied.status_code == 409
    assert heartbeat_denied.json()["code"] == "lease_owned_by_other_user"

    heartbeat_ok = redis_api_client.post(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/lease/{lease_id}/heartbeat",
        headers=_user_headers("annotator_a"),
    )
    assert heartbeat_ok.status_code == 200

    release_ok = redis_api_client.post(
        f"/api/datasets/{DATASET_ID}/samples/{SUCCESS_SAMPLE_ID}/lease/{lease_id}/release",
        headers=_user_headers("annotator_a"),
    )
    assert release_ok.status_code == 200
    assert not redis_client.key_exists(lease_key)

    created_job = redis_api_client.post(
        f"/api/datasets/{DATASET_ID}/import-jobs",
        json={"requested_sample_ids": [SUCCESS_SAMPLE_ID]},
    )
    assert created_job.status_code == 201
    created_payload = created_job.json()
    assert created_payload["live_progress"]["stage"] == "create"
    job_id = created_payload["job_id"]

    scan_lock_key = f"uvp:lock:import_job_scan:{BATCH_DATASET_ID}:{job_id}"
    redis_client.set(scan_lock_key, "busy-token", ex=30, nx=True)
    locked_scan = redis_api_client.post(f"/api/datasets/{DATASET_ID}/import-jobs/{job_id}/scan")
    assert locked_scan.status_code == 409
    assert locked_scan.json()["code"] == "import_job_locked"

    redis_client.delete(scan_lock_key)
    scanned = redis_api_client.post(f"/api/datasets/{DATASET_ID}/import-jobs/{job_id}/scan")
    assert scanned.status_code == 200
    assert scanned.json()["live_progress"]["stage"] == "scan"
    assert scanned.json()["live_progress"]["state"] == "completed"

    import_progress_key = f"uvp:import_progress:{BATCH_DATASET_ID}:{job_id}"
    assert redis_client.key_exists(import_progress_key)


def test_qc_queue_generation_uses_distributed_lock(redis_api_client: TestClient, redis_client: FakeRedis) -> None:
    queue_lock = f"uvp:lock:qc_queue_generation:{BATCH_DATASET_ID}:{BATCH_DATASET_ID}"
    redis_client.set(queue_lock, "busy", ex=20, nx=True)
    locked = redis_api_client.post(f"/api/datasets/{DATASET_ID}/qc/generate", headers=_admin_headers())
    assert locked.status_code == 409
    assert locked.json()["code"] == "qc_queue_generation_locked"


def test_session_lookup_cache_roundtrip(redis_api_client: TestClient, redis_client: FakeRedis) -> None:
    login = redis_api_client.post(
        "/api/auth/login",
        json={"user_id": "platform_admin", "password": "admin123456"},
    )
    assert login.status_code == 200
    token = login.json()["token"]

    session_keys = redis_client.scan_iter(match="uvp:session:*")
    assert session_keys

    me = redis_api_client.get("/api/me", headers={"X-Session-Token": token})
    assert me.status_code == 200

    logout = redis_api_client.post("/api/auth/logout", headers={"X-Session-Token": token})
    assert logout.status_code == 200

    # Session cache entry should be removed on logout.
    assert not redis_client.scan_iter(match="uvp:session:*")


def test_real_redis_smoke_if_available() -> None:
    redis_url = os.environ.get("TEST_REDIS_URL")
    if not redis_url:
        pytest.skip("Set TEST_REDIS_URL to run real Redis integration smoke test.")

    coordinator = build_runtime_coordinator(
        redis_enabled=True,
        redis_url=redis_url,
        lease_ttl_seconds=20,
        lock_ttl_seconds=10,
        import_progress_ttl_seconds=60,
        session_cache_ttl_seconds=60,
    )
    assert coordinator.enabled is True

    dataset_id = "redis_runtime_smoke"
    sample_id = "sample-1"
    lease_id = "lease-1"
    user_id = "smoke-user"

    try:
        coordinator.force_release_sample_lease_lock(dataset_id=dataset_id, sample_id=sample_id)
        assert coordinator.acquire_sample_lease_lock(
            dataset_id=dataset_id,
            sample_id=sample_id,
            lease_id=lease_id,
            user_id=user_id,
            ttl_seconds=10,
        )
        assert coordinator.heartbeat_sample_lease_lock(
            dataset_id=dataset_id,
            sample_id=sample_id,
            lease_id=lease_id,
            user_id=user_id,
            ttl_seconds=10,
        )
        assert coordinator.release_sample_lease_lock(
            dataset_id=dataset_id,
            sample_id=sample_id,
            lease_id=lease_id,
            user_id=user_id,
        )
    finally:
        coordinator.force_release_sample_lease_lock(dataset_id=dataset_id, sample_id=sample_id)

"""Redis-backed runtime coordination with safe no-op fallback."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import secrets
from typing import Any, Protocol

from redis import Redis
from redis.exceptions import RedisError

from urban_violation_backend.schemas import AuthSession


LEASE_VALUE_VERSION = 1

_LEASE_REFRESH_SCRIPT = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
end
return 0
""".strip()

_LEASE_RELEASE_SCRIPT = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
""".strip()

_LOCK_RELEASE_SCRIPT = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
""".strip()


class RedisClientProtocol(Protocol):
    """Minimal Redis client surface used by runtime coordination."""

    def set(
        self,
        name: str,
        value: str,
        ex: int | None = None,
        px: int | None = None,
        nx: bool = False,
        xx: bool = False,
    ) -> Any: ...

    def get(self, name: str) -> Any: ...

    def delete(self, *names: str) -> int: ...

    def eval(self, script: str, numkeys: int, *keys_and_args: Any) -> Any: ...

    def scan_iter(self, match: str | None = None, count: int | None = None) -> Any: ...


class SessionLookupCacheProtocol(Protocol):
    """Optional fast-path cache for token-to-session lookups."""

    def get_session(self, token: str) -> AuthSession | None: ...

    def set_session(self, session: AuthSession) -> None: ...

    def invalidate_session(self, token: str) -> None: ...


class RuntimeCoordinatorProtocol(SessionLookupCacheProtocol, Protocol):
    """Runtime coordination operations shared by service and auth layers."""

    @property
    def enabled(self) -> bool: ...

    def acquire_sample_lease_lock(
        self,
        *,
        dataset_id: str,
        sample_id: str,
        lease_id: str,
        user_id: str,
        ttl_seconds: int,
    ) -> bool: ...

    def heartbeat_sample_lease_lock(
        self,
        *,
        dataset_id: str,
        sample_id: str,
        lease_id: str,
        user_id: str,
        ttl_seconds: int,
    ) -> bool: ...

    def release_sample_lease_lock(
        self,
        *,
        dataset_id: str,
        sample_id: str,
        lease_id: str,
        user_id: str,
    ) -> bool: ...

    def force_release_sample_lease_lock(self, *, dataset_id: str, sample_id: str) -> None: ...

    def try_acquire_lock(
        self,
        *,
        scope: str,
        dataset_id: str,
        resource_id: str,
        ttl_seconds: int,
    ) -> "RuntimeLock | None": ...

    def set_import_progress(
        self,
        *,
        dataset_id: str,
        job_id: str,
        stage: str,
        state: str,
        current: int,
        total: int,
        message: str,
    ) -> None: ...

    def get_import_progress(self, *, dataset_id: str, job_id: str) -> dict[str, Any] | None: ...

    def clear_import_progress(self, *, dataset_id: str, job_id: str) -> None: ...


@dataclass(slots=True)
class RuntimeLock:
    """Best-effort lock handle released by value-checked Redis script."""

    coordinator: "RedisRuntimeCoordinator"
    key: str
    owner_token: str
    _released: bool = False

    def release(self) -> None:
        if self._released:
            return
        self._released = True
        self.coordinator._release_lock_by_token(key=self.key, owner_token=self.owner_token)

    def __enter__(self) -> "RuntimeLock":
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> bool:
        self.release()
        return False


class NoopRuntimeCoordinator(RuntimeCoordinatorProtocol):
    """Fallback coordinator preserving file/database-only behavior."""

    @property
    def enabled(self) -> bool:
        return False

    def acquire_sample_lease_lock(
        self,
        *,
        dataset_id: str,
        sample_id: str,
        lease_id: str,
        user_id: str,
        ttl_seconds: int,
    ) -> bool:
        return True

    def heartbeat_sample_lease_lock(
        self,
        *,
        dataset_id: str,
        sample_id: str,
        lease_id: str,
        user_id: str,
        ttl_seconds: int,
    ) -> bool:
        return True

    def release_sample_lease_lock(
        self,
        *,
        dataset_id: str,
        sample_id: str,
        lease_id: str,
        user_id: str,
    ) -> bool:
        return True

    def force_release_sample_lease_lock(self, *, dataset_id: str, sample_id: str) -> None:
        return None

    def try_acquire_lock(
        self,
        *,
        scope: str,
        dataset_id: str,
        resource_id: str,
        ttl_seconds: int,
    ) -> RuntimeLock:
        return RuntimeLock(coordinator=RedisRuntimeCoordinator.disabled(), key="", owner_token="")

    def set_import_progress(
        self,
        *,
        dataset_id: str,
        job_id: str,
        stage: str,
        state: str,
        current: int,
        total: int,
        message: str,
    ) -> None:
        return None

    def get_import_progress(self, *, dataset_id: str, job_id: str) -> dict[str, Any] | None:
        return None

    def clear_import_progress(self, *, dataset_id: str, job_id: str) -> None:
        return None

    def get_session(self, token: str) -> AuthSession | None:
        return None

    def set_session(self, session: AuthSession) -> None:
        return None

    def invalidate_session(self, token: str) -> None:
        return None


class RedisRuntimeCoordinator(RuntimeCoordinatorProtocol):
    """Redis-backed coordination for leases, locks, import progress, and session cache."""

    def __init__(
        self,
        *,
        client: RedisClientProtocol,
        lease_ttl_seconds: int,
        lock_ttl_seconds: int,
        import_progress_ttl_seconds: int,
        session_cache_ttl_seconds: int,
    ) -> None:
        self._client = client
        self._lease_ttl_seconds = lease_ttl_seconds
        self._lock_ttl_seconds = lock_ttl_seconds
        self._import_progress_ttl_seconds = import_progress_ttl_seconds
        self._session_cache_ttl_seconds = session_cache_ttl_seconds

    @classmethod
    def disabled(cls) -> "RedisRuntimeCoordinator":
        return cls(
            client=_NullRedisClient(),
            lease_ttl_seconds=600,
            lock_ttl_seconds=120,
            import_progress_ttl_seconds=1800,
            session_cache_ttl_seconds=300,
        )

    @property
    def enabled(self) -> bool:
        return not isinstance(self._client, _NullRedisClient)

    def acquire_sample_lease_lock(
        self,
        *,
        dataset_id: str,
        sample_id: str,
        lease_id: str,
        user_id: str,
        ttl_seconds: int,
    ) -> bool:
        if not self.enabled:
            return True
        key = self._lease_key(dataset_id=dataset_id, sample_id=sample_id)
        payload = self._lease_payload(lease_id=lease_id, user_id=user_id)
        try:
            return bool(self._client.set(key, payload, ex=max(5, ttl_seconds), nx=True))
        except RedisError:
            return False

    def heartbeat_sample_lease_lock(
        self,
        *,
        dataset_id: str,
        sample_id: str,
        lease_id: str,
        user_id: str,
        ttl_seconds: int,
    ) -> bool:
        if not self.enabled:
            return True
        key = self._lease_key(dataset_id=dataset_id, sample_id=sample_id)
        payload = self._lease_payload(lease_id=lease_id, user_id=user_id)
        try:
            result = self._client.eval(_LEASE_REFRESH_SCRIPT, 1, key, payload, max(5, ttl_seconds))
        except RedisError:
            return False
        return bool(result)

    def release_sample_lease_lock(
        self,
        *,
        dataset_id: str,
        sample_id: str,
        lease_id: str,
        user_id: str,
    ) -> bool:
        if not self.enabled:
            return True
        key = self._lease_key(dataset_id=dataset_id, sample_id=sample_id)
        payload = self._lease_payload(lease_id=lease_id, user_id=user_id)
        try:
            result = self._client.eval(_LEASE_RELEASE_SCRIPT, 1, key, payload)
        except RedisError:
            return False
        return bool(result)

    def force_release_sample_lease_lock(self, *, dataset_id: str, sample_id: str) -> None:
        if not self.enabled:
            return
        key = self._lease_key(dataset_id=dataset_id, sample_id=sample_id)
        try:
            self._client.delete(key)
        except RedisError:
            return

    def try_acquire_lock(
        self,
        *,
        scope: str,
        dataset_id: str,
        resource_id: str,
        ttl_seconds: int,
    ) -> RuntimeLock | None:
        if not self.enabled:
            return RuntimeLock(coordinator=self, key="", owner_token="")
        key = self._lock_key(scope=scope, dataset_id=dataset_id, resource_id=resource_id)
        owner_token = secrets.token_urlsafe(24)
        try:
            acquired = bool(self._client.set(key, owner_token, ex=max(5, ttl_seconds), nx=True))
        except RedisError:
            return None
        if not acquired:
            return None
        return RuntimeLock(coordinator=self, key=key, owner_token=owner_token)

    def _release_lock_by_token(self, *, key: str, owner_token: str) -> None:
        if not self.enabled or not key:
            return
        try:
            self._client.eval(_LOCK_RELEASE_SCRIPT, 1, key, owner_token)
        except RedisError:
            return

    def set_import_progress(
        self,
        *,
        dataset_id: str,
        job_id: str,
        stage: str,
        state: str,
        current: int,
        total: int,
        message: str,
    ) -> None:
        if not self.enabled:
            return
        payload = {
            "stage": stage,
            "state": state,
            "current": max(0, int(current)),
            "total": max(0, int(total)),
            "message": message,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            self._client.set(
                self._import_progress_key(dataset_id=dataset_id, job_id=job_id),
                json.dumps(payload, ensure_ascii=False, sort_keys=True),
                ex=self._import_progress_ttl_seconds,
            )
        except RedisError:
            return

    def get_import_progress(self, *, dataset_id: str, job_id: str) -> dict[str, Any] | None:
        if not self.enabled:
            return None
        try:
            raw = self._client.get(self._import_progress_key(dataset_id=dataset_id, job_id=job_id))
        except RedisError:
            return None
        if raw is None:
            return None
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8", errors="ignore")
        try:
            payload = json.loads(raw)
        except (TypeError, json.JSONDecodeError):
            return None
        if not isinstance(payload, dict):
            return None
        return payload

    def clear_import_progress(self, *, dataset_id: str, job_id: str) -> None:
        if not self.enabled:
            return
        try:
            self._client.delete(self._import_progress_key(dataset_id=dataset_id, job_id=job_id))
        except RedisError:
            return

    def get_session(self, token: str) -> AuthSession | None:
        if not self.enabled:
            return None
        try:
            raw = self._client.get(self._session_cache_key(token))
        except RedisError:
            return None
        if raw is None:
            return None
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8", errors="ignore")
        try:
            payload = json.loads(raw)
            if not isinstance(payload, dict):
                return None
            return AuthSession.model_validate(payload)
        except (ValueError, json.JSONDecodeError, TypeError):
            return None

    def set_session(self, session: AuthSession) -> None:
        if not self.enabled:
            return
        now = datetime.now(timezone.utc)
        ttl = int((session.expires_at - now).total_seconds())
        if ttl <= 0:
            return
        ttl = min(ttl, self._session_cache_ttl_seconds)
        if ttl <= 0:
            return
        try:
            self._client.set(
                self._session_cache_key(session.token),
                json.dumps(session.model_dump(mode="json"), ensure_ascii=False, sort_keys=True),
                ex=ttl,
            )
        except RedisError:
            return

    def invalidate_session(self, token: str) -> None:
        if not self.enabled:
            return
        try:
            self._client.delete(self._session_cache_key(token))
        except RedisError:
            return

    def _lease_key(self, *, dataset_id: str, sample_id: str) -> str:
        return f"uvp:lease:{dataset_id}:{sample_id}"

    def _import_progress_key(self, *, dataset_id: str, job_id: str) -> str:
        return f"uvp:import_progress:{dataset_id}:{job_id}"

    def _lock_key(self, *, scope: str, dataset_id: str, resource_id: str) -> str:
        return f"uvp:lock:{scope}:{dataset_id}:{resource_id}"

    @staticmethod
    def _lease_payload(*, lease_id: str, user_id: str) -> str:
        return json.dumps(
            {
                "version": LEASE_VALUE_VERSION,
                "lease_id": lease_id,
                "user_id": user_id,
            },
            ensure_ascii=False,
            sort_keys=True,
        )

    @staticmethod
    def _session_cache_key(token: str) -> str:
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        return f"uvp:session:{token_hash}"


def build_runtime_coordinator(
    *,
    redis_enabled: bool,
    redis_url: str | None,
    lease_ttl_seconds: int,
    lock_ttl_seconds: int,
    import_progress_ttl_seconds: int,
    session_cache_ttl_seconds: int,
    redis_client: RedisClientProtocol | None = None,
) -> RuntimeCoordinatorProtocol:
    """Build a Redis-backed coordinator with fail-safe no-op fallback."""
    if not redis_enabled or not redis_url:
        return NoopRuntimeCoordinator()
    client = redis_client or Redis.from_url(redis_url, decode_responses=False)
    return RedisRuntimeCoordinator(
        client=client,
        lease_ttl_seconds=lease_ttl_seconds,
        lock_ttl_seconds=lock_ttl_seconds,
        import_progress_ttl_seconds=import_progress_ttl_seconds,
        session_cache_ttl_seconds=session_cache_ttl_seconds,
    )


class _NullRedisClient:
    """Local stub used by disabled lock handles."""

    def set(
        self,
        name: str,
        value: str,
        ex: int | None = None,
        px: int | None = None,
        nx: bool = False,
        xx: bool = False,
    ) -> None:
        return None

    def get(self, name: str) -> None:
        return None

    def delete(self, *names: str) -> int:
        return 0

    def eval(self, script: str, numkeys: int, *keys_and_args: Any) -> int:
        return 0

    def scan_iter(self, match: str | None = None, count: int | None = None) -> list[str]:
        return []

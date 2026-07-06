"""Single-process runtime coordination for the offline workbench."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from urban_violation_backend.schemas import AuthSession


class RedisClientProtocol(Protocol):
    """Compatibility placeholder for older factory signatures."""


class SessionLookupCacheProtocol(Protocol):
    """Optional token-to-session cache interface used by auth."""

    def get_session(self, token: str) -> AuthSession | None: ...

    def set_session(self, session: AuthSession) -> None: ...

    def invalidate_session(self, token: str) -> None: ...


class RuntimeCoordinatorProtocol(SessionLookupCacheProtocol, Protocol):
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
    """No-op context manager matching the old lock handle API."""

    def release(self) -> None:
        return None

    def __enter__(self) -> "RuntimeLock":
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> bool:
        return False


class NoopRuntimeCoordinator(RuntimeCoordinatorProtocol):
    """Offline coordinator; process-local service state is authoritative."""

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
    ) -> RuntimeLock | None:
        return RuntimeLock()

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


def build_runtime_coordinator(**_: Any) -> RuntimeCoordinatorProtocol:
    """Return the offline no-op coordinator."""
    return NoopRuntimeCoordinator()

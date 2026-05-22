# TASK-019 Phase 5 Backend Plan

## Goal

Add Redis-backed runtime coordination for active sample leases, distributed locks, session lookup cache, and live import progress while keeping PostgreSQL as the durable authority and preserving file-backed defaults when Redis is disabled.

## Role

Backend Agent

## Branch

`agent/TASK-019/backend/redis-runtime`

## Worktree

`/mnt/lc/LC/ares_xtws/0_train_data/_worktrees/data_platform/TASK-019-backend-redis-runtime`

## Assigned Scope

- `pyproject.toml`
- `uv.lock`
- `src/urban_violation_backend/db/settings.py`
- `src/urban_violation_backend/service.py`
- `src/urban_violation_backend/api_schemas.py`
- New backend Redis/runtime coordination modules under `src/urban_violation_backend/**`
- Focused backend tests under `tests/test_redis_runtime_backend.py` or similar
- `.agent/**`

## Dependency Approval

Lead Agent approves adding exactly one Python runtime dependency for Redis support through `uv add`: `redis`.

Do not add other dependencies without documenting a dependency request in `.agent/findings.md`.

## Out Of Scope

- Frontend product UI implementation
- Docker default switch to Redis-required deployment
- File-state import tool
- Storing drafts, submissions, audit, label config, users, roles, dataset metadata, or import final state in Redis
- Raw dataset files, uploaded archives, media bytes, or export artifact bytes

## Planned Steps

1. Inspect Phase 4 service lease/import/QC queue methods and database settings.
2. Add Redis runtime settings:
   - `REDIS_URL`
   - `PLATFORM_REDIS_ENABLED=0|1`
   - conservative TTL defaults for leases, locks, progress, and session cache.
3. Add Redis runtime coordinator with disabled/no-op fallback.
4. Implement active sample lease coordination with Redis atomic `SET NX EX`, owner-checked heartbeat, and owner-checked release.
5. Keep PostgreSQL/file store lease history as durable audit/history authority.
6. Add Redis locks for QC queue generation and import job scan/validate/confirm/retry operations.
7. Add live import progress storage and optional progress data on import job detail/list responses.
8. Add optional session lookup cache only as cache backed by `PlatformStateStore`.
9. Add focused backend tests for enabled/disabled behavior using a deterministic fake Redis client and gated real Redis when `TEST_REDIS_URL` is set.
10. Update `.agent/progress.md` and complete `.agent/handoff.md`; commit changes.

## Acceptance Criteria

- Redis disabled path preserves all Phase 4 behavior and tests.
- Redis enabled path allows only one active lease owner per sample across service instances.
- Heartbeat and release verify owner identity atomically.
- Redis lock prevents duplicate QC queue generation/import execution under concurrency.
- Redis loss/flush does not remove drafts, submissions, label configs, audit, batch metadata, or import final state.
- Import job responses can include optional live progress, and missing progress falls back cleanly.

## Expected Checks

- `uv sync`
- `uv run pytest tests/test_redis_runtime_backend.py -q`
- `uv run pytest -k "redis_runtime or db_qc_state or db_foundation or state_store_contract" -q`
- `uv run pytest -q`
- If Redis is available: `TEST_REDIS_URL=redis://127.0.0.1:<port>/0 uv run pytest -k redis_runtime -q`


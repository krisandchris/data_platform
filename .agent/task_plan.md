# TASK-019 Phase 4 Backend Plan

## Goal

Move authoritative QC, draft, submission, snapshot, sample pool, export, and evaluation state into PostgreSQL database mode while preserving file-backed default behavior and existing API response contracts.

## Role

Backend Agent

## Branch

`agent/TASK-019/backend/qc-state`

## Worktree

`/mnt/lc/LC/ares_xtws/0_train_data/_worktrees/data_platform/TASK-019-backend-qc-state`

## Assigned Scope

- `src/urban_violation_backend/db/**`
- `alembic/**`
- `src/urban_violation_backend/state_store.py`
- `src/urban_violation_backend/service.py`, only for store wiring or transactional state transitions needed by database mode
- Backend focused tests such as `tests/test_db_qc_state_backend.py`

## Out Of Scope

- Frontend product code
- Redis runtime behavior
- File-state import CLI
- Docker default switch to database mode
- Raw `DATASET/`, uploaded archives, extracted source trees, media bytes, and export artifact file storage

## Planned Steps

1. Inspect `PlatformStateStoreProtocol`, file-backed store behavior, and Phase 3 `DatabaseBackedPlatformStateStore`.
2. Add Alembic schema coverage for assignments, task records, lease history, drafts, batch drafts, submissions, annotation snapshots, modification events, sample pool items, export jobs, and evaluation runs.
3. Implement database-backed store methods for Phase 4 domains using transactional row-level writes or upserts instead of read-all-and-overwrite patterns.
4. Preserve JSON payload compatibility for Pydantic models and normalize timezone-aware datetimes on read/write.
5. Keep `RegisteredBatchRuntime` derived from database batch metadata plus filesystem `source_uri`; do not store raw files in PostgreSQL.
6. Add focused backend tests for DB-mode restart persistence and file-backed compatibility.

## Acceptance Criteria

- Database mode supports assignment, lease history, draft, batch draft, submission, snapshot, sample pool, export job, and evaluation persistence across service recreation.
- Batch deletion removes database runtime state records and does not delete source files.
- File-backed mode remains green.
- No Redis dependency or Docker database default is introduced.
- Verification results are recorded in `.agent/progress.md` and `.agent/handoff.md`.

## Expected Checks

- `uv sync`
- `uv run pytest tests/test_db_qc_state_backend.py -q`
- `uv run pytest -k "state_store_contract or db_foundation or db_qc_state" -q`
- `uv run pytest`
- SQLite Alembic smoke with `DATABASE_URL=sqlite+pysqlite:////tmp/<db>.sqlite uv run alembic upgrade head`


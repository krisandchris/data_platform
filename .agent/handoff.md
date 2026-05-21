# TASK-019 Phase 3 Backend Handoff

## Agent Role

Backend Agent

## Branch

`agent/TASK-019/backend/db-foundation`

## Worktree

`/mnt/lc/LC/ares_xtws/0_train_data/_worktrees/data_platform/TASK-019-backend-db-foundation`

## Scope Completed

- Added PostgreSQL foundation dependencies through uv (`sqlalchemy`, `alembic`, `psycopg[binary]`).
- Added DB config support for:
  - `PLATFORM_STATE_BACKEND=file|database`
  - `DATABASE_URL`
  - `PLATFORM_DB_AUTO_MIGRATE=0|1`
- Added Alembic setup and initial migration for foundation tables:
  - identity/users
  - role bindings
  - sessions
  - dataset type registry
  - dataset batch registry
  - import job metadata
  - label config versions + active pointers
  - audit events
- Implemented DB-backed foundation persistence with transitional hybrid behavior:
  - DB-backed foundation domains
  - non-migrated QC/review/export/evaluation state remains file-backed
- Wired app/service construction so file-backed mode remains default and database mode is explicit.
- Added backend-focused DB foundation tests.

## Files Changed

- `pyproject.toml`
- `uv.lock`
- `src/urban_violation_backend/app.py`
- `src/urban_violation_backend/service.py`
- `src/urban_violation_backend/db/__init__.py`
- `src/urban_violation_backend/db/base.py`
- `src/urban_violation_backend/db/settings.py`
- `src/urban_violation_backend/db/engine.py`
- `src/urban_violation_backend/db/migrations.py`
- `src/urban_violation_backend/db/models.py`
- `src/urban_violation_backend/db/foundation.py`
- `alembic.ini`
- `alembic/env.py`
- `alembic/script.py.mako`
- `alembic/versions/20260522_0001_task019_phase3_foundation.py`
- `tests/test_db_foundation_backend.py`

## Shared Contracts Changed

- Runtime construction contract:
  - `build_fixture_service(...)` accepts explicit DB-mode overrides and DB auto-migration toggle.
  - `create_app(...)` exposes matching constructor args.
- Internal persistence contract:
  - Added DB foundation repository/store abstractions and runtime selection wiring.

## Dependencies Changed

- Added:
  - `sqlalchemy`
  - `alembic`
  - `psycopg[binary]`

## Verification

- `uv run pytest -k 'state_store_contract or label_config_repository_contract or db_foundation' -q`
  - Result: passed (`8 passed`).
- `uv run pytest`
  - Result: `4 failed, 93 passed`.
  - Failure scope: manual-batch ingestion tests requiring local `DATASET/urban` path in this worktree.
- `git diff --check`
  - Result: passed.

## Known Risks / Notes

- Current full-suite failures are environment fixture-path dependent (`DATASET/urban` absent in this isolated worktree), not DB foundation schema/wiring failures.
- Transitional hybrid store is intentional for Phase 3: QC/review/export/evaluation persistence is still file-backed until later migration branches.
- Local DB verification used SQLite URL fallback; PostgreSQL-specific runtime smoke is not executed in this worktree due missing dedicated Postgres test target.

# Runtime And Validation

Last updated: 2026-05-22

## Stack

- Python managed by `uv`.
- FastAPI and Pydantic.
- Uvicorn for local serving.
- File-backed runtime state in the current local platform phase.
- TASK-019 target state backend: PostgreSQL for durable mutable records and Redis for short-lived coordination only.
- TASK-019 Phase 3 status: PostgreSQL foundation only. Docker defaults stay file-backed and Redis is not implemented in this phase.
- TASK-019 Phase 4 status: QC/review state migration to PostgreSQL is merged into `main`. Docker defaults still stay file-backed and Redis is still not implemented in this phase.
- TASK-019 Phase 5 status: Redis runtime coordination is optional and enabled explicitly for database-mode smoke validation. Docker defaults still stay file-backed until Phase 7.
- Pytest for backend regression tests.

## Runtime State

Runtime state includes:

- users and sessions;
- role bindings;
- registered dataset types and batches;
- import jobs;
- QC assignments, tasks, and leases;
- label edit drafts, batch drafts, submissions;
- audit events;
- label config versions and active pointers;
- snapshots, modification events, sample pool items, export jobs.

Use isolated state roots for tests and smoke runs:

```bash
PLATFORM_STATE_ROOT=/tmp/uvp-check \
LABEL_CONFIG_STORE_ROOT=/tmp/uvp-label-config \
uv run pytest
```

Raw `DATASET/` contents must not be mutated by runtime writes.

Migration boundary:

- `DATASET/`, uploaded archive extraction directories, browser media files, and export artifact files remain filesystem content.
- PostgreSQL is the target authority for users, roles, sessions, dataset registries, label config, import jobs, audit, QC state, drafts, submissions, snapshots, sample pool, exports, and evaluations.
- Phase 3 database-backed scope is limited to foundation domains: users, roles, sessions, dataset registries, import job metadata, label config, and audit.
- Phase 4 migrates QC assignments, tasks, lease history/current lease rows, drafts, batch drafts, submissions, snapshots, modification events, sample pool items, export metadata, and evaluation metadata to PostgreSQL in database mode.
- Phase 4 does not store raw files or generated export artifact bytes in PostgreSQL.
- Redis may hold active lease locks, distributed locks, session cache, live import progress, and optional caches.
- Redis is not the authority for drafts, submissions, audit, label config, users, roles, sessions, dataset type metadata, or batch metadata.
- Redis is opt-in in Phase 5 with `PLATFORM_REDIS_ENABLED=1` and `REDIS_URL`.
- Redis loss, TTL expiry, or Redis restart may remove only active locks, live progress hints, and optional cache entries; durable workflow state must remain readable from PostgreSQL.
- `REDIS_URL` and `PLATFORM_REDIS_ENABLED` are not Phase 4 requirements and must not become Docker production defaults before Phase 7.
- `RegisteredBatchRuntime` remains a derived runtime cache hydrated from database metadata plus filesystem `source_uri`.

TASK-019 database and Redis env vars:

| Variable | Values | Use |
| --- | --- | --- |
| `DATABASE_URL` | SQLAlchemy database URL; PostgreSQL uses `postgresql+psycopg://user:password@host:5432/dbname` | Required for Alembic and database-backed foundation mode. |
| `PLATFORM_STATE_BACKEND` | `file` or `database` | Selects file-backed or database-backed foundation/QC-review mode. |
| `PLATFORM_DB_AUTO_MIGRATE` | `0` or `1` | Controls startup migration behavior; explicit Alembic remains safer for verification. |
| `PLATFORM_REDIS_ENABLED` | `0` or `1` | Enables optional Redis runtime coordination in Phase 5 when set to `1`. Keep disabled for file-backed/default Docker runs. |
| `REDIS_URL` | Redis URL such as `redis://localhost:6379/15` | Required only when Redis coordination is explicitly enabled. Use an isolated Redis DB for smoke validation. |
| `TEST_DATABASE_URL` | PostgreSQL test URL | Enables real PostgreSQL integration checks. |
| `TEST_REDIS_URL` | Redis test URL | Enables real Redis integration checks. Use an isolated DB because Redis loss tests may remove keys. |

Detailed boundary and operator steps:

- [State Persistence Boundaries](../../architecture/state-persistence-boundaries.md)
- [PostgreSQL + Redis Migration Runbook](../../architecture/postgres-redis-migration-runbook.md)

## Validation Commands

```bash
uv sync
PLATFORM_STATE_ROOT=/tmp/uvp-check uv run pytest
uv run python -m py_compile \
  src/urban_violation_backend/service.py \
  src/urban_violation_backend/routes.py \
  src/urban_violation_backend/api_schemas.py
```

Live smoke:

```bash
scripts/integration-smoke.sh main
scripts/integration-smoke.sh agent
```

Phase 4 database-mode validation:

```bash
DATABASE_URL="$DATABASE_URL" uv run alembic upgrade head
TEST_DATABASE_URL="$DATABASE_URL" \
PLATFORM_STATE_BACKEND=database \
uv run pytest -k "state_store_contract or db_foundation or db_qc_state" -q
```

Phase 4 operator smoke should cover:

- QC queue, assignment, reassign, release, and task listing persistence after backend restart.
- Lease acquire, heartbeat, release, force release, and owner-check behavior without Redis.
- Sample draft, batch draft/autosave, batch submit, submission history, confirmation, and return.
- Annotation snapshots, modification events, correction sample pool, export job metadata, and evaluation metadata.
- Export download resolving filesystem artifacts through backend routes.

Phase 5 Redis-enabled database-mode validation after backend/QA Redis branches land:

```bash
uv run pytest -k "redis_runtime or db_qc_state" -q

export TEST_DATABASE_URL='postgresql+psycopg://urban_platform:change-me@localhost:5432/urban_platform_test'
export TEST_REDIS_URL='redis://localhost:6379/15'
DATABASE_URL="$TEST_DATABASE_URL" uv run alembic upgrade head
TEST_DATABASE_URL="$TEST_DATABASE_URL" \
TEST_REDIS_URL="$TEST_REDIS_URL" \
PLATFORM_STATE_BACKEND=database \
PLATFORM_REDIS_ENABLED=1 \
uv run pytest tests/test_postgres_redis_smoke.py tests/test_redis_runtime_backend.py::test_real_redis_smoke_if_available -q
```

Phase 5 operator smoke should cover:

- Concurrent lease acquire, owner heartbeat, owner release, non-owner rejection, TTL expiry, and backend restart.
- Duplicate QC queue generation and import execution attempts under Redis distributed locks.
- Import progress present while Redis keys exist and fallback behavior after progress expiry.
- Redis restart or isolated `FLUSHDB` causing only active locks, live progress hints, and optional caches to disappear.
- PostgreSQL still retaining durable users, roles, sessions, label configs, batch metadata, QC assignments, drafts, submissions, snapshots, audit, sample pool, export metadata, and evaluations.
- Docker production defaults remaining file-backed until Phase 7.

## Known Risks

- STEP2 failure remediation queue remains a product design follow-up.
- Snapshot rollback is intentionally guarded and should not become a normal UI action without a separate approval flow.
- Export permission names should be formalized if export moves from local feature to production multi-user workflow.
- Phase 5 Redis test selectors and TTL env-var names must be reconciled after backend and QA handoffs land.

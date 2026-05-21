# Runtime And Validation

Last updated: 2026-05-22

## Stack

- Python managed by `uv`.
- FastAPI and Pydantic.
- Uvicorn for local serving.
- File-backed runtime state in the current local platform phase.
- TASK-019 target state backend: PostgreSQL for durable mutable records and Redis for short-lived coordination only.
- TASK-019 Phase 3 status: PostgreSQL foundation only. Docker defaults stay file-backed and Redis is not implemented in this phase.
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
- QC/review state remains file-backed until the following backend phase migrates assignments, tasks, leases, drafts, submissions, snapshots, sample pool, exports, and evaluations.
- Redis may hold active lease locks, distributed locks, session cache, and live import progress.
- Redis is not the authority for drafts, submissions, audit, label config, users, roles, sessions, dataset type metadata, or batch metadata.
- `RegisteredBatchRuntime` remains a derived runtime cache hydrated from database metadata plus filesystem `source_uri`.

Phase 3 env vars:

| Variable | Values | Use |
| --- | --- | --- |
| `DATABASE_URL` | SQLAlchemy database URL; PostgreSQL uses `postgresql+psycopg://user:password@host:5432/dbname` | Required for Alembic and database-backed foundation mode. |
| `PLATFORM_STATE_BACKEND` | `file` or `database` | Selects file-backed or database-backed foundation mode. |
| `PLATFORM_DB_AUTO_MIGRATE` | `0` or `1` | Controls startup migration behavior; explicit Alembic remains safer for verification. |

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

## Known Risks

- STEP2 failure remediation queue remains a product design follow-up.
- Snapshot rollback is intentionally guarded and should not become a normal UI action without a separate approval flow.
- Export permission names should be formalized if export moves from local feature to production multi-user workflow.

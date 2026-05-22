# Handoff

## Scope

Backend Agent delivery for TASK-019 Phase 7 Docker rollout defaults in branch:
`agent/TASK-019/backend/docker-rollout`

## Changed Files

- `docker-compose.yml`
- `deploy/docker/backend.Dockerfile`
- `.agent/progress.md`
- `.agent/handoff.md`

## What Changed

1. Compose service topology and defaults
- Added `postgres` service (`postgres:16`) with:
  - persistent volume `postgres_data:/var/lib/postgresql/data`
  - env overrides for `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
  - health check via `pg_isready`
- Added `redis` service (`redis:7-alpine`) with:
  - health check via `redis-cli ping`
- Backend now defaults to database+redis mode while preserving rollback/env overrides:
  - `PLATFORM_STATE_BACKEND=${PLATFORM_STATE_BACKEND:-database}`
  - `PLATFORM_DB_AUTO_MIGRATE=${PLATFORM_DB_AUTO_MIGRATE:-1}`
  - `DATABASE_URL=${DATABASE_URL:-postgresql+psycopg://...@postgres:5432/...}`
  - `PLATFORM_REDIS_ENABLED=${PLATFORM_REDIS_ENABLED:-1}`
  - `REDIS_URL=${REDIS_URL:-redis://redis:6379/0}`
- Backend `depends_on` now waits for healthy `postgres` and `redis`.
- Preserved existing dataset/runtime mounts and upload limit overrides:
  - `DATASET_HOST_ROOT` bind remains readonly at `/data/datasets`
  - `PLATFORM_STATE_HOST_ROOT` and `LABEL_CONFIG_HOST_ROOT` remain writable runtime roots
  - import archive limit env overrides unchanged

2. Backend image migration assets
- Added Alembic runtime assets into backend image:
  - `COPY alembic.ini ./`
  - `COPY alembic ./alembic`

## Verification Commands and Results

- `uv run python scripts/docker-compose-auto-subnet.py config`
  - PASS
  - Confirmed rendered services include `backend`, `frontend`, `postgres`, `redis`
  - Confirmed backend env defaults render to database+redis values
- `scripts/docker-compose-auto-subnet.py build backend`
  - PASS
  - Backend image built successfully; build log shows Alembic files copied
- `git diff --check`
  - PASS

## Shared Contracts Touched

- `docker-compose.yml` (shared deployment contract): **yes**
- `deploy/docker/backend.Dockerfile` (backend container contract): **yes**
- No API schema, Pydantic model, DB migration file, or dependency lockfile changed.

## Dependency Status

- No dependency manifest or lockfile changes.
- No new Python/Node packages added.

## Risks / Notes

- Compose defaults now use dev credentials (`platform/platform_dev_password`) unless overridden. Operators should override `POSTGRES_*` or `DATABASE_URL` for non-dev deployments.
- File-backed rollback remains available via env override (`PLATFORM_STATE_BACKEND=file`, `PLATFORM_REDIS_ENABLED=0`), but `postgres`/`redis` services still start unless compose invocation is adjusted by operators.

## Next-Agent Notes

- If Lead Agent wants stricter rollback ergonomics, consider an optional compose profile that disables `postgres`/`redis` and removes backend health dependency when explicitly running file mode.

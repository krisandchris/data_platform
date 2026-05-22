# TASK-019 Phase 7 Backend Docker Rollout

## Role

Backend Agent

## Branch

`agent/TASK-019/backend/docker-rollout`

## Worktree

`../_worktrees/data_platform/TASK-019-backend-docker-rollout`

## Goal

Update Docker/backend deployment wiring so Compose defaults run PostgreSQL + Redis in database mode while preserving mounted filesystem artifact roots and a rollback path.

## Ownership

- Own: `docker-compose.yml`, `deploy/docker/backend.Dockerfile`, backend Docker health/dependency wiring, and backend-focused Docker config tests if needed.
- Coordinate before changing: dependency files, frontend files, docs outside minimal handoff references.
- You are not alone in the codebase. Do not revert edits from other agents; adjust to compatible changes.

## Tasks

1. Add `postgres` and `redis` services to Compose with persistent volumes and health checks.
2. Set backend Compose defaults for Phase 7:
   - `PLATFORM_STATE_BACKEND=database`
   - `PLATFORM_DB_AUTO_MIGRATE=1` unless you implement and document a safer equivalent operator path.
   - `DATABASE_URL` targeting the Compose `postgres` service.
   - `PLATFORM_REDIS_ENABLED=1`
   - `REDIS_URL` targeting the Compose `redis` service.
3. Make backend depend on healthy `postgres` and `redis`.
4. Ensure backend image includes `alembic.ini` and `alembic/` so startup migration works inside the container.
5. Keep `DATASET/` readonly and runtime filesystem roots mounted.
6. Preserve operator overrides for host paths, ports, credentials, and upload limits.
7. Run focused backend/Docker checks and complete `.agent/handoff.md`.

## Acceptance Criteria

- `scripts/docker-compose-auto-subnet.py config` renders all four services.
- Backend Docker image can build with Alembic assets included.
- Generated config contains database/Redis defaults and no hardcoded secrets beyond local default dev credentials.
- File-backed rollback remains possible through env overrides or a documented profile/path.

## Expected Checks

- `uv run python scripts/docker-compose-auto-subnet.py config`
- `scripts/docker-compose-auto-subnet.py build backend`
- `git diff --check`

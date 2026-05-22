# Findings

- Resumed QA branch after backend Phase 7 merge commit `416ff39` into `integration/TASK-019`.
- `docker-compose.yml` now renders the default four-service rollout: `backend`, `frontend`, `postgres`, `redis`.
- Backend defaults now include database/redis mode wiring:
  - `PLATFORM_STATE_BACKEND=database`
  - `PLATFORM_DB_AUTO_MIGRATE=1`
  - `DATABASE_URL` defaults to Compose `postgres`
  - `PLATFORM_REDIS_ENABLED=1`
  - `REDIS_URL` defaults to Compose `redis`
- Backend now depends on healthy `postgres` and `redis` services.
- `deploy/docker/backend.Dockerfile` now includes `COPY alembic.ini ./` and `COPY alembic ./alembic`, satisfying Alembic packaging assumptions for containerized migration startup.
- Updated `tests/test_docker_rollout_phase7.py` so config-level defaults always assert the Phase 7 four-service Compose (no rollout flag required).
- Added explicit config assertion for file-backed rollback implications: overriding `PLATFORM_STATE_BACKEND=file` and `PLATFORM_REDIS_ENABLED=0` still renders safely, while postgres/redis services remain defined.
- Live Docker smoke remains strictly env-gated:
  - `QA_RUN_DOCKER_ROLLOUT_SMOKE=1`
  - `QA_DOCKER_SMOKE_CONFIRM_ISOLATED=1`
- No product Docker code changes were made in this QA corrective pass.

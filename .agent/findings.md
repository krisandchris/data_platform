# Findings

- Phase 7 starts from `integration/TASK-019` at `6557415`.
- Current Compose has only `backend` and `frontend`; Phase 7 must add `postgres` and `redis`.
- Current backend Dockerfile does not copy `alembic.ini` or `alembic/`, but database startup migration resolves `alembic.ini` from the app root.
- Existing runtime settings already parse `DATABASE_URL`, `PLATFORM_STATE_BACKEND`, `PLATFORM_DB_AUTO_MIGRATE`, `PLATFORM_REDIS_ENABLED`, and `REDIS_URL`.
- Raw dataset/media/archive/export files must remain mounted filesystem content, not database blobs.

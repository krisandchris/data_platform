# Findings

- Phase 7 starts from `integration/TASK-019` at `6557415`.
- Prior live PostgreSQL/Redis smoke tests are env-gated through `TEST_DATABASE_URL` and `TEST_REDIS_URL`.
- Existing Docker helper must be used so subnet selection avoids host conflicts.
- Current Compose defaults are still file-backed until backend rollout branch lands.
- Added `tests/test_docker_rollout_phase7.py` with two layers:
  - Always-safe config checks for current file-backed Compose defaults.
  - Phase-7 assertions (postgres/redis, backend DB/Redis env defaults, healthchecks, Alembic packaging assumptions) gated by `QA_EXPECT_PHASE7_DOCKER_ROLLOUT=1` so this QA branch merges cleanly before backend Compose rollout lands.
- Added env-gated live Docker smoke test `test_docker_rollout_live_smoke_env_gated` guarded by:
  - `QA_RUN_DOCKER_ROLLOUT_SMOKE=1`
  - `QA_DOCKER_SMOKE_CONFIRM_ISOLATED=1`
- Live smoke uses isolated compose project naming (`task019qa_*`), temp host mounts, dynamic local port, `scripts/docker-compose-auto-subnet.py` for all Compose actions, and enforced cleanup via `down -v --remove-orphans`.

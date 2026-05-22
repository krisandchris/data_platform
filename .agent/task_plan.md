# TASK-019 Phase 5 QA Plan

## Goal

Add independent Redis/PostgreSQL integration coverage for Phase 5 runtime coordination and resolve the remaining Phase 4 risk of no real PostgreSQL validation.

## Role

QA Agent

## Branch

`agent/TASK-019/qa/redis-runtime-tests`

## Worktree

`/mnt/lc/LC/ares_xtws/0_train_data/_worktrees/data_platform/TASK-019-qa-redis-runtime-tests`

## Assigned Scope

- `tests/test_redis_runtime_api.py`
- `tests/test_postgres_redis_smoke.py`
- Test helpers under `tests/`
- Optional non-product verification scripts under `scripts/`
- `.agent/**`

## Out Of Scope

- Product backend implementation under `src/**`
- Frontend product code
- Dependency changes
- Docker Compose production rollout changes

## Planned Steps

1. Inspect Phase 4 DB tests and current API helpers.
2. Add tests for Redis enabled/disabled behavior:
   - concurrent lease acquire;
   - heartbeat by non-owner;
   - release by non-owner;
   - TTL expiry;
   - backend restart with Redis progress expired.
3. Add duplicate QC queue generation lock tests.
4. Add import progress present/absent tests.
5. Add PostgreSQL smoke tests gated by `TEST_DATABASE_URL`.
6. Add Redis smoke tests gated by `TEST_REDIS_URL`.
7. Prefer deterministic tests without external services; gate real service tests clearly.
8. Update `.agent/progress.md` and complete `.agent/handoff.md`; commit changes.

## Acceptance Criteria

- Focused QA tests pass after backend Phase 5 implementation is integrated.
- Real PostgreSQL tests are skipped unless `TEST_DATABASE_URL` is set.
- Real Redis tests are skipped unless `TEST_REDIS_URL` is set.
- Test failure messages distinguish missing service configuration from implementation failures.

## Expected Checks

- `uv sync`
- `uv run pytest tests/test_redis_runtime_api.py tests/test_postgres_redis_smoke.py -q`
- `uv run pytest -k "redis_runtime or postgres_live or db_qc_state" -q`
- If Docker services are available: run the same tests with `TEST_DATABASE_URL` and `TEST_REDIS_URL`.


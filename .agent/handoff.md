# Handoff

## Summary

Implemented QA-owned Phase 7 Docker rollout verification in `tests/test_docker_rollout_phase7.py` with config assertions and env-gated live smoke workflow.

## Files Changed

- `tests/test_docker_rollout_phase7.py`
- `.agent/findings.md`
- `.agent/progress.md`
- `.agent/handoff.md`

## Commands Run

1. `uv run pytest tests/test_docker_rollout_phase7.py -q`
2. `uv run pytest -k "docker_rollout or postgres_live or redis_runtime" -q`
3. `for i in 1 2 3 4 5; do uv run pytest -k "docker_rollout or postgres_live or redis_runtime" -q; done`
4. `git diff --check`

## Results

- `tests/test_docker_rollout_phase7.py`: pass with skips on gated tests (`.sss`).
- `-k "docker_rollout or postgres_live or redis_runtime"`: pass with expected skips (env-gated live/docker/postgres paths).
- 5-run rerun sweep: all 5 runs passed.

## Skipped Live Checks and Reasons

- Live Docker smoke is intentionally skipped unless both flags are set:
  - `QA_RUN_DOCKER_ROLLOUT_SMOKE=1`
  - `QA_DOCKER_SMOKE_CONFIRM_ISOLATED=1`
- Exact skip message includes which flag is missing.
- This avoids accidental operations against shared Docker resources.

## Phase-7 Rollout Gating Notes

- `test_docker_compose_phase7_postgres_redis_defaults_when_enabled` and `test_backend_dockerfile_keeps_alembic_migration_entrypoints_packaged` are gated behind `QA_EXPECT_PHASE7_DOCKER_ROLLOUT=1`.
- Reason: backend/docker rollout branch may land in parallel. Gating keeps this QA branch mergeable now while making strict assertions immediately enforceable once Compose defaults switch to postgres/redis.

## Risks

- Without setting the Phase 7 and live-smoke flags in CI or operator validation, only current file-backed baseline config assertions run.
- Live smoke depends on local Docker daemon health and available image build resources.

## Next-Agent Notes

- When backend Compose rollout lands, run with:
  - `QA_EXPECT_PHASE7_DOCKER_ROLLOUT=1`
- For isolated local end-to-end Docker smoke, run with:
  - `QA_RUN_DOCKER_ROLLOUT_SMOKE=1`
  - `QA_DOCKER_SMOKE_CONFIRM_ISOLATED=1`
- If CI policy allows, add a dedicated gated job to set these flags on a disposable Docker runner.

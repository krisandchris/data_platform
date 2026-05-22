# TASK-019 Phase 7 QA Docker Rollout Smoke

## Role

QA Agent

## Branch

`agent/TASK-019/qa/docker-rollout-smoke`

## Worktree

`../_worktrees/data_platform/TASK-019-qa-docker-rollout-smoke`

## Goal

Provide final QA verification for merged Phase 7 Docker rollout with deterministic config assertions and safe env-gated live smoke.

## Corrective Scope (Post-Merge)

1. Merge/rebase QA branch from `integration/TASK-019` after backend rollout merge `416ff39`.
2. Resolve `.agent/**` merge conflicts.
3. Update `tests/test_docker_rollout_phase7.py` default assertions to always expect four-service Compose.
4. Keep live smoke gated behind explicit isolation flags.
5. Run required pytest/check commands and finalize handoff.

## Verification Commands

- `uv run pytest tests/test_docker_rollout_phase7.py -q`
- `uv run pytest -k "docker_rollout or postgres_live or redis_runtime" -q`
- `git diff --check`

# TASK-019 Phase 7 QA Docker Rollout Smoke

## Role

QA Agent

## Branch

`agent/TASK-019/qa/docker-rollout-smoke`

## Worktree

`../_worktrees/data_platform/TASK-019-qa-docker-rollout-smoke`

## Goal

Add and run Docker rollout verification for PostgreSQL + Redis defaults, covering config rendering, service health, restart persistence, and key API smoke paths.

## Ownership

- Own: `tests/**`, QA helper scripts under `scripts/**` if needed, and `.agent/**`.
- Do not modify product frontend/backend code except to document a blocker in `.agent/findings.md`.
- You are not alone in the codebase. Do not revert edits from other agents; adjust tests to the integrated contracts.

## Tasks

1. Add deterministic Compose/config assertions that can run without starting Docker services.
2. Add or document an env-gated live Docker smoke workflow for:
   - `scripts/docker-compose-auto-subnet.py config`
   - build/up/health
   - `/health`
   - login/admin session
   - label config or dataset registry read
   - backend restart persistence
   - Redis restart durability boundary
3. If Docker services are available, run the live smoke against isolated volumes/ports and clean up after.
4. Keep tests safe: no destructive operations against shared PostgreSQL/Redis instances.
5. Complete `.agent/handoff.md` with pass/fail/skipped details and exact commands.

## Acceptance Criteria

- Config-level test fails if Compose omits `postgres`, `redis`, database defaults, Redis defaults, or Alembic packaging assumptions.
- Live smoke is either passed or explicitly skipped with a concrete environment reason.
- Full backend tests remain green after integration.

## Expected Checks

- `uv run pytest tests/test_docker_rollout_config.py -q` or equivalent new test file.
- `uv run pytest -k "docker_rollout or postgres_live or redis_runtime" -q`
- `git diff --check`

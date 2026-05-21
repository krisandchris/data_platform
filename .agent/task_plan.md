# TASK-019 Phase 3 Docs Plan

## Goal

Update TASK-019 documentation for the PostgreSQL foundation phase so operators and integrators understand that this phase adds database foundation only. Docker defaults, Redis runtime state, QC/review state migration, and production database rollout remain later phases.

## Agent Role

Docs Agent

## Branch

`agent/TASK-019/docs/db-foundation-runbooks`

## Worktree

`/mnt/lc/LC/ares_xtws/0_train_data/_worktrees/data_platform/TASK-019-docs-db-foundation-runbooks`

## Assigned Scope

- `docs/**`
- `.agent/task_plan.md`
- `.agent/findings.md`
- `.agent/progress.md`
- `.agent/handoff.md`

## Out Of Scope

- Product backend code.
- Product frontend code.
- Docker Compose or Dockerfile changes.
- Dependency files such as `pyproject.toml`, `uv.lock`, `package.json`, or lockfiles.
- Redis implementation and Docker default switch.

## Plan

1. Restore context from required instructions and docs.
   - Status: complete.
2. Record Phase 3 documentation findings.
   - Status: complete.
3. Patch docs for PostgreSQL foundation scope, env vars, Alembic workflow placeholders, transitional file/database boundary, and non-production gates.
   - Status: complete.
4. Run manual link/structure review and `git diff --check`.
   - Status: complete.
5. Complete handoff and commit branch.
   - Status: complete.

## Acceptance Criteria

- Docs clearly state Phase 3 introduces PostgreSQL foundation only.
- Docs explicitly say Docker defaults are not switched in Phase 3.
- Docs explicitly say Redis is not implemented in Phase 3.
- Expected env vars are documented:
  - `DATABASE_URL`
  - `PLATFORM_STATE_BACKEND=file|database`
  - `PLATFORM_DB_AUTO_MIGRATE=0|1`
- Alembic workflow and verification gates are documented without pretending final backend command/module names are confirmed.
- Transitional boundary is documented: foundation domains may be database-backed while QC/review state remains file-backed until the next backend phase.
- Manual link/structure review passes.
- `git diff --check` passes.

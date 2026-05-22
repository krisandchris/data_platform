# TASK-019 Phase 5 Docs Plan

## Goal

Update architecture and runbooks for Redis runtime coordination, including operator validation for Redis loss, PostgreSQL authority, live progress expiry, and real PostgreSQL/Redis smoke checks.

## Role

Docs Agent

## Branch

`agent/TASK-019/docs/redis-runtime-runbooks`

## Worktree

`/mnt/lc/LC/ares_xtws/0_train_data/_worktrees/data_platform/TASK-019-docs-redis-runtime-runbooks`

## Assigned Scope

- `docs/architecture/state-persistence-boundaries.md`
- `docs/architecture/postgres-redis-migration-runbook.md`
- `docs/architecture/state_migration_agent_sequence.md`
- `docs/backend/modules/runtime-and-validation.md`
- `docs/architecture/deployment.md`
- `.agent/**`

## Out Of Scope

- Product code
- Tests
- Docker default production switch

## Planned Steps

1. Inspect existing Phase 5 docs.
2. Document Redis env vars, responsibilities, TTL/loss behavior, and security cautions.
3. Document real PostgreSQL/Redis smoke validation with `TEST_DATABASE_URL` and `TEST_REDIS_URL`.
4. Keep docs explicit that Redis is not durable authority and Docker production rollout remains Phase 7.
5. Update `.agent/progress.md` and complete `.agent/handoff.md`; commit changes.

## Acceptance Criteria

- Docs match implemented Phase 5 behavior after integration reconciliation.
- Runbook states that Redis loss only affects active locks/live progress hints.
- Runbook explains that PostgreSQL/database state remains authoritative.
- `git diff --check` passes.

## Expected Checks

- `git diff --check`
- Manual link/structure review


# TASK-019 Phase 5 Docs Findings

## Initial Context

- Phase 4 docs already state Redis is Phase 5.
- Phase 5 docs must avoid implying Redis stores durable platform state.

## Findings

- Required docs were inspected on 2026-05-22: `state-persistence-boundaries.md`, `postgres-redis-migration-runbook.md`, `runtime-and-validation.md`, `deployment.md`, and `state_migration_agent_sequence.md`.
- Current branch base is `main` at Phase 4 integration. Phase 4 docs and tests are present; Phase 5 Redis implementation and `TEST_REDIS_URL` tests are not visible in this docs worktree yet.
- Current PostgreSQL integration tests use `TEST_DATABASE_URL` with SQLite fallback for local coverage and PostgreSQL-only gates when a PostgreSQL URL is provided.
- Existing Phase 5 planning names `REDIS_URL` and `PLATFORM_REDIS_ENABLED=0|1`; no confirmed Redis TTL env-var names are present in this worktree.
- Docs updates should therefore document confirmed env names, operator TTL/loss expectations, and mark exact Redis test selectors as backend/QA handoff dependent.

## Risks

- Docs must be reconciled after backend and QA branches land for exact env names, test selectors, and commands.
- Redis `FLUSHDB` or restart checks are destructive to active locks/progress for the selected Redis DB; run only against isolated smoke Redis databases.

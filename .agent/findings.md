# Findings

- Phase 7 starts from `integration/TASK-019` at `6557415`.
- Current docs still describe Compose as file-backed until Phase 7.
- Phase 6 runbook already documents import dry-run/apply/idempotency and no reverse export.
- Docs must be reconciled with backend/QA final handoffs before Lead Agent final merge.
- Required files read before editing: `AGENTS.md`, `.agent/task_plan.md`, `.agent/findings.md`, `docs/architecture/deployment.md`, `docs/architecture/postgres-redis-migration-runbook.md`, and `docs/architecture/state-persistence-boundaries.md`.
- Current docs worktree `docker-compose.yml` still has only `backend` and `frontend`; read-only inspection of `agent/TASK-019/backend/docker-rollout:docker-compose.yml` showed the same two-service Compose state.
- Read-only inspection of backend, frontend, and QA agent `.agent/handoff.md` files showed `Pending.` as of this docs pass.
- Current backend env parser confirms these runtime names: `PLATFORM_STATE_BACKEND`, `DATABASE_URL`, `PLATFORM_DB_AUTO_MIGRATE`, `PLATFORM_REDIS_ENABLED`, `REDIS_URL`, `PLATFORM_REDIS_LEASE_TTL_SECONDS`, `PLATFORM_REDIS_LOCK_TTL_SECONDS`, `PLATFORM_REDIS_IMPORT_PROGRESS_TTL_SECONDS`, and `PLATFORM_REDIS_SESSION_CACHE_TTL_SECONDS`.
- Prior deployment memory and current deployment docs agree that `DATASET_HOST_ROOT` must be the parent directory containing `urban_violation/`, not the dataset child itself.
- Lead reconciliation is required for exact Phase 7 Compose image tags, PostgreSQL password variable names, named volume names, Redis persistence setting, final health-check commands, and final backend/QA smoke results.

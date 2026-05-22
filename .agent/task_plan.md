# TASK-019 PostgreSQL + Redis State Migration Plan

Objective: migrate mutable platform state from file-backed JSON/JSONL stores to PostgreSQL, use Redis for active leases/locks/progress, preserve current frontend API behavior, and provide a safe import path from existing runtime state.

## Phases

1. Baseline and contract freeze.
   - Status: complete.
2. Store interface extraction.
   - Status: complete.
3. PostgreSQL foundation for identity, registry, label config, import jobs, and audit.
   - Status: complete.
4. PostgreSQL migration for QC, drafts, submissions, sample pool, exports, and evaluations.
   - Status: complete.
5. Redis runtime state for active leases, locks, session cache, and import progress.
   - Status: in_progress. Backend and QA are merged into integration; Frontend is being merged; Docs is ready.
6. File-state import tool.
   - Status: pending.
7. Docker rollout and full acceptance.
   - Status: pending.

## Phase 5 Agent Branches

- Merged into integration: `agent/TASK-019/backend/redis-runtime` at `28f70c6`
- Merged into integration: `agent/TASK-019/qa/redis-runtime-tests` at `3529101`
- Integrating: `agent/TASK-019/frontend/progress-and-lease` at `151131c`
- Ready to integrate: `agent/TASK-019/docs/redis-runtime-runbooks` at `3ff44e3`

## Phase 5 Scope

- Add Redis runtime coordination for active sample leases, owner-checked heartbeat/release, QC queue locks, import job locks, optional session lookup cache, and live import progress.
- Preserve PostgreSQL as the durable authority for users, roles, sessions, dataset metadata, import final state, label configs, audit, drafts, submissions, snapshots, sample pool, exports, and evaluations.
- Resolve the remaining live-service validation risk by adding and running PostgreSQL/Redis smoke checks where Docker services are available.
- Do not switch Docker production defaults in this phase.

## Phase 5 Exit Gate

- Redis disabled mode remains green.
- Redis enabled mode passes focused lease/lock/progress tests.
- Redis loss does not lose durable platform state.
- Real PostgreSQL/Redis smoke passes locally if disposable Docker services can be started.
- Frontend tests/build remain green.
- Docs and runbooks are reconciled with implemented env names and test selectors.

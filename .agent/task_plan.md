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
   - Status: complete. Backend, QA, Frontend, and Docs branches are merged into `integration/TASK-019`; local integration verification passed with SQLite database fallback.
5. Redis runtime state for active leases, locks, session cache, and import progress.
   - Status: in_progress. Phase 5 Redis runtime worktrees have been created and agents are being dispatched.
6. File-state import tool.
   - Status: pending.
7. Docker rollout and full acceptance.
   - Status: pending.

## Phase 4 Agent Branches

- Merged into integration: `agent/TASK-019/backend/qc-state` at `254e9f0`
- Merged into integration: `agent/TASK-019/qa/qc-state-tests` at `a3c16e9`
- Merged into integration: `agent/TASK-019/frontend/qc-db-compat` at `011df88`
- Merged into integration: `agent/TASK-019/docs/qc-state-runbooks` at `b4f1042`

## Phase 4 Scope

- Move authoritative QC assignments, task records, lease history, drafts, batch drafts, submissions, annotation snapshots, modification events, sample pool items, export job metadata, and evaluation run metadata to PostgreSQL in database mode.
- Preserve file-backed mode and existing frontend API response contracts.
- Keep raw dataset files, uploaded archives, extracted source trees, media files, and export artifacts on the filesystem.
- Do not introduce Redis or switch Docker defaults in this phase.

## Phase 4 Exit Gate

- Database mode supports the full review workflow through confirmation and persistence across service recreation.
- File-backed test suite remains green.
- Frontend tests/build remain green.
- QA database-mode tests pass with SQLite fallback and optionally with `TEST_DATABASE_URL`.
- Docs and runbooks are reconciled with the implemented Phase 4 behavior.

Exit gate status: complete for local integration. PostgreSQL-specific live validation still requires `TEST_DATABASE_URL`.

## Phase 5 Agent Branches

- In progress: `agent/TASK-019/backend/redis-runtime`
- In progress: `agent/TASK-019/qa/redis-runtime-tests`
- In progress: `agent/TASK-019/frontend/progress-and-lease`
- In progress: `agent/TASK-019/docs/redis-runtime-runbooks`

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

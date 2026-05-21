# TASK-019 PostgreSQL + Redis State Migration Plan

Objective: migrate mutable platform state from file-backed JSON/JSONL stores to PostgreSQL, use Redis for active leases/locks/progress, preserve current frontend API behavior, and provide a safe import path from existing runtime state.

## Phases

1. Baseline and contract freeze.
   - Status: complete.
2. Store interface extraction.
   - Status: complete.
3. PostgreSQL foundation for identity, registry, label config, import jobs, and audit.
   - Status: complete. Backend, QA, and Docs Phase 3 branches were merged and verified on `integration/TASK-019`.
4. PostgreSQL migration for QC, drafts, submissions, sample pool, exports, and evaluations.
   - Status: in_progress. Phase 4 worktrees have been created and agents are being dispatched.
5. Redis runtime state for active leases, locks, session cache, and import progress.
   - Status: pending.
6. File-state import tool.
   - Status: pending.
7. Docker rollout and full acceptance.
   - Status: pending.

## Phase 3 Agent Branches

- Merged: `agent/TASK-019/backend/db-foundation` at `a640e85`
- Merged: `agent/TASK-019/qa/db-foundation-tests` at `064f7a2`
- Merged: `agent/TASK-019/docs/db-foundation-runbooks` at `816d862`

## Phase 3 Scope

- Added SQLAlchemy, Alembic, and `psycopg[binary]` through `uv`.
- Added DB config/env support:
  - `DATABASE_URL`
  - `PLATFORM_STATE_BACKEND=file|database`
  - `PLATFORM_DB_AUTO_MIGRATE=0|1`
- Added Alembic baseline and initial schema for users, role bindings, sessions, dataset registry, batch/import job metadata, label config versions/active pointers, and audit events.
- Added transitional DB foundation storage while leaving QC/review/export/evaluation state file-backed for later phases.
- Added gated QA database foundation tests.
- Updated Phase 3 documentation and runbooks.

## Phase 3 Exit Gate

- File-backed mode remains green: `uv run pytest` -> 103 passed, 1 skipped.
- Focused DB foundation and existing store contract tests pass -> 14 passed, 1 skipped.
- Frontend tests/build remain green -> 114 tests passed and production build passed.
- Docs are reconciled with actual backend command names and DB behavior.
- No Docker default switch to database mode yet.
- No Redis implementation yet.

## Phase 4 Agent Branches

- In progress: `agent/TASK-019/backend/qc-state`
- In progress: `agent/TASK-019/qa/qc-state-tests`
- In progress: `agent/TASK-019/frontend/qc-db-compat`
- In progress: `agent/TASK-019/docs/qc-state-runbooks`

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

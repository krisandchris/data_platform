# TASK-019 PostgreSQL + Redis State Migration Plan

Objective: migrate mutable platform state from file-backed JSON/JSONL stores to PostgreSQL, use Redis for active leases/locks/progress, preserve current frontend API behavior, and provide a safe import path from existing runtime state.

## Phases

1. Baseline and contract freeze.
   - Status: complete. Backend, QA, and Docs first-pass branches were merged and verified on `integration/TASK-019`.
2. Store interface extraction.
   - Status: complete. Backend protocol extraction and QA contract tests passed integration verification.
3. PostgreSQL foundation for identity, registry, label config, import jobs, and audit.
   - Status: integration in progress. Backend DB foundation and QA DB foundation tests are merged into `integration/TASK-019`; Docs DB foundation runbooks are pending merge.
4. PostgreSQL migration for QC, drafts, submissions, sample pool, exports, and evaluations.
   - Status: pending.
5. Redis runtime state for active leases, locks, session cache, and import progress.
   - Status: pending.
6. File-state import tool.
   - Status: pending.
7. Docker rollout and full acceptance.
   - Status: pending.

## Agent Branches

- Active integration: `integration/TASK-019`
- Phase 3 merged:
  - `agent/TASK-019/backend/db-foundation` at `a640e85`
  - `agent/TASK-019/qa/db-foundation-tests` at `064f7a2`
- Phase 3 pending:
  - `agent/TASK-019/docs/db-foundation-runbooks` at `816d862`
- Planned later:
  - `agent/TASK-019/backend/qc-state`
  - `agent/TASK-019/backend/redis-runtime`
  - `agent/TASK-019/backend/import-tool`
  - `agent/TASK-019/frontend/progress-and-lease`

## Constraints

- Main workspace is orchestration, planning, integration review, verification, and accepted-code synchronization only.
- Product backend changes must happen in backend worktrees.
- Product frontend changes must happen in frontend worktrees.
- `DATASET/` remains readonly and outside PostgreSQL.
- Uploaded/extracted archives, media files, and export artifacts remain on the filesystem.
- Redis must not be the authority for drafts, submissions, audit, users, roles, label config, or batch metadata.
- `RegisteredBatchRuntime` remains a derived cache hydrated from database metadata plus filesystem `source_uri`.

## Phase 3 Scope

- Added SQLAlchemy, Alembic, and `psycopg[binary]` through `uv`.
- Added DB config/env support:
  - `DATABASE_URL`
  - `PLATFORM_STATE_BACKEND=file|database`
  - `PLATFORM_DB_AUTO_MIGRATE=0|1`
- Added Alembic baseline and initial schema for users, role bindings, sessions, dataset registry, batch/import job metadata, label config versions/active pointers, and audit events.
- Added transitional DB foundation storage while leaving QC/review/export/evaluation state file-backed for later phases.
- Added gated QA database foundation tests.

## Phase 3 Exit Gate

- File-backed mode remains green: `uv run pytest`.
- Focused DB foundation and existing store contract tests pass.
- Frontend tests/build remain green.
- Docs are reconciled with actual backend command names and DB behavior.
- No Docker default switch to database mode yet.
- No Redis implementation yet.

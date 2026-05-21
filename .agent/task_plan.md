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
   - Status: in_progress. Backend and QA are merged into integration; Frontend is being merged; Docs is ready to integrate.
5. Redis runtime state for active leases, locks, session cache, and import progress.
   - Status: pending.
6. File-state import tool.
   - Status: pending.
7. Docker rollout and full acceptance.
   - Status: pending.

## Phase 4 Agent Branches

- Merged into integration: `agent/TASK-019/backend/qc-state` at `254e9f0`
- Merged into integration: `agent/TASK-019/qa/qc-state-tests` at `a3c16e9`
- Integrating: `agent/TASK-019/frontend/qc-db-compat` at `011df88`
- Ready to integrate: `agent/TASK-019/docs/qc-state-runbooks` at `b4f1042`

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

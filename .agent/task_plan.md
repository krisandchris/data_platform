# TASK-019 PostgreSQL + Redis State Migration Plan

Objective: migrate mutable platform state from file-backed JSON/JSONL stores to PostgreSQL, use Redis for active leases/locks/progress, preserve current frontend API behavior, and provide a safe import path from existing runtime state.

Current agent: TASK-019 Docs Agent.

Current worktree: `/mnt/lc/LC/ares_xtws/0_train_data/_worktrees/data_platform/TASK-019-docs-runbooks`

Current branch: `agent/TASK-019/docs/runbooks`

Assigned scope:

- `docs/**`
- this worktree's `.agent/*` records

Out of scope:

- backend product code
- frontend product code
- tests
- Docker Compose and Dockerfiles
- dependency files

## Phases

1. Baseline and contract freeze.
   - Status: in progress.
   - Docs Agent status: completed state boundary and migration runbook draft.
2. Store interface extraction.
   - Status: pending.
3. PostgreSQL foundation for identity, registry, label config, import jobs, and audit.
   - Status: pending.
4. PostgreSQL migration for QC, drafts, submissions, sample pool, exports, and evaluations.
   - Status: pending.
5. Redis runtime state for active leases, locks, session cache, and import progress.
   - Status: pending.
6. File-state import tool.
   - Status: pending.
7. Docker rollout and full acceptance.
   - Status: pending.

## Docs Agent Deliverables

1. Document current file-backed, process-local cache, and derived runtime boundaries.
   - Status: complete.
2. Document target PostgreSQL and Redis responsibility split.
   - Status: complete.
3. Draft operator runbook for backup, Alembic migration, file-state import, Docker rollout, and rollback.
   - Status: complete.
4. Cross-link architecture, deployment, and backend runtime docs.
   - Status: complete.
5. Verify markdown structure/links manually and run `git diff --check`.
   - Status: complete.

## Agent Branches

- `integration/TASK-019`
- `agent/TASK-019/backend/state-contracts`
- `agent/TASK-019/backend/db-foundation`
- `agent/TASK-019/backend/qc-state`
- `agent/TASK-019/backend/redis-runtime`
- `agent/TASK-019/backend/import-tool`
- `agent/TASK-019/frontend/progress-and-lease`
- `agent/TASK-019/qa/test-matrix`
- `agent/TASK-019/docs/runbooks`

## Constraints

- Main workspace is orchestration, planning, integration review, verification, and accepted-code synchronization only.
- Product backend changes must happen in backend worktrees.
- Product frontend changes must happen in frontend worktrees.
- Dependency changes are owned by the Lead Agent or an explicitly assigned dependency owner.
- `DATASET/` remains readonly and outside PostgreSQL.
- Uploaded/extracted archives, media files, and export artifacts remain on the filesystem.
- Redis must not be the authority for drafts, submissions, audit, users, roles, label config, or batch metadata.
- `RegisteredBatchRuntime` remains a derived cache hydrated from database metadata plus filesystem `source_uri`.

## Acceptance Criteria

- File-backed mode remains green after each phase until database mode is the Docker default.
- Database mode passes store contract tests and API regression tests.
- Redis active lease is cross-process safe and does not cause data loss when Redis restarts.
- Existing frontend API contracts remain compatible.
- Migration tool imports existing `PLATFORM_STATE_ROOT` and `LABEL_CONFIG_STORE_ROOT` data idempotently.
- Docker deployment defaults to PostgreSQL + Redis only after migration, import, and rollback paths are tested.

## Reference

Detailed sub-agent sequence and per-phase test design:

- `docs/architecture/state_migration_agent_sequence.md`

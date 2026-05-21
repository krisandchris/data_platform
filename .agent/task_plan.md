# TASK-019 Phase 4 Docs Plan

## Goal

Update migration documentation and operator runbooks for the Phase 4 QC/review state database migration while preserving the documented filesystem and Redis boundaries.

## Role

Docs Agent

## Branch

`agent/TASK-019/docs/qc-state-runbooks`

## Worktree

`/mnt/lc/LC/ares_xtws/0_train_data/_worktrees/data_platform/TASK-019-docs-qc-state-runbooks`

## Assigned Scope

- `docs/architecture/state-persistence-boundaries.md`
- `docs/architecture/postgres-redis-migration-runbook.md`
- `docs/architecture/state_migration_agent_sequence.md`
- `docs/backend/modules/runtime-and-validation.md`
- `docs/backend/modules/assets-media-review.md`
- `.agent/**`

## Out Of Scope

- Product frontend/backend code
- Tests
- Docker default switch to database mode
- Redis implementation details beyond preserving the existing boundary

## Planned Steps

1. Inspect Phase 3 docs and Phase 4 code contracts.
2. Draft Phase 4 operator validation notes for QC assignments, leases, drafts, submissions, snapshots, sample pool, exports, and evaluations.
3. Keep docs explicit that raw files and export artifacts stay on the filesystem.
4. Keep docs explicit that Redis is not implemented until Phase 5.
5. Mark any backend-confirmation-dependent statements clearly until the backend branch lands.

## Acceptance Criteria

- Documentation matches actual Phase 4 implementation after integration reconciliation.
- No docs claim Docker defaults switch to database mode in Phase 4.
- Runbook has concrete validation commands and rollback notes.
- `.agent/handoff.md` lists changed docs and manual review result.

## Expected Checks

- Manual link and structure review.
- `git diff --check`


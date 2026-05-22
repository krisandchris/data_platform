# TASK-019 Phase 7 Docs Docker Rollout Runbook

## Role

Docs Agent

## Branch

`agent/TASK-019/docs/docker-rollout-runbook`

## Worktree

`../_worktrees/data_platform/TASK-019-docs-docker-rollout-runbook`

## Goal

Finalize operator documentation for Phase 7 PostgreSQL + Redis Docker rollout, including startup, import/cutover, rollback, smoke checks, and remaining filesystem boundaries.

## Ownership

- Own: `docs/**`, README docs references if needed, and `.agent/**`.
- Do not modify product code, Docker Compose, or dependency files.
- You are not alone in the codebase. Do not revert edits from other agents; reconcile docs with implemented contracts after integration.

## Tasks

1. Update Docker deployment docs from file-backed-current to Phase 7 PostgreSQL + Redis default posture.
2. Update migration runbook Docker rollout section with exact Compose services/env/volumes and rollback instructions.
3. Preserve explicit filesystem boundaries for `DATASET/`, uploads, media, and export artifacts.
4. Document emergency file-backed rollback and state-authority decisions after database-mode writes.
5. Complete `.agent/handoff.md` with docs changed and manual review result.

## Acceptance Criteria

- Docs match the implemented Phase 7 Compose service names, env vars, volumes, and health checks.
- Docs clearly state what survives PostgreSQL/Redis/container restarts.
- Docs do not imply reverse export exists.

## Expected Checks

- `git diff --check`
- Manual link/structure review.

## Status

- Required reading: complete.
- Documentation updates: complete.
- Verification: complete (`git diff --check`, manual link/structure review).
- `.agent/handoff.md`: complete.
- Lead reconciliation required before integration: final backend/QA handoffs and final Compose service definitions are not present in this docs branch snapshot.

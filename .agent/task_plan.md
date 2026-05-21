# TASK-019 Phase 4 Frontend Compatibility Plan

## Goal

Verify that review, QC, sample pool, export, and evaluation frontend behavior does not depend on file-backed backend internals and remains stable when the backend runs in database mode.

## Role

Frontend Agent

## Branch

`agent/TASK-019/frontend/qc-db-compat`

## Worktree

`/mnt/lc/LC/ares_xtws/0_train_data/_worktrees/data_platform/TASK-019-frontend-qc-db-compat`

## Assigned Scope

- `frontend/src/features/review-workbench/**`
- `frontend/src/features/qc/**`
- `frontend/src/features/sample-pool/**`
- `frontend/src/features/batch-overview/**`, if evaluation/export UI is located there
- `frontend/src/services/**`, only for type-safe compatibility checks if backend response contracts require it
- Frontend tests under `frontend/src/**`
- `.agent/**`

## Out Of Scope

- Backend product code
- API contract changes
- Redis progress UI, unless a current Phase 4 backend response already exposes a compatible optional field
- Dependency changes

## Planned Steps

1. Inspect current API client types and affected pages for assumptions about leases, drafts, submissions, sample pool, exports, and evaluations.
2. Run frontend tests/build on the Phase 4 base.
3. Add or adjust lightweight tests only if the current frontend lacks coverage for stable review/QC/sample pool rendering under unchanged response shapes.
4. Verify that sample switching and lease readonly indicators remain stable and do not introduce layout jitter.
5. Document whether any backend response change would require frontend coordination.

## Acceptance Criteria

- `npm run test` passes.
- `VITE_API_BASE_URL=/api npm run build` passes.
- No frontend API contract change is required for Phase 4.
- Any discovered UI risk is documented in `.agent/findings.md` and `.agent/handoff.md`.

## Expected Checks

- `nvm use $(cat .nvmrc)` from repo root or equivalent Node 20 setup
- `cd frontend && npm run test`
- `cd frontend && VITE_API_BASE_URL=/api npm run build`

## Completion Status

- Steps 1-5 complete.
- Added one focused frontend API adapter regression test for database-mode review state normalization.
- No frontend product UI, backend code, API contract, or dependency declaration changes were made.
- Final checks passed: `cd frontend && npm run test` and `cd frontend && VITE_API_BASE_URL=/api npm run build`.

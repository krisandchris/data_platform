# TASK-019 Phase 5 Frontend Plan

## Goal

Extend frontend compatibility for optional Redis-backed import progress and keep lease conflict/readonly messaging stable when Redis runtime state is enabled or expires.

## Role

Frontend Agent

## Branch

`agent/TASK-019/frontend/progress-and-lease`

## Worktree

`/mnt/lc/LC/ares_xtws/0_train_data/_worktrees/data_platform/TASK-019-frontend-progress-lease`

## Assigned Scope

- `frontend/src/services/**`
- `frontend/src/features/datasets/components/DatasetTypeBatchPanel.vue`
- `frontend/src/features/import/**`
- `frontend/src/features/review-workbench/**`, only for lease readonly/conflict compatibility tests or minimal UI stability changes
- `frontend/src/test/**`
- `.agent/**`

## Out Of Scope

- Backend product code
- API contract changes not already introduced by backend
- Dependency changes
- Broad UI redesign

## Planned Steps

1. [x] Inspect existing import job normalization and upload progress UI.
2. [x] Add optional backend processing progress fields to frontend API types/normalizers if backend exposes them.
3. [x] Preserve current browser upload progress behavior.
4. [x] Show backend processing progress when present and fall back to stable "processing" copy when absent/expired.
5. [x] Verify lease conflict and readonly messaging remains stable when Redis lease state is missing, expired, or owned by another user.
6. [x] Add focused frontend tests.
7. [x] Update `.agent/progress.md` and complete `.agent/handoff.md`; commit changes.

## Status

Implementation and frontend verification complete in this worktree. Changes are ready for the required frontend agent commit.

## Acceptance Criteria

- `npm run test` passes.
- `VITE_API_BASE_URL=/api npm run build` passes.
- Missing Redis progress does not break import pages.
- Review workbench lease readonly indicators do not flicker or change layout due to optional Redis data.

## Expected Checks

- `source "$HOME/.nvm/nvm.sh" && nvm use "$(cat ../.nvmrc)"`
- `cd frontend && npm run test`
- `cd frontend && VITE_API_BASE_URL=/api npm run build`

# Handoff

## Agent Role

Frontend Agent

## Branch

`agent/TASK-019/frontend/qc-db-compat`

## Worktree

`/mnt/lc/LC/ares_xtws/0_train_data/_worktrees/data_platform/TASK-019-frontend-qc-db-compat`

## Scope Completed

- Verified review, QC, sample pool export, model evaluation, and version-history frontend compatibility under unchanged API contracts.
- Confirmed existing page tests already protect sample switching and readonly lease warning behavior.
- Added one focused HTTP API adapter regression test for database-mode review payload normalization:
  - `current_user`
  - `batch_assignment`
  - `qc_task`
  - `sample_lease`
  - `my_draft`
  - `latest_submission`

## Changed Files

- `.agent/task_plan.md`
- `.agent/findings.md`
- `.agent/progress.md`
- `.agent/handoff.md`
- `frontend/src/test/apiClient.test.ts`

## Shared Contracts Changed

- None.

## Dependencies Changed

- None. Ran `npm ci` only to install existing lockfile dependencies locally.

## Verification

- `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use $(cat .nvmrc) && cd frontend && npm run test`
  - Passed: 6 test files / 115 tests.
- `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use $(cat .nvmrc) && cd frontend && VITE_API_BASE_URL=/api npm run build`
  - Passed.
- Environment note: plain `nvm use $(cat .nvmrc)` failed in the non-interactive shell because `nvm` was not preloaded; sourcing `$HOME/.nvm/nvm.sh` selected Node 20.19.6 successfully.

## Known Risks

- Database mode should preserve unchanged API contracts. The frontend adapter tolerates snake_case and wrapper variants for inspected surfaces.
- `ModelEvaluationPanel.vue` and `VersionHistoryPanel.vue` sort by `completedAt`/`createdAt` before choosing default comparison pairs; records with identical or missing timestamps remain render-safe, but default pairing may follow backend ordering.
- Existing Vitest route tests emit Vue Router warnings for intentionally unstubbed routes; tests still pass.

## Next Agent Notes

- No backend/API contract change is requested from frontend.
- QA can run integrated browser/API checks against the database-mode backend using the existing review, QC, sample pool, export, evaluation, and snapshot flows.

# TASK-022 QC Chinese Localization

Objective: Chinese-localize the sample review / QC page while keeping `violation_category` values unchanged.

## Agent Role

Frontend Agent

## Branch

`agent/TASK-022/frontend/qc-zh-localization`

## Worktree

`../_worktrees/data_platform/qc-zh-localization`

## Assigned Scope

- `frontend/src/features/review-workbench/**`
- Frontend tests that cover review workbench UI text and label-config display.

## Out of Scope

- Backend API contracts.
- Label-config schema changes.
- `violation_category` value localization.
- Unrelated visual redesign.

## Steps

1. Inspect review workbench text and option rendering helpers.
   - Status: complete.
2. Implement display-only label-config option localization for non-`violation_category` fields.
   - Status: complete.
3. Replace hard-coded English operator text in the QC/review page with Chinese.
   - Status: complete.
4. Update focused tests.
   - Status: complete.
5. Run frontend tests, build, and diff checks.
   - Status: complete.

## Acceptance Criteria

- `violation_category` remains displayed as raw code/value.
- Other label-config options prefer Chinese labels when available while keeping stored values unchanged.
- Main QC operator workflow text is Chinese.
- Existing sample navigation, draft editing, bbox editing, lease/read-only behavior, and submission logic are unchanged.

---

# TASK-023 Project Function and Architecture Analysis

Objective: analyze current project functionality and architecture design from repository code and documentation.

## Agent Role

Lead Agent

## Assigned Scope

- Repository documentation and configuration.
- Frontend/backend entry points and module boundaries.
- Local orchestration scripts and worktree coordination files.

## Steps

1. Inspect repository layout, docs, and top-level configuration.
   - Status: complete.
2. Inspect backend modules, API routes, data models, and tests.
   - Status: complete.
3. Inspect frontend modules, routing, API clients, and tests.
   - Status: complete.
4. Summarize architecture, major workflows, risks, and extension points.
   - Status: complete.

## Acceptance Criteria

- Analysis is grounded in files from the current checkout.
- Project functions are described by actual modules/routes/pages.
- Architecture summary includes frontend, backend, storage, orchestration, and development workflow boundaries.

---

# TASK-024 Offline QC Validation Workbench

Objective: create the offline single-machine branch `offline/qc-validation-workbench` that keeps data validation and QC workbench flows while hiding or bypassing non-core platform features.

## Agent Role

Lead Agent

## Branch

`offline/qc-validation-workbench`

## Worktrees

- Backend: `../_worktrees/data_platform/backend-offline-core`
- Frontend: `../_worktrees/data_platform/frontend-offline-shell`

## Assigned Scope

- Lead coordination and `.agent/` planning in the main workspace.
- Backend offline mode, health/config defaults, and retained import/QC API behavior in backend worktree.
- Frontend offline shell/routing trim in frontend worktree.
- Offline stack script in main workspace or integration branch.

## Out of Scope

- Desktop packaging.
- Physical deletion of non-core feature modules unless required by references.
- UI redesign of `ImportJobPage`, `QcPage`, `ReviewWorkbenchPage`, `ReviewWorkbenchShell`, or `BBoxOverlay`.
- New dependencies.

## Steps

1. Inspect current backend/frontend entry points and tests.
   - Status: complete.
2. Add failing focused tests for offline health/config and offline route shell.
   - Status: complete.
3. Implement minimal backend offline defaults and single-user behavior.
   - Status: complete.
4. Implement minimal frontend route/nav pruning while preserving retained pages.
   - Status: complete.
5. Add offline stack script.
   - Status: complete.
6. Run focused and integration verification, then merge agent branches.
   - Status: complete.

## Acceptance Criteria

- `/health` exposes offline mode, data root, and state root when offline mode is enabled.
- Offline startup defaults avoid Docker/PostgreSQL/Redis.
- Frontend navigation exposes only `数据校验` and `质检工作台` in offline mode.
- Existing import/QC/review page components and interactions are not redesigned.
- `scripts/offline-stack.sh start|stop|status|urls` exists.
- Relevant backend/frontend checks are run or documented if unavailable.

---

# TASK-026 Offline Manual ZIP Import Gate

Objective: remove default offline dataset loading and make the single-machine flow start from manual ZIP upload, then verify data validation and QC remain usable.

## Agent Role

Lead Agent

## Branch

`offline/qc-validation-workbench`

## Assigned Scope

- Lead planning and verification in main workspace.
- Backend/script changes in backend worktree if product backend behavior changes.
- Frontend route/shell/upload-entry changes in frontend worktree if product UI changes.

## Out of Scope

- Rewriting `ImportJobPage`, `QcPage`, or review workbench UI.
- Adding new dependencies.
- Desktop packaging.
- Supporting local-directory default loading in offline startup.

## Steps

1. Reproduce and inspect current offline startup/import/QC path.
   - Status: complete.
2. Add focused failing tests for no default data root and reachable offline ZIP upload entry.
   - Status: complete.
3. Implement minimal script/backend/frontend changes through agent worktrees.
   - Status: complete.
4. Verify upload -> validation -> confirm -> QC queue flow with focused tests or smoke checks.
   - Status: complete.
5. Merge verified worktree changes and summarize exact local test commands.
   - Status: complete.

## Acceptance Criteria

- `scripts/offline-stack.sh start` no longer defaults to reading `DATASET/urban_violation`.
- Offline mode can start with only `OFFLINE_LABEL_CONFIG_PATH=$PWD/label_config.json` and state root.
- Manual ZIP upload entry is reachable in offline UI.
- After uploaded batch import confirmation, QC queue can be generated/read by `offline_reviewer`.
- Existing retained page interactions are not redesigned.

---

# TASK-027 Offline 0508 ZIP End-to-End Verification

Objective: use `DATASET/0508_797.zip` as the manual-upload validation data and verify the offline single-user upload, import validation, QC queue, and visual review workflow end to end.

## Agent Role

Lead/QA Agent

## Branch

`offline/qc-validation-workbench`

## Steps

1. Confirm current branch, clean offline runtime, ZIP existence, and ZIP structure.
   - Status: complete.
2. Restart offline stack with limits large enough for the 1.4G ZIP.
   - Status: complete.
3. Upload `DATASET/0508_797.zip` through the offline archive API.
   - Status: complete.
4. Verify import job validation/confirmation state and generated batch metadata.
   - Status: complete.
5. Generate/read QC queue and confirm `offline_reviewer` assignment.
   - Status: complete.
6. Browser-verify import validation page, QC page, and one sample review visualization.
   - Status: complete.
7. Record evidence and final status.
   - Status: complete.

## Acceptance Criteria

- Uploaded batch is created from `DATASET/0508_797.zip` into offline state, not from default data-root loading.

---

# TASK-028 Offline QC Generic Entry Fix

Objective: fix the offline blank QC screen caused by opening the dataset-type QC URL instead of the uploaded batch QC URL.

## Agent Role

Lead/Frontend Agent

## Branch

`offline/qc-validation-workbench`

## Worktree

- Frontend: `../_worktrees/data_platform/frontend-offline-qc-entry`

## Steps

1. Reproduce generic `/datasets/urban_violation/qc` behavior and identify the failing API path.
   - Status: complete.
2. Add a focused frontend route regression test.
   - Status: complete.
3. Implement minimal offline redirect from generic QC entry to the first uploaded batch, or upload entry if none exists.
   - Status: complete.
4. Update stack URL output so it no longer advertises the broken generic QC URL.
   - Status: complete.
5. Run focused tests, build/syntax checks, and browser smoke.
   - Status: complete.

## Acceptance Criteria

- Opening `/datasets/urban_violation/qc` in offline mode no longer lands on a blank/error workspace.
- If uploaded batches exist, the generic QC entry redirects to `/datasets/<batch_id>/qc`.
- If no uploaded batch exists, the generic QC entry redirects to `/datasets/types/urban_violation?create=batch`.
- Existing uploaded batch QC and review URLs remain unchanged.
- Import/validation evidence shows expected images and stage1/stage2 records from the ZIP.
- QC queue is available for the uploaded batch and assigned to `offline_reviewer`.

---

# TASK-029 Offline Branch Hardening and Non-Core Cleanup

Objective: fix the offline branch as the single-machine validation/QC product line and remove or stop loading code unrelated to the current offline flow.

## Agent Role

Lead Agent

## Branch

`offline/qc-validation-workbench`

## Worktrees

- Frontend: `../_worktrees/data_platform/frontend-offline-cleanup`
- Backend: `../_worktrees/data_platform/backend-offline-cleanup`

## Cleanup Boundary

Keep:
- ZIP upload and dataset-type batch entry needed to create local batches.
- Import validation page and import job actions.
- QC queue/workspace.
- Review workbench, bbox overlay, drafts, autosave, validate, submit/confirm.
- Label config loading because review validation depends on it.
- Offline single-user auth/current-user health path.

Remove or stop loading:
- Dataset center/general overview/assets/preannotations.
- Account/users/RBAC/audit UI and management flows.
- Sample pool/export/evaluation/snapshot/version-history UI.
- Docker/PostgreSQL/Redis-first runtime paths from offline entrypoints.

## Steps

1. Audit current frontend and backend references for non-core offline code.
   - Status: complete.
2. Add focused failing tests for frontend offline route surface and backend offline blocked non-core endpoints.
   - Status: complete.
3. Implement frontend cleanup in frontend worktree.
   - Status: complete.
4. Implement backend cleanup/route blocking in backend worktree.
   - Status: complete.
5. Integrate reviewed changes into main offline branch.
   - Status: complete.
6. Verify import upload -> validation -> QC -> review remains intact.
   - Status: complete.

## Acceptance Criteria

- Offline frontend router no longer imports non-core pages into the main route surface.
- Offline navigation exposes only data validation and QC workbench.
- Non-core backend endpoints are unavailable or explicitly blocked in offline single-user mode.
- Existing verified `0508_797` offline workflow still renders import/QC/review pages.
- No new dependencies.
- Browser can render the import validation page, QC queue page, and sample review page with image/bbox visualization.

---

# TASK-030 Offline Physical Prune

Objective: physically delete non-core offline branch code, tests, API client methods, and shared types while preserving manual ZIP import, validation, QC, and review workbench.

## Agent Role

Lead Agent

## Branch

`offline/qc-validation-workbench`

## Worktrees

- Frontend: `../_worktrees/data_platform/frontend-offline-prune`
- Backend: `../_worktrees/data_platform/backend-offline-prune`

## Assigned Scope

- Lead coordination, integration, and final verification in the main workspace.
- Frontend deletion and API/type pruning in the frontend worktree.
- Backend route/schema/service/test pruning in the backend worktree.

## Out of Scope

- UI redesign of retained import/QC/review workbench pages.
- Deleting user `label_config.json`, DATASET inputs, or `.runtime` evidence.
- Adding new dependencies.

## Steps

1. Create TASK-030 worktrees and per-agent handoff files.
   - Status: complete.
2. Trim frontend routes, pages, API client, shared types, and frontend tests.
   - Status: complete.
3. Trim backend routes, schemas, service/state methods, and backend tests.
   - Status: complete.
4. Merge worktree branches into the offline branch.
   - Status: complete.
5. Run focused frontend, backend, and live offline verification.
   - Status: complete.

## Acceptance Criteria

- Offline UI exposes only ZIP upload/data validation, QC queue, and sample review.
- Frontend API client and shared types no longer export non-core platform methods/types.
- Backend no longer registers non-core platform routes.
- Non-core tests are removed or rewritten into retained offline-flow tests.
- Existing verified `0508_797` offline workflow still works after restart.

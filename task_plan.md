# Urban Violation Platform Task Plan

Last compacted: 2026-05-19

## Objective

Build and validate a local urban-violation dataset management and QC platform around the real `DATASET/` inputs. The platform must support dataset type and batch management, manual batch import, label-config upload/activation, preannotation/QC lifecycle, multi-user assignment, and a focused sample review workbench.

## Workspace Rule

The main workspace is now the orchestration, documentation, integration-review, and accepted-code sync surface.

Product frontend/backend development must happen in the dedicated agent worktrees first:

- Frontend agent: `../data_platform_frontend_agent`
- Backend agent: `../data_platform_backend_agent`
- Integration agent: `../data_platform_integration_agent`

After human review and verification, accepted changes are synchronized into the main workspace. The main workspace may still maintain docs, plans, scripts, and integration evidence.

## Current Source Of Truth

- General project governance: `AGENTS.md`
- Current documentation map: `docs/README.md`
- Frontend architecture: `docs/frontend/README.md`
- Backend architecture: `docs/backend/README.md`
- Overall architecture: `docs/architecture/README.md`
- Historical architecture inputs: consolidated into `docs/`
- Dataset fixture and test data: `DATASET/`
- Agent-stack launcher from main: `scripts/agent-dev-stack.sh`
- Main-stack launcher for accepted code: `scripts/dev-stack.sh`

## Product Boundaries

- Dataset type is the shared schema/config boundary, for example `urban_violation` and future `ares_detection`.
- Dataset batch is the execution boundary for import, assets, preannotations, QC queue, assignment, leases, drafts, submissions, and progress.
- Label config is type-scoped and inherited by batches.
- QC queues are generated explicitly per concrete batch after import/preannotation readiness and active label config availability.
- The current sample review workbench layout and bbox behavior are protected unless the user explicitly asks to modify it.
- Raw `DATASET/` files should remain readonly. Runtime state should use `PLATFORM_STATE_ROOT` or another platform state root.

## Current Phase Status

| Area | Status | Notes |
| --- | --- | --- |
| Git/worktree setup | Complete | Main plus frontend/backend/integration worktrees exist. |
| Real dataset registration | Complete | `DATASET/urban_violation` registered as the main fixture. |
| QC review workbench | Complete/protected | Focused single-screen review UI, bbox editing, zoom, color semantics, Relation/Candidate layout, and bottom action bar are accepted. |
| Label field editing | Complete baseline | Validate, save draft, submit modification, and field legality validation exist. |
| Label config upload | Complete/hardened | Frontend upload, validate, upload-update, active read, suggestions, reload, readonly unique history, duplicate-content reuse, same-version conflict, and runtime root isolation are implemented. |
| Dataset management | Complete baseline | Dataset type plus batch model, manual batch scan/register/ingest, assets, import job, preannotation, and QC queue generation are implemented. |
| Multi-user collaboration | Complete baseline | Internal accounts, sessions, RBAC, batch assignment, leases, private drafts, submissions, qc_lead confirmation, and audit are implemented. |
| User center | Complete baseline | `/account`, `/account/permissions`, `/account/audit`, topbar entry, permission guards, and legacy redirects are implemented. |
| Frontend architecture repair | P0 complete | Route reuse refresh, batch-switch cache cleanup, dataset type/batch semantic aliases, and focused tests are integrated. P1/P2 remain. |
| QC closed loop | Planned | The PDF方案 is adapted as a backend-derived snapshot/diff pipeline, not frontend-only event capture. |
| Main-workspace governance | Complete | `AGENTS.md` and `scripts/agent-dev-stack.sh` added. |

## Protected Review Workbench Rules

Do not modify these without explicit user approval:

- `frontend/src/features/review-workbench/**`
- `frontend/src/shared/components/BBoxOverlay.vue`
- `frontend/src/test/bboxOverlay.test.ts`

Protected behavior:

- Bbox values are 0-1000 quantized coordinates.
- Image aspect ratio determines the rendered stage; bbox positions are percentages of that stage.
- Default bbox line width is 2px; selected state changes color only unless the user asks otherwise.
- Default colors must exclude red, black, and the reserved unreferenced color.
- Unreferenced Relation boxes use purple and turn red only when explicitly selected in the image evidence area.
- The review page stays chrome-free and review-focused.
- Bottom bar actions are `跳过样本`, `校验修改`, `保存草稿`, `提交修改`.
- `校验修改` checks field legality only; it does not save, submit, or judge semantic correctness.

## Active Backlog

### P0 - Keep Stable

- Before any new frontend/backend product change, synchronize main into the corresponding agent worktree.
- Use `scripts/agent-dev-stack.sh` to run agent worktree code for review.
- After implementation agents finish, use integration validation against the combined frontend/backend product before syncing accepted code into main.
- After every service-based verification, stop frontend/backend services and check no tracked local listeners remain.

### P0 - Documentation Split And Login Design

Status: completed as documentation/design.

Goal:

- Split frontend and backend documentation so neither side depends on a single large README.
- Organize frontend documentation by page hierarchy.
- Organize backend documentation by API module.
- Design an independent login page where users must authenticate before entering the platform.

Output:

- Frontend index: `docs/frontend/README.md`.
- Frontend page documents:
  - `docs/frontend/pages/login.md`;
  - `docs/frontend/pages/dataset-type-pages.md`;
  - `docs/frontend/pages/batch-workspace-pages.md`;
  - `docs/frontend/pages/sample-review.md`;
  - `docs/frontend/pages/sample-pool.md`;
  - `docs/frontend/pages/user-center.md`.
- Frontend shared documents:
  - `docs/frontend/shell-and-navigation.md`;
  - `docs/frontend/shared-components-and-states.md`;
  - `docs/frontend/api-and-permissions.md`.
- Backend index: `docs/backend/README.md`.
- Backend API modules under `docs/backend/modules/`.

Independent login design:

- `/login` is a full-screen standalone page outside `AppShell`.
- Protected routes redirect to `/login?redirect=<target>` when no current user exists.
- Login success routes to the original target or `/datasets`.
- Login design uses a restrained technical operations style with Chinese UI text, high-contrast form fields, explicit loading/error states, and optional dev user switch only in dev/fixture mode.

Implementation note:

- Product implementation must be assigned to the frontend agent worktree if the design is approved for build.

### P0 - Independent Login Page Implementation

Status: complete. Frontend agent implementation was verified and synchronized into the main workspace.

Goal:

- Implement `/login` as a standalone full-screen page outside `AppShell`.
- Preserve existing protected-route guard behavior: unauthenticated users go to `/login?redirect=<target>`.
- Preserve login success redirect to the original target or `/datasets`.
- Keep all visible login UI text in Chinese and match the restrained technical platform style documented in `docs/frontend/pages/login.md`.

Frontend agent scope:

- `frontend/src/app/App.vue`
- `frontend/src/features/auth/LoginPage.vue`
- `frontend/src/test/routesAndPages.test.ts`
- Minimal shared style edits only if required.

Guardrails:

- Do not touch protected review workbench files.
- Do not change backend contracts or dependencies.
- Keep dev user switch available only in existing dev/fixture mode.

Acceptance:

- `/login` renders without sidebar/topbar/app shell.
- Protected routes still redirect unauthenticated users to login with `redirect`.
- Login success returns to redirect target or `/datasets`.
- Login failure shows an error state without entering the platform.
- Frontend tests and build pass in the frontend agent worktree before synchronization.
- Main `dev-stack` and `agent-dev-stack` default to session auth with anonymous dev auth disabled, so the local platform also requires login.

Verification:

- Frontend agent: `npm run test -- routesAndPages` passed with 67 tests.
- Frontend agent: `npm run test` passed with 105 tests.
- Frontend agent: `npm run build` passed.
- Main workspace: `cd frontend && npm run test -- routesAndPages` passed with 67 tests.
- Main workspace: `cd frontend && npm run test` passed with 105 tests.
- Main workspace: `cd frontend && npm run build` passed.
- Main browser smoke: unauthenticated `/datasets` redirected to `/login?redirect=/datasets`; login page rendered without app shell/sidebar/topbar; login with `platform_admin` entered `/datasets`.

### P0 - QC Batch Assignment Repair

Status: complete. Frontend/backend agent worktree fixes were implemented, integration-tested, and synchronized into the main workspace.

Root cause:

- `QcPage` uses `/api/users` to populate assignee options.
- `/api/users` is gated by `users:manage`, while batch assignment managers normally only need `batch_assignment:manage`.
- When `/api/users` returns 403, `QcPage` silently falls back to the current user only, so `qc_lead`/`batch_manager` cannot select annotators even though the backend assignment API can assign a known active user.
- `releaseBatchAssignment` sends no body, but backend release route requires `BatchAssignmentActionRequest`; live API returns 422.
- Assignment actions do not surface action-level API errors, making failures appear as no-op.

Implemented fix:

- Backend added `GET /api/datasets/{dataset_id}/qc/assignable-users`, scoped by `batch_assignment:manage` on the concrete batch and limited to active users.
- `/api/users` remains admin-only behind `users:manage`.
- Backend release accepts an empty/no-body request and frontend sends `{}` for compatibility.
- `QcPage` now uses the assignment-scoped user endpoint, keeps disabled users out, and shows pending/success/error messages for assign/reassign/release.
- Backend/frontend tests cover scoped assignee listing, release, user-directory permission boundary, frontend selector loading, fallback/error states, and release UI.

Verification:

- Agent integration passed against `../data_platform_backend_agent` and `../data_platform_frontend_agent`.
- Main workspace focused backend: `7 passed, 54 deselected`.
- Main workspace focused frontend: `69 passed`.
- Main workspace full backend: `67 passed`.
- Main workspace frontend build: passed.
- `git diff --check`: passed.
- Protected review workbench diff: empty.

### P1 - Project Test Case Suite Design

Status: completed as architecture specification.

Goal:

- Design a functionally complete project-level test case suite.
- Define a concrete `>90%` boundary-coverage denominator and release threshold.
- Cover backend API, frontend component/route behavior, integration smoke, browser smoke, multi-user/RBAC, dataset import, label editing, QC closed loop, export/evaluation, service hygiene, and protected review-workbench behavior.

Output:

- `docs/architecture/README.md` now contains `Project Test Case Suite`.
- The suite defines 182 required domain-boundary points and a minimum automated target of 170 points, giving a target boundary coverage of 93.4%.
- Test cases are organized as backend API cases, frontend cases, integration/E2E cases, boundary checklist, and required quality gates.

Acceptance:

- Future frontend/backend implementation tasks can be assigned against the matrix without inventing a new coverage model.
- Main workspace remains orchestration/documentation-only; product test implementation still happens in the relevant agent worktrees before sync.

### P0 - Admin Batch Deletion

Status: complete. Frontend/backend agent worktree fixes were implemented, integration-tested, and synchronized into the main workspace.

Goal:

- Add a destructive batch deletion action on the batch overview page.
- The action is visible and executable only for administrator accounts.
- Deletion requires a second confirmation dialog before the backend call.
- Raw files under `DATASET/` must not be deleted.

Backend contract:

- Add `DELETE /api/datasets/{dataset_id}` for registered dataset batches only.
- Built-in fixture datasets and dataset-type ids must not be deletable through this endpoint.
- Require a dedicated `dataset_batch:delete` permission granted only to `platform_admin`.
- Delete platform runtime state for the batch:
  - registered batch summary,
  - registered runtime,
  - active/import jobs for that batch,
  - accepted dataset id,
  - mutable QC state under `PLATFORM_STATE_ROOT/qc/{dataset_id}`,
  - batch sample-pool entries if present.
- Preserve audit history and raw source files.

Frontend contract:

- Add `deleteDatasetBatch(batchId)` to the API client.
- In `DatasetOverviewPage.vue`, show a destructive `删除批次` action only when current user has `dataset_batch:delete` or is `platform_admin`.
- Open a confirmation modal/drawer with batch id, batch name, and a warning that source files are not deleted but platform state will be removed.
- Require an explicit second confirmation action before calling the API. Prefer typing the batch id or checking a confirm control before enabling the final button.
- On success, navigate to `/datasets/types/{datasetType}` or `/datasets` if the type cannot be resolved.
- On 403/404/409, show Chinese error feedback.

Acceptance:

- `platform_admin` can delete a registered batch and it disappears from dataset list/type detail.
- `dataset_admin`, `batch_manager`, `qc_lead`, and `annotator` cannot delete the batch.
- Deleting a built-in fixture dataset or dataset type id returns conflict/not allowed.
- Deletion removes QC assignment/tasks/leases/drafts/submissions/snapshots/evaluations/modification event state for that batch.
- Protected review workbench files remain untouched.

Verification:

- Agent integration passed against `../data_platform_backend_agent` and `../data_platform_frontend_agent`.
- Main workspace focused backend: `6 passed, 58 deselected`.
- Main workspace focused frontend: `74 passed`.
- Main workspace full backend: `70 passed`.
- Main workspace full frontend: `90 passed`.
- Main workspace frontend build: passed.
- `git diff --check`: passed.
- Protected review workbench diff: empty.

### P0 - 0520 Preannotated Batch QC Queue Repair

Status: complete. Backend agent worktree fix was implemented, integration-tested, and synchronized into the main workspace.

Problem:

- `urban_violation__urban_violation_0520` is persisted as `Imported` and `preannotation_ready`, but QC queue generation returns `source_not_ingested`.
- Runtime hydration is failing internally and being collapsed into the generic missing-runtime error.
- Current failure evidence:
  - STEP1 manifest contains retry/failure history rows with `status=failed`.
  - `Stage1ManifestEntry` only accepts successful STEP1 rows and aborts on the first failed history row.
  - STEP1 final state is still valid: all 505 unique STEP1 ids have final success rows.
  - STEP2 has 496 final successes, 8 final failures, and 1 STEP1-success sample missing from STEP2 manifest.

Backend repair contract:

- Parse STEP1 manifest rows using deterministic last-write-wins semantics, matching the STEP2 reader behavior.
- Support STEP1 failed/retry rows without aborting the whole manifest read.
- Keep samples whose final STEP1 state is successful.
- Exclude or diagnose samples whose final STEP1 state is failed; do not create normal QC label samples from them.
- Prevent missing STEP2 rows from breaking whole-batch runtime hydration. Represent them as `stage2_missing` diagnostics or skip them from queueable QC items while preserving import diagnostics.
- Improve QC generation/import diagnostics so hydration failures do not surface only as `Batch source must be ingested before QC queue generation.`

Acceptance:

- `DATASET/urban_violation_0520` can hydrate a registered runtime from `stage1_run_0520` / `stage2_run_0520`.
- QC queue generation for `urban_violation__urban_violation_0520` succeeds after active label config is available.
- Generated queue includes STEP2 success and STEP2 failure samples as supported by the current QC workflow, and handles the one missing STEP2 sample deterministically.
- Existing fixture behavior for `DATASET/urban_violation` remains unchanged.
- Backend parser/API tests cover STEP1 failed retry rows, final STEP1 failure handling, missing STEP2 handling, and the 0520 registered-batch flow.
- Protected review workbench files remain untouched.

Verification:

- Backend agent full test suite: `74 passed`.
- Integration agent live API: `POST /api/datasets/urban_violation__urban_violation_0520/qc/generate` returned `200`, queue `total=505`, status distribution `success=496`, `failure=9`.
- Main workspace parser tests: `8 passed`.
- Main workspace focused API tests: `3 passed, 63 deselected`.
- Main workspace full backend tests: `74 passed`.
- Main workspace frontend route/API tests: `74 passed`.
- Main workspace frontend build: passed.
- `git diff --check`: passed.
- Protected review workbench diff: empty.
- Dev services were stopped and ports `8000/5173/18031/15195` were released.

### P1 - QC Review Keyboard Shortcuts

Status: completed.

Goal:

- Add keyboard shortcuts for high-frequency sample review operations without changing the accepted visual layout of the QC review workbench.
- Use the accepted batch-draft/batch-submit lifecycle: shortcuts must never turn batch finalization into an instant action.

Suspension note:

- Previous shortcut work was paused until `保存草稿` and `提交修改` were reworked into batch-draft and batch-submit actions.
- Batch-draft/batch-submit lifecycle is now implemented and verified, so implementation may resume.
- Batch submit still remains modal-confirmed only; no instant submit shortcut is approved.

Shortcut contract:

- Previous sample: `ArrowLeft` or `A`.
- Next sample: `ArrowRight` or `D`.
- Skip sample: `X`.
- Validate edits: `V`.
- Save draft: `S`.
- Submit edits: none. `提交批次修改` remains a mouse/touch/modal-confirmed final action.

Guardrails:

- Shortcuts are active only on the sample review route.
- Shortcuts are ignored while focus is in text inputs, selects, textareas, contenteditable nodes, buttons, or while IME composition is active.
- Pending validate/save/submit blocks duplicate shortcut execution.
- Shortcuts must use the same disabled logic as visible buttons.
- Dirty navigation or skip must not silently discard unsaved edits; use the same save-before-leave or non-destructive guard as visible controls.
- `Ctrl/Cmd+S` is reserved by browsers for saving the page. Do not bind it in the first implementation; if product later enables it, the handler must call `preventDefault()` only inside the review route and only outside editable fields.
- Relation selection should remain click-first through image bbox or relation index buttons; do not add Relation keyboard cycling in the first implementation.
- No persistent visible shortcut legend should be added to the review canvas.

Implementation task shape:

- Frontend agent updated the review-workbench shortcut handling in the frontend worktree.
- Tests cover key handling, disabled gates, input-focus ignore behavior, dirty/save guard, no `Ctrl/Cmd+S`, and no submit shortcut.
- Integration checks verified keyboard flow on the live review route.

Acceptance:

- Keyboard navigation moves to previous/next queue sample and keeps the silent refresh behavior.
- Bottom bar shortcut actions call the same handlers as visible buttons.
- `校验修改` still validates only.
- `保存草稿` maps to batch draft persistence, not a single-sample-only save.
- `提交批次修改` has no instant shortcut and remains modal-confirmed.
- The first implementation does not bind `Ctrl/Cmd+S`, so browser save-page behavior remains untouched.
- Text editing in Relation/Candidate fields is not interrupted by letter shortcuts.
- Protected bbox behavior and accepted review layout remain unchanged.

Verification:

- Frontend agent: `npm run test -- routesAndPages` passed, `npm run test` passed, `npm run build` passed.
- Main workspace: `cd frontend && npm run test` passed, `cd frontend && npm run build` passed, `git diff --check` passed.
- Browser smoke confirmed `S` saves batch draft, `D` moves to the next sample, `V` validates only, `Ctrl/Cmd+S` and `Ctrl/Cmd+Enter` do not trigger review actions, editable-field focus ignores letter shortcuts, and submit remains button/modal confirmed.

### P0 - QC Review Draft Autosave And Batch Submission Redesign

Status: completed.

Goal:

- Redesign the QC review bottom bar so draft persistence covers all operator edits in the current assigned batch, and final submit represents completion of the entire batch QC modification work.
- Preserve the accepted single-screen review layout and bbox behavior.

Current mismatch:

- `保存草稿` currently posts only the active sample patch to `POST /api/datasets/{batch_id}/samples/{sample_id}/label-edits` with `submitAction=save_draft`.
- `提交修改` currently validates and submits only the active sample patch with `submitAction=submit_changes`, then releases only the active sample lease.
- This does not match the intended workflow where the operator works through a batch and submits the whole batch only after all required samples are reviewed.

Target interaction contract:

- `跳过样本`: leave current sample without submitting; if dirty edits exist, trigger save-before-leave or an explicit non-destructive confirmation.
- `校验修改`: validate field legality for the current sample only; no save, no submit, no status finalization.
- `保存草稿`: manually persist all dirty sample drafts in the current batch review session. It should include the current sample plus any previously modified samples tracked by the batch draft workspace.
- Auto-save: every 2-5 minutes while dirty edits exist; default design target is 3 minutes. It must not submit, must avoid overlapping saves, and must surface last-save/error status in the bottom bar.
- `提交修改`: rename in UI to `提交批次修改` or equivalent. It opens a confirmation modal and finalizes the entire assigned batch only when required draft saves and field validations pass.

Frontend task shape:

- Add a batch draft workspace state above the active sample editor: dirty sample ids, validation state, save status, last autosave time, failed autosave reason, and batch submit readiness.
- Keep local edits responsive while autosave is pending; do not blank or remount the review screen during autosave.
- Bottom bar should show compact status chips: current sample change count, batch draft saved count, autosave state, validation issue count.
- Manual `保存草稿` should flush all dirty sample drafts and update the batch draft status chip.
- `提交批次修改` should open a modal with total tasks, saved drafts, unsaved dirty samples, validation errors, skipped/unmodified samples, and final confirmation.
- Disable batch submit when autosave is pending, dirty edits are unsaved, validation has errors, assignment is missing, label config is missing, or current user is not the batch assignee.

Backend/API task shape:

- Keep the existing sample-level validate endpoint for current-sample legality checks.
- Add or extend batch draft APIs so the frontend can persist and reload a user's batch-level draft manifest.
- Add a batch submit endpoint that atomically finalizes the assigned batch and records a batch-level submission/audit record.
- Batch submit should create or reference per-sample submissions from saved drafts, mark the batch assignment/submission as submitted for lead review, and reject stale revisions or missing required validations.
- Autosave writes must remain draft-only and idempotent.

Acceptance:

- Restarting frontend/backend preserves the user's saved batch draft progress.
- Auto-save runs within the configured 2-5 minute window only when there are dirty edits.
- Save draft never marks the batch or sample as final submitted.
- Batch submit cannot complete with unsaved dirty edits or validation errors.
- Successful batch submit produces one durable batch-level finalization record and an audit event.
- The current accepted review layout, bbox rendering, zoom/pan, and field editor placement remain unchanged.

Execution assignment:

- Backend agent worktree: `/mnt/lc/LC/ares_xtws/0_train_data/data_platform_backend_agent`, branch `agent/backend-implementation`.
- Frontend agent worktree: `/mnt/lc/LC/ares_xtws/0_train_data/data_platform_frontend_agent`, branch `agent/frontend-implementation`.
- Frontend and backend handoffs are complete.
- Main workspace must not directly edit product frontend/backend code for this task.

Integration result:

- Frontend request/response payloads were corrected to match the backend `entries[]` and `submit-batch` contracts.
- Live agent-stack API smoke verified batch draft read/save/autosave, blocked submit, missing-config non-500 handling, and successful batch submit after activating the test label config.
- Headless Chrome CDP smoke verified the review page renders the new bottom-bar chips/buttons and opens the batch submit confirmation modal.
- Main workspace regression checks passed: backend pytest, frontend Vitest, frontend build, and `git diff --check`.

### P1 - Project Test Case Suite Execution

Status: completed by integration/test agent.

Execution:

- Test agent executed static checks, backend pytest, frontend Vitest/build, main-stack smoke, and supplemental browser automation.
- Browser verification used Playwright/system Chrome automation because Chrome MCP was not available in the current tool surface.
- Test report saved at `test_reports/project_test_report_2026-05-20.md`.

Result:

- Backend: `60 passed`; `tests/test_manifest_parser.py`: `6 passed`; `tests/test_api.py`: `54 passed`.
- Frontend: `82 passed` across 6 test files; build passed.
- Integration smoke: `scripts/integration-smoke.sh main` passed.
- Supplemental browser checks passed for dataset routes, label-config route, permission console, and review page bbox visibility.
- Estimated automated boundary coverage: `170 / 182 = 93.4%`.
- Services were stopped and ports `8000/5173/18031/15195` were confirmed released.

### P1 - Frontend Architecture Repair

Source plan: `docs/frontend/README.md`

Remaining work:

- Split the large API adapter into clearer dataset, batch, import, label-config, QC, account, and audit clients.
- Improve asset browsing filters and batch-level browsing efficiency.
- Improve QC queue throughput page behavior without touching the sample review page.
- Consolidate status dictionaries and Chinese UI copy.
- Remove demo-default leakage from audit and role-binding pages.

Acceptance:

- Existing review workbench tests remain unchanged and passing.
- Route/API tests cover non-review route refresh and batch context.
- `npm run test` and `npm run build` pass in the frontend agent worktree before main sync.

### P1 - Label Config Persistence Idempotency

Status: completed and accepted into main.

Problem:

- Restart/reload does not create new versions, but saving the same content repeatedly creates duplicate `label-config-N` versions because backend save is not content-hash idempotent.

Required behavior:

- Identical content save should reuse the existing version by default.
- Explicit new-version creation must require a request flag and frontend action such as `另存为新版本`.
- Manual `重新加载 active` must never create a version.
- Runtime config root should not default to raw `DATASET/` if the dataset must remain strictly input-only; this can be completed as the next hardening phase if it requires broader startup behavior changes.

Backend tasks:

- Add a save request flag, recommended name `save_as_new_version`, default `false`.
- Make label config repositories lookup existing versions by `content_hash` for the dataset type.
- When saving identical content with `save_as_new_version=false`, return the existing stored config; if `activate=true`, activate the existing config instead of creating a duplicate.
- When `save_as_new_version=true`, create a new version even if the content hash matches an existing version.
- Preserve reload behavior: active reload reads active pointer and never creates a version.
- Update backend tests for duplicate save, activate-on-duplicate, reload after restart, and explicit new-version save.

Frontend tasks:

- Add a visible manual `另存为新版本` action or toggle in `LabelConfigUploadPanel`.
- Default `保存配置` should be idempotent and not request a new version.
- Send `saveAsNewVersion/save_as_new_version` only when the user explicitly chooses the new-version action.
- Surface reused-version status in user-facing Chinese copy without implying a new version was created.
- Update API client types, fixtures, and route/API tests.

Integration/test tasks:

- Run backend and frontend unit tests.
- Run `scripts/integration-smoke.sh agent` after both implementation agents finish.
- Add or run a focused live API smoke for repeated label config save count stability if not already covered by unit tests.

Dispatch status:

- Backend agent: completed implementation and backend tests in `../data_platform_backend_agent`.
- Frontend agent: completed implementation and frontend tests in `../data_platform_frontend_agent`.
- Integration/test agent: passed protected-file checks, backend/frontend tests, agent stack smoke, live API idempotency verification, browser smoke for `另存为新版本`, and service shutdown checks.
- Main workspace: synchronized accepted code, passed backend/frontend tests, passed `scripts/integration-smoke.sh main`, and confirmed services/ports released.

### P1 - Label Config History Deduplication And Runtime Store Hardening

Status: completed and accepted into main.

Problem:

- Historical versions must remain available for comparison.
- The same label config version/content must not appear multiple times.
- Current historical data shows repeated `label-config-*` records with identical `content_hash`, `version`, and `file_name`.
- The old default runtime path can write label-config state into `DATASET/urban_violation/label_configs` when `LABEL_CONFIG_STORE_ROOT` is not set.
- Existing UI still exposes `另存为新版本` and per-row `激活`, which encourages version-history operations instead of a simple manual upload/update workflow.

Target behavior:

- Keep a version history, but define one unique history item as one semantic config version.
- Same `content_hash` for the same dataset type always reuses the existing config entry.
- Same `config.version` with different `content_hash` should not silently create a second row with the same version label. It must return a clear `version_conflict` unless an explicit user action changes the version field.
- A new history entry is created only when a manually uploaded config has a new `config.version` and new `content_hash`.
- Upload/save should activate the accepted current config by default.
- History rows are comparison/read-only entries; historical activation should be removed unless a future rollback feature is explicitly designed.
- Runtime label config state should default to `.runtime/label_config_state`, not raw `DATASET/`.
- A one-time cleanup/migration should collapse duplicate historical entries, preserving one active entry and moving/removing redundant same-hash records from runtime state.

Backend tasks:

- Treat the normal save API as a manual upload/update operation. `save_as_new_version` may remain accepted for backward compatibility, but it must not create a duplicate same-hash row.
- Add repository lookup by `content_hash` and by `config.version`.
- For duplicate `content_hash`: return existing config and activate it if requested.
- For duplicate `config.version` but different hash: return 409 `label_config_version_conflict`.
- For new version+hash: create a new history record and archive previous active.
- Fix active pointer consistency so `registry.json` and `active.json` cannot diverge.
- Add a migration/repair function for duplicate persisted configs that preserves one canonical entry and moves, ignores, or rewrites redundant same-hash rows without mutating raw `DATASET/`.
- Change dev/runtime default store root away from `DATASET/`; update backend factory defaults and stack scripts so `.runtime/label_config_state` is used when `LABEL_CONFIG_STORE_ROOT` is omitted.
- Add backend tests for duplicate hash, duplicate version different hash, new version, active pointer consistency, migration repair, restart persistence, and default root isolation.

Frontend tasks:

- Remove `另存为新版本` from the normal label-config management UI.
- Rename primary action to `上传并更新配置` or `保存并激活配置`.
- Keep history visible as comparison records, but remove row-level `激活` unless rollback is later designed.
- Show duplicate-content reuse as `配置未变化，已复用当前版本`.
- Show duplicate-version conflict as a clear instruction to bump `version` inside the uploaded JSON.
- Update API types/adapters so the frontend no longer sends `saveAsNewVersion` in normal operation.
- Keep all visible copy Chinese.

Integration/test tasks:

- Start from a dirty historical store containing duplicate same-hash entries and verify repair collapses duplicates.
- Upload same file twice and verify version count stays stable.
- Upload changed config with same `version` and verify 409 conflict.
- Upload changed config with bumped `version` and verify one new history entry plus active pointer update.
- Verify no writes occur under raw `DATASET/` when using dev stack defaults.
- Browser verify `/datasets/types/urban_violation/label-config` shows `上传并更新配置`, does not show `另存为新版本`, and has no history-row `激活`.
- Stop all main/agent services after validation and confirm ports `8000/5173/18031/15195` are released.

Dispatch status:

- Backend agent: completed repository semantics, runtime root hardening, repair, API error, stack-script support, and backend tests in `../data_platform_backend_agent`.
- Frontend agent: completed label-config UI/API workflow, follow-up reload-button wording fix, and frontend tests in `../data_platform_frontend_agent`.
- Integration/test agent: passed combined worktree validation after a first UI wording failure was fixed.
- Main workspace: accepted patches synchronized, backend/frontend tests passed, `scripts/integration-smoke.sh main` passed, and services/ports were released.

### P1 - Dataset Type Detail Navigation And Label Config Relocation

Status: completed and accepted into main.

Problem:

- `/datasets` currently combines dataset type selection, batch management, and full label-config editing in one long homepage.
- This does not scale for multiple dataset types such as `urban_violation` and `ares_detection`.
- `label_config` is dataset-type-scoped, but the current UI exposes the full editor directly under every homepage type group.
- Batch overview links type config by hash (`/datasets#label-config-{datasetType}`), which is fragile and not a real child route.

Required behavior:

- `/datasets` becomes the dataset-type landing page: each card summarizes one dataset type and exposes clear entry actions.
- Each dataset type card must show active label config version, field schema version, batch count, and whether label config is missing.
- Full label-config upload/validate/save/version activation UI moves into a dataset-type child management page.
- A dataset-type child page must support direct navigation for at least:
  - Type overview and batch list.
  - Label config management.
  - Creating a batch under that dataset type.
- Batch-scoped routes remain based on concrete batch ids.
- Batch overview should navigate to the dataset-type child label-config route, not to a homepage hash.
- Do not modify protected QC sample review files.

Backend agent tasks:

- Add a focused dataset-type detail API such as `GET /api/dataset-types/{dataset_type}` returning the same `DatasetTypeResponse` shape used in `GET /api/dataset-types`.
- Reuse the existing type grouping logic so the detail response includes display name, field schema version, active label config version, batch count, and batches.
- Return 404 for an unknown dataset type.
- Preserve existing list/create/type-scoped label-config endpoints and idempotent label-config save behavior.
- Add backend tests for existing `urban_violation`, newly created empty `ares_detection`, and unknown type 404.

Frontend agent tasks:

- Add route(s) for dataset-type detail, recommended:
  - `/datasets/types/:datasetType`
  - `/datasets/types/:datasetType/label-config`
- Add API client method for dataset-type detail if the backend endpoint exists; otherwise isolate fallback lookup behind the service layer.
- Refactor `/datasets` so it shows compact dataset-type cards rather than embedding `LabelConfigUploadPanel`.
- Put label config status and a `标签配置` / `管理类型配置` action inside each dataset type card.
- Move `LabelConfigUploadPanel` into the dataset-type child page.
- Move or reuse batch creation under the dataset-type child page; the homepage may keep a shortcut, but the full workflow must be available from the child page.
- Update batch overview `typeConfigTarget` to the dataset-type label-config route.
- Keep all visible copy in Chinese and preserve the current tech-minimal management style.
- Do not touch `frontend/src/features/review-workbench/**`, `frontend/src/shared/components/BBoxOverlay.vue`, or `frontend/src/test/bboxOverlay.test.ts`.

Integration/test tasks:

- After backend and frontend agents finish, run protected-file checks, backend tests, frontend tests, and build.
- Run agent stack smoke with fresh `PLATFORM_STATE_ROOT` and `LABEL_CONFIG_STORE_ROOT`.
- Browser-smoke `/datasets` and verify:
  - Dataset type cards for `urban_violation` are visible.
  - The homepage no longer shows the full label config upload/editor table by default.
  - The card contains label config status and navigation action.
- Browser-smoke `/datasets/types/urban_violation/label-config` and verify:
  - The label config panel is visible.
  - Existing active config/version list loads.
  - The current accepted baseline showed `保存配置` and `另存为新版本`; the follow-up hardening phase replaces this with the single `上传并更新配置` path and readonly history.
- Browser-smoke a batch overview whose lifecycle needs config and verify `管理类型配置` opens the child label-config route.
- Stop all services and confirm project ports are released.

Acceptance:

- Multi-type landing page remains useful when `urban_violation` and `ares_detection` both exist.
- Full label config editing is no longer expanded directly on `/datasets`.
- Dataset type child route is deep-linkable and contains the full type-scoped label config workflow.
- Existing batch routes, import creation, QC queue generation, and label-config idempotency tests continue to pass.
- Agent integration validation passes before main workspace synchronization.

Dispatch status:

- Backend agent: completed dataset-type detail API and backend tests in `../data_platform_backend_agent`.
- Frontend agent: completed homepage/type route refactor and frontend tests in `../data_platform_frontend_agent`.
- Integration/test agent: passed protected-file checks, backend/frontend tests, agent stack smoke, live API checks, browser route checks, and service shutdown checks.
- Main workspace: synchronized accepted code, passed backend/frontend tests, passed `scripts/integration-smoke.sh main`, passed live dataset-type API checks, captured browser evidence for dataset home, label-config child route, and create-batch child route, then stopped services and released ports.

### P1 - Permission Management Command Center

Status: completed and accepted into main.

Problem:

- `/account/permissions` currently shows account creation and role binding forms directly on the page.
- Admins must manually type scope ids such as `urban_violation` or `urban_violation__0508_fixture`, which is error-prone.
- Account creation and data permission assignment are not visually separated enough.
- Detailed operations such as create account, edit account, reset password, assign permission, delete binding, and disable user should not all be flattened into the main page.

Required behavior:

- Keep `/account/permissions` as a command center with clear tabs or sections:
  - `账号管理`
  - `数据集权限分配`
  - `角色绑定记录`
- Main page shows summaries, lists, search/filter controls, role/status chips, and primary action buttons.
- Detailed sub-flows open in modals or right-side drawers:
  - Create account.
  - Edit account.
  - Reset password.
  - Assign dataset permission.
  - Binding detail.
  - Delete binding confirmation.
  - Disable/enable account confirmation.
- Account creation only creates identity. Dataset access is granted only through role bindings.
- Dataset permission assignment must guide admins through:
  - Select user.
  - Select target level: platform, dataset type, or dataset batch.
  - Select concrete target.
  - Select role.
  - Preview granted permissions.
  - Submit binding.
- Avoid free-text scope ids where possible:
  - `platform` locks `scopeId` to `*`.
  - `dataset_type` uses dataset type options from backend.
  - `dataset_batch` first selects dataset type, then selects a concrete batch.
- Preserve Chinese visible copy and current tech-minimal management style.
- Do not modify protected QC review files.

Backend agent tasks:

- Add a read-only RBAC catalog endpoint such as `GET /api/rbac/catalog`.
- Catalog should expose roles, role labels or ids, scope types, and each role's permission list so frontend can render permission previews without duplicating backend grant logic.
- Keep machine permission strings authoritative from `ROLE_PERMISSIONS`.
- Add safety guardrails:
  - Prevent disabling the current active user account from the management API.
  - Prevent deleting the current user's own active platform-admin binding if it would remove their management route access, or provide a clear conflict response for self-lockout risk.
- Preserve existing `/api/users` and `/api/role-bindings` contracts.
- Keep existing permission checks: user CRUD requires `users:manage`; role-binding CRUD requires `roles:manage`.
- Add backend tests for catalog, scope/role payload shape, self-disable prevention, duplicate binding conflict, and existing RBAC boundaries.

Frontend agent tasks:

- Refactor `UsersPage.vue` into a command-center layout.
- Implement tabs or equivalent segmented navigation for `账号管理`, `数据集权限分配`, and `角色绑定记录`.
- Implement modal/drawer surfaces for account create/edit/reset, permission assignment, binding detail, delete confirmation, and disable/enable confirmation.
- Use `GET /api/dataset-types` to populate dataset type and batch selectors.
- Use new RBAC catalog endpoint for role permission preview; if unavailable during development, isolate a temporary frontend fallback behind the service layer.
- Show unassigned users clearly as `未分配角色`.
- Data permission assignment drawer must support platform, dataset-type, and dataset-batch scopes without raw typing for normal use.
- Add inline error handling for duplicate binding, invalid scope, and backend validation errors.
- Update API client/types/fixtures/tests.
- Do not touch `frontend/src/features/review-workbench/**`, `frontend/src/shared/components/BBoxOverlay.vue`, or `frontend/src/test/bboxOverlay.test.ts`.

Integration/test tasks:

- After backend/frontend agents complete, run protected-file checks, backend tests, frontend tests, and build.
- Run `scripts/integration-smoke.sh agent`.
- Live API checks:
  - Catalog returns all supported roles and expected permissions.
  - Admin cannot disable their own active account.
  - Duplicate role binding returns conflict.
  - Creating a user and assigning dataset-batch annotator role succeeds.
- Browser checks:
  - `/account/permissions` shows `账号管理`, `数据集权限分配`, and `角色绑定记录`.
  - `新建账号` opens modal/drawer, not an always-visible long form.
  - `分配数据权限` opens assignment drawer.
  - Dataset batch scope can be selected through dataset type -> batch selectors.
  - Permission preview is visible before submit.
  - Delete/disable actions require confirmation.
- Stop all services and confirm project ports are released.

Acceptance:

- Permission management is easier to understand: identity and data access are visibly separated.
- Scope ids are selected through UI controls, not manually typed in normal flows.
- Main page is not overloaded by expanded forms.
- Backend remains the source of truth for role permissions.
- Safety guardrails prevent obvious self-lockout paths.
- Existing account, audit, assignment, and review-workbench tests remain passing.
- Integration validation passes before main workspace synchronization.
- Dispatch status:
  - Backend agent: completed RBAC catalog, self-lockout guardrails, and backend tests in `../data_platform_backend_agent`.
  - Frontend agent: completed `/account/permissions` command-center refactor, drawers/modals, selector-driven scope assignment, RBAC permission preview, and frontend tests in `../data_platform_frontend_agent`.
  - Integration/test agent: passed static checks, backend/frontend tests, agent-stack smoke, live API guardrail checks, browser flow checks, and service shutdown checks.
  - Main workspace: synchronized accepted code, passed backend/frontend tests, passed `scripts/integration-smoke.sh main`, and confirmed project ports released.

Acceptance:

- Repeated save of unchanged config does not append a duplicate version.
- Reload active keeps the same active config id and content hash.
- Tests cover restart, reload, duplicate save, and explicit new-version save.
- Existing review workbench protected files remain unchanged.
- `scripts/integration-smoke.sh agent` passes before main sync.

### P1 - Dataset Batch Product Hardening

- Persist import validation history or clearly separate recalculated validation from audit history.
- Make manual batch source-path warnings clearer when backend cannot read `source_uri`.
- Keep batch QC queue generation explicit and label-config gated.
- Keep batch-scoped state keyed by concrete batch id.

### P1 - QC Closed Loop Phase 1: Snapshots, Diff, Attribution

Design source: `质检闭环整改方案.pdf`, adapted in `docs/architecture/README.md`.

Dispatch status:

- Backend agent: completed Phase 1 backend implementation in `../data_platform_backend_agent`.
- Frontend agent: completed Phase 1 frontend implementation in `../data_platform_frontend_agent`.
- Integration/test agent: completed combined validation after both implementation agents completed.

Backend agent tasks:

- Add annotation snapshot models and file-backed persistence under `PLATFORM_STATE_ROOT`.
- Create baseline snapshots for batch samples after preannotation readiness or QC queue generation.
- During `confirm_submission`, materialize confirmed annotation payloads from accepted label-edit operations and create confirmed snapshots.
- Add deterministic baseline-vs-confirmed diff generation.
- Derive modification events from diff results, with event classes `relation_modify`, `relation_bbox_adjust`, `candidate_category_change`, `candidate_delete`, `candidate_add`, and `candidate_evidence_edit`.
- Add attribution summary APIs scoped by concrete batch id.
- Keep implementation inside `../data_platform_backend_agent`.
- Do not modify protected review-workbench frontend files.

Frontend agent tasks:

- Add readonly `质检分析` tab to the batch overview page.
- Display event counts, attribution distribution, bbox offset bands, changed samples, and reviewer/time filters.
- Do not change the protected sample review workbench layout or bbox behavior.
- Keep implementation inside `../data_platform_frontend_agent`.
- Update frontend API client/types/tests for the new backend contract, but do not implement backend behavior in the frontend worktree.

Integration agent tasks:

- Run a real edit -> submit -> qc_lead confirm flow.
- Assert baseline snapshot, confirmed snapshot, derived events, and attribution stats are generated for the concrete batch id.
- Verify the frontend `质检分析` tab reads the backend-derived stats.
- Start only after frontend/backend implementation agents finish.
- Use `../data_platform_integration_agent` for validation, or run `scripts/agent-dev-stack.sh` from main with explicit worktree overrides if needed.

Acceptance:

- Frontend operation telemetry is not required for authoritative attribution.
- A confirmed edit produces deterministic diff-derived events after qc_lead confirmation.
- Re-running stats does not duplicate snapshots or modification events.
- Existing label edit, assignment, lease, and review workbench tests remain passing.
- Integration validation passed on agent worktree outputs; main sync is pending human review/approval.

### P1 - QC Closed Loop Phase 2: Correction Sample Pool

Dispatch status:

- Backend agent: completed correction sample pool backend implementation in `../data_platform_backend_agent`.
- Frontend agent: completed correction sample pool frontend implementation in `../data_platform_frontend_agent`.
- Integration/test agent: completed combined validation after both implementation agents completed.

Backend agent tasks:

- Add correction sample pool item models and persistence under `PLATFORM_STATE_ROOT`.
- Auto-create or update a pool item when a confirmed sample contains meaningful diff events.
- Provide pool list/detail/stats APIs with filters for dataset type, batch, category, attribution tag, reviewer, and time.
- Reuse Phase 1 confirmed snapshot and modification event outputs as the source of truth.
- Keep pool insertion idempotent for repeated stats reads or repeated workflow checks.

Frontend agent tasks:

- Add a global `修正样本池` navigation entry and page.
- Show pool filters, changed-field summary, attribution tags, source batch, and before/after review entry.
- Keep all visible copy in Chinese and use the current tech-minimal management page style.
- Do not modify protected sample review workbench files.

Integration agent tasks:

- Confirm a changed sample and assert it appears in the sample pool without manual import.
- Verify unchanged confirmed samples do not pollute the pool unless explicitly selected.
- Verify sample pool page reads real backend data from the agent stack.
- Start only after frontend/backend implementation agents finish.

Acceptance:

- Confirmed changed samples appear in the pool using concrete batch id and confirmed snapshot id.
- Pool APIs do not read or mutate raw `DATASET/`.
- UI remains Chinese and uses the current tech-minimal management style.
- Integration validation passed on agent worktree outputs and accepted changes were synchronized into main.

### P2 - QC Closed Loop Phase 3: Training Export

Dispatch status:

- Backend agent: completed training export backend implementation in `../data_platform_backend_agent`.
- Frontend agent: completed training export frontend implementation in `../data_platform_frontend_agent`.
- Integration/test agent: completed combined validation after both implementation agents completed.

Backend agent tasks:

- Add export job models, retention metadata, and generated artifact paths under `PLATFORM_STATE_ROOT`.
- Implement COCO JSON export from correction pool filters first.
- Add VOC XML and custom JSON only after COCO passes validation.
- Use correction sample pool confirmed snapshots as the export source of truth.
- Keep generated artifacts under `PLATFORM_STATE_ROOT`, not `DATASET/`.
- Provide export list/detail/download/cancel APIs without breaking existing export routes.

Frontend agent tasks:

- Add export creation and export task management surfaces under sample-pool workflow.
- Show status, source filter, format, item count, error, and download action.
- Keep this as sample-pool export management; do not add model evaluation UI in this phase.
- Keep all visible copy in Chinese and preserve current management-page style.

Integration agent tasks:

- Create a pool-filtered COCO export and validate that the generated JSON can be parsed and contains expected images/annotations/categories.
- Verify the frontend export UI can create/read/download export jobs against backend APIs.
- Start only after frontend/backend implementation agents finish.

Acceptance:

- Export output is generated from confirmed snapshots, not from unconfirmed drafts.
- Export jobs can be listed, inspected, downloaded, and failed/cancelled without breaking existing export routes.
- Integration validation passed on agent worktree outputs and accepted changes were synchronized into main.

### P2 - QC Closed Loop Phase 4: Evaluation And Version Governance

Dispatch status:

- Backend agent: completed evaluation and version-governance backend implementation in `../data_platform_backend_agent`.
- Frontend agent: completed evaluation and version-history frontend implementation in `../data_platform_frontend_agent`.
- Integration/test agent: completed combined validation after both implementation agents completed.

Backend agent tasks:

- Add evaluation run records, metric summaries, comparison APIs, and changed sample references.
- Add snapshot list and snapshot diff APIs.
- Implement rollback only after exact restore semantics and permission checks are specified and tested.
- Keep rollback disabled or admin-gated unless exact restore tests pass.
- Reuse existing Phase 1 annotation snapshots and Phase 3 export/evaluation concepts; do not write raw `DATASET/`.

Frontend agent tasks:

- Add `模型评估` and `版本历史` tabs to batch overview.
- Display metric deltas, category-level metrics, snapshot timeline, and diff summaries.
- Do not modify the protected sample review workbench.
- Keep visible copy in Chinese and preserve current management-page style.

Integration agent tasks:

- Seed or create evaluation records and verify comparison output.
- Verify snapshot list/diff permissions and exact payload restoration before enabling rollback controls.
- Verify batch overview tabs read real backend data from the agent stack.
- Start only after frontend/backend implementation agents finish.

Acceptance:

- Evaluation comparison shows metric deltas and related changed samples.
- Version history shows import baseline, confirmed annotation snapshots, and model-preannotation snapshots.
- Rollback is gated behind tests and management permissions.
- Integration validation passed on agent worktree outputs; accepted changes are ready for main-workspace synchronization.

### P2 - Integration Test Environment

Status: complete.

Scope:

- This is main-workspace verification infrastructure, not product frontend/backend implementation.
- Keep product UI and backend behavior unchanged unless a smoke script exposes a real blocking defect.

Tasks:

- Add a black-box API smoke script that runs against a live backend URL and verifies the current closed-loop route contracts.
- Add a stack-level smoke runner that can target either accepted main code or frontend/backend agent worktrees.
- Include browser smoke checks for batch overview `模型评估` / `版本历史` and sample-pool `导出管理`.
- Pin or document the Playwright CLI path used by local browser smoke checks.
- Ensure every smoke run stops services and verifies project ports are released.
- Document the new commands in the current docs entry points.

Acceptance:

- `scripts/integration-smoke.sh main` passes against accepted main code.
- The same runner passes with `agent` to validate frontend/backend agent worktrees.
- API smoke asserts concrete route contracts for label edit confirmation, sample pool, training export, evaluation comparison, snapshot diff, rollback-disabled response, and audit action names.
- Browser smoke runs headless and captures evidence artifacts under `.runtime/`.
- Service shutdown gate reports no listeners on project ports after the run.

## Validation Commands

Backend:

```bash
PLATFORM_STATE_ROOT=/tmp/uvp-check uv run pytest
uv run python -m py_compile src/urban_violation_backend/service.py src/urban_violation_backend/routes.py src/urban_violation_backend/api_schemas.py
```

Frontend:

```bash
cd frontend
source ~/.nvm/nvm.sh
nvm use "$(cat ../.nvmrc)"
npm run test
npm run build
```

Agent stack from main:

```bash
scripts/agent-dev-stack.sh start
scripts/agent-dev-stack.sh status
scripts/agent-dev-stack.sh stop
```

Main accepted-code stack:

```bash
scripts/dev-stack.sh start
scripts/dev-stack.sh stop
```

## Service Shutdown Gate

After any live check:

```bash
scripts/dev-stack.sh stop
scripts/agent-dev-stack.sh stop
```

Then verify no project `uvicorn`, Vite, or tracked backend/frontend listener remains on the ports used for the check.

## Completed Milestones

- Documentation and DATASET analysis.
- Worktree and subagent orchestration.
- Backend FastAPI fixture/runtime baseline.
- Frontend Vue runtime/API baseline.
- Full `DATASET/urban_violation` registration.
- Immersive QC sample review redesign and iterative bbox/image fixes.
- QC label editing and label-config upload workflow.
- Dataset type/batch lifecycle, asset browsing, import job orchestration, and manual batch creation.
- Registered-batch QC queue generation.
- Internal account, RBAC, batch assignment, lease, draft, submission, qc_lead confirmation, and audit baseline.
- User center and management route hierarchy.
- Chinese tech-minimal topbar and permission page refinement.
- Frontend architecture P0 repair.
- Main-workspace governance and agent worktree stack script.

## Open Product Decisions

- Whether STEP2 failure entries should enter the normal QC queue by default or a separate remediation queue.
- Whether category/code dictionaries should be displayed only as Chinese labels or preserve machine codes in advanced views.
- Whether future batch keys should be date-only, scene-only, or a combined convention such as `{date}_{scene}`.
- Whether import validation history should become persistent audit data in the first production hardening pass.
- Whether frontend operation telemetry should be added after backend-derived attribution is stable, and which privacy/storage limits it should use.
- Whether rollback should be enabled in the first version-history release or kept as an admin-only recovery operation.

## Autosave Persistence Completion

- Status: complete.
- Backend save/autosave now treats successful persistence as authoritative: returned and reloaded batch draft entries are `dirty=false` and `saved=true`.
- Frontend save/autosave parsing now treats top-level `BatchDraftSummaryResponse` as authoritative `result.draft`.
- Frontend fallback merge no longer reuses the original dirty request payload as saved state.
- Acceptance verified:
  - dirty autosave payload returns `saved_count=1`, `dirty_count=0`;
  - reloading `my-batch-draft` preserves `saved=true`, `dirty=false`;
  - batch submit readiness no longer remains blocked by stale dirty flags after successful save/autosave.

## Autosave Scheduling Optimization

- Replaced fixed idle autosave interval with dirty-only one-shot scheduling.
- Added stale in-flight save protection: if a sample changes while autosave is pending, the older response cannot mark the newer draft as saved.
- Added frontend regression coverage for dirty-only autosave and stale autosave response handling.

## Autosave Interval Control Completion

- Status: complete.
- Added bottom-bar autosave interval control with `1分钟`, `2分钟`, `3分钟`, and `5分钟` options.
- Default remains `3分钟`; the reviewer selection is stored locally in the browser.
- Changing the interval while dirty reschedules the next autosave without cancelling any in-flight save request.

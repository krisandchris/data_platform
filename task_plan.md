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
| Label config upload | Complete baseline | Frontend upload, validate, save, activate, active read, suggestions, reload are implemented. Duplicate-version idempotency remains a backlog item. |
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
  - `保存配置` and `另存为新版本` remain present.
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

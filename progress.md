# Progress

Last compacted: 2026-05-19

This file now records only current project progress and recent verification context. Detailed historical phase logs are preserved in git history.

## Current State

- Main workspace is initialized as a git worktree with dedicated frontend, backend, and integration agent worktrees.
- `AGENTS.md` now defines main-workspace governance: product frontend/backend code work should be done in agent worktrees first, then reviewed and synchronized into main.
- `scripts/init-agent-worktrees.sh` initializes or repairs the standard backend, frontend, and integration agent worktrees from the main workspace.
- `scripts/agent-dev-stack.sh` starts and stops frontend/backend code from the agent worktrees for human review.
- `scripts/dev-stack.sh` remains the launcher for accepted main-workspace code.
- Current accepted code includes dataset management, import jobs, asset browsing, preannotations, QC queue, sample review, label editing, label config upload/reload, multi-user assignment, user center, permissions, and audit baseline.
- Current documentation has been organized under `docs/README.md`, `docs/frontend/README.md`, `docs/backend/README.md`, and `docs/architecture/README.md`.

## Latest Work

### Agent Worktree Initialization

- Added `scripts/init-agent-worktrees.sh` to create, status-check, and sync the standard backend, frontend, and integration agent worktrees.
- Added documentation entries in `AGENT_WORKTREES.md` and `docs/README.md`.
- Recorded durable initialization facts in `findings.md` and `task_plan.md`.
- Initial execution exposed that requiring a clean main workspace blocks first-time initialization while the initializer itself is still uncommitted; adjusted this to warn and continue because new worktrees are created from the configured `BASE_REF`.
- Ran `scripts/init-agent-worktrees.sh init`; backend, frontend, and integration worktrees were created at commit `2db902a` on their expected branches and are clean.
- `DATASET` links were skipped because neither the default `./DATASET` nor the older documented shared dataset path exists in this environment. Re-run with `DATASET_SOURCE=/actual/DATASET` when the dataset location is available.

### Rejected_Data_0518 Run-Through

- Started validation for dataset root `/mnt/data1/Project/XTS/data_platform/dataset/Rejected_Data_0518`.
- Dataset layout is `images/`, `stage1/`, and `stage2/` with manifests under `stage1/meta/manifest.jsonl` and `stage2/meta/manifest.jsonl`.
- Current importer discovery only accepts `stage1_run_*` and `stage2_run_*`, so the backend agent must add compatibility for exact `stage1`/`stage2` run directories before the stack can ingest this dataset.
- Backend agent added importer compatibility for exact `stage1` and `stage2` directories while preserving preference for named `stage*_run_*` directories.
- Real data import check passed in the backend agent worktree: `505` imported assets, `496` STEP2 successes, `8` STEP2 failure artifacts, and one missing STEP2 manifest row handled as the existing `Stage2MissingError` path.
- Focused new backend tests passed: `2 passed`.
- Synchronized the backend importer compatibility fix into the main workspace.
- Added `dataset/` to `.gitignore` so local large input data under lowercase `dataset/` is not accidentally tracked.
- Main workspace verification passed:
  - `uv run pytest tests/test_manifest_parser.py::test_discover_stage_run_dir_accepts_exact_stage_directory tests/test_manifest_parser.py::test_discover_stage_run_dir_prefers_named_run_directory`: 2 passed.
  - Real data import check: `505` assets, `496` STEP2 successes, `8` STEP2 failure artifacts.
  - `git diff --check`: passed.
- Main stack was started with `DATASET_ROOT=/mnt/data1/Project/XTS/data_platform/dataset/Rejected_Data_0518` and isolated runtime roots under `.runtime/rejected-data-0518`.
- Live checks passed:
  - `GET /health`: 200.
  - `GET /api/datasets`: fixture batch reports `total_assets=505`, `stage1_count=505`, `stage2_success_count=496`, `stage2_failure_count=8`.
  - Session login as `platform_admin` succeeded.
  - Built-in `urban_violation` label config saved and activated for dataset type `urban_violation`.
  - `POST /api/datasets/urban_violation__0508_fixture/qc/generate`: 200 with `505` QC tasks.
  - First sample review detail returned 2 relations and 1 candidate.
  - First asset image URL returned `200 image/jpeg`.
  - Frontend `/login` returned 200.
- Stack remains running for user review at backend `http://127.0.0.1:8000` and frontend `http://127.0.0.1:5173`.

### Review Label Display And Segmentation Target Refinement

- Confirmed backend built-in relation label config does not expose `occupying`; it exposes only `占据` with English label `occupies`.
- Confirmed `Rejected_Data_0518` raw STEP data contains legacy relation code `occupying` (`636` stage1 parsed occurrences and `627` stage2 parsed occurrences), while `占据` does not appear in raw parsed relation values.
- Implemented frontend display compatibility so legacy `occupying` relation values render as `占据`.
- Added `motor_vehicle` / `机动车` to segmentation target options next to `nonmotor_vehicle` / `非机动车` in backend built-in label config and frontend fixtures/display mappings.
- Added backend tests for built-in label config relation/segmentation target expectations.
- Added frontend review-workbench route test coverage for displaying legacy `occupying` as `占据` and showing `motor_vehicle` as `机动车`.
- Verification passed:
  - Backend agent: `uv run pytest tests/test_builtin_label_config.py tests/test_label_config_repository_contract.py`: 5 passed.
  - Frontend agent: `npm run test -- src/test/routesAndPages.test.ts`: 76 passed.
  - Main workspace backend: same focused backend tests, 5 passed.
  - Main workspace frontend: same focused frontend test, 76 passed.
  - `git diff --check`: passed.

## Latest Completed Work

### QC Closed Loop Phase 1 Main Sync

- Synchronized the verified frontend/backend Phase 1 outputs from agent worktrees into the main workspace.
- Main workspace verification passed:
  - `PLATFORM_STATE_ROOT=/tmp/uvp-qc-loop-main uv run pytest`: 44 passed.
  - `cd frontend && npm run test`: 61 passed.
  - `cd frontend && npm run build`: passed.
- Confirmed protected review workbench files have no diff.
- Stopped main and agent stacks; service status reports stopped and checked ports were released.
- Committed the accepted code as `c4cae28 feat: add qc closed-loop phase1`.
- Fast-forwarded frontend, backend, and integration agent worktrees to `c4cae28` after preserving their accepted Phase 1 dirty states in stashes.

### QC Closed Loop Phase 2 Dispatch

- Started Phase 2: correction sample pool.
- Backend agent is assigned to implement pool models, persistence, idempotent auto-insertion after qc_lead confirmation, and pool list/detail/stats APIs.
- Frontend agent is assigned to add the global `修正样本池` page, navigation entry, filters, stats, table, and review entry links.
- Integration/test agent remains queued until both implementation agents complete.
- Backend Phase 2 implementation completed in the backend agent worktree: added correction sample pool persistence, auto-insertion after qc_lead confirmation, list/detail/stats/manual upsert/soft-delete APIs, and backend tests; reported `45 passed`.
- Frontend Phase 2 implementation completed in the frontend agent worktree: added `/sample-pool`, AppShell navigation, filters, stats, table, API client/types, and tests; reported `67 passed` and build passing.
- Integration/test agent is now ready to validate the combined Phase 2 frontend/backend worktree products.
- Integration/test agent completed Phase 2 validation successfully:
  - Backend full test suite passed: 45 tests.
  - Backend sample-pool focused tests were rerun 5 times without failures.
  - Frontend test suite passed: 67 tests.
  - Frontend build passed.
  - Agent stack launched backend `18031` and frontend `15195`.
  - `/api/sample-pool`, `/api/sample-pool/stats`, item detail, manual upsert, and soft delete were reachable.
  - Online flow confirmed edit -> submit -> qc_lead confirm -> sample-pool insertion.
  - Browser screenshot smoke confirmed `/sample-pool` loads.
  - Protected review workbench files were not modified.
  - Services were stopped and checked ports were released.
- Non-blocking validation notes:
  - A temporary integration script initially assumed `relation_id` exists in stage1 relation payloads; the stable review contract uses scopes like `relation:R1`.
  - Reusing a populated `PLATFORM_STATE_ROOT` can cause expected assignment/lease 409s because each batch has one active assignee.

### QC Closed Loop Phase 2 Main Sync

- Synchronized the verified Phase 2 frontend/backend outputs from agent worktrees into the main workspace.
- Main workspace verification passed:
  - `PLATFORM_STATE_ROOT=/tmp/uvp-sample-pool-main uv run pytest`: 45 passed.
  - `cd frontend && npm run test`: 67 passed.
  - `cd frontend && npm run build`: passed.
- Confirmed protected review workbench files have no diff.
- Stopped main and agent stacks; service status reports stopped and checked ports were released.
- Committed the accepted code as `f333fae feat: add qc correction sample pool`.
- Fast-forwarded frontend, backend, and integration agent worktrees to `f333fae` after preserving their accepted Phase 2 dirty states in stashes.

### QC Closed Loop Phase 3 Dispatch

- Started Phase 3: training export.
- Backend agent is assigned to implement export job state, COCO JSON generation from correction sample pool confirmed snapshots, artifact retention metadata, and export APIs.
- Frontend agent is assigned to implement sample-pool export creation/task management/download UI.
- Integration/test agent remains queued until both implementation agents complete.
- Backend Phase 3 implementation completed in the backend agent worktree: added export job state, COCO JSON artifact generation, list/detail/download/cancel APIs, compatibility for the legacy dataset export route, and backend tests; reported `47 passed`.
- Frontend Phase 3 implementation completed in the frontend agent worktree: added sample-pool export management UI, export API client/types, task table, download/cancel actions, and tests; reported `71 passed` and build passing.
- Integration/test agent completed Phase 3 validation successfully:
  - Backend full test suite passed: 47 tests.
  - Backend COCO export targeted chain was rerun 5 times without failures.
  - Frontend test suite passed: 71 tests.
  - Frontend build passed.
  - Agent stack launched backend `18031` and frontend `15195`.
  - Online flow created an active pool item, created a COCO export job, read details, downloaded artifact, and parsed `info/images/annotations/categories`.
  - Export artifact was written under `PLATFORM_STATE_ROOT/exports/artifacts`, not `DATASET/`.
  - Browser screenshot smoke confirmed `/sample-pool` renders the `导出管理` area.
  - Protected review workbench files were not modified.
  - Services were stopped and checked ports were released.
- Non-blocking validation note: an initial verification script used older export request fields and correctly received 422; the accepted contract is `format`, `source_type`, and `filters`.

### QC Closed Loop Phase 3 Main Sync

- Synchronized the verified Phase 3 frontend/backend outputs from agent worktrees into the main workspace.
- Main workspace verification passed:
  - `PLATFORM_STATE_ROOT=/tmp/uvp-export-main uv run pytest`: 47 passed.
  - `cd frontend && npm run test`: 71 passed.
  - `cd frontend && npm run build`: passed.
- Confirmed protected review workbench files have no diff.
- Stopped main and agent stacks; service status reports stopped and checked ports were released.
- Committed the accepted code as `202d11f feat: add qc training export`.
- Fast-forwarded frontend, backend, and integration agent worktrees to `202d11f` after preserving their accepted Phase 3 dirty states in stashes.

### QC Closed Loop Phase 4 Dispatch

- Started Phase 4: model evaluation feedback and annotation version governance.
- Backend agent is assigned to implement evaluation run records, metric summaries, comparison APIs, changed sample references, snapshot list/diff APIs, and rollback only if exact restore tests pass.
- Frontend agent is assigned to add `模型评估` and `版本历史` surfaces to batch overview with metric deltas, snapshot timeline, and diff summaries.
- Backend Phase 4 implementation completed in the backend agent worktree: added evaluation persistence, metric comparison and delta-sample APIs, snapshot list/diff APIs, rollback-disabled audit path, and backend tests; reported `49 passed`.
- Frontend Phase 4 implementation completed in the frontend agent worktree: added `模型评估` and `版本历史` batch overview surfaces, evaluation/snapshot API client types, comparison/delta-sample UI, rollback-disabled messaging, and tests; reported `74 passed` and build passing.
- Integration/test agent is now ready to validate the combined Phase 4 frontend/backend worktree products.
- Integration/test agent completed Phase 4 validation successfully:
  - Backend full test suite passed: 49 tests.
  - Frontend full test suite passed: 74 tests.
  - Frontend build passed.
  - Agent stack launched backend `18031` and frontend `15195`.
  - Online API flow verified evaluation create/list/detail/compare/delta-samples.
  - Online snapshot flow verified snapshot list/diff after confirmed sample modification.
  - Rollback endpoint returned `501 rollback_disabled`, confirming rollback is disabled rather than fake-successful.
  - Browser screenshot smoke confirmed batch overview renders `模型评估` and `版本历史`.
  - Protected review workbench files were not modified.
  - Services were stopped and checked ports were released.

### QC Closed Loop Phase 4 Main Sync

- Synchronized the verified Phase 4 frontend/backend outputs from agent worktrees into the main workspace.
- Main workspace verification passed:
  - `PLATFORM_STATE_ROOT=/tmp/uvp-eval-version-main uv run pytest`: 49 passed.
  - `cd frontend && npm run test`: 74 passed.
  - `cd frontend && npm run build`: passed.
- Main accepted-code stack smoke passed:
  - `scripts/dev-stack.sh start` launched backend `8000` and frontend `5173`.
  - `GET /health` returned 200.
  - Browser screenshot smoke confirmed batch overview renders `模型评估` and `版本历史`.
- Confirmed protected review workbench files have no diff.
- Confirmed `质检闭环整改方案.pdf` is not tracked.
- Stopped main and agent stacks; service status reports stopped and checked ports were released.

### QC Closed Loop Plan Adaptation

- Analyzed `质检闭环整改方案.pdf` against the current dataset/QC architecture.
- Reframed modification behavior capture as backend-derived snapshot diff after qc_lead confirmation, with frontend operation telemetry kept as optional auxiliary context.
- Added the closed-loop development plan to `docs/architecture/README.md`.
- Added P1/P2 closed-loop implementation phases to `task_plan.md`.
- Recorded durable closed-loop findings and risks in `findings.md`.

### QC Closed Loop Task Dispatch

- Confirmed `质检闭环整改方案.pdf` is not a tracked project file and added it to local git exclude.
- Backed up stale dirty states in the three agent worktrees with stash entries:
  - `stash@{2}` frontend implementation backup before QC closed-loop task assignment.
  - `stash@{1}` backend implementation backup before QC closed-loop task assignment.
  - `stash@{0}` integration testing backup before QC closed-loop task assignment.
- Fast-forwarded frontend, backend, and integration agent worktrees to main commit `de83ee5`.
- Prepared Phase 1 task dispatch: backend implements snapshot/diff/attribution APIs; frontend implements readonly `质检分析` tab and API client/types; integration waits until both implementation agents finish.
- Frontend implementation agent completed: added readonly `质检分析` overview area, API client/types, fixtures, and Vitest coverage; reported `npm run test` and `npm run build` passing.
- Backend implementation agent completed: added snapshot/diff/modification-event/stats APIs and backend tests; reported full `PLATFORM_STATE_ROOT=/tmp/uvp-qc-loop-be uv run pytest` passing with 44 tests.
- Integration/test agent is now ready to validate the combined frontend/backend worktree products.
- Integration/test agent completed validation successfully:
  - Backend full test suite passed: 44 tests.
  - Backend closed-loop targeted test passed.
  - Backend full suite was rerun 5 times without failures.
  - Frontend test suite passed: 61 tests.
  - Frontend build passed.
  - Agent stack launched backend `18031` and frontend `15195`.
  - Health endpoint and the three new QC closed-loop APIs returned 200.
  - Browser screenshot smoke confirmed the batch overview renders the `质检分析` area.
  - Protected review workbench files were not modified.
  - `质检闭环整改方案.pdf` is not tracked.
  - Services were stopped and project ports were released.
- Known validation note: `scripts/agent-dev-stack.sh stop` may occasionally need a second stop/process cleanup pass before ports are released; the final validation state was clean.

### Documentation Compaction

- Replaced long historical `task_plan.md`, `progress.md`, and `findings.md` with compact current-state versions.
- Added current documentation entry points:
  - `docs/README.md`
  - `docs/frontend/README.md`
  - `docs/backend/README.md`
  - `docs/architecture/README.md`
- Removed earlier detailed design and implementation docs from `docs/` after consolidating durable content into the then-current compact documentation set.
- Removed the historical architecture-input folder after consolidating durable architecture content into the current `docs/` entry documents.
- Expanded `docs/frontend/README.md` into the current frontend interface specification, including page inventory, navigation, per-page layout diagrams, data fields, core components, interaction/exception states, API integration, permissions, and operation boundaries.
- Prepared the current main-workspace project state for a git commit snapshot after documentation cleanup and frontend documentation consolidation.

### Main Workspace Governance

- Added `AGENTS.md`.
- Added `scripts/agent-dev-stack.sh`.
- The agent stack defaults to backend port `18031` and frontend port `15195`.
- `BACKEND_WORKTREE` and `FRONTEND_WORKTREE` can override agent worktree paths.
- `start`, `stop`, `restart`, `status`, `logs`, and `urls` are supported.

### Frontend Architecture P0 Repair

- Integrated route-reuse refresh support.
- Added stale-request protection through `useAsyncState`.
- Cleared asset image failure cache on batch switch.
- Added semantic aliases/wrappers for dataset type id and dataset batch id.
- Preserved protected review workbench files.
- Latest recorded verification:
  - `npm run test -- routesAndPages apiClient`: 41 passed.
  - `npm run build`: passed.

### User Center And Chinese UI Refinement

- `/account`, `/account/permissions`, and `/account/audit` are implemented.
- Topbar user chip links to `/account`.
- Permission and audit child pages are capability-gated.
- Legacy `/users` and `/audit` redirect into the account hierarchy.
- Topbar and permissions surfaces were refined into Chinese tech-minimal UI.
- Latest recorded verification:
  - Frontend full test suite: 53 passed.
  - Frontend production build: passed.

### Multi-User Baseline

- Internal accounts, session login, scoped RBAC, batch assignment, sample lease, private draft, immutable submission, qc_lead confirm/return, and audit events are implemented.
- Batch assignment is batch-scoped and one active assignee per batch.
- A sample has only one active editor at a time.
- `submitted` waits for qc_lead confirmation.
- Runtime state uses `PLATFORM_STATE_ROOT` for smoke/test runs.
- Latest recorded backend verification after user-center work:
  - Full backend test suite: 43 passed.

### Dataset Management Baseline

- Dataset type and dataset batch are separate product levels.
- `urban_violation` and future types such as `ares_detection` are same-level dataset types.
- Label config is type-scoped and inherited by batches.
- Manual batch registration supports:
  - images-only directory
  - images plus STEP1/STEP2 output directory
- Batch scanner counts only business artifacts:
  - `images/**/*`
  - `stage1_run_*/parsed/**/*.json`
  - `stage2_run_*/parsed/**/*.json`
  - `stage2_run_*/failures/**/*.json`
- Registered batches with STEP outputs require explicit QC queue generation.
- QC task/progress/lease/draft/submission state is keyed by concrete batch id.

### QC Review Workbench Baseline

- Review route is chrome-free and focused.
- Image evidence area supports direct bbox editing, wheel zoom, middle-button drag after zoom, and quantized bbox projection.
- Relation and Candidate panels use the accepted right-side layout.
- Bottom action bar uses:
  - `跳过样本`
  - `校验修改`
  - `保存草稿`
  - `提交修改`
- Review layout and bbox behavior are now protected.

## Known Remaining Work

- Complete frontend architecture P1/P2 packages recorded in `docs/frontend/README.md`.
- Move default label/config/runtime persistence away from raw `DATASET/` unless explicitly configured.
- Harden manual batch import validation and source-path diagnostics.

### Label Config Idempotency Dispatch

- Started next development stage: `P1 - Label Config Persistence Idempotency`.
- Current root cause confirmed from code:
  - Backend `LabelConfigSaveRequest` only has `activate`.
  - Repository `save()` always increments and writes a new `label-config-N`.
  - Frontend `LabelConfigUploadPanel` only has a normal `保存配置` action and no explicit `另存为新版本` flow.
- Development split:
  - Backend agent owns request contract, repository idempotency, persistence behavior, and backend tests.
  - Frontend agent owns upload panel action/copy, API payload flag, fixtures, and frontend tests.
  - Integration/test agent starts only after both implementation agents finish and must run the agent stack smoke.
- Backend implementation task dispatched to backend agent worktree.
- Frontend implementation task dispatched to frontend agent worktree.
- Backend agent completed implementation:
  - Added `save_as_new_version: bool = False`.
  - Default duplicate save now reuses existing content hash and config id.
  - `activate=true` on duplicate activates the existing version.
  - Explicit `save_as_new_version=true` creates a new config id.
  - Reported focused label-config tests `13 passed, 35 deselected`, full backend `54 passed`, and `git diff --check` passing.
- Frontend agent completed implementation:
  - Default `保存配置` remains idempotent and does not send `save_as_new_version`.
  - Added explicit `另存为新版本` action that sends `save_as_new_version: true`.
  - Updated fixture API and frontend tests.
  - Reported focused frontend tests `58 passed`, build passing, `git diff --check` passing, and protected review workbench files unchanged.
- Integration/test agent validated the combined backend/frontend agent worktree outputs:
  - Protected review workbench files remained unchanged.
  - `质检闭环整改方案.pdf` was not tracked.
  - Backend focused label-config tests passed: `13 passed, 35 deselected`.
  - Backend full tests passed: `54 passed`.
  - Frontend focused tests passed: `58 passed`.
  - Frontend build passed.
  - `scripts/integration-smoke.sh agent` passed.
  - Live API idempotency check confirmed default duplicate save reuses `label-config-1`, explicit `save_as_new_version:true` creates `label-config-2`, and active reload does not increase the version count.
  - Browser smoke found `另存为新版本`.
  - Agent/main stack services were stopped and ports released.
- Main workspace sync and verification passed:
  - Accepted backend/frontend worktree diffs were applied to main.
  - `PLATFORM_STATE_ROOT=/tmp/uvp-label-idempotency-main LABEL_CONFIG_STORE_ROOT=/tmp/uvp-label-idempotency-main-labels uv run pytest tests/test_api.py -k "label_config"`: `13 passed, 35 deselected`.
  - `PLATFORM_STATE_ROOT=/tmp/uvp-label-idempotency-main-full LABEL_CONFIG_STORE_ROOT=/tmp/uvp-label-idempotency-main-labels-full uv run pytest`: `54 passed`.
  - `cd frontend && npm run test -- apiClient routesAndPages`: `58 passed`.
  - `cd frontend && npm run build`: passed.
  - `SMOKE_RUNTIME_DIR=/tmp/uvp-label-idempotency-main-smoke scripts/integration-smoke.sh main`: passed.
  - `scripts/dev-stack.sh stop`, `scripts/agent-dev-stack.sh stop`, and project port check confirmed no remaining tracked listeners.

### Integration Test Environment Dispatch

- Started next stage: `P2 - Integration Test Environment`.
- Confirmed this stage is allowed in the main workspace because it adds orchestration and verification scripts, not product frontend/backend implementation.
- Read `planning-with-files` and `webapp-testing` skill guidance.
- Discovery findings:
  - The AGENTS skill path points to the old `~/.codex/skills/...` location; actual available skill path is `/home/hy/.agents/skills/planning-with-files/SKILL.md`.
  - Current accepted main stack uses backend `8000` and frontend `5173`.
  - Current agent stack uses backend `18031` and frontend `15195`.
  - `npx playwright --version` reports `1.60.0` in the current environment.
  - Live smoke should use a fresh `PLATFORM_STATE_ROOT` to avoid stale assignment/lease conflicts.
- First `scripts/integration-smoke.sh main` attempt failed at active label config inheritance because only `PLATFORM_STATE_ROOT` was isolated; backend label-config store still used the default persistent root.
- Fix applied: smoke runner now also sets a fresh `LABEL_CONFIG_STORE_ROOT`, and API smoke explicitly activates the saved config id before continuing.
- Added `scripts/integration-api-smoke.py` for live backend route-contract validation.
- Added `scripts/integration-smoke.sh` for main/agent stack orchestration, API smoke, Playwright screenshot smoke, service stop, and port checks.
- Documented the integration smoke workflow in `docs/README.md`, `docs/architecture/README.md`, `docs/frontend/README.md`, and `docs/backend/README.md`.
- Verification passed:
  - `bash -n scripts/integration-smoke.sh`
  - `uv run python -m py_compile scripts/integration-api-smoke.py`
  - `git diff --check`
  - `scripts/integration-smoke.sh main`
  - `scripts/integration-smoke.sh agent`
  - `PLATFORM_STATE_ROOT=/tmp/uvp-integration-env-main LABEL_CONFIG_STORE_ROOT=/tmp/uvp-integration-env-labels uv run pytest`: 49 passed.
  - `cd frontend && npm run test`: 74 passed.
  - `cd frontend && npm run build`: passed.
- Smoke artifacts were produced under `.runtime/integration-smoke-main/artifacts` and `.runtime/integration-smoke-agent/artifacts`.
- Services were stopped and checked ports were released after both smoke runs.

## Current Verification Discipline

For backend changes:

```bash
PLATFORM_STATE_ROOT=/tmp/uvp-check uv run pytest
```

For frontend changes:

```bash
cd frontend
source ~/.nvm/nvm.sh
nvm use "$(cat ../.nvmrc)"
npm run test
npm run build
```

For agent worktree review:

```bash
scripts/agent-dev-stack.sh start
scripts/agent-dev-stack.sh status
scripts/agent-dev-stack.sh stop
```

For accepted main code:

```bash
scripts/dev-stack.sh start
scripts/dev-stack.sh stop
```

## Service State

After the latest main verification, both stack stop commands were run and checked project ports were released.

## Dataset Center Design Audit

- Checked current dataset center routing and implementation:
  - `/datasets` renders `DatasetsPage.vue`.
  - `/datasets/:id/overview`, `/assets`, `/import-jobs/:jobId`, `/preannotations`, `/qc`, and sample review are batch-scoped routes.
  - There is no dedicated dataset-type detail/config route yet.
- Verified current UI by opening `/datasets` in the running main stack and capturing `/tmp/uvp-dataset-home-design.png`.
- Observed that the homepage embeds `LabelConfigUploadPanel` directly under each dataset type group.
- Conclusion recorded: this is acceptable only as a short-term single/few-type implementation. For multi-type management, label config should be an entry inside each dataset type card and open a dataset-type child management page.
- Stopped both dev and agent stacks and confirmed tracked project ports were released.

## Dataset Type Detail Dispatch

- Started implementation stage: `P1 - Dataset Type Detail Navigation And Label Config Relocation`.
- Development split:
  - Backend agent owns dataset-type detail API and backend tests.
  - Frontend agent owns route/page refactor, homepage card behavior, child label-config page, and frontend tests.
  - Integration/test agent starts only after both implementation agents finish and must validate the combined agent worktree outputs.
- Main workspace remains orchestration-only for this product change.
- Backend task dispatched to `../data_platform_backend_agent`.
- Frontend task dispatched to `../data_platform_frontend_agent`.
- Backend agent completed implementation:
  - Added `GET /api/dataset-types/{dataset_type}`.
  - Reused dataset-type response construction for list/detail.
  - Unknown type returns 404.
  - Reported `17 passed, 34 deselected` for focused `dataset_type or label_config` tests, full backend `57 passed`, and `git diff --check` passing.
- Frontend agent completed implementation:
  - Added `/datasets/types/:datasetType` and `/datasets/types/:datasetType/label-config`.
  - `/datasets` now renders dataset-type cards and no longer expands the full label config editor by default.
  - Added `DatasetTypePage` and reusable batch panel.
  - Moved full label config workflow into the type child route.
  - Updated batch overview type-config link to the child route.
  - Added `getDatasetType(datasetType)` with temporary fallback to list filtering for unsupported detail endpoints.
  - Reported focused frontend tests `61 passed`, build passing, `git diff --check` passing, and protected review workbench files unchanged.
- Integration validation checklist prepared:
  - Protected QC review files must have no diff.
  - Backend focused and full pytest must pass.
  - Frontend focused tests and build must pass.
  - Agent stack smoke must pass with fresh `PLATFORM_STATE_ROOT` and `LABEL_CONFIG_STORE_ROOT`.
  - Browser must verify `/datasets` shows dataset type cards without the full label config editor.
  - Browser must verify `/datasets/types/urban_violation/label-config` shows the label config workflow.
  - Browser must verify batch overview links to the dataset-type label-config route.
  - All services must be stopped and checked ports released.
- Integration/test agent dispatched to validate the combined backend/frontend agent worktree outputs.
- Integration/test agent validated the combined backend/frontend agent worktree outputs:
  - Protected review workbench files remained unchanged.
  - `质检闭环整改方案.pdf` was not tracked.
  - Backend focused tests passed: `17 passed, 34 deselected`.
  - Backend full tests passed: `57 passed`.
  - Frontend focused tests passed: `61 passed`.
  - Frontend build passed.
  - `scripts/integration-smoke.sh agent` passed.
  - Live API confirmed `GET /api/dataset-types/urban_violation` 200 with batches, created `ares_detection` detail 200 with zero batches, and unknown type 404.
  - Browser confirmed `/datasets` shows type cards and does not show `标签配置上传` by default.
  - Browser confirmed `/datasets/types/urban_violation/label-config` shows the full label config workflow.
  - Browser confirmed `/datasets/types/urban_violation?create=batch` opens batch creation.
  - Browser confirmed batch overview links `管理类型配置` to `/datasets/types/urban_violation/label-config`.
  - Agent/main stack services were stopped and ports released.
- Main workspace sync and verification passed:
  - Accepted backend/frontend worktree diffs were applied to main.
  - `PLATFORM_STATE_ROOT=/tmp/uvp-type-detail-main-be LABEL_CONFIG_STORE_ROOT=/tmp/uvp-type-detail-main-labels uv run pytest tests/test_api.py -k "dataset_type or label_config"`: `17 passed, 34 deselected`.
  - `PLATFORM_STATE_ROOT=/tmp/uvp-type-detail-main-be-full LABEL_CONFIG_STORE_ROOT=/tmp/uvp-type-detail-main-labels-full uv run pytest`: `57 passed`.
  - `cd frontend && npm run test -- apiClient routesAndPages`: `61 passed`.
  - `cd frontend && npm run build`: passed.
  - `SMOKE_RUNTIME_DIR=/tmp/uvp-type-detail-main-smoke scripts/integration-smoke.sh main`: passed.
  - Extra live API check on main passed for `urban_violation`, newly created `ares_detection`, and unknown type 404.
  - Extra browser evidence captured:
    - `/tmp/uvp-type-detail-main-datasets.png`
    - `/tmp/uvp-type-detail-main-label-config.png`
    - `/tmp/uvp-type-detail-main-create-batch.png`
  - `scripts/dev-stack.sh stop`, `scripts/agent-dev-stack.sh stop`, and project port check confirmed no remaining tracked listeners.
- Verification tool note:
  - Attempting a temporary Node script with `import { chromium } from 'playwright'` failed because the project does not install the Playwright package as an importable dependency.
  - Attempting `npx playwright test` against a temporary spec failed because `@playwright/test` was not resolvable for that temp runner path.
  - The verification path was changed to the already working `npx playwright screenshot` CLI with route selectors and full-page screenshots.

## Permission Management Design Review

- Reviewed current permission-management implementation and backend RBAC contract.
- Captured current UI evidence:
  - `/tmp/uvp-permissions-page.png`
  - `/tmp/uvp-account-page.png`
- Confirmed `/account/permissions` is protected by `users:manage` or `roles:manage`.
- Confirmed current page design:
  - Left panel manages internal accounts.
  - Right panel manages scoped role bindings.
  - Account center shows management entry only when the current user has management capability.
- Confirmed backend operation boundaries:
  - User list/create/update require `users:manage`.
  - Role binding list/create/delete require `roles:manage`.
  - Audit viewing remains separate under `/account/audit`.
- Stopped both dev and agent stacks and confirmed tracked project ports were released.

## Account And Dataset Permission Logic Redesign

- Reworked the permission-management interaction design around clarity and ease of use.
- Updated `docs/frontend/README.md` with:
  - Recommended tab structure: `账号管理`, `数据集权限分配`, `角色绑定记录`.
  - Processing logic that separates account creation from data access grants.
  - Dataset permission flow: select user -> select target level -> select concrete target -> select role -> preview permissions -> submit.
  - Main-page vs modal/drawer responsibilities so detailed sub-features are not flattened into the page.
  - Scope UI rules for `platform`, `dataset_type`, and `dataset_batch`.
  - Recommended role presets for platform owner, dataset admin, batch manager, annotator, qc lead, and auditor.
  - Error/empty/duplicate-binding states.
- No frontend/backend product code was modified in this step.
- Added explicit guidance that account creation, account editing, password reset, dataset permission assignment, binding detail, delete confirmation, and disable confirmation should use modal or drawer surfaces.

## Permission Management Command Center Dispatch

- Started implementation stage: `P1 - Permission Management Command Center`.
- Development split:
  - Backend agent owns RBAC catalog endpoint, self-lockout guardrails, conflict behavior, and backend tests.
  - Frontend agent owns `/account/permissions` command-center refactor, tabs, drawers/modals, selector-driven scope assignment, permission preview, and frontend tests.
  - Integration/test agent starts only after both implementation agents finish and must validate the combined agent worktree outputs.
- Main workspace remains orchestration-only for this product change.
- Backend task dispatched to `../data_platform_backend_agent`.
- Frontend task dispatched to `../data_platform_frontend_agent`.
- Backend agent completed implementation:
  - Added `GET /api/rbac/catalog`.
  - Catalog returns roles with backend-derived permissions and supported scope types.
  - Catalog read requires `dataset:read`.
  - Added self-disable conflict for the current user.
  - Added conflict protection for deleting the current user's own `platform_admin/platform/*` binding.
  - Preserved existing user and role-binding API contracts.
  - Reported focused backend tests `5 passed, 49 deselected`, full backend `60 passed`, and `git diff --check` passing.
- Frontend agent completed implementation:
  - Refactored `/account/permissions` into command-center layout with `账号管理`, `数据集权限分配`, and `角色绑定记录`.
  - Replaced always-visible long forms with drawers/modals for account creation/editing, permission assignment, binding detail, password reset, delete binding, and account enable/disable.
  - Added dataset type -> batch selector flow for dataset-batch assignments.
  - Added permission preview via `getRbacCatalog()` with service-level fallback for unsupported endpoint responses.
  - Shows `未分配角色` for users without bindings.
  - Reported focused frontend tests `66 passed`, build passing, `git diff --check` passing, and protected review workbench files unchanged.
- Frontend agent completed a follow-up compatibility fix:
  - `normalizeRbacCatalog()` now consumes backend `scope_types` directly instead of relying on default scope fallback.
  - RBAC fallback permissions now align with backend `ROLE_PERMISSIONS`, including `label_edit:confirm`.
  - API client tests cover `scope_types` parsing.
  - Reported focused frontend tests `66 passed`, build passing, `git diff --check` passing, and protected review workbench files unchanged.
- Integration validation checklist prepared:
  - Protected QC review files must have no diff.
  - Backend focused and full pytest must pass.
  - Frontend focused tests and build must pass.
  - Agent stack smoke must pass with fresh `PLATFORM_STATE_ROOT` and `LABEL_CONFIG_STORE_ROOT`.
  - Live API must verify RBAC catalog, self-disable conflict, self platform-admin binding delete conflict, duplicate binding conflict, and successful dataset-batch annotator assignment.
  - Browser must verify `/account/permissions` command-center sections, modal/drawer account creation, assignment drawer, dataset type -> batch selector flow, permission preview, delete confirmation, and disable confirmation.
  - All services must be stopped and checked ports released.
- First integration pass result:
  - Static checks, backend tests, frontend tests/build, agent stack smoke, live API guardrails, and browser modal/drawer flows passed.
  - Integration did not pass final acceptance because `qc_lead` permission preview showed `质检确认` instead of the expected explicit `label_edit:confirm`/`提交确认` wording.
  - Frontend agent was assigned a follow-up copy/mapping fix for `label_edit:confirm` preview text.
- Final integration pass result:
  - Frontend follow-up changed `label_edit:confirm` preview text to `提交确认` and updated tests.
  - Integration/test agent reran static checks, backend focused/full tests, frontend focused tests/build, agent-stack smoke, live API checks, browser permission-management flows, and shutdown checks.
  - Final agent integration result: passed.
- Main workspace sync and verification passed:
  - Accepted backend/frontend patches were applied to the main workspace.
  - Protected review workbench files remained unchanged.
  - `PLATFORM_STATE_ROOT=/tmp/uvp-permission-command-main-be LABEL_CONFIG_STORE_ROOT=/tmp/uvp-permission-command-main-labels uv run pytest tests/test_api.py -k "rbac or account or role_binding or users"`: `5 passed, 49 deselected`.
  - `PLATFORM_STATE_ROOT=/tmp/uvp-permission-command-main-be-full LABEL_CONFIG_STORE_ROOT=/tmp/uvp-permission-command-main-labels-full uv run pytest`: `60 passed`.
  - `cd frontend && npm run test -- apiClient routesAndPages`: `66 passed`.
  - `cd frontend && npm run build`: passed.
  - `git diff --check`: passed.
  - `SMOKE_RUNTIME_DIR=/tmp/uvp-permission-command-main-smoke scripts/integration-smoke.sh main`: passed.
  - `scripts/integration-smoke.sh main` stopped services and released project ports; a final `ss` check showed no listeners on `8000/5173/18031/15195`.

## Project Test Case Suite Design

- Started a project-level test case design task for functionally complete coverage and `>90%` boundary coverage.
- Inspected current backend routes, service functions, schemas, frontend routes, existing pytest/Vitest coverage, and integration smoke scripts.
- Recorded findings that current tests are broad but lack a durable project-level coverage matrix and denominator.
- Updated `docs/architecture/README.md` with `Project Test Case Suite`:
  - Defined boundary coverage as domain-boundary coverage, separate from line coverage.
  - Set 182 required boundary points and 170 minimum automated points, target 93.4%.
  - Added backend API, frontend, and integration/E2E test case matrices.
  - Added boundary checklist and quality gates for backend, frontend, cross-contract, review-workbench, dataset/import, and permission/multi-user changes.
- Updated `task_plan.md` with completed `P1 - Project Test Case Suite Design`.

## Project Test Case Suite Execution

- Assigned the test checklist execution to the integration/test agent.
- Required the agent to stop any existing `8000/5173/18031/15195` services first, then run tests with fresh runtime roots.
- The test agent executed:
  - `git diff --check` and protected review-workbench diff checks.
  - Backend full pytest plus separate manifest/API test runs.
  - Frontend full Vitest suite and build.
  - `SMOKE_RUNTIME_DIR=/tmp/uvp-test-suite-main-smoke scripts/integration-smoke.sh main`.
  - Supplemental browser automation for dataset home, dataset-type label config page, permission console, and review workbench bbox visibility.
- Report generated: `test_reports/project_test_report_2026-05-20.md`.
- Result summary:
  - Backend: `60 passed`; manifest parser `6 passed`; API `54 passed`.
  - Frontend: `82 passed` across 6 test files; build passed.
  - Integration smoke: passed.
  - Supplemental browser automation: passed.
  - Estimated automated boundary coverage: `170 / 182 = 93.4%`.
  - Known coverage gaps: 12 boundary points remain as recommended future tests, mainly deeper import abnormal matrices, complex permission UI E2E chains, and high-frequency review workbench interaction stability.
  - Services were stopped and ports `8000/5173/18031/15195` were confirmed released.

## Label Config History Deduplication Analysis

- Investigated why the label-config management page shows multiple archived versions after only one manual upload.
- Found current default persistent state under `DATASET/urban_violation/label_configs`.
- Observed five saved versions:
  - `label-config-1` through `label-config-5`.
  - All have the same `content_hash`, `file_name`, and semantic `version`.
  - Four are archived and one is active in `registry.json`.
- Found `active.json` and `registry.json` can be inconsistent in the historical store:
  - `registry.json` marks `label-config-5` active.
  - `active.json` points to `label-config-1`.
- Root causes identified:
  - Earlier versioning model and old non-idempotent saves created duplicate same-content versions.
  - UI still exposes `另存为新版本` and historical activation controls.
  - Backend still allows explicit `save_as_new_version=true` to create a duplicate even with identical hash.
  - Runtime default can write label-config state under raw `DATASET/` when `LABEL_CONFIG_STORE_ROOT` is unset.
- Updated `findings.md` and `task_plan.md` with the desired model:
  - Keep history for comparison.
  - Never keep duplicate entries for the same content hash.
  - Reject same semantic `config.version` with different content unless the uploaded JSON bumps version.
  - Remove normal UI path for `另存为新版本` and historical activation.
  - Move runtime defaults out of `DATASET/`.

## Label Config History Deduplication Implementation Dispatch

- Started implementation stage: `P1 - Label Config History Deduplication And Runtime Store Hardening`.
- Updated coordination/spec documents before product-code dispatch:
  - `docs/backend/README.md`: label-config history, duplicate-content reuse, same-version conflict, active pointer normalization, repair, and runtime root requirements.
  - `docs/frontend/README.md`: dataset-type label-config page workflow, single `上传并更新配置` write path, readonly unique history, duplicate/conflict states, and API boundary.
  - `docs/architecture/README.md`: cross-contract label-config versioning rules plus updated backend/frontend/integration test cases.
  - `task_plan.md` and `findings.md`: moved the phase to in-progress and recorded dispatch requirements.
- Backend implementation assignment:
  - Worktree: `../data_platform_backend_agent`.
  - Scope: repository save semantics, version conflict error, duplicate-store repair, active pointer consistency, default `.runtime/label_config_state`, stack-script env support, and backend tests.
- Frontend implementation assignment:
  - Worktree: `../data_platform_frontend_agent`.
  - Scope: remove `另存为新版本` and history-row `激活`, expose manual upload/update as the only normal write path, show duplicate/conflict Chinese messages, update API types/adapters, and frontend tests.
- Integration/test assignment is prepared to run after both implementation agents finish:
  - Validate duplicate upload count stability, same-version conflict, bumped-version creation, dirty-store repair, browser UI state, no raw `DATASET/` writes, and service shutdown hygiene.
- Dispatch messages sent:
  - Backend agent `019e404a-4b4d-7142-8fb4-5d1532587af8` received the backend implementation and test specification.
  - Frontend agent `019e404a-4b91-7541-8492-553d90e3d6a9` received the frontend implementation and test specification.
  - Integration/test agent `019e4042-455a-73e3-8747-0a6802b8771a` received the联调验收清单 and was instructed to wait until both implementation agents finish.
- Frontend agent completed:
  - Updated `LabelConfigUploadPanel.vue` and frontend tests.
  - Normal UI now has `上传并更新配置`; `另存为新版本` and history-row `激活` are removed.
  - `save_as_new_version` is not sent in normal save.
  - Duplicate-content and version-conflict messages are Chinese.
  - `npm run test -- apiClient routesAndPages`: `67 passed`.
  - `npm run build`: passed.
  - `git diff --check`: passed.
  - Protected review workbench files: no diff.
- Backend agent completed:
  - Updated label repository, service defaults, stack scripts, and backend tests.
  - Same `content_hash` reuses existing entry even if `save_as_new_version` is supplied.
  - Same `config.version` with different hash returns `409 label_config_version_conflict`.
  - New version+hash creates one active history entry and archives the previous active.
  - Duplicate same-hash runtime stores are repaired; active pointer and registry are normalized.
  - Default label config store root is `.runtime/label_config_state` instead of raw `DATASET/`.
  - Focused backend test: `21 passed, 37 deselected`.
  - Full backend test: `64 passed`.
  - `git diff --check`: passed.
- First integration pass result:
  - Backend tests, frontend tests/build, agent stack smoke, live API checks, dirty-store repair, raw `DATASET/` no-write check, and service shutdown passed.
  - Browser probe failed because one button still contained `激活` via `重新加载激活配置`; historical row activation itself had already been removed.
  - Frontend agent was assigned a follow-up copy fix to rename that action.
- Frontend follow-up completed:
  - `重新加载激活配置` renamed to `重新加载当前配置`.
  - Reload success/error fallback copy now avoids `active` and `激活` button wording.
  - `npm run test -- apiClient routesAndPages`: `67 passed`.
  - `npm run build`: passed.
  - `git diff --check`: passed.
  - Protected review workbench files: no diff.
- Final integration pass result:
  - Browser rerun passed: `上传并更新配置` count 1, `另存为新版本` count 0, buttons containing `激活` count 0, history row buttons count 0.
  - API rerun passed for duplicate same-hash non-growth and same-version conflict `409 label_config_version_conflict`.
  - Agent stack services were stopped and ports released.
  - Integration/test agent marked the combined agent worktree output as syncable.
- Main workspace sync and verification passed:
  - Applied accepted backend/frontend patches to the main workspace.
  - `git diff --check`: passed.
  - Protected review workbench files: no diff.
  - `PLATFORM_STATE_ROOT=/tmp/uvp-label-history-main-be LABEL_CONFIG_STORE_ROOT=/tmp/uvp-label-history-main-labels uv run pytest tests/test_api.py -k "label_config or dataset_type"`: `21 passed, 37 deselected`.
  - `cd frontend && npm run test -- apiClient routesAndPages`: `67 passed`.
  - `PLATFORM_STATE_ROOT=/tmp/uvp-label-history-main-be-full LABEL_CONFIG_STORE_ROOT=/tmp/uvp-label-history-main-labels-full uv run pytest`: `64 passed`.
  - `cd frontend && npm run build`: passed.
  - `SMOKE_RUNTIME_DIR=/tmp/uvp-label-history-main-smoke scripts/integration-smoke.sh main`: passed.
  - `scripts/dev-stack.sh stop`, `scripts/agent-dev-stack.sh stop`, and port check confirmed no listeners on `8000/5173/18031/15195`.

## Batch Assignment Bug Analysis

- Investigated the QC workbench `Batch Assignment` failure report without modifying product code.
- Started an isolated stack on `BACKEND_PORT=18081` and `FRONTEND_PORT=15181` with `/tmp/uvp-assignment-bug-*` runtime roots; stopped it afterward.
- Confirmed backend direct assignment works when the assignee account exists:
  - `POST /api/datasets/urban_violation__0508_fixture/qc/assignment` with `assignee_user_id=annotator_a` returned 200 after creating the user.
- Confirmed a `qc_lead` with dataset-batch scoped `batch_assignment:manage` can assign a known user directly:
  - `/me` showed `batch_assignment:manage`.
  - Direct assignment to known `annotator_a` returned 200.
- Found the UI-blocking contract gap:
  - `QcPage` loads assignee options from `apiClient.listUsers()`.
  - Backend `list_users` requires `users:manage`.
  - A normal `qc_lead` or `batch_manager` gets 403 on `/api/users`.
  - `QcPage` catches that error and falls back to `[currentUser]`, so the selector cannot choose annotators even though the assignment API would allow assigning them by id.
- Found a secondary release bug:
  - Frontend `releaseBatchAssignment()` posts no body.
  - Backend release route requires `BatchAssignmentActionRequest`.
  - Live API returned 422 for no-body release; `{}` succeeds and reaches service logic.
- Found a UX masking issue:
  - `assignBatch()` / `releaseBatch()` do not catch `ApiClientError` or show action-level messages, so failed requests appear as no-op.

## Batch Assignment Repair Dispatch

- Started repair stage for QC workbench Batch Assignment.
- Backend task:
  - Add an assignment-scoped active assignee list endpoint for callers with `batch_assignment:manage` on the concrete batch.
  - Keep disabled users out of the list.
  - Preserve existing `/api/users` admin-only contract.
  - Make assignment release compatible with an empty/no body request, or otherwise align route/client so frontend release no longer 422s.
  - Add API tests covering `qc_lead` dataset-batch scoped user listing, direct assignment, and release.
- Frontend task:
  - Add API client method for the assignment-scoped assignee list.
  - Make `QcPage` use that endpoint instead of admin-only `/api/users` for Batch Assignment.
  - Fix release request body and add visible action-level pending/error/success messages.
  - Add route/page and API adapter tests for `qc_lead` assignment flow and release.
- Integration/test task prepared:
  - Validate combined agent worktree output with live API and browser flow before main sync.

## Batch Assignment Repair Complete

- Backend agent completed and integration verified:
  - Added `GET /api/datasets/{dataset_id}/qc/assignable-users`.
  - Endpoint requires `batch_assignment:manage` on the concrete dataset/batch and returns active users only, including admins.
  - `/api/users` remains restricted to `users:manage`.
  - `POST /api/datasets/{dataset_id}/qc/assignment/release` accepts no body.
  - Focused backend tests: `7 passed, 54 deselected`.
  - Full backend tests: `67 passed`.
- Frontend agent completed and integration verified:
  - `QcPage` now uses `listBatchAssignableUsers()` instead of admin-only `listUsers()` for Batch Assignment.
  - Release sends `{}`.
  - Assignment/reassignment/release now show pending, success, and error messages.
  - Empty assignable-user state and permission failures are visible in Chinese.
  - Focused frontend tests: `69 passed`.
  - Frontend build: passed.
- Integration/test agent result:
  - Protected review workbench files had no diff.
  - Live API confirmed `qc_lead` can read assignable users while `/api/users` remains 403.
  - Live API confirmed active annotator/admin users are returned and disabled users are excluded.
  - Live API confirmed assignment, no-body release, admin assignment, and release-with-body compatibility.
  - Browser flow confirmed the Batch Assignment selector is populated and action feedback is visible.
  - Agent stack services were stopped and target ports were released.
- Main workspace sync and verification passed:
  - Applied only the reviewed Batch Assignment changes from agent worktrees.
  - `PLATFORM_STATE_ROOT=/tmp/uvp-assignment-repair-main-be LABEL_CONFIG_STORE_ROOT=/tmp/uvp-assignment-repair-main-labels uv run pytest tests/test_api.py -k "assignment or rbac or users"`: `7 passed, 54 deselected`.
  - `cd frontend && npm run test -- apiClient routesAndPages`: `69 passed`.
  - `PLATFORM_STATE_ROOT=/tmp/uvp-assignment-repair-main-be-full LABEL_CONFIG_STORE_ROOT=/tmp/uvp-assignment-repair-main-labels-full uv run pytest`: `67 passed`.
  - `cd frontend && npm run build`: passed.
  - `git diff --check`: passed.
  - Protected review workbench files: no diff.

## 0520 Preannotated Batch QC Queue Analysis

- Investigated user report: generating a QC queue for `urban_violation_0520_reject` returns `Batch source must be ingested before QC queue generation.`
- Confirmed the dataset directory is `DATASET/urban_violation_0520`; the registered batch display name is `urban_violation_0520_reject`.
- Confirmed directory counts:
  - `images`: 505.
  - `stage1/parsed`: 505.
  - `stage2/parsed`: 496.
  - `stage2/failures`: 8.
- Confirmed manifest edge case:
  - `stage1` manifest has 505 unique sample ids.
  - `stage2` manifest has 504 unique sample ids.
  - One image/stage1 sample has no stage2 manifest entry.
  - 8 failed stage2 ids appear twice in the manifest as duplicate failed entries.
- Confirmed `.runtime/label_config_state/dataset_batches.json` says the batch is `Imported` and `preannotation_ready`.
- Reproduced backend runtime hydration failure by instantiating `build_fixture_service()`:
  - Batch id: `urban_violation__urban_violation_0520`.
  - Source resolves to `DATASET/urban_violation_0520`.
  - `_registered_batch_runtimes` does not contain the batch.
  - `_build_registered_batch_runtime()` raises `FileNotFoundError: Missing stage1 run manifest under DATASET/urban_violation_0520`.
- Root cause:
  - Frontend upload scan treats plain `stage1/` and `stage2/` as valid STEP output directories.
  - Backend importer only discovers `stage1_run_*` and `stage2_run_*` directories.
  - The batch can be registered as preannotated, but cannot be hydrated for QC queue generation.
- Proposed fix:
  - Update backend stage-run discovery to support both canonical direct dirs (`stage1`, `stage2`) and legacy run dirs (`stage1_run_*`, `stage2_run_*`).
  - Represent stage2-missing samples as queueable failure diagnostics for reject/remediation batches instead of failing whole-batch hydration.
  - Prevent registered batches from being marked `Imported`/`preannotation_ready` if runtime hydration fails.
  - Improve QC generation error detail so unsupported layout and unreadable source are distinguishable.

## Admin Batch Deletion Planning

- User explicitly paused the 0520 preannotation import fix and requested a batch deletion action on the batch overview page.
- Current backend has no batch deletion route. Existing delete routes only cover role bindings and sample-pool items.
- Current frontend batch overview page is `frontend/src/features/datasets/DatasetOverviewPage.vue`.
- Planned backend behavior:
  - `DELETE /api/datasets/{dataset_id}` deletes registered batches only.
  - Only `platform_admin` gets the new `dataset_batch:delete` permission.
  - Raw `DATASET/` source files are not removed.
  - Registered summary/runtime/import-job references and mutable QC state are removed.
- Planned frontend behavior:
  - Add `删除批次` to page actions for platform admins only.
  - Use a second confirmation modal before calling the API.
  - Show Chinese success/error feedback and redirect after success.
- Implementation will be delegated to backend and frontend agent worktrees, followed by integration/test agent validation before main sync.

## Admin Batch Deletion Complete

- Backend agent implemented `DELETE /api/datasets/{dataset_id}` for registered dataset batches only.
- Added `dataset_batch:delete` permission for `platform_admin`; non-admin roles remain forbidden.
- Deletion removes registered batch state, runtime state, import job references, mutable QC state, and sample-pool rows while preserving raw `DATASET/` files and audit history.
- Frontend agent added a `删除批次` action on the batch overview page for admins, with a second confirmation dialog requiring the exact batch id before deletion.
- After deletion, the page redirects to the dataset type detail when resolvable, otherwise back to the dataset center.
- Integration/test agent verified API permissions, forbidden fixture/type deletes, browser modal behavior, and non-admin visibility boundaries.
- Main workspace verification:
  - `PLATFORM_STATE_ROOT=/tmp/uvp-delete-batch-main-be LABEL_CONFIG_STORE_ROOT=/tmp/uvp-delete-batch-main-labels uv run pytest tests/test_api.py -k "delete or dataset_batch or sample_pool"`: `6 passed, 58 deselected`.
  - `cd frontend && npm run test -- apiClient routesAndPages`: `74 passed`.
  - `PLATFORM_STATE_ROOT=/tmp/uvp-delete-batch-main-be-full LABEL_CONFIG_STORE_ROOT=/tmp/uvp-delete-batch-main-labels-full uv run pytest`: `70 passed`.
  - `cd frontend && npm run test`: `90 passed`.
  - `cd frontend && npm run build`: passed.
  - `git diff --check`: passed.
  - Protected review workbench diff: empty.
  - `scripts/dev-stack.sh stop`, `scripts/agent-dev-stack.sh stop`, and port check confirmed no listeners on `8000/5173/18031/15195`.

## 0520 QC Queue Error Log Diagnosis

- Investigated the still-failing `Batch source must be ingested before QC queue generation.` report against the live main dev stack.
- `.runtime/backend.log` shows the batch was created and import-confirmed, then `POST /api/datasets/urban_violation__urban_violation_0520/qc/generate` returned `409 Conflict`.
- Direct API response:
  - `code`: `source_not_ingested`.
  - `message`: `Batch source must be ingested before QC queue generation.`
- Persisted state says the batch is already `Imported` / `preannotation_ready`; therefore the message is not describing the real internal failure.
- Direct runtime construction with `build_fixture_service()` exposed the swallowed exception:
  - `ValueError: Invalid stage1 manifest line 40`.
  - The line is a STEP1 manifest failure/retry row with `status=failed` and `failure_path`.
  - `Stage1ManifestEntry` only supports success rows, so parsing aborts.
- Current `DATASET/urban_violation_0520` shape:
  - `images`: 505.
  - STEP1 parsed files: 505.
  - STEP1 manifest: 543 rows, 505 unique ids, final status for all unique ids is success.
  - STEP2 parsed files: 496.
  - STEP2 failure files: 8.
  - STEP2 manifest: 512 rows, 504 unique ids, final status is 496 success and 8 failed.
  - One STEP1-success id is missing from STEP2 manifest.
- Root cause for the current error:
  - Backend hydration does not tolerate STEP1 retry/failure rows.
  - Hydration exceptions are swallowed and converted into absent runtime state.
  - QC generation only sees absent runtime state and returns the generic `source_not_ingested` message.
- Expected implementation direction:
  - Add STEP1 failure/retry row parsing with deterministic last-write-wins so retry history does not break final successful samples.
  - Keep final STEP1 failures as import diagnostics rather than QC-ready label samples.
  - Tolerate missing STEP2 rows as `stage2_missing` diagnostics or excluded/diagnostic QC items according to product decision.
  - Surface hydration failure details in import validation or QC generation instead of returning only `source_not_ingested`.

## 0520 QC Queue Repair Dispatch

- Started backend repair for the 0520 preannotated batch hydration failure.
- Main workspace remains orchestration-only per `AGENTS.md`; product code changes are assigned to the backend agent worktree.
- Backend agent scope:
  - Update manifest parsing and runtime hydration to tolerate STEP1 retry/failure history rows.
  - Keep deterministic final successful STEP1 entries.
  - Handle the one missing STEP2 sample without failing the full batch.
  - Add parser/API regression tests.
- Integration agent will validate live QC queue generation against `DATASET/urban_violation_0520` after backend completion.

## 0520 QC Queue Repair Complete

- Backend agent completed the parser/runtime repair in `../data_platform_backend_agent`.
- Main changes synchronized after integration approval:
  - `src/urban_violation_backend/importer/parser.py`
  - `src/urban_violation_backend/service.py`
  - `tests/test_manifest_parser.py`
  - `tests/test_api.py`
- Implemented behavior:
  - STEP1 manifest now tolerates failed retry/history rows and applies final-row-by-id semantics.
  - Historical STEP1 failures no longer abort runtime hydration when a later success row exists.
  - Samples missing STEP2 rows are represented as `Stage2MissingError` diagnostics and do not abort whole-batch hydration.
  - Runtime hydration failures are stored and surfaced with specific diagnostic text instead of only generic `source_not_ingested`.
- Integration agent result:
  - Protected review workbench files had no diff.
  - Backend parser tests: `8 passed`.
  - Focused backend API tests: `3 passed, 63 deselected`.
  - Five focused reruns had `0/5` failures.
  - Live API on agent stack generated QC queue for `urban_violation__urban_violation_0520` with HTTP `200`, total `505`, STEP2 distribution `success=496`, `failure=9`.
  - Frontend QC route smoke loaded successfully.
- Main workspace verification:
  - `uv run pytest tests/test_manifest_parser.py`: `8 passed`.
  - `PLATFORM_STATE_ROOT=/tmp/uvp-0520-repair-main-be LABEL_CONFIG_STORE_ROOT=/tmp/uvp-0520-repair-main-labels uv run pytest tests/test_api.py -k "0520 or preannotated_registered_batch_generates_batch_scoped_qc_queue or qc_generate_surfaces_hydration_error_details or source_not_ingested"`: `3 passed, 63 deselected`.
  - `PLATFORM_STATE_ROOT=/tmp/uvp-0520-repair-main-be-full LABEL_CONFIG_STORE_ROOT=/tmp/uvp-0520-repair-main-labels-full uv run pytest`: `74 passed`.
  - `cd frontend && npm run test -- apiClient routesAndPages`: `74 passed`.
  - `cd frontend && npm run build`: passed.
  - Live main stack via `scripts/dev-stack.sh start`: `POST /api/datasets/urban_violation__urban_violation_0520/qc/generate` returned `200`, queue total `505`, status counts `success=496`, `failure=9`.
  - `git diff --check`: passed.
  - Protected review workbench diff: empty.
  - Services stopped with `scripts/dev-stack.sh stop` and `scripts/agent-dev-stack.sh stop`; ports `8000/5173/18031/15195` are released.

## QC Review Keyboard Shortcut Planning

- Planned keyboard shortcuts for the accepted sample review workbench.
- Reviewed current `ReviewWorkbenchShell.vue` behavior:
  - Prev/Next/List already exist in the top bar.
  - Bottom bar actions are `跳过样本`, `校验修改`, `保存草稿`, `提交修改`.
  - `跳过样本` releases current sample lease and moves to next sample or QC list.
  - `提交修改` validates first and releases lease after successful submit.
  - Review fields include many text inputs and selects, so shortcut handling must ignore focused editable elements and IME composition.
- Added the shortcut design to `docs/frontend/README.md`.
- Added implementation/acceptance planning to `task_plan.md`.
- Recorded durable findings in `findings.md`.
- Found residual dev services on `8000/5173` after the interrupted prior turn; they should be stopped before ending this planning pass.

## QC Review Keyboard Shortcut Plan Adjustment

- Removed `Shift+[` / `Shift+]` Candidate switching from the shortcut scope.
- Removed `1` / `2` / `3` bbox layer switching from the shortcut scope.
- Confirmed `Ctrl/Cmd+S` conflicts with the browser save-page shortcut.
- Updated the first implementation plan to bind only plain `S` for 保存草稿.
- Documented that `Ctrl/Cmd+S` should remain unbound in the first version; if enabled later, it must be route-scoped, ignored in editable fields, and call `preventDefault()`.

## QC Review Keyboard Shortcut Plan Adjustment 2

- Removed `[` / `]` Relation switching from the shortcut scope.
- Rationale: direct image bbox click is faster and clearer for Relation selection in the current evidence-first review layout.
- First implementation shortcut set is now limited to sample navigation and bottom-bar actions only.

## QC Review Bottom Bar Lifecycle Redesign

- Suspended the QC review keyboard shortcut task because the bottom-bar semantics need to change first.
- Rechecked current frontend and backend flow:
  - Save draft is currently active-sample-only.
  - Submit changes is currently active-sample-only and releases only the active sample lease.
  - Backend creates per-sample draft/submission records but has no batch-level draft manifest or batch finalization API.
- Updated `task_plan.md` with `P0 - QC Review Draft Autosave And Batch Submission Redesign`.
- Updated `findings.md` with current mismatch and target state.
- Updated the frontend documentation at that phase with target bottom-bar layout, autosave behavior, batch submit modal, API additions, permissions, and suspended shortcut status.

## QC Review Bottom Bar Lifecycle Implementation Dispatch

- Started implementation for the batch-draft/autosave/batch-submit redesign.
- Dispatched Backend Agent in `/mnt/lc/LC/ares_xtws/0_train_data/data_platform_backend_agent`:
  - implement batch draft read/save/autosave APIs;
  - implement batch-level final submit API;
  - keep current sample validate endpoint compatible;
  - add backend tests and handoff.
- Dispatched Frontend Agent in `/mnt/lc/LC/ares_xtws/0_train_data/data_platform_frontend_agent`:
  - keep accepted review layout and bbox behavior unchanged;
  - update bottom bar to batch draft/autosave/batch submit semantics;
  - add submit confirmation modal and frontend tests;
  - no keyboard shortcut implementation in this phase.
- Integration/testing remains pending until both implementation handoffs are complete.

## QC Review Bottom Bar Contract Review

- Backend and frontend implementation handoffs returned.
- Lead contract check found a blocking mismatch before live integration:
  - Backend expects batch draft save body `entries[]`; frontend was sending `samples[]`.
  - Backend `BatchDraftEntryRequest` forbids extra fields; frontend was sending `task_mode`, `task_revision`, `updated_at`, `saved_at`, `skipped`, and validation metadata not accepted by backend.
  - Backend `submit-batch` expects `unsaved_dirty_sample_ids[]`, `validation_error_sample_ids[]`, and optional `notes`; frontend was sending label config and count fields instead.
- Sent correction back to the frontend agent to align request payloads and response normalizers with the backend contract before integration testing.
- Frontend correction completed:
  - batch draft save/autosave now sends `entries[]` only;
  - response normalizer supports `entries`, `sample_count`, `dirty_count`, `saved_count`, and `validation_error_count`;
  - `submit-batch` now sends `unsaved_dirty_sample_ids[]`, `validation_error_sample_ids[]`, and `notes`;
  - frontend agent reran `npm run test` and `npm run build`, both passed.

## QC Review Bottom Bar Integration Complete

- Synced the verified frontend/backend agent changes back into the main workspace using a focused patch generated from the relevant worktree files.
- Live agent-stack API smoke:
  - `GET /label-edits/my-batch-draft` returned batch draft summary.
  - `PUT /label-edits/my-batch-draft` saved `entries[]`.
  - `POST /label-edits/my-batch-draft/autosave` saved `entries[]` idempotently.
  - `POST /label-edits/submit-batch` with missing active label config now returns structured `404` instead of `500`.
  - After activating `DATASET/urban_violation/label_config.json`, `submit-batch` returned `200` and marked the assignment `submitted`.
- Browser smoke through headless Chrome CDP:
  - review route loaded at `/datasets/urban_violation__0508_fixture/samples/000036_0_1760525209967/review`;
  - bottom bar rendered `当前样本修改`, `批次草稿`, `自动保存`, `校验`, `跳过样本`, `校验修改`, `保存草稿`, and `提交批次修改`;
  - `提交批次修改` opened a confirmation modal with batch stats.
- Main workspace verification:
  - `uv run pytest` -> `81 passed`;
  - `cd frontend && npm run test` -> `93 passed`;
  - `cd frontend && npm run build` -> passed;
  - `git diff --check` -> passed.

## QC Batch Draft Restore Follow-up

- Frontend handoff review found a product gap: remote batch draft operations were restored only into progress accounting, not into the active editor.
- Sent follow-up to the frontend agent to restore saved `entries[].operations` into `reviewDraft` on page load/sample switch.
- Frontend agent implemented restore support for:
  - `relation:Rn` replace operations;
  - `verification:Rn` replace operations;
  - `candidate:Cn` replace operations;
  - `delete_candidate`.
- Synced the verified restore patch back into the main workspace.
- Main workspace follow-up verification:
  - `cd frontend && npm run test` -> `95 passed`;
  - `cd frontend && npm run build` -> passed.

## QC Review Keyboard Shortcut Resume

- Resumed the keyboard shortcut task after the batch draft/batch submit lifecycle was implemented and verified.
- Updated the shortcut contract:
  - previous/next sample: `ArrowLeft`/`A`, `ArrowRight`/`D`;
  - skip sample: `X`;
  - validate current sample: `V`;
  - save batch draft: `S`;
  - no instant submit shortcut for `提交批次修改`;
  - no `Ctrl/Cmd+S`, no Relation/Candidate/layer cycling shortcuts.
- Frontend implementation is being assigned to the frontend agent worktree.

## QC Review Keyboard Shortcut Implementation Complete

- Frontend agent implemented route-scoped review shortcuts in `ReviewWorkbenchShell.vue`.
- Synced the verified frontend patch back into the main workspace for:
  - `frontend/src/features/review-workbench/components/ReviewWorkbenchShell.vue`;
  - `frontend/src/test/routesAndPages.test.ts`.
- Implemented shortcuts:
  - `ArrowLeft`/`A`: previous queue sample;
  - `ArrowRight`/`D`: next queue sample;
  - `X`: skip sample through the same dirty-save guard;
  - `V`: field legality validation only;
  - `S`: save batch draft.
- Explicitly not implemented:
  - no `Ctrl/Cmd+S`;
  - no `Ctrl/Cmd+Enter`;
  - no instant batch submit shortcut;
  - no Relation/Candidate/layer cycling shortcuts.
- Verification:
  - Frontend agent `npm run test -- routesAndPages` passed with 62 tests.
  - Frontend agent `npm run test` passed with 100 tests.
  - Frontend agent `npm run build` passed.
  - Main workspace `cd frontend && npm run test` passed with 100 tests.
  - Main workspace `cd frontend && npm run build` passed.
  - Main workspace `git diff --check` passed before final status-doc updates.
  - Headless Chrome CDP smoke confirmed `S` saves batch draft, `D` navigates to the next sample, `V` validates only, `Ctrl/Cmd+S` and `Ctrl/Cmd+Enter` do not trigger review actions, focused editable controls ignore shortcuts, and submit remains button/modal confirmed.

## Documentation Page/API Restructure

- Reorganized `docs/frontend/README.md` by frontend page hierarchy:
  - root/auth pages;
  - dataset type pages;
  - concrete batch workspace pages;
  - sample review page;
  - global closed-loop page;
  - user center pages.
- Reorganized `docs/backend/README.md` by backend API modules:
  - health/auth/session;
  - users/RBAC/audit;
  - dataset types and batches;
  - label config;
  - import jobs;
  - assets/media/review detail;
  - QC queue, assignment, tasks, leases;
  - label edit drafts/submissions;
  - QC closed loop;
  - export.
- Refreshed `docs/README.md` to describe the new frontend/backend document organization.
- Added `.agent/` task notes for this documentation pass.

## Documentation Split And Independent Login Design

- Split frontend documentation into an index plus page/shared documents:
  - `docs/frontend/pages/login.md`;
  - `docs/frontend/pages/dataset-type-pages.md`;
  - `docs/frontend/pages/batch-workspace-pages.md`;
  - `docs/frontend/pages/sample-review.md`;
  - `docs/frontend/pages/sample-pool.md`;
  - `docs/frontend/pages/user-center.md`;
  - `docs/frontend/shell-and-navigation.md`;
  - `docs/frontend/shared-components-and-states.md`;
  - `docs/frontend/api-and-permissions.md`.
- Split backend documentation into an index plus API module documents under `docs/backend/modules/`.
- Added independent login interface design to `docs/frontend/pages/login.md`.
- Updated `docs/README.md`, `findings.md`, and `task_plan.md` to reflect the split documentation structure.

## Independent Login Page Implementation Dispatch

- Started implementation stage for the independent login page.
- Confirmed `frontend/src` is currently identical between the main workspace and frontend agent worktree before dispatch.
- Assigned frontend implementation to `/mnt/lc/LC/ares_xtws/0_train_data/data_platform_frontend_agent`.
- Frontend agent scope:
  - `frontend/src/app/App.vue`;
  - `frontend/src/features/auth/LoginPage.vue`;
  - `frontend/src/test/routesAndPages.test.ts`;
  - minimal shared styles only if needed.
- Protected review workbench files are out of scope.

## Independent Login Page Implementation Complete

- Frontend agent implemented `/login` as a standalone route outside `AppShell`.
- Synced the verified frontend patch back into the main workspace for:
  - `frontend/src/app/App.vue`;
  - `frontend/src/features/auth/LoginPage.vue`;
  - `frontend/src/test/routesAndPages.test.ts`.
- Updated `scripts/dev-stack.sh` and `scripts/agent-dev-stack.sh` so local stacks default to:
  - `PLATFORM_AUTH_MODE=session`;
  - `PLATFORM_DEV_ANON=0`.
- Updated auth/login documentation to record the local session-auth default.
- Verification:
  - Frontend agent `npm run test -- routesAndPages` passed with 67 tests.
  - Frontend agent `npm run test` passed with 105 tests.
  - Frontend agent `npm run build` passed.
  - Main workspace `cd frontend && npm run test -- routesAndPages` passed with 67 tests.
  - Main workspace `cd frontend && npm run test` passed with 105 tests.
  - Main workspace `cd frontend && npm run build` passed.
  - Live API without session returned 401 for `/api/me`.
  - Headless Chrome smoke confirmed `/datasets` redirects to `/login?redirect=/datasets`, login renders without app shell/sidebar/topbar, visible login status text is Chinese, and `platform_admin` login enters `/datasets`.

## Autosave Persistence Fix

- Completed automatic-save reliability fix through frontend/backend agent worktrees and synchronized verified patches back to the main workspace.
- Backend:
  - successful batch draft save/autosave now normalizes saved entries to `dirty=false`, `saved=true`;
  - autosave regression test covers dirty request payloads and reload state.
- Frontend:
  - API client now parses top-level batch draft save/autosave summaries as `result.draft`;
  - review page fallback save-result merge canonicalizes successful sample ids to `dirty=false`, `saved=true`.
- Verification:
  - `uv run pytest tests/test_api.py -k "batch_draft"` passed, 4 tests;
  - `npm run test -- apiClient` passed, 22 tests;
  - `npm run test -- routesAndPages -t "autosaves only when the batch draft is dirty and editable"` passed;
  - `npm run build` passed;
  - dirty autosave TestClient probe returned and reloaded `saved_count=1`, `dirty_count=0`, entry `saved=true`, `dirty=false`.

## Autosave Scheduling Optimization

- Completed frontend autosave scheduling optimization through frontend agent worktree and synchronized the verified patch into the main workspace.
- Verification: selected `routesAndPages` autosave tests passed, pending shortcut test passed, and frontend build was run after synchronization.

## Autosave Interval Control

- Completed frontend bottom-bar autosave interval control through the frontend agent worktree and synchronized the verified patch into the main workspace.
- Updated sample review documentation and review workbench acceptance criteria.
- Verification:
  - `npm run test -- routesAndPages -t "autosaves only when the batch draft is dirty and editable|lets reviewers set the autosave interval|keeps newer edits dirty"` passed.
  - `npm run test -- routesAndPages -t "does not repeat shortcut actions during pending"` passed.
  - `npm run build` passed.

## Submitted Batch Review Visibility Investigation

- Investigated the report that annotator batch draft save + batch submit appears unsaved when a platform admin opens the QC queue.
- Found that backend draft save and batch submit persist data:
  - batch draft save writes per-sample drafts and a batch manifest;
  - batch submit creates `LabelEditSubmission`, updates task status to `submitted`, stores `latest_submission_id`, releases leases, and clears the batch draft manifest.
- Found that admin review display does not apply the submitted patch:
  - review detail returns raw imported `stage1`/`stage2` plus `latest_submission`;
  - the workbench restores only current-user drafts/batch drafts/local cache, not `latestSubmission.operations`.
- Runtime check in `.runtime/mimo-1548` confirmed a real submitted record for `1548_000002` with operations and task status `submitted`; the user-facing problem is display/materialization of submitted operations for reviewer/admin, not missing persistence.
- Implemented accepted fix through backend/frontend agent worktrees and synchronized verified patches back to the main workspace:
  - backend QC queue items now include `latest_submission` when a task has `latest_submission_id`;
  - backend review detail reuses the same latest-submission helper;
  - frontend review workbench restores `detail.latestSubmission.operations` for admin/qc review when there is no current-user draft;
  - regression tests cover submitted operations appearing in the admin editor and backend queue/detail submission visibility.
- Verification:
  - `npm run test -- routesAndPages -t "shows latest submitted operations|restores saved batch draft relation"` passed in the frontend agent worktree and main workspace.
  - `npm run build` passed in the frontend agent worktree and main workspace.
  - Backend `api_schemas.py`/`service.py` AST parse passed in the backend agent worktree and main workspace.
  - Backend `QCQueueItem.latest_submission` serialization probe passed in the backend agent worktree and main workspace.
  - `create_app()` started successfully against `/mnt/data1/Project/XTS/data_platform/dataset/Rejected_Data_0518` in the backend agent worktree and main workspace.
  - Full `tests/test_api.py` targeted pytest could not run in this environment because that suite still imports a hard-coded legacy fixture path `/mnt/lc/LC/ares_xtws/0_train_data/data_platform/DATASET/urban_violation`.

## test_api Relative Path Cleanup

- Replaced `tests/test_api.py` legacy absolute fixture paths with paths derived from the repository root:
  - `DATASET/urban_violation`;
  - `DATASET/urban_violation_0520`;
  - `DATASET/urban`.
- Set test default `DATASET_ROOT` to the relative string `DATASET/urban_violation` before importing the FastAPI app module.
- If the relative dataset is absent in a worktree, collection now disables fixture-batch startup instead of failing during module import.
- Verification:
  - Backend agent `uv run pytest tests/test_api.py --collect-only -q`: collected 81 tests.
  - Main workspace `uv run pytest tests/test_api.py --collect-only -q`: collected 81 tests.
  - `tests/test_api.py` AST parse passed.
  - Search found no legacy `/mnt/lc`, `/mnt/data1`, `/home`, or `Path.cwd() / "DATASET"` path usage in `tests/test_api.py`.

### 2026-05-28 R2 Relation Tone Update

- Frontend agent worktree: fixed canonical relation tones so R2 uses cyan and R1/R3/R4 remain blue/green/orange.
- Added matching relation tone classes to the right-side fact relation index buttons.
- Added focused frontend test coverage for R1-R4 overlay and index-button tone classes.

Verification for R2 relation tone update:
- Frontend agent: `npm run test -- src/test/routesAndPages.test.ts` passed, 78 tests.
- Frontend agent: `npm run build` passed.
- Main workspace: `npm run test -- src/test/routesAndPages.test.ts` passed, 78 tests.
- Main workspace: `npm run build` passed.
- Restarted dev stack with dataset `/mnt/data1/Project/XTS/data_platform/dataset/mimo_1548` and 0.0.0.0 hosts.
- Status: backend pid 2088093 at http://0.0.0.0:8000, frontend pid 2088475 at http://0.0.0.0:5173.
- Health: backend `/health` returned `{"status":"ok","dataset_id":"urban_violation"}`; frontend root returned HTTP 200.

### 2026-05-29 Relation Object Selector Update

- Frontend agent worktree: changed the review workbench fact-relation `客体` editor from free text input to a configured selector.
- Selector options now include the requested anchor/object set: 人行道、盲道、停车线或停车区域、路缘或边界、车行道、店铺边界、柜台或经营区域、出入口、公共区域.
- Kept legacy object values display-compatible by mapping common imported values such as `sidewalk`, `curb`, `road`, and `intersection` to the corresponding Chinese labels while preserving unknown/current values.
- Added focused route/workbench test coverage for editing the relation object selector and validating the generated `relation:*` label-edit operation.

Verification for relation object selector update:
- Frontend agent: `npm run test -- src/test/routesAndPages.test.ts` passed, 79 tests.
- Main workspace: `npm run test -- src/test/routesAndPages.test.ts` passed, 79 tests.
- Main workspace: `git diff --check` passed.

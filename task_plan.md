# Urban Violation Platform Agent Work Plan

## Goal

Analyze `urban_violation_platform_markdown/` and the dataset layout under `DATASET/` to define execution tasks and acceptance criteria for three implementation agents:

- Frontend implementation agent
- Backend implementation agent
- Integration testing agent

## Status

- Phase 0: Planning files initialized - complete
- Phase 1: Documentation inventory and product scope analysis - complete
- Phase 2: Dataset structure and schema sampling - complete
- Phase 3: Frontend/backend/integration task split - complete
- Phase 4: Acceptance criteria and handoff checklist - complete
- Phase 5: Git repository and agent worktree setup - complete
- Phase 6: Shared contract/bootstrap execution - in_progress (first slices complete)
- Phase 7: Remaining task backlog and execution order - complete
- Phase 8: P0 contract/API/frontend/integration execution cycle - complete

## Phase 1 - Documentation Inventory

Tasks:
- Read the markdown files under `urban_violation_platform_markdown/`.
- Extract product modules, user workflows, UI screens, backend boundaries, API/data expectations, and nonfunctional constraints.
- Record findings in `findings.md`.

Acceptance:
- Every markdown file has been accounted for.
- Product scope and implementation surfaces are summarized with source file references.

## Phase 2 - Dataset Structure and Schema Sampling

Tasks:
- Inspect `DATASET/urban_violation` directory structure without enumerating every file manually.
- Sample JSON files from stage outputs and inspect image/visualization naming conventions.
- Identify fields needed by backend ingestion APIs and frontend views.

Acceptance:
- Dataset directory layers, file pairing rules, and representative JSON schemas are summarized.
- Unknowns or risky assumptions are listed explicitly.

## Phase 3 - Agent Task Split

Tasks:
- Convert documentation and dataset findings into work packages for frontend, backend, and integration testing agents.
- Define dependencies and sequencing between agents.
- Keep tasks implementation-ready and scoped to observable deliverables.

Acceptance:
- Each agent has clear responsibilities, inputs, outputs, and blocked-by relationships.
- Cross-agent contracts are explicit enough for parallel work.

### Shared Contract First

Before implementation agents diverge, freeze a minimal API/schema contract:

- Dataset: `Dataset`, `DatasetSummary`, `DatasetImportStatus`.
- Asset: `RawAsset`, stable `asset_id`, `sample_id`, `image_url`, dimensions, source paths, import status.
- Stage1: `PreAnnotationStep1`, `key_relations[]`, bbox coordinates, judge report, visualization URL.
- Stage2: `PreAnnotationStep2`, `fact_verifications[]`, `candidates[]`, candidate category/confidence/sample category, failure state.
- QC: queue item, review decision, human edits to bbox/category/reasoning, audit history.
- Import job: state machine from `Draft` through `QCQueueGenerated`, including `ValidationFailed` and `ImportFailed`.

The backend agent owns the canonical OpenAPI/Pydantic schema; the frontend agent consumes generated or manually mirrored TypeScript types; the integration testing agent validates the contract against sample fixtures.

### Backend Implementation Agent

Inputs:
- `urban_violation_platform_markdown/backend_architecture.md`
- `DATASET/urban_violation/images`
- `DATASET/urban_violation/stage1_run_0508`
- `DATASET/urban_violation/stage2_run_0508`
- `findings.md`

Execution tasks:
1. Scaffold FastAPI service with `uv`, async SQLAlchemy, PostgreSQL-compatible models, and local file/minio-compatible asset abstraction.
2. Implement database entities: `RawAsset`, `PreAnnotationStep1`, `PreAnnotationStep2`, `HumanReview`, `AuditArtifact`, plus `Dataset` and `ImportJob` if absent from the architecture draft.
3. Implement dataset importer that reads `meta/manifest.jsonl` as the pairing source, imports original images, stage1 records/parsed/visualizations, stage2 records/parsed/inputs/failures, and preserves raw request/response artifacts.
4. Normalize absolute source image paths into stable browser-safe asset URLs; store original paths only as internal provenance fields.
5. Implement import job state machine and validation:
   - Count expected assets.
   - Verify referenced files exist.
   - Verify bbox coordinate arrays are valid for 1280x720 sampled images or stored image dimensions.
   - Detect stage2 success/failure split.
6. Implement APIs:
   - Dataset list/detail/summary.
   - Import job create/status/validation preview.
   - Asset list with filters for category, judge decision, QC status, failure status, sample category.
   - Asset detail with image URL, stage1 relations, stage2 fact verifications/candidates, audit artifacts.
   - QC queue list, review detail, submit/update review.
   - Search endpoint over sample id, category, relation text, reasoning text.
   - Export job endpoint for reviewed/filtered samples.
7. Add backend tests for parser, importer, validation, state transitions, API responses, and failure handling.

Deliverables:
- Backend app entrypoint and reproducible `uv` environment.
- Pydantic schemas and OpenAPI docs.
- Importer with deterministic fixture support.
- Database migrations or schema initialization path.
- Unit/integration tests and seed/import command.

Acceptance criteria:
- `uv sync` and backend test command pass in a clean environment.
- Importing the provided dataset creates 797 raw assets, 797 stage1 records, 780 successful stage2 records, and records the stage2 failure set without crashing.
- Stage1 summary API reports 797 succeeded, 0 failed, 797 bbox-valid.
- Stage2 summary API reports 780 successful parsed records and exposes 19 failure records; rerun summary nuance is documented.
- Sample `000142_0_1762483003246` returns original image URL, stage1 relation bbox, stage2 fact verification, and candidate category.
- API never returns raw local absolute image paths as browser image sources.
- OpenAPI schema includes all frontend-needed fields and error responses.

### Frontend Implementation Agent

Inputs:
- `urban_violation_platform_markdown/frontend_architecture.md`
- `urban_violation_platform_markdown/frontend_uiux.md`
- UI mockups in `urban_violation_platform_markdown/images`
- Backend OpenAPI/schema from backend agent
- `findings.md`

Execution tasks:
1. Scaffold frontend using the repo-approved Node version and `npm`; add `.nvmrc` if a frontend project root is created and none exists.
2. Implement feature structure:
   - `app/`
   - `services/`
   - `features/datasets`
   - `features/import`
   - `features/review-workbench`
   - `features/qc`
   - `features/exports`
   - `shared/components`, `shared/composables`, `shared/types`
3. Implement routes:
   - `/datasets`
   - `/datasets/:id/overview`
   - `/datasets/:id/assets`
   - `/datasets/:id/import-jobs/:jobId`
   - `/datasets/:id/preannotations`
   - `/datasets/:id/qc`
   - `/datasets/:id/samples/:sampleId/review`
4. Build UI workflows:
   - Dataset dashboard with total counts, stage1/stage2 status, pass/soft-fail distribution, category distribution, and failure count.
   - Dataset registration/upload/import wizard with validation preview and state-machine status.
   - Import job validation view showing manifest pairing, missing file issues, bbox validation, and success/failure split.
   - Asset list with thumbnail, sample id, categories, judge decision, QC status, and filters.
   - Review workbench with image viewer, bbox overlays, stage1 relations, stage2 fact verifications, candidates, confidence/category chips, failure banner, and human review controls.
5. Implement typed API client and error/loading/empty states for all routes.
6. Add UI tests for routing, table filtering, import status display, review decision submission, and bbox overlay rendering.

Deliverables:
- Runnable frontend app.
- Typed service layer matching backend contract.
- Reusable components for asset table, status chips, bbox overlay, JSON/audit viewer, review form, import stepper.
- Tests and build scripts in `package.json`.

Acceptance criteria:
- `npm ci`, `npm run build`, and available test/lint commands pass.
- Frontend can render dashboard from backend fixture data without mock-only dependencies.
- Asset list can filter `pass`, `soft_fail`, stage2 failure, and violation categories.
- Review page for `000142_0_1762483003246` shows the 1280x720 image proportionally, draws relation bbox overlays, and displays stage1/stage2 reasoning fields.
- Stage2 failure samples show actionable failure state instead of a blank review panel.
- UI does not expose filesystem absolute paths; all media loads through backend URLs.

### Integration Testing Agent

Inputs:
- Backend API and frontend app from implementation agents.
- `DATASET/urban_violation` fixture.
- `findings.md`
- Shared contract/OpenAPI schema.

Execution tasks:
1. Build a small deterministic fixture subset containing:
   - One fully successful sample such as `000142_0_1762483003246`.
   - At least one `soft_fail` sample.
   - At least one stage2 failure sample such as `001710_0_1763108687181`.
   - Multiple violation categories, including `no violation`, `nonmotor_vehicle_illegal_parking`, and `goods_blocking_road`.
2. Run backend import against the subset and full dataset smoke import where feasible.
3. Validate API contract with schema checks and sample response assertions.
4. Run frontend E2E checks against the backend:
   - Dataset list to overview.
   - Import job status/validation.
   - Asset list filters.
   - Sample review page.
   - Review submission and audit trail refresh.
5. Add regression tests for known dataset edge cases:
   - Stage2 manifest has both success and failure semantics.
   - Candidate counts can exceed sample counts.
   - `soft_fail` is not an import failure.
   - Bbox coordinates are pixel coordinates and must scale in UI.

Deliverables:
- Test fixture manifest.
- Backend API integration tests.
- Frontend E2E tests.
- Contract validation report.
- Final acceptance checklist with commands and observed counts.

Acceptance criteria:
- A fresh environment can import the deterministic fixture and produce stable counts.
- Contract tests verify required fields for dashboard, asset list, review detail, review submit, and failure detail.
- E2E tests prove that media URLs load, overlays render, filters work, and review submission persists.
- Full dataset smoke test confirms expected high-level counts or documents any environment-specific skip.
- Test report separates product bugs, environment issues, and open questions.

### Recommended Sequencing

1. Backend agent freezes schema and importer on a 5-10 sample fixture.
2. Frontend agent builds pages against the frozen schema, initially using recorded API fixtures if backend is still moving.
3. Integration testing agent builds fixture pack and contract checks in parallel once schemas exist.
4. Backend agent runs full dataset import and exposes summary metrics.
5. Frontend agent removes any temporary fixture-only assumptions and points to live backend.
6. Integration testing agent runs E2E and reports blockers.

## Global Handoff Gates

Contract gate:
- Backend OpenAPI/Pydantic schema covers all dashboard, import, asset list, review, QC, search, and export fields.
- Frontend type definitions match the backend schema.
- Integration tests validate representative responses against the schema.

Dataset gate:
- Importer uses `meta/manifest.jsonl` as the primary pairing source.
- Full dataset import or smoke import reports:
  - 797 raw assets.
  - 797 stage1 parsed/record entries.
  - 780 successful stage2 parsed/record entries.
  - 19 stage2 failure files preserved.
- `soft_fail` is treated as review/QC signal, not an import failure.

UI gate:
- Routes listed in `frontend_architecture.md` are implemented.
- Five UI surfaces from `frontend_uiux.md` exist and load backend data.
- Review workbench displays original image, bbox overlays, stage1 relations, stage2 fact verifications, candidates, failure state, and human review form.

Verification command gate:
- Backend: `uv sync`, then the repo-defined backend test command via `uv run ...`.
- Frontend: use `nvm` for the project Node version, then `npm ci`, `npm run build`, and repo-defined `npm run test` or `npm run lint`.
- Integration: run backend API tests, frontend E2E tests, and contract/fixture validation against the deterministic fixture subset.

Open-question gate:
- Decide raw request/response storage policy.
- Decide stage2 failure queue behavior.
- Decide label dictionary/display language strategy.
- Confirm actual frontend framework once code scaffolding starts.

## Phase 5 - Git Repository And Agent Worktrees

Tasks:
- Initialize this directory as a Git repository.
- Exclude large local dataset files from version control.
- Commit the planning/documentation baseline.
- Create separate Git worktrees for backend, frontend, and integration testing agents.
- Add handoff instructions for each worktree.

Acceptance:
- `git status` in the main worktree is clean after baseline setup.
- `git worktree list` shows one main worktree and three agent worktrees.
- Each agent worktree is on its own branch with a task handoff file.
- `DATASET/` remains ignored and available from the main absolute path.

## Phase 6 - Shared Contract/Bootstrap Execution

Tasks:
- Start from backend schema/API contract and deterministic fixture definition.
- Keep frontend and integration branches aligned through explicit contract files.
- Reconcile the backend contract artifact with frontend TypeScript types and integration fixture checks.
- Decide whether to merge backend contract into main before frontend contract consumption, or cherry-pick contract artifacts into frontend/integration branches.

Acceptance:
- Backend branch has the first canonical schema/contract artifact.
- Frontend branch can consume the contract without inventing response shapes.
- Integration branch has a fixture manifest that covers success, soft-fail, and failure samples.
- First-slice status:
  - Backend complete on `agent/backend-implementation` at `fc82b60`.
  - Frontend complete on `agent/frontend-implementation` at `83f4501`.
  - Integration complete on `agent/integration-testing` at `8344695`.

## Phase 7 - Remaining Task Backlog

Tasks:
- Consolidate remaining unfinished work after the first agent slices.
- Separate tasks by priority and owner.
- Define acceptance criteria for the next execution cycle.

Acceptance:
- `REMAINING_TASKS.md` exists.
- Remaining work is grouped into P0/P1/P2 priorities.
- Next execution order is explicit.

## Phase 8 - P0 Execution Cycle

Goal:
- Move from isolated first slices to a working fixture-backed vertical loop.

Agent assignments:
- Backend: implement runnable FastAPI API over fixture import, keep backend schema as canonical contract, and expose browser-safe media endpoints.
- Frontend: replace fixture-only usage with live backend API integration while preserving fixture fallback for tests/dev.
- Integration: convert skipped skeleton tests into URL-parameterized contract/E2E checks that run when backend/frontend URLs are provided.

Acceptance:
- Backend branch starts a local API server and passes API tests.
- Frontend branch builds/tests and can point at backend URL without response shape patches.
- Integration branch validates fixtures, runs contract tests against backend URL, and has E2E checks ready for frontend URL.
- Main `progress.md` records each branch commit and validation result.

Results:
- Backend complete on `agent/backend-implementation` at `f6a76ee`.
- Frontend complete on `agent/frontend-implementation` at `5d55505`.
- Integration complete on `agent/integration-testing` at `501578a`.
- Active backend contract against `http://127.0.0.1:8000`: 6 passed.
- Active E2E against backend/frontend URLs: 3 passed, 1 skipped. The skipped review submit/audit refresh case remains under the P1 Review and Audit Workflow backlog.

## Phase 4 - Acceptance Criteria

Tasks:
- Define phase gates and final acceptance criteria for each agent.
- Include verification commands, sample data checks, API contract checks, and UI workflow checks where applicable.
- Update `progress.md` with completed analysis steps.

Acceptance:
- The final plan can be used directly as an execution brief.
- Remaining open questions are separated from executable work.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `cat ~/.codex/skills/planning-with-files/SKILL.md` failed because the AGENTS path does not exist on this machine. | Read skill from AGENTS-specified path. | Used installed skill path `/home/hy/.agents/skills/planning-with-files/SKILL.md`. |
| `git status --short` failed because `/mnt/lc/LC/ares_xtws/0_train_data/data_platform` is not inside a Git repository. | Final verification. | Treated as environment fact; verified planning files directly instead. |

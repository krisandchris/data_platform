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
- Phase 9: Full DATASET registration for product preview - complete
- Phase 10: Immersive QC sample review redesign - complete
- Phase 11: Reference-aligned Sample Detail workbench redesign - complete
- Phase 12: Sample review non-blocking refresh mode - complete
- Phase 13: Review workbench layout and bbox editing refinement - complete
- Phase 14: Direct image-stage bbox editing and fill-area alignment fix - complete
- Phase 15: Sample review focused chrome reduction - complete
- Phase 16: Minimal bbox preview styling - complete
- Phase 17: Quantized bbox coordinate projection fix - complete
- Phase 18: Bbox color and selected-state styling rule - complete
- Phase 19: Review bottom dock and panel height expansion - complete

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
   - Verify bbox coordinate arrays are valid 0-1000 quantized coordinates with ordered corners.
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
- Integration test harness complete on `agent/integration-testing` at `501578a`.
- Integration product validation complete on `agent/integration-testing` at `ee3deb5`; it validated the backend and frontend worktree products as running services and published `docs/front_back_integration_report.md`.
- Active backend contract against `http://127.0.0.1:8000`: 6 passed.
- Active E2E against backend/frontend URLs: 3 passed, 1 skipped. The skipped review submit/audit refresh case remains under the P1 Review and Audit Workflow backlog.

## Phase 9 - Full DATASET Registration For Product Preview

Goal:
- Replace the 2-sample runtime default with the real `DATASET/urban_violation` dataset so frontend pages can be judged against representative product data.

Tasks:
- Load all stage1 manifest samples into the backend runtime service by default.
- Preserve deterministic subset import support for unit tests.
- Normalize stage2 parsed payloads that include dataset-only extra fields.
- Expose import validation rows and mapping counts for the import task page.
- Expose dataset distributions and preannotation counts for overview/preannotation pages.
- Expose asset/category/confidence fields for asset list and QC queue pages.
- Re-run frontend/backend preview against live services.

Acceptance:
- Backend summary reports 797 raw assets, 797 stage1 records, 780 successful stage2 records, and 19 preserved stage2 failure artifacts.
- Backend import job returns 797 validation rows.
- Backend QC queue returns 797 samples.
- Frontend pages render without route-level error state:
  - `/datasets`
  - `/datasets/urban_violation/overview`
  - `/datasets/urban_violation/assets`
  - `/datasets/urban_violation/import-jobs/fixture-import-urban-violation`
  - `/datasets/urban_violation/preannotations`
  - `/datasets/urban_violation/qc`
  - `/datasets/urban_violation/samples/000142_0_1762483003246/review`
  - `/datasets/urban_violation/samples/001710_0_1763108687181/review`

Results:
- Backend full registration verified with `uv run pytest`: 13 passed.
- Frontend live adapter verified with `npm run build` and `npm run test`: build passed, 14 tests passed.
- Integration validation after full registration: fixture validator passed, contract tests 6 passed, E2E smoke 3 passed and 1 skipped.
- Local tmux preview services are running as `uvp-backend` and `uvp-frontend`.

## Phase 10 - Immersive QC Sample Review Redesign

Goal:
- Redesign the sample review route around the actual evidence flow from STEP1 and STEP2.

Analysis:
- STEP1 is the spatial evidence layer: environment analysis, scene elements, anchors, relation text, and 0-1000 quantized bboxes.
- STEP2 is the decision evidence layer: fact verification result/confidence, candidate category, evidence relation indices, and reasoning.
- Stage2 failure samples must keep the image and STEP1 relation layer visible while showing the failure reason as a first-class remediation signal.

Implementation:
- Replaced the three-column table-like review shell with a single-screen evidence workbench.
- Added a left QC queue rail, central image evidence canvas, relation timeline, right evidence inspector, and fixed decision dock.
- Preserved review submission semantics and the existing backend/frontend API contract.

Acceptance:
- Success sample review route renders STEP1, STEP2, candidate, image, bbox, and review controls in one screen.
- Stage2 failure sample route renders image, STEP1 evidence, failure reason, and review controls without a blank panel.
- `npm run test` passes.
- `npm run build` passes.

## Phase 11 - Reference-Aligned Sample Detail Workbench Redesign

Goal:
- Align the live sample review route with `2026-05-13-qc-tool-ui-interaction-design.md` and `2026-05-13-qc-tool-ui-interaction-preview.html`.

Implementation:
- Reworked the review shell into the reference Sample Detail structure:
  - Fixed top status/action bar with sample, progress, stage judge, draft state, Prev/Next/List, Save Patch, Pass, and Fail.
  - Left image evidence panel with STEP1/STEP2/candidate bbox layer toggles, global facts, scene elements, anchors, and active relation summary.
  - Middle relation review panel with active relation expansion, Step1 Core, Step2 Verification, orphan warnings, and stage2 failure warnings.
  - Right candidate/verdict panel with evidence relation checklist, Pass gate, vote note, review decision buttons, and patch preview.
- Preserved the existing review submission API contract while adding local Save Patch/draft-gate state for the current frontend surface.
- Added route-prop reload handling so Prev/Next sample navigation reloads the review payload in the reused Vue route component.

Acceptance:
- Success sample route includes image evidence, relation review, candidate verdict, Pass gate, patch preview, and submit controls.
- Stage2 failure sample route keeps image and STEP1 relation evidence visible and shows the STEP2 failure remediation state.
- `npm run test` passes with 14 tests.
- `npm run build` passes.
- Headless browser checks pass for:
  - `/datasets/urban_violation/samples/000142_0_1762483003246/review`
  - `/datasets/urban_violation/samples/001710_0_1763108687181/review`

## Phase 12 - Sample Review Non-Blocking Refresh Mode

Goal:
- Remove visible screen flicker when navigating between samples from the review workbench.

Root Cause:
- `ReviewWorkbenchPage.vue` reused the same route component for Prev/Next navigation, but the route watcher called the same `load()` path used for first entry.
- That path set `loading=true`, causing the template to unmount `ReviewWorkbenchShell` and render the full-page loading state before the next sample detail returned.

Implementation:
- Split review loading into first-entry `initialLoading` and same-dataset `refreshing`.
- Keep the current review workbench mounted while a new sample detail request is in flight.
- Show a compact sticky refresh banner during sample switching instead of replacing the screen.
- Fetch the QC queue during initial load; sample switches fetch only the review detail so the transition is shorter and less disruptive.
- Guard async responses with a request sequence so stale sample responses cannot overwrite a newer navigation.

Acceptance:
- Switching from sample `000142_0_1762483003246` to the next sample does not show `Loading review sample...`.
- During the pending request, the old review detail remains visible and a `正在切换到 ...` banner appears.
- After the next sample detail resolves, the target sample replaces the old detail and the banner disappears.
- `npm run test` passes with 15 tests.
- `npm run build` passes.
- Headless Chrome CDP navigation check verifies transition and final states.

## Phase 13 - Review Workbench Layout And Bbox Editing Refinement

Goal:
- Apply the latest sample-review layout and interaction corrections requested after the non-blocking refresh pass.

Implementation Order:
1. Remove the visible sample-switch sticky refresh banner while keeping the non-blocking refresh model.
2. Remove the bottom active-relation summary from the image evidence card.
3. Add bbox selection and bbox coordinate editing.
4. Reflow the workbench to a two-column layout:
   - Left: image evidence, global facts, scene elements, anchors, bbox coordinate editor.
   - Right: stacked Relation review card over Candidate/verdict card.
   - Bottom: unified review action bar containing vote note, approve, reject, manual-label, and submit controls.
5. Remove subtitle descriptions from panel headers so each card's left header contains only the primary title.

Acceptance:
- No visible `正在切换到 ...` banner appears while switching samples.
- The image evidence card no longer renders the old active relation text block.
- Clicking a bbox selects the corresponding relation and opens its Relation review row.
- Editing bbox coordinates updates the selected relation display and patch preview.
- Relation and Candidate cards stack vertically on the right side at desktop width.
- `npm run test` passes with 16 tests.
- `npm run build` passes.
- Headless Chrome checks confirm no refresh banner/loading flash, bbox click opens R3, bbox edit writes `[400, 492, 452, 545]` into the relation/patch state, and the new layout screenshot is captured at `/tmp/uvp_review_layout_new.png`.

## Phase 14 - Direct Image-Stage Bbox Editing And Fill-Area Alignment Fix

Goal:
- Replace manual bbox coordinate editing with direct manipulation inside the image preview.
- Ensure bbox rendering and pointer math use the actual rendered image stage, not the black letterbox/pillarbox fill area.

Implementation:
- Refactored `BBoxOverlay` to split the black preview shell from the real image stage.
- Measured the shell with `ResizeObserver` and sized `.bbox-shell__stage` to the actual image aspect ratio inside the shell.
- Rendered overlay boxes inside the stage only, so boxes cannot drift into side fill areas.
- Added direct editable overlays:
  - Drag a box to move it.
  - Drag the bottom-right handle to resize it.
  - Clicking or editing a box selects the matching Relation row.
- Removed the manual `BBox 坐标` editor from the image evidence card.
- Changed the bottom review action bar to normal layout flow so it no longer overlays and intercepts lower image/box pointer events.
- Kept bbox edits synchronized with relation display and Patch Preview through `draftRelationBboxes`.

Acceptance:
- Browser validation shows the shell can have side fill while the stage remains inside the shell and boxes remain inside the stage.
- No manual bbox coordinate inputs or `BBox 坐标` editor are rendered.
- No visible `正在切换到 ...` refresh banner is rendered.
- Dragging R3 in the image preview selects R3, updates its relation bbox, and writes a `relation:R3` bbox entry into Patch Preview.
- `npm run test` passes with 18 tests.
- `npm run build` passes.
- Updated screenshot captured at `/tmp/uvp_review_direct_bbox.png`.

## Phase 15 - Sample Review Focused Chrome Reduction

Goal:
- Remove non-review chrome when entering the sample audit stage so the viewport is dedicated to review work.

Root Cause:
- The sample review route was rendering three stacked header/chrome layers:
  - Global `AppShell` sidebar/topbar with platform navigation and search.
  - `ReviewWorkbenchPage` page title/actions header.
  - `ReviewWorkbenchShell` review-specific sample status/action topbar.

Implementation:
- Added review-focus mode to `AppShell` for `/datasets/:id/samples/:sampleId/review`.
- In review-focus mode, hide the global sidebar and topbar and make the page surface full-width with compact dark padding.
- Removed the page-level review header from `ReviewWorkbenchPage`.
- Kept only the review-specific workbench header with sample state, progress, stage judge, draft state, Prev/Next, and List.

Acceptance:
- Sample review route no longer renders global sidebar, global search topbar, or the page-level `质检工作台 / 样本审阅` header.
- Review workbench remains visible and starts near the top of the viewport.
- Other non-review routes keep the normal platform shell.
- `npm run test` passes with 19 tests.
- `npm run build` passes.
- Browser DOM check confirms `app-shell--review-focus`, no `.sidebar`, no `.topbar`, no `.page-header`, and workbench top at 10px.
- Updated screenshot captured at `/tmp/uvp_review_focus_mode.png`.

## Phase 16 - Minimal Bbox Preview Styling

Goal:
- Remove visible text labels from bbox overlays and make the image preview annotation layer visually minimal.

Implementation:
- Removed the visible `<span>` label from each bbox overlay.
- Preserved each bbox label as `aria-label` so keyboard/screen-reader context is not lost.
- Reworked bbox styling to use a restrained 1px line, transparent fill, subtle selected state, softer colors, and a small square resize handle.
- Removed the review-shell override that positioned bbox label text above the image.

Acceptance:
- No bbox overlay renders visible text.
- Bbox overlays still expose accessible names through `aria-label`.
- Drag/resize and relation-selection interactions remain intact.
- `npm run test` passes with 19 tests.
- `npm run build` passes.
- Browser DOM check confirms 8 bbox overlays, empty visible text, retained aria labels, and the simplified 1px selected border.
- Updated screenshot captured at `/tmp/uvp_review_minimal_boxes.png`.

## Phase 17 - Quantized Bbox Coordinate Projection Fix

Goal:
- Correct bbox projection so all overlay boxes use the dataset's 0-1000 quantized coordinate system instead of treating bbox values as source-image pixels.

Root Cause:
- `BBoxOverlay` divided bbox x values by `imageWidth` and y values by `imageHeight`.
- For a 1280x720 image, a quantized bbox such as `[163, 362, 336, 632]` was incorrectly rendered as `left=12.7%`, `top=50.3%` instead of `left=16.3%`, `top=36.2%`.

Implementation:
- Added an explicit `BBOX_COORDINATE_MAX = 1000` coordinate space in `BBoxOverlay`.
- Converted bbox placement to percentages with `value / 1000`.
- Converted pointer drag/resize positions from the rendered image stage back into 0-1000 coordinates.
- Kept `imageWidth/imageHeight` only for the rendered image stage aspect ratio.
- Updated bbox overlay tests to validate quantized coordinates on non-1000 source image resolutions.

Acceptance:
- `npm run test` passes with 20 tests.
- `npm run build` passes.
- Browser check confirms sample R1 `[163, 362, 336, 632]` renders as `left: 16.3%; top: 36.2%; width: 17.3%; height: 27%`.
- Browser check confirms the rendered box remains inside the actual image stage.
- Updated screenshot captured at `/tmp/uvp_review_quantized_boxes.png`.

## Phase 18 - Bbox Color And Selected-State Styling Rule

Goal:
- Enforce the requested bbox visual rule: default boxes use pure 2px non-red lines; selected boxes become thicker and red.

Implementation:
- Changed default bbox styling to `2px solid currentColor` with no shadow/fill treatment.
- Changed selected bbox styling to a `4px` red border.
- Stopped mapping orphan stage1 relations and unsupported stage2 verifications to red tones.
- Kept default tones to blue, green, orange, and purple.

Acceptance:
- Default bbox overlays do not use red as their line color.
- Selected bbox overlay is red and thicker than default overlays.
- `npm run test` passes with 20 tests.
- `npm run build` passes.
- Browser computed-style check confirms selected R1 is `4px` red and default R2/R3/S2 boxes are `2px` non-red lines.
- Updated screenshot captured at `/tmp/uvp_review_box_color_rules.png`.

## Phase 19 - Review Bottom Dock And Panel Height Expansion

Goal:
- Align the vote note/review action dock to the browser bottom and increase the usable height of the image evidence and right-side review panels.

Root Cause:
- The review workbench used fixed grid height math (`calc(100vh - 380px)`) that left unused vertical space and kept the vote note/action bar above the browser bottom.
- The bottom action bar also had bottom padding, so the vote note textarea did not visually touch the bottom edge even after the dock reached the viewport bottom.

Implementation:
- Changed the review-focus page surface to a fixed viewport-height surface with no bottom padding on desktop.
- Changed `ReviewWorkbenchShell` to a full-height flex column.
- Let `.review-grid` flex to fill the remaining height between the top status bar and bottom action dock.
- Increased image evidence minimum row height and made the right-side Relation/Candidate panels share the expanded vertical space.
- Removed bottom padding and bottom border/radius from the review action dock so the vote note textarea aligns with the browser bottom.
- Kept responsive breakpoints in normal document flow on narrower screens.

Acceptance:
- `npm run test` passes with 20 tests.
- `npm run build` passes.
- Browser layout check confirms action dock bottom gap is `0` and vote note textarea bottom gap is `0`.
- Browser layout check confirms the image stage is 430px high and Relation/Candidate panels are each 310px high in the 1440px desktop check.
- Updated screenshot captured at `/tmp/uvp_review_bottom_aligned_layout.png`.

## Phase 20 - QC Label Field Editing Design Document

Goal:
- Define how the QC workbench edits model label fields without overwriting model baseline data.
- Separate fixed dictionary fields from flexible open-tag fields.
- Explicitly handle `scene_elements` and `segmentation_targets` as open controlled tags, not closed enums.

Implementation:
- Added `docs/qc_label_field_editing_design.md`.
- Documented the `baseSample` / `reviewDraft` / `mergedSample` / `buildPatch` editing model.
- Defined field categories: closed enum, open controlled tags, numeric confidence, free text, and quantized bbox.
- Designed dictionary-backed validation for category/relation/result fields.
- Designed suggestion-backed but non-blocking validation for `scene_elements` and `segmentation_targets`.
- Added patch payload examples for closed enum replacement, open-tag add, open-tag normalization, and tag deletion.

Acceptance:
- The design clearly states that `scene_elements` and `segmentation_targets` are not fixed enumerable fields.
- Closed enum fields have a backend dictionary contract and save-time validation rule.
- Open tags preserve `raw_text`, `normalized_text`, optional `canonical_code`, status, and audit history.
- The design can be used directly by frontend, backend, and integration agents for the next implementation slice.

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

# Progress

Last compacted: 2026-05-19

This file now records only current project progress and recent verification context. Detailed historical phase logs are preserved in git history.

## Current State

- Main workspace is initialized as a git worktree with dedicated frontend, backend, and integration agent worktrees.
- `AGENTS.md` now defines main-workspace governance: product frontend/backend code work should be done in agent worktrees first, then reviewed and synchronized into main.
- `scripts/agent-dev-stack.sh` starts and stops frontend/backend code from the agent worktrees for human review.
- `scripts/dev-stack.sh` remains the launcher for accepted main-workspace code.
- Current accepted code includes dataset management, import jobs, asset browsing, preannotations, QC queue, sample review, label editing, label config upload/reload, multi-user assignment, user center, permissions, and audit baseline.
- Current documentation has been organized under `docs/README.md`, `docs/frontend/README.md`, `docs/backend/README.md`, and `docs/architecture/README.md`.

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
- Removed earlier detailed design and implementation docs from `docs/` after consolidating durable content into the four current entry documents.
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
- Make label config save idempotent for identical content.
- Move default label/config/runtime persistence away from raw `DATASET/` unless explicitly configured.
- Harden manual batch import validation and source-path diagnostics.
- Add a reproducible browser smoke setup or document the system-Chrome fallback as the standard local path.

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

At the time of this compaction, no new frontend/backend service was intentionally started. Any future live verification must end with both stack stop commands and a process/port check.

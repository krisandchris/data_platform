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

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

Problem:

- Restart/reload does not create new versions, but saving the same content repeatedly creates duplicate `label-config-N` versions because backend save is not content-hash idempotent.

Required behavior:

- Identical content save should reuse the existing version or require an explicit "save as new version" action.
- Manual `重新加载 active` must never create a version.
- Runtime config root should not default to raw `DATASET/` if the dataset must remain strictly input-only.

Acceptance:

- Repeated save of unchanged config does not append a duplicate version.
- Reload active keeps the same active config id and content hash.
- Tests cover restart, reload, duplicate save, and explicit new-version save.

### P1 - Dataset Batch Product Hardening

- Persist import validation history or clearly separate recalculated validation from audit history.
- Make manual batch source-path warnings clearer when backend cannot read `source_uri`.
- Keep batch QC queue generation explicit and label-config gated.
- Keep batch-scoped state keyed by concrete batch id.

### P2 - Integration Test Environment

- Add a reproducible browser smoke setup if Playwright remains absent from the repo environment.
- Keep headless Chrome fallback documented for local checks.
- Add integration scripts that assert actual backend action strings and current route contracts.

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

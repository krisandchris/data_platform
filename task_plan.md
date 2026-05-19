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
- Whether frontend operation telemetry should be added after backend-derived attribution is stable, and which privacy/storage limits it should use.
- Whether rollback should be enabled in the first version-history release or kept as an admin-only recovery operation.

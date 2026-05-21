# Overall Architecture

Last updated: 2026-05-21

## System Shape

Urban Violation Platform is a local dataset management and QC system for image-based violation annotation outputs. It combines:

- A Vue frontend for dataset operations, QC, user center, and audit.
- A FastAPI backend for dataset import, label config, QC workflow, RBAC, and runtime state.
- A readonly `DATASET/` fixture tree used as source data.
- Dedicated frontend/backend/integration agent worktrees for implementation and validation.

For LAN deployment, see [Docker LAN Deployment](./deployment.md).
For the PostgreSQL + Redis migration boundary, see [State Persistence Boundaries](./state-persistence-boundaries.md).
For the operator migration draft, see [PostgreSQL + Redis Migration Runbook](./postgres-redis-migration-runbook.md).

## Main Concepts

| Concept | Meaning |
| --- | --- |
| Dataset type | Shared field schema and label config boundary, for example `urban_violation` or `ares_detection`. |
| Dataset batch | Concrete work unit for import/assets/preannotations/QC, for example `urban_violation__0508_fixture`. |
| Import job | Batch creation/refresh execution record and validation surface. |
| Asset | Image/sample entry inside a batch. |
| STEP1 | Scene/relation evidence extraction result. |
| STEP2 | Fact verification and candidate generation result. |
| Label config | Type-level dictionary and validation configuration. |
| QC queue | Concrete-batch task list generated after preannotation readiness. |
| Assignment | One active assignee for one concrete batch. |
| Lease | One active editor for one sample. |
| Draft | User-owned unsent label patch. |
| Submission | Immutable annotator-submitted label patch awaiting lead confirmation. |
| Audit event | Runtime action record for management and traceability. |

## Data Flow

1. Dataset type is created or selected.
2. Type-level label config is uploaded, validated, saved, and activated.
3. A concrete batch is registered under the type.
4. Import job scans images-only or images-with-STEP outputs.
5. Backend ingests readable source paths and exposes assets/media through normalized URLs.
6. Batch enters preannotation-ready state when STEP outputs are available.
7. QC queue is explicitly generated for the concrete batch.
8. Manager or lead assigns the batch to one active user.
9. Annotator leases samples, edits labels, validates current-sample field legality, saves batch drafts manually or through autosave, and submits the assigned batch when the batch QC work is complete.
10. qc_lead confirms or returns submitted changes.
11. Audit/progress surfaces track actions and state.

## Frontend/Backend Contract

The contract is batch-centric for execution state:

- Frontend routes must preserve concrete batch id.
- Backend permissions must scope batch work to concrete batch id.
- Label config reads use dataset type context.
- Review/detail/edit APIs use concrete batch id.
- Media URLs are backend-served URLs, not raw file paths.
- Validation errors should expose field-level detail for UI display.

## Label Config Versioning Contract

Label config is type-scoped and manually updated from the dataset-type label-config page.

Required behavior:

- History is retained for comparison, but a semantic config version must be unique per dataset type.
- Semantic identity is enforced with both uploaded `config.version` and normalized `content_hash`.
- Re-uploading identical content returns the existing history entry and may activate it; it must not create another `label-config-N`.
- Uploading changed content with the same `config.version` returns `409 label_config_version_conflict`.
- Uploading changed content with a new `config.version` creates exactly one new history entry and activates it by default.
- Normal frontend operation exposes one write path: `上传并更新配置`.
- History rows are read-only comparison records. Per-row activation and `另存为新版本` are excluded from the normal UI until rollback is separately designed.
- Runtime label config state defaults to `.runtime/label_config_state` or an explicit `LABEL_CONFIG_STORE_ROOT`, never raw `DATASET/`.
- Old stores with duplicate same-hash records must be repaired by preserving one canonical active entry and excluding redundant entries from active history.

## Multi-User Model

Roles are internal platform roles. Production identity for this phase is internal custom account login.

Core rules:

- `platform_admin` can manage accounts and role bindings.
- `dataset_admin`, `batch_manager`, and `qc_lead` can participate in assignment according to permission scope.
- `annotator` edits assigned batch samples.
- `auditor` reads audit according to granted scope.
- One batch has one active assignee.
- One sample has one active editor.
- Annotator submission requires qc_lead confirmation.

## Label Editing Model

The review workbench must keep original model output and human edits separate:

- Base sample data is readonly.
- Human edits are patch operations.
- Drafts are private to the user.
- Submit creates immutable submission history.
- Validation is field-legality validation.
- Semantic correctness is reviewed by humans and lead confirmation, not by the `校验修改` button.

## QC Closed Loop Optimization Plan

The rectification plan should be adapted to the current project as a post-QC data flywheel:

```text
preannotation ready
  -> baseline annotation snapshot
  -> annotator draft/submission patch
  -> qc_lead confirm
  -> confirmed annotation snapshot
  -> snapshot diff
  -> derived modification events
  -> error attribution statistics
  -> correction sample pool
  -> training export
  -> model evaluation and version comparison
```

Key correction to the original proposal:

- The canonical source for modification behavior is the difference between the pre-QC baseline annotation and the qc_lead-confirmed annotation.
- Frontend operation telemetry may be added later as auxiliary context, but it must not be the only source of truth.
- Draft saves, submit/return cycles, cross-session edits, and lead confirmation timing make frontend-only event capture insufficient for authoritative attribution.
- The review workbench layout and bbox interaction remain protected; closed-loop work should integrate through existing patch, submission, and confirmation contracts.

### Data Ownership

| Data | Scope | Source |
| --- | --- | --- |
| Baseline annotation snapshot | dataset batch + sample | Imported STEP1/STEP2 output after preannotation readiness. |
| Confirmed annotation snapshot | dataset batch + sample | Materialized result of accepted label-edit operations after qc_lead confirmation. |
| Annotation diff | dataset batch + sample | Deterministic backend diff between baseline and confirmed snapshots. |
| Modification event | dataset batch + sample + reviewer | Derived from the diff and enriched with submission/audit metadata. |
| Error attribution summary | dataset batch/type/user/time/category | Aggregated from modification events. |
| Correction sample pool item | global, batch-linked | Created from confirmed changed samples. |
| Export job | global, source-filtered | Uses correction pool or completed batch snapshots. |
| Evaluation run | model/version + dataset batch/pool | Stores metrics, comparison deltas, and changed sample references. |

### Event And Attribution Mapping

The first implementation should derive these event classes from backend diff results:

| Event | Derived from | Attribution |
| --- | --- | --- |
| `relation_modify` | Relation subject/relation/object/description changed. | STEP1 relation extraction error. |
| `relation_bbox_adjust` | Relation bbox changed in 0-1000 coordinates. | STEP1 localization offset. |
| `candidate_category_change` | Candidate category changed. | STEP2 classification error. |
| `candidate_delete` | Existing candidate removed. | STEP2 false positive. |
| `candidate_add` | New candidate added. | STEP2 missed detection. |
| `candidate_evidence_edit` | Evidence relation, reasoning, confidence, observation, or tag fields changed. | STEP2 reasoning/evidence error. |

Bbox offset analysis must stay in quantized 0-1000 coordinates for storage and statistics. UI projection to pixels remains a frontend rendering concern only.

### Backend Work Breakdown

1. Snapshot foundation:
   - Add file-backed snapshot storage under `PLATFORM_STATE_ROOT`.
   - Create baseline snapshots when a batch reaches preannotation readiness or QC queue generation.
   - Create confirmed snapshots during `confirm_submission`.
   - Store payload hash, label config id/version, source submission id, actor, and timestamp.

2. Diff and event derivation:
   - Materialize confirmed annotations by applying accepted `LabelEditOperation` records to the baseline payload.
   - Generate normalized diff operations per sample.
   - Map diff operations to `ModificationEvent` records and attribution codes.
   - Keep events batch-scoped and reviewer/lead traceable.

3. Attribution APIs:
   - Add batch-level event list and statistics endpoints.
   - Aggregate by batch, dataset type, category, reviewer, time window, event type, and bbox offset band.
   - Keep raw `DATASET/` readonly; all derived state stays in `PLATFORM_STATE_ROOT`.

4. Correction sample pool:
   - Auto-create or update pool items after qc_lead confirms changed samples.
   - Store sample id, batch id, confirmed snapshot id, event tags, attribution tags, changed field count, and complexity score.
   - Provide list/detail/stats APIs with filters for dataset type, batch, category, attribution, reviewer, and time.

5. Export jobs:
   - Add async export task state and generated file retention.
   - Support COCO JSON first, then VOC XML and custom JSON.
   - Export from correction pool filters or completed batch snapshots.

6. Evaluation and version governance:
   - Store evaluation runs and metric deltas.
   - Add snapshot list/diff APIs before rollback.
   - Implement rollback only after exact snapshot restore tests are available.

### Frontend Work Breakdown

1. Batch overview enhancements:
   - Add tabs to the existing batch overview for `质检分析`, `模型评估`, and `版本历史`.
   - Start with readonly analysis cards and tables; do not add new editing controls inside the review workbench.

2. Sample pool:
   - Add a global `修正样本池` entry in AppShell.
   - Provide filters, changed-field summary, attribution tags, before/after entry point, and export selection.

3. Export management:
   - Add export creation and export task list surfaces.
   - Show task status, source filter, format, item count, error, and download action.

4. Version and evaluation views:
   - Display snapshot timeline and diff summaries.
   - Display model evaluation metrics and version deltas.

### Integration Acceptance

- A sample with STEP1/STEP2 baseline can be edited, submitted, confirmed, and then produce one confirmed snapshot.
- The backend can derive modification events from baseline-vs-confirmed diff without relying on frontend-only operation logs.
- Attribution stats are visible from the batch overview `质检分析` tab.
- A confirmed changed sample appears in the correction pool.
- COCO export validates against generated pool items.
- Evaluation comparison can show metric deltas and changed samples when evaluation records exist.
- Snapshot rollback is not enabled until exact payload restore and permission checks are covered by tests.

## Runtime And Persistence

Source data:

- `DATASET/` is source input and should be treated as readonly.
- Uploaded archive extraction directories, media files, and export artifact files remain filesystem content.
- PostgreSQL is the target authority for mutable platform records after TASK-019.
- Redis is the target coordination layer for active locks, live progress, and cache only; it is not an authority for drafts, submissions, audit, label config, or registry metadata.

Runtime state:

- Use `PLATFORM_STATE_ROOT` for users, roles, sessions, assignments, leases, drafts, submissions, audits, and registered batches.
- Use `LABEL_CONFIG_STORE_ROOT` for label config state when explicitly set; otherwise use a repo-local `.runtime/label_config_state` default.
- Do not write runtime state into raw `DATASET/`.

Local services:

- Main accepted code: `scripts/dev-stack.sh`
- Agent worktree code: `scripts/agent-dev-stack.sh`

## Agent Workflow

Main workspace:

- Planning, documentation, integration review, and accepted-code sync.

Frontend agent worktree:

- Frontend product implementation.

Backend agent worktree:

- Backend product implementation.

Integration agent worktree:

- Frontend/backend product validation against running services and real DATASET fixture.

Acceptance flow:

1. Sync main into target agent worktree.
2. Assign bounded task with protected paths.
3. Agent implements and verifies in its worktree.
4. Run agent stack from main for human review when needed.
5. Integration validates frontend and backend together.
6. Sync accepted changes into main.
7. Stop all services and check ports/processes.

## Validation Matrix

| Change type | Required validation |
| --- | --- |
| Backend API/workflow | `PLATFORM_STATE_ROOT=/tmp/uvp-check uv run pytest` |
| Backend schema-heavy change | Add `uv run python -m py_compile ...` for touched modules |
| Frontend route/API/UI shell | `npm run test` and `npm run build` |
| Review workbench change | Review-specific tests, bbox tests, browser smoke, and explicit user approval |
| Dataset import change | Real `DATASET/` scan/import tests and batch-id scoping checks |
| Multi-user change | Two-user assignment/lease/submission/lead-confirm smoke |
| QC closed-loop change | Baseline snapshot, confirm diff, event attribution, pool insertion, and export/evaluation contract tests |
| Live stack check | `scripts/integration-smoke.sh main` for accepted code or `scripts/integration-smoke.sh agent` for agent worktrees; stop stack and verify no tracked listener remains |

## Integration Smoke Contract

The main workspace owns the reusable integration smoke environment:

```bash
scripts/integration-smoke.sh main
scripts/integration-smoke.sh agent
```

The runner creates fresh isolated runtime roots under `.runtime/integration-smoke-*`:

- `PLATFORM_STATE_ROOT` for users, role bindings, assignments, leases, drafts, submissions, snapshots, sample pool, exports, evaluations, and audit events.
- `LABEL_CONFIG_STORE_ROOT` for dataset type and label-config state.
- `artifacts/` for JSON summaries and browser screenshots.

The API smoke asserts live route contracts for:

- label config activation and batch inheritance.
- user/role creation, batch assignment, sample lease, label edit submit, and qc_lead confirmation.
- sample-pool insertion and stats.
- COCO training export creation, detail, and download.
- model evaluation create/list/compare/delta-samples.
- snapshot list/diff and rollback-disabled response.
- audit action strings including `batch_assignment.assign`, `sample_lease.acquire`, `label_edit.submit`, `label_edit.confirm`, `evaluation.create`, and `snapshot.rollback.disabled`.

Browser smoke uses pinned `npx playwright@1.60.0` CLI screenshots and checks `模型评估`, `版本历史`, and `导出管理`.

## Project Test Case Suite

This section defines the project-level test design. It is a specification for backend, frontend, and integration agents to implement or maintain tests against. The target is functional completeness with domain-boundary coverage above 90%.

### Coverage Definition

`Boundary coverage` means coverage of documented business, contract, state, permission, data-shape, and runtime edge points. It is not the same as line coverage. If line/branch coverage tooling is added later, it should be reported separately.

Boundary coverage formula:

```text
boundary_coverage = automated_boundary_points_covered / required_boundary_points
```

Release threshold:

- Overall boundary coverage must be greater than 90%.
- Every critical domain must be at least 85%.
- P0 security, data-integrity, and review-workbench protection cases must all pass.
- Manual-only checks do not count as automated coverage unless the result is captured by a repeatable script, browser probe, or test assertion.

Initial boundary denominator:

| Domain | Required boundary points | Minimum automated points | Target |
| --- | ---: | ---: | ---: |
| Auth, users, RBAC | 18 | 17 | 94.4% |
| Dataset type and batch lifecycle | 18 | 17 | 94.4% |
| Import scan and validation | 16 | 15 | 93.8% |
| Label config | 16 | 15 | 93.8% |
| Asset, search, and media | 12 | 11 | 91.7% |
| QC queue, assignment, and leases | 16 | 15 | 93.8% |
| Review label editing | 22 | 20 | 90.9% |
| QC closed loop, snapshots, and attribution | 18 | 17 | 94.4% |
| Correction sample pool, export, and evaluation | 16 | 15 | 93.8% |
| Frontend route and interaction states | 20 | 18 | 90.0% |
| Integration runtime and service hygiene | 10 | 10 | 100.0% |
| **Total** | **182** | **170** | **93.4%** |

### Test Layers

| Layer | Owner | Purpose | Required command or tool |
| --- | --- | --- | --- |
| Backend unit/API | Backend agent | Validate FastAPI contracts, state transitions, RBAC, persistence, and derived data. | `PLATFORM_STATE_ROOT=/tmp/uvp-be LABEL_CONFIG_STORE_ROOT=/tmp/uvp-labels uv run pytest` |
| Backend parser | Backend agent | Validate manifest, real DATASET shard scanning, media path normalization, and STEP1/STEP2 pairing. | `uv run pytest tests/test_manifest_parser.py` |
| Frontend unit/component | Frontend agent | Validate API adapters, route rendering, bbox overlay, media safety, and UI state transitions. | `cd frontend && npm run test` |
| Frontend build/typecheck | Frontend agent | Validate Vue/TypeScript build integrity. | `cd frontend && npm run build` |
| Integration API smoke | Integration agent | Validate live backend flow with fresh runtime state. | `scripts/integration-api-smoke.py` through `scripts/integration-smoke.sh` |
| Browser smoke | Integration agent | Validate critical user journeys on a running frontend/backend stack. | `scripts/integration-smoke.sh main` or `agent` |
| Static protection | Main workspace/integration agent | Prevent protected review workbench drift and accidental dataset/PDF tracking. | `git diff --check` plus protected path diff checks |

### Backend API Test Cases

| ID | Area | Scenario | Boundary assertions |
| --- | --- | --- | --- |
| BE-AUTH-001 | Auth | Login succeeds with valid internal account. | Session token/user payload returned; `/api/me` hydrates roles. |
| BE-AUTH-002 | Auth | Login fails for wrong password or unknown user. | Structured 401; no session state mutation. |
| BE-AUTH-003 | Auth | Disabled account cannot log in or act. | Structured 403/401 according to mode. |
| BE-AUTH-004 | Auth | Session mode rejects missing credentials. | Structured 401 with stable error shape. |
| BE-RBAC-001 | RBAC | `/api/rbac/catalog` returns all roles and scope types. | Includes six roles, `platform/dataset_type/dataset_batch`, and backend permission strings. |
| BE-RBAC-002 | RBAC | Annotator can read RBAC catalog but cannot manage users. | Catalog 200; user CRUD 403. |
| BE-RBAC-003 | RBAC | Platform admin can create, patch, and list users. | Required fields validated; duplicate user rejected. |
| BE-RBAC-004 | RBAC | Current admin cannot disable self. | 409 `self_disable_forbidden`. |
| BE-RBAC-005 | RBAC | Current admin cannot delete own active platform-admin binding. | 409 `self_binding_delete_forbidden`. |
| BE-RBAC-006 | RBAC | Duplicate role binding rejected. | 409 `role_binding_conflict`. |
| BE-RBAC-007 | RBAC | Scope permission is enforced by platform/type/batch. | Wrong dataset or batch scope gives 403. |
| BE-RBAC-008 | Audit | User with `audit:read_own` sees own events only. | Cross-user event read forbidden or filtered. |
| BE-DATASET-001 | Dataset type | Existing `urban_violation` detail returns batches and active config status. | 200; batch count matches registry. |
| BE-DATASET-002 | Dataset type | Create empty `ares_detection`. | 201; detail 200 with zero batches. |
| BE-DATASET-003 | Dataset type | Unknown dataset type. | 404 stable error. |
| BE-DATASET-004 | Dataset type | Duplicate type create. | Conflict or idempotent behavior is explicit and tested. |
| BE-BATCH-001 | Batch | Register images-only batch. | Assets counted; preannotation status missing; no QC queue without preannotations/config. |
| BE-BATCH-002 | Batch | Register images-with-STEP batch. | STEP1/STEP2 counts preserved; batch becomes preannotation-ready. |
| BE-BATCH-003 | Batch | Batch state persists across app restart. | Fresh app from same `PLATFORM_STATE_ROOT` lists the batch. |
| BE-BATCH-004 | Batch | Registered batch never falls back to fixture tasks/assets. | All ids and counts use concrete batch id. |
| BE-IMPORT-001 | Import | Scanner recurses shard folders such as `parsed/00/*.json`. | All nested STEP outputs counted. |
| BE-IMPORT-002 | Import | STEP2 success and failure folders are both detected. | Success/failure counts reported separately. |
| BE-IMPORT-003 | Import | Duplicate sample ids resolve deterministically. | Stable winner and warning row. |
| BE-IMPORT-004 | Import | Orphan STEP output without image. | `orphan_annotation` validation row. |
| BE-IMPORT-005 | Import | Missing STEP2 for image. | `stage2_missing` validation row. |
| BE-IMPORT-006 | Import | Unreadable `source_uri`. | Explicit validation warning; no raw DATASET mutation. |
| BE-IMPORT-007 | Import | Confirm import only after valid scan. | Invalid job cannot be confirmed. |
| BE-LABEL-001 | Label config | Validate real `DATASET/urban_violation/label_config.json`. | Valid result; closed/open field counts correct. |
| BE-LABEL-002 | Label config | Invalid config schema/rule. | Rejected with field-level issue. |
| BE-LABEL-003 | Label config | Save without activate, if backend compatibility path is retained. | Version saved; active pointer unchanged. |
| BE-LABEL-004 | Label config | Manual upload/update with activate. | Active version set and inherited by batches. |
| BE-LABEL-005 | Label config | Normal duplicate save is content-hash idempotent. | No duplicate version. |
| BE-LABEL-006 | Label config | Duplicate save with activate reuses existing and activates. | Version count stable; active pointer updated. |
| BE-LABEL-007 | Label config | Same `config.version` with different content. | 409 `label_config_version_conflict`; no history mutation. |
| BE-LABEL-008 | Label config | New `config.version` with different content. | One new history row; previous active archived; new active pointer consistent. |
| BE-LABEL-009 | Label config | Reload active after restart. | No version creation; same hash/id. |
| BE-LABEL-010 | Label config | Duplicate historical store repair. | Same-hash duplicates collapse to one canonical history item; registry and active pointer agree. |
| BE-LABEL-011 | Label config | Closed enum unknown value. | Label-edit validation rejects it. |
| BE-LABEL-012 | Label config | Open tag fields allow custom values. | `scene_elements` and `segmentation_targets` support custom/deduped values. |
| BE-ASSET-001 | Asset | List assets with stage2 success/failure filters. | Totals and rows match filters. |
| BE-ASSET-002 | Asset | Filter by sample category, media status, label edit status, confidence range. | Combined filters are ANDed and stable. |
| BE-ASSET-003 | Media | Media URLs are browser-safe. | Raw absolute file paths and traversal are rejected. |
| BE-ASSET-004 | Search | Search by sample id/category/status. | Results are concrete-batch scoped. |
| BE-QC-001 | QC queue | Generate queue only after active config and preannotation readiness. | Missing preconditions return explicit errors. |
| BE-QC-002 | QC queue | Generate queue for registered STEP batch. | Tasks keyed by concrete batch id. |
| BE-QC-003 | Assignment | One active assignee per batch. | Reassignment/release state transitions audited. |
| BE-QC-004 | Assignment | Platform admin may be assigned. | Active user selector accepts admin user. |
| BE-QC-005 | Lease | One active lease per sample. | Second user gets conflict; release permits next lease. |
| BE-QC-006 | Lease | Lease release/revoke/expiry behavior. | Status changes are persisted and audited. |
| BE-EDIT-001 | Review | Review detail returns stage1, stage2, active config, and edit state. | Failure sample includes failure payload; success sample includes candidates. |
| BE-EDIT-002 | Review | Missing active label config disables edit/submit path. | Review still readable; mutation rejected clearly. |
| BE-EDIT-003 | Review | Validate label edits without persistence. | No draft/submission side effects. |
| BE-EDIT-004 | Review | Save draft persists privately by user. | Other user cannot see private draft. |
| BE-EDIT-005 | Review | Save/autosave batch draft. | `entries[]` payload is idempotent, draft-only, and scoped to the current batch assignee. |
| BE-EDIT-006 | Review | Submit assigned batch. | Unsaved dirty or validation-error samples block submit; missing active label config returns structured non-500 error; success marks assignment submitted. |
| BE-EDIT-005 | Review | Submit creates immutable submission. | History contains submission id and audit event. |
| BE-EDIT-006 | Review | qc_lead confirms submitted patch. | Confirmed snapshot, progress, and audit generated. |
| BE-EDIT-007 | Review | Invalid confidence values. | Below 0 and above 1 rejected. |
| BE-EDIT-008 | Review | Invalid bbox values. | Negative, >1000, reversed x/y, malformed length rejected. |
| BE-EDIT-009 | Review | Empty `segmentation_targets`. | Accepted. |
| BE-EDIT-010 | Review | Candidate add/delete operations. | Structured ops validated and materialized. |
| BE-EDIT-011 | Review | Unsupported sample-level scope. | Rejected with stable validation issue. |
| BE-CLOSED-001 | Closed loop | Baseline snapshots created from imported preannotations. | Idempotent across queue generation/restart. |
| BE-CLOSED-002 | Closed loop | Confirmed snapshot created on lead confirmation. | Links to submission, reviewer, and payload hash. |
| BE-CLOSED-003 | Closed loop | Diff derives relation/candidate modification events. | Event types and attribution tags match changed fields. |
| BE-CLOSED-004 | Closed loop | Stats reads are idempotent. | Repeated reads do not duplicate events. |
| BE-CLOSED-005 | Closed loop | No meaningful changes do not enter sample pool. | Pool remains unchanged. |
| BE-CLOSED-006 | Closed loop | Snapshot diff API handles missing or cross-batch ids. | 404/400 stable error. |
| BE-CLOSED-007 | Closed loop | Rollback endpoint is disabled. | 501 `rollback_disabled`; audit recorded. |
| BE-POOL-001 | Sample pool | Changed confirmed sample enters pool. | Item links batch, sample, snapshot, event tags. |
| BE-POOL-002 | Sample pool | Filters by dataset, batch, category, attribution, reviewer, time, status. | Filter totals are deterministic. |
| BE-POOL-003 | Sample pool | Manual item create/reactivate/delete. | Status transitions do not delete source data. |
| BE-EXPORT-001 | Export | COCO export from correction pool. | Coordinate space is `quantized_1000`; JSON has info/images/annotations/categories. |
| BE-EXPORT-002 | Export | Empty filters or unsupported format. | Clear rejection or empty completed artifact according to contract. |
| BE-EXPORT-003 | Export | Cancel queued export. | Status becomes cancelled; completed job cannot be cancelled incorrectly. |
| BE-EVAL-001 | Evaluation | Create/list/get evaluation. | Metrics and category metrics preserved. |
| BE-EVAL-002 | Evaluation | Compare two runs. | Positive/negative deltas computed. |
| BE-EVAL-003 | Evaluation | Delta samples. | Count and changed sample ids match payload. |

### Frontend Test Cases

| ID | Area | Scenario | Boundary assertions |
| --- | --- | --- | --- |
| FE-API-001 | API adapter | Normalize backend snake_case payloads. | Frontend contract fields remain camelCase. |
| FE-API-002 | API adapter | Structured 401/403/409/422 errors. | UI receives status, code, message, and field issues. |
| FE-API-003 | API adapter | RBAC catalog with backend `scope_types`. | Scope labels show Chinese; no stale fallback-only behavior. |
| FE-API-004 | API adapter | Dataset type detail fallback on 404/405/501 only. | Other errors propagate. |
| FE-API-005 | API adapter | Media safety. | Local absolute paths rejected; backend-relative media resolved. |
| FE-ROUTE-001 | Routing | Public `/login` and protected routes. | Unauthenticated users redirect with `redirect` query. |
| FE-ROUTE-002 | Routing | Legacy `/users` and `/audit` redirects. | Redirects land under `/account`. |
| FE-ROUTE-003 | Routing | Permission guard. | Users lacking `users:manage`/`roles:manage` land on account center. |
| FE-ROUTE-004 | Routing | Review route chrome-free. | No global sidebar/topbar; review-only shell visible. |
| FE-DATASET-001 | Dataset UI | `/datasets` shows dataset-type cards. | No full label config editor expanded by default. |
| FE-DATASET-002 | Dataset UI | Type child route shows overview, batch list, label config. | Deep links work. |
| FE-DATASET-003 | Dataset UI | Create second dataset type. | `ares_detection` can exist without a batch. |
| FE-DATASET-004 | Batch UI | Register images-only and preannotated batch from selected directory listing. | Scan summary and lifecycle status match source structure. |
| FE-DATASET-005 | Batch UI | Batch route reuse. | Overview/assets/preannotations/import pages reload when `id` changes. |
| FE-LABEL-001 | Label config UI | Upload/validate/update active config. | Normal save is idempotent; no `另存为新版本` or row-level `激活`. |
| FE-LABEL-002 | Label config UI | Invalid config. | Field issues shown; save disabled or rejected visibly. |
| FE-LABEL-003 | Label config UI | Duplicate content and duplicate semantic version. | Reuse and conflict messages are shown in Chinese. |
| FE-ASSET-001 | Asset UI | Asset table filters. | Stage2 failures, category, media, label-edit, confidence filters are composable. |
| FE-QC-001 | QC UI | QC queue generation from dataset management. | Button flow calls concrete batch endpoint and refreshes state. |
| FE-QC-002 | QC UI | Assignment selector includes active admins. | Users without role payload still selectable if active. |
| FE-REVIEW-001 | Review workbench | Bbox 0-1000 projection. | Placement independent from source resolution and outside black fill. |
| FE-REVIEW-002 | Review workbench | Wheel zoom and middle-button pan. | Bbox coordinates remain stable; panning disabled/limited at 1x. |
| FE-REVIEW-003 | Review workbench | Bbox edit and resize. | Emits quantized coordinates clamped to 0-1000. |
| FE-REVIEW-004 | Review workbench | Bbox colors. | Default excludes red/black/purple; unreferenced relation purple; selected referenced red. |
| FE-REVIEW-005 | Review workbench | Bottom bar actions. | `校验修改` validates only; `保存草稿` saves batch draft state; `提交批次修改` opens confirmation before final batch submit; autosave interval can be set to 1/2/3/5 minutes. |
| FE-REVIEW-006 | Review workbench | Missing label config. | Evidence remains visible; patch/submit disabled. |
| FE-REVIEW-007 | Review workbench | Candidate add/delete and empty segmentation targets. | Payload matches backend label-edit contract. |
| FE-REVIEW-008 | Review workbench | Sample switching. | Current review remains visible during fetch; no flicker bar. |
| FE-ACCOUNT-001 | Account center | Role-dependent entries. | Annotator lacks permission management; auditor sees audit. |
| FE-ACCOUNT-002 | Permission console | Tabs/sections render. | `账号管理`, `数据集权限分配`, `角色绑定记录` visible. |
| FE-ACCOUNT-003 | Permission console | Create/edit/reset account drawer/modal. | Main page does not flatten long forms. |
| FE-ACCOUNT-004 | Permission console | Dataset permission assignment drawer. | User -> target level -> target -> role -> permission preview. |
| FE-ACCOUNT-005 | Permission console | Dataset batch scope selector. | Select dataset type first, then batch; no raw id typing in normal flow. |
| FE-ACCOUNT-006 | Permission console | Delete binding and disable user confirmations. | Confirmation modal required; 409 shown inline. |
| FE-AUDIT-001 | Audit UI | Audit filters and empty/error states. | Scope/user/action filters survive reload errors. |
| FE-POOL-001 | Sample pool UI | Stats/list/detail/filter states. | Empty, loading, error, and filtered-empty states all render. |
| FE-POOL-002 | Sample pool UI | Export create/list/download/cancel. | Task statuses and disabled states are correct. |
| FE-EVAL-001 | Batch overview | QC analysis, model evaluation, version history. | Stats unavailable state keeps page visible. |
| FE-EVAL-002 | Batch overview | Snapshot diff empty/insufficient records. | User sees stable empty state, no broken layout. |

### Integration And End-To-End Test Cases

| ID | Flow | Scenario | Required assertions |
| --- | --- | --- | --- |
| INT-001 | Stack | Start main stack with fresh runtime roots. | Backend/Frontend ready; health 200; ports released after stop. |
| INT-002 | Stack | Start agent stack from main workspace. | Uses frontend/backend agent worktrees; isolated ports 18031/15195. |
| INT-003 | Dataset | Activate label config and verify batch inheritance. | Active config read through batch id returns type config id. |
| INT-003A | Label config | Upload same config twice, changed same version, then bumped version. | Count stable on duplicate hash; 409 on same version different hash; one new active row on bumped version. |
| INT-004 | Import | Register images-with-STEP batch from readable source. | Validation rows, counts, and lifecycle status match source. |
| INT-005 | QC | Generate queue, assign batch, lease sample. | Concrete batch id used in assignment, task, lease, and audit. |
| INT-006 | Review | Annotator edits, validates, submits; qc_lead confirms. | Submission immutable; confirmed snapshot and events generated. |
| INT-007 | Closed loop | Confirmed changed sample enters correction pool. | Pool stats increment once; repeated stats reads are idempotent. |
| INT-008 | Export | Create COCO export from pool and download artifact. | Artifact shape valid; coordinate space quantized. |
| INT-009 | Evaluation | Create two evaluations, compare, inspect delta samples. | Deltas and sample counts correct. |
| INT-010 | Snapshot | List snapshots, diff baseline/confirmed, try rollback. | Diff non-empty; rollback returns disabled response and audit. |
| INT-011 | Permission | Create user, assign dataset-batch annotator, duplicate bind. | First bind 201; duplicate 409; self-lockout guards 409. |
| INT-012 | Browser | Dataset home, type label-config page, batch overview. | Navigation and child routes visible. |
| INT-013 | Browser | Permission console drawers/modals. | Assignment preview includes `提交确认`; no `qc_submission:confirm`. |
| INT-014 | Browser | Review workbench smoke. | Image evidence visible; bbox overlay not blank; protected layout unchanged. |
| INT-015 | Hygiene | Stop all services. | No listeners on 8000/5173/18031/15195. |

### Boundary Coverage Checklist

Each implementation phase must update this checklist before main synchronization:

- Input boundaries: missing fields, malformed JSON, unknown enum, empty arrays, duplicate ids, unsupported scopes, invalid source path, path traversal.
- Numeric boundaries: bbox 0/1000, reversed bbox, confidence 0/1 and outside range, pagination/filter limits if added.
- State boundaries: missing active config, not preannotation-ready, queue not generated, already assigned, already leased, submitted vs confirmed, returned vs revoked, cancelled vs completed export.
- Permission boundaries: platform/type/batch scope mismatch, disabled user, self-lockout, annotator forbidden paths, auditor own-vs-global audit.
- Persistence boundaries: restart with same runtime root, fresh runtime root, idempotent repeated save/generate/confirm/stats reads.
- UI boundaries: loading, empty, error, long text, modal open/close, route reuse, protected review layout, browser-safe media.
- Integration boundaries: frontend/backend contract mismatch, proxy media fallback, service startup timeout, service shutdown cleanup.

### Required Quality Gates

Before a change can be accepted into main:

1. Backend change:
   - Add or update backend tests for positive, negative, permission, persistence, and idempotency boundaries.
   - Run `PLATFORM_STATE_ROOT=/tmp/uvp-check LABEL_CONFIG_STORE_ROOT=/tmp/uvp-labels uv run pytest`.
2. Frontend change:
   - Add or update adapter/component/route tests for loading, empty, error, success, and permission states.
   - Run `cd frontend && npm run test` and `cd frontend && npm run build`.
3. Cross-contract change:
   - Update backend schemas, frontend types, fixtures, and integration smoke in the same task.
   - Run `scripts/integration-smoke.sh agent` before main sync and `scripts/integration-smoke.sh main` after main sync.
4. Review workbench change:
   - Requires explicit user approval.
   - Must include `bboxOverlay.test.ts`, review route tests, browser evidence, and protected behavior confirmation.
5. Dataset/import change:
   - Must test real `DATASET/urban_violation` structure without writing into `DATASET/`.
   - Must include source structures `images_only` and `images_with_preannotations`.
6. Permission or multi-user change:
   - Must test all impacted roles and at least one platform/type/batch scope mismatch.
   - Must test self-lockout and duplicate-binding behavior when relevant.

## Open Architecture Work

- Runtime/config state root hardening.
- Persistent import validation history.
- STEP2 failure remediation queue design.
- QC closed-loop product hardening after snapshot, diff, attribution, sample-pool, export, evaluation, and version-governance implementation.
- Frontend API adapter split.

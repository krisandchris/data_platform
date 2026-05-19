# Overall Architecture

Last updated: 2026-05-19

## System Shape

Urban Violation Platform is a local dataset management and QC system for image-based violation annotation outputs. It combines:

- A Vue frontend for dataset operations, QC, user center, and audit.
- A FastAPI backend for dataset import, label config, QC workflow, RBAC, and runtime state.
- A readonly `DATASET/` fixture tree used as source data.
- Dedicated frontend/backend/integration agent worktrees for implementation and validation.

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
9. Annotator leases a sample, edits labels, validates field legality, saves drafts, and submits changes.
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

Runtime state:

- Use `PLATFORM_STATE_ROOT` for users, roles, sessions, assignments, leases, drafts, submissions, audits, registered batches, and label config store.

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

## Open Architecture Work

- Label config save idempotency.
- Runtime/config state root hardening.
- Persistent import validation history.
- STEP2 failure remediation queue design.
- QC closed-loop product hardening after snapshot, diff, attribution, sample-pool, export, evaluation, and version-governance implementation.
- Frontend API adapter split.

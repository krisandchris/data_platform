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
| Live stack check | Stop stack and verify no tracked listener remains |

## Open Architecture Work

- Label config save idempotency.
- Runtime/config state root hardening.
- Persistent import validation history.
- STEP2 failure remediation queue design.
- Frontend API adapter split.
- Reproducible browser smoke environment.

# Backend Architecture

Last updated: 2026-05-19

## Stack

- Python managed by `uv`
- FastAPI
- Pydantic
- Uvicorn for local serving
- File-backed runtime state for local/platform state in this phase
- Pytest

Root: `src/urban_violation_backend`

## Current Responsibilities

The backend owns:

- Dataset type and batch registry.
- Dataset import and validation.
- Real fixture loading from `DATASET/urban_violation`.
- Manual batch registration and backend-readable source ingestion.
- Normalized media serving for browser-safe image/visualization URLs.
- Label config validation, save, activate, active read, suggestions, and reload.
- QC queue generation for concrete batches.
- Label edit validation, draft save, submit, history, and qc_lead confirmation/return.
- Internal accounts, sessions, scoped RBAC, batch assignment, sample lease, and audit events.

## Source Layout

- `app.py`: application factory and app wiring.
- `routes.py`: HTTP route definitions.
- `api_schemas.py`: API request/response schemas.
- `schemas.py`: core dataset and runtime schemas.
- `service.py`: main application service and workflow logic.
- `labels.py`: label config repository and validation.
- `auth.py`: session and account helpers.
- `permissions.py`: permission and role logic.
- `state_store.py`: runtime state persistence.
- `contracts.py`: exported/shared contract helpers.
- `importer/`: dataset parser and import helpers.
- `tests/`: backend API and workflow regression tests.

## Data Model

Current product model:

- Dataset type: shared schema and label config boundary.
- Dataset batch: import/assets/preannotation/QC execution boundary.
- Raw asset: image and media metadata.
- STEP1 output: scene and relation evidence.
- STEP2 output: fact verification and candidates.
- Label config version: type-scoped field dictionary and validation config.
- QC task: concrete-batch sample work item.
- Batch assignment: one active assignee per batch.
- Sample lease: one active editor per sample.
- Label edit draft: user-owned editable patch state.
- Label edit submission: immutable annotator submission.
- Lead confirmation: qc_lead final confirm/return workflow.
- Audit event: user/action/scope trail.

## Dataset Import Rules

- Importers must discover `stage1_run_*` and `stage2_run_*`.
- Do not hardcode `stage1_run_0508` and `stage2_run_0508`.
- Business label counts are based on parsed/failure folders, not records/requests/responses/meta/support folders.
- STEP2 parsed success and STEP2 failures are separate counters.
- Bbox values are 0-1000 quantized integer coordinates.
- Raw absolute source paths are internal provenance only.
- Browser media must be served through backend URLs.
- Raw `DATASET/` should remain readonly.

## Runtime State

Use `PLATFORM_STATE_ROOT` for local test/smoke state:

```bash
PLATFORM_STATE_ROOT=/tmp/uvp-check uv run pytest
```

Runtime state includes users, sessions, role bindings, batch assignments, leases, drafts, submissions, audit events, registered batches, and label config persistence.

Known hardening item:

- Audit default config/state roots so smoke runs do not write into raw `DATASET/` when `PLATFORM_STATE_ROOT` is omitted.

## API Surface

Important route groups:

- Auth and current user: login, logout, `/api/me`.
- Users and roles: user CRUD, role bindings.
- Dataset types and batches: registry, overview, batch list, batch summary.
- Import jobs: create, validate, confirm, retry/status.
- Assets: batch-level list/detail/media.
- Label config: validate upload, save, activate, get active, reload active, suggestions.
- QC: queue, assignment, generate queue, task progress.
- Review detail: `/api/datasets/{dataset_id}/samples/{sample_id}/review`.
- Label edits: validate, draft, submit, history, qc_lead confirm/return.
- Audit: full audit and self-audit subject to permission boundaries.

## Label Config Behavior

Current behavior:

- Active config is restored from persisted active/version files.
- Reload active should not create a new version.
- Saving currently creates a new version even for identical content.

Backlog:

- Make save idempotent for identical content hash or require explicit "save as new version".

## Validation

```bash
uv sync
PLATFORM_STATE_ROOT=/tmp/uvp-check uv run pytest
uv run python -m py_compile src/urban_violation_backend/service.py src/urban_violation_backend/routes.py src/urban_violation_backend/api_schemas.py
```

## Current Known Risks

- Label config duplicate version creation on repeated unchanged save.
- Runtime state root defaults need another audit.
- Import validation history vs recalculated diagnostics is still a product decision.
- STEP2 failure remediation queue design is still open.

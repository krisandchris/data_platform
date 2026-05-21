# Runtime And Validation

Last updated: 2026-05-20

## Stack

- Python managed by `uv`.
- FastAPI and Pydantic.
- Uvicorn for local serving.
- File-backed runtime state in the current local platform phase.
- Pytest for backend regression tests.

## Runtime State

Runtime state includes:

- users and sessions;
- role bindings;
- registered dataset types and batches;
- import jobs;
- QC assignments, tasks, and leases;
- label edit drafts, batch drafts, submissions;
- audit events;
- label config versions and active pointers;
- snapshots, modification events, sample pool items, export jobs.

Use isolated state roots for tests and smoke runs:

```bash
PLATFORM_STATE_ROOT=/tmp/uvp-check \
LABEL_CONFIG_STORE_ROOT=/tmp/uvp-label-config \
uv run pytest
```

Raw `DATASET/` contents must not be mutated by runtime writes.

## Validation Commands

```bash
uv sync
PLATFORM_STATE_ROOT=/tmp/uvp-check uv run pytest
uv run python -m py_compile \
  src/urban_violation_backend/service.py \
  src/urban_violation_backend/routes.py \
  src/urban_violation_backend/api_schemas.py
```

Live smoke:

```bash
scripts/integration-smoke.sh main
scripts/integration-smoke.sh agent
```

## Known Risks

- STEP2 failure remediation queue remains a product design follow-up.
- Snapshot rollback is intentionally guarded and should not become a normal UI action without a separate approval flow.
- Export permission names should be formalized if export moves from local feature to production multi-user workflow.

# TASK-019 Phase 6 Backend Agent Handoff

## Agent Role

Backend Agent

## Branch

`agent/TASK-019/backend/import-tool`

## Assigned Scope

- Implement the explicit file-state import command for Phase 6.
- Own backend source under `src/urban_violation_backend/**`, backend CLI entrypoints, and focused backend tests if needed.
- Do not modify frontend files.
- Do not change Docker production defaults.
- Do not add dependencies unless strictly necessary; if a dependency is needed, document it before changing `pyproject.toml` or `uv.lock`.

## Required Behavior

- Provide command surface equivalent to:
  - `uv run python -m urban_violation_backend.migrate_state import-file-state --platform-state-root ... --label-config-store-root ... --dataset-root ... --dry-run --report ...`
- Import file-backed state into database-backed repositories:
  - users, role bindings, sessions, audit;
  - dataset type registry, registered batches/import jobs;
  - label configs and active pointers;
  - QC assignments, tasks, leases, drafts, batch drafts, submissions;
  - annotation snapshots, modification events, sample pool items, export jobs, evaluations.
- Preserve source IDs and filesystem references.
- Support dry-run without DB mutation.
- Support idempotent re-run with same-content match reporting.
- Report same-ID different-content conflicts without silent overwrite.
- Never mutate `DATASET/`, uploaded archives, extracted source files, media files, export artifacts, or file-backed state roots.

## Verification Expected

- Focused unit tests for import planning/apply/idempotency/conflict behavior.
- `uv run pytest <focused tests> -q`.
- `git diff --check`.

## Handoff To Complete

- List changed files.
- List command examples.
- List verification commands/results.
- Note any unsupported state class or known risk.

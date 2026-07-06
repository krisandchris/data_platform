# Handoff

## Agent Role
Backend Agent

## Branch
`agent/TASK-030/backend/offline-prune`

## Worktree
`../_worktrees/data_platform/backend-offline-prune`

## Scope Completed
- Pruned FastAPI route surface to offline import validation, QC, review, label config, label suggestions, leases, drafts, submit, and media endpoints.
- Deleted DB/Redis/Docker/migration tests and rewrote retained backend tests for the offline flow.
- Removed Postgres/Redis runtime code and dependencies; offline state remains file-backed.

## Changed Files
- `src/urban_violation_backend/routes.py`: offline-only API routes.
- `src/urban_violation_backend/runtime_coordination.py`: no-op single-process coordinator.
- `src/urban_violation_backend/service.py`: file-state-only factory path.
- `src/urban_violation_backend/db/**`: deleted.
- `src/urban_violation_backend/migrate_state.py`: deleted.
- `tests/**`: retained offline tests only.
- `pyproject.toml`, `uv.lock`: removed DB/Redis dependency stack.

## Shared Contracts Changed
Yes. Backend exposed API surface is reduced to offline workbench endpoints.

## Dependencies Changed
Yes. Removed `alembic`, `psycopg`, `redis`, `sqlalchemy` and transitive lock entries.

## Verification
- Command: `uv lock`
  Result: passed.
- Command: `uv run python -m compileall -q src`
  Result: passed.
- Command: `uv run pytest tests -q`
  Result: passed, 21 tests.

## Known Risks
- Service/schema modules still contain some dormant helper methods and DTO classes for historical closed-loop objects used internally around submissions; they are no longer routed.

# Progress

- Replaced backend route surface with retained offline validation/QC endpoints.
- Rewrote API tests around offline health, single user, label config, blocked non-core endpoints, safe ZIP upload, import validation, QC queue, review, lease, batch draft, submit, and restart recovery.
- Deleted DB foundation, Redis, Docker rollout, and migration tests.
- Replaced Redis runtime coordination with no-op offline coordination.
- Removed DB package and state migration tool.
- Removed Alembic, Psycopg, Redis, SQLAlchemy from `pyproject.toml` and regenerated `uv.lock`.

## Verification

- `uv lock`: passed, removed DB/Redis packages.
- `uv run python -m compileall -q src`: passed.
- `uv run pytest tests -q`: passed, 21 tests.

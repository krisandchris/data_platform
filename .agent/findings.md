# TASK-019 Migration Findings

## Decisions

- PostgreSQL is the authoritative target for durable mutable platform records.
- Redis is only for active lease, locks, session cache, and import progress in later phases.
- File-backed implementation remains rollback and test baseline until Docker rollout.
- `DATASET/`, uploaded archives, extracted source trees, media files, and export artifacts remain filesystem state.

## Phase 3 Backend Findings

- Backend DB foundation branch completed at `a640e85`.
- Dependencies added through `uv`: SQLAlchemy, Alembic, and `psycopg[binary]`.
- File-backed behavior remains default; DB mode is explicitly opt-in via `PLATFORM_STATE_BACKEND=database`.
- DB mode supports `DATABASE_URL` and `PLATFORM_DB_AUTO_MIGRATE`.
- A transitional hybrid store is in place:
  - Database authority: users, role bindings, sessions, audit events, dataset type registry, dataset batch registry/import job metadata, label config versions and active pointers.
  - File-backed authority unchanged for later phases: QC assignments/tasks/leases, drafts/submissions, snapshots/modification events, sample pool, exports, evaluations.
- Alembic initial schema covers requested foundation domains and is compatible with local SQLite fallback for tests.
- PostgreSQL-specific smoke still requires a real `TEST_DATABASE_URL`.

## Phase 3 QA Findings

- QA DB foundation branch completed at `064f7a2`.
- Added `tests/test_db_foundation_contract.py` and `tests/test_db_foundation_api.py`.
- Tests are gated by DB support detection and `TEST_DATABASE_URL` for PostgreSQL-only checks.
- After backend merge, the harness should activate against real `PLATFORM_STATE_BACKEND` / `DATABASE_URL` wiring.

## Phase 3 Docs Findings

- Docs DB foundation branch completed at `816d862`.
- Docs were written before backend had landed, so Lead integration must reconcile remaining backend-confirmation wording with actual Alembic paths and test selectors.

## Known Risks

- PostgreSQL runtime validation still requires a real `TEST_DATABASE_URL`.
- Rollback after database-mode writes remains a policy decision unless a tested reverse export tool is implemented.
- Redis and full QC/review durable-state migration are not part of Phase 3.

# TASK-019 Migration Findings

## Current Architecture Facts

- `PlatformStateStore` persists mutable collaboration state under `PLATFORM_STATE_ROOT` as JSON and JSONL files.
- `FileBackedLabelConfigRepository` persists label config versions, active pointers, and registry files under `LABEL_CONFIG_STORE_ROOT`.
- Registered batch metadata is currently persisted in label config store files, while `RegisteredBatchRuntime` is rehydrated from `source_uri`.
- Upload archives extract under `PLATFORM_STATE_ROOT/import_uploads/...`; this remains filesystem state.
- Frontend API client already covers login/session, import upload progress, label config, assignment, lease, draft, audit, sample pool, export, and evaluation flows.

## Decisions

- Use PostgreSQL as authoritative state store.
- Use Redis for active lease, locks, session cache, and import progress only.
- Preserve file-backed implementation as rollback and contract-test baseline.
- Use explicit file-state import command rather than automatic import on container startup.
- Split implementation into sequential integration phases; do not start Docker rollout until database, Redis, and import tool phases pass.

## Phase 3 Backend Findings

- Backend DB foundation branch completed at `a640e85`.
- Dependencies added through `uv`: SQLAlchemy, Alembic, and `psycopg[binary]`.
- File-backed behavior remains the default runtime path; DB mode is explicitly opt-in via `PLATFORM_STATE_BACKEND=database`.
- DB mode supports `DATABASE_URL` and `PLATFORM_DB_AUTO_MIGRATE`.
- A transitional hybrid store is in place for this phase:
  - Database authority: users, role bindings, sessions, audit events, dataset type registry, dataset batch registry/import job metadata, label config versions and active pointers.
  - File-backed authority unchanged for later phases: QC assignments/tasks/leases, drafts/submissions, snapshots/modification events, sample pool, exports, evaluations.
- Alembic initial schema covers requested foundation domains and is compatible with local SQLite fallback for tests.
- PostgreSQL-specific smoke was not run in the backend worktree; SQLite URL fallback covered local DB foundation tests.

## Phase 3 QA Findings

- QA DB foundation branch completed at `064f7a2`.
- Added `tests/test_db_foundation_contract.py` and `tests/test_db_foundation_api.py`.
- Tests are gated by DB support detection and `TEST_DATABASE_URL` for PostgreSQL-only checks.
- After backend merge, the harness should activate against real `PLATFORM_STATE_BACKEND` / `DATABASE_URL` wiring.

## Phase 3 Docs Findings

- Docs DB foundation branch completed at `816d862`.
- Docs intentionally marked some command names and behavior as backend-confirmation assumptions because Backend DB Foundation had not landed when Docs completed.
- Lead integration must reconcile docs after backend merge if actual Alembic paths, test selectors, driver URL form, mixed-mode behavior, or auto-migrate support differ from the docs.

## Known Risks

- PostgreSQL runtime validation still requires a real `TEST_DATABASE_URL`.
- Rollback after database-mode writes remains a policy decision unless a tested reverse export tool is implemented.
- Redis and full QC/review durable-state migration are not part of Phase 3.

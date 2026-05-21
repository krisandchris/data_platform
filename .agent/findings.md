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
- Docs were reconciled during Lead integration with actual Alembic paths, command names, and test selectors.

## Phase 4 Dispatch Findings

- Phase 4 must keep frontend API contracts stable while changing the database-mode authority for QC/review/export/evaluation metadata.
- The frontend agent is assigned compatibility validation rather than broad UI changes because Phase 4 is intended to be backend-state transparent.

## Phase 4 Backend Findings

- Backend Phase 4 branch completed at `254e9f0`.
- `DatabaseBackedPlatformStateStore` previously overrode only identity/audit methods; QC/review methods still used file-backed storage via inheritance from `PlatformStateStore`.
- Existing Alembic coverage ended at Phase 3 foundation tables and had no QC durable-state tables.
- Service state transitions already go through `PlatformStateStoreProtocol`, so Phase 4 can be delivered by DB store plus migration/test updates without frontend contract changes.
- Current `save_tasks` and `save_leases` implementations still replace the dataset-scoped set transactionally with delete+insert. This matches existing file-backed semantics and current service behavior, but does not provide row-level conflict resolution.
- `save_annotation_snapshot` dedup is implemented with read-then-insert logic in one transaction; concurrent writers could still race without a dedicated unique index over nullable dedup keys.
- Export artifacts remain filesystem files by design; only metadata and pointers are in PostgreSQL.

## Known Risks

- PostgreSQL runtime validation against an actual PostgreSQL server still requires a real `TEST_DATABASE_URL`; integration uses SQLite fallback plus Alembic smoke unless a PostgreSQL URL is provided.
- Rollback after database-mode writes remains a policy decision unless a tested reverse export tool is implemented.
- Redis is not part of Phase 4 and remains pending for active locks/live progress.

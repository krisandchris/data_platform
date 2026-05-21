# TASK-019 Migration Findings

## Decisions

- PostgreSQL is the authoritative target for durable mutable platform records.
- Redis is only for active lease, locks, session cache, and import progress in later phases.
- File-backed implementation remains rollback and test baseline until Docker rollout.
- `DATASET/`, uploaded archives, extracted source trees, media files, and export artifacts remain filesystem state.

## Phase 3 Findings

- Phase 3 added SQLAlchemy, Alembic, `psycopg[binary]`, explicit database mode wiring, and the foundation schema for identity, RBAC, sessions, registry, import job metadata, label config, and audit.
- File-backed behavior remains default; DB mode is explicitly opt-in via `PLATFORM_STATE_BACKEND=database`.
- PostgreSQL-specific smoke still requires a real `TEST_DATABASE_URL`; integration used SQLite fallback plus Alembic smoke.

## Phase 4 Backend Findings

- Backend Phase 4 branch completed at `254e9f0` and is merged into integration.
- `DatabaseBackedPlatformStateStore` previously overrode only identity/audit methods; QC/review methods still used file-backed storage via inheritance from `PlatformStateStore`.
- Phase 4 adds ORM and Alembic coverage for assignments, tasks, leases, drafts, batch drafts, submissions, snapshots, modification events, sample pool items, export jobs, and evaluation runs.
- Current `save_tasks` and `save_leases` implementations still replace the dataset-scoped set transactionally with delete+insert. This matches existing file-backed semantics and current service behavior, but does not provide row-level conflict resolution.
- `save_annotation_snapshot` dedup is implemented with read-then-insert logic in one transaction; concurrent writers could still race without a dedicated unique index over nullable dedup keys.
- Export artifacts remain filesystem files by design; only metadata and pointers are in PostgreSQL.

## Phase 4 QA Findings

- QA Phase 4 branch completed at `a3c16e9` and is being merged into integration.
- QA added database-mode API/contract tests for QC state persistence and race-sensitive workflows.
- QA focused suites passed in its worktree; full suite failed on known `DATASET/urban` fixture/environment assumptions.

## Phase 4 Frontend Findings

- Frontend Phase 4 branch completed at `011df88`.
- Frontend added a focused HTTP API adapter test for database-mode review payload fields.
- Existing coverage already protects sample switching and readonly lease warning behavior.
- No frontend API contract change is expected.

## Phase 4 Docs Findings

- Docs Phase 4 branch completed at `b4f1042`.
- Docs need final reconciliation after backend/QA integration for exact table names, revision IDs, and test selectors.

## Known Risks

- Rollback after database-mode writes remains a policy decision unless a tested reverse export tool is implemented.
- Redis is not part of Phase 4 and remains pending for active locks/live progress.

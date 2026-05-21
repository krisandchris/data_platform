# TASK-019 Phase 4 Backend Findings

## Initial Context

- Phase 3 added SQLAlchemy, Alembic, and hybrid database-backed foundation stores.
- Phase 4 must move QC/review mutable state into PostgreSQL without changing frontend API contracts.
- Redis remains a later phase and must not become required here.

## Findings

Pending backend inspection.

## Risks

- Lease and draft flows currently use list/read-all/update patterns; database mode must avoid lost updates.
- Export artifact files remain filesystem artifacts; only metadata and pointers belong in PostgreSQL.
- Datetime normalization must stay timezone-aware to avoid SQLite/PostgreSQL readback regressions.


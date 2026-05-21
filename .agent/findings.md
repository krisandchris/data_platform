# TASK-019 Phase 4 Backend Findings

## Initial Context

- Phase 3 added SQLAlchemy, Alembic, and hybrid database-backed foundation stores.
- Phase 4 must move QC/review mutable state into PostgreSQL without changing frontend API contracts.
- Redis remains a later phase and must not become required here.

## Findings

- `DatabaseBackedPlatformStateStore` previously overrode only identity/audit methods; all QC/review methods still used file-backed storage via inheritance from `PlatformStateStore`.
- Existing Alembic coverage ended at Phase 3 foundation tables and had no QC durable-state tables.
- Service state transitions already go through `PlatformStateStoreProtocol`, so Phase 4 can be delivered by DB store + migration/test updates without frontend contract changes.
- Full-repo pytest failures in this worktree are fixture/environment related (`DATASET/urban` path not present), not caused by Phase 4 DB state changes.

## Risks

- Current `save_tasks` / `save_leases` implementations still replace the dataset-scoped set transactionally (delete+insert). This matches existing file-backed semantics and current service behavior, but does not provide row-level conflict resolution.
- `save_annotation_snapshot` dedup is implemented with read-then-insert logic in one transaction; concurrent writers could still race without a dedicated unique index over nullable dedup keys.
- Export artifacts remain filesystem files by design; only metadata and pointers are in PostgreSQL.

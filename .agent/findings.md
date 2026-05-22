# TASK-019 Phase 5 Backend Findings

## Initial Context

- Phase 4 moved durable QC/review state to PostgreSQL in database mode.
- Phase 5 must not make Redis durable authority.
- Local host has Docker available but no `redis-server` executable.

## Findings

Pending backend inspection.

## Risks

- Active lease history must stay in PostgreSQL/file store even if Redis lock expires.
- Redis TTL expiry may make the UI fall back to a stable processing/readonly state; it must not delete persistent draft/submission records.
- Session cache must be strictly optional and backed by the durable session store.


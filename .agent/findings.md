# TASK-019 Phase 5 Backend Findings

## Implemented Findings

1. Redis runtime settings can be introduced without breaking defaults.
- Added `PLATFORM_REDIS_ENABLED` and `REDIS_URL` parsing to runtime settings.
- Effective Redis enablement is gated by both flag and URL, preserving no-op defaults when unset.

2. Lease coordination needs runtime lock checks at all lease transitions.
- Acquire path now uses Redis `SET NX EX` for new active lease lock.
- Heartbeat path now enforces owner-checked TTL extension.
- Release path now enforces owner-checked delete (with force-release fallback for privileged admin path).
- Durable lease history is still persisted in state store/PostgreSQL authority.

3. Distributed lock guards are required around non-idempotent runtime generation/execution paths.
- Added Redis lock protection for:
  - QC queue generation
  - import job scan
  - import job validate
  - import job confirm
  - import job retry

4. Import progress can be exposed safely as optional non-authoritative fields.
- Added optional `live_progress` payload on import job responses.
- Progress lifecycle is stored in Redis with TTL and never used as durable import state.

5. Session cache can be introduced as a strict optimization only.
- Added optional Redis-backed session lookup cache in `AuthService`.
- Durable session list remains source of truth.
- Cache is invalidated on logout/revoke and bypassed safely when absent/stale.

## Test Findings

- New focused suite `tests/test_redis_runtime_backend.py` validates:
  - owner-checked lease lock semantics
  - TTL expiry behavior
  - import/QC distributed lock conflict behavior
  - optional import progress fields
  - optional session cache behavior
  - gated real Redis smoke via `TEST_REDIS_URL`
- Full suite failures in this worktree are tied to missing dataset path `DATASET/urban` required by certain ingestion tests, not to Redis runtime changes.

## Risks

- If Redis is enabled but unavailable at runtime, lock operations return conflict/no-op outcomes depending on path; this is intentional to avoid silently violating exclusivity.
- Admin force-release can clear durable lease state even when Redis key already expired; this is acceptable and keeps durable authority coherent.
- Real Redis integration is environment-gated (`TEST_REDIS_URL`), so full cross-process validation depends on CI/host setup with Redis reachable.

# TASK-019 Migration Findings

## Decisions

- PostgreSQL is the authoritative target for durable mutable platform records.
- Redis is only for active lease, locks, session cache, and import progress in later phases.
- File-backed implementation remains rollback and test baseline until Docker rollout.
- `DATASET/`, uploaded archives, extracted source trees, media files, and export artifacts remain filesystem state.

## Phase 5 Backend Findings

- Backend Phase 5 branch completed at `28f70c6` and is merged into integration.
- Redis is opt-in through runtime settings and defaults to disabled/no-op fallback.
- Backend adds Redis runtime coordination for active sample leases, owner-checked heartbeat/release, QC queue generation locks, import job execution locks, live import progress, and optional session lookup cache.
- `ImportJobStatusResponse` adds optional `live_progress`; existing required fields remain unchanged.
- Durable authority remains the existing state store/PostgreSQL path. Redis stores only runtime coordination/cache/progress data.

## Phase 5 QA Findings

- QA Phase 5 branch completed at `3529101` and is being merged into integration.
- QA added deterministic Redis runtime/API tests and env-gated live PostgreSQL/Redis smoke tests.
- Live smoke tests require `TEST_DATABASE_URL` and `TEST_REDIS_URL`.

## Phase 5 Frontend Findings

- Frontend Phase 5 branch completed at `151131c`.
- Frontend accepts optional import progress variants and keeps upload progress behavior.
- Frontend treats expired leases as readonly and avoids heartbeat/release for expired or other-user leases.

## Phase 5 Docs Findings

- Docs Phase 5 branch completed at `3ff44e3`.
- Docs need final reconciliation after backend/QA integration for exact env names and test selectors.

## Known Risks

- Real Redis cross-process validation still needs a reachable Redis service in final integration.
- Rollback after database-mode writes remains a policy decision unless a tested reverse export tool is implemented.
- File-state import remains Phase 6.
- Untracked `prompts_complete.md` exists in the main worktree and is unrelated to TASK-019 Phase 5.

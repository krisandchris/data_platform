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

- QA Phase 5 branch completed at `3529101` and is merged into integration.
- QA added deterministic Redis runtime/API tests and env-gated live PostgreSQL/Redis smoke tests.
- Live smoke tests require `TEST_DATABASE_URL` and `TEST_REDIS_URL`.

## Phase 5 Frontend Findings

- Frontend Phase 5 branch completed at `151131c` and is merged into integration.
- Frontend accepts optional import progress variants and keeps upload progress behavior.
- Lead integration aligned frontend normalization with backend `live_progress`.
- Lead integration added frontend percent derivation from backend `current` / `total` progress values and declared `BackendImportJob.live_progress` in the shared TypeScript contract.
- Frontend treats expired leases as readonly and avoids heartbeat/release for expired or other-user leases.

## Phase 5 Docs Findings

- Docs Phase 5 branch completed at `3ff44e3` and is merged into integration.
- Lead integration changed docs test selectors to the actual QA selector: `redis_runtime or postgres_live or db_qc_state`.
- Lead integration split deterministic Phase 5 regressions from live PostgreSQL/Redis smoke commands so shared `TEST_DATABASE_URL` does not pollute isolated unit/API tests.

## Phase 5 Integration Findings

- Current fixture label config is `urban_violation_labels_v2`; test helpers now derive label config version and the next-version case from the fixture instead of hard-coding v1/v2.
- Live smoke tests use the implemented `/health` endpoint.
- Focused Redis/API tests, selector tests, live Docker PostgreSQL/Redis smoke, full backend tests, frontend tests/build, Docker config rendering, and diff whitespace checks passed.

## Known Risks

- Rollback after database-mode writes remains a policy decision unless a tested reverse export tool is implemented.
- File-state import remains Phase 6.
- Untracked `prompts_complete.md` exists in the main worktree and is unrelated to TASK-019 Phase 5.

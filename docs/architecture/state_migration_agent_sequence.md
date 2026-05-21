# PostgreSQL + Redis Migration Agent Sequence

Last updated: 2026-05-22

Task ID: `TASK-019`

## Objective

Migrate mutable platform state from JSON/JSONL files to PostgreSQL, add Redis for short-lived concurrency state, and preserve existing frontend API behavior.

Chosen defaults:

- PostgreSQL is the authoritative state store.
- Redis is used for active leases, short-lived locks, session cache, and import progress only.
- Raw `DATASET/`, uploaded archive extraction directories, media files, and export artifacts remain on the filesystem.
- `RegisteredBatchRuntime` remains a derived runtime cache hydrated from `source_uri`, not a database authority.
- Existing frontend endpoints and response shapes remain compatible; only optional import progress fields may be added.

## Worktree And Branch Order

Use fresh worktrees under:

```text
../_worktrees/data_platform/
```

Use this branch layout:

```text
integration/TASK-019
agent/TASK-019/backend/state-contracts
agent/TASK-019/backend/db-foundation
agent/TASK-019/backend/qc-state
agent/TASK-019/backend/redis-runtime
agent/TASK-019/backend/import-tool
agent/TASK-019/frontend/progress-and-lease
agent/TASK-019/qa/test-matrix
agent/TASK-019/qa/db-foundation-tests
agent/TASK-019/docs/runbooks
agent/TASK-019/docs/db-foundation-runbooks
```

Do not start a later phase until the previous phase's exit gate passes on the integration branch.

## Phase 1: Baseline And Contract Freeze

Primary owner: Lead Agent.

Supporting agents:

- QA Agent: current regression baseline.
- Backend Agent: state contract inventory.
- Frontend Agent: current page/API baseline.
- Docs Agent: state architecture notes.

Backend tasks:

- Inventory current `PlatformStateStore` methods and classify each as identity, registry, QC, draft, audit, artifact metadata, or derived state.
- Inventory `FileBackedLabelConfigRepository` behavior: content hash dedup, same-version conflict, active pointer, reload.
- Mark in-memory fields in `FixtureRuntimeService` as authority or cache, especially `_registered_batches`, `_import_jobs`, `_accepted_dataset_ids`, and `_registered_batch_runtimes`.

Frontend tasks:

- Confirm the frontend does not need to know whether backend state mode is `file` or `database`.
- Record current affected pages: login, dataset center, dataset type label config, import/upload panel, batch QC workspace, sample review, audit, sample pool, exports, evaluation.

QA tasks:

- Run and record current baseline:
  - `uv run pytest`
  - `npm run test`
  - `VITE_API_BASE_URL=/api npm run build`
  - `scripts/docker-compose-auto-subnet.py config`

Exit gate:

- Baseline commands pass.
- State contract inventory is documented.
- No product code changes are merged in this phase.

## Phase 2: Store Interface Extraction

Primary owner: Backend Agent on `agent/TASK-019/backend/state-contracts`.

Parallel support:

- QA Agent creates reusable store contract tests.
- Docs Agent documents file vs database state boundary.
- Frontend Agent only runs compatibility checks.

Backend tasks:

- Introduce protocol/interface boundaries for platform state and label config repositories.
- Rename or wrap current file implementations as file-backed implementations.
- Inject store/repository implementations through service construction.
- Keep default runtime behavior as file-backed.
- Do not introduce PostgreSQL or Redis dependencies yet.

Frontend tasks:

- No product UI change.
- Verify existing API client and route tests still pass.

QA tasks:

- Create store contract tests that can run against file-backed implementation first.
- Cover users, role bindings, sessions, audit, assignments, tasks, leases, drafts, submissions, snapshots, modification events, sample pool, exports, evaluations, and label config behavior.

Exit gate:

- File-backed implementation passes all old backend tests and new contract tests.
- Frontend tests/build pass.
- `FixtureRuntimeService` no longer imports concrete file store types except at factory wiring.

## Phase 3: PostgreSQL Foundation

Primary owner: Backend Agent on `agent/TASK-019/backend/db-foundation`.

Parallel support:

- Lead Agent owns dependency approval and lockfile updates.
- QA Agent prepares PostgreSQL integration test harness.
- Docs Agent starts migration runbook skeleton.

This is a foundation phase, not the production database rollout. It introduces the database configuration and foundation tables/repositories only. It must not switch Docker defaults, must not implement Redis, and must not move QC/review state yet.

Expected configuration surface:

| Variable | Expected values | Phase 3 role |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection URL | Required only when running database-backed foundation mode or Alembic. Exact driver URL form depends on backend implementation. |
| `PLATFORM_STATE_BACKEND` | `file` or `database` | Selects file-backed default or database-backed foundation mode. `file` remains the default until Docker rollout. |
| `PLATFORM_DB_AUTO_MIGRATE` | `0` or `1` | Controls startup migration behavior if implemented. `0` is the safer default; `1` requires backend implementation and tests. |

Backend tasks:

- Add SQLAlchemy, psycopg, and Alembic using `uv add`.
- Add `DATABASE_URL`, `PLATFORM_STATE_BACKEND=file|database`, and `PLATFORM_DB_AUTO_MIGRATE=0|1`.
- Create Alembic migrations for identity, registry, import job, label config, and audit tables.
- Implement database-backed identity, role binding, session, dataset type, dataset batch, import job, label config, and audit operations.
- Preserve file-backed mode as the default for local tests unless `PLATFORM_STATE_BACKEND=database`.
- Leave QC assignments, tasks, leases, drafts, submissions, snapshots, modification events, sample pool, exports, and evaluations file-backed until the next backend phase.
- Do not add `REDIS_URL`, `PLATFORM_REDIS_ENABLED`, Redis dependencies, or Redis runtime behavior in this phase.
- Do not change Compose defaults to `PLATFORM_STATE_BACKEND=database` in this phase.

Frontend tasks:

- No API change.
- Run login, dataset, label config, upload panel, and audit page tests against existing mocks.

QA tasks:

- Add database-mode backend tests using `TEST_DATABASE_URL`.
- Verify Alembic upgrade on an empty database.
- Verify database mode can bootstrap admin, login, save label config, create a batch, and list audit events.
- Verify QC/review endpoints either continue using the file-backed store in mixed mode or are explicitly outside the Phase 3 database-mode gate.

Exit gate:

- File-backed test suite still passes.
- Database-mode foundation tests pass.
- Dependency and lockfile changes are documented in handoff.
- Alembic command names, migration locations, and database test commands are recorded in docs after backend confirmation.
- Docker deployment remains file-backed.
- Redis remains unimplemented.

## Phase 4: QC, Draft, Submission, And Review State

Primary owner: Backend Agent on `agent/TASK-019/backend/qc-state`.

Parallel support:

- Frontend Agent validates review and QC pages without changing contracts.
- QA Agent adds concurrency and restart persistence tests.

Backend tasks:

- Move authoritative QC state into PostgreSQL: assignments, tasks, lease history, drafts, batch drafts, submissions, snapshots, modification events, sample pool items, export jobs, and evaluation runs.
- Replace read-all-and-overwrite logic with transactional upserts and state transitions.
- Keep `RegisteredBatchRuntime` as a derived cache hydrated from database batch metadata plus filesystem `source_uri`.
- Ensure batch deletion removes runtime state records but does not delete raw source data.

Frontend tasks:

- Verify review workbench still receives the same assignment, lease, draft, and submission contracts.
- Verify no sample-switch jitter regression.
- Verify sample pool/export/evaluation pages still render after database-mode backend responses.

QA tasks:

- Add restart persistence tests for assignment, tasks, drafts, submissions, audit, sample pool, exports, and evaluations.
- Add race tests for autosave vs submit, duplicate QC queue generation, and assignment transitions.

Exit gate:

- Database mode supports the full review workflow through confirmation.
- File-backed mode remains green.
- Frontend tests/build remain green.

## Phase 5: Redis Runtime State

Primary owner: Backend Agent on `agent/TASK-019/backend/redis-runtime`.

Parallel support:

- Frontend Agent on `agent/TASK-019/frontend/progress-and-lease`.
- QA Agent adds Redis integration tests.

Backend tasks:

- Add Redis client dependency using `uv add`.
- Add `REDIS_URL` and `PLATFORM_REDIS_ENABLED=0|1`.
- Implement active sample lease with Redis atomic `SET NX EX`, owner-checked heartbeat, and owner-checked release.
- Keep PostgreSQL as lease history authority.
- Add Redis locks for QC queue generation and import job execution.
- Store live upload/extract/import progress in Redis and return optional progress data from import job detail.

Frontend tasks:

- Extend import progress display to show backend processing progress when available.
- Keep current browser upload progress behavior.
- Ensure missing Redis progress falls back to "processing" without breaking the import page.
- Verify lease conflict and readonly messaging remain stable.

QA tasks:

- Test concurrent lease acquire, heartbeat by non-owner, release by non-owner, TTL expiry, and backend restart.
- Test duplicate QC queue generation under lock.
- Test import progress present and absent cases.

Exit gate:

- Redis loss does not lose drafts, submissions, label configs, audit, or batch metadata.
- Active lease is cross-process safe.
- Frontend import progress remains usable when Redis progress expires.

## Phase 6: File-State Import Tool

Primary owner: Backend Agent on `agent/TASK-019/backend/import-tool`.

Parallel support:

- QA Agent prepares migration fixtures.
- Docs Agent completes upgrade and rollback runbooks.

Backend tasks:

- Add explicit import command for existing file-backed state roots.
- Import users, roles, sessions, audit, dataset types, batches, import jobs, label configs, QC state, drafts, submissions, snapshots, modification events, sample pool, exports, and evaluations.
- Preserve original IDs.
- Make import idempotent.
- Report same-ID different-content conflicts without silent overwrite.

Frontend tasks:

- No migration UI.
- Validate migrated data through existing pages.

QA tasks:

- Test empty import.
- Test full fixture import.
- Test repeated import.
- Test conflict import.
- Test post-import API reads and continued writes.

Exit gate:

- Existing Docker file-state deployment can be migrated into database mode.
- Import tool never mutates `DATASET/`.
- Failure report is clear enough for operator rollback.

## Phase 7: Docker Rollout And Full Acceptance

Primary owner: Lead Agent.

Parallel support:

- Backend Agent updates backend service wiring and health checks.
- Frontend Agent verifies production build.
- QA Agent performs Docker and browser smoke.
- Docs Agent finalizes deployment docs.

Backend tasks:

- Add `postgres` and `redis` services to Compose.
- Set Docker defaults:
  - `PLATFORM_STATE_BACKEND=database`
  - `PLATFORM_REDIS_ENABLED=1`
  - `DATABASE_URL` points at `postgres`
  - `REDIS_URL` points at `redis`
- Add health checks and volume docs.
- Keep file-backed mode documented as emergency rollback.

Frontend tasks:

- Production build only; no deployment-specific API path changes.
- Browser-smoke login, upload, review, audit, and restart persistence.

QA tasks:

- Run:
  - `scripts/docker-compose-auto-subnet.py config`
  - `scripts/docker-compose-auto-subnet.py build backend frontend`
  - `scripts/docker-compose-auto-subnet.py up -d`
  - `/health`
  - login
  - upload batch
  - save label config
  - save draft
  - restart backend
  - restart redis
  - verify state persistence

Exit gate:

- New Docker deployment defaults to PostgreSQL + Redis.
- File-backed rollback path remains available.
- Full backend, frontend, Docker, and browser smoke checks pass.

## Agent Start Order

1. Lead Agent creates `integration/TASK-019` and the first backend/QA/docs worktrees.
2. Backend Agent starts Phase 2 state contracts.
3. QA Agent starts Phase 2 contract test harness in parallel.
4. Docs Agent records state architecture and migration runbook skeleton in parallel.
5. Lead merges Phase 2 only after backend and QA handoffs pass.
6. Backend DB Foundation starts Phase 3 after Phase 2 integration.
7. Frontend Agent starts only lightweight compatibility checks during Phases 2-4.
8. Backend Redis and Frontend progress work start together in Phase 5.
9. Import tool starts after database schema and database store are stable.
10. Docker rollout starts last, after import tool and Redis tests pass.

## Non-Negotiable Checks

Every phase handoff must include:

- Files changed.
- Contracts changed.
- Dependencies changed.
- Commands run and results.
- Known risks.
- Rollback route.

Lead integration must run at minimum:

- `uv run pytest`
- `npm run test`
- `VITE_API_BASE_URL=/api npm run build`
- `git diff --check`
- Docker config/build checks once Compose changes begin.

## Related Documents

- [State Persistence Boundaries](./state-persistence-boundaries.md)
- [PostgreSQL + Redis Migration Runbook](./postgres-redis-migration-runbook.md)
- [Docker LAN Deployment](./deployment.md)

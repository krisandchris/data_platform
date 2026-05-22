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

## Phase 6 Initial Findings

- Phase 6 must implement `uv run python -m urban_violation_backend.migrate_state import-file-state` or reconcile the runbook to the final command name.
- File-backed runtime state is read through `PlatformStateStore` under `PLATFORM_STATE_ROOT`.
- File-backed label configs are read through `FileBackedLabelConfigRepository` under `LABEL_CONFIG_STORE_ROOT`.
- Database targets are already represented by `DatabaseFoundationRegistryRepository`, `DatabaseLabelConfigRepository`, and `DatabaseBackedPlatformStateStore`.
- The import should prefer existing store APIs where possible, but conflict reporting requires explicit same-ID same-content vs same-ID different-content checks.
- `DatabaseBackedPlatformStateStore.save_users`, `save_role_bindings`, `save_sessions`, `save_tasks`, and `save_leases` are replace-style operations, so a migration tool must avoid using them blindly for conflict-sensitive imports unless it compares destination rows first.
- Append/upsert-style DB methods such as audit append, sample-pool upsert, export/evaluation save, and label config save have useful primitives but still need same-ID conflict checks for migration reporting.
- File-backed label config state is stored under `{LABEL_CONFIG_STORE_ROOT}/{dataset_id}/label_configs/{versions,registry.json,active.json}` and can be loaded through `FileBackedLabelConfigRepository`.
- Existing `.gitignore` has an unrelated user modification in the main workspace; it should stay unstaged unless the user explicitly wants it committed.

## Phase 6 Backend Findings (agent/TASK-019/backend/import-tool)

- `FileBackedLabelConfigRepository` is not safe as a read-only migration source because `_load_dataset()` can normalize and persist files; Phase 6 importer now reads `label_configs/versions/*.json` and `active.json` directly to avoid mutating file-backed roots.
- Existing DB label-config APIs did not support preserved-ID imports; added explicit helpers:
  - `DatabaseLabelConfigRepository.import_with_preserved_id(stored)` for same-ID match/conflict detection.
  - `DatabaseLabelConfigRepository.import_active_pointer(dataset_id, config_id)` for non-overwriting active-pointer import.
- DB store and registry APIs are still reused for all other mutable-state domains, with importer-side conflict checks to prevent silent overwrite.
- Import command returns exit code `3` on conflicts so operators can stop and inspect the JSON report.

## Phase 6 QA Findings (agent/TASK-019/qa/import-tool-tests)

- QA branch supplied file-state import coverage expectations before the backend importer existed.
- During integration, the QA scenarios were reconciled into `tests/test_migrate_state_import_tool.py`:
  - CLI report writing through `migrate_state.main()`;
  - dry-run source-file non-mutation;
  - post-import database-mode API reads and continued writes.
- Focused integrated test file now executes against the real importer instead of skipping on module discovery.

## Phase 6 Docs Findings

- Docs branch documented the Phase 6 runbook around the now-confirmed command: `uv run python -m urban_violation_backend.migrate_state import-file-state`.
- Runbook updates must continue to state that Docker defaults remain file-backed until Phase 7.
- Reverse export from PostgreSQL back to file-backed roots is not implemented in Phase 6, so rollback after database-mode writes must explicitly choose PostgreSQL or the pre-cutover file backup as authoritative.

## Phase 6 Integration Findings

- Required state roots are CLI flags; only `DATABASE_URL` may be supplied from the environment when `--database-url` is omitted.
- The JSON report exposes top-level `status`, `dry_run`, redacted `database_url`, `summary`, per-domain counters, `unsupported_domains`, `filesystem_only_domains`, `filesystem_references`, and operator notes.
- Docs were reconciled from expected/pending command language to confirmed Phase 6 command language after merging backend, QA, and docs branches.

## Phase 7 Initial Findings

- `docker-compose.yml` currently has only `backend` and `frontend`; no `postgres` or `redis` services are present yet.
- Current backend Compose defaults are still file-backed and omit `DATABASE_URL`, `PLATFORM_STATE_BACKEND=database`, `PLATFORM_REDIS_ENABLED=1`, and `REDIS_URL`.
- Current backend Dockerfile copies `pyproject.toml`, `uv.lock`, `docs`, and `src`, but does not copy `alembic.ini` or `alembic/`. This blocks `PLATFORM_DB_AUTO_MIGRATE=1` in a database-mode container because `run_migrations_to_head()` resolves `alembic.ini` from the app root.
- `DatabaseRuntimeSettings.from_env()` already supports `PLATFORM_STATE_BACKEND`, `DATABASE_URL`, `PLATFORM_DB_AUTO_MIGRATE`, `PLATFORM_REDIS_ENABLED`, `REDIS_URL`, and Redis TTL environment variables.
- `build_fixture_service()` already runs Alembic migrations when database mode and `PLATFORM_DB_AUTO_MIGRATE=1` are enabled.
- `scripts/docker-compose-auto-subnet.py` already wraps all `docker compose` commands with an auto-selected 172.x subnet and should remain the supported operator entrypoint.
- Phase 7 should not move raw dataset files, uploaded archives, extracted sources, media, or export blobs into PostgreSQL; PostgreSQL stores durable metadata/state only.
- Existing `.gitignore` has an unrelated user modification in the main workspace; it should remain unstaged unless explicitly requested.
- Baseline `uv run python scripts/docker-compose-auto-subnet.py config` on Phase 7 start renders only `backend` and `frontend`; this confirms the four-service rollout is not yet implemented.
- Docker is available locally (`Docker Server 29.1.2`, Compose `v2.40.3`), so Phase 7 live build/smoke validation should be attempted unless later resource or port conflicts appear.

## Phase 7 Backend Findings (agent/TASK-019/backend/docker-rollout)

- Backend branch completed at `77b9a08` and is being merged into integration.
- Compose now defines `postgres:16` and `redis:7-alpine` services with health checks; `postgres` uses named volume `postgres_data`.
- Backend Compose defaults are database/Redis mode:
  - `PLATFORM_STATE_BACKEND=${PLATFORM_STATE_BACKEND:-database}`
  - `PLATFORM_DB_AUTO_MIGRATE=${PLATFORM_DB_AUTO_MIGRATE:-1}`
  - `DATABASE_URL` defaults to the Compose `postgres` service.
  - `PLATFORM_REDIS_ENABLED=${PLATFORM_REDIS_ENABLED:-1}`
  - `REDIS_URL=${REDIS_URL:-redis://redis:6379/0}`
- Backend now depends on healthy `postgres` and `redis`.
- Backend image now copies `alembic.ini` and `alembic/`, resolving the startup migration packaging gap.
- No dependency files changed.
- Remaining rollout risk: file-backed env rollback still starts `postgres` and `redis` services unless operators use a narrower compose invocation/profile; docs/QA should make this explicit or improve ergonomics in a follow-up.

## Phase 7 Frontend Findings (agent/TASK-019/frontend/docker-production-build)

- Frontend branch completed at `8385997` and is being merged into integration.
- Existing frontend Dockerfile already builds with `VITE_API_BASE_URL=/api`; Nginx proxies `/api/`, `/media/`, and `/health`.
- Added focused `HttpClient` test coverage for same-origin relative `/api/` URL joining.
- Frontend tests and production build pass with `VITE_API_BASE_URL=/api`.
- No dependency files changed; `npm ci` used the existing lockfile and reported 6 existing audit vulnerabilities.
- Existing Vue Router no-match warnings in `routesAndPages.test.ts` remain unchanged.

## Phase 7 Docs Findings (agent/TASK-019/docs/docker-rollout-runbook)

- Docs branch completed at `5ff8f40` and is being merged into integration.
- Docs updated Docker deployment, migration runbook, and state-boundary docs for Phase 7 PostgreSQL + Redis rollout.
- Lead integration reconciled docs against the actual backend Docker implementation:
  - `postgres:16`, service name `postgres`, named volume `postgres_data`;
  - `redis:7-alpine`, service name `redis`, no durable Redis data volume by default;
  - default `POSTGRES_USER=platform`, `POSTGRES_DB=urban_platform`, `POSTGRES_PASSWORD=platform_dev_password`;
  - default `DATABASE_URL=postgresql+psycopg://platform:<password>@postgres:5432/urban_platform`;
  - default `PLATFORM_DB_AUTO_MIGRATE=1`.
- Docs retain the invariant that filesystem artifacts remain on mounted volumes and reverse export back to file-backed JSON roots is not implemented.

## Phase 7 QA Findings (agent/TASK-019/qa/docker-rollout-smoke)

- QA branch completed at `93410a0` after merging backend rollout into the QA worktree.
- Added `tests/test_docker_rollout_phase7.py`.
- Default config assertions now require Phase 7 four-service Compose (`backend`, `frontend`, `postgres`, `redis`) without any rollout gate env var.
- QA asserts backend database/Redis defaults, Postgres/Redis health checks, backend `depends_on`, backend volume targets, Alembic Dockerfile packaging, and file-backed rollback override rendering.
- Live Docker smoke remains opt-in only with both:
  - `QA_RUN_DOCKER_ROLLOUT_SMOKE=1`
  - `QA_DOCKER_SMOKE_CONFIRM_ISOLATED=1`
- QA selector flakiness rerun passed 5/5 with 0% observed failure rate.
- Remaining QA risk: default rollback env render still includes postgres/redis services; this is documented as an operational boundary rather than a test failure.

## Phase 7 Final Findings

- Gated live Docker smoke exercises health, admin login, `/api/me`, dataset listing, label-config listing, backend restart persistence, and Redis restart durability boundary through the Nginx frontend port.
- The only live-smoke interruption encountered during integration was Docker Hub image pulling for `postgres:16`. Once the image was present locally, the smoke test passed.
- Test cleanup removed the isolated `task019qa_*` Compose project; no task-owned containers, volumes, or networks were left behind.
- Existing unrelated exited `data_platform-backend-1` and `data_platform-frontend-1` containers predate this final smoke and were left untouched.
- Existing unrelated `.gitignore` user modification remains outside TASK-019.

## Coverage Gate Findings

- Current backend total line coverage is 87%, below the requested 95% gate.
- Current frontend total line coverage is 81.36%, below the requested 95% gate.
- Backend coverage gaps are concentrated in `service.py`, `routes.py`, `runtime_coordination.py`, `db/foundation.py`, auth/permission edge paths, and CLI entrypoints.
- Frontend coverage gaps are concentrated in large UI surfaces and service modules: review workbench shell/page, dataset batch panels, users page, fixture/API service paths, and shared overlay edge paths.
- The repo currently has no committed backend coverage dependency/configuration and no committed frontend coverage provider/script/threshold, so 95% is not enforced by CI or local default commands.
- Reaching 95% should be treated as a new testing-hardening phase rather than a Phase 7 Docker rollout completion criterion.

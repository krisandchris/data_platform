# TASK-020 Import Validation UI Detail And Pagination Plan

Objective: improve the import validation page so blocking errors and non-blocking warnings show actionable backend detail instead of generic labels, and paginate scan validation / import preview lists at 10 rows per page.

## Current Task Status

1. Inspect frontend import validation data flow and tests.
   - Status: complete.
2. Implement UI/detail rendering in frontend worktree.
   - Status: complete.
3. Add/update frontend tests for detailed errors/warnings and pagination.
   - Status: complete.
4. Run frontend tests/build in worktree.
   - Status: complete.
5. Merge verified frontend branch into integration and then main.
   - Status: in_progress.

## Frontend Worktree

- Branch: `agent/TASK-020/frontend/import-validation-ui`
- Worktree: `/mnt/lc/LC/ares_xtws/0_train_data/_worktrees/data_platform/TASK-020-frontend-import-validation-ui`
- Scope: `frontend/**` import validation page/components/tests only.
- Out of scope: backend API contract changes unless inspection proves details are not sent by the backend.

## Acceptance Criteria

- Blocking errors card lists concrete validation messages and useful context for each backend issue.
- Non-blocking warnings card lists concrete validation messages and useful context for each backend issue.
- Generic labels such as `Backend warning` are not the only visible user-facing content when backend details are available.
- Scan validation list is paginated at 10 entries per page.
- Import preview list is paginated at 10 entries per page.
- Pagination controls show current range/page and allow previous/next navigation without layout churn.
- Existing import workflow behavior and API calls remain unchanged.

## Changed Files

- `frontend/src/features/import/ImportJobPage.vue`
- `frontend/src/services/urbanViolationApi.ts`
- `frontend/src/shared/types/contract.ts`
- `frontend/src/test/apiClient.test.ts`
- `frontend/src/test/routesAndPages.test.ts`

## Frontend Verification

- `cd frontend && npm ci`: passed.
- `cd frontend && npm run test -- src/test/apiClient.test.ts src/test/routesAndPages.test.ts`: passed.
- `cd frontend && npm run test`: passed.
- `cd frontend && npm run build`: passed.
- `git diff --check`: passed.

---

# TASK-019 PostgreSQL + Redis State Migration Plan

Objective: migrate mutable platform state from file-backed JSON/JSONL stores to PostgreSQL, use Redis for active leases/locks/progress, preserve current frontend API behavior, and provide a safe import path from existing runtime state.

## Phases

1. Baseline and contract freeze.
   - Status: complete.
2. Store interface extraction.
   - Status: complete.
3. PostgreSQL foundation for identity, registry, label config, import jobs, and audit.
   - Status: complete.
4. PostgreSQL migration for QC, drafts, submissions, sample pool, exports, and evaluations.
   - Status: complete.
5. Redis runtime state for active leases, locks, session cache, and import progress.
   - Status: complete. Backend, QA, Frontend, and Docs branches are merged into integration; final verification passed.
6. File-state import tool.
   - Status: complete. Backend, QA, and Docs branches are merged into integration; final verification passed.
7. Docker rollout and full acceptance.
   - Status: complete. Backend, QA, Frontend, and Docs branches are merged into integration; final verification and gated Docker live smoke passed.
8. Coverage hardening to 95%.
   - Status: pending. Current measured backend and frontend line coverage are below the requested 95% gate.

## Phase 5 Agent Branches

- Merged into integration: `agent/TASK-019/backend/redis-runtime` at `28f70c6`
- Merged into integration: `agent/TASK-019/qa/redis-runtime-tests` at `3529101`
- Merged into integration: `agent/TASK-019/frontend/progress-and-lease` at `151131c`
- Merged into integration: `agent/TASK-019/docs/redis-runtime-runbooks` at `3ff44e3`

## Phase 5 Scope

- Add Redis runtime coordination for active sample leases, owner-checked heartbeat/release, QC queue locks, import job locks, optional session lookup cache, and live import progress.
- Preserve PostgreSQL as the durable authority for users, roles, sessions, dataset metadata, import final state, label configs, audit, drafts, submissions, snapshots, sample pool, exports, and evaluations.
- Resolve the remaining live-service validation risk by adding and running PostgreSQL/Redis smoke checks where Docker services are available.
- Do not switch Docker production defaults in this phase.

## Phase 5 Exit Gate

- Redis disabled mode remains green.
- Redis enabled mode passes focused lease/lock/progress tests.
- Redis loss does not lose durable platform state.
- Real PostgreSQL/Redis smoke passes locally if disposable Docker services can be started.
- Frontend tests/build remain green.
- Docs and runbooks are reconciled with implemented env names and test selectors.

## Phase 5 Verification Results

- `uv run pytest tests/test_redis_runtime_backend.py tests/test_redis_runtime_api.py tests/test_postgres_redis_smoke.py tests/test_db_qc_state_api.py::test_db_qc_state_api_restart_persistence_and_full_workflow tests/test_db_qc_state_api.py::test_db_qc_state_api_autosave_then_submit_batch_is_consistent -q` passed.
- `uv run pytest -k "redis_runtime or postgres_live or db_qc_state or db_foundation or state_store_contract" -q` passed.
- Disposable Docker PostgreSQL/Redis smoke passed with `tests/test_postgres_redis_smoke.py` and `tests/test_redis_runtime_backend.py::test_real_redis_smoke_if_available`.
- `uv run pytest -q` passed.
- `cd frontend && npm run test` passed.
- `cd frontend && VITE_API_BASE_URL=/api npm run build` passed.
- `uv run python scripts/docker-compose-auto-subnet.py config` passed.
- `git diff --check` passed.

## Phase 6 Agent Branches

- Merged into integration: `agent/TASK-019/backend/import-tool` at `6c70088`
- Merged into integration: `agent/TASK-019/qa/import-tool-tests` at `ed66515`
- Merged into integration: `agent/TASK-019/docs/import-tool-runbook` at `af3c2ec`

## Phase 6 Scope

- Add an explicit CLI command for importing existing file-backed runtime state into the PostgreSQL-backed repositories.
- Import users, role bindings, sessions, audit events, dataset type registry, registered batches/import jobs, label configs/active pointers, QC assignments, tasks, leases, sample drafts, batch drafts, submissions, snapshots, modification events, sample pool items, export jobs, and evaluation runs.
- Preserve original IDs and filesystem references.
- Support `--dry-run`, `--report`, idempotent re-run, and same-ID different-content conflict reporting.
- Do not mutate `DATASET/`, uploaded archives, extracted source files, media files, export artifacts, or file-backed runtime roots.
- Keep Docker defaults file-backed until Phase 7.

## Phase 6 Exit Gate

- Empty import succeeds and reports zero imported rows.
- Full fixture import succeeds into database mode.
- Repeated import is idempotent and reports same-content matches rather than duplicating rows.
- Same-ID different-content conflicts are reported without silent overwrite.
- Post-import API reads and continued writes work in database mode.
- Docs include confirmed command names, reports, rollback notes, and verification commands.

## Phase 6 Verification Results

- `uv run pytest tests/test_migrate_state_import_tool.py tests/test_db_foundation_backend.py -q` passed.
- `uv run pytest -k "migrate_state or db_foundation or db_qc_state or state_store_contract" -q` passed with expected live-test skips.
- `uv run pytest -q` passed with expected live-test skips.
- `uv run python scripts/docker-compose-auto-subnet.py config` passed.
- `git diff --check` passed.

## Phase 7 Agent Branches

- Merged into integration: `agent/TASK-019/backend/docker-rollout` at `77b9a08`
- Merged into integration: `agent/TASK-019/frontend/docker-production-build` at `8385997`
- Merged into integration: `agent/TASK-019/docs/docker-rollout-runbook` at `5ff8f40`
- Merged into integration: `agent/TASK-019/qa/docker-rollout-smoke` at `93410a0`

## Phase 7 Scope

- Change Docker Compose production defaults from file-backed two-container deployment to PostgreSQL + Redis rollout.
- Add `postgres` and `redis` services, persistent PostgreSQL volume, Redis health check, backend dependency gates, and backend env defaults:
  - `PLATFORM_STATE_BACKEND=database`
  - `PLATFORM_REDIS_ENABLED=1`
  - `DATABASE_URL` points to the Compose `postgres` service.
  - `REDIS_URL` points to the Compose `redis` service.
  - `PLATFORM_DB_AUTO_MIGRATE=1` or an explicitly documented equivalent startup migration path.
- Ensure backend Docker image contains Alembic config and migration files if startup migration remains enabled.
- Preserve readonly `DATASET/` mount and writable filesystem roots for source files, uploads, media, label-config import roots, and export artifacts.
- Keep an explicit file-backed rollback profile/path documented and testable.
- Verify frontend production build remains same-origin through `/api`.

## Phase 7 Exit Gate

- Docker config renders with PostgreSQL, Redis, backend, and frontend services on the auto-selected 172.x subnet.
- Backend image builds with Alembic files available.
- Compose startup reaches healthy backend and frontend with database/Redis defaults.
- `/health`, `/login`, admin login, dataset/label-config read, import/upload path, review draft/save path, audit, and restart persistence are smoke-tested or blocked with exact environment reason.
- Redis restart does not lose durable PostgreSQL state; only active locks/live progress/cache may disappear.
- File-backed rollback path remains documented.
- Backend tests, frontend tests/build, Docker config/build/smoke checks, and `git diff --check` pass or have documented external blockers.

## Phase 7 Verification Results

- `uv run python scripts/docker-compose-auto-subnet.py config` passed.
- `uv run pytest tests/test_migrate_state_import_tool.py tests/test_db_foundation_backend.py -q` passed.
- `cd frontend && npm run test` passed.
- `uv run pytest tests/test_docker_rollout_phase7.py -q` passed.
- `uv run pytest -k "docker_rollout or postgres_live or redis_runtime" -q` passed.
- `git diff --check` passed.
- `uv run pytest -q` passed.
- `cd frontend && VITE_API_BASE_URL=/api npm run build` passed.
- `scripts/docker-compose-auto-subnet.py build backend frontend` passed.
- `QA_RUN_DOCKER_ROLLOUT_SMOKE=1 QA_DOCKER_SMOKE_CONFIRM_ISOLATED=1 uv run pytest tests/test_docker_rollout_phase7.py::test_docker_rollout_live_smoke_env_gated -q` passed after `postgres:16` was present locally.

## Coverage Audit

- `uv run --with coverage coverage run --source=src/urban_violation_backend -m pytest -q && uv run --with coverage coverage report -m` passed, but backend line coverage is 87%.
- `npm install --no-save --package-lock=false @vitest/coverage-v8@2.1.9 && npm run test -- --coverage --coverage.reporter=text` passed, but frontend line coverage is 81.36%.
- Requested 95% coverage gate is not yet satisfied.

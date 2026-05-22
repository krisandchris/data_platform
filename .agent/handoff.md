# TASK-019 Phase 7 Integration Handoff

## Lead Scope

Integration branch: `integration/TASK-019`

Phase 7 switches the Docker rollout target to PostgreSQL + Redis defaults, verifies production build/runtime behavior, and preserves a documented file-backed rollback path.

## Planned Agent Branches

- `agent/TASK-019/backend/docker-rollout`
- `agent/TASK-019/qa/docker-rollout-smoke`
- `agent/TASK-019/frontend/docker-production-build`
- `agent/TASK-019/docs/docker-rollout-runbook`

## Integration Status

Backend Docker rollout, frontend production-build, docs rollout, and QA rollout smoke branches have been merged into `integration/TASK-019`.

## Agent Branches Merged

- Merged commit: `agent/TASK-019/backend/docker-rollout` at `77b9a08`
  - Adds `postgres` and `redis` services.
  - Switches backend Compose defaults to database + Redis mode.
  - Copies Alembic assets into backend image.
- Merged commit: `agent/TASK-019/frontend/docker-production-build` at `8385997`
  - Adds same-origin `/api/` HttpClient test coverage.
  - Verifies frontend tests and production build with `VITE_API_BASE_URL=/api`.
- Merged commit: `agent/TASK-019/docs/docker-rollout-runbook` at `5ff8f40`
  - Updates deployment, migration, and state-boundary docs for Phase 7.
  - Lead reconciliation aligns docs to actual Compose defaults.
- Merged commit: `agent/TASK-019/qa/docker-rollout-smoke` at `93410a0`
  - Adds strict Phase 7 Docker config tests.
  - Adds gated live Docker smoke workflow.

## Verification

- `uv run python scripts/docker-compose-auto-subnet.py config`: passed.
- `uv run pytest tests/test_migrate_state_import_tool.py tests/test_db_foundation_backend.py -q`: passed.
- `cd frontend && npm run test`: passed.
- `uv run pytest tests/test_docker_rollout_phase7.py -q`: passed.
- `uv run pytest -k "docker_rollout or postgres_live or redis_runtime" -q`: passed.
- `git diff --check`: passed.
- `uv run pytest -q`: passed.
- `cd frontend && VITE_API_BASE_URL=/api npm run build`: passed.
- `scripts/docker-compose-auto-subnet.py build backend frontend`: passed.
- `QA_RUN_DOCKER_ROLLOUT_SMOKE=1 QA_DOCKER_SMOKE_CONFIRM_ISOLATED=1 uv run pytest tests/test_docker_rollout_phase7.py::test_docker_rollout_live_smoke_env_gated -q`: passed after `postgres:16` was available locally.

## Risks

- Docker image pulling can still fail in restricted networks; operators should pre-pull or mirror `postgres:16`, `redis:7-alpine`, Python, Node, Nginx, and `ghcr.io/astral-sh/uv` base images before rollout in constrained server environments.
- File-backed rollback env overrides remain documented and renderable, but Compose still includes `postgres` and `redis` services by default.
- Large filesystem artifacts remain on mounted volumes; only metadata and durable mutable state move to PostgreSQL.
- Requested 95% coverage gate is not yet satisfied: backend measured 87%, frontend measured 81.36%.
- Existing unrelated `.gitignore` user modification is not part of TASK-019 Phase 7.

## Rollback Plan

- Use the documented rollback env path with `PLATFORM_STATE_BACKEND=file` and `PLATFORM_REDIS_ENABLED=0` against the preserved mounted runtime roots.
- If database-mode writes have already occurred, choose PostgreSQL or the pre-cutover file backup as the authoritative state source; reverse export from PostgreSQL to file-backed JSON roots is not implemented.

# TASK-020 Integration Handoff

## Lead Scope

Integration branch: `integration/TASK-020`

Goal: merge a verified frontend fix for import validation detail rendering and 10-item pagination.

## Planned Branches

- `agent/TASK-020/frontend/import-validation-ui`

## Status

- Frontend implementation complete, merged into integration, and integration verification passed.

## Scope Completed

- Preserved backend string warnings as concrete user-visible issue messages.
- Included backend `validation_errors` in blocking validation issues even when warnings also exist.
- Added issue detail rendering for blocking and non-blocking cards.
- Added 10-row pagination to the scan validation / import preview table.
- Added tests for normalization, detailed issue rendering, and pagination.

## Changed Files

- `frontend/src/features/import/ImportJobPage.vue`
- `frontend/src/services/urbanViolationApi.ts`
- `frontend/src/shared/types/contract.ts`
- `frontend/src/test/apiClient.test.ts`
- `frontend/src/test/routesAndPages.test.ts`

## Shared Contracts Changed

Yes. Frontend-only TypeScript contract `ImportWarning` gained optional `details?: string[]`.

## Dependencies Changed

No.

## Verification

- `cd frontend && npm ci`: passed.
- `cd frontend && npm run test -- src/test/apiClient.test.ts src/test/routesAndPages.test.ts`: passed.
- `cd frontend && npm run test`: passed.
- `cd frontend && npm run build`: passed.
- `git diff --check`: passed.

## Known Risks

- Existing route-test Vue Router no-match warnings remain unchanged.
# TASK-021 Integration Handoff

## Lead Scope

Integration branch: `integration/TASK-021`

Goal: merge a verified frontend fix for asset sample pagination and QC "我的批次" row-layout pagination.

## Planned Branches

- `agent/TASK-021/frontend/sample-qc-pagination`

## Status

- Frontend worktree created.
- Implementation pending.

---

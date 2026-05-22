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
   - Status: in_progress. Phase 6 worktrees are being prepared for backend implementation, QA coverage, and docs/runbook updates.
7. Docker rollout and full acceptance.
   - Status: pending.

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

- Planned: `agent/TASK-019/backend/import-tool`
- Planned: `agent/TASK-019/qa/import-tool-tests`
- Planned: `agent/TASK-019/docs/import-tool-runbook`

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

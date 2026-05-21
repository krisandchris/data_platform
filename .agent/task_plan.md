# TASK-019 PostgreSQL + Redis State Migration Plan

Objective: migrate mutable platform state from file-backed JSON/JSONL stores to PostgreSQL, use Redis for active leases/locks/progress, preserve current frontend API behavior, and provide a safe import path from existing runtime state.

## Phases

1. Baseline and contract freeze.
   - Status: complete. Backend, QA, and Docs first-pass branches were merged and verified on `integration/TASK-019`.
2. Store interface extraction.
   - Status: complete. Backend protocol extraction and QA contract tests passed integration verification.
3. PostgreSQL foundation for identity, registry, label config, import jobs, and audit.
   - Status: dispatch in progress. Phase 3 worktrees are being prepared for backend DB foundation, QA database tests, and docs/runbook alignment.
4. PostgreSQL migration for QC, drafts, submissions, sample pool, exports, and evaluations.
   - Status: pending.
5. Redis runtime state for active leases, locks, session cache, and import progress.
   - Status: pending.
6. File-state import tool.
   - Status: pending.
7. Docker rollout and full acceptance.
   - Status: pending.

## Agent Branches

- `integration/TASK-019`
- Merged: `agent/TASK-019/backend/state-contracts` at `e1d145f`
- Merged: `agent/TASK-019/qa/test-matrix` at `d64fc60`
- Merged: `agent/TASK-019/docs/runbooks` at `df52cae`
- Planned later:
  - `agent/TASK-019/backend/db-foundation`
  - `agent/TASK-019/qa/db-foundation-tests`
  - `agent/TASK-019/docs/db-foundation-runbooks`
  - `agent/TASK-019/backend/qc-state`
  - `agent/TASK-019/backend/redis-runtime`
  - `agent/TASK-019/backend/import-tool`
  - `agent/TASK-019/frontend/progress-and-lease`

## Constraints

- Main workspace is orchestration, planning, integration review, verification, and accepted-code synchronization only.
- Product backend changes must happen in backend worktrees.
- Product frontend changes must happen in frontend worktrees.
- Dependency changes are owned by the Lead Agent or an explicitly assigned dependency owner.
- `DATASET/` remains readonly and outside PostgreSQL.
- Uploaded/extracted archives, media files, and export artifacts remain on the filesystem.
- Redis must not be the authority for drafts, submissions, audit, users, roles, label config, or batch metadata.
- `RegisteredBatchRuntime` remains a derived cache hydrated from database metadata plus filesystem `source_uri`.

## Acceptance Criteria

- File-backed mode remains green after each phase until database mode is the Docker default.
- Database mode passes store contract tests and API regression tests.
- Redis active lease is cross-process safe and does not cause data loss when Redis restarts.
- Existing frontend API contracts remain compatible.
- Migration tool imports existing `PLATFORM_STATE_ROOT` and `LABEL_CONFIG_STORE_ROOT` data idempotently.
- Docker deployment defaults to PostgreSQL + Redis only after migration, import, and rollback paths are tested.

## Reference

Detailed sub-agent sequence and per-phase test design:

- `docs/architecture/state_migration_agent_sequence.md`

## Phase 1 Deliverables

- Backend:
  - Extract `PlatformStateStoreProtocol`.
  - Extract `LabelConfigRepositoryProtocol`.
  - Switch `FixtureRuntimeService`, `AuthService`, and `build_fixture_service` to protocol-typed dependencies.
  - Keep default runtime wiring file-backed.
- QA:
  - Add file-backed state store contract tests.
  - Add label config repository contract tests.
  - Record baseline backend/frontend/docker-compose checks.
- Docs:
  - Document persistence boundaries.
  - Document PostgreSQL/Redis migration runbook and operational gates.

## Phase 1 Integration Verification

- `git diff --check` -> passed.
- `git diff --cached --check` -> passed.
- `uv run pytest -k 'state_store_contract or label_config_repository_contract' -q` -> 4 passed.
- `uv run pytest` -> 93 passed.
- `npm run test` in `frontend/` with Node 20 -> 6 files passed, 114 tests passed.
- `VITE_API_BASE_URL=/api npm run build` in `frontend/` with Node 20 -> passed.
- `uv run python scripts/docker-compose-auto-subnet.py config` -> passed.

## Phase 3 Dispatch Scope

- Backend DB Foundation:
  - Add approved Python database dependencies with `uv add`: SQLAlchemy, Alembic, and psycopg or the minimal PostgreSQL driver stack selected by the backend agent.
  - Add database configuration for `DATABASE_URL`, `PLATFORM_STATE_BACKEND=file|database`, and `PLATFORM_DB_AUTO_MIGRATE=0|1`.
  - Add Alembic setup and first migrations for identity, RBAC, sessions, dataset registry, batch registry, import job metadata, label config, and audit.
  - Implement database-backed foundation repositories while preserving file-backed default behavior.
  - Do not migrate QC drafts/submissions/sample-pool/export/evaluation state in this phase.
- QA DB Foundation:
  - Add database-mode contract/integration tests for config, migration bootstrap, admin/session, label config, dataset registry, import job metadata, and audit.
  - Keep tests runnable without a local PostgreSQL server where possible, with explicit `TEST_DATABASE_URL` gating for PostgreSQL-only checks.
- Docs DB Foundation:
  - Update migration docs and runbook with actual dependency, env, Alembic, and verification command names produced by the backend branch.

## Phase 3 Exit Gate

- File-backed mode remains green: `uv run pytest`.
- Database foundation tests pass.
- Dependency changes are documented with `pyproject.toml` and `uv.lock` updates.
- No Docker default switch to database mode yet.
- No Redis implementation yet.

## 2026-05-22 QA Phase 3 Execution (db-foundation-tests)

- Add `tests/test_db_foundation_contract.py` with branch-safe gating so tests skip until DB foundation backend wiring exists.
- Add `tests/test_db_foundation_api.py` for DB-mode admin/session, label config lifecycle, dataset type/batch/import job metadata, and audit list behavior.
- Gate PostgreSQL-only assertions on `TEST_DATABASE_URL`.
- Keep file-backed default behavior checks and avoid backend/product code edits.
- Verify with focused new-harness runs, 5x rerun flakiness probe, required contract baseline command, full suite attempt, and `git diff --check`.

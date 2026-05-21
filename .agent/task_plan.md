# TASK-019 Phase 4 QA Plan

## Goal

Add independent Phase 4 verification for database-backed QC/review state, restart persistence, concurrency risks, and file-backed regression safety.

## Role

QA Agent

## Branch

`agent/TASK-019/qa/qc-state-tests`

## Worktree

`/mnt/lc/LC/ares_xtws/0_train_data/_worktrees/data_platform/TASK-019-qa-qc-state-tests`

## Assigned Scope

- `tests/test_db_qc_state_contract.py`
- `tests/test_db_qc_state_api.py`
- Test helpers under `tests/` if required and non-conflicting
- `.agent/**`

## Out Of Scope

- Product backend implementation under `src/**`
- Frontend product code
- Redis implementation
- Docker rollout
- Dependency changes

## Planned Steps

1. Inspect existing state store, DB foundation, and API tests.
2. Add gated database-mode tests for assignment, lease, draft, batch draft, submission, snapshot, sample pool, export, and evaluation persistence.
3. Add restart persistence tests by recreating service/store against the same database URL.
4. Add race-oriented tests for duplicate queue generation, autosave vs submit, and assignment transition conflicts where feasible without external services.
5. Keep tests compatible with SQLite fallback and optionally enable PostgreSQL with `TEST_DATABASE_URL`.
6. Document tests that are expected to fail before backend Phase 4 lands.

## Acceptance Criteria

- Tests pass after backend Phase 4 branch is integrated.
- File-backed regression tests remain green.
- PostgreSQL-only checks are gated on `TEST_DATABASE_URL`.
- `.agent/handoff.md` lists exact commands and pass/fail results.

## Expected Checks

- `uv sync`
- `uv run pytest tests/test_db_qc_state_contract.py tests/test_db_qc_state_api.py -q`
- `uv run pytest -k "state_store_contract or db_foundation or db_qc_state" -q`
- `uv run pytest`


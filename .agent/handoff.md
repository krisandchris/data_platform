# TASK-019 Phase 6 QA Agent Handoff

## Agent Role

QA Agent

## Branch

`agent/TASK-019/qa/import-tool-tests`

## Assigned Scope

- Migration/import test design and implementation under `tests/**`.
- Fixture construction via existing API/state-store behavior (no frontend or dependency changes).

## Changed Files

- `tests/test_migrate_state_import_tool.py`
- `.agent/handoff.md`

## Test Inventory

- `test_import_file_state_empty_report`
  - Verifies empty file-state import succeeds and report import-like counters are zero.
- `test_import_file_state_representative_fixture`
  - Seeds representative file-backed state via existing APIs, imports into SQLite database mode, validates report has positive user/role/draft-or-submission signal, and confirms DB-mode read path is reachable.
- `test_import_file_state_idempotent_repeated_import`
  - Runs import twice and verifies second report has no new created/inserted/imported rows (excluding same-content style metrics).
- `test_import_file_state_conflict_same_id_different_content_without_overwrite`
  - Mutates file-backed user payload with same ID/different content, re-imports, checks conflict metrics, and verifies DB-side record was not overwritten.
- `test_import_file_state_dry_run_does_not_mutate`
  - Runs apply then dry-run and verifies source file hashes (`users.json`, `audit_events.jsonl`) remain unchanged by dry-run.
- `test_import_file_state_post_import_reads_and_continued_writes`
  - After import, verifies DB-mode user list/read APIs and executes continued DB-mode write (`POST /api/users`) then read-back.

## Command Coordination

- Primary expected backend command surface used by tests:
  - `python -m urban_violation_backend.migrate_state import-file-state`
- Tests are built with a module discovery guard and skip if the backend import module is not yet present on this branch.
- Import flags used in tests follow runbook expectations:
  - `--platform-state-root`
  - `--label-config-store-root`
  - `--dataset-root`
  - `--report`
  - `--dry-run` (when applicable)

## Verification Commands And Results

- `uv run pytest tests/test_migrate_state_import_tool.py -q`
  - Result: `6 skipped` (backend import module not present yet in this QA branch snapshot).
- Flakiness rerun (5x): `uv run pytest tests/test_migrate_state_import_tool.py -q`
  - Result: 5/5 successful test sessions, 0 failures, all skipped consistently.
  - Failure rate: `0/5 = 0%` session failures.
- `git diff --check`
  - Result: pass (no whitespace/conflict marker issues).

## Coverage Gaps / Blockers

- Current branch snapshot does not yet contain `urban_violation_backend.migrate_state`; therefore execution-path assertions against the real importer implementation are gated by skip.
- Once backend Phase 6 import module lands (or final command module path is confirmed), these tests should execute without structural changes; only command discovery/flag wiring may need minor alignment if backend surface differs.
- PostgreSQL-only semantics were intentionally not required here; tests default to SQLite-compatible verification per assignment.

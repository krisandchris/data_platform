# TASK-019 Phase 6 QA Agent Handoff

## Agent Role

QA Agent

## Branch

`agent/TASK-019/qa/import-tool-tests`

## Assigned Scope

- Own migration test design and test files under `tests/**`.
- Build fixtures using existing public store APIs where possible.
- Do not implement product backend source unless a tiny test helper is unavoidable.
- Do not modify frontend files or dependency files.

## Required Coverage

- Empty import reports zero imported rows.
- Full fixture/file-state import covers representative state classes.
- Repeated import is idempotent and reports same-content matches.
- Same-ID different-content conflict is reported and does not overwrite.
- Post-import API reads work in database mode.
- Continued writes after import work in database mode.
- Dry-run does not mutate DB or source files.

## Coordination Notes

- Backend command is expected as `urban_violation_backend.migrate_state import-file-state`, but confirm final command from Backend Agent before finalizing command-level tests.
- Prefer tests that can run on SQLite by default; gate PostgreSQL-only tests with `TEST_DATABASE_URL` only where PostgreSQL semantics are essential.

## Verification Expected

- `uv run pytest <new migration tests> -q`.
- Relevant existing database/QC selectors if practical.
- `git diff --check`.

## Handoff To Complete

- List changed files.
- List tests added and what each proves.
- List verification commands/results.
- Note any coverage blocked by backend handoff timing.

# TASK-019 Phase 6 Docs Agent Handoff

## Agent Role

Docs Agent

## Branch

`agent/TASK-019/docs/import-tool-runbook`

## Assigned Scope

- Own docs updates under `docs/**` and any docs-only `.agent` notes.
- Do not modify backend/frontend product code or dependency files.

## Required Documentation

- Confirmed Phase 6 command name and examples.
- Dry-run, apply, idempotency, and conflict-report workflow.
- Required env vars: `DATABASE_URL`, `PLATFORM_STATE_BACKEND`, `PLATFORM_DB_AUTO_MIGRATE` if applicable.
- Source roots: `PLATFORM_STATE_ROOT`, `LABEL_CONFIG_STORE_ROOT`, `DATASET_ROOT`.
- Explicit non-mutation guarantees for raw dataset files, uploaded packages, extracted source trees, media, export artifacts, and file-backed state roots.
- Operator rollback notes and remaining limitation that reverse export is not yet implemented.
- Verification checklist for post-import API reads and continued writes.

## Coordination Notes

- Start with the placeholder sections in `docs/architecture/postgres-redis-migration-runbook.md`.
- Reconcile command names after Backend Agent lands the final CLI surface.

## Verification Expected

- `git diff --check`.
- Manual structure/link review.

## Handoff To Complete

## Changed Docs

- `docs/architecture/postgres-redis-migration-runbook.md`
  - Added Phase 6 file-state import scope.
  - Added expected env vars, roots, command flags, and Docker host-root notes.
  - Expanded dry-run, apply, idempotency, conflict, rollback, and post-import verification workflow.
  - Clarified Docker defaults remain file-backed until Phase 7 and reverse export is not implemented in Phase 6.
- `docs/architecture/deployment.md`
  - Added Phase 6 deployment posture and expected import command example.
  - Clarified import is explicit operator-run migration work, not current Compose default behavior.
- `docs/architecture/state-persistence-boundaries.md`
  - Added Phase 6 import boundary, source roots, target writes, idempotency/conflict rules, and reverse-export limitation.

## Command Names Documented

- Expected backend-confirmation-dependent command:
  - `uv run python -m urban_violation_backend.migrate_state import-file-state`
- Expected flags:
  - `--platform-state-root`
  - `--label-config-store-root`
  - `--dataset-root`
  - `--dry-run`
  - `--report`

## Verification

- `git diff --check` passed.
- Manual structure review performed against the three edited docs.

## Open Docs Risks

- Backend Phase 6 implementation handoff is not final yet. The command name and report schema must be reconciled after backend and QA branches complete.
- Focused import test file names/selectors are not yet final, so the docs describe workflow expectations rather than a committed test command.
- Docker defaults intentionally remain file-backed in these docs until Phase 7 integration changes and verifies Compose defaults.

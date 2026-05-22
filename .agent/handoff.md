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

- List changed docs.
- List final command names documented.
- Note any docs that still need update after backend/QA integration.

# TASK-019 Phase 4 Docs Findings

## Initial Context

- Phase 3 docs describe database foundation only.
- Phase 4 docs must update the transition boundary after backend QC/review state moves to PostgreSQL.

## Findings

- Read required docs: `docs/architecture/state-persistence-boundaries.md`, `docs/architecture/postgres-redis-migration-runbook.md`, and `docs/backend/modules/runtime-and-validation.md`.
- Read assigned support docs: `docs/architecture/state_migration_agent_sequence.md` and `docs/backend/modules/assets-media-review.md`.
- Current docs described Phase 3 as PostgreSQL foundation only and left QC/review state file-backed.
- Current `src/urban_violation_backend/db/models.py` still declares Phase 3 foundation ORM rows only: users, role bindings, sessions, dataset types, dataset batches, import jobs, label configs, active label-config pointer, and audit events.
- Current `src/urban_violation_backend/state_store.py` protocol already names the Phase 4 persistence surface: assignments, tasks, leases, drafts, batch drafts, submissions, snapshots, modification events, sample pool items, export jobs, and evaluations.
- Current API/docs route surface for Phase 4 validation is in `docs/backend/modules/qc-workflow.md`, `docs/backend/modules/label-edits.md`, `docs/backend/modules/qc-closed-loop.md`, `docs/backend/modules/export-search.md`, and `docs/backend/modules/assets-media-review.md`.
- Current `tests/test_state_store_contract.py` covers the Phase 4 store contract shape for assignment, task, lease, draft, batch draft, submission, snapshot idempotency, modification event de-duplication, sample pool upsert/soft removal, export job status update, and evaluation persistence.
- Phase 4 backend table names, migration revision IDs, and exact database-mode test selectors are backend-confirmation-dependent until backend and QA branches land.
- Docker/default deployment context from prior repo memory reinforced that dataset roots and runtime roots are intentionally host-mounted/filesystem-backed, so docs should not imply raw files or export artifacts move into PostgreSQL.

## Risks

- Backend implementation details may differ from initial Phase 4 plan; docs should be reconciled after backend branch lands.
- Redis remains later-phase only.
- Commands using `-k "qc_state or review_state or state_store_contract"` are documented as selector patterns to reconcile with backend/QA handoff, not confirmed current test names.

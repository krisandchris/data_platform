# TASK-019 Migration Findings

## Decisions

- PostgreSQL is the authoritative target for durable mutable platform records.
- Redis is only for active lease, locks, session cache, and import progress in later phases.
- File-backed implementation remains rollback and test baseline until Docker rollout.
- `DATASET/`, uploaded archives, extracted source trees, media files, and export artifacts remain filesystem state.

## Phase 5 Backend Findings

- Backend Phase 5 branch completed at `28f70c6` and is merged into integration.
- Redis is opt-in through runtime settings and defaults to disabled/no-op fallback.
- Backend adds Redis runtime coordination for active sample leases, owner-checked heartbeat/release, QC queue generation locks, import job execution locks, live import progress, and optional session lookup cache.
- `ImportJobStatusResponse` adds optional `live_progress`; existing required fields remain unchanged.
- Durable authority remains the existing state store/PostgreSQL path. Redis stores only runtime coordination/cache/progress data.

## Phase 5 QA Findings

- QA Phase 5 branch completed at `3529101` and is merged into integration.
- QA added deterministic Redis runtime/API tests and env-gated live PostgreSQL/Redis smoke tests.
- Live smoke tests require `TEST_DATABASE_URL` and `TEST_REDIS_URL`.

## Phase 5 Frontend Findings

- Frontend Phase 5 branch completed at `151131c` and is merged into integration.
- Frontend accepts optional import progress variants and keeps upload progress behavior.
- Lead integration aligned frontend normalization with backend `live_progress`.
- Lead integration added frontend percent derivation from backend `current` / `total` progress values and declared `BackendImportJob.live_progress` in the shared TypeScript contract.
- Frontend treats expired leases as readonly and avoids heartbeat/release for expired or other-user leases.

## Phase 5 Docs Findings

- Docs Phase 5 branch completed at `3ff44e3` and is merged into integration.
- Lead integration changed docs test selectors to the actual QA selector: `redis_runtime or postgres_live or db_qc_state`.
- Lead integration split deterministic Phase 5 regressions from live PostgreSQL/Redis smoke commands so shared `TEST_DATABASE_URL` does not pollute isolated unit/API tests.

## Phase 5 Integration Findings

- Current fixture label config is `urban_violation_labels_v2`; test helpers now derive label config version and the next-version case from the fixture instead of hard-coding v1/v2.
- Live smoke tests use the implemented `/health` endpoint.
- Focused Redis/API tests, selector tests, live Docker PostgreSQL/Redis smoke, full backend tests, frontend tests/build, Docker config rendering, and diff whitespace checks passed.

## Known Risks

- Rollback after database-mode writes remains a policy decision unless a tested reverse export tool is implemented.
- File-state import remains Phase 6.
- Untracked `prompts_complete.md` exists in the main worktree and is unrelated to TASK-019 Phase 5.

## Phase 6 Initial Findings

- Phase 6 must implement `uv run python -m urban_violation_backend.migrate_state import-file-state` or reconcile the runbook to the final command name.
- File-backed runtime state is read through `PlatformStateStore` under `PLATFORM_STATE_ROOT`.
- File-backed label configs are read through `FileBackedLabelConfigRepository` under `LABEL_CONFIG_STORE_ROOT`.
- Database targets are already represented by `DatabaseFoundationRegistryRepository`, `DatabaseLabelConfigRepository`, and `DatabaseBackedPlatformStateStore`.
- The import should prefer existing store APIs where possible, but conflict reporting requires explicit same-ID same-content vs same-ID different-content checks.
- `DatabaseBackedPlatformStateStore.save_users`, `save_role_bindings`, `save_sessions`, `save_tasks`, and `save_leases` are replace-style operations, so a migration tool must avoid using them blindly for conflict-sensitive imports unless it compares destination rows first.
- Append/upsert-style DB methods such as audit append, sample-pool upsert, export/evaluation save, and label config save have useful primitives but still need same-ID conflict checks for migration reporting.
- File-backed label config state is stored under `{LABEL_CONFIG_STORE_ROOT}/{dataset_id}/label_configs/{versions,registry.json,active.json}` and can be loaded through `FileBackedLabelConfigRepository`.
- Existing `.gitignore` has an unrelated user modification in the main workspace; it should stay unstaged unless the user explicitly wants it committed.

## Phase 6 Backend Findings (agent/TASK-019/backend/import-tool)

- `FileBackedLabelConfigRepository` is not safe as a read-only migration source because `_load_dataset()` can normalize and persist files; Phase 6 importer now reads `label_configs/versions/*.json` and `active.json` directly to avoid mutating file-backed roots.
- Existing DB label-config APIs did not support preserved-ID imports; added explicit helpers:
  - `DatabaseLabelConfigRepository.import_with_preserved_id(stored)` for same-ID match/conflict detection.
  - `DatabaseLabelConfigRepository.import_active_pointer(dataset_id, config_id)` for non-overwriting active-pointer import.
- DB store and registry APIs are still reused for all other mutable-state domains, with importer-side conflict checks to prevent silent overwrite.
- Import command returns exit code `3` on conflicts so operators can stop and inspect the JSON report.

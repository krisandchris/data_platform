# TASK-019 Migration Findings

## Current Architecture Facts

- `FixtureRuntimeService` currently combines business logic, file-backed registries, and process-local runtime caches.
- `PlatformStateStore` persists mutable collaboration state under `PLATFORM_STATE_ROOT` as JSON and JSONL files.
- `FileBackedLabelConfigRepository` persists label config versions, active pointers, and registry files under `LABEL_CONFIG_STORE_ROOT`.
- Registered batch metadata is currently persisted in label config store files, while `RegisteredBatchRuntime` is rehydrated from `source_uri`.
- Upload archives extract under `PLATFORM_STATE_ROOT/import_uploads/...`; this remains filesystem state.
- Frontend API client already covers login/session, import upload progress, label config, assignment, lease, draft, audit, sample pool, export, and evaluation flows.

## Migration Risks

- Replacing files with database tables directly would break process-local assumptions around `_registered_batches`, `_import_jobs`, and `_accepted_dataset_ids`.
- Moving `RegisteredBatchRuntime` into PostgreSQL would duplicate source data and make media/sample hydration brittle.
- Redis must not become the authority for durable state; Redis restart must not lose drafts, submissions, audit, label configs, users, or batch metadata.
- Current file writes often read all rows and rewrite full JSON files; database mode must replace these with transactional updates.
- Frontend should not need to know whether backend is in file or database mode.

## Decisions

- Use PostgreSQL as authoritative state store.
- Use Redis for active lease, locks, session cache, and import progress only.
- Preserve file-backed implementation as rollback and contract-test baseline.
- Use explicit file-state import command rather than automatic import on container startup.
- Split implementation into sequential integration phases; do not start Docker rollout until database, Redis, and import tool phases pass.

## Phase 1 Backend Findings (State Contract Extraction)

- `FixtureRuntimeService` had direct concrete coupling to both `PlatformStateStore` and `FileBackedLabelConfigRepository`, which blocked later store substitution without touching service logic.
- `AuthService` also typed directly to `PlatformStateStore`; this was updated to the protocol boundary so auth/session logic can operate with future database-backed stores.
- Extracted protocol surface reflects real current usage:
  - state store methods used by runtime/auth (users, sessions, RBAC bindings, QC state, drafts/submissions, snapshots/events, sample pool, exports/evaluations).
  - label config repository methods used by runtime (list/save/activate/get_active/reload_active).
- Full `uv run pytest` in this worktree is currently affected by local fixture path assumptions (`DATASET/urban` not present in this worktree), with 4 preannotation/manual-batch tests failing for source ingestion expectations; protocol extraction itself does not alter API schemas or route payload structure.

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

## Docs Agent Findings

- Current Compose file is at repository root `docker-compose.yml`, not `deploy/docker-compose.yml`.
- Current Docker deployment is file-backed with backend/frontend services only; PostgreSQL and Redis are TASK-019 future rollout services.
- `PlatformStateStore` stores users, role bindings, sessions, audit JSONL, QC assignments/tasks/leases, drafts, submissions, snapshots, modification events, sample pool items, export jobs, and evaluations under `PLATFORM_STATE_ROOT`.
- `FileBackedLabelConfigRepository` stores label config versions, registries, and active pointers under `LABEL_CONFIG_STORE_ROOT/{dataset_type}/label_configs`.
- `FixtureRuntimeService` persists dataset type and registered batch registries under `LABEL_CONFIG_STORE_ROOT`, while `_registered_batch_runtimes` is hydrated from source paths and must remain a rebuildable derived cache.
- Uploaded archives and extracted uploaded batch sources live under `PLATFORM_STATE_ROOT/import_uploads/{dataset_type}/{batch_key}` and must remain filesystem state.
- Export job metadata is mutable platform state, but generated export artifact files are filesystem artifacts and must not be stored as PostgreSQL blobs.
- Redis loss must be treated as loss of active locks/progress/cache only; it must not lose drafts, submissions, audit, label configs, users, roles, or batch metadata.

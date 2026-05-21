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

## Agent Monitoring Findings

- Backend Phase 1 branch is complete and clean at `e1d145f`; it added internal Python protocol boundaries without dependency changes or external API schema changes.
- QA contract baseline branch is complete and clean at `d64fc60`; new file-backed store contract tests passed repeatedly.
- Docs branch completed at `df52cae` with a clean worktree and docs-only handoff.
- Sub-agent status polling for Docs did not emit a completion event before notification arrived, so Lead Agent also verified completion from git state and handoff contents.

## Phase 1 Backend Findings

- `FixtureRuntimeService` had direct concrete coupling to both `PlatformStateStore` and `FileBackedLabelConfigRepository`, which blocked later store substitution without touching service logic.
- `AuthService` also typed directly to `PlatformStateStore`; this was updated to the protocol boundary so auth/session logic can operate with future database-backed stores.
- Extracted protocol surface reflects real current usage:
  - state store methods used by runtime/auth (users, sessions, RBAC bindings, QC state, drafts/submissions, snapshots/events, sample pool, exports/evaluations).
  - label config repository methods used by runtime (list/save/activate/get_active/reload_active).
- Protocol extraction does not alter external API schemas or route payload structure.

## Phase 1 QA Findings

- Added `tests/test_state_store_contract.py` to baseline file-backed behavior for users, role bindings, sessions, audit events, assignment, tasks, leases, drafts, submissions, snapshots, modification events, sample pool, exports, evaluations, and cleanup methods.
- Added `tests/test_label_config_repository_contract.py` to validate save/default activation, hash dedup, version conflict, and active reload behavior.
- Focused contract tests passed 5/5 repeated runs with 0 observed failures.
- Full backend test runs in Backend/QA worktrees reported existing failures tied to missing `DATASET/urban` fixture data in those isolated worktrees, not a confirmed regression from the new protocol/test changes.
- Frontend baseline commands in the QA worktree failed because `frontend/node_modules` was absent (`vitest` and `vue-tsc` not found); this requires dependency install or verification in the main workspace before final integration signoff.

## Phase 1 Docs Findings

- Current Compose file is at repository root `docker-compose.yml`, not `deploy/docker-compose.yml`.
- Current Docker deployment is file-backed with backend/frontend services only; PostgreSQL and Redis are TASK-019 future rollout services.
- `PlatformStateStore` stores users, role bindings, sessions, audit JSONL, QC assignments/tasks/leases, drafts, submissions, snapshots, modification events, sample pool items, export jobs, and evaluations under `PLATFORM_STATE_ROOT`.
- `FileBackedLabelConfigRepository` stores label config versions, registries, and active pointers under `LABEL_CONFIG_STORE_ROOT/{dataset_type}/label_configs`.
- `FixtureRuntimeService` persists dataset type and registered batch registries under `LABEL_CONFIG_STORE_ROOT`, while `_registered_batch_runtimes` is hydrated from source paths and must remain a rebuildable derived cache.
- Uploaded archives and extracted uploaded batch sources live under `PLATFORM_STATE_ROOT/import_uploads/{dataset_type}/{batch_key}` and must remain filesystem state.
- Export job metadata is mutable platform state, but generated export artifact files are filesystem artifacts and must not be stored as PostgreSQL blobs.
- Redis loss must be treated as loss of active locks/progress/cache only; it must not lose drafts, submissions, audit, label configs, users, roles, or batch metadata.

## Phase 3 Dispatch Findings

- Current `pyproject.toml` has no database dependencies yet; backend dependencies are limited to FastAPI, pwdlib, Pydantic, and Uvicorn plus dev pytest/httpx.
- PostgreSQL and Redis references in the repository are currently documentation/planning only, not runtime implementation.
- `build_fixture_service` already accepts injected `platform_state_store` and `label_config_repo`, which is the intended seam for database-backed foundation implementations.
- The first database phase must preserve file-backed defaults because Docker defaults and full QC state migration are later phases.

## Phase 3 QA Monitoring Findings

- QA DB foundation branch completed at `064f7a2` and intentionally gates DB-mode checks until backend source contains `PLATFORM_STATE_BACKEND` and `DATABASE_URL` wiring.
- PostgreSQL-only QA checks are additionally gated by `TEST_DATABASE_URL`.
- Lead integration order should merge Backend DB Foundation before QA so gated tests become active against real DB wiring.

## Phase 3 Docs Monitoring Findings

- Docs DB foundation branch completed at `816d862`.
- Docs intentionally mark some command names and behavior as backend-confirmation assumptions because Backend DB Foundation had not landed when Docs completed.
- Lead integration must reconcile docs after backend merge if actual Alembic paths, test selectors, driver URL form, mixed-mode behavior, or auto-migrate support differ from the docs.

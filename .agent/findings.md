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

# TASK-022 Findings

## Repository Facts

- The shell receives normalized label config with `code`, `labelZh`, and `labelEn`.
- Existing helper functions rendered `option.code`, which leaked English codes into the QC page.
- The user explicitly excluded `violation_category` from this localization pass.

## Implemented Decisions

- Display-only helpers were added so model/draft values remain original codes.
- For `violation_category`, the page continues displaying the raw value/code.
- For other label-config backed fields, visible text prefers `labelZh`, then `labelEn`, then known local fallback labels, then raw value.
- Datalist suggestions keep raw `value` but include localized `label`, so adding a tag still stores the original code.
- Lease/status/progress/topbar/relation/candidate labels were changed to Chinese operator text.

## Risks

- Free-text fields such as relation subject/object/description can still contain English if the sample data itself is English. The change maps known tag/code values for display-only text but does not mutate editable free-text values.
- Some technical identifiers remain intentionally raw, including `violation_category`, sample IDs, candidate IDs, relation IDs, and persisted operation field names.

---

# TASK-023 Findings

## Research Notes

- Started from current checkout `/mnt/lc/LC/ares_xtws/4_agent/data_platform`.
- Memory contained only an older sibling checkout note for `/mnt/lc/LC/ares_xtws/0_train_data/data_platform`; treat as potentially stale and verify against current files.
- Current checkout is a Python backend + Vue/Vite frontend repository.
- Top-level runtime/config files include `pyproject.toml`, `uv.lock`, `.nvmrc`, `docker-compose.yml`, `frontend/package.json`, and `frontend/package-lock.json`.
- Backend code lives under `src/urban_violation_backend`; frontend code lives under `frontend/src`.
- Documentation is split across `docs/architecture`, `docs/backend`, and `docs/frontend`.
- Backend entrypoint `create_app()` wires `build_fixture_service()` into `build_router()` and registers API error handling plus CORS for local Vite.
- API surface covers auth/users/RBAC, dataset types/batches, label config, import jobs, assets/media, QC queue, leases, drafts/submissions, audit/progress, snapshots/diffs, sample pool, search, exports, and evaluation.
- Domain model includes dataset lifecycle, import job states, platform roles/scopes, batch assignment, QC task states, leases, annotation snapshots, modification events, sample pool, export jobs, and evaluation runs.
- Mutable runtime state is abstracted by `PlatformStateStoreProtocol`; file-backed state stores JSON/JSONL under platform state root, and database-backed tables exist for PostgreSQL migration.
- Auth supports session tokens and dev-header mode; bootstrap admin is created automatically when no users exist.
- Frontend is Vue 3 + Vue Router + Vite; routes cover login, dataset center/type pages, batch overview/assets/import/preannotations/QC/review, sample pool, account, permissions, and audit.
- `AppShell` provides the product navigation and hides the normal shell for focused sample review.
- Frontend API boundary is `UrbanViolationApi`; runtime selects HTTP mode by default or fixture mode through `VITE_API_MODE=fixture`.
- Review workbench loads current user, review detail, QC queue, active label config, and batch draft concurrently; it acquires and heartbeats sample leases for editable users.
- Import parser reads image files plus stage1/stage2 manifest JSONL, pairs preannotation outputs by sample id, and serves browser-safe media URLs.
- Label config enforces required open-tag and closed-enum field modes, deduplicates by content hash, and rejects same semantic version with different content.
- Deployment is a four-service stack: PostgreSQL, Redis, FastAPI backend, and Nginx-served frontend; source DATASET is mounted readonly.
- Persistence design keeps raw/source files on filesystem, durable mutable records in PostgreSQL in database mode, and Redis limited to locks/progress/session-cache style short-lived coordination.
- Test surface includes backend API/state/migration/Redis/Docker smoke tests and focused frontend API/router/media/component tests.

---

# TASK-024 Findings

## Repository Facts

- Started from `/mnt/lc/LC/ares_xtws/4_agent/data_platform` on branch `1.2`; created `offline/qc-validation-workbench`.
- Existing `.agent/` files already contained TASK-022/TASK-023 edits; preserving and appending TASK-024.
- Local `AGENTS.md` requires product frontend/backend edits to happen in agent worktrees, with main workspace used for planning, review, verification, and accepted-code sync.
- Memory had only older sibling-checkout `data_platform` notes; current implementation decisions must be verified from this checkout.

## Constraints

- No new dependencies unless necessary.
- Keep retained page interactions intact; prefer route/nav/config gates over component rewrites.
- Shared contract/config changes require lead review.

## Implemented Decisions

- Backend offline mode is enabled by `PLATFORM_AUTH_MODE=offline_single_user`.
- Offline mode forces file state and disables Redis coordination even if database/Redis env vars are present.
- `OFFLINE_DATA_ROOT`, `OFFLINE_STATE_ROOT`, and `OFFLINE_LABEL_CONFIG_PATH` are supported by backend startup.
- Offline user is `offline_reviewer`, bootstrapped with existing `batch_manager` and `qc_lead` role bindings.
- Frontend offline mode is enabled by `VITE_RUNTIME_MODE=offline_single_user`; optional `VITE_OFFLINE_DATASET_ID` defaults to `urban_violation`.
- Frontend non-core routes are redirected to `/datasets/<offlineDatasetId>/qc` in offline mode.
- `scripts/offline-stack.sh` starts the existing FastAPI/Vite stack with offline env defaults.

## Risks

- The offline nav does not add an import-job discovery UI; users need an import-job route with `jobId` or direct `/import-jobs/:jobId` URL for validation navigation.
- Full backend fixture summary tests require `DATASET/urban_violation`, which is absent from the worktree checkout used for verification.

---

# TASK-026 Findings

## Repository Facts

- `scripts/offline-stack.sh` currently defaults `OFFLINE_DATA_ROOT` to `$ROOT_DIR/DATASET/urban_violation` and derives `OFFLINE_LABEL_CONFIG_PATH` from it.
- Existing frontend upload UI already lives in `DatasetTypeBatchPanel.vue` and uploads ZIP archives via `apiClient.createImportJobArchive`.
- Existing backend archive upload route is `POST /api/datasets/{dataset_id}/import-jobs/archive`; it safely stores and extracts ZIP files under platform state.
- Offline router currently allows only import job, QC, and sample review route names, so `/datasets/types/:datasetType` is redirected away and the upload form is unreachable in offline mode.

## Hypothesis

- The smallest root fix is to stop script-level default data root wiring and expose the existing dataset-type upload page as the offline upload entry. No new upload implementation is needed.

## Implemented Decisions

- `scripts/offline-stack.sh` no longer defaults `OFFLINE_DATA_ROOT`; unset means manual ZIP upload only.
- The default label config path is now project-root `label_config.json`.
- Offline root and hidden routes land on `/datasets/types/urban_violation?create=batch`.
- Backend disables fixture batch loading when offline mode has no explicit `OFFLINE_DATA_ROOT`.
- Backend auto-loads an existing `OFFLINE_LABEL_CONFIG_PATH` as active label config.
- Label config store state stays under `OFFLINE_STATE_ROOT/label_config_state`, not beside the source `label_config.json`.

## Verification Notes

- Browser final state: upload page visible, 0 batches, active label config version 2, no console errors.
- API final state: `/health` has no `data_root`, dataset type has `batch_count=0` and `active_label_config_version=2`.

---

# TASK-027 Findings

## Current Evidence

- `DATASET/0508_797.zip` exists and is 1.4G.
- ZIP listing has 11233 entries and includes `0508_797/images`, `stage1_run_0508`, and `stage2_run_0508`.
- Current live offline stack reports `Data root: manual ZIP upload only`.
- Current dataset type state before upload has `batch_count=0` and `active_label_config_version=2`.

## Constraints

- Default archive upload limit is 200MB and extract limit is 1GB; this ZIP needs larger `PLATFORM_IMPORT_ARCHIVE_MAX_BYTES` and `PLATFORM_IMPORT_ARCHIVE_EXTRACT_MAX_BYTES` for the verification run.

## Final Evidence

- Uploaded `DATASET/0508_797.zip` with streaming Python HTTP client because curl exhausted memory on the 1.4G body.
- Import job `manual-import-urban_violation-0508_797-1` created batch `urban_violation__0508_797`.
- Import evidence:
  - `state=Imported`
  - `lifecycle_status=qc_in_progress` after confirm/QC generation
  - `expected_assets=797`, `imported_assets=797`
  - `stage1_file_count=797`, `stage2_file_count=780`, `stage2_failure_file_count=19`
  - `validation_rows=797`
- QC evidence:
  - queue `qcq_urban_violation_0508_797`
  - `total=797`
  - assignment user `offline_reviewer`, status `assigned`
  - `797` tasks, all `assigned`
- Browser evidence saved under `.runtime/offline_state_0508_zip_e2e/evidence/`:
  - `import_page.png`
  - `qc_page.png`
  - `review_page.png`
- Media endpoint evidence for sample `000002_0_1760525209355`: `GET` returned `200 image/jpeg`, 1280x720, 237854 bytes.

---

# TASK-028 Findings

## Root Cause

- User screenshot matches the offline generic QC route `/datasets/urban_violation/qc`.
- Backend returns `404 Dataset not found: urban_violation` for `/api/datasets/urban_violation/qc`.
- Uploaded `0508_797` batch QC works at `/datasets/urban_violation__0508_797/qc`; its API returns 797 queue items.
- Offline `AppShell` currently builds the top-level QC link as `/datasets/${activeDatasetId || offlineDatasetId()}/qc`, which becomes the invalid generic dataset-type URL when no batch is active.
- Browser evidence saved: `.runtime/offline_state_0508_zip_e2e/evidence/generic_qc_wrong_batch.png`.

## Minimal Fix Direction

- In offline mode, treat `/datasets/<offlineDatasetId>/qc` as a QC entry point, not a real batch.
- Redirect it to the first known uploaded batch QC URL when dataset type metadata has batches.
- Redirect it to the ZIP upload entry when there is no batch or the lookup fails.

## Resolution

- `frontend/src/app/router.ts` now resolves the offline generic QC entry via `apiClient.getDatasetType(offlineDatasetId())`.
- `scripts/offline-stack.sh urls` now prints a direct uploaded batch QC URL when `OFFLINE_STATE_ROOT/label_config_state/dataset_batches.json` contains one.
- The live browser route no longer stays on the invalid generic batch; it lands on `urban_violation__0508_797`.

---

# TASK-029 Findings

## Initial Cleanup Observations

- Frontend `frontend/src/app/router.ts` still statically imports non-core pages: dataset center, overview, assets, preannotations, sample pool, users, audit, account.
- Frontend `AppShell` already hides most non-core navigation in offline mode, but the static imports mean non-core code remains part of the route module and development load graph.
- Backend route surface is likely centralized in `src/urban_violation_backend/routes.py`; route-level cleanup needs tests before blocking/removal.
- Per repository AGENTS, product frontend/backend changes must be made in agent worktrees, not directly in the main workspace.

## Implemented Cleanup Decisions

- Frontend offline mode now registers only the ZIP upload/type route, import-job route, QC route, and sample review route.
- Full-platform non-core route components are lazy-loaded instead of statically imported by the router module.
- QC page skips `role-bindings` lookup in offline mode; the live QC page now has no console/network errors.
- Backend offline mode blocks non-core endpoints at app middleware level with `404 offline_endpoint_disabled`.
- This pass intentionally does not physically delete non-core service/state-store/page files yet; they remain for full-platform mode and future deeper deletion after contracts/tests are split.

---

# TASK-030 Findings

## Physical Prune Decisions

- Frontend route and API client pruning can be physical: retained pages do not require dataset center, overview, assets, preannotations, sample pool, users, audit, account, fixture API, or non-core tests.
- Frontend label-edit endpoints must stay aligned to existing backend retained paths: `my-draft`, `my-batch-draft`, `submit-batch`, and sample-scoped confirm/return.
- Backend DB/Redis code is not needed for offline single-user file-state mode; route and tests still pass after deleting DB package, migration tool, Redis implementation, and DB/Redis dependencies.
- Backend state store still needs retained objects for users, role bindings used by offline auth, sessions, QC assignments/tasks, leases, drafts, batch drafts, and submissions.

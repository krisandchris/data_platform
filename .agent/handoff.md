# Handoff

## Agent Role
Lead Agent

## Branch
`main`

## Worktree
`/mnt/lc/LC/ares_xtws/0_train_data/data_platform`

## Scope Completed
- Integrated backend agent archive-upload support for Docker/LAN batch creation.
- Integrated frontend agent zip-upload UI and raw upload API client support.
- Kept the readonly mounted `DATASET/` model intact; uploaded batch package contents are extracted into writable platform runtime state.

## Changed Files
- `src/urban_violation_backend/service.py`: archive upload limits, safe zip extraction, extracted-root selection, registered batch creation from archive.
- `src/urban_violation_backend/routes.py`: `POST /api/datasets/{dataset_id}/import-jobs/archive`.
- `tests/test_api.py`: archive upload success and unsafe zip path rejection coverage.
- `frontend/src/services/http.ts`: raw POST helper.
- `frontend/src/shared/types/contract.ts`: `ImportArchiveUploadPayload`.
- `frontend/src/services/urbanViolationApi.ts`: `createImportJobArchive`.
- `frontend/src/services/fixtures.ts`: fixture archive import support.
- `frontend/src/features/datasets/components/DatasetTypeBatchPanel.vue`: zip upload batch creation form.
- `frontend/src/test/apiClient.test.ts`: raw zip upload API test.
- `frontend/src/test/routesAndPages.test.ts`: zip upload batch form test.
- `.agent/task_plan.md`, `.agent/findings.md`, `.agent/progress.md`, `.agent/handoff.md`: integration tracking.

## Shared Contracts Changed
Yes. Added `POST /api/datasets/{dataset_id}/import-jobs/archive` and frontend `ImportArchiveUploadPayload`.

## Dependencies Changed
No.

## Verification
- `uv run pytest tests/test_api.py -k "archive_upload or manual_batch"` -> passed (`7 passed, 72 deselected`)
- `npm run test -- apiClient.test.ts routesAndPages.test.ts` -> passed (`2 passed`, `92 passed`)
- `VITE_API_BASE_URL=/api npm run build` -> passed
- `uv run pytest` -> passed (`87 passed`)
- `git diff --check` -> passed
- `docker compose config` -> passed
- `docker compose build backend frontend` -> passed

## Known Risks
- Existing compose containers were not recreated after the image rebuild, so the running stack is still on the previously started containers until `docker compose up -d` is run.
- Live Docker-stack browser smoke upload was not run after container recreation.
- Upload-limit fix requires recreating the frontend container so the new Nginx config is loaded.

## Rollback Plan
- Revert the archive endpoint and frontend `createImportJobArchive` path to return to the previous server-side `source_uri` registration flow.

## 2026-05-21 Upload Limit Follow-Up
- Raised Nginx `client_max_body_size` from `200m` to `2048m`.
- Added backend compose env overrides:
  - `PLATFORM_IMPORT_ARCHIVE_MAX_BYTES=2147483648`
  - `PLATFORM_IMPORT_ARCHIVE_EXTRACT_MAX_BYTES=4294967296`
- Updated deployment docs with archive upload size guidance.
- Verification:
  - `docker compose config` -> passed
  - `docker compose build frontend backend` -> passed
  - `docker run --rm --add-host backend:127.0.0.1 data_platform-frontend nginx -t` -> passed
  - `git diff --check` -> passed

## 2026-05-21 Large Upload Follow-Up
- Tuned deployment for frequent 3-5 GiB zip uploads:
  - Nginx `client_max_body_size=8192m`
  - Nginx `/api/` request buffering disabled
  - Nginx upload/proxy timeouts set to 3600s
  - Backend upload limit default set to 8 GiB
  - Backend extracted-content limit default set to 32 GiB
- Operational note: large archive uploads still require sufficient host free space under `PLATFORM_STATE_HOST_ROOT`.
- Verification:
  - `docker compose config` -> passed
  - `git diff --check` -> passed
  - `docker compose build frontend backend` -> passed
  - `docker run --rm --add-host backend:127.0.0.1 data_platform-frontend nginx -t` -> passed

## 2026-05-21 Archive Upload Progress Follow-Up
- Added frontend upload progress support for batch archive uploads.
- Normal API requests remain fetch-based; archive uploads use XMLHttpRequest when `onUploadProgress` is supplied.
- Dataset type batch creation now shows:
  - percentage progress
  - uploaded/total byte count
  - backend processing state after upload reaches 100%
- Verification in frontend agent:
  - `npm run test -- apiClient.test.ts routesAndPages.test.ts` -> passed (`2 passed`, `93 passed`)
  - `VITE_API_BASE_URL=/api npm run build` -> passed
- Main verification:
  - `npm run test -- apiClient.test.ts routesAndPages.test.ts` -> passed (`2 passed`, `93 passed`)
  - `VITE_API_BASE_URL=/api npm run build` -> passed
  - `git diff --check` -> passed
  - `docker compose build frontend` -> passed
- Deployment note: recreate the frontend container for the progress UI to appear in Docker.

## 2026-05-21 Sample Review Switching UX Follow-Up
- Reduced Sample Review sample-switch flicker by keeping the workbench mounted while the next sample route request is pending.
- Added an inline topbar switching status: `正在切换到 <sampleId>`.
- Disabled repeated navigation/actions during the pending sample switch.
- Buffered `BBoxOverlay` image and box snapshots so the previous preview remains visible until the next image finishes loading.
- Added regression coverage for route-level sample switching and image/box buffering.
- Changed files:
  - `frontend/src/features/review-workbench/ReviewWorkbenchPage.vue`
  - `frontend/src/features/review-workbench/components/ReviewWorkbenchShell.vue`
  - `frontend/src/shared/components/BBoxOverlay.vue`
  - `frontend/src/test/routesAndPages.test.ts`
  - `frontend/src/test/bboxOverlay.test.ts`
- Verification in frontend agent:
  - `npm run test -- routesAndPages.test.ts bboxOverlay.test.ts` -> passed (`2 passed`, `80 passed`)
  - `VITE_API_BASE_URL=/api npm run build` -> passed
- Main verification:
  - `npm run test -- routesAndPages.test.ts bboxOverlay.test.ts` -> passed (`2 passed`, `80 passed`)
  - `VITE_API_BASE_URL=/api npm run build` -> passed
  - `git diff --check` -> passed
  - `docker compose build frontend` -> passed
- Deployment note: recreate the frontend container for the updated review UI to appear in Docker.
- Main verification:
  - `npm run test -- routesAndPages.test.ts bboxOverlay.test.ts` -> first run hit an unrelated label-config conflict assertion, immediate rerun passed (`2 passed`, `80 passed`)
  - `VITE_API_BASE_URL=/api npm run build` -> passed
  - `git diff --check` -> passed
  - `docker compose build frontend` -> passed
- Deployment note: recreate the frontend container for the updated review UI to appear in Docker.

## 2026-05-21 Sample Review No-Jitter Follow-Up
- Removed the visible `正在切换到 <sampleId>` status from the top action bar so sample switching does not change toolbar width or push down the image area.
- Kept pending state as `aria-busy` on the stable `.sample-detail-workbench` root.
- Removed switching-time opacity changes from `.review-grid` and `.review-action-bar`.
- Updated route/page regression coverage to assert the old sample remains visible without a visible switching status during the pending request.
- Verification:
  - `npm run test -- routesAndPages.test.ts bboxOverlay.test.ts` -> passed (`2 passed`, `80 passed`)
  - `VITE_API_BASE_URL=/api npm run build` -> passed
  - `git diff --check` -> passed
  - `docker compose build frontend` -> passed

## 2026-05-21 Sample Review Lease Flicker Follow-Up
- Kept the backend lease release call during Sample Review navigation.
- Added a navigation-only release mode that does not mutate the still-visible old sample lease to `released`.
- Suppressed the readonly warning row while a sample route refresh is pending, while preserving readonly state for edit gating.
- Added regression coverage for the window after `releaseSampleLease` resolves and before the next sample detail is hydrated.
- Changed files:
  - `frontend/src/features/review-workbench/ReviewWorkbenchPage.vue`
  - `frontend/src/features/review-workbench/components/ReviewWorkbenchShell.vue`
  - `frontend/src/test/routesAndPages.test.ts`
- Verification in frontend agent:
  - `npm run test -- routesAndPages.test.ts bboxOverlay.test.ts` -> passed (`2 passed`, `80 passed`)
  - `VITE_API_BASE_URL=/api npm run build` -> passed

## 2026-05-21 BBox Overlap Selection Follow-Up
- Changed normal bbox pointer selection to stage-level coordinate hit testing.
- Selection now ranks boxes that contain the pointer by nearest corner distance, then smaller area, then render order.
- Kept editable resize handles pointer-addressable.
- Added Shift/Alt click cycling for identical overlapping boxes.
- Added regression coverage for selecting a nested small box when a larger box is already selected.
- Changed files:
  - `frontend/src/shared/components/BBoxOverlay.vue`
  - `frontend/src/test/bboxOverlay.test.ts`
- Verification in frontend agent:
  - `npm run test -- bboxOverlay.test.ts routesAndPages.test.ts` -> passed (`2 passed`, `82 passed`)
  - `VITE_API_BASE_URL=/api npm run build` -> passed
- Main verification:
  - `npm run test -- bboxOverlay.test.ts routesAndPages.test.ts` -> passed (`2 passed`, `82 passed`)
  - `VITE_API_BASE_URL=/api npm run build` -> passed
  - `git diff --check` -> passed
  - `docker compose build frontend` -> passed
- Deployment note: recreate the frontend container for the updated bbox interaction to appear in Docker.

## 2026-05-21 BBox Move Regression Fix
- Restored editable bbox movement after coordinate-based overlap selection.
- Split pointer interactions into click selection and drag movement using a 3px threshold.
- Kept click selection on coordinate/nearest-corner ranking.
- Drag movement now prefers a selected editable hit box, so readonly overlapping boxes no longer block moving the editable box.
- Changed files:
  - `frontend/src/shared/components/BBoxOverlay.vue`
  - `frontend/src/test/bboxOverlay.test.ts`
- Verification in frontend agent:
  - `npm run test -- bboxOverlay.test.ts routesAndPages.test.ts` -> passed (`2 passed`, `83 passed`)
  - `VITE_API_BASE_URL=/api npm run build` -> passed
- Main verification:
  - `npm run test -- bboxOverlay.test.ts routesAndPages.test.ts` -> passed (`2 passed`, `83 passed`)
  - `VITE_API_BASE_URL=/api npm run build` -> passed
  - `git diff --check` -> passed
  - `docker compose build frontend` -> passed
- Deployment note: recreate the frontend container for the restored bbox move interaction to appear in Docker.

## 2026-05-21 Release 0.0.1 Preparation
- Prepared backend/frontend package metadata for `0.0.1`.
- Added root `CHANGELOG.md` entry for `v0.0.1`.
- Refreshed `uv.lock` with `uv lock`.
- Refreshed frontend lockfile with `npm install --package-lock-only` under Node 20.
- Pre-release tag check: no existing `v0.0.1` or `0.0.1` tag.
- Verification:
  - `uv run pytest` -> passed (`87 passed`)
  - `npm run test` -> passed (`6 passed`, `113 passed`)
  - `VITE_API_BASE_URL=/api npm run build` -> passed
  - `docker compose config` -> passed
  - `git diff --check` -> passed
  - `docker compose build frontend backend` -> passed
- Known release note: frontend dependency audit still reports 5 moderate findings; not remediated in this release because npm recommends `npm audit fix --force`, which may introduce breaking dependency changes.
- Release commit is prepared for annotated `v0.0.1` tag creation.

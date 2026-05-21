# Docker LAN Deployment Findings

## Repository State

- Main branch: `main`.
- Existing worktrees:
  - Backend: `../data_platform_backend_agent` on `agent/backend-implementation`.
  - Frontend: `../data_platform_frontend_agent` on `agent/frontend-implementation`.
  - Integration/testing: `../data_platform_integration_agent` on `agent/integration-testing`.
- All workspaces have existing dirty changes from prior work. These are preserved.
- Local `AGENTS.md` requires main workspace to coordinate and verify, with frontend/backend implementation in agent worktrees.

## Backend Runtime Facts

- App entrypoint: `src/urban_violation_backend/app.py`.
- Service factory: `src/urban_violation_backend/service.py`.
- Current default dataset root is hardcoded as `/mnt/lc/LC/ares_xtws/0_train_data/data_platform/DATASET/urban_violation`.
- `LABEL_CONFIG_STORE_ROOT` and `PLATFORM_STATE_ROOT` are already supported.
- `PLATFORM_AUTH_MODE`, `PLATFORM_DEV_ANON`, and initial admin env vars are handled in `src/urban_violation_backend/auth.py`.
- Health route is `GET /health`; API routes are rooted under `/api/...`.

## Frontend Runtime Facts

- Frontend package root: `frontend/`.
- Build command: `npm run build`.
- Production API base is controlled by `VITE_API_BASE_URL`; default is `http://127.0.0.1:8000/api`.
- Vite dev server already proxies `/api` and `/media` to backend for development.

## Deployment Decisions

- Use two services: `backend` and `frontend`.
- Mount host dataset directory to `/data/datasets` and set `DATASET_ROOT=/data/datasets/urban_violation`.
- Mount writable runtime directories to `/data/platform_state` and `/data/label_config_state`.
- Publish `frontend` as `8080:80`; keep backend on the compose network only.
- Use Nginx as the public LAN entrypoint and reverse proxy.

## Agent Handoffs

- Frontend agent verified `VITE_API_BASE_URL=/api npm run build` in `../data_platform_frontend_agent`; no frontend source changes were required.
- Backend agent implemented `DATASET_ROOT` env fallback in `../data_platform_backend_agent`; focused env-root tests and full `uv run pytest` passed there.
- Backend worktree contained older unrelated backend edits, so main synchronization used only the isolated `DATASET_ROOT` resolution patch and its focused tests.

## Verification Notes

- Main workspace checks passed for backend tests, frontend production build, compose syntax, and whitespace.
- Docker image build was not completed because base image layers from Docker Hub were downloading too slowly in this environment. This is a verification gap, not an observed Dockerfile failure.

## Archive Upload Requirement

- Current deployment has `DATASET/` mounted readonly; browser directory selection only sends metadata and `source_uri`, it does not upload files.
- For deployed use, new batch creation should accept a compressed package such as `urban_violation_0520.zip` containing:
  - `urban_violation_0520/images/...`
  - `urban_violation_0520/stage1_run_0520/...`
  - `urban_violation_0520/stage2_run_0520/...`
- To avoid adding `python-multipart`, backend upload should use raw request body streaming plus query parameters, then safely extract into writable `PLATFORM_STATE_ROOT/import_uploads/...`.
- Extracted package roots are runtime state, not raw `DATASET/`; batch deletion should remove registry/runtime state only unless an explicit cleanup policy is added later.

## Archive Upload Integration Notes

- Backend agent added `POST /api/datasets/{dataset_id}/import-jobs/archive` with raw zip body streaming and query metadata.
- Uploads are staged under `PLATFORM_STATE_ROOT/import_uploads/{dataset_type}/{batch_key}/archives`.
- Safe extraction writes to `PLATFORM_STATE_ROOT/import_uploads/{dataset_type}/{batch_key}/source`.
- Archive selection supports either a top-level batch directory such as `urban_violation_0520/images/...` or a single extracted root that directly contains `images/` or stage run directories.
- Frontend now sends the selected `.zip` as the request body and no longer depends on browser directory upload for deployed batch creation.

## Upload Size Finding

- A browser error reading `Request Entity Too Large` during batch zip upload is produced by the Nginx `client_max_body_size` limit before the request reaches FastAPI.
- The initial deployment limit was 200 MB in both Nginx and backend defaults. Compose later raised backend archive limits to 2 GiB upload / 4 GiB extracted content, and Nginx to `2048m`.
- For frequent 3-5 GiB uploads, Nginx also needs request buffering disabled on `/api/`; otherwise large request bodies can be staged in Nginx container temp storage before proxying.
- The Docker deployment now sets Nginx `client_max_body_size 8192m`, disables `/api/` request buffering, and defaults backend archive limits to 8 GiB upload / 32 GiB extracted content.

## Upload Progress Finding

- Browser `fetch` does not expose upload progress events, so the frontend archive-upload path uses `XMLHttpRequest` only when an upload progress callback is supplied.
- The progress percentage represents browser-to-server upload. Backend extraction/import happens after upload completion, so the UI has a separate processing state after 100%.

## Sample Review Switching Finding

- `ReviewWorkbenchPage` already keeps `detail` mounted during same-dataset sample route changes, but the UI had no explicit switching state beyond a cursor change.
- `BBoxOverlay` binds `<img :src>` directly to the incoming image URL. When the sample detail changes, the browser may blank the image area while the new image loads, which reads as a full workbench refresh because the image panel dominates the page.
- The fix should preserve the old review shell during the route request, show a small switching banner, and buffer the image URL/boxes inside `BBoxOverlay` until the next image has loaded.

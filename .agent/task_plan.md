# Docker LAN Deployment Task Plan

Objective: add a docker compose LAN deployment path with an Nginx-served Vue frontend, FastAPI/Uvicorn backend, readonly `DATASET/` mount, writable runtime state mounts, and documented startup/verification steps.

## Phases

1. Inspect current backend/frontend runtime configuration, route paths, and existing worktree state.
   - Status: complete.
2. Coordinate backend worktree changes for production environment configuration.
   - Status: complete.
3. Add shared Docker deployment files in the lead workspace after agent worktree changes are reviewed.
   - Status: complete.
4. Add or update deployment documentation.
   - Status: complete.
5. Run targeted backend/frontend checks plus Docker build/smoke checks where possible.
   - Status: complete with Docker image build limitation documented.
6. Synchronize accepted worktree changes back to the main workspace and prepare handoff.
   - Status: complete.
7. Add deployment-mode batch archive upload flow for `urban_violation_0520`-style zip packages.
   - Status: complete.
8. Add upload progress feedback for large batch archive uploads.
   - Status: complete.
9. Optimize Sample Review sample switching so the workbench stays mounted and image transitions do not flash.
   - Status: complete.

## Constraints

- Main workspace is for orchestration, deployment/docs coordination, integration review, verification, and accepted-code synchronization.
- Backend product code changes must be made in `../data_platform_backend_agent` first.
- Frontend product code changes, if needed, must be made in `../data_platform_frontend_agent` first.
- Existing dirty changes in main and agent worktrees are presumed user or previously accepted work and must not be reverted.
- `DATASET/` must remain outside the image and mounted readonly.
- Runtime state must be writable outside the image.

## Acceptance Criteria

- Backend can read `DATASET_ROOT` from environment without breaking explicit `create_app(dataset_root=...)` tests.
- Compose defines `backend` and `frontend` services, publishing only frontend port `8080:80`.
- Nginx serves SPA static assets and proxies `/api/`, `/media/`, and `/health` to backend.
- Docker build uses `VITE_API_BASE_URL=/api` for the frontend.
- Documentation names required host directories, env vars, default credentials, and verification commands.
- Relevant tests/builds either pass or any blockers are documented with command output.
- Docker deployment batch creation accepts `.zip` packages through the frontend and persists extracted content under writable runtime state.
- Unsafe archive paths are rejected and do not write outside the import upload directory.
- Large batch archive upload shows progress during browser upload and an explicit processing state while backend extraction/import runs.
- Sample Review keeps the current sample visible while a route-level sample switch is loading.
- Sample Review shows a non-destructive switching indicator instead of replacing the whole page.
- The image overlay avoids blanking the preview while a new sample image URL is loading.

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| `docker compose build` did not complete after about ten minutes because external base image layers were downloading extremely slowly. | Ran full compose build after `docker compose config` passed. | Stopped the build process cleanly and documented the Docker build/smoke check as not completed in this environment. Local backend tests, frontend production build, compose config, and diff check passed. |
| One `routesAndPages.test.ts` run failed in the existing label-config conflict case, then passed on immediate rerun without code changes. | Ran `npm run test -- routesAndPages.test.ts bboxOverlay.test.ts` after adding bbox interaction lock during image buffering. | Re-ran the same command; `2 passed`, `80 passed`. Recorded as transient test flake because the failure was outside the changed Sample Review/BBoxOverlay assertions. |

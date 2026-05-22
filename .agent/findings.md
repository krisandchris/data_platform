# Findings

- Phase 7 starts from `integration/TASK-019` at `6557415`.
- Frontend Dockerfile already builds with `ARG VITE_API_BASE_URL=/api`.
- Nginx proxies `/api/`, `/media/`, and `/health` to backend.
- Frontend should not need to know whether backend state is file-backed or database-backed.
- Existing frontend tests covered absolute API bases such as `http://backend.test/api`, but did not directly protect relative same-origin `/api` URL joining for Docker production.

# TASK-019 Phase 7 Frontend Production Build

## Role

Frontend Agent

## Branch

`agent/TASK-019/frontend/docker-production-build`

## Worktree

`../_worktrees/data_platform/TASK-019-frontend-docker-production-build`

## Goal

Verify the Vue production build and frontend behavior remain compatible with Phase 7 Docker same-origin `/api` deployment and optional Redis/live-progress fields.

## Ownership

- Own: `frontend/**`, frontend tests, and `.agent/**`.
- Do not modify backend product code or Docker Compose unless you document a blocker and coordinate with Lead Agent.
- You are not alone in the codebase. Do not revert edits from other agents; keep changes scoped.

## Tasks

1. Run frontend tests.
2. Run production build with `VITE_API_BASE_URL=/api`.
3. Inspect frontend API config to confirm same-origin Docker deployment still works.
4. If needed, add or adjust frontend tests for Docker production API base assumptions; avoid broad UI rewrites.
5. Complete `.agent/handoff.md` with exact commands and results.

## Acceptance Criteria

- Frontend test suite passes.
- Production build passes with `/api`.
- No deployment-specific API path regression is introduced.

## Expected Checks

- `cd frontend && npm run test`
- `cd frontend && VITE_API_BASE_URL=/api npm run build`
- `git diff --check`

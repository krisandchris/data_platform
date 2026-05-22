# TASK-019 Phase 7 Integration Handoff

## Lead Scope

Integration branch: `integration/TASK-019`

Phase 7 switches the Docker rollout target to PostgreSQL + Redis defaults, verifies production build/runtime behavior, and preserves a documented file-backed rollback path.

## Planned Agent Branches

- `agent/TASK-019/backend/docker-rollout`
- `agent/TASK-019/qa/docker-rollout-smoke`
- `agent/TASK-019/frontend/docker-production-build`
- `agent/TASK-019/docs/docker-rollout-runbook`

## Integration Status

Dispatch is in progress. No Phase 7 agent branches have been merged yet.

## Initial Risks

- Backend image currently lacks Alembic files; database startup migration will fail until Dockerfile packaging is fixed or startup migration is disabled with an explicit operator migration path.
- Docker defaults must now change to PostgreSQL + Redis, but file-backed rollback must stay documented and testable.
- Large filesystem artifacts remain on mounted volumes; only metadata and durable mutable state move to PostgreSQL.
- Existing unrelated `.gitignore` user modification is not part of TASK-019 Phase 7.

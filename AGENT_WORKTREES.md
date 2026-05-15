# Agent Worktree Handoff

This repository uses separate Git worktrees for three implementation tracks.

## Worktrees

- `../data_platform_backend_agent` on branch `agent/backend-implementation`
- `../data_platform_frontend_agent` on branch `agent/frontend-implementation`
- `../data_platform_integration_agent` on branch `agent/integration-testing`

## Shared Inputs

- Product and architecture docs: `urban_violation_platform_markdown/`
- Planning files: `task_plan.md`, `findings.md`, `progress.md`
- Local dataset source: `/mnt/lc/LC/ares_xtws/0_train_data/data_platform/DATASET/urban_violation`

`DATASET/` is intentionally not tracked by Git. Agents should reference the shared absolute dataset path above or create small local fixtures in their own worktree when needed.

## Coordination Rules

- Backend owns canonical API/Pydantic/OpenAPI contracts.
- Frontend consumes the backend contract and must not invent incompatible response shapes.
- Integration testing owns fixture selection, contract validation, and end-to-end acceptance checks.
- Cross-agent contract changes should be reflected in `task_plan.md` or a dedicated contract document before implementation diverges.

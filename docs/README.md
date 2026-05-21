# Project Documentation Index

Last updated: 2026-05-20

This directory is the current documentation entry point for the Urban Violation Platform. Frontend and backend documentation are split into small topic files under their own directories. Historical design notes have been folded into these current documents or remain available through git history.

## Current Documentation

- Frontend index: `docs/frontend/README.md`
- Frontend page documents: `docs/frontend/pages/`
- Frontend shared shell/API documents: `docs/frontend/*.md`
- Backend index: `docs/backend/README.md`
- Backend API module documents: `docs/backend/modules/`
- Overall architecture: `docs/architecture/README.md`
- Docker LAN deployment: `docs/architecture/deployment.md`

## Historical Inputs

The original product input folder has been removed from the working tree. Its durable conclusions are consolidated into the current architecture documents, and the detailed source material remains available through git history when needed.

## Consolidated Topics

- Dataset type, batch, import, asset, preannotation, and QC lifecycle rules are consolidated in `docs/architecture/README.md`.
- Frontend page hierarchy, shell behavior, page layouts, page fields, interactions, exception states, API bindings, permission boundaries, and independent login design are split under `docs/frontend/`.
- Backend module-level API design, endpoint request/response schemas, permission boundaries, workflow notes, runtime state, and validation commands are split under `docs/backend/modules/`.
- Detailed historical design notes are no longer retained as separate files under `docs/`.

## Working State Files

- Current task plan: `task_plan.md`
- Current progress: `progress.md`
- Durable findings: `findings.md`

These three files are intentionally compact. Use git history for detailed phase-by-phase logs.

## Agent And Runtime Documents

- Main workspace rules: `AGENTS.md`
- Main accepted-code stack: `scripts/dev-stack.sh`
- Agent worktree stack: `scripts/agent-dev-stack.sh`
- Integration smoke runner: `scripts/integration-smoke.sh`
- Live API smoke contract: `scripts/integration-api-smoke.py`
- Historical remaining-task backlog: `REMAINING_TASKS.md`

## Integration Smoke

Run the accepted main workspace stack:

```bash
scripts/integration-smoke.sh main
```

Run the frontend/backend agent worktrees together:

```bash
scripts/integration-smoke.sh agent
```

The smoke runner starts a fresh runtime state, verifies the closed-loop API contract, captures headless browser screenshots for `模型评估`, `版本历史`, and `导出管理`, then stops services and checks project ports.

## Documentation Maintenance Rules

- Keep product architecture in `docs/`, not in `AGENTS.md`.
- Keep `AGENTS.md` limited to development and assistant working rules.
- Keep durable product documentation under the current `docs/frontend/`, `docs/backend/`, and `docs/architecture/` structure.
- Avoid recreating large monolithic frontend/backend README files; use small page/module documents and keep each README as an index.
- If a temporary design artifact is needed, place it outside `docs/` or merge the durable outcome into the appropriate split document.

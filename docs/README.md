# Project Documentation Index

Last updated: 2026-05-19

This directory is the current documentation entry point for the Urban Violation Platform. It intentionally keeps only the current frontend, backend, and overall architecture documents. Historical design notes have been folded into these entry documents or remain available through git history.

## Current Architecture

- Frontend: `docs/frontend/README.md`
- Backend: `docs/backend/README.md`
- Overall architecture: `docs/architecture/README.md`

## Historical Inputs

The original product input folder has been removed from the working tree. Its durable conclusions are consolidated into the current architecture documents, and the detailed source material remains available through git history when needed.

## Consolidated Topics

- Dataset type, batch, import, asset, preannotation, and QC lifecycle rules are consolidated in `docs/architecture/README.md`.
- Frontend route hierarchy, shell behavior, review-workbench protection, and active frontend backlog are consolidated in `docs/frontend/README.md`.
- Backend import, runtime state, label config, QC workflow, RBAC, and API boundaries are consolidated in `docs/backend/README.md`.
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
- Keep this directory limited to the four current entry documents unless the user explicitly asks for a new doc.
- If a temporary design artifact is needed, place it outside `docs/` or merge the durable outcome into one of the retained entry documents.

# AGENTS.md

## Project Coordination Constraint

- The main project workspace is for orchestration, planning, integration review, verification, and accepted-code synchronization only.
- Do not implement product frontend or backend development tasks directly in the main workspace.
- Frontend development tasks must be assigned to the frontend agent worktree, and backend development tasks must be assigned to the backend agent worktree.
- After frontend/backend agents finish their work, the main workspace must perform human review and verification first. Only verified changes may be synchronized back into the main workspace through git-based integration such as merge, cherry-pick, or patch application from the agent worktree.
- The main workspace may maintain project-level planning files, coordination documentation, verification scripts, and stack-control scripts such as `scripts/dev-stack.sh` and `scripts/agent-dev-stack.sh`.

## Agent Worktree Stack

- Use `scripts/agent-dev-stack.sh` from the main workspace when the code under the frontend/backend agent worktrees needs to be started together for review.
- By default the script starts:
  - Backend code from `../data_platform_backend_agent`
  - Frontend code from `../data_platform_frontend_agent`
- Override `BACKEND_WORKTREE` and `FRONTEND_WORKTREE` if a different agent workspace should be reviewed.

# TASK-019 QA Test Matrix Plan

## Role / Branch / Worktree
- Role: QA Agent
- Branch: `agent/TASK-019/qa/test-matrix`
- Worktree: `/mnt/lc/LC/ares_xtws/0_train_data/_worktrees/data_platform/TASK-019-qa-test-matrix`

## Scope (Phase 0/1)
1. Add reusable file-backed store contract tests for `PlatformStateStore`.
2. Add label config repository contract tests for `FileBackedLabelConfigRepository`.
3. Run baseline commands and record outcomes:
   - `uv run pytest`
   - `npm run test` (frontend)
   - `VITE_API_BASE_URL=/api npm run build` (frontend)
   - `uv run python scripts/docker-compose-auto-subnet.py config`
4. Update `.agent/findings.md`, `.agent/progress.md`, `.agent/handoff.md`.

## Guardrails
- Only modify `tests/` and `.agent/*`.
- No dependency changes.
- No backend/frontend product code changes.
- Record failures as findings; only fix test harness issues.

## Status
- [x] Add state store contract tests.
- [x] Add label config repository contract tests.
- [x] Run focused pytest + flakiness loop (5 reruns).
- [x] Run baseline commands.
- [x] Update `.agent/*` records and handoff.

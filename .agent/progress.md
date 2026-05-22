# TASK-022 Progress

## 2026-05-22

- Created frontend worktree from current `main`.
- Replaced review page loading/empty/fallback errors with Chinese text.
- Localized review workbench topbar, navigation, evidence panel, relation panel, candidate panel, lease/status text, and submit modal labels.
- Added display-only label helpers for label-config backed options, preserving raw saved values.
- Kept `violation_category` display raw per user request.
- Updated regression tests for localized QC text and option labels.

## Verification

- `cd frontend && npm ci`: passed.
- `cd frontend && npm run test -- src/test/routesAndPages.test.ts`: passed.
- `cd frontend && npm run build`: passed.
- `cd frontend && npm run test`: passed.
- `git diff --check`: passed.

# TASK-030 Backend Offline Prune

Objective: physically trim backend API/tests/dependencies to the offline single-user validation and QC workbench.

## Scope

- Keep import archive/scan/validate/confirm/retry.
- Keep QC queue, assignment, lease, review, label suggestions, drafts, autosave, validate, submit, confirm/return.
- Keep file-state persistence and label config loading.
- Remove DB/Redis/Docker/migration tests and backend DB/Redis runtime dependencies.

## Status

- Routes pruned: complete.
- Tests pruned and rewritten: complete.
- DB/Redis runtime dependency removal: complete.
- Verification: complete.

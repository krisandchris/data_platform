# TASK-022 QC Chinese Localization

Objective: Chinese-localize the sample review / QC page while keeping `violation_category` values unchanged.

## Agent Role

Frontend Agent

## Branch

`agent/TASK-022/frontend/qc-zh-localization`

## Worktree

`../_worktrees/data_platform/qc-zh-localization`

## Assigned Scope

- `frontend/src/features/review-workbench/**`
- Frontend tests that cover review workbench UI text and label-config display.

## Out of Scope

- Backend API contracts.
- Label-config schema changes.
- `violation_category` value localization.
- Unrelated visual redesign.

## Steps

1. Inspect review workbench text and option rendering helpers.
   - Status: complete.
2. Implement display-only label-config option localization for non-`violation_category` fields.
   - Status: complete.
3. Replace hard-coded English operator text in the QC/review page with Chinese.
   - Status: complete.
4. Update focused tests.
   - Status: complete.
5. Run frontend tests, build, and diff checks.
   - Status: complete.

## Acceptance Criteria

- `violation_category` remains displayed as raw code/value.
- Other label-config options prefer Chinese labels when available while keeping stored values unchanged.
- Main QC operator workflow text is Chinese.
- Existing sample navigation, draft editing, bbox editing, lease/read-only behavior, and submission logic are unchanged.

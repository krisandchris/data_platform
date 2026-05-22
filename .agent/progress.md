# TASK-021 Progress

## 2026-05-22 Frontend Implementation

- Added client-side 10-row pagination to `AssetTable.vue`.
- Added asset pagination range text and previous/next controls.
- Bounded long asset `sample_id` values in the sample column and exposed full values via `title`.
- Replaced QC queue card layout with horizontal row layout in `QcPage.vue`.
- Added client-side 10-row pagination to the QC filtered queue.
- Preserved QC row links and readonly/editable styling behavior.
- Added frontend regression tests for asset pagination and QC queue pagination/layout.

## Verification

- `cd frontend && npm ci`: passed.
- `cd frontend && npm run test -- src/test/assetTable.test.ts src/test/routesAndPages.test.ts`: passed.
- `cd frontend && npm run test`: passed.
- `cd frontend && npm run build`: passed.
- `git diff --check`: passed.

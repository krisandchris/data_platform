# TASK-021 Sample And QC Pagination Plan

Objective: fix two frontend layout regressions:

- Asset sample preview must paginate samples at 10 rows per page and prevent long `sample_id` values from hiding right-side fields.
- QC workspace "我的批次" must paginate tasks at 10 rows per page and replace card layout with horizontal single-row entries that keep fields aligned and scannable.

## Branches

- Integration: `integration/TASK-021`
- Frontend: `agent/TASK-021/frontend/sample-qc-pagination` at `f1f0190`

## Steps

1. Inspect current asset and QC table/card rendering.
   - Status: complete.
2. Add asset table pagination and fixed long-ID column behavior.
   - Status: complete.
3. Replace QC queue cards with paginated horizontal rows.
   - Status: complete.
4. Add focused regression tests.
   - Status: complete.
5. Merge frontend branch into integration.
   - Status: complete.
6. Run integration verification and merge to main.
   - Status: complete.

## Acceptance Criteria

- Asset sample preview renders at most 10 rows per page.
- Asset sample preview exposes previous/next controls and range text.
- Long `sample_id` values stay bounded in the sample column and expose full text via `title`.
- QC "我的批次" renders as horizontal rows instead of cards.
- QC task rows render at most 10 items per page with previous/next controls and range text.
- Existing routes, review links, and QC editability behavior remain unchanged.

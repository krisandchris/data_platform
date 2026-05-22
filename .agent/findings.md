# TASK-021 Findings

## Frontend Findings

- `AssetTable.vue` rendered every filtered asset directly with no pagination.
- The asset sample link had no explicit layout containment, so long `sample_id` values could consume table width and squeeze fields on the right.
- `QcPage.vue` rendered filtered queue items as three-column cards. This made dense batch review harder to scan and had no pagination for larger assignments.
- The existing QC `canOpenEditable(item)` route/link logic is independent from the card markup and was preserved while changing presentation.
- No backend API contract changes were needed.

## Decisions

- Use 10 rows per page for both asset samples and QC queue items to match the import validation pagination pattern.
- Keep pagination client-side because both components already receive the full list from current frontend data flows.
- Use fixed/bounded sample columns and `title` attributes for full long IDs.
- Use a table-like grid for QC queue rows while keeping each row as a `RouterLink` to the sample review page.
- Keep very narrow viewport behavior scrollable rather than hiding operational fields.

## Integration Findings

- Frontend branch `agent/TASK-021/frontend/sample-qc-pagination` merged into integration with only `.agent` documentation conflicts.
- Product files merged without conflicts.
- Existing unrelated `.gitignore` user modification remains outside TASK-021.

## Risks

- Very narrow viewports may still need horizontal scrolling because both pages expose many operational fields. The desktop layout keeps columns bounded so long IDs do not hide right-side fields.

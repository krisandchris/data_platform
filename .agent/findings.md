# TASK-019 Phase 5 Frontend Findings

## Initial Context

- Browser upload progress already exists.
- Backend Phase 5 may add optional import processing progress fields.
- Lease readonly UI was recently stabilized and should not be broadly rewritten.

## Findings

- `frontend/src/shared/types/contract.ts` has `ImportJobSummary` and `ImportJobDetail` but no optional backend processing progress field yet.
- `frontend/src/services/urbanViolationApi.ts` normalizes import job detail/summary through `normalizeImportJob()`, so optional Redis progress can be added there without changing endpoint calls.
- `DatasetTypeBatchPanel.vue` already preserves browser upload progress through `onUploadProgress`; it switches to a generic processing phase after XHR upload reaches 100%.
- `ImportJobPage.vue` shows job state, metrics, validation rows, and mapping steps, but does not render backend processing progress when present.
- `ReviewWorkbenchPage.vue` gates editability on lease status/user, but does not currently treat an `active` lease with a past `expiresAt` as expired.

## Risks

- Optional backend progress must not become required by the frontend.
- Lease state expiry should render a stable readonly/conflict state without layout jitter.

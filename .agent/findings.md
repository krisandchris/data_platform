# TASK-019 Phase 4 Frontend Findings

## Initial Context

- Phase 4 is intended to preserve existing frontend API response shapes.
- Frontend work should focus on compatibility verification and stable review/QC rendering.

## Findings

- `frontend/src/services/urbanViolationApi.ts` already normalizes both snake_case backend database-mode fields and existing wrapper shapes for assignments, tasks, sample leases, drafts, submissions, sample pool items, export jobs, evaluation runs, delta samples, snapshots, and snapshot diffs.
- Review workbench compatibility hinges on unchanged response contracts: `ReviewWorkbenchPage.vue` hydrates `currentUser`, acquires a lease only when the current user owns the batch assignment, keeps release best-effort, and suppresses readonly lease warnings while a sample switch is refreshing.
- Existing Vitest coverage already protects sample switching and lease readonly indicators in `frontend/src/test/routesAndPages.test.ts`: the current review remains visible during route reuse, `aria-busy` is set while the next sample loads, and stale lease-release state does not show a readonly warning during the transition.
- Sample pool export and evaluation/version-history surfaces are already covered by API adapter and route/component tests for filters, export create/list/download/cancel, model evaluation comparison, delta samples, snapshot list/diff, and rollback-disabled messaging.
- Added a focused API adapter regression test for database-mode review payloads carrying `current_user`, `batch_assignment`, `qc_task`, `sample_lease`, `my_draft`, and `latest_submission`; this protects the readonly/lease gate data path without changing frontend contracts.

## Risks

- Lease readonly indicators and sample switching were recently optimized; avoid broad UI rewrites.
- Backend database mode may surface ordering differences; frontend should tolerate stable contract-equivalent ordering or backend should preserve ordering.
- `ModelEvaluationPanel.vue` and `VersionHistoryPanel.vue` sort records by `completedAt`/`createdAt` before choosing comparison defaults. If database mode returns records with identical or missing timestamps, the UI remains render-safe but the default comparison pair may depend on backend ordering.

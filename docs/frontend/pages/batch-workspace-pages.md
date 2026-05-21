# Batch Workspace Pages

Last updated: 2026-05-20

Batch pages use concrete batch ids such as `urban_violation__0508_fixture`.

## 批次概览

Route: `/datasets/:id/overview`

Component: `DatasetOverviewPage.vue`

Layout:

```text
+------------------------------------------------------------------+
| Header: batch name + primary actions                               |
+------------------------------------------------------------------+
| Context strip: type, lifecycle, active config, import job           |
+------------------------------------------------------------------+
| Metric cards: raw images, STEP1, STEP2, failures, coverage          |
+------------------------------------------------------------------+
| Lifecycle track                  | Asset/import/QC status           |
+------------------------------------------------------------------+
| Preannotation runs               | Latest import warnings           |
+------------------------------------------------------------------+
| Distributions and metadata                                         |
+------------------------------------------------------------------+
```

Fields:

- Batch identity and lifecycle.
- Active label config.
- Active/latest import job.
- Asset, STEP1, STEP2, failure, QC totals.
- Category/confidence/sample distributions.

Interactions:

- Open type config if missing.
- Open latest import job.
- Open assets.
- Generate QC queue.
- Enter QC queue.
- Delete batch with admin permission and second confirmation.

States:

- Loading dashboard.
- Backend error.
- Missing active config.
- Queue generation pending/success/error.
- Delete pending/success/error.

API:

- `GET /api/datasets/{batch_id}/summary`
- `POST /api/datasets/{batch_id}/qc/generate`
- `DELETE /api/datasets/{batch_id}`

## 资产样本

Route: `/datasets/:id/assets`

Component: `DatasetAssetsPage.vue`

Fields:

- Asset summary counters.
- Asset row: sample id, image URLs, media status, STEP1/STEP2 status, model judgement, categories, confidence, QC status, label edit status.
- Filters: judgement, STEP1, STEP2, QC, category, sample category, media, label edit, confidence range, search.

Interactions:

- Filter and reset assets.
- Thumbnail fallback.
- Open sample review.

API:

- `GET /api/datasets/{batch_id}/assets`
- `GET /api/datasets/{batch_id}/assets/summary`
- `GET /api/datasets/{batch_id}/summary`

## 导入校验

Route: `/datasets/:id/import-jobs/:jobId`

Component: `ImportJobPage.vue`

Fields:

- Import job identity, source mode, source URI, source structure.
- Job state and active step.
- Validation rows and validation report.
- Mapping steps.

Interactions:

- Scan.
- Validate.
- Retry failed job.
- Confirm import when no blocking issue remains.
- Navigate to overview/assets/QC.

API:

- `GET /api/datasets/{batch_id}/import-jobs/{job_id}`
- `POST /api/datasets/{batch_id}/import-jobs/{job_id}/scan`
- `POST /api/datasets/{batch_id}/import-jobs/{job_id}/validate`
- `POST /api/datasets/{batch_id}/import-jobs/{job_id}/confirm`
- `POST /api/datasets/{batch_id}/import-jobs/{job_id}/retry`

## 预标注结果

Route: `/datasets/:id/preannotations`

Component: `PreannotationsPage.vue`

Fields:

- STEP1 succeeded/failed/bbox-valid counters.
- STEP2 parsed/failure/candidate counters.
- Verification distribution.
- Category distribution.
- Contract fields: relation bbox, fact verifications, candidates, stage2 failure.

Interactions:

- Read-only inspection.
- Reload on batch route change.

API:

- `GET /api/datasets/{batch_id}/summary`

## 质检队列

Route: `/datasets/:id/qc`

Component: `QcPage.vue`

Fields:

- Assignment, queue, tasks, leases, progress.
- Assignable users.
- Queue item: sample id, category, status, assignee, lease, label config version, latest submission.

Interactions:

- Assign/reassign/release batch.
- Filter by task tab.
- Open sample review.
- Confirm or return submitted label edits.

API:

- `GET /api/datasets/{batch_id}/qc`
- `GET /api/datasets/{batch_id}/qc/assignable-users`
- `POST /api/datasets/{batch_id}/qc/assignment`
- `POST /api/datasets/{batch_id}/qc/assignment/reassign`
- `POST /api/datasets/{batch_id}/qc/assignment/release`
- `GET /api/datasets/{batch_id}/qc/tasks`
- `POST /api/datasets/{batch_id}/samples/{sample_id}/label-edits/{submission_id}/confirm`
- `POST /api/datasets/{batch_id}/samples/{sample_id}/label-edits/{submission_id}/return`

Boundary:

- Login required for all batch pages.
- Assignment requires `batch_assignment:manage`.
- Submission confirmation requires `label_edit:confirm`.

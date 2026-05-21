# Import Jobs API

Last updated: 2026-05-20

Purpose: register and validate manually uploaded batch source data.

| Method | Path | Request schema | Response schema | Permission |
| --- | --- | --- | --- | --- |
| `GET` | `/api/datasets/{dataset_id}/import-jobs` | none | `list[ImportJobStatusResponse]` | `dataset:read` |
| `POST` | `/api/datasets/{dataset_id}/import-jobs` | `ImportJobCreateRequest` | `ImportJobStatusResponse` | `import_job:manage` |
| `GET` | `/api/datasets/{dataset_id}/import-jobs/{job_id}` | none | `ImportJobStatusResponse` | `dataset:read` |
| `POST` | `/api/datasets/{dataset_id}/import-jobs/{job_id}/scan` | none | `ImportJobStatusResponse` | `import_job:manage` |
| `POST` | `/api/datasets/{dataset_id}/import-jobs/{job_id}/validate` | none | `ImportJobStatusResponse` | `import_job:manage` |
| `POST` | `/api/datasets/{dataset_id}/import-jobs/{job_id}/confirm` | none | `ImportJobStatusResponse` | `import_job:manage` |
| `POST` | `/api/datasets/{dataset_id}/import-jobs/{job_id}/retry` | none | `ImportJobStatusResponse` | `import_job:manage` |

Supported source structures:

- Images-only directory.
- Directory containing images plus STEP1 and STEP2 outputs.

Import rules:

- Discover `stage1_run_*` and `stage2_run_*`.
- Do not hardcode one run name.
- Treat STEP1 retry/failure history rows deterministically and keep final successful entries.
- Count parsed/failure output files separately from records/requests/responses/meta/support folders.
- STEP2 parsed successes and STEP2 failures are separate lifecycle inputs.

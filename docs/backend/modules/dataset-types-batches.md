# Dataset Types And Batches API

Last updated: 2026-05-20

Purpose: manage dataset types, concrete batch registry, batch summaries, and batch deletion.

| Method | Path | Request schema | Response schema | Permission |
| --- | --- | --- | --- | --- |
| `GET` | `/api/datasets` | none | `list[DatasetSummaryResponse]` | `dataset:read` |
| `DELETE` | `/api/datasets/{dataset_id}` | none | `DatasetDeleteResponse` | `dataset_batch:delete` |
| `GET` | `/api/dataset-types` | none | `list[DatasetTypeResponse]` | `dataset:read` |
| `GET` | `/api/dataset-types/{dataset_type}` | none | `DatasetTypeResponse` | `dataset:read` |
| `POST` | `/api/dataset-types` | `DatasetTypeCreateRequest` | `DatasetTypeResponse` | `dataset_type:create` |
| `GET` | `/api/datasets/{dataset_id}/summary` | none | `DatasetSummaryResponse` | `dataset:read` |

Design notes:

- Dataset type response includes type identity, active label config summary, and batches.
- Concrete batch summary powers overview, preannotation, and lifecycle UI.
- Batch deletion removes runtime registration/state for the batch; it must not delete raw source files.
- Future dataset types such as `ares_detection` follow the same type/batch boundary as `urban_violation`.

# QC Closed Loop API

Last updated: 2026-05-20

Purpose: derive modification behavior, attribution, snapshots, evaluation comparison, and correction sample pool from before/after QC data.

## Progress And Modification Events

| Method | Path | Query | Response schema | Permission |
| --- | --- | --- | --- | --- |
| `GET` | `/api/datasets/{dataset_id}/qc/progress` | none | `QcProgressResponse` | `qc_progress:read` or own boundary |
| `GET` | `/api/datasets/{dataset_id}/qc/modification-events` | optional filters | `list[ModificationEventResponse]` | `qc_progress:read` |
| `GET` | `/api/datasets/{dataset_id}/qc/modification-events/stats` | optional filters | `ModificationEventStatsResponse` | `qc_progress:read` |
| `GET` | `/api/datasets/{dataset_id}/qc/annotation-snapshots` | none | `list[AnnotationSnapshotResponse]` | `qc_progress:read` |

## Evaluation And Snapshots

| Method | Path | Request/query | Response schema | Permission |
| --- | --- | --- | --- | --- |
| `POST` | `/api/datasets/{dataset_id}/evaluations` | `EvaluationRunCreateRequest` | `EvaluationRunResponse` | `qc_progress:read` or evaluation owner boundary |
| `GET` | `/api/datasets/{dataset_id}/evaluations` | none | `list[EvaluationRunResponse]` | `qc_progress:read` |
| `GET` | `/api/datasets/{dataset_id}/evaluations/{evaluation_id}` | none | `EvaluationRunResponse` | `qc_progress:read` |
| `GET` | `/api/evaluations/compare` | `left_id`, `right_id` | `EvaluationCompareResponse` | `qc_progress:read` |
| `GET` | `/api/evaluations/{evaluation_id}/delta-samples` | none | `EvaluationDeltaSamplesResponse` | `qc_progress:read` |
| `GET` | `/api/datasets/{dataset_id}/snapshots` | none | `list[AnnotationSnapshotResponse]` | `qc_progress:read` |
| `GET` | `/api/datasets/{dataset_id}/snapshots/diff` | `left_snapshot_id`, `right_snapshot_id` | `SnapshotDiffResponse` | `qc_progress:read` |
| `POST` | `/api/datasets/{dataset_id}/snapshots/{snapshot_id}/rollback` | none | `SnapshotRollbackResponse` | restricted; currently guarded |

## Correction Sample Pool

| Method | Path | Request/query | Response schema | Permission |
| --- | --- | --- | --- | --- |
| `GET` | `/api/sample-pool` | filters | `SamplePoolListResponse` | `dataset:read` |
| `GET` | `/api/sample-pool/stats` | filters | `SamplePoolStatsResponse` | `dataset:read` |
| `GET` | `/api/sample-pool/items/{item_id}` | none | `SamplePoolItemDetailResponse` | `dataset:read` |
| `POST` | `/api/sample-pool/items` | `SamplePoolItemUpsertRequest` | `SamplePoolItemResponse` | write boundary |
| `DELETE` | `/api/sample-pool/items/{item_id}` | none | `SamplePoolItemResponse` | write boundary |

Design notes:

- Modification behavior and attribution are derived from differences between pre-QC and post-QC label snapshots.
- Frontend event capture is not the source of truth for attribution.
- Correction sample pool items link back to dataset type, batch, sample, event type, attribution, and review evidence.

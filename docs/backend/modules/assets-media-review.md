# Assets, Media, Review Detail API

Last updated: 2026-05-20

Purpose: expose batch assets, summaries, browser-safe media URLs, and sample review detail.

## Asset And Review Endpoints

| Method | Path | Request/query | Response schema | Permission |
| --- | --- | --- | --- | --- |
| `GET` | `/api/datasets/{dataset_id}/assets` | filters | `AssetListResponse` | `dataset:read` |
| `GET` | `/api/datasets/{dataset_id}/assets/summary` | none | `AssetSummaryResponse` | `dataset:read` |
| `GET` | `/api/datasets/{dataset_id}/assets/{sample_id}` | none | `AssetDetailResponse` | `dataset:read` |
| `GET` | `/api/datasets/{dataset_id}/samples/{sample_id}/review` | none | `AssetDetailResponse` | `dataset:read` |
| `GET` | `/api/datasets/{dataset_id}/search` | `q` | `SearchResponse` | `dataset:read` |

## Media Endpoints

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/media/images/{file_name}` | file response |
| `GET` | `/api/datasets/{dataset_id}/media/images/{file_name}` | file response |
| `GET` | `/media/visualizations/{file_name}` | file response |
| `GET` | `/api/datasets/{dataset_id}/media/visualizations/{file_name}` | file response |

Asset filters:

- `judge_decision`
- `stage1_status`
- `failure_status`
- `qc_status`
- `category`
- `sample_category`
- `confidence_min`
- `confidence_max`
- `media_status`
- `label_edit_status`
- `search`

Design notes:

- Review detail returns asset identity, image URL, STEP1 relation evidence, STEP2 verification/candidates, label config context, QC task, assignment, lease state, draft, and submissions.
- Media endpoints must resolve only allowed runtime media files.

## TASK-019 Phase 4 Persistence Notes

Backend-confirmation-dependent: after the backend `qc-state` branch lands, review detail should continue to expose the same response shape while assignment, task, lease, draft, and submission state are loaded from PostgreSQL in database mode.

Persistence boundaries:

- `image_url` and visualization URLs remain backend media routes over filesystem files.
- Raw source images, STEP outputs, visualization files, and other media bytes are not stored in PostgreSQL.
- Review detail may include database-backed QC/review metadata in Phase 4, but filesystem media resolution remains unchanged.
- Redis is not required for review detail in Phase 4.

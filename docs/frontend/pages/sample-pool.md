# Sample Pool Page

Last updated: 2026-05-20

Route: `/sample-pool`

Component: `SamplePoolPage.vue`

## Purpose

The sample pool is the global correction-sample workspace for QC closed-loop analysis and training/export preparation.

## Layout

```text
+------------------------------------------------------------------+
| Header: 修正样本池                                                 |
+------------------------------------------------------------------+
| Stats and filters                                                  |
+------------------------------------------------------------------+
| Sample pool table/cards                                            |
+------------------------------------------------------------------+
| Export controls                                                    |
+------------------------------------------------------------------+
```

## Fields

- Item id.
- Dataset type.
- Batch id.
- Sample id.
- Category.
- Attribution.
- Event type.
- Reviewer.
- Status.
- Export jobs.

## Interactions

- Filter by dataset type, batch, category, attribution, event type, reviewer, status, search.
- Open related review sample.
- Create, list, cancel, and download exports.

## States

- Loading pool/stats/export jobs.
- Backend error.
- Empty result.
- Export pending/ready/failed/cancelled.

## API

- `GET /api/sample-pool`
- `GET /api/sample-pool/stats`
- `GET /api/sample-pool/items/{item_id}`
- `POST /api/exports`
- `GET /api/exports`
- `GET /api/exports/{export_id}`
- `GET /api/exports/{export_id}/download`
- `POST /api/exports/{export_id}/cancel`

## Permission Boundary

- Login required.
- Backend enforces sample-pool and export permissions.

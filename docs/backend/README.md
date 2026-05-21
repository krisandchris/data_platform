# Backend Documentation

Last updated: 2026-05-20

This directory documents the FastAPI backend by API module. The README is only an index; endpoint details and workflow notes live in `modules/`.

## Source Entry Points

- App factory: `src/urban_violation_backend/app.py`
- Routes: `src/urban_violation_backend/routes.py`
- API schemas: `src/urban_violation_backend/api_schemas.py`
- Workflow service: `src/urban_violation_backend/service.py`
- Runtime state: `src/urban_violation_backend/state_store.py`
- Label config: `src/urban_violation_backend/labels.py`
- Auth and sessions: `src/urban_violation_backend/auth.py`
- Permissions: `src/urban_violation_backend/permissions.py`
- Import parser: `src/urban_violation_backend/importer/`

## Module Documents

- [Runtime And Validation](./modules/runtime-and-validation.md)
- [Auth And Session](./modules/auth-session.md)
- [Users, RBAC, Audit](./modules/users-rbac-audit.md)
- [Dataset Types And Batches](./modules/dataset-types-batches.md)
- [Label Config](./modules/label-config.md)
- [Import Jobs](./modules/import-jobs.md)
- [Assets, Media, Review Detail](./modules/assets-media-review.md)
- [QC Workflow](./modules/qc-workflow.md)
- [Label Edits](./modules/label-edits.md)
- [QC Closed Loop](./modules/qc-closed-loop.md)
- [Export And Search](./modules/export-search.md)

## Global API Rules

- Product APIs live under `/api` except `/health` and media compatibility routes.
- `dataset_type` is the schema and label config boundary.
- `dataset_id` in batch APIs means a concrete batch id, for example `urban_violation__0508_fixture`.
- Raw `DATASET/` files remain readonly.
- Browser image access must use backend media URLs.
- Bbox values are integer 0-1000 quantized coordinates.
- Label edits are patch/draft/submission based; imported STEP1/STEP2 payloads are not overwritten.

# Findings - Urban Violation Platform

This file records research findings from `urban_violation_platform_markdown/` and `DATASET/`.

## Documentation Findings

- `urban_violation_platform_markdown/README.md` states the documentation set contains three markdown documents and UI mockup images: `frontend_uiux.md`, `frontend_architecture.md`, `backend_architecture.md`, and `images/`.
- `frontend_uiux.md` defines five UI surfaces:
  - Dataset overview dashboard.
  - Dataset registration/upload wizard.
  - Import task and sample alignment validation.
  - Sample asset list/browse view.
  - QC review workbench.
- `frontend_architecture.md` proposes a Vue-style feature structure under `frontend/src/` with `app/`, `services/`, `features/`, and `shared/`, and feature modules for `datasets`, `import`, `review-workbench`, `qc`, and `exports`.
- `frontend_architecture.md` route candidates: `/datasets`, `/datasets/:id/overview`, `/datasets/:id/assets`, `/datasets/:id/import-jobs/:jobId`, `/datasets/:id/preannotations`, `/datasets/:id/qc`, `/datasets/:id/samples/:sampleId/review`.
- `backend_architecture.md` proposes FastAPI + async SQLAlchemy, PostgreSQL, Redis, MinIO, Meilisearch, Milvus Lite, Celery + Redis.
- `backend_architecture.md` module boundaries: data import, annotation management, QC, search, export, permissions, analytics.
- `backend_architecture.md` import state machine: `Draft -> Uploading -> Uploaded -> Scanning -> Validating -> ValidationPassed -> PreviewReady -> Importing -> Imported -> QCQueueGenerated`, with failure paths `ValidationFailed -> Draft` and `Importing -> ImportFailed`.
- `backend_architecture.md` database entities listed: `RawAsset`, `PreAnnotationStep1`, `PreAnnotationStep2`, `HumanReview`, `AuditArtifact`.

## Dataset Findings

- Root dataset path inspected: `DATASET/urban_violation`.
- Top-level layout:
  - `images/`: 797 original `.jpg` files.
  - `stage1_run_0508/`: stage 1 model run outputs.
  - `stage2_run_0508/`: stage 2 model run outputs.
- File counts by major bucket:
  - `images`: 797 `.jpg`.
  - `stage1_run_0508`: 797 each for `requests`, `responses`, `parsed`, `records`, `visualizations`; 6 `meta` files.
  - `stage2_run_0508`: 797 `inputs`, 797 `requests`, 780 `responses`, 780 `parsed`, 780 `records`, 19 `failures`, 6 `meta` files.
  - Entire dataset sample contains 7151 `.json`, 2 `.jsonl`, 797 `.jpg`, and 797 `.png`.
- Both stage directories use two-character shard directories such as `49/000142_0_1762483003246.json`; this should be treated as an implementation detail derived from sample ID hashing/pathing, not as a user-facing concept.
- `meta/manifest.jsonl` is the most direct pairing index:
  - Stage1 lines include `id`, `request_path`, `response_path`, `parsed_path`, and `record_path`.
  - Stage2 lines include success entries with paths and failure entries with `status`, `input_path`, `request_path`, and `failure_path`.
- `meta/plan.json` is a 797-item array with `id`, `image_ref`, `prefix_key`, `is_warmup`, `group_size`, `already_done`, and `previous_failed`.
- Stage1 `summary.json`: 797 total jobs, 797 attempted, 797 succeeded, 0 failed, 797 with relation bbox, 797 with valid bbox coordinates, 797 visualized.
- Stage2 `summary.json`: 797 total jobs, 778 skipped existing success, 19 attempted, 2 succeeded, 17 failed in the rerun summary; on-disk aggregate has 780 successful parsed/records and 19 failure files.
- Stage1 parsed schema top-level keys: `environment_analysis`, `scene_elements`, `key_anchors`, `key_relations`.
- Stage1 relation objects include `subject`, `relation`, `object`, `description`, and `bbox` integer arrays in a 0-1000 quantized coordinate space.
- Stage1 record schema top-level keys: `id`, `images`, `messages`, `metadata`; metadata includes model cache stats, `response_source`, `judge_report`, `bbox_validation`, and `qc_integration`.
- Stage2 input schema top-level keys: `sample_id`, `image_path`, `stage1_output`.
- Stage2 parsed schema top-level keys: `sample_id`, `fact_verifications`, `candidates`.
- Stage2 fact verification objects include `relation_index`, `subject`, `relation`, `object`, `bbox`, `visibility_level`, visible attributes, observations, `verification_result`, and `verification_confidence`.
- Stage2 candidate objects include `violation_category`, `evidence_relation_indices`, `evidence_reasoning`, `relation_hint`, `segmentation_targets`, `confidence`, and `sample_category`.
- Stage2 failure files include `error_type` and `message`; example error: `ValueError` with invalid output reason `boundary_truncation but supported`.
- Observed stage2 category distribution across parsed outputs:
  - `no violation`: 387
  - `nonmotor_vehicle_illegal_parking`: 302
  - `goods_blocking_road`: 221
  - `road_occupying_vendor`: 20
  - `motor_vehicle_illegal_parking`: 13
- Observed stage2 sample category distribution: `positive samples` 859, `hard boundary samples` 56, `negative samples` 28. Counts exceed sample count because candidates are per candidate, not per image.
- Observed fact verification result distribution: `supported` 1709, `weakly_supported` 764, `unsupported` 2, `unclear` 1.
- Observed judge decisions:
  - Stage1 records: 592 `pass`, 205 `soft_fail`.
  - Stage2 records: 569 `pass`, 211 `soft_fail`.
- Original images and visualizations are 1280x720 for sampled assets; UI mockup PNGs are 1672x941.

## Cross-Agent Contract Notes

- Frontend and backend agents should converge first on route/API contracts for datasets, assets, import jobs, preannotations, QC queue, review submission, audit artifacts, search, and export jobs.
- Backend agent owns the data model and import pipeline contract; frontend agent owns UI workflows and typed client integration; integration testing agent owns fixture selection from `DATASET/urban_violation` and end-to-end acceptance.
- Minimal ingest contract should preserve source paths and pairing paths from `manifest.jsonl`; deriving records by glob alone risks mismatch because stage2 manifests include historical failed entries and rerun state.
- Frontend review tooling must handle both `pass` and `soft_fail`, show bbox overlays from stage1/stage2, and expose failure states for stage2 invalid outputs.
- Backend API should normalize file-system-specific paths into stable asset URLs and record IDs; absolute source image paths inside JSON records are not directly browser-safe.

## UI Findings

- The sample review route should be treated as a focused audit workspace rather than a normal management page.
- The previous review route stacked three header/chrome layers: global `AppShell` navigation/search, page-level `ReviewWorkbenchPage` title/actions, and the review-specific `ReviewWorkbenchShell` status/action topbar.
- For sample audit, the only necessary top chrome is the review-specific workbench topbar because it contains sample id, queue progress, stage judge state, draft state, and Prev/Next/List controls.
- Global navigation/search and page-level marketing/management titles reduce vertical evidence space and should be hidden on `/datasets/:id/samples/:sampleId/review`.
- Bbox overlays in the image evidence area should not show visible text labels because labels compete with image evidence and create clutter; keep label text as `aria-label` only.
- Minimal bbox styling is preferable for this QC workflow: thin outlines, transparent fill, restrained selected state, and a small resize handle preserve editability without covering visual evidence.
- Bbox rendering must treat stored bbox values as 0-1000 quantized coordinates. The preview stage uses the actual image resolution only to preserve aspect ratio; overlay placement converts quantized x/y values to percentages of the rendered image stage.
- Bbox visual semantics: default boxes should use pure 2px non-red lines; red is reserved for the selected active box, where the line should become thicker.

## Open Questions

- Whether the platform should import full raw request/response payloads or store them as audit artifacts only while exposing normalized parsed fields to the UI.
- Whether stage2 failure entries should enter QC queue by default or live in a separate import-failure remediation queue.
- Whether category labels should remain machine labels such as `nonmotor_vehicle_illegal_parking` or be mapped to Chinese display labels in backend dictionaries.
- The target frontend framework is implied by docs as Vue-style structure, but the actual codebase has not been created or inspected in this directory.

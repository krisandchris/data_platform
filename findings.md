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
- The sample review workbench should consume the full review-focus viewport on desktop: top status bar at the top, image/relation/candidate panels filling the middle, and vote note/review actions docked to the browser bottom.
- QC label editing should distinguish closed enum fields from open controlled tags. `violation_category`, `sample_category`, `relation`, `verification_result`, and `visibility_level` should be dictionary-backed closed fields, while `scene_elements` and `segmentation_targets` should allow custom human tags with suggestion assistance, normalization, deduplication, and audit history.
- Dataset label configuration should be uploaded and activated through the frontend dataset workflow. Backend package-level config files are acceptable only as fixtures/examples; the product source of truth is the dataset-bound uploaded config version.
- The test upload config for the current dataset lives at `DATASET/urban_violation/label_config.json`; it has 8 fields, with 6 `closed_enum` fields and 2 `open_tags` fields.
- Live integration confirmed the backend upload lifecycle API with the current dataset config: validate, save, activate, active config read, suggestions, and three negative validation cases passed. Browser E2E still needs a working Playwright or Chrome DevTools environment.
- If label config validation shows `Not Found` in the frontend, first verify that `http://127.0.0.1:8000/openapi.json` contains `/api/datasets/{dataset_id}/label-configs/validate`; a stale backend process on port 8000 can keep serving old routes even after the backend branch has been updated.
- STEP1/STEP2 field-level QC design now lives in `docs/qc_step_review_field_layout_design.md`.
- STEP1 editable fields should focus first on `key_relations[].subject/relation/object/description/bbox` and `scene_elements`; `environment_analysis` and `key_anchors` can be secondary editors.
- STEP2 `fact_verifications[]` should be edited together with the matching STEP1 relation inside the Relation review area; `relation_index` is an import compatibility key and should not be exposed as the primary UI editing target.
- STEP2 `candidates[]` should be edited in the Candidate/verdict area; `evidence_relation_indices` should render as readable Relation rows and save through stable relation references rather than naked numeric indices.
- STEP2 failure records (`error_type`, `message`) are readonly diagnostics, but the review UI should allow a human-created Candidate patch when model stage2 produced no candidate.
- The right review rail should be treated as two operational regions: upper `Relation 复核区` for relation/verification editing and lower `Candidate 与质检裁决` for candidate evidence, category, confidence, note, and decision.
- The two-zone review design preview now lives at `docs/qc_step_review_field_layout_preview.html`; it uses real sample `000142_0_1762483003246`, the current dark review-workbench style, image-stage bbox overlays, Relation editor, Candidate evidence rows, and global bottom decision actions.
- Corrected review layout requirement: `Relation 复核区` and `Candidate 与质检裁决` must each occupy exactly half of the right rail, each with its own scrollable content area; `vote note` and all review decision buttons must be a full-width bottom dock across the whole workbench.
- Browser verification for the preview used `google-chrome --headless=new` because Chrome DevTools MCP could not connect to the local Chrome profile.
- For annotator-only label editing, the bottom dock should not expose final QC actions such as pass/reject/manual refinement and should not require any explanation text. It should use only status chips plus `跳过样本`, `校验修改`, `保存草稿`, and `提交修改`.
- Label-edit audit should rely on structured patch diffs and field-level validation results, not a free-text `change_note`.
- The left side of `Relation 复核区` should be an index-only selector that displays only `R1/R2/R3`; status, triple text, verification result, bbox state, and relation explanations belong in the right-side Relation detail/editor or Candidate evidence area.
- `subject_visible`, `subject_match`, and `key_attributes_visible` should not be annotator-editable fields in this workbench. They should be shown as read-only model visibility reference below `bbox_observation / global_context_observation`.
- `Candidate 与质检裁决` should mirror the Relation panel structure: a left candidate index rail showing only `C1/C2/+`, and a right-side editor containing category, confidence, segmentation targets, reasoning, evidence relations, and hint fields.
- Bottom action `校验修改` is field-legality validation only: type, requiredness, enum membership, open-tag format, numeric range, bbox coordinate legality, and text constraints. It must not judge Relation truth, Candidate evidence sufficiency, cross-field business consistency, QC verdict, saving, submission, or queue state.
- Implementation contract for this round: backend owns `POST /api/datasets/{dataset_id}/samples/{sample_id}/label-edits/validate` and `POST /api/datasets/{dataset_id}/samples/{sample_id}/label-edits`; frontend consumes those endpoints for `校验修改`, `保存草稿`, and `提交修改`.
- Main integration confirmed the backend/frontend label-edit contract live: `validate` does not persist, `save_draft` hydrates `label_edit_state`, `submit_changes` persists `annotation_submitted`, and invalid confidence returns 422 with field-level validation details.
- When running frontend in Vite proxy mode with `VITE_API_BASE_URL=/api`, `/media` must also be proxied to the backend or review images fall through to the frontend HTML route.
- Local dev startup should keep frontend in Vite proxy mode by default: `VITE_API_BASE_URL=/api` and `VITE_API_PROXY_TARGET=$BACKEND_URL`. This avoids browser CORS issues and keeps review images loading through the same `/media` proxy path.
- Image evidence zoom should be implemented as a visual transform on the rendered image stage, not as bbox coordinate mutation. This keeps 0-1000 quantized bbox data stable while the image and overlay boxes scale together.
- Bbox color semantics after the latest review tweak: unreferenced Relation boxes use purple by default and turn red when selected. Ordinary referenced Relation boxes use a stable Relation-id-based pseudo-random color card that excludes purple, red, and black.
- Candidate editing semantics after the latest review tweak: `segmentation_targets` may be an empty array, and deleting an existing Candidate should be represented as a structured `delete_candidate` label-edit operation.

## Open Questions

- Whether the platform should import full raw request/response payloads or store them as audit artifacts only while exposing normalized parsed fields to the UI.
- Whether stage2 failure entries should enter QC queue by default or live in a separate import-failure remediation queue.
- Whether category labels should remain machine labels such as `nonmotor_vehicle_illegal_parking` or be mapped to Chinese display labels in backend dictionaries.
- The target frontend framework is implied by docs as Vue-style structure, but the actual codebase has not been created or inspected in this directory.

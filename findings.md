# Findings

Last compacted: 2026-05-19

This file keeps durable project facts, constraints, and open risks. Historical notes have been compressed out of the working version.

## Documentation Facts

- Current documentation entry points:
  - `docs/README.md`
  - `docs/frontend/README.md`
  - `docs/backend/README.md`
  - `docs/architecture/README.md`
- The original product input folder has been removed; durable conclusions are now consolidated into the current documentation entry points and git history preserves the deleted source material.

## Dataset Facts

- Primary fixture root: `DATASET/urban_violation`.
- Top-level fixture layout:
  - `images/`: 797 original `.jpg` files.
  - `stage1_run_0508/`: STEP1 outputs.
  - `stage2_run_0508/`: STEP2 outputs.
- On-disk aggregate counts:
  - 797 raw images.
  - 797 STEP1 parsed outputs.
  - 780 STEP2 successful parsed outputs.
  - 19 STEP2 failure artifacts.
- STEP1 parsed payloads include:
  - `environment_analysis`
  - `scene_elements`
  - `key_anchors`
  - `key_relations`
- STEP1 relation bbox values are integer arrays in a 0-1000 quantized coordinate space.
- STEP2 parsed payloads include:
  - `sample_id`
  - `fact_verifications`
  - `candidates`
- STEP2 candidates include category, evidence relation indices, evidence reasoning, relation hint, segmentation targets, confidence, and sample category.
- `stage2_run_*/parsed` and `stage2_run_*/failures` are separate sets. Do not subtract failure count from parsed success count.
- Some newer STEP2 payloads can omit fields such as `subject_visible` and `subject_match`; ingestion should tolerate compatible variants.
- The dataset uses shard folders such as `parsed/00/{sample_id}.json`; scanners must recurse.

## Dataset Management Facts

- Dataset type and dataset batch are distinct.
- Dataset type examples: `urban_violation`, future `ares_detection`.
- Dataset batch examples: `urban_violation__0508_fixture`, future date or scene batches.
- Dataset type owns shared field design and active label config.
- Dataset batch owns import execution, asset statistics, preannotation state, QC queue, assignment, leases, drafts, submissions, and progress.
- Asset browsing belongs under a batch, not as an unrelated top-level product module.
- Import jobs are part of dataset-batch creation or refresh.
- Batch QC queue generation is explicit and label-config gated.
- Registered batches must not fall back to fixture assets or fixture QC tasks.
- Runtime platform state should use `PLATFORM_STATE_ROOT`; raw `DATASET/` should not be treated as a writable application state directory.

## Label Config Facts

- Label config is uploaded and activated through the frontend workflow.
- Active config is dataset-type-scoped and inherited by all batches of that type.
- Batch detail pages may display inherited active version but should not activate config.
- Current test config: `DATASET/urban_violation/label_config.json`.
- Current config shape: `label_config_v1`, dataset type `urban_violation`, 8 fields, 6 closed enum fields, 2 open tag fields.
- Closed enum examples include category, relation, verification result, visibility level, and sample category.
- Open controlled tags include `scene_elements` and `segmentation_targets`.
- `scene_elements` and `segmentation_targets` must allow custom human entries, suggestion assistance, normalization, deduplication, and audit history.
- Current duplicate-version issue is caused by save, not reload: backend save creates a new `label-config-N` even when content hash is identical.
- Desired fix: idempotent save for identical content, or a distinct explicit "save as new version" flow.

## QC Review Facts

- The current main-directory review workbench is the accepted source of truth.
- Sample review route should hide global sidebar/topbar and show only review-related controls.
- Stored bbox values are 0-1000 quantized coordinates.
- Actual image resolution is used only to preserve aspect ratio of the rendered image stage.
- Bbox overlay placement must convert quantized coordinates to percentages of the rendered image stage.
- Bbox overlays must stay inside the image stage, not black side-fill areas.
- Bbox visible text labels are removed; accessibility labels may remain.
- Default bbox border is a simple 2px solid line.
- Selected state changes color but should not alter geometry unless explicitly requested.
- Red is reserved for explicitly selected boxes.
- Purple is reserved for unreferenced Relation boxes.
- Default referenced boxes must use a color palette excluding red, black, and purple.
- Selection red must be driven by image evidence interaction, not by default active Relation/Candidate state on page entry.
- Image evidence supports wheel zoom and middle-button panning for local detail inspection.
- Relation panel left rail shows only Relation indices such as `R1/R2/R3`.
- Candidate panel mirrors the Relation structure with a left candidate index rail.
- `subject_visible`, `subject_match`, and `key_attributes_visible` are read-only model visibility references, not human-editable fields in the current workbench.
- Bottom action `校验修改` performs field legality validation only.

## Label Edit Contract Facts

- The editable state must preserve readonly base sample data and write patch/draft data separately.
- `baseSample` remains readonly.
- `reviewDraft` is editable.
- The UI shows merged state for review.
- Saving should be patch-only.
- Validation must happen before final submission.
- Current operation scopes include `stage1`, `relation:R*`, `verification:R*`, and `candidate:C*`.
- A sample-level edit scope like `sample.scene_elements` is invalid in the current backend contract.
- Candidate deletion should be represented as structured `delete_candidate` label-edit operation.
- Empty `segmentation_targets` is allowed.

## Multi-User Facts

- Authentication uses internal custom platform accounts, not LDAP/SSO or gateway identity injection.
- Batch assignment is single-user per concrete dataset batch.
- One sample has only one active editor at a time.
- Drafts are user-owned by `dataset_id + sample_id + user_id`.
- Submissions are immutable history records.
- `submitted` means annotator submitted changes and still requires qc_lead secondary confirmation.
- `跳过样本` does not release or change batch assignment.
- Batch roles must be scoped to concrete batch ids such as `urban_violation__0508_fixture`, not the dataset type id `urban_violation`.
- Backend assignment APIs use action names such as `batch_assignment.assign`; tests should assert actual emitted actions.
- Users with only `audit:read_own` may list audit events only when `actor_user_id` is bound to themselves.
- Admin assignment accepts any active user as assignee, including `platform_admin`.

## Frontend Facts

- Framework: Vue 3, Vite, vue-router, lucide icons.
- Source root: `frontend/src`.
- Main routes:
  - `/login`
  - `/datasets`
  - `/datasets/:id/overview`
  - `/datasets/:id/assets`
  - `/import-jobs/:jobId`
  - `/preannotations`
  - `/qc`
  - `/samples/:sampleId/review`
  - `/account`
  - `/account/permissions`
  - `/account/audit`
- Legacy `/users` and `/audit` redirect into the account hierarchy.
- Sidebar should derive current batch links from the active route id and must not hardcode `urban_violation`.
- Sample review route remains chrome-free and protected.
- Vite proxy mode should proxy both `/api` and `/media`; otherwise review images can fall through to frontend HTML.
- API/client code should continue splitting dataset type id from dataset batch id.
- P1/P2 frontend architecture work remains in `docs/frontend/README.md`.

## Backend Facts

- Framework: FastAPI, Pydantic, `uv`.
- Source root: `src/urban_violation_backend`.
- Important modules:
  - `app.py`
  - `routes.py`
  - `service.py`
  - `api_schemas.py`
  - `schemas.py`
  - `labels.py`
  - `auth.py`
  - `permissions.py`
  - `state_store.py`
  - `importer/`
- Backend routes serve normalized media URLs; frontend must not consume raw absolute filesystem paths as image sources.
- Importer should discover `stage1_run_*` and `stage2_run_*`, not only fixed `0508` directories.
- Backend-readable `source_uri` can ingest manually registered batches; browser-selected local files alone are not trustworthy backend paths.
- `GET /api/datasets/{dataset_id}/samples/{sample_id}/review` is the current review-detail endpoint.
- `/api/datasets/{dataset_id}/samples/{sample_id}` is not the review-detail endpoint.

## Integration Facts

- Integration validation must test the actual frontend and backend products together.
- It is not enough for the integration agent to prepare scaffolding.
- Browser verification may use system Chrome/headless fallback when Chrome DevTools MCP or repo-local Playwright is unavailable.
- Service checks should use the current command conventions and stop all local services after verification.
- Local proxy quirks can affect localhost checks; direct port and process checks are required after stack shutdown.

## Agent Workflow Facts

- Frontend/backend product work should be done in agent worktrees.
- Main workspace should integrate only reviewed and accepted changes.
- Agent worktrees can lag behind main; compare before syncing and avoid copying stale shared contract files wholesale.
- `DATASET` in agent worktrees should be a symlink to the main readonly dataset rather than a copied 1.6G tree.
- Sync excludes must preserve worktree `.git` pointer files.

## Open Risks

- Label config duplicate-version behavior still needs an idempotency fix.
- Default runtime/config state paths should be audited so smoke runs do not write into raw `DATASET/`.
- Import validation persistence vs recalculation remains a product decision.
- STEP2 failure remediation may need its own queue instead of normal QC queue inclusion.
- Category/code dictionaries may need clearer Chinese label mapping while preserving machine-readable codes.

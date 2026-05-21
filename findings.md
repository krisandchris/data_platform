# Findings

## 2026-05-21 Autosave Persistence

- Root cause: frontend dirty batch draft payloads could be persisted by backend with `dirty=true` and `saved=false` even after a successful save/autosave.
- Secondary issue: frontend API client treated only nested `draft`/`batch_draft` fields as authoritative save result drafts, while backend returns `BatchDraftSummaryResponse` at the top level.
- Fix direction implemented: backend normalizes successful persisted entries to `dirty=false`, `saved=true`; frontend parses the top-level summary and canonicalizes fallback merged entries.

Last compacted: 2026-05-19

This file keeps durable project facts, constraints, and open risks. Historical notes have been compressed out of the working version.

## Documentation Facts

- Current documentation structure:
  - `docs/README.md`
  - `docs/frontend/README.md`
  - `docs/frontend/pages/`
  - `docs/backend/README.md`
  - `docs/backend/modules/`
  - `docs/architecture/README.md`
- Frontend docs are split by page hierarchy; backend docs are split by API module.
- The original product input folder has been removed; durable conclusions are now consolidated into the current documentation structure and git history preserves the deleted source material.

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
- Accepted baseline already made normal saves content-hash idempotent, but the next hardening phase must remove the normal UI path for explicit duplicate history creation.
- The target backend contract treats label-config upload as manual update: duplicate content reuses an existing entry, same `config.version` with changed content returns `409 label_config_version_conflict`, and bumped `config.version` with changed content creates exactly one new active history entry.
- `save_as_new_version` may remain accepted for backward compatibility, but it must not create duplicate same-hash history rows.
- Active reload remains read-only for version history and does not create label config versions.
- The frontend upload panel should expose one normal write action such as `上传并更新配置`, keep history read-only, and remove `另存为新版本` plus history-row `激活`.
- Current persistent default can still write label-config state under `DATASET/urban_violation/label_configs` when `LABEL_CONFIG_STORE_ROOT` is not set, because the backend falls back to `dataset_root.parent`.
- Historical `DATASET/urban_violation/label_configs` currently contains five `label-config-*` files with the same `content_hash`, `file_name`, and `version`, which means one semantic config was persisted multiple times.
- `registry.json` and `active.json` can disagree after historical writes; in the observed state the registry marks `label-config-5` active while `active.json` points to `label-config-1`.
- Desired label-config semantics are now: keep historical versions for comparison, but never keep multiple entries for the same semantic version/content. A repeated upload of identical content should reuse the existing entry; uploading changed content with the same `config.version` should be rejected or require an explicit version bump, not create another same-named version.
- Runtime label config state should default to `.runtime/label_config_state`, not raw `DATASET/`, when `LABEL_CONFIG_STORE_ROOT` is omitted.

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

## QC Closed Loop Findings

- `质检闭环整改方案.pdf` identifies six missing post-QC capabilities: modification behavior capture, error attribution, correction sample pool, training export, model evaluation feedback, and annotation version governance.
- The PDF's frontend event-capture proposal should be adapted for this project: authoritative modification behavior should be derived after qc_lead confirmation by diffing the pre-QC baseline snapshot against the confirmed annotation snapshot.
- Frontend operation telemetry can still be useful as auxiliary context, such as elapsed time, zoom level, and active panel, but it should not be the canonical source for model-error attribution.
- Current backend already stores `LabelEditOperation` entries with `scope`, `field`, `op`, `before`, `after`, and optional `tag_payload`, and qc_lead confirmation currently happens through `confirm_submission`.
- Closed-loop implementation should hook into `confirm_submission`: verify the submitted patch, materialize a confirmed annotation payload, create a confirmed snapshot, derive diff events, then update attribution summaries and correction sample pool entries.
- Baseline snapshots should be created from imported STEP1/STEP2 preannotation outputs once a batch reaches preannotation readiness or when the QC queue is generated.
- Derived modification event classes should include `relation_modify`, `relation_bbox_adjust`, `candidate_category_change`, `candidate_delete`, `candidate_add`, and `candidate_evidence_edit`.
- Bbox offset statistics should operate in the stored 0-1000 quantized coordinate system; rendered image pixels are frontend-only display state.
- The correction sample pool should include confirmed changed samples and reference batch id, sample id, confirmed snapshot id, attribution tags, changed field count, reviewer, lead, and timestamps.
- Export should use confirmed snapshots or correction-pool filters, not drafts or raw STEP files.
- Evaluation and version-governance surfaces belong on batch overview tabs first; the sample review workbench should not be reshaped for this work.
- Rollback is a higher-risk capability and should be implemented only after snapshot list/diff and exact restore tests are in place.

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
- Current QC workbench batch assignment has a frontend/backend contract gap: `QcPage` fills the assignee selector from `/api/users`, but backend `list_users` requires `users:manage`. A `qc_lead` or `batch_manager` with `batch_assignment:manage` can assign a known active user via `/api/datasets/{batch_id}/qc/assignment`, but cannot read the user directory, so the UI falls back to only the current manager and cannot choose target annotators.
- Current batch assignment release has a request-body mismatch: frontend calls `POST /api/datasets/{batch_id}/qc/assignment/release` without a body, while the backend route requires `BatchAssignmentActionRequest`; this returns 422 before service logic.
- `QcPage` batch assignment actions currently have no local pending/error state, so API 403/409/422 failures look like a silent no-op in the UI.

## Permission Management Page Design

- Permission management is routed at `/account/permissions` and implemented by `frontend/src/features/users/UsersPage.vue`.
- Access to `/account/permissions` is guarded by route meta `requiresAnyPermission: ['users:manage', 'roles:manage']`; users without these permissions are redirected to `/account`.
- The account center exposes the permission-management entry only when `canManageUsers` is true; auditors can see audit entry without permission-management entry.
- The current page has two primary panels:
  - `账号管理`: create internal user accounts, list users, show status and role tags, enable/disable accounts.
  - `角色绑定`: create scoped role bindings, list bindings, delete bindings.
- Supported roles are `platform_admin`, `dataset_admin`, `batch_manager`, `annotator`, `qc_lead`, and `auditor`.
- Supported role scopes are `platform`, `dataset_type`, and `dataset_batch`; platform scope should use `*`, dataset-type scope uses a dataset type such as `urban_violation`, and dataset-batch scope uses a concrete batch id such as `urban_violation__0508_fixture`.
- Backend operations map to `/api/users`, `/api/users/{user_id}`, `/api/role-bindings`, and `/api/role-bindings/{binding_id}`.
- Backend permission checks are split: account CRUD requires `users:manage`, role-binding CRUD requires `roles:manage`.
- The current UI is functionally correct but should eventually add clearer scope-id assistance, duplicate-binding error display, role-permission preview, and safer self-disable/self-role-removal guardrails.
- Easy-to-use target design should separate identity from access:
  - Account creation only creates an internal identity and should not imply dataset access.
  - Dataset access is granted only through role binding.
  - Data permission assignment should guide admins through user -> target level -> concrete target -> role -> permission preview -> submit.
- The permission-management page should not flatten every sub-feature onto the main canvas. The page should act as a command center with lists, summaries, filters, and primary actions, while detailed creation/editing/assignment/confirmation flows open in modals or right-side drawers.
- Scope entry should avoid free-text where possible:
  - `platform` locks `scope_id` to `*`.
  - `dataset_type` uses a dataset-type dropdown.
  - `dataset_batch` first selects dataset type, then selects a concrete batch under that type.
- User rows should clearly surface `未分配角色`, and each binding row should make who/role/scope visible without reading raw IDs only.
- Recommended modal/drawer surfaces include create account, edit account, reset password, assign dataset permission, binding detail, delete binding confirmation, and disable account confirmation.

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

## Dataset Center Design Audit

- Current dataset center home is `/datasets`, implemented by `frontend/src/features/datasets/DatasetsPage.vue`.
- Current route model has only one dataset-type collection route (`/datasets`) and batch routes under `/datasets/:id/...`; there is no dedicated dataset-type detail route such as `/datasets/types/:datasetType`.
- The backend/frontend contract already supports multi-type grouping: `DatasetType` contains `datasetType`, `displayName`, `fieldSchemaVersion`, `activeLabelConfigVersion`, `batchCount`, and `batches`.
- The homepage currently renders each dataset type as a large panel with all batches, and then renders `LabelConfigUploadPanel` immediately after each type panel.
- Batch overview page links type config by hash back to `/datasets#label-config-{datasetType}`.
- This works technically for one or two dataset types, but does not scale as a multi-type management landing page because label-config upload/version tables become long embedded editor sections on the homepage.
- The better navigation model is: `/datasets` = dataset-type cards and high-level status; dataset type detail = type-scoped configuration, label config, and batch list; batch detail routes stay under concrete batch ids for overview/assets/import/preannotation/qc.
- `label_config` is dataset-type-scoped, so it belongs inside the dataset type card as a status/entry action, not as an always-expanded homepage editor. The edit/upload/version UI should live in a child type-management view.

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
- Live-stack smoke should run against a fresh `PLATFORM_STATE_ROOT` to avoid stale assignment, lease, or label-config state from previous manual checks.
- Live-stack smoke must also isolate `LABEL_CONFIG_STORE_ROOT`; otherwise active label config can be read from the default persistent root even when `PLATFORM_STATE_ROOT` is fresh.
- Current dev stack ports are `8000/5173`; current agent stack ports are `18031/15195`.
- Current test auth headers are `X-User-Id` and `X-User-Role`; this is suitable for local dev smoke unless `PLATFORM_AUTH_MODE=session` is explicitly enabled.
- Closed-loop API smoke should assert the actual audit action strings currently emitted by the backend, including `batch_assignment.assign`, `sample_lease.acquire`, `label_edit.submit`, `label_edit.confirm`, `evaluation.create`, and `snapshot.rollback.disabled`.
- `npx playwright` is available in the current environment and reports version `1.60.0`; the smoke runner should pin that CLI version or fail with an install hint.

## Agent Workflow Facts

- Frontend/backend product work should be done in agent worktrees.
- Main workspace should integrate only reviewed and accepted changes.
- Agent worktrees can lag behind main; compare before syncing and avoid copying stale shared contract files wholesale.
- `DATASET` in agent worktrees should be a symlink to the main readonly dataset rather than a copied 1.6G tree.
- Sync excludes must preserve worktree `.git` pointer files.

## Open Risks

- Default runtime/config state paths should be audited so smoke runs do not write into raw `DATASET/`.
- Import validation persistence vs recalculation remains a product decision.
- STEP2 failure remediation may need its own queue instead of normal QC queue inclusion.
- Category/code dictionaries may need clearer Chinese label mapping while preserving machine-readable codes.
- QC closed-loop event generation must be idempotent; repeated confirmation/stat refresh must not duplicate snapshots, events, or pool items.

## Project Test Design Findings

- Current backend test surface is concentrated in `tests/test_api.py` and `tests/test_manifest_parser.py`.
- Current frontend test surface is concentrated in `frontend/src/test/apiClient.test.ts`, `routesAndPages.test.ts`, `bboxOverlay.test.ts`, `assetTable.test.ts`, `media.test.ts`, and `fixtureApi.test.ts`.
- Current integration smoke is `scripts/integration-smoke.sh`, which runs `scripts/integration-api-smoke.py` plus browser screenshots for accepted main or agent worktree stacks.
- Backend routes cover auth, users/RBAC, dataset types, batch summaries, label config, imports, assets, review detail, label edits, assignments, leases, QC queue, audit, progress, closed-loop stats/events, snapshots, sample pool, exports, evaluations, search, and media serving.
- Frontend routes cover `/login`, `/datasets`, dataset-type detail and label config child routes, batch overview/assets/import/preannotations/QC, sample review, sample pool, account center, permission management, and audit.
- Existing tests are broad but not organized as a project-level coverage matrix. The missing artifact is a durable test strategy that enumerates functional domains, positive/negative/boundary cases, integration gates, and an explicit boundary coverage denominator.
- The requested `>90% boundary coverage` should be treated as domain-boundary coverage unless the project adds code-coverage tooling. Recommended denominator: documented boundary points by module; passing threshold: at least 90% of critical/high boundary points covered by automated unit/API/frontend/integration tests.

## Batch Assignment Repair Findings

- The Batch Assignment selector must not depend on `/api/users`; that endpoint remains a global account-management API and correctly requires `users:manage`.
- Assignment managers need a scoped assignee list under the concrete batch permission boundary. The accepted contract is `GET /api/datasets/{dataset_id}/qc/assignable-users` with `batch_assignment:manage` and active-user filtering.
- Admin accounts are valid assignment targets; disabled users are not.
- `qc_lead`/`batch_manager` can assign a known active user by id even when they cannot read `/api/users`.
- Release must be tolerant of empty request bodies because the UI action has no required user input.
- Batch assignment UI failures need visible action-level feedback; silent fallback makes permission and validation failures look like a broken dropdown.

## 0520 Preannotated Batch QC Queue Findings

- `DATASET/urban_violation_0520` is a preannotated batch shape, not images-only:
  - `images`: 505 files.
  - `stage1/parsed`: 505 JSON files.
  - `stage2/parsed`: 496 JSON files.
  - `stage2/failures`: 8 JSON files.
  - `stage1/meta/manifest.jsonl` and `stage2/meta/manifest.jsonl` exist.
- The registered batch state currently says `urban_violation__urban_violation_0520` is `Imported` and `preannotation_ready`, with source structure `images_with_preannotations`.
- Runtime hydration fails because backend `discover_stage_run_dir()` only accepts directories named `stage1_run_*` and `stage2_run_*`.
- Frontend directory scanning accepts plain `stage1`/`stage2` because `isStage1RunSegment()` and `isStage2RunSegment()` match any segment starting with `stage1`/`stage2`.
- This creates an inconsistent contract: the UI can register a plain `stage1`/`stage2` preannotated batch, but the backend importer cannot load it for QC generation.
- The current `source_not_ingested` error is therefore misleading for this case; the source was registered and counted, but runtime sample hydration failed due to unsupported stage directory naming.
- The 0520 manifest also has reject-batch edge cases:
  - `stage1/meta/manifest.jsonl` has 505 unique sample ids.
  - `stage2/meta/manifest.jsonl` has 504 unique sample ids, with one stage1 sample missing from stage2.
  - 8 stage2 failure ids are duplicated in the manifest, so the raw manifest line count is higher than the unique sample count.
- The importer currently treats a sample missing from stage2 as a hard `KeyError`; for reject/remediation batches, missing stage2 should be represented as a queueable `stage2_missing`/failure diagnostic item rather than preventing all QC queue generation.

## 2026-05-20 QC queue source-not-ingested log diagnosis

- Runtime log for `urban_violation__urban_violation_0520` shows the UI successfully created/import-confirmed the batch, then `POST /api/datasets/urban_violation__urban_violation_0520/qc/generate` returned `409 Conflict`.
- API response detail is `code=source_not_ingested`, message `Batch source must be ingested before QC queue generation.`
- The persisted batch state at `.runtime/label_config_state/dataset_batches.json` says:
  - dataset id `urban_violation__urban_violation_0520`,
  - source URI `urban_violation_0520`,
  - source structure `images_with_preannotations`,
  - lifecycle `preannotation_ready`,
  - import job `manual-import-urban_violation-urban_violation_0520-2`,
  - `stage1_count=505`, `stage2_success_count=496`, `stage2_failure_count=8`.
- The data directory currently uses run-style directories:
  - `DATASET/urban_violation_0520/stage1_run_0520/meta/manifest.jsonl`,
  - `DATASET/urban_violation_0520/stage2_run_0520/meta/manifest.jsonl`.
  This means the earlier plain `stage1/` and `stage2/` naming mismatch is no longer the immediate failure.
- Directly calling `_build_registered_batch_runtime()` revealed the swallowed internal exception:
  - `ValueError: Invalid stage1 manifest line 40`
  - The line is a STEP1 retry/failure history row with `status=failed` and `failure_path`, missing `response_path`, `parsed_path`, and `record_path`.
- Current parser model `Stage1ManifestEntry` only accepts successful STEP1 rows. `read_stage1_manifest()` does not support STEP1 failure/retry rows, unlike `read_stage2_manifest()` which has a failure-entry model and deterministic overwrite behavior.
- Current manifest statistics for `DATASET/urban_violation_0520`:
  - images: 505.
  - STEP1 parsed files: 505.
  - STEP1 manifest lines: 543, unique ids: 505, rows by status: 528 success and 15 failed.
  - All 13 unique STEP1 failed ids also have successful STEP1 rows; last status by unique id is 505 success.
  - STEP2 parsed files: 496.
  - STEP2 failure files: 8.
  - STEP2 manifest lines: 512, unique ids: 504, last status by unique id is 496 success and 8 failed.
  - One STEP1-success id is missing from STEP2 manifest: `RAW001B5000001_20260325_104404_front_01010100150000010101_20260325104420A659`.
- Therefore the current user-visible error is misleading. The source has been registered/import-confirmed, but runtime hydration fails and is silently discarded by `_hydrate_registered_batch_runtime()`, causing queue generation to see no runtime and report `source_not_ingested`.

## QC review keyboard shortcut planning

- Current sample review page already has top navigation controls for previous sample, next sample, and list return.
- Current accepted bottom bar actions are:
  - `跳过样本`: leaves the current sample without batch finalization and must not discard dirty edits silently.
  - `校验修改`: runs current-sample field legality validation only.
  - `保存草稿`: persists the current batch draft workspace.
  - `提交批次修改`: opens a confirmation modal and finalizes the assigned batch only after gates pass.
- Current review editor contains many text/select inputs. Letter shortcuts must be ignored while focus is inside editable fields or while IME composition is active.
- Unsaved local edits are tracked by `operationCount`, `patchSaved`, and the existing `actionMessage` area can show shortcut guard feedback.
- The safe first shortcut set is navigation plus bottom bar actions:
  - previous/next sample: `ArrowLeft`/`ArrowRight` and `A`/`D`;
  - skip: `X`;
  - validate: `V`;
  - save batch draft: `S`.
- `Ctrl/Cmd+S` conflicts with the browser save-page shortcut. It should not be bound in the first implementation. If it is enabled later, it must call `preventDefault()` only when the review route is active and focus is not inside an editable field.
- `Ctrl/Cmd+Enter` should not be bound for this implementation because batch finalization is a high-impact modal-confirmed action.
- Relation keyboard cycling is not needed in the first implementation. Directly clicking the image bbox is more efficient and better aligned with the current evidence-first review flow.
- Shortcut implementation must not add a persistent visible shortcut legend to the accepted review canvas; use docs, `aria-keyshortcuts`, and non-intrusive metadata instead.
- Implemented shortcut set is route-scoped to the review workbench:
  - previous/next sample: `ArrowLeft`/`ArrowRight` and `A`/`D`;
  - skip: `X`;
  - validate-only: `V`;
  - save batch draft: `S`.
- Implemented shortcut guards ignore editable targets, button focus, IME composition, repeated keydown events, and `Ctrl`/`Meta`/`Alt` modified events.
- `Ctrl/Cmd+S` and `Ctrl/Cmd+Enter` remain intentionally unbound. Batch submission remains button-triggered and modal-confirmed only.
- Dirty navigation and skip reuse the same save-before-leave batch draft guard as visible controls.

## QC review draft/autosave/batch-submit redesign

- Keyboard shortcut implementation resumed after bottom-bar lifecycle semantics were accepted and is now complete.
- Current frontend save/submit handlers are sample-scoped:
  - `saveDraft()` posts the active sample patch with `submitAction=save_draft` and marks only local `patchSaved/lastSavedAt`.
  - `submitChanges()` validates the active sample, posts `submitAction=submit_changes`, and treats success as current sample submission.
  - `ReviewWorkbenchPage.submitLabelEdit()` releases only the active sample lease when `submitAction=submit_changes`.
- Current backend submit logic is also sample-scoped:
  - `submit_label_edits()` requires batch assignment and active sample lease.
  - `save_draft` stores one `LabelEditDraft` for the active sample and marks that task `DRAFT_SAVED`.
  - `submit_changes` stores one `LabelEditSubmission`, marks that task `SUBMITTED`, and releases that sample lease.
  - There is no batch-level draft manifest or batch-level finalization record in the current flow.
- User expectation changes the product contract:
  - `保存草稿` should save all modifications made during the current batch QC work, not only the active sample.
  - The workbench should autosave progress every 2-5 minutes while dirty edits exist.
  - `提交修改` should mean final submission of the entire assigned batch after all required samples are reviewed, saved, and valid.
- Target frontend state needs a batch draft workspace above active-sample state:
  - dirty sample ids, saved draft sample count, current sample operation count, validation status per edited sample, autosave status, last saved time, save errors, and batch submit readiness.
- Target backend/API needs explicit batch support:
  - batch draft load/upsert/autosave endpoints;
  - batch submit endpoint with atomic validation/finalization;
  - durable batch-level submission and audit record;
  - idempotent draft-only autosave behavior.
- Final submit should be modal-confirmed and block on unsaved dirty edits, pending autosave, validation errors, missing assignment, missing label config, stale revisions, or readonly permissions.

## 2026-05-21 Autosave Load Assessment
- Current autosave write path per request: one sample draft JSON write per dirty entry, one batch manifest JSON write, one audit JSONL append, and possible assignment status write on first save.
- Current backend response path still summarizes user drafts, so fewer autosave calls directly reduce filesystem reads/writes.
- Frontend optimization implemented: no fixed idle interval; schedule one timeout only while dirty; stale save responses no longer clear newer dirty edits.

## 2026-05-21 Autosave Interval Control

- Bottom-bar interval selection is frontend-only and does not require a backend contract change.
- Allowed intervals are intentionally fixed to `1`, `2`, `3`, and `5` minutes to avoid excessive autosave write pressure.
- The setting is stored in `localStorage` under `urbanViolationReviewAutosaveIntervalMs`, so it is remembered per browser.
- Changing the interval while dirty clears the pending timeout and schedules the next autosave using the new interval.

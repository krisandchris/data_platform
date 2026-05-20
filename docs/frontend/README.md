# Frontend Interface Specification

Last updated: 2026-05-20

This file is the current frontend documentation source of truth. It is based on the actual Vue source under `frontend/src`, not on historical mockups.

## Stack And Entry Points

- Framework: Vue 3 + TypeScript
- Build: Vite
- Routing: vue-router
- Icons: lucide-vue-next
- Tests: Vitest
- Source root: `frontend/src`
- App shell: `frontend/src/app/layouts/AppShell.vue`
- Router: `frontend/src/app/router.ts`
- API client: `frontend/src/services/urbanViolationApi.ts`
- Shared contract types: `frontend/src/shared/types/contract.ts`

## Navigation Model

Root and auth:

```text
/ -> /datasets
/login -> 登录页
```

Dataset and batch workspace:

```text
/datasets
  -> /datasets/:id/overview
  -> /datasets/:id/assets
  -> /datasets/:id/import-jobs/:jobId
  -> /datasets/:id/preannotations
  -> /datasets/:id/qc
  -> /datasets/:id/samples/:sampleId/review
```

User center:

```text
/account
  -> /account/permissions
  -> /account/audit
```

Compatibility redirects:

```text
/users -> /account/permissions
/audit -> /account/audit
```

Batch routes must use the concrete dataset batch id, for example `urban_violation__0508_fixture`. They must not use the dataset type id, for example `urban_violation`, when reading batch assets, QC queue, assignment, leases, drafts, or submissions.

## App Shell Layout

Default management pages:

```text
+-----------------+------------------------------------------------+
| Sidebar         | Topbar: route context + system status + user   |
|                 +------------------------------------------------+
| 工作入口         | Page content                                    |
| 当前批次         |                                                |
| 用户中心         |                                                |
| Collapse button |                                                |
+-----------------+------------------------------------------------+
```

Review page focus mode:

```text
+------------------------------------------------------------------+
| Review workbench only, no global sidebar, no topbar              |
+------------------------------------------------------------------+
```

Shell behavior:

- Sidebar can collapse; state is stored in `localStorage` key `uvp.sidebarCollapsed`.
- Current batch links are derived from route param `:id`.
- User chip routes to `/account`.
- `/datasets/:id/samples/:sampleId/review` hides global navigation and topbar.

## Page Inventory

| Page | Route | Component | Main purpose |
| --- | --- | --- | --- |
| 登录 | `/login` | `LoginPage.vue` | Internal account login and dev user switch. |
| 数据集中心 | `/datasets` | `DatasetsPage.vue` | Manage dataset types, type-level label config, and batches. |
| 批次概览 | `/datasets/:id/overview` | `DatasetOverviewPage.vue` | Batch lifecycle, asset/import/QC summary, distributions. |
| 资产样本 | `/datasets/:id/assets` | `DatasetAssetsPage.vue` | Batch asset statistics, filters, sample entry. |
| 导入校验 | `/datasets/:id/import-jobs/:jobId` | `ImportJobPage.vue` | Import scan, validation, preview, confirm/retry. |
| 预标注结果 | `/datasets/:id/preannotations` | `PreannotationsPage.vue` | STEP1/STEP2 summary and contract fields. |
| 质检队列 | `/datasets/:id/qc` | `QcPage.vue` | Batch assignment, task tabs, submitted confirmation queue. |
| 样本审阅 | `/datasets/:id/samples/:sampleId/review` | `ReviewWorkbenchPage.vue` + `ReviewWorkbenchShell.vue` | Focused label editing and sample review. |
| 账户信息 | `/account` | `AccountPage.vue` | Current user profile, roles, permissions, logout, management entry. |
| 权限管理 | `/account/permissions` | `UsersPage.vue` | User account management and role binding. |
| 审计记录 | `/account/audit` | `AuditPage.vue` | Audit event filters and QC progress summary. |

## Page Details

### 登录

Route: `/login`

Layout:

```text
+--------------------------------------+
| 城市治理数据平台                      |
| 登录数据协作平台                      |
| username input                        |
| password input                        |
| 登录 button                           |
| dev user quick switch, dev only       |
+--------------------------------------+
```

Data fields:

- `username`
- `password`
- `message`
- `users[]` for dev-mode quick switch

Interactions:

- Submit calls internal login.
- Success redirects to `redirect` query or `/datasets`.
- Dev mode can switch `uvp.devUserId`.

States:

- Pending disables login.
- Login failure shows `message`.
- Dev user list load failure is ignored because stale non-admin identity can make user directory unreadable.

API:

- `POST /api/auth/login`
- `GET /api/me`
- Dev mode user list may call `GET /api/users`

Permissions:

- Public route.
- Other routes redirect here if current user is missing.

### 数据集中心

Route: `/datasets`

Layout:

```text
+----------------------------------------------------------------+
| Header: 数据集 + 新增数据集类型                                  |
+----------------------------------------------------------------+
| Optional dataset type form                                      |
+----------------------------------------------------------------+
| Dataset Type Panel                                              |
|  - type identity, active label config, field schema             |
|  - new batch button                                             |
|  - optional batch registration form                             |
|  - batch list rows with overview/assets/import/QC actions       |
+----------------------------------------------------------------+
| LabelConfigUploadPanel for this dataset type                    |
+----------------------------------------------------------------+
```

Data fields:

- Dataset type: `datasetType`, `displayName`, `fieldSchemaVersion`, `activeLabelConfigVersion`, `batchCount`
- Batch: `id`, `batchKey`, `batchName`, `datasetType`, `lifecycleStatus`, `activeImportJobId`, `latestImportJob`, `qcQueueId`, `assetTotal`, `stage1Total`, `stage2SuccessTotal`, `stage2FailureTotal`, `qcProgress`
- New type form: `datasetType`, `displayName`, `fieldSchemaVersion`
- New batch form: `batchKey`, `batchName`, `sourceStructure`, `sourceUri`, scanned file counters
- Directory scan counters: `sourceFileCount`, `imageCount`, `stage1FileCount`, `stage2FileCount`, `stage2FailureFileCount`

Interactions:

- Toggle and submit dataset type creation.
- Open/cancel batch registration form.
- Select a local directory for client-side file-name scanning.
- Create batch import job.
- Navigate to overview/assets/import job.
- Generate QC queue if batch is `preannotation_ready` and has no `qcQueueId`.
- Upload, validate, save, activate, reload type-level label config via `LabelConfigUploadPanel`.

States:

- Loading: `正在加载数据集...`
- Error: backend error text.
- Empty: backend returns no dataset types.
- Type create success/error message.
- Batch create success/error message.
- QC queue generation pending/success/error per batch.

API:

- `GET /api/dataset-types`
- `POST /api/dataset-types`
- `POST /api/datasets/{batch_id}/import-jobs`
- `POST /api/datasets/{batch_id}/qc/generate`
- Label config APIs under `/api/dataset-types/{dataset_type}/label-configs`

Permissions:

- Route requires login.
- Current frontend shows creation and queue actions based on page state; backend enforces actual permission.
- Label config is type-level. Batch pages must not activate config directly.

### 批次概览

Route: `/datasets/:id/overview`

Layout:

```text
+----------------------------------------------------------------+
| Header: batch name + action buttons                             |
+----------------------------------------------------------------+
| Context strip: type, batch, lifecycle, active config, import job |
+----------------------------------------------------------------+
| Metric cards: raw images, STEP1, STEP2, failures, coverage      |
+----------------------------------------------------------------+
| Left: lifecycle track        | Right: asset/import/QC stats      |
+----------------------------------------------------------------+
| Left: preannotation runs     | Right: latest import warnings     |
+----------------------------------------------------------------+
| Distribution panels: violation, confidence, sample category     |
+----------------------------------------------------------------+
| Dataset metadata                                                |
+----------------------------------------------------------------+
```

Data fields:

- `DatasetSummary.dataset`: identity, type, batch key/name, lifecycle, active label config, active import job, QC queue id
- `totals`: `rawAssets`, `stage1Parsed`, `stage2Parsed`, `stage2Failures`
- `coverage`: `stage1`, `stage2`
- `qc`: `total`, `pending`, `passed`, `rejected`, `needsHumanReview`
- `assetSummary`: media, import health, preannotation, model judgement, QC counters
- `recentRuns[]`: run id/name/stage/status/input/output
- `importWarnings[]`: severity/title/message
- Distributions: violation category, confidence, sample category
- Metadata: image source, region, collection range, image resolution

Interactions:

- Open type config when lifecycle is `label_config_required`.
- Open latest import job.
- Open assets.
- Generate QC queue when lifecycle is `preannotation_ready` and queue is missing.
- Enter QC queue otherwise.

States:

- Loading: `Loading dashboard...`
- Error: backend error text.
- Empty: no summary returned.
- Action message for QC queue generation success/error.

API:

- `GET /api/datasets/{batch_id}/summary`
- `POST /api/datasets/{batch_id}/qc/generate`

Permissions:

- Route requires login.
- QC queue generation is state-gated in UI and permission-gated by backend.

### 资产样本

Route: `/datasets/:id/assets`

Layout:

```text
+-------------------------------------------------------------+
| Header: 批次资产 / 样本浏览 + 返回概览                       |
+-------------------------------------------------------------+
| Metric cards: media, import, STEP1, STEP2, QC, soft fail     |
+-------------------------------------------------------------+
| AssetTable toolbar filters                                  |
+-------------------------------------------------------------+
| Asset table with thumbnail, statuses, categories, review link|
+-------------------------------------------------------------+
```

Data fields:

- Summary fields: dataset batch identity and `AssetSummary`
- Asset row: `id`, `sampleId`, `imageUrl`, `thumbnailUrl`, `mediaStatus`, `stage1Status`, `stage2Status`, `hasStage2Failure`, `judgeDecision`, `violationCategories`, `sampleCategories`, `highestConfidence`, `qcStatus`, `labelEditStatus`, `updatedAt`
- Filters: `stage1Status`, `judgeDecision`, `stage2State`, `qcStatus`, `violationCategory`, `sampleCategory`, `mediaStatus`, `labelEditStatus`, `confidenceMin`, `search`

Interactions:

- Filter locally and notify parent to reload backend-filtered assets.
- Reset filters.
- Thumbnail load failure marks row fallback.
- Sample id opens review page.
- Batch id route change resets stale assets and summary.

States:

- Loading: `Loading assets...`
- Error: backend error text.
- Empty assets from backend.
- Empty filtered result.
- Image fallback for missing or failed media URL.

API:

- `GET /api/datasets/{batch_id}/assets`
- `GET /api/datasets/{batch_id}/assets/summary`
- `GET /api/datasets/{batch_id}/summary`

Permissions:

- Route requires login.
- Review link may open readonly page if user is not assignee or has no active lease.

### 导入校验

Route: `/datasets/:id/import-jobs/:jobId`

Layout:

```text
+------------------------------------------------------------+
| Header: import job identity + scan/validate/retry/confirm   |
+------------------------------------------------------------+
| ImportStepper: batch info -> source -> scan -> preview ...  |
+------------------------------------------------------------+
| Metric cards: raw, STEP1, STEP2, failures                   |
+------------------------------------------------------------+
| Validation table                         | warning panel    |
+------------------------------------------------------------+
| Mapping flow: source folders -> entities                    |
+------------------------------------------------------------+
| Next actions: overview, assets, QC                          |
+------------------------------------------------------------+
```

Data fields:

- Import job: `id`, `datasetId`, `datasetType`, `batchKey`, `title`, `sourceMode`, `sourceUri`, `sourceStructure`, `state`, `activeStep`, `createdAt`, `updatedAt`
- Totals and coverage
- `validationRows[]`: `sampleId`, `imagePath`, `stage1Path`, `stage2Path`, `failurePath`, `status`
- `validationReport`: `valid`, `blockingErrors`, `warnings`
- `mappingSteps[]`: `label`, `count`, `entity`

Interactions:

- Re-scan import job.
- Validate import job.
- Retry if job failed.
- Confirm import when no blocking issues.
- Navigate to overview/assets/QC.

States:

- Loading: `Loading import job...`
- Error: backend error text.
- Empty: no job returned.
- Action pending disables buttons.
- Blocking issues disable confirm.
- Action message shows success or backend error.

API:

- `GET /api/datasets/{batch_id}/import-jobs/{job_id}`
- `POST /api/datasets/{batch_id}/import-jobs/{job_id}/scan`
- `POST /api/datasets/{batch_id}/import-jobs/{job_id}/validate`
- `POST /api/datasets/{batch_id}/import-jobs/{job_id}/confirm`
- `POST /api/datasets/{batch_id}/import-jobs/{job_id}/retry`

Permissions:

- Route requires login.
- Backend enforces import management permissions.

### 预标注结果

Route: `/datasets/:id/preannotations`

Layout:

```text
+---------------------------------------------------------+
| Header: 预标注运行                                      |
+---------------------------------------------------------+
| STEP1 summary | STEP2 summary | verification distribution|
+---------------------------------------------------------+
| category distribution | contract fields                 |
+---------------------------------------------------------+
```

Data fields:

- `stage1.succeeded`, `stage1.failed`, `stage1.bboxValid`
- `stage2.parsed`, `stage2.failures`, `stage2.candidateCount`
- `verificationDistribution`
- `categoryDistribution`
- Contract fields displayed: `stage1.key_relations[].bbox`, `stage2.fact_verifications[]`, `stage2.candidates[]`, `stage2Failure`

Interactions:

- Read-only summary page.
- Reloads when route batch id changes.

States:

- Loading: `Loading preannotations...`
- Error: backend error text.
- Empty: no summary returned.

API:

- `GET /api/datasets/{batch_id}/summary`, normalized as preannotation summary.

Permissions:

- Route requires login.
- Read-only view.

### 质检队列

Route: `/datasets/:id/qc`

Layout:

```text
+------------------------------------------------------------+
| Header: 质检工作台                                         |
+------------------------------------------------------------+
| Batch Assignment panel                                     |
+------------------------------------------------------------+
| Task progress tabs                                         |
+------------------------------------------------------------+
| Submitted confirmation queue, if any                       |
+------------------------------------------------------------+
| Queue cards by active tab                                  |
+------------------------------------------------------------+
```

Data fields:

- Workspace: `assignment`, `queue[]`, `tasks[]`, `leases[]`, `progress`
- Assignment: assignee, assigner, status, timestamps
- User directory: active users and role bindings
- Queue item: `sampleId`, `primaryCategory`, `status`, `taskStatus`, assignee, lease status, label config version, latest submission
- Tabs: `mine`, `in_progress`, `skipped`, `submitted`, `confirmed`, `returned`

Interactions:

- Assign, reassign, release batch when current user can manage assignments.
- Filter queue by tab.
- Open sample review from queue card.
- Confirm or return submitted label edit when current user can confirm submissions.

States:

- Loading: `Loading QC workspace...`
- Error: backend error text.
- Empty tab: no matched tasks.
- Submitted confirmation queue hidden when empty.
- Queue cards show readonly styling when current user cannot edit.

API:

- `GET /api/datasets/{batch_id}/qc`
- `GET /api/users`
- `GET /api/role-bindings`
- `POST /api/datasets/{batch_id}/qc/assignment`
- `POST /api/datasets/{batch_id}/qc/assignment/reassign`
- `POST /api/datasets/{batch_id}/qc/assignment/release`
- `POST /api/datasets/{batch_id}/samples/{sample_id}/label-edits/{submission_id}/confirm`
- `POST /api/datasets/{batch_id}/samples/{sample_id}/label-edits/{submission_id}/return`

Permissions:

- Route requires login.
- Assignment form requires `batch_assignment:manage`, `batch:assign`, `batch:reassign`, or fallback roles `platform_admin`, `dataset_admin`, `batch_manager`, `qc_lead` when permissions are absent.
- Submission confirmation requires `qc_submission:confirm`, `qc:confirm`, or fallback roles `platform_admin`, `dataset_admin`, `qc_lead` when permissions are absent.
- Annotator sees only queue items assigned to self or to the batch assignment.

### 样本审阅

Route: `/datasets/:id/samples/:sampleId/review`

Layout:

```text
+----------------------------------------------------------------+
| QC topbar: sample, progress, judge, draft, config, assignee     |
+----------------------------------------------------------------+
| Warnings: action, readonly, missing config                      |
+----------------------------------------------------------------+
| Image evidence panel                   | Relation review panel  |
| - layer toggles                        | - R index rail          |
| - bbox overlay image stage             | - relation editor       |
| - scene/context strip                  | - verification editor   |
|                                        +------------------------+
|                                        | Candidate/verdict panel |
|                                        | - C index rail          |
|                                        | - candidate editor      |
|                                        | - evidence relations    |
+----------------------------------------------------------------+
| Bottom bar: status chips + 跳过/校验/保存草稿/提交修改           |
+----------------------------------------------------------------+
```

Data fields:

- Asset: `datasetId`, `sampleId`, `imageUrl`, `width`, `height`, `judgeDecision`, `stage2Status`
- STEP1: `environmentAnalysis`, `sceneElements`, `keyAnchors`, `keyRelations[]`
- Relation fields: `subject`, `relation`, `object`, `description`, `bbox`
- STEP2 verification fields: `visibilityLevel`, `informationLossType`, `verificationResult`, `verificationConfidence`, `bboxObservation`, `globalContextObservation`
- Read-only visibility reference: `subjectVisible`, `subjectMatch`, `keyAttributesVisible`
- Candidate fields: `violationCategory`, `sampleCategory`, `confidence`, `segmentationTargets`, `evidenceReasoning`, `relationHint`, `evidenceRelationIds`
- Assignment/lease/task: current user, batch assignment, QC task, sample lease
- Label config: closed enum options and open tag suggestions
- Draft/submission payload: label edit operations, lease id, task revision, label config id/version

Interactions:

- Prev/Next/List navigation.
- Toggle STEP1, STEP2, Candidate bbox layers.
- Click bbox to select relation.
- Drag editable bbox to move.
- Drag resize handle to resize bbox.
- Mouse wheel zooms image stage, max 4x.
- Middle mouse button pans image when zoomed in.
- Relation index rail switches active relation.
- Relation editor changes text fields, enum fields, confidence, observations.
- Candidate index rail switches active candidate.
- Add/delete candidate.
- Edit candidate category, sample category, confidence, segmentation targets, reasoning, relation hint.
- Toggle evidence relations.
- Skip releases current lease and moves to next sample or QC list.
- Validate checks field legality only.
- Save draft persists patch as draft.
- Submit validates first, then submits patch and releases lease.
- Route sample switch keeps current screen mounted and refreshes silently.

States:

- Initial loading: `Loading review sample...`
- Initial error: backend error.
- Empty: no review detail returned.
- Refreshing state keeps current workbench visible.
- Readonly when no assignment, current user is not assignee, or no active lease.
- Missing label config disables editing.
- Validation states: unvalidated, valid, invalid with field issue count.
- Save and submit pending states disable related buttons.
- Image fallback appears when media URL is missing or load fails.

API:

- `GET /api/datasets/{batch_id}/samples/{sample_id}/review`
- `GET /api/datasets/{batch_id}/qc`
- `GET /api/dataset-types/{dataset_type}/label-config/active` through compatibility method
- `GET /api/datasets/{batch_id}/label-suggestions`
- `POST /api/datasets/{batch_id}/samples/{sample_id}/lease`
- `POST /api/datasets/{batch_id}/samples/{sample_id}/lease/{lease_id}/heartbeat`
- `POST /api/datasets/{batch_id}/samples/{sample_id}/lease/{lease_id}/release`
- `GET /api/datasets/{batch_id}/samples/{sample_id}/label-edits/my-draft`
- `POST /api/datasets/{batch_id}/samples/{sample_id}/label-edits/validate`
- `POST /api/datasets/{batch_id}/samples/{sample_id}/label-edits`

Permissions:

- Route requires login.
- Editing requires active type/batch label config, batch assignment to current user, and active sample lease held by current user.
- Non-assignee and no-lease users can view readonly.
- `校验修改` does not submit or save.
- `保存草稿` and `提交修改` require patch operations and editability.

Protected behavior:

- Bbox values are 0-1000 quantized.
- Bbox overlays must stay inside the rendered image stage.
- Default bbox border is 2px.
- Red is reserved for explicitly selected boxes.
- Purple is reserved for unreferenced Relation boxes.
- Default referenced Relation colors exclude red, black, and purple.
- Do not change the accepted review layout unless explicitly requested.

### 账户信息

Route: `/account`

Layout:

```text
+---------------------------------------------------+
| Header: 账户信息                                  |
+---------------------------------------------------+
| Personal account panel        | Session operation  |
+---------------------------------------------------+
| Roles and scopes                                  |
+---------------------------------------------------+
| Permission summary                                |
+---------------------------------------------------+
| Management entries, if allowed                    |
+---------------------------------------------------+
```

Data fields:

- Current user: `userId`, `displayName`, `email`, `status`, `authMode`
- Role bindings: role, scope type, scope id, creator, created time
- Permissions grouped by prefix

Interactions:

- Logout clears session and returns to login.
- Management entry links appear when user has permission.

States:

- Loading account.
- Error loading account.
- Empty when not logged in.
- Logout pending.

API:

- `GET /api/me`
- `POST /api/auth/logout`

Permissions:

- Any logged-in user can open `/account`.
- Permission management entry requires `users:manage` or `roles:manage`.
- Audit entry requires `audit:read` or role fallback from current frontend logic.

### 权限管理

Route: `/account/permissions`

Design intent:

- Make account lifecycle and data permission assignment two separate mental models.
- Avoid asking admins to remember raw scope ids whenever the UI can offer choices.
- Make each binding answer three visible questions: who gets access, what role they get, and where that role applies.
- Keep destructive actions explicit and reversible at the workflow level through audit visibility, not hidden inside compact controls.
- Keep the main page as a command center. Do not flatten every sub-feature into the page; use dialogs or drawers for detailed creation, editing, assignment, and confirmation workflows.

Recommended layout:

```text
+------------------------------------------------------------------------+
| Header: 权限管理                                                         |
| Metrics: active users / disabled users / bindings / unscoped accounts    |
+------------------------------------------------------------------------+
| Tab: 账号管理 | 数据集权限分配 | 角色绑定记录                            |
+------------------------------------------------------------------------+
| 账号管理                                                                 |
| - user table with status, roles, last seen, operation buttons             |
| - primary actions: 新建账号 / 分配权限 / 编辑账号 / 禁用                  |
+------------------------------------------------------------------------+
| 数据集权限分配                                                            |
| - assignment cards or table grouped by dataset type and batch             |
| - open assignment drawer for detailed role/scope setup                    |
+------------------------------------------------------------------------+
| 角色绑定记录                                                              |
| - filter by user, role, scope type, dataset type, batch, status           |
| - binding list with detail drawer, delete confirmation, audit trail link   |
+------------------------------------------------------------------------+
```

Main-page vs dialog responsibilities:

| Surface | Shows directly | Opens dialog/drawer for |
| --- | --- | --- |
| 账号管理 tab | user list, status, role summary, quick search, primary actions | create account, edit account, reset password, disable/enable confirmation |
| 数据集权限分配 tab | dataset type/batch tree, assigned user count, missing assignment warnings | assign permission wizard, role permission preview, batch-specific binding details |
| 角色绑定记录 tab | binding table, filters, status, created time | binding detail, delete confirmation, audit trail context |

Data fields:

- Users: `userId`, `displayName`, `email`, `status`
- New user form: `username`, `displayName`, `email`, `password`
- Role binding: `userId`, `role`, `scopeType`, `scopeId`, `bindingId`
- Roles: `annotator`, `qc_lead`, `batch_manager`, `dataset_admin`, `auditor`, `platform_admin`
- Scopes: `dataset_batch`, `dataset_type`, `platform`
- Dataset type choices: from `GET /api/dataset-types`
- Dataset batch choices: from dataset type `batches[]` or batch list data already returned by dataset type APIs

Processing logic:

1. Account creation creates identity only. It must not imply data access.
2. Data access is granted only by role binding.
3. A role binding is always `(userId, role, scopeType, scopeId)`.
4. Platform scope applies globally and should use `scopeId="*"`.
5. Dataset type scope applies to every current and future batch under that type.
6. Dataset batch scope applies only to one concrete batch id, such as `urban_violation__0508_fixture`.
7. Duplicate role bindings should be blocked before submit and also handled from backend conflict responses.
8. Disabling a user should prevent new work while preserving historical submissions and audit records.
9. Deleting a role binding should revoke future access; existing audit records and submitted work remain immutable.

Recommended role presets:

| Scenario | Role | Scope type | Scope id |
| --- | --- | --- | --- |
| System owner | `platform_admin` | `platform` | `*` |
| Manage one dataset type | `dataset_admin` | `dataset_type` | `urban_violation` |
| Manage one batch import and assignment | `batch_manager` | `dataset_batch` | concrete batch id |
| Annotate one batch | `annotator` | `dataset_batch` | concrete batch id |
| Confirm one batch | `qc_lead` | `dataset_batch` | concrete batch id |
| Read audit for one dataset type | `auditor` | `dataset_type` | `urban_violation` |

Recommended interaction flow:

```text
Create account
  -> user appears as "未分配角色"
  -> admin clicks "分配数据权限"
  -> choose user
  -> choose target level
       platform: scope id locked to *
       dataset type: choose dataset type
       dataset batch: choose dataset type first, then choose batch
  -> choose role
  -> preview permission summary
  -> submit binding
  -> binding appears in user row and binding records
```

Dialog and drawer behavior:

- `新建账号` opens a modal or right drawer; success closes the surface and refreshes the user list.
- `编辑账号` opens the same account drawer in edit mode; password reset should be a separate confirmation step.
- `分配数据权限` opens a right drawer with the guided assignment flow rather than expanding a long form inline.
- `查看绑定详情` opens a read-only drawer showing role, scope, derived permissions, creator, created time, and related audit entries.
- `删除绑定` opens a confirmation modal; the confirm button should repeat the role and scope being removed.
- `禁用账号` opens a confirmation modal and warns when the account still owns active assignments, drafts, or role bindings.
- Only one edit drawer/modal should be open at a time; closing with unsaved changes should ask for confirmation.

Form behavior:

- `scopeType=platform`: hide free-text scope input and display fixed `*`.
- `scopeType=dataset_type`: use a dataset-type dropdown; do not ask the admin to type `urban_violation`.
- `scopeType=dataset_batch`: first choose dataset type, then choose batch from that type.
- Role dropdown should show role labels and intended use, not only machine values.
- Permission preview should show grouped permission names such as 数据集查看、质检队列查看、标签编辑、批次分配管理.
- Submit should be disabled until user, role, scope type, and valid scope id are selected.
- Delete binding should require confirmation that includes user, role, and scope.
- Disable user should require confirmation and should warn if the target user is the current admin.

Interactions:

- Create user through modal/drawer.
- Edit account or reset password through modal/drawer.
- Enable/disable user through confirmation modal.
- Create role binding through assignment drawer.
- Delete role binding through confirmation modal.
- Filter role bindings by user, role, and scope.
- Jump from one user row to pre-filled data-permission assignment.

States:

- Loading permissions data.
- 403 shows management-permission error.
- Empty user list.
- Empty binding list.
- User created but no role: show `未分配角色`.
- Scope choices failed to load: keep user list readable and disable binding submit.
- Duplicate binding: show inline conflict message.
- Backend validation error: show the backend message near the binding form.

API:

- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/{user_id}`
- `GET /api/role-bindings`
- `POST /api/role-bindings`
- `DELETE /api/role-bindings/{binding_id}`
- `GET /api/dataset-types` for scope dropdowns

Permissions:

- Route guard requires `users:manage` or `roles:manage`.
- Backend enforces exact user and role management permissions.
- Account operations require `users:manage`.
- Role binding operations require `roles:manage`.
- Audit viewing remains separate under `/account/audit`.

### 审计记录

Route: `/account/audit`

Layout:

```text
+------------------------------------------------------+
| Header: 审计与批次进度                                |
+------------------------------------------------------+
| Progress panel | Audit event panel                    |
| - by status    | - filters                            |
| - by user      | - event list                          |
+------------------------------------------------------+
```

Data fields:

- Filters: `datasetId`, `sampleId`, `actorUserId`, `action`
- Audit events: `eventId`, `action`, `entityType`, `entityId`, `actorUserId`, `actorDisplayName`, `datasetId`, `sampleId`, `createdAt`
- QC progress: `byStatus`, `byUser`, `total`, `updatedAt`

Interactions:

- Refresh progress and events.
- Filter audit events.

States:

- Loading audit events.
- Error loading audit events.
- Empty event list renders no rows.

API:

- `GET /api/audit-events`
- `GET /api/datasets/{batch_id}/qc/progress`

Permissions:

- Route guard requires `audit:read`.
- Backend enforces full audit vs self-audit boundaries.

## Core Component List

| Component | File | Responsibility |
| --- | --- | --- |
| `AppShell` | `frontend/src/app/layouts/AppShell.vue` | Global sidebar/topbar, current batch navigation, user center entry, review focus mode. |
| `MetricCard` | `frontend/src/shared/components/MetricCard.vue` | Reusable metric card with icon and tone. |
| `StatusChip` | `frontend/src/shared/components/StatusChip.vue` | Status badge with color derived from status string. |
| `CategoryChip` | `frontend/src/shared/components/CategoryChip.vue` | Category display chip. |
| `BBoxOverlay` | `frontend/src/shared/components/BBoxOverlay.vue` | Image stage, 0-1000 bbox projection, bbox editing, wheel zoom, middle-button pan. |
| `AssetTable` | `frontend/src/features/datasets/components/AssetTable.vue` | Asset filtering, thumbnails, status columns, sample review link. |
| `DatasetDashboardCards` | `frontend/src/features/datasets/components/DatasetDashboardCards.vue` | Dataset overview metric group. |
| `DistributionPanel` | `frontend/src/features/datasets/components/DistributionPanel.vue` | Count/ratio distribution rows and bars. |
| `LabelConfigUploadPanel` | `frontend/src/features/datasets/components/LabelConfigUploadPanel.vue` | Type-level label config upload, validate, save, activate, reload, version list. |
| `ImportStepper` | `frontend/src/features/import/components/ImportStepper.vue` | Import lifecycle step indicator. |
| `ReviewWorkbenchShell` | `frontend/src/features/review-workbench/components/ReviewWorkbenchShell.vue` | Accepted sample review layout and label edit interaction. |
| `useAsyncState` | `frontend/src/shared/composables/useAsyncState.ts` | Loading/error/data wrapper with stale request protection and route watch reload. |

## Shared Interaction And Exception States

Global route guard:

- All non-public routes call `ensureCurrentUser()`.
- Missing user redirects to `/login?redirect={target}`.
- Routes with `requiresAnyPermission` redirect to `/account` if missing permission.

Global data states:

- `loading-state`: pending backend data.
- `error-state`: backend or client error.
- `empty-state`: backend returned no data or no matched data.
- Stale request protection exists in `useAsyncState` and selected page loaders.

Media states:

- API image paths are normalized by `toBrowserMediaUrl`.
- Missing/failed media uses fallback UI instead of breaking the page.
- In Vite proxy mode, `/media` must be proxied together with `/api`.

Form states:

- Pending actions disable their buttons.
- Backend validation errors are surfaced as text messages.
- Import confirm is disabled when blocking issues exist.
- Review submit validates first and stops on validation failure.

## API Integration Summary

HTTP behavior:

- Base URL: `VITE_API_BASE_URL`, default `http://127.0.0.1:8000/api`.
- Fixture mode: `VITE_API_MODE=fixture`.
- Session token: stored in `localStorage` key `uvp.sessionToken`, sent as `X-Session-Token`.
- Dev user switch: dev mode sends `x-user-id` from `localStorage` key `uvp.devUserId`.
- Errors are normalized into `ApiClientError(status, message, payload)`.

Main API groups:

| Group | Frontend methods | Backend route shape |
| --- | --- | --- |
| Auth/current user | `login`, `logout`, `getCurrentUser` | `/auth/login`, `/auth/logout`, `/me` |
| Users/roles | `listUsers`, `createUser`, `updateUser`, `listRoleBindings`, `createRoleBinding`, `deleteRoleBinding` | `/users`, `/role-bindings` |
| Dataset types | `listDatasetTypes`, `createDatasetType` | `/dataset-types` |
| Batch summary/assets | `getDatasetBatchSummary`, `getDatasetBatchAssetSummary`, `listDatasetBatchAssets` | `/datasets/{batch_id}/summary`, `/assets`, `/assets/summary` |
| Import jobs | `createDatasetBatchImportJob`, `getDatasetBatchImportJob`, `scanImportJob`, `validateImportJob`, `confirmImportJob`, `retryImportJob` | `/datasets/{batch_id}/import-jobs` |
| Label config | `validateDatasetTypeLabelConfig`, `saveDatasetTypeLabelConfig`, `activateDatasetTypeLabelConfig`, `reloadActiveDatasetTypeLabelConfig`, `getActiveDatasetTypeLabelConfig` | `/dataset-types/{type}/label-configs` |
| Preannotation | `getDatasetBatchPreannotationSummary` | `/datasets/{batch_id}/summary` |
| QC workspace | `getDatasetBatchQcWorkspace`, `listDatasetBatchQcQueue`, `generateQcQueue`, `getDatasetBatchQcProgress` | `/datasets/{batch_id}/qc` |
| Assignment | `getBatchAssignment`, `assignBatch`, `reassignBatch`, `releaseBatchAssignment` | `/datasets/{batch_id}/qc/assignment` |
| Review sample | `getReviewSample` | `/datasets/{batch_id}/samples/{sample_id}/review` |
| Lease | `acquireSampleLease`, `heartbeatSampleLease`, `releaseSampleLease` | `/datasets/{batch_id}/samples/{sample_id}/lease` |
| Label edit | `validateLabelEdit`, `getMyLabelEditDraft`, `getLabelEditHistory`, `submitLabelEdit`, `confirmLabelEditSubmission`, `returnLabelEditSubmission` | `/datasets/{batch_id}/samples/{sample_id}/label-edits` |
| Audit | `listAuditEvents` | `/audit-events` |

## Permission And Operation Boundaries

| Operation | UI boundary | Backend boundary |
| --- | --- | --- |
| Login | Public route only. | Internal account auth. |
| Dataset type creation | Visible on dataset center. | Backend permission enforcement. |
| Batch registration/import | Visible on dataset center/import job pages. | Import/job permissions. |
| Label config upload/activation | Type-level panel only. | Label config management permissions. |
| QC queue generation | Only when batch is `preannotation_ready` and queue is missing. | QC queue generation permission and label-config readiness. |
| Batch assignment | Form only when `canManageAssignments`. | `batch_assignment:manage` and concrete batch scope. |
| Sample edit | Requires assignment to current user, active lease, and active label config. | Lease, assignment, label edit permissions, task revision. |
| Save draft | Requires editability and at least one patch operation. | User-owned draft. |
| Submit changes | Validates first, requires editability and patch operations. | Immutable submission awaiting qc_lead confirmation. |
| Confirm/return submission | Buttons enabled only for confirmation-capable users. | `qc_submission:confirm` or equivalent backend permission. |
| Permission management | Route guard requires `users:manage` or `roles:manage`. | User and role management permissions. |
| Audit page | Route guard requires `audit:read`. | Full audit vs self-audit rules enforced server-side. |

## Validation

Frontend checks:

```bash
cd frontend
source ~/.nvm/nvm.sh
nvm use "$(cat ../.nvmrc)"
npm run test
npm run build
```

Focused checks commonly used:

```bash
npm run test -- routesAndPages apiClient
```

Live review after agent implementation should use the agent worktree stack from the main workspace:

```bash
scripts/agent-dev-stack.sh start
scripts/agent-dev-stack.sh status
scripts/agent-dev-stack.sh stop
```

End-to-end browser smoke should use the integration runner:

```bash
scripts/integration-smoke.sh main
scripts/integration-smoke.sh agent
```

The runner captures headless screenshots for the batch overview `模型评估` / `版本历史` sections and the sample-pool `导出管理` section.

Always stop frontend/backend services after live verification.

# Dataset Type Pages

Last updated: 2026-05-20

## 数据集中心

Route: `/datasets`

Component: `DatasetsPage.vue`

Layout:

```text
+------------------------------------------------------------------+
| Header: 数据集中心 + 新增数据集类型                                |
+------------------------------------------------------------------+
| Optional create-type form                                          |
+------------------------------------------------------------------+
| Dataset type cards                                                 |
| - type identity, active label config, field schema, batch count     |
| - enter type detail, label config, create batch                     |
+------------------------------------------------------------------+
```

Fields:

- `datasetType`
- `displayName`
- `fieldSchemaVersion`
- `activeLabelConfigVersion`
- `batchCount`

Interactions:

- Create dataset type.
- Enter dataset type detail.
- Enter type-level label config.
- Start batch creation for a selected type.

States:

- Loading dataset types.
- Empty dataset type list.
- Create success/error.
- Backend error.

API:

- `GET /api/dataset-types`
- `POST /api/dataset-types`

Boundary:

- Login required.
- Backend enforces `dataset_type:create`.

## 数据集类型详情

Route: `/datasets/types/:datasetType`

Component: `DatasetTypePage.vue`

Layout:

```text
+------------------------------------------------------------------+
| Header: type identity + 标签配置 + 新建批次                         |
+------------------------------------------------------------------+
| Type status cards                                                  |
+------------------------------------------------------------------+
| Optional batch registration form                                    |
+------------------------------------------------------------------+
| Batch rows: overview, assets, import job, QC action                 |
+------------------------------------------------------------------+
```

Fields:

- Type identity and active label config.
- Batch: `id`, `batchKey`, `batchName`, `lifecycleStatus`, `activeImportJobId`, `latestImportJob`, `qcQueueId`, asset/preannotation/QC counters.
- New batch: `batchKey`, `batchName`, `sourceStructure`, `sourceUri`.
- Client scan counters: image files, STEP1 files, STEP2 parsed files, STEP2 failure files.

Interactions:

- Register a batch.
- Scan selected local directory names.
- Create import job.
- Generate QC queue for preannotation-ready batch.
- Navigate to overview/assets/import/QC.

States:

- Loading type detail.
- Empty batch list.
- Batch creation pending/success/error.
- Per-batch QC generation pending/success/error.

API:

- `GET /api/dataset-types/{dataset_type}`
- `POST /api/datasets/{batch_id}/import-jobs`
- `POST /api/datasets/{batch_id}/qc/generate`

Boundary:

- Login required.
- Backend enforces import and queue permissions.
- Label config activation remains type-level.

## 标签配置管理

Route: `/datasets/types/:datasetType/label-config`

Component: `DatasetTypePage.vue`, label config section

Layout:

```text
+------------------------------------------------------------------+
| Header: 标签配置管理 + type context                                |
+------------------------------------------------------------------+
| Upload and validation panel                                        |
+------------------------------------------------------------------+
| Current active config summary                                      |
+------------------------------------------------------------------+
| Read-only version history                                          |
+------------------------------------------------------------------+
```

Fields:

- Uploaded JSON file.
- `config.version`
- `configId`
- `contentHash`
- validation issues
- enum/open-tag field summaries
- saved version status and timestamps

Interactions:

- Upload local `label_config.json`.
- Validate config.
- Save and activate uploaded config.
- Reload active config.
- Compare history rows.

States:

- Loading active/history.
- Invalid config.
- Duplicate content reuse.
- Semantic version conflict.
- Save pending/error.

API:

- `GET /api/dataset-types/{dataset_type}/label-configs`
- `POST /api/dataset-types/{dataset_type}/label-configs/validate`
- `POST /api/dataset-types/{dataset_type}/label-configs`
- `GET /api/dataset-types/{dataset_type}/label-config/active`
- `POST /api/dataset-types/{dataset_type}/label-config/active/reload`

Boundary:

- Login required.
- Backend enforces `label_config:manage`.
- Normal UI does not expose historical rollback activation.

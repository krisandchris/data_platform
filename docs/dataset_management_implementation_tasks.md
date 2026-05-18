# 数据集管理模块实现任务拆解

## 目标

基于 `docs/dataset_asset_import_usage_logic_design.md`，把数据集、批次、资产统计/浏览、导入任务编排实现为统一的数据集管理模块。

本轮只拆解实现与测试任务，不要求改动质检审阅台。

## 硬性边界

严禁修改当前质检审阅台的界面布局与功能。

受保护范围：

- `frontend/src/features/review-workbench/**`
- `frontend/src/shared/components/BBoxOverlay.vue`
- `frontend/src/test/bboxOverlay.test.ts`
- `docs/qc_step_review_field_layout_preview.html`
- `docs/qc_step_review_field_layout_design.md`
- `docs/qc_image_middle_pan_design.md`
- `docs/qc_bbox_color_palette_scope_plan.md`

允许的最小接触：

- 可以运行现有审阅台测试作为回归验证。
- 可以新增独立的集成测试，验证从资产列表或质检队列跳转到现有审阅页时 URL 仍携带当前 `dataset_id` 和 `sample_id`。
- 不得修改审阅台 DOM 结构、布局 CSS、bbox 交互、底栏按钮、Relation/Candidate 编辑行为。
- 不得变更现有审阅台 API 请求/响应字段语义；如后端增加批次校验，只能保持兼容并补充错误分支测试。

## 总体实现顺序

1. 后端先冻结数据模型和 API 契约。
2. 后端实现批次、导入任务、资产统计和批次级队列的最小可用接口。
3. 前端更新数据集列表、概览、资产页、导入任务页与导航编排。
4. 测试线补齐后端契约、前端路由/渲染、端到端批次流转和审阅台不变回归。
5. 联调后关闭所有前后端服务。

## 后端实现任务

### BE-1 数据模型与契约扩展

目标：

- 明确 `DatasetType`、`DatasetBatch`、`DatasetBatchAsset`、`AssetSummary`、`ImportJob`、`ImportValidationReport` 的后端契约。
- 扩展当前 `DatasetLifecycleStatus`，覆盖导入、预标注、质检、导出状态。

实现范围：

- `src/urban_violation_backend/api_schemas.py`
- `src/urban_violation_backend/schemas.py`
- `src/urban_violation_backend/service.py`
- `tests/test_api.py` 或新增后端契约测试。

任务：

- 增加类型级字段：`dataset_type`、`display_name`、`active_label_config_version`、`field_schema_version`。
- 增加批次级字段：`dataset_id`、`dataset_type`、`batch_key`、`lifecycle_status`、`active_import_job_id`、`qc_queue_id`。
- 保留当前 `urban_violation` 兼容入口，内部可映射为默认批次，例如 `urban_violation__0508_fixture`。
- 所有响应必须继续保证浏览器媒体 URL 不暴露本地绝对路径。

验收：

- 数据集列表能返回按类型/批次表达所需字段。
- 当前 `urban_violation` 旧 URL 仍可工作，避免破坏现有页面。
- 后端测试覆盖生命周期状态枚举。

### BE-2 类型级 `label_config` 兼容改造

目标：

- 同类型共享 active `label_config`。
- 保持现有 `/api/datasets/{dataset_id}/label-configs/*` 兼容。

实现范围：

- Label config repository/service 相关代码。
- 现有 label config API 测试。

任务：

- 上传时从 `dataset_id` 解析 `dataset_type`。
- 保存和激活配置时写入类型级作用域。
- 审阅、资产、导入流程读取当前批次所属类型的 active config。

验收：

- `urban_violation__0508_fixture` 和后续同类型批次能读取同一 active config。
- 旧路径 validate/save/activate/active/suggestions 均保持可用。

### BE-3 导入任务编排接口

目标：

- 导入任务成为批次创建/更新流程的一部分。

实现接口：

```text
GET  /api/datasets/{dataset_id}/import-jobs
POST /api/datasets/{dataset_id}/import-jobs
GET  /api/datasets/{dataset_id}/import-jobs/{job_id}
POST /api/datasets/{dataset_id}/import-jobs/{job_id}/scan
POST /api/datasets/{dataset_id}/import-jobs/{job_id}/validate
POST /api/datasets/{dataset_id}/import-jobs/{job_id}/confirm
POST /api/datasets/{dataset_id}/import-jobs/{job_id}/retry
```

任务：

- 禁止创建无 `dataset_id` 的导入任务。
- scan/validate 阶段只写入任务临时报告，不写最终资产。
- confirm 阶段写入当前批次资产、预标注产物、失败诊断和审计记录。
- 把 STEP2 failure 作为非阻塞告警，不能阻塞导入。
- 导入完成后推进批次状态到 `imported`，再根据预标注和 label config 推进到 `preannotation_ready`、`label_config_required` 或 `qc_ready`。

验收：

- 当前测试源导入统计为 797 images、797 STEP1、780 STEP2 parsed、19 STEP2 failures。
- 19 个 failure 出现在 validation warning/diagnostic 中，不触发 `ValidationFailed`。
- `QCQueueGenerated` 只作用于当前批次队列。

### BE-4 批次级资产统计与浏览

目标：

- 资产统计和列表完全按 `dataset_id` 隔离。

实现接口：

```text
GET /api/datasets/{dataset_id}/assets/summary
GET /api/datasets/{dataset_id}/assets
GET /api/datasets/{dataset_id}/assets/{sample_id}
```

任务：

- 增加资产统计：媒体有效性、导入健康、STEP1/STEP2 覆盖、模型判断、类别分布、QC 进度。
- 扩展资产筛选：STEP1/STEP2 状态、模型判断、类别、sample category、置信度、QC 状态、媒体状态、人工修改状态。
- `assets/{sample_id}` 必须校验样本属于当前批次。

验收：

- 跨批次不能读取对方资产。
- STEP2 failure 资产仍在同一批次资产列表可见。
- 资产详情只读，不承担标签编辑。

### BE-5 批次级质检队列保护

目标：

- 队列生成、队列列表、样本详情、草稿、提交全部绑定当前批次。

任务：

- 队列条目携带 `qc_queue_id`、`dataset_id`、`dataset_type`、`batch_key`、`sample_id`、`label_config_version`。
- `/api/datasets/{dataset_id}/qc` 只返回当前批次。
- `/api/datasets/{dataset_id}/samples/{sample_id}/review` 校验 sample 属于当前批次。
- label edit validate/save/submit 保持现有功能，不改变审阅台交互契约。

验收：

- 同类型不同批次不串队列、不串草稿、不串提交结果。
- 现有审阅台接口响应字段保持兼容。

## 前端实现任务

### FE-1 类型与 API 客户端

目标：

- 前端类型和 API 客户端支持类型 + 批次 + 导入任务编排。

实现范围：

- `frontend/src/shared/types/contract.ts`
- `frontend/src/services/urbanViolationApi.ts`
- 相关 API client 测试。

任务：

- 扩展 `DatasetLifecycleStatus`。
- 增加 `DatasetType`、`DatasetBatch`、`AssetSummary`、`ImportValidationReport` 类型。
- 增加 import job list/create/scan/validate/confirm/retry 客户端方法。
- 保持 review API、label edit API、BBoxOverlay 类型不变。

验收：

- API normalize 能兼容当前后端 fixture 响应。
- 不修改 `review-workbench` 和 `BBoxOverlay`。

### FE-2 数据集列表页

目标：

- 从单层数据集卡片改为类型分组 + 批次列表。

实现范围：

- `frontend/src/features/datasets/DatasetsPage.vue`
- 相关样式和测试。

任务：

- 主按钮从“导入数据”改为“新建批次”。
- 按 `dataset_type` 分组展示批次。
- 批次行展示状态、资产数、预标注覆盖、质检进度、最新导入任务。
- 入口指向当前批次概览或批次创建向导。

验收：

- `urban_violation` 显示为类型。
- 默认测试批次可进入概览、资产、导入任务、质检队列。

### FE-3 数据集概览页

目标：

- 概览页成为批次工作台。

实现范围：

- `frontend/src/features/datasets/DatasetOverviewPage.vue`
- `frontend/src/features/datasets/components/*`

任务：

- 展示类型、批次、生命周期、active label config、最新导入任务。
- 增加生命周期时间线或状态卡。
- 增加资产统计、导入健康、预标注覆盖、模型分布、QC 进度。
- 主按钮根据生命周期切换：继续导入、查看资产、上传配置、进入质检队列等。
- 把“创建质检任务”文案改为“进入质检队列”。

验收：

- `qc_ready/qc_in_progress` 下只能显示“进入质检队列”。
- 页面跳转保持当前 `dataset_id`。
- 不改审阅台页面。

### FE-4 批次资产页

目标：

- 资产页定位为当前批次资产统计与浏览。

实现范围：

- `frontend/src/features/datasets/DatasetAssetsPage.vue`
- `frontend/src/features/datasets/components/AssetTable.vue`

任务：

- 页头显示当前批次上下文和资产统计。
- 增加或整理筛选项：STEP1/STEP2、模型判断、类别、sample category、置信度、QC、媒体状态、人工修改状态。
- 表格只提供浏览、筛选、跳转，不直接编辑标签。
- `sample_id` 链接仍指向 `/datasets/{dataset_id}/samples/{sample_id}/review`。

验收：

- 资产列表只展示当前批次。
- STEP2 failure 样本可筛选、可跳转现有审阅页。

### FE-5 导入向导/任务页

目标：

- 导入任务页并入批次创建流程。

实现范围：

- `frontend/src/features/import/ImportJobPage.vue`
- `frontend/src/features/import/components/ImportStepper.vue`
- 可新增 `DatasetBatchCreatePage.vue` 或批次创建组件。

任务：

- 页面标题改为“批次创建 / 导入校验”。
- 导入步骤使用：批次信息、数据源、扫描校验、导入预览、确认入库、完成。
- 展示阻塞错误和非阻塞告警。
- 确认导入调用 confirm 接口。
- 完成后根据批次状态引导去概览、资产、标签配置或质检队列。
- 左侧导航移除全局“导入任务”入口，导入历史放在批次详情内。

验收：

- 导入任务页面始终带 `dataset_id`。
- 当前 fixture import 能显示 797/797/780/19。
- 不触碰审阅台布局和功能。

## 测试与联调任务

### QA-1 后端契约测试

覆盖：

- dataset type + batch 列表。
- 生命周期状态转换。
- import job create/scan/validate/confirm/retry。
- STEP2 failure 非阻塞。
- asset summary/list/detail 批次隔离。
- qc queue batch scope。
- label config type scope 兼容旧 dataset path。

命令：

```bash
uv run pytest
```

### QA-2 前端单元/组件测试

覆盖：

- API client normalize。
- 数据集类型分组和批次行。
- 概览页生命周期动作。
- 资产列表筛选。
- 导入任务 stepper 和预览。
- 跳转 URL 保持当前 `dataset_id`。

命令：

```bash
cd frontend
npm run test
npm run build
```

### QA-3 审阅台不变回归

目标：

- 证明本轮没有改坏当前质检审阅台。

执行方式：

- 运行现有 `ReviewWorkbenchPage`、`BBoxOverlay`、route 相关测试。
- 只读打开一个成功样本和一个 STEP2 failure 样本。
- 检查 URL、页面加载、现有底栏按钮、bbox 渲染、Relation/Candidate 区域仍可用。

禁止：

- 不为了测试去改审阅台组件。
- 不调整审阅台 CSS。
- 不改 bbox 交互。

### QA-4 端到端联调

流程：

1. 打开数据集列表。
2. 查看 `urban_violation` 类型与测试批次。
3. 进入批次概览。
4. 查看导入任务预览，确认 797/797/780/19。
5. 进入资产页，筛选 STEP2 failure。
6. 从资产行跳转到现有审阅页。
7. 回到批次质检队列，确认队列只属于当前批次。
8. 测试完成后关闭前后端服务。

命令：

```bash
scripts/dev-stack.sh start
# run smoke checks
scripts/dev-stack.sh stop
```

验收：

- 服务停止后 `scripts/dev-stack.sh status` 显示 backend/frontend stopped。
- 不存在残留 `vite` 或 `urban_violation_backend.app` 进程。

## 建议执行顺序

1. BE-1 + FE-1：先冻结类型和契约。
2. BE-3：导入任务编排后端。
3. BE-4：资产统计与浏览后端。
4. BE-5：批次级队列保护。
5. FE-2 + FE-3：数据集列表和概览。
6. FE-4：资产页。
7. FE-5：导入任务页。
8. QA-1 到 QA-4：完整回归和联调。

## 最终验收标准

- 数据集管理模块使用类型 + 批次模型。
- 资产浏览和导入任务都融入当前批次管理。
- 当前 `DATASET/urban_violation` 测试数据可作为一个批次完成导入预览、资产浏览、质检队列进入。
- 同类型不同批次不共享资产、队列、草稿、提交结果。
- 现有质检审阅台布局和功能没有发生改动。

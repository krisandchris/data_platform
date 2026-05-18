# 数据集、资产、导入任务使用逻辑设计

## 设计范围

本文档用于约束数据集、资产、导入任务三个能力在数据集管理模块中的产品逻辑与实现边界。

核心结论：

- 数据集按“类型 + 批次”管理。
- 同一数据集类型共享一套字段设计、标签字典、校验规则与 `label_config`。
- 单个批次承载真实资产、预标注产物、质检队列、人工修改与导出结果。
- 导入任务是数据集批次创建/更新流程的一部分，负责把外部数据源扫描、校验、预览并确认写入当前批次。
- 进入质检队列的数据必须按批次隔离；同一类型共享配置，但不共享队列实例和质检进度。
- 预标注是标签来源，因此数据集生命周期必须显式包含预标注准备、执行、失败、就绪状态。

## 数据集类型与批次模型

### 类型级对象

`urban_violation` 是数据集类型，不是唯一批次。类型级对象负责保存跨批次共享的标注协议。

建议字段：

```json
{
  "dataset_type": "urban_violation",
  "display_name": "城市违规",
  "field_schema_version": "2026-05-18",
  "active_label_config_id": "label_config_urban_violation_v1",
  "active_label_config_version": 1,
  "status": "active"
}
```

类型级共享内容：

- 字段设计：Relation、Fact Verification、Candidate、裁决字段的结构。
- `label_config`：闭集枚举、开放标签字段、字段合法性规则、显示名。
- 标签字典：类别、关系、验证结果、可见性等级等闭集字段。
- 质检编辑布局规则：哪些字段可编辑、只读、可新增、可删除。

### 批次级对象

批次是平台实际处理的工作单元。后续命名可以使用日期或场景后缀。

建议 ID：

```text
urban_violation__20260518
urban_violation__night_market_202605
urban_violation__roadside_batch_a
```

建议字段：

```json
{
  "dataset_id": "urban_violation__20260518",
  "dataset_type": "urban_violation",
  "batch_key": "20260518",
  "batch_name": "2026-05-18 批次",
  "lifecycle_status": "qc_ready",
  "source_root": "DATASET/urban_violation",
  "active_import_job_id": "fixture-import-urban-violation",
  "asset_total": 797,
  "stage1_total": 797,
  "stage2_success_total": 780,
  "stage2_failure_total": 19,
  "qc_queue_id": "qcq_urban_violation_20260518",
  "qc_progress": {
    "pending": 797,
    "submitted": 0
  }
}
```

批次级独有内容：

- 原始图片与媒体资产。
- 导入任务与导入校验结果。
- STEP1/STEP2 预标注产物。
- 预标注失败文件。
- 质检队列、人工修改草稿、提交结果。
- 导出任务与导出包。

## 批次级质检队列归属规则

质检队列必须归属到具体数据集批次，而不是归属到数据集类型。

原因：

- 同一类型下不同批次的数据来源、导入时间、预标注覆盖率和失败样本不同。
- 质检进度、跳过样本、保存草稿、提交修改都只能对当前批次生效。
- 同一 `urban_violation` 类型虽然共享 `label_config`，但 `urban_violation__20260518` 与 `urban_violation__night_market_202605` 应拥有不同队列。

队列条目必须至少携带：

```json
{
  "qc_queue_id": "qcq_urban_violation_20260518",
  "dataset_id": "urban_violation__20260518",
  "dataset_type": "urban_violation",
  "batch_key": "20260518",
  "sample_id": "000142_0_1762483003246",
  "preannotation_run_id": "stage1_0508__stage2_0508",
  "label_config_version": 1,
  "review_status": "pending"
}
```

交互规则：

- 从数据集概览页点击“进入质检队列”时，进入的是当前批次的队列。
- `/datasets/{dataset_id}/qc` 只展示该 `dataset_id` 下的队列条目。
- `/datasets/{dataset_id}/samples/{sample_id}/review` 必须校验样本属于该批次。
- 当前批次的 `qc_ready`、`qc_in_progress`、`qc_completed` 只由该批次队列进度计算。
- 同类型多批次可以共享候选类别、关系枚举、字段校验规则，但不能混合排队、混合进度、混合提交结果。
- 如果未来需要跨批次给标注员分配任务，应新增“工作台任务视图”作为多个批次队列的聚合投影，不应把多个批次合并成一个真实质检队列。

## 数据集批次生命周期状态机

### 状态分层

数据集批次生命周期分为四条逻辑链路：

- 创建与导入链路：从批次登记到资产入库。
- 预标注链路：从无标签到 STEP1/STEP2 产物就绪。
- 质检链路：从标签配置检查到人工修改完成。
- 归档链路：从可导出到只读冻结。

### 状态定义

| 状态 | 含义 | 允许的主要动作 |
| --- | --- | --- |
| `draft` | 只创建了批次元信息，尚未绑定数据源 | 编辑批次信息、选择数据源 |
| `registered` | 已绑定数据源或上传包，尚未扫描 | 开始扫描 |
| `scanning` | 正在枚举图片、STEP1、STEP2、manifest 等文件 | 查看扫描进度 |
| `validation_failed` | 文件配对、结构或必要字段校验失败 | 查看错误、修复后重新扫描 |
| `validated` | 导入前校验通过，等待确认入库 | 确认导入 |
| `importing` | 正在写入资产与预标注原始产物 | 查看进度 |
| `import_failed` | 入库过程失败 | 查看错误、重试导入 |
| `imported` | 原始资产已可浏览，预标注产物已被登记 | 查看资产、检查预标注状态 |
| `preannotation_pending` | 资产已入库，但尚无可用预标注标签 | 启动预标注 |
| `preannotating` | STEP1/STEP2 预标注正在执行 | 查看任务进度 |
| `preannotation_failed` | 预标注任务整体失败或可用覆盖率不足 | 查看失败、重试、人工处理 |
| `preannotation_ready` | 预标注结果可用于质检，失败样本也被保留为诊断产物 | 检查标签配置、生成当前批次质检队列 |
| `label_config_required` | 当前类型没有激活的 `label_config`，阻塞质检编辑 | 上传/激活类型级标签配置 |
| `qc_ready` | 当前批次预标注已就绪且类型级 `label_config` 已激活 | 进入当前批次质检队列 |
| `qc_in_progress` | 当前批次已有人开始修改或提交部分样本 | 继续质检、查看当前批次进度 |
| `qc_completed` | 目标质检范围已完成 | 生成导出 |
| `export_ready` | 已存在可用导出结果 | 下载导出、归档 |
| `archived` | 批次冻结，只读保留 | 查看历史 |

### 主路径

```text
draft
  -> registered
  -> scanning
  -> validated
  -> importing
  -> imported
  -> preannotation_ready
  -> qc_ready
  -> qc_in_progress
  -> qc_completed
  -> export_ready
  -> archived
```

### 失败与等待路径

```text
scanning -> validation_failed -> registered
importing -> import_failed -> validated
imported -> preannotation_pending -> preannotating -> preannotation_ready
preannotating -> preannotation_failed -> preannotation_pending
preannotation_ready -> label_config_required -> qc_ready
```

### 当前 `DATASET/urban_violation` 的映射

当前测试数据已经包含图片、STEP1、STEP2 成功产物与 STEP2 失败文件，因此注册后不需要等待平台重新跑预标注。

导入后的状态判断：

- 资产、STEP1、STEP2 manifest 校验通过后进入 `imported`。
- 因为已有 STEP1/STEP2 产物，继续进入 `preannotation_ready`。
- 如果 `urban_violation` 类型已激活 `label_config`，进入 `qc_ready`。
- 如果没有激活配置，进入 `label_config_required`。

注意：STEP2 的 19 个失败文件不是数据集导入失败。它们应作为预标注失败诊断产物保留，并在资产列表、预标注页、质检入口中可见。

## 事件与转换规则

| 事件 | 前置状态 | 目标状态 | 规则 |
| --- | --- | --- | --- |
| `create_batch` | 无 | `draft` | 必须选择 `dataset_type` 与 `batch_key` |
| `attach_source` | `draft` | `registered` | 数据源可以是本地目录、上传包或对象存储路径 |
| `start_scan` | `registered` | `scanning` | 创建导入任务，导入任务进入扫描流程 |
| `scan_validation_failed` | `scanning` | `validation_failed` | 阻塞性错误必须列出样本、文件、字段与原因 |
| `scan_validation_passed` | `scanning` | `validated` | 允许用户确认导入 |
| `start_import` | `validated` | `importing` | 导入任务写入资产与预标注产物 |
| `import_failed` | `importing` | `import_failed` | 保留可恢复错误与重试入口 |
| `import_succeeded` | `importing` | `imported` | 资产可浏览 |
| `preannotation_missing` | `imported` | `preannotation_pending` | 没有 STEP1/STEP2 可用标签 |
| `start_preannotation` | `preannotation_pending` | `preannotating` | 平台触发模型预标注任务 |
| `preannotation_succeeded` | `preannotating`/`imported` | `preannotation_ready` | 预标注产物达到可质检条件 |
| `preannotation_failed` | `preannotating` | `preannotation_failed` | 预标注整体失败或覆盖率低于阈值 |
| `label_config_missing` | `preannotation_ready` | `label_config_required` | 当前 `dataset_type` 没有激活配置 |
| `label_config_activated` | `label_config_required`/`preannotation_ready` | `qc_ready` | 激活的是类型级配置，不是批次私有配置 |
| `enter_qc_queue` | `qc_ready` | `qc_in_progress` | 用户进入当前批次质检队列，队列生成和读取都必须带 `dataset_id` |
| `review_progress_updated` | `qc_in_progress` | `qc_in_progress` | 当前批次局部样本状态变化 |
| `review_scope_completed` | `qc_in_progress` | `qc_completed` | 当前批次所有目标样本达到完成标准 |
| `create_export` | `qc_completed` | `export_ready` | 生成可追溯导出结果 |
| `archive_batch` | `export_ready`/`qc_completed` | `archived` | 冻结批次编辑入口 |

## 与导入任务状态的关系

数据集生命周期是批次的业务状态；导入任务状态是某一次导入执行的任务状态。二者不能合并。

例如：

- 一个批次可以有多次导入任务历史。
- 当前批次状态可以是 `validation_failed`，同时最新导入任务状态是 `ValidationFailed`。
- 当前批次状态可以是 `qc_ready`，导入任务状态仍停留在 `Imported` 或 `QCQueueGenerated`。
- 重新导入补充资产时，应创建新的导入任务，并按策略决定批次是否回退到 `scanning`/`validated`。
- 导入任务生成质检队列时，生成对象是当前批次的 `qc_queue_id`，不是 `dataset_type` 的全局队列。

## 页面使用逻辑

### 数据集列表页

目标：让用户先按类型理解数据，再进入具体批次。

展示方式：

- 一级分组：`dataset_type`，例如 `urban_violation`。
- 二级列表：该类型下的各批次。
- 类型头部展示：
  - 类型名称。
  - 激活 `label_config` 版本。
  - 字段设计版本。
  - 批次数量。
- 批次行展示：
  - 批次名与 `batch_key`。
  - 生命周期状态。
  - 资产数。
  - STEP1/STEP2 覆盖率。
  - 预标注失败数。
  - 质检进度。
  - 最新导入任务状态。
- “进入质检队列”按钮必须位于批次行或批次概览页上，不能只挂在类型头部，否则会丢失批次上下文。

### 数据集概览页

目标：展示单个批次当前是否可用、卡在哪一步、下一步能做什么。

页面顶部信息：

- 数据集类型：`urban_violation`。
- 批次：日期或场景后缀。
- 生命周期状态。
- 继承的类型级 `label_config`。
- 最新导入任务。

核心区域：

- 生命周期时间线。
- 资产与预标注覆盖卡片。
- STEP2 失败诊断入口。
- 类型级标签配置卡片。
- 最近导入任务与质检进度。

主按钮规则：

| 生命周期状态 | 主按钮 |
| --- | --- |
| `draft`/`registered` | 创建/继续导入任务 |
| `validation_failed` | 查看导入错误 |
| `validated` | 确认导入 |
| `imported` | 查看资产 |
| `preannotation_pending` | 启动预标注 |
| `preannotation_failed` | 查看预标注失败 |
| `preannotation_ready` 且无配置 | 上传标签配置 |
| `label_config_required` | 上传/激活标签配置 |
| `qc_ready`/`qc_in_progress` | 进入质检队列 |
| `qc_completed` | 生成导出 |
| `export_ready` | 查看导出 |
| `archived` | 只读查看 |

现有“创建质检任务”按钮应改为“进入质检队列”。如果队列尚未生成，可在点击后执行“生成队列并进入”，但文案上仍应强调进入工作队列，而不是创建一次性任务。

该按钮必须始终绑定当前 `dataset_id`。用户从 `urban_violation__20260518` 进入队列时，只能看到该批次资产；切换到同类型其他批次需要先回到对应批次概览或批次队列。

### 类型级标签配置入口

因为同一类型共享 `label_config`，上传入口可以在批次概览页出现，但保存位置必须是类型级。

推荐交互：

- 在任意 `urban_violation` 批次概览页上传配置。
- 后端校验配置中的 `dataset_type` 必须等于当前批次的类型。
- 激活后，所有 `urban_violation` 批次使用同一份 active config。
- 历史批次保留提交时使用的配置版本号，保证审计可追溯。

## 资产统计与浏览功能设计

### 产品定位

资产浏览不应作为脱离数据集的独立顶层模块。资产是某个数据集批次中的样本行，资产统计与浏览应融入数据集批次详情。

推荐结构：

```text
数据集类型 urban_violation
  └── 批次 urban_violation__20260518
        ├── 概览
        ├── 资产
        ├── 预标注
        ├── 质检队列
        ├── 导入任务
        └── 标签配置
```

其中“资产”页对应当前已有的 `/datasets/{dataset_id}/assets`，但产品语义应改为“当前批次资产浏览”，而不是全局资产库。

### 资产定义

资产是批次内的一条可浏览样本，通常由一张原始图片和该图片关联的导入、预标注、质检状态组成。

资产最小字段：

```json
{
  "asset_id": "asset_000142_0_1762483003246",
  "dataset_id": "urban_violation__20260518",
  "dataset_type": "urban_violation",
  "batch_key": "20260518",
  "sample_id": "000142_0_1762483003246",
  "image_url": "/media/urban_violation__20260518/000142_0_1762483003246.jpg",
  "width": 1280,
  "height": 720,
  "import_status": "imported",
  "preannotation_status": "stage2_ready",
  "qc_status": "queued",
  "label_edit_status": "none",
  "judge_decision": "pass",
  "violation_categories": ["nonmotor_vehicle_illegal_parking"],
  "sample_categories": ["positive samples"],
  "candidate_count": 1,
  "highest_confidence": 0.95
}
```

资产归属规则：

- 资产必须归属到具体 `dataset_id`。
- 同一张图片如果出现在两个批次中，应作为两个批次内的不同资产记录处理。
- MVP 不提供跨批次移动、复制或重新归属资产；批次边界由导入任务决定。
- 资产浏览可以读取类型级 `label_config` 做字段显示和标签翻译，但不能把资产挂到类型级全局列表。

### 批次概览中的资产统计

数据集批次概览页应直接展示资产统计，帮助用户判断这个批次是否完整、是否可预标注、是否可质检。

建议统计分组：

| 统计组 | 指标 | 用途 |
| --- | --- | --- |
| 基础资产 | 总图片数、有效图片数、缺失图片数、分辨率分布、文件格式分布 | 判断批次媒体是否完整 |
| 导入健康 | 已导入、重复 `sample_id`、孤立标注、路径失效、schema 警告 | 判断导入质量 |
| 预标注覆盖 | STEP1 ready、STEP2 ready、STEP2 failed、STEP2 missing | 判断标签来源是否可用 |
| 模型判断 | `pass/soft_fail`、类别分布、样本类别分布、置信度分布 | 判断预标注质量和难度 |
| 质检进度 | 已入队、未入队、跳过、草稿、已提交 | 判断人工处理进度 |

当前 `DatasetSummary` 已经包含 `rawAssets`、STEP1/STEP2 计数、失败数、类别/置信度/sample category 分布，可继续扩展为 `assetSummary` 或 `assetHealth`。

### 资产浏览页

资产浏览页应服务两个目标：

- 浏览当前批次所有资产和状态。
- 快速筛出需要处理的样本，并跳转到当前批次的样本复核页。

推荐入口：

```text
/datasets/{dataset_id}/assets
```

推荐布局：

- 顶部显示当前批次上下文：类型、批次、资产总数、预标注覆盖、质检进度。
- 左侧或顶部提供筛选器。
- 主区域使用表格作为默认视图，后续可增加缩略图网格视图。
- 行级操作只做查看和跳转，不在资产列表中直接编辑标签。

推荐表格列：

| 列 | 内容 |
| --- | --- |
| `sample_id` | 批次内样本 ID，点击进入样本复核 |
| 缩略图 | 当前批次媒体 URL |
| 媒体状态 | 有效、缺失、加载失败、分辨率异常 |
| STEP1 | ready/missing/invalid |
| STEP2 | ready/failed/missing |
| 模型判断 | pass/soft_fail/unknown |
| 类别 | 候选违规类别 |
| 置信度 | 最高 Candidate 置信度 |
| 质检 | queued/skipped/draft/submitted |
| 最近更新 | 导入或人工修改时间 |

推荐筛选器：

- `sample_id` 搜索。
- STEP1 状态。
- STEP2 状态：ready、failed、missing。
- 模型判断：pass、soft_fail、unknown。
- 违规类别。
- sample category。
- 置信度区间。
- 质检状态：未入队、待处理、跳过、草稿、已提交。
- 媒体状态：有效、缺失、加载失败。
- 是否存在人工修改。

推荐排序：

- `sample_id`。
- 最近更新时间。
- 置信度从高到低或从低到高。
- STEP2 失败优先。
- 未质检优先。

### 资产详情与样本复核的边界

资产浏览页不直接承担标签编辑职责。

建议拆分：

- 资产详情：只读查看媒体、导入来源、预标注摘要、失败诊断、历史修改摘要。
- 样本复核页：进入沉浸式工作台，执行 bbox、Relation、Candidate、字段合法性校验、保存草稿、提交修改。

当前已有 `/datasets/{dataset_id}/samples/{sample_id}/review`，应继续作为编辑入口。资产表中的 `sample_id` 链接必须带当前 `dataset_id`，确保进入当前批次复核。

### 与批次级质检队列的关系

资产列表展示批次内全部资产；质检队列展示当前批次中需要人工处理的资产子集或排序视图。

默认建议：

- 当前批次所有已导入资产都可在资产页浏览。
- 当前批次所有具备 STEP1 产物的资产都可以进入质检队列。
- STEP2 成功资产进入正常复核流。
- STEP2 失败资产也保留在同一批次资产列表中，并以 `stage2_failed` 标记；进入质检时应打开人工补 Candidate/诊断处理模式。
- `跳过样本`、`保存草稿`、`提交修改`只改变当前批次内该资产的 QC/label edit 状态。

资产状态不应反向修改类型级配置。类型级配置只决定字段和校验规则，资产状态只反映该批次内样本处理进展。

## 导入任务编排设计

### 产品定位

导入任务不是独立业务模块，而是数据集批次创建和后续增量更新的执行记录。

推荐理解：

```text
创建数据集批次
  -> 创建导入任务
  -> 扫描数据源
  -> 校验样本配对和 schema
  -> 预览导入结果
  -> 确认入库
  -> 批次进入 imported / preannotation_ready / label_config_required / qc_ready
```

因此，页面和导航上不建议再保留一个脱离数据集上下文的“导入任务”一级模块。导入任务应出现在：

- 数据集列表页的“新建批次”入口。
- 数据集批次概览页的“继续创建 / 继续导入 / 查看导入历史”入口。
- 数据集批次详情下的“导入任务”子页或 Tab。

当前已有路径 `/datasets/{dataset_id}/import-jobs/{job_id}` 可以保留，但它应被理解为当前批次创建流程中的一个步骤页。

### 创建批次与导入任务的关系

批次是业务对象，导入任务是执行对象。

| 对象 | 生命周期职责 | 是否可多条 |
| --- | --- | --- |
| `DatasetBatch` | 表示一个具体数据集批次的业务状态和最终结果 | 一个批次一条 |
| `ImportJob` | 表示某一次扫描、校验、入库执行过程 | 一个批次可多条 |

推荐主流程：

1. 用户在数据集列表页点击“新建批次”。
2. 选择或确认 `dataset_type`，例如 `urban_violation`。
3. 填写 `batch_key`、批次名、数据来源。
4. 后端创建 `DatasetBatch`，状态为 `draft` 或 `registered`。
5. 后端创建当前批次的第一个 `ImportJob`，状态为 `Draft`。
6. 用户进入导入向导，导入任务推动批次生命周期前进。

不能先创建一个没有批次归属的导入任务；每个导入任务必须带 `dataset_id`。

### 导入任务状态与批次生命周期映射

导入任务状态仍使用执行状态机；批次生命周期使用业务状态机。二者映射如下：

| 导入任务状态 | 批次生命周期 | 含义 |
| --- | --- | --- |
| `Draft` | `draft`/`registered` | 批次已创建，导入信息未完成 |
| `Uploading`/`Uploaded` | `registered` | 用户正在上传包或绑定数据源 |
| `Scanning` | `scanning` | 正在枚举图片、manifest、STEP1、STEP2、失败文件 |
| `Validating` | `scanning` | 正在做文件配对、schema、bbox、路径校验 |
| `ValidationFailed` | `validation_failed` | 发现阻塞性问题，批次不能入库 |
| `ValidationPassed` | `validated` | 校验通过，可进入导入预览 |
| `PreviewReady` | `validated` | 用户可查看样本对齐、导入映射和告警 |
| `Importing` | `importing` | 正在写入批次资产和预标注产物 |
| `ImportFailed` | `import_failed` | 入库失败，需要重试或回滚 |
| `Imported` | `imported` | 资产和已有预标注产物已写入 |
| `QCQueueGenerated` | `qc_ready`/`qc_in_progress` | 当前批次质检队列已生成或已进入 |

`QCQueueGenerated` 不应代表类型级队列生成。它只能代表当前 `dataset_id` 的批次队列生成。

### 数据源模式

导入任务需要支持不同数据源形态，但第一阶段可以优先支持本地目录或已上传目录。

| 模式 | 说明 | MVP |
| --- | --- | --- |
| `local_directory` | 选择服务器可访问目录，例如 `DATASET/urban_violation` | 是 |
| `uploaded_package` | 前端上传 zip/tar 后由后端解压扫描 | 可后置 |
| `object_storage_prefix` | 从 MinIO/S3 前缀扫描 | 可后置 |
| `manifest_only` | 只上传 manifest，媒体已在对象存储中 | 可后置 |

当前 `DATASET/urban_violation` 应视为 `local_directory` 测试源。

### 导入向导步骤

当前 `ImportStepper` 的“基础信息、上传模式、目录扫描、导入预览、完成”方向是可复用的，但应并入“新建批次”向导。

建议步骤：

1. **批次信息**
   - 选择 `dataset_type`。
   - 填写 `batch_key`、批次名、说明。
   - 展示该类型当前 active `label_config` 状态。
2. **数据源**
   - 选择数据源模式。
   - 绑定目录、上传包或对象存储前缀。
   - 生成 `ImportJob(Draft/Uploading/Uploaded)`。
3. **扫描与校验**
   - 枚举图片。
   - 读取 `manifest.jsonl`、`plan.json`、STEP1、STEP2、failures。
   - 校验样本配对、路径可用性、schema、bbox 0-1000、重复样本、孤立标注。
4. **导入预览**
   - 展示样本对齐结果。
   - 展示阻塞错误、非阻塞告警、STEP2 失败拆分。
   - 展示实体映射：RawAsset、PreAnnotationStep1、PreAnnotationStep2、PreAnnotationFailure、AuditArtifact。
   - 用户确认后才进入真实写入。
5. **确认入库**
   - 写入当前批次资产。
   - 写入已有预标注产物和失败诊断。
   - 更新批次资产统计和预标注覆盖。
6. **完成与下一步**
   - 如果已有 STEP1/STEP2 产物：进入 `preannotation_ready`。
   - 如果没有预标注产物：进入 `preannotation_pending`。
   - 如果类型级 `label_config` 缺失：进入 `label_config_required`。
   - 如果预标注和配置都就绪：进入 `qc_ready`。

### 校验规则

导入任务的核心价值是把问题挡在批次入库前。建议分为阻塞错误和非阻塞告警。

阻塞错误：

- 图片文件缺失或不可读。
- `sample_id` 重复且无法确定覆盖策略。
- STEP1/STEP2 JSON 结构无法解析。
- bbox 不是 0-1000 量化坐标或坐标顺序非法。
- manifest 指向的关键文件缺失。
- `dataset_type` 与上传或选择的 label config 不一致。

非阻塞告警：

- STEP2 存在失败文件。
- STEP2 缺失但 STEP1 存在，后续需要预标注或人工补全。
- `records/` 中存在过期绝对图片路径，但可以按 `images/{sample_id}.jpg` 重新对齐。
- 类别不在当前 active `label_config` 中，需要质检阶段人工修正或配置扩展。

当前 `DATASET/urban_violation` 的 19 个 STEP2 failure 应是非阻塞告警，不应阻塞导入。

### 入库策略

确认导入时应保证批次结果一致。

建议规则：

- 校验预览阶段不写入最终资产，只保存导入任务临时结果和校验报告。
- 确认导入阶段才写入 `DatasetBatchAsset`、预标注记录、失败诊断和审计文件。
- 如果入库失败，应能回滚到导入前状态或标记 `import_failed` 并保留失败上下文。
- 原始外部路径只存为内部 provenance，浏览器端只返回平台媒体 URL。
- 业务导入优先读取 `parsed/` 与 manifest 配对结果；`records/requests/responses/meta` 作为审计材料保留。

### 增量导入与重新导入

MVP 建议先限制为“一个批次一次初始导入”。后续再支持增量。

推荐策略：

- 初始导入完成且尚未开始质检时，可以允许重新扫描并覆盖本批次导入结果。
- 一旦当前批次进入 `qc_in_progress`，禁止破坏性重新导入。
- 需要补充新样本时，优先创建同类型新批次。
- 如果确实要在同一批次增量追加，只允许追加新的 `sample_id`，不得覆盖已有已提交样本。
- 对已保存草稿或已提交修改的样本，重新导入只能创建差异报告，不能静默覆盖人工结果。

### 与预标注任务的关系

导入任务本身不等于模型预标注任务。

两种情况需要区分：

- **导入已有预标注产物**：像当前 `DATASET/urban_violation`，目录里已经有 STEP1/STEP2 结果。导入任务负责登记这些结果，完成后可直接进入 `preannotation_ready`。
- **只导入原始图片**：导入任务只生成资产，完成后进入 `preannotation_pending`，后续由预标注运行任务触发 STEP1/STEP2。

因此，导入任务可以“注册已有预标注产物”，但不应把模型推理执行和文件入库混成同一个状态机。模型推理应作为 `PreAnnotationRun` 管理。

### 页面编排

推荐调整：

- 数据集列表页主按钮从“导入数据”改为“新建批次”。
- 批次概览页在 `draft/registered/scanning/validation_failed/validated/importing/import_failed` 状态下突出“继续导入流程”。
- 导入任务详情页保留样本对齐、告警、映射关系，但标题改为“批次创建 / 导入校验”。
- 左侧导航不需要独立“导入任务”一级入口；可在数据集详情内部提供“导入任务”子入口。
- 导入历史用于审计和排障，不作为日常主工作入口。

### 当前测试数据的导入编排

`DATASET/urban_violation` 可作为数据集创建测试源：

1. 创建类型 `urban_violation` 下的批次，例如 `urban_violation__0508_fixture`。
2. 数据源选择 `DATASET/urban_violation`。
3. 扫描得到：
   - 797 张图片。
   - 797 条 STEP1 parsed。
   - 780 条 STEP2 parsed。
   - 19 条 STEP2 failures。
4. 导入预览展示 797 条样本对齐结果。
5. 用户确认导入后，批次进入 `imported`。
6. 因为已有预标注产物，继续进入 `preannotation_ready`。
7. 如果 `urban_violation` 类型 active `label_config` 存在，进入 `qc_ready`。
8. 用户点击“进入质检队列”时，生成或打开当前批次队列。

## 实现影响

### 前端类型建议

当前 `DatasetLifecycleStatus` 只有 `draft | active | archived`，不足以表达导入、预标注与质检阶段。

建议扩展为：

```ts
type DatasetLifecycleStatus =
  | 'draft'
  | 'registered'
  | 'scanning'
  | 'validation_failed'
  | 'validated'
  | 'importing'
  | 'import_failed'
  | 'imported'
  | 'preannotation_pending'
  | 'preannotating'
  | 'preannotation_failed'
  | 'preannotation_ready'
  | 'label_config_required'
  | 'qc_ready'
  | 'qc_in_progress'
  | 'qc_completed'
  | 'export_ready'
  | 'archived'
```

### 后端模型建议

需要拆分：

- `DatasetType`：类型级配置与字典。
- `DatasetBatch`：批次级资产、任务、生命周期。
- `DatasetBatchAsset`：批次内资产行，绑定 `dataset_id + sample_id`。
- `AssetSummary`：批次内资产统计与健康度。
- `ImportJob`：一次导入任务。
- `ImportValidationReport`：导入扫描/校验报告，保存阻塞错误、非阻塞告警和样本对齐行。
- `PreAnnotationRun`：一次 STEP1/STEP2 预标注任务。
- `LabelConfigVersion`：类型级标签配置版本。

### API 建议

```text
GET  /api/dataset-types
GET  /api/dataset-types/{dataset_type}
POST /api/dataset-types/{dataset_type}/label-configs/validate
POST /api/dataset-types/{dataset_type}/label-configs
POST /api/dataset-types/{dataset_type}/label-configs/{version}/activate

GET  /api/datasets
POST /api/datasets
GET  /api/datasets/{dataset_id}
GET  /api/datasets/{dataset_id}/summary
GET  /api/datasets/{dataset_id}/lifecycle
POST /api/datasets/{dataset_id}/lifecycle/events
GET  /api/datasets/{dataset_id}/import-jobs
POST /api/datasets/{dataset_id}/import-jobs
GET  /api/datasets/{dataset_id}/import-jobs/{job_id}
POST /api/datasets/{dataset_id}/import-jobs/{job_id}/scan
POST /api/datasets/{dataset_id}/import-jobs/{job_id}/validate
POST /api/datasets/{dataset_id}/import-jobs/{job_id}/confirm
POST /api/datasets/{dataset_id}/import-jobs/{job_id}/retry
GET  /api/datasets/{dataset_id}/assets/summary
GET  /api/datasets/{dataset_id}/assets
GET  /api/datasets/{dataset_id}/assets/{sample_id}
GET  /api/datasets/{dataset_id}/qc
POST /api/datasets/{dataset_id}/qc/generate
```

为了兼容当前实现，现有 `/api/datasets/{dataset_id}/label-configs/*` 可以保留，但内部应解析出 `dataset_type` 后写入类型级配置。

## 数据集模块验收标准

- 数据集列表能按 `dataset_type` 分组展示多个批次。
- `urban_violation` 被识别为类型，批次 ID 使用类型加日期/场景后缀。
- 同类型批次共享同一 active `label_config`。
- 同类型批次不共享质检队列；质检队列、进度、草稿、提交结果都必须按 `dataset_id` 隔离。
- 资产浏览是数据集批次详情的子能力，不作为脱离数据集的全局资产库。
- `/datasets/{dataset_id}/assets` 只展示该批次资产，所有筛选、统计、跳转都必须绑定当前 `dataset_id`。
- 批次概览能展示资产统计、导入健康、预标注覆盖、模型判断分布和质检进度。
- 资产列表能筛选 STEP2 失败、类别、sample category、置信度、质检状态、媒体状态和人工修改状态。
- 资产列表不直接编辑标签；标签修改必须进入当前批次样本复核页。
- STEP2 失败资产仍在同一批次资产列表中可见，并能进入人工处理模式。
- 导入任务必须绑定具体 `dataset_id`；不能创建无批次归属的全局导入任务。
- 新建数据集批次时，应自动进入导入向导或创建第一个 `ImportJob`。
- 导入任务完成扫描/校验后必须给出可审计的样本对齐、错误、告警和实体映射预览。
- 确认导入前不得写入最终资产和预标注业务记录。
- 导入完成后，批次生命周期必须自动推进到 `imported`，并根据预标注产物和 `label_config` 状态继续推进到 `preannotation_ready`、`label_config_required` 或 `qc_ready`。
- 已进入 `qc_in_progress` 的批次不得被破坏性重新导入覆盖。
- 修改或激活类型级 `label_config` 后，同类型所有批次的质检编辑规则一致。
- 批次概览页能展示完整生命周期状态和下一步动作。
- 没有预标注结果的批次不能进入 `qc_ready`。
- 没有 active `label_config` 的批次不能进入 `qc_ready`，只能停在 `label_config_required`。
- STEP2 失败样本不会导致整个批次导入失败；失败文件必须被计入预标注诊断与资产筛选。
- “进入质检队列”只在 `qc_ready` 或 `qc_in_progress` 下作为主动作出现。
- 从某个批次进入质检队列时，队列列表、上一条/下一条、样本复核页、底栏保存/提交都只能操作该批次内的样本。
- 样本复核接口必须校验 `sample_id` 属于 URL 中的 `dataset_id`，避免同类型不同批次串样。
- `archived` 批次所有人工修改入口只读。

## 后续待沟通问题

- 数据集创建向导是否需要支持“只创建空批次，稍后再导入”。
- 是否需要在 MVP 中支持同一批次增量追加样本。
- STEP2 failure 资产是否默认进入当前批次质检队列，还是需要单独的队列策略开关。
- 导入完成后是否自动生成当前批次质检队列，还是保持“点击进入质检队列时生成或打开”的交互。

# 质检标签配置前端上传加载流程设计

日期：2026-05-17

## 1. 目标修正

标签配置不应由后端启动时从包内固定文件自动读取。正确目标是：

- 前端在数据集注册、导入配置或数据集设置流程中手动上传标签配置文件。
- 后端接收前端上传的配置内容，执行结构校验、字段语义校验和版本入库。
- 审核员确认后，将某个配置版本绑定为该数据集的当前激活标签配置。
- 质检工作台进入样本审阅时，从后端读取该数据集的激活配置来渲染字段编辑控件。

因此，数据集配置文件是“用户/运营上传的数据集资产”，不是“后端代码内置资源”。

## 2. 角色边界

### 前端职责

- 提供手动上传入口。
- 在浏览器侧做基础解析和预览，尽早提示 JSON 语法错误、字段缺失、重复字段等明显问题。
- 展示配置预览：闭集枚举字段、开放标签字段、字段数量、选项数量、错误和警告。
- 允许用户确认上传、保存草稿、激活配置。
- 在质检工作台根据激活配置渲染不同字段控件。
- 在保存标签修改 patch 时携带 `label_config_id` 和 `label_config_version`。

### 后端职责

- 接收前端上传的配置文件。
- 统一校验配置结构和业务规则。
- 保存原始配置文件、规范化配置、内容 hash、版本号、上传人和状态。
- 将某个配置版本绑定到数据集。
- 对外提供数据集当前激活标签配置。
- 对质检 patch 做配置版本校验和字段级合法性校验。

### 联调测试职责

- 用真实配置文件走完整流程：上传、校验、激活、读取、质检编辑、patch 保存。
- 验证闭集枚举被约束，开放标签不被误判为非法枚举。
- 验证未上传配置的数据集不能进入完整标签编辑流程，或只能进入只读审阅模式。

## 3. 前端流程

### 3.1 数据集注册阶段

推荐在数据集注册向导中加入“标签配置”步骤：

1. 用户选择数据集基础信息和数据路径。
2. 用户上传标签配置文件。
3. 前端解析配置并生成本地预览。
4. 前端调用后端校验接口。
5. 后端返回标准化配置、错误、警告和字段摘要。
6. 用户确认后保存数据集，并绑定该配置版本。

若标签配置暂时缺失，数据集可以先注册为 `config_missing` 状态，但质检工作台应提示“请先上传标签配置”，不能让审核员编辑闭集字段。

### 3.2 已存在数据集阶段

数据集详情页或数据集设置页应提供“标签配置”管理面板：

- 当前激活配置版本。
- 历史配置版本列表。
- 上传新配置。
- 校验结果预览。
- 激活新版本。
- 回退到旧版本。

激活新版本前需要检查：

- 是否存在正在进行的质检任务。
- 新旧配置是否删除了仍在使用的闭集枚举值。
- 是否需要迁移或冻结旧 patch 的显示快照。

### 3.3 质检工作台加载阶段

进入样本审阅页时，前端必须同时加载：

- 样本审阅数据。
- 数据集激活标签配置。
- 当前样本已有人工 patch。

推荐加载顺序：

```text
进入样本审阅页
  -> GET /api/datasets/{dataset_id}/label-config/active
  -> GET /api/datasets/{dataset_id}/samples/{sample_id}/review
  -> 根据 label config 创建字段控件
  -> 将 baseSample + reviewDraft + label config 合成为可编辑视图
```

如果配置加载失败：

- 图像证据区仍可展示。
- 原始模型结果仍可只读展示。
- 标签字段编辑和质检提交按钮应禁用。
- 页面提示需要上传或重新激活标签配置。

## 4. 后端 API 设计

### 4.1 配置校验

用于前端上传后预览，不一定持久化。

```http
POST /api/label-configs/validate
Content-Type: multipart/form-data

file=<label_config.json>
dataset_id=urban_violation
```

返回：

```json
{
  "valid": true,
  "dataset_id": "urban_violation",
  "detected_version": "urban_violation_labels_v1",
  "content_hash": "sha256:...",
  "summary": {
    "field_count": 8,
    "closed_enum_count": 6,
    "open_tags_count": 2,
    "option_count": 52
  },
  "errors": [],
  "warnings": [
    {
      "field": "relation",
      "message": "配置包含低频关系值，建议确认是否需要保留"
    }
  ],
  "normalized_config": {}
}
```

### 4.2 上传并保存为草稿

```http
POST /api/datasets/{dataset_id}/label-configs
Content-Type: multipart/form-data

file=<label_config.json>
activate=false
```

返回：

```json
{
  "config_id": "label-config-20260517-001",
  "dataset_id": "urban_violation",
  "version": "urban_violation_labels_v1",
  "status": "draft",
  "content_hash": "sha256:...",
  "created_at": "2026-05-17T12:00:00Z",
  "validation": {
    "valid": true,
    "errors": [],
    "warnings": []
  }
}
```

### 4.3 激活配置

```http
POST /api/datasets/{dataset_id}/label-configs/{config_id}/activate
```

激活后，该数据集所有新进入的质检会使用这个配置版本。旧 patch 继续保留其提交时的 `label_config_id` 和 `label_config_version`。

### 4.4 获取激活配置

```http
GET /api/datasets/{dataset_id}/label-config/active
```

返回当前激活配置，供前端渲染控件和提交 patch 时携带版本信息。

### 4.5 获取标签建议

```http
GET /api/datasets/{dataset_id}/label-suggestions?field=segmentation_targets&q=电
```

建议来源应是当前激活配置中的 `open_tags` 字段选项，再叠加后续治理出的高频标签。对 `scene_elements` 和 `segmentation_targets`，返回为空也不代表用户不能输入新标签。

## 5. 配置文件结构

推荐上传 JSON。后续如需 YAML，可以在后端增加解析器，但接口语义不变。

```json
{
  "schema_version": "label_config_v1",
  "dataset_type": "urban_violation",
  "version": "urban_violation_labels_v1",
  "fields": [
    {
      "field": "violation_category",
      "mode": "closed_enum",
      "label_zh": "违法类别",
      "label_en": "Violation category",
      "allow_custom": false,
      "options": [
        {
          "code": "goods_blocking_road",
          "label_zh": "物品占道",
          "label_en": "Goods blocking road",
          "aliases": ["物品占路", "杂物占道"]
        }
      ]
    },
    {
      "field": "scene_elements",
      "mode": "open_tags",
      "label_zh": "场景元素",
      "label_en": "Scene elements",
      "allow_custom": true,
      "max_items": 30,
      "options": [
        {
          "code": "sidewalk",
          "label_zh": "人行道",
          "label_en": "sidewalk",
          "aliases": ["步道"]
        }
      ]
    }
  ]
}
```

关键约束：

- `closed_enum` 字段必须有 `options`，且 `allow_custom` 必须为 `false`。
- `open_tags` 字段可以有 `options`，但这些只作为建议项，`allow_custom` 必须为 `true`。
- `scene_elements` 和 `segmentation_targets` 必须配置为 `open_tags`。
- 字段名不能重复。
- 同一字段内 `code` 不能重复。
- 配置文件应有 `schema_version`，便于后续升级。

## 6. 后端存储模型

建议新增配置版本表或等价持久化模型：

```text
dataset_label_configs
  config_id
  dataset_id
  schema_version
  version
  status: draft | active | archived | rejected
  content_hash
  original_file_name
  raw_config
  normalized_config
  validation_report
  created_by
  created_at
  activated_at
```

数据集表增加：

```text
datasets
  active_label_config_id
  label_config_status
```

质检 patch 增加：

```text
review_patches
  label_config_id
  label_config_version
```

这样可以保证：

- 历史 patch 能按当时配置解释。
- 新配置不会破坏旧审计记录。
- 数据集可以回退配置版本。

## 7. 当前后端实现需要调整的点

上一版“后端包内 `dataset_configs/urban_violation.json` + 启动时读取”的实现不符合此目标，应改为：

- 包内配置最多只能作为开发 fixture 或默认示例，不能作为生产读取路径。
- `load_dataset_label_config(dataset_id)` 不应直接从包资源决定数据集配置。
- 后端应提供上传、校验、保存、激活接口。
- `GET label-dictionary` 应读取数据集当前激活配置，而不是读取代码仓库中的固定文件。
- 前端必须在注册或设置流程里显式上传配置；没有激活配置时，质检字段编辑应被禁用。

## 8. 实现顺序

1. 定义上传配置文件 schema 与校验错误结构。
2. 前端实现配置上传组件和本地预览。
3. 后端实现 `validate` 接口，先不落库。
4. 后端实现配置版本保存和激活接口。
5. 数据集注册流程接入配置上传。
6. 质检工作台进入时加载激活配置。
7. 标签字段编辑控件改为由激活配置驱动。
8. patch 保存携带 `label_config_id` 和 `label_config_version`。
9. 联调覆盖上传配置、激活配置、闭集字段校验、开放标签自由输入。

## 9. 验收标准

- 前端可以手动上传标签配置文件，并展示字段预览。
- 配置文件错误可以在保存前被明确提示。
- 后端不依赖包内固定配置作为数据集标签配置来源。
- 每个数据集有独立激活配置版本。
- 质检工作台控件由当前数据集激活配置生成。
- `scene_elements` 和 `segmentation_targets` 在上传配置中必须是 `open_tags`。
- `violation_category`、`relation` 等闭集字段必须是 `closed_enum`。
- patch 保存时包含配置版本，历史审计可回放。

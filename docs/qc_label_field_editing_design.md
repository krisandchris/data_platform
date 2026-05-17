# 质检工作台标签字段修改设计文档

日期：2026-05-17

## 1. 设计目标

质检工作台需要允许审核员修改模型预标注结果中的标签字段，同时保留模型原始输出、人工修改痕迹、字段来源、字段版本和可回滚的审计链路。当前设计不直接覆盖 `baseSample`，而是继续采用：

- `baseSample`：模型与导入数据的只读基线。
- `reviewDraft`：审核员当前编辑草稿。
- `mergedSample`：界面展示用的合并结果。
- `buildPatch`：只提交字段差异，不提交整份样本。

本设计重点处理两类字段：

- 固定枚举字段：如类别、关系、判定结果等，必须由后端标签字典约束。
- 开放受控标签字段：`scene_elements`、`segmentation_targets` 不是固定枚举，允许一定自由输入，但需要规范化、去重和审计。

## 2. 已确认产品规则

- 审核员可以修改标签字段内容。
- 模型置信度 `confidence`、`verification_confidence` 可以被人工修正。
- 字段允许删除，但删除必须保留审计记录；推荐使用软删除或 patch 删除操作，而不是物理丢弃历史。
- 标签采用双层结构：机器稳定值与中文展示值分离。
- 类别、关系等闭集字段必须使用固定集合。
- `scene_elements` 和 `segmentation_targets` 不是可枚举字段，应按开放受控标签处理。

## 3. 字段类型分层

### 3.1 闭集枚举字段

闭集字段只能从后端标签字典中选择，前端不允许保存任意新值。典型字段包括：

| 字段 | 所属阶段 | 建议控件 | 约束 |
| --- | --- | --- | --- |
| `violation_category` | Stage2 Candidate | 搜索下拉 / 单选选择器 | 必须命中字典 |
| `sample_category` | Stage2 Candidate | 搜索下拉 / 单选选择器 | 必须命中字典 |
| `relation` | Stage1 Relation / Stage2 Verification | 搜索下拉 | 必须命中字典 |
| `verification_result` | Stage2 Verification | 分段选择器 | 必须命中字典 |
| `visibility_level` | Stage2 Verification | 分段选择器 | 必须命中字典 |
| `review_decision` | QC Submit | 底栏按钮 | 必须命中字典 |

闭集字段的存储建议采用双层结构：

```json
{
  "code": "goods_blocking_road",
  "label_zh": "物品占道",
  "label_en": "Goods blocking road",
  "dictionary_version": "urban_violation_labels_v1"
}
```

界面展示中文 `label_zh`，接口、补丁、导出和模型训练侧优先使用稳定 `code`。

### 3.2 开放受控标签字段

`scene_elements` 和 `segmentation_targets` 不进入闭集枚举。它们应作为开放标签数组处理：

| 字段 | 所属阶段 | 业务含义 | 设计类型 |
| --- | --- | --- | --- |
| `scene_elements` | Stage1 | 图像场景中可见的环境/物体/道路元素 | 开放受控标签 |
| `segmentation_targets` | Stage2 Candidate | 候选违法目标对应的分割对象提示 | 开放受控标签 |

开放受控标签的含义是：

- 允许审核员输入字典中没有的新标签。
- 前端提供建议项，但建议项不是强制枚举。
- 后端做格式校验、规范化、去重和风险控制。
- 系统保留原始输入值与规范化值，避免人工语义被过度改写。
- 后续可以通过后台治理将高频自由标签沉淀为推荐词或标准词。

推荐单个标签结构：

```json
{
  "raw_text": "临时摊位",
  "normalized_text": "临时摊位",
  "canonical_code": null,
  "label_zh": "临时摊位",
  "label_en": null,
  "source": "human",
  "status": "custom",
  "dictionary_version": "urban_violation_open_tags_v1"
}
```

字段含义：

- `raw_text`：审核员原始输入，不被自动覆盖。
- `normalized_text`：去除首尾空格、合并连续空白、统一大小写或全半角后的值。
- `canonical_code`：当标签可匹配到已治理标准词时写入；无法匹配时为 `null`。
- `source`：`model` 或 `human`。
- `status`：`model_original`、`custom`、`suggested`、`canonicalized`、`deprecated`。
- `dictionary_version`：记录建议词/治理词表版本，不代表该字段是闭集枚举。

### 3.3 数值字段

置信度字段允许人工修改，但必须作为数值字段处理：

| 字段 | 范围 | 修改要求 |
| --- | --- | --- |
| `confidence` | 0 到 1 | 保留模型原值和人工修正值 |
| `verification_confidence` | 0 到 1 | 保留模型原值和人工修正值 |

界面建议使用输入框或滑杆加数字输入组合，保存前校验范围。人工修改后应显示“人工修正”状态，不再伪装成模型置信度。

### 3.4 自由文本字段

自由文本字段不使用枚举，但需要长度限制和安全清洗：

| 字段 | 所属阶段 | 用途 |
| --- | --- | --- |
| `environment_analysis` | Stage1 | 场景环境分析 |
| `description` | Stage1 Relation | 关系描述 |
| `observations` | Stage2 Verification | 可见性观察 |
| `evidence_reasoning` | Stage2 Candidate | 候选证据推理 |
| `vote_note` | QC Submit | 审核备注 |

### 3.5 空间字段

`bbox` 是 0-1000 量化坐标，不是图片像素坐标。前端编辑时在图像显示区拖拽 box，保存时仍提交 0-1000 坐标。

```json
{
  "bbox": [163, 362, 336, 632],
  "coordinate_space": "quantized_0_1000"
}
```

## 4. 标签字典与开放标签服务

后端建议提供两个层级的标签服务。

### 4.1 闭集标签字典接口

```http
GET /api/v1/label-dictionaries?dataset=urban_violation
```

返回结构建议：

```json
{
  "dataset": "urban_violation",
  "version": "urban_violation_labels_v1",
  "fields": [
    {
      "field": "violation_category",
      "mode": "closed_enum",
      "options": [
        {
          "code": "goods_blocking_road",
          "label_zh": "物品占道",
          "label_en": "Goods blocking road",
          "description": "货物、杂物或经营物品占用道路通行空间",
          "status": "active",
          "sort_order": 30,
          "aliases": ["goods_blocking_road", "物品占路"]
        }
      ]
    }
  ]
}
```

闭集字段校验规则：

- `code` 必须存在于该字段的 active options。
- 保存 patch 时记录 `dictionary_version`。
- 导出时输出稳定 `code`，可附带中文显示快照。
- 字典升级不能破坏历史 patch；历史值通过版本回放解释。

### 4.2 开放标签建议接口

```http
GET /api/v1/label-suggestions?dataset=urban_violation&field=scene_elements&q=摊
```

返回结构建议：

```json
{
  "dataset": "urban_violation",
  "field": "scene_elements",
  "mode": "open_tags",
  "suggestions": [
    {
      "canonical_code": "temporary_vendor_stall",
      "label_zh": "临时摊位",
      "label_en": "temporary vendor stall",
      "frequency": 42,
      "source": "curated"
    }
  ]
}
```

开放标签接口只提供建议，不阻止审核员输入新标签。

## 5. 前端编辑交互

### 5.1 统一编辑入口

样本审阅页保持沉浸式单屏布局。字段编辑不新增管理页，而是在右侧 Relation 复核区、Candidate 与质检裁决区内就地编辑。

推荐交互：

- 默认展示合并后的标签结果。
- 点击字段进入编辑状态。
- 闭集字段打开字典选择器。
- 开放标签字段打开 tag input，带搜索建议和新增标签能力。
- 数值字段显示数值输入与人工修正状态。
- 文本字段使用多行输入。
- `bbox` 只在图像区域直接拖拽修改，不提供坐标优先的主入口。

### 5.2 开放标签输入规则

`scene_elements` 和 `segmentation_targets` 的前端控件应满足：

- 支持多标签 chip 展示。
- 支持搜索建议。
- 支持直接输入新标签并回车创建。
- 支持删除已有标签。
- 支持撤销当前字段修改。
- 对新增自由标签显示 `自定义` 状态。
- 对命中建议项的标签显示标准中文名。
- 对重复标签进行即时合并提示。

建议限制：

- 单个标签长度：1 到 40 个字符。
- 单字段标签数量：建议不超过 30 个。
- 不允许空标签。
- 不允许 HTML 标签、控制字符、脚本片段。
- 中英文、数字、空格、下划线、连字符和常见中文标点可接受。

## 6. Patch 设计

所有修改通过 patch 表达，避免覆盖模型原始结果。

### 6.1 闭集字段修改

```json
{
  "sample_id": "000142_0_1762483003246",
  "base_revision": "stage2_run_0508:parsed:sha256:...",
  "dictionary_version": "urban_violation_labels_v1",
  "operations": [
    {
      "scope": "candidate:C1",
      "field": "violation_category",
      "op": "replace",
      "before": {
        "code": "no_violation",
        "label_zh": "无违法"
      },
      "after": {
        "code": "goods_blocking_road",
        "label_zh": "物品占道"
      },
      "reason": "候选区域存在物品占道"
    }
  ]
}
```

### 6.2 开放标签新增

```json
{
  "sample_id": "000142_0_1762483003246",
  "base_revision": "stage1_run_0508:parsed:sha256:...",
  "operations": [
    {
      "scope": "stage1",
      "field": "scene_elements",
      "op": "add_tag",
      "before": ["人行道", "非机动车"],
      "after": ["人行道", "非机动车", "临时摊位"],
      "tag_payload": {
        "raw_text": "临时摊位",
        "normalized_text": "临时摊位",
        "canonical_code": null,
        "source": "human",
        "status": "custom",
        "dictionary_version": "urban_violation_open_tags_v1"
      },
      "reason": "补充图像中可见的场景元素"
    }
  ]
}
```

### 6.3 开放标签规范化

当用户输入值命中建议词时，可以保存原始输入和标准化结果：

```json
{
  "scope": "candidate:C1",
  "field": "segmentation_targets",
  "op": "add_tag",
  "tag_payload": {
    "raw_text": "摊 位",
    "normalized_text": "摊位",
    "canonical_code": "vendor_stall",
    "label_zh": "摊位",
    "label_en": "vendor stall",
    "source": "human",
    "status": "canonicalized"
  }
}
```

### 6.4 删除标签

删除不是丢弃历史，而是 patch 操作：

```json
{
  "scope": "stage1",
  "field": "scene_elements",
  "op": "remove_tag",
  "before": ["人行道", "非机动车", "临时摊位"],
  "after": ["人行道", "非机动车"],
  "removed": {
    "raw_text": "临时摊位",
    "normalized_text": "临时摊位"
  },
  "reason": "该标签与图像内容不匹配"
}
```

## 7. 后端校验规则

后端保存 patch 前必须做字段级校验。

| 字段类型 | 后端校验 |
| --- | --- |
| 闭集枚举 | 检查 `field + code + dictionary_version` 是否有效 |
| 开放标签 | 清洗文本、去重、长度限制、数量限制、保留原始输入 |
| 数值 | 校验 0 到 1 范围，记录人工修正来源 |
| 自由文本 | 长度限制、安全清洗、保留换行 |
| `bbox` | 校验数组长度为 4、整数、范围 0 到 1000、`x1 < x2`、`y1 < y2` |

对于开放标签，不应该因为不存在于字典而拒绝保存；只在格式非法、超长、重复或存在安全风险时拒绝。

## 8. 审计与导出

### 8.1 审计记录必须包含

- `sample_id`
- `reviewer_id`
- `base_revision`
- `patch_id`
- `field`
- `scope`
- `op`
- `before`
- `after`
- `reason`
- `created_at`
- `dictionary_version`
- 对开放标签额外记录 `raw_text`、`normalized_text`、`canonical_code`、`status`

### 8.2 导出策略

默认导出 `mergedSample`，并附加可选审计信息：

- 训练导出：使用合并后的稳定字段。
- 审计导出：包含模型原始输出、人工 patch 和最终合并结果。
- 闭集字段导出稳定 `code`。
- 开放标签导出 `normalized_text`，同时可附带 `raw_text` 和 `canonical_code`。

## 9. 验收标准

- 闭集字段不能保存字典外 `code`。
- `scene_elements` 支持新增、删除、去重、建议选择和自由输入。
- `segmentation_targets` 支持新增、删除、去重、建议选择和自由输入。
- 开放标签字段保存时保留 `raw_text` 与 `normalized_text`。
- 自定义开放标签不会被当作非法枚举拒绝。
- 置信度字段可以人工修改，且保存后能区分模型值与人工修正值。
- `bbox` 修改仍保持 0-1000 量化坐标。
- 所有修改只生成 patch，不覆盖 `baseSample`。
- 提交质检结论前必须校验 patch 合法性。
- 审计记录可以还原每个字段的修改前后状态。

## 10. 后续实现顺序

1. 后端补齐标签字典与开放标签建议接口。
2. 后端补齐 patch 字段校验器，区分 `closed_enum` 与 `open_tags`。
3. 前端建立字段元数据表，将字段映射到控件类型。
4. 前端实现闭集选择器、开放标签输入器、数值修正器和文本编辑器。
5. 前端将字段修改统一写入 `reviewDraft`，由 `buildPatch` 生成差异。
6. 联调验证 `scene_elements` 与 `segmentation_targets` 的自由输入不会被枚举校验误杀。
7. 增加导出和审计回放检查。

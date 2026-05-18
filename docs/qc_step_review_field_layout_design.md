# STEP1/STEP2 质检字段与右侧复核区布局设计

日期：2026-05-17

## 1. 设计目标

本设计补充 `docs/qc_label_field_editing_design.md`，重点回答两个问题：

1. STEP1、STEP2 模型结果中哪些字段需要进入质检修改流程。
2. 样本审阅页右侧如何重构为两个明确工作区：`Relation 复核区`、`Candidate 与质检裁决`。

当前数据集样例确认：

- STEP1 parsed 顶层字段为 `environment_analysis`、`scene_elements`、`key_anchors`、`key_relations`。
- STEP2 parsed 顶层字段为 `sample_id`、`fact_verifications`、`candidates`。
- STEP2 failure 字段为 `error_type`、`message`。
- `bbox` 均为 0-1000 量化坐标，界面显示时按图像真实渲染尺寸动态投影，不作为像素坐标保存。

## 2. 基础编辑原则

- `baseSample` 保持只读，模型原始输出不得被覆盖。
- 所有人工修改进入 `reviewDraft`，界面展示使用 `mergedSample`。
- 保存只提交 patch，不提交完整样本。
- 所有闭集字段由当前激活的 dataset label config 约束。
- `scene_elements`、`segmentation_targets` 是开放受控标签，允许自定义输入。
- `bbox` 只通过图像预览区直接拖拽、缩放、点选修改；右侧面板只显示状态与快捷操作，不提供主坐标编辑入口。
- `relation_index` 和 `evidence_relation_indices` 在 UI 中必须转换为可读 Relation 引用，不让审核员直接维护裸数字。

## 3. STEP1 需要质检修改的字段

| 字段 | 数据位置 | 是否可改 | 控件 | 配置来源 | Patch scope | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `environment_analysis` | `stage1.environment_analysis` | 可改，低优先级 | 多行文本 | 无枚举，长度/安全校验 | `stage1` | 场景摘要，建议放在图像区下方或 Relation 区折叠区，避免占用主审阅空间。 |
| `scene_elements` | `stage1.scene_elements[]` | 可改 | 开放 tag input | `scene_elements` 字段，`mode=open_tags` | `stage1.scene_elements` | 允许新增、删除、去重、自定义；配置项只作为建议。 |
| `key_anchors` | `stage1.key_anchors[]` | 可改，建议二期 | 开放 tag input | 可复用 `scene_elements` 建议或单独配置 | `stage1.key_anchors` | 当前样例为字符串数组，作为证据锚点/场景锚点。MVP 可先只读展示，下一步再开放编辑。 |
| `subject` | `stage1.key_relations[].subject` | 可改 | 文本输入/实体 chip | 无闭集 | `relation:{relation_id}.subject` | Relation 三元组核心字段。 |
| `relation` | `stage1.key_relations[].relation` | 可改 | 搜索下拉 | `relation` 字段，`mode=closed_enum` | `relation:{relation_id}.relation` | 必须命中当前激活配置中的关系枚举。 |
| `object` | `stage1.key_relations[].object` | 可改 | 文本输入/实体 chip | 无闭集 | `relation:{relation_id}.object` | Relation 三元组核心字段。 |
| `description` | `stage1.key_relations[].description` | 可改 | 多行文本 | 无枚举，长度/安全校验 | `relation:{relation_id}.description` | 对关系判断依据的自然语言说明。 |
| `bbox` | `stage1.key_relations[].bbox` | 可改 | 图像区 box 拖拽/缩放 | 坐标校验 | `relation:{relation_id}.bbox` | 保存 0-1000 量化坐标；选中 box 自动打开对应 Relation。 |

建议优先级：

1. 第一优先：`key_relations[].subject/relation/object/description/bbox`、`scene_elements`。
2. 第二优先：`environment_analysis`、`key_anchors`。

## 4. STEP2 需要质检修改的字段

### 4.1 `fact_verifications[]`

`fact_verifications[]` 应与 STEP1 `key_relations[]` 在 `Relation 复核区` 中合并展示，一个 Relation 行同时显示 STEP1 三元组和 STEP2 核验结果。

| 字段 | 是否可改 | 控件 | 配置来源 | Patch scope | 说明 |
| --- | --- | --- | --- | --- | --- |
| `relation_index` | 不直接编辑 | 只读映射 | 无 | 不作为可编辑字段 | 仅作为导入兼容字段；UI 内部应转换为稳定 `relation_id`。 |
| `subject` | 可改，但默认跟随 STEP1 | 文本输入/差异提示 | 无闭集 | `verification:{relation_id}.subject` | 与 STEP1 不一致时显示差异；建议从 Relation 主编辑同步。 |
| `relation` | 可改，但默认跟随 STEP1 | 搜索下拉 | `relation` closed enum | `verification:{relation_id}.relation` | 与 STEP1 Relation 共享配置。 |
| `object` | 可改，但默认跟随 STEP1 | 文本输入/差异提示 | 无闭集 | `verification:{relation_id}.object` | 与 STEP1 不一致时显示差异。 |
| `bbox` | 可改 | 图像区 box 拖拽/缩放 | 坐标校验 | `verification:{relation_id}.bbox` | 默认可跟随 Relation bbox；若单独修正，需要显示“STEP2 bbox override”。 |
| `visibility_level` | 可改 | 分段选择/下拉 | `visibility_level` closed enum | `verification:{relation_id}.visibility_level` | 样例值包括 `clear`、`occluded`。 |
| `information_loss_type` | 可改 | 分段选择/下拉 | 建议加入 label config closed enum | `verification:{relation_id}.information_loss_type` | 样例值包括 `none`、`occlusion`；应配置为固定集合。 |
| `key_attributes_visible` | 可改 | 开放 tag input | 可单独配置 open_tags，或作为自由 tag | `verification:{relation_id}.key_attributes_visible` | 样例值如 `wheel`、`cover`、`body_outline`。 |
| `subject_visible` | 可改 | 开关 | Boolean | `verification:{relation_id}.subject_visible` | 是否可见主体。 |
| `subject_match` | 可改 | 开关 | Boolean | `verification:{relation_id}.subject_match` | 可见主体是否与三元组主体匹配。 |
| `bbox_observation` | 可改 | 多行文本 | 无枚举 | `verification:{relation_id}.bbox_observation` | Bbox 准确性观察。 |
| `global_context_observation` | 可改 | 多行文本 | 无枚举 | `verification:{relation_id}.global_context_observation` | 全局上下文观察。 |
| `verification_result` | 可改 | 分段选择 | `verification_result` closed enum | `verification:{relation_id}.verification_result` | 必须命中配置，样例值包括 `supported`、`weakly_supported`。 |
| `verification_confidence` | 可改 | 数字输入 + 滑杆 | 0-1 数值校验 | `verification:{relation_id}.verification_confidence` | 人工修正后必须标记为 human override。 |

### 4.2 `candidates[]`

Candidate 应在 `Candidate 与质检裁决` 区中编辑。它不是 Relation 的子项，而是对若干 Relation 证据的违法判断结论。

| 字段 | 是否可改 | 控件 | 配置来源 | Patch scope | 说明 |
| --- | --- | --- | --- | --- | --- |
| `violation_category` | 可改 | 闭集选择器 | `violation_category` closed enum | `candidate:{candidate_id}.violation_category` | 原始数据是数组；MVP 可单选并序列化为单元素数组，若允许多类别，应在配置中补 `max_items` 并启用多选。 |
| `evidence_relation_indices` | 可改 | Relation 证据勾选表 | Relation 列表 | `candidate:{candidate_id}.evidence_relations` | UI 显示为 `R1 · subject relation object`，保存时使用稳定 relation id，再由适配层兼容原始索引。 |
| `evidence_reasoning` | 可改 | 多行文本 | 无枚举 | `candidate:{candidate_id}.evidence_reasoning` | 候选结论依据。 |
| `relation_hint` | 可改，低优先级 | 单行/多行文本 | 无枚举 | `candidate:{candidate_id}.relation_hint` | 可作为模型提示残留或关系摘要，建议放在折叠详情。 |
| `segmentation_targets` | 可改 | 开放 tag input | `segmentation_targets` open_tags | `candidate:{candidate_id}.segmentation_targets` | 允许自定义，不受闭集枚举限制。 |
| `confidence` | 可改 | 数字输入 + 滑杆 | 0-1 数值校验 | `candidate:{candidate_id}.confidence` | 人工修正后显示 human override。 |
| `sample_category` | 可改 | 闭集选择器 | `sample_category` closed enum | `candidate:{candidate_id}.sample_category` | 样例值包括 `positive samples`、`negative samples`、`hard boundary samples`。 |

### 4.3 STEP2 failure

| 字段 | 是否可改 | 控件 | Patch scope | 说明 |
| --- | --- | --- | --- | --- |
| `error_type` | 不改 | 只读诊断 | 无 | 记录模型运行或解析失败类型。 |
| `message` | 不改 | 只读诊断 | 无 | 记录失败原因。 |
| 人工 Candidate | 可新增 | 新建 Candidate 表单 | `candidate:new` | STEP2 无候选结果时，允许审核员基于 STEP1 Relation 手工补判。 |

## 5. 右侧目标布局

右侧只保留两个主要区域，避免“通用标签编辑器 + Relation + Candidate + 门禁 + Patch Preview”堆叠成多个互相抢空间的卡片。

```text
┌─────────────────────────────── 右侧审阅栏 ───────────────────────────────┐
│ Relation 复核区                                                          │
│ ┌─索引─┐ ┌────────────────── 当前 Relation 编辑 ─────────────────────┐ │
│ │ R1  │ │ subject | relation | object                                 │ │
│ │ R2  │ │ visibility | result | confidence                            │ │
│ │ R3  │ │ subject_visible | subject_match                             │ │
│ │     │ │ visible attributes tags                                     │ │
│ └─────┘ │ bbox/context observations                                   │ │
│         │ bbox 由图像区拖拽修改                                      │ │
│         └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│ Candidate 与质检裁决                                                     │
│ Candidate tabs/list | category | sample_category | confidence            │
│ Evidence Relations 勾选表 | segmentation targets | reasoning             │
├─────────────────────────────────────────────────────────────────────────┤
│ 全局底栏：已修改/校验/草稿状态 + 跳过样本 / 校验修改 / 保存草稿 / 提交修改 │
└─────────────────────────────────────────────────────────────────────────┘
```

桌面尺寸建议：

- 左侧图像证据区占 60%-65% 宽度。
- 右侧审阅栏占 35%-40% 宽度。
- 右侧上区 `Relation 复核区` 占右栏 50% 高度。
- 右侧下区 `Candidate 与质检裁决` 占右栏 50% 高度。
- 两个右侧区域都必须有独立内容滚动容器，内容较多时不得挤压另一区高度。
- 如果界面用于标注人员修改标签，底部只保留状态摘要与修改提交按钮，并作为全局底栏横跨整个审阅页底部，不属于右侧 Candidate 面板内部。

## 6. Relation 复核区设计

### 6.1 区域内容

`Relation 复核区` 聚焦“事实关系是否成立、框是否准确、STEP2 对该关系的核验是否可信”。

Relation 左侧索引轨展示：

- 只显示 `R1/R2/R3` 这类 Relation 索引序号。
- 不显示三元组摘要、核验结果、bbox 状态、引用状态或说明文本。
- 当前选中态、警告态、已修改态只能通过边框、背景、细小状态点等非文本视觉标记表达。
- 三元组、核验结果、bbox 状态、引用状态统一放入右侧当前 Relation 编辑区或下方 Candidate 证据列表。

当前 Relation 编辑区展示：

- 当前 Relation 状态摘要：`已引用`、`未被 Candidate 引用`、`已修改`、`STEP2 缺失`、`STEP2 failed`。
- 三元组编辑：`subject`、`relation`、`object`。
- 关系说明：`description`。
- 核验字段：`visibility_level`、`information_loss_type`、`verification_result`、`verification_confidence`。
- 可见性开关：`subject_visible`、`subject_match`。
- 可见属性：`key_attributes_visible` tag input。
- 文本观察：`bbox_observation`、`global_context_observation`。
- Bbox 操作提示：`在图像区拖拽或缩放当前 box`。

### 6.2 交互规则

- 点击图像中的 box，自动选中并展开对应 Relation。
- 点击 Relation 行，图像中对应 box 变为选中红色粗线。
- 拖拽或缩放 box 后，Relation 行显示 `bbox edited` 状态。
- 修改 `relation` 时必须从 active label config 的 `relation` 选项中选择。
- STEP1 与 STEP2 三元组不一致时，显示差异条；默认以 Relation 主编辑值作为合并结果。
- 删除 Relation 不做物理删除，生成 `op=soft_delete_relation` patch，并同步在 Candidate 证据列表中显示引用失效提示。
- 新增 Relation 生成 `op=add_relation` patch，并要求用户在图像区绘制或选择 bbox。

## 7. Candidate 与质检裁决区设计

### 7.1 区域内容

该区域合并两个职责：

1. 审核 Candidate 是否正确引用 Relation 并给出违法判断。
2. 给出本样本最终质检裁决。

Candidate 选择器：

- 顶部使用紧凑 tabs 或列表：`C1 no violation 0.90`。
- 多 Candidate 时只展开当前 Candidate，其他 Candidate 保持一行摘要。
- STEP2 failure 或无 Candidate 时显示“人工补判”入口。

Candidate 编辑内容：

- `violation_category`：闭集选择器。
- `sample_category`：闭集选择器。
- `confidence`：0-1 数值输入和滑杆。
- `evidence_relation_indices`：Relation 证据勾选表，不展示裸索引。
- `segmentation_targets`：开放 tag input。
- `evidence_reasoning`：多行文本。
- `relation_hint`：折叠详情中的低优先级文本字段。

底栏内容：

- 如果该界面是质检裁决模式，底栏可承载裁决按钮和 `vote note`。
- 如果该界面是标注修改模式，底栏应改为状态摘要、`跳过样本`、`校验修改`、`保存草稿`、`提交修改`。
- 标注修改模式下不显示 `通过`、`驳回`、`人工精标`，避免让标注人员承担最终质检裁决。
- 标注修改模式下不需要填写说明，patch/audit 通过结构化 diff 记录修改内容。
- 详细底栏逻辑见 `docs/qc_label_edit_bottom_bar_design.md`。

### 7.2 交互规则

- 选择 Candidate 时，高亮它引用的 Relation box。
- 勾选/取消 Relation 证据时，Candidate 行立刻显示 dirty 状态。
- 被 soft delete 的 Relation 如果仍被 Candidate 引用，Candidate 区显示阻断提示。
- 修改 `violation_category`、`sample_category` 时必须命中 active label config。
- `segmentation_targets` 允许自定义，不因未命中字典而保存失败。
- `confidence` 修改后显示模型值与人工值差异。
- `提交修改` 前必须满足：无阻断校验错误、patch 已保存或可随提交保存、active label config 存在。

## 8. Patch 数据粒度

推荐 patch operation 粒度：

```json
{
  "sample_id": "000142_0_1762483003246",
  "label_config_id": "label-config-20260517-001",
  "label_config_version": "urban_violation_labels_v1",
  "operations": [
    {
      "scope": "relation:R1",
      "field": "relation",
      "op": "replace",
      "before": "占据",
      "after": "靠近"
    },
    {
      "scope": "verification:R1",
      "field": "verification_confidence",
      "op": "replace",
      "before": 0.9,
      "after": 0.72
    },
    {
      "scope": "candidate:C1",
      "field": "evidence_relations",
      "op": "replace",
      "before": ["R1", "R2"],
      "after": ["R1"]
    },
    {
      "scope": "candidate:C1",
      "field": "segmentation_targets",
      "op": "add_tag",
      "tag_payload": {
        "raw_text": "被遮盖的车辆",
        "normalized_text": "被遮盖的车辆",
        "canonical_code": null,
        "source": "human",
        "status": "custom"
      }
    }
  ],
  "review_decision": "needs_changes",
  "vote_note": "R2 证据不足，保留 R1 作为主要证据。"
}
```

## 9. 与当前实现的差距

当前前端已有基础能力：

- 图像区 box 可点选、拖拽、缩放。
- 选中 box 可联动 Relation。
- 已加载 active label config 并能对部分字段渲染选择器/tag input。
- 保存 patch 时携带 `label_config_id`、`label_config_version`。

仍需调整：

- 去掉右侧通用“标签字段复核”大块，改成 Relation/Candidate 上下文内编辑。
- Relation 区补齐 `subject/object/description` 和 STEP2 verification 详细字段编辑。
- Candidate 区补齐 `evidence_relation_indices` 可编辑、`evidence_reasoning` 可编辑、`confidence` 可编辑。
- `information_loss_type`、`key_attributes_visible` 需要进入前端类型与编辑控件。
- `violation_category` 需要明确单选/多选策略，不得因为当前 UI 单选而丢失源数据数组语义。
- STEP2 failure 样本需要支持基于 STEP1 人工新建 Candidate，而不是只展示失败信息。

## 10. 验收标准

- STEP1/STEP2 每个可编辑字段都有明确控件、校验来源和 patch scope。
- 闭集字段全部由 active label config 驱动，未激活配置时禁止编辑和提交。
- `scene_elements`、`segmentation_targets` 可输入自定义值，并保留原始输入与规范化值。
- `bbox` 修改只能通过图像区完成，保存仍为 0-1000 量化坐标。
- 点击 box 能打开对应 Relation；选择 Candidate 能高亮其引用的 Relation box。
- Candidate 证据关系使用可读 Relation 行编辑，不暴露裸 `relation_index`。
- 修改 Candidate 证据后，orphan/失效引用能产生阻断或明确警告。
- `confidence`、`verification_confidence` 可人工修改，并能区分模型值与人工值。
- 标注修改模式下，状态摘要、`跳过样本`、`校验修改`、`保存草稿`、`提交修改` 在底部修改提交区统一处理。
- 所有修改只生成 patch，不覆盖 `baseSample`。

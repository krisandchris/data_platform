# QC Review BBox 色卡使用范围定义计划

## 背景

当前审阅界面的普通 Relation 色卡已经排除了紫色、红色、黑色，但 Candidate overlay 仍存在独立紫色使用路径。结果是：即使一个 Relation 已经被 Candidate 引用，只要 Candidate 图层打开，它仍可能通过 Candidate overlay 显示为紫色。

本计划的目标是冻结 bbox 色彩语义，避免同一颜色承担多个含义。

## 色彩语义原则

1. 一个颜色只表达一个语义。
2. 红色只表达图像区真实选中态。
3. 紫色只表达未被 Candidate 引用的 Relation。
4. 黑色不作为 bbox 线框色使用。
5. 普通 Relation 使用稳定的身份色卡，色卡必须排除红色、紫色、黑色。
6. Candidate 不拥有独立颜色语义；Candidate overlay 应继承对应 Relation 的身份色。

## 色卡使用范围

### 1. 选中态色

- 颜色：红色。
- 使用范围：用户在图像预览区点击、拖拽、缩放某个 bbox 后，该 bbox 所属 Relation 进入图像区选中态。
- 驱动状态：只允许由 `activeImageRelationKey` 或等价的图像区交互状态驱动。
- 禁止范围：
  - 页面初始进入时不得出现。
  - 右侧 Relation 索引默认激活不得触发。
  - Candidate 默认激活、Candidate evidence 默认选择不得触发。
  - 普通默认色卡不得包含红色。

### 2. 未引用 Relation 色

- 颜色：紫色。
- 使用范围：Relation 没有被任何 Candidate 的 evidence relation 引用时，STEP1/STEP2 对应 bbox 使用紫色。
- 语义：提示该 Relation 暂未参与 Candidate 证据链。
- 选中覆盖：当用户在图像区点选该未引用 Relation 时，红色选中态覆盖紫色线框。
- 禁止范围：
  - 已被 Candidate 引用的 Relation 不得使用紫色。
  - Candidate overlay 不得使用紫色，因为 Candidate overlay 本身就表示存在引用关系。
  - 普通 Relation 身份色卡不得包含紫色。

### 3. 普通 Relation 身份色卡

- 颜色集合：蓝、绿、橙、青、黄、蓝绿。
- 推荐 token：`blue`, `green`, `orange`, `cyan`, `yellow`, `teal`。
- 使用范围：所有已被 Candidate 引用或普通非 orphan Relation。
- 分配方式：按标准化 Relation id 做稳定伪随机映射，例如 `R1`、`R2`、`R3` 每次刷新都得到同一个颜色。
- 禁止范围：
  - 不包含红色。
  - 不包含紫色。
  - 不包含黑色。

### 4. Candidate overlay

- Candidate overlay 不再定义独立 bbox 颜色。
- Candidate overlay 应使用 `relationTone(relationId)`，与 STEP1/STEP2 中同一 Relation 的身份色保持一致。
- 如果后续需要区分 Candidate 来源，不使用新颜色，而使用非语义冲突的视觉手段：
  - 虚线线框；
  - 更高或更低透明度；
  - 独立图层开关；
  - hover/focus 辅助提示。

### 5. 禁用态或隐藏态

- 禁用、隐藏、不可编辑等状态不通过黑色表达。
- 推荐使用 opacity、cursor、图层开关、按钮状态或说明文本表达。
- 黑色不进入 bbox 线框色卡。

## 实现顺序

### Phase A - 冻结色彩 token 合同

在前端审阅组件中集中定义 bbox 色彩合同：

```ts
const DEFAULT_RELATION_TONES = ['blue', 'green', 'orange', 'cyan', 'yellow', 'teal'];
const ORPHAN_RELATION_TONE = 'purple';
```

并保持以下辅助函数边界：

- `relationTone(relationId)`：只返回普通身份色卡。
- `relationBoxTone(relationView)`：orphan 返回紫色，否则返回 `relationTone`。
- `candidateBoxTone(relationId)`：返回 `relationTone(relationId)`，不得返回紫色。
- `imageRelationSelected(relationId)`：只读取图像区选中状态。

### Phase B - 修复 Candidate 紫色路径

将 Candidate overlay 当前的固定紫色改为 Relation 身份色：

```ts
tone: relationTone(relationId)
```

保留：

```ts
selected: imageRelationSelected(relationId)
```

这样 Candidate overlay 仍能在图像区被点选后变红，但不会在默认状态下使用紫色。

### Phase C - 补充回归测试

前端测试需要覆盖以下断言：

- 页面初始进入时，bbox selected class 数量为 0。
- `R1` 这类已被 Candidate 引用的 Relation 不得出现紫色、红色、黑色默认类。
- `C1 R1` 这类 Candidate overlay 不得出现紫色、红色、黑色默认类。
- 未被 Candidate 引用的 Relation 默认出现紫色。
- 点击未引用 Relation 后，该 box 通过 selected class 变红。
- 普通身份色卡只来自 `blue/green/orange/cyan/yellow/teal`。

### Phase D - 浏览器验收

使用当前一键 dev stack 启动前后端后，在真实审阅页做 DOM 与截图验收：

1. 激活 `DATASET/urban_violation/label_config.json`。
2. 打开样本审阅页。
3. 抽取 `.bbox-shell__box` 的 class 列表。
4. 验证：
   - `selected_element_count=0`；
   - `candidate_referenced_purple_count=0`；
   - `referenced_relation_purple_count=0`；
   - `orphan_purple_count>0`；
   - `black_element_count=0`；
   - `ordinary_palette_count>0`。
5. 截图留存。

## 验收标准

- 被 Candidate 引用的 Relation，包括 Candidate overlay，不再使用紫色默认线框。
- 紫色只出现在未被 Candidate 引用的 Relation 上。
- 红色只在用户图像区点选或编辑 bbox 后出现。
- 黑色不作为任何 bbox 线框色出现。
- 同一个 Relation 在 STEP1、STEP2、Candidate overlay 中使用同一个普通身份色。
- 普通身份色刷新后保持稳定，不随组件重渲染随机变化。
- 前端测试、前端构建、浏览器 DOM 验收均通过。

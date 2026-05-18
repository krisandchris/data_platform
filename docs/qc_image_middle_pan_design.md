# QC Image Preview Middle-Button Pan Design

## 目标

在样本审阅页的图像预览区域增加“鼠标中键拖动图片位置”能力，用于在放大后查看局部证据。该功能只改变图像视图位置，不改变任何 bbox 的 0-1000 量化坐标。

## 当前约束

- `BBoxOverlay.vue` 当前已经支持鼠标滚轮缩放。
- 缩放作用在整张 rendered image stage 上，bbox 与图像一起缩放。
- bbox 数据仍然是 0-1000 量化坐标，不能因为缩放或平移而变化。
- bbox 编辑通过 `stageRef.getBoundingClientRect()` 把屏幕指针坐标换算回 0-1000 坐标。
- bbox 拖拽/缩放编辑当前使用左键 pointer 操作。

## 交互定义

### 触发方式

- 鼠标中键按下并拖动：平移图像预览视图。
- 鼠标中键释放：结束平移。
- 鼠标滚轮：继续执行缩放。
- 鼠标左键拖动 bbox：继续执行 bbox 移动。
- 鼠标左键拖动 bbox 右下角 handle：继续执行 bbox resize。

### 优先级

中键拖拽优先级高于 bbox 编辑：

1. 如果 `event.button === 1` 或 `event.buttons & 4`，进入图像平移流程。
2. 中键拖拽不触发 `selectBox`。
3. 中键拖拽不触发 `updateBox`。
4. 中键落在 bbox 上时，也应平移图像，而不是移动 bbox。
5. 左键落在 editable bbox 上时，仍然进入 bbox 编辑流程。

### 浏览器默认行为处理

中键在浏览器中可能触发自动滚动、标签页打开或 Linux 中键粘贴。图像预览区内需要阻止这些默认行为：

- `pointerdown` 中键时 `preventDefault()`。
- `auxclick` 中键时 `preventDefault()`。
- 拖动期间禁用文本选择。

该阻止行为只作用于图像预览区，不影响右侧表单和页面其他区域。

## 视图状态模型

建议将当前的 `zoom + zoomOrigin` 模型升级为统一的 viewport transform：

```ts
const viewport = ref({
  zoom: 1,
  panX: 0,
  panY: 0,
});
```

stage 使用固定左上角原点：

```css
transform-origin: 0 0;
transform: translate(var(--pan-x), var(--pan-y)) scale(var(--zoom));
```

原因：

- 中键平移天然需要 `panX/panY`。
- 固定 `transform-origin: 0 0` 后，缩放、平移、边界 clamp 都可以用同一套数学模型。
- 继续依赖 `getBoundingClientRect()` 做 bbox 编辑坐标换算，bbox 仍然跟随图像变换，不会漂移。

## 滚轮缩放与平移的关系

滚轮缩放需要保持“鼠标所在图像点尽量不动”：

1. 读取当前 zoom、pan、stage 原始尺寸、shell 尺寸。
2. 把鼠标屏幕点换算成 stage local point。
3. 计算 nextZoom。
4. 反推 nextPan，让 local point 缩放后仍落在原鼠标位置。
5. 对 nextPan 做边界 clamp。

伪代码：

```ts
const localX = (event.clientX - baseStageLeft - panX) / zoom;
const localY = (event.clientY - baseStageTop - panY) / zoom;

const nextZoom = clamp(zoom * factor, MIN_ZOOM, MAX_ZOOM);
const nextPanX = event.clientX - baseStageLeft - localX * nextZoom;
const nextPanY = event.clientY - baseStageTop - localY * nextZoom;

viewport.value = {
  zoom: nextZoom,
  ...clampPan(nextPanX, nextPanY, nextZoom),
};
```

当 `nextZoom === 1` 时，`panX/panY` 应重置为 `0/0`。

## 中键拖拽流程

### 状态

```ts
let panDragState:
  | {
      pointerId: number;
      startClient: { x: number; y: number };
      startPan: { x: number; y: number };
    }
  | undefined;
```

### 开始

- 只接受鼠标中键。
- 如果 `zoom <= 1`，可以阻止默认行为，但不进入可见平移。
- 如果 `zoom > 1`：
  - 记录起点。
  - 添加 `window.pointermove` / `window.pointerup` / `window.pointercancel`。
  - 给 shell 添加 `bbox-shell--panning` class。

### 移动

```ts
const dx = event.clientX - panDragState.startClient.x;
const dy = event.clientY - panDragState.startClient.y;

const nextPan = clampPan(
  panDragState.startPan.x + dx,
  panDragState.startPan.y + dy,
  viewport.value.zoom,
);
```

### 结束

- 清空 `panDragState`。
- 移除 window 监听。
- 移除 `bbox-shell--panning` class。

## 平移边界

目标：放大后可以移动图像，但不能把图像拖到完全露出空白区域；bbox 永远留在 image stage 内。

### 基础量

- `shellWidth/shellHeight`：图像预览容器可见区域。
- `stageWidth/stageHeight`：未缩放时按图片比例 fit 后的 image stage 尺寸。
- `baseOffsetX/baseOffsetY`：未缩放 stage 在 shell 内的居中偏移。
- `scaledWidth = stageWidth * zoom`。
- `scaledHeight = stageHeight * zoom`。

### clamp 规则

如果缩放后某一轴仍不大于 shell，该轴不允许用户平移，并保持视觉居中：

```ts
if (scaledWidth <= shellWidth) panX = (stageWidth - scaledWidth) / 2;
if (scaledHeight <= shellHeight) panY = (stageHeight - scaledHeight) / 2;
```

如果缩放后某一轴大于 shell，限制平移范围：

```ts
minPanX = shellWidth - baseOffsetX - scaledWidth;
maxPanX = -baseOffsetX;
panX = clamp(panX, minPanX, maxPanX);

minPanY = shellHeight - baseOffsetY - scaledHeight;
maxPanY = -baseOffsetY;
panY = clamp(panY, minPanY, maxPanY);
```

这样可以保证：

- 图像不会被拖出到只剩黑色填充区。
- 原有因比例适配产生的黑色填充不会影响 bbox 坐标。
- bbox 和图像始终在同一个 transformed stage 内。

## 与 bbox 编辑的边界

### 不改变 bbox 数据

中键平移只修改 `viewport.panX/panY`，不得调用：

- `emit('selectBox', ...)`
- `emit('updateBox', ...)`

### 左键编辑保持不变

bbox 编辑流程只接受左键：

```ts
if (event.button !== 0) return;
```

resize handle 同样只接受左键。

### 坐标换算保持一致

`pointerToImagePoint()` 仍然可以使用 transformed `stageRef.getBoundingClientRect()`：

- stage 被 translate/scale 后仍是轴对齐矩形。
- `clientX/clientY` 相对 transformed rect 的比例仍能映射到 0-1000。
- bbox 拖拽编辑不会受到 pan/zoom 影响。

## 重置边界

以下场景需要 clamp 或 reset：

- 图片 URL 变化：`zoom=1, panX=0, panY=0`。
- 样本切换：随图片 URL reset。
- shell 尺寸变化：保留 zoom，重新 clamp pan；如果 zoom 为 1，则 pan 重置。
- 缩小到 1：pan 重置。
- 组件卸载：清理 pan 和 box edit 的所有 window 监听。

## 视觉状态

- 默认不新增说明文字，避免审阅界面干扰。
- `zoom > 1` 时可以给 shell 增加轻量状态 class：`bbox-shell--pannable`。
- 中键拖动中使用 `bbox-shell--panning`：
  - cursor: `grabbing`;
  - user-select: `none`;
  - 可选：临时降低 transition，避免拖动滞后。

注意：不要把普通 hover cursor 改成明显的 left-drag pan 暗示，因为左键仍然是 bbox 编辑。

## 测试验收

### 单元/组件测试

- wheel zoom 后 stage transform 包含 zoom。
- 中键 pointerdown + pointermove 改变 pan transform。
- zoom 为 1 时中键拖拽不产生 pan 偏移。
- 中键拖拽 bbox 不触发 `selectBox` / `updateBox`。
- 左键拖拽 bbox 仍触发 `selectBox` / `updateBox`。
- pan 被 clamp，不会超过边界。
- 图片变化后 pan/zoom 重置。

### 浏览器验收

- 打开样本审阅页。
- 滚轮放大图像。
- 鼠标中键拖动图像，图像与 bbox 同步移动。
- 中键拖动落在 bbox 上时，bbox 不被选中、不被移动。
- 左键拖动 bbox 时，bbox 仍可编辑，坐标 patch 正常生成。
- 缩小回 1 后图像回到居中 fit 状态。

## 实现顺序

1. 在 `BBoxOverlay.vue` 引入 `viewport.zoom/panX/panY` 状态。
2. 将现有 `zoomOrigin` 缩放模型改为固定原点 viewport transform。
3. 实现 `clampPan()`。
4. 改造 `handleWheelZoom()`，让缩放到鼠标位置与 pan clamp 协同。
5. 增加 `startImagePan/updateImagePan/stopImagePan`。
6. 调整 bbox pointerdown 分支，中键进入 pan，左键进入 bbox edit。
7. 增加 `auxclick.prevent` 防止中键默认行为。
8. 增加组件测试与真实页面 smoke。

## 实现结果

- 已将 `BBoxOverlay.vue` 从 `zoom + zoomOrigin` 改为 `viewport.zoom/panX/panY`。
- stage 使用 `transform-origin: 0 0` 和 `translate(...) scale(...)`。
- 中键拖动在放大后修改 `panX/panY`，不触发 `selectBox` 和 `updateBox`。
- 左键 bbox 移动和 resize 仍然保持原编辑语义。
- 缩小回 1x 或图片变化时重置 viewport。
- shell resize 后重新 clamp 当前 pan。
- 已增加组件测试和真实页面 CDP smoke 验证。

## 不做范围

- 不改变 bbox 存储坐标。
- 不新增后端字段。
- 不保存 pan/zoom 到后端。
- 不影响右侧 Relation/Candidate 编辑状态。
- 不把鼠标左键空白区域拖拽定义为 pan，避免和 bbox 编辑心智冲突。

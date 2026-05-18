<template>
  <div
    ref="shellRef"
    class="bbox-shell"
    :class="{ 'bbox-shell--pannable': viewport.zoom > MIN_ZOOM, 'bbox-shell--panning': isPanning }"
    :style="{ '--bbox-aspect': `${imageWidth} / ${imageHeight}` }"
    @pointerdown="startImagePan"
    @wheel.prevent="handleWheelZoom"
    @auxclick.prevent
  >
    <div ref="stageRef" class="bbox-shell__stage" :style="stageStyle">
      <img
        v-if="safeImageUrl"
        class="bbox-shell__image"
        :src="safeImageUrl"
        :alt="alt"
        @error="imageFailed = true"
      />
      <div v-if="imageFailed || !safeImageUrl" class="bbox-shell__fallback">
        <ImageOff :size="28" />
        <span>Media preview pending from backend URL</span>
      </div>

      <div
        v-for="box in boxes"
        :key="box.id"
        class="bbox-shell__box"
        :class="[
          `bbox-shell__box--${box.tone ?? 'blue'}`,
          { 'bbox-shell__box--selected': box.selected, 'bbox-shell__box--editable': box.editable },
        ]"
        :style="boxStyle(box.bbox)"
        role="button"
        tabindex="0"
        :aria-label="box.label"
        @click.stop="emit('selectBox', box)"
        @auxclick.stop.prevent
        @keydown.enter.prevent="emit('selectBox', box)"
        @keydown.space.prevent="emit('selectBox', box)"
        @pointerdown.stop="handleBoxPointerDown($event, box, 'move')"
      >
        <button
          v-if="box.editable"
          class="bbox-shell__resize"
          type="button"
          aria-label="Resize bounding box"
          @click.stop
          @auxclick.stop.prevent
          @pointerdown.stop.prevent="handleBoxPointerDown($event, box, 'resize')"
        ></button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ImageOff } from 'lucide-vue-next';
import { toBrowserMediaUrl } from '../../services/media';
import type { BBox } from '../types/contract';

export interface OverlayBox {
  id: string;
  label: string;
  bbox: BBox;
  tone?: 'blue' | 'green' | 'orange' | 'cyan' | 'yellow' | 'teal' | 'purple';
  relationIndex?: string;
  selected?: boolean;
  editable?: boolean;
}

const props = withDefaults(
  defineProps<{
    imageUrl?: string;
    alt?: string;
    boxes: OverlayBox[];
    imageWidth?: number;
    imageHeight?: number;
  }>(),
  {
    alt: 'Sample image',
    imageWidth: 1280,
    imageHeight: 720,
  },
);

const emit = defineEmits<{
  selectBox: [box: OverlayBox];
  updateBox: [box: OverlayBox, bbox: BBox];
}>();

const imageFailed = ref(false);
const shellRef = ref<HTMLElement>();
const stageRef = ref<HTMLElement>();
const shellSize = ref({ width: 0, height: 0 });
const viewport = ref({ zoom: 1, panX: 0, panY: 0 });
const isPanning = ref(false);
const safeImageUrl = computed(() => toBrowserMediaUrl(props.imageUrl));
const BBOX_COORDINATE_MAX = 1000;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_FACTOR = 1.12;
let resizeObserver: ResizeObserver | undefined;
let dragState:
  | {
      box: OverlayBox;
      mode: 'move' | 'resize';
      startPoint: { x: number; y: number };
      startBbox: [number, number, number, number];
    }
  | undefined;
let panDragState:
  | {
      startClient: { x: number; y: number };
      startPan: { x: number; y: number };
    }
  | undefined;

const stageDimensions = computed(() => {
  const aspect = props.imageWidth / props.imageHeight;
  const width = shellSize.value.width;
  const height = shellSize.value.height;

  if (width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }

  if (width / height > aspect) {
    return {
      width: height * aspect,
      height,
    };
  }

  return {
    width,
    height: width / aspect,
  };
});

const stageStyle = computed(() => {
  const { width, height } = stageDimensions.value;
  if (width <= 0 || height <= 0) {
    return {};
  }
  return {
    width: `${width}px`,
    height: `${height}px`,
    transform: `translate(${roundPan(viewport.value.panX)}px, ${roundPan(viewport.value.panY)}px) scale(${viewport.value.zoom})`,
    transformOrigin: '0 0',
  };
});

watch([safeImageUrl, () => props.imageWidth, () => props.imageHeight], () => {
  imageFailed.value = false;
  resetViewport();
});

onMounted(() => {
  if (typeof ResizeObserver === 'undefined') {
    updateShellSize();
    return;
  }

  resizeObserver = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect;
    if (!rect) {
      return;
    }
    shellSize.value = {
      width: rect.width,
      height: rect.height,
    };
    clampViewportPan();
  });
  if (shellRef.value) {
    resizeObserver.observe(shellRef.value);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  stopBoxEdit();
  stopImagePan();
});

const boxStyle = (bbox: BBox) => {
  const [x1, y1, x2, y2] = normalizeBbox(cloneBbox(bbox));
  return {
    left: quantizedToPercent(x1),
    top: quantizedToPercent(y1),
    width: quantizedToPercent(x2 - x1),
    height: quantizedToPercent(y2 - y1),
  };
};

function updateShellSize() {
  const rect = shellRef.value?.getBoundingClientRect();
  shellSize.value = {
    width: rect?.width || props.imageWidth,
    height: rect?.height || props.imageHeight,
  };
  clampViewportPan();
}

function handleWheelZoom(event: WheelEvent) {
  const metrics = viewportMetrics();
  if (!metrics) {
    return;
  }

  const current = viewport.value;
  const factor = event.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
  const nextZoom = roundZoom(clamp(current.zoom * factor, MIN_ZOOM, MAX_ZOOM));
  if (nextZoom <= MIN_ZOOM) {
    resetViewport();
    return;
  }

  const localX = clamp(
    (event.clientX - metrics.baseLeft - current.panX) / current.zoom,
    0,
    metrics.stageWidth,
  );
  const localY = clamp(
    (event.clientY - metrics.baseTop - current.panY) / current.zoom,
    0,
    metrics.stageHeight,
  );
  const nextPan = clampPan(
    event.clientX - metrics.baseLeft - localX * nextZoom,
    event.clientY - metrics.baseTop - localY * nextZoom,
    nextZoom,
  );

  viewport.value = {
    zoom: nextZoom,
    ...nextPan,
  };
}

function resetViewport() {
  viewport.value = { zoom: 1, panX: 0, panY: 0 };
}

function handleBoxPointerDown(event: PointerEvent, box: OverlayBox, mode: 'move' | 'resize') {
  if (isMiddleButton(event)) {
    startImagePan(event);
    return;
  }
  startBoxEdit(event, box, mode);
}

function startBoxEdit(event: PointerEvent, box: OverlayBox, mode: 'move' | 'resize') {
  if (event.button !== 0) {
    return;
  }
  event.preventDefault();
  emit('selectBox', box);
  if (!box.editable) {
    return;
  }

  dragState = {
    box,
    mode,
    startPoint: pointerToImagePoint(event),
    startBbox: cloneBbox(box.bbox),
  };
  window.addEventListener('pointermove', updateBoxEdit);
  window.addEventListener('pointerup', stopBoxEdit, { once: true });
  window.addEventListener('pointercancel', stopBoxEdit, { once: true });
}

function updateBoxEdit(event: PointerEvent) {
  if (!dragState) {
    return;
  }

  const point = pointerToImagePoint(event);
  const dx = point.x - dragState.startPoint.x;
  const dy = point.y - dragState.startPoint.y;
  const [x1, y1, x2, y2] = dragState.startBbox;

  const next =
    dragState.mode === 'move'
      ? normalizeBbox([x1 + dx, y1 + dy, x2 + dx, y2 + dy])
      : normalizeBbox([x1, y1, x2 + dx, y2 + dy]);

  emit('updateBox', dragState.box, next);
}

function stopBoxEdit() {
  dragState = undefined;
  window.removeEventListener('pointermove', updateBoxEdit);
  window.removeEventListener('pointerup', stopBoxEdit);
  window.removeEventListener('pointercancel', stopBoxEdit);
}

function startImagePan(event: PointerEvent) {
  if (!isMiddleButton(event)) {
    return;
  }
  event.preventDefault();
  if (viewport.value.zoom <= MIN_ZOOM) {
    return;
  }

  panDragState = {
    startClient: { x: event.clientX, y: event.clientY },
    startPan: { x: viewport.value.panX, y: viewport.value.panY },
  };
  isPanning.value = true;
  window.addEventListener('pointermove', updateImagePan);
  window.addEventListener('pointerup', stopImagePan, { once: true });
  window.addEventListener('pointercancel', stopImagePan, { once: true });
}

function updateImagePan(event: PointerEvent) {
  if (!panDragState) {
    return;
  }
  event.preventDefault();
  const dx = event.clientX - panDragState.startClient.x;
  const dy = event.clientY - panDragState.startClient.y;
  const nextPan = clampPan(
    panDragState.startPan.x + dx,
    panDragState.startPan.y + dy,
    viewport.value.zoom,
  );
  viewport.value = {
    ...viewport.value,
    ...nextPan,
  };
}

function stopImagePan() {
  panDragState = undefined;
  isPanning.value = false;
  window.removeEventListener('pointermove', updateImagePan);
  window.removeEventListener('pointerup', stopImagePan);
  window.removeEventListener('pointercancel', stopImagePan);
}

function pointerToImagePoint(event: PointerEvent) {
  const rect = stageRef.value?.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: ((event.clientX - rect.left) / rect.width) * BBOX_COORDINATE_MAX,
    y: ((event.clientY - rect.top) / rect.height) * BBOX_COORDINATE_MAX,
  };
}

function isMiddleButton(event: PointerEvent) {
  return event.button === 1 || Boolean(event.buttons & 4);
}

function clampViewportPan() {
  if (viewport.value.zoom <= MIN_ZOOM) {
    viewport.value = { ...viewport.value, panX: 0, panY: 0 };
    return;
  }
  viewport.value = {
    ...viewport.value,
    ...clampPan(viewport.value.panX, viewport.value.panY, viewport.value.zoom),
  };
}

function clampPan(panX: number, panY: number, zoomValue: number) {
  const metrics = viewportMetrics();
  if (!metrics || zoomValue <= MIN_ZOOM) {
    return { panX: 0, panY: 0 };
  }
  return {
    panX: clampPanAxis(panX, metrics.shellWidth, metrics.stageWidth, metrics.baseOffsetX, zoomValue),
    panY: clampPanAxis(panY, metrics.shellHeight, metrics.stageHeight, metrics.baseOffsetY, zoomValue),
  };
}

function clampPanAxis(value: number, shellLength: number, stageLength: number, baseOffset: number, zoomValue: number) {
  const scaledLength = stageLength * zoomValue;
  if (scaledLength <= shellLength) {
    return (stageLength - scaledLength) / 2;
  }
  return clamp(value, shellLength - baseOffset - scaledLength, -baseOffset);
}

function viewportMetrics() {
  const { width: stageWidth, height: stageHeight } = stageDimensions.value;
  const shellWidth = shellSize.value.width;
  const shellHeight = shellSize.value.height;
  const shellRect = shellRef.value?.getBoundingClientRect();
  if (stageWidth <= 0 || stageHeight <= 0 || shellWidth <= 0 || shellHeight <= 0) {
    return undefined;
  }

  const baseOffsetX = Math.max(0, (shellWidth - stageWidth) / 2);
  const baseOffsetY = Math.max(0, (shellHeight - stageHeight) / 2);
  return {
    shellWidth,
    shellHeight,
    stageWidth,
    stageHeight,
    baseOffsetX,
    baseOffsetY,
    baseLeft: (shellRect?.left ?? 0) + baseOffsetX,
    baseTop: (shellRect?.top ?? 0) + baseOffsetY,
  };
}

function cloneBbox(value: readonly number[]): [number, number, number, number] {
  return [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0, value[3] ?? 0];
}

function normalizeBbox(value: [number, number, number, number]): BBox {
  const width = Math.max(1, value[2] - value[0]);
  const height = Math.max(1, value[3] - value[1]);
  let x1 = value[0];
  let y1 = value[1];
  let x2 = value[2];
  let y2 = value[3];

  if (x1 < 0) {
    x2 = Math.min(BBOX_COORDINATE_MAX, width);
    x1 = 0;
  }
  if (y1 < 0) {
    y2 = Math.min(BBOX_COORDINATE_MAX, height);
    y1 = 0;
  }
  if (x2 > BBOX_COORDINATE_MAX) {
    x1 = Math.max(0, BBOX_COORDINATE_MAX - width);
    x2 = BBOX_COORDINATE_MAX;
  }
  if (y2 > BBOX_COORDINATE_MAX) {
    y1 = Math.max(0, BBOX_COORDINATE_MAX - height);
    y2 = BBOX_COORDINATE_MAX;
  }

  x1 = clamp(Math.round(x1), 0, BBOX_COORDINATE_MAX - 1);
  y1 = clamp(Math.round(y1), 0, BBOX_COORDINATE_MAX - 1);
  x2 = clamp(Math.round(x2), x1 + 1, BBOX_COORDINATE_MAX);
  y2 = clamp(Math.round(y2), y1 + 1, BBOX_COORDINATE_MAX);

  return [x1, y1, x2, y2];
}

function quantizedToPercent(value: number) {
  return `${(clamp(value, 0, BBOX_COORDINATE_MAX) / BBOX_COORDINATE_MAX) * 100}%`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundZoom(value: number) {
  return Math.round(value * 100) / 100;
}

function roundPan(value: number) {
  return Math.round(value * 100) / 100;
}
</script>

<style scoped>
.bbox-shell {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  display: grid;
  place-items: center;
  aspect-ratio: var(--bbox-aspect);
  background:
    linear-gradient(135deg, rgba(18, 100, 255, 0.08), transparent 32%),
    #0d1015;
}

.bbox-shell__stage {
  position: relative;
  max-width: 100%;
  max-height: 100%;
  overflow: hidden;
  background: #111827;
  transform: translate(0, 0) scale(1);
  transform-origin: 0 0;
  transition: transform 0.12s ease;
  will-change: transform;
}

.bbox-shell--panning,
.bbox-shell--panning * {
  cursor: grabbing !important;
  user-select: none;
}

.bbox-shell--panning .bbox-shell__stage {
  transition: none;
}

.bbox-shell__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.bbox-shell__fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  color: #475467;
  font-weight: 700;
}

.bbox-shell__box {
  position: absolute;
  border: 2px solid currentColor;
  background: transparent;
  cursor: pointer;
  opacity: 0.92;
  outline: none;
  pointer-events: none;
  transition: border-color 0.15s ease, opacity 0.15s ease;
}

.bbox-shell__box:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.86);
  outline-offset: 2px;
}

.bbox-shell__box--selected {
  border-color: #ff3b30;
  opacity: 1;
  z-index: 5;
}

.bbox-shell__box--editable {
  cursor: move;
  pointer-events: auto;
}

.bbox-shell__box--editable:hover {
  opacity: 1;
}

.bbox-shell__resize {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 9px;
  height: 9px;
  border: 1px solid rgba(255, 255, 255, 0.86);
  border-radius: 2px;
  background: currentColor;
  cursor: nwse-resize;
  opacity: 0.58;
  padding: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.bbox-shell__box--editable:hover .bbox-shell__resize,
.bbox-shell__box--selected .bbox-shell__resize,
.bbox-shell__resize:focus-visible {
  background: #ff3b30;
  opacity: 1;
  transform: scale(1.05);
}

.bbox-shell__box--blue {
  color: #7aa7ff;
}

.bbox-shell__box--green {
  color: #67d391;
}

.bbox-shell__box--orange {
  color: #f6ad55;
}

.bbox-shell__box--purple {
  color: #c084fc;
}

.bbox-shell__box--cyan {
  color: #22d3ee;
}

.bbox-shell__box--yellow {
  color: #facc15;
}

.bbox-shell__box--teal {
  color: #2dd4bf;
}
</style>

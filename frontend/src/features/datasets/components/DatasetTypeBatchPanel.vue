<template>
  <section class="panel type-batch-panel">
    <div class="type-batch-panel__header">
      <div>
        <h2 class="panel__title">批次管理</h2>
        <strong>{{ group.batchCount }} 个批次</strong>
      </div>
      <button class="button" type="button" @click="openBatchForm">
        <Plus :size="16" />
        新建批次
      </button>
    </div>

    <form v-if="showBatchForm" class="batch-create-form" @submit.prevent="createBatch">
      <div class="batch-create-form__header">
        <div>
          <strong>登记批次数据</strong>
          <span>选择目录结构后扫描本地目录文件名，提交后生成该类型下的新批次和导入校验任务。</span>
        </div>
        <button class="button" type="button" @click="closeBatchForm">取消</button>
      </div>

      <div class="batch-create-form__grid">
        <label>
          <span>批次标识</span>
          <input v-model.trim="newBatch.batchKey" placeholder="20260518_roadside" pattern="^[A-Za-z0-9_-]+$" required />
        </label>
        <label>
          <span>批次名称</span>
          <input v-model.trim="newBatch.batchName" placeholder="2026-05-18 路侧巡检" required />
        </label>
        <label>
          <span>目录结构</span>
          <select v-model="newBatch.sourceStructure">
            <option value="images_only">仅 images 图片目录</option>
            <option value="images_with_preannotations">图片 + STEP1/STEP2 产物</option>
          </select>
        </label>
        <label>
          <span>目录标识 / 服务器路径</span>
          <input v-model.trim="newBatch.sourceUri" placeholder="DATASET/urban_violation/20260518_roadside" />
        </label>
      </div>

      <label class="batch-directory-picker">
        <input type="file" multiple webkitdirectory directory @change="onDirectorySelected" />
        <FolderOpen :size="18" />
        <span>选择批次目录</span>
        <small>{{ directoryScanLabel }}</small>
      </label>

      <dl class="batch-scan-metrics">
        <div>
          <dt>文件</dt>
          <dd>{{ batchScan.sourceFileCount }}</dd>
        </div>
        <div>
          <dt>图片</dt>
          <dd>{{ batchScan.imageCount }}</dd>
        </div>
        <div>
          <dt>STEP1</dt>
          <dd>{{ batchScan.stage1FileCount }}</dd>
        </div>
        <div>
          <dt>STEP2</dt>
          <dd>{{ batchScan.stage2FileCount }}</dd>
        </div>
        <div>
          <dt>失败产物</dt>
          <dd>{{ batchScan.stage2FailureFileCount }}</dd>
        </div>
      </dl>

      <div class="batch-create-form__footer">
        <p v-if="batchMessage" class="type-message" :class="{ error: batchMessageIsError }">{{ batchMessage }}</p>
        <button class="button button--primary" type="submit" :disabled="creatingBatch || !newBatch.batchKey || !newBatch.batchName">
          <Plus :size="16" />
          创建批次
        </button>
      </div>
    </form>

    <div class="batch-list">
      <article v-for="batch in group.batches" :key="batch.id" class="batch-row">
        <div class="batch-row__identity">
          <strong>{{ displayBatchName(batch) }}</strong>
          <span>{{ batch.id }} · 批次标识：{{ batch.batchKey ?? '-' }}</span>
          <small v-if="batch.sourceStructure">{{ sourceStructureText(batch.sourceStructure) }} · {{ batch.sourceUri || '未声明路径' }}</small>
        </div>
        <div class="batch-row__status">
          <StatusChip :value="batch.lifecycleStatus ?? batch.status" :label="lifecycleLabel(batch.lifecycleStatus ?? batch.status)" />
          <small>最近导入：{{ importStateText(batch.latestImportJob?.state ?? batch.activeImportJobId) }}</small>
        </div>
        <dl class="batch-row__metrics">
          <div>
            <dt>资产</dt>
            <dd>{{ batch.assetTotal ?? '-' }}</dd>
          </div>
          <div>
            <dt>预标注</dt>
            <dd>{{ preannotationText(batch) }}</dd>
          </div>
          <div>
            <dt>质检</dt>
            <dd>{{ qcProgressText(batch) }}</dd>
          </div>
        </dl>
        <div class="batch-row__actions">
          <RouterLink class="button" :to="`/datasets/${batch.id}/overview`">
            <LayoutDashboard :size="16" />
            概览
          </RouterLink>
          <RouterLink class="button" :to="`/datasets/${batch.id}/assets`">
            <Table2 :size="16" />
            资产
          </RouterLink>
          <RouterLink
            v-if="batch.activeImportJobId || batch.latestImportJob"
            class="button"
            :to="`/datasets/${batch.id}/import-jobs/${batch.activeImportJobId ?? batch.latestImportJob?.id}`"
          >
            <FileSearch :size="16" />
            导入校验
          </RouterLink>
          <RouterLink v-if="batch.qcQueueId" class="button button--primary" :to="`/datasets/${batch.id}/qc`">
            <ShieldCheck :size="16" />
            进入质检队列
          </RouterLink>
          <button
            v-else-if="canGenerateBatchQcQueue(batch)"
            class="button button--primary"
            type="button"
            :disabled="generatingQcBatchId === batch.id"
            @click="generateBatchQcQueue(batch)"
          >
            <ShieldCheck :size="16" />
            {{ generatingQcBatchId === batch.id ? '生成中...' : '生成质检队列' }}
          </button>
          <button v-else class="button" type="button" disabled>
            <ShieldCheck :size="16" />
            队列未生成
          </button>
          <small
            v-if="qcQueueMessages[batch.id]"
            class="batch-row__message"
            :class="{ error: qcQueueMessageErrors[batch.id] }"
          >
            {{ qcQueueMessages[batch.id] }}
          </small>
        </div>
      </article>
      <article v-if="!group.batches.length" class="batch-empty-row">
        <div>
          <strong>暂无批次</strong>
          <span>先确认 {{ group.datasetType }} 的类型配置，再创建该类型下的导入批次。</span>
        </div>
        <button class="button" type="button" @click="openBatchForm">
          <Plus :size="16" />
          新建批次
        </button>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { FileSearch, FolderOpen, LayoutDashboard, Plus, ShieldCheck, Table2 } from 'lucide-vue-next';
import { apiClient } from '../../../services/urbanViolationApi';
import StatusChip from '../../../shared/components/StatusChip.vue';
import type { Dataset, DatasetType, ImportSourceStructure } from '../../../shared/types/contract';

const props = defineProps<{
  group: DatasetType;
  initialCreateOpen?: boolean;
}>();

const emit = defineEmits<{
  reload: [];
}>();

const showBatchForm = ref(false);
const creatingBatch = ref(false);
const batchMessage = ref('');
const batchMessageIsError = ref(false);
const generatingQcBatchId = ref('');
const qcQueueMessages = reactive<Record<string, string>>({});
const qcQueueMessageErrors = reactive<Record<string, boolean>>({});
const consumedInitialCreateOpen = ref(false);
const newBatch = reactive({
  datasetType: '',
  batchKey: '',
  batchName: '',
  sourceMode: 'local_directory' as const,
  sourceUri: '',
  sourceStructure: 'images_only' as ImportSourceStructure,
  description: '',
});
const batchScan = reactive({
  rootName: '',
  sourceFileCount: 0,
  imageCount: 0,
  stage1FileCount: 0,
  stage2FileCount: 0,
  stage2FailureFileCount: 0,
});

const directoryScanLabel = computed(() => {
  if (!batchScan.sourceFileCount) {
    return '支持选择仅 images 目录，或包含 images / step1 / step2 的批次目录';
  }
  return `${batchScan.rootName || '已选目录'} · ${batchScan.sourceFileCount} 个文件`;
});

watch(
  () => props.initialCreateOpen,
  (shouldOpen) => {
    if (shouldOpen && !consumedInitialCreateOpen.value) {
      openBatchForm();
      consumedInitialCreateOpen.value = true;
    }
  },
  { immediate: true },
);

watch(
  () => props.group.datasetType,
  () => {
    closeBatchForm();
    consumedInitialCreateOpen.value = Boolean(props.initialCreateOpen);
  },
);

const preannotationText = (batch: Dataset) => {
  const stage1 = batch.stage1Total ?? 0;
  const stage2 = batch.stage2SuccessTotal ?? 0;
  const failures = batch.stage2FailureTotal ?? 0;
  return stage1 || stage2 || failures ? `S1 ${stage1} / S2 ${stage2} / 失败 ${failures}` : '-';
};

const qcProgressText = (batch: Dataset) => {
  if (!batch.qcProgress) {
    return '-';
  }
  const total = batch.qcProgress.total ?? batch.qcProgress.pending + batch.qcProgress.submitted;
  return `${batch.qcProgress.submitted}/${total}`;
};

const canGenerateBatchQcQueue = (batch: Dataset) => (
  (batch.lifecycleStatus ?? batch.status) === 'preannotation_ready' && !batch.qcQueueId
);

async function generateBatchQcQueue(batch: Dataset) {
  if (!canGenerateBatchQcQueue(batch) || generatingQcBatchId.value) {
    return;
  }
  generatingQcBatchId.value = batch.id;
  qcQueueMessages[batch.id] = '';
  qcQueueMessageErrors[batch.id] = false;
  try {
    await apiClient.generateQcQueue(batch.id);
    qcQueueMessages[batch.id] = '质检队列已生成';
    emit('reload');
  } catch (err) {
    qcQueueMessageErrors[batch.id] = true;
    qcQueueMessages[batch.id] = err instanceof Error ? err.message : '生成质检队列失败';
  } finally {
    generatingQcBatchId.value = '';
  }
}

type BatchPathCandidate = {
  rootKey: string;
  rootName: string;
  includeMarkerRoot: boolean;
};

const imageFilePattern = /\.(jpe?g|png|webp|bmp)$/i;
const jsonFilePattern = /\.json$/i;

const isStage1RunSegment = (segment: string) => {
  const lowered = segment.toLowerCase();
  return lowered.startsWith('stage1') || lowered.startsWith('step1');
};

const isStage2RunSegment = (segment: string) => {
  const lowered = segment.toLowerCase();
  return lowered.startsWith('stage2') || lowered.startsWith('step2');
};

const normalizeRelativePath = (file: File) => {
  return ((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name)
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .join('/');
};

const detectBatchCandidate = (path: string): BatchPathCandidate | null => {
  const segments = path.split('/').filter(Boolean);
  const markerIndex = segments.findIndex((segment) => {
    const lowered = segment.toLowerCase();
    return lowered === 'images' || isStage1RunSegment(segment) || isStage2RunSegment(segment);
  });
  if (markerIndex < 0) {
    return null;
  }
  if (markerIndex === 0) {
    return {
      rootKey: segments[0],
      rootName: segments[0],
      includeMarkerRoot: true,
    };
  }
  const rootSegments = segments.slice(0, markerIndex);
  return {
    rootKey: rootSegments.join('/'),
    rootName: rootSegments[rootSegments.length - 1],
    includeMarkerRoot: false,
  };
};

const relativeSegmentsForCandidate = (path: string, candidate: BatchPathCandidate) => {
  const segments = path.split('/').filter(Boolean);
  if (candidate.includeMarkerRoot) {
    return segments;
  }
  if (path === candidate.rootKey) {
    return [];
  }
  return path.slice(candidate.rootKey.length + 1).split('/').filter(Boolean);
};

const pathBelongsToCandidate = (path: string, candidate: BatchPathCandidate) => {
  return path === candidate.rootKey || path.startsWith(`${candidate.rootKey}/`);
};

const applyBusinessPathCounts = (relativeSegments: string[], path: string) => {
  if (!relativeSegments.length) {
    return;
  }
  const [head, second] = relativeSegments;
  const loweredSecond = second?.toLowerCase();
  if (head.toLowerCase() === 'images' && imageFilePattern.test(path)) {
    batchScan.imageCount += 1;
    return;
  }
  if (!jsonFilePattern.test(path)) {
    return;
  }
  if (isStage1RunSegment(head) && loweredSecond === 'parsed') {
    batchScan.stage1FileCount += 1;
    return;
  }
  if (!isStage2RunSegment(head)) {
    return;
  }
  if (loweredSecond === 'parsed') {
    batchScan.stage2FileCount += 1;
    return;
  }
  if (loweredSecond === 'failures') {
    batchScan.stage2FailureFileCount += 1;
  }
};

function resetBatchScan() {
  batchScan.rootName = '';
  batchScan.sourceFileCount = 0;
  batchScan.imageCount = 0;
  batchScan.stage1FileCount = 0;
  batchScan.stage2FileCount = 0;
  batchScan.stage2FailureFileCount = 0;
}

function openBatchForm() {
  showBatchForm.value = true;
  batchMessage.value = '';
  batchMessageIsError.value = false;
  newBatch.datasetType = props.group.datasetType;
  newBatch.batchKey = '';
  newBatch.batchName = '';
  newBatch.sourceUri = '';
  newBatch.sourceStructure = 'images_only';
  newBatch.description = '';
  resetBatchScan();
}

function closeBatchForm() {
  showBatchForm.value = false;
  batchMessage.value = '';
  batchMessageIsError.value = false;
}

function onDirectorySelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  resetBatchScan();
  batchMessage.value = '';
  batchMessageIsError.value = false;

  const paths = files.map((file) => normalizeRelativePath(file)).filter(Boolean);
  const candidates = new Map<string, BatchPathCandidate>();
  for (const path of paths) {
    const candidate = detectBatchCandidate(path);
    if (candidate !== null) {
      candidates.set(candidate.rootKey, candidate);
    }
  }
  if (candidates.size === 0) {
    batchMessageIsError.value = true;
    batchMessage.value = '未识别到批次根目录：需要 images/，或 stage1_run_*/stage2_run_* 目录。';
    return;
  }
  if (candidates.size > 1) {
    batchMessageIsError.value = true;
    batchMessage.value = `检测到 ${candidates.size} 个批次根目录，请只选择单个批次目录。`;
    return;
  }

  const candidate = Array.from(candidates.values())[0];
  if (candidate === undefined) {
    return;
  }
  batchScan.rootName = candidate.rootKey;
  for (const path of paths) {
    if (!pathBelongsToCandidate(path, candidate)) {
      continue;
    }
    batchScan.sourceFileCount += 1;
    applyBusinessPathCounts(relativeSegmentsForCandidate(path, candidate), path);
  }
  if (batchScan.stage1FileCount || batchScan.stage2FileCount || batchScan.stage2FailureFileCount) {
    newBatch.sourceStructure = 'images_with_preannotations';
  } else {
    newBatch.sourceStructure = 'images_only';
  }
  if (!newBatch.sourceUri && batchScan.rootName) {
    newBatch.sourceUri = batchScan.rootName;
  }
}

async function createBatch() {
  if (!newBatch.datasetType || !newBatch.batchKey || !newBatch.batchName) {
    return;
  }
  creatingBatch.value = true;
  batchMessage.value = '';
  batchMessageIsError.value = false;
  try {
    const created = await apiClient.createImportJob(newBatch.datasetType, {
      datasetType: newBatch.datasetType,
      batchKey: newBatch.batchKey,
      batchName: newBatch.batchName,
      sourceMode: newBatch.sourceMode,
      sourceUri: newBatch.sourceUri || undefined,
      sourceStructure: newBatch.sourceStructure,
      description: newBatch.description || undefined,
      sourceFileCount: batchScan.sourceFileCount,
      imageCount: batchScan.imageCount,
      stage1FileCount: newBatch.sourceStructure === 'images_only' ? 0 : batchScan.stage1FileCount,
      stage2FileCount: newBatch.sourceStructure === 'images_only' ? 0 : batchScan.stage2FileCount,
      stage2FailureFileCount: newBatch.sourceStructure === 'images_only' ? 0 : batchScan.stage2FailureFileCount,
    });
    batchMessage.value = `已创建批次 ${created.datasetId}`;
    showBatchForm.value = false;
    emit('reload');
  } catch (err) {
    batchMessageIsError.value = true;
    batchMessage.value = err instanceof Error ? err.message : '创建批次失败';
  } finally {
    creatingBatch.value = false;
  }
}

const sourceStructureText = (structure: ImportSourceStructure) => {
  return structure === 'images_with_preannotations' ? '图片 + STEP1/STEP2' : '仅图片';
};

const displayBatchName = (batch: Dataset) => {
  const rawName = batch.batchName ?? batch.name;
  if (rawName === 'Urban Violation') {
    return '城市违规 0508';
  }
  return rawName;
};

const lifecycleLabel = (status: string) => {
  const labels: Record<string, string> = {
    active: '启用中',
    registered: '已登记',
    imported: '已导入',
    preannotation_pending: '待预标注',
    preannotation_ready: '预标注就绪',
    preannotation_failed: '预标注失败',
    label_config_required: '待配置标签',
    qc_ready: '质检就绪',
    qc_in_progress: '质检中',
    qc_completed: '质检完成',
  };
  return labels[status] ?? status;
};

const importStateText = (state?: string) => {
  if (!state) {
    return '未创建';
  }
  const labels: Record<string, string> = {
    Draft: '草稿',
    Validating: '校验中',
    ValidationFailed: '校验失败',
    Validated: '已校验',
    Importing: '导入中',
    Imported: '已导入',
    ImportFailed: '导入失败',
  };
  return labels[state] ?? state;
};
</script>

<style scoped>
.type-batch-panel {
  overflow: hidden;
}

.type-batch-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--line);
}

.type-batch-panel__header > div {
  display: grid;
  gap: 4px;
}

.type-batch-panel__header strong {
  color: var(--muted);
  font-size: 13px;
}

.batch-create-form {
  display: grid;
  gap: 14px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--panel) 92%, var(--blue) 8%);
}

.batch-create-form__header,
.batch-create-form__footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.batch-create-form__header div {
  display: grid;
  gap: 4px;
}

.batch-create-form__header span,
.batch-directory-picker small {
  color: var(--muted);
  font-size: 13px;
}

.batch-create-form__grid {
  display: grid;
  grid-template-columns: minmax(160px, 0.8fr) minmax(180px, 1fr) minmax(220px, 1fr) minmax(220px, 1.1fr);
  gap: 12px;
}

.batch-create-form__grid label {
  display: grid;
  gap: 6px;
}

.batch-create-form__grid span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 760;
}

.batch-create-form__grid input,
.batch-create-form__grid select {
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  color: var(--text);
}

.type-message {
  margin: 0;
  color: var(--green);
  font-size: 13px;
  font-weight: 720;
}

.type-message.error {
  color: var(--red);
}

.batch-directory-picker {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px dashed color-mix(in srgb, var(--blue) 50%, var(--line));
  border-radius: 8px;
  cursor: pointer;
}

.batch-directory-picker input {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.batch-scan-metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
}

.batch-scan-metrics div {
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
}

.batch-scan-metrics dt {
  color: var(--muted);
  font-size: 12px;
  font-weight: 720;
}

.batch-scan-metrics dd {
  margin: 3px 0 0;
  font-size: 18px;
  font-weight: 800;
}

.batch-list {
  display: grid;
}

.batch-row {
  display: grid;
  grid-template-columns: minmax(220px, 1.1fr) minmax(170px, 0.65fr) minmax(260px, 1fr) minmax(320px, 1.3fr);
  gap: 16px;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
}

.batch-empty-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
}

.batch-empty-row div {
  display: grid;
  gap: 4px;
}

.batch-empty-row strong {
  color: var(--text);
}

.batch-row:last-child {
  border-bottom: 0;
}

.batch-row__identity,
.batch-row__status {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.batch-row__identity span,
.batch-row__identity small,
.batch-row__status small {
  color: var(--muted);
  overflow-wrap: anywhere;
}

.batch-row__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
}

.batch-row__metrics dt {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.batch-row__metrics dd {
  margin: 2px 0 0;
  overflow-wrap: anywhere;
  font-weight: 720;
}

.batch-row__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.batch-row__message {
  flex-basis: 100%;
  color: var(--green);
  font-size: 12px;
  font-weight: 720;
  text-align: right;
}

.batch-row__message.error {
  color: var(--red);
}

@media (max-width: 780px) {
  .batch-create-form__grid,
  .batch-create-form__footer,
  .batch-row {
    grid-template-columns: 1fr;
  }

  .batch-create-form__header {
    align-items: stretch;
    flex-direction: column;
  }

  .batch-directory-picker,
  .batch-scan-metrics {
    grid-template-columns: 1fr;
  }

  .batch-empty-row,
  .type-batch-panel__header {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>

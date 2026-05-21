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
          <strong>上传批次压缩包</strong>
          <span>上传 urban_violation_0520.zip 这类批次包，后端会解压到运行态目录并登记为新批次。</span>
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
          <span>备注</span>
          <input v-model.trim="newBatch.description" placeholder="可选：数据来源、采集说明" />
        </label>
      </div>

      <label class="batch-directory-picker">
        <input type="file" accept=".zip,application/zip,application/x-zip-compressed" @change="onArchiveSelected" />
        <FileArchive :size="18" />
        <span>选择批次压缩包</span>
        <small>{{ archiveUploadLabel }}</small>
      </label>

      <dl class="batch-scan-metrics">
        <div>
          <dt>文件名</dt>
          <dd>{{ batchArchiveFile?.name ?? '-' }}</dd>
        </div>
        <div>
          <dt>大小</dt>
          <dd>{{ batchArchiveFile ? formatBytes(batchArchiveFile.size) : '-' }}</dd>
        </div>
        <div>
          <dt>上传方式</dt>
          <dd>压缩包</dd>
        </div>
        <div>
          <dt>解压位置</dt>
          <dd>运行态目录</dd>
        </div>
        <div>
          <dt>导入统计</dt>
          <dd>后端生成</dd>
        </div>
      </dl>

      <div
        v-if="uploadProgressVisible"
        class="archive-upload-progress"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="uploadProgressPercent"
      >
        <div class="archive-upload-progress__header">
          <span>{{ uploadProgressTitle }}</span>
          <strong>{{ uploadProgressPercent }}%</strong>
        </div>
        <div class="archive-upload-progress__track">
          <span :style="uploadProgressStyle"></span>
        </div>
        <small>{{ uploadProgressDetail }}</small>
      </div>

      <div class="batch-create-form__footer">
        <p v-if="batchMessage" class="type-message" :class="{ error: batchMessageIsError }">{{ batchMessage }}</p>
        <button class="button button--primary" type="submit" :disabled="creatingBatch || !newBatch.batchKey || !newBatch.batchName || !batchArchiveFile">
          <Plus :size="16" />
          {{ creatingBatch ? '上传中...' : '上传并创建批次' }}
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
import { FileArchive, FileSearch, LayoutDashboard, Plus, ShieldCheck, Table2 } from 'lucide-vue-next';
import { apiClient } from '../../../services/urbanViolationApi';
import StatusChip from '../../../shared/components/StatusChip.vue';
import type {
  Dataset,
  DatasetType,
  ImportArchiveUploadProgress,
  ImportSourceStructure,
} from '../../../shared/types/contract';

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
const batchArchiveFile = ref<File | null>(null);
const uploadPhase = ref<'idle' | 'uploading' | 'processing'>('idle');
const uploadLoadedBytes = ref(0);
const uploadTotalBytes = ref(0);
const uploadProgressValue = ref(0);
const generatingQcBatchId = ref('');
const qcQueueMessages = reactive<Record<string, string>>({});
const qcQueueMessageErrors = reactive<Record<string, boolean>>({});
const consumedInitialCreateOpen = ref(false);
const newBatch = reactive({
  datasetType: '',
  batchKey: '',
  batchName: '',
  sourceMode: 'uploaded_package' as const,
  sourceUri: '',
  sourceStructure: 'images_with_preannotations' as ImportSourceStructure,
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

const archiveUploadLabel = computed(() => {
  if (!batchArchiveFile.value) {
    return '支持包含 images/、stage1_run_*/、stage2_run_* 的 .zip 批次包';
  }
  return `${batchArchiveFile.value.name} · ${formatBytes(batchArchiveFile.value.size)}`;
});
const uploadProgressVisible = computed(() => uploadPhase.value !== 'idle' || creatingBatch.value);
const uploadProgressPercent = computed(() => Math.min(100, Math.max(0, Math.round(uploadProgressValue.value))));
const uploadProgressStyle = computed(() => ({ width: `${uploadProgressPercent.value}%` }));
const uploadProgressTitle = computed(() => {
  if (uploadPhase.value === 'processing') {
    return '上传完成，正在解压并生成批次';
  }
  return '正在上传批次压缩包';
});
const uploadProgressDetail = computed(() => {
  if (uploadPhase.value === 'processing') {
    return '大压缩包解压和导入可能需要几分钟，请保持页面打开。';
  }
  if (uploadTotalBytes.value) {
    return `${formatBytes(uploadLoadedBytes.value)} / ${formatBytes(uploadTotalBytes.value)}`;
  }
  if (uploadLoadedBytes.value) {
    return `${formatBytes(uploadLoadedBytes.value)} 已上传`;
  }
  return '准备上传';
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

function resetUploadProgress() {
  uploadPhase.value = 'idle';
  uploadLoadedBytes.value = 0;
  uploadTotalBytes.value = 0;
  uploadProgressValue.value = 0;
}

function openBatchForm() {
  showBatchForm.value = true;
  batchMessage.value = '';
  batchMessageIsError.value = false;
  batchArchiveFile.value = null;
  resetUploadProgress();
  newBatch.datasetType = props.group.datasetType;
  newBatch.batchKey = '';
  newBatch.batchName = '';
  newBatch.sourceUri = '';
  newBatch.sourceStructure = 'images_with_preannotations';
  newBatch.description = '';
  resetBatchScan();
}

function closeBatchForm() {
  showBatchForm.value = false;
  batchMessage.value = '';
  batchMessageIsError.value = false;
  batchArchiveFile.value = null;
  resetUploadProgress();
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function inferBatchKeyFromArchive(file: File) {
  return file.name.replace(/\.(zip)$/i, '').replace(/[^A-Za-z0-9_-]+/g, '_');
}

function onArchiveSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  batchArchiveFile.value = null;
  batchMessage.value = '';
  batchMessageIsError.value = false;
  resetUploadProgress();
  if (!file) {
    return;
  }
  if (!file.name.toLowerCase().endsWith('.zip')) {
    batchMessageIsError.value = true;
    batchMessage.value = '请上传 .zip 格式的批次压缩包。';
    input.value = '';
    return;
  }
  batchArchiveFile.value = file;
  const inferredBatchKey = inferBatchKeyFromArchive(file);
  if (!newBatch.batchKey && inferredBatchKey) {
    newBatch.batchKey = inferredBatchKey;
  }
  if (!newBatch.batchName && inferredBatchKey) {
    newBatch.batchName = inferredBatchKey;
  }
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

function updateUploadProgress(progress: ImportArchiveUploadProgress, fallbackTotalBytes: number) {
  const totalBytes = progress.totalBytes ?? fallbackTotalBytes;
  uploadPhase.value = 'uploading';
  uploadLoadedBytes.value = progress.loadedBytes;
  uploadTotalBytes.value = totalBytes;
  uploadProgressValue.value = progress.percent ?? (totalBytes ? (progress.loadedBytes / totalBytes) * 100 : 0);
  if (uploadProgressValue.value >= 100) {
    uploadLoadedBytes.value = totalBytes || progress.loadedBytes;
    uploadProgressValue.value = 100;
    uploadPhase.value = 'processing';
  }
}

async function createBatch() {
  if (!newBatch.datasetType || !newBatch.batchKey || !newBatch.batchName || !batchArchiveFile.value) {
    return;
  }
  const archiveFile = batchArchiveFile.value;
  creatingBatch.value = true;
  batchMessage.value = '';
  batchMessageIsError.value = false;
  uploadPhase.value = 'uploading';
  uploadLoadedBytes.value = 0;
  uploadTotalBytes.value = archiveFile.size;
  uploadProgressValue.value = 0;
  try {
    const created = await apiClient.createImportJobArchive(newBatch.datasetType, {
      datasetType: newBatch.datasetType,
      batchKey: newBatch.batchKey,
      batchName: newBatch.batchName,
      sourceStructure: newBatch.sourceStructure,
      description: newBatch.description || undefined,
      archiveFile,
      archiveFileName: archiveFile.name,
      onUploadProgress: (progress) => updateUploadProgress(progress, archiveFile.size),
    });
    batchMessage.value = `已创建批次 ${created.datasetId}`;
    showBatchForm.value = false;
    emit('reload');
  } catch (err) {
    batchMessageIsError.value = true;
    batchMessage.value = err instanceof Error ? err.message : '创建批次失败';
    resetUploadProgress();
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

.archive-upload-progress {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--blue) 28%, var(--line));
  border-radius: 8px;
  background: color-mix(in srgb, var(--panel) 88%, var(--blue) 12%);
}

.archive-upload-progress__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  color: var(--text);
  font-size: 13px;
  font-weight: 760;
}

.archive-upload-progress__header strong {
  font-variant-numeric: tabular-nums;
}

.archive-upload-progress__track {
  position: relative;
  overflow: hidden;
  block-size: 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--line) 70%, var(--panel));
}

.archive-upload-progress__track span {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--blue), var(--green));
  transition: width 160ms ease;
}

.archive-upload-progress small {
  color: var(--muted);
  font-size: 12px;
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

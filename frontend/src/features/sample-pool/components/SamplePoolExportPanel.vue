<template>
  <section class="panel sample-pool-export" aria-label="导出管理">
    <div class="panel__header">
      <h2 class="panel__title">导出管理</h2>
      <button class="button" type="button" :disabled="jobsLoading" data-testid="training-export-refresh" @click="loadExports">
        <RefreshCw :size="17" />
        刷新任务
      </button>
    </div>

    <div class="sample-pool-export__body">
      <form class="sample-pool-export-create" @submit.prevent="createExport">
        <label>
          <span>导出格式</span>
          <select v-model="selectedFormat" data-testid="training-export-format">
            <option v-for="format in exportFormats" :key="format.value" :value="format.value" :disabled="!format.enabled">
              {{ format.label }}{{ format.enabled ? '' : '（不可用）' }}
            </option>
          </select>
        </label>

        <div class="sample-pool-export-source" role="group" aria-label="导出来源">
          <span>导出来源</span>
          <div class="sample-pool-export-source__buttons">
            <button
              type="button"
              class="sample-pool-export-source__button"
              :class="{ 'sample-pool-export-source__button--active': selectedSource === 'current_filters' }"
              data-testid="training-export-source-current"
              @click="selectedSource = 'current_filters'"
            >
              当前筛选
            </button>
            <button
              type="button"
              class="sample-pool-export-source__button"
              :class="{ 'sample-pool-export-source__button--active': selectedSource === 'all_active_pool_items' }"
              data-testid="training-export-source-all-active"
              @click="selectedSource = 'all_active_pool_items'"
            >
              全部活跃样本
            </button>
          </div>
        </div>

        <div class="sample-pool-export-summary" data-testid="training-export-filter-summary">
          <span>筛选摘要</span>
          <div class="sample-pool-export-summary__chips">
            <span v-for="chip in filterChips" :key="chip">{{ chip }}</span>
          </div>
        </div>

        <div class="sample-pool-export-create__actions">
          <button
            class="button button--primary"
            type="submit"
            :disabled="!canCreate"
            data-testid="training-export-create"
          >
            <Plus :size="17" />
            {{ createPending ? '创建中' : '创建导出' }}
          </button>
          <span v-if="!activeFormat?.enabled" class="sample-pool-export-unavailable">后端未启用该格式</span>
        </div>
      </form>

      <div v-if="createSuccess" class="sample-pool-export-message sample-pool-export-message--success" data-testid="training-export-success">
        {{ createSuccess }}
      </div>
      <div v-if="createError" class="sample-pool-export-message sample-pool-export-message--error" data-testid="training-export-create-error">
        创建失败：{{ createError }}
      </div>
      <div v-if="downloadError" class="sample-pool-export-message sample-pool-export-message--error" data-testid="training-export-download-error">
        下载失败：{{ downloadError }}
      </div>

      <div v-if="jobsLoading && !hasLoadedJobs" class="loading-state" data-testid="training-export-loading">
        正在加载导出任务
      </div>
      <div v-else-if="jobsError" class="error-state" data-testid="training-export-error">
        导出任务暂不可用：{{ jobsError }}
      </div>
      <div v-else-if="jobs.length === 0" class="empty-state" data-testid="training-export-empty">
        暂无导出任务
      </div>
      <div v-else class="sample-pool-export-table-wrap">
        <table class="sample-pool-export-table" data-testid="training-export-table">
          <thead>
            <tr>
              <th>任务 ID</th>
              <th>格式</th>
              <th>来源</th>
              <th>筛选摘要</th>
              <th>样本数</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>完成时间</th>
              <th>错误</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="job in jobs" :key="job.exportId">
              <td>
                <strong class="sample-pool-export-id" :title="job.exportId">{{ job.exportId }}</strong>
              </td>
              <td>{{ formatExportFormat(job.format) }}</td>
              <td>{{ formatExportSource(job.source) }}</td>
              <td>{{ job.filterSummary || formatFilters(job.filters) }}</td>
              <td>{{ formatSampleCount(job.sampleCount) }}</td>
              <td>
                <span class="sample-pool-export-status" :class="`sample-pool-export-status--${statusTone(job.status)}`">
                  {{ formatExportStatus(job.status) }}
                </span>
              </td>
              <td>{{ formatDate(job.createdAt) }}</td>
              <td>{{ formatDate(job.completedAt) }}</td>
              <td>{{ job.error || '无' }}</td>
              <td>
                <div class="sample-pool-export-actions">
                  <button
                    class="button"
                    type="button"
                    :disabled="!isDownloadable(job)"
                    :data-testid="`training-export-download-${job.exportId}`"
                    @click="downloadExport(job)"
                  >
                    <Download :size="16" />
                    {{ isDownloadable(job) ? '下载' : '不可下载' }}
                  </button>
                  <button
                    class="button"
                    type="button"
                    :disabled="!canCancel(job) || cancelPendingExportId === job.exportId"
                    :data-testid="`training-export-cancel-${job.exportId}`"
                    @click="cancelExport(job)"
                  >
                    <XCircle :size="16" />
                    {{ cancelPendingExportId === job.exportId ? '取消中' : '取消' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Download, Plus, RefreshCw, XCircle } from 'lucide-vue-next';
import { apiClient } from '../../../services/urbanViolationApi';
import type {
  SamplePoolListFilters,
  TrainingExportFormat,
  TrainingExportJob,
  TrainingExportSource,
  TrainingExportStatus,
} from '../../../shared/types/contract';

const props = defineProps<{
  filters: SamplePoolListFilters;
  activeFilterCount: number;
}>();

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const exportFormats: Array<{ value: TrainingExportFormat; label: string; enabled: boolean }> = [
  { value: 'coco_json', label: 'COCO JSON', enabled: true },
  { value: 'voc_xml', label: 'VOC XML', enabled: false },
  { value: 'custom_json', label: '自定义 JSON', enabled: false },
];

const selectedFormat = ref<TrainingExportFormat>('coco_json');
const selectedSource = ref<TrainingExportSource>('current_filters');
const jobs = ref<TrainingExportJob[]>([]);
const jobsLoading = ref(false);
const hasLoadedJobs = ref(false);
const jobsError = ref('');
const createPending = ref(false);
const createError = ref('');
const createSuccess = ref('');
const downloadError = ref('');
const cancelPendingExportId = ref('');

const activeFormat = computed(() => exportFormats.find((format) => format.value === selectedFormat.value));
const canCreate = computed(() => Boolean(activeFormat.value?.enabled) && !createPending.value);
const exportFilters = computed<SamplePoolListFilters>(() =>
  selectedSource.value === 'all_active_pool_items' ? { status: 'active' } : { ...props.filters },
);
const filterChips = computed(() => filterSummaryParts(exportFilters.value, selectedSource.value, props.activeFilterCount));

onMounted(() => {
  void loadExports();
});

async function loadExports() {
  jobsLoading.value = true;
  jobsError.value = '';
  try {
    jobs.value = await apiClient.listTrainingExports();
    hasLoadedJobs.value = true;
  } catch (error) {
    jobsError.value = error instanceof Error ? error.message : '加载失败';
    jobs.value = [];
    hasLoadedJobs.value = true;
  } finally {
    jobsLoading.value = false;
  }
}

async function createExport() {
  if (!canCreate.value) return;
  createPending.value = true;
  createError.value = '';
  createSuccess.value = '';
  downloadError.value = '';
  try {
    const created = await apiClient.createTrainingExport({
      format: selectedFormat.value,
      source: selectedSource.value,
      filters: exportFilters.value,
    });
    createSuccess.value = `已创建导出任务 ${created.exportId}`;
    await loadExports();
  } catch (error) {
    createError.value = error instanceof Error ? error.message : '创建失败';
  } finally {
    createPending.value = false;
  }
}

function downloadExport(job: TrainingExportJob) {
  if (!isDownloadable(job)) {
    downloadError.value = '任务尚未完成，暂不可下载';
    return;
  }
  downloadError.value = '';
  const url = job.downloadUrl || apiClient.getTrainingExportDownloadUrl(job.exportId);
  try {
    window.open(url, '_blank', 'noopener');
  } catch (error) {
    downloadError.value = error instanceof Error ? error.message : '下载窗口无法打开';
  }
}

async function cancelExport(job: TrainingExportJob) {
  if (!canCancel(job) || cancelPendingExportId.value) return;
  cancelPendingExportId.value = job.exportId;
  jobsError.value = '';
  try {
    const updated = await apiClient.cancelTrainingExport(job.exportId);
    const index = jobs.value.findIndex((item) => item.exportId === updated.exportId);
    if (index >= 0) {
      jobs.value.splice(index, 1, updated);
    } else {
      jobs.value.unshift(updated);
    }
  } catch (error) {
    jobsError.value = error instanceof Error ? error.message : '取消失败';
  } finally {
    cancelPendingExportId.value = '';
  }
}

function isDownloadable(job: TrainingExportJob) {
  return job.status === 'completed';
}

function canCancel(job: TrainingExportJob) {
  return ['pending', 'queued', 'running', 'in_progress', 'processing'].includes(job.status);
}

function formatSampleCount(value?: number) {
  return value === undefined ? '待计算' : value;
}

function formatDate(value?: string) {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
}

function formatExportFormat(value: TrainingExportFormat) {
  const labels: Record<string, string> = {
    coco_json: 'COCO JSON',
    voc_xml: 'VOC XML',
    custom_json: '自定义 JSON',
  };
  return labels[value] ?? value;
}

function formatExportSource(value: TrainingExportSource) {
  const labels: Record<string, string> = {
    current_filters: '当前筛选',
    all_active_pool_items: '全部活跃样本',
  };
  return labels[value] ?? value;
}

function formatExportStatus(value: TrainingExportStatus) {
  const labels: Record<string, string> = {
    pending: '等待中',
    queued: '排队中',
    running: '生成中',
    processing: '生成中',
    in_progress: '生成中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
    expired: '已过期',
  };
  return labels[value] ?? value;
}

function statusTone(value: TrainingExportStatus) {
  if (value === 'completed') return 'green';
  if (value === 'failed') return 'red';
  if (value === 'cancelled' || value === 'expired') return 'gray';
  return 'blue';
}

function formatFilters(filters: SamplePoolListFilters) {
  return filterSummaryParts(filters, 'current_filters', Object.values(filters).filter(Boolean).length).join('，');
}

function filterSummaryParts(
  filters: SamplePoolListFilters,
  source: TrainingExportSource,
  activeFilterCount: number,
) {
  if (source === 'all_active_pool_items') {
    return ['全部活跃样本'];
  }
  if (activeFilterCount === 0) {
    return ['全部匹配'];
  }
  const parts = [
    filters.datasetType ? `类型：${formatDatasetType(filters.datasetType)}` : '',
    filters.batchId ? `批次：${filters.batchId}` : '',
    filters.category ? `类别：${formatCategory(filters.category)}` : '',
    filters.attribution ? `归因：${formatAttribution(filters.attribution)}` : '',
    filters.eventType ? `事件：${formatEventType(filters.eventType)}` : '',
    filters.reviewer ? `人员：${filters.reviewer}` : '',
    filters.status ? `状态：${formatPoolStatus(filters.status)}` : '',
    filters.search ? `搜索：${filters.search}` : '',
  ].filter(Boolean);
  return parts.length ? parts : ['全部匹配'];
}

function formatDatasetType(value: string) {
  const labels: Record<string, string> = {
    urban_violation: '城市违规',
    ares_detection: 'Ares 检测',
  };
  return labels[value] ?? value;
}

function formatCategory(value: string) {
  const labels: Record<string, string> = {
    'no violation': '无违法',
    nonmotor_vehicle_illegal_parking: '非机动车违停',
    motor_vehicle_illegal_parking: '机动车违停',
    goods_blocking_road: '物品占道',
    road_occupying_vendor: '摊贩占道',
    stage2_failure: 'STEP2 失败',
  };
  return labels[value] ?? value;
}

function formatAttribution(value: string) {
  const labels: Record<string, string> = {
    model_bbox_offset: '模型框偏移',
    category_boundary: '类别边界判断',
    visibility_miss: '可见性漏判',
    relation_mismatch: '关系判断错误',
    evidence_missing: '证据缺失',
  };
  return labels[value] ?? value;
}

function formatEventType(value: string) {
  const labels: Record<string, string> = {
    relation_modify: '关系修正',
    relation_bbox_adjust: '关系框调整',
    candidate_category_change: '候选类别修正',
    candidate_delete: '候选删除',
    candidate_add: '候选新增',
    candidate_evidence_edit: '候选证据修正',
  };
  return labels[value] ?? value;
}

function formatPoolStatus(value: string) {
  const labels: Record<string, string> = {
    active: '活跃',
    pending: '待处理',
    removed: '已移出',
    archived: '已归档',
  };
  return labels[value] ?? value;
}
</script>

<style scoped>
.sample-pool-export__body {
  display: grid;
  gap: 16px;
  padding: 18px;
}

.sample-pool-export-create {
  display: grid;
  grid-template-columns: minmax(180px, 0.7fr) minmax(260px, 1fr) minmax(260px, 1.3fr) auto;
  gap: 14px;
  align-items: end;
}

.sample-pool-export-create label,
.sample-pool-export-source,
.sample-pool-export-summary {
  display: grid;
  gap: 7px;
  color: #344054;
  font-size: 13px;
  font-weight: 800;
}

.sample-pool-export-create select {
  width: 100%;
  min-height: 40px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: #fff;
  color: var(--text);
  padding: 0 11px;
  outline: 0;
}

.sample-pool-export-create select:focus {
  border-color: var(--blue);
  box-shadow: 0 0 0 3px rgba(18, 100, 255, 0.12);
}

.sample-pool-export-source__buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.sample-pool-export-source__button {
  min-height: 40px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: #fff;
  color: #344054;
  font-weight: 850;
}

.sample-pool-export-source__button--active {
  border-color: var(--blue);
  background: var(--blue-soft);
  color: var(--blue);
}

.sample-pool-export-summary__chips {
  display: flex;
  min-height: 40px;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.sample-pool-export-summary__chips span,
.sample-pool-export-status {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  border-radius: 8px;
  padding: 0 9px;
  font-size: 12px;
  font-weight: 850;
  white-space: nowrap;
}

.sample-pool-export-summary__chips span {
  border: 1px solid #c6d8f6;
  background: #f4f8ff;
  color: #0f5bd8;
}

.sample-pool-export-create__actions {
  display: grid;
  gap: 7px;
  justify-items: stretch;
}

.sample-pool-export-unavailable {
  color: var(--red);
  font-size: 12px;
  font-weight: 850;
}

.sample-pool-export-message {
  border-radius: 8px;
  padding: 10px 12px;
  font-weight: 800;
}

.sample-pool-export-message--success {
  border: 1px solid #b7e8c9;
  background: var(--green-soft);
  color: #10733f;
}

.sample-pool-export-message--error {
  border: 1px solid #ffd2d2;
  background: var(--red-soft);
  color: #ad1f26;
}

.sample-pool-export-table-wrap {
  overflow-x: auto;
}

.sample-pool-export-table {
  width: 100%;
  min-width: 1180px;
  border-collapse: collapse;
}

.sample-pool-export-table th,
.sample-pool-export-table td {
  border-bottom: 1px solid var(--line);
  padding: 13px 14px;
  text-align: left;
  vertical-align: middle;
}

.sample-pool-export-table th {
  color: #475467;
  font-size: 13px;
  font-weight: 850;
  white-space: nowrap;
}

.sample-pool-export-table td {
  color: #24324b;
}

.sample-pool-export-id {
  display: inline-block;
  max-width: 170px;
  overflow: hidden;
  color: #101828;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}

.sample-pool-export-status--green {
  background: var(--green-soft);
  color: #10733f;
}

.sample-pool-export-status--blue {
  background: var(--blue-soft);
  color: var(--blue);
}

.sample-pool-export-status--red {
  background: var(--red-soft);
  color: var(--red);
}

.sample-pool-export-status--gray {
  background: #eef2f6;
  color: #475467;
}

.sample-pool-export-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sample-pool-export-actions .button {
  min-height: 34px;
  padding: 0 10px;
  font-size: 13px;
}

.sample-pool-export .button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

@media (max-width: 1180px) {
  .sample-pool-export-create {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .sample-pool-export-create {
    grid-template-columns: 1fr;
  }

  .sample-pool-export-source__buttons {
    grid-template-columns: 1fr;
  }
}
</style>

<template>
  <div>
    <header class="page-header">
      <div>
        <h1 class="page-title">{{ summary?.dataset.name ?? id }} / 数据集概览</h1>
        <p class="page-subtitle">
          批次ID: {{ id }}
          <span v-if="summary">| 类型: {{ summary.dataset.datasetType ?? summary.dataset.name }}</span>
          <span v-if="summary">| 批次键: {{ summary.dataset.batchKey ?? '-' }}</span>
        </p>
      </div>
      <div class="page-actions">
        <RouterLink v-if="lifecycleStatus === 'label_config_required'" class="button" :to="typeConfigTarget">
          <Settings2 :size="17" />
          管理类型配置
        </RouterLink>
        <RouterLink v-if="latestImportJobId" class="button" :to="`/datasets/${id}/import-jobs/${latestImportJobId}`">
          <FileSearch :size="17" />
          导入校验
        </RouterLink>
        <RouterLink class="button" :to="`/datasets/${id}/assets`">
          <Table2 :size="17" />
          查看资产
        </RouterLink>
        <button
          v-if="canGenerateQcQueue"
          class="button button--primary"
          type="button"
          :disabled="generatingQcQueue"
          @click="generateQcQueue"
        >
          <ShieldCheck :size="17" />
          {{ generatingQcQueue ? '生成中...' : '生成质检队列' }}
        </button>
        <RouterLink v-else class="button button--primary" :to="primaryAction.to">
          <ShieldCheck :size="17" />
          {{ primaryAction.label }}
        </RouterLink>
      </div>
    </header>
    <p v-if="actionMessage" class="overview-action-message" :class="{ error: actionMessageIsError }">
      {{ actionMessage }}
    </p>

    <div v-if="loading" class="loading-state">正在加载数据集概览...</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>
    <template v-else-if="summary">
      <section class="panel overview-grid">
        <div class="batch-context">
          <div>
            <span class="context-label">数据集类型</span>
            <strong>{{ summary.dataset.displayName ?? summary.dataset.datasetType ?? summary.dataset.name }}</strong>
            <small>{{ summary.dataset.datasetType ?? summary.dataset.name }}</small>
          </div>
          <div>
            <span class="context-label">批次</span>
            <strong>{{ summary.dataset.batchName ?? summary.dataset.name }}</strong>
            <small>{{ summary.dataset.batchKey ?? id }}</small>
          </div>
          <div>
            <span class="context-label">生命周期</span>
            <StatusChip :value="lifecycleStatus" :label="lifecycleStatusLabel(lifecycleStatus)" />
            <small>{{ lifecycleHint }}</small>
          </div>
          <div>
            <span class="context-label">当前标签配置</span>
            <strong>{{ summary.dataset.activeLabelConfigVersion ?? '未激活' }}</strong>
            <small>继承自数据集类型，批次内不可激活</small>
          </div>
          <div>
            <span class="context-label">最新导入任务</span>
            <strong>{{ summary.latestImportJob?.id ?? summary.dataset.activeImportJobId ?? '未创建' }}</strong>
            <small>{{ importJobStateLabel(summary.latestImportJob?.state) }}</small>
          </div>
        </div>
      </section>

      <DatasetDashboardCards :summary="summary" />

      <QcAnalysisPanel :dataset-id="id" />

      <ModelEvaluationPanel :dataset-id="id" />

      <VersionHistoryPanel :dataset-id="id" />

      <section class="grid grid--two overview-grid">
        <div class="panel">
          <div class="panel__header">
            <h2 class="panel__title">批次生命周期</h2>
            <StatusChip :value="lifecycleStatus" :label="lifecycleStatusLabel(lifecycleStatus)" />
          </div>
          <div class="lifecycle-track">
            <article v-for="step in lifecycleSteps" :key="step.status" :class="{ active: step.status === lifecycleStatus }">
              <span>{{ step.label }}</span>
              <small>{{ lifecycleStatusLabel(step.status) }}</small>
            </article>
          </div>
        </div>

        <div class="panel">
          <div class="panel__header">
            <h2 class="panel__title">资产 / 导入 / 质检统计</h2>
          </div>
          <div class="panel__body stat-list">
            <div>
              <span>有效媒体</span>
              <strong>{{ summary.assetSummary?.media.valid ?? summary.totals.rawAssets }}/{{ summary.assetSummary?.media.total ?? summary.totals.rawAssets }}</strong>
            </div>
            <div>
              <span>STEP2 失败</span>
              <strong>{{ summary.assetSummary?.preannotation.stage2Failed ?? summary.totals.stage2Failures }}</strong>
            </div>
            <div>
              <span>导入告警</span>
              <strong>{{ summary.importWarnings.length }}</strong>
            </div>
            <div>
              <span>QC 已提交</span>
              <strong>{{ summary.assetSummary?.qc.submitted ?? summary.qc.passed + summary.qc.rejected }}</strong>
            </div>
          </div>
        </div>
      </section>

      <section class="grid grid--two overview-grid">
        <div class="panel">
          <div class="panel__header">
            <h2 class="panel__title">预标注运行记录</h2>
          </div>
          <div class="panel__body">
            <table class="runs-table">
              <thead>
                <tr>
                  <th>运行</th>
                  <th>阶段</th>
                  <th>状态</th>
                  <th>输入</th>
                  <th>输出</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="run in summary.recentRuns" :key="run.runId">
                  <td>{{ run.name }}</td>
                  <td>{{ runStageLabel(run.stage) }}</td>
                  <td><StatusChip :value="run.status" :label="runStatusLabel(run.status)" /></td>
                  <td>{{ run.inputCount }}</td>
                  <td>{{ run.outputCount }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel">
          <div class="panel__header">
            <h2 class="panel__title">最新导入任务 / 告警</h2>
            <StatusChip v-if="summary.latestImportJob" :value="summary.latestImportJob.state" />
          </div>
          <div class="panel__body warning-list">
            <article v-for="warning in summary.importWarnings" :key="warning.id">
              <TriangleAlert :size="18" />
              <div>
                <strong>{{ warning.title }}</strong>
                <p>{{ warning.message }}</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section class="grid grid--three overview-grid">
        <DistributionPanel title="违规类别分布" :items="summary.violationCategoryDistribution" />
        <DistributionPanel title="置信度分布" :items="summary.confidenceDistribution" />
        <DistributionPanel title="Sample Category 分布" :items="summary.sampleCategoryDistribution" />
      </section>

      <section class="panel overview-grid">
        <div class="panel__header">
          <h2 class="panel__title">数据集概况</h2>
        </div>
        <dl class="dataset-meta">
          <div>
            <dt>图像来源</dt>
            <dd>{{ summary.metadata.imageSource }}</dd>
          </div>
          <div>
            <dt>地理范围</dt>
            <dd>{{ summary.metadata.region }}</dd>
          </div>
          <div>
            <dt>采集时间范围</dt>
            <dd>{{ summary.metadata.collectionRange }}</dd>
          </div>
          <div>
            <dt>图像分辨率</dt>
            <dd>{{ summary.metadata.imageResolution }}</dd>
          </div>
        </dl>
      </section>
    </template>
    <div v-else class="empty-state">后端暂未返回数据集概览</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { FileSearch, Settings2, ShieldCheck, Table2, TriangleAlert } from 'lucide-vue-next';
import { apiClient } from '../../services/urbanViolationApi';
import StatusChip from '../../shared/components/StatusChip.vue';
import { useAsyncState } from '../../shared/composables/useAsyncState';
import DatasetDashboardCards from './components/DatasetDashboardCards.vue';
import DistributionPanel from './components/DistributionPanel.vue';
import ModelEvaluationPanel from './components/ModelEvaluationPanel.vue';
import QcAnalysisPanel from './components/QcAnalysisPanel.vue';
import VersionHistoryPanel from './components/VersionHistoryPanel.vue';

const props = defineProps<{ id: string }>();
const { data, loading, error, reload } = useAsyncState(() => apiClient.getDatasetBatchSummary(props.id), {
  watch: () => props.id,
  resetOnExecute: true,
});
const summary = computed(() => data.value);
const lifecycleStatus = computed(() => summary.value?.dataset.lifecycleStatus ?? summary.value?.dataset.status ?? 'draft');
const latestImportJobId = computed(() => summary.value?.latestImportJob?.id ?? summary.value?.dataset.activeImportJobId);
const datasetType = computed(() => summary.value?.dataset.datasetType ?? summary.value?.assetSummary?.datasetType ?? props.id);
const typeConfigTarget = computed(() => `/datasets/types/${encodeURIComponent(datasetType.value)}/label-config`);
const generatingQcQueue = ref(false);
const actionMessage = ref('');
const actionMessageIsError = ref(false);
const canGenerateQcQueue = computed(
  () => lifecycleStatus.value === 'preannotation_ready' && !summary.value?.dataset.qcQueueId,
);

const primaryAction = computed(() => {
  const status = lifecycleStatus.value;
  if (status === 'label_config_required') {
    return { label: '管理类型配置', to: typeConfigTarget.value };
  }
  if (status === 'draft' || status === 'registered' || status === 'scanning' || status === 'validation_failed' || status === 'validated' || status === 'import_failed') {
    return {
      label: status === 'validation_failed' ? '查看导入错误' : '继续导入',
      to: latestImportJobId.value ? `/datasets/${props.id}/import-jobs/${latestImportJobId.value}` : `/datasets/${props.id}/overview`,
    };
  }
  if (status === 'imported' || status === 'preannotation_pending' || status === 'preannotation_failed') {
    return { label: '查看资产', to: `/datasets/${props.id}/assets` };
  }
  if (status === 'preannotation_ready' && !summary.value?.dataset.qcQueueId) {
    return { label: '查看资产', to: `/datasets/${props.id}/assets` };
  }
  return { label: '进入质检队列', to: `/datasets/${props.id}/qc` };
});

async function generateQcQueue() {
  if (!canGenerateQcQueue.value || generatingQcQueue.value) {
    return;
  }
  generatingQcQueue.value = true;
  actionMessage.value = '';
  actionMessageIsError.value = false;
  try {
    await apiClient.generateQcQueue(props.id);
    actionMessage.value = '质检队列已生成';
    await reload();
  } catch (err) {
    actionMessageIsError.value = true;
    actionMessage.value = err instanceof Error ? err.message : '生成质检队列失败';
  } finally {
    generatingQcQueue.value = false;
  }
}

const lifecycleHint = computed(() => {
  if (lifecycleStatus.value === 'qc_ready' || lifecycleStatus.value === 'qc_in_progress') {
    return '预标注与类型级标签配置已就绪';
  }
  if (lifecycleStatus.value === 'label_config_required') {
    return '等待激活类型级标签配置';
  }
  return '批次状态由导入、预标注和 QC 进度共同推进';
});

const lifecycleSteps = [
  { status: 'registered', label: '登记' },
  { status: 'validated', label: '校验' },
  { status: 'imported', label: '入库' },
  { status: 'preannotation_ready', label: '预标注' },
  { status: 'qc_ready', label: '质检' },
  { status: 'qc_completed', label: '完成' },
];

function lifecycleStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: '草稿',
    registered: '已登记',
    scanning: '扫描中',
    validation_failed: '校验失败',
    validated: '已校验',
    importing: '导入中',
    import_failed: '导入失败',
    imported: '已入库',
    preannotation_pending: '等待预标注',
    preannotating: '预标注中',
    preannotation_failed: '预标注失败',
    preannotation_ready: '预标注就绪',
    label_config_required: '等待标签配置',
    qc_ready: '质检就绪',
    qc_in_progress: '质检中',
    qc_completed: '质检完成',
    export_ready: '可导出',
    active: '启用',
    archived: '归档',
  };
  return labels[status] ?? status;
}

function importJobStateLabel(status?: string) {
  if (!status) return '-';
  const labels: Record<string, string> = {
    Draft: '草稿',
    Uploading: '上传中',
    Uploaded: '已上传',
    Scanning: '扫描中',
    Validating: '校验中',
    ValidationPassed: '校验通过',
    PreviewReady: '预览就绪',
    Importing: '导入中',
    Imported: '已导入',
    QCQueueGenerated: '质检队列已生成',
    ValidationFailed: '校验失败',
    ImportFailed: '导入失败',
  };
  return labels[status] ?? status;
}

function runStageLabel(stage: string) {
  if (stage === 'stage1') return '阶段一';
  if (stage === 'stage2') return '阶段二';
  return stage;
}

function runStatusLabel(status: string) {
  const labels: Record<string, string> = {
    success: '成功',
    running: '运行中',
    failed: '失败',
  };
  return labels[status] ?? status;
}
</script>

<style scoped>
.overview-grid {
  margin-top: 14px;
}

.overview-action-message {
  margin: -6px 0 12px;
  color: var(--green);
  font-size: 13px;
  font-weight: 720;
}

.overview-action-message.error {
  color: var(--red);
}

.batch-context {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
  padding: 18px;
}

.batch-context > div {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.batch-context strong,
.batch-context small {
  overflow-wrap: anywhere;
}

.context-label {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.batch-context small {
  color: var(--muted);
}

.lifecycle-track {
  display: grid;
  gap: 10px;
  padding: 16px;
}

.lifecycle-track article {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-subtle);
}

.lifecycle-track article.active {
  border-color: var(--blue);
  background: var(--blue-soft);
  color: var(--blue);
}

.lifecycle-track small {
  color: var(--muted);
}

.stat-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.stat-list div {
  display: grid;
  gap: 6px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-subtle);
}

.stat-list span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.stat-list strong {
  font-size: 22px;
}

.runs-table {
  width: 100%;
  border-collapse: collapse;
}

.runs-table th,
.runs-table td {
  padding: 12px;
  border-bottom: 1px solid var(--line);
  text-align: left;
}

.runs-table th {
  color: var(--muted);
  font-size: 12px;
  text-transform: uppercase;
}

.warning-list {
  display: grid;
  gap: 10px;
}

.warning-list article {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 10px;
  padding: 12px;
  border: 1px solid #ffd8a8;
  border-radius: 8px;
  background: #fff9ec;
  color: #b45309;
}

.warning-list p {
  margin: 3px 0 0;
  color: #8a4b00;
}

.dataset-meta {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin: 0;
  padding: 18px;
}

.dataset-meta dt {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.dataset-meta dd {
  margin: 4px 0 0;
  font-weight: 720;
}

@media (max-width: 920px) {
  .batch-context,
  .dataset-meta {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .batch-context,
  .stat-list {
    grid-template-columns: 1fr;
  }
}
</style>

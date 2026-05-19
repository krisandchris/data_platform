<template>
  <div>
    <header class="page-header">
      <div>
        <h1 class="page-title">{{ summary?.dataset.name ?? id }} / 数据集概览</h1>
        <p class="page-subtitle">
          批次ID: {{ id }}
          <span v-if="summary">| 类型: {{ summary.dataset.datasetType ?? summary.dataset.name }}</span>
          <span v-if="summary">| batch_key: {{ summary.dataset.batchKey ?? '-' }}</span>
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

    <div v-if="loading" class="loading-state">Loading dashboard...</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>
    <template v-else-if="summary">
      <section class="panel overview-grid">
        <div class="batch-context">
          <div>
            <span class="context-label">Dataset Type</span>
            <strong>{{ summary.dataset.displayName ?? summary.dataset.datasetType ?? summary.dataset.name }}</strong>
            <small>{{ summary.dataset.datasetType ?? summary.dataset.name }}</small>
          </div>
          <div>
            <span class="context-label">Batch</span>
            <strong>{{ summary.dataset.batchName ?? summary.dataset.name }}</strong>
            <small>{{ summary.dataset.batchKey ?? id }}</small>
          </div>
          <div>
            <span class="context-label">Lifecycle</span>
            <StatusChip :value="lifecycleStatus" />
            <small>{{ lifecycleHint }}</small>
          </div>
          <div>
            <span class="context-label">Active label config</span>
            <strong>{{ summary.dataset.activeLabelConfigVersion ?? '未激活' }}</strong>
            <small>继承自数据集类型，批次内不可激活</small>
          </div>
          <div>
            <span class="context-label">Latest import job</span>
            <strong>{{ summary.latestImportJob?.id ?? summary.dataset.activeImportJobId ?? '未创建' }}</strong>
            <small>{{ summary.latestImportJob?.state ?? '-' }}</small>
          </div>
        </div>
      </section>

      <DatasetDashboardCards :summary="summary" />

      <section class="grid grid--two overview-grid">
        <div class="panel">
          <div class="panel__header">
            <h2 class="panel__title">批次生命周期</h2>
            <StatusChip :value="lifecycleStatus" />
          </div>
          <div class="lifecycle-track">
            <article v-for="step in lifecycleSteps" :key="step.status" :class="{ active: step.status === lifecycleStatus }">
              <span>{{ step.label }}</span>
              <small>{{ step.status }}</small>
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
              <span>STEP2 failure</span>
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
                  <th>run</th>
                  <th>stage</th>
                  <th>status</th>
                  <th>input</th>
                  <th>output</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="run in summary.recentRuns" :key="run.runId">
                  <td>{{ run.name }}</td>
                  <td>{{ run.stage }}</td>
                  <td><StatusChip :value="run.status" /></td>
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
    <div v-else class="empty-state">No dataset overview returned by the backend.</div>
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

const props = defineProps<{ id: string }>();
const { data, loading, error, reload } = useAsyncState(() => apiClient.getDatasetBatchSummary(props.id), {
  watch: () => props.id,
  resetOnExecute: true,
});
const summary = computed(() => data.value);
const lifecycleStatus = computed(() => summary.value?.dataset.lifecycleStatus ?? summary.value?.dataset.status ?? 'draft');
const latestImportJobId = computed(() => summary.value?.latestImportJob?.id ?? summary.value?.dataset.activeImportJobId);
const datasetType = computed(() => summary.value?.dataset.datasetType ?? summary.value?.assetSummary?.datasetType ?? props.id);
const typeConfigTarget = computed(() => `/datasets#label-config-${encodeURIComponent(datasetType.value)}`);
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

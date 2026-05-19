<template>
  <div>
    <header class="page-header">
      <div>
        <h1 class="page-title">批次创建 / 导入校验</h1>
        <p class="page-subtitle">
          批次 {{ id }} 的导入任务 {{ jobId }}，用于扫描、校验、预览并确认写入当前批次。
        </p>
      </div>
      <div class="page-actions">
        <button class="button" type="button" :disabled="actionLoading" @click="runAction('scan')">
          <ScanSearch :size="17" />
          重新扫描
        </button>
        <button class="button" type="button" :disabled="actionLoading" @click="runAction('validate')">
          <FileCheck2 :size="17" />
          校验任务
        </button>
        <button v-if="job?.state === 'ImportFailed' || job?.state === 'ValidationFailed'" class="button" type="button" :disabled="actionLoading" @click="runAction('retry')">
          <RotateCcw :size="17" />
          重试导入
        </button>
        <button class="button button--primary" type="button" :disabled="actionLoading || hasBlockingIssues" @click="runAction('confirm')">
          <CheckCircle2 :size="17" />
          确认入库
        </button>
      </div>
    </header>

    <div v-if="loading" class="loading-state">Loading import job...</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>
    <template v-else-if="job">
      <ImportStepper :active-step="job.activeStep" />
      <p v-if="actionMessage" class="action-message">{{ actionMessage }}</p>

      <section class="grid grid--metrics import-metrics">
        <MetricCard label="Raw Images" :value="job.totals.rawAssets" detail="total" tone="blue">
          <template #icon><Image :size="23" /></template>
        </MetricCard>
        <MetricCard label="STEP1 Parsed" :value="job.totals.stage1Parsed" detail="parsed records" tone="blue">
          <template #icon><FileCheck2 :size="23" /></template>
        </MetricCard>
        <MetricCard label="STEP2 Parsed" :value="job.totals.stage2Parsed" detail="parsed records" tone="green">
          <template #icon><FileCog :size="23" /></template>
        </MetricCard>
        <MetricCard label="STEP2 Failures" :value="job.totals.stage2Failures" detail="preserved failures" tone="red">
          <template #icon><TriangleAlert :size="23" /></template>
        </MetricCard>
      </section>

      <section class="grid grid--two import-grid">
        <div class="panel">
          <div class="panel__header">
            <h2 class="panel__title">扫描校验 / 导入预览</h2>
            <StatusChip :value="job.state" />
          </div>
          <div class="import-table-wrap">
            <table class="import-table">
              <thead>
                <tr>
                  <th>sample_id</th>
                  <th>image</th>
                  <th>stage1</th>
                  <th>stage2</th>
                  <th>failure</th>
                  <th>status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in job.validationRows" :key="row.sampleId">
                  <td>{{ row.sampleId }}</td>
                  <td>{{ row.imagePath }}</td>
                  <td>{{ row.stage1Path ?? '-' }}</td>
                  <td>{{ row.stage2Path ?? '-' }}</td>
                  <td>{{ row.failurePath ?? '-' }}</td>
                  <td><StatusChip :value="row.status" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <aside class="panel">
          <div class="panel__header">
            <h2 class="panel__title">阻塞错误 / 非阻塞告警</h2>
          </div>
          <div class="panel__body validation-list">
            <article v-for="warning in blockingIssues" :key="warning.id" class="blocking">
              <TriangleAlert :size="18" />
              <div>
                <strong>{{ warning.title }}</strong>
                <p>{{ warning.message }}</p>
              </div>
            </article>
            <article v-for="warning in nonBlockingWarnings" :key="warning.id">
              <TriangleAlert :size="18" />
              <div>
                <strong>{{ warning.title }}</strong>
                <p>{{ warning.message }}</p>
              </div>
            </article>
            <div v-if="blockingIssues.length === 0 && nonBlockingWarnings.length === 0" class="empty-inline">
              当前校验没有返回阻塞错误或告警。
            </div>
          </div>
        </aside>
      </section>

      <section class="panel import-grid">
        <div class="panel__header">
          <h2 class="panel__title">导入映射关系</h2>
        </div>
        <div class="mapping-flow">
          <article v-for="step in job.mappingSteps" :key="step.id">
            <FolderTree :size="22" />
            <strong>{{ step.label }}</strong>
            <span>{{ step.count }} files</span>
            <small>{{ step.entity }}</small>
          </article>
        </div>
      </section>

      <section class="panel import-grid">
        <div class="panel__header">
          <h2 class="panel__title">完成后下一步</h2>
        </div>
        <div class="next-actions">
          <RouterLink class="button" :to="`/datasets/${id}/overview`">返回批次概览</RouterLink>
          <RouterLink class="button" :to="`/datasets/${id}/assets`">查看当前批次资产</RouterLink>
          <RouterLink class="button button--primary" :to="`/datasets/${id}/qc`">进入质检队列</RouterLink>
        </div>
      </section>
    </template>
    <div v-else class="empty-state">No import job returned by the backend.</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { CheckCircle2, FileCheck2, FileCog, FolderTree, Image, RotateCcw, ScanSearch, TriangleAlert } from 'lucide-vue-next';
import { apiClient } from '../../services/urbanViolationApi';
import MetricCard from '../../shared/components/MetricCard.vue';
import StatusChip from '../../shared/components/StatusChip.vue';
import { useAsyncState } from '../../shared/composables/useAsyncState';
import type { ImportJobDetail } from '../../shared/types/contract';
import ImportStepper from './components/ImportStepper.vue';

const props = defineProps<{
  id: string;
  jobId: string;
}>();

const { data: job, loading, error } = useAsyncState(
  () => apiClient.getDatasetBatchImportJob(props.id, props.jobId),
  {
    watch: [() => props.id, () => props.jobId],
    resetOnExecute: true,
  },
);
const actionLoading = ref(false);
const actionMessage = ref('');
const blockingIssues = computed(() => job.value?.validationReport?.blockingErrors ?? job.value?.warnings.filter((warning) => warning.severity === 'blocking') ?? []);
const nonBlockingWarnings = computed(() => job.value?.validationReport?.warnings ?? job.value?.warnings.filter((warning) => warning.severity !== 'blocking') ?? []);
const hasBlockingIssues = computed(() => blockingIssues.value.length > 0);

const runAction = async (action: 'scan' | 'validate' | 'confirm' | 'retry') => {
  actionLoading.value = true;
  actionMessage.value = '';
  try {
    const actions: Record<typeof action, () => Promise<ImportJobDetail>> = {
      scan: () => apiClient.scanImportJob(props.id, props.jobId),
      validate: () => apiClient.validateImportJob(props.id, props.jobId),
      confirm: () => apiClient.confirmImportJob(props.id, props.jobId),
      retry: () => apiClient.retryImportJob(props.id, props.jobId),
    };
    job.value = await actions[action]();
    actionMessage.value = '任务状态已更新。';
  } catch (err) {
    actionMessage.value = err instanceof Error ? err.message : '导入任务操作失败';
  } finally {
    actionLoading.value = false;
  }
};
</script>

<style scoped>
.import-metrics,
.import-grid {
  margin-top: 18px;
}

.import-table-wrap {
  overflow-x: auto;
}

.import-table {
  min-width: 980px;
  width: 100%;
  border-collapse: collapse;
}

.import-table th,
.import-table td {
  max-width: 240px;
  padding: 12px;
  border-bottom: 1px solid var(--line);
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.import-table th {
  background: var(--panel-subtle);
  color: var(--muted);
  font-size: 12px;
  text-transform: uppercase;
}

.validation-list {
  display: grid;
  gap: 10px;
}

.validation-list article {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 10px;
  padding: 12px;
  border: 1px solid #ffd8a8;
  border-radius: 8px;
  background: #fff9ec;
  color: #b45309;
}

.validation-list article.blocking {
  border-color: #ffb4b4;
  background: #fff3f3;
  color: var(--red);
}

.validation-list p {
  margin: 4px 0 0;
  color: #8a4b00;
}

.empty-inline {
  padding: 12px;
  border: 1px dashed var(--line-strong);
  border-radius: 8px;
  color: var(--muted);
}

.mapping-flow {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  padding: 18px;
}

.mapping-flow article {
  display: grid;
  gap: 8px;
  min-height: 124px;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-subtle);
}

.mapping-flow svg {
  color: var(--blue);
}

.mapping-flow span,
.mapping-flow small {
  color: var(--muted);
}

.action-message {
  margin: 10px 0 0;
  color: var(--muted);
  font-weight: 700;
}

.next-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 16px;
}

@media (max-width: 1050px) {
  .mapping-flow {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

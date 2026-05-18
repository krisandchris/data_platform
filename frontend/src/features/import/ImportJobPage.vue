<template>
  <div>
    <header class="page-header">
      <div>
        <h1 class="page-title">导入任务 / 目录扫描与校验</h1>
        <p class="page-subtitle">Import job {{ jobId }} validates manifest pairing, missing files, bbox readiness, and stage2 failure split.</p>
      </div>
      <div class="page-actions">
        <button class="button" type="button">
          <Download :size="17" />
          导出校验报告
        </button>
        <button class="button button--primary" type="button">
          <CheckCircle2 :size="17" />
          确认导入
        </button>
      </div>
    </header>

    <div v-if="loading" class="loading-state">Loading import job...</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>
    <template v-else-if="job">
      <ImportStepper :active-step="job.activeStep" />

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
            <h2 class="panel__title">样本对齐结果</h2>
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
            <h2 class="panel__title">校验结果</h2>
          </div>
          <div class="panel__body validation-list">
            <article v-for="warning in job.warnings" :key="warning.id">
              <TriangleAlert :size="18" />
              <div>
                <strong>{{ warning.title }}</strong>
                <p>{{ warning.message }}</p>
              </div>
            </article>
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
    </template>
    <div v-else class="empty-state">No import job returned by the backend.</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { CheckCircle2, Download, FileCheck2, FileCog, FolderTree, Image, TriangleAlert } from 'lucide-vue-next';
import { apiClient } from '../../services/urbanViolationApi';
import MetricCard from '../../shared/components/MetricCard.vue';
import StatusChip from '../../shared/components/StatusChip.vue';
import { useAsyncState } from '../../shared/composables/useAsyncState';
import ImportStepper from './components/ImportStepper.vue';

const props = defineProps<{
  id: string;
  jobId: string;
}>();

const { data, loading, error } = useAsyncState(() => apiClient.getImportJob(props.id, props.jobId));
const job = computed(() => data.value);
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
  min-width: 920px;
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

.validation-list p {
  margin: 4px 0 0;
  color: #8a4b00;
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

@media (max-width: 1050px) {
  .mapping-flow {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

<template>
  <div>
    <header class="page-header">
      <div>
        <h1 class="page-title">{{ summary?.dataset.name ?? id }} / 数据集概览</h1>
        <p class="page-subtitle">
          数据集ID: {{ id }} <span v-if="summary">| 数据版本: {{ summary.dataset.version }}</span>
        </p>
      </div>
      <div class="page-actions">
        <RouterLink class="button" :to="`/datasets/${id}/assets`">
          <Table2 :size="17" />
          查看资产
        </RouterLink>
        <RouterLink class="button button--primary" :to="`/datasets/${id}/qc`">
          <ShieldCheck :size="17" />
          创建质检任务
        </RouterLink>
      </div>
    </header>

    <div v-if="loading" class="loading-state">Loading dashboard...</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>
    <template v-else-if="summary">
      <DatasetDashboardCards :summary="summary" />

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
            <h2 class="panel__title">导入告警</h2>
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

      <LabelConfigUploadPanel :dataset-id="id" @saved="onLabelConfigSaved" />
    </template>
    <div v-else class="empty-state">No dataset overview returned by the backend.</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { ShieldCheck, Table2, TriangleAlert } from 'lucide-vue-next';
import { apiClient } from '../../services/urbanViolationApi';
import StatusChip from '../../shared/components/StatusChip.vue';
import { useAsyncState } from '../../shared/composables/useAsyncState';
import DatasetDashboardCards from './components/DatasetDashboardCards.vue';
import DistributionPanel from './components/DistributionPanel.vue';
import LabelConfigUploadPanel from './components/LabelConfigUploadPanel.vue';
import type { LabelConfigSaveResult } from '../../shared/types/contract';

const props = defineProps<{ id: string }>();
const { data, loading, error } = useAsyncState(() => apiClient.getDatasetSummary(props.id));
const summary = computed(() => data.value);

const onLabelConfigSaved = (_result: LabelConfigSaveResult) => {
  // The upload panel refreshes its own active-config display; overview metrics are unchanged.
};
</script>

<style scoped>
.overview-grid {
  margin-top: 14px;
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
  .dataset-meta {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

<template>
  <div>
    <header class="page-header">
      <div>
        <h1 class="page-title">数据集</h1>
        <p class="page-subtitle">按数据集类型管理字段规则，按批次管理资产、导入、预标注和质检队列。</p>
      </div>
      <div class="page-actions">
        <RouterLink class="button button--primary" :to="newBatchTarget">
          <Plus :size="17" />
          新建批次
        </RouterLink>
      </div>
    </header>

    <div v-if="loading" class="loading-state">Loading datasets...</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>
    <div v-else-if="!data?.length" class="empty-state">No datasets returned by the backend.</div>
    <div v-else class="dataset-type-list">
      <section v-for="group in datasetGroups" :key="group.datasetType" class="dataset-type-panel panel">
        <div class="dataset-type-panel__header">
          <div>
            <span class="dataset-card__eyebrow">Dataset Type</span>
            <h2>{{ group.displayName }}</h2>
            <p>{{ group.datasetType }} · {{ group.batchCount }} 个批次</p>
          </div>
          <dl>
            <div>
              <dt>active label config</dt>
              <dd>{{ group.activeLabelConfigVersion ?? '未激活' }}</dd>
            </div>
            <div>
              <dt>field schema</dt>
              <dd>{{ group.fieldSchemaVersion ?? '未声明' }}</dd>
            </div>
          </dl>
        </div>

        <div class="batch-list">
          <article v-for="batch in group.batches" :key="batch.id" class="batch-row">
            <div class="batch-row__identity">
              <strong>{{ batch.batchName ?? batch.name }}</strong>
              <span>{{ batch.id }} · batch_key: {{ batch.batchKey ?? '-' }}</span>
            </div>
            <div class="batch-row__status">
              <StatusChip :value="batch.lifecycleStatus ?? batch.status" />
              <small>latest import: {{ batch.latestImportJob?.state ?? batch.activeImportJobId ?? '未创建' }}</small>
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
                <dt>QC</dt>
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
              <RouterLink class="button button--primary" :to="`/datasets/${batch.id}/qc`">
                <ShieldCheck :size="16" />
                进入质检队列
              </RouterLink>
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { FileSearch, LayoutDashboard, Plus, ShieldCheck, Table2 } from 'lucide-vue-next';
import { apiClient } from '../../services/urbanViolationApi';
import StatusChip from '../../shared/components/StatusChip.vue';
import { useAsyncState } from '../../shared/composables/useAsyncState';
import type { Dataset, DatasetType } from '../../shared/types/contract';

const { data, loading, error } = useAsyncState(() => apiClient.listDatasets());

const datasetGroups = computed<DatasetType[]>(() => {
  const groups = new Map<string, DatasetType>();
  (data.value ?? []).forEach((dataset) => {
    const datasetType = dataset.datasetType ?? dataset.name ?? dataset.id;
    const group = groups.get(datasetType) ?? {
      datasetType,
      displayName: dataset.displayName ?? dataset.name ?? datasetType,
      fieldSchemaVersion: dataset.fieldSchemaVersion,
      activeLabelConfigVersion: dataset.activeLabelConfigVersion,
      status: 'active',
      batchCount: 0,
      batches: [],
    };
    group.batches.push(dataset);
    group.batchCount = group.batches.length;
    group.fieldSchemaVersion = group.fieldSchemaVersion ?? dataset.fieldSchemaVersion;
    group.activeLabelConfigVersion = group.activeLabelConfigVersion ?? dataset.activeLabelConfigVersion;
    groups.set(datasetType, group);
  });
  return [...groups.values()];
});

const firstBatch = computed(() => data.value?.[0]);
const newBatchTarget = computed(() => {
  const batch = firstBatch.value;
  if (!batch) {
    return '/datasets';
  }
  const jobId = batch.activeImportJobId ?? batch.latestImportJob?.id;
  return jobId ? `/datasets/${batch.id}/import-jobs/${jobId}` : `/datasets/${batch.id}/overview`;
});

const preannotationText = (batch: Dataset) => {
  const stage1 = batch.stage1Total ?? 0;
  const stage2 = batch.stage2SuccessTotal ?? 0;
  const failures = batch.stage2FailureTotal ?? 0;
  return stage1 || stage2 || failures ? `S1 ${stage1} / S2 ${stage2} / fail ${failures}` : '-';
};

const qcProgressText = (batch: Dataset) => {
  if (!batch.qcProgress) {
    return '-';
  }
  const total = batch.qcProgress.total ?? batch.qcProgress.pending + batch.qcProgress.submitted;
  return `${batch.qcProgress.submitted}/${total}`;
};
</script>

<style scoped>
.dataset-type-list {
  display: grid;
  gap: 16px;
}

.dataset-type-panel {
  overflow: hidden;
}

.dataset-type-panel__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.5fr);
  gap: 20px;
  padding: 20px;
  border-bottom: 1px solid var(--line);
}

.dataset-type-panel__header h2 {
  margin: 4px 0 4px;
  font-size: 26px;
}

.dataset-card__eyebrow {
  color: var(--blue);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.dataset-type-panel__header p {
  margin: 0;
  color: var(--muted);
}

.dataset-type-panel__header dl,
.batch-row__metrics {
  display: grid;
  gap: 10px;
  margin: 0;
}

.dataset-type-panel__header dt,
.batch-row__metrics dt {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.dataset-type-panel__header dd,
.batch-row__metrics dd {
  margin: 2px 0 0;
  overflow-wrap: anywhere;
  font-weight: 720;
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
.batch-row__status small {
  color: var(--muted);
  overflow-wrap: anywhere;
}

.batch-row__metrics {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.batch-row__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 780px) {
  .dataset-type-panel__header,
  .batch-row {
    grid-template-columns: 1fr;
  }

  .batch-row__actions {
    justify-content: flex-start;
  }
}
</style>

<template>
  <div>
    <header class="page-header">
      <div>
        <h1 class="page-title">数据集</h1>
        <p class="page-subtitle">Urban violation datasets prepared for import, pre-annotation, and QC review.</p>
      </div>
      <div class="page-actions">
        <RouterLink class="button button--primary" to="/datasets/urban_violation/import-jobs/fixture-import-urban-violation">
          <Upload :size="17" />
          导入数据
        </RouterLink>
      </div>
    </header>

    <div v-if="loading" class="loading-state">Loading datasets...</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>
    <div v-else-if="!data?.length" class="empty-state">No datasets returned by the backend.</div>
    <div v-else class="dataset-list">
      <RouterLink
        v-for="dataset in data"
        :key="dataset.id"
        class="dataset-card"
        :to="`/datasets/${dataset.id}/overview`"
      >
        <div>
          <span class="dataset-card__eyebrow">Dataset</span>
          <h2>{{ dataset.name }} / 数据集概览</h2>
          <p>{{ dataset.description }}</p>
        </div>
        <dl>
          <div>
            <dt>ID</dt>
            <dd>{{ dataset.id }}</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>{{ dataset.version }}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd><StatusChip :value="dataset.status" /></dd>
          </div>
        </dl>
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { Upload } from 'lucide-vue-next';
import { apiClient } from '../../services/urbanViolationApi';
import StatusChip from '../../shared/components/StatusChip.vue';
import { useAsyncState } from '../../shared/composables/useAsyncState';

const { data, loading, error } = useAsyncState(() => apiClient.listDatasets());
</script>

<style scoped>
.dataset-list {
  display: grid;
  gap: 16px;
}

.dataset-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.6fr);
  gap: 28px;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  box-shadow: var(--shadow-sm);
}

.dataset-card:hover {
  border-color: var(--blue);
  box-shadow: var(--shadow-md);
}

.dataset-card__eyebrow {
  color: var(--blue);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.dataset-card h2 {
  margin: 4px 0 8px;
  font-size: 28px;
}

.dataset-card p {
  margin: 0;
  color: var(--muted);
}

.dataset-card dl {
  display: grid;
  gap: 10px;
  margin: 0;
}

.dataset-card div {
  min-width: 0;
}

.dataset-card dt {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.dataset-card dd {
  margin: 2px 0 0;
  overflow-wrap: anywhere;
  font-weight: 720;
}

@media (max-width: 780px) {
  .dataset-card {
    grid-template-columns: 1fr;
  }
}
</style>

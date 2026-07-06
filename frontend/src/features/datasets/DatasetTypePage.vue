<template>
  <div>
    <header class="page-header">
      <div>
        <h1 class="page-title">{{ group?.displayName ?? datasetType }} / 数据校验</h1>
      </div>
    </header>

    <div v-if="loading" class="loading-state">正在加载数据集类型...</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>
    <template v-else-if="group">
      <section class="panel type-summary-panel">
        <div>
          <span>类型标识</span>
          <strong>{{ group.datasetType }}</strong>
        </div>
        <div>
          <span>批次数</span>
          <strong>{{ group.batchCount }}</strong>
        </div>
        <div>
          <span>字段设计版本</span>
          <strong>{{ group.fieldSchemaVersion ?? '未声明' }}</strong>
        </div>
        <div>
          <span>激活标签配置</span>
          <strong>{{ group.activeLabelConfigVersion ?? '未激活' }}</strong>
        </div>
      </section>

      <DatasetTypeBatchPanel
        class="type-page-section"
        :group="group"
        :initial-create-open="shouldOpenCreateBatch"
        @reload="reload"
      />
    </template>
    <div v-else class="empty-state">未找到数据集类型</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { apiClient } from '../../services/urbanViolationApi';
import { useAsyncState } from '../../shared/composables/useAsyncState';
import DatasetTypeBatchPanel from './components/DatasetTypeBatchPanel.vue';

const props = defineProps<{
  datasetType: string;
}>();

const route = useRoute();
const { data, loading, error, reload } = useAsyncState(() => apiClient.getDatasetType(props.datasetType), {
  watch: () => props.datasetType,
  resetOnExecute: true,
});

const group = computed(() => data.value);
const shouldOpenCreateBatch = computed(() => route?.query?.create === 'batch');
</script>

<style scoped>
.type-summary-panel {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding: 18px;
}

.type-summary-panel > div {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-subtle);
}

.type-summary-panel span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 760;
}

.type-summary-panel strong {
  overflow-wrap: anywhere;
  font-size: 20px;
}

.type-page-section {
  margin-top: 14px;
}

@media (max-width: 880px) {
  .type-summary-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 620px) {
  .type-summary-panel {
    grid-template-columns: 1fr;
  }
}
</style>

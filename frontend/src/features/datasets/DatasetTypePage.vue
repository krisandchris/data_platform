<template>
  <div>
    <header class="page-header">
      <div>
        <h1 class="page-title">{{ group?.displayName ?? datasetType }} / 类型管理</h1>
      </div>
      <div class="page-actions">
        <RouterLink class="button" to="/datasets">
          <ArrowLeft :size="17" />
          返回数据集中心
        </RouterLink>
        <RouterLink v-if="isLabelConfigSection" class="button" :to="typeRoute">
          <LayoutDashboard :size="17" />
          类型管理
        </RouterLink>
        <RouterLink v-else class="button button--primary" :to="labelConfigRoute">
          <Settings2 :size="17" />
          标签配置
        </RouterLink>
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

      <LabelConfigUploadPanel
        v-if="isLabelConfigSection"
        :dataset-id="group.datasetType"
        :scope-name="group.displayName"
        @saved="reload"
      />
      <section v-else class="panel label-config-entry-panel">
        <div>
          <h2 class="panel__title">标签配置管理</h2>
          <strong>{{ group.activeLabelConfigVersion ?? '未激活' }}</strong>
        </div>
        <RouterLink class="button button--primary" :to="labelConfigRoute">
          <Settings2 :size="16" />
          打开标签配置
        </RouterLink>
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
import { RouterLink, useRoute } from 'vue-router';
import { ArrowLeft, LayoutDashboard, Settings2 } from 'lucide-vue-next';
import { apiClient } from '../../services/urbanViolationApi';
import { useAsyncState } from '../../shared/composables/useAsyncState';
import DatasetTypeBatchPanel from './components/DatasetTypeBatchPanel.vue';
import LabelConfigUploadPanel from './components/LabelConfigUploadPanel.vue';

const props = defineProps<{
  datasetType: string;
  section?: 'overview' | 'label-config';
}>();

const route = useRoute();
const { data, loading, error, reload } = useAsyncState(() => apiClient.getDatasetType(props.datasetType), {
  watch: () => props.datasetType,
  resetOnExecute: true,
});

const group = computed(() => data.value);
const isLabelConfigSection = computed(() => props.section === 'label-config');
const typeRoute = computed(() => `/datasets/types/${encodeURIComponent(props.datasetType)}`);
const labelConfigRoute = computed(() => `${typeRoute.value}/label-config`);
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

.label-config-entry-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: 14px;
  padding: 18px;
}

.label-config-entry-panel > div {
  display: grid;
  gap: 6px;
}

.label-config-entry-panel strong {
  color: var(--muted);
  overflow-wrap: anywhere;
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

  .label-config-entry-panel {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>

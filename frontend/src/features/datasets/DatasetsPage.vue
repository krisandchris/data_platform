<template>
  <div>
    <header class="page-header">
      <div>
        <h1 class="page-title">数据集中心</h1>
      </div>
      <div class="page-actions">
        <button class="button button--primary" type="button" @click="showTypeForm = !showTypeForm">
          <Plus :size="17" />
          新增数据集类型
        </button>
      </div>
    </header>

    <form v-if="showTypeForm" class="panel dataset-type-form" @submit.prevent="createType">
      <label>
        <span>类型标识</span>
        <input v-model.trim="newType.datasetType" placeholder="ares_detection" pattern="^[a-z][a-z0-9_]*$" required />
      </label>
      <label>
        <span>显示名称</span>
        <input v-model.trim="newType.displayName" placeholder="Ares Detection" required />
      </label>
      <label>
        <span>字段设计版本</span>
        <input v-model.trim="newType.fieldSchemaVersion" placeholder="draft" />
      </label>
      <button class="button button--primary" type="submit" :disabled="creatingType">
        <Plus :size="16" />
        创建类型
      </button>
      <p v-if="typeMessage" class="type-message" :class="{ error: typeMessageIsError }">{{ typeMessage }}</p>
    </form>

    <div v-if="loading" class="loading-state">正在加载数据集类型...</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>
    <div v-else-if="!datasetGroups.length" class="empty-state">后端暂未返回数据集类型</div>
    <div v-else class="dataset-type-grid">
      <article v-for="group in datasetGroups" :key="group.datasetType" class="panel dataset-type-card">
        <div class="dataset-type-card__header">
          <div>
            <span class="dataset-type-card__eyebrow">数据集类型</span>
            <h2>{{ group.displayName }}</h2>
          </div>
          <StatusChip :value="group.status ?? 'active'" :label="typeStatusLabel(group.status)" />
        </div>

        <dl class="dataset-type-card__metrics">
          <div>
            <dt>类型标识</dt>
            <dd>{{ group.datasetType }}</dd>
          </div>
          <div>
            <dt>批次数</dt>
            <dd>{{ batchCount(group) }}</dd>
          </div>
          <div>
            <dt>字段设计版本</dt>
            <dd>{{ group.fieldSchemaVersion ?? '未声明' }}</dd>
          </div>
          <div>
            <dt>激活标签配置</dt>
            <dd>{{ group.activeLabelConfigVersion ?? '未激活' }}</dd>
          </div>
        </dl>

        <div class="dataset-type-card__actions">
          <RouterLink class="button button--primary" :to="typeRoute(group.datasetType)">
            <LayoutDashboard :size="16" />
            进入类型管理
          </RouterLink>
          <RouterLink class="button" :to="labelConfigRoute(group.datasetType)">
            <Settings2 :size="16" />
            标签配置
          </RouterLink>
          <RouterLink class="button" :to="{ path: typeRoute(group.datasetType), query: { create: 'batch' } }">
            <FolderPlus :size="16" />
            新建批次
          </RouterLink>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { FolderPlus, LayoutDashboard, Plus, Settings2 } from 'lucide-vue-next';
import { apiClient } from '../../services/urbanViolationApi';
import StatusChip from '../../shared/components/StatusChip.vue';
import { useAsyncState } from '../../shared/composables/useAsyncState';
import type { DatasetType, DatasetTypeCreatePayload } from '../../shared/types/contract';

const { data, loading, error, reload } = useAsyncState(() => apiClient.listDatasetTypes());
const showTypeForm = ref(false);
const creatingType = ref(false);
const typeMessage = ref('');
const typeMessageIsError = ref(false);
const newType = reactive<DatasetTypeCreatePayload>({
  datasetType: '',
  displayName: '',
  fieldSchemaVersion: 'draft',
});

const datasetGroups = computed(() => data.value ?? []);

async function createType() {
  if (!newType.datasetType || !newType.displayName) {
    return;
  }
  creatingType.value = true;
  typeMessage.value = '';
  typeMessageIsError.value = false;
  try {
    await apiClient.createDatasetType({
      datasetType: newType.datasetType,
      displayName: newType.displayName,
      fieldSchemaVersion: newType.fieldSchemaVersion || 'draft',
    });
    typeMessage.value = `已创建数据集类型 ${newType.datasetType}`;
    newType.datasetType = '';
    newType.displayName = '';
    newType.fieldSchemaVersion = 'draft';
    await reload();
  } catch (err) {
    typeMessageIsError.value = true;
    typeMessage.value = err instanceof Error ? err.message : '创建数据集类型失败';
  } finally {
    creatingType.value = false;
  }
}

const batchCount = (group: DatasetType) => group.batchCount ?? group.batches.length;
const typeRoute = (datasetType: string) => `/datasets/types/${encodeURIComponent(datasetType)}`;
const labelConfigRoute = (datasetType: string) => `${typeRoute(datasetType)}/label-config`;

const typeStatusLabel = (status?: string) => {
  const labels: Record<string, string> = {
    active: '启用中',
    archived: '已归档',
    draft: '草稿',
  };
  return labels[status ?? 'active'] ?? status ?? '启用中';
};
</script>

<style scoped>
.dataset-type-form {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr) minmax(140px, 0.8fr) auto;
  gap: 12px;
  align-items: end;
  margin-bottom: 16px;
  padding: 16px;
}

.dataset-type-form label {
  display: grid;
  gap: 6px;
}

.dataset-type-form span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 760;
}

.dataset-type-form input {
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  color: var(--text);
}

.type-message {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--green);
  font-size: 13px;
  font-weight: 720;
}

.type-message.error {
  color: var(--red);
}

.dataset-type-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.dataset-type-card {
  display: grid;
  gap: 18px;
  padding: 18px;
}

.dataset-type-card__header {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
}

.dataset-type-card__header h2 {
  margin: 4px 0 0;
  font-size: 26px;
}

.dataset-type-card__eyebrow {
  color: var(--blue);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.dataset-type-card__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
}

.dataset-type-card__metrics div {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-subtle);
}

.dataset-type-card__metrics dt {
  color: var(--muted);
  font-size: 12px;
  font-weight: 720;
}

.dataset-type-card__metrics dd {
  margin: 4px 0 0;
  overflow-wrap: anywhere;
  font-weight: 760;
}

.dataset-type-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 780px) {
  .dataset-type-form,
  .dataset-type-card__metrics {
    grid-template-columns: 1fr;
  }
}
</style>

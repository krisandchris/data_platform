<template>
  <div>
    <header class="page-header">
      <div>
        <h1 class="page-title">资产 / 样本列表</h1>
        <p class="page-subtitle">Filter assets by judge decision, stage2 failure state, QC status, and violation category.</p>
      </div>
      <div class="page-actions">
        <RouterLink class="button" :to="`/datasets/${id}/overview`">
          <LayoutDashboard :size="17" />
          返回概览
        </RouterLink>
      </div>
    </header>

    <div v-if="loading" class="loading-state">Loading assets...</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>
    <div v-else-if="assets.length === 0" class="empty-state">No assets returned by the backend.</div>
    <AssetTable v-else :dataset-id="id" :assets="assets" @filters-changed="loadAssets" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { LayoutDashboard } from 'lucide-vue-next';
import { apiClient } from '../../services/urbanViolationApi';
import type { AssetListFilters, AssetListItem } from '../../shared/types/contract';
import AssetTable from './components/AssetTable.vue';

const props = defineProps<{ id: string }>();

const assets = ref<AssetListItem[]>([]);
const loading = ref(true);
const error = ref<string>();

const loadAssets = async (filters: AssetListFilters = {}) => {
  loading.value = true;
  error.value = undefined;
  try {
    assets.value = await apiClient.listAssets(props.id, filters);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to load assets';
  } finally {
    loading.value = false;
  }
};

onMounted(() => loadAssets());
</script>

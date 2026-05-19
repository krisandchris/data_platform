<template>
  <div>
    <header class="page-header">
      <div>
        <h1 class="page-title">批次资产 / 样本浏览</h1>
        <p class="page-subtitle">
          当前批次: {{ summary?.dataset.batchName ?? summary?.dataset.name ?? id }}
          <span v-if="summary">| 类型: {{ summary.dataset.datasetType ?? summary.dataset.name }}</span>
        </p>
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
    <template v-else>
      <section v-if="assetSummary" class="grid grid--metrics asset-summary">
        <MetricCard label="有效媒体" :value="`${assetSummary.media.valid}/${assetSummary.media.total}`" detail="当前批次媒体" tone="blue">
          <template #icon><Image :size="23" /></template>
        </MetricCard>
        <MetricCard label="导入资产" :value="assetSummary.importHealth.imported" :detail="`${assetSummary.importHealth.pathWarnings} path warnings`" tone="green">
          <template #icon><Database :size="23" /></template>
        </MetricCard>
        <MetricCard label="STEP1 Ready" :value="assetSummary.preannotation.stage1Ready" detail="可进入质检基础" tone="blue">
          <template #icon><FileCheck2 :size="23" /></template>
        </MetricCard>
        <MetricCard label="STEP2 Ready" :value="assetSummary.preannotation.stage2Ready" :detail="`${assetSummary.preannotation.stage2Failed} failures`" tone="orange">
          <template #icon><FileCog :size="23" /></template>
        </MetricCard>
        <MetricCard label="QC Submitted" :value="assetSummary.qc.submitted" :detail="`${assetSummary.qc.pending} pending`" tone="purple">
          <template #icon><ShieldCheck :size="23" /></template>
        </MetricCard>
        <MetricCard label="Soft Fail" :value="assetSummary.modelJudgement.softFail" detail="模型判断需复核" tone="red">
          <template #icon><TriangleAlert :size="23" /></template>
        </MetricCard>
      </section>

      <div v-if="assets.length === 0" class="empty-state">No assets returned by the backend.</div>
      <AssetTable v-else :dataset-id="id" :assets="assets" @filters-changed="loadAssets" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { Database, FileCheck2, FileCog, Image, LayoutDashboard, ShieldCheck, TriangleAlert } from 'lucide-vue-next';
import { apiClient } from '../../services/urbanViolationApi';
import MetricCard from '../../shared/components/MetricCard.vue';
import type { AssetListFilters, AssetListItem, AssetSummary, DatasetSummary } from '../../shared/types/contract';
import AssetTable from './components/AssetTable.vue';

const props = defineProps<{ id: string }>();

const assets = ref<AssetListItem[]>([]);
const summary = ref<DatasetSummary>();
const assetSummary = ref<AssetSummary>();
const loading = ref(true);
const error = ref<string>();
let loadSequence = 0;

const resetBatchState = () => {
  assets.value = [];
  summary.value = undefined;
  assetSummary.value = undefined;
  error.value = undefined;
};

const loadAssets = async (filters: AssetListFilters = {}, options: { reset?: boolean } = {}) => {
  const requestId = ++loadSequence;
  const batchId = props.id;
  if (options.reset) {
    resetBatchState();
  }
  loading.value = true;
  error.value = undefined;
  try {
    const [nextAssets, nextSummary] = await Promise.all([
      apiClient.listDatasetBatchAssets(batchId, filters),
      summary.value && !options.reset ? Promise.resolve(summary.value) : apiClient.getDatasetBatchSummary(batchId),
    ]);
    const nextAssetSummary = assetSummary.value && !options.reset
      ? assetSummary.value
      : await apiClient.getDatasetBatchAssetSummary(batchId).catch(() => nextSummary.assetSummary);
    if (requestId !== loadSequence) {
      return;
    }
    assets.value = nextAssets;
    summary.value = nextSummary;
    assetSummary.value = nextAssetSummary;
  } catch (err) {
    if (requestId === loadSequence) {
      error.value = err instanceof Error ? err.message : 'Unable to load assets';
      assets.value = [];
      summary.value = undefined;
      assetSummary.value = undefined;
    }
  } finally {
    if (requestId === loadSequence) {
      loading.value = false;
    }
  }
};

onMounted(() => loadAssets({}, { reset: true }));
watch(
  () => props.id,
  () => {
    void loadAssets({}, { reset: true });
  },
);
</script>

<style scoped>
.asset-summary {
  margin-bottom: 18px;
}
</style>

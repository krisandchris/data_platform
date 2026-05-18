<template>
  <section class="panel asset-table">
    <div class="asset-table__toolbar">
      <div class="filters">
        <label>
          状态
          <select v-model="localFilters.judgeDecision">
            <option value="all">全部</option>
            <option value="pass">pass</option>
            <option value="soft_fail">soft_fail</option>
          </select>
        </label>
        <label>
          STEP2
          <select v-model="localFilters.stage2State">
            <option value="all">全部</option>
            <option value="ready">ready</option>
            <option value="failed">stage2 failed</option>
          </select>
        </label>
        <label>
          质检
          <select v-model="localFilters.qcStatus">
            <option value="all">全部</option>
            <option value="qc_pending">qc_pending</option>
            <option value="needs_review">needs_review</option>
            <option value="manual_label_required">manual_label_required</option>
            <option value="passed">passed</option>
          </select>
        </label>
        <label>
          类别
          <select v-model="localFilters.violationCategory">
            <option value="all">全部</option>
            <option v-for="category in categories" :key="category" :value="category">{{ category }}</option>
          </select>
        </label>
        <label class="filters__search">
          sample_id
          <input v-model="localFilters.search" type="search" placeholder="搜索 sample_id" />
        </label>
      </div>
    </div>

    <div class="asset-table__meta">
      <span>已匹配 {{ filteredAssets.length }} 条样本</span>
      <button class="button" type="button" @click="resetFilters">
        <RotateCcw :size="16" />
        重置
      </button>
    </div>

    <div v-if="filteredAssets.length === 0" class="empty-state">No assets match the current filters.</div>
    <table v-else>
      <thead>
        <tr>
          <th>sample_id</th>
          <th>media</th>
          <th>stage</th>
          <th>decision</th>
          <th>category</th>
          <th>confidence</th>
          <th>qc</th>
          <th>updated</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="asset in filteredAssets" :key="asset.id">
          <td>
            <RouterLink class="sample-link" :to="reviewLink(asset.sampleId)">{{ asset.sampleId }}</RouterLink>
          </td>
          <td>
            <div class="thumb">
              <img v-if="safeMedia(asset)" :src="safeMedia(asset)" alt="" @error="markFailed(asset.id)" />
              <span v-if="failedImages.has(asset.id) || !safeMedia(asset)">URL</span>
            </div>
          </td>
          <td>
            <div class="chip-stack">
              <StatusChip :value="asset.stage1Status" label="STEP1 ready" />
              <StatusChip :value="asset.hasStage2Failure ? 'stage2_failed' : asset.stage2Status" />
            </div>
          </td>
          <td><StatusChip :value="asset.judgeDecision" /></td>
          <td>
            <div class="chip-stack">
              <CategoryChip v-for="category in asset.violationCategories" :key="category" :value="category" />
            </div>
          </td>
          <td>{{ asset.highestConfidence === undefined ? '-' : `${(asset.highestConfidence * 100).toFixed(2)}%` }}</td>
          <td><StatusChip :value="asset.qcStatus" /></td>
          <td>{{ formatTime(asset.updatedAt) }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { RotateCcw } from 'lucide-vue-next';
import { toBrowserMediaUrl } from '../../../services/media';
import CategoryChip from '../../../shared/components/CategoryChip.vue';
import StatusChip from '../../../shared/components/StatusChip.vue';
import type { AssetListFilters, AssetListItem, DatasetId, SampleId } from '../../../shared/types/contract';

const props = defineProps<{
  datasetId: DatasetId;
  assets: AssetListItem[];
}>();

const emit = defineEmits<{
  filtersChanged: [AssetListFilters];
}>();

const localFilters = reactive<AssetListFilters>({
  judgeDecision: 'all',
  stage2State: 'all',
  qcStatus: 'all',
  violationCategory: 'all',
  sampleCategory: 'all',
  search: '',
});

const failedImages = ref(new Set<string>());

const categories = computed(() =>
  [...new Set(props.assets.flatMap((asset) => asset.violationCategories))].sort((a, b) => a.localeCompare(b)),
);

const filteredAssets = computed(() =>
  props.assets.filter((asset) => {
    const query = localFilters.search?.trim().toLowerCase();
    return (
      (!localFilters.judgeDecision ||
        localFilters.judgeDecision === 'all' ||
        asset.judgeDecision === localFilters.judgeDecision) &&
      (!localFilters.stage2State ||
        localFilters.stage2State === 'all' ||
        (localFilters.stage2State === 'failed' ? asset.hasStage2Failure : !asset.hasStage2Failure)) &&
      (!localFilters.qcStatus || localFilters.qcStatus === 'all' || asset.qcStatus === localFilters.qcStatus) &&
      (!localFilters.violationCategory ||
        localFilters.violationCategory === 'all' ||
        asset.violationCategories.includes(localFilters.violationCategory)) &&
      (!query || asset.sampleId.toLowerCase().includes(query))
    );
  }),
);

watch(localFilters, () => emit('filtersChanged', { ...localFilters }), { deep: true });

const resetFilters = () => {
  localFilters.judgeDecision = 'all';
  localFilters.stage2State = 'all';
  localFilters.qcStatus = 'all';
  localFilters.violationCategory = 'all';
  localFilters.sampleCategory = 'all';
  localFilters.search = '';
};

const markFailed = (assetId: string) => {
  failedImages.value = new Set([...failedImages.value, assetId]);
};

const safeMedia = (asset: AssetListItem) => toBrowserMediaUrl(asset.thumbnailUrl ?? asset.imageUrl);
const reviewLink = (sampleId: SampleId) => `/datasets/${props.datasetId}/samples/${sampleId}/review`;
const formatTime = (value: string) => new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
</script>

<style scoped>
.asset-table {
  overflow: hidden;
}

.asset-table__toolbar,
.asset-table__meta {
  padding: 14px 16px;
  border-bottom: 1px solid var(--line);
}

.asset-table__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--muted);
}

.filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(150px, 1fr)) minmax(180px, 1.2fr);
  gap: 12px;
}

.filters label {
  display: grid;
  gap: 6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.filters select,
.filters input {
  height: 38px;
  min-width: 0;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: #fff;
  color: var(--text);
  padding: 0 10px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: middle;
}

th {
  background: var(--panel-subtle);
  color: #475467;
  font-size: 12px;
  text-transform: uppercase;
}

.sample-link {
  color: var(--blue);
  font-weight: 760;
}

.thumb {
  position: relative;
  display: grid;
  width: 96px;
  aspect-ratio: 16 / 9;
  place-items: center;
  overflow: hidden;
  border-radius: 8px;
  background: #dce8f8;
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb span {
  position: absolute;
}

.chip-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

@media (max-width: 1080px) {
  .filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .asset-table {
    overflow-x: auto;
  }

  table {
    min-width: 920px;
  }
}
</style>

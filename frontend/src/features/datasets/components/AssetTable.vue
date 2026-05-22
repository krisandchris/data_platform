<template>
  <section class="panel asset-table">
    <div class="asset-table__toolbar">
      <div class="filters">
        <label>
          STEP1
          <select v-model="localFilters.stage1Status">
            <option value="all">全部</option>
            <option value="ready">ready</option>
            <option value="missing">missing</option>
            <option value="failed">failed</option>
          </select>
        </label>
        <label>
          模型判断
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
          QC
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
        <label>
          sample category
          <select v-model="localFilters.sampleCategory">
            <option value="all">全部</option>
            <option v-for="category in sampleCategories" :key="category" :value="category">{{ category }}</option>
          </select>
        </label>
        <label>
          媒体
          <select v-model="localFilters.mediaStatus">
            <option value="all">全部</option>
            <option value="valid">valid</option>
            <option value="missing">missing</option>
            <option value="load_failed">load_failed</option>
          </select>
        </label>
        <label>
          人工修改
          <select v-model="localFilters.labelEditStatus">
            <option value="all">全部</option>
            <option value="none">none</option>
            <option value="draft">draft</option>
            <option value="submitted">submitted</option>
            <option value="changed">changed</option>
          </select>
        </label>
        <label>
          最低置信度
          <input v-model.number="localFilters.confidenceMin" type="number" min="0" max="1" step="0.05" placeholder="0.00" />
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
    <div v-else class="asset-table__scroll">
      <table>
        <thead>
          <tr>
            <th>sample_id</th>
            <th>media</th>
            <th>stage</th>
            <th>decision</th>
            <th>category</th>
            <th>sample category</th>
            <th>confidence</th>
            <th>qc</th>
            <th>edit</th>
            <th>updated</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="asset in paginatedAssets" :key="asset.id">
            <td>
              <RouterLink class="sample-link" :to="reviewLink(asset.sampleId)" :title="asset.sampleId">
                {{ asset.sampleId }}
              </RouterLink>
            </td>
            <td>
              <div class="thumb">
                <img v-if="safeMedia(asset)" :src="safeMedia(asset)" alt="" @error="markFailed(asset.id)" />
                <span v-if="failedImages.has(asset.id) || !safeMedia(asset)">{{ asset.mediaStatus ?? 'URL' }}</span>
              </div>
              <small class="asset-muted">{{ asset.mediaStatus ?? 'unknown' }}</small>
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
            <td>
              <div class="chip-stack">
                <StatusChip v-for="category in asset.sampleCategories" :key="category" :value="category" />
              </div>
            </td>
            <td>{{ asset.highestConfidence === undefined ? '-' : `${(asset.highestConfidence * 100).toFixed(2)}%` }}</td>
            <td><StatusChip :value="asset.qcStatus" /></td>
            <td><StatusChip :value="asset.labelEditStatus ?? 'none'" /></td>
            <td>{{ formatTime(asset.updatedAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="filteredAssets.length" class="pagination-bar" aria-label="资产样本分页">
      <span>{{ assetPaginationText }}</span>
      <div class="pagination-bar__controls">
        <button type="button" :disabled="assetPage === 1" aria-label="上一页" @click="assetPage = Math.max(1, assetPage - 1)">
          <ChevronLeft :size="16" />
        </button>
        <strong>{{ assetPage }} / {{ assetTotalPages }}</strong>
        <button
          type="button"
          :disabled="assetPage === assetTotalPages"
          aria-label="下一页"
          @click="assetPage = Math.min(assetTotalPages, assetPage + 1)"
        >
          <ChevronRight :size="16" />
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-vue-next';
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
  stage1Status: 'all',
  stage2State: 'all',
  qcStatus: 'all',
  violationCategory: 'all',
  sampleCategory: 'all',
  mediaStatus: 'all',
  labelEditStatus: 'all',
  search: '',
});

const failedImages = ref(new Set<string>());
const assetPageSize = 10;
const assetPage = ref(1);
const assetIdentityKey = computed(() =>
  [props.datasetId, ...props.assets.map((asset) => `${asset.id}:${asset.imageUrl ?? ''}:${asset.thumbnailUrl ?? ''}`)].join('|'),
);

const categories = computed(() =>
  [...new Set(props.assets.flatMap((asset) => asset.violationCategories))].sort((a, b) => a.localeCompare(b)),
);

const sampleCategories = computed(() =>
  [...new Set(props.assets.flatMap((asset) => asset.sampleCategories))].sort((a, b) => a.localeCompare(b)),
);

const filteredAssets = computed(() =>
  props.assets.filter((asset) => {
    const query = localFilters.search?.trim().toLowerCase();
    return (
      (!localFilters.stage1Status ||
        localFilters.stage1Status === 'all' ||
        asset.stage1Status === localFilters.stage1Status) &&
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
      (!localFilters.sampleCategory ||
        localFilters.sampleCategory === 'all' ||
        asset.sampleCategories.includes(localFilters.sampleCategory)) &&
      (localFilters.confidenceMin === undefined ||
        localFilters.confidenceMin === null ||
        (asset.highestConfidence !== undefined && asset.highestConfidence >= localFilters.confidenceMin)) &&
      (!localFilters.mediaStatus ||
        localFilters.mediaStatus === 'all' ||
        asset.mediaStatus === localFilters.mediaStatus) &&
      (!localFilters.labelEditStatus ||
        localFilters.labelEditStatus === 'all' ||
        asset.labelEditStatus === localFilters.labelEditStatus) &&
      (!query || asset.sampleId.toLowerCase().includes(query))
    );
  }),
);
const assetTotalPages = computed(() => Math.max(1, Math.ceil(filteredAssets.value.length / assetPageSize)));
const assetPageStartIndex = computed(() => (filteredAssets.value.length ? (assetPage.value - 1) * assetPageSize : 0));
const assetPageEndIndex = computed(() => Math.min(filteredAssets.value.length, assetPageStartIndex.value + assetPageSize));
const paginatedAssets = computed(() => filteredAssets.value.slice(assetPageStartIndex.value, assetPageEndIndex.value));
const assetPaginationText = computed(() =>
  filteredAssets.value.length
    ? `显示 ${assetPageStartIndex.value + 1}-${assetPageEndIndex.value} / ${filteredAssets.value.length}，每页 ${assetPageSize} 条`
    : `显示 0 / 0，每页 ${assetPageSize} 条`,
);

watch(
  localFilters,
  () => {
    assetPage.value = 1;
    emit('filtersChanged', { ...localFilters });
  },
  { deep: true },
);
watch(assetIdentityKey, () => {
  assetPage.value = 1;
  failedImages.value = new Set();
});
watch(
  () => filteredAssets.value.length,
  () => {
    if (assetPage.value > assetTotalPages.value) {
      assetPage.value = assetTotalPages.value;
    }
  },
);

const resetFilters = () => {
  localFilters.judgeDecision = 'all';
  localFilters.stage1Status = 'all';
  localFilters.stage2State = 'all';
  localFilters.qcStatus = 'all';
  localFilters.violationCategory = 'all';
  localFilters.sampleCategory = 'all';
  localFilters.confidenceMin = undefined;
  localFilters.confidenceMax = undefined;
  localFilters.mediaStatus = 'all';
  localFilters.labelEditStatus = 'all';
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
  grid-template-columns: repeat(4, minmax(140px, 1fr));
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
  table-layout: fixed;
}

.asset-table__scroll {
  overflow-x: auto;
}

th,
td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: middle;
  min-width: 0;
}

th {
  background: var(--panel-subtle);
  color: #475467;
  font-size: 12px;
  text-transform: uppercase;
}

th:nth-child(1),
td:nth-child(1) {
  width: 210px;
}

th:nth-child(2),
td:nth-child(2) {
  width: 126px;
}

th:nth-child(3),
td:nth-child(3),
th:nth-child(5),
td:nth-child(5),
th:nth-child(6),
td:nth-child(6) {
  width: 150px;
}

th:nth-child(7),
td:nth-child(7),
th:nth-child(10),
td:nth-child(10) {
  width: 108px;
}

th:nth-child(4),
td:nth-child(4),
th:nth-child(8),
td:nth-child(8),
th:nth-child(9),
td:nth-child(9) {
  width: 104px;
}

.sample-link {
  display: block;
  max-width: 100%;
  color: var(--blue);
  font-weight: 760;
  line-height: 1.35;
  overflow-wrap: anywhere;
  word-break: break-word;
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

.asset-muted {
  display: block;
  margin-top: 5px;
  color: var(--muted);
  font-size: 12px;
}

.chip-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}

.pagination-bar__controls {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.pagination-bar button {
  display: inline-flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: #fff;
  color: var(--text);
}

.pagination-bar button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@media (max-width: 1080px) {
  .filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  table {
    min-width: 1180px;
  }
}
</style>

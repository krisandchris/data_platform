<template>
  <div class="sample-pool-page">
    <header class="page-header sample-pool-header">
      <div>
        <h1 class="page-title">修正样本池</h1>
      </div>
      <div class="page-actions">
        <button class="button" type="button" :disabled="itemsLoading || statsLoading" @click="reloadAll">
          <RefreshCw :size="17" />
          刷新
        </button>
      </div>
    </header>

    <section class="grid sample-pool-metrics" aria-label="样本池统计">
      <MetricCard label="总入池样本" :value="statsValue(stats?.totalItems)" detail="确认后有修改的样本" tone="blue">
        <template #icon><Database :size="23" /></template>
      </MetricCard>
      <MetricCard label="活跃样本" :value="statsValue(stats?.activeItems)" detail="可继续审阅处理" tone="green">
        <template #icon><Activity :size="23" /></template>
      </MetricCard>
      <MetricCard
        label="主要归因"
        :value="stats?.primaryAttribution ? formatAttribution(stats.primaryAttribution.code, stats.primaryAttribution.label) : '暂无'"
        :detail="stats?.primaryAttribution?.count !== undefined ? `${stats.primaryAttribution.count} 次事件` : '等待归因统计'"
        tone="orange"
      >
        <template #icon><Tags :size="23" /></template>
      </MetricCard>
      <MetricCard label="涉及批次" :value="statsValue(stats?.involvedBatchCount)" detail="按具体批次汇总" tone="purple">
        <template #icon><Layers :size="23" /></template>
      </MetricCard>
      <MetricCard label="最近入池" :value="formatDate(stats?.recentlyAddedAt)" detail="最新确认修改样本" tone="blue">
        <template #icon><Clock :size="23" /></template>
      </MetricCard>
    </section>

    <div v-if="statsError" class="sample-pool-inline-error" data-testid="sample-pool-stats-error">
      统计暂不可用：{{ statsError }}
    </div>

    <section class="panel sample-pool-filters" aria-label="筛选条件">
      <div class="panel__header">
        <h2 class="panel__title">筛选条件</h2>
        <span class="muted">{{ activeFilterCount ? `已启用 ${activeFilterCount} 项` : '未筛选' }}</span>
      </div>
      <form class="sample-pool-filter-grid" @submit.prevent="applyFilters">
        <label>
          <span>数据集类型</span>
          <select v-model="filters.datasetType" data-testid="sample-pool-filter-dataset-type">
            <option value="">全部类型</option>
            <option v-for="option in datasetTypeOptions" :key="option" :value="option">
              {{ formatDatasetType(option) }}
            </option>
          </select>
        </label>
        <label>
          <span>批次</span>
          <select v-model="filters.batchId" data-testid="sample-pool-filter-batch">
            <option value="">全部批次</option>
            <option v-for="option in batchOptions" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
        </label>
        <label>
          <span>类别</span>
          <select v-model="filters.category" data-testid="sample-pool-filter-category">
            <option value="">全部类别</option>
            <option v-for="option in categoryOptions" :key="option" :value="option">
              {{ formatCategory(option) }}
            </option>
          </select>
        </label>
        <label>
          <span>归因</span>
          <select v-model="filters.attribution" data-testid="sample-pool-filter-attribution">
            <option value="">全部归因</option>
            <option v-for="option in attributionOptions" :key="option.code" :value="option.code">
              {{ formatAttribution(option.code, option.label) }}
            </option>
          </select>
        </label>
        <label>
          <span>事件类型</span>
          <select v-model="filters.eventType" data-testid="sample-pool-filter-event-type">
            <option value="">全部事件</option>
            <option v-for="option in eventTypeOptions" :key="option" :value="option">
              {{ formatEventType(option) }}
            </option>
          </select>
        </label>
        <label>
          <span>质检员/审核人</span>
          <select v-model="filters.reviewer" data-testid="sample-pool-filter-reviewer">
            <option value="">全部人员</option>
            <option v-for="option in reviewerOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <label>
          <span>状态</span>
          <select v-model="filters.status" data-testid="sample-pool-filter-status">
            <option value="">全部状态</option>
            <option value="active">活跃</option>
            <option value="pending">待处理</option>
            <option value="removed">已移出</option>
            <option value="archived">已归档</option>
          </select>
        </label>
        <label class="sample-pool-search">
          <span>样本 ID 搜索</span>
          <input
            v-model.trim="filters.search"
            data-testid="sample-pool-filter-search"
            type="search"
            placeholder="输入样本 ID"
            @keyup.enter="applyFilters"
          />
        </label>
        <div class="sample-pool-filter-actions">
          <button class="button button--primary" type="submit">
            <Filter :size="17" />
            应用筛选
          </button>
          <button class="button" type="button" @click="resetFilters">重置</button>
        </div>
      </form>
    </section>

    <SamplePoolExportPanel :filters="activeApiFilters" :active-filter-count="activeFilterCount" />

    <section class="panel sample-pool-list">
      <div class="panel__header">
        <h2 class="panel__title">样本列表</h2>
        <span class="muted">{{ itemsLoading ? '加载中' : `${items.length} 条` }}</span>
      </div>

      <div v-if="itemsLoading && !hasLoadedItems" class="loading-state" data-testid="sample-pool-loading">
        正在加载修正样本池
      </div>
      <div v-else-if="itemsError" class="error-state" data-testid="sample-pool-error">
        样本池暂不可用：{{ itemsError }}
      </div>
      <div v-else-if="items.length === 0 && activeFilterCount === 0" class="empty-state" data-testid="sample-pool-empty">
        暂无修正样本入池
      </div>
      <div v-else-if="items.length === 0" class="empty-state" data-testid="sample-pool-filtered-empty">
        当前筛选无匹配样本
      </div>
      <div v-else class="sample-pool-table-wrap">
        <table class="sample-pool-table" data-testid="sample-pool-table">
          <thead>
            <tr>
              <th>样本 ID</th>
              <th>来源批次</th>
              <th>类别</th>
              <th>归因标签</th>
              <th>事件数</th>
              <th>变更字段数</th>
              <th>质检员</th>
              <th>确认时间</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.itemId">
              <td>
                <strong class="sample-pool-sample-id" :title="item.sampleId">{{ item.sampleId }}</strong>
              </td>
              <td>{{ item.batchName || item.batchId || item.datasetId }}</td>
              <td>{{ formatCategory(item.category) }}</td>
              <td>
                <div class="sample-pool-tags">
                  <span v-for="tag in visibleAttributionTags(item)" :key="tag.code">
                    {{ formatAttribution(tag.code, tag.label) }}
                  </span>
                  <span v-if="item.attributionTags.length === 0">未归因</span>
                </div>
              </td>
              <td>{{ item.eventCount }}</td>
              <td>{{ item.changedFieldCount }}</td>
              <td>{{ item.reviewerDisplayName || item.reviewerId || '未记录' }}</td>
              <td>{{ formatDate(item.confirmedAt) }}</td>
              <td>
                <span class="sample-pool-status" :class="`sample-pool-status--${statusTone(item.status)}`">
                  {{ formatStatus(item.status) }}
                </span>
              </td>
              <td>
                <RouterLink class="sample-pool-review-link" :to="reviewPath(item)">
                  进入审阅页
                  <ArrowRight :size="16" />
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { Activity, ArrowRight, Clock, Database, Filter, Layers, RefreshCw, Tags } from 'lucide-vue-next';
import { apiClient } from '../../services/urbanViolationApi';
import MetricCard from '../../shared/components/MetricCard.vue';
import SamplePoolExportPanel from './components/SamplePoolExportPanel.vue';
import type {
  SamplePoolAttributionTag,
  SamplePoolItem,
  SamplePoolItemStatus,
  SamplePoolListFilters,
  SamplePoolStats,
} from '../../shared/types/contract';

type FilterState = Record<keyof SamplePoolListFilters, string>;

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const items = ref<SamplePoolItem[]>([]);
const stats = ref<SamplePoolStats>();
const itemsLoading = ref(false);
const statsLoading = ref(false);
const hasLoadedItems = ref(false);
const itemsError = ref('');
const statsError = ref('');
const filters = reactive<FilterState>({
  datasetType: '',
  batchId: '',
  category: '',
  attribution: '',
  eventType: '',
  reviewer: '',
  status: '',
  search: '',
});

const activeFilterCount = computed(() => Object.values(filters).filter(Boolean).length);
const activeApiFilters = computed(() => toApiFilters());
const datasetTypeOptions = computed(() => optionsFrom(items.value.map((item) => item.datasetType), filters.datasetType));
const batchOptions = computed(() => optionsFrom(items.value.map((item) => item.batchId || item.datasetId), filters.batchId));
const categoryOptions = computed(() => optionsFrom(items.value.map((item) => item.category), filters.category));
const eventTypeOptions = computed(() => optionsFrom(items.value.flatMap((item) => item.eventTypes), filters.eventType));
const attributionOptions = computed(() => {
  const options = new Map<string, SamplePoolAttributionTag>();
  items.value.flatMap((item) => item.attributionTags).forEach((tag) => options.set(tag.code, tag));
  stats.value?.byAttribution.forEach((tag) => options.set(tag.code, tag));
  if (filters.attribution && !options.has(filters.attribution)) {
    options.set(filters.attribution, { code: filters.attribution, label: filters.attribution });
  }
  return Array.from(options.values());
});
const reviewerOptions = computed(() => {
  const options = new Map<string, string>();
  items.value.forEach((item) => {
    if (item.reviewerId) options.set(item.reviewerId, item.reviewerDisplayName || item.reviewerId);
    if (item.confirmedBy) options.set(item.confirmedBy, item.confirmedByDisplayName || item.confirmedBy);
  });
  if (filters.reviewer && !options.has(filters.reviewer)) {
    options.set(filters.reviewer, filters.reviewer);
  }
  return Array.from(options.entries()).map(([value, label]) => ({ value, label }));
});

onMounted(() => {
  void reloadAll();
});

async function reloadAll() {
  await Promise.all([loadStats(), loadItems()]);
}

async function loadStats() {
  statsLoading.value = true;
  statsError.value = '';
  try {
    stats.value = await apiClient.getSamplePoolStats();
  } catch (error) {
    statsError.value = error instanceof Error ? error.message : '加载失败';
  } finally {
    statsLoading.value = false;
  }
}

async function loadItems() {
  itemsLoading.value = true;
  itemsError.value = '';
  try {
    items.value = await apiClient.listSamplePoolItems(toApiFilters());
    hasLoadedItems.value = true;
  } catch (error) {
    itemsError.value = error instanceof Error ? error.message : '加载失败';
    items.value = [];
    hasLoadedItems.value = true;
  } finally {
    itemsLoading.value = false;
  }
}

async function applyFilters() {
  await loadItems();
}

async function resetFilters() {
  Object.keys(filters).forEach((key) => {
    filters[key as keyof FilterState] = '';
  });
  await loadItems();
}

function toApiFilters(): SamplePoolListFilters {
  const next: SamplePoolListFilters = {};
  if (filters.datasetType) next.datasetType = filters.datasetType;
  if (filters.batchId) next.batchId = filters.batchId;
  if (filters.category) next.category = filters.category;
  if (filters.attribution) next.attribution = filters.attribution;
  if (filters.eventType) next.eventType = filters.eventType;
  if (filters.reviewer) next.reviewer = filters.reviewer;
  if (filters.status) next.status = filters.status;
  if (filters.search) next.search = filters.search;
  return next;
}

function reviewPath(item: SamplePoolItem) {
  return `/datasets/${encodeURIComponent(item.batchId || item.datasetId)}/samples/${encodeURIComponent(item.sampleId)}/review`;
}

function visibleAttributionTags(item: SamplePoolItem) {
  return item.attributionTags.slice(0, 3);
}

function optionsFrom(values: Array<string | undefined>, selected: string) {
  const options = Array.from(new Set(values.filter((value): value is string => Boolean(value))));
  if (selected && !options.includes(selected)) {
    options.push(selected);
  }
  return options;
}

function statsValue(value?: number) {
  if (statsLoading.value && value === undefined) {
    return '加载中';
  }
  return value ?? 0;
}

function formatDate(value?: string) {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date);
}

function formatDatasetType(value?: string) {
  const labels: Record<string, string> = {
    urban_violation: '城市违规',
    ares_detection: 'Ares 检测',
  };
  return value ? (labels[value] ?? value) : '未记录';
}

function formatCategory(value?: string) {
  const labels: Record<string, string> = {
    'no violation': '无违法',
    nonmotor_vehicle_illegal_parking: '非机动车违停',
    motor_vehicle_illegal_parking: '机动车违停',
    goods_blocking_road: '物品占道',
    road_occupying_vendor: '摊贩占道',
    stage2_failure: 'STEP2 失败',
  };
  return value ? (labels[value] ?? value) : '未记录';
}

function formatAttribution(code: string, label?: string) {
  const labels: Record<string, string> = {
    model_bbox_offset: '模型框偏移',
    category_boundary: '类别边界判断',
    visibility_miss: '可见性漏判',
    relation_mismatch: '关系判断错误',
    evidence_missing: '证据缺失',
  };
  return labels[code] ?? label ?? code;
}

function formatEventType(value?: string) {
  const labels: Record<string, string> = {
    relation_modify: '关系修正',
    relation_bbox_adjust: '关系框调整',
    candidate_category_change: '候选类别修正',
    candidate_delete: '候选删除',
    candidate_add: '候选新增',
    candidate_evidence_edit: '候选证据修正',
    bbox_adjusted: '框位置调整',
    category_changed: '类别修正',
  };
  return value ? (labels[value] ?? value) : '未记录';
}

function formatStatus(value: SamplePoolItemStatus) {
  const labels: Record<string, string> = {
    active: '活跃',
    pending: '待处理',
    removed: '已移出',
    archived: '已归档',
  };
  return labels[value] ?? value;
}

function statusTone(value: SamplePoolItemStatus) {
  if (value === 'active') return 'green';
  if (value === 'removed') return 'red';
  if (value === 'archived') return 'gray';
  return 'blue';
}
</script>

<style scoped>
.sample-pool-page {
  display: grid;
  gap: 18px;
}

.sample-pool-header {
  align-items: center;
  margin-bottom: 0;
}

.sample-pool-metrics {
  grid-template-columns: repeat(5, minmax(150px, 1fr));
}

.sample-pool-inline-error {
  border: 1px solid #ffd2d2;
  border-radius: 8px;
  background: var(--red-soft);
  color: #ad1f26;
  padding: 12px 14px;
  font-weight: 750;
}

.sample-pool-filter-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(160px, 1fr));
  gap: 14px;
  padding: 18px;
}

.sample-pool-filter-grid label {
  display: grid;
  gap: 7px;
  color: #344054;
  font-size: 13px;
  font-weight: 800;
}

.sample-pool-filter-grid select,
.sample-pool-filter-grid input {
  width: 100%;
  min-height: 40px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: #fff;
  color: var(--text);
  padding: 0 11px;
  outline: 0;
}

.sample-pool-filter-grid select:focus,
.sample-pool-filter-grid input:focus {
  border-color: var(--blue);
  box-shadow: 0 0 0 3px rgba(18, 100, 255, 0.12);
}

.sample-pool-search {
  grid-column: span 2;
}

.sample-pool-filter-actions {
  display: flex;
  align-items: end;
  gap: 10px;
}

.sample-pool-table-wrap {
  overflow-x: auto;
}

.sample-pool-table {
  width: 100%;
  min-width: 1080px;
  border-collapse: collapse;
}

.sample-pool-table th,
.sample-pool-table td {
  border-bottom: 1px solid var(--line);
  padding: 13px 14px;
  text-align: left;
  vertical-align: middle;
}

.sample-pool-table th {
  color: #475467;
  font-size: 13px;
  font-weight: 850;
  white-space: nowrap;
}

.sample-pool-table td {
  color: #24324b;
}

.sample-pool-sample-id {
  display: inline-block;
  max-width: 210px;
  overflow: hidden;
  color: #101828;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}

.sample-pool-tags {
  display: flex;
  max-width: 260px;
  flex-wrap: wrap;
  gap: 6px;
}

.sample-pool-tags span {
  display: inline-flex;
  min-height: 26px;
  align-items: center;
  border: 1px solid #c6d8f6;
  border-radius: 8px;
  background: #f4f8ff;
  color: #0f5bd8;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 800;
}

.sample-pool-status,
.sample-pool-review-link {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  gap: 6px;
  border-radius: 8px;
  padding: 0 9px;
  font-size: 13px;
  font-weight: 850;
  white-space: nowrap;
}

.sample-pool-status--green {
  background: var(--green-soft);
  color: #10733f;
}

.sample-pool-status--blue {
  background: var(--blue-soft);
  color: var(--blue);
}

.sample-pool-status--red {
  background: var(--red-soft);
  color: var(--red);
}

.sample-pool-status--gray {
  background: #eef2f6;
  color: #475467;
}

.sample-pool-review-link {
  border: 1px solid #b8cdf2;
  background: #fff;
  color: #0f5bd8;
}

.sample-pool-review-link:hover {
  border-color: var(--blue);
  background: var(--blue-soft);
}

@media (max-width: 1180px) {
  .sample-pool-metrics,
  .sample-pool-filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .sample-pool-metrics,
  .sample-pool-filter-grid {
    grid-template-columns: 1fr;
  }

  .sample-pool-search {
    grid-column: auto;
  }

  .sample-pool-filter-actions {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>

<template>
  <section class="panel qc-analysis-panel overview-grid" data-testid="qc-analysis-panel">
    <div class="panel__header">
      <h2 class="panel__title">质检分析</h2>
      <span v-if="stats?.generatedAt" class="qc-analysis-panel__timestamp">
        生成时间：{{ formatDateTime(stats.generatedAt) }}
      </span>
    </div>

    <div class="panel__body qc-analysis-panel__body">
      <div v-if="loading" class="loading-state">正在加载质检分析...</div>
      <div v-else-if="error" class="error-state" data-testid="qc-analysis-error">
        质检分析暂不可用：{{ error }}。批次概览其他信息不受影响。
      </div>
      <div v-else-if="isEmpty" class="empty-state" data-testid="qc-analysis-empty">
        暂无质检修改事件。完成样本确认后，这里会展示修改归因与样本变更分布。
      </div>

      <template v-else-if="stats">
        <div class="qc-analysis-metrics">
          <div>
            <span>修改事件总数</span>
            <strong>{{ formatNumber(stats.totalEvents) }}</strong>
          </div>
          <div>
            <span>变更样本数</span>
            <strong>{{ formatNumber(stats.changedSampleCount) }}</strong>
          </div>
          <div>
            <span>最高频归因</span>
            <strong>{{ topAttributionText }}</strong>
          </div>
          <div>
            <span>标注框偏移分布</span>
            <strong>{{ bboxBandsText }}</strong>
          </div>
        </div>

        <div class="qc-analysis-layout">
          <section class="qc-analysis-block">
            <h3>事件类型分布</h3>
            <div v-if="stats.byEventType.length" class="qc-analysis-distribution">
              <div v-for="item in stats.byEventType" :key="item.eventType" class="qc-analysis-row">
                <span>{{ item.label }}</span>
                <div class="qc-analysis-row__bar" aria-hidden="true">
                  <i :style="{ width: `${barWidth(item.count, eventTypeMax)}%` }" />
                </div>
                <strong>{{ formatNumber(item.count) }}</strong>
              </div>
            </div>
            <div v-else class="qc-analysis-muted">暂无事件类型统计</div>
          </section>

          <section class="qc-analysis-block">
            <h3>错误归因分布</h3>
            <div v-if="stats.byAttribution.length" class="qc-analysis-distribution">
              <div v-for="item in stats.byAttribution" :key="item.code" class="qc-analysis-row">
                <span>{{ item.label }}</span>
                <div class="qc-analysis-row__bar" aria-hidden="true">
                  <i :style="{ width: `${barWidth(item.count, attributionMax)}%` }" />
                </div>
                <strong>{{ attributionCountText(item) }}</strong>
              </div>
            </div>
            <div v-else class="qc-analysis-muted">暂无错误归因统计</div>
          </section>
        </div>

        <section class="qc-analysis-block qc-analysis-block--bbox">
          <h3>标注框偏移分布</h3>
          <div class="qc-bbox-bands">
            <div v-for="band in bboxBandItems" :key="band.key">
              <span>{{ band.label }}</span>
              <strong>{{ formatNumber(band.count) }}</strong>
            </div>
          </div>
        </section>

        <section class="qc-analysis-block">
          <h3>变更样本列表</h3>
          <div v-if="stats.changedSamples.length" class="qc-sample-table-wrap">
            <table class="qc-sample-table">
              <thead>
                <tr>
                  <th>样本</th>
                  <th>事件数</th>
                  <th>事件类型</th>
                  <th>归因</th>
                  <th>确认人</th>
                  <th>确认时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="sample in stats.changedSamples" :key="sample.sampleId">
                  <td>{{ sample.sampleId }}</td>
                  <td>{{ formatNumber(sample.eventCount) }}</td>
                  <td>{{ eventTypeText(sample.eventTypes) }}</td>
                  <td>{{ attributionCodeText(sample.attributionCodes) }}</td>
                  <td>{{ sample.reviewerId ?? '-' }}</td>
                  <td>{{ sample.confirmedAt ? formatDateTime(sample.confirmedAt) : '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="qc-analysis-muted">暂无变更样本</div>
        </section>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { apiClient } from '../../../services/urbanViolationApi';
import { useAsyncState } from '../../../shared/composables/useAsyncState';
import type { QcModificationAttributionCount } from '../../../shared/types/contract';

const props = defineProps<{
  datasetId: string;
}>();

const { data: stats, loading, error } = useAsyncState(
  () => apiClient.getDatasetBatchQcModificationEventStats(props.datasetId),
  {
    watch: () => props.datasetId,
    resetOnExecute: true,
  },
);

const isEmpty = computed(() => !stats.value || stats.value.totalEvents === 0);

const topAttribution = computed(() =>
  (stats.value?.byAttribution ?? []).reduce<QcModificationAttributionCount | undefined>(
    (top, item) => (!top || item.count > top.count ? item : top),
    undefined,
  ),
);

const topAttributionText = computed(() => {
  if (!topAttribution.value) {
    return '暂无归因';
  }
  return `${topAttribution.value.label} ${formatNumber(topAttribution.value.count)}`;
});

const bboxBandsText = computed(() => {
  const bands = stats.value?.bboxOffsetBands;
  if (!bands) {
    return '微小 0 / 中等 0 / 大 0';
  }
  return `微小 ${formatNumber(bands.micro)} / 中等 ${formatNumber(bands.medium)} / 大 ${formatNumber(bands.large)}`;
});

const eventTypeMax = computed(() => maxCount(stats.value?.byEventType));
const attributionMax = computed(() => maxCount(stats.value?.byAttribution));

const eventTypeLabels = computed(() => new Map((stats.value?.byEventType ?? []).map((item) => [item.eventType, item.label])));
const attributionLabels = computed(() => new Map((stats.value?.byAttribution ?? []).map((item) => [item.code, item.label])));

const bboxBandItems = computed(() => {
  const bands = stats.value?.bboxOffsetBands ?? { micro: 0, medium: 0, large: 0 };
  return [
    { key: 'micro', label: '微小偏移', count: bands.micro },
    { key: 'medium', label: '中等偏移', count: bands.medium },
    { key: 'large', label: '大偏移', count: bands.large },
  ];
});

function maxCount(items?: Array<{ count: number }>) {
  return Math.max(...(items ?? []).map((item) => item.count), 0);
}

function barWidth(count: number, max: number) {
  if (max <= 0) {
    return 0;
  }
  return Math.max((count / max) * 100, 4);
}

function attributionCountText(item: QcModificationAttributionCount) {
  if (typeof item.weightSum === 'number') {
    return `${formatNumber(item.count)} / 权重 ${item.weightSum.toFixed(2)}`;
  }
  return formatNumber(item.count);
}

function eventTypeText(types: string[]) {
  return labelList(types, eventTypeLabels.value);
}

function attributionCodeText(codes: string[]) {
  return labelList(codes, attributionLabels.value);
}

function labelList(values: string[], labels: Map<string, string>) {
  if (!values.length) {
    return '-';
  }
  return values.map((value) => labels.get(value) ?? value).join('、');
}

function formatNumber(value: number) {
  return value.toLocaleString('zh-CN');
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', { hour12: false });
}
</script>

<style scoped>
.qc-analysis-panel__timestamp {
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}

.qc-analysis-panel__body {
  display: grid;
  gap: 16px;
}

.qc-analysis-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.qc-analysis-metrics > div {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-subtle);
}

.qc-analysis-metrics span,
.qc-analysis-block h3,
.qc-sample-table th {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
}

.qc-analysis-metrics strong {
  overflow-wrap: anywhere;
  color: var(--text);
  font-size: 20px;
  line-height: 1.2;
}

.qc-analysis-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.qc-analysis-block {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
}

.qc-analysis-block h3 {
  margin: 0;
}

.qc-analysis-distribution {
  display: grid;
  gap: 12px;
}

.qc-analysis-row {
  display: grid;
  grid-template-columns: minmax(120px, 0.9fr) minmax(120px, 1fr) minmax(50px, auto);
  gap: 12px;
  align-items: center;
}

.qc-analysis-row span {
  overflow: hidden;
  color: #344054;
  font-weight: 680;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qc-analysis-row strong {
  color: var(--text);
  text-align: right;
  white-space: nowrap;
}

.qc-analysis-row__bar {
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: #edf3fb;
}

.qc-analysis-row__bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #1264ff, #37b24d);
}

.qc-analysis-muted {
  color: var(--muted);
  font-weight: 680;
}

.qc-bbox-bands {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.qc-bbox-bands > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-subtle);
}

.qc-bbox-bands span {
  color: var(--muted);
  font-weight: 720;
}

.qc-bbox-bands strong {
  color: var(--text);
}

.qc-sample-table-wrap {
  overflow-x: auto;
}

.qc-sample-table {
  width: 100%;
  min-width: 860px;
  border-collapse: collapse;
}

.qc-sample-table th,
.qc-sample-table td {
  padding: 12px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
}

.qc-sample-table td {
  color: #344054;
  font-weight: 640;
}

.qc-sample-table td:first-child {
  color: var(--text);
  font-weight: 760;
}

@media (max-width: 960px) {
  .qc-analysis-metrics,
  .qc-analysis-layout {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .qc-analysis-metrics,
  .qc-analysis-layout,
  .qc-bbox-bands {
    grid-template-columns: 1fr;
  }
}
</style>

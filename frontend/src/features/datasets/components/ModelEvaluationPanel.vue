<template>
  <section class="panel model-evaluation-panel overview-grid" data-testid="model-evaluation-panel">
    <div class="panel__header">
      <h2 class="panel__title">模型评估</h2>
      <button class="button" type="button" :disabled="loading || compareLoading" @click="reload">
        <RefreshCw :size="17" />
        刷新
      </button>
    </div>

    <div class="panel__body model-evaluation-panel__body">
      <div v-if="loading && !hasLoaded" class="loading-state" data-testid="model-evaluation-loading">
        正在加载模型评估
      </div>
      <div v-else-if="error" class="error-state" data-testid="model-evaluation-error">
        模型评估暂不可用：{{ error }}
      </div>
      <div v-else-if="evaluations.length === 0" class="empty-state" data-testid="model-evaluation-empty">
        暂无模型评估记录
      </div>

      <template v-else>
        <div class="model-evaluation-metrics">
          <div>
            <span>最新模型版本</span>
            <strong>{{ latestEvaluation?.modelVersion ?? '未记录' }}</strong>
          </div>
          <div>
            <span>评估样本</span>
            <strong>{{ formatNumber(latestEvaluation?.sampleCount) }}</strong>
          </div>
          <div>
            <span>变化样本</span>
            <strong>{{ formatNumber(latestEvaluation?.changedSampleCount) }}</strong>
          </div>
          <div>
            <span>关键指标</span>
            <strong>{{ topMetricText }}</strong>
          </div>
        </div>

        <section class="model-evaluation-block">
          <div class="model-evaluation-block__header">
            <h3>评估列表</h3>
            <span>{{ evaluations.length }} 条</span>
          </div>
          <div class="model-evaluation-table-wrap">
            <table class="model-evaluation-table">
              <thead>
                <tr>
                  <th>评估 ID</th>
                  <th>模型版本</th>
                  <th>状态</th>
                  <th>样本</th>
                  <th>变化样本</th>
                  <th>来源</th>
                  <th>完成时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="evaluation in evaluations" :key="evaluation.evaluationId">
                  <td>{{ evaluation.evaluationId }}</td>
                  <td>{{ evaluation.modelVersion }}</td>
                  <td>{{ formatStatus(evaluation.status) }}</td>
                  <td>{{ formatNumber(evaluation.sampleCount) }}</td>
                  <td>{{ formatNumber(evaluation.changedSampleCount) }}</td>
                  <td>{{ sourceText(evaluation) }}</td>
                  <td>{{ formatDate(evaluation.completedAt || evaluation.createdAt) }}</td>
                  <td>
                    <button class="model-evaluation-link" type="button" @click="loadDeltaSamples(evaluation.evaluationId)">
                      变化样本
                      <ArrowRight :size="15" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="model-evaluation-block" data-testid="model-evaluation-compare">
          <div class="model-evaluation-block__header">
            <h3>评估比较</h3>
            <GitCompareArrows :size="18" />
          </div>

          <div v-if="evaluations.length < 2" class="empty-state model-evaluation-state" data-testid="model-evaluation-compare-empty">
            至少需要两个评估记录才能比较
          </div>
          <template v-else>
            <div class="model-evaluation-compare-controls">
              <label>
                <span>基准评估</span>
                <select v-model="leftEvaluationId" data-testid="evaluation-left-select" @change="loadComparison">
                  <option v-for="evaluation in evaluations" :key="evaluation.evaluationId" :value="evaluation.evaluationId">
                    {{ evaluation.modelVersion }}
                  </option>
                </select>
              </label>
              <label>
                <span>对比评估</span>
                <select v-model="rightEvaluationId" data-testid="evaluation-right-select" @change="loadComparison">
                  <option v-for="evaluation in evaluations" :key="evaluation.evaluationId" :value="evaluation.evaluationId">
                    {{ evaluation.modelVersion }}
                  </option>
                </select>
              </label>
            </div>

            <div v-if="!comparisonReady" class="empty-state model-evaluation-state" data-testid="model-evaluation-compare-same">
              请选择两个不同的评估记录
            </div>
            <div v-else-if="compareLoading" class="loading-state model-evaluation-state">正在计算评估差异</div>
            <div v-else-if="compareError" class="error-state model-evaluation-state" data-testid="model-evaluation-compare-error">
              评估比较暂不可用：{{ compareError }}
            </div>
            <div v-else-if="compareResult" class="model-evaluation-delta-grid" data-testid="model-evaluation-compare-result">
              <div>
                <span>基准版本</span>
                <strong>{{ compareResult.leftModelVersion || leftEvaluationId }}</strong>
              </div>
              <div>
                <span>对比版本</span>
                <strong>{{ compareResult.rightModelVersion || rightEvaluationId }}</strong>
              </div>
              <div>
                <span>提升样本</span>
                <strong>{{ formatNumber(compareResult.improvedCount) }}</strong>
              </div>
              <div>
                <span>退化样本</span>
                <strong>{{ formatNumber(compareResult.regressedCount) }}</strong>
              </div>
              <div v-for="metric in compareResult.metricDeltas" :key="metric.key">
                <span>{{ metric.label }}</span>
                <strong :class="deltaClass(metric.delta)">{{ formatDelta(metric.delta) }}</strong>
              </div>
            </div>
            <div v-else class="empty-state model-evaluation-state" data-testid="model-evaluation-compare-unavailable">
              暂无可展示的评估差异
            </div>
          </template>
        </section>

        <section class="model-evaluation-block">
          <div class="model-evaluation-block__header">
            <h3>分类指标</h3>
            <BarChart3 :size="18" />
          </div>
          <div v-if="latestCategoryMetrics.length === 0" class="model-evaluation-muted">暂无分类指标</div>
          <div v-else class="model-evaluation-table-wrap">
            <table class="model-evaluation-table model-evaluation-table--compact">
              <thead>
                <tr>
                  <th>类别</th>
                  <th>精确率</th>
                  <th>召回率</th>
                  <th>F1</th>
                  <th>样本数</th>
                  <th>变化</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="metric in latestCategoryMetrics" :key="metric.category">
                  <td>{{ formatCategory(metric.category, metric.label) }}</td>
                  <td>{{ formatMetric(metric.precision) }}</td>
                  <td>{{ formatMetric(metric.recall) }}</td>
                  <td>{{ formatMetric(metric.f1) }}</td>
                  <td>{{ formatNumber(metric.sampleCount) }}</td>
                  <td :class="deltaClass(metric.delta)">{{ formatDelta(metric.delta) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="model-evaluation-block" data-testid="model-evaluation-delta-samples">
          <div class="model-evaluation-block__header">
            <h3>变化样本入口</h3>
            <span>{{ activeDeltaEvaluationLabel }}</span>
          </div>
          <div v-if="deltaLoading" class="loading-state model-evaluation-state">正在加载变化样本</div>
          <div v-else-if="deltaError" class="error-state model-evaluation-state" data-testid="model-evaluation-delta-error">
            变化样本暂不可用：{{ deltaError }}
          </div>
          <div v-else-if="deltaSamples.length === 0" class="empty-state model-evaluation-state" data-testid="model-evaluation-delta-empty">
            选择评估记录后查看变化样本
          </div>
          <div v-else class="model-evaluation-table-wrap" data-testid="model-evaluation-delta-table">
            <table class="model-evaluation-table model-evaluation-table--compact">
              <thead>
                <tr>
                  <th>样本</th>
                  <th>类别</th>
                  <th>变化类型</th>
                  <th>指标影响</th>
                  <th>原因</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="sample in deltaSamples" :key="sample.sampleId">
                  <td>{{ sample.sampleId }}</td>
                  <td>{{ formatCategory(sample.category) }}</td>
                  <td>{{ sample.changeType || '未记录' }}</td>
                  <td>{{ metricImpactText(sample.metricImpacts) }}</td>
                  <td>{{ sample.reason || '未记录' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ArrowRight, BarChart3, GitCompareArrows, RefreshCw } from 'lucide-vue-next';
import { apiClient } from '../../../services/urbanViolationApi';
import type {
  ModelEvaluationCompareResult,
  ModelEvaluationDeltaSample,
  ModelEvaluationMetric,
  ModelEvaluationRun,
} from '../../../shared/types/contract';

const props = defineProps<{
  datasetId: string;
}>();

const evaluations = ref<ModelEvaluationRun[]>([]);
const loading = ref(false);
const error = ref('');
const hasLoaded = ref(false);
const leftEvaluationId = ref('');
const rightEvaluationId = ref('');
const compareResult = ref<ModelEvaluationCompareResult>();
const compareLoading = ref(false);
const compareError = ref('');
const deltaSamples = ref<ModelEvaluationDeltaSample[]>([]);
const deltaLoading = ref(false);
const deltaError = ref('');
const activeDeltaEvaluationId = ref('');

const latestEvaluation = computed(() => evaluations.value[0]);
const latestCategoryMetrics = computed(() => latestEvaluation.value?.categoryMetrics ?? []);
const comparisonReady = computed(
  () => Boolean(leftEvaluationId.value && rightEvaluationId.value && leftEvaluationId.value !== rightEvaluationId.value),
);
const topMetricText = computed(() => {
  const metric = latestEvaluation.value?.metrics[0];
  return metric ? `${metric.label} ${formatMetric(metric.value, metric.unit)}` : '未记录';
});
const activeDeltaEvaluationLabel = computed(() => {
  const evaluation = evaluations.value.find((item) => item.evaluationId === activeDeltaEvaluationId.value);
  return evaluation?.modelVersion ?? '未选择';
});

onMounted(() => {
  void reload();
});

watch(
  () => props.datasetId,
  () => {
    void reload();
  },
);

async function reload() {
  loading.value = true;
  error.value = '';
  compareResult.value = undefined;
  compareError.value = '';
  deltaSamples.value = [];
  deltaError.value = '';
  activeDeltaEvaluationId.value = '';
  try {
    const rows = await apiClient.listDatasetBatchEvaluations(props.datasetId);
    evaluations.value = [...rows].sort((left, right) => sortTime(right) - sortTime(left));
    ensureComparisonDefaults();
    if (comparisonReady.value) {
      await loadComparison();
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败';
    evaluations.value = [];
  } finally {
    hasLoaded.value = true;
    loading.value = false;
  }
}

function ensureComparisonDefaults() {
  if (evaluations.value.length >= 2) {
    rightEvaluationId.value = evaluations.value[0].evaluationId;
    leftEvaluationId.value = evaluations.value[1].evaluationId;
  } else {
    rightEvaluationId.value = evaluations.value[0]?.evaluationId ?? '';
    leftEvaluationId.value = '';
  }
}

async function loadComparison() {
  compareResult.value = undefined;
  compareError.value = '';
  if (!comparisonReady.value) {
    return;
  }
  compareLoading.value = true;
  try {
    compareResult.value = await apiClient.compareModelEvaluations(leftEvaluationId.value, rightEvaluationId.value);
  } catch (err) {
    compareError.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    compareLoading.value = false;
  }
}

async function loadDeltaSamples(evaluationId: string) {
  deltaLoading.value = true;
  deltaError.value = '';
  activeDeltaEvaluationId.value = evaluationId;
  try {
    deltaSamples.value = await apiClient.listModelEvaluationDeltaSamples(evaluationId);
  } catch (err) {
    deltaError.value = err instanceof Error ? err.message : '加载失败';
    deltaSamples.value = [];
  } finally {
    deltaLoading.value = false;
  }
}

function sortTime(evaluation: ModelEvaluationRun) {
  const value = Date.parse(evaluation.completedAt || evaluation.createdAt || '');
  return Number.isNaN(value) ? 0 : value;
}

function formatNumber(value?: number) {
  return typeof value === 'number' ? value.toLocaleString('zh-CN') : '0';
}

function formatMetric(value?: number, unit?: string) {
  if (typeof value !== 'number') {
    return '未记录';
  }
  if (unit === '%' || Math.abs(value) <= 1) {
    return `${(value * 100).toFixed(1)}%`;
  }
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 3 });
}

function formatDelta(value?: number) {
  if (typeof value !== 'number') {
    return '未记录';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatMetric(value)}`;
}

function deltaClass(value?: number) {
  if (typeof value !== 'number') return '';
  if (value > 0) return 'is-positive';
  if (value < 0) return 'is-negative';
  return '';
}

function formatDate(value?: string) {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function formatStatus(value?: string) {
  const labels: Record<string, string> = {
    queued: '排队中',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
  };
  return value ? (labels[value] ?? value) : '未记录';
}

function formatCategory(value?: string, label?: string) {
  const labels: Record<string, string> = {
    'no violation': '无违法',
    nonmotor_vehicle_illegal_parking: '非机动车违停',
    motor_vehicle_illegal_parking: '机动车违停',
    goods_blocking_road: '物品占道',
    road_occupying_vendor: '摊贩占道',
    stage2_failure: 'STEP2 失败',
  };
  return value ? (labels[value] ?? label ?? value) : '未记录';
}

function sourceText(evaluation: ModelEvaluationRun) {
  if (evaluation.sourceExportId) return `导出 ${evaluation.sourceExportId}`;
  if (evaluation.sourceSnapshotId) return `快照 ${evaluation.sourceSnapshotId}`;
  return '未记录';
}

function metricImpactText(metrics: ModelEvaluationMetric[]) {
  if (!metrics.length) return '未记录';
  return metrics.map((metric) => `${metric.label} ${formatDelta(metric.delta)}`).join('、');
}
</script>

<style scoped>
.model-evaluation-panel__body {
  display: grid;
  gap: 16px;
}

.model-evaluation-metrics,
.model-evaluation-delta-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.model-evaluation-metrics > div,
.model-evaluation-delta-grid > div {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-subtle);
}

.model-evaluation-metrics span,
.model-evaluation-delta-grid span,
.model-evaluation-block h3,
.model-evaluation-table th,
.model-evaluation-compare-controls span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
}

.model-evaluation-metrics strong,
.model-evaluation-delta-grid strong {
  overflow-wrap: anywhere;
  color: var(--text);
  font-size: 20px;
  line-height: 1.2;
}

.model-evaluation-block {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
}

.model-evaluation-block__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.model-evaluation-block__header h3 {
  margin: 0;
}

.model-evaluation-block__header span {
  color: var(--muted);
  font-size: 13px;
  font-weight: 760;
}

.model-evaluation-table-wrap {
  overflow-x: auto;
}

.model-evaluation-table {
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;
}

.model-evaluation-table--compact {
  min-width: 760px;
}

.model-evaluation-table th,
.model-evaluation-table td {
  padding: 12px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
}

.model-evaluation-table td {
  color: #344054;
  font-weight: 640;
}

.model-evaluation-table td:first-child {
  color: var(--text);
  font-weight: 760;
}

.model-evaluation-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  color: var(--blue);
  padding: 0;
  font-weight: 800;
}

.model-evaluation-compare-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.model-evaluation-compare-controls label {
  display: grid;
  gap: 6px;
}

.model-evaluation-compare-controls select {
  min-height: 40px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: #fff;
  color: var(--text);
  padding: 0 10px;
}

.model-evaluation-state {
  min-height: 118px;
}

.model-evaluation-muted {
  color: var(--muted);
  font-weight: 680;
}

.is-positive {
  color: var(--green) !important;
}

.is-negative {
  color: var(--red) !important;
}

@media (max-width: 960px) {
  .model-evaluation-metrics,
  .model-evaluation-delta-grid,
  .model-evaluation-compare-controls {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .model-evaluation-metrics,
  .model-evaluation-delta-grid,
  .model-evaluation-compare-controls {
    grid-template-columns: 1fr;
  }
}
</style>

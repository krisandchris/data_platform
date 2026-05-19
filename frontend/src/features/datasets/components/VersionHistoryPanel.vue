<template>
  <section class="panel version-history-panel overview-grid" data-testid="version-history-panel">
    <div class="panel__header">
      <h2 class="panel__title">版本历史</h2>
      <button class="button" type="button" :disabled="loading || diffLoading" @click="reload">
        <RefreshCw :size="17" />
        刷新
      </button>
    </div>

    <div class="panel__body version-history-panel__body">
      <div v-if="loading && !hasLoaded" class="loading-state" data-testid="version-history-loading">
        正在加载版本历史
      </div>
      <div v-else-if="error" class="error-state" data-testid="version-history-error">
        版本历史暂不可用：{{ error }}
      </div>
      <div v-else-if="snapshots.length === 0" class="empty-state" data-testid="version-history-empty">
        暂无版本快照
      </div>

      <template v-else>
        <section class="version-history-block">
          <div class="version-history-block__header">
            <h3>快照时间线</h3>
            <span>{{ snapshots.length }} 个快照</span>
          </div>
          <div class="version-history-timeline">
            <article v-for="snapshot in snapshots" :key="snapshot.snapshotId">
              <div class="version-history-timeline__marker" aria-hidden="true" />
              <div class="version-history-timeline__content">
                <div class="version-history-timeline__title">
                  <strong>{{ formatSnapshotType(snapshot.snapshotType) }}</strong>
                  <span>{{ formatDate(snapshot.createdAt) }}</span>
                </div>
                <dl>
                  <div>
                    <dt>快照 ID</dt>
                    <dd>{{ snapshot.snapshotId }}</dd>
                  </div>
                  <div>
                    <dt>样本</dt>
                    <dd>{{ snapshot.sampleId || '批次级' }}</dd>
                  </div>
                  <div>
                    <dt>标签配置版本</dt>
                    <dd>{{ snapshot.labelConfigVersion || '未记录' }}</dd>
                  </div>
                  <div>
                    <dt>来源</dt>
                    <dd>{{ sourceText(snapshot) }}</dd>
                  </div>
                  <div>
                    <dt>载荷哈希</dt>
                    <dd>{{ snapshot.payloadHash || '未记录' }}</dd>
                  </div>
                </dl>
                <button class="button version-history-rollback" type="button" disabled>
                  <RotateCcw :size="16" />
                  回滚需通过精确恢复校验后启用
                </button>
              </div>
            </article>
          </div>
        </section>

        <section class="version-history-block" data-testid="snapshot-diff-panel">
          <div class="version-history-block__header">
            <h3>快照对比</h3>
            <GitCompareArrows :size="18" />
          </div>

          <div v-if="snapshots.length < 2" class="empty-state version-history-state" data-testid="snapshot-diff-empty">
            至少需要两个版本快照才能对比
          </div>
          <template v-else>
            <div class="version-history-diff-controls">
              <label>
                <span>基准快照</span>
                <select v-model="leftSnapshotId" data-testid="snapshot-left-select" @change="loadDiff">
                  <option v-for="snapshot in snapshots" :key="snapshot.snapshotId" :value="snapshot.snapshotId">
                    {{ snapshotOptionLabel(snapshot) }}
                  </option>
                </select>
              </label>
              <label>
                <span>对比快照</span>
                <select v-model="rightSnapshotId" data-testid="snapshot-right-select" @change="loadDiff">
                  <option v-for="snapshot in snapshots" :key="snapshot.snapshotId" :value="snapshot.snapshotId">
                    {{ snapshotOptionLabel(snapshot) }}
                  </option>
                </select>
              </label>
            </div>

            <div v-if="!diffReady" class="empty-state version-history-state" data-testid="snapshot-diff-same">
              请选择两个不同的版本快照
            </div>
            <div v-else-if="diffLoading" class="loading-state version-history-state">正在计算快照差异</div>
            <div v-else-if="diffError" class="error-state version-history-state" data-testid="snapshot-diff-error">
              快照对比暂不可用：{{ diffError }}
            </div>
            <template v-else-if="diff">
              <div class="version-history-diff-metrics" data-testid="snapshot-diff-result">
                <div>
                  <span>字段变更</span>
                  <strong>{{ diff.changedFieldCount }}</strong>
                </div>
                <div>
                  <span>关系变更</span>
                  <strong>{{ diff.changedRelationCount }}</strong>
                </div>
                <div>
                  <span>候选变更</span>
                  <strong>{{ diff.changedCandidateCount }}</strong>
                </div>
                <div>
                  <span>回滚状态</span>
                  <strong>{{ diff.rollbackAvailable ? '可用' : '待校验' }}</strong>
                </div>
              </div>

              <div class="version-history-diff-grid">
                <section>
                  <h4>字段变更</h4>
                  <div v-if="diff.changedFields.length === 0" class="version-history-muted">暂无字段变更</div>
                  <div v-else class="version-history-diff-list">
                    <article v-for="item in diff.changedFields" :key="`${item.field}-${item.changeType ?? ''}`">
                      <strong>{{ item.label || item.field }}</strong>
                      <span>{{ formatChangeType(item.changeType) }}</span>
                      <p>{{ formatValue(item.before) }} 到 {{ formatValue(item.after) }}</p>
                    </article>
                  </div>
                </section>
                <section>
                  <h4>关系变更</h4>
                  <div v-if="relationDiffItems.length === 0" class="version-history-muted">暂无关系变更</div>
                  <div v-else class="version-history-diff-list">
                    <article v-for="item in relationDiffItems" :key="`${item.field}-${item.changeType ?? ''}`">
                      <strong>{{ item.label || item.field }}</strong>
                      <span>{{ formatChangeType(item.changeType) }}</span>
                      <p>{{ formatValue(item.before) }} 到 {{ formatValue(item.after) }}</p>
                    </article>
                  </div>
                </section>
                <section>
                  <h4>候选变更</h4>
                  <div v-if="candidateDiffItems.length === 0" class="version-history-muted">暂无候选变更</div>
                  <div v-else class="version-history-diff-list">
                    <article v-for="item in candidateDiffItems" :key="`${item.field}-${item.changeType ?? ''}`">
                      <strong>{{ item.label || item.field }}</strong>
                      <span>{{ formatChangeType(item.changeType) }}</span>
                      <p>{{ formatValue(item.before) }} 到 {{ formatValue(item.after) }}</p>
                    </article>
                  </div>
                </section>
              </div>
            </template>
            <div v-else class="empty-state version-history-state" data-testid="snapshot-diff-unavailable">
              暂无可展示的快照差异
            </div>
          </template>
        </section>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { GitCompareArrows, RefreshCw, RotateCcw } from 'lucide-vue-next';
import { apiClient } from '../../../services/urbanViolationApi';
import type {
  AnnotationSnapshot,
  AnnotationSnapshotDiff,
  AnnotationSnapshotFieldDiff,
} from '../../../shared/types/contract';

const props = defineProps<{
  datasetId: string;
}>();

const snapshots = ref<AnnotationSnapshot[]>([]);
const loading = ref(false);
const error = ref('');
const hasLoaded = ref(false);
const leftSnapshotId = ref('');
const rightSnapshotId = ref('');
const diff = ref<AnnotationSnapshotDiff>();
const diffLoading = ref(false);
const diffError = ref('');

const diffReady = computed(
  () => Boolean(leftSnapshotId.value && rightSnapshotId.value && leftSnapshotId.value !== rightSnapshotId.value),
);
const relationDiffItems = computed<AnnotationSnapshotFieldDiff[]>(() =>
  (diff.value?.relations ?? []).map((item) => ({
    ...item,
    label: `${item.relationIndex || item.relationId || '关系'} · ${item.label || item.field}`,
  })),
);
const candidateDiffItems = computed<AnnotationSnapshotFieldDiff[]>(() =>
  (diff.value?.candidates ?? []).map((item) => ({
    ...item,
    label: `${item.candidateIndex || item.candidateId || '候选'} · ${item.label || item.field}`,
  })),
);

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
  diff.value = undefined;
  diffError.value = '';
  try {
    const rows = await apiClient.listDatasetBatchSnapshots(props.datasetId);
    snapshots.value = [...rows].sort((left, right) => sortTime(right) - sortTime(left));
    ensureDiffDefaults();
    if (diffReady.value) {
      await loadDiff();
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败';
    snapshots.value = [];
  } finally {
    hasLoaded.value = true;
    loading.value = false;
  }
}

function ensureDiffDefaults() {
  if (snapshots.value.length >= 2) {
    rightSnapshotId.value = snapshots.value[0].snapshotId;
    leftSnapshotId.value = snapshots.value[1].snapshotId;
  } else {
    rightSnapshotId.value = snapshots.value[0]?.snapshotId ?? '';
    leftSnapshotId.value = '';
  }
}

async function loadDiff() {
  diff.value = undefined;
  diffError.value = '';
  if (!diffReady.value) {
    return;
  }
  diffLoading.value = true;
  try {
    diff.value = await apiClient.diffDatasetBatchSnapshots(props.datasetId, leftSnapshotId.value, rightSnapshotId.value);
  } catch (err) {
    diffError.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    diffLoading.value = false;
  }
}

function sortTime(snapshot: AnnotationSnapshot) {
  const value = Date.parse(snapshot.createdAt || '');
  return Number.isNaN(value) ? 0 : value;
}

function snapshotOptionLabel(snapshot: AnnotationSnapshot) {
  return `${formatSnapshotType(snapshot.snapshotType)} · ${snapshot.sampleId || snapshot.snapshotId}`;
}

function formatSnapshotType(value?: string) {
  const labels: Record<string, string> = {
    baseline: '导入基线',
    confirmed: '确认标注',
    model_preannotation: '模型预标注',
    export: '导出版本',
  };
  return value ? (labels[value] ?? value) : '未记录';
}

function formatDate(value?: string) {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function sourceText(snapshot: AnnotationSnapshot) {
  if (snapshot.sourceSubmissionId) return `提交 ${snapshot.sourceSubmissionId}`;
  if (snapshot.sourceExportId) return `导出 ${snapshot.sourceExportId}`;
  if (snapshot.sourceModelVersion) return `模型 ${snapshot.sourceModelVersion}`;
  if (snapshot.sourceEvaluationId) return `评估 ${snapshot.sourceEvaluationId}`;
  return snapshot.createdBy ? `创建人 ${snapshot.createdBy}` : '未记录';
}

function formatChangeType(value?: string) {
  const labels: Record<string, string> = {
    add: '新增',
    added: '新增',
    delete: '删除',
    deleted: '删除',
    replace: '替换',
    update: '更新',
    modified: '修改',
  };
  return value ? (labels[value] ?? value) : '变更';
}

function formatValue(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return '空';
  }
  if (Array.isArray(value)) {
    return `[${value.join(', ')}]`;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
</script>

<style scoped>
.version-history-panel__body {
  display: grid;
  gap: 16px;
}

.version-history-block {
  display: grid;
  gap: 14px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
}

.version-history-block__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.version-history-block__header h3,
.version-history-diff-grid h4 {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
}

.version-history-block__header span {
  color: var(--muted);
  font-size: 13px;
  font-weight: 760;
}

.version-history-timeline {
  display: grid;
  gap: 12px;
}

.version-history-timeline article {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  gap: 12px;
}

.version-history-timeline__marker {
  width: 12px;
  height: 12px;
  margin-top: 8px;
  border: 3px solid #fff;
  border-radius: 999px;
  background: var(--blue);
  box-shadow: 0 0 0 1px var(--line-strong);
}

.version-history-timeline__content {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-subtle);
}

.version-history-timeline__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.version-history-timeline__title strong {
  color: var(--text);
  font-size: 16px;
}

.version-history-timeline__title span {
  color: var(--muted);
  font-weight: 720;
}

.version-history-timeline dl {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
}

.version-history-timeline dt,
.version-history-diff-metrics span,
.version-history-diff-controls span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.version-history-timeline dd {
  margin: 4px 0 0;
  overflow-wrap: anywhere;
  color: #344054;
  font-weight: 700;
}

.version-history-rollback {
  justify-self: start;
  color: var(--muted);
}

.version-history-diff-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.version-history-diff-controls label {
  display: grid;
  gap: 6px;
}

.version-history-diff-controls select {
  min-height: 40px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: #fff;
  color: var(--text);
  padding: 0 10px;
}

.version-history-state {
  min-height: 118px;
}

.version-history-diff-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.version-history-diff-metrics > div {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-subtle);
}

.version-history-diff-metrics strong {
  color: var(--text);
  font-size: 20px;
  line-height: 1.2;
}

.version-history-diff-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.version-history-diff-grid section {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.version-history-diff-list {
  display: grid;
  gap: 8px;
}

.version-history-diff-list article {
  display: grid;
  gap: 5px;
  min-width: 0;
  padding: 10px;
  border-radius: 8px;
  background: var(--panel-subtle);
}

.version-history-diff-list strong,
.version-history-diff-list p {
  overflow-wrap: anywhere;
}

.version-history-diff-list strong {
  color: var(--text);
}

.version-history-diff-list span {
  color: var(--blue);
  font-size: 12px;
  font-weight: 800;
}

.version-history-diff-list p {
  margin: 0;
  color: #344054;
  font-weight: 640;
}

.version-history-muted {
  color: var(--muted);
  font-weight: 680;
}

@media (max-width: 1120px) {
  .version-history-timeline dl,
  .version-history-diff-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .version-history-timeline dl,
  .version-history-diff-controls,
  .version-history-diff-metrics,
  .version-history-diff-grid {
    grid-template-columns: 1fr;
  }
}
</style>

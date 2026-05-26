<template>
  <div class="review-page">
    <div v-if="initialLoading && !detail" class="loading-state">正在加载质检样本...</div>
    <div v-else-if="error && !detail" class="error-state">{{ error }}</div>
    <div v-else-if="detail" class="review-refresh-frame" :class="{ 'is-refreshing': refreshing }">
      <ReviewWorkbenchShell
        :detail="detail"
        :queue-items="queue"
        :label-config="activeLabelConfig"
        :label-config-missing="Boolean(labelConfigError)"
        :label-config-gate-message="labelConfigError"
        :label-suggestions="labelSuggestions"
        :request-label-suggestions="requestLabelSuggestions"
        :validate-label-edit="validateLabelEdit"
        :batch-draft="batchDraft"
        :save-batch-draft="saveBatchDraft"
        :autosave-batch-draft="autosaveBatchDraft"
        :submit-batch-label-edits="submitBatchLabelEdits"
        :current-user="detail.currentUser"
        :batch-assignment="detail.batchAssignment"
        :qc-task="detail.qcTask"
        :sample-lease="detail.sampleLease"
        :readonly-reason="readonlyReason"
        :suppress-readonly-warning="refreshing"
        :release-sample-lease="releaseCurrentLease"
        :is-switching-sample="refreshing"
        :switch-error="refreshError"
      />
    </div>
    <div v-else class="empty-state">后端未返回质检样本详情。</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { apiClient } from '../../services/urbanViolationApi';
import type {
  BatchLabelEditDraft,
  BatchLabelEditDraftPayload,
  BatchLabelEditDraftSaveResult,
  BatchLabelEditSubmitPayload,
  BatchLabelEditSubmitResult,
  CurrentUser,
  LabelConfig,
  LabelEditPatchPayload,
  LabelSuggestion,
  QcQueueItem,
  ReviewSampleDetail,
  SampleLease,
} from '../../shared/types/contract';
import ReviewWorkbenchShell from './components/ReviewWorkbenchShell.vue';
import { useAuthState } from '../auth/authState';

const props = defineProps<{
  id: string;
  sampleId: string;
}>();

const detail = ref<ReviewSampleDetail>();
const queue = ref<QcQueueItem[]>([]);
const activeLabelConfig = ref<LabelConfig>();
const batchDraft = ref<BatchLabelEditDraft>();
const labelConfigError = ref('');
const labelSuggestions = ref<Record<string, string[]>>({});
const initialLoading = ref(true);
const refreshing = ref(false);
const error = ref<string>();
const refreshError = ref('');
const { loadCurrentUser } = useAuthState();
let requestSequence = 0;
let heartbeatTimer: number | undefined;

interface ReleaseSampleLeaseOptions {
  preserveDisplayedLease?: boolean;
}

const readonlyReason = computed(() => {
  const reviewDetail = detail.value;
  const currentUser = reviewDetail?.currentUser;
  const assignment = reviewDetail?.batchAssignment;
  const lease = reviewDetail?.sampleLease;
  if (!reviewDetail) return '';
  if (!assignment || assignment.status === 'revoked') {
    return '该批次尚未分配，需批次管理员或质检负责人先分配后才能编辑';
  }
  if (!currentUser) {
    return '未读取到当前用户，当前样本只读';
  }
  if (assignment.assigneeUserId !== currentUser.userId) {
    return `该批次已分配给 ${assignment.assigneeDisplayName || assignment.assigneeUserId}`;
  }
  if (!hasEditableLease(lease, currentUser.userId)) {
    return '未持有有效样本锁，当前样本只读';
  }
  return '';
});

const loadInitial = async () => {
  const sequence = ++requestSequence;
  initialLoading.value = true;
  refreshing.value = false;
  error.value = undefined;
  refreshError.value = '';
  try {
    const [currentUser, reviewDetail, queueItems, labelContext, batchDraftContext] = await Promise.all([
      loadCurrentUser(),
      apiClient.getReviewSample(props.id, props.sampleId),
      apiClient.listQcQueue(props.id),
      loadLabelContext(props.id),
      loadBatchDraftContext(props.id),
    ]);
    if (sequence !== requestSequence) {
      return;
    }
    detail.value = await hydrateEditableContext(reviewDetail, currentUser);
    queue.value = queueItems;
    activeLabelConfig.value = labelContext.config;
    batchDraft.value = batchDraftContext;
    labelConfigError.value = labelContext.error ?? '';
    labelSuggestions.value = labelContext.suggestions;
  } catch (err) {
    if (sequence !== requestSequence) {
      return;
    }
    error.value = err instanceof Error ? err.message : '无法加载质检样本';
    refreshError.value = error.value;
  } finally {
    if (sequence === requestSequence) {
      initialLoading.value = false;
      refreshing.value = false;
    }
  }
};

const refreshSample = async () => {
  const sequence = ++requestSequence;
  if (!detail.value) {
    initialLoading.value = true;
  } else {
    refreshing.value = true;
  }
  error.value = undefined;
  refreshError.value = '';
  try {
    const currentUser = await loadCurrentUser();
    const reviewDetail = await apiClient.getReviewSample(props.id, props.sampleId);
    if (sequence !== requestSequence) {
      return;
    }
    detail.value = await hydrateEditableContext(reviewDetail, currentUser);
  } catch (err) {
    if (sequence !== requestSequence) {
      return;
    }
    error.value = err instanceof Error ? err.message : '无法加载质检样本';
    refreshError.value = detail.value ? error.value : '';
  } finally {
    if (sequence === requestSequence) {
      initialLoading.value = false;
      refreshing.value = false;
    }
  }
};

const validateLabelEdit = (payload: LabelEditPatchPayload) =>
  apiClient.validateLabelEdit(props.id, props.sampleId, withLeaseContext(payload));

const saveBatchDraft = async (payload: BatchLabelEditDraftPayload): Promise<BatchLabelEditDraftSaveResult> => {
  const result = await apiClient.saveMyBatchLabelEditDraft(props.id, payload);
  applyBatchDraftSaveResult(result, payload);
  return result;
};

const autosaveBatchDraft = async (payload: BatchLabelEditDraftPayload): Promise<BatchLabelEditDraftSaveResult> => {
  const result = await apiClient.autosaveMyBatchLabelEditDraft(props.id, payload);
  applyBatchDraftSaveResult(result, payload);
  return result;
};

const submitBatchLabelEdits = async (
  payload: BatchLabelEditSubmitPayload,
): Promise<BatchLabelEditSubmitResult> => {
  const result = await apiClient.submitBatchLabelEdits(props.id, payload);
  await releaseCurrentLease();
  if (detail.value && result.assignment) {
    detail.value = {
      ...detail.value,
      batchAssignment: result.assignment,
    };
  }
  return result;
};

async function hydrateEditableContext(
  reviewDetail: ReviewSampleDetail,
  currentUser: CurrentUser | undefined,
): Promise<ReviewSampleDetail> {
  const nextDetail: ReviewSampleDetail = {
    ...reviewDetail,
    currentUser: reviewDetail.currentUser ?? currentUser,
  };
  const assignment = nextDetail.batchAssignment;
  const existingLease = nextDetail.sampleLease;
  if (
    currentUser &&
    assignment?.assigneeUserId === currentUser.userId &&
    assignment.status !== 'revoked' &&
    !hasEditableLease(existingLease, currentUser.userId)
  ) {
    try {
      nextDetail.sampleLease = await apiClient.acquireSampleLease(props.id, props.sampleId);
    } catch {
      nextDetail.sampleLease = existingLease;
    }
  }
  startHeartbeat(nextDetail.sampleLease);
  try {
    nextDetail.myDraft = nextDetail.myDraft ?? await apiClient.getMyLabelEditDraft(props.id, props.sampleId);
  } catch {
    // Draft is optional; conflicts must not wipe the local in-page draft.
  }
  return nextDetail;
}

function withLeaseContext<T extends LabelEditPatchPayload>(payload: T): T {
  return {
    ...payload,
    leaseId: detail.value?.sampleLease?.leaseId,
    baseRevision: detail.value?.qcTask?.taskRevision,
  };
}

function startHeartbeat(lease: SampleLease | undefined) {
  stopHeartbeat();
  if (!lease || lease.status !== 'active' || leaseExpired(lease)) {
    return;
  }
  heartbeatTimer = window.setInterval(async () => {
    try {
      const nextLease = await apiClient.heartbeatSampleLease(props.id, props.sampleId, lease.leaseId);
      if (detail.value && detail.value.asset.sampleId === props.sampleId) {
        detail.value = { ...detail.value, sampleLease: nextLease };
      }
    } catch {
      stopHeartbeat();
    }
  }, 60_000);
}

function hasEditableLease(lease: SampleLease | undefined, userId: string) {
  return Boolean(lease && lease.status === 'active' && lease.userId === userId && !leaseExpired(lease));
}

function leaseExpired(lease: SampleLease) {
  if (!lease.expiresAt) {
    return false;
  }
  const expiresAt = new Date(lease.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

function stopHeartbeat() {
  if (heartbeatTimer !== undefined) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = undefined;
  }
}

async function releaseCurrentLease(options: ReleaseSampleLeaseOptions = {}) {
  const currentDetail = detail.value;
  const lease = currentDetail?.sampleLease;
  if (!lease || lease.status !== 'active' || leaseExpired(lease) || lease.userId !== currentDetail?.currentUser?.userId) {
    return;
  }
  stopHeartbeat();
  try {
    await apiClient.releaseSampleLease(props.id, currentDetail?.asset.sampleId ?? props.sampleId, lease.leaseId);
    if (detail.value && !options.preserveDisplayedLease) {
      detail.value = {
        ...detail.value,
        sampleLease: {
          ...lease,
          status: 'released',
        },
      };
    }
  } catch {
    // Release is best-effort on navigation/unload.
  }
}

async function loadLabelContext(datasetId: string): Promise<{
  config?: LabelConfig;
  suggestions: Record<string, string[]>;
  error?: string;
}> {
  try {
    const config = await apiClient.getActiveLabelConfig(datasetId);
    const suggestions = await preloadOpenTagSuggestions(datasetId, config);
    return { config, suggestions };
  } catch {
    return {
      suggestions: {},
      error: '请先上传并激活标签配置',
    };
  }
}

async function loadBatchDraftContext(datasetId: string): Promise<BatchLabelEditDraft> {
  try {
    return await apiClient.getMyBatchLabelEditDraft(datasetId);
  } catch {
    return {
      datasetId,
      savedSampleCount: 0,
      samples: [],
    };
  }
}

function applyBatchDraftSaveResult(result: BatchLabelEditDraftSaveResult, payload: BatchLabelEditDraftPayload) {
  if (result.draft) {
    batchDraft.value = result.draft;
    return;
  }
  const existingSamples = batchDraft.value?.samples ?? [];
  const savedSampleIds = new Set(result.sampleIds.length ? result.sampleIds : payload.entries.map((sample) => sample.sampleId));
  const incomingSamples = payload.entries.map((sample) =>
    savedSampleIds.has(sample.sampleId)
      ? {
          ...sample,
          dirty: false,
          saved: true,
        }
      : sample,
  );
  const incomingBySample = new Map(incomingSamples.map((sample) => [sample.sampleId, sample]));
  const mergedSamples = [
    ...existingSamples.filter((sample) => !incomingBySample.has(sample.sampleId)),
    ...incomingSamples,
  ];
  batchDraft.value = {
    ...(batchDraft.value ?? { datasetId: props.id, savedSampleCount: 0, samples: [] }),
    totalSampleCount: result.totalSampleCount ?? batchDraft.value?.totalSampleCount,
    savedSampleCount: result.savedSampleCount,
    samples: mergedSamples,
    updatedAt: result.updatedAt ?? new Date().toISOString(),
  };
}

async function preloadOpenTagSuggestions(datasetId: string, config: LabelConfig): Promise<Record<string, string[]>> {
  const openFields = config.fields
    .filter((field) => field.mode === 'open_tags')
    .map((field) => field.field);
  const entries = await Promise.all(
    openFields.map(async (field) => {
      try {
        const suggestions = await apiClient.getLabelSuggestions(datasetId, field, '');
        return [field, suggestionValues(suggestions)] as const;
      } catch {
        return [field, []] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

async function requestLabelSuggestions(field: string, query: string) {
  if (!activeLabelConfig.value) {
    return [];
  }
  try {
    const suggestions = suggestionValues(await apiClient.getLabelSuggestions(props.id, field, query));
    labelSuggestions.value = {
      ...labelSuggestions.value,
      [field]: suggestions,
    };
    return suggestions;
  } catch {
    return labelSuggestions.value[field] ?? [];
  }
}

function suggestionValues(suggestions: LabelSuggestion[]) {
  return Array.from(new Set(suggestions.map((item) => item.value).filter(Boolean)));
}

onMounted(loadInitial);
onBeforeUnmount(() => {
  void releaseCurrentLease();
});

window.addEventListener?.('beforeunload', () => {
  void releaseCurrentLease();
});

watch(
  () => [props.id, props.sampleId],
  ([datasetId], [previousDatasetId]) => {
    if (datasetId !== previousDatasetId) {
      void loadInitial();
      return;
    }
    void refreshSample();
  },
);
</script>

<style scoped>
.review-page {
  min-width: 0;
}

.review-refresh-frame {
  position: relative;
  display: grid;
}

.review-refresh-frame.is-refreshing {
  cursor: progress;
}
</style>

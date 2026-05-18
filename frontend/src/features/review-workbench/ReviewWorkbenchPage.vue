<template>
  <div class="review-page">
    <div v-if="initialLoading && !detail" class="loading-state">Loading review sample...</div>
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
        :submit-label-edit="submitLabelEdit"
      />
    </div>
    <div v-else class="empty-state">No review detail returned by the backend.</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { apiClient } from '../../services/urbanViolationApi';
import type {
  LabelConfig,
  LabelEditPatchPayload,
  LabelEditSubmitPayload,
  LabelSuggestion,
  QcQueueItem,
  ReviewSampleDetail,
} from '../../shared/types/contract';
import ReviewWorkbenchShell from './components/ReviewWorkbenchShell.vue';

const props = defineProps<{
  id: string;
  sampleId: string;
}>();

const detail = ref<ReviewSampleDetail>();
const queue = ref<QcQueueItem[]>([]);
const activeLabelConfig = ref<LabelConfig>();
const labelConfigError = ref('');
const labelSuggestions = ref<Record<string, string[]>>({});
const initialLoading = ref(true);
const refreshing = ref(false);
const error = ref<string>();
let requestSequence = 0;

const loadInitial = async () => {
  const sequence = ++requestSequence;
  initialLoading.value = true;
  refreshing.value = false;
  error.value = undefined;
  try {
    const [reviewDetail, queueItems, labelContext] = await Promise.all([
      apiClient.getReviewSample(props.id, props.sampleId),
      apiClient.listQcQueue(props.id),
      loadLabelContext(props.id),
    ]);
    if (sequence !== requestSequence) {
      return;
    }
    detail.value = reviewDetail;
    queue.value = queueItems;
    activeLabelConfig.value = labelContext.config;
    labelConfigError.value = labelContext.error ?? '';
    labelSuggestions.value = labelContext.suggestions;
  } catch (err) {
    if (sequence !== requestSequence) {
      return;
    }
    error.value = err instanceof Error ? err.message : 'Unable to load review sample';
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
  try {
    const reviewDetail = await apiClient.getReviewSample(props.id, props.sampleId);
    if (sequence !== requestSequence) {
      return;
    }
    detail.value = reviewDetail;
  } catch (err) {
    if (sequence !== requestSequence) {
      return;
    }
    error.value = err instanceof Error ? err.message : 'Unable to load review sample';
  } finally {
    if (sequence === requestSequence) {
      initialLoading.value = false;
      refreshing.value = false;
    }
  }
};

const validateLabelEdit = (payload: LabelEditPatchPayload) =>
  apiClient.validateLabelEdit(props.id, props.sampleId, payload);

const submitLabelEdit = (payload: LabelEditSubmitPayload) =>
  apiClient.submitLabelEdit(props.id, props.sampleId, payload);

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

<template>
  <div>
    <header class="page-header">
      <div>
        <h1 class="page-title">预标注运行</h1>
        <p class="page-subtitle">Stage1 scene relations and Stage2 fact verification contract surface.</p>
      </div>
    </header>

    <div v-if="loading" class="loading-state">Loading preannotations...</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>
    <template v-else-if="summary">
      <section class="grid grid--three">
        <div class="panel">
          <div class="panel__header">
            <h2 class="panel__title">STEP1</h2>
          </div>
          <dl class="summary-list">
            <div>
              <dt>succeeded</dt>
              <dd>{{ summary.stage1.succeeded }}</dd>
            </div>
            <div>
              <dt>failed</dt>
              <dd>{{ summary.stage1.failed }}</dd>
            </div>
            <div>
              <dt>bbox valid</dt>
              <dd>{{ summary.stage1.bboxValid }}</dd>
            </div>
          </dl>
        </div>
        <div class="panel">
          <div class="panel__header">
            <h2 class="panel__title">STEP2</h2>
          </div>
          <dl class="summary-list">
            <div>
              <dt>parsed</dt>
              <dd>{{ summary.stage2.parsed }}</dd>
            </div>
            <div>
              <dt>failures</dt>
              <dd>{{ summary.stage2.failures }}</dd>
            </div>
            <div>
              <dt>candidates</dt>
              <dd>{{ summary.stage2.candidateCount }}</dd>
            </div>
          </dl>
        </div>
        <DistributionPanel title="Verification Results" :items="summary.verificationDistribution" />
      </section>

      <section class="grid grid--two preannotation-grid">
        <DistributionPanel title="Violation Categories" :items="summary.categoryDistribution" />
        <div class="panel">
          <div class="panel__header">
            <h2 class="panel__title">Contract Fields</h2>
          </div>
          <div class="panel__body field-list">
            <StatusChip value="ready" label="stage1.key_relations[].bbox" />
            <StatusChip value="ready" label="stage2.fact_verifications[]" />
            <StatusChip value="ready" label="stage2.candidates[]" />
            <StatusChip value="stage2_failed" label="stage2Failure" />
          </div>
        </div>
      </section>
    </template>
    <div v-else class="empty-state">No preannotation summary returned by the backend.</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { apiClient } from '../../services/urbanViolationApi';
import StatusChip from '../../shared/components/StatusChip.vue';
import { useAsyncState } from '../../shared/composables/useAsyncState';
import DistributionPanel from './components/DistributionPanel.vue';

const props = defineProps<{ id: string }>();
const { data, loading, error } = useAsyncState(() => apiClient.getDatasetBatchPreannotationSummary(props.id), {
  watch: () => props.id,
  resetOnExecute: true,
});
const summary = computed(() => data.value);
</script>

<style scoped>
.summary-list {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 18px;
}

.summary-list div {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 1px solid var(--line);
  padding-bottom: 10px;
}

.summary-list dt {
  color: var(--muted);
  font-weight: 700;
}

.summary-list dd {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
}

.preannotation-grid {
  margin-top: 14px;
}

.field-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>

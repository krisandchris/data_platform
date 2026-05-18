<template>
  <div>
    <header class="page-header">
      <div>
        <h1 class="page-title">质检工作台</h1>
        <p class="page-subtitle">QC queue shell for dataset {{ id }}.</p>
      </div>
    </header>

    <div v-if="loading" class="loading-state">Loading QC queue...</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>
    <section v-else class="panel">
      <div class="panel__header">
        <h2 class="panel__title">QC Queue</h2>
        <span class="muted">{{ queue.length }} samples</span>
      </div>
      <div v-if="queue.length === 0" class="empty-state">No QC queue items returned by the backend.</div>
      <div class="queue-grid">
        <RouterLink
          v-for="item in queue"
          :key="item.sampleId"
          class="queue-card"
          :to="`/datasets/${id}/samples/${item.sampleId}/review`"
        >
          <strong>{{ item.sampleId }}</strong>
          <StatusChip :value="item.stage2Failure ? 'stage2_failed' : item.status" />
          <span>{{ item.primaryCategory ?? 'uncategorized' }}</span>
        </RouterLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { apiClient } from '../../services/urbanViolationApi';
import StatusChip from '../../shared/components/StatusChip.vue';
import { useAsyncState } from '../../shared/composables/useAsyncState';

const props = defineProps<{ id: string }>();
const { data, loading, error } = useAsyncState(() => apiClient.listQcQueue(props.id));
const queue = computed(() => data.value ?? []);
</script>

<style scoped>
.queue-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 16px;
}

.queue-card {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-subtle);
}

.queue-card:hover {
  border-color: var(--blue);
}

.queue-card strong,
.queue-card span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-card span:last-child {
  color: var(--muted);
}

@media (max-width: 980px) {
  .queue-grid {
    grid-template-columns: 1fr;
  }
}
</style>

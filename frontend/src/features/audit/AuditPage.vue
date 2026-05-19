<template>
  <div>
    <header class="page-header">
      <div>
        <h1 class="page-title">审计与批次进度</h1>
        <p class="page-subtitle">按 dataset、sample、actor、action 过滤事件，并查看批次任务状态分布。</p>
      </div>
    </header>

    <div class="audit-grid">
      <section class="panel">
        <div class="panel__header">
          <h2 class="panel__title">进度</h2>
          <button type="button" @click="load">刷新</button>
        </div>
        <div v-if="progress" class="progress-grid">
          <article v-for="(count, status) in progress.byStatus" :key="status">
            <span>{{ status }}</span>
            <strong>{{ count }}</strong>
          </article>
        </div>
        <div v-if="progress?.byUser.length" class="user-progress">
          <article v-for="row in progress.byUser" :key="row.userId">
            <strong>{{ row.displayName || row.userId }}</strong>
            <span>草稿 {{ row.draftSaved }} · 提交 {{ row.submitted }} · 退回 {{ row.returned }} · 确认 {{ row.confirmed }}</span>
          </article>
        </div>
      </section>

      <section class="panel">
        <div class="panel__header">
          <h2 class="panel__title">审计事件</h2>
          <span class="muted">{{ events.length }} events</span>
        </div>
        <form class="filters" @submit.prevent="load">
          <input v-model="filters.datasetId" placeholder="dataset_id" />
          <input v-model="filters.sampleId" placeholder="sample_id" />
          <input v-model="filters.actorUserId" placeholder="actor_user_id" />
          <input v-model="filters.action" placeholder="action" />
          <button type="submit">过滤</button>
        </form>
        <div v-if="loading" class="loading-state">Loading audit events...</div>
        <div v-else-if="error" class="error-state">{{ error }}</div>
        <div v-else class="event-list">
          <article v-for="event in events" :key="event.eventId" class="event-row">
            <div>
              <strong>{{ event.action }}</strong>
              <span>{{ event.entityType }} · {{ event.entityId }}</span>
            </div>
            <span>{{ event.actorDisplayName || event.actorUserId }}</span>
            <span>{{ event.sampleId || event.datasetId || '-' }}</span>
            <time>{{ event.createdAt }}</time>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { apiClient } from '../../services/urbanViolationApi';
import type { AuditEvent, AuditEventFilters, QcProgress } from '../../shared/types/contract';

const defaultDatasetId = 'urban_violation__0508_fixture';
const filters = reactive<AuditEventFilters>({
  datasetId: defaultDatasetId,
});
const events = ref<AuditEvent[]>([]);
const progress = ref<QcProgress>();
const loading = ref(true);
const error = ref('');

onMounted(load);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [nextEvents, nextProgress] = await Promise.all([
      apiClient.listAuditEvents(filters),
      apiClient.getQcProgress(filters.datasetId || defaultDatasetId),
    ]);
    events.value = nextEvents;
    progress.value = nextProgress;
  } catch (err) {
    error.value = err instanceof Error ? err.message : '无法加载审计事件';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.audit-grid {
  display: grid;
  grid-template-columns: minmax(300px, 0.45fr) minmax(0, 1fr);
  gap: 16px;
}

.panel__header button,
.filters button {
  min-height: 34px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--blue);
  color: #fff;
  padding: 0 12px;
  font-weight: 900;
}

.progress-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 14px;
}

.progress-grid article,
.user-progress article,
.event-row {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-subtle);
  padding: 10px;
}

.progress-grid article {
  display: grid;
  gap: 4px;
}

.progress-grid span,
.user-progress span,
.event-row span,
.event-row time {
  color: var(--muted);
  font-size: 12px;
}

.user-progress,
.event-list {
  display: grid;
  gap: 8px;
  padding: 0 14px 14px;
}

.filters {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  padding: 14px;
}

.filters input {
  min-height: 34px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0 10px;
}

.event-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 150px 180px 220px;
  gap: 10px;
  align-items: center;
}

.event-row div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

@media (max-width: 1100px) {
  .audit-grid,
  .filters,
  .event-row {
    grid-template-columns: 1fr;
  }
}
</style>

<template>
  <section class="panel distribution-panel">
    <div class="panel__header">
      <h2 class="panel__title">{{ title }}</h2>
    </div>
    <div class="panel__body distribution-panel__body">
      <div v-for="item in items" :key="item.key" class="distribution-row">
        <div>
          <span>{{ item.label }}</span>
          <strong>{{ item.count }}</strong>
        </div>
        <div class="distribution-row__bar" aria-hidden="true">
          <span :style="{ width: `${Math.max(item.ratio * 100, 2)}%` }" />
        </div>
        <small>{{ (item.ratio * 100).toFixed(2) }}%</small>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CountDistribution } from '../../../shared/types/contract';

defineProps<{
  title: string;
  items: CountDistribution[];
}>();
</script>

<style scoped>
.distribution-panel__body {
  display: grid;
  gap: 14px;
}

.distribution-row {
  display: grid;
  grid-template-columns: minmax(130px, 0.8fr) minmax(120px, 1fr) 64px;
  gap: 12px;
  align-items: center;
}

.distribution-row div:first-child {
  min-width: 0;
}

.distribution-row span,
.distribution-row strong {
  display: block;
}

.distribution-row span {
  overflow: hidden;
  color: #344054;
  font-weight: 680;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.distribution-row strong {
  color: var(--text);
}

.distribution-row__bar {
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: #edf3fb;
}

.distribution-row__bar span {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #1264ff, #37b24d);
}

.distribution-row small {
  color: var(--muted);
  text-align: right;
}
</style>

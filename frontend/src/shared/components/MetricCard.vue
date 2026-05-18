<template>
  <article class="metric-card">
    <div class="metric-card__icon" :class="`metric-card__icon--${tone}`">
      <slot name="icon" />
    </div>
    <div>
      <p class="metric-card__label">{{ label }}</p>
      <strong class="metric-card__value">{{ value }}</strong>
      <span class="metric-card__detail">{{ detail }}</span>
    </div>
  </article>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    value: string | number;
    detail?: string;
    tone?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
  }>(),
  {
    detail: '',
    tone: 'blue',
  },
);
</script>

<style scoped>
.metric-card {
  display: grid;
  min-height: 132px;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  padding: 22px 18px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  box-shadow: var(--shadow-sm);
}

.metric-card__icon {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 8px;
}

.metric-card__icon--blue {
  background: var(--blue-soft);
  color: var(--blue);
}

.metric-card__icon--green {
  background: var(--green-soft);
  color: var(--green);
}

.metric-card__icon--orange {
  background: var(--orange-soft);
  color: var(--orange);
}

.metric-card__icon--red {
  background: var(--red-soft);
  color: var(--red);
}

.metric-card__icon--purple {
  background: var(--purple-soft);
  color: var(--purple);
}

.metric-card__label {
  margin: 0 0 4px;
  color: #344054;
  font-weight: 700;
}

.metric-card__value {
  display: block;
  font-size: 28px;
  line-height: 1.15;
}

.metric-card__detail {
  display: block;
  margin-top: 16px;
  color: var(--muted);
  font-size: 13px;
}
</style>

<template>
  <span class="status-chip" :class="`status-chip--${tone}`">
    <span class="status-chip__dot" />
    {{ label }}
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{
  value: string;
  label?: string;
}>();

const label = props.label ?? props.value;
const tone =
  props.value.includes('fail') || props.value === 'rejected'
    ? 'red'
    : props.value.includes('soft') ||
        props.value.includes('pending') ||
        props.value.includes('review') ||
        props.value === 'needs_changes'
      ? 'orange'
      : props.value.includes('pass') ||
          props.value.includes('ready') ||
          props.value.includes('success') ||
          props.value === 'approved'
        ? 'green'
        : props.value.includes('manual')
          ? 'purple'
          : 'blue';
</script>

<style scoped>
.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
  max-width: 100%;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 750;
  white-space: nowrap;
}

.status-chip__dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
}

.status-chip--green {
  background: var(--green-soft);
  color: var(--green);
}

.status-chip--orange {
  background: var(--orange-soft);
  color: #c65d00;
}

.status-chip--red {
  background: var(--red-soft);
  color: var(--red);
}

.status-chip--purple {
  background: var(--purple-soft);
  color: var(--purple);
}

.status-chip--blue {
  background: var(--blue-soft);
  color: var(--blue);
}
</style>

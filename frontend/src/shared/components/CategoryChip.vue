<template>
  <span class="category-chip" :title="value">{{ displayValue }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  value: string;
}>();

const displayValue = computed(() => props.value.replaceAll('_', ' '));
</script>

<style scoped>
.category-chip {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  max-width: 100%;
  padding: 0 10px;
  border: 1px solid #cfe0fb;
  border-radius: 999px;
  background: #f5f9ff;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 720;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

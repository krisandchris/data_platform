<template>
  <section class="grid grid--metrics" aria-label="Dataset metrics">
    <MetricCard label="Raw Images" :value="summary.totals.rawAssets" detail="total" tone="blue">
      <template #icon><Image :size="24" /></template>
    </MetricCard>
    <MetricCard label="STEP1 Parsed" :value="summary.totals.stage1Parsed" detail="parsed records" tone="blue">
      <template #icon><FileCheck2 :size="24" /></template>
    </MetricCard>
    <MetricCard
      label="STEP2 Parsed"
      :value="summary.totals.stage2Parsed"
      :detail="`${percent(summary.coverage.stage2)} coverage`"
      tone="green"
    >
      <template #icon><FileCog :size="24" /></template>
    </MetricCard>
    <MetricCard
      label="STEP2 Failures"
      :value="summary.totals.stage2Failures"
      :detail="`${percent(1 - summary.coverage.stage2)} of raw assets`"
      tone="red"
    >
      <template #icon><TriangleAlert :size="24" /></template>
    </MetricCard>
    <MetricCard label="STEP1 Coverage" :value="percent(summary.coverage.stage1)" detail="bbox validation" tone="purple">
      <template #icon><ScanSearch :size="24" /></template>
    </MetricCard>
    <MetricCard label="STEP2 Coverage" :value="percent(summary.coverage.stage2)" detail="parsed coverage" tone="orange">
      <template #icon><Gauge :size="24" /></template>
    </MetricCard>
  </section>
</template>

<script setup lang="ts">
import { FileCheck2, FileCog, Gauge, Image, ScanSearch, TriangleAlert } from 'lucide-vue-next';
import MetricCard from '../../../shared/components/MetricCard.vue';
import type { DatasetSummary } from '../../../shared/types/contract';

defineProps<{
  summary: DatasetSummary;
}>();

const percent = (value: number) => `${(value * 100).toFixed(value === 1 ? 0 : 2)}%`;
</script>

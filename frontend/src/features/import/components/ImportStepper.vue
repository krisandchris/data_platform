<template>
  <ol class="import-stepper" aria-label="Import progress">
    <li v-for="(step, index) in steps" :key="step" :class="{ complete: index + 1 < activeStep, active: index + 1 === activeStep }">
      <span>{{ index + 1 }}</span>
      <strong>{{ step }}</strong>
    </li>
  </ol>
</template>

<script setup lang="ts">
defineProps<{
  activeStep: number;
}>();

const steps = ['基础信息', '上传模式', '目录扫描', '导入预览', '完成'];
</script>

<style scoped>
.import-stepper {
  display: grid;
  grid-template-columns: repeat(5, minmax(110px, 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.import-stepper li {
  display: flex;
  align-items: center;
  min-height: 48px;
  gap: 10px;
  border-bottom: 2px solid var(--line-strong);
  color: var(--muted);
}

.import-stepper span {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: #fff;
  font-weight: 800;
}

.import-stepper .active,
.import-stepper .complete {
  border-color: var(--blue);
  color: var(--blue);
}

.import-stepper .active span,
.import-stepper .complete span {
  border-color: var(--blue);
  background: var(--blue);
  color: #fff;
}

@media (max-width: 860px) {
  .import-stepper {
    grid-template-columns: 1fr;
  }
}
</style>

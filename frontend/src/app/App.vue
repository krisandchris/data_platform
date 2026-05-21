<template>
  <RouterView v-if="isStandaloneRoute" />
  <AppShell v-else>
    <RouterView />
  </AppShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import AppShell from './layouts/AppShell.vue';

const route = useRoute();
const isStandaloneRoute = computed(() => route.name === 'login' || route.meta.standalone === true);
</script>

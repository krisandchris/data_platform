<template>
  <AppShell>
    <RouterView />
  </AppShell>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router';
import AppShell from './layouts/AppShell.vue';
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--review-focus': isReviewFocusRoute }">
    <aside v-if="!isReviewFocusRoute" class="sidebar" aria-label="Primary">
      <RouterLink class="brand" to="/datasets">
        <Database class="brand__mark" :size="28" />
        <span>城市治理数据平台</span>
      </RouterLink>

      <nav class="nav-list">
        <RouterLink class="nav-item" to="/datasets">
          <Layers :size="18" />
          <span>数据集</span>
        </RouterLink>
        <RouterLink class="nav-item" to="/datasets/urban_violation/assets">
          <Box :size="18" />
          <span>资产</span>
        </RouterLink>
        <RouterLink class="nav-item" to="/datasets/urban_violation/preannotations">
          <FileStack :size="18" />
          <span>预标注运行</span>
        </RouterLink>
        <RouterLink class="nav-item" to="/datasets/urban_violation/qc">
          <Bell :size="18" />
          <span>质检工作台</span>
        </RouterLink>
      </nav>

      <button class="sidebar-collapse" type="button" aria-label="Collapse sidebar">
        <PanelLeftClose :size="18" />
        <span>收起</span>
      </button>
    </aside>

    <div class="workspace">
      <header v-if="!isReviewFocusRoute" class="topbar">
        <label class="search-box">
          <Search :size="18" />
          <input type="search" placeholder="搜索图像、任务、运行、标签..." />
        </label>
        <div class="topbar-actions">
          <button class="icon-button" type="button" aria-label="Help">
            <CircleHelp :size="20" />
          </button>
          <button class="icon-button icon-button--alert" type="button" aria-label="Notifications">
            <Bell :size="20" />
            <span>3</span>
          </button>
          <div class="user-chip">
            <span class="avatar">张</span>
            <span>
              <strong>张伟</strong>
              <small>数据管理员</small>
            </span>
          </div>
        </div>
      </header>

      <main class="page-surface" :class="{ 'page-surface--review-focus': isReviewFocusRoute }">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import {
  Bell,
  Box,
  CircleHelp,
  Database,
  FileStack,
  Layers,
  PanelLeftClose,
  Search,
} from 'lucide-vue-next';

const route = useRoute();
const isReviewFocusRoute = computed(
  () => route.name === 'sample-review' || /^\/datasets\/[^/]+\/samples\/[^/]+\/review$/.test(route.path),
);
</script>

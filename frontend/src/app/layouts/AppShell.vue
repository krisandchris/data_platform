<template>
  <div
    class="app-shell"
    :class="{
      'app-shell--review-focus': isReviewFocusRoute,
      'app-shell--sidebar-collapsed': isSidebarCollapsed,
    }"
  >
    <aside
      v-if="!isReviewFocusRoute"
      class="sidebar"
      :class="{ 'sidebar--collapsed': isSidebarCollapsed }"
      aria-label="Primary"
    >
      <RouterLink class="brand" :to="offlineHomePath" title="质检工作台">
        <Database class="brand__mark" :size="28" />
        <span class="brand__text">城市治理数据平台</span>
      </RouterLink>

      <nav class="nav-list">
        <div class="nav-section">
          <span class="nav-section__title">工作入口</span>
          <RouterLink class="nav-item" :to="offlineValidationPath" title="数据校验">
            <FileSearch :size="18" />
            <span class="nav-item__label">数据校验</span>
          </RouterLink>
          <RouterLink class="nav-item" :to="offlineHomePath" title="质检工作台">
            <ShieldCheck :size="18" />
            <span class="nav-item__label">质检工作台</span>
          </RouterLink>
        </div>

        <div v-if="activeDatasetId" class="nav-section nav-section--context">
          <span class="nav-section__title">当前批次</span>
          <div class="batch-context-chip" :title="activeDatasetId">
            <span class="batch-context-chip__dot" />
            <span class="batch-context-chip__text">{{ activeDatasetId }}</span>
          </div>
        </div>
      </nav>

      <button
        class="sidebar-collapse"
        type="button"
        :aria-expanded="!isSidebarCollapsed"
        :aria-label="isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
        @click="toggleSidebar"
      >
        <component :is="isSidebarCollapsed ? PanelLeftOpen : PanelLeftClose" :size="18" />
        <span class="sidebar-collapse__label">{{ isSidebarCollapsed ? '展开' : '收起' }}</span>
      </button>
    </aside>

    <div class="workspace">
      <header v-if="!isReviewFocusRoute" class="topbar">
        <div class="topbar-context">
          <span class="topbar-context__badge">{{ topbarContext.eyebrow }}</span>
          <strong>{{ topbarContext.title }}</strong>
        </div>
        <div class="topbar-actions">
          <div class="system-status" title="系统在线">
            <Activity :size="17" />
            <span>系统在线</span>
          </div>
          <div class="user-chip" title="单机模式">
            <span class="avatar">{{ userInitial }}</span>
            <span class="user-chip__name">
              <strong>{{ currentUserName }}</strong>
            </span>
            <span class="user-role-pill">{{ primaryRoleText }}</span>
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
import { computed, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import {
  Activity,
  Database,
  FileSearch,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
} from 'lucide-vue-next';
import { useAuthState } from '../../features/auth/authState';
import { offlineDatasetId } from '../../services/config';

const SIDEBAR_COLLAPSED_KEY = 'uvp.sidebarCollapsed';
const route = useRoute();
const { currentUser, loadCurrentUser } = useAuthState();
const isSidebarCollapsed = ref(readSidebarCollapsed());
const isReviewFocusRoute = computed(
  () => route.name === 'sample-review' || /^\/datasets\/[^/]+\/samples\/[^/]+\/review$/.test(route.path),
);
const activeDatasetId = computed(() => {
  const id = route.params.id;
  return typeof id === 'string' && id ? id : '';
});
const currentImportJobId = computed(() => {
  const jobId = route.params.jobId;
  return typeof jobId === 'string' && jobId ? jobId : '';
});
const offlineHomePath = computed(() => `/datasets/${activeDatasetId.value || offlineDatasetId()}/qc`);
const offlineValidationPath = computed(() => (
  activeDatasetId.value && currentImportJobId.value
    ? `/datasets/${activeDatasetId.value}/import-jobs/${currentImportJobId.value}`
    : `/datasets/types/${offlineDatasetId()}?create=batch`
));
const currentUserName = computed(() => displayUserName(currentUser.value?.userId, currentUser.value?.displayName));
const userInitial = computed(() => currentUserName.value.slice(0, 1) || '?');
const primaryRoleText = computed(() => formatRole(currentUser.value?.roles?.[0]));
const topbarContext = computed(() => {
  const labels: Record<string, string> = {
    'dataset-type': '数据校验',
    'dataset-import-job': '数据校验',
    'dataset-qc': '质检工作台',
  };
  return {
    eyebrow: activeDatasetId.value ? '当前批次' : '单机模式',
    title: labels[String(route.name ?? '')] ?? '质检工作台',
  };
});

void loadCurrentUser();

function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, isSidebarCollapsed.value ? '1' : '0');
  } catch {
    // localStorage may be unavailable in tests.
  }
}

function readSidebarCollapsed() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function formatRole(role?: string) {
  const labels: Record<string, string> = {
    platform_admin: '平台管理员',
    dataset_admin: '数据集管理员',
    batch_manager: '批次管理员',
    annotator: '标注员',
    qc_lead: '质检组长',
  };
  return role ? labels[role] ?? role : '单机用户';
}

function displayUserName(userId?: string, displayName?: string) {
  return displayName || userId || 'offline_reviewer';
}
</script>

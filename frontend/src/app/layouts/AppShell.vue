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
      <RouterLink class="brand" to="/datasets" title="数据集中心">
        <Database class="brand__mark" :size="28" />
        <span class="brand__text">城市治理数据平台</span>
      </RouterLink>

      <nav class="nav-list">
        <div class="nav-section">
          <span class="nav-section__title">工作入口</span>
          <RouterLink class="nav-item" to="/datasets" title="数据集中心">
            <Layers :size="18" />
            <span class="nav-item__label">数据集中心</span>
          </RouterLink>
        </div>

        <div v-if="activeDatasetId" class="nav-section nav-section--context">
          <span class="nav-section__title">当前批次</span>
          <div class="batch-context-chip" :title="activeDatasetId">
            <span class="batch-context-chip__dot" />
            <span class="batch-context-chip__text">{{ activeDatasetId }}</span>
          </div>
          <RouterLink class="nav-item" :to="`/datasets/${activeDatasetId}/overview`" title="批次概览">
            <LayoutDashboard :size="18" />
            <span class="nav-item__label">批次概览</span>
          </RouterLink>
          <RouterLink class="nav-item" :to="`/datasets/${activeDatasetId}/assets`" title="资产样本">
            <Box :size="18" />
            <span class="nav-item__label">资产样本</span>
          </RouterLink>
          <RouterLink
            v-if="currentImportJobId"
            class="nav-item"
            :to="`/datasets/${activeDatasetId}/import-jobs/${currentImportJobId}`"
            title="导入校验"
          >
            <FileSearch :size="18" />
            <span class="nav-item__label">导入校验</span>
          </RouterLink>
          <RouterLink class="nav-item" :to="`/datasets/${activeDatasetId}/preannotations`" title="预标注结果">
            <FileStack :size="18" />
            <span class="nav-item__label">预标注结果</span>
          </RouterLink>
          <RouterLink class="nav-item" :to="`/datasets/${activeDatasetId}/qc`" title="质检队列">
            <ShieldCheck :size="18" />
            <span class="nav-item__label">质检队列</span>
          </RouterLink>
        </div>

        <div v-if="canManageUsers || canReadAudit" class="nav-section">
          <span class="nav-section__title">用户中心</span>
          <RouterLink v-if="canManageUsers" class="nav-item" to="/account/permissions" title="权限管理">
            <Users :size="18" />
            <span class="nav-item__label">权限管理</span>
          </RouterLink>
          <RouterLink v-if="canReadAudit" class="nav-item" to="/account/audit" title="审计记录">
            <ClipboardList :size="18" />
            <span class="nav-item__label">审计记录</span>
          </RouterLink>
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
          <RouterLink class="user-chip" to="/account" title="用户中心" aria-label="用户中心">
            <span class="avatar">{{ userInitial }}</span>
            <span class="user-chip__name">
              <strong>{{ currentUserName }}</strong>
            </span>
            <span class="user-role-pill">{{ primaryRoleText }}</span>
          </RouterLink>
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
  Box,
  ClipboardList,
  Database,
  FileSearch,
  FileStack,
  LayoutDashboard,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Users,
} from 'lucide-vue-next';
import { useAuthState } from '../../features/auth/authState';

const SIDEBAR_COLLAPSED_KEY = 'uvp.sidebarCollapsed';
const route = useRoute();
const { currentUser, canManageUsers, canReadAudit, loadCurrentUser } = useAuthState();
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
const currentUserName = computed(() => displayUserName(currentUser.value?.userId, currentUser.value?.displayName));
const userInitial = computed(() => currentUserName.value.slice(0, 1) || '?');
const primaryRoleText = computed(() => formatRole(currentUser.value?.roles?.[0]));
const topbarContext = computed(() => {
  const name = String(route.name ?? '');
  if (name === 'datasets') {
    return {
      eyebrow: '数据集中心',
      title: '选择数据集类型与批次',
    };
  }
  if (name === 'account') {
    return { eyebrow: '用户中心', title: '账户信息' };
  }
  if (name === 'account-permissions') {
    return { eyebrow: '用户中心', title: '权限管理' };
  }
  if (name === 'account-audit') {
    return { eyebrow: '用户中心', title: '审计记录' };
  }

  const labels: Record<string, string> = {
    'dataset-overview': '批次概览',
    'dataset-assets': '资产样本',
    'dataset-import-job': '导入校验',
    'dataset-preannotations': '预标注结果',
    'dataset-qc': '质检队列',
  };
  return {
    eyebrow: activeDatasetId.value ? '当前批次' : '工作区',
    title: labels[name] ?? '工作区',
  };
});

void loadCurrentUser();

function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, isSidebarCollapsed.value ? '1' : '0');
  } catch {
    // localStorage may be unavailable in non-browser tests.
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
    qc_lead: '质检负责人',
    auditor: '审计员',
  };
  return role ? (labels[role] ?? role) : '未分配角色';
}

function displayUserName(userId?: string, displayName?: string) {
  const builtInNames: Record<string, string> = {
    platform_admin: '平台管理员',
    admin: '平台管理员',
    annotator_a: '标注员 A',
    annotator_b: '标注员 B',
    annotator_account: '标注员',
    qc_lead_a: '质检负责人 A',
    batch_manager_a: '批次管理员 A',
    auditor: '审计员',
    auditor_account: '审计员',
  };
  if (userId && builtInNames[userId]) {
    return builtInNames[userId];
  }
  return displayName || '未登录';
}
</script>

<template>
  <div class="account-page">
    <header class="page-header">
      <div>
        <h1 class="page-title">账户信息</h1>
      </div>
    </header>

    <div v-if="loading && !currentUser" class="loading-state">正在加载账户信息...</div>
    <div v-else-if="error && !currentUser" class="error-state">{{ error }}</div>
    <div v-else-if="!currentUser" class="empty-state">请先登录后查看用户中心。</div>

    <div v-else class="account-grid">
      <section class="panel account-overview">
        <div class="panel__header">
          <h2 class="panel__title">个人账户</h2>
          <UserCircle class="section-icon" :size="22" />
        </div>
        <div class="profile-list">
          <div v-for="row in profileRows" :key="row.label" class="profile-row">
            <span>{{ row.label }}</span>
            <strong>{{ row.value }}</strong>
          </div>
        </div>
      </section>

      <section class="panel session-panel">
        <div class="panel__header">
          <h2 class="panel__title">会话操作</h2>
          <LogOut class="section-icon" :size="21" />
        </div>
        <div class="session-panel__body">
          <p v-if="sessionMessage" class="form-message">{{ sessionMessage }}</p>
          <button class="button button--danger" type="button" :disabled="signingOut" @click="handleLogout">
            <LogOut :size="17" />
            {{ signingOut ? '正在退出' : '退出登录' }}
          </button>
        </div>
      </section>

      <section class="panel account-roles">
        <div class="panel__header">
          <h2 class="panel__title">角色与作用域</h2>
          <ShieldCheck class="section-icon" :size="22" />
        </div>

        <div v-if="roleBindings.length" class="role-binding-list">
          <article v-for="binding in roleBindings" :key="binding.bindingId" class="role-binding-row">
            <span class="role-chip">{{ roleLabel(binding.role) }}</span>
            <div>
              <strong>{{ formatScope(binding.scopeType, binding.scopeId) }}</strong>
              <span class="binding-meta">
                <span>作用域 {{ formatScopeType(binding.scopeType) }}</span>
                <span v-if="binding.createdBy">创建人 {{ binding.createdBy }}</span>
                <span v-if="binding.createdAt">创建时间 {{ binding.createdAt }}</span>
              </span>
            </div>
          </article>
        </div>

        <div v-else class="role-summary">
          <span v-for="role in currentUser.roles" :key="role" class="role-chip">{{ roleLabel(role) }}</span>
          <p class="role-summary__text">当前账号没有角色绑定明细</p>
        </div>
      </section>

      <section class="panel account-permissions">
        <div class="panel__header">
          <h2 class="panel__title">权限摘要</h2>
          <KeyRound class="section-icon" :size="22" />
        </div>
        <div v-if="permissionGroups.length" class="permission-groups">
          <article v-for="group in permissionGroups" :key="group.name" class="permission-group">
            <h3>{{ permissionGroupLabel(group.name) }}</h3>
            <div>
              <span v-for="permission in group.permissions" :key="permission" class="permission-chip">
                {{ permissionLabel(permission) }}
              </span>
            </div>
          </article>
        </div>
        <div v-else class="empty-inline">当前账号没有返回权限清单。</div>
      </section>

      <section v-if="hasManagementEntries" class="panel management-entry-panel">
        <div class="panel__header">
          <h2 class="panel__title">管理入口</h2>
        </div>
        <div class="management-entry-grid">
          <RouterLink v-if="canManageUsers" class="management-entry" to="/account/permissions">
            <UsersRound :size="20" />
            <span>
              <strong>权限管理</strong>
              <span>账号与角色绑定</span>
            </span>
          </RouterLink>
          <RouterLink v-if="canReadAudit" class="management-entry" to="/account/audit">
            <ClipboardList :size="20" />
            <span>
              <strong>审计记录</strong>
              <span>批次操作记录</span>
            </span>
          </RouterLink>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { ClipboardList, KeyRound, LogOut, ShieldCheck, UserCircle, UsersRound } from 'lucide-vue-next';
import { useAuthState } from '../auth/authState';
import type { RoleBinding, RoleScopeType } from '../../shared/types/contract';

const router = useRouter();
const {
  currentUser,
  loading,
  error,
  canManageUsers,
  canReadAudit,
  loadCurrentUser,
  logout,
} = useAuthState();
const signingOut = ref(false);
const sessionMessage = ref('');

onMounted(() => {
  if (!currentUser.value) {
    void loadCurrentUser();
  }
});

const profileRows = computed(() => {
  const user = currentUser.value;
  if (!user) {
    return [];
  }
  return [
    { label: '用户 ID', value: user.userId },
    { label: '显示名称', value: displayUserName(user.userId, user.displayName) },
    { label: '邮箱', value: user.email || '未设置' },
    { label: '状态', value: user.status === 'disabled' ? '已停用' : '启用中' },
    { label: '认证模式', value: authModeLabel(user.authMode) },
  ];
});

const roleBindings = computed<RoleBinding[]>(() => currentUser.value?.roleBindings ?? []);
const hasManagementEntries = computed(() => canManageUsers.value || canReadAudit.value);
const permissionGroups = computed(() => {
  const permissions = [...(currentUser.value?.permissions ?? [])].sort((a, b) => a.localeCompare(b));
  const grouped = permissions.reduce<Record<string, string[]>>((acc, permission) => {
    const prefix = permission.includes(':')
      ? permission.split(':')[0]
      : permission.includes('.')
        ? permission.split('.')[0]
        : 'other';
    acc[prefix] = [...(acc[prefix] ?? []), permission];
    return acc;
  }, {});
  const groupOrder = [
    'users',
    'roles',
    'dataset',
    'import_job',
    'qc_queue',
    'batch_assignment',
    'label_edit',
    'audit',
  ];
  return Object.entries(grouped)
    .sort(([left], [right]) => {
      const leftIndex = groupOrder.indexOf(left);
      const rightIndex = groupOrder.indexOf(right);
      if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    })
    .map(([name, values]) => ({ name, permissions: values }));
});

async function handleLogout() {
  signingOut.value = true;
  sessionMessage.value = '';
  try {
    await logout();
  } catch (err) {
    sessionMessage.value = err instanceof Error ? err.message : '退出登录失败，已清理本地会话';
  } finally {
    signingOut.value = false;
    await router.push({ name: 'login' });
  }
}

function formatScope(scopeType: RoleScopeType, scopeId: string) {
  if (scopeType === 'platform') {
    return '全平台';
  }
  if (scopeType === 'dataset_type') {
    return `数据集类型 · ${scopeId}`;
  }
  if (scopeType === 'dataset_batch') {
    return `具体批次 · ${scopeId}`;
  }
  return scopeId;
}

function formatScopeType(scopeType: RoleScopeType) {
  const labels: Record<RoleScopeType, string> = {
    platform: '全平台',
    dataset_type: '数据集类型',
    dataset_batch: '具体批次',
  };
  return labels[scopeType] ?? scopeType;
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    platform_admin: '平台管理员',
    dataset_admin: '数据集管理员',
    batch_manager: '批次管理员',
    annotator: '标注员',
    qc_lead: '质检负责人',
    auditor: '审计员',
  };
  return labels[role] ?? role;
}

function authModeLabel(authMode: string) {
  const labels: Record<string, string> = {
    session: '账号会话',
    dev_header: '开发模式',
    anonymous: '匿名模式',
  };
  return labels[authMode] ?? authMode;
}

function permissionGroupLabel(group: string) {
  const labels: Record<string, string> = {
    users: '用户',
    roles: '角色',
    dataset: '数据集',
    import_job: '导入任务',
    qc_queue: '质检队列',
    batch_assignment: '批次分配',
    label_edit: '标签编辑',
    audit: '审计',
    other: '其他',
  };
  return labels[group] ?? group;
}

function permissionLabel(permission: string) {
  const labels: Record<string, string> = {
    'users:manage': '用户管理',
    'roles:manage': '角色管理',
    'audit:read': '审计查看',
    'audit:read_own': '本人审计',
    'dataset:read': '数据集查看',
    'dataset_type:create': '创建数据集类型',
    'import_job:manage': '导入任务管理',
    'label_config:manage': '标签配置管理',
    'label_edit:write': '标签编辑',
    'label_edit:confirm': '提交确认',
    'lease:force_release': '强制释放锁定',
    'qc_progress:read': '质检进度查看',
    'qc_queue:read': '质检队列查看',
    'batch_assignment:manage': '批次分配管理',
  };
  return labels[permission] ?? permission;
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
  return displayName || '未设置';
}
</script>

<style scoped>
.account-page {
  display: grid;
  gap: 18px;
}

.account-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(300px, 0.55fr);
  gap: 16px;
  align-items: start;
}

.account-roles,
.account-permissions,
.management-entry-panel {
  grid-column: 1 / -1;
}

.section-icon {
  color: var(--blue);
}

.profile-list,
.session-panel__body,
.role-binding-list,
.role-summary,
.permission-groups,
.management-entry-grid {
  padding: 16px 18px 18px;
}

.profile-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.profile-row {
  display: grid;
  gap: 4px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-subtle);
  padding: 10px 12px;
}

.profile-row span,
.binding-meta,
.management-entry span span {
  color: #344054;
  font-size: 13px;
  font-weight: 700;
}

.profile-row strong {
  overflow-wrap: anywhere;
}

.session-panel__body {
  display: grid;
  gap: 12px;
}

.form-message {
  margin: 0;
  color: var(--red);
  font-size: 13px;
}

.role-binding-list,
.permission-groups,
.management-entry-grid {
  display: grid;
  gap: 10px;
}

.role-binding-row {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-subtle);
  padding: 10px;
}

.role-binding-row div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.binding-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  overflow-wrap: anywhere;
}

.role-chip,
.permission-chip {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: #fff;
  color: #24324b;
  padding: 2px 9px;
  font-size: 12px;
  font-weight: 800;
}

.role-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.role-summary__text {
  flex-basis: 100%;
  margin: 0;
  color: #344054;
  font-size: 13px;
  font-weight: 700;
}

.permission-group {
  display: grid;
  gap: 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-subtle);
  padding: 10px 12px;
}

.permission-group h3 {
  margin: 0;
  color: #263853;
  font-size: 13px;
  font-weight: 900;
}

.permission-group div {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.permission-chip {
  border-color: #cbd8ea;
  background: #fff;
}

.empty-inline {
  margin: 16px 18px 18px;
  border: 1px dashed var(--line-strong);
  border-radius: 8px;
  background: var(--panel-subtle);
  color: var(--muted);
  padding: 18px;
}

.management-entry-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.management-entry {
  display: flex;
  gap: 12px;
  align-items: center;
  min-height: 74px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-subtle);
  padding: 12px;
}

.management-entry:hover {
  border-color: var(--line-strong);
  background: var(--blue-soft);
  color: var(--blue);
}

.management-entry span {
  display: grid;
  gap: 3px;
}

@media (max-width: 920px) {
  .account-grid,
  .profile-list,
  .management-entry-grid {
    grid-template-columns: 1fr;
  }
}
</style>

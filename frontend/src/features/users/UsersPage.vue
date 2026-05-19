<template>
  <div class="permissions-page">
    <header class="page-header permissions-header">
      <h1 class="page-title">权限管理</h1>
      <div class="header-metrics">
        <span>{{ users.length }} 个账号</span>
        <span>{{ roleBindings.length }} 条绑定</span>
      </div>
    </header>

    <div v-if="loading" class="loading-state">正在加载权限管理数据...</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>
    <div v-else class="management-grid">
      <section class="panel tech-panel">
        <div class="panel__header panel__header--tech">
          <h2 class="panel__title">账号管理</h2>
          <span class="panel-count">账号 {{ users.length }}</span>
        </div>
        <form class="account-form" @submit.prevent="createUser">
          <label>
            <span>账号</span>
            <input v-model="newUser.username" placeholder="请输入账号" />
          </label>
          <label>
            <span>姓名</span>
            <input v-model="newUser.displayName" placeholder="请输入显示名称" />
          </label>
          <label>
            <span>邮箱</span>
            <input v-model="newUser.email" placeholder="请输入邮箱" />
          </label>
          <label>
            <span>初始密码</span>
            <input v-model="newUser.password" autocomplete="new-password" placeholder="至少 8 位" type="password" />
          </label>
          <button type="submit">创建用户</button>
        </form>
        <div class="table-list">
          <article v-for="user in users" :key="user.userId" class="user-row">
            <div class="user-identity">
              <strong>{{ displayUserName(user) }}</strong>
              <span>账号 {{ user.userId }}</span>
              <span>邮箱 {{ user.email || '未设置' }}</span>
            </div>
            <StatusChip :value="user.status" :label="userStatusLabel(user.status)" />
            <div class="role-tags">
              <span v-for="role in rolesForUser(user.userId)" :key="role">{{ roleLabel(role) }}</span>
            </div>
            <button class="button-secondary" type="button" @click="toggleUser(user)">
              {{ user.status === 'disabled' ? '启用' : '禁用' }}
            </button>
          </article>
          <div v-if="!users.length" class="empty-inline">暂无账号</div>
        </div>
      </section>

      <section class="panel tech-panel">
        <div class="panel__header panel__header--tech">
          <h2 class="panel__title">角色绑定</h2>
          <span class="panel-count">绑定 {{ roleBindings.length }}</span>
        </div>
        <form class="binding-form" @submit.prevent="createBinding">
          <label>
            <span>用户</span>
            <select v-model="newBinding.userId">
              <option v-for="user in users" :key="user.userId" :value="user.userId">{{ displayUserName(user) }}</option>
            </select>
          </label>
          <label>
            <span>角色</span>
            <select v-model="newBinding.role">
              <option v-for="role in roleOptions" :key="role.value" :value="role.value">{{ role.label }}</option>
            </select>
          </label>
          <label>
            <span>作用域</span>
            <select v-model="newBinding.scopeType">
              <option v-for="scope in scopeOptions" :key="scope.value" :value="scope.value">{{ scope.label }}</option>
            </select>
          </label>
          <label>
            <span>作用域标识</span>
            <input v-model="newBinding.scopeId" placeholder="urban_violation__0508_fixture" />
          </label>
          <button type="submit">绑定角色</button>
        </form>
        <div class="table-list">
          <article v-for="binding in roleBindings" :key="binding.bindingId" class="binding-row">
            <span class="role-pill">{{ roleLabel(binding.role) }}</span>
            <div class="binding-detail">
              <strong>{{ userDisplayName(binding.userId) }}</strong>
              <span>{{ scopeText(binding.scopeType, binding.scopeId) }}</span>
            </div>
            <button class="button-secondary button-danger" type="button" @click="deleteBinding(binding.bindingId)">删除</button>
          </article>
          <div v-if="!roleBindings.length" class="empty-inline">暂无角色绑定</div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ApiClientError } from '../../services/http';
import { apiClient } from '../../services/urbanViolationApi';
import StatusChip from '../../shared/components/StatusChip.vue';
import type { RoleBindingCreatePayload, RoleScopeType, UserAccount, UserRole } from '../../shared/types/contract';

const users = ref<UserAccount[]>([]);
const roleBindings = ref<Awaited<ReturnType<typeof apiClient.listRoleBindings>>>([]);
const loading = ref(true);
const error = ref('');
const newUser = reactive({
  username: '',
  displayName: '',
  email: '',
  password: '',
});
const newBinding = reactive<RoleBindingCreatePayload>({
  userId: 'annotator_a',
  role: 'annotator',
  scopeType: 'dataset_batch',
  scopeId: 'urban_violation__0508_fixture',
});
const bindingsByUser = computed(() =>
  roleBindings.value.reduce<Record<string, UserRole[]>>((acc, binding) => {
    acc[binding.userId] = [...(acc[binding.userId] ?? []), binding.role];
    return acc;
  }, {}),
);
const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: 'annotator', label: '标注员' },
  { value: 'qc_lead', label: '质检负责人' },
  { value: 'batch_manager', label: '批次管理员' },
  { value: 'dataset_admin', label: '数据集管理员' },
  { value: 'auditor', label: '审计员' },
  { value: 'platform_admin', label: '平台管理员' },
];
const scopeOptions: Array<{ value: RoleScopeType; label: string }> = [
  { value: 'dataset_batch', label: '具体批次' },
  { value: 'dataset_type', label: '数据集类型' },
  { value: 'platform', label: '全平台' },
];

onMounted(load);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [nextUsers, nextBindings] = await Promise.all([apiClient.listUsers(), apiClient.listRoleBindings()]);
    users.value = nextUsers;
    roleBindings.value = nextBindings;
    if (nextUsers[0]) {
      newBinding.userId = nextUsers[0].userId;
    }
  } catch (err) {
    error.value =
      err instanceof ApiClientError && err.status === 403
        ? '当前账号没有用户权限管理权限，请使用平台管理员账号登录。'
        : err instanceof Error
          ? err.message
          : '无法加载用户权限';
  } finally {
    loading.value = false;
  }
}

async function createUser() {
  if (!newUser.username || !newUser.displayName || !newUser.email || newUser.password.length < 8) return;
  await apiClient.createUser({
    username: newUser.username,
    displayName: newUser.displayName,
    email: newUser.email,
    password: newUser.password,
    status: 'active',
  });
  newUser.username = '';
  newUser.displayName = '';
  newUser.email = '';
  newUser.password = '';
  await load();
}

async function toggleUser(user: UserAccount) {
  await apiClient.updateUser(user.userId, {
    status: user.status === 'disabled' ? 'active' : 'disabled',
  });
  await load();
}

async function createBinding() {
  await apiClient.createRoleBinding({ ...newBinding });
  await load();
}

async function deleteBinding(bindingId: string) {
  await apiClient.deleteRoleBinding(bindingId);
  await load();
}

function rolesForUser(userId: string) {
  return bindingsByUser.value[userId] ?? [];
}

function roleLabel(role: UserRole | string) {
  return roleOptions.find((item) => item.value === role)?.label ?? role;
}

function userStatusLabel(status: string) {
  return status === 'disabled' ? '已停用' : '启用中';
}

function scopeText(scopeType: RoleScopeType, scopeId: string) {
  return `${scopeOptions.find((item) => item.value === scopeType)?.label ?? scopeType} · ${scopeId}`;
}

function userDisplayName(userId: string) {
  const user = users.value.find((item) => item.userId === userId);
  return user ? displayUserName(user) : userId;
}

function displayUserName(user: UserAccount) {
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
  return builtInNames[user.userId] ?? user.displayName;
}
</script>

<style scoped>
.permissions-page {
  display: grid;
  gap: 18px;
}

.permissions-header {
  align-items: center;
}

.header-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.header-metrics span,
.panel-count {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  border: 1px solid #b9ccf5;
  border-radius: 8px;
  background: linear-gradient(135deg, #edf5ff, #fff);
  color: #0f5bd8;
  padding: 0 10px;
  font-size: 13px;
  font-weight: 900;
}

.management-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(390px, 0.78fr);
  gap: 16px;
}

.tech-panel {
  overflow: hidden;
  border-color: #c8d9f3;
  background:
    linear-gradient(180deg, rgba(18, 100, 255, 0.035), rgba(255, 255, 255, 0) 160px),
    #fff;
}

.panel__header--tech {
  border-bottom-color: #c8d9f3;
  background: linear-gradient(90deg, rgba(18, 100, 255, 0.06), rgba(255, 255, 255, 0.92));
}

.account-form,
.binding-form {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  padding: 16px;
}

.binding-form {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.account-form label,
.binding-form label {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.account-form label span,
.binding-form label span {
  color: #263853;
  font-size: 13px;
  font-weight: 900;
}

input,
select,
button {
  min-height: 36px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  color: var(--text);
  padding: 0 10px;
  font-weight: 750;
}

button {
  background: var(--blue);
  color: #fff;
  font-weight: 900;
}

.button-secondary {
  border-color: #c4d5ef;
  background: #f6f9ff;
  color: #16345f;
}

.button-danger {
  border-color: #f3b8bd;
  background: #fff5f5;
  color: #b4232a;
}

.table-list {
  display: grid;
  gap: 10px;
  padding: 0 16px 16px;
}

.user-row,
.binding-row {
  display: grid;
  gap: 12px;
  align-items: center;
  border: 1px solid #d6e2f3;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.78);
  padding: 12px;
}

.user-row {
  grid-template-columns: minmax(0, 1.4fr) auto minmax(180px, 0.8fr) auto;
}

.binding-row {
  grid-template-columns: max-content minmax(0, 1fr) auto;
}

.user-identity,
.binding-detail {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.user-identity strong,
.binding-detail strong {
  overflow-wrap: anywhere;
  color: #111827;
  font-size: 15px;
  font-weight: 900;
}

.user-identity span,
.binding-detail span {
  overflow-wrap: anywhere;
  color: #344054;
  font-size: 13px;
  font-weight: 700;
}

.role-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.role-tags span,
.role-pill {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  border: 1px solid #bdd0ee;
  border-radius: 8px;
  background: #eef5ff;
  color: #0f4fbf;
  padding: 0 9px;
  font-size: 13px;
  font-weight: 900;
  white-space: nowrap;
}

.role-tags:empty::before {
  content: '暂无角色';
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  color: #526070;
  padding: 0 9px;
  font-size: 13px;
  font-weight: 800;
}

.empty-inline {
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  color: #526070;
  padding: 16px;
  font-weight: 800;
  text-align: center;
}

.permissions-page :deep(.status-chip) {
  min-height: 28px;
  font-size: 13px;
}

@media (max-width: 980px) {
  .management-grid,
  .account-form,
  .binding-form,
  .user-row,
  .binding-row {
    grid-template-columns: 1fr;
  }
}
</style>

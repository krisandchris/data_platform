<template>
  <div class="permissions-page">
    <header class="page-header permissions-header">
      <div>
        <h1 class="page-title">权限管理</h1>
      </div>
      <div class="page-actions">
        <button class="button" type="button" @click="openAssignmentDrawer()">
          <ShieldCheck :size="17" />
          分配数据权限
        </button>
        <button class="button button--primary" type="button" @click="openCreateUserDrawer">
          <UserPlus :size="17" />
          新建账号
        </button>
      </div>
    </header>

    <div v-if="loading" class="loading-state">正在加载权限管理数据...</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>
    <template v-else>
      <section class="permissions-command-panel panel">
        <div class="command-metrics">
          <div>
            <span>账号</span>
            <strong>{{ users.length }}</strong>
          </div>
          <div>
            <span>启用</span>
            <strong>{{ activeUserCount }}</strong>
          </div>
          <div>
            <span>未分配角色</span>
            <strong>{{ unassignedUserCount }}</strong>
          </div>
          <div>
            <span>绑定记录</span>
            <strong>{{ roleBindings.length }}</strong>
          </div>
        </div>

        <div class="toolbar-grid">
          <label class="search-field">
            <Search :size="16" />
            <input v-model.trim="searchQuery" placeholder="搜索账号、姓名或邮箱" />
          </label>
          <select v-model="statusFilter">
            <option value="all">全部状态</option>
            <option value="active">启用中</option>
            <option value="disabled">已停用</option>
          </select>
          <select v-model="roleFilter">
            <option value="all">全部角色</option>
            <option value="unassigned">未分配角色</option>
            <option v-for="role in roleOptions" :key="role.role" :value="role.role">{{ role.label }}</option>
          </select>
        </div>

        <div class="segmented-tabs" role="tablist" aria-label="权限管理分区">
          <button :class="{ active: activeTab === 'accounts' }" type="button" @click="activeTab = 'accounts'">
            账号管理
          </button>
          <button :class="{ active: activeTab === 'assignment' }" type="button" @click="activeTab = 'assignment'">
            数据集权限分配
          </button>
          <button :class="{ active: activeTab === 'bindings' }" type="button" @click="activeTab = 'bindings'">
            角色绑定记录
          </button>
        </div>
      </section>

      <section v-if="activeTab === 'accounts'" class="panel command-section">
        <div class="panel__header">
          <h2 class="panel__title">账号管理</h2>
          <button class="button button--compact" type="button" @click="openCreateUserDrawer">
            <UserPlus :size="15" />
            新建账号
          </button>
        </div>
        <div class="account-list">
          <article v-for="user in filteredUsers" :key="user.userId" class="account-row">
            <div class="account-identity">
              <strong>{{ displayUserName(user) }}</strong>
              <span>{{ user.userId }} · {{ user.email || '未设置邮箱' }}</span>
            </div>
            <StatusChip :value="user.status" :label="userStatusLabel(user.status)" />
            <div class="role-tags">
              <span v-for="role in rolesForUser(user.userId)" :key="role">{{ roleLabel(role) }}</span>
              <span v-if="!rolesForUser(user.userId).length" class="role-tag-empty">未分配角色</span>
            </div>
            <div class="row-actions">
              <button class="button button--compact" type="button" @click="openEditUserDrawer(user)">编辑</button>
              <button class="button button--compact" type="button" @click="openResetPasswordModal(user)">重置密码</button>
              <button class="button button--compact" type="button" @click="openToggleUserModal(user)">
                {{ user.status === 'disabled' ? '启用' : '禁用' }}
              </button>
            </div>
          </article>
          <div v-if="!filteredUsers.length" class="empty-inline">暂无匹配账号</div>
        </div>
      </section>

      <section v-else-if="activeTab === 'assignment'" class="panel command-section">
        <div class="panel__header">
          <h2 class="panel__title">数据集权限分配</h2>
          <button class="button button--primary" type="button" @click="openAssignmentDrawer()">
            <ShieldCheck :size="15" />
            分配数据权限
          </button>
        </div>
        <div class="assignment-summary-grid">
          <div v-for="scope in scopeOptions" :key="scope.scopeType">
            <span>{{ scope.label }}</span>
            <strong>{{ bindingCountByScope(scope.scopeType) }}</strong>
          </div>
        </div>
        <div class="compact-binding-list">
          <article v-for="binding in roleBindings.slice(0, 5)" :key="binding.bindingId">
            <span class="role-pill">{{ roleLabel(binding.role) }}</span>
            <strong>{{ userDisplayName(binding.userId) }}</strong>
            <small>{{ scopeText(binding.scopeType, binding.scopeId) }}</small>
          </article>
          <div v-if="!roleBindings.length" class="empty-inline">暂无角色绑定</div>
        </div>
      </section>

      <section v-else class="panel command-section">
        <div class="panel__header">
          <h2 class="panel__title">角色绑定记录</h2>
          <span class="panel-count">{{ filteredBindings.length }} 条</span>
        </div>
        <div class="binding-list">
          <article v-for="binding in filteredBindings" :key="binding.bindingId" class="binding-row">
            <span class="role-pill">{{ roleLabel(binding.role) }}</span>
            <div class="binding-detail">
              <strong>{{ userDisplayName(binding.userId) }}</strong>
              <span>{{ scopeText(binding.scopeType, binding.scopeId) }}</span>
            </div>
            <div class="row-actions">
              <button class="button button--compact" type="button" @click="openBindingDetailDrawer(binding)">详情</button>
              <button class="button button--compact button--danger" type="button" @click="openDeleteBindingModal(binding)">删除</button>
            </div>
          </article>
          <div v-if="!filteredBindings.length" class="empty-inline">暂无匹配绑定记录</div>
        </div>
      </section>
    </template>

    <div v-if="activeDrawer" class="drawer-backdrop" @click.self="closeDrawer">
      <aside class="right-drawer">
        <header class="drawer-header">
          <div>
            <span>{{ drawerEyebrow }}</span>
            <h2>{{ drawerTitle }}</h2>
          </div>
          <button class="icon-button" type="button" aria-label="关闭" @click="closeDrawer">
            <X :size="18" />
          </button>
        </header>

        <form v-if="activeDrawer === 'createUser' || activeDrawer === 'editUser'" class="drawer-form" @submit.prevent="submitUserForm">
          <label>
            <span>账号</span>
            <input v-model.trim="userForm.username" :disabled="activeDrawer === 'editUser'" placeholder="annotator_c" required />
          </label>
          <label>
            <span>姓名</span>
            <input v-model.trim="userForm.displayName" placeholder="标注员 C" required />
          </label>
          <label>
            <span>邮箱</span>
            <input v-model.trim="userForm.email" placeholder="user@example.local" />
          </label>
          <label v-if="activeDrawer === 'createUser'">
            <span>初始密码</span>
            <input v-model="userForm.password" autocomplete="new-password" placeholder="至少 8 位" type="password" required />
          </label>
          <p v-if="drawerError" class="inline-error">{{ drawerError }}</p>
          <footer class="drawer-actions">
            <button class="button" type="button" @click="closeDrawer">取消</button>
            <button class="button button--primary" type="submit">{{ activeDrawer === 'createUser' ? '创建账号' : '保存账号' }}</button>
          </footer>
        </form>

        <form v-else-if="activeDrawer === 'assignment'" class="drawer-form" @submit.prevent="submitAssignment">
          <ol class="wizard-steps">
            <li>
              <label>
                <span>选择用户</span>
                <select v-model="assignmentForm.userId" data-testid="assignment-user">
                  <option v-for="user in users" :key="user.userId" :value="user.userId">{{ displayUserName(user) }}</option>
                </select>
              </label>
            </li>
            <li>
              <label>
                <span>选择目标级别</span>
                <select v-model="assignmentForm.scopeType" data-testid="assignment-scope" @change="onAssignmentScopeChange">
                  <option value="platform">全平台</option>
                  <option value="dataset_type">数据集类型</option>
                  <option value="dataset_batch">数据集批次</option>
                </select>
              </label>
            </li>
            <li v-if="assignmentForm.scopeType === 'platform'" class="fixed-scope">
              <span>具体目标</span>
              <strong>*</strong>
            </li>
            <li v-else>
              <label>
                <span>数据集类型</span>
                <select v-model="assignmentForm.datasetType" data-testid="assignment-dataset-type" @change="onAssignmentDatasetTypeChange">
                  <option value="" disabled>请选择数据集类型</option>
                  <option v-for="type in datasetTypes" :key="type.datasetType" :value="type.datasetType">
                    {{ type.displayName }} · {{ type.datasetType }}
                  </option>
                </select>
              </label>
            </li>
            <li v-if="assignmentForm.scopeType === 'dataset_batch'">
              <label>
                <span>具体批次</span>
                <select v-model="assignmentForm.batchId" data-testid="assignment-batch">
                  <option value="" disabled>请选择批次</option>
                  <option v-for="batch in batchesForSelectedType" :key="batch.id" :value="batch.id">
                    {{ batch.batchName ?? batch.name }} · {{ batch.id }}
                  </option>
                </select>
              </label>
            </li>
            <li>
              <label>
                <span>选择角色</span>
                <select v-model="assignmentForm.role" data-testid="assignment-role">
                  <option v-for="role in roleOptions" :key="role.role" :value="role.role">
                    {{ role.label }} · {{ role.description ?? role.role }}
                  </option>
                </select>
              </label>
            </li>
          </ol>

          <section class="permission-preview" data-testid="rbac-permission-preview">
            <strong>权限预览</strong>
            <div v-if="selectedRolePermissions.length" class="permission-tags">
              <span v-for="permission in selectedRolePermissions" :key="permission">{{ permissionLabel(permission) }}</span>
            </div>
            <p v-else>该角色暂无派生权限</p>
          </section>

          <p v-if="assignmentConflict" class="inline-error">{{ assignmentConflict }}</p>
          <p v-if="drawerError" class="inline-error">{{ drawerError }}</p>
          <footer class="drawer-actions">
            <button class="button" type="button" @click="closeDrawer">取消</button>
            <button class="button button--primary" type="submit" :disabled="Boolean(assignmentConflict)">提交分配</button>
          </footer>
        </form>

        <section v-else-if="activeDrawer === 'bindingDetail' && selectedBinding" class="drawer-detail">
          <dl>
            <div>
              <dt>用户</dt>
              <dd>{{ userDisplayName(selectedBinding.userId) }}</dd>
            </div>
            <div>
              <dt>角色</dt>
              <dd>{{ roleLabel(selectedBinding.role) }}</dd>
            </div>
            <div>
              <dt>作用域</dt>
              <dd>{{ scopeText(selectedBinding.scopeType, selectedBinding.scopeId) }}</dd>
            </div>
            <div>
              <dt>派生权限</dt>
              <dd>
                <span v-for="permission in permissionsForRole(selectedBinding.role)" :key="permission" class="detail-permission">
                  {{ permissionLabel(permission) }}
                </span>
              </dd>
            </div>
            <div>
              <dt>创建人</dt>
              <dd>{{ selectedBinding.createdBy ?? '-' }}</dd>
            </div>
            <div>
              <dt>创建时间</dt>
              <dd>{{ selectedBinding.createdAt ?? '-' }}</dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>

    <div v-if="activeModal" class="modal-backdrop" @click.self="closeModal">
      <section class="confirm-modal">
        <header>
          <h2>{{ modalTitle }}</h2>
          <button class="icon-button" type="button" aria-label="关闭" @click="closeModal">
            <X :size="18" />
          </button>
        </header>

        <form v-if="activeModal === 'resetPassword' && selectedUser" class="modal-form" @submit.prevent="submitResetPassword">
          <p>为 {{ displayUserName(selectedUser) }} 设置新密码。</p>
          <label>
            <span>新密码</span>
            <input v-model="passwordForm.password" autocomplete="new-password" type="password" placeholder="至少 8 位" />
          </label>
          <p v-if="modalError" class="inline-error">{{ modalError }}</p>
          <footer>
            <button class="button" type="button" @click="closeModal">取消</button>
            <button class="button button--primary" type="submit">确认重置</button>
          </footer>
        </form>

        <div v-else-if="activeModal === 'deleteBinding' && selectedBinding" class="modal-form">
          <p>
            确认删除 {{ userDisplayName(selectedBinding.userId) }} 的 {{ roleLabel(selectedBinding.role) }}
            绑定，作用域 {{ scopeText(selectedBinding.scopeType, selectedBinding.scopeId) }}。
          </p>
          <p v-if="modalError" class="inline-error">{{ modalError }}</p>
          <footer>
            <button class="button" type="button" @click="closeModal">取消</button>
            <button class="button button--danger" type="button" @click="confirmDeleteBinding">确认删除</button>
          </footer>
        </div>

        <div v-else-if="activeModal === 'toggleUser' && selectedUser" class="modal-form">
          <p>
            确认{{ selectedUser.status === 'disabled' ? '启用' : '禁用' }}账号
            {{ displayUserName(selectedUser) }}。
          </p>
          <p v-if="selectedUser.userId === currentUser?.userId && selectedUser.status !== 'disabled'" class="inline-warning">
            当前登录账号不能在前端直接禁用，请切换管理员后操作。
          </p>
          <p v-if="modalError" class="inline-error">{{ modalError }}</p>
          <footer>
            <button class="button" type="button" @click="closeModal">取消</button>
            <button
              class="button button--primary"
              type="button"
              :disabled="selectedUser.userId === currentUser?.userId && selectedUser.status !== 'disabled'"
              @click="confirmToggleUser"
            >
              确认{{ selectedUser.status === 'disabled' ? '启用' : '禁用' }}
            </button>
          </footer>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { Search, ShieldCheck, UserPlus, X } from 'lucide-vue-next';
import { ApiClientError } from '../../services/http';
import { apiClient } from '../../services/urbanViolationApi';
import StatusChip from '../../shared/components/StatusChip.vue';
import type {
  CurrentUser,
  DatasetType,
  RbacCatalog,
  RbacCatalogRole,
  RbacCatalogScope,
  RoleBinding,
  RoleBindingCreatePayload,
  RoleScopeType,
  UserAccount,
  UserRole,
} from '../../shared/types/contract';

type ActiveTab = 'accounts' | 'assignment' | 'bindings';
type ActiveDrawer = 'createUser' | 'editUser' | 'assignment' | 'bindingDetail';
type ActiveModal = 'resetPassword' | 'deleteBinding' | 'toggleUser';

const users = ref<UserAccount[]>([]);
const roleBindings = ref<RoleBinding[]>([]);
const datasetTypes = ref<DatasetType[]>([]);
const currentUser = ref<CurrentUser>();
const rbacCatalog = ref<RbacCatalog>({ roles: [], scopes: [], permissions: [] });
const loading = ref(true);
const error = ref('');
const activeTab = ref<ActiveTab>('accounts');
const searchQuery = ref('');
const statusFilter = ref<'all' | 'active' | 'disabled'>('all');
const roleFilter = ref<UserRole | 'all' | 'unassigned'>('all');
const activeDrawer = ref<ActiveDrawer | null>(null);
const activeModal = ref<ActiveModal | null>(null);
const selectedUser = ref<UserAccount>();
const selectedBinding = ref<RoleBinding>();
const drawerError = ref('');
const modalError = ref('');
const userForm = reactive({
  userId: '',
  username: '',
  displayName: '',
  email: '',
  password: '',
});
const passwordForm = reactive({
  password: '',
});
const assignmentForm = reactive({
  userId: '',
  scopeType: 'dataset_batch' as RoleScopeType,
  datasetType: '',
  batchId: '',
  role: 'annotator' as UserRole,
});

const roleOptions = computed<RbacCatalogRole[]>(() => rbacCatalog.value.roles);
const scopeOptions = computed<RbacCatalogScope[]>(() => rbacCatalog.value.scopes);
const activeUserCount = computed(() => users.value.filter((user) => user.status !== 'disabled').length);
const bindingsByUser = computed(() =>
  roleBindings.value.reduce<Record<string, UserRole[]>>((acc, binding) => {
    acc[binding.userId] = [...(acc[binding.userId] ?? []), binding.role];
    return acc;
  }, {}),
);
const unassignedUserCount = computed(() => users.value.filter((user) => !rolesForUser(user.userId).length).length);
const filteredUsers = computed(() => {
  const query = searchQuery.value.toLowerCase();
  return users.value.filter((user) => {
    const matchesQuery = [user.userId, user.username, user.displayName, user.email]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
    const matchesStatus = statusFilter.value === 'all' || user.status === statusFilter.value;
    const roles = rolesForUser(user.userId);
    const matchesRole =
      roleFilter.value === 'all' ||
      (roleFilter.value === 'unassigned' ? roles.length === 0 : roles.includes(roleFilter.value));
    return matchesQuery && matchesStatus && matchesRole;
  });
});
const filteredBindings = computed(() => {
  const query = searchQuery.value.toLowerCase();
  return roleBindings.value.filter((binding) => {
    const user = userDisplayName(binding.userId).toLowerCase();
    const role = roleLabel(binding.role).toLowerCase();
    const scope = scopeText(binding.scopeType, binding.scopeId).toLowerCase();
    return user.includes(query) || role.includes(query) || scope.includes(query);
  });
});
const batchesForSelectedType = computed(() =>
  datasetTypes.value.find((item) => item.datasetType === assignmentForm.datasetType)?.batches ?? [],
);
const selectedScopeId = computed(() => {
  if (assignmentForm.scopeType === 'platform') {
    return '*';
  }
  if (assignmentForm.scopeType === 'dataset_type') {
    return assignmentForm.datasetType;
  }
  return assignmentForm.batchId;
});
const selectedRolePermissions = computed(() => permissionsForRole(assignmentForm.role));
const assignmentConflict = computed(() => {
  if (!assignmentForm.userId || !assignmentForm.role || !selectedScopeId.value) {
    return '';
  }
  const duplicate = roleBindings.value.find(
    (binding) =>
      binding.userId === assignmentForm.userId &&
      binding.role === assignmentForm.role &&
      binding.scopeType === assignmentForm.scopeType &&
      binding.scopeId === selectedScopeId.value,
  );
  return duplicate ? '该用户在当前目标上已有相同角色绑定，请选择其他角色或目标。' : '';
});
const drawerTitle = computed(() => {
  if (activeDrawer.value === 'createUser') return '新建账号';
  if (activeDrawer.value === 'editUser') return '编辑账号';
  if (activeDrawer.value === 'assignment') return '数据权限分配向导';
  return '绑定详情';
});
const drawerEyebrow = computed(() => {
  if (activeDrawer.value === 'assignment') return 'RBAC';
  if (activeDrawer.value === 'bindingDetail') return '只读详情';
  return '账号';
});
const modalTitle = computed(() => {
  if (activeModal.value === 'resetPassword') return '重置密码';
  if (activeModal.value === 'deleteBinding') return '删除绑定';
  return '账号状态确认';
});

onMounted(load);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [me, nextUsers, nextBindings, catalog, types] = await Promise.all([
      apiClient.getCurrentUser(),
      apiClient.listUsers(),
      apiClient.listRoleBindings(),
      apiClient.getRbacCatalog(),
      apiClient.listDatasetTypes(),
    ]);
    currentUser.value = me;
    users.value = nextUsers;
    roleBindings.value = nextBindings;
    rbacCatalog.value = catalog;
    datasetTypes.value = types ?? [];
    if (!assignmentForm.userId && nextUsers[0]) {
      assignmentForm.userId = nextUsers[0].userId;
    }
    if (!assignmentForm.datasetType && datasetTypes.value[0]) {
      assignmentForm.datasetType = datasetTypes.value[0].datasetType;
      assignmentForm.batchId = datasetTypes.value[0].batches[0]?.id ?? '';
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

function openCreateUserDrawer() {
  closeModal();
  resetUserForm();
  activeDrawer.value = 'createUser';
}

function openEditUserDrawer(user: UserAccount) {
  closeModal();
  selectedUser.value = user;
  userForm.userId = user.userId;
  userForm.username = user.username ?? user.userId;
  userForm.displayName = user.displayName;
  userForm.email = user.email ?? '';
  userForm.password = '';
  drawerError.value = '';
  activeDrawer.value = 'editUser';
}

function openAssignmentDrawer(user?: UserAccount) {
  closeModal();
  drawerError.value = '';
  selectedBinding.value = undefined;
  if (user) {
    assignmentForm.userId = user.userId;
  } else if (!assignmentForm.userId && users.value[0]) {
    assignmentForm.userId = users.value[0].userId;
  }
  if (!assignmentForm.datasetType && datasetTypes.value[0]) {
    assignmentForm.datasetType = datasetTypes.value[0].datasetType;
  }
  if (assignmentForm.scopeType === 'dataset_batch' && !assignmentForm.batchId) {
    assignmentForm.batchId = batchesForSelectedType.value[0]?.id ?? '';
  }
  activeDrawer.value = 'assignment';
  activeTab.value = 'assignment';
}

function openBindingDetailDrawer(binding: RoleBinding) {
  closeModal();
  selectedBinding.value = binding;
  drawerError.value = '';
  activeDrawer.value = 'bindingDetail';
}

function openResetPasswordModal(user: UserAccount) {
  closeDrawer();
  selectedUser.value = user;
  passwordForm.password = '';
  modalError.value = '';
  activeModal.value = 'resetPassword';
}

function openDeleteBindingModal(binding: RoleBinding) {
  closeDrawer();
  selectedBinding.value = binding;
  modalError.value = '';
  activeModal.value = 'deleteBinding';
}

function openToggleUserModal(user: UserAccount) {
  closeDrawer();
  selectedUser.value = user;
  modalError.value = '';
  activeModal.value = 'toggleUser';
}

function closeDrawer() {
  activeDrawer.value = null;
  selectedBinding.value = undefined;
  drawerError.value = '';
  resetUserForm();
}

function closeModal() {
  activeModal.value = null;
  modalError.value = '';
  passwordForm.password = '';
}

function resetUserForm() {
  selectedUser.value = undefined;
  userForm.userId = '';
  userForm.username = '';
  userForm.displayName = '';
  userForm.email = '';
  userForm.password = '';
}

async function submitUserForm() {
  drawerError.value = '';
  try {
    if (activeDrawer.value === 'createUser') {
      if (!userForm.username || !userForm.displayName || userForm.password.length < 8) {
        drawerError.value = '请填写账号、姓名，并设置至少 8 位初始密码。';
        return;
      }
      await apiClient.createUser({
        username: userForm.username,
        displayName: userForm.displayName,
        email: userForm.email || undefined,
        password: userForm.password,
        status: 'active',
      });
    } else if (selectedUser.value) {
      await apiClient.updateUser(selectedUser.value.userId, {
        displayName: userForm.displayName,
        email: userForm.email || undefined,
      });
    }
    closeDrawer();
    await load();
  } catch (err) {
    drawerError.value = apiErrorMessage(err, '账号保存失败');
  }
}

async function submitResetPassword() {
  if (!selectedUser.value) return;
  modalError.value = '';
  if (passwordForm.password.length < 8) {
    modalError.value = '新密码至少 8 位。';
    return;
  }
  try {
    await apiClient.updateUser(selectedUser.value.userId, { password: passwordForm.password });
    closeModal();
  } catch (err) {
    modalError.value = apiErrorMessage(err, '密码重置失败');
  }
}

async function submitAssignment() {
  drawerError.value = '';
  if (!assignmentForm.userId || !assignmentForm.role || !selectedScopeId.value) {
    drawerError.value = '请完成用户、目标和角色选择。';
    return;
  }
  if (assignmentConflict.value) {
    return;
  }
  const payload: RoleBindingCreatePayload = {
    userId: assignmentForm.userId,
    role: assignmentForm.role,
    scopeType: assignmentForm.scopeType,
    scopeId: selectedScopeId.value,
  };
  try {
    await apiClient.createRoleBinding(payload);
    closeDrawer();
    await load();
  } catch (err) {
    drawerError.value = apiErrorMessage(err, '角色绑定失败');
  }
}

async function confirmDeleteBinding() {
  if (!selectedBinding.value) return;
  modalError.value = '';
  try {
    await apiClient.deleteRoleBinding(selectedBinding.value.bindingId);
    closeModal();
    await load();
  } catch (err) {
    modalError.value = apiErrorMessage(err, '删除绑定失败');
  }
}

async function confirmToggleUser() {
  if (!selectedUser.value) return;
  if (selectedUser.value.userId === currentUser.value?.userId && selectedUser.value.status !== 'disabled') {
    modalError.value = '当前登录账号不能在前端直接禁用。';
    return;
  }
  modalError.value = '';
  try {
    await apiClient.updateUser(selectedUser.value.userId, {
      status: selectedUser.value.status === 'disabled' ? 'active' : 'disabled',
    });
    closeModal();
    await load();
  } catch (err) {
    modalError.value = apiErrorMessage(err, '账号状态更新失败');
  }
}

function onAssignmentScopeChange() {
  if (assignmentForm.scopeType === 'platform') {
    assignmentForm.datasetType = '';
    assignmentForm.batchId = '';
    return;
  }
  if (!assignmentForm.datasetType && datasetTypes.value[0]) {
    assignmentForm.datasetType = datasetTypes.value[0].datasetType;
  }
  if (assignmentForm.scopeType === 'dataset_batch') {
    assignmentForm.batchId = batchesForSelectedType.value[0]?.id ?? '';
  } else {
    assignmentForm.batchId = '';
  }
}

function onAssignmentDatasetTypeChange() {
  assignmentForm.batchId = assignmentForm.scopeType === 'dataset_batch' ? batchesForSelectedType.value[0]?.id ?? '' : '';
}

function rolesForUser(userId: string) {
  const directRoles = users.value.find((user) => user.userId === userId)?.roles ?? [];
  return Array.from(new Set([...(bindingsByUser.value[userId] ?? []), ...directRoles]));
}

function roleLabel(role: UserRole | string) {
  return roleOptions.value.find((item) => item.role === role)?.label ?? role;
}

function permissionsForRole(role: UserRole | string) {
  return roleOptions.value.find((item) => item.role === role)?.permissions ?? [];
}

function userStatusLabel(status: string) {
  return status === 'disabled' ? '已停用' : '启用中';
}

function scopeText(scopeType: RoleScopeType, scopeId: string) {
  const label = scopeOptions.value.find((item) => item.scopeType === scopeType)?.label ?? scopeType;
  return `${label} · ${scopeId}`;
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

function bindingCountByScope(scopeType: RoleScopeType) {
  return roleBindings.value.filter((binding) => binding.scopeType === scopeType).length;
}

function permissionLabel(permission: string) {
  const labels: Record<string, string> = {
    'users:manage': '账号管理',
    'roles:manage': '角色管理',
    'dataset_type:create': '类型创建',
    'label_config:manage': '标签配置',
    'import_job:manage': '导入任务',
    'batch_assignment:manage': '批次分配',
    'lease:force_release': '释放租约',
    'dataset:read': '数据读取',
    'qc_queue:read': '质检队列',
    'audit:read': '审计读取',
    'audit:read_own': '本人审计',
    'qc_progress:read': '质检进度',
    'qc_progress:read_own': '本人进度',
    'label_edit:confirm': '提交确认',
    'label_edit:write': '标签编辑',
    'label.edit': '标签编辑',
  };
  return labels[permission] ?? permission;
}

function apiErrorMessage(err: unknown, fallback: string) {
  if (err instanceof ApiClientError) {
    if (err.status === 409) {
      return err.payload?.message ?? '操作冲突，请刷新后重试。';
    }
    return err.payload?.message ?? err.message;
  }
  return err instanceof Error ? err.message : fallback;
}

</script>

<style scoped>
.permissions-page {
  display: grid;
  gap: 16px;
}

.permissions-header {
  align-items: center;
}

.permissions-command-panel {
  display: grid;
  gap: 14px;
  padding: 16px;
}

.command-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.command-metrics div,
.assignment-summary-grid div {
  display: grid;
  gap: 5px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-subtle);
}

.command-metrics span,
.assignment-summary-grid span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 760;
}

.command-metrics strong,
.assignment-summary-grid strong {
  font-size: 22px;
}

.toolbar-grid {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) minmax(150px, 0.32fr) minmax(170px, 0.36fr);
  gap: 10px;
}

.search-field {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
}

.search-field input {
  border: 0;
  min-height: 34px;
  padding: 0;
}

.segmented-tabs {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
  width: fit-content;
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-subtle);
}

.segmented-tabs button {
  min-height: 34px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  padding: 0 12px;
}

.segmented-tabs button.active {
  background: var(--blue);
  color: #fff;
}

.command-section {
  overflow: hidden;
}

.account-list,
.binding-list,
.compact-binding-list {
  display: grid;
  gap: 10px;
  padding: 16px;
}

.account-row,
.binding-row {
  display: grid;
  gap: 12px;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  padding: 12px;
}

.account-row {
  grid-template-columns: minmax(0, 1.2fr) auto minmax(170px, 0.75fr) auto;
}

.binding-row {
  grid-template-columns: max-content minmax(0, 1fr) auto;
}

.account-identity,
.binding-detail,
.compact-binding-list article {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.account-identity strong,
.binding-detail strong,
.compact-binding-list strong {
  overflow-wrap: anywhere;
  font-size: 15px;
}

.account-identity span,
.binding-detail span,
.compact-binding-list small {
  overflow-wrap: anywhere;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}

.role-tags,
.permission-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.role-tags span,
.role-pill,
.permission-tags span,
.detail-permission {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  border: 1px solid color-mix(in srgb, var(--blue) 28%, var(--line));
  border-radius: 8px;
  background: var(--blue-soft);
  color: var(--blue);
  padding: 0 9px;
  font-size: 13px;
  font-weight: 850;
  white-space: nowrap;
}

.role-tag-empty {
  border-style: dashed !important;
  background: var(--panel-subtle) !important;
  color: var(--muted) !important;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.assignment-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding: 16px 16px 0;
}

.empty-inline {
  border: 1px dashed var(--line);
  border-radius: 8px;
  color: var(--muted);
  padding: 16px;
  font-weight: 800;
  text-align: center;
}

.drawer-backdrop,
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(15, 23, 42, 0.24);
}

.right-drawer {
  position: fixed;
  top: 0;
  right: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: min(560px, 100vw);
  height: 100vh;
  overflow: auto;
  border-left: 1px solid var(--line);
  background: var(--panel);
  box-shadow: -18px 0 50px rgba(15, 23, 42, 0.18);
}

.drawer-header,
.confirm-modal header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px;
  border-bottom: 1px solid var(--line);
}

.drawer-header span {
  color: var(--blue);
  font-size: 12px;
  font-weight: 850;
}

.drawer-header h2,
.confirm-modal h2 {
  margin: 3px 0 0;
  font-size: 22px;
}

.icon-button {
  display: inline-grid;
  place-items: center;
  min-width: 34px;
  min-height: 34px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  color: var(--text);
  padding: 0;
}

.drawer-form,
.drawer-detail,
.modal-form {
  display: grid;
  gap: 14px;
  padding: 18px;
}

.drawer-form label,
.modal-form label {
  display: grid;
  gap: 6px;
}

.drawer-form label span,
.modal-form label span,
.fixed-scope span,
.drawer-detail dt {
  color: var(--muted);
  font-size: 12px;
  font-weight: 760;
}

input,
select {
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  color: var(--text);
}

.wizard-steps {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.fixed-scope {
  display: grid;
  gap: 6px;
  padding: 11px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-subtle);
}

.permission-preview {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-subtle);
}

.drawer-detail dl {
  display: grid;
  gap: 12px;
  margin: 0;
}

.drawer-detail div {
  display: grid;
  gap: 6px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}

.drawer-detail dd {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  overflow-wrap: anywhere;
  font-weight: 760;
}

.drawer-actions,
.modal-form footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.inline-error,
.inline-warning {
  margin: 0;
  border-radius: 8px;
  padding: 10px 12px;
  font-weight: 760;
}

.inline-error {
  border: 1px solid #fecaca;
  background: #fff5f5;
  color: #b4232a;
}

.inline-warning {
  border: 1px solid #fde68a;
  background: #fffbeb;
  color: #92400e;
}

.confirm-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  display: grid;
  width: min(460px, calc(100vw - 28px));
  overflow: hidden;
  transform: translate(-50%, -50%);
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.22);
}

.button--danger {
  border-color: #fecaca;
  background: #fff5f5;
  color: #b4232a;
}

@media (max-width: 980px) {
  .command-metrics,
  .toolbar-grid,
  .assignment-summary-grid,
  .account-row,
  .binding-row {
    grid-template-columns: 1fr;
  }

  .row-actions,
  .drawer-actions,
  .modal-form footer {
    justify-content: flex-start;
  }
}
</style>

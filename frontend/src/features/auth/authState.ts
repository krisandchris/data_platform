import { computed, ref } from 'vue';
import { ApiClientError } from '../../services/http';
import { apiClient } from '../../services/urbanViolationApi';
import type { CurrentUser, LoginPayload, UserAccount, UserRole } from '../../shared/types/contract';

const currentUser = ref<CurrentUser>();
const users = ref<UserAccount[]>([]);
const loading = ref(false);
const error = ref('');
let loadPromise: Promise<CurrentUser | undefined> | undefined;

export const isDevAuthSwitchEnabled = import.meta.env.DEV;

export function useAuthState() {
  const roles = computed(() => currentUser.value?.roles ?? []);
  const permissions = computed(() => currentUser.value?.permissions ?? []);
  const canManageUsers = computed(() => userCanManageUsers(currentUser.value));
  const canManageAssignments = computed(
    () =>
      userHasAnyPermission(currentUser.value, ['batch_assignment:manage', 'batch:assign', 'batch:reassign']) ||
      canFallbackToRoles(currentUser.value, ['platform_admin', 'dataset_admin', 'batch_manager', 'qc_lead']),
  );
  const canConfirmSubmissions = computed(
    () =>
      userHasAnyPermission(currentUser.value, ['qc_submission:confirm', 'qc:confirm']) ||
      canFallbackToRoles(currentUser.value, ['platform_admin', 'dataset_admin', 'qc_lead']),
  );
  const canReadAudit = computed(() => userCanReadAudit(currentUser.value));

  return {
    currentUser,
    users,
    loading,
    error,
    roles,
    permissions,
    canManageUsers,
    canManageAssignments,
    canConfirmSubmissions,
    canReadAudit,
    loadCurrentUser,
    ensureCurrentUser,
    loadUsers,
    login,
    logout,
    switchDevUser,
  };
}

export async function ensureCurrentUser() {
  if (currentUser.value) {
    return currentUser.value;
  }
  return loadCurrentUser();
}

export async function loadCurrentUser() {
  if (loadPromise) {
    return loadPromise;
  }
  loading.value = true;
  error.value = '';
  loadPromise = apiClient
    .getCurrentUser()
    .then((user) => {
      currentUser.value = user;
      return user;
    })
    .catch((err) => {
      currentUser.value = undefined;
      if (err instanceof ApiClientError && err.status === 401) {
        error.value = err.payload?.message ?? '请先登录';
        return undefined;
      }
      error.value = err instanceof Error ? err.message : '无法读取当前用户';
      return undefined;
    })
    .finally(() => {
      loading.value = false;
      loadPromise = undefined;
    });
  return loadPromise;
}

export async function loadUsers() {
  users.value = await apiClient.listUsers();
  return users.value;
}

export async function login(payload: LoginPayload) {
  const user = await apiClient.login(payload);
  currentUser.value = user;
  return user;
}

export async function logout() {
  try {
    await apiClient.logout();
  } finally {
    currentUser.value = undefined;
  }
}

export async function switchDevUser(userId: string) {
  try {
    window.localStorage.setItem('uvp.devUserId', userId);
  } catch {
    // localStorage may be unavailable in non-browser tests.
  }
  currentUser.value = undefined;
  return loadCurrentUser();
}

function hasAnyRole(actual: UserRole[], expected: UserRole[]) {
  return expected.some((role) => actual.includes(role));
}

export function userCanManageUsers(user: CurrentUser | undefined) {
  return userHasAnyPermission(user, ['users:manage', 'roles:manage']) || canFallbackToRoles(user, ['platform_admin']);
}

export function userCanReadAudit(user: CurrentUser | undefined) {
  return (
    userHasAnyPermission(user, ['audit:read']) ||
    canFallbackToRoles(user, ['platform_admin', 'dataset_admin', 'batch_manager', 'qc_lead', 'auditor'])
  );
}

export function userHasAnyPermission(user: CurrentUser | undefined, required: string[]) {
  const actual = new Set((user?.permissions ?? []).flatMap(permissionVariants));
  return required.some((permission) => permissionVariants(permission).some((candidate) => actual.has(candidate)));
}

function canFallbackToRoles(user: CurrentUser | undefined, expectedRoles: UserRole[]) {
  if (!user || user.permissions.length > 0) {
    return false;
  }
  return hasAnyRole(user.roles ?? [], expectedRoles);
}

function permissionVariants(permission: string) {
  const trimmed = permission.trim();
  if (!trimmed) {
    return [];
  }
  const normalizedColon = trimmed.replace(/\./g, ':');
  const normalizedDot = trimmed.replace(/:/g, '.');
  return Array.from(new Set([trimmed, normalizedColon, normalizedDot]));
}

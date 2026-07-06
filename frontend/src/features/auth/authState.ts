import { computed, ref } from 'vue';
import { apiClient } from '../../services/urbanViolationApi';
import type { CurrentUser } from '../../shared/types/contract';

const currentUser = ref<CurrentUser>();
const loading = ref(false);
const error = ref('');
let loadPromise: Promise<CurrentUser | undefined> | undefined;

export function useAuthState() {
  return {
    currentUser,
    users: ref<CurrentUser[]>([]),
    loading,
    error,
    roles: computed(() => currentUser.value?.roles ?? []),
    permissions: computed(() => currentUser.value?.permissions ?? []),
    canManageUsers: computed(() => false),
    canManageAssignments: computed(() => true),
    canConfirmSubmissions: computed(() => true),
    canReadAudit: computed(() => false),
    loadCurrentUser,
    ensureCurrentUser,
    loadUsers: async () => [],
    login: loadCurrentUser,
    logout: async () => {
      currentUser.value = undefined;
    },
    switchDevUser: loadCurrentUser,
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
      error.value = err instanceof Error ? err.message : '无法读取当前用户';
      return undefined;
    })
    .finally(() => {
      loading.value = false;
      loadPromise = undefined;
    });
  return loadPromise;
}

export function userHasAnyPermission(user: CurrentUser | undefined, required: string[]) {
  const actual = new Set((user?.permissions ?? []).flatMap(permissionVariants));
  return required.some((permission) => permissionVariants(permission).some((candidate) => actual.has(candidate)));
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

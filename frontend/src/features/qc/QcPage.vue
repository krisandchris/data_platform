<template>
  <div>
    <header class="page-header">
      <div>
        <h1 class="page-title">质检工作台</h1>
        <p class="page-subtitle">批次单人分配、样本任务状态、lease 与 qc_lead 二次确认。</p>
      </div>
    </header>

    <div v-if="loading" class="loading-state">Loading QC workspace...</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>
    <div v-else class="qc-workspace">
      <section class="panel assignment-panel">
        <div class="panel__header">
          <h2 class="panel__title">Batch Assignment</h2>
          <StatusChip :value="workspace?.assignment?.status ?? 'unassigned'" />
        </div>
        <div class="assignment-body">
          <div class="assignment-summary">
            <span>Assignee</span>
            <strong>{{ assignmentText }}</strong>
            <em>{{ workspace?.assignment?.updatedAt || workspace?.assignment?.assignedAt || 'no assignment yet' }}</em>
          </div>
          <form v-if="canManageAssignments" class="assignment-actions" @submit.prevent="assignBatch">
            <select v-model="selectedAssignee" :disabled="assignmentPending || !assignableUsers.length">
              <option v-for="user in assignableUsers" :key="user.userId" :value="user.userId">
                {{ user.displayName }} · {{ userRoleText(user) }}
              </option>
            </select>
            <button type="submit" :disabled="assignmentPending || !selectedAssignee">
              {{ assignmentAction === 'assign' ? '处理中...' : hasActiveAssignment ? '重新分配' : '分配批次' }}
            </button>
            <button type="button" :disabled="assignmentPending || !hasActiveAssignment" @click="releaseBatch">
              {{ assignmentAction === 'release' ? '释放中...' : '释放批次' }}
            </button>
          </form>
          <p v-if="canManageAssignments && !assignableUsers.length" class="assignment-message assignment-message--error">
            没有可分配用户，请先在权限管理中创建并启用账号。
          </p>
          <p v-if="assignableUsersError" class="assignment-message assignment-message--error">{{ assignableUsersError }}</p>
          <p v-if="assignmentActionMessage" class="assignment-message" :class="`assignment-message--${assignmentActionTone}`">
            {{ assignmentActionMessage }}
          </p>
        </div>
      </section>

      <section class="panel progress-panel">
        <div class="panel__header">
          <h2 class="panel__title">任务进度</h2>
          <span class="muted">{{ visibleQueue.length }} visible / {{ workspace?.queue.length ?? 0 }} total</span>
        </div>
        <div class="tab-row" aria-label="QC task filters">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
            <span>{{ tabCount(tab.key) }}</span>
          </button>
        </div>
      </section>

      <section v-if="submittedQueue.length" class="panel submitted-panel">
        <div class="panel__header">
          <h2 class="panel__title">Submitted confirmation queue</h2>
          <span class="muted">{{ submittedQueue.length }} submitted</span>
        </div>
        <div class="submitted-list">
          <article v-for="item in submittedQueue" :key="item.sampleId" class="submitted-row">
            <div>
              <strong>{{ item.sampleId }}</strong>
              <span>
                {{ item.latestSubmission?.userDisplayName || item.assigneeDisplayName || item.assigneeUserId || 'unknown' }}
                · {{ item.latestSubmission?.submittedAt || item.task?.submittedAt || 'submitted' }}
              </span>
            </div>
            <span>{{ item.latestSubmission?.operations.length ?? 0 }} patch ops</span>
            <RouterLink :to="`/datasets/${id}/samples/${item.sampleId}/review`">查看</RouterLink>
            <button type="button" :disabled="!canConfirmSubmissions" @click="confirmSubmission(item)">确认提交</button>
            <button type="button" :disabled="!canConfirmSubmissions" @click="returnSubmission(item)">退回修改</button>
          </article>
        </div>
      </section>

      <section class="panel">
        <div class="panel__header">
          <h2 class="panel__title">{{ activeTabLabel }}</h2>
          <span class="muted">{{ filteredQueue.length }} samples</span>
        </div>
        <div v-if="filteredQueue.length === 0" class="empty-state">No QC task matched this view.</div>
        <div v-else class="queue-list">
          <div class="queue-row queue-row--head" aria-hidden="true">
            <span>sample_id</span>
            <span>状态</span>
            <span>类别</span>
            <span>负责人</span>
            <span>Lease</span>
            <span>Label Config</span>
            <span>提交</span>
            <span>操作</span>
          </div>
          <RouterLink
            v-for="item in paginatedQueue"
            :key="item.sampleId"
            class="queue-row"
            :class="{ readonly: !canOpenEditable(item) }"
            :to="`/datasets/${id}/samples/${item.sampleId}/review`"
          >
            <span class="queue-cell queue-cell--sample" :title="item.sampleId">{{ item.sampleId }}</span>
            <span class="queue-cell"><StatusChip :value="item.taskStatus ?? item.status" /></span>
            <span class="queue-cell" :title="item.primaryCategory ?? 'uncategorized'">{{ item.primaryCategory ?? 'uncategorized' }}</span>
            <span class="queue-cell" :title="item.assigneeDisplayName || item.assigneeUserId || 'unassigned'">
              {{ item.assigneeDisplayName || item.assigneeUserId || 'unassigned' }}
            </span>
            <span class="queue-cell" :title="item.leaseStatus ?? 'none'">{{ item.leaseStatus ?? 'none' }}</span>
            <span class="queue-cell" :title="item.labelConfigVersion ?? item.task?.labelConfigVersion ?? '-'">
              {{ item.labelConfigVersion ?? item.task?.labelConfigVersion ?? '-' }}
            </span>
            <span class="queue-cell" :title="item.latestSubmission?.submittedAt || item.latestSubmission?.status || '-'">
              {{ item.latestSubmission?.submittedAt || item.latestSubmission?.status || '-' }}
            </span>
            <span class="queue-cell queue-cell--action">查看</span>
          </RouterLink>
        </div>

        <div v-if="filteredQueue.length" class="pagination-bar" aria-label="质检任务分页">
          <span>{{ queuePaginationText }}</span>
          <div class="pagination-bar__controls">
            <button type="button" :disabled="queuePage === 1" aria-label="上一页" @click="queuePage = Math.max(1, queuePage - 1)">
              <ChevronLeft :size="16" />
            </button>
            <strong>{{ queuePage }} / {{ queueTotalPages }}</strong>
            <button
              type="button"
              :disabled="queuePage === queueTotalPages"
              aria-label="下一页"
              @click="queuePage = Math.min(queueTotalPages, queuePage + 1)"
            >
              <ChevronRight :size="16" />
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { ApiClientError } from '../../services/http';
import { apiClient } from '../../services/urbanViolationApi';
import StatusChip from '../../shared/components/StatusChip.vue';
import type { QcQueueItem, QcTaskStatus, QcWorkspace, UserAccount } from '../../shared/types/contract';
import { useAuthState } from '../auth/authState';

const props = defineProps<{ id: string }>();
const { currentUser, canManageAssignments, canConfirmSubmissions, loadCurrentUser } = useAuthState();
const workspace = ref<QcWorkspace>();
const users = ref<UserAccount[]>([]);
const loading = ref(true);
const error = ref('');
const assignableUsersError = ref('');
const assignmentActionMessage = ref('');
const assignmentActionTone = ref<'success' | 'error'>('success');
const assignmentAction = ref<'' | 'assign' | 'release'>('');
const selectedAssignee = ref('annotator_a');
const activeTab = ref<'mine' | 'in_progress' | 'skipped' | 'submitted' | 'confirmed' | 'returned'>('mine');
const queuePageSize = 10;
const queuePage = ref(1);
const tabs = [
  { key: 'mine' as const, label: '我的批次' },
  { key: 'in_progress' as const, label: '进行中样本' },
  { key: 'skipped' as const, label: '已跳过' },
  { key: 'submitted' as const, label: '已提交' },
  { key: 'confirmed' as const, label: '已确认' },
  { key: 'returned' as const, label: '已退回' },
];

onMounted(load);

const assignableUsers = computed(() => users.value.filter((user) => user.status === 'active'));
const assignmentPending = computed(() => assignmentAction.value !== '');
const hasActiveAssignment = computed(() => {
  const assignment = workspace.value?.assignment;
  return Boolean(assignment && assignment.status !== 'revoked');
});
const assignmentText = computed(() => {
  const assignment = workspace.value?.assignment;
  if (!assignment || assignment.status === 'revoked') return '未分配';
  return `${assignment.assigneeDisplayName || assignment.assigneeUserId} · ${assignment.status}`;
});
const visibleQueue = computed(() => {
  const queue = workspace.value?.queue ?? [];
  const user = currentUser.value;
  if (!user?.roles.includes('annotator')) return queue;
  return queue.filter((item) => item.assigneeUserId === user.userId || workspace.value?.assignment?.assigneeUserId === user.userId);
});
const submittedQueue = computed(() =>
  (workspace.value?.queue ?? []).filter((item) => taskStatus(item) === 'submitted'),
);
const filteredQueue = computed(() =>
  visibleQueue.value.filter((item) => {
    if (activeTab.value === 'mine') {
      return !currentUser.value || item.assigneeUserId === currentUser.value.userId || workspace.value?.assignment?.assigneeUserId === currentUser.value.userId;
    }
    return statusMatches(activeTab.value, taskStatus(item));
  }),
);
const activeTabLabel = computed(() => tabs.find((tab) => tab.key === activeTab.value)?.label ?? 'QC tasks');
const queueTotalPages = computed(() => Math.max(1, Math.ceil(filteredQueue.value.length / queuePageSize)));
const queuePageStartIndex = computed(() => (filteredQueue.value.length ? (queuePage.value - 1) * queuePageSize : 0));
const queuePageEndIndex = computed(() => Math.min(filteredQueue.value.length, queuePageStartIndex.value + queuePageSize));
const paginatedQueue = computed(() => filteredQueue.value.slice(queuePageStartIndex.value, queuePageEndIndex.value));
const queuePaginationText = computed(() =>
  filteredQueue.value.length
    ? `显示 ${queuePageStartIndex.value + 1}-${queuePageEndIndex.value} / ${filteredQueue.value.length}，每页 ${queuePageSize} 条`
    : `显示 0 / 0，每页 ${queuePageSize} 条`,
);

watch(activeTab, () => {
  queuePage.value = 1;
});
watch(
  () => filteredQueue.value.length,
  () => {
    if (queuePage.value > queueTotalPages.value) {
      queuePage.value = queueTotalPages.value;
    }
  },
);

async function load() {
  loading.value = true;
  error.value = '';
  assignableUsersError.value = '';
  try {
    const [user, nextWorkspace, nextUsersResult] = await Promise.all([
      loadCurrentUser(),
      apiClient.getQcWorkspace(props.id),
      loadAssignableUsers(),
    ]);
    workspace.value = nextWorkspace;
    assignableUsersError.value = nextUsersResult.error;
    users.value = nextUsersResult.users.length
      ? nextUsersResult.users
      : nextUsersResult.error && user?.status === 'active'
        ? [user]
        : [];
    const activeUsers = users.value.filter((item) => item.status === 'active');
    const preferredAssignee = nextWorkspace.assignment?.assigneeUserId;
    selectedAssignee.value =
      activeUsers.find((item) => item.userId === preferredAssignee)?.userId || activeUsers[0]?.userId || '';
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to load QC workspace';
  } finally {
    loading.value = false;
  }
}

async function loadAssignableUsers(): Promise<{ users: UserAccount[]; error: string }> {
  try {
    const nextUsers = await apiClient.listBatchAssignableUsers(props.id);
    return { users: nextUsers, error: '' };
  } catch (err) {
    return { users: [], error: assignableUsersErrorMessage(err) };
  }
}

async function assignBatch() {
  if (!selectedAssignee.value) return;
  assignmentAction.value = 'assign';
  assignmentActionMessage.value = '';
  try {
    if (hasActiveAssignment.value) {
      await apiClient.reassignBatch(props.id, { assigneeUserId: selectedAssignee.value });
      assignmentActionMessage.value = '已重新分配批次。';
    } else {
      await apiClient.assignBatch(props.id, { assigneeUserId: selectedAssignee.value });
      assignmentActionMessage.value = '已分配批次。';
    }
    assignmentActionTone.value = 'success';
    await load();
  } catch (err) {
    assignmentActionTone.value = 'error';
    assignmentActionMessage.value = assignmentErrorMessage(err, '批次分配失败。');
  } finally {
    assignmentAction.value = '';
  }
}

async function releaseBatch() {
  assignmentAction.value = 'release';
  assignmentActionMessage.value = '';
  try {
    await apiClient.releaseBatchAssignment(props.id);
    assignmentActionTone.value = 'success';
    assignmentActionMessage.value = '已释放批次。';
    await load();
  } catch (err) {
    assignmentActionTone.value = 'error';
    assignmentActionMessage.value = assignmentErrorMessage(err, '释放批次失败。');
  } finally {
    assignmentAction.value = '';
  }
}

async function confirmSubmission(item: QcQueueItem) {
  const submissionId = item.latestSubmission?.submissionId || item.task?.latestSubmissionId;
  if (!submissionId) return;
  await apiClient.confirmLabelEditSubmission(props.id, item.sampleId, submissionId);
  await load();
}

async function returnSubmission(item: QcQueueItem) {
  const submissionId = item.latestSubmission?.submissionId || item.task?.latestSubmissionId;
  if (!submissionId) return;
  await apiClient.returnLabelEditSubmission(props.id, item.sampleId, submissionId, 'qc_lead returned from queue');
  await load();
}

function taskStatus(item: QcQueueItem): QcTaskStatus {
  return item.taskStatus ?? item.task?.status ?? statusFromQc(item.status);
}

function statusFromQc(status: QcQueueItem['status']): QcTaskStatus {
  if (status === 'passed') return 'confirmed';
  if (status === 'manual_label_required') return 'returned';
  if (status === 'needs_review') return 'assigned';
  return 'queued';
}

function statusMatches(tab: typeof activeTab.value, status: QcTaskStatus) {
  if (tab === 'in_progress') return status === 'assigned' || status === 'in_progress' || status === 'draft_saved';
  if (tab === 'skipped') return status === 'skipped';
  if (tab === 'submitted') return status === 'submitted';
  if (tab === 'confirmed') return status === 'confirmed' || status === 'completed';
  if (tab === 'returned') return status === 'returned';
  return true;
}

function tabCount(tab: typeof activeTab.value) {
  if (tab === 'mine') return visibleQueue.value.length;
  return visibleQueue.value.filter((item) => statusMatches(tab, taskStatus(item))).length;
}

function canOpenEditable(item: QcQueueItem) {
  return Boolean(currentUser.value && workspace.value?.assignment?.assigneeUserId === currentUser.value.userId && item.assigneeUserId === currentUser.value.userId);
}

function userRoleText(user: UserAccount) {
  const roles = user.roles;
  return roles?.length ? roles.join(', ') : 'active';
}

function assignableUsersErrorMessage(err: unknown) {
  if (err instanceof ApiClientError) {
    if (err.status === 403) {
      return '当前账号没有批次分配权限。';
    }
    if ([404, 405, 501].includes(err.status)) {
      return '可分配用户接口不可用，已临时仅显示当前账号。';
    }
    return err.payload?.message ?? '可分配用户加载失败，已临时仅显示当前账号。';
  }
  return '可分配用户加载失败，已临时仅显示当前账号。';
}

function assignmentErrorMessage(err: unknown, fallback: string) {
  if (err instanceof ApiClientError) {
    const code = err.payload?.code ?? '';
    if (err.status === 403) {
      return '当前账号没有批次分配权限。';
    }
    if (code.includes('queue') || code.includes('qc_queue')) {
      return '请先生成质检队列。';
    }
    if (
      code.includes('assignee') ||
      code.includes('user_not_found') ||
      code.includes('user_disabled') ||
      (err.status === 422 && fallback.includes('分配'))
    ) {
      return '被分配账号不存在或已停用。';
    }
    if (err.status === 409) {
      return err.payload?.message ?? '批次分配状态冲突，请刷新后重试。';
    }
    if (err.status === 422) {
      return err.payload?.message ?? '批次分配请求无效，请刷新后重试。';
    }
    return err.payload?.message ?? fallback;
  }
  return err instanceof Error && err.message ? err.message : fallback;
}
</script>

<style scoped>
.qc-workspace {
  display: grid;
  gap: 16px;
}

.assignment-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(420px, 0.8fr);
  gap: 12px;
  padding: 14px;
}

.assignment-summary {
  display: grid;
  gap: 4px;
}

.assignment-summary span,
.assignment-summary em,
.queue-cell,
.submitted-row span {
  color: var(--muted);
  font-size: 12px;
}

.assignment-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 10px;
}

.assignment-actions select,
.assignment-actions button,
.tab-row button,
.submitted-row button {
  min-height: 34px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  padding: 0 10px;
}

.assignment-actions button,
.submitted-row button {
  background: var(--blue);
  color: #fff;
  font-weight: 900;
}

.assignment-actions button:disabled,
.assignment-actions select:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.assignment-message {
  grid-column: 1 / -1;
  margin: 0;
  border-radius: 8px;
  padding: 9px 10px;
  font-size: 13px;
  font-weight: 800;
}

.assignment-message--success {
  border: 1px solid #c8f1d8;
  background: var(--green-soft);
  color: #16703a;
}

.assignment-message--error {
  border: 1px solid #ffd1d1;
  background: var(--red-soft);
  color: var(--red);
}

.tab-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 14px;
}

.tab-row button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  font-weight: 800;
}

.tab-row button.active {
  border-color: var(--blue);
  background: #eef4ff;
  color: var(--blue);
}

.tab-row span {
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  padding: 1px 7px;
}

.submitted-list {
  display: grid;
  gap: 8px;
  padding: 14px;
}

.submitted-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px auto auto auto;
  gap: 10px;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-subtle);
  padding: 10px;
}

.queue-list {
  display: grid;
  gap: 8px;
  overflow-x: auto;
  padding: 14px 16px 6px;
}

.queue-row {
  display: grid;
  grid-template-columns:
    minmax(150px, 1.25fr) minmax(82px, 0.55fr) minmax(110px, 0.85fr) minmax(105px, 0.8fr)
    minmax(72px, 0.5fr) minmax(118px, 0.9fr) minmax(96px, 0.72fr) 42px;
  gap: 8px;
  align-items: center;
  min-width: 0;
  min-height: 42px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  padding: 8px 10px;
}

.queue-row.readonly {
  background: #f8fafc;
}

.queue-row--head {
  min-height: 34px;
  background: var(--panel-subtle);
  border-color: transparent;
  color: #475467;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0;
  text-transform: uppercase;
}

.queue-cell,
.queue-row--head span {
  min-width: 0;
}

.queue-cell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-cell--sample {
  color: var(--blue);
  font-weight: 820;
  line-height: 1.32;
  overflow-wrap: anywhere;
  white-space: normal;
  word-break: break-word;
}

.queue-cell--action {
  justify-self: end;
  color: var(--blue);
  font-weight: 900;
}

.queue-row:not(.queue-row--head):hover {
  border-color: var(--blue);
}

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}

.pagination-bar__controls {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.pagination-bar button {
  display: inline-flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: #fff;
  color: var(--text);
}

.pagination-bar button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@media (max-width: 1080px) {
  .assignment-body,
  .assignment-actions,
  .submitted-row {
    grid-template-columns: 1fr;
  }
}
</style>

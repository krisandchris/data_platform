import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import DatasetTypePage from '../features/datasets/DatasetTypePage.vue';
import ImportJobPage from '../features/import/ImportJobPage.vue';
import QcPage from '../features/qc/QcPage.vue';
import ReviewWorkbenchPage from '../features/review-workbench/ReviewWorkbenchPage.vue';
import { ensureCurrentUser, userHasAnyPermission } from '../features/auth/authState';
import { isOfflineSingleUserMode, offlineDatasetId } from '../services/config';
import { apiClient } from '../services/urbanViolationApi';

const offlineUploadEntryPath = () => `/datasets/types/${offlineDatasetId()}?create=batch`;
const offlineRouteNames = new Set(['dataset-type', 'dataset-import-job', 'dataset-qc', 'sample-review']);

const offlineQcEntryPath = async () => {
  try {
    const group = await apiClient.getDatasetType(offlineDatasetId());
    const batch = group.batches[0];
    return batch ? `/datasets/${batch.id}/qc` : offlineUploadEntryPath();
  } catch {
    return offlineUploadEntryPath();
  }
};

const sharedOfflineRoutes: RouteRecordRaw[] = [
  { path: '/', redirect: () => offlineUploadEntryPath() },
  {
    path: '/import-jobs/:jobId',
    redirect: (route) => `/datasets/${offlineDatasetId()}/import-jobs/${String(route.params.jobId)}`,
  },
  {
    path: '/datasets/types/:datasetType',
    name: 'dataset-type',
    component: DatasetTypePage,
    props: (route) => ({
      datasetType: String(route.params.datasetType),
      section: 'overview',
    }),
  },
  {
    path: '/datasets/:id/import-jobs/:jobId',
    name: 'dataset-import-job',
    component: ImportJobPage,
    props: true,
  },
  {
    path: '/datasets/:id/qc',
    name: 'dataset-qc',
    component: QcPage,
    props: true,
  },
  {
    path: '/datasets/:id/samples/:sampleId/review',
    name: 'sample-review',
    component: ReviewWorkbenchPage,
    props: true,
  },
];

const fullRoutes: RouteRecordRaw[] = [
  { path: '/', redirect: '/datasets' },
  {
    path: '/import-jobs/:jobId',
    redirect: (route) => `/datasets/${offlineDatasetId()}/import-jobs/${String(route.params.jobId)}`,
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../features/auth/LoginPage.vue'),
    meta: { public: true },
  },
  {
    path: '/datasets',
    name: 'datasets',
    component: () => import('../features/datasets/DatasetsPage.vue'),
  },
  ...sharedOfflineRoutes.filter((route) => route.path !== '/' && route.path !== '/import-jobs/:jobId'),
  {
    path: '/datasets/types/:datasetType/label-config',
    name: 'dataset-type-label-config',
    component: DatasetTypePage,
    props: (route) => ({
      datasetType: String(route.params.datasetType),
      section: 'label-config',
    }),
  },
  {
    path: '/sample-pool',
    name: 'sample-pool',
    component: () => import('../features/sample-pool/SamplePoolPage.vue'),
  },
  {
    path: '/datasets/:id/overview',
    name: 'dataset-overview',
    component: () => import('../features/datasets/DatasetOverviewPage.vue'),
    props: true,
  },
  {
    path: '/datasets/:id/assets',
    name: 'dataset-assets',
    component: () => import('../features/datasets/DatasetAssetsPage.vue'),
    props: true,
  },
  {
    path: '/datasets/:id/preannotations',
    name: 'dataset-preannotations',
    component: () => import('../features/datasets/PreannotationsPage.vue'),
    props: true,
  },
  {
    path: '/account',
    name: 'account',
    component: () => import('../features/account/AccountPage.vue'),
  },
  {
    path: '/account/permissions',
    name: 'account-permissions',
    component: () => import('../features/users/UsersPage.vue'),
    meta: { requiresAnyPermission: ['users:manage', 'roles:manage'] },
  },
  {
    path: '/account/audit',
    name: 'account-audit',
    component: () => import('../features/audit/AuditPage.vue'),
    meta: { requiresAnyPermission: ['audit:read'] },
  },
  { path: '/users', redirect: '/account/permissions' },
  { path: '/audit', redirect: '/account/audit' },
];

export const router = createRouter({
  history: createWebHistory(),
  routes: isOfflineSingleUserMode() ? sharedOfflineRoutes : fullRoutes,
});

router.beforeEach(async (to) => {
  if (isOfflineSingleUserMode()) {
    if (to.name === 'dataset-qc' && String(to.params.id ?? '') === offlineDatasetId()) {
      return offlineQcEntryPath();
    }
    if (!offlineRouteNames.has(String(to.name ?? ''))) {
      return offlineUploadEntryPath();
    }
  }
  if (to.meta.public) {
    return true;
  }
  const user = await ensureCurrentUser();
  if (!user) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    };
  }
  const requiredPermissions = to.meta.requiresAnyPermission;
  if (Array.isArray(requiredPermissions) && !userHasAnyPermission(user, requiredPermissions.map(String))) {
    return { name: 'account' };
  }
  return true;
});

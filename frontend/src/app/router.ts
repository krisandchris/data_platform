import { createRouter, createWebHistory } from 'vue-router';
import LoginPage from '../features/auth/LoginPage.vue';
import DatasetsPage from '../features/datasets/DatasetsPage.vue';
import DatasetTypePage from '../features/datasets/DatasetTypePage.vue';
import DatasetOverviewPage from '../features/datasets/DatasetOverviewPage.vue';
import DatasetAssetsPage from '../features/datasets/DatasetAssetsPage.vue';
import PreannotationsPage from '../features/datasets/PreannotationsPage.vue';
import ImportJobPage from '../features/import/ImportJobPage.vue';
import QcPage from '../features/qc/QcPage.vue';
import SamplePoolPage from '../features/sample-pool/SamplePoolPage.vue';
import ReviewWorkbenchPage from '../features/review-workbench/ReviewWorkbenchPage.vue';
import UsersPage from '../features/users/UsersPage.vue';
import AuditPage from '../features/audit/AuditPage.vue';
import AccountPage from '../features/account/AccountPage.vue';
import { ensureCurrentUser, userHasAnyPermission } from '../features/auth/authState';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/datasets' },
    {
      path: '/login',
      name: 'login',
      component: LoginPage,
      meta: { public: true },
    },
    {
      path: '/datasets',
      name: 'datasets',
      component: DatasetsPage,
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
      component: SamplePoolPage,
    },
    {
      path: '/datasets/:id/overview',
      name: 'dataset-overview',
      component: DatasetOverviewPage,
      props: true,
    },
    {
      path: '/datasets/:id/assets',
      name: 'dataset-assets',
      component: DatasetAssetsPage,
      props: true,
    },
    {
      path: '/datasets/:id/import-jobs/:jobId',
      name: 'dataset-import-job',
      component: ImportJobPage,
      props: true,
    },
    {
      path: '/datasets/:id/preannotations',
      name: 'dataset-preannotations',
      component: PreannotationsPage,
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
    {
      path: '/account',
      name: 'account',
      component: AccountPage,
    },
    {
      path: '/account/permissions',
      name: 'account-permissions',
      component: UsersPage,
      meta: { requiresAnyPermission: ['users:manage', 'roles:manage'] },
    },
    {
      path: '/account/audit',
      name: 'account-audit',
      component: AuditPage,
      meta: { requiresAnyPermission: ['audit:read'] },
    },
    { path: '/users', redirect: '/account/permissions' },
    { path: '/audit', redirect: '/account/audit' },
  ],
});

router.beforeEach(async (to) => {
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

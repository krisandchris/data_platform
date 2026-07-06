import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import DatasetTypePage from '../features/datasets/DatasetTypePage.vue';
import ImportJobPage from '../features/import/ImportJobPage.vue';
import QcPage from '../features/qc/QcPage.vue';
import ReviewWorkbenchPage from '../features/review-workbench/ReviewWorkbenchPage.vue';
import { ensureCurrentUser } from '../features/auth/authState';
import { offlineDatasetId } from '../services/config';
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

const routes: RouteRecordRaw[] = [
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

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  if (to.name === 'dataset-qc' && String(to.params.id ?? '') === offlineDatasetId()) {
    return offlineQcEntryPath();
  }
  if (!offlineRouteNames.has(String(to.name ?? ''))) {
    return offlineUploadEntryPath();
  }
  await ensureCurrentUser();
  return true;
});

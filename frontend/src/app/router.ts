import { createRouter, createWebHistory } from 'vue-router';
import DatasetsPage from '../features/datasets/DatasetsPage.vue';
import DatasetOverviewPage from '../features/datasets/DatasetOverviewPage.vue';
import DatasetAssetsPage from '../features/datasets/DatasetAssetsPage.vue';
import PreannotationsPage from '../features/datasets/PreannotationsPage.vue';
import ImportJobPage from '../features/import/ImportJobPage.vue';
import QcPage from '../features/qc/QcPage.vue';
import ReviewWorkbenchPage from '../features/review-workbench/ReviewWorkbenchPage.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/datasets' },
    {
      path: '/datasets',
      name: 'datasets',
      component: DatasetsPage,
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
  ],
});

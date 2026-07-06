import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatasetType, ImportJobDetail, QcQueueItem, QcWorkspace } from '../shared/types/contract';

const mockApiClient = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getDatasetType: vi.fn(),
  createImportJobArchive: vi.fn(),
  getDatasetBatchImportJob: vi.fn(),
  getImportJob: vi.fn(),
  scanImportJob: vi.fn(),
  validateImportJob: vi.fn(),
  confirmImportJob: vi.fn(),
  retryImportJob: vi.fn(),
  listBatchAssignableUsers: vi.fn(),
  getQcWorkspace: vi.fn(),
  generateQcQueue: vi.fn(),
  assignBatch: vi.fn(),
  reassignBatch: vi.fn(),
  releaseBatchAssignment: vi.fn(),
  confirmLabelEditSubmission: vi.fn(),
  returnLabelEditSubmission: vi.fn(),
  getReviewSample: vi.fn(),
  listQcQueue: vi.fn(),
  acquireSampleLease: vi.fn(),
  heartbeatSampleLease: vi.fn(),
  releaseSampleLease: vi.fn(),
  getActiveLabelConfig: vi.fn(),
  getLabelSuggestions: vi.fn(),
  validateLabelEdit: vi.fn(),
  getMyLabelEditDraft: vi.fn(),
  getMyBatchLabelEditDraft: vi.fn(),
  saveMyBatchLabelEditDraft: vi.fn(),
  autosaveMyBatchLabelEditDraft: vi.fn(),
  submitBatchLabelEdits: vi.fn(),
}));

vi.mock('../services/urbanViolationApi', () => ({
  apiClient: mockApiClient,
}));

import { router as appRouter } from '../app/router';
import DatasetTypePage from '../features/datasets/DatasetTypePage.vue';
import ImportJobPage from '../features/import/ImportJobPage.vue';
import QcPage from '../features/qc/QcPage.vue';

const currentUser = {
  userId: 'offline_reviewer',
  displayName: 'Offline Reviewer',
  status: 'active' as const,
  roles: ['qc_lead'],
  permissions: ['batch_assignment:manage', 'qc_submission:confirm'],
};

const datasetType: DatasetType = {
  datasetType: 'urban_violation',
  displayName: '城市违规',
  fieldSchemaVersion: '2026-05-18',
  activeLabelConfigVersion: '2',
  status: 'active',
  batchCount: 1,
  batches: [
    {
      id: 'urban_violation__0508_797',
      name: '0508_797',
      datasetType: 'urban_violation',
      batchKey: '0508_797',
      lifecycleStatus: 'qc_in_progress',
      assetTotal: 797,
      stage1Count: 797,
      stage2SuccessCount: 780,
      stage2FailureCount: 19,
      qcQueueId: 'qcq_urban_violation_0508_797',
      activeImportJobId: 'manual-import-urban_violation-0508_797-1',
    },
  ],
};

const importJob: ImportJobDetail = {
  id: 'manual-import-urban_violation-0508_797-1',
  datasetId: 'urban_violation__0508_797',
  title: '0508_797',
  state: 'ValidationFailed',
  activeStep: 2,
  batchKey: '0508_797',
  batchName: '0508_797',
  sourceMode: 'uploaded_package',
  sourceStructure: 'images_with_preannotations',
  totals: {
    rawAssets: 797,
    stage1Parsed: 797,
    stage2Parsed: 780,
    stage2Failures: 19,
  },
  coverage: {
    stage1: 1,
    stage2: 780 / 797,
  },
  warnings: [
    {
      id: 'stage2_failed',
      severity: 'blocking',
      title: 'stage2_failed',
      message: 'Missing stage2 response',
    },
  ],
  mappingSteps: [],
  validationRows: [
    {
      sampleId: '000001',
      imagePath: 'images/000001.jpg',
      stage1Path: 'stage1/000001.json',
      status: 'failed',
      issues: ['Missing stage2 response'],
    },
  ],
};

const queue: QcQueueItem[] = [
  {
    sampleId: '000001',
    assetId: 'asset-1',
    datasetId: 'urban_violation__0508_797',
    status: 'needs_review',
    judgeDecision: 'pass',
    taskStatus: 'assigned',
    assigneeUserId: 'offline_reviewer',
    assigneeDisplayName: 'Offline Reviewer',
  },
];

const workspace: QcWorkspace = {
  datasetId: 'urban_violation__0508_797',
  assignment: {
    assignmentId: 'assignment-offline',
    datasetId: 'urban_violation__0508_797',
    assigneeUserId: 'offline_reviewer',
    assigneeDisplayName: 'Offline Reviewer',
    status: 'assigned',
  },
  queue,
  tasks: [],
  leases: [],
};

beforeEach(async () => {
  vi.clearAllMocks();
  mockApiClient.getCurrentUser.mockResolvedValue(currentUser);
  mockApiClient.getDatasetType.mockResolvedValue(datasetType);
  mockApiClient.getDatasetBatchImportJob.mockResolvedValue(importJob);
  mockApiClient.getImportJob.mockResolvedValue(importJob);
  mockApiClient.scanImportJob.mockResolvedValue(importJob);
  mockApiClient.validateImportJob.mockResolvedValue(importJob);
  mockApiClient.confirmImportJob.mockResolvedValue(importJob);
  mockApiClient.retryImportJob.mockResolvedValue(importJob);
  mockApiClient.getQcWorkspace.mockResolvedValue(workspace);
  mockApiClient.listBatchAssignableUsers.mockResolvedValue([currentUser]);
  mockApiClient.generateQcQueue.mockResolvedValue(workspace);
  await appRouter.push('/');
  await appRouter.isReady();
});

describe('offline route surface', () => {
  it('registers only retained offline routes', () => {
    const routeNames = new Set(appRouter.getRoutes().map((route) => String(route.name ?? route.path)));

    expect(routeNames).toEqual(
      new Set(['/', '/import-jobs/:jobId', 'dataset-type', 'dataset-import-job', 'dataset-qc', 'sample-review']),
    );
  });

  it('redirects hidden routes to the ZIP upload entry', async () => {
    await appRouter.push('/users');
    await flushPromises();

    expect(appRouter.currentRoute.value.fullPath).toBe('/datasets/types/urban_violation?create=batch');
  });

  it('redirects the generic QC entry to the uploaded batch route', async () => {
    await appRouter.push('/datasets/urban_violation/qc');
    await flushPromises();

    expect(mockApiClient.getDatasetType).toHaveBeenCalledWith('urban_violation');
    expect(appRouter.currentRoute.value.fullPath).toBe('/datasets/urban_violation__0508_797/qc');
  });
});

describe('offline retained pages', () => {
  it('renders ZIP upload and batch QC entry on the dataset type page', async () => {
    const wrapper = mount(DatasetTypePage, {
      props: { datasetType: 'urban_violation' },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('数据校验');
    expect(wrapper.text()).toContain('新建批次');
    expect(wrapper.text()).toContain('进入质检队列');
    expect(wrapper.text()).not.toContain('数据集中心');
    expect(wrapper.text()).not.toContain('标签配置管理');
  });

  it('renders import job validation status from the retained API', async () => {
    const wrapper = mount(ImportJobPage, {
      props: {
        id: 'urban_violation__0508_797',
        jobId: 'manual-import-urban_violation-0508_797-1',
      },
      global: {
        stubs: { RouterLink: true },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('ValidationFailed');
    expect(wrapper.text()).toContain('stage2_failed');
    expect(wrapper.text()).toContain('Missing stage2 response');
  });

  it('renders QC queue without role-binding or user-directory APIs', async () => {
    const wrapper = mount(QcPage, {
      props: { id: 'urban_violation__0508_797' },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('1 visible / 1 total');
    expect(wrapper.text()).toContain('Offline Reviewer');
    expect(mockApiClient.listBatchAssignableUsers).toHaveBeenCalledWith('urban_violation__0508_797');
    expect('listRoleBindings' in mockApiClient).toBe(false);
  });
});

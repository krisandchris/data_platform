import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AssetListItem,
  AssetSummary,
  Dataset,
  DatasetSummary,
  ImportJobDetail,
  LabelConfig,
  LabelConfigSaveResult,
  LabelConfigValidationResult,
  PreannotationSummary,
  QcModificationEventStats,
  QcQueueItem,
  ReviewSampleDetail,
  SamplePoolItem,
  SamplePoolStats,
} from '../shared/types/contract';

const mockApiClient = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  listRoleBindings: vi.fn(),
  createRoleBinding: vi.fn(),
  deleteRoleBinding: vi.fn(),
  listDatasets: vi.fn(),
  listDatasetTypes: vi.fn(),
  createDatasetType: vi.fn(),
  getDatasetBatchSummary: vi.fn(),
  getDatasetBatchAssetSummary: vi.fn(),
  listDatasetBatchAssets: vi.fn(),
  listDatasetBatchImportJobs: vi.fn(),
  createDatasetBatchImportJob: vi.fn(),
  getDatasetBatchImportJob: vi.fn(),
  getDatasetBatchPreannotationSummary: vi.fn(),
  createImportJob: vi.fn(),
  getImportJob: vi.fn(),
  listDatasetBatchQcQueue: vi.fn(),
  getDatasetBatchQcWorkspace: vi.fn(),
  getDatasetBatchQcProgress: vi.fn(),
  getDatasetBatchQcModificationEventStats: vi.fn(),
  getQcModificationEventStats: vi.fn(),
  listDatasetBatchQcModificationEvents: vi.fn(),
  listQcModificationEvents: vi.fn(),
  listSamplePoolItems: vi.fn(),
  getSamplePoolStats: vi.fn(),
  getSamplePoolItem: vi.fn(),
  getQcWorkspace: vi.fn(),
  generateQcQueue: vi.fn(),
  getQcProgress: vi.fn(),
  getBatchAssignment: vi.fn(),
  assignBatch: vi.fn(),
  reassignBatch: vi.fn(),
  releaseBatchAssignment: vi.fn(),
  listQcTasks: vi.fn(),
  getReviewSample: vi.fn(),
  acquireSampleLease: vi.fn(),
  heartbeatSampleLease: vi.fn(),
  releaseSampleLease: vi.fn(),
  listQcQueue: vi.fn(),
  submitReviewDecision: vi.fn(),
  validateLabelEdit: vi.fn(),
  getMyLabelEditDraft: vi.fn(),
  getLabelEditHistory: vi.fn(),
  submitLabelEdit: vi.fn(),
  confirmLabelEditSubmission: vi.fn(),
  returnLabelEditSubmission: vi.fn(),
  listAuditEvents: vi.fn(),
  validateLabelConfig: vi.fn(),
  validateDatasetTypeLabelConfig: vi.fn(),
  saveLabelConfig: vi.fn(),
  saveDatasetTypeLabelConfig: vi.fn(),
  listLabelConfigs: vi.fn(),
  listDatasetTypeLabelConfigs: vi.fn(),
  activateLabelConfig: vi.fn(),
  activateDatasetTypeLabelConfig: vi.fn(),
  reloadActiveLabelConfig: vi.fn(),
  reloadActiveDatasetTypeLabelConfig: vi.fn(),
  getActiveLabelConfig: vi.fn(),
  getActiveDatasetTypeLabelConfig: vi.fn(),
  getLabelSuggestions: vi.fn(),
}));

vi.mock('../services/urbanViolationApi', () => ({
  apiClient: mockApiClient,
}));

import DatasetsPage from '../features/datasets/DatasetsPage.vue';
import DatasetAssetsPage from '../features/datasets/DatasetAssetsPage.vue';
import DatasetOverviewPage from '../features/datasets/DatasetOverviewPage.vue';
import PreannotationsPage from '../features/datasets/PreannotationsPage.vue';
import ImportJobPage from '../features/import/ImportJobPage.vue';
import QcPage from '../features/qc/QcPage.vue';
import SamplePoolPage from '../features/sample-pool/SamplePoolPage.vue';
import ReviewWorkbenchPage from '../features/review-workbench/ReviewWorkbenchPage.vue';
import LabelConfigUploadPanel from '../features/datasets/components/LabelConfigUploadPanel.vue';
import AppShell from '../app/layouts/AppShell.vue';
import AccountPage from '../features/account/AccountPage.vue';
import { router as appRouter } from '../app/router';
import { useAuthState } from '../features/auth/authState';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
};

const dataset: Dataset = {
  id: 'ds-live',
  name: 'urban_violation',
  datasetType: 'urban_violation',
  version: 'live',
  status: 'active',
  createdAt: '2026-05-15T00:00:00Z',
  updatedAt: '2026-05-15T00:00:00Z',
  tags: [],
};

const importJob: ImportJobDetail = {
  id: 'job-1',
  datasetId: 'ds-live',
  state: 'ValidationFailed',
  activeStep: 10,
  createdAt: '2026-05-15T00:00:00Z',
  updatedAt: '2026-05-15T00:00:00Z',
  totals: {
    rawAssets: 2,
    stage1Parsed: 2,
    stage2Parsed: 1,
    stage2Failures: 1,
  },
  coverage: {
    stage1: 1,
    stage2: 0.5,
  },
  warnings: [
    {
      id: 'w1',
      severity: 'blocking',
      title: 'Missing stage2 response',
      message: 'sample-2 has no stage2 response.',
    },
  ],
  validationRows: [
    {
      sampleId: 'sample-1',
      imagePath: 'images/sample-1.jpg',
      stage1Path: 'stage1/sample-1.json',
      stage2Path: 'stage2/sample-1.json',
      status: 'ready',
    },
    {
      sampleId: 'sample-2',
      imagePath: 'images/sample-2.jpg',
      stage1Path: 'stage1/sample-2.json',
      failurePath: 'failures/sample-2.json',
      status: 'stage2_failed',
    },
  ],
  mappingSteps: [],
};

const makeDatasetSummary = (batchId: string, name: string, rawAssets: number): DatasetSummary => ({
  dataset: {
    ...dataset,
    id: batchId,
    name,
    displayName: name,
    batchName: name,
    batchKey: batchId.includes('__') ? batchId.split('__').slice(1).join('__') : batchId,
    lifecycleStatus: 'qc_ready',
  },
  totals: {
    rawAssets,
    stage1Parsed: rawAssets,
    stage2Parsed: Math.max(rawAssets - 1, 0),
    stage2Failures: rawAssets > 0 ? 1 : 0,
  },
  coverage: {
    stage1: 1,
    stage2: rawAssets > 0 ? Math.max(rawAssets - 1, 0) / rawAssets : 0,
  },
  qc: {
    total: rawAssets,
    pending: rawAssets,
    passed: 0,
    rejected: 0,
    needsHumanReview: rawAssets,
  },
  judgeDecisionDistribution: [],
  violationCategoryDistribution: [],
  confidenceDistribution: [],
  visibilityDistribution: [],
  sampleCategoryDistribution: [],
  importWarnings: [],
  recentRuns: [],
  latestImportJob: {
    id: `import-${batchId}`,
    datasetId: batchId,
    state: 'Imported',
    createdAt: '2026-05-15T00:00:00Z',
    updatedAt: '2026-05-15T00:00:00Z',
    blockingIssueCount: 0,
    warningCount: 0,
  },
  metadata: {
    imageSource: 'fixture',
    region: 'test',
    collectionRange: '2026-05',
    imageResolution: '1280x720',
    fileFormats: ['jpg'],
  },
});

const makeQcModificationStats = (batchId: string, totalEvents = 3): QcModificationEventStats => ({
  datasetId: batchId,
  totalEvents,
  changedSampleCount: totalEvents > 0 ? 2 : 0,
  byEventType: totalEvents > 0
    ? [
        { eventType: 'bbox_adjusted', label: '框位置调整', count: 2 },
        { eventType: 'category_changed', label: '类别修正', count: 1 },
      ]
    : [],
  byAttribution: totalEvents > 0
    ? [
        { code: 'model_bbox_offset', label: '模型框偏移', count: 2, weightSum: 1.2 },
        { code: 'category_boundary', label: '类别边界判断', count: 1 },
      ]
    : [],
  bboxOffsetBands: totalEvents > 0
    ? { micro: 1, medium: 1, large: 0 }
    : { micro: 0, medium: 0, large: 0 },
  changedSamples: totalEvents > 0
    ? [
        {
          sampleId: 'sample-1',
          eventCount: 2,
          eventTypes: ['bbox_adjusted'],
          attributionCodes: ['model_bbox_offset'],
          reviewerId: 'qc_lead_a',
          confirmedAt: '2026-05-19T09:00:00Z',
        },
        {
          sampleId: 'sample-2',
          eventCount: 1,
          eventTypes: ['category_changed'],
          attributionCodes: ['category_boundary'],
          reviewerId: 'qc_lead_b',
          confirmedAt: '2026-05-19T09:10:00Z',
        },
      ]
    : [],
  generatedAt: '2026-05-19T10:00:00Z',
});

const makeSamplePoolStats = (totalItems = 2): SamplePoolStats => ({
  totalItems,
  activeItems: totalItems,
  primaryAttribution: totalItems > 0
    ? { code: 'model_bbox_offset', label: '模型框偏移', count: 2, weightSum: 1.2 }
    : undefined,
  involvedBatchCount: totalItems > 0 ? 1 : 0,
  recentlyAddedAt: totalItems > 0 ? '2026-05-19T09:30:00Z' : undefined,
  byAttribution: totalItems > 0
    ? [
        { code: 'model_bbox_offset', label: '模型框偏移', count: 2, weightSum: 1.2 },
        { code: 'category_boundary', label: '类别边界判断', count: 1 },
      ]
    : [],
  byStatus: totalItems > 0 ? [{ status: 'active', label: '活跃', count: totalItems }] : [],
  generatedAt: '2026-05-19T10:00:00Z',
});

const makeSamplePoolItem = (overrides: Partial<SamplePoolItem> = {}): SamplePoolItem => ({
  itemId: 'pool-sample-1',
  datasetId: 'urban_violation__0508_fixture',
  datasetType: 'urban_violation',
  batchId: 'urban_violation__0508_fixture',
  batchName: '0508 测试批次',
  sampleId: 'sample-1',
  category: 'goods_blocking_road',
  attributionTags: [{ code: 'model_bbox_offset', label: '模型框偏移', count: 2, weightSum: 1.2 }],
  eventTypes: ['relation_bbox_adjust'],
  eventCount: 2,
  changedFieldCount: 1,
  reviewerId: 'annotator_a',
  reviewerDisplayName: '标注员 A',
  confirmedBy: 'qc_lead_a',
  confirmedByDisplayName: '质检负责人 A',
  confirmedAt: '2026-05-19T09:20:00Z',
  addedAt: '2026-05-19T09:21:00Z',
  status: 'active',
  confirmedSnapshotId: 'snap-confirmed-1',
  sourceEventIds: ['event-1'],
  ...overrides,
});

const makeAssetSummary = (batchId: string, total: number): AssetSummary => ({
  datasetId: batchId,
  datasetType: 'urban_violation',
  batchKey: batchId.includes('__') ? batchId.split('__').slice(1).join('__') : batchId,
  media: {
    total,
    valid: total,
    missing: 0,
    loadFailed: 0,
    resolutionAbnormal: 0,
  },
  importHealth: {
    imported: total,
    duplicates: 0,
    orphanAnnotations: 0,
    pathWarnings: 0,
    schemaWarnings: 0,
  },
  preannotation: {
    stage1Ready: total,
    stage2Ready: total,
    stage2Failed: 0,
    stage2Missing: 0,
  },
  modelJudgement: {
    pass: total,
    softFail: 0,
    unknown: 0,
  },
  qc: {
    queued: total,
    pending: total,
    skipped: 0,
    draft: 0,
    submitted: 0,
  },
  categoryDistribution: [],
  sampleCategoryDistribution: [],
});

const makeAsset = (batchId: string, sampleId: string): AssetListItem => ({
  id: `${batchId}-${sampleId}`,
  datasetId: batchId,
  datasetType: 'urban_violation',
  batchKey: batchId.includes('__') ? batchId.split('__').slice(1).join('__') : batchId,
  sampleId,
  imageUrl: `/media/${batchId}/${sampleId}.jpg`,
  width: 1280,
  height: 720,
  mediaStatus: 'valid',
  importedAt: '2026-05-15T00:00:00Z',
  stage1Status: 'ready',
  stage2Status: 'ready',
  judgeDecision: 'pass',
  qcStatus: 'needs_review',
  hasStage2Failure: false,
  violationCategories: ['goods_blocking_road'],
  sampleCategories: ['positive samples'],
  candidateCount: 1,
  highestConfidence: 0.9,
  updatedAt: '2026-05-15T00:00:00Z',
});

const makePreannotationSummary = (batchId: string, stage1Succeeded: number): PreannotationSummary => ({
  datasetId: batchId,
  stage1: {
    succeeded: stage1Succeeded,
    failed: 0,
    bboxValid: stage1Succeeded,
  },
  stage2: {
    parsed: stage1Succeeded,
    failures: 0,
    factVerificationCount: stage1Succeeded,
    candidateCount: stage1Succeeded,
  },
  categoryDistribution: [],
  verificationDistribution: [],
});

const makeImportJob = (batchId: string, jobId: string, rawAssets: number): ImportJobDetail => ({
  ...importJob,
  id: jobId,
  datasetId: batchId,
  totals: {
    ...importJob.totals,
    rawAssets,
  },
  validationRows: [
    {
      sampleId: `${batchId}-sample`,
      imagePath: `images/${batchId}.jpg`,
      stage1Path: `stage1/${batchId}.json`,
      stage2Path: `stage2/${batchId}.json`,
      status: 'ready',
    },
  ],
});

const reviewDetail: ReviewSampleDetail = {
  asset: {
    id: 'asset-1',
    datasetId: 'ds-live',
    sampleId: 'sample-1',
    imageUrl: '/api/media/sample-1',
    width: 1280,
    height: 720,
    importedAt: '2026-05-15T00:00:00Z',
    stage1Status: 'ready',
    stage2Status: 'ready',
    judgeDecision: 'pass',
    qcStatus: 'needs_review',
    hasStage2Failure: false,
    violationCategories: ['goods_blocking_road'],
    sampleCategories: ['positive samples'],
    candidateCount: 1,
    highestConfidence: 0.9,
    updatedAt: '2026-05-15T00:00:00Z',
  },
  stage1: {
    sampleId: 'sample-1',
    environmentAnalysis: 'street',
    sceneElements: ['sidewalk'],
    keyAnchors: [],
    keyRelations: [
      {
        relationIndex: 'R1',
        subject: 'goods',
        relation: 'blocks',
        object: 'sidewalk',
        bbox: [320, 180, 640, 360],
      },
    ],
  },
  stage2: {
    sampleId: 'sample-1',
    factVerifications: [
      {
        relationIndex: 'R1',
        subject: 'goods',
        relation: 'blocks',
        object: 'sidewalk',
        bbox: [320, 180, 640, 360],
        visibilityLevel: 'clear',
        informationLossType: 'none',
        subjectVisible: true,
        subjectMatch: true,
        keyAttributesVisible: ['visible goods'],
        bboxObservation: 'bbox aligned',
        globalContextObservation: 'sidewalk visible',
        observations: 'aligned',
        verificationResult: 'supported',
        verificationConfidence: 0.94,
      },
    ],
    candidates: [
      {
        violationCategory: 'goods_blocking_road',
        evidenceRelationIndices: ['R1'],
        evidenceReasoning: 'goods block sidewalk',
        segmentationTargets: ['goods'],
        confidence: 0.88,
        sampleCategory: 'positive samples',
      },
    ],
  },
  auditArtifacts: [],
  labelEditHistory: [],
};

const qcQueue: QcQueueItem[] = [
  {
    sampleId: 'sample-1',
    assetId: 'asset-1',
    status: 'needs_review',
    judgeDecision: 'pass',
    highestConfidence: 0.9,
    primaryCategory: 'goods_blocking_road',
    stage2Failure: false,
    updatedAt: '2026-05-15T00:00:00Z',
    taskStatus: 'in_progress',
    assigneeUserId: 'annotator_a',
    assigneeDisplayName: '标注员 A',
    leaseStatus: 'active',
    labelConfigVersion: 'urban_violation_labels_v1',
  },
];

const currentUser = {
  userId: 'annotator_a',
  username: 'annotator_a',
  displayName: '标注员 A',
  email: 'annotator_a@example.local',
  status: 'active' as const,
  authMode: 'dev_header',
  roles: ['annotator' as const],
  roleBindings: [
    {
      bindingId: 'binding-annotator-a',
      userId: 'annotator_a',
      role: 'annotator' as const,
      scopeType: 'dataset_batch' as const,
      scopeId: 'ds-live',
      createdAt: '2026-05-18T00:00:00Z',
      createdBy: 'admin',
    },
  ],
  permissions: ['label_edit:write'],
};

const adminUser = {
  ...currentUser,
  userId: 'admin',
  username: 'admin',
  displayName: '平台管理员',
  email: 'admin@example.local',
  roles: ['platform_admin' as const],
  roleBindings: [
    {
      bindingId: 'binding-admin',
      userId: 'admin',
      role: 'platform_admin' as const,
      scopeType: 'platform' as const,
      scopeId: '*',
      createdAt: '2026-05-18T00:00:00Z',
      createdBy: 'system',
    },
  ],
  permissions: ['users:manage', 'roles:manage', 'audit:read'],
};

const auditorUser = {
  ...currentUser,
  userId: 'auditor',
  username: 'auditor',
  displayName: '审计员',
  email: 'auditor@example.local',
  roles: ['auditor' as const],
  roleBindings: [
    {
      bindingId: 'binding-auditor',
      userId: 'auditor',
      role: 'auditor' as const,
      scopeType: 'dataset_batch' as const,
      scopeId: 'ds-live',
      createdAt: '2026-05-18T00:00:00Z',
      createdBy: 'admin',
    },
  ],
  permissions: ['audit:read'],
};

reviewDetail.currentUser = currentUser;
reviewDetail.batchAssignment = {
  assignmentId: 'assignment-ds-live',
  datasetId: 'ds-live',
  assigneeUserId: 'annotator_a',
  assigneeDisplayName: '标注员 A',
  status: 'in_progress',
  assignedAt: '2026-05-18T00:00:00Z',
};
reviewDetail.qcTask = {
  taskId: 'task-sample-1',
  datasetId: 'ds-live',
  sampleId: 'sample-1',
  status: 'in_progress',
  assigneeUserId: 'annotator_a',
  assigneeDisplayName: '标注员 A',
  labelConfigId: 'label-config-1',
  labelConfigVersion: 'urban_violation_labels_v1',
  taskRevision: 7,
};
reviewDetail.sampleLease = {
  leaseId: 'lease-sample-1',
  datasetId: 'ds-live',
  sampleId: 'sample-1',
  taskId: 'task-sample-1',
  userId: 'annotator_a',
  userDisplayName: '标注员 A',
  status: 'active',
  expiresAt: '2026-05-18T01:00:00Z',
};

const labelConfig: LabelConfig = {
  configId: 'label-config-1',
  datasetId: 'ds-live',
  schemaVersion: 'label_config_v1',
  datasetType: 'urban_violation',
  version: 'urban_violation_labels_v1',
  status: 'active',
  fields: [
    {
      field: 'violation_category',
      mode: 'closed_enum',
      labelZh: '违法类别',
      allowCustom: false,
      options: [
        { code: 'goods_blocking_road', labelZh: '物品占道', aliases: [] },
        { code: 'no violation', labelZh: '无违法', aliases: [] },
      ],
    },
    {
      field: 'sample_category',
      mode: 'closed_enum',
      labelZh: '样本类别',
      allowCustom: false,
      options: [{ code: 'positive samples', labelZh: '正样本', aliases: [] }],
    },
    {
      field: 'relation',
      mode: 'closed_enum',
      labelZh: '事实关系',
      allowCustom: false,
      options: [
        { code: 'blocks', labelZh: '阻挡', aliases: [] },
        { code: 'near', labelZh: '靠近', aliases: [] },
      ],
    },
    {
      field: 'visibility_level',
      mode: 'closed_enum',
      labelZh: '可见性',
      allowCustom: false,
      options: [
        { code: 'clear', labelZh: '清晰', aliases: [] },
        { code: 'occluded', labelZh: '遮挡', aliases: [] },
      ],
    },
    {
      field: 'information_loss_type',
      mode: 'closed_enum',
      labelZh: '信息损失',
      allowCustom: false,
      options: [
        { code: 'none', labelZh: '无', aliases: [] },
        { code: 'occlusion', labelZh: '遮挡', aliases: [] },
      ],
    },
    {
      field: 'verification_result',
      mode: 'closed_enum',
      labelZh: '核验结果',
      allowCustom: false,
      options: [
        { code: 'supported', labelZh: '支持', aliases: [] },
        { code: 'weakly_supported', labelZh: '弱支持', aliases: [] },
      ],
    },
    {
      field: 'scene_elements',
      mode: 'open_tags',
      labelZh: '场景元素',
      allowCustom: true,
      options: [{ code: 'sidewalk', labelZh: '人行道', aliases: [] }],
    },
    {
      field: 'segmentation_targets',
      mode: 'open_tags',
      labelZh: '分割目标',
      allowCustom: true,
      options: [{ code: 'goods', labelZh: '货物', aliases: [] }],
    },
  ],
};

const labelValidation: LabelConfigValidationResult = {
  valid: true,
  datasetId: 'ds-live',
  schemaVersion: 'label_config_v1',
  version: 'urban_violation_labels_v1',
  summary: {
    fieldCount: labelConfig.fields.length,
    closedEnumCount: labelConfig.fields.filter((field) => field.mode === 'closed_enum').length,
    openTagsCount: labelConfig.fields.filter((field) => field.mode === 'open_tags').length,
    optionCount: labelConfig.fields.reduce((total, field) => total + field.options.length, 0),
  },
  errors: [],
  warnings: [],
  normalizedConfig: labelConfig,
};

const labelSaveResult: LabelConfigSaveResult = {
  configId: 'label-config-1',
  datasetId: 'ds-live',
  schemaVersion: 'label_config_v1',
  version: 'urban_violation_labels_v1',
  status: 'active',
  validation: labelValidation,
  config: labelConfig,
};

const makeReviewDetail = (sampleId: string): ReviewSampleDetail => ({
  ...reviewDetail,
  asset: {
    ...reviewDetail.asset,
    id: `asset-${sampleId}`,
    sampleId,
  },
  stage1: {
    ...reviewDetail.stage1,
    sampleId,
  },
  stage2: reviewDetail.stage2
    ? {
        ...reviewDetail.stage2,
        sampleId,
      }
    : undefined,
  qcTask: reviewDetail.qcTask ? { ...reviewDetail.qcTask, sampleId, taskId: `task-${sampleId}` } : undefined,
  sampleLease: reviewDetail.sampleLease
    ? { ...reviewDetail.sampleLease, sampleId, taskId: `task-${sampleId}`, leaseId: `lease-${sampleId}` }
    : undefined,
});

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  const authState = useAuthState();
  authState.currentUser.value = undefined;
  authState.users.value = [];
  authState.error.value = '';
  mockApiClient.getCurrentUser.mockResolvedValue(currentUser);
  mockApiClient.listUsers.mockResolvedValue([currentUser]);
  mockApiClient.listRoleBindings.mockResolvedValue([]);
  mockApiClient.logout.mockResolvedValue(undefined);
  mockApiClient.getDatasetBatchSummary.mockResolvedValue(makeDatasetSummary('ds-live', 'Batch A', 2));
  mockApiClient.getDatasetBatchAssetSummary.mockResolvedValue(makeAssetSummary('ds-live', 2));
  mockApiClient.getDatasetBatchQcModificationEventStats.mockResolvedValue(makeQcModificationStats('ds-live'));
  mockApiClient.getQcModificationEventStats.mockResolvedValue(makeQcModificationStats('ds-live'));
  mockApiClient.listDatasetBatchQcModificationEvents.mockResolvedValue([]);
  mockApiClient.listQcModificationEvents.mockResolvedValue([]);
  mockApiClient.getSamplePoolStats.mockResolvedValue(makeSamplePoolStats());
  mockApiClient.listSamplePoolItems.mockResolvedValue([makeSamplePoolItem()]);
  mockApiClient.getSamplePoolItem.mockResolvedValue({
    ...makeSamplePoolItem(),
    beforeSnapshotId: 'snap-baseline-1',
    changedFields: ['bbox'],
    events: [],
  });
  mockApiClient.listDatasetBatchAssets.mockResolvedValue([makeAsset('ds-live', 'sample-1')]);
  mockApiClient.getDatasetBatchImportJob.mockResolvedValue(importJob);
  mockApiClient.getDatasetBatchPreannotationSummary.mockResolvedValue(makePreannotationSummary('ds-live', 2));
  mockApiClient.getMyLabelEditDraft.mockResolvedValue(undefined);
  mockApiClient.acquireSampleLease.mockResolvedValue(reviewDetail.sampleLease);
  mockApiClient.heartbeatSampleLease.mockResolvedValue(reviewDetail.sampleLease);
  mockApiClient.releaseSampleLease.mockResolvedValue({ ...reviewDetail.sampleLease!, status: 'released' });
  mockApiClient.getActiveLabelConfig.mockResolvedValue(labelConfig);
  mockApiClient.getActiveDatasetTypeLabelConfig.mockResolvedValue(labelConfig);
  mockApiClient.getLabelSuggestions.mockResolvedValue([{ value: 'sidewalk', labelZh: '人行道' }]);
  mockApiClient.generateQcQueue.mockResolvedValue({
    datasetId: dataset.id,
    queue: [],
    tasks: [],
    leases: [],
  });
  mockApiClient.validateLabelConfig.mockResolvedValue(labelValidation);
  mockApiClient.validateDatasetTypeLabelConfig.mockResolvedValue(labelValidation);
  mockApiClient.saveLabelConfig.mockResolvedValue(labelSaveResult);
  mockApiClient.saveDatasetTypeLabelConfig.mockResolvedValue(labelSaveResult);
  mockApiClient.listLabelConfigs.mockResolvedValue([labelSaveResult]);
  mockApiClient.listDatasetTypeLabelConfigs.mockResolvedValue([labelSaveResult]);
  mockApiClient.activateLabelConfig.mockResolvedValue(labelSaveResult);
  mockApiClient.activateDatasetTypeLabelConfig.mockResolvedValue(labelSaveResult);
  mockApiClient.reloadActiveLabelConfig.mockResolvedValue(labelSaveResult);
  mockApiClient.reloadActiveDatasetTypeLabelConfig.mockResolvedValue(labelSaveResult);
  mockApiClient.validateLabelEdit.mockResolvedValue({
    valid: true,
    errors: [],
    warnings: [],
    checkedAt: '2026-05-18T00:00:00Z',
  });
  mockApiClient.submitLabelEdit.mockResolvedValue({
    saved: true,
    sampleId: 'sample-1',
    submitAction: 'save_draft',
    taskStatus: 'annotation_draft',
    editId: 'patch-1',
    operationCount: 1,
    updatedAt: '2026-05-18T00:00:00Z',
  });
});

describe('route rendering and live route states', () => {
  it('declares account routes and compatibility redirects', () => {
    const routes = appRouter.getRoutes();
    expect(routes.some((route) => route.path === '/sample-pool' && route.name === 'sample-pool')).toBe(true);
    expect(routes.some((route) => route.path === '/account' && route.name === 'account')).toBe(true);
    expect(routes.some((route) => route.path === '/account/permissions' && route.name === 'account-permissions')).toBe(
      true,
    );
    expect(routes.some((route) => route.path === '/account/audit' && route.name === 'account-audit')).toBe(true);
    expect(routes.find((route) => route.path === '/users')?.redirect).toBe('/account/permissions');
    expect(routes.find((route) => route.path === '/audit')?.redirect).toBe('/account/audit');
  });

  it('uses a focused chrome-free shell on the sample review route', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/datasets', name: 'datasets', component: { template: '<div />' } },
        {
          path: '/datasets/:id/samples/:sampleId/review',
          name: 'sample-review',
          component: { template: '<div />' },
        },
      ],
    });
    await router.push('/datasets/ds-live/samples/sample-1/review');
    await router.isReady();

    const wrapper = mount(AppShell, {
      slots: {
        default: '<div class="review-slot">Review body</div>',
      },
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.classes()).toContain('app-shell--review-focus');
    expect(wrapper.text()).toContain('Review body');
    expect(wrapper.text()).not.toContain('城市治理数据平台');
    expect(wrapper.find('input[placeholder="搜索图像、任务、运行、标签..."]').exists()).toBe(false);
  });

  it('routes the topbar user chip to the account center', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/datasets', name: 'datasets', component: { template: '<div />' } },
        { path: '/account', name: 'account', component: { template: '<div />' } },
      ],
    });
    await router.push('/datasets');
    await router.isReady();

    const wrapper = mount(AppShell, {
      slots: {
        default: '<div class="route-slot">Datasets body</div>',
      },
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    const userChip = wrapper.find('a.user-chip');
    expect(userChip.attributes('href')).toBe('/account');

    await userChip.trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/account');
  });

  it('renders account center for annotators without management entries', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/account', name: 'account', component: AccountPage },
        { path: '/account/permissions', name: 'account-permissions', component: { template: '<div />' } },
        { path: '/account/audit', name: 'account-audit', component: { template: '<div />' } },
        { path: '/login', name: 'login', component: { template: '<div />' } },
      ],
    });
    await router.push('/account');
    await router.isReady();

    const wrapper = mount(RouterView, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('个人账户');
    expect(wrapper.text()).toContain('annotator_a');
    expect(wrapper.text()).toContain('具体批次 · ds-live');
    expect(wrapper.text()).toContain('标签编辑');
    expect(wrapper.text()).not.toContain('管理入口');
    expect(wrapper.find('a[href="/account/permissions"]').exists()).toBe(false);
    expect(wrapper.find('a[href="/account/audit"]').exists()).toBe(false);
  });

  it('shows permission management and audit entries from current user permissions', async () => {
    mockApiClient.getCurrentUser.mockResolvedValue(adminUser);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/account', name: 'account', component: AccountPage },
        { path: '/account/permissions', name: 'account-permissions', component: { template: '<div>Permissions</div>' } },
        { path: '/account/audit', name: 'account-audit', component: { template: '<div>Audit</div>' } },
        { path: '/login', name: 'login', component: { template: '<div />' } },
      ],
    });
    await router.push('/account');
    await router.isReady();

    const wrapper = mount(RouterView, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('平台管理员');
    expect(wrapper.text()).toContain('用户管理');
    expect(wrapper.find('a[href="/account/permissions"]').exists()).toBe(true);
    expect(wrapper.find('a[href="/account/audit"]').exists()).toBe(true);
  });

  it('shows audit entry without permission management for auditors', async () => {
    mockApiClient.getCurrentUser.mockResolvedValue(auditorUser);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/account', name: 'account', component: AccountPage },
        { path: '/account/permissions', name: 'account-permissions', component: { template: '<div />' } },
        { path: '/account/audit', name: 'account-audit', component: { template: '<div />' } },
        { path: '/login', name: 'login', component: { template: '<div />' } },
      ],
    });
    await router.push('/account');
    await router.isReady();

    const wrapper = mount(RouterView, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('审计员');
    expect(wrapper.find('a[href="/account/permissions"]').exists()).toBe(false);
    expect(wrapper.find('a[href="/account/audit"]').exists()).toBe(true);
  });

  it('logs out from account center and routes to login', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/account', name: 'account', component: AccountPage },
        { path: '/login', name: 'login', component: { template: '<div>Login</div>' } },
      ],
    });
    await router.push('/account');
    await router.isReady();

    const wrapper = mount(RouterView, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    const logoutButton = wrapper.findAll('button').find((button) => button.text().includes('退出登录'));
    await logoutButton?.trigger('click');
    await flushPromises();

    expect(mockApiClient.logout).toHaveBeenCalledTimes(1);
    expect(router.currentRoute.value.name).toBe('login');
  });

  it('shows contextual batch navigation and persists sidebar collapse state', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/datasets', name: 'datasets', component: { template: '<div />' } },
        { path: '/sample-pool', name: 'sample-pool', component: { template: '<div />' } },
        { path: '/datasets/:id/overview', name: 'dataset-overview', component: { template: '<div />' } },
        { path: '/datasets/:id/assets', name: 'dataset-assets', component: { template: '<div />' } },
        { path: '/datasets/:id/preannotations', name: 'dataset-preannotations', component: { template: '<div />' } },
        { path: '/datasets/:id/qc', name: 'dataset-qc', component: { template: '<div />' } },
      ],
    });
    await router.push('/datasets/ds-live/assets');
    await router.isReady();

    const wrapper = mount(AppShell, {
      slots: {
        default: '<div>Assets body</div>',
      },
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.text()).toContain('当前批次');
    expect(wrapper.text()).toContain('ds-live');
    expect(wrapper.find('a[href="/sample-pool"]').text()).toContain('修正样本池');
    expect(wrapper.find('a[href="/datasets/ds-live/qc"]').exists()).toBe(true);
    expect(wrapper.find('a[href="/datasets/urban_violation/qc"]').exists()).toBe(false);

    await wrapper.find('button.sidebar-collapse').trigger('click');

    expect(wrapper.classes()).toContain('app-shell--sidebar-collapsed');
    expect(window.localStorage.getItem('uvp.sidebarCollapsed')).toBe('1');
  });

  it('renders the sample pool loading state before API responses settle', async () => {
    const statsRequest = deferred<SamplePoolStats>();
    const itemsRequest = deferred<SamplePoolItem[]>();
    mockApiClient.getSamplePoolStats.mockReturnValueOnce(statsRequest.promise);
    mockApiClient.listSamplePoolItems.mockReturnValueOnce(itemsRequest.promise);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/sample-pool', component: SamplePoolPage },
        { path: '/datasets/:id/samples/:sampleId/review', component: { template: '<div />' } },
      ],
    });
    await router.push('/sample-pool');
    await router.isReady();

    const wrapper = mount(SamplePoolPage, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="sample-pool-loading"]').text()).toContain('正在加载修正样本池');

    statsRequest.resolve(makeSamplePoolStats());
    itemsRequest.resolve([makeSamplePoolItem()]);
    await flushPromises();

    expect(wrapper.find('[data-testid="sample-pool-table"]').exists()).toBe(true);
  });

  it('renders sample pool stats, data rows, and review links', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/sample-pool', component: SamplePoolPage },
        { path: '/datasets/:id/samples/:sampleId/review', component: { template: '<div />' } },
      ],
    });
    await router.push('/sample-pool');
    await router.isReady();

    const wrapper = mount(SamplePoolPage, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    expect(mockApiClient.getSamplePoolStats).toHaveBeenCalledTimes(1);
    expect(mockApiClient.listSamplePoolItems).toHaveBeenCalledWith({});
    expect(wrapper.text()).toContain('总入池样本');
    expect(wrapper.text()).toContain('活跃样本');
    expect(wrapper.text()).toContain('主要归因');
    expect(wrapper.text()).toContain('sample-1');
    expect(wrapper.text()).toContain('物品占道');
    expect(wrapper.text()).toContain('模型框偏移');
    expect(wrapper.find('a.sample-pool-review-link').attributes('href')).toBe(
      '/datasets/urban_violation__0508_fixture/samples/sample-1/review',
    );
  });

  it('renders the sample pool empty state when no items exist', async () => {
    mockApiClient.getSamplePoolStats.mockResolvedValueOnce(makeSamplePoolStats(0));
    mockApiClient.listSamplePoolItems.mockResolvedValueOnce([]);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/sample-pool', component: SamplePoolPage }],
    });
    await router.push('/sample-pool');
    await router.isReady();

    const wrapper = mount(SamplePoolPage, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="sample-pool-empty"]').text()).toContain('暂无修正样本入池');
  });

  it('keeps the sample pool page local when item API fails', async () => {
    mockApiClient.getSamplePoolStats.mockResolvedValueOnce(makeSamplePoolStats());
    mockApiClient.listSamplePoolItems.mockRejectedValueOnce(new Error('接口未实现'));
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/sample-pool', component: SamplePoolPage }],
    });
    await router.push('/sample-pool');
    await router.isReady();

    const wrapper = mount(SamplePoolPage, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="sample-pool-error"]').text()).toContain('样本池暂不可用：接口未实现');
    expect(wrapper.text()).toContain('总入池样本');
  });

  it('applies sample pool filters and renders filtered-empty state', async () => {
    mockApiClient.listSamplePoolItems
      .mockResolvedValueOnce([
        makeSamplePoolItem(),
        makeSamplePoolItem({
          itemId: 'pool-sample-2',
          sampleId: 'sample-2',
          category: 'nonmotor_vehicle_illegal_parking',
          attributionTags: [{ code: 'visibility_miss', label: '可见性漏判', count: 1 }],
          eventTypes: ['relation_modify'],
          reviewerId: 'annotator_b',
          reviewerDisplayName: '标注员 B',
        }),
      ])
      .mockResolvedValueOnce([]);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/sample-pool', component: SamplePoolPage }],
    });
    await router.push('/sample-pool');
    await router.isReady();

    const wrapper = mount(SamplePoolPage, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    await wrapper.find('[data-testid="sample-pool-filter-category"]').setValue('goods_blocking_road');
    await wrapper.find('[data-testid="sample-pool-filter-attribution"]').setValue('model_bbox_offset');
    await wrapper.find('[data-testid="sample-pool-filter-status"]').setValue('active');
    await wrapper.find('form.sample-pool-filter-grid').trigger('submit');
    await flushPromises();

    expect(mockApiClient.listSamplePoolItems).toHaveBeenLastCalledWith({
      category: 'goods_blocking_road',
      attribution: 'model_bbox_offset',
      status: 'active',
    });
    expect(wrapper.find('[data-testid="sample-pool-filtered-empty"]').text()).toContain('当前筛选无匹配样本');
  });

  it('renders the datasets route from API data', async () => {
    mockApiClient.listDatasetTypes.mockResolvedValue([
      {
        datasetType: 'urban_violation',
        displayName: '城市违规',
        fieldSchemaVersion: '2026-05-18',
        activeLabelConfigVersion: 'urban_violation_labels_v1',
        status: 'active',
        batchCount: 1,
        batches: [dataset],
      },
    ]);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/datasets', component: DatasetsPage },
        { path: '/datasets/:id/overview', component: { template: '<div />' } },
        { path: '/datasets/:id/import-jobs/:jobId', component: { template: '<div />' } },
      ],
    });
    await router.push('/datasets');
    await router.isReady();

    const wrapper = mount(RouterView, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('urban_violation');
    expect(wrapper.text()).toContain('ds-live');
    expect(wrapper.text()).toContain('数据集类型共享的标签配置版本');
    expect(mockApiClient.getActiveLabelConfig).toHaveBeenCalledWith('urban_violation');
  });

  it('creates a second dataset type without needing a batch', async () => {
    mockApiClient.listDatasetTypes.mockResolvedValueOnce([
      {
        datasetType: 'urban_violation',
        displayName: '城市违规',
        fieldSchemaVersion: '2026-05-18',
        activeLabelConfigVersion: 'urban_violation_labels_v1',
        status: 'active',
        batchCount: 1,
        batches: [dataset],
      },
    ]);
    mockApiClient.listDatasetTypes.mockResolvedValueOnce([
      {
        datasetType: 'urban_violation',
        displayName: '城市违规',
        fieldSchemaVersion: '2026-05-18',
        activeLabelConfigVersion: 'urban_violation_labels_v1',
        status: 'active',
        batchCount: 1,
        batches: [dataset],
      },
      {
        datasetType: 'ares_detection',
        displayName: 'Ares Detection',
        fieldSchemaVersion: 'draft',
        status: 'active',
        batchCount: 0,
        batches: [],
      },
    ]);
    mockApiClient.createDatasetType.mockResolvedValue({
      datasetType: 'ares_detection',
      displayName: 'Ares Detection',
      fieldSchemaVersion: 'draft',
      status: 'active',
      batchCount: 0,
      batches: [],
    });

    const wrapper = mount(DatasetsPage, {
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    await wrapper.find('button').trigger('click');
    await wrapper.find('input[placeholder="ares_detection"]').setValue('ares_detection');
    await wrapper.find('input[placeholder="Ares Detection"]').setValue('Ares Detection');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mockApiClient.createDatasetType).toHaveBeenCalledWith({
      datasetType: 'ares_detection',
      displayName: 'Ares Detection',
      fieldSchemaVersion: 'draft',
    });
    expect(wrapper.text()).toContain('ares_detection');
    expect(wrapper.text()).toContain('暂无批次');
  });

  it('registers a manual batch from a selected directory structure', async () => {
    const aresBatch: Dataset = {
      ...dataset,
      id: 'ares_detection__20260518_roadside',
      name: '2026-05-18 路侧巡检',
      datasetType: 'ares_detection',
      batchKey: '20260518_roadside',
      batchName: '2026-05-18 路侧巡检',
      lifecycleStatus: 'registered',
      status: 'registered',
      assetTotal: 2,
      stage1Total: 1,
      stage2SuccessTotal: 1,
      stage2FailureTotal: 1,
      qcQueueId: undefined,
      activeImportJobId: 'manual-import-1',
      sourceStructure: 'images_with_preannotations',
      sourceUri: 'batch',
    };
    mockApiClient.listDatasetTypes.mockResolvedValueOnce([
      {
        datasetType: 'ares_detection',
        displayName: 'Ares Detection',
        fieldSchemaVersion: 'draft',
        status: 'active',
        batchCount: 0,
        batches: [],
      },
    ]);
    mockApiClient.listDatasetTypes.mockResolvedValueOnce([
      {
        datasetType: 'ares_detection',
        displayName: 'Ares Detection',
        fieldSchemaVersion: 'draft',
        status: 'active',
        batchCount: 1,
        batches: [aresBatch],
      },
    ]);
    mockApiClient.createImportJob.mockResolvedValue({
      ...importJob,
      id: 'manual-import-1',
      datasetId: 'ares_detection__20260518_roadside',
      datasetType: 'ares_detection',
      batchKey: '20260518_roadside',
      sourceMode: 'local_directory',
      sourceUri: 'batch',
      sourceStructure: 'images_with_preannotations',
      state: 'Draft',
    });

    const wrapper = mount(DatasetsPage, {
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    const newBatchButton = wrapper.findAll('button').find((button) => button.text().includes('新建批次'));
    expect(newBatchButton).toBeTruthy();
    await newBatchButton!.trigger('click');
    await wrapper.find('input[placeholder="20260518_roadside"]').setValue('20260518_roadside');
    await wrapper.find('input[placeholder="2026-05-18 路侧巡检"]').setValue('2026-05-18 路侧巡检');
    await wrapper.find('select').setValue('images_with_preannotations');

    const files = [
      new File(['image'], 'a.jpg', { type: 'image/jpeg' }),
      new File(['image'], 'b.png', { type: 'image/png' }),
      new File(['{}'], 'stage1-parsed.json', { type: 'application/json' }),
      new File(['{}'], 'stage1-record.json', { type: 'application/json' }),
      new File(['{}'], 'stage1-request.json', { type: 'application/json' }),
      new File(['{}'], 'stage2-parsed.json', { type: 'application/json' }),
      new File(['{}'], 'stage2-input.json', { type: 'application/json' }),
      new File(['{}'], 'stage2-response.json', { type: 'application/json' }),
      new File(['{}'], 'stage2-failure.json', { type: 'application/json' }),
      new File(['{}'], 'summary.json', { type: 'application/json' }),
    ];
    [
      'batch/images/a.jpg',
      'batch/images/b.png',
      'batch/stage1_run_0518/parsed/00/a.json',
      'batch/stage1_run_0518/records/00/a.json',
      'batch/stage1_run_0518/requests/00/a.json',
      'batch/stage2_run_0518/parsed/00/a.json',
      'batch/stage2_run_0518/inputs/00/a.json',
      'batch/stage2_run_0518/responses/00/a.json',
      'batch/stage2_run_0518/failures/0a/b.json',
      'batch/stage2_run_0518/meta/summary.json',
    ].forEach((path, index) => {
      Object.defineProperty(files[index], 'webkitRelativePath', { value: path });
    });
    const input = wrapper.find('input[type="file"]');
    Object.defineProperty(input.element, 'files', { value: files, configurable: true });
    await input.trigger('change');
    await wrapper.find('form.batch-create-form').trigger('submit');
    await flushPromises();

    expect(mockApiClient.createImportJob).toHaveBeenCalledWith('ares_detection', {
      datasetType: 'ares_detection',
      batchKey: '20260518_roadside',
      batchName: '2026-05-18 路侧巡检',
      sourceMode: 'local_directory',
      sourceUri: 'batch',
      sourceStructure: 'images_with_preannotations',
      description: undefined,
      sourceFileCount: 10,
      imageCount: 2,
      stage1FileCount: 1,
      stage2FileCount: 1,
      stage2FailureFileCount: 1,
    });
    expect(wrapper.text()).toContain('ares_detection__20260518_roadside');
    expect(wrapper.text()).toContain('队列未生成');
  });

  it('generates a QC queue for a preannotated batch from dataset management', async () => {
    const readyBatch: Dataset = {
      ...dataset,
      id: 'urban_violation__0518_imported',
      name: '2026-05-18 Imported Batch',
      batchKey: '0518_imported',
      batchName: '2026-05-18 Imported Batch',
      lifecycleStatus: 'preannotation_ready',
      status: 'preannotation_ready',
      qcQueueId: undefined,
      activeImportJobId: 'manual-import-0518',
      sourceStructure: 'images_with_preannotations',
    };
    const queuedBatch: Dataset = {
      ...readyBatch,
      lifecycleStatus: 'qc_ready',
      status: 'qc_ready',
      qcQueueId: 'qcq_urban_violation_0518_imported',
    };
    mockApiClient.listDatasetTypes.mockResolvedValueOnce([
      {
        datasetType: 'urban_violation',
        displayName: '城市违规',
        fieldSchemaVersion: '2026-05-18',
        activeLabelConfigVersion: 'urban_violation_labels_v1',
        status: 'active',
        batchCount: 1,
        batches: [readyBatch],
      },
    ]);
    mockApiClient.listDatasetTypes.mockResolvedValueOnce([
      {
        datasetType: 'urban_violation',
        displayName: '城市违规',
        fieldSchemaVersion: '2026-05-18',
        activeLabelConfigVersion: 'urban_violation_labels_v1',
        status: 'active',
        batchCount: 1,
        batches: [queuedBatch],
      },
    ]);

    const wrapper = mount(DatasetsPage, {
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    const generateButton = wrapper.findAll('button').find((button) => button.text().includes('生成质检队列'));
    expect(generateButton).toBeTruthy();
    await generateButton!.trigger('click');
    await flushPromises();

    expect(mockApiClient.generateQcQueue).toHaveBeenCalledWith('urban_violation__0518_imported');
    expect(wrapper.text()).toContain('质检就绪');
    expect(wrapper.findAll('button').some((button) => button.text().includes('生成质检队列'))).toBe(false);
  });

  it('shows route-level empty state for datasets', async () => {
    mockApiClient.listDatasetTypes.mockResolvedValue([]);
    const wrapper = mount(DatasetsPage, {
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('后端暂未返回数据集');
  });

  it('reloads batch overview when the same route component is reused for another batch', async () => {
    mockApiClient.getDatasetBatchSummary.mockImplementation(async (batchId: string) =>
      batchId === 'urban_violation__batch_b'
        ? makeDatasetSummary(batchId, 'Batch B', 5)
        : makeDatasetSummary(batchId, 'Batch A', 2),
    );

    const wrapper = mount(DatasetOverviewPage, {
      props: {
        id: 'urban_violation__batch_a',
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Batch A');

    await wrapper.setProps({ id: 'urban_violation__batch_b' });
    await flushPromises();

    expect(mockApiClient.getDatasetBatchSummary).toHaveBeenLastCalledWith('urban_violation__batch_b');
    expect(wrapper.text()).toContain('Batch B');
    expect(wrapper.text()).not.toContain('Batch A');
  });

  it('renders readonly QC analysis stats on the batch overview with the concrete batch id', async () => {
    mockApiClient.getDatasetBatchQcModificationEventStats.mockResolvedValueOnce(
      makeQcModificationStats('urban_violation__0518_imported'),
    );

    const wrapper = mount(DatasetOverviewPage, {
      props: {
        id: 'urban_violation__0518_imported',
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    expect(mockApiClient.getDatasetBatchQcModificationEventStats).toHaveBeenCalledWith(
      'urban_violation__0518_imported',
    );
    expect(wrapper.text()).toContain('质检分析');
    expect(wrapper.text()).toContain('修改事件总数');
    expect(wrapper.text()).toContain('模型框偏移 2');
    expect(wrapper.text()).toContain('框位置调整');
    expect(wrapper.text()).toContain('sample-1');
  });

  it('shows an empty QC analysis state when no modification events exist', async () => {
    mockApiClient.getDatasetBatchQcModificationEventStats.mockResolvedValueOnce(
      makeQcModificationStats('urban_violation__empty_batch', 0),
    );

    const wrapper = mount(DatasetOverviewPage, {
      props: {
        id: 'urban_violation__empty_batch',
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="qc-analysis-empty"]').text()).toContain('暂无质检修改事件');
    expect(wrapper.text()).toContain('Batch A');
  });

  it('keeps the batch overview visible when QC analysis stats are unavailable', async () => {
    mockApiClient.getDatasetBatchQcModificationEventStats.mockRejectedValueOnce(new Error('接口未实现'));

    const wrapper = mount(DatasetOverviewPage, {
      props: {
        id: 'urban_violation__error_batch',
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="qc-analysis-error"]').text()).toContain('质检分析暂不可用：接口未实现');
    expect(wrapper.text()).toContain('Batch A');
    expect(wrapper.text()).toContain('数据集概况');
  });

  it('reloads assets and review links with the concrete batch id after batch route reuse', async () => {
    mockApiClient.getDatasetBatchSummary.mockImplementation(async (batchId: string) =>
      batchId === 'urban_violation__batch_b'
        ? makeDatasetSummary(batchId, 'Batch B', 5)
        : makeDatasetSummary(batchId, 'Batch A', 2),
    );
    mockApiClient.getDatasetBatchAssetSummary.mockImplementation(async (batchId: string) =>
      batchId === 'urban_violation__batch_b' ? makeAssetSummary(batchId, 5) : makeAssetSummary(batchId, 2),
    );
    mockApiClient.listDatasetBatchAssets.mockImplementation(async (batchId: string) =>
      batchId === 'urban_violation__batch_b'
        ? [makeAsset(batchId, 'sample-b')]
        : [makeAsset(batchId, 'sample-a')],
    );
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/datasets/:id/overview', component: { template: '<div />' } },
        { path: '/datasets/:id/samples/:sampleId/review', component: { template: '<div />' } },
      ],
    });
    await router.push('/datasets/urban_violation__batch_a/assets');
    await router.isReady();

    const wrapper = mount(DatasetAssetsPage, {
      props: {
        id: 'urban_violation__batch_a',
      },
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('sample-a');

    await wrapper.setProps({ id: 'urban_violation__batch_b' });
    await flushPromises();

    expect(mockApiClient.listDatasetBatchAssets).toHaveBeenLastCalledWith('urban_violation__batch_b', {});
    expect(wrapper.text()).toContain('sample-b');
    expect(wrapper.text()).not.toContain('sample-a');
    expect(wrapper.find('a.sample-link').attributes('href')).toBe('/datasets/urban_violation__batch_b/samples/sample-b/review');
  });

  it('reloads preannotation summary when the batch route id changes', async () => {
    mockApiClient.getDatasetBatchPreannotationSummary.mockImplementation(async (batchId: string) =>
      batchId === 'urban_violation__batch_b'
        ? makePreannotationSummary(batchId, 9)
        : makePreannotationSummary(batchId, 2),
    );

    const wrapper = mount(PreannotationsPage, {
      props: {
        id: 'urban_violation__batch_a',
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('2');

    await wrapper.setProps({ id: 'urban_violation__batch_b' });
    await flushPromises();

    expect(mockApiClient.getDatasetBatchPreannotationSummary).toHaveBeenLastCalledWith('urban_violation__batch_b');
    expect(wrapper.text()).toContain('9');
  });

  it('reloads import job details when route reuse changes both batch and job ids', async () => {
    mockApiClient.getDatasetBatchImportJob.mockImplementation(async (batchId: string, jobId: string) =>
      batchId === 'urban_violation__batch_b'
        ? makeImportJob(batchId, jobId, 7)
        : makeImportJob(batchId, jobId, 2),
    );

    const wrapper = mount(ImportJobPage, {
      props: {
        id: 'urban_violation__batch_a',
        jobId: 'job-a',
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('urban_violation__batch_a-sample');

    await wrapper.setProps({
      id: 'urban_violation__batch_b',
      jobId: 'job-b',
    });
    await flushPromises();

    expect(mockApiClient.getDatasetBatchImportJob).toHaveBeenLastCalledWith('urban_violation__batch_b', 'job-b');
    expect(wrapper.text()).toContain('urban_violation__batch_b-sample');
    expect(wrapper.text()).not.toContain('urban_violation__batch_a-sample');
  });

  it('keeps active admins available in the batch assignment selector even when users have no roles payload', async () => {
    const adminUser = {
      userId: 'platform_admin',
      username: 'platform_admin',
      displayName: 'Platform Admin',
      email: 'admin@example.local',
      status: 'active' as const,
      authMode: 'session',
      roles: ['platform_admin' as const],
      permissions: ['batch_assignment:manage'],
    };
    mockApiClient.getCurrentUser.mockResolvedValue(adminUser);
    mockApiClient.getQcWorkspace.mockResolvedValue({
      datasetId: 'ds-live',
      queue: qcQueue,
      tasks: [],
      leases: [],
    });
    mockApiClient.listUsers.mockResolvedValue([
      {
        userId: 'platform_admin',
        displayName: 'Platform Admin',
        email: 'admin@example.local',
        status: 'active',
      },
      {
        userId: 'annotator_a',
        displayName: '标注员 A',
        email: 'annotator_a@example.local',
        status: 'active',
      },
      {
        userId: 'disabled_user',
        displayName: 'Disabled User',
        email: 'disabled@example.local',
        status: 'disabled',
      },
    ]);
    mockApiClient.listRoleBindings.mockResolvedValue([
      {
        bindingId: 'rb-admin',
        userId: 'platform_admin',
        role: 'platform_admin',
        scopeType: 'platform',
        scopeId: '*',
      },
    ]);
    mockApiClient.assignBatch.mockResolvedValue({
      assignmentId: 'assign-admin',
      datasetId: 'ds-live',
      assigneeUserId: 'platform_admin',
      assigneeDisplayName: 'Platform Admin',
      status: 'assigned',
    });

    const wrapper = mount(QcPage, {
      props: {
        id: 'ds-live',
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    const optionTexts = wrapper.findAll('option').map((option) => option.text());
    expect(optionTexts).toContain('Platform Admin · platform_admin');
    expect(optionTexts).toContain('标注员 A · active');
    expect(optionTexts.some((text) => text.includes('Disabled User'))).toBe(false);

    await wrapper.find('form.assignment-actions').trigger('submit');
    await flushPromises();

    expect(mockApiClient.assignBatch).toHaveBeenCalledWith('ds-live', { assigneeUserId: 'platform_admin' });
  });

  it('falls back to the current assignment manager when the full user directory is unreadable', async () => {
    const leadUser = {
      userId: 'qc_lead_a',
      username: 'qc_lead_a',
      displayName: '质检组长 A',
      email: 'qc_lead_a@example.local',
      status: 'active' as const,
      authMode: 'session',
      roles: ['qc_lead' as const],
      permissions: ['batch_assignment:manage'],
    };
    mockApiClient.getCurrentUser.mockResolvedValue(leadUser);
    mockApiClient.getQcWorkspace.mockResolvedValue({
      datasetId: 'ds-live',
      queue: qcQueue,
      tasks: [],
      leases: [],
    });
    mockApiClient.listUsers.mockRejectedValue(new Error('forbidden'));

    const wrapper = mount(QcPage, {
      props: {
        id: 'ds-live',
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    const optionTexts = wrapper.findAll('option').map((option) => option.text());
    expect(optionTexts).toEqual(['质检组长 A · qc_lead']);
  });
});

describe('import and review routes', () => {
  it('parses, validates, and saves a dataset-type label config JSON file', async () => {
    const wrapper = mount(LabelConfigUploadPanel, {
      props: {
        datasetId: 'urban_violation',
        scopeName: 'Urban Violation',
      },
    });
    await flushPromises();

    const input = wrapper.find('input[type="file"]');
    const file = new File(
      [
        JSON.stringify({
          schema_version: 'label_config_v1',
          version: 'urban_violation_labels_v1',
          fields: [
            {
              field: 'violation_category',
              mode: 'closed_enum',
              allow_custom: false,
              options: [{ code: 'goods_blocking_road' }],
            },
            {
              field: 'scene_elements',
              mode: 'open_tags',
              allow_custom: true,
              options: [{ code: 'sidewalk' }],
            },
          ],
        }),
      ],
      'label_config.json',
      { type: 'application/json' },
    );
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [file],
    });
    input.element.dispatchEvent(new Event('change'));
    await flushPromises();
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(wrapper.text()).toContain('urban_violation_labels_v1');
    expect(wrapper.text()).toContain('固定枚举');

    const validateButton = wrapper.findAll('button').find((button) => button.text().includes('校验配置'));
    await validateButton?.trigger('click');
    await flushPromises();

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('保存配置'));
    await saveButton?.trigger('click');
    await flushPromises();

    expect(mockApiClient.validateLabelConfig).toHaveBeenCalledWith('urban_violation', {
      fileName: 'label_config.json',
      config: expect.objectContaining({ version: 'urban_violation_labels_v1' }),
    });
    expect(mockApiClient.saveLabelConfig).toHaveBeenCalledWith('urban_violation', {
      fileName: 'label_config.json',
      config: expect.objectContaining({ version: 'urban_violation_labels_v1' }),
      activate: true,
    });
  });

  it('displays import job validation status from the API', async () => {
    mockApiClient.getImportJob.mockResolvedValue(importJob);
    const wrapper = mount(ImportJobPage, {
      props: {
        id: 'ds-live',
        jobId: 'job-1',
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('ValidationFailed');
    expect(wrapper.text()).toContain('stage2_failed');
    expect(wrapper.text()).toContain('Missing stage2 response');
  });

  it('validates without saving and submits label-edit draft/change payloads', async () => {
    mockApiClient.getReviewSample.mockResolvedValue(reviewDetail);
    mockApiClient.listQcQueue.mockResolvedValue(qcQueue);

    const wrapper = mount(ReviewWorkbenchPage, {
      props: {
        id: 'ds-live',
        sampleId: 'sample-1',
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    const subjectInput = wrapper.find('.relation-editor input');
    await subjectInput.setValue('goods updated');

    const validateButton = wrapper.findAll('button').find((button) => button.text().includes('校验修改'));
    await validateButton?.trigger('click');
    await flushPromises();

    expect(mockApiClient.validateLabelEdit).toHaveBeenCalledTimes(1);
    expect(mockApiClient.submitLabelEdit).not.toHaveBeenCalled();
    expect(mockApiClient.validateLabelEdit).toHaveBeenCalledWith(
      'ds-live',
      'sample-1',
      expect.objectContaining({
        taskMode: 'label_edit',
        operations: expect.arrayContaining([
          expect.objectContaining({
            scope: 'relation:R1',
            field: 'subject',
            op: 'replace',
            after: 'goods updated',
          }),
        ]),
      }),
    );

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('保存草稿'));
    await saveButton?.trigger('click');
    await flushPromises();

    expect(mockApiClient.submitLabelEdit).toHaveBeenCalledWith(
      'ds-live',
      'sample-1',
      expect.objectContaining({
        submitAction: 'save_draft',
        taskStatus: 'annotation_draft',
        labelConfigId: 'label-config-1',
        labelConfigVersion: 'urban_violation_labels_v1',
      }),
    );

    const submitButton = wrapper.findAll('button').find((button) => button.text().includes('提交修改'));
    await submitButton?.trigger('click');
    await flushPromises();

    expect(mockApiClient.validateLabelEdit).toHaveBeenCalledTimes(2);
    expect(mockApiClient.submitLabelEdit).toHaveBeenLastCalledWith(
      'ds-live',
      'sample-1',
      expect.objectContaining({
        submitAction: 'submit_changes',
        taskStatus: 'annotation_submitted',
        labelConfigId: 'label-config-1',
        labelConfigVersion: 'urban_violation_labels_v1',
        operations: expect.any(Array),
      }),
    );
  });

  it('keeps review evidence visible but disables patch and submit when active label config is missing', async () => {
    mockApiClient.getReviewSample.mockResolvedValue(reviewDetail);
    mockApiClient.listQcQueue.mockResolvedValue(qcQueue);
    mockApiClient.getActiveLabelConfig.mockRejectedValue(new Error('config_missing'));

    const wrapper = mount(ReviewWorkbenchPage, {
      props: {
        id: 'ds-live',
        sampleId: 'sample-1',
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('sample-1');
    expect(wrapper.text()).toContain('R1 · goods blocks sidewalk');
    expect(wrapper.text()).toContain('请先上传并激活标签配置');
    const submitButton = wrapper.findAll('button').find((button) => button.text().includes('提交修改'));
    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('保存草稿'));
    expect(submitButton?.attributes('disabled')).toBeDefined();
    expect(saveButton?.attributes('disabled')).toBeDefined();
  });

  it('renders bare index rails, label-edit bottom bar, and readonly model visibility references', async () => {
    mockApiClient.getReviewSample.mockResolvedValue(reviewDetail);
    mockApiClient.listQcQueue.mockResolvedValue(qcQueue);

    const wrapper = mount(ReviewWorkbenchPage, {
      props: {
        id: 'ds-live',
        sampleId: 'sample-1',
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    expect(wrapper.find('.relation-index-track').text()).toBe('R1');
    expect(wrapper.find('.candidate-index-track').text().replace(/\s+/g, '')).toBe('C1+');
    expect(wrapper.find('[aria-label="模型可见性参考"]').text()).toContain('subject_visible');
    expect(wrapper.find('[aria-label="模型可见性参考"]').text()).toContain('true');
    expect(wrapper.find('[aria-label="标注修改底栏"]').text()).toContain('校验修改');
    expect(wrapper.find('[aria-label="标注修改底栏"]').text()).toContain('保存草稿');
    expect(wrapper.find('[aria-label="标注修改底栏"]').text()).toContain('提交修改');
    expect(wrapper.text()).not.toContain('vote note');
    expect(wrapper.text()).not.toContain('提交质检');
    expect(wrapper.text()).not.toContain('人工精标');
  });

  it('marks unreferenced relation boxes purple and turns them red when selected', async () => {
    const orphanDetail: ReviewSampleDetail = {
      ...reviewDetail,
      stage1: {
        ...reviewDetail.stage1,
        keyRelations: [
          ...reviewDetail.stage1.keyRelations,
          {
            relationIndex: 'R2',
            subject: 'sign',
            relation: 'near',
            object: 'sidewalk',
            bbox: [100, 100, 220, 220],
          },
        ],
      },
      stage2: reviewDetail.stage2
        ? {
            ...reviewDetail.stage2,
            factVerifications: [
              ...reviewDetail.stage2.factVerifications,
              {
                ...reviewDetail.stage2.factVerifications[0],
                relationIndex: 'R2',
                subject: 'sign',
                relation: 'near',
                object: 'sidewalk',
                bbox: [100, 100, 220, 220],
              },
            ],
          }
        : undefined,
    };
    mockApiClient.getReviewSample.mockResolvedValue(orphanDetail);
    mockApiClient.listQcQueue.mockResolvedValue(qcQueue);

    const wrapper = mount(ReviewWorkbenchPage, {
      props: {
        id: 'ds-live',
        sampleId: 'sample-1',
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    expect(wrapper.findAll('.bbox-shell__box--selected')).toHaveLength(0);

    await wrapper.findAll('.relation-index-track .index-button').find((button) => button.text().includes('R2'))?.trigger('click');
    await flushPromises();

    const unreferencedBoxes = wrapper.findAll('.bbox-shell__box--purple');
    expect(unreferencedBoxes.length).toBeGreaterThan(0);
    expect(unreferencedBoxes.some((box) => box.classes().includes('bbox-shell__box--selected'))).toBe(false);
    expect(wrapper.findAll('.bbox-shell__box--black')).toHaveLength(0);

    const defaultToneClasses = wrapper
      .findAll('.bbox-shell__box')
      .filter((box) => /^(S2 )?R1$/.test(box.attributes('aria-label') ?? ''))
      .flatMap((box) => box.classes().filter((className) => className.startsWith('bbox-shell__box--')));
    expect(defaultToneClasses).not.toContain('bbox-shell__box--purple');
    expect(defaultToneClasses).not.toContain('bbox-shell__box--red');
    expect(defaultToneClasses).not.toContain('bbox-shell__box--black');

    const candidateToneClasses = wrapper
      .findAll('.bbox-shell__box')
      .filter((box) => /^C1 R1$/.test(box.attributes('aria-label') ?? ''))
      .flatMap((box) => box.classes().filter((className) => className.startsWith('bbox-shell__box--')));
    expect(candidateToneClasses.length).toBeGreaterThan(0);
    expect(candidateToneClasses).not.toContain('bbox-shell__box--purple');
    expect(candidateToneClasses).not.toContain('bbox-shell__box--red');
    expect(candidateToneClasses).not.toContain('bbox-shell__box--black');
    expect(
      candidateToneClasses.some((className) =>
        [
          'bbox-shell__box--blue',
          'bbox-shell__box--green',
          'bbox-shell__box--orange',
          'bbox-shell__box--cyan',
          'bbox-shell__box--yellow',
          'bbox-shell__box--teal',
        ].includes(className),
      ),
    ).toBe(true);

    await unreferencedBoxes[0].trigger('click');
    await flushPromises();

    const selectedPurpleBoxes = wrapper
      .findAll('.bbox-shell__box--purple')
      .filter((box) => box.classes().includes('bbox-shell__box--selected'));
    expect(selectedPurpleBoxes.length).toBeGreaterThan(0);
  });

  it('allows empty segmentation targets and sends a delete operation for removed candidates', async () => {
    mockApiClient.getReviewSample.mockResolvedValue(reviewDetail);
    mockApiClient.listQcQueue.mockResolvedValue(qcQueue);

    const wrapper = mount(ReviewWorkbenchPage, {
      props: {
        id: 'ds-live',
        sampleId: 'sample-1',
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    await wrapper.find('.tag button').trigger('click');

    const validateButton = wrapper.findAll('button').find((button) => button.text().includes('校验修改'));
    await validateButton?.trigger('click');
    await flushPromises();

    expect(mockApiClient.validateLabelEdit).toHaveBeenCalledWith(
      'ds-live',
      'sample-1',
      expect.objectContaining({
        operations: expect.arrayContaining([
          expect.objectContaining({
            scope: 'candidate:C1',
            field: 'segmentation_targets',
            op: 'replace',
            after: [],
          }),
        ]),
      }),
    );

    await wrapper.find('.candidate-delete-button').trigger('click');
    await flushPromises();

    expect(wrapper.find('.candidate-index-track').text().replace(/\s+/g, '')).toBe('+');
    expect(wrapper.find('[aria-label="标注修改底栏"]').text()).toContain('已修改 1 项');

    await validateButton?.trigger('click');
    await flushPromises();

    expect(mockApiClient.validateLabelEdit).toHaveBeenLastCalledWith(
      'ds-live',
      'sample-1',
      expect.objectContaining({
        operations: expect.arrayContaining([
          expect.objectContaining({
            scope: 'candidate:C1',
            field: 'candidate',
            op: 'delete_candidate',
            after: null,
          }),
        ]),
      }),
    );
  });

  it('keeps the current review visible while switching samples', async () => {
    const nextDetail = makeReviewDetail('sample-2');
    const nextDetailRequest = deferred<ReviewSampleDetail>();
    mockApiClient.getReviewSample
      .mockResolvedValueOnce(reviewDetail)
      .mockReturnValueOnce(nextDetailRequest.promise);
    mockApiClient.listQcQueue.mockResolvedValue([
      ...qcQueue,
      {
        ...qcQueue[0],
        sampleId: 'sample-2',
        assetId: 'asset-sample-2',
      },
    ]);

    const wrapper = mount(ReviewWorkbenchPage, {
      props: {
        id: 'ds-live',
        sampleId: 'sample-1',
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('sample-1');
    expect(wrapper.text()).not.toContain('Loading review sample...');

    await wrapper.setProps({ sampleId: 'sample-2' });
    await flushPromises();

    expect(wrapper.text()).toContain('sample-1');
    expect(wrapper.text()).not.toContain('Loading review sample...');
    expect(wrapper.text()).not.toContain('正在切换到 sample-2');

    nextDetailRequest.resolve(nextDetail);
    await flushPromises();

    expect(wrapper.text()).toContain('sample-2');
    expect(wrapper.text()).not.toContain('正在切换到 sample-2');
  });
});

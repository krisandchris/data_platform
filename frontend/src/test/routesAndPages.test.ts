import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '../services/http';
import type {
  AssetListItem,
  AssetSummary,
  AnnotationSnapshot,
  AnnotationSnapshotDiff,
  BatchLabelEditDraftSaveResult,
  Dataset,
  DatasetSummary,
  ImportJobDetail,
  LabelConfig,
  LabelConfigSaveResult,
  LabelConfigValidationResult,
  LabelEditValidationResult,
  ModelEvaluationCompareResult,
  ModelEvaluationDeltaSample,
  ModelEvaluationRun,
  PreannotationSummary,
  QcModificationEventStats,
  QcQueueItem,
  ReviewSampleDetail,
  SamplePoolItem,
  SamplePoolStats,
  TrainingExportJob,
} from '../shared/types/contract';

const mockApiClient = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
  listUsers: vi.fn(),
  listBatchAssignableUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  listRoleBindings: vi.fn(),
  createRoleBinding: vi.fn(),
  deleteRoleBinding: vi.fn(),
  getRbacCatalog: vi.fn(),
  listDatasets: vi.fn(),
  listDatasetTypes: vi.fn(),
  getDatasetType: vi.fn(),
  createDatasetType: vi.fn(),
  deleteDatasetBatch: vi.fn(),
  getDatasetBatchSummary: vi.fn(),
  getDatasetBatchAssetSummary: vi.fn(),
  listDatasetBatchAssets: vi.fn(),
  listDatasetBatchImportJobs: vi.fn(),
  createDatasetBatchImportJob: vi.fn(),
  getDatasetBatchImportJob: vi.fn(),
  getDatasetBatchPreannotationSummary: vi.fn(),
  createImportJob: vi.fn(),
  createImportJobArchive: vi.fn(),
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
  createTrainingExport: vi.fn(),
  listTrainingExports: vi.fn(),
  getTrainingExport: vi.fn(),
  downloadTrainingExport: vi.fn(),
  getTrainingExportDownloadUrl: vi.fn(),
  cancelTrainingExport: vi.fn(),
  createDatasetBatchEvaluation: vi.fn(),
  createModelEvaluation: vi.fn(),
  listDatasetBatchEvaluations: vi.fn(),
  listModelEvaluations: vi.fn(),
  getDatasetBatchEvaluation: vi.fn(),
  getModelEvaluation: vi.fn(),
  compareModelEvaluations: vi.fn(),
  listModelEvaluationDeltaSamples: vi.fn(),
  listDatasetBatchSnapshots: vi.fn(),
  listSnapshots: vi.fn(),
  diffDatasetBatchSnapshots: vi.fn(),
  diffSnapshots: vi.fn(),
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
  getMyBatchLabelEditDraft: vi.fn(),
  saveMyBatchLabelEditDraft: vi.fn(),
  autosaveMyBatchLabelEditDraft: vi.fn(),
  submitBatchLabelEdits: vi.fn(),
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

import App from '../app/App.vue';
import DatasetsPage from '../features/datasets/DatasetsPage.vue';
import DatasetTypePage from '../features/datasets/DatasetTypePage.vue';
import DatasetAssetsPage from '../features/datasets/DatasetAssetsPage.vue';
import DatasetOverviewPage from '../features/datasets/DatasetOverviewPage.vue';
import PreannotationsPage from '../features/datasets/PreannotationsPage.vue';
import ImportJobPage from '../features/import/ImportJobPage.vue';
import QcPage from '../features/qc/QcPage.vue';
import SamplePoolPage from '../features/sample-pool/SamplePoolPage.vue';
import ReviewWorkbenchPage from '../features/review-workbench/ReviewWorkbenchPage.vue';
import LabelConfigUploadPanel from '../features/datasets/components/LabelConfigUploadPanel.vue';
import AppShell from '../app/layouts/AppShell.vue';
import LoginPage from '../features/auth/LoginPage.vue';
import AccountPage from '../features/account/AccountPage.vue';
import AuditPage from '../features/audit/AuditPage.vue';
import UsersPage from '../features/users/UsersPage.vue';
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

const dispatchDocumentShortcut = (key: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  document.dispatchEvent(event);
  return event;
};

const dispatchElementShortcut = (element: Element, key: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  element.dispatchEvent(event);
  return event;
};

const makeRouterPushMock = () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  });
  return {
    router,
    push: vi.spyOn(router, 'push').mockResolvedValue(undefined),
  };
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

const makeTrainingExportJob = (overrides: Partial<TrainingExportJob> = {}): TrainingExportJob => ({
  exportId: 'export-coco-1',
  format: 'coco_json',
  source: 'current_filters',
  filters: { category: 'goods_blocking_road', status: 'active' },
  filterSummary: '类别：物品占道，状态：活跃',
  sampleCount: 1,
  status: 'completed',
  createdAt: '2026-05-19T10:00:00Z',
  completedAt: '2026-05-19T10:02:00Z',
  downloadUrl: 'http://backend.test/api/exports/export-coco-1/download',
  ...overrides,
});

const makeModelEvaluation = (overrides: Partial<ModelEvaluationRun> = {}): ModelEvaluationRun => ({
  evaluationId: 'eval-v2',
  datasetId: 'ds-live',
  modelName: 'Qwen2.5-VL',
  modelVersion: 'qwen2.5-vl-qc-v2',
  status: 'completed',
  sampleCount: 780,
  sourceExportId: 'export-coco-1',
  sourceSnapshotId: 'snap-model-v2',
  metrics: [
    { key: 'mAP50', label: 'mAP50', value: 0.84, baselineValue: 0.81, delta: 0.03 },
    { key: 'recall', label: '召回率', value: 0.8, baselineValue: 0.76, delta: 0.04 },
  ],
  metricDeltas: [{ key: 'mAP50', label: 'mAP50', value: 0.84, baselineValue: 0.81, delta: 0.03 }],
  categoryMetrics: [
    { category: 'goods_blocking_road', label: '物品占道', precision: 0.9, recall: 0.82, f1: 0.86, sampleCount: 120, delta: 0.02 },
  ],
  changedSampleCount: 12,
  createdAt: '2026-05-19T10:00:00Z',
  completedAt: '2026-05-19T10:08:00Z',
  ...overrides,
});

const makeEvaluationCompare = (): ModelEvaluationCompareResult => ({
  leftEvaluationId: 'eval-v1',
  rightEvaluationId: 'eval-v2',
  leftModelVersion: 'qwen2.5-vl-qc-v1',
  rightModelVersion: 'qwen2.5-vl-qc-v2',
  metricDeltas: [{ key: 'mAP50', label: 'mAP50', value: 0.84, baselineValue: 0.81, delta: 0.03 }],
  categoryDeltas: [{ category: 'goods_blocking_road', label: '物品占道', precision: 0.9, recall: 0.82, f1: 0.86, sampleCount: 120, delta: 0.02 }],
  changedSampleCount: 12,
  improvedCount: 8,
  regressedCount: 4,
});

const makeDeltaSamples = (): ModelEvaluationDeltaSample[] => [
  {
    sampleId: 'sample-1',
    category: 'goods_blocking_road',
    changeType: '指标提升',
    beforeSnapshotId: 'snap-baseline-1',
    afterSnapshotId: 'snap-model-v2-1',
    metricImpacts: [{ key: 'confidence', label: '置信度', value: 0.9, baselineValue: 0.75, delta: 0.15 }],
    reason: '修正样本被新模型正确召回',
  },
];

const makeSnapshot = (overrides: Partial<AnnotationSnapshot> = {}): AnnotationSnapshot => ({
  snapshotId: 'snap-confirmed-1',
  datasetId: 'ds-live',
  sampleId: 'sample-1',
  snapshotType: 'confirmed',
  labelConfigVersion: 'urban_violation_labels_v1',
  sourceSubmissionId: 'submission-1',
  payloadHash: 'hash-confirmed',
  createdBy: 'qc_lead_a',
  createdAt: '2026-05-19T09:20:00Z',
  rollbackAvailable: false,
  ...overrides,
});

const makeSnapshotDiff = (): AnnotationSnapshotDiff => ({
  datasetId: 'ds-live',
  leftSnapshotId: 'snap-baseline-1',
  rightSnapshotId: 'snap-confirmed-1',
  changedFieldCount: 3,
  changedRelationCount: 1,
  changedCandidateCount: 1,
  changedFields: [{ field: 'candidate.C1.violation_category', label: '候选类别', changeType: 'replace', before: '摊贩占道', after: '物品占道' }],
  relations: [{ relationIndex: 'R1', field: 'bbox', label: '关系框', changeType: 'replace', before: [1, 2, 3, 4], after: [2, 3, 4, 5] }],
  candidates: [{ candidateIndex: 'C1', field: 'violation_category', label: '候选类别', changeType: 'replace', before: 'road_occupying_vendor', after: 'goods_blocking_road' }],
  summary: '确认版本相对基线存在 3 项变更',
  rollbackAvailable: false,
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
  expiresAt: '2099-01-01T00:00:00Z',
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
      options: [
        { code: 'goods', labelZh: '货物', aliases: [] },
        { code: 'nonmotor_vehicle', labelZh: '非机动车', aliases: [] },
        { code: 'motor_vehicle', labelZh: '机动车', aliases: [] },
      ],
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
  mockApiClient.login.mockResolvedValue(currentUser);
  mockApiClient.listUsers.mockResolvedValue([currentUser]);
  mockApiClient.listBatchAssignableUsers.mockResolvedValue([currentUser]);
  mockApiClient.listRoleBindings.mockResolvedValue([]);
  mockApiClient.getRbacCatalog.mockResolvedValue({
    roles: [
      {
        role: 'platform_admin',
        label: '平台管理员',
        description: '管理账号、角色、审计与全平台配置',
        permissions: ['users:manage', 'roles:manage', 'audit:read'],
      },
      {
        role: 'dataset_admin',
        label: '数据集管理员',
        description: '管理数据集类型与批次',
        permissions: ['roles:manage', 'batch_assignment:manage', 'audit:read'],
      },
      {
        role: 'batch_manager',
        label: '批次管理员',
        description: '管理批次分配',
        permissions: ['batch_assignment:manage', 'audit:read'],
      },
      {
        role: 'qc_lead',
        label: '质检负责人',
        description: '确认质检提交',
        permissions: ['label_edit:confirm', 'audit:read'],
      },
      {
        role: 'annotator',
        label: '标注员',
        description: '编辑标签',
        permissions: ['label_edit:write'],
      },
      {
        role: 'auditor',
        label: '审计员',
        description: '查看审计记录',
        permissions: ['audit:read'],
      },
    ],
    scopes: [
      { scopeType: 'platform', label: '全平台' },
      { scopeType: 'dataset_type', label: '数据集类型' },
      { scopeType: 'dataset_batch', label: '数据集批次' },
    ],
    permissions: ['users:manage', 'roles:manage', 'batch_assignment:manage', 'audit:read', 'label_edit:confirm', 'label_edit:write'],
  });
  mockApiClient.logout.mockResolvedValue(undefined);
  mockApiClient.getDatasetBatchSummary.mockResolvedValue(makeDatasetSummary('ds-live', 'Batch A', 2));
  mockApiClient.deleteDatasetBatch.mockResolvedValue(undefined);
  mockApiClient.getDatasetType.mockResolvedValue({
    datasetType: 'urban_violation',
    displayName: '城市违规',
    fieldSchemaVersion: '2026-05-18',
    activeLabelConfigVersion: 'urban_violation_labels_v1',
    status: 'active',
    batchCount: 1,
    batches: [dataset],
  });
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
  mockApiClient.createTrainingExport.mockResolvedValue(makeTrainingExportJob({ exportId: 'export-created' }));
  mockApiClient.listTrainingExports.mockResolvedValue([
    makeTrainingExportJob(),
    makeTrainingExportJob({
      exportId: 'export-running',
      source: 'all_active_pool_items',
      filters: { status: 'active' },
      filterSummary: '全部活跃样本',
      sampleCount: 2,
      status: 'running',
      completedAt: undefined,
      downloadUrl: undefined,
    }),
  ]);
  mockApiClient.getTrainingExport.mockResolvedValue(makeTrainingExportJob());
  mockApiClient.downloadTrainingExport.mockResolvedValue({
    exportId: 'export-coco-1',
    url: 'http://backend.test/api/exports/export-coco-1/download',
  });
  mockApiClient.getTrainingExportDownloadUrl.mockImplementation(
    (exportId: string) => `http://backend.test/api/exports/${exportId}/download`,
  );
  mockApiClient.cancelTrainingExport.mockImplementation((exportId: string) =>
    Promise.resolve(makeTrainingExportJob({ exportId, status: 'cancelled', completedAt: '2026-05-19T10:04:00Z' })),
  );
  mockApiClient.createDatasetBatchEvaluation.mockResolvedValue(makeModelEvaluation({ evaluationId: 'eval-created' }));
  mockApiClient.createModelEvaluation.mockResolvedValue(makeModelEvaluation({ evaluationId: 'eval-created' }));
  mockApiClient.listDatasetBatchEvaluations.mockResolvedValue([
    makeModelEvaluation(),
    makeModelEvaluation({
      evaluationId: 'eval-v1',
      modelVersion: 'qwen2.5-vl-qc-v1',
      metrics: [{ key: 'mAP50', label: 'mAP50', value: 0.81 }],
      metricDeltas: [],
      changedSampleCount: 18,
      createdAt: '2026-05-18T10:00:00Z',
      completedAt: '2026-05-18T10:08:00Z',
    }),
  ]);
  mockApiClient.listModelEvaluations.mockResolvedValue([makeModelEvaluation()]);
  mockApiClient.getDatasetBatchEvaluation.mockResolvedValue(makeModelEvaluation());
  mockApiClient.getModelEvaluation.mockResolvedValue(makeModelEvaluation());
  mockApiClient.compareModelEvaluations.mockResolvedValue(makeEvaluationCompare());
  mockApiClient.listModelEvaluationDeltaSamples.mockResolvedValue(makeDeltaSamples());
  mockApiClient.listDatasetBatchSnapshots.mockResolvedValue([
    makeSnapshot(),
    makeSnapshot({
      snapshotId: 'snap-baseline-1',
      snapshotType: 'baseline',
      sourceSubmissionId: undefined,
      payloadHash: 'hash-baseline',
      createdBy: 'importer',
      createdAt: '2026-05-18T09:00:00Z',
    }),
  ]);
  mockApiClient.listSnapshots.mockResolvedValue([makeSnapshot()]);
  mockApiClient.diffDatasetBatchSnapshots.mockResolvedValue(makeSnapshotDiff());
  mockApiClient.diffSnapshots.mockResolvedValue(makeSnapshotDiff());
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
  mockApiClient.getMyBatchLabelEditDraft.mockResolvedValue({
    datasetId: 'ds-live',
    savedSampleCount: 0,
    totalSampleCount: 1,
    samples: [],
  });
  mockApiClient.saveMyBatchLabelEditDraft.mockResolvedValue({
    saved: true,
    datasetId: 'ds-live',
    savedSampleCount: 1,
    totalSampleCount: 1,
    sampleIds: ['sample-1'],
    updatedAt: '2026-05-18T00:00:00Z',
  });
  mockApiClient.autosaveMyBatchLabelEditDraft.mockResolvedValue({
    saved: true,
    datasetId: 'ds-live',
    savedSampleCount: 1,
    totalSampleCount: 1,
    sampleIds: ['sample-1'],
    updatedAt: '2026-05-18T00:00:00Z',
  });
  mockApiClient.submitBatchLabelEdits.mockResolvedValue({
    submitted: true,
    datasetId: 'ds-live',
    status: 'submitted',
    submittedAt: '2026-05-18T00:00:00Z',
    submittedSampleCount: 1,
    totalSampleCount: 1,
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

  it('renders login as a standalone route without the app shell', async () => {
    mockApiClient.getCurrentUser.mockRejectedValueOnce(new Error('unauthenticated'));
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', name: 'login', component: LoginPage },
        { path: '/datasets', name: 'datasets', component: { template: '<div>Datasets</div>' } },
      ],
    });
    await router.push('/login');
    await router.isReady();

    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    expect(wrapper.find('.login-page').exists()).toBe(true);
    expect(wrapper.find('.app-shell').exists()).toBe(false);
    expect(wrapper.find('.sidebar').exists()).toBe(false);
    expect(wrapper.find('.topbar').exists()).toBe(false);
    expect(wrapper.text()).toContain('登录平台');
    wrapper.unmount();
  });

  it('redirects unauthenticated protected routes to login with the target path', async () => {
    mockApiClient.getCurrentUser.mockRejectedValueOnce(new Error('unauthenticated'));

    await appRouter.push('/login');
    await appRouter.isReady();
    await appRouter.push('/datasets/ds-live/qc?tab=queue');
    await flushPromises();

    expect(appRouter.currentRoute.value.name).toBe('login');
    expect(appRouter.currentRoute.value.query.redirect).toBe('/datasets/ds-live/qc?tab=queue');
  });

  it('keeps redirect after successful login', async () => {
    mockApiClient.getCurrentUser.mockRejectedValueOnce(new Error('unauthenticated'));
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', name: 'login', component: LoginPage },
        { path: '/datasets/:id/qc', name: 'dataset-qc', component: { template: '<div>QC</div>' } },
        { path: '/datasets', name: 'datasets', component: { template: '<div>Datasets</div>' } },
      ],
    });
    await router.push('/login?redirect=/datasets/ds-live/qc');
    await router.isReady();

    const wrapper = mount(LoginPage, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('annotator_a');
    await inputs[1].setValue('secret');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mockApiClient.login).toHaveBeenCalledWith({ username: 'annotator_a', password: 'secret' });
    expect(router.currentRoute.value.path).toBe('/datasets/ds-live/qc');
    wrapper.unmount();
  });

  it('shows failed login errors without leaving the login page', async () => {
    mockApiClient.getCurrentUser.mockRejectedValueOnce(new Error('unauthenticated'));
    mockApiClient.login.mockRejectedValueOnce(new Error('账号或密码错误'));
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', name: 'login', component: LoginPage },
        { path: '/datasets', name: 'datasets', component: { template: '<div>Datasets</div>' } },
      ],
    });
    await router.push('/login');
    await router.isReady();

    const wrapper = mount(LoginPage, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('annotator_a');
    await inputs[1].setValue('bad-password');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('账号或密码错误');
    expect(router.currentRoute.value.name).toBe('login');
    wrapper.unmount();
  });

  it('keeps the dev user switch in dev mode', async () => {
    mockApiClient.getCurrentUser
      .mockRejectedValueOnce(new Error('unauthenticated'))
      .mockResolvedValueOnce(currentUser);
    mockApiClient.listUsers.mockResolvedValueOnce([currentUser]);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', name: 'login', component: LoginPage },
        { path: '/sample-pool', name: 'sample-pool', component: { template: '<div>Pool</div>' } },
      ],
    });
    await router.push('/login?redirect=/sample-pool');
    await router.isReady();

    const wrapper = mount(LoginPage, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    expect(wrapper.find('[aria-label="开发用户切换"]').exists()).toBe(true);
    await wrapper.find('[aria-label="开发用户切换"] button').trigger('click');
    await flushPromises();

    expect(window.localStorage.getItem('uvp.devUserId')).toBe('annotator_a');
    expect(router.currentRoute.value.path).toBe('/sample-pool');
    wrapper.unmount();
  });

  it('loads audit events without assuming the fixture dataset batch', async () => {
    mockApiClient.listAuditEvents.mockResolvedValue([]);
    mockApiClient.getQcProgress.mockResolvedValue({
      datasetId: 'urban_violation__uploaded',
      byStatus: {},
      byUser: [],
      total: 0,
      updatedAt: '2026-05-21T00:00:00Z',
    });

    const wrapper = mount(AuditPage);
    await flushPromises();

    const initialFilters = mockApiClient.listAuditEvents.mock.calls[0]?.[0];
    expect(initialFilters).toBeDefined();
    expect(initialFilters?.datasetId).toBeUndefined();
    expect(mockApiClient.getQcProgress).not.toHaveBeenCalled();

    await wrapper.find('input[placeholder="dataset_id"]').setValue('urban_violation__uploaded');
    await wrapper.find('form.filters').trigger('submit.prevent');
    await flushPromises();

    expect(mockApiClient.listAuditEvents.mock.calls[1]?.[0]?.datasetId).toBe('urban_violation__uploaded');
    expect(mockApiClient.getQcProgress).toHaveBeenCalledWith('urban_violation__uploaded');
    wrapper.unmount();
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

  it('renders the permission console tabs and opens the account drawer on demand', async () => {
    mockApiClient.getCurrentUser.mockResolvedValue(adminUser);
    mockApiClient.listUsers.mockResolvedValue([
      {
        userId: 'admin',
        username: 'admin',
        displayName: '平台管理员',
        email: 'admin@example.local',
        status: 'active',
      },
      {
        userId: 'new_user',
        username: 'new_user',
        displayName: '未授权用户',
        email: 'new@example.local',
        status: 'active',
      },
    ]);
    mockApiClient.listRoleBindings.mockResolvedValue([
      {
        bindingId: 'binding-admin',
        userId: 'admin',
        role: 'platform_admin',
        scopeType: 'platform',
        scopeId: '*',
        createdAt: '2026-05-18T00:00:00Z',
        createdBy: 'system',
      },
    ]);

    const wrapper = mount(UsersPage);
    await flushPromises();

    expect(wrapper.text()).toContain('账号管理');
    expect(wrapper.text()).toContain('数据集权限分配');
    expect(wrapper.text()).toContain('角色绑定记录');
    expect(wrapper.text()).toContain('未分配角色');
    expect(wrapper.find('input[placeholder="至少 8 位"]').exists()).toBe(false);

    const createButton = wrapper.findAll('button').find((button) => button.text().includes('新建账号'));
    await createButton?.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('新建账号');
    expect(wrapper.find('input[placeholder="至少 8 位"]').exists()).toBe(true);
  });

  it('opens the dataset permission assignment drawer with dataset-batch flow and permission preview', async () => {
    mockApiClient.getCurrentUser.mockResolvedValue(adminUser);
    mockApiClient.listUsers.mockResolvedValue([
      { userId: 'annotator_a', username: 'annotator_a', displayName: '标注员 A', status: 'active' },
    ]);
    mockApiClient.listRoleBindings.mockResolvedValue([]);
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
      {
        datasetType: 'ares_detection',
        displayName: 'Ares Detection',
        fieldSchemaVersion: 'draft',
        status: 'active',
        batchCount: 0,
        batches: [],
      },
    ]);

    const wrapper = mount(UsersPage);
    await flushPromises();

    const assignButton = wrapper.findAll('button').find((button) => button.text().includes('分配数据权限'));
    await assignButton?.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('数据权限分配向导');
    await wrapper.find('[data-testid="assignment-scope"]').setValue('dataset_batch');
    await wrapper.find('[data-testid="assignment-dataset-type"]').setValue('urban_violation');
    expect(wrapper.find('[data-testid="assignment-batch"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="assignment-batch"]').text()).toContain('ds-live');
    await wrapper.find('[data-testid="assignment-role"]').setValue('qc_lead');
    const previewText = wrapper.find('[data-testid="rbac-permission-preview"]').text();
    const legacyConfirmPermission = ['qc', 'submission'].join('_') + ':confirm';
    expect(previewText).toContain('提交确认');
    expect(previewText).not.toContain(legacyConfirmPermission);
  });

  it('shows binding detail and delete confirmation with user role and scope', async () => {
    mockApiClient.getCurrentUser.mockResolvedValue(adminUser);
    mockApiClient.listUsers.mockResolvedValue([
      { userId: 'annotator_a', username: 'annotator_a', displayName: '标注员 A', status: 'active' },
    ]);
    mockApiClient.listRoleBindings.mockResolvedValue([
      {
        bindingId: 'binding-annotator',
        userId: 'annotator_a',
        role: 'annotator',
        scopeType: 'dataset_batch',
        scopeId: 'ds-live',
        createdAt: '2026-05-18T00:00:00Z',
        createdBy: 'admin',
      },
    ]);

    const wrapper = mount(UsersPage);
    await flushPromises();

    await wrapper.findAll('button').find((button) => button.text().includes('角色绑定记录'))?.trigger('click');
    await flushPromises();
    await wrapper.findAll('button').find((button) => button.text().includes('详情'))?.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('绑定详情');
    expect(wrapper.text()).toContain('派生权限');
    expect(wrapper.text()).toContain('admin');

    await wrapper.find('button[aria-label="关闭"]').trigger('click');
    await flushPromises();
    await wrapper.findAll('button').find((button) => button.text().includes('删除'))?.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('确认删除 标注员 A 的 标注员');
    expect(wrapper.text()).toContain('数据集批次 · ds-live');
  });

  it('confirms account disable and displays backend 409 errors', async () => {
    mockApiClient.getCurrentUser.mockResolvedValue(adminUser);
    mockApiClient.listUsers.mockResolvedValue([
      { userId: 'admin', username: 'admin', displayName: '平台管理员', status: 'active' },
      { userId: 'annotator_a', username: 'annotator_a', displayName: '标注员 A', status: 'active' },
    ]);
    mockApiClient.updateUser.mockRejectedValueOnce(
      new ApiClientError(409, '不能禁用存在未完成任务的账号', {
        code: 'user_has_active_tasks',
        message: '不能禁用存在未完成任务的账号',
      }),
    );

    const wrapper = mount(UsersPage);
    await flushPromises();

    const disableButtons = wrapper.findAll('button').filter((button) => button.text() === '禁用');
    await disableButtons[1]?.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('确认禁用账号 标注员 A');

    await wrapper.findAll('button').find((button) => button.text().includes('确认禁用'))?.trigger('click');
    await flushPromises();

    expect(mockApiClient.updateUser).toHaveBeenCalledWith('annotator_a', { status: 'disabled' });
    expect(wrapper.text()).toContain('不能禁用存在未完成任务的账号');
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

  it('renders sample pool export controls and task states', async () => {
    mockApiClient.listTrainingExports.mockResolvedValueOnce([
      makeTrainingExportJob(),
      makeTrainingExportJob({
        exportId: 'export-running',
        source: 'all_active_pool_items',
        filters: { status: 'active' },
        filterSummary: '全部活跃样本',
        sampleCount: 2,
        status: 'running',
        completedAt: undefined,
        downloadUrl: undefined,
      }),
      makeTrainingExportJob({
        exportId: 'export-failed',
        status: 'failed',
        error: '生成文件失败',
        completedAt: '2026-05-19T10:03:00Z',
        downloadUrl: undefined,
      }),
    ]);
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

    expect(wrapper.text()).toContain('导出管理');
    expect(wrapper.find('[data-testid="training-export-format"]').text()).toContain('COCO JSON');
    expect(wrapper.find('[data-testid="training-export-format"]').text()).toContain('VOC XML（不可用）');
    expect(wrapper.find('[data-testid="training-export-table"]').text()).toContain('export-coco-1');
    expect(wrapper.find('[data-testid="training-export-table"]').text()).toContain('已完成');
    expect(wrapper.find('[data-testid="training-export-table"]').text()).toContain('生成中');
    expect(wrapper.find('[data-testid="training-export-table"]').text()).toContain('生成文件失败');
    expect(wrapper.find('[data-testid="training-export-download-export-running"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-testid="training-export-cancel-export-coco-1"]').attributes('disabled')).toBeDefined();
  });

  it('creates a sample pool export from current filters', async () => {
    const created = makeTrainingExportJob({
      exportId: 'export-new',
      filters: { category: 'goods_blocking_road', status: 'active' },
      filterSummary: '类别：物品占道，状态：活跃',
    });
    mockApiClient.listTrainingExports.mockResolvedValueOnce([]).mockResolvedValueOnce([created]);
    mockApiClient.createTrainingExport.mockResolvedValueOnce(created);
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
    await wrapper.find('[data-testid="sample-pool-filter-status"]').setValue('active');
    await wrapper.find('form.sample-pool-export-create').trigger('submit');
    await flushPromises();

    expect(mockApiClient.createTrainingExport).toHaveBeenCalledWith({
      format: 'coco_json',
      source: 'current_filters',
      filters: {
        category: 'goods_blocking_road',
        status: 'active',
      },
    });
    expect(wrapper.find('[data-testid="training-export-success"]').text()).toContain('已创建导出任务 export-new');
    expect(wrapper.find('[data-testid="training-export-table"]').text()).toContain('export-new');
  });

  it('opens completed export downloads and cancels running exports', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    mockApiClient.listTrainingExports.mockResolvedValueOnce([
      makeTrainingExportJob(),
      makeTrainingExportJob({
        exportId: 'export-running',
        source: 'all_active_pool_items',
        filters: { status: 'active' },
        filterSummary: '全部活跃样本',
        sampleCount: 2,
        status: 'running',
        completedAt: undefined,
        downloadUrl: undefined,
      }),
    ]);
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

    await wrapper.find('[data-testid="training-export-download-export-coco-1"]').trigger('click');
    await wrapper.find('[data-testid="training-export-cancel-export-running"]').trigger('click');
    await flushPromises();

    expect(openSpy).toHaveBeenCalledWith('http://backend.test/api/exports/export-coco-1/download', '_blank', 'noopener');
    expect(mockApiClient.cancelTrainingExport).toHaveBeenCalledWith('export-running');
    expect(wrapper.find('[data-testid="training-export-table"]').text()).toContain('已取消');

    openSpy.mockRestore();
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
      {
        datasetType: 'ares_detection',
        displayName: 'Ares Detection',
        fieldSchemaVersion: 'draft',
        status: 'active',
        batchCount: 0,
        batches: [],
      },
    ]);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/datasets', component: DatasetsPage },
        { path: '/datasets/types/:datasetType', component: { template: '<div />' } },
        { path: '/datasets/types/:datasetType/label-config', component: { template: '<div />' } },
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
    expect(wrapper.text()).toContain('ares_detection');
    expect(wrapper.text()).toContain('urban_violation_labels_v1');
    expect(wrapper.text()).toContain('批次数');
    expect(wrapper.text()).toContain('进入类型管理');
    expect(wrapper.text()).toContain('标签配置');
    expect(wrapper.text()).toContain('新建批次');
    expect(wrapper.text()).not.toContain('标签配置上传');
    expect(wrapper.text()).not.toContain('配置版本');
    expect(mockApiClient.getActiveLabelConfig).not.toHaveBeenCalled();
  });

  it('opens dataset type label config management from the child route', async () => {
    mockApiClient.getDatasetType.mockResolvedValue({
      datasetType: 'urban_violation',
      displayName: '城市违规',
      fieldSchemaVersion: '2026-05-18',
      activeLabelConfigVersion: 'urban_violation_labels_v1',
      status: 'active',
      batchCount: 1,
      batches: [dataset],
    });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/datasets/types/:datasetType/label-config',
          component: DatasetTypePage,
          props: (route) => ({
            datasetType: String(route.params.datasetType),
            section: 'label-config',
          }),
        },
      ],
    });
    await router.push('/datasets/types/urban_violation/label-config');
    await router.isReady();

    const wrapper = mount(RouterView, {
      global: {
        plugins: [router],
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await flushPromises();

    expect(mockApiClient.getDatasetType).toHaveBeenCalledWith('urban_violation');
    expect(wrapper.text()).toContain('标签配置上传');
    expect(wrapper.text()).toContain('上传并更新配置');
    expect(wrapper.text()).toContain('重新加载当前配置');
    expect(wrapper.text()).not.toContain('另存为新版本');
    const buttonTexts = wrapper.findAll('button').map((button) => button.text());
    expect(buttonTexts.some((text) => text.includes('激活'))).toBe(false);
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
          RouterLink: {
            props: ['to'],
            template: '<a><slot /></a>',
          },
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
    expect(wrapper.text()).toContain('进入类型管理');
    expect(wrapper.text()).toContain('新建批次');
  });

  it('uploads a batch archive and registers it as a manual batch', async () => {
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
    mockApiClient.getDatasetType
      .mockResolvedValueOnce({
        datasetType: 'ares_detection',
        displayName: 'Ares Detection',
        fieldSchemaVersion: 'draft',
        status: 'active',
        batchCount: 0,
        batches: [],
      })
      .mockResolvedValueOnce({
        datasetType: 'ares_detection',
        displayName: 'Ares Detection',
        fieldSchemaVersion: 'draft',
        status: 'active',
        batchCount: 1,
        batches: [aresBatch],
      });
    let resolveArchiveUpload: ((value: unknown) => void) | undefined;
    const createdImportJob = {
      ...importJob,
      id: 'manual-import-1',
      datasetId: 'ares_detection__20260518_roadside',
      datasetType: 'ares_detection',
      batchKey: '20260518_roadside',
      sourceMode: 'uploaded_package',
      sourceUri: '20260518_roadside.zip',
      sourceStructure: 'images_with_preannotations',
      state: 'Draft',
    };
    mockApiClient.createImportJobArchive.mockImplementation((_datasetId, payload) => {
      payload.onUploadProgress?.({ loadedBytes: 500, totalBytes: 1000, percent: 50 });
      return new Promise((resolve) => {
        resolveArchiveUpload = resolve;
      });
    });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/datasets/types/:datasetType', component: { template: '<div />' } }],
    });
    await router.push('/datasets/types/ares_detection');
    await router.isReady();

    const wrapper = mount(DatasetTypePage, {
      props: {
        datasetType: 'ares_detection',
        section: 'overview',
      },
      global: {
        plugins: [router],
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await flushPromises();

    expect(mockApiClient.getDatasetType).toHaveBeenCalledWith('ares_detection');
    expect(wrapper.text()).toContain('暂无批次');

    const newBatchButton = wrapper.findAll('button').find((button) => button.text().includes('新建批次'));
    expect(newBatchButton).toBeTruthy();
    await newBatchButton!.trigger('click');
    await wrapper.find('input[placeholder="20260518_roadside"]').setValue('20260518_roadside');
    await wrapper.find('input[placeholder="2026-05-18 路侧巡检"]').setValue('2026-05-18 路侧巡检');
    await wrapper.find('select').setValue('images_with_preannotations');

    const archiveFile = new File(['archive-bytes'], '20260518_roadside.zip', { type: 'application/zip' });
    const input = wrapper.find('input[type="file"]');
    Object.defineProperty(input.element, 'files', { value: [archiveFile], configurable: true });
    await input.trigger('change');
    await wrapper.find('form.batch-create-form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('50%');
    expect(wrapper.text()).toContain('500 B / 1000 B');

    expect(mockApiClient.createImportJobArchive).toHaveBeenCalledWith('ares_detection', expect.objectContaining({
      datasetType: 'ares_detection',
      batchKey: '20260518_roadside',
      batchName: '2026-05-18 路侧巡检',
      sourceStructure: 'images_with_preannotations',
      description: undefined,
      archiveFile,
      archiveFileName: '20260518_roadside.zip',
      onUploadProgress: expect.any(Function),
    }));

    resolveArchiveUpload?.(createdImportJob);
    await flushPromises();

    expect(wrapper.text()).toContain('ares_detection__20260518_roadside');
    expect(wrapper.text()).toContain('概览');
    expect(wrapper.text()).toContain('资产');
    expect(wrapper.text()).toContain('导入校验');
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
    mockApiClient.getDatasetType
      .mockResolvedValueOnce({
        datasetType: 'urban_violation',
        displayName: '城市违规',
        fieldSchemaVersion: '2026-05-18',
        activeLabelConfigVersion: 'urban_violation_labels_v1',
        status: 'active',
        batchCount: 1,
        batches: [readyBatch],
      })
      .mockResolvedValueOnce({
        datasetType: 'urban_violation',
        displayName: '城市违规',
        fieldSchemaVersion: '2026-05-18',
        activeLabelConfigVersion: 'urban_violation_labels_v1',
        status: 'active',
        batchCount: 1,
        batches: [queuedBatch],
      });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/datasets/types/:datasetType', component: { template: '<div />' } }],
    });
    await router.push('/datasets/types/urban_violation');
    await router.isReady();

    const wrapper = mount(DatasetTypePage, {
      props: {
        datasetType: 'urban_violation',
        section: 'overview',
      },
      global: {
        plugins: [router],
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a><slot /></a>',
          },
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
    expect(wrapper.text()).toContain('进入质检队列');
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
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
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

  it('links batch overview type configuration to the dataset-type child route', async () => {
    const labelConfigRequired = makeDatasetSummary('urban_violation__needs_config', 'Batch A', 2);
    labelConfigRequired.dataset.lifecycleStatus = 'label_config_required';
    labelConfigRequired.dataset.status = 'label_config_required';
    labelConfigRequired.dataset.datasetType = 'urban_violation';
    mockApiClient.getDatasetBatchSummary.mockResolvedValueOnce(labelConfigRequired);

    const wrapper = mount(DatasetOverviewPage, {
      props: {
        id: 'urban_violation__needs_config',
      },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="String(to)"><slot /></a>',
          },
        },
      },
    });
    await flushPromises();

    const links = wrapper.findAll('a').filter((link) => link.text().includes('管理类型配置'));
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((link) => link.attributes('href') === '/datasets/types/urban_violation/label-config')).toBe(true);
  });

  it('shows batch deletion only to platform admins and requires exact batch id confirmation', async () => {
    mockApiClient.getCurrentUser.mockResolvedValue(adminUser);
    const wrapper = mount(DatasetOverviewPage, {
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
    await flushPromises();

    const deleteButton = wrapper.findAll('button').find((button) => button.text().includes('删除批次'));
    expect(deleteButton).toBeTruthy();

    await deleteButton?.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('批次名称');
    expect(wrapper.text()).toContain('Batch A');
    expect(wrapper.text()).toContain('批次 ID');
    expect(wrapper.text()).toContain('ds-live');
    expect(wrapper.text()).toContain('数据集类型');
    expect(wrapper.text()).toContain('urban_violation');
    expect(wrapper.text()).toContain('不删除 DATASET 原始文件');
    expect(wrapper.text()).toContain('删除后无法从平台恢复');

    const confirmButton = wrapper.findAll('button').find((button) => button.text().includes('确认删除'));
    expect(confirmButton?.attributes('disabled')).toBeDefined();

    await wrapper.find('.delete-confirm-field input').setValue('ds-live');
    expect(wrapper.findAll('button').find((button) => button.text().includes('确认删除'))?.attributes('disabled')).toBeUndefined();
  });

  it('hides batch deletion for non-admin users without delete permission', async () => {
    const wrapper = mount(DatasetOverviewPage, {
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

    expect(wrapper.findAll('button').some((button) => button.text().includes('删除批次'))).toBe(false);
  });

  it('deletes a batch after confirmation and navigates back to the dataset type page', async () => {
    mockApiClient.getCurrentUser.mockResolvedValue(adminUser);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/datasets/:id/overview', component: { template: '<div />' } },
        { path: '/datasets/types/:datasetType', component: { template: '<div />' } },
        { path: '/datasets', component: { template: '<div />' } },
      ],
    });
    await router.push('/datasets/ds-live/overview');
    await router.isReady();

    const wrapper = mount(DatasetOverviewPage, {
      props: {
        id: 'ds-live',
      },
      global: {
        plugins: [router],
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await flushPromises();
    await flushPromises();

    const deleteButton = wrapper.findAll('button').find((button) => button.text().includes('删除批次'));
    expect(deleteButton).toBeTruthy();
    await deleteButton?.trigger('click');
    await wrapper.find('.delete-confirm-field input').setValue('ds-live');
    const confirmButton = wrapper.findAll('button').find((button) => button.text().includes('确认删除'));
    await confirmButton?.trigger('click');
    await flushPromises();

    expect(mockApiClient.deleteDatasetBatch).toHaveBeenCalledWith('ds-live');
    expect(router.currentRoute.value.fullPath).toBe('/datasets/types/urban_violation');
  });

  it('shows Chinese batch deletion errors for forbidden and conflict responses', async () => {
    mockApiClient.getCurrentUser.mockResolvedValue(adminUser);
    mockApiClient.deleteDatasetBatch
      .mockRejectedValueOnce(
        new ApiClientError(403, 'forbidden', {
          code: 'forbidden',
          message: 'forbidden',
        }),
      )
      .mockRejectedValueOnce(
        new ApiClientError(409, 'batch conflict', {
          code: 'dataset_batch_delete_conflict',
          message: '批次仍有关联任务或状态冲突，请处理后重试。',
        }),
      );

    const wrapper = mount(DatasetOverviewPage, {
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
    await flushPromises();

    const deleteButton = wrapper.findAll('button').find((button) => button.text().includes('删除批次'));
    expect(deleteButton).toBeTruthy();
    await deleteButton?.trigger('click');
    await wrapper.find('.delete-confirm-field input').setValue('ds-live');
    let confirmButton = wrapper.findAll('button').find((button) => button.text().includes('确认删除'));
    await confirmButton?.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('当前账号没有删除批次权限。');

    confirmButton = wrapper.findAll('button').find((button) => button.text().includes('确认删除'));
    await confirmButton?.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('批次仍有关联任务或状态冲突，请处理后重试。');
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

  it('renders model evaluation and version history on the batch overview', async () => {
    const wrapper = mount(DatasetOverviewPage, {
      props: {
        id: 'urban_violation__0519_phase4',
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();
    await flushPromises();

    expect(mockApiClient.listDatasetBatchEvaluations).toHaveBeenCalledWith('urban_violation__0519_phase4');
    expect(mockApiClient.compareModelEvaluations).toHaveBeenCalledWith('eval-v1', 'eval-v2');
    expect(mockApiClient.listDatasetBatchSnapshots).toHaveBeenCalledWith('urban_violation__0519_phase4');
    expect(mockApiClient.diffDatasetBatchSnapshots).toHaveBeenCalledWith(
      'urban_violation__0519_phase4',
      'snap-baseline-1',
      'snap-confirmed-1',
    );
    expect(wrapper.text()).toContain('模型评估');
    expect(wrapper.text()).toContain('qwen2.5-vl-qc-v2');
    expect(wrapper.text()).toContain('评估比较');
    expect(wrapper.text()).toContain('mAP50');
    expect(wrapper.text()).toContain('版本历史');
    expect(wrapper.text()).toContain('确认标注');
    expect(wrapper.text()).toContain('候选类别');
    expect(wrapper.text()).toContain('回滚需通过精确恢复校验后启用');

    const deltaButton = wrapper.findAll('button').find((button) => button.text().includes('变化样本'));
    await deltaButton?.trigger('click');
    await flushPromises();

    expect(mockApiClient.listModelEvaluationDeltaSamples).toHaveBeenCalledWith('eval-v2');
    expect(wrapper.find('[data-testid="model-evaluation-delta-table"]').text()).toContain('sample-1');
    expect(wrapper.text()).toContain('修正样本被新模型正确召回');
  });

  it('shows comparison and snapshot diff empty states when records are insufficient', async () => {
    mockApiClient.listDatasetBatchEvaluations.mockResolvedValueOnce([makeModelEvaluation({ evaluationId: 'eval-only' })]);
    mockApiClient.listDatasetBatchSnapshots.mockResolvedValueOnce([
      makeSnapshot({ snapshotId: 'snap-only', snapshotType: 'baseline' }),
    ]);

    const wrapper = mount(DatasetOverviewPage, {
      props: {
        id: 'urban_violation__phase4_empty',
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();
    await flushPromises();

    expect(wrapper.find('[data-testid="model-evaluation-compare-empty"]').text()).toContain(
      '至少需要两个评估记录才能比较',
    );
    expect(wrapper.find('[data-testid="snapshot-diff-empty"]').text()).toContain('至少需要两个版本快照才能对比');
    expect(mockApiClient.compareModelEvaluations).not.toHaveBeenCalled();
    expect(mockApiClient.diffDatasetBatchSnapshots).not.toHaveBeenCalled();
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

  it('shows optional backend import processing progress when present', async () => {
    mockApiClient.getDatasetBatchImportJob.mockResolvedValue({
      ...makeImportJob('urban_violation__batch_a', 'job-a', 20),
      state: 'Importing',
      activeStep: 5,
      processingProgress: {
        phase: 'import',
        processedItems: 8,
        totalItems: 20,
        percent: 40,
        message: 'Writing imported assets',
      },
    });

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

    expect(wrapper.text()).toContain('Writing imported assets');
    expect(wrapper.text()).toContain('8 / 20');
    expect(wrapper.text()).toContain('40%');
  });

  it('falls back to stable processing text when backend import progress is absent or expired', async () => {
    mockApiClient.getDatasetBatchImportJob.mockResolvedValueOnce({
      ...makeImportJob('urban_violation__batch_a', 'job-a', 20),
      state: 'Importing',
      activeStep: 5,
      processingProgress: {
        phase: 'import',
        percent: 81,
        message: 'Stale import progress',
        expired: true,
      },
    });

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

    expect(wrapper.text()).toContain('后端正在处理导入任务');
    expect(wrapper.text()).toContain('实时进度暂不可用，当前任务仍处于处理中。');
    expect(wrapper.text()).not.toContain('Stale import progress');
    expect(wrapper.text()).not.toContain('81%');

    mockApiClient.getDatasetBatchImportJob.mockResolvedValueOnce({
      ...makeImportJob('urban_violation__batch_b', 'job-b', 20),
      state: 'Importing',
      activeStep: 5,
      processingProgress: undefined,
    });
    await wrapper.setProps({ id: 'urban_violation__batch_b', jobId: 'job-b' });
    await flushPromises();

    expect(wrapper.text()).toContain('实时进度暂不可用，当前任务仍处于处理中。');
  });

  it('renders my QC batch as paginated horizontal rows with bounded long sample ids', async () => {
    const longSampleId =
      'urban_violation_0520_really_long_sample_identifier_for_queue_layout_regression_00000000000000000001';
    const queue = Array.from({ length: 12 }, (_, index): QcQueueItem => ({
      ...qcQueue[0],
      sampleId: `${longSampleId}_${String(index + 1).padStart(2, '0')}`,
      assetId: `asset-${index + 1}`,
      updatedAt: `2026-05-15T00:${String(index).padStart(2, '0')}:00Z`,
    }));
    mockApiClient.getQcWorkspace.mockResolvedValue({
      datasetId: 'ds-live',
      assignment: {
        assignmentId: 'assignment-annotator',
        datasetId: 'ds-live',
        assigneeUserId: 'annotator_a',
        assigneeDisplayName: '标注员 A',
        status: 'assigned',
      },
      queue,
      tasks: [],
      leases: [],
    });

    const wrapper = mount(QcPage, {
      props: {
        id: 'ds-live',
      },
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

    expect(wrapper.find('.queue-card').exists()).toBe(false);
    expect(wrapper.findAll('.queue-row:not(.queue-row--head)')).toHaveLength(10);
    expect(wrapper.text()).toContain('显示 1-10 / 12，每页 10 条');
    expect(wrapper.text()).toContain(`${longSampleId}_01`);
    expect(wrapper.text()).not.toContain(`${longSampleId}_11`);
    expect(wrapper.find('.queue-cell--sample').attributes('title')).toBe(`${longSampleId}_01`);

    await wrapper.find('button[aria-label="下一页"]').trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.queue-row:not(.queue-row--head)')).toHaveLength(2);
    expect(wrapper.text()).toContain('显示 11-12 / 12，每页 10 条');
    expect(wrapper.text()).not.toContain(`${longSampleId}_01`);
    expect(wrapper.text()).toContain(`${longSampleId}_11`);
  });

  it('uses assignable-users for qc lead batch assignment instead of the admin user directory', async () => {
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
    mockApiClient.listUsers.mockRejectedValue(new ApiClientError(403, 'forbidden', { code: 'forbidden', message: 'forbidden' }));
    mockApiClient.listBatchAssignableUsers.mockResolvedValue([
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
      assignmentId: 'assign-annotator',
      datasetId: 'ds-live',
      assigneeUserId: 'annotator_a',
      assigneeDisplayName: '标注员 A',
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
    expect(mockApiClient.listBatchAssignableUsers).toHaveBeenCalledWith('ds-live');
    expect(mockApiClient.listUsers).not.toHaveBeenCalled();

    await wrapper.find('select').setValue('annotator_a');
    await wrapper.find('form.assignment-actions').trigger('submit');
    await flushPromises();

    expect(mockApiClient.assignBatch).toHaveBeenCalledWith('ds-live', { assigneeUserId: 'annotator_a' });
    expect(wrapper.text()).toContain('已分配批次。');
  });

  it('falls back to the current assignment manager and shows an error when assignable-users fails', async () => {
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
    mockApiClient.listBatchAssignableUsers.mockRejectedValue(
      new ApiClientError(403, 'forbidden', { code: 'forbidden', message: 'forbidden' }),
    );

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
    expect(wrapper.text()).toContain('当前账号没有批次分配权限。');
  });

  it('shows an empty assignment selector message when there are no assignable users', async () => {
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
    mockApiClient.listBatchAssignableUsers.mockResolvedValue([]);

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

    expect(wrapper.findAll('option')).toHaveLength(0);
    expect(wrapper.text()).toContain('没有可分配用户，请先在权限管理中创建并启用账号。');
  });

  it('shows assignment action errors and release success in the batch assignment card', async () => {
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
      assignment: {
        assignmentId: 'assignment-1',
        datasetId: 'ds-live',
        assigneeUserId: 'annotator_a',
        assigneeDisplayName: '标注员 A',
        status: 'assigned',
      },
      queue: qcQueue,
      tasks: [],
      leases: [],
    });
    mockApiClient.listBatchAssignableUsers.mockResolvedValue([
      {
        userId: 'annotator_a',
        displayName: '标注员 A',
        email: 'annotator_a@example.local',
        status: 'active',
      },
    ]);
    mockApiClient.reassignBatch.mockRejectedValueOnce(
      new ApiClientError(422, 'invalid assignee', {
        code: 'assignee_disabled',
        message: 'assignee disabled',
      }),
    );
    mockApiClient.releaseBatchAssignment.mockResolvedValue({
      assignmentId: 'assignment-1',
      datasetId: 'ds-live',
      assigneeUserId: 'annotator_a',
      assigneeDisplayName: '标注员 A',
      status: 'revoked',
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

    await wrapper.find('form.assignment-actions').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('被分配账号不存在或已停用。');

    const releaseButton = wrapper.findAll('button').find((button) => button.text().includes('释放批次'));
    await releaseButton?.trigger('click');
    await flushPromises();

    expect(mockApiClient.releaseBatchAssignment).toHaveBeenCalledWith('ds-live');
    expect(wrapper.text()).toContain('已释放批次。');
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
    await input.trigger('change');
    await flushPromises();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await flushPromises();

    expect(wrapper.text()).toContain('urban_violation_labels_v1');
    expect(wrapper.text()).toContain('固定枚举');

    const validateButton = wrapper.findAll('button').find((button) => button.text().includes('校验配置'));
    await validateButton?.trigger('click');
    await flushPromises();

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('上传并更新配置'));
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
    expect(mockApiClient.saveLabelConfig.mock.calls[0]?.[1]).not.toHaveProperty('saveAsNewVersion');
    expect(wrapper.text()).toContain('配置未变化，已复用当前版本');
    expect(wrapper.text()).not.toContain('另存为新版本');
    expect(wrapper.findAll('button').map((button) => button.text())).toContain('重新加载当前配置');
    expect(wrapper.findAll('button').some((button) => button.text().includes('激活'))).toBe(false);
    expect(wrapper.findAll('button').filter((button) => button.text().includes('上传并更新配置'))).toHaveLength(1);
    expect(wrapper.find('.version-history tbody').findAll('button')).toHaveLength(0);
  });

  it('shows a clear label config version conflict message', async () => {
    mockApiClient.saveLabelConfig.mockRejectedValueOnce(
      new ApiClientError(409, 'label config version conflict', {
        code: 'label_config_version_conflict',
        message: 'version already exists',
      }),
    );
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
    await input.trigger('change');
    await flushPromises();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await flushPromises();

    const validateButton = wrapper.findAll('button').find((button) => button.text().includes('校验配置'));
    await validateButton?.trigger('click');
    await flushPromises();

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('上传并更新配置'));
    await saveButton?.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('版本号已存在，请修改上传 JSON 内的 version 后重新上传。');
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

  it('shows detailed backend import issues and paginates validation preview rows', async () => {
    const validationRows = Array.from({ length: 12 }, (_, index) => {
      const rowNumber = String(index + 1).padStart(2, '0');
      return {
        sampleId: `row-${rowNumber}`,
        imagePath: `images/row-${rowNumber}.jpg`,
        stage1Path: `stage1/row-${rowNumber}.json`,
        stage2Path: `stage2/row-${rowNumber}.json`,
        status: 'ready' as const,
      };
    });
    mockApiClient.getDatasetBatchImportJob.mockResolvedValue({
      ...importJob,
      validationRows,
      validationReport: {
        datasetId: importJob.datasetId,
        jobId: importJob.id,
        valid: false,
        totals: importJob.totals,
        coverage: importJob.coverage,
        blockingErrors: [
          {
            id: 'backend-error-1',
            severity: 'blocking',
            title: 'Validation error',
            message: 'sample-011 is missing a readable image file.',
            details: ['Path: images/sample-011.jpg'],
          },
        ],
        warnings: [
          {
            id: 'backend-warning-1',
            severity: 'warning',
            title: 'Backend warning',
            message: 'Detected 3 STEP2 failure artifacts; preserved as import diagnostics.',
            details: ['Count: 3'],
          },
        ],
        rows: validationRows,
      },
    });

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

    expect(wrapper.text()).toContain('sample-011 is missing a readable image file.');
    expect(wrapper.text()).toContain('Path: images/sample-011.jpg');
    expect(wrapper.text()).toContain('Detected 3 STEP2 failure artifacts; preserved as import diagnostics.');
    expect(wrapper.text()).toContain('Count: 3');
    expect(wrapper.text()).toContain('显示 1-10 / 12，每页 10 条');
    expect(wrapper.text()).toContain('row-10');
    expect(wrapper.text()).not.toContain('row-11');

    await wrapper.find('button[aria-label="下一页"]').trigger('click');

    expect(wrapper.text()).toContain('显示 11-12 / 12，每页 10 条');
    expect(wrapper.text()).toContain('row-11');
    expect(wrapper.text()).toContain('row-12');
    expect(wrapper.text()).not.toContain('row-01');
  });

  it('validates without saving, saves a batch draft, and submits only through the batch modal', async () => {
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
    expect(mockApiClient.saveMyBatchLabelEditDraft).not.toHaveBeenCalled();
    expect(mockApiClient.submitBatchLabelEdits).not.toHaveBeenCalled();
    expect(mockApiClient.validateLabelEdit).toHaveBeenCalledWith(
      'ds-live',
      'sample-1',
      expect.objectContaining({
        taskMode: 'label_edit',
        baseRevision: 7,
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
    expect(mockApiClient.validateLabelEdit.mock.calls[0]?.[2]).not.toHaveProperty('taskRevision');

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('保存草稿'));
    await saveButton?.trigger('click');
    await flushPromises();

    expect(mockApiClient.saveMyBatchLabelEditDraft).toHaveBeenCalledWith(
      'ds-live',
      expect.objectContaining({
        entries: [
          expect.objectContaining({
            sampleId: 'sample-1',
            labelConfigId: 'label-config-1',
            labelConfigVersion: 'urban_violation_labels_v1',
            dirty: true,
            saved: false,
            operations: expect.arrayContaining([
              expect.objectContaining({
                scope: 'relation:R1',
                field: 'subject',
                after: 'goods updated',
              }),
            ]),
          }),
        ],
      }),
    );
    expect(mockApiClient.submitLabelEdit).not.toHaveBeenCalled();

    const submitButton = wrapper.findAll('button').find((button) => button.text().includes('提交批次修改'));
    await submitButton?.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('确认提交批次修改');
    expect(mockApiClient.submitBatchLabelEdits).not.toHaveBeenCalled();
    const confirmButton = wrapper.findAll('button').find((button) => button.text().includes('确认提交批次修改'));
    await confirmButton?.trigger('click');
    await flushPromises();

    expect(mockApiClient.validateLabelEdit).toHaveBeenCalledTimes(1);
    expect(mockApiClient.submitLabelEdit).not.toHaveBeenCalled();
    expect(mockApiClient.submitBatchLabelEdits).toHaveBeenCalledWith(
      'ds-live',
      expect.objectContaining({
        unsavedDirtySampleIds: [],
        validationErrorSampleIds: [],
        notes: null,
      }),
    );
  });

  it('shows legacy occupying relations and motor vehicle segmentation targets with Chinese labels', async () => {
    mockApiClient.getReviewSample.mockResolvedValue({
      ...reviewDetail,
      stage1: {
        ...reviewDetail.stage1,
        keyRelations: reviewDetail.stage1.keyRelations.map((relation, index) =>
          index === 0 ? { ...relation, relation: 'occupying' } : relation,
        ),
      },
      stage2: reviewDetail.stage2
        ? {
            ...reviewDetail.stage2,
            candidates: reviewDetail.stage2.candidates.map((candidate, index) =>
              index === 0
                ? { ...candidate, segmentationTargets: ['nonmotor_vehicle', 'motor_vehicle'] }
                : candidate,
            ),
          }
        : reviewDetail.stage2,
    });
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

    expect(wrapper.text()).toContain('占据');
    expect(wrapper.text()).not.toContain('occupying');
    expect(wrapper.text()).toContain('非机动车');
    expect(wrapper.text()).toContain('机动车');
  });

  it('edits relation object through the configured anchor selector', async () => {
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

    const objectSelect = wrapper.findAll('.relation-editor select')[1];
    const objectOptions = objectSelect.findAll('option').map((option) => option.text());
    expect(objectOptions).toEqual(
      expect.arrayContaining([
        '人行道',
        '盲道',
        '停车线或停车区域',
        '路缘或边界',
        '车行道',
        '店铺边界',
        '柜台或经营区域',
        '出入口',
        '公共区域',
      ]),
    );

    await objectSelect.setValue('tactile_paving');
    const validateButton = wrapper.findAll('button').find((button) => button.text().includes('校验修改'));
    await validateButton?.trigger('click');
    await flushPromises();

    expect(mockApiClient.validateLabelEdit).toHaveBeenCalledWith(
      'ds-live',
      'sample-1',
      expect.objectContaining({
        operations: expect.arrayContaining([
          expect.objectContaining({
            scope: 'relation:R1',
            field: 'object',
            op: 'replace',
            after: 'tactile_paving',
          }),
        ]),
      }),
    );
  });

  it('uses Arrow/A and Arrow/D shortcuts for guarded queue navigation', async () => {
    const { router, push: routerPush } = makeRouterPushMock();
    const sample2Detail = makeReviewDetail('sample-2');
    const keyboardQueue: QcQueueItem[] = [
      qcQueue[0],
      { ...qcQueue[0], sampleId: 'sample-2', assetId: 'asset-sample-2', taskStatus: 'queued' },
      { ...qcQueue[0], sampleId: 'sample-3', assetId: 'asset-sample-3', taskStatus: 'queued' },
    ];
    mockApiClient.getReviewSample.mockResolvedValue(sample2Detail);
    mockApiClient.listQcQueue.mockResolvedValue(keyboardQueue);

    const wrapper = mount(ReviewWorkbenchPage, {
      props: {
        id: 'ds-live',
        sampleId: 'sample-2',
      },
      global: {
        stubs: {
          RouterLink: true,
        },
        plugins: [router],
      },
    });
    await flushPromises();

    const keyA = dispatchDocumentShortcut('a');
    await flushPromises();
    const arrowLeft = dispatchDocumentShortcut('ArrowLeft');
    await flushPromises();
    const keyD = dispatchDocumentShortcut('d');
    await flushPromises();
    const arrowRight = dispatchDocumentShortcut('ArrowRight');
    await flushPromises();

    expect(keyA.defaultPrevented).toBe(true);
    expect(arrowLeft.defaultPrevented).toBe(true);
    expect(keyD.defaultPrevented).toBe(true);
    expect(arrowRight.defaultPrevented).toBe(true);
    expect(routerPush).toHaveBeenNthCalledWith(1, '/datasets/ds-live/samples/sample-1/review');
    expect(routerPush).toHaveBeenNthCalledWith(2, '/datasets/ds-live/samples/sample-1/review');
    expect(routerPush).toHaveBeenNthCalledWith(3, '/datasets/ds-live/samples/sample-3/review');
    expect(routerPush).toHaveBeenNthCalledWith(4, '/datasets/ds-live/samples/sample-3/review');
    expect(mockApiClient.saveMyBatchLabelEditDraft).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('uses X to skip through the existing dirty-save navigation guard', async () => {
    const { router, push: routerPush } = makeRouterPushMock();
    mockApiClient.getReviewSample.mockResolvedValue(reviewDetail);
    mockApiClient.listQcQueue.mockResolvedValue([
      qcQueue[0],
      { ...qcQueue[0], sampleId: 'sample-2', assetId: 'asset-sample-2', taskStatus: 'queued' },
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
        plugins: [router],
      },
    });
    await flushPromises();

    await wrapper.find('.relation-editor input').setValue('skip shortcut subject');
    const keyX = dispatchDocumentShortcut('x');
    await flushPromises();

    expect(keyX.defaultPrevented).toBe(true);
    expect(mockApiClient.saveMyBatchLabelEditDraft).toHaveBeenCalledWith(
      'ds-live',
      expect.objectContaining({
        entries: [
          expect.objectContaining({
            sampleId: 'sample-1',
            operations: expect.arrayContaining([
              expect.objectContaining({
                scope: 'relation:R1',
                field: 'subject',
                after: 'skip shortcut subject',
              }),
            ]),
          }),
        ],
      }),
    );
    expect(mockApiClient.submitLabelEdit).not.toHaveBeenCalled();
    expect(mockApiClient.submitBatchLabelEdits).not.toHaveBeenCalled();
    expect(routerPush).toHaveBeenCalledWith('/datasets/ds-live/samples/sample-2/review');
    wrapper.unmount();
  });

  it('uses V for validate-only and S for the batch draft save lifecycle', async () => {
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

    await wrapper.find('.relation-editor input').setValue('shortcut subject');

    const ctrlSave = dispatchDocumentShortcut('s', { ctrlKey: true });
    const metaSave = dispatchDocumentShortcut('s', { metaKey: true });
    const ctrlEnter = dispatchDocumentShortcut('Enter', { ctrlKey: true });
    const metaEnter = dispatchDocumentShortcut('Enter', { metaKey: true });
    await flushPromises();

    expect(ctrlSave.defaultPrevented).toBe(false);
    expect(metaSave.defaultPrevented).toBe(false);
    expect(ctrlEnter.defaultPrevented).toBe(false);
    expect(metaEnter.defaultPrevented).toBe(false);
    expect(mockApiClient.saveMyBatchLabelEditDraft).not.toHaveBeenCalled();
    expect(mockApiClient.submitBatchLabelEdits).not.toHaveBeenCalled();
    expect(wrapper.text()).not.toContain('确认提交批次修改');

    const keyV = dispatchDocumentShortcut('v');
    await flushPromises();

    expect(keyV.defaultPrevented).toBe(true);
    expect(mockApiClient.validateLabelEdit).toHaveBeenCalledTimes(1);
    expect(mockApiClient.saveMyBatchLabelEditDraft).not.toHaveBeenCalled();
    expect(mockApiClient.autosaveMyBatchLabelEditDraft).not.toHaveBeenCalled();
    expect(mockApiClient.submitLabelEdit).not.toHaveBeenCalled();
    expect(mockApiClient.submitBatchLabelEdits).not.toHaveBeenCalled();

    const keyS = dispatchDocumentShortcut('s');
    await flushPromises();

    expect(keyS.defaultPrevented).toBe(true);
    expect(mockApiClient.saveMyBatchLabelEditDraft).toHaveBeenCalledWith(
      'ds-live',
      expect.objectContaining({
        entries: [
          expect.objectContaining({
            sampleId: 'sample-1',
            operations: expect.arrayContaining([
              expect.objectContaining({
                scope: 'relation:R1',
                field: 'subject',
                after: 'shortcut subject',
              }),
            ]),
          }),
        ],
      }),
    );
    expect(mockApiClient.submitLabelEdit).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('ignores review shortcuts from editable controls and button focus targets', async () => {
    const { router, push: routerPush } = makeRouterPushMock();
    mockApiClient.getReviewSample.mockResolvedValue(reviewDetail);
    mockApiClient.listQcQueue.mockResolvedValue([
      qcQueue[0],
      { ...qcQueue[0], sampleId: 'sample-2', assetId: 'asset-sample-2', taskStatus: 'queued' },
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
        plugins: [router],
      },
    });
    await flushPromises();

    await wrapper.find('.relation-editor input').setValue('focused edit subject');
    dispatchElementShortcut(wrapper.find('.relation-editor input').element, 's');
    dispatchElementShortcut(wrapper.find('.relation-editor textarea').element, 'v');
    dispatchElementShortcut(wrapper.find('.relation-editor select').element, 'ArrowRight');
    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('保存草稿'));
    dispatchElementShortcut(saveButton!.element, 'x');

    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    document.body.appendChild(editable);
    dispatchElementShortcut(editable, 's');
    editable.remove();

    const roleTextbox = document.createElement('div');
    roleTextbox.setAttribute('role', 'textbox');
    document.body.appendChild(roleTextbox);
    dispatchElementShortcut(roleTextbox, 's');
    roleTextbox.remove();

    await flushPromises();

    expect(mockApiClient.validateLabelEdit).not.toHaveBeenCalled();
    expect(mockApiClient.saveMyBatchLabelEditDraft).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('does not repeat shortcut actions during pending or repeated keydown states', async () => {
    const validationRequest = deferred<LabelEditValidationResult>();
    const saveRequest = deferred<BatchLabelEditDraftSaveResult>();
    mockApiClient.validateLabelEdit.mockReturnValueOnce(validationRequest.promise);
    mockApiClient.saveMyBatchLabelEditDraft.mockReturnValueOnce(saveRequest.promise);
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

    dispatchDocumentShortcut('v');
    await flushPromises();
    dispatchDocumentShortcut('v');
    dispatchDocumentShortcut('v', { repeat: true });
    await flushPromises();

    expect(mockApiClient.validateLabelEdit).toHaveBeenCalledTimes(1);
    validationRequest.resolve({
      valid: true,
      errors: [],
      warnings: [],
      checkedAt: '2026-05-18T00:00:00Z',
    });
    await flushPromises();

    await wrapper.find('.relation-editor input').setValue('pending save subject');
    dispatchDocumentShortcut('s');
    await flushPromises();
    dispatchDocumentShortcut('s');
    dispatchDocumentShortcut('s', { repeat: true });
    await flushPromises();

    expect(mockApiClient.saveMyBatchLabelEditDraft).toHaveBeenCalledTimes(1);
    saveRequest.resolve({
      saved: true,
      datasetId: 'ds-live',
      savedSampleCount: 1,
      totalSampleCount: 1,
      sampleIds: ['sample-1'],
      updatedAt: '2026-05-18T00:00:00Z',
    });
    await flushPromises();

    dispatchDocumentShortcut('s');
    await flushPromises();
    expect(mockApiClient.saveMyBatchLabelEditDraft).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('autosaves only when the batch draft is dirty and editable', async () => {
    vi.useFakeTimers();
    try {
      window.localStorage.removeItem('urbanViolationReviewAutosaveIntervalMs');
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

      await vi.advanceTimersByTimeAsync(180_000);
      await flushPromises();
      expect(mockApiClient.autosaveMyBatchLabelEditDraft).not.toHaveBeenCalled();

      await wrapper.find('.relation-editor input').setValue('autosave subject');
      await flushPromises();
      await vi.advanceTimersByTimeAsync(180_000);
      await flushPromises();

      expect(mockApiClient.autosaveMyBatchLabelEditDraft).toHaveBeenCalledWith(
        'ds-live',
        expect.objectContaining({
          entries: [
            expect.objectContaining({
              sampleId: 'sample-1',
              operations: expect.arrayContaining([
                expect.objectContaining({
                  scope: 'relation:R1',
                  field: 'subject',
                  after: 'autosave subject',
                }),
              ]),
            }),
          ],
        }),
      );
      wrapper.unmount();
    } finally {
      window.localStorage.removeItem('urbanViolationReviewAutosaveIntervalMs');
      vi.useRealTimers();
    }
  });

  it('lets reviewers set the autosave interval from the bottom bar', async () => {
    vi.useFakeTimers();
    try {
      window.localStorage.removeItem('urbanViolationReviewAutosaveIntervalMs');
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

      const intervalSelect = wrapper.find('.autosave-interval-control select');
      expect((intervalSelect.element as HTMLSelectElement).value).toBe('180000');
      await intervalSelect.setValue('60000');
      expect(window.localStorage.getItem('urbanViolationReviewAutosaveIntervalMs')).toBe('60000');

      await wrapper.find('.relation-editor input').setValue('autosave interval subject');
      await flushPromises();
      await vi.advanceTimersByTimeAsync(59_999);
      await flushPromises();
      expect(mockApiClient.autosaveMyBatchLabelEditDraft).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      await flushPromises();
      expect(mockApiClient.autosaveMyBatchLabelEditDraft).toHaveBeenCalledTimes(1);
      expect(mockApiClient.autosaveMyBatchLabelEditDraft).toHaveBeenCalledWith(
        'ds-live',
        expect.objectContaining({
          entries: [
            expect.objectContaining({
              sampleId: 'sample-1',
              operations: expect.arrayContaining([
                expect.objectContaining({
                  scope: 'relation:R1',
                  field: 'subject',
                  after: 'autosave interval subject',
                }),
              ]),
            }),
          ],
        }),
      );
      wrapper.unmount();
    } finally {
      window.localStorage.removeItem('urbanViolationReviewAutosaveIntervalMs');
      vi.useRealTimers();
    }
  });

  it('keeps newer edits dirty when an older autosave response returns', async () => {
    vi.useFakeTimers();
    try {
      window.localStorage.removeItem('urbanViolationReviewAutosaveIntervalMs');
      const firstAutosave = deferred<BatchLabelEditDraftSaveResult>();
      mockApiClient.autosaveMyBatchLabelEditDraft
        .mockReturnValueOnce(firstAutosave.promise)
        .mockResolvedValueOnce({
          saved: true,
          datasetId: 'ds-live',
          savedSampleCount: 1,
          totalSampleCount: 1,
          sampleIds: ['sample-1'],
          updatedAt: '2026-05-18T00:03:00Z',
        });
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
      await subjectInput.setValue('autosave subject first');
      await flushPromises();
      await vi.advanceTimersByTimeAsync(180_000);
      await flushPromises();

      expect(mockApiClient.autosaveMyBatchLabelEditDraft).toHaveBeenCalledTimes(1);

      await subjectInput.setValue('autosave subject second');
      await flushPromises();
      firstAutosave.resolve({
        saved: true,
        datasetId: 'ds-live',
        savedSampleCount: 1,
        totalSampleCount: 1,
        sampleIds: ['sample-1'],
        updatedAt: '2026-05-18T00:02:00Z',
      });
      await flushPromises();

      await vi.advanceTimersByTimeAsync(179_999);
      await flushPromises();
      expect(mockApiClient.autosaveMyBatchLabelEditDraft).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      await flushPromises();

      expect(mockApiClient.autosaveMyBatchLabelEditDraft).toHaveBeenCalledTimes(2);
      expect(mockApiClient.autosaveMyBatchLabelEditDraft).toHaveBeenLastCalledWith(
        'ds-live',
        expect.objectContaining({
          entries: [
            expect.objectContaining({
              sampleId: 'sample-1',
              operations: expect.arrayContaining([
                expect.objectContaining({
                  scope: 'relation:R1',
                  field: 'subject',
                  after: 'autosave subject second',
                }),
              ]),
            }),
          ],
        }),
      );
      wrapper.unmount();
    } finally {
      window.localStorage.removeItem('urbanViolationReviewAutosaveIntervalMs');
      vi.useRealTimers();
    }
  });

  it('blocks batch submit while dirty edits are unsaved or saved edits have validation errors', async () => {
    mockApiClient.getReviewSample.mockResolvedValue(reviewDetail);
    mockApiClient.listQcQueue.mockResolvedValue(qcQueue);
    mockApiClient.validateLabelEdit.mockResolvedValue({
      valid: false,
      errors: [
        {
          operationIndex: 0,
          scope: 'relation:R1',
          field: 'subject',
          code: 'invalid_field_value',
          message: 'subject is invalid',
        },
      ],
      warnings: [],
      checkedAt: '2026-05-18T00:00:00Z',
    });

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

    await wrapper.find('.relation-editor input').setValue('invalid subject');
    await wrapper.findAll('button').find((button) => button.text().includes('提交批次修改'))?.trigger('click');
    await flushPromises();

    expect(wrapper.find('[aria-label="批次提交统计"]').text()).toContain('未保存 1');
    expect(wrapper.text()).toContain('未保存修改');
    expect(wrapper.findAll('button').find((button) => button.text().includes('确认提交批次修改'))?.attributes('disabled')).toBeDefined();
    expect(mockApiClient.submitBatchLabelEdits).not.toHaveBeenCalled();

    await wrapper.findAll('button').find((button) => button.text().trim() === '取消')?.trigger('click');
    await flushPromises();
    await wrapper.findAll('button').find((button) => button.text().includes('校验修改'))?.trigger('click');
    await flushPromises();
    await wrapper.findAll('button').find((button) => button.text().includes('保存草稿'))?.trigger('click');
    await flushPromises();
    await wrapper.findAll('button').find((button) => button.text().includes('提交批次修改'))?.trigger('click');
    await flushPromises();

    expect(wrapper.find('[aria-label="批次提交统计"]').text()).toContain('校验错误 1');
    expect(wrapper.text()).toContain('存在 1 个校验错误');
    expect(wrapper.findAll('button').find((button) => button.text().includes('确认提交批次修改'))?.attributes('disabled')).toBeDefined();
    expect(mockApiClient.submitBatchLabelEdits).not.toHaveBeenCalled();
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
    expect(wrapper.text()).toContain('R1 · 货物 阻挡 人行道');
    expect(wrapper.text()).toContain('请先上传并激活标签配置');
    const submitButton = wrapper.findAll('button').find((button) => button.text().includes('提交批次修改'));
    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('保存草稿'));
    await submitButton?.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('请先上传并激活标签配置');
    expect(wrapper.findAll('button').find((button) => button.text().includes('确认提交批次修改'))?.attributes('disabled')).toBeDefined();
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
    expect(wrapper.find('[aria-label="模型可见性参考"]').text()).toContain('主体可见');
    expect(wrapper.find('[aria-label="模型可见性参考"]').text()).toContain('是');
    expect(wrapper.text()).toContain('正样本');
    expect(wrapper.text()).toContain('清晰');
    expect(wrapper.text()).toContain('支持');
    expect(wrapper.text()).toContain('货物');
    expect(wrapper.text()).toContain('人行道');
    expect(wrapper.text()).toContain('goods_blocking_road');
    expect(wrapper.text()).not.toContain('sample_category');
    expect(wrapper.text()).not.toContain('Evidence Relations');
    expect(wrapper.find('[aria-label="标注修改底栏"]').text()).toContain('校验修改');
    expect(wrapper.find('[aria-label="标注修改底栏"]').text()).toContain('保存草稿');
    expect(wrapper.find('[aria-label="标注修改底栏"]').text()).toContain('提交批次修改');
    expect(wrapper.find('[aria-label="标注修改底栏"]').text()).toContain('批次草稿');
    expect(wrapper.find('[aria-label="标注修改底栏"]').text()).toContain('自动保存');
    expect(wrapper.text()).not.toContain('vote note');
    expect(wrapper.text()).not.toContain('提交质检');
    expect(wrapper.text()).not.toContain('人工精标');
  });

  it('restores saved batch draft relation and candidate operations into the review editor', async () => {
    mockApiClient.getReviewSample.mockResolvedValue(reviewDetail);
    mockApiClient.listQcQueue.mockResolvedValue(qcQueue);
    mockApiClient.getMyBatchLabelEditDraft.mockResolvedValueOnce({
      datasetId: 'ds-live',
      savedSampleCount: 1,
      totalSampleCount: 1,
      dirtySampleCount: 0,
      samples: [
        {
          sampleId: 'sample-1',
          leaseId: 'lease-sample-1',
          baseRevision: 7,
          labelConfigId: 'label-config-1',
          labelConfigVersion: 'urban_violation_labels_v1',
          dirty: false,
          saved: true,
          validation: {
            valid: true,
            errorCount: 0,
            warningCount: 0,
            errors: [],
            warnings: [],
          },
          operations: [
            {
              scope: 'relation:R1',
              field: 'subject',
              op: 'replace',
              before: 'goods',
              after: 'draft goods',
            },
            {
              scope: 'relation:R1',
              field: 'bbox',
              op: 'replace',
              before: [320, 180, 640, 360],
              after: [100, 120, 500, 580],
            },
            {
              scope: 'candidate:C1',
              field: 'violation_category',
              op: 'replace',
              before: 'goods_blocking_road',
              after: 'nonmotor_vehicle_illegal_parking',
            },
            {
              scope: 'candidate:C1',
              field: 'evidence_reasoning',
              op: 'replace',
              before: 'goods block sidewalk',
              after: 'draft candidate reasoning',
            },
          ],
        },
      ],
    });

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

    expect((wrapper.find('.relation-editor input').element as HTMLInputElement).value).toBe('draft goods');
    expect(wrapper.find('.bbox-shell__box[aria-label="R1"]').attributes('style')).toContain('left: 10%');
    expect(wrapper.find('.bbox-shell__box[aria-label="R1"]').attributes('style')).toContain('top: 12%');
    expect(wrapper.find('.bbox-shell__box[aria-label="R1"]').attributes('style')).toContain('width: 40%');
    expect(wrapper.find('.bbox-shell__box[aria-label="R1"]').attributes('style')).toContain('height: 46%');
    expect(
      wrapper
        .findAll('.candidate-editor select')
        .some((select) => (select.element as HTMLSelectElement).value === 'nonmotor_vehicle_illegal_parking'),
    ).toBe(true);
    expect((wrapper.find('.candidate-editor textarea').element as HTMLTextAreaElement).value).toBe(
      'draft candidate reasoning',
    );
    expect(wrapper.find('[aria-label="标注修改底栏"]').text()).toContain('当前样本修改 4 项');
    expect(wrapper.find('[aria-label="标注修改底栏"]').text()).toContain('批次草稿 1/1');
    expect(wrapper.find('[aria-label="标注修改底栏"]').text()).toContain('自动保存 空闲');
    expect(wrapper.findAll('button').find((button) => button.text().includes('保存草稿'))?.attributes('disabled')).toBeDefined();
  });

  it('shows latest submitted operations in the admin review editor when no admin draft exists', async () => {
    mockApiClient.getReviewSample.mockResolvedValue({
      ...reviewDetail,
      currentUser: adminUser,
      myDraft: undefined,
      qcTask: {
        ...reviewDetail.qcTask,
        status: 'submitted',
        latestSubmissionId: 'submission-sample-1',
        taskRevision: 8,
      },
      latestSubmission: {
        submissionId: 'submission-sample-1',
        datasetId: 'ds-live',
        sampleId: 'sample-1',
        userId: 'annotator_a',
        userDisplayName: '标注员 A',
        status: 'submitted',
        submittedAt: '2026-05-18T00:00:00Z',
        labelConfigId: 'label-config-1',
        labelConfigVersion: 'urban_violation_labels_v1',
        operations: [
          {
            scope: 'relation:R1',
            field: 'subject',
            op: 'replace',
            before: 'goods',
            after: 'submitted goods',
          },
          {
            scope: 'candidate:C1',
            field: 'evidence_reasoning',
            op: 'replace',
            before: 'goods block sidewalk',
            after: 'submitted candidate reasoning',
          },
        ],
      },
    });
    mockApiClient.listQcQueue.mockResolvedValue(qcQueue);
    mockApiClient.getMyBatchLabelEditDraft.mockResolvedValueOnce({
      datasetId: 'ds-live',
      savedSampleCount: 0,
      totalSampleCount: 1,
      dirtySampleCount: 0,
      samples: [],
    });

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

    expect((wrapper.find('.relation-editor input').element as HTMLInputElement).value).toBe('submitted goods');
    expect((wrapper.find('.candidate-editor textarea').element as HTMLTextAreaElement).value).toBe(
      'submitted candidate reasoning',
    );
    expect(wrapper.find('[aria-label="标注修改底栏"]').text()).toContain('当前样本修改 2 项');
    expect(wrapper.find('[aria-label="标注修改底栏"]').text()).toContain('自动保存 空闲');
    expect(wrapper.findAll('button').find((button) => button.text().includes('保存草稿'))?.attributes('disabled')).toBeDefined();
  });

  it('restores saved batch draft candidate deletions without marking the sample unsaved', async () => {
    mockApiClient.getReviewSample.mockResolvedValue(reviewDetail);
    mockApiClient.listQcQueue.mockResolvedValue(qcQueue);
    mockApiClient.getMyBatchLabelEditDraft.mockResolvedValueOnce({
      datasetId: 'ds-live',
      savedSampleCount: 1,
      totalSampleCount: 1,
      dirtySampleCount: 0,
      samples: [
        {
          sampleId: 'sample-1',
          leaseId: 'lease-sample-1',
          baseRevision: 7,
          labelConfigId: 'label-config-1',
          labelConfigVersion: 'urban_violation_labels_v1',
          dirty: false,
          saved: true,
          operations: [
            {
              scope: 'candidate:C1',
              field: 'candidate',
              op: 'delete_candidate',
              before: {
                id: 'C1',
                violation_category: 'goods_blocking_road',
                sample_category: 'positive samples',
                confidence: 0.88,
                segmentation_targets: ['goods'],
                evidence_relations: ['R1'],
                evidence_reasoning: 'goods block sidewalk',
                relation_hint: '',
              },
              after: null,
            },
          ],
        },
      ],
    });

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

    expect(wrapper.find('.candidate-index-track').text().replace(/\s+/g, '')).toBe('+');
    expect(wrapper.find('[aria-label="标注修改底栏"]').text()).toContain('当前样本修改 1 项');
    expect(wrapper.find('[aria-label="标注修改底栏"]').text()).toContain('自动保存 空闲');
    expect(wrapper.findAll('button').find((button) => button.text().includes('保存草稿'))?.attributes('disabled')).toBeDefined();

    await wrapper.findAll('button').find((button) => button.text().includes('校验修改'))?.trigger('click');
    await flushPromises();

    expect(mockApiClient.validateLabelEdit).toHaveBeenCalledWith(
      'ds-live',
      'sample-1',
      expect.objectContaining({
        operations: [
          expect.objectContaining({
            scope: 'candidate:C1',
            field: 'candidate',
            op: 'delete_candidate',
            after: null,
          }),
        ],
      }),
    );
    expect(mockApiClient.saveMyBatchLabelEditDraft).not.toHaveBeenCalled();
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

  it('uses a distinct cyan tone for R2 relation boxes and review index button', async () => {
    const relationDetail: ReviewSampleDetail = {
      ...reviewDetail,
      stage1: {
        ...reviewDetail.stage1,
        keyRelations: [
          {
            relationIndex: 'R1',
            subject: 'goods',
            relation: 'blocks',
            object: 'sidewalk',
            bbox: [100, 100, 220, 220],
          },
          {
            relationIndex: 'R2',
            subject: 'cone',
            relation: 'near',
            object: 'curb',
            bbox: [230, 120, 340, 260],
          },
          {
            relationIndex: 'R3',
            subject: 'bicycle',
            relation: 'near',
            object: 'sidewalk',
            bbox: [350, 160, 470, 300],
          },
          {
            relationIndex: 'R4',
            subject: 'sign',
            relation: 'near',
            object: 'road',
            bbox: [480, 180, 600, 330],
          },
        ],
      },
      stage2: reviewDetail.stage2
        ? {
            ...reviewDetail.stage2,
            factVerifications: [
              {
                ...reviewDetail.stage2.factVerifications[0],
                relationIndex: 'R1',
                subject: 'goods',
                relation: 'blocks',
                object: 'sidewalk',
                bbox: [100, 100, 220, 220],
              },
              {
                ...reviewDetail.stage2.factVerifications[0],
                relationIndex: 'R2',
                subject: 'cone',
                relation: 'near',
                object: 'curb',
                bbox: [230, 120, 340, 260],
              },
              {
                ...reviewDetail.stage2.factVerifications[0],
                relationIndex: 'R3',
                subject: 'bicycle',
                relation: 'near',
                object: 'sidewalk',
                bbox: [350, 160, 470, 300],
              },
              {
                ...reviewDetail.stage2.factVerifications[0],
                relationIndex: 'R4',
                subject: 'sign',
                relation: 'near',
                object: 'road',
                bbox: [480, 180, 600, 330],
              },
            ],
            candidates: [
              {
                ...reviewDetail.stage2.candidates[0],
                evidenceRelationIndices: ['R1', 'R2', 'R3', 'R4'],
              },
            ],
          }
        : undefined,
    };
    mockApiClient.getReviewSample.mockResolvedValue(relationDetail);
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

    const relationToneClass = (label: string) =>
      wrapper
        .findAll('.bbox-shell__box')
        .find((box) => box.attributes('aria-label') === label)
        ?.classes()
        .find((className) => className.startsWith('bbox-shell__box--'));
    expect(relationToneClass('R1')).toBe('bbox-shell__box--blue');
    expect(relationToneClass('R2')).toBe('bbox-shell__box--cyan');
    expect(relationToneClass('R3')).toBe('bbox-shell__box--green');
    expect(relationToneClass('R4')).toBe('bbox-shell__box--orange');

    const indexToneClass = (label: string) =>
      wrapper
        .findAll('.relation-index-track .index-button')
        .find((button) => button.text().includes(label))
        ?.classes()
        .find((className) => className.startsWith('index-button--'));
    expect(indexToneClass('R1')).toBe('index-button--blue');
    expect(indexToneClass('R2')).toBe('index-button--cyan');
    expect(indexToneClass('R3')).toBe('index-button--green');
    expect(indexToneClass('R4')).toBe('index-button--orange');
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
    expect(wrapper.find('[aria-label="标注修改底栏"]').text()).toContain('当前样本修改 1 项');

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

  it('keeps review workbench readonly stable when Redis lease state is missing, expired, or owned by another user', async () => {
    const scenarios: Array<{
      name: string;
      sampleLease: ReviewSampleDetail['sampleLease'];
      leaseText: string;
    }> = [
      {
        name: 'missing',
        sampleLease: undefined,
        leaseText: '无样本锁',
      },
      {
        name: 'expired',
        sampleLease: {
          ...reviewDetail.sampleLease!,
          status: 'active',
          expiresAt: '2000-01-01T00:00:00Z',
        },
        leaseText: '已过期 · 标注员 A',
      },
      {
        name: 'owned-by-other-user',
        sampleLease: {
          ...reviewDetail.sampleLease!,
          leaseId: 'lease-other-user',
          userId: 'annotator_b',
          userDisplayName: '标注员 B',
          status: 'active',
          expiresAt: '2099-01-01T00:00:00Z',
        },
        leaseText: '有效 · 标注员 B',
      },
    ];

    for (const scenario of scenarios) {
      mockApiClient.getReviewSample.mockResolvedValueOnce({
        ...reviewDetail,
        sampleLease: scenario.sampleLease,
      });
      mockApiClient.acquireSampleLease.mockRejectedValueOnce(
        new ApiClientError(409, `${scenario.name} lease conflict`, {
          code: 'lease_owned_by_other_user',
          message: 'Active lease is not editable.',
        }),
      );
      mockApiClient.listQcQueue.mockResolvedValueOnce(qcQueue);

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

      expect(wrapper.text()).toContain(scenario.leaseText);
      expect(wrapper.text()).toContain('未持有有效样本锁，当前样本只读');
      expect(wrapper.findAll('.gate-warning--readonly')).toHaveLength(1);
      expect(wrapper.findAll('button').find((button) => button.text().includes('保存草稿'))?.attributes('disabled')).toBeDefined();
      expect(wrapper.findAll('button').find((button) => button.text().includes('校验修改'))?.attributes('disabled')).toBeDefined();
      wrapper.unmount();
      expect(mockApiClient.releaseSampleLease).not.toHaveBeenCalled();
    }
  });

  it('keeps the current review visible while switching samples', async () => {
    const { router, push: routerPush } = makeRouterPushMock();
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
        plugins: [router],
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('sample-1');
    expect(wrapper.text()).not.toContain('正在加载质检样本...');

    await wrapper.findAll('button').find((button) => button.text().includes('下一个'))?.trigger('click');
    await flushPromises();

    expect(mockApiClient.releaseSampleLease).toHaveBeenCalledWith('ds-live', 'sample-1', 'lease-sample-1');
    expect(routerPush).toHaveBeenCalledWith('/datasets/ds-live/samples/sample-2/review');
    expect(wrapper.text()).toContain('sample-1');
    expect(wrapper.text()).not.toContain('未持有有效样本锁');
    expect(wrapper.text()).not.toContain('当前样本只读');
    expect(wrapper.find('.gate-warning--readonly').exists()).toBe(false);

    await wrapper.setProps({ sampleId: 'sample-2' });
    await flushPromises();

    expect(wrapper.text()).toContain('sample-1');
    expect(wrapper.text()).not.toContain('正在加载质检样本...');
    expect(wrapper.find('.sample-detail-workbench').attributes('aria-busy')).toBe('true');
    expect(wrapper.find('[data-testid="sample-switch-status"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('正在切换到 sample-2');
    expect(wrapper.text()).not.toContain('未持有有效样本锁');
    expect(wrapper.text()).not.toContain('当前样本只读');
    expect(wrapper.find('.gate-warning--readonly').exists()).toBe(false);

    nextDetailRequest.resolve(nextDetail);
    await flushPromises();

    expect(wrapper.text()).toContain('sample-2');
    expect(wrapper.find('.sample-detail-workbench').attributes('aria-busy')).toBeUndefined();
    expect(wrapper.text()).not.toContain('正在切换到 sample-2');
  });
});

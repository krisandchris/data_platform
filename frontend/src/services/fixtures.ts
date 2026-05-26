import type { SubmitReviewPayload, UrbanViolationApi } from './urbanViolationApi';
import type {
  AssetListFilters,
  AssetListItem,
  AssetSummary,
  AnnotationSnapshot,
  AnnotationSnapshotDiff,
  AuditEvent,
  AuditEventFilters,
  BatchAssignmentPayload,
  BatchLabelEditDraft,
  BatchLabelEditDraftPayload,
  BatchLabelEditDraftSaveResult,
  BatchLabelEditSubmitPayload,
  BatchLabelEditSubmitResult,
  BatchQcAssignment,
  CurrentUser,
  Dataset,
  DatasetSummary,
  DatasetType,
  DatasetTypeCreatePayload,
  HumanReview,
  ImportJobDetail,
  LabelConfig,
  LabelEditDraft,
  LabelEditSubmission,
  LabelEditState,
  LabelEditSubmitPayload,
  LabelConfigSaveResult,
  LabelConfigValidationResult,
  LabelSuggestion,
  LoginPayload,
  ModelEvaluationCompareResult,
  ModelEvaluationCreatePayload,
  ModelEvaluationDeltaSample,
  ModelEvaluationRun,
  PreannotationSummary,
  QcModificationEvent,
  QcModificationEventStats,
  QcProgress,
  QcQueueItem,
  QcTask,
  QcWorkspace,
  ReviewSampleDetail,
  RbacCatalog,
  RoleBinding,
  RoleBindingCreatePayload,
  SampleLease,
  SamplePoolItem,
  SamplePoolItemDetail,
  SamplePoolListFilters,
  SamplePoolStats,
  TrainingExportCreatePayload,
  TrainingExportDownload,
  TrainingExportJob,
  UserAccount,
  UserCreatePayload,
  UserUpdatePayload,
} from '../shared/types/contract';

const dataset: Dataset = {
  id: 'ds_urban_violation_001',
  name: 'urban_violation',
  version: 'v1.0',
  status: 'qc_ready',
  datasetType: 'urban_violation',
  batchKey: '0508_fixture',
  batchName: '0508 测试批次',
  lifecycleStatus: 'qc_ready',
  displayName: '城市违规',
  fieldSchemaVersion: '2026-05-18',
  activeLabelConfigVersion: 'urban_violation_labels_v1',
  activeImportJobId: 'import-stage2-0508',
  qcQueueId: 'qcq_urban_violation_0508_fixture',
  assetTotal: 797,
  stage1Total: 797,
  stage2SuccessTotal: 780,
  stage2FailureTotal: 19,
  qcProgress: {
    pending: 186,
    submitted: 528,
    total: 780,
  },
  description: 'Urban traffic violation dataset with stage1 and stage2 pre-annotation outputs.',
  createdAt: '2025-05-08T10:21:33+08:00',
  updatedAt: '2025-05-08T15:45:12+08:00',
  tags: ['traffic_violation', 'hangzhou', 'workday'],
  owner: 'data-admin',
};

const datasetTypes: DatasetType[] = [
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
];

const qcModificationEventStats: QcModificationEventStats = {
  datasetId: dataset.id,
  totalEvents: 4,
  changedSampleCount: 2,
  byEventType: [
    { eventType: 'bbox_adjusted', label: '框位置调整', count: 2 },
    { eventType: 'candidate_category_changed', label: '候选类别修正', count: 1 },
    { eventType: 'relation_visibility_changed', label: '关系可见性修正', count: 1 },
  ],
  byAttribution: [
    { code: 'model_bbox_offset', label: '模型框偏移', count: 2, weightSum: 1.4 },
    { code: 'category_boundary', label: '类别边界判断', count: 1, weightSum: 0.8 },
    { code: 'visibility_miss', label: '可见性漏判', count: 1, weightSum: 0.6 },
  ],
  bboxOffsetBands: {
    micro: 1,
    medium: 1,
    large: 0,
  },
  changedSamples: [
    {
      sampleId: 'sample-0001',
      eventCount: 3,
      eventTypes: ['bbox_adjusted', 'candidate_category_changed'],
      attributionCodes: ['model_bbox_offset', 'category_boundary'],
      reviewerId: 'qc_lead_a',
      confirmedAt: '2026-05-19T09:20:00+08:00',
    },
    {
      sampleId: 'sample-0002',
      eventCount: 1,
      eventTypes: ['relation_visibility_changed'],
      attributionCodes: ['visibility_miss'],
      reviewerId: 'qc_lead_a',
      confirmedAt: '2026-05-19T09:26:00+08:00',
    },
  ],
  generatedAt: '2026-05-19T09:30:00+08:00',
};

const qcModificationEvents: QcModificationEvent[] = [
  {
    eventId: 'mod-event-1',
    datasetId: dataset.id,
    sampleId: 'sample-0001',
    eventType: 'bbox_adjusted',
    label: '框位置调整',
    attributionCode: 'model_bbox_offset',
    attributionLabel: '模型框偏移',
    weight: 0.7,
    reviewerId: 'qc_lead_a',
    confirmedAt: '2026-05-19T09:20:00+08:00',
    createdAt: '2026-05-19T09:20:00+08:00',
  },
  {
    eventId: 'mod-event-2',
    datasetId: dataset.id,
    sampleId: 'sample-0001',
    eventType: 'candidate_category_changed',
    label: '候选类别修正',
    attributionCode: 'category_boundary',
    attributionLabel: '类别边界判断',
    weight: 0.8,
    reviewerId: 'qc_lead_a',
    confirmedAt: '2026-05-19T09:20:00+08:00',
    createdAt: '2026-05-19T09:20:00+08:00',
  },
];

const samplePoolItems: SamplePoolItem[] = [
  {
    itemId: 'pool-sample-0001',
    datasetId: dataset.id,
    datasetType: dataset.datasetType,
    batchId: dataset.id,
    batchName: dataset.batchName,
    sampleId: 'sample-0001',
    category: 'goods_blocking_road',
    attributionTags: [
      { code: 'model_bbox_offset', label: '模型框偏移', count: 2, weightSum: 1.4 },
      { code: 'category_boundary', label: '类别边界判断', count: 1, weightSum: 0.8 },
    ],
    eventTypes: ['relation_bbox_adjust', 'candidate_category_change'],
    eventCount: 3,
    changedFieldCount: 2,
    reviewerId: 'annotator_a',
    reviewerDisplayName: '标注员 A',
    confirmedBy: 'qc_lead_a',
    confirmedByDisplayName: '质检负责人 A',
    confirmedAt: '2026-05-19T09:20:00+08:00',
    addedAt: '2026-05-19T09:21:00+08:00',
    status: 'active',
    confirmedSnapshotId: 'confirmed-snapshot-sample-0001',
    sourceEventIds: ['mod-event-1', 'mod-event-2'],
  },
  {
    itemId: 'pool-sample-0002',
    datasetId: dataset.id,
    datasetType: dataset.datasetType,
    batchId: dataset.id,
    batchName: dataset.batchName,
    sampleId: 'sample-0002',
    category: 'nonmotor_vehicle_illegal_parking',
    attributionTags: [{ code: 'visibility_miss', label: '可见性漏判', count: 1, weightSum: 0.6 }],
    eventTypes: ['relation_modify'],
    eventCount: 1,
    changedFieldCount: 1,
    reviewerId: 'annotator_b',
    reviewerDisplayName: '标注员 B',
    confirmedBy: 'qc_lead_a',
    confirmedByDisplayName: '质检负责人 A',
    confirmedAt: '2026-05-19T09:26:00+08:00',
    addedAt: '2026-05-19T09:27:00+08:00',
    status: 'active',
    confirmedSnapshotId: 'confirmed-snapshot-sample-0002',
    sourceEventIds: ['mod-event-3'],
  },
];

const samplePoolStats: SamplePoolStats = {
  totalItems: samplePoolItems.length,
  activeItems: samplePoolItems.filter((item) => item.status === 'active').length,
  primaryAttribution: { code: 'model_bbox_offset', label: '模型框偏移', count: 2, weightSum: 1.4 },
  involvedBatchCount: 1,
  recentlyAddedAt: samplePoolItems[1]?.addedAt,
  byAttribution: [
    { code: 'model_bbox_offset', label: '模型框偏移', count: 2, weightSum: 1.4 },
    { code: 'category_boundary', label: '类别边界判断', count: 1, weightSum: 0.8 },
    { code: 'visibility_miss', label: '可见性漏判', count: 1, weightSum: 0.6 },
  ],
  byStatus: [{ status: 'active', label: '活跃', count: samplePoolItems.length }],
  generatedAt: '2026-05-19T09:30:00+08:00',
};

const exportDownloadUrl = (exportId: string) => `/api/exports/${encodeURIComponent(exportId)}/download`;

let trainingExportJobs: TrainingExportJob[] = [
  {
    exportId: 'export-coco-0508',
    format: 'coco_json',
    source: 'all_active_pool_items',
    filters: { status: 'active' },
    filterSummary: '全部活跃样本',
    sampleCount: samplePoolItems.filter((item) => item.status === 'active').length,
    status: 'completed',
    createdAt: '2026-05-19T10:00:00+08:00',
    completedAt: '2026-05-19T10:02:00+08:00',
    downloadUrl: exportDownloadUrl('export-coco-0508'),
  },
  {
    exportId: 'export-coco-running',
    format: 'coco_json',
    source: 'current_filters',
    filters: { attribution: 'model_bbox_offset', status: 'active' },
    filterSummary: '归因：模型框偏移，状态：活跃',
    sampleCount: 1,
    status: 'running',
    createdAt: '2026-05-19T10:08:00+08:00',
  },
];

let modelEvaluations: ModelEvaluationRun[] = [
  {
    evaluationId: 'eval-qwen25-v2',
    datasetId: dataset.id,
    modelName: 'Qwen2.5-VL',
    modelVersion: 'qwen2.5-vl-qc-v2',
    status: 'completed',
    sampleCount: 780,
    sourceExportId: 'export-coco-0508',
    sourceExportName: '全部活跃样本',
    sourceSnapshotId: 'snap-model-v2',
    metrics: [
      { key: 'mAP50', label: 'mAP50', value: 0.842, baselineValue: 0.818, delta: 0.024 },
      { key: 'precision', label: '精确率', value: 0.891, baselineValue: 0.872, delta: 0.019 },
      { key: 'recall', label: '召回率', value: 0.804, baselineValue: 0.781, delta: 0.023 },
    ],
    metricDeltas: [
      { key: 'mAP50', label: 'mAP50', value: 0.842, baselineValue: 0.818, delta: 0.024 },
      { key: 'recall', label: '召回率', value: 0.804, baselineValue: 0.781, delta: 0.023 },
    ],
    categoryMetrics: [
      { category: 'goods_blocking_road', label: '物品占道', precision: 0.9, recall: 0.82, f1: 0.858, sampleCount: 188, delta: 0.021 },
      { category: 'nonmotor_vehicle_illegal_parking', label: '非机动车违停', precision: 0.87, recall: 0.79, f1: 0.828, sampleCount: 156, delta: 0.012 },
    ],
    changedSampleCount: 24,
    createdBy: 'ml_ops',
    createdAt: '2026-05-19T11:00:00+08:00',
    completedAt: '2026-05-19T11:08:00+08:00',
    notes: '基于修正样本池导出的 COCO 数据完成评估',
  },
  {
    evaluationId: 'eval-qwen25-v1',
    datasetId: dataset.id,
    modelName: 'Qwen2.5-VL',
    modelVersion: 'qwen2.5-vl-qc-v1',
    status: 'completed',
    sampleCount: 780,
    sourceExportId: 'export-coco-0508',
    sourceExportName: '全部活跃样本',
    sourceSnapshotId: 'snap-model-v1',
    metrics: [
      { key: 'mAP50', label: 'mAP50', value: 0.818 },
      { key: 'precision', label: '精确率', value: 0.872 },
      { key: 'recall', label: '召回率', value: 0.781 },
    ],
    metricDeltas: [],
    categoryMetrics: [
      { category: 'goods_blocking_road', label: '物品占道', precision: 0.88, recall: 0.79, f1: 0.833, sampleCount: 188 },
      { category: 'nonmotor_vehicle_illegal_parking', label: '非机动车违停', precision: 0.86, recall: 0.77, f1: 0.813, sampleCount: 156 },
    ],
    changedSampleCount: 31,
    createdBy: 'ml_ops',
    createdAt: '2026-05-18T18:30:00+08:00',
    completedAt: '2026-05-18T18:37:00+08:00',
  },
];

const modelEvaluationDeltaSamples: ModelEvaluationDeltaSample[] = [
  {
    sampleId: 'sample-0001',
    category: 'goods_blocking_road',
    changeType: '指标提升',
    beforeSnapshotId: 'snap-baseline-sample-0001',
    afterSnapshotId: 'snap-model-v2-sample-0001',
    metricImpacts: [{ key: 'confidence', label: '置信度', value: 0.91, baselineValue: 0.76, delta: 0.15 }],
    reason: '修正后的边界框提高了候选置信度',
  },
  {
    sampleId: 'sample-0002',
    category: 'nonmotor_vehicle_illegal_parking',
    changeType: '结果变化',
    beforeSnapshotId: 'snap-baseline-sample-0002',
    afterSnapshotId: 'snap-model-v2-sample-0002',
    metricImpacts: [{ key: 'recall', label: '召回率', value: 0.8, baselineValue: 0.71, delta: 0.09 }],
    reason: '可见性修正样本被新模型正确召回',
  },
];

const annotationSnapshots: AnnotationSnapshot[] = [
  {
    snapshotId: 'snap-baseline-sample-0001',
    datasetId: dataset.id,
    sampleId: 'sample-0001',
    snapshotType: 'baseline',
    labelConfigVersion: dataset.activeLabelConfigVersion,
    payloadHash: 'a7c2e109d1',
    createdBy: 'importer',
    createdAt: '2026-05-18T09:10:00+08:00',
    rollbackAvailable: false,
  },
  {
    snapshotId: 'snap-confirmed-sample-0001',
    datasetId: dataset.id,
    sampleId: 'sample-0001',
    snapshotType: 'confirmed',
    sourceSubmissionId: 'submission-sample-0001',
    labelConfigVersion: dataset.activeLabelConfigVersion,
    payloadHash: 'b8d4a201ff',
    createdBy: 'qc_lead_a',
    createdAt: '2026-05-19T09:20:00+08:00',
    rollbackAvailable: false,
  },
  {
    snapshotId: 'snap-model-v2-sample-0001',
    datasetId: dataset.id,
    sampleId: 'sample-0001',
    snapshotType: 'model_preannotation',
    sourceExportId: 'export-coco-0508',
    sourceModelVersion: 'qwen2.5-vl-qc-v2',
    sourceEvaluationId: 'eval-qwen25-v2',
    labelConfigVersion: dataset.activeLabelConfigVersion,
    payloadHash: 'f1c9c23391',
    createdBy: 'ml_ops',
    createdAt: '2026-05-19T11:12:00+08:00',
    rollbackAvailable: false,
  },
];

const snapshotDiff: AnnotationSnapshotDiff = {
  datasetId: dataset.id,
  leftSnapshotId: 'snap-baseline-sample-0001',
  rightSnapshotId: 'snap-confirmed-sample-0001',
  changedFieldCount: 3,
  changedRelationCount: 1,
  changedCandidateCount: 1,
  changedFields: [
    { field: 'stage1.key_relations.R1.bbox', label: '关系框', changeType: 'replace', before: [310, 180, 620, 360], after: [320, 190, 650, 372] },
    { field: 'stage2.candidates.C1.violation_category', label: '候选类别', changeType: 'replace', before: 'road_occupying_vendor', after: 'goods_blocking_road' },
    { field: 'stage2.candidates.C1.evidence_reasoning', label: '证据说明', changeType: 'replace', before: '摊贩占道', after: '物品占道证据更完整' },
  ],
  relations: [
    { relationIndex: 'R1', field: 'bbox', label: '关系框', changeType: 'replace', before: [310, 180, 620, 360], after: [320, 190, 650, 372] },
  ],
  candidates: [
    { candidateIndex: 'C1', field: 'violation_category', label: '候选类别', changeType: 'replace', before: 'road_occupying_vendor', after: 'goods_blocking_road' },
  ],
  summary: '确认版本相对基线修改了关系框、候选类别和候选证据说明',
  rollbackAvailable: false,
};

const fixtureUsers: UserAccount[] = [
  {
    userId: 'admin',
    username: 'admin',
    displayName: '平台管理员',
    email: 'admin@example.local',
    status: 'active',
    roles: ['platform_admin'],
  },
  {
    userId: 'manager',
    username: 'manager',
    displayName: '批次经理',
    email: 'manager@example.local',
    status: 'active',
    roles: ['batch_manager'],
  },
  {
    userId: 'annotator_a',
    username: 'annotator_a',
    displayName: '标注员 A',
    email: 'annotator_a@example.local',
    status: 'active',
    roles: ['annotator'],
  },
  {
    userId: 'annotator_b',
    username: 'annotator_b',
    displayName: '标注员 B',
    email: 'annotator_b@example.local',
    status: 'active',
    roles: ['annotator'],
  },
  {
    userId: 'lead',
    username: 'lead',
    displayName: '质检组长',
    email: 'lead@example.local',
    status: 'active',
    roles: ['qc_lead'],
  },
  {
    userId: 'auditor',
    username: 'auditor',
    displayName: '审计员',
    email: 'auditor@example.local',
    status: 'active',
    roles: ['auditor'],
  },
];

let fixtureCurrentUserId = 'annotator_a';

const roleBindings: RoleBinding[] = fixtureUsers.flatMap((user) =>
  (user.roles ?? []).map((role) => ({
    bindingId: `binding-${user.userId}-${role}`,
    userId: user.userId,
    role,
    scopeType: role === 'platform_admin' ? 'platform' : 'dataset_batch',
    scopeId: role === 'platform_admin' ? '*' : dataset.id,
    createdAt: '2026-05-18T00:00:00Z',
    createdBy: 'admin',
  })),
);

let batchAssignment: BatchQcAssignment = {
  assignmentId: 'assignment-urban-violation-0508',
  qcQueueId: dataset.qcQueueId,
  datasetId: dataset.id,
  assigneeUserId: 'annotator_a',
  assigneeDisplayName: '标注员 A',
  assignedBy: 'manager',
  assignedByDisplayName: '批次经理',
  status: 'in_progress',
  assignedAt: '2026-05-18T09:00:00Z',
  updatedAt: '2026-05-18T09:30:00Z',
};

const taskStatusBySample: Record<string, QcTask['status']> = {
  '000142_0_1762483003246': 'in_progress',
  '001710_0_1763108687181': 'draft_saved',
  '000233_0_1762483885120': 'submitted',
  '000376_0_1762484770192': 'confirmed',
  '000511_0_1762485111234': 'returned',
};

const leases = new Map<string, SampleLease>();
const submissions = new Map<string, LabelEditSubmission[]>();
const auditEvents: AuditEvent[] = [
  {
    eventId: 'audit-assignment-1',
    actorUserId: 'manager',
    actorDisplayName: '批次经理',
    actorRole: 'batch_manager',
    action: 'batch_assignment.assign',
    entityType: 'batch_assignment',
    entityId: batchAssignment.assignmentId,
    datasetId: dataset.id,
    after: batchAssignment,
    createdAt: batchAssignment.assignedAt ?? '2026-05-18T09:00:00Z',
  },
];

const mediaUrl = (sampleId: string, variant?: 'thumb') =>
  `/api/datasets/${dataset.id}/assets/${encodeURIComponent(sampleId)}/image${variant ? `?variant=${variant}` : ''}`;

const assets: AssetListItem[] = [
  {
    id: 'asset-000142',
    datasetId: dataset.id,
    datasetType: dataset.datasetType,
    batchKey: dataset.batchKey,
    sampleId: '000142_0_1762483003246',
    imageUrl: mediaUrl('000142_0_1762483003246'),
    thumbnailUrl: mediaUrl('000142_0_1762483003246', 'thumb'),
    width: 1280,
    height: 720,
    sourcePath: 'images/000142_0_1762483003246.jpg',
    importedAt: '2025-05-08T11:54:21+08:00',
    mediaStatus: 'valid',
    importStatus: 'imported',
    stage1Status: 'ready',
    stage2Status: 'passed',
    preannotationStatus: 'stage2_ready',
    judgeDecision: 'pass',
    qcStatus: 'qc_pending',
    labelEditStatus: 'none',
    hasStage2Failure: false,
    violationCategories: ['nonmotor_vehicle_illegal_parking'],
    sampleCategories: ['positive samples'],
    candidateCount: 3,
    highestConfidence: 0.9421,
    updatedAt: '2025-05-08T11:54:21+08:00',
  },
  {
    id: 'asset-001710',
    datasetId: dataset.id,
    datasetType: dataset.datasetType,
    batchKey: dataset.batchKey,
    sampleId: '001710_0_1763108687181',
    imageUrl: mediaUrl('001710_0_1763108687181'),
    thumbnailUrl: mediaUrl('001710_0_1763108687181', 'thumb'),
    width: 1280,
    height: 720,
    sourcePath: 'images/001710_0_1763108687181.jpg',
    importedAt: '2025-05-08T11:54:20+08:00',
    mediaStatus: 'valid',
    importStatus: 'imported',
    stage1Status: 'ready',
    stage2Status: 'failed',
    preannotationStatus: 'stage2_failed',
    judgeDecision: 'soft_fail',
    qcStatus: 'needs_review',
    labelEditStatus: 'draft',
    hasStage2Failure: true,
    violationCategories: ['stage2_failure'],
    sampleCategories: ['hard boundary samples'],
    candidateCount: 0,
    updatedAt: '2025-05-08T11:54:20+08:00',
  },
  {
    id: 'asset-000233',
    datasetId: dataset.id,
    datasetType: dataset.datasetType,
    batchKey: dataset.batchKey,
    sampleId: '000233_0_1762483885120',
    imageUrl: mediaUrl('000233_0_1762483885120'),
    thumbnailUrl: mediaUrl('000233_0_1762483885120', 'thumb'),
    width: 1280,
    height: 720,
    sourcePath: 'images/000233_0_1762483885120.jpg',
    importedAt: '2025-05-08T11:53:58+08:00',
    mediaStatus: 'valid',
    importStatus: 'imported',
    stage1Status: 'ready',
    stage2Status: 'passed',
    preannotationStatus: 'stage2_ready',
    judgeDecision: 'pass',
    qcStatus: 'passed',
    labelEditStatus: 'submitted',
    hasStage2Failure: false,
    violationCategories: ['goods_blocking_road'],
    sampleCategories: ['positive samples'],
    candidateCount: 5,
    highestConfidence: 0.9732,
    updatedAt: '2025-05-08T11:53:58+08:00',
  },
  {
    id: 'asset-000376',
    datasetId: dataset.id,
    datasetType: dataset.datasetType,
    batchKey: dataset.batchKey,
    sampleId: '000376_0_1762484770192',
    imageUrl: mediaUrl('000376_0_1762484770192'),
    thumbnailUrl: mediaUrl('000376_0_1762484770192', 'thumb'),
    width: 1280,
    height: 720,
    sourcePath: 'images/000376_0_1762484770192.jpg',
    importedAt: '2025-05-08T11:53:36+08:00',
    mediaStatus: 'valid',
    importStatus: 'imported',
    stage1Status: 'ready',
    stage2Status: 'ready',
    preannotationStatus: 'stage2_ready',
    judgeDecision: 'soft_fail',
    qcStatus: 'needs_review',
    labelEditStatus: 'none',
    hasStage2Failure: false,
    violationCategories: ['no violation'],
    sampleCategories: ['negative samples'],
    candidateCount: 2,
    highestConfidence: 0.7108,
    updatedAt: '2025-05-08T11:53:36+08:00',
  },
  {
    id: 'asset-000511',
    datasetId: dataset.id,
    datasetType: dataset.datasetType,
    batchKey: dataset.batchKey,
    sampleId: '000511_0_1762485111234',
    imageUrl: mediaUrl('000511_0_1762485111234'),
    thumbnailUrl: mediaUrl('000511_0_1762485111234', 'thumb'),
    width: 1280,
    height: 720,
    sourcePath: 'images/000511_0_1762485111234.jpg',
    importedAt: '2025-05-08T11:52:48+08:00',
    mediaStatus: 'valid',
    importStatus: 'imported',
    stage1Status: 'ready',
    stage2Status: 'ready',
    preannotationStatus: 'stage2_ready',
    judgeDecision: 'soft_fail',
    qcStatus: 'manual_label_required',
    labelEditStatus: 'changed',
    hasStage2Failure: false,
    violationCategories: ['motor_vehicle_illegal_parking'],
    sampleCategories: ['hard boundary samples'],
    candidateCount: 1,
    highestConfidence: 0.5377,
    updatedAt: '2025-05-08T11:52:48+08:00',
  },
];

const assetSummary: AssetSummary = {
  datasetId: dataset.id,
  datasetType: dataset.datasetType,
  batchKey: dataset.batchKey,
  media: {
    total: 797,
    valid: 797,
    missing: 0,
    loadFailed: 0,
    resolutionAbnormal: 0,
  },
  importHealth: {
    imported: 797,
    duplicates: 0,
    orphanAnnotations: 1,
    pathWarnings: 2,
    schemaWarnings: 0,
  },
  preannotation: {
    stage1Ready: 797,
    stage2Ready: 780,
    stage2Failed: 19,
    stage2Missing: 0,
  },
  modelJudgement: {
    pass: 569,
    softFail: 211,
    unknown: 17,
  },
  qc: {
    queued: 797,
    pending: 186,
    skipped: 0,
    draft: 66,
    submitted: 528,
  },
  categoryDistribution: [
    { key: 'no violation', label: 'no violation', count: 387, ratio: 0.4962 },
    { key: 'nonmotor_vehicle_illegal_parking', label: 'nonmotor_vehicle_illegal_parking', count: 302, ratio: 0.3872 },
    { key: 'goods_blocking_road', label: 'goods_blocking_road', count: 221, ratio: 0.2833 },
  ],
  sampleCategoryDistribution: [
    { key: 'positive samples', label: 'Positive', count: 612, ratio: 0.7846 },
    { key: 'negative samples', label: 'Negative', count: 104, ratio: 0.1333 },
    { key: 'hard boundary samples', label: 'Hard boundary', count: 64, ratio: 0.0821 },
  ],
  updatedAt: '2025-05-08T15:45:12+08:00',
};

const datasetSummary: DatasetSummary = {
  dataset,
  totals: {
    rawAssets: 797,
    stage1Parsed: 797,
    stage2Parsed: 780,
    stage2Failures: 19,
  },
  coverage: {
    stage1: 1,
    stage2: 0.9787,
  },
  qc: {
    total: 780,
    pending: 186,
    passed: 452,
    rejected: 76,
    needsHumanReview: 66,
  },
  judgeDecisionDistribution: [
    { key: 'qc_pending', label: 'Pending', count: 186, ratio: 0.2385 },
    { key: 'passed', label: 'Passed', count: 452, ratio: 0.5795 },
    { key: 'rejected', label: 'Rejected', count: 76, ratio: 0.0974 },
    { key: 'needs_review', label: 'Needs review', count: 66, ratio: 0.0846 },
  ],
  violationCategoryDistribution: [
    { key: 'no violation', label: 'no violation', count: 387, ratio: 0.4962 },
    {
      key: 'nonmotor_vehicle_illegal_parking',
      label: 'nonmotor_vehicle_illegal_parking',
      count: 302,
      ratio: 0.3872,
    },
    { key: 'goods_blocking_road', label: 'goods_blocking_road', count: 221, ratio: 0.2833 },
    { key: 'road_occupying_vendor', label: 'road_occupying_vendor', count: 20, ratio: 0.0256 },
  ],
  confidenceDistribution: [
    { key: '0-0.2', label: '0-0.2', count: 4, ratio: 0.0051 },
    { key: '0.2-0.4', label: '0.2-0.4', count: 18, ratio: 0.0231 },
    { key: '0.4-0.6', label: '0.4-0.6', count: 66, ratio: 0.0846 },
    { key: '0.6-0.8', label: '0.6-0.8', count: 192, ratio: 0.2462 },
    { key: '0.8-1.0', label: '0.8-1.0', count: 500, ratio: 0.641 },
  ],
  visibilityDistribution: [
    { key: 'fully_visible', label: 'Fully visible', count: 402, ratio: 0.5154 },
    { key: 'mostly_visible', label: 'Mostly visible', count: 248, ratio: 0.3179 },
    { key: 'partially_visible', label: 'Partially visible', count: 96, ratio: 0.1231 },
    { key: 'barely_visible', label: 'Barely visible', count: 34, ratio: 0.0436 },
  ],
  sampleCategoryDistribution: [
    { key: 'positive samples', label: 'Positive', count: 612, ratio: 0.7846 },
    { key: 'negative samples', label: 'Negative', count: 104, ratio: 0.1333 },
    { key: 'hard boundary samples', label: 'Hard boundary', count: 64, ratio: 0.0821 },
  ],
  importWarnings: [
    {
      id: 'warn-stage2-gap',
      severity: 'warning',
      title: 'STEP2 parsed less than images',
      message: 'STEP2 parsed (780) is lower than Raw Images (797).',
      createdAt: '2025-05-08T15:42:25+08:00',
    },
    {
      id: 'warn-stage2-total',
      severity: 'warning',
      title: 'parsed plus failures count mismatch',
      message: 'STEP2 parsed (780) plus failures (19) differs from Raw Images (797).',
      createdAt: '2025-05-08T15:42:25+08:00',
    },
  ],
  latestImportJob: {
    id: 'import-stage2-0508',
    datasetId: dataset.id,
    state: 'PreviewReady',
    title: '0508 fixture local directory import',
    createdAt: '2025-05-08T10:21:33+08:00',
    updatedAt: '2025-05-08T15:42:25+08:00',
    blockingIssueCount: 0,
    warningCount: 2,
    totals: {
      rawAssets: 797,
      stage1Parsed: 797,
      stage2Parsed: 780,
      stage2Failures: 19,
    },
  },
  assetSummary,
  recentRuns: [
    {
      runId: 'stage2_run_0508',
      name: 'stage2_run_0508',
      stage: 'stage2',
      startedAt: '2025-05-08T15:42:18+08:00',
      status: 'success',
      inputCount: 797,
      outputCount: 780,
    },
    {
      runId: 'stage1_run_0508',
      name: 'stage1_run_0508',
      stage: 'stage1',
      startedAt: '2025-05-08T11:03:25+08:00',
      status: 'success',
      inputCount: 797,
      outputCount: 797,
    },
  ],
  metadata: {
    imageSource: 'city governance capture system',
    region: 'China / Hangzhou',
    collectionRange: '2025-04-01 - 2025-05-08',
    imageResolution: '1280x720 - 4096x2160',
    fileFormats: ['jpg', 'png'],
  },
};

const importJob: ImportJobDetail = {
  id: 'import-stage2-0508',
  datasetId: dataset.id,
  datasetType: dataset.datasetType,
  batchKey: dataset.batchKey,
  title: '0508 fixture local directory import',
  sourceMode: 'local_directory',
  sourceUri: 'DATASET/urban_violation',
  state: 'PreviewReady',
  activeStep: 4,
  createdAt: '2025-05-08T10:21:33+08:00',
  updatedAt: '2025-05-08T15:42:25+08:00',
  totals: datasetSummary.totals,
  coverage: datasetSummary.coverage,
  warnings: datasetSummary.importWarnings,
  validationRows: [
    {
      sampleId: '000142_0_1762483003246',
      imagePath: 'images/000142_0_1762483003246.jpg',
      stage1Path: 'stage1_run_0508/parsed/49/000142_0_1762483003246.json',
      stage2Path: 'stage2_run_0508/parsed/49/000142_0_1762483003246.json',
      status: 'ready',
    },
    {
      sampleId: '001710_0_1763108687181',
      imagePath: 'images/001710_0_1763108687181.jpg',
      stage1Path: 'stage1_run_0508/parsed/8f/001710_0_1763108687181.json',
      failurePath: 'stage2_run_0508/failures/8f/001710_0_1763108687181.json',
      status: 'stage2_failed',
    },
    {
      sampleId: '001222_0_1762890000000',
      imagePath: 'images/001222_0_1762890000000.jpg',
      stage1Path: 'stage1_run_0508/parsed/a2/001222_0_1762890000000.json',
      status: 'stage2_missing',
    },
    {
      sampleId: 'stage2_orphan_1762483999000',
      imagePath: 'images/stage2_orphan_1762483999000.jpg',
      stage2Path: 'stage2_run_0508/parsed/bb/stage2_orphan_1762483999000.json',
      status: 'orphan_annotation',
    },
  ],
  mappingSteps: [
    { id: 'raw', label: 'images/*.jpg', count: 797, entity: 'RawAsset' },
    { id: 'stage1', label: 'stage1 parsed/*.json', count: 797, entity: 'PreAnnotationStep1' },
    { id: 'stage2', label: 'stage2 parsed/*.json', count: 780, entity: 'PreAnnotationStep2' },
    { id: 'failures', label: 'failures/*.json', count: 19, entity: 'PreAnnotationFailure' },
    { id: 'audit', label: 'records / requests / responses / meta', count: 7930, entity: 'AuditArtifact' },
  ],
};

importJob.validationReport = {
  datasetId: dataset.id,
  jobId: importJob.id,
  valid: true,
  totals: importJob.totals,
  coverage: importJob.coverage,
  blockingErrors: [],
  warnings: importJob.warnings,
  rows: importJob.validationRows,
  checkedAt: importJob.updatedAt,
};

const preannotationSummary: PreannotationSummary = {
  datasetId: dataset.id,
  stage1: {
    succeeded: 797,
    failed: 0,
    bboxValid: 797,
  },
  stage2: {
    parsed: 780,
    failures: 19,
    factVerificationCount: 2476,
    candidateCount: 943,
  },
  categoryDistribution: datasetSummary.violationCategoryDistribution,
  verificationDistribution: [
    { key: 'supported', label: 'supported', count: 1709, ratio: 0.6902 },
    { key: 'weakly_supported', label: 'weakly_supported', count: 764, ratio: 0.3086 },
    { key: 'unsupported', label: 'unsupported', count: 2, ratio: 0.0008 },
    { key: 'unclear', label: 'unclear', count: 1, ratio: 0.0004 },
  ],
};

const fixtureLabelConfig: LabelConfig = {
  configId: 'label-config-fixture-1',
  datasetId: dataset.id,
  schemaVersion: 'label_config_v1',
  datasetType: 'urban_violation',
  version: 'urban_violation_labels_v1',
  status: 'active',
  contentHash: 'sha256:fixture-label-config',
  createdAt: '2026-05-17T12:00:00Z',
  activatedAt: '2026-05-17T12:00:00Z',
  fields: [
    {
      field: 'violation_category',
      mode: 'closed_enum',
      labelZh: '违法类别',
      labelEn: 'Violation category',
      allowCustom: false,
      options: [
        { code: 'no violation', labelZh: '无违法', labelEn: 'No violation', aliases: [] },
        {
          code: 'nonmotor_vehicle_illegal_parking',
          labelZh: '非机动车违停',
          labelEn: 'Non-motor vehicle illegal parking',
          aliases: ['电动车违停'],
        },
        { code: 'goods_blocking_road', labelZh: '物品占道', labelEn: 'Goods blocking road', aliases: ['杂物占道'] },
      ],
    },
    {
      field: 'sample_category',
      mode: 'closed_enum',
      labelZh: '样本类别',
      labelEn: 'Sample category',
      allowCustom: false,
      options: [
        { code: 'positive samples', labelZh: '正样本', labelEn: 'Positive samples', aliases: [] },
        { code: 'negative samples', labelZh: '负样本', labelEn: 'Negative samples', aliases: [] },
        { code: 'hard boundary samples', labelZh: '困难边界样本', labelEn: 'Hard boundary samples', aliases: [] },
      ],
    },
    {
      field: 'relation',
      mode: 'closed_enum',
      labelZh: '事实关系',
      labelEn: 'Fact relation',
      allowCustom: false,
      options: [
        { code: 'blocks', labelZh: '阻挡', labelEn: 'blocks', aliases: [] },
        { code: 'parked beside', labelZh: '停放于旁侧', labelEn: 'parked beside', aliases: [] },
        { code: 'located behind', labelZh: '位于后方', labelEn: 'located behind', aliases: [] },
      ],
    },
    {
      field: 'verification_result',
      mode: 'closed_enum',
      labelZh: '事实核验结果',
      labelEn: 'Verification result',
      allowCustom: false,
      options: [
        { code: 'supported', labelZh: '支持', labelEn: 'Supported', aliases: [] },
        { code: 'weakly_supported', labelZh: '弱支持', labelEn: 'Weakly supported', aliases: [] },
        { code: 'unsupported', labelZh: '不支持', labelEn: 'Unsupported', aliases: [] },
        { code: 'unclear', labelZh: '不清楚', labelEn: 'Unclear', aliases: [] },
      ],
    },
    {
      field: 'visibility_level',
      mode: 'closed_enum',
      labelZh: '可见性等级',
      labelEn: 'Visibility level',
      allowCustom: false,
      options: [
        { code: 'clear', labelZh: '清晰', labelEn: 'Clear', aliases: [] },
        { code: 'partial', labelZh: '部分可见', labelEn: 'Partial', aliases: [] },
        { code: 'occluded', labelZh: '遮挡', labelEn: 'Occluded', aliases: [] },
      ],
    },
    {
      field: 'information_loss_type',
      mode: 'closed_enum',
      labelZh: '信息损失类型',
      labelEn: 'Information loss type',
      allowCustom: false,
      options: [
        { code: 'none', labelZh: '无', labelEn: 'None', aliases: [] },
        { code: 'occlusion', labelZh: '遮挡', labelEn: 'Occlusion', aliases: [] },
        { code: 'boundary_truncation', labelZh: '边界截断', labelEn: 'Boundary truncation', aliases: [] },
      ],
    },
    {
      field: 'scene_elements',
      mode: 'open_tags',
      labelZh: '场景元素',
      labelEn: 'Scene elements',
      allowCustom: true,
      maxItems: 30,
      options: [
        { code: 'sidewalk', labelZh: '人行道', labelEn: 'sidewalk', aliases: ['步道'] },
        { code: 'electric_vehicle', labelZh: '电动车', labelEn: 'electric vehicle', aliases: ['电动自行车'] },
        { code: 'pedestrian', labelZh: '行人', labelEn: 'pedestrian', aliases: [] },
      ],
    },
    {
      field: 'segmentation_targets',
      mode: 'open_tags',
      labelZh: '分割目标',
      labelEn: 'Segmentation targets',
      allowCustom: true,
      maxItems: 30,
      options: [
        { code: 'goods', labelZh: '货物', labelEn: 'goods', aliases: ['杂物'] },
        { code: 'nonmotor_vehicle', labelZh: '非机动车', labelEn: 'non-motor vehicle', aliases: [] },
        { code: 'person', labelZh: '人', labelEn: 'person', aliases: ['行人'] },
      ],
    },
  ],
};

const reviewDetails: Record<string, ReviewSampleDetail> = {
  '000142_0_1762483003246': {
    asset: assets[0],
    stage1: {
      sampleId: '000142_0_1762483003246',
      environmentAnalysis: 'Urban street, daytime, clear weather, active traffic.',
      sceneElements: ['pedestrian', 'nonmotor vehicle', 'motor vehicle', 'sidewalk', 'traffic signal'],
      keyAnchors: [
        { anchor: 'no parking sign', bbox: [740, 122, 910, 342] },
        { anchor: 'traffic signal', bbox: [1114, 43, 1216, 160] },
      ],
      keyRelations: [
        {
          relationIndex: 'R1',
          subject: 'pedestrian',
          relation: 'standing on',
          object: 'crosswalk edge',
          description: 'Pedestrian is waiting near the crossing.',
          bbox: [38, 250, 178, 642],
        },
        {
          relationIndex: 'R2',
          subject: 'nonmotor vehicle',
          relation: 'parked beside',
          object: 'curb',
          description: 'Vehicle is stopped along the curb line.',
          bbox: [380, 295, 668, 490],
        },
        {
          relationIndex: 'R3',
          subject: 'motor vehicle',
          relation: 'occupies',
          object: 'road lane',
          description: 'Car is visible in the right travel lane.',
          bbox: [792, 330, 1115, 504],
        },
        {
          relationIndex: 'R4',
          subject: 'no parking sign',
          relation: 'located behind',
          object: 'curb',
          description: 'Sign constrains curbside parking behavior.',
          bbox: [738, 126, 912, 342],
        },
        {
          relationIndex: 'R5',
          subject: 'traffic signal',
          relation: 'controls',
          object: 'intersection',
          description: 'Signal is visible above the right side of the road.',
          bbox: [1112, 42, 1216, 166],
        },
      ],
      judgeReport: {
        decision: 'pass',
        reason: 'All relation boxes are valid and aligned to visible objects.',
      },
    },
    stage2: {
      sampleId: '000142_0_1762483003246',
      factVerifications: [
        {
          relationIndex: 'R1',
          subject: 'pedestrian',
          relation: 'standing on',
          object: 'crosswalk edge',
          bbox: [38, 250, 178, 642],
          visibilityLevel: 'partial',
          informationLossType: 'occlusion',
          subjectVisible: true,
          subjectMatch: true,
          keyAttributesVisible: ['body_outline'],
          bboxObservation: 'Subject bbox is aligned with the visible pedestrian outline.',
          globalContextObservation: 'Subject is visible with mild occlusion from street furniture.',
          observations: 'Subject bbox is aligned with the visible pedestrian outline. Subject is visible with mild occlusion from street furniture.',
          verificationResult: 'supported',
          verificationConfidence: 0.98,
        },
        {
          relationIndex: 'R2',
          subject: 'nonmotor vehicle',
          relation: 'parked beside',
          object: 'curb',
          bbox: [380, 295, 668, 490],
          visibilityLevel: 'clear',
          informationLossType: 'none',
          subjectVisible: true,
          subjectMatch: true,
          keyAttributesVisible: ['wheel', 'body_outline'],
          bboxObservation: 'Vehicle bbox covers the parked nonmotor vehicle.',
          globalContextObservation: 'Vehicle and curb alignment are clearly visible.',
          observations: 'Vehicle bbox covers the parked nonmotor vehicle. Vehicle and curb alignment are clearly visible.',
          verificationResult: 'supported',
          verificationConfidence: 0.96,
        },
        {
          relationIndex: 'R4',
          subject: 'no parking sign',
          relation: 'located behind',
          object: 'curb',
          bbox: [738, 126, 912, 342],
          visibilityLevel: 'clear',
          informationLossType: 'none',
          subjectVisible: true,
          subjectMatch: true,
          keyAttributesVisible: ['sign_panel'],
          bboxObservation: 'Sign bbox covers the visible sign panel.',
          globalContextObservation: 'The traffic sign is readable enough for category reasoning.',
          observations: 'Sign bbox covers the visible sign panel. The traffic sign is readable enough for category reasoning.',
          verificationResult: 'supported',
          verificationConfidence: 0.97,
        },
      ],
      candidates: [
        {
          violationCategory: 'nonmotor_vehicle_illegal_parking',
          evidenceRelationIndices: ['R2', 'R4'],
          evidenceReasoning:
            'The nonmotor vehicle is stationary beside the curb near a no-parking sign.',
          relationHint: 'R2 indicates curbside stop and R4 provides regulatory context.',
          segmentationTargets: ['nonmotor vehicle', 'no parking sign'],
          confidence: 0.87,
          sampleCategory: 'positive samples',
        },
        {
          violationCategory: 'no violation',
          evidenceRelationIndices: ['R1'],
          evidenceReasoning: 'Pedestrian presence alone does not indicate a violation.',
          segmentationTargets: ['pedestrian'],
          confidence: 0.32,
          sampleCategory: 'negative samples',
        },
      ],
      judgeReport: {
        decision: 'pass',
        reason: 'Candidate evidence references valid relation indices.',
      },
    },
    humanReview: {
      id: 'review-000142',
      sampleId: '000142_0_1762483003246',
      decision: 'approved',
      reviewer: 'demo-reviewer',
      reasoning: 'Initial fixture decision for UI workflow.',
      updatedAt: '2025-05-08T16:00:00+08:00',
    },
    auditArtifacts: [
      {
        id: 'artifact-stage1-parsed',
        label: 'STEP1 parsed',
        artifactType: 'record',
        url: `/api/datasets/${dataset.id}/artifacts/000142_0_1762483003246/stage1-parsed`,
      },
      {
        id: 'artifact-stage2-record',
        label: 'STEP2 record',
        artifactType: 'record',
        url: `/api/datasets/${dataset.id}/artifacts/000142_0_1762483003246/stage2-record`,
      },
    ],
    labelEditHistory: [],
  },
  '001710_0_1763108687181': {
    asset: assets[1],
    stage1: {
      sampleId: '001710_0_1763108687181',
      environmentAnalysis: 'Urban roadside scene with dense curb activity.',
      sceneElements: ['sidewalk', 'roadside vendor', 'pedestrian', 'motor vehicle'],
      keyAnchors: [{ anchor: 'roadside goods', bbox: [520, 284, 812, 612] }],
      keyRelations: [
        {
          relationIndex: 'R1',
          subject: 'roadside goods',
          relation: 'blocks',
          object: 'sidewalk passage',
          bbox: [520, 284, 812, 612],
        },
      ],
      judgeReport: {
        decision: 'soft_fail',
        reason: 'Scene is useful but needs model output remediation.',
      },
    },
    stage2Failure: {
      sampleId: '001710_0_1763108687181',
      errorType: 'ValueError',
      message: 'Invalid output reason: boundary_truncation but supported.',
      rawArtifactUrl: `/api/datasets/${dataset.id}/artifacts/001710_0_1763108687181/stage2-failure`,
    },
    auditArtifacts: [
      {
        id: 'artifact-stage2-failure',
        label: 'STEP2 failure',
        artifactType: 'failure',
        url: `/api/datasets/${dataset.id}/artifacts/001710_0_1763108687181/stage2-failure`,
      },
    ],
    labelEditHistory: [],
  },
};

const reviews = new Map<string, HumanReview>(
  Object.entries(reviewDetails)
    .filter(([, detail]) => detail.humanReview)
    .map(([sampleId, detail]) => [sampleId, detail.humanReview as HumanReview]),
);
const labelEdits = new Map<string, LabelEditState[]>();
const batchDraftSamples = new Map<string, BatchLabelEditDraft['samples'][number]>();

const clone = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value))) as T;
const delay = async () => new Promise((resolve) => window.setTimeout(resolve, 80));
const userDisplayName = (userId?: string) =>
  fixtureUsers.find((user) => user.userId === userId)?.displayName ?? userId ?? '未分配';
const currentFixtureUser = (): CurrentUser => {
  let userId = fixtureCurrentUserId;
  try {
    userId = window.localStorage.getItem('uvp.devUserId') || fixtureCurrentUserId;
  } catch {
    userId = fixtureCurrentUserId;
  }
  const account = fixtureUsers.find((user) => user.userId === userId) ?? fixtureUsers[0];
  const bindings = roleBindings.filter((binding) => binding.userId === account.userId);
  return {
    ...account,
    authMode: 'dev_header',
    roles: account.roles ?? bindings.map((binding) => binding.role),
    roleBindings: bindings,
    permissions: permissionsFor(account.roles ?? []),
  };
};

const permissionsFor = (roles: UserAccount['roles'] = []) => {
  const permissions = new Set<string>();
  roles.forEach((role) => {
    if (role === 'platform_admin') {
      [
        'users:manage',
        'roles:manage',
        'dataset_type:create',
        'label_config:manage',
        'import_job:manage',
        'batch_assignment:manage',
        'lease:force_release',
        'label_edit:write',
        'label_edit:confirm',
        'audit:read',
        'qc_progress:read',
        'dataset:read',
        'qc_queue:read',
      ].forEach((item) => permissions.add(item));
    }
    if (role === 'dataset_admin') {
      [
        'dataset_type:create',
        'label_config:manage',
        'import_job:manage',
        'batch_assignment:manage',
        'lease:force_release',
        'label_edit:write',
        'audit:read',
        'qc_progress:read',
        'dataset:read',
        'qc_queue:read',
      ].forEach((item) => permissions.add(item));
    }
    if (role === 'batch_manager') {
      [
        'import_job:manage',
        'batch_assignment:manage',
        'lease:force_release',
        'dataset:read',
        'qc_queue:read',
        'audit:read',
        'qc_progress:read',
        'label_edit:write',
      ].forEach((item) => permissions.add(item));
    }
    if (role === 'qc_lead') {
      [
        'dataset:read',
        'qc_queue:read',
        'batch_assignment:manage',
        'lease:force_release',
        'label_edit:write',
        'label_edit:confirm',
        'audit:read',
        'qc_progress:read',
      ].forEach((item) => permissions.add(item));
    }
    if (role === 'annotator') {
      ['dataset:read', 'qc_queue:read', 'label_edit:write', 'audit:read_own', 'qc_progress:read_own'].forEach((item) =>
        permissions.add(item),
      );
    }
    if (role === 'auditor') {
      ['dataset:read', 'qc_queue:read', 'audit:read', 'qc_progress:read'].forEach((item) => permissions.add(item));
    }
  });
  return Array.from(permissions);
};

const rbacCatalog: RbacCatalog = {
  roles: [
    {
      role: 'platform_admin',
      label: '平台管理员',
      description: '管理账号、角色、审计与全平台配置',
      permissions: permissionsFor(['platform_admin']),
    },
    {
      role: 'dataset_admin',
      label: '数据集管理员',
      description: '管理数据集类型、标签配置和批次生命周期',
      permissions: permissionsFor(['dataset_admin']),
    },
    {
      role: 'batch_manager',
      label: '批次管理员',
      description: '管理批次分配、质检队列和批次状态',
      permissions: permissionsFor(['batch_manager']),
    },
    {
      role: 'qc_lead',
      label: '质检负责人',
      description: '确认标注修改、退回问题样本和查看审计记录',
      permissions: permissionsFor(['qc_lead']),
    },
    {
      role: 'annotator',
      label: '标注员',
      description: '领取样本、编辑标签并提交修改',
      permissions: permissionsFor(['annotator']),
    },
    {
      role: 'auditor',
      label: '审计员',
      description: '查看操作审计和权限变更记录',
      permissions: permissionsFor(['auditor']),
    },
  ],
  scopes: [
    { scopeType: 'platform', label: '全平台', description: '作用于全部数据集类型与批次' },
    { scopeType: 'dataset_type', label: '数据集类型', description: '作用于一个数据集类型及其批次' },
    { scopeType: 'dataset_batch', label: '数据集批次', description: '仅作用于一个具体批次' },
  ],
  permissions: Array.from(
    new Set([
      'users:manage',
      'roles:manage',
      'dataset_type:create',
      'label_config:manage',
      'import_job:manage',
      'batch_assignment:manage',
      'lease:force_release',
      'label_edit:write',
      'label_edit:confirm',
      'audit:read',
      'audit:read_own',
      'qc_progress:read',
      'qc_progress:read_own',
      'dataset:read',
      'qc_queue:read',
    ]),
  ),
};

const taskForAsset = (asset: AssetListItem): QcTask => ({
  taskId: `task-${asset.sampleId}`,
  qcQueueId: dataset.qcQueueId,
  datasetId: dataset.id,
  sampleId: asset.sampleId,
  status: taskStatusBySample[asset.sampleId] ?? 'assigned',
  assigneeUserId: batchAssignment.assigneeUserId,
  assigneeDisplayName: batchAssignment.assigneeDisplayName,
  claimedAt: asset.sampleId === '000142_0_1762483003246' ? '2026-05-18T09:31:00Z' : undefined,
  submittedAt: asset.sampleId === '000233_0_1762483885120' ? '2026-05-18T10:00:00Z' : undefined,
  confirmedBy: asset.sampleId === '000376_0_1762484770192' ? 'lead' : undefined,
  confirmedAt: asset.sampleId === '000376_0_1762484770192' ? '2026-05-18T10:30:00Z' : undefined,
  latestSubmissionId: asset.sampleId === '000233_0_1762483885120' ? 'submission-000233' : undefined,
  labelConfigId: fixtureLabelConfig.configId,
  labelConfigVersion: fixtureLabelConfig.version,
  taskRevision: 1,
  updatedAt: asset.updatedAt,
});

const submissionForTask = (task: QcTask): LabelEditSubmission | undefined =>
  task.latestSubmissionId
    ? {
        submissionId: task.latestSubmissionId,
        datasetId: dataset.id,
        sampleId: task.sampleId,
        userId: task.assigneeUserId ?? 'annotator_a',
        userDisplayName: task.assigneeDisplayName,
        status: 'submitted',
        operations: [],
        validation: {
          valid: true,
          datasetId: dataset.id,
          sampleId: task.sampleId,
          checkedOperationCount: 0,
          errors: [],
          warnings: [],
          checkedAt: task.submittedAt,
        },
        labelConfigId: task.labelConfigId,
        labelConfigVersion: task.labelConfigVersion,
        taskRevision: task.taskRevision,
        submittedAt: task.submittedAt,
      }
    : undefined;

const qcQueueItems = (): QcQueueItem[] =>
  assets.map((asset) => {
    const task = taskForAsset(asset);
    const lease = leases.get(asset.sampleId);
    const latestSubmission = submissions.get(asset.sampleId)?.at(-1) ?? submissionForTask(task);
    return {
      sampleId: asset.sampleId,
      assetId: asset.id,
      status: asset.qcStatus,
      judgeDecision: asset.judgeDecision,
      highestConfidence: asset.highestConfidence,
      primaryCategory: asset.violationCategories[0],
      stage2Failure: asset.hasStage2Failure,
      updatedAt: asset.updatedAt,
      task,
      taskStatus: task.status,
      assigneeUserId: task.assigneeUserId,
      assigneeDisplayName: task.assigneeDisplayName,
      lease,
      leaseStatus: lease?.status,
      latestSubmission,
      labelConfigVersion: task.labelConfigVersion,
    };
  });

const assignmentFor = (assigneeUserId: string, status: BatchQcAssignment['status']): BatchQcAssignment => ({
  assignmentId: `assignment-${dataset.id}`,
  qcQueueId: dataset.qcQueueId,
  datasetId: dataset.id,
  assigneeUserId,
  assigneeDisplayName: userDisplayName(assigneeUserId),
  assignedBy: currentFixtureUser().userId,
  assignedByDisplayName: currentFixtureUser().displayName,
  status,
  assignedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const batchDraftForCurrentUser = (): BatchLabelEditDraft => {
  const samples = Array.from(batchDraftSamples.values()).filter((sample) => sample.operations.length > 0);
  return {
    draftId: `batch-draft-${dataset.id}-${currentFixtureUser().userId}`,
    datasetId: dataset.id,
    userId: currentFixtureUser().userId,
    assignmentId: batchAssignment.assignmentId,
    labelConfigId: fixtureLabelConfig.configId,
    labelConfigVersion: fixtureLabelConfig.version,
    totalSampleCount: assets.length,
    savedSampleCount: samples.filter((sample) => sample.saved).length,
    dirtySampleCount: samples.filter((sample) => sample.dirty).length,
    validationErrorCount: samples.filter((sample) => sample.validation && !sample.validation.valid).length,
    samples: clone(samples),
    updatedAt: new Date().toISOString(),
  };
};

const saveBatchDraftSamples = (payload: BatchLabelEditDraftPayload): BatchLabelEditDraftSaveResult => {
  const updatedAt = new Date().toISOString();
  payload.entries.forEach((sample) => {
    batchDraftSamples.set(sample.sampleId, {
      ...clone(sample),
      dirty: false,
      saved: true,
    });
    taskStatusBySample[sample.sampleId] = 'draft_saved';
  });
  const draft = batchDraftForCurrentUser();
  return {
    saved: true,
    datasetId: dataset.id,
    savedSampleCount: draft.savedSampleCount,
    totalSampleCount: draft.totalSampleCount,
    sampleIds: payload.entries.map((sample) => sample.sampleId),
    updatedAt,
    draft,
  };
};

const progressFromTasks = (tasks: QcTask[]): QcProgress => {
  const byStatus = tasks.reduce<QcProgress['byStatus']>((acc, task) => {
    acc[task.status] = (acc[task.status] ?? 0) + 1;
    return acc;
  }, {});
  const byUserMap = new Map<string, QcProgress['byUser'][number]>();
  tasks.forEach((task) => {
    const userId = task.assigneeUserId ?? 'unassigned';
    const row = byUserMap.get(userId) ?? {
      userId,
      displayName: task.assigneeDisplayName ?? userDisplayName(userId),
      draftSaved: 0,
      submitted: 0,
      returned: 0,
      confirmed: 0,
    };
    if (task.status === 'draft_saved') row.draftSaved += 1;
    if (task.status === 'submitted') row.submitted += 1;
    if (task.status === 'returned') row.returned += 1;
    if (task.status === 'confirmed' || task.status === 'completed') row.confirmed += 1;
    byUserMap.set(userId, row);
  });
  return {
    datasetId: dataset.id,
    byStatus,
    byUser: Array.from(byUserMap.values()),
    total: tasks.length,
    updatedAt: new Date().toISOString(),
  };
};

const audit = (
  action: string,
  entityType: string,
  entityId: string,
  before?: unknown,
  after?: unknown,
  sampleId?: string,
): AuditEvent => {
  const user = currentFixtureUser();
  return {
    eventId: `audit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    actorUserId: user.userId,
    actorDisplayName: user.displayName,
    actorRole: user.roles[0],
    action,
    entityType,
    entityId,
    datasetId: dataset.id,
    sampleId,
    before,
    after,
    createdAt: new Date().toISOString(),
  };
};

const createLease = (sampleId: string): SampleLease => {
  const user = currentFixtureUser();
  return {
    leaseId: `lease-${sampleId}-${user.userId}-${Date.now()}`,
    datasetId: dataset.id,
    sampleId,
    taskId: `task-${sampleId}`,
    userId: user.userId,
    userDisplayName: user.displayName,
    status: 'active',
    acquiredAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    heartbeatAt: new Date().toISOString(),
  };
};

const filterAssets = (filters: AssetListFilters = {}) =>
  assets.filter((asset) => {
    const matchesJudge =
      !filters.judgeDecision || filters.judgeDecision === 'all' || asset.judgeDecision === filters.judgeDecision;
    const matchesStage1 =
      !filters.stage1Status || filters.stage1Status === 'all' || asset.stage1Status === filters.stage1Status;
    const matchesStage2 =
      !filters.stage2State ||
      filters.stage2State === 'all' ||
      (filters.stage2State === 'failed' ? asset.hasStage2Failure : !asset.hasStage2Failure);
    const matchesQc = !filters.qcStatus || filters.qcStatus === 'all' || asset.qcStatus === filters.qcStatus;
    const matchesCategory =
      !filters.violationCategory ||
      filters.violationCategory === 'all' ||
      asset.violationCategories.includes(filters.violationCategory);
    const matchesSampleCategory =
      !filters.sampleCategory ||
      filters.sampleCategory === 'all' ||
      asset.sampleCategories.includes(filters.sampleCategory);
    const matchesConfidenceMin =
      filters.confidenceMin === undefined ||
      (asset.highestConfidence !== undefined && asset.highestConfidence >= filters.confidenceMin);
    const matchesConfidenceMax =
      filters.confidenceMax === undefined ||
      (asset.highestConfidence !== undefined && asset.highestConfidence <= filters.confidenceMax);
    const matchesMedia =
      !filters.mediaStatus || filters.mediaStatus === 'all' || asset.mediaStatus === filters.mediaStatus;
    const matchesLabelEdit =
      !filters.labelEditStatus ||
      filters.labelEditStatus === 'all' ||
      asset.labelEditStatus === filters.labelEditStatus;
    const query = filters.search?.trim().toLowerCase();
    const matchesSearch = !query || asset.sampleId.toLowerCase().includes(query);

    return (
      matchesJudge &&
      matchesStage1 &&
      matchesStage2 &&
      matchesQc &&
      matchesCategory &&
      matchesSampleCategory &&
      matchesConfidenceMin &&
      matchesConfidenceMax &&
      matchesMedia &&
      matchesLabelEdit &&
      matchesSearch
    );
  });

const filterSamplePoolItems = (filters: SamplePoolListFilters = {}) =>
  samplePoolItems.filter((item) => {
    const matchesDatasetType = !filters.datasetType || item.datasetType === filters.datasetType;
    const matchesBatch = !filters.batchId || item.batchId === filters.batchId || item.datasetId === filters.batchId;
    const matchesCategory = !filters.category || item.category === filters.category;
    const matchesAttribution =
      !filters.attribution || item.attributionTags.some((tag) => tag.code === filters.attribution);
    const matchesEventType = !filters.eventType || item.eventTypes.includes(filters.eventType);
    const matchesReviewer =
      !filters.reviewer ||
      item.reviewerId === filters.reviewer ||
      item.confirmedBy === filters.reviewer ||
      item.reviewerDisplayName === filters.reviewer ||
      item.confirmedByDisplayName === filters.reviewer;
    const matchesStatus = !filters.status || filters.status === 'all' || item.status === filters.status;
    const query = filters.search?.trim().toLowerCase();
    const matchesSearch = !query || item.sampleId.toLowerCase().includes(query) || item.itemId.toLowerCase().includes(query);
    return (
      matchesDatasetType &&
      matchesBatch &&
      matchesCategory &&
      matchesAttribution &&
      matchesEventType &&
      matchesReviewer &&
      matchesStatus &&
      matchesSearch
    );
  });

const samplePoolFilterSummary = (filters: SamplePoolListFilters = {}) => {
  const parts = [
    filters.datasetType ? `类型：${filters.datasetType}` : '',
    filters.batchId ? `批次：${filters.batchId}` : '',
    filters.category ? `类别：${filters.category}` : '',
    filters.attribution ? `归因：${filters.attribution}` : '',
    filters.eventType ? `事件：${filters.eventType}` : '',
    filters.reviewer ? `人员：${filters.reviewer}` : '',
    filters.status ? `状态：${filters.status}` : '',
    filters.search ? `搜索：${filters.search}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join('，') : '全部匹配';
};

const exportFiltersForPayload = (payload: TrainingExportCreatePayload): SamplePoolListFilters =>
  payload.source === 'all_active_pool_items' ? { status: 'active' } : { ...(payload.filters ?? {}) };

const labelConfigValidation = (config: LabelConfig = fixtureLabelConfig): LabelConfigValidationResult => ({
  valid: true,
  datasetId: dataset.id,
  schemaVersion: config.schemaVersion,
  version: config.version,
  contentHash: config.contentHash,
  summary: {
    fieldCount: config.fields.length,
    closedEnumCount: config.fields.filter((field) => field.mode === 'closed_enum').length,
    openTagsCount: config.fields.filter((field) => field.mode === 'open_tags').length,
    optionCount: config.fields.reduce((total, field) => total + field.options.length, 0),
  },
  errors: [],
  warnings: [],
  normalizedConfig: config,
});

const labelConfigSaveResult = (
  activate = false,
  overrides: Partial<LabelConfigSaveResult> = {},
): LabelConfigSaveResult => ({
  configId: fixtureLabelConfig.configId ?? 'label-config-fixture-1',
  datasetId: dataset.id,
  schemaVersion: fixtureLabelConfig.schemaVersion,
  version: fixtureLabelConfig.version,
  status: activate ? 'active' : 'draft',
  contentHash: fixtureLabelConfig.contentHash,
  createdAt: new Date().toISOString(),
  activatedAt: activate ? new Date().toISOString() : undefined,
  validation: labelConfigValidation(),
  config: fixtureLabelConfig,
  ...overrides,
});

let labelConfigVersionCounter = 1;
const savedLabelConfigVersions: LabelConfigSaveResult[] = [labelConfigSaveResult(true)];

const labelConfigVersions = (): LabelConfigSaveResult[] => savedLabelConfigVersions;

const labelConfigVersionResult = (versionIndex: number, activate: boolean): LabelConfigSaveResult => {
  const now = new Date().toISOString();
  const configId = `label-config-fixture-${versionIndex}`;
  const version = `${fixtureLabelConfig.version}_manual_${versionIndex}`;
  const status = activate ? 'active' : 'saved';
  const config: LabelConfig = {
    ...fixtureLabelConfig,
    configId,
    version,
    status,
    createdAt: now,
    activatedAt: activate ? now : undefined,
  };
  return labelConfigSaveResult(activate, {
    configId,
    version,
    status,
    createdAt: now,
    activatedAt: activate ? now : undefined,
    validation: labelConfigValidation(config),
    config,
  });
};

const markSavedLabelConfigActive = (configId: string) => {
  savedLabelConfigVersions.forEach((version) => {
    if (version.configId === configId) {
      version.status = 'active';
      version.activatedAt = new Date().toISOString();
      version.config = version.config ? { ...version.config, status: 'active', activatedAt: version.activatedAt } : version.config;
      return;
    }
    if (version.status === 'active') {
      version.status = 'saved';
      version.config = version.config ? { ...version.config, status: 'saved', activatedAt: undefined } : version.config;
      version.activatedAt = undefined;
    }
  });
};

const suggestionsFor = (fieldName: string, query = ''): LabelSuggestion[] => {
  const normalizedQuery = query.trim().toLowerCase();
  const field = fixtureLabelConfig.fields.find((item) => item.field === fieldName);
  return (
    field?.options
      .filter((option) => {
        const haystack = [option.code, option.labelZh, option.labelEn, ...option.aliases].join(' ').toLowerCase();
        return !normalizedQuery || haystack.includes(normalizedQuery);
      })
      .map((option) => ({
        value: option.code,
        labelZh: option.labelZh,
        labelEn: option.labelEn,
        source: 'fixture',
      })) ?? []
  );
};

export const fixtureApiClient: UrbanViolationApi = {
  async login(payload: LoginPayload) {
    await delay();
    const account = fixtureUsers.find((user) => user.username === payload.username || user.userId === payload.username);
    if (account) {
      fixtureCurrentUserId = account.userId;
      try {
        window.localStorage.setItem('uvp.devUserId', account.userId);
      } catch {
        // noop in non-browser tests
      }
    }
    return clone(currentFixtureUser());
  },
  async logout() {
    await delay();
  },
  async getCurrentUser() {
    await delay();
    return clone(currentFixtureUser());
  },
  async listUsers() {
    await delay();
    return clone(fixtureUsers);
  },
  async listBatchAssignableUsers() {
    await delay();
    return clone(fixtureUsers.filter((user) => user.status === 'active'));
  },
  async createUser(payload: UserCreatePayload) {
    await delay();
    const user: UserAccount = {
      userId: payload.userId || payload.username,
      username: payload.username,
      displayName: payload.displayName,
      email: payload.email,
      status: payload.status ?? 'active',
      roles: [],
      createdAt: new Date().toISOString(),
    };
    fixtureUsers.push(user);
    return clone(user);
  },
  async updateUser(userId: string, payload: UserUpdatePayload) {
    await delay();
    const index = fixtureUsers.findIndex((user) => user.userId === userId);
    const next = {
      ...(fixtureUsers[index] ?? {
        userId,
        username: userId,
        displayName: userId,
        status: 'active' as const,
        roles: [],
      }),
      ...payload,
    };
    if (index >= 0) {
      fixtureUsers[index] = next;
    } else {
      fixtureUsers.push(next);
    }
    return clone(next);
  },
  async listRoleBindings() {
    await delay();
    return clone(roleBindings);
  },
  async createRoleBinding(payload: RoleBindingCreatePayload) {
    await delay();
    const binding: RoleBinding = {
      bindingId: `binding-${payload.userId}-${payload.role}-${Date.now()}`,
      ...payload,
      createdAt: new Date().toISOString(),
      createdBy: currentFixtureUser().userId,
    };
    roleBindings.push(binding);
    const user = fixtureUsers.find((item) => item.userId === payload.userId);
    if (user && !(user.roles ?? []).includes(payload.role)) {
      user.roles = [...(user.roles ?? []), payload.role];
    }
    return clone(binding);
  },
  async deleteRoleBinding(bindingId: string) {
    await delay();
    const index = roleBindings.findIndex((binding) => binding.bindingId === bindingId);
    if (index >= 0) {
      roleBindings.splice(index, 1);
    }
  },
  async getRbacCatalog() {
    await delay();
    return clone(rbacCatalog);
  },
  async listDatasets() {
    await delay();
    return clone([dataset]);
  },
  async listDatasetTypes() {
    await delay();
    return clone(datasetTypes);
  },
  async getDatasetType(datasetType) {
    await delay();
    const group = datasetTypes.find((item) => item.datasetType === datasetType);
    if (group) {
      return clone(group);
    }
    return clone({
      datasetType,
      displayName: datasetType,
      fieldSchemaVersion: 'draft',
      status: 'active',
      batchCount: 0,
      batches: [],
    });
  },
  async createDatasetType(payload: DatasetTypeCreatePayload) {
    await delay();
    if (!datasetTypes.some((item) => item.datasetType === payload.datasetType)) {
      datasetTypes.push({
        datasetType: payload.datasetType,
        displayName: payload.displayName,
        fieldSchemaVersion: payload.fieldSchemaVersion || 'draft',
        status: 'active',
        batchCount: 0,
        batches: [],
      });
    }
    return clone(datasetTypes.find((item) => item.datasetType === payload.datasetType)!);
  },
  async deleteDatasetBatch(batchId) {
    await delay();
    datasetTypes.forEach((group) => {
      const nextBatches = group.batches.filter((batch) => batch.id !== batchId);
      group.batches = nextBatches;
      group.batchCount = nextBatches.length;
    });
  },
  async getDatasetSummary() {
    await delay();
    return clone(datasetSummary);
  },
  async getDatasetBatchSummary(batchId) {
    return this.getDatasetSummary(batchId);
  },
  async getAssetSummary() {
    await delay();
    return clone(assetSummary);
  },
  async getDatasetBatchAssetSummary(batchId) {
    return this.getAssetSummary(batchId);
  },
  async listAssets(_datasetId, filters) {
    await delay();
    return clone(filterAssets(filters));
  },
  async listDatasetBatchAssets(batchId, filters) {
    return this.listAssets(batchId, filters);
  },
  async listImportJobs() {
    await delay();
    return clone([datasetSummary.latestImportJob!]);
  },
  async listDatasetBatchImportJobs(batchId) {
    return this.listImportJobs(batchId);
  },
  async createImportJob(_datasetId, payload) {
    await delay();
    const created: ImportJobDetail = {
      ...importJob,
      id: `import-${payload.batchKey ?? dataset.batchKey ?? 'draft'}`,
      datasetId: payload.batchKey && payload.datasetType ? `${payload.datasetType}__${payload.batchKey}` : importJob.datasetId,
      datasetType: payload.datasetType ?? importJob.datasetType,
      batchKey: payload.batchKey ?? importJob.batchKey,
      title: payload.batchName ?? 'New batch import',
      state: 'Draft',
      activeStep: 1,
      sourceMode: payload.sourceMode,
      sourceUri: payload.sourceUri,
      sourceStructure: payload.sourceStructure,
    };
    if (payload.batchKey && payload.datasetType) {
      const group = datasetTypes.find((item) => item.datasetType === payload.datasetType);
      const batch: Dataset = {
        ...dataset,
        id: created.datasetId,
        name: payload.batchName ?? payload.batchKey,
        datasetType: payload.datasetType,
        batchKey: payload.batchKey,
        batchName: payload.batchName ?? payload.batchKey,
        lifecycleStatus: 'registered',
        status: 'registered',
        activeImportJobId: created.id,
        qcQueueId: undefined,
        assetTotal: payload.imageCount ?? 0,
        stage1Total: payload.stage1FileCount ?? 0,
        stage2SuccessTotal: payload.stage2FileCount ?? 0,
        stage2FailureTotal: payload.stage2FailureFileCount ?? 0,
        sourceMode: payload.sourceMode,
        sourceUri: payload.sourceUri,
        sourceStructure: payload.sourceStructure,
        sourceFileCount: payload.sourceFileCount,
      };
      if (group && !group.batches.some((item) => item.id === batch.id)) {
        group.batches.push(batch);
        group.batchCount = group.batches.length;
      }
    }
    return clone(created);
  },
  async createImportJobArchive(datasetId, payload) {
    payload.onUploadProgress?.({
      loadedBytes: payload.archiveFile.size,
      totalBytes: payload.archiveFile.size,
      percent: 100,
    });
    return this.createImportJob(datasetId, {
      datasetType: payload.datasetType,
      batchKey: payload.batchKey,
      batchName: payload.batchName,
      sourceMode: 'uploaded_package',
      sourceUri: payload.archiveFileName ?? payload.archiveFile.name,
      sourceStructure: payload.sourceStructure,
      sourceFileCount: 1,
    });
  },
  async createDatasetBatchImportJob(batchId, payload) {
    return this.createImportJob(batchId, payload);
  },
  async getImportJob() {
    await delay();
    return clone(importJob);
  },
  async getDatasetBatchImportJob(batchId, jobId) {
    return this.getImportJob(batchId, jobId);
  },
  async scanImportJob() {
    await delay();
    return clone({ ...importJob, state: 'Validating', activeStep: 3 });
  },
  async validateImportJob() {
    await delay();
    return clone({ ...importJob, state: 'PreviewReady', activeStep: 4 });
  },
  async confirmImportJob() {
    await delay();
    return clone({ ...importJob, state: 'QCQueueGenerated', activeStep: 6 });
  },
  async retryImportJob() {
    await delay();
    return clone({ ...importJob, state: 'Scanning', activeStep: 3 });
  },
  async getPreannotationSummary() {
    await delay();
    return clone(preannotationSummary);
  },
  async getDatasetBatchPreannotationSummary(batchId) {
    return this.getPreannotationSummary(batchId);
  },
  async listQcQueue() {
    await delay();
    return clone(qcQueueItems());
  },
  async listDatasetBatchQcQueue(batchId) {
    return this.listQcQueue(batchId);
  },
  async getQcWorkspace() {
    await delay();
    const tasks = assets.map((asset) => taskForAsset(asset));
    const workspace: QcWorkspace = {
      datasetId: dataset.id,
      assignment: batchAssignment,
      queue: qcQueueItems(),
      tasks,
      leases: Array.from(leases.values()),
      progress: progressFromTasks(tasks),
    };
    return clone(workspace);
  },
  async getDatasetBatchQcWorkspace(batchId) {
    return this.getQcWorkspace(batchId);
  },
  async generateQcQueue() {
    await delay();
    const tasks = assets.map((asset) => taskForAsset(asset));
    const workspace: QcWorkspace = {
      datasetId: dataset.id,
      assignment: batchAssignment,
      queue: qcQueueItems(),
      tasks,
      leases: Array.from(leases.values()),
      progress: progressFromTasks(tasks),
    };
    return clone(workspace);
  },
  async getQcProgress() {
    await delay();
    return clone(progressFromTasks(assets.map((asset) => taskForAsset(asset))));
  },
  async getDatasetBatchQcProgress(batchId) {
    return this.getQcProgress(batchId);
  },
  async getQcModificationEventStats() {
    await delay();
    return clone(qcModificationEventStats);
  },
  async getDatasetBatchQcModificationEventStats(batchId) {
    return this.getQcModificationEventStats(batchId);
  },
  async listQcModificationEvents() {
    await delay();
    return clone(qcModificationEvents);
  },
  async listDatasetBatchQcModificationEvents(batchId) {
    return this.listQcModificationEvents(batchId);
  },
  async listSamplePoolItems(filters) {
    await delay();
    return clone(filterSamplePoolItems(filters));
  },
  async getSamplePoolStats() {
    await delay();
    return clone(samplePoolStats);
  },
  async getSamplePoolItem(itemId) {
    await delay();
    const item = samplePoolItems.find((entry) => entry.itemId === itemId) ?? samplePoolItems[0];
    const detail: SamplePoolItemDetail = {
      ...item,
      beforeSnapshotId: `baseline-${item.sampleId}`,
      changedFields: ['bbox', 'violation_category'].slice(0, item.changedFieldCount),
      events: qcModificationEvents.filter((event) => item.sourceEventIds?.includes(event.eventId)),
      notes: '确认后自动入池',
    };
    return clone(detail);
  },
  async createTrainingExport(payload) {
    await delay();
    const filters = exportFiltersForPayload(payload);
    const exportId = `export-coco-${Date.now()}`;
    const job: TrainingExportJob = {
      exportId,
      format: payload.format,
      source: payload.source,
      filters,
      filterSummary: payload.source === 'all_active_pool_items' ? '全部活跃样本' : samplePoolFilterSummary(filters),
      sampleCount: filterSamplePoolItems(filters).length,
      status: 'completed',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      downloadUrl: exportDownloadUrl(exportId),
    };
    trainingExportJobs = [job, ...trainingExportJobs];
    return clone(job);
  },
  async listTrainingExports() {
    await delay();
    return clone(trainingExportJobs);
  },
  async getTrainingExport(exportId) {
    await delay();
    return clone(trainingExportJobs.find((job) => job.exportId === exportId) ?? trainingExportJobs[0]);
  },
  async downloadTrainingExport(exportId): Promise<TrainingExportDownload> {
    await delay();
    return clone({
      exportId,
      url: exportDownloadUrl(exportId),
      fileName: `${exportId}.json`,
    });
  },
  getTrainingExportDownloadUrl(exportId) {
    return exportDownloadUrl(exportId);
  },
  async cancelTrainingExport(exportId) {
    await delay();
    const index = trainingExportJobs.findIndex((job) => job.exportId === exportId);
    const next: TrainingExportJob = {
      ...(trainingExportJobs[index] ?? {
        exportId,
        format: 'coco_json',
        source: 'current_filters',
        filters: {},
        createdAt: new Date().toISOString(),
      }),
      status: 'cancelled',
      completedAt: new Date().toISOString(),
    };
    if (index >= 0) {
      trainingExportJobs[index] = next;
    } else {
      trainingExportJobs = [next, ...trainingExportJobs];
    }
    return clone(next);
  },
  async createModelEvaluation(_datasetId, payload: ModelEvaluationCreatePayload) {
    await delay();
    const evaluation: ModelEvaluationRun = {
      evaluationId: `eval-${Date.now()}`,
      datasetId: dataset.id,
      modelName: payload.modelName,
      modelVersion: payload.modelVersion,
      status: 'completed',
      sampleCount: samplePoolItems.length,
      sourceExportId: payload.sourceExportId,
      sourceSnapshotId: payload.sourceSnapshotId,
      metrics: [
        { key: 'mAP50', label: 'mAP50', value: 0.84 },
        { key: 'precision', label: '精确率', value: 0.89 },
        { key: 'recall', label: '召回率', value: 0.8 },
      ],
      metricDeltas: [{ key: 'mAP50', label: 'mAP50', value: 0.84, baselineValue: 0.82, delta: 0.02 }],
      categoryMetrics: [],
      changedSampleCount: modelEvaluationDeltaSamples.length,
      createdBy: currentFixtureUser().userId,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      notes: payload.notes,
    };
    modelEvaluations = [evaluation, ...modelEvaluations];
    return clone(evaluation);
  },
  async createDatasetBatchEvaluation(batchId, payload) {
    return this.createModelEvaluation(batchId, payload);
  },
  async listModelEvaluations() {
    await delay();
    return clone(modelEvaluations);
  },
  async listDatasetBatchEvaluations(batchId) {
    return this.listModelEvaluations(batchId);
  },
  async getModelEvaluation(_datasetId, evaluationId) {
    await delay();
    return clone(modelEvaluations.find((item) => item.evaluationId === evaluationId) ?? modelEvaluations[0]);
  },
  async getDatasetBatchEvaluation(batchId, evaluationId) {
    return this.getModelEvaluation(batchId, evaluationId);
  },
  async compareModelEvaluations(leftId, rightId) {
    await delay();
    const left = modelEvaluations.find((item) => item.evaluationId === leftId) ?? modelEvaluations[1];
    const right = modelEvaluations.find((item) => item.evaluationId === rightId) ?? modelEvaluations[0];
    const result: ModelEvaluationCompareResult = {
      leftEvaluationId: left.evaluationId,
      rightEvaluationId: right.evaluationId,
      leftModelVersion: left.modelVersion,
      rightModelVersion: right.modelVersion,
      metricDeltas: right.metricDeltas.length ? right.metricDeltas : right.metrics,
      categoryDeltas: right.categoryMetrics,
      changedSampleCount: modelEvaluationDeltaSamples.length,
      improvedCount: 18,
      regressedCount: 6,
      summary: '新版本在召回和边界框指标上整体提升',
    };
    return clone(result);
  },
  async listModelEvaluationDeltaSamples() {
    await delay();
    return clone(modelEvaluationDeltaSamples);
  },
  async listSnapshots() {
    await delay();
    return clone(annotationSnapshots);
  },
  async listDatasetBatchSnapshots(batchId) {
    return this.listSnapshots(batchId);
  },
  async diffSnapshots(_datasetId, leftSnapshotId, rightSnapshotId) {
    await delay();
    return clone({
      ...snapshotDiff,
      leftSnapshotId,
      rightSnapshotId,
    });
  },
  async diffDatasetBatchSnapshots(batchId, leftSnapshotId, rightSnapshotId) {
    return this.diffSnapshots(batchId, leftSnapshotId, rightSnapshotId);
  },
  async getBatchAssignment() {
    await delay();
    return clone(batchAssignment);
  },
  async assignBatch(_datasetId, payload: BatchAssignmentPayload) {
    await delay();
    batchAssignment = assignmentFor(payload.assigneeUserId, 'assigned');
    auditEvents.unshift(audit('batch_assignment.assign', 'batch_assignment', batchAssignment.assignmentId, undefined, batchAssignment));
    return clone(batchAssignment);
  },
  async reassignBatch(_datasetId, payload: BatchAssignmentPayload) {
    await delay();
    const previous = clone(batchAssignment);
    leases.clear();
    batchAssignment = assignmentFor(payload.assigneeUserId, 'assigned');
    auditEvents.unshift(audit('batch_assignment.reassign', 'batch_assignment', batchAssignment.assignmentId, previous, batchAssignment));
    return clone(batchAssignment);
  },
  async releaseBatchAssignment() {
    await delay();
    const previous = clone(batchAssignment);
    leases.clear();
    batchAssignment = {
      ...batchAssignment,
      status: 'revoked',
      updatedAt: new Date().toISOString(),
    };
    auditEvents.unshift(audit('batch_assignment.release', 'batch_assignment', batchAssignment.assignmentId, previous, batchAssignment));
    return clone(batchAssignment);
  },
  async listQcTasks() {
    await delay();
    return clone(assets.map((asset) => taskForAsset(asset)));
  },
  async getReviewSample(_datasetId, sampleId) {
    await delay();
    const detail = reviewDetails[sampleId] ?? reviewDetails['000142_0_1762483003246'];
    const cloned = clone(detail);
    const task = taskForAsset(cloned.asset);
    const lease = leases.get(cloned.asset.sampleId);
    const currentUser = currentFixtureUser();
    cloned.humanReview = reviews.get(cloned.asset.sampleId);
    cloned.labelEditHistory = clone(labelEdits.get(cloned.asset.sampleId) ?? []);
    cloned.labelEditState = cloned.labelEditHistory.at(-1);
    cloned.currentUser = currentUser;
    cloned.batchAssignment = clone(batchAssignment);
    cloned.qcTask = clone(task);
    cloned.sampleLease = lease ? clone(lease) : undefined;
    cloned.myDraft = cloned.labelEditState && cloned.labelEditState.userId === currentUser.userId
      ? {
          draftId: cloned.labelEditState.editId,
          datasetId: cloned.labelEditState.datasetId,
          sampleId: cloned.labelEditState.sampleId,
          userId: currentUser.userId,
          operations: cloned.labelEditState.operations,
          labelConfigId: cloned.labelEditState.labelConfigId,
          labelConfigVersion: cloned.labelEditState.labelConfigVersion,
          leaseId: cloned.labelEditState.leaseId,
          taskRevision: cloned.labelEditState.taskRevision,
          updatedAt: cloned.labelEditState.updatedAt,
        }
      : undefined;
    cloned.latestSubmission = clone(submissions.get(cloned.asset.sampleId)?.at(-1) ?? submissionForTask(task));
    return cloned;
  },
  async acquireSampleLease(_datasetId, sampleId) {
    await delay();
    const lease = createLease(sampleId);
    leases.set(sampleId, lease);
    auditEvents.unshift(audit('sample_lease.acquire', 'sample_lease', lease.leaseId, undefined, lease, sampleId));
    return clone(lease);
  },
  async heartbeatSampleLease(_datasetId, sampleId, leaseId) {
    await delay();
    const lease = leases.get(sampleId);
    if (lease?.leaseId === leaseId) {
      lease.heartbeatAt = new Date().toISOString();
      lease.expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      return clone(lease);
    }
    const nextLease = createLease(sampleId);
    leases.set(sampleId, nextLease);
    return clone(nextLease);
  },
  async releaseSampleLease(_datasetId, sampleId, leaseId) {
    await delay();
    const lease = leases.get(sampleId);
    if (lease?.leaseId === leaseId) {
      lease.status = 'released';
      leases.delete(sampleId);
      auditEvents.unshift(audit('sample_lease.release', 'sample_lease', lease.leaseId, lease, { ...lease, status: 'released' }, sampleId));
      return clone(lease);
    }
    return undefined;
  },
  async submitReviewDecision(_datasetId, sampleId, payload: SubmitReviewPayload) {
    await delay();
    const review: HumanReview = {
      id: `review-${sampleId}`,
      sampleId,
      decision: payload.decision,
      reviewer: 'frontend-agent',
      reasoning: payload.notes,
      updatedAt: new Date().toISOString(),
    };
    reviews.set(sampleId, review);
    return clone(review);
  },
  async validateLabelEdit(_datasetId, sampleId, payload) {
    await delay();
    const errors = validateFixtureLabelEdit(payload);
    return {
      valid: errors.length === 0,
      datasetId: dataset.id,
      sampleId,
      checkedOperationCount: payload.operations.length,
      errors,
      warnings: [],
      checkedAt: new Date().toISOString(),
    };
  },
  async getMyLabelEditDraft(_datasetId, sampleId) {
    await delay();
    const user = currentFixtureUser();
    const userHistory = (labelEdits.get(sampleId) ?? []).filter((item) => item.userId === user.userId);
    const state = userHistory[userHistory.length - 1];
    if (!state) {
      return undefined;
    }
    const draft: LabelEditDraft = {
      draftId: state.editId,
      datasetId: state.datasetId,
      sampleId,
      userId: user.userId,
      operations: clone(state.operations),
      labelConfigId: state.labelConfigId,
      labelConfigVersion: state.labelConfigVersion,
      leaseId: state.leaseId,
      taskRevision: state.taskRevision,
      updatedAt: state.updatedAt,
    };
    return clone(draft);
  },
  async getLabelEditHistory(_datasetId, sampleId) {
    await delay();
    return clone(submissions.get(sampleId) ?? []);
  },
  async submitLabelEdit(_datasetId, sampleId, payload: LabelEditSubmitPayload) {
    await delay();
    const history = labelEdits.get(sampleId) ?? [];
    const user = currentFixtureUser();
    const taskRevision = Number(payload.baseRevision);
    const state: LabelEditState = {
      editId: `label-edit-${history.length + 1}`,
      datasetId: dataset.id,
      sampleId,
      userId: user.userId,
      taskMode: payload.taskMode,
      submitAction: payload.submitAction,
      taskStatus: payload.taskStatus,
      labelConfigId: payload.labelConfigId,
      labelConfigVersion: payload.labelConfigVersion,
      leaseId: payload.leaseId,
      taskRevision: Number.isFinite(taskRevision) ? taskRevision : undefined,
      operations: clone(payload.operations),
      updatedAt: new Date().toISOString(),
    };
    labelEdits.set(sampleId, [...history, state]);
    if (payload.submitAction === 'submit_changes') {
      const submission: LabelEditSubmission = {
        submissionId: `submission-${sampleId}-${Date.now()}`,
        datasetId: dataset.id,
        sampleId,
        userId: user.userId,
        userDisplayName: user.displayName,
        status: 'submitted',
        operations: clone(payload.operations),
        labelConfigId: payload.labelConfigId,
        labelConfigVersion: payload.labelConfigVersion,
        taskRevision: Number.isFinite(taskRevision) ? taskRevision : undefined,
        submittedAt: state.updatedAt,
        validation: {
          valid: true,
          datasetId: dataset.id,
          sampleId,
          checkedOperationCount: payload.operations.length,
          errors: [],
          warnings: [],
          checkedAt: state.updatedAt,
        },
      };
      submissions.set(sampleId, [...(submissions.get(sampleId) ?? []), submission]);
      taskStatusBySample[sampleId] = 'submitted';
      leases.delete(sampleId);
      auditEvents.unshift(audit('label_edit.submit', 'label_edit_submission', submission.submissionId, undefined, submission, sampleId));
    } else {
      taskStatusBySample[sampleId] = 'draft_saved';
      auditEvents.unshift(audit('label_edit.save_draft', 'label_edit_draft', state.editId, undefined, state, sampleId));
    }
    return {
      saved: true,
      sampleId,
      submitAction: payload.submitAction,
      taskStatus: payload.taskStatus,
      editId: state.editId,
      operationCount: payload.operations.length,
      updatedAt: state.updatedAt,
      state: clone(state),
      validation: {
        valid: true,
        datasetId: dataset.id,
        sampleId,
        checkedOperationCount: payload.operations.length,
        errors: [],
        warnings: [],
        checkedAt: new Date().toISOString(),
      },
    };
  },
  async getMyBatchLabelEditDraft() {
    await delay();
    return clone(batchDraftForCurrentUser());
  },
  async saveMyBatchLabelEditDraft(_datasetId, payload: BatchLabelEditDraftPayload) {
    await delay();
    return clone(saveBatchDraftSamples(payload));
  },
  async autosaveMyBatchLabelEditDraft(_datasetId, payload: BatchLabelEditDraftPayload) {
    await delay();
    const result = saveBatchDraftSamples(payload);
    return clone({
      ...result,
      draft: result.draft
        ? {
            ...result.draft,
            autosavedAt: result.updatedAt,
          }
        : undefined,
    });
  },
  async submitBatchLabelEdits(_datasetId, payload: BatchLabelEditSubmitPayload): Promise<BatchLabelEditSubmitResult> {
    await delay();
    const now = new Date().toISOString();
    const submittedSampleIds = Array.from(batchDraftSamples.keys()).filter(
      (sampleId) =>
        !payload.unsavedDirtySampleIds.includes(sampleId) &&
        !payload.validationErrorSampleIds.includes(sampleId),
    );
    const releasedLeaseCount = submittedSampleIds.filter((sampleId) => leases.has(sampleId)).length;
    batchAssignment = {
      ...batchAssignment,
      status: 'submitted',
      submittedAt: now,
      updatedAt: now,
    };
    submittedSampleIds.forEach((sampleId) => {
      taskStatusBySample[sampleId] = 'submitted';
      leases.delete(sampleId);
    });
    return clone({
      submitted: true,
      datasetId: dataset.id,
      assignmentId: batchAssignment.assignmentId,
      assigneeUserId: batchAssignment.assigneeUserId,
      status: batchAssignment.status,
      submittedAt: now,
      submittedSampleCount: submittedSampleIds.length,
      releasedLeaseCount,
      assignment: batchAssignment,
    });
  },
  async confirmLabelEditSubmission(_datasetId, sampleId, submissionId) {
    await delay();
    const history = submissions.get(sampleId) ?? [];
    const task = taskForAsset(assets.find((asset) => asset.sampleId === sampleId) ?? assets[0]);
    const submission = history.find((item) => item.submissionId === submissionId) ?? submissionForTask(task) ?? {
      submissionId,
      datasetId: dataset.id,
      sampleId,
      userId: task.assigneeUserId ?? 'annotator_a',
      userDisplayName: task.assigneeDisplayName,
      status: 'submitted' as const,
      operations: [],
      submittedAt: new Date().toISOString(),
    };
    const next: LabelEditSubmission = {
      ...(submission as LabelEditSubmission),
      status: 'confirmed',
      confirmedBy: currentFixtureUser().userId,
      confirmedAt: new Date().toISOString(),
    };
    submissions.set(sampleId, [...history.filter((item) => item.submissionId !== submissionId), next]);
    taskStatusBySample[sampleId] = 'confirmed';
    auditEvents.unshift(audit('label_edit.confirm', 'label_edit_submission', next.submissionId, submission, next, sampleId));
    return clone(next);
  },
  async returnLabelEditSubmission(_datasetId, sampleId, submissionId, reason = '') {
    await delay();
    const history = submissions.get(sampleId) ?? [];
    const task = taskForAsset(assets.find((asset) => asset.sampleId === sampleId) ?? assets[0]);
    const submission = history.find((item) => item.submissionId === submissionId) ?? submissionForTask(task) ?? {
      submissionId,
      datasetId: dataset.id,
      sampleId,
      userId: task.assigneeUserId ?? 'annotator_a',
      userDisplayName: task.assigneeDisplayName,
      status: 'submitted' as const,
      operations: [],
      submittedAt: new Date().toISOString(),
    };
    const next: LabelEditSubmission = {
      ...(submission as LabelEditSubmission),
      status: 'returned',
      returnedAt: new Date().toISOString(),
      returnReason: reason,
    };
    submissions.set(sampleId, [...history.filter((item) => item.submissionId !== submissionId), next]);
    taskStatusBySample[sampleId] = 'returned';
    auditEvents.unshift(audit('label_edit.returned', 'label_edit_submission', next.submissionId, submission, next, sampleId));
    return clone(next);
  },
  async listAuditEvents(filters: AuditEventFilters = {}) {
    await delay();
    return clone(
      auditEvents.filter(
        (event) =>
          (!filters.datasetId || event.datasetId === filters.datasetId) &&
          (!filters.sampleId || event.sampleId === filters.sampleId) &&
          (!filters.actorUserId || event.actorUserId === filters.actorUserId) &&
          (!filters.action || event.action.includes(filters.action)),
      ),
    );
  },
  async validateLabelConfig() {
    await delay();
    return clone(labelConfigValidation());
  },
  async validateDatasetTypeLabelConfig(datasetTypeId, payload) {
    return this.validateLabelConfig(datasetTypeId, payload);
  },
  async saveLabelConfig(_datasetId, payload) {
    await delay();
    if (payload.saveAsNewVersion) {
      labelConfigVersionCounter += 1;
      const result = labelConfigVersionResult(labelConfigVersionCounter, Boolean(payload.activate));
      if (payload.activate) {
        markSavedLabelConfigActive(result.configId);
      }
      savedLabelConfigVersions.unshift(result);
      return clone(result);
    }
    const result = savedLabelConfigVersions[0] ?? labelConfigSaveResult(Boolean(payload.activate));
    if (payload.activate) {
      markSavedLabelConfigActive(result.configId);
      return clone(savedLabelConfigVersions.find((version) => version.configId === result.configId) ?? result);
    }
    return clone(result);
  },
  async saveDatasetTypeLabelConfig(datasetTypeId, payload) {
    return this.saveLabelConfig(datasetTypeId, payload);
  },
  async listLabelConfigs() {
    await delay();
    return clone(labelConfigVersions());
  },
  async listDatasetTypeLabelConfigs(datasetTypeId) {
    return this.listLabelConfigs(datasetTypeId);
  },
  async activateLabelConfig() {
    await delay();
    const result = savedLabelConfigVersions[0] ?? labelConfigSaveResult(true);
    markSavedLabelConfigActive(result.configId);
    return clone(savedLabelConfigVersions.find((version) => version.configId === result.configId) ?? result);
  },
  async activateDatasetTypeLabelConfig(datasetTypeId, configId) {
    return this.activateLabelConfig(datasetTypeId, configId);
  },
  async reloadActiveLabelConfig() {
    await delay();
    return clone(savedLabelConfigVersions.find((version) => version.status === 'active') ?? labelConfigSaveResult(true));
  },
  async reloadActiveDatasetTypeLabelConfig(datasetTypeId) {
    return this.reloadActiveLabelConfig(datasetTypeId);
  },
  async getActiveLabelConfig() {
    await delay();
    return clone(fixtureLabelConfig);
  },
  async getActiveDatasetTypeLabelConfig(datasetTypeId) {
    return this.getActiveLabelConfig(datasetTypeId);
  },
  async getLabelSuggestions(_datasetId, field, query) {
    await delay();
    return clone(suggestionsFor(field, query));
  },
};

function validateFixtureLabelEdit(payload: { operations: Array<{ scope?: string; field: string; after?: unknown }> }) {
  const errors: Array<{ operationIndex: number; scope: string; field: string; code: string; message: string }> = [];
  payload.operations.forEach((operation, index) => {
    if (
      (operation.field === 'confidence' || operation.field === 'verification_confidence') &&
      (typeof operation.after !== 'number' || operation.after < 0 || operation.after > 1)
    ) {
      errors.push({
        operationIndex: index,
        scope: operation.scope ?? '',
        field: operation.field,
        code: 'range',
        message: `${operation.field} must be between 0 and 1.`,
      });
    }
    if (operation.field === 'bbox' && !isValidFixtureBbox(operation.after)) {
      errors.push({
        operationIndex: index,
        scope: operation.scope ?? '',
        field: operation.field,
        code: 'bbox',
        message: 'bbox must be 0-1000 coordinates with x1 < x2 and y1 < y2.',
      });
    }
  });
  return errors;
}

function isValidFixtureBbox(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((item) => typeof item === 'number' && item >= 0 && item <= 1000) &&
    value[0] < value[2] &&
    value[1] < value[3]
  );
}

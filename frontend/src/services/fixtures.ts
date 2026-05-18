import type { SubmitReviewPayload, UrbanViolationApi } from './urbanViolationApi';
import type {
  AssetListFilters,
  AssetListItem,
  Dataset,
  DatasetSummary,
  HumanReview,
  ImportJobDetail,
  LabelConfig,
  LabelEditState,
  LabelEditSubmitPayload,
  LabelConfigSaveResult,
  LabelConfigValidationResult,
  LabelSuggestion,
  PreannotationSummary,
  QcQueueItem,
  ReviewSampleDetail,
} from '../shared/types/contract';

const dataset: Dataset = {
  id: 'ds_urban_violation_001',
  name: 'urban_violation',
  version: 'v1.0',
  status: 'active',
  description: 'Urban traffic violation dataset with stage1 and stage2 pre-annotation outputs.',
  createdAt: '2025-05-08T10:21:33+08:00',
  updatedAt: '2025-05-08T15:45:12+08:00',
  tags: ['traffic_violation', 'hangzhou', 'workday'],
  owner: 'data-admin',
};

const mediaUrl = (sampleId: string, variant?: 'thumb') =>
  `/api/datasets/${dataset.id}/assets/${encodeURIComponent(sampleId)}/image${variant ? `?variant=${variant}` : ''}`;

const assets: AssetListItem[] = [
  {
    id: 'asset-000142',
    datasetId: dataset.id,
    sampleId: '000142_0_1762483003246',
    imageUrl: mediaUrl('000142_0_1762483003246'),
    thumbnailUrl: mediaUrl('000142_0_1762483003246', 'thumb'),
    width: 1280,
    height: 720,
    sourcePath: 'images/000142_0_1762483003246.jpg',
    importedAt: '2025-05-08T11:54:21+08:00',
    stage1Status: 'ready',
    stage2Status: 'passed',
    judgeDecision: 'pass',
    qcStatus: 'qc_pending',
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
    sampleId: '001710_0_1763108687181',
    imageUrl: mediaUrl('001710_0_1763108687181'),
    thumbnailUrl: mediaUrl('001710_0_1763108687181', 'thumb'),
    width: 1280,
    height: 720,
    sourcePath: 'images/001710_0_1763108687181.jpg',
    importedAt: '2025-05-08T11:54:20+08:00',
    stage1Status: 'ready',
    stage2Status: 'failed',
    judgeDecision: 'soft_fail',
    qcStatus: 'needs_review',
    hasStage2Failure: true,
    violationCategories: ['stage2_failure'],
    sampleCategories: ['hard boundary samples'],
    candidateCount: 0,
    updatedAt: '2025-05-08T11:54:20+08:00',
  },
  {
    id: 'asset-000233',
    datasetId: dataset.id,
    sampleId: '000233_0_1762483885120',
    imageUrl: mediaUrl('000233_0_1762483885120'),
    thumbnailUrl: mediaUrl('000233_0_1762483885120', 'thumb'),
    width: 1280,
    height: 720,
    sourcePath: 'images/000233_0_1762483885120.jpg',
    importedAt: '2025-05-08T11:53:58+08:00',
    stage1Status: 'ready',
    stage2Status: 'passed',
    judgeDecision: 'pass',
    qcStatus: 'passed',
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
    sampleId: '000376_0_1762484770192',
    imageUrl: mediaUrl('000376_0_1762484770192'),
    thumbnailUrl: mediaUrl('000376_0_1762484770192', 'thumb'),
    width: 1280,
    height: 720,
    sourcePath: 'images/000376_0_1762484770192.jpg',
    importedAt: '2025-05-08T11:53:36+08:00',
    stage1Status: 'ready',
    stage2Status: 'ready',
    judgeDecision: 'soft_fail',
    qcStatus: 'needs_review',
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
    sampleId: '000511_0_1762485111234',
    imageUrl: mediaUrl('000511_0_1762485111234'),
    thumbnailUrl: mediaUrl('000511_0_1762485111234', 'thumb'),
    width: 1280,
    height: 720,
    sourcePath: 'images/000511_0_1762485111234.jpg',
    importedAt: '2025-05-08T11:52:48+08:00',
    stage1Status: 'ready',
    stage2Status: 'ready',
    judgeDecision: 'soft_fail',
    qcStatus: 'manual_label_required',
    hasStage2Failure: false,
    violationCategories: ['motor_vehicle_illegal_parking'],
    sampleCategories: ['hard boundary samples'],
    candidateCount: 1,
    highestConfidence: 0.5377,
    updatedAt: '2025-05-08T11:52:48+08:00',
  },
];

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
  state: 'PreviewReady',
  activeStep: 3,
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

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const delay = async () => new Promise((resolve) => window.setTimeout(resolve, 80));

const filterAssets = (filters: AssetListFilters = {}) =>
  assets.filter((asset) => {
    const matchesJudge =
      !filters.judgeDecision || filters.judgeDecision === 'all' || asset.judgeDecision === filters.judgeDecision;
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
    const query = filters.search?.trim().toLowerCase();
    const matchesSearch = !query || asset.sampleId.toLowerCase().includes(query);

    return (
      matchesJudge &&
      matchesStage2 &&
      matchesQc &&
      matchesCategory &&
      matchesSampleCategory &&
      matchesSearch
    );
  });

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

const labelConfigSaveResult = (activate = false): LabelConfigSaveResult => ({
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
});

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
  async listDatasets() {
    await delay();
    return clone([dataset]);
  },
  async getDatasetSummary() {
    await delay();
    return clone(datasetSummary);
  },
  async listAssets(_datasetId, filters) {
    await delay();
    return clone(filterAssets(filters));
  },
  async getImportJob() {
    await delay();
    return clone(importJob);
  },
  async getPreannotationSummary() {
    await delay();
    return clone(preannotationSummary);
  },
  async listQcQueue() {
    await delay();
    return clone(
      assets.map<QcQueueItem>((asset) => ({
        sampleId: asset.sampleId,
        assetId: asset.id,
        status: asset.qcStatus,
        judgeDecision: asset.judgeDecision,
        highestConfidence: asset.highestConfidence,
        primaryCategory: asset.violationCategories[0],
        stage2Failure: asset.hasStage2Failure,
        updatedAt: asset.updatedAt,
      })),
    );
  },
  async getReviewSample(_datasetId, sampleId) {
    await delay();
    const detail = reviewDetails[sampleId] ?? reviewDetails['000142_0_1762483003246'];
    const cloned = clone(detail);
    cloned.humanReview = reviews.get(cloned.asset.sampleId);
    cloned.labelEditHistory = clone(labelEdits.get(cloned.asset.sampleId) ?? []);
    cloned.labelEditState = cloned.labelEditHistory.at(-1);
    return cloned;
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
  async submitLabelEdit(_datasetId, sampleId, payload: LabelEditSubmitPayload) {
    await delay();
    const history = labelEdits.get(sampleId) ?? [];
    const state: LabelEditState = {
      editId: `label-edit-${history.length + 1}`,
      datasetId: dataset.id,
      sampleId,
      taskMode: payload.taskMode,
      submitAction: payload.submitAction,
      taskStatus: payload.taskStatus,
      labelConfigId: payload.labelConfigId,
      labelConfigVersion: payload.labelConfigVersion,
      operations: clone(payload.operations),
      updatedAt: new Date().toISOString(),
    };
    labelEdits.set(sampleId, [...history, state]);
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
  async validateLabelConfig() {
    await delay();
    return clone(labelConfigValidation());
  },
  async saveLabelConfig(_datasetId, payload) {
    await delay();
    return clone(labelConfigSaveResult(Boolean(payload.activate)));
  },
  async activateLabelConfig() {
    await delay();
    return clone(labelConfigSaveResult(true));
  },
  async getActiveLabelConfig() {
    await delay();
    return clone(fixtureLabelConfig);
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

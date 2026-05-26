export type DatasetId = string;
export type DatasetTypeId = string;
export type DatasetBatchId = DatasetId;
export type AssetId = string;
export type SampleId = string;
export type ImportJobId = string;

export type DatasetLifecycleStatus =
  | 'draft'
  | 'registered'
  | 'scanning'
  | 'validation_failed'
  | 'validated'
  | 'importing'
  | 'import_failed'
  | 'imported'
  | 'preannotation_pending'
  | 'preannotating'
  | 'preannotation_failed'
  | 'preannotation_ready'
  | 'label_config_required'
  | 'qc_ready'
  | 'qc_in_progress'
  | 'qc_completed'
  | 'export_ready'
  | 'active'
  | 'archived';
export type ImportJobState =
  | 'Draft'
  | 'Uploading'
  | 'Uploaded'
  | 'Scanning'
  | 'Validating'
  | 'ValidationPassed'
  | 'PreviewReady'
  | 'Importing'
  | 'Imported'
  | 'QCQueueGenerated'
  | 'ValidationFailed'
  | 'ImportFailed';

export type JudgeDecision = 'pass' | 'soft_fail' | 'fail' | 'unknown';
export type QcStatus = 'qc_pending' | 'needs_review' | 'passed' | 'rejected' | 'manual_label_required';
export type StageStatus = 'missing' | 'ready' | 'passed' | 'failed';
export type VisibilityLevel =
  | 'clear'
  | 'partial'
  | 'tiny'
  | 'blurry'
  | 'occluded'
  | 'fully_visible'
  | 'mostly_visible'
  | 'partially_visible'
  | 'barely_visible'
  | 'unknown';
export type VerificationResult = 'supported' | 'weakly_supported' | 'unsupported' | 'unclear';
export type ReviewDecision = 'approved' | 'needs_changes' | 'rejected';
export type LabelConfigMode = 'closed_enum' | 'open_tags' | string;
export type LabelConfigStatus = 'draft' | 'active' | 'archived' | 'rejected' | string;
export type AssetMediaStatus = 'valid' | 'missing' | 'load_failed' | 'resolution_abnormal' | 'unknown';
export type AssetLabelEditStatus = 'none' | 'draft' | 'submitted' | 'changed' | 'unknown';
export type ImportSourceMode = 'local_directory' | 'uploaded_package' | 'object_storage_prefix' | 'manifest_only';
export type ImportSourceStructure = 'images_only' | 'images_with_preannotations';

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type AuthMode = 'session' | 'dev_header' | 'anonymous' | string;
export type UserRole =
  | 'platform_admin'
  | 'dataset_admin'
  | 'batch_manager'
  | 'annotator'
  | 'qc_lead'
  | 'auditor';
export type RoleScopeType = 'platform' | 'dataset_type' | 'dataset_batch';
export type UserStatus = 'active' | 'disabled';
export type BatchAssignmentStatus = 'assigned' | 'in_progress' | 'submitted' | 'confirmed' | 'returned' | 'revoked';
export type QcTaskStatus =
  | 'queued'
  | 'assigned'
  | 'in_progress'
  | 'draft_saved'
  | 'skipped'
  | 'submitted'
  | 'confirmed'
  | 'returned'
  | 'completed';
export type LeaseStatus = 'active' | 'released' | 'expired' | 'revoked';

export interface UserAccount {
  userId: string;
  username?: string;
  displayName: string;
  email?: string;
  status: UserStatus;
  createdAt?: string;
  lastSeenAt?: string;
  roles?: UserRole[];
  roleBindings?: RoleBinding[];
}

export interface CurrentUser extends UserAccount {
  authMode: AuthMode;
  roles: UserRole[];
  permissions: string[];
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface UserCreatePayload {
  userId?: string;
  username: string;
  displayName: string;
  email?: string;
  password?: string;
  status?: UserStatus;
}

export interface UserUpdatePayload {
  displayName?: string;
  email?: string;
  password?: string;
  status?: UserStatus;
}

export interface RoleBinding {
  bindingId: string;
  userId: string;
  role: UserRole;
  scopeType: RoleScopeType;
  scopeId: string;
  createdAt?: string;
  createdBy?: string;
}

export interface RoleBindingCreatePayload {
  userId: string;
  role: UserRole;
  scopeType: RoleScopeType;
  scopeId: string;
}

export interface RbacCatalogRole {
  role: UserRole;
  label: string;
  description?: string;
  permissions: string[];
}

export interface RbacCatalogScope {
  scopeType: RoleScopeType;
  label: string;
  description?: string;
}

export interface RbacCatalog {
  roles: RbacCatalogRole[];
  scopes: RbacCatalogScope[];
  permissions: string[];
}

export interface BatchQcAssignment {
  assignmentId: string;
  qcQueueId?: string;
  datasetId: DatasetId;
  assigneeUserId: string;
  assigneeDisplayName?: string;
  assignedBy?: string;
  assignedByDisplayName?: string;
  status: BatchAssignmentStatus;
  assignedAt?: string;
  updatedAt?: string;
  submittedAt?: string;
  confirmedAt?: string;
  returnedAt?: string;
}

export interface BatchAssignmentPayload {
  assigneeUserId: string;
}

export interface QcTask {
  taskId: string;
  qcQueueId?: string;
  datasetId: DatasetId;
  sampleId: SampleId;
  status: QcTaskStatus;
  assigneeUserId?: string;
  assigneeDisplayName?: string;
  claimedAt?: string;
  submittedAt?: string;
  completedAt?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  latestSubmissionId?: string;
  labelConfigId?: string;
  labelConfigVersion?: string;
  taskRevision?: number;
  updatedAt?: string;
}

export interface SampleLease {
  leaseId: string;
  datasetId: DatasetId;
  sampleId: SampleId;
  taskId?: string;
  userId: string;
  userDisplayName?: string;
  status: LeaseStatus;
  acquiredAt?: string;
  expiresAt?: string;
  heartbeatAt?: string;
}

export interface LabelEditDraft {
  draftId: string;
  datasetId: DatasetId;
  sampleId: SampleId;
  userId: string;
  operations: LabelEditOperation[];
  labelConfigId?: string;
  labelConfigVersion?: string;
  leaseId?: string;
  taskRevision?: number;
  updatedAt?: string;
}

export interface LabelEditSubmission {
  submissionId: string;
  datasetId: DatasetId;
  sampleId: SampleId;
  userId: string;
  userDisplayName?: string;
  status: Extract<QcTaskStatus, 'submitted' | 'confirmed' | 'returned' | 'completed'>;
  operations: LabelEditOperation[];
  validation?: LabelEditValidationResult;
  labelConfigId?: string;
  labelConfigVersion?: string;
  taskRevision?: number;
  submittedAt?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  returnedAt?: string;
  returnReason?: string;
}

export interface AuditEvent {
  eventId: string;
  actorUserId: string;
  actorDisplayName?: string;
  actorRole?: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  datasetId?: DatasetId;
  sampleId?: SampleId;
  before?: unknown;
  after?: unknown;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditEventFilters {
  datasetId?: DatasetId;
  sampleId?: SampleId;
  actorUserId?: string;
  action?: string;
}

export interface QcProgress {
  datasetId: DatasetId;
  byStatus: Partial<Record<QcTaskStatus, number>>;
  byUser: Array<{
    userId: string;
    displayName?: string;
    draftSaved: number;
    submitted: number;
    returned: number;
    confirmed: number;
  }>;
  total: number;
  updatedAt?: string;
}

export interface QcWorkspace {
  datasetId: DatasetId;
  assignment?: BatchQcAssignment;
  queue: QcQueueItem[];
  tasks: QcTask[];
  leases: SampleLease[];
  progress?: QcProgress;
}

export interface QcModificationEventTypeCount {
  eventType: string;
  label: string;
  count: number;
}

export interface QcModificationAttributionCount {
  code: string;
  label: string;
  count: number;
  weightSum?: number;
}

export interface QcModificationBboxOffsetBands {
  micro: number;
  medium: number;
  large: number;
}

export interface QcChangedSampleSummary {
  sampleId: SampleId;
  eventCount: number;
  eventTypes: string[];
  attributionCodes: string[];
  reviewerId?: string;
  confirmedAt?: string;
}

export interface QcModificationEventStats {
  datasetId: DatasetId;
  totalEvents: number;
  changedSampleCount: number;
  byEventType: QcModificationEventTypeCount[];
  byAttribution: QcModificationAttributionCount[];
  bboxOffsetBands: QcModificationBboxOffsetBands;
  changedSamples: QcChangedSampleSummary[];
  generatedAt?: string;
}

export interface QcModificationEvent {
  eventId: string;
  datasetId: DatasetId;
  sampleId: SampleId;
  eventType: string;
  label: string;
  attributionCode?: string;
  attributionLabel?: string;
  weight?: number;
  reviewerId?: string;
  confirmedAt?: string;
  createdAt?: string;
  details?: Record<string, unknown>;
}

export type SamplePoolItemStatus = 'active' | 'removed' | 'archived' | 'pending' | string;

export interface SamplePoolAttributionTag {
  code: string;
  label: string;
  count?: number;
  weightSum?: number;
}

export interface SamplePoolStatusCount {
  status: SamplePoolItemStatus;
  label: string;
  count: number;
}

export interface SamplePoolListFilters {
  datasetType?: string;
  batchId?: DatasetBatchId;
  category?: string;
  attribution?: string;
  eventType?: string;
  reviewer?: string;
  status?: SamplePoolItemStatus | 'all';
  search?: string;
}

export interface SamplePoolStats {
  totalItems: number;
  activeItems: number;
  primaryAttribution?: SamplePoolAttributionTag;
  involvedBatchCount: number;
  recentlyAddedAt?: string;
  byAttribution: SamplePoolAttributionTag[];
  byStatus: SamplePoolStatusCount[];
  generatedAt?: string;
}

export interface SamplePoolItem {
  itemId: string;
  datasetId: DatasetId;
  datasetType?: string;
  batchId?: DatasetBatchId;
  batchName?: string;
  sampleId: SampleId;
  category?: string;
  attributionTags: SamplePoolAttributionTag[];
  eventTypes: string[];
  eventCount: number;
  changedFieldCount: number;
  reviewerId?: string;
  reviewerDisplayName?: string;
  confirmedBy?: string;
  confirmedByDisplayName?: string;
  confirmedAt?: string;
  addedAt?: string;
  status: SamplePoolItemStatus;
  confirmedSnapshotId?: string;
  sourceEventIds?: string[];
}

export interface SamplePoolItemDetail extends SamplePoolItem {
  beforeSnapshotId?: string;
  confirmedSnapshotPayload?: unknown;
  baselineSnapshotPayload?: unknown;
  changedFields: string[];
  events: QcModificationEvent[];
  notes?: string;
}

export type TrainingExportFormat = 'coco_json' | 'voc_xml' | 'custom_json' | string;
export type TrainingExportSource = 'current_filters' | 'all_active_pool_items' | string;
export type TrainingExportStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | string;

export interface TrainingExportCreatePayload {
  format: TrainingExportFormat;
  source: TrainingExportSource;
  filters?: SamplePoolListFilters;
}

export interface TrainingExportJob {
  exportId: string;
  format: TrainingExportFormat;
  source: TrainingExportSource;
  filters: SamplePoolListFilters;
  filterSummary?: string;
  sampleCount?: number;
  status: TrainingExportStatus;
  createdAt?: string;
  completedAt?: string;
  error?: string;
  downloadUrl?: string;
}

export interface TrainingExportDownload {
  exportId: string;
  url: string;
  fileName?: string;
  content?: unknown;
}

export type ModelEvaluationStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | string;

export interface ModelEvaluationCreatePayload {
  modelVersion: string;
  modelName?: string;
  sourceExportId?: string;
  sourceSnapshotId?: string;
  notes?: string;
  parameters?: Record<string, unknown>;
}

export interface ModelEvaluationMetric {
  key: string;
  label: string;
  value: number;
  baselineValue?: number;
  delta?: number;
  unit?: string;
}

export interface ModelEvaluationCategoryMetric {
  category: string;
  label?: string;
  precision?: number;
  recall?: number;
  f1?: number;
  accuracy?: number;
  sampleCount?: number;
  delta?: number;
}

export interface ModelEvaluationRun {
  evaluationId: string;
  datasetId: DatasetId;
  modelVersion: string;
  modelName?: string;
  status: ModelEvaluationStatus;
  sampleCount?: number;
  sourceExportId?: string;
  sourceExportName?: string;
  sourceSnapshotId?: string;
  sourceSnapshotType?: string;
  metrics: ModelEvaluationMetric[];
  metricDeltas: ModelEvaluationMetric[];
  categoryMetrics: ModelEvaluationCategoryMetric[];
  changedSampleCount?: number;
  createdBy?: string;
  createdAt?: string;
  completedAt?: string;
  notes?: string;
}

export interface ModelEvaluationCompareResult {
  leftEvaluationId: string;
  rightEvaluationId: string;
  leftModelVersion?: string;
  rightModelVersion?: string;
  metricDeltas: ModelEvaluationMetric[];
  categoryDeltas: ModelEvaluationCategoryMetric[];
  changedSampleCount?: number;
  improvedCount?: number;
  regressedCount?: number;
  summary?: string;
}

export interface ModelEvaluationDeltaSample {
  sampleId: SampleId;
  category?: string;
  changeType?: string;
  beforeSnapshotId?: string;
  afterSnapshotId?: string;
  metricImpacts: ModelEvaluationMetric[];
  reason?: string;
}

export type AnnotationSnapshotType = 'baseline' | 'confirmed' | 'model_preannotation' | 'export' | string;

export interface AnnotationSnapshot {
  snapshotId: string;
  datasetId: DatasetId;
  sampleId?: SampleId;
  snapshotType: AnnotationSnapshotType;
  labelConfigId?: string;
  labelConfigVersion?: string;
  sourceSubmissionId?: string;
  sourceExportId?: string;
  sourceModelVersion?: string;
  sourceEvaluationId?: string;
  payloadHash?: string;
  payloadRef?: string;
  createdBy?: string;
  createdAt?: string;
  rollbackAvailable?: boolean;
}

export interface AnnotationSnapshotFieldDiff {
  field: string;
  label?: string;
  changeType?: string;
  before?: unknown;
  after?: unknown;
}

export interface AnnotationSnapshotRelationDiff extends AnnotationSnapshotFieldDiff {
  relationId?: string;
  relationIndex?: string;
}

export interface AnnotationSnapshotCandidateDiff extends AnnotationSnapshotFieldDiff {
  candidateId?: string;
  candidateIndex?: string;
}

export interface AnnotationSnapshotDiff {
  datasetId?: DatasetId;
  leftSnapshotId: string;
  rightSnapshotId: string;
  changedFieldCount: number;
  changedRelationCount: number;
  changedCandidateCount: number;
  changedFields: AnnotationSnapshotFieldDiff[];
  relations: AnnotationSnapshotRelationDiff[];
  candidates: AnnotationSnapshotCandidateDiff[];
  summary?: string;
  rollbackAvailable?: boolean;
}

export interface Dataset {
  id: DatasetId;
  name: string;
  version: string;
  status: DatasetLifecycleStatus;
  datasetType?: string;
  batchKey?: string;
  batchName?: string;
  lifecycleStatus?: DatasetLifecycleStatus;
  displayName?: string;
  fieldSchemaVersion?: string;
  activeLabelConfigVersion?: string;
  activeImportJobId?: ImportJobId;
  qcQueueId?: string;
  assetTotal?: number;
  stage1Total?: number;
  stage2SuccessTotal?: number;
  stage2FailureTotal?: number;
  qcProgress?: {
    pending: number;
    submitted: number;
    total?: number;
  };
  latestImportJob?: ImportJobSummary;
  description?: string;
  rootPath?: string;
  sourceMode?: ImportSourceMode;
  sourceUri?: string;
  sourceStructure?: ImportSourceStructure;
  sourceFileCount?: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  owner?: string;
}

export type DatasetBatch = Dataset;

export interface DatasetType {
  datasetType: string;
  displayName: string;
  fieldSchemaVersion?: string;
  activeLabelConfigVersion?: string;
  status?: string;
  batchCount: number;
  batches: DatasetBatch[];
}

export interface DatasetTypeCreatePayload {
  datasetType: string;
  displayName: string;
  fieldSchemaVersion?: string;
}

export interface DatasetRunSummary {
  runId: string;
  name: string;
  stage: 'stage1' | 'stage2';
  startedAt: string;
  status: 'success' | 'running' | 'failed';
  inputCount: number;
  outputCount: number;
}

export interface CountDistribution {
  key: string;
  label: string;
  count: number;
  ratio: number;
}

export interface ImportJobSummary {
  id: ImportJobId;
  datasetId: DatasetId;
  state: ImportJobState;
  title?: string;
  createdAt: string;
  updatedAt: string;
  blockingIssueCount: number;
  warningCount: number;
  totals?: DatasetSummary['totals'];
  processingProgress?: ImportProcessingProgress;
}

export interface DatasetSummary {
  dataset: Dataset;
  totals: {
    rawAssets: number;
    stage1Parsed: number;
    stage2Parsed: number;
    stage2Failures: number;
  };
  coverage: {
    stage1: number;
    stage2: number;
  };
  qc: {
    total: number;
    pending: number;
    passed: number;
    rejected: number;
    needsHumanReview: number;
  };
  judgeDecisionDistribution: CountDistribution[];
  violationCategoryDistribution: CountDistribution[];
  confidenceDistribution: CountDistribution[];
  visibilityDistribution: CountDistribution[];
  sampleCategoryDistribution: CountDistribution[];
  importWarnings: ImportWarning[];
  recentRuns: DatasetRunSummary[];
  latestImportJob?: ImportJobSummary;
  assetSummary?: AssetSummary;
  metadata: {
    imageSource: string;
    region: string;
    collectionRange: string;
    imageResolution: string;
    fileFormats: string[];
  };
}

export interface ImportWarning {
  id: string;
  severity: 'blocking' | 'warning' | 'info';
  title: string;
  message: string;
  details?: string[];
  createdAt?: string;
}

export interface AssetSummary {
  datasetId: DatasetId;
  datasetType?: string;
  batchKey?: string;
  media: {
    total: number;
    valid: number;
    missing: number;
    loadFailed: number;
    resolutionAbnormal: number;
  };
  importHealth: {
    imported: number;
    duplicates: number;
    orphanAnnotations: number;
    pathWarnings: number;
    schemaWarnings: number;
  };
  preannotation: {
    stage1Ready: number;
    stage2Ready: number;
    stage2Failed: number;
    stage2Missing: number;
  };
  modelJudgement: {
    pass: number;
    softFail: number;
    unknown: number;
  };
  qc: {
    queued: number;
    pending: number;
    skipped: number;
    draft: number;
    submitted: number;
  };
  categoryDistribution: CountDistribution[];
  sampleCategoryDistribution: CountDistribution[];
  updatedAt?: string;
}

export interface ImportValidationRow {
  sampleId: SampleId;
  imagePath: string;
  stage1Path?: string;
  stage2Path?: string;
  failurePath?: string;
  status: 'ready' | 'stage2_failed' | 'stage2_missing' | 'orphan_annotation';
}

export interface ImportValidationReport {
  datasetId: DatasetId;
  jobId: ImportJobId;
  valid: boolean;
  totals: DatasetSummary['totals'];
  coverage: DatasetSummary['coverage'];
  blockingErrors: ImportWarning[];
  warnings: ImportWarning[];
  rows: ImportValidationRow[];
  checkedAt?: string;
}

export interface ImportMappingStep {
  id: string;
  label: string;
  count: number;
  entity: 'RawAsset' | 'PreAnnotationStep1' | 'PreAnnotationStep2' | 'PreAnnotationFailure' | 'AuditArtifact';
}

export interface ImportProcessingProgress {
  phase?: string;
  status?: string;
  message?: string;
  processedItems?: number;
  totalItems?: number;
  percent?: number;
  updatedAt?: string;
  expiresAt?: string;
  expired?: boolean;
}

export interface ImportJobDetail {
  id: ImportJobId;
  datasetId: DatasetId;
  datasetType?: string;
  batchKey?: string;
  title?: string;
  sourceMode?: ImportSourceMode;
  sourceUri?: string;
  sourceStructure?: ImportSourceStructure;
  state: ImportJobState;
  activeStep: number;
  createdAt: string;
  updatedAt: string;
  totals: DatasetSummary['totals'];
  coverage: DatasetSummary['coverage'];
  warnings: ImportWarning[];
  validationRows: ImportValidationRow[];
  mappingSteps: ImportMappingStep[];
  processingProgress?: ImportProcessingProgress;
  validationReport?: ImportValidationReport;
}

export interface ImportJobCreatePayload {
  datasetType?: string;
  batchKey?: string;
  batchName?: string;
  sourceMode?: ImportSourceMode;
  sourceUri?: string;
  sourceStructure?: ImportSourceStructure;
  description?: string;
  sourceFileCount?: number;
  imageCount?: number;
  stage1FileCount?: number;
  stage2FileCount?: number;
  stage2FailureFileCount?: number;
}

export interface ImportArchiveUploadProgress {
  loadedBytes: number;
  totalBytes?: number;
  percent?: number;
}

export interface ImportArchiveUploadPayload {
  archiveFile: File;
  archiveFileName?: string;
  datasetType?: string;
  batchKey: string;
  batchName?: string;
  sourceStructure?: ImportSourceStructure;
  description?: string;
  onUploadProgress?: (progress: ImportArchiveUploadProgress) => void;
}

export interface AssetListFilters {
  judgeDecision?: JudgeDecision | 'all';
  stage1Status?: StageStatus | 'all';
  stage2State?: 'all' | 'ready' | 'failed';
  qcStatus?: QcStatus | 'all';
  violationCategory?: string | 'all';
  sampleCategory?: string | 'all';
  confidenceMin?: number;
  confidenceMax?: number;
  mediaStatus?: AssetMediaStatus | 'all';
  labelEditStatus?: AssetLabelEditStatus | 'all';
  search?: string;
}

export interface RawAsset {
  id: AssetId;
  datasetId: DatasetId;
  datasetType?: string;
  batchKey?: string;
  sampleId: SampleId;
  imageUrl?: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
  mediaStatus?: AssetMediaStatus;
  importStatus?: string;
  sourcePath?: string;
  importedAt: string;
}

export interface AssetListItem extends RawAsset {
  stage1Status: StageStatus;
  stage2Status: StageStatus;
  preannotationStatus?: string;
  judgeDecision: JudgeDecision;
  qcStatus: QcStatus;
  labelEditStatus?: AssetLabelEditStatus;
  hasStage2Failure: boolean;
  violationCategories: string[];
  sampleCategories: string[];
  candidateCount: number;
  highestConfidence?: number;
  updatedAt: string;
}

export type BBox = readonly [x1: number, y1: number, x2: number, y2: number];

export interface StageRelation {
  relationIndex: string;
  subject: string;
  relation: string;
  object: string;
  description?: string;
  bbox: BBox;
}

export interface KeyAnchor {
  anchor: string;
  bbox?: BBox;
}

export interface PreAnnotationStep1 {
  sampleId: SampleId;
  environmentAnalysis: string;
  sceneElements: string[];
  keyAnchors: KeyAnchor[];
  keyRelations: StageRelation[];
  judgeReport?: {
    decision: JudgeDecision;
    reason?: string;
  };
}

export interface FactVerification {
  relationIndex: string;
  subject: string;
  relation: string;
  object: string;
  bbox: BBox;
  visibilityLevel: VisibilityLevel;
  informationLossType?: string;
  subjectVisible?: boolean;
  subjectMatch?: boolean;
  keyAttributesVisible: string[];
  bboxObservation: string;
  globalContextObservation: string;
  observations: string;
  verificationResult: VerificationResult;
  verificationConfidence: number;
}

export interface Stage2Candidate {
  violationCategory: string;
  evidenceRelationIndices: string[];
  evidenceReasoning: string;
  relationHint?: string;
  segmentationTargets: string[];
  confidence: number;
  sampleCategory: string;
}

export interface PreAnnotationStep2 {
  sampleId: SampleId;
  factVerifications: FactVerification[];
  candidates: Stage2Candidate[];
  judgeReport?: {
    decision: JudgeDecision;
    reason?: string;
  };
}

export interface Stage2Failure {
  sampleId: SampleId;
  errorType: string;
  message: string;
  rawArtifactUrl?: string;
}

export interface HumanReview {
  id: string;
  sampleId: SampleId;
  decision: ReviewDecision;
  reviewer?: string;
  reasoning?: string;
  updatedAt: string;
}

export interface AuditArtifact {
  id: string;
  label: string;
  artifactType: 'request' | 'response' | 'record' | 'failure' | 'review';
  url: string;
  createdAt?: string;
}

export interface LabelConfigOption {
  code: string;
  labelZh?: string;
  labelEn?: string;
  description?: string;
  sortOrder?: number;
  aliases: string[];
}

export interface LabelConfigField {
  field: string;
  mode: LabelConfigMode;
  labelZh?: string;
  labelEn?: string;
  allowCustom: boolean;
  maxItems?: number;
  options: LabelConfigOption[];
}

export interface LabelConfig {
  configId?: string;
  datasetId: DatasetId;
  schemaVersion?: string;
  datasetType?: string;
  version: string;
  status?: LabelConfigStatus;
  contentHash?: string;
  createdAt?: string;
  activatedAt?: string;
  fields: LabelConfigField[];
  rawConfig?: unknown;
}

export interface LabelConfigSummary {
  fieldCount: number;
  closedEnumCount: number;
  openTagsCount: number;
  optionCount: number;
}

export interface LabelConfigIssue {
  field?: string;
  code?: string;
  message: string;
}

export interface LabelConfigValidationResult {
  valid: boolean;
  datasetId: DatasetId;
  schemaVersion?: string;
  version?: string;
  contentHash?: string;
  summary: LabelConfigSummary;
  errors: LabelConfigIssue[];
  warnings: LabelConfigIssue[];
  normalizedConfig?: LabelConfig;
}

export interface LabelConfigSaveResult {
  configId: string;
  datasetId: DatasetId;
  schemaVersion?: string;
  version: string;
  status: LabelConfigStatus;
  contentHash?: string;
  createdAt?: string;
  activatedAt?: string;
  validation?: LabelConfigValidationResult;
  config?: LabelConfig;
}

export interface LabelSuggestion {
  value: string;
  labelZh?: string;
  labelEn?: string;
  source?: string;
}

export type LabelEditSubmitAction = 'save_draft' | 'submit_changes';
export type LabelEditTaskStatus = 'annotation_draft' | 'annotation_submitted';

export interface LabelEditOperation {
  scope: string;
  field: string;
  op: 'replace' | 'add_tag' | 'remove_tag' | 'soft_delete_relation' | 'add_relation' | 'delete_candidate';
  before?: unknown;
  after?: unknown;
  tagPayload?: {
    rawText: string;
    normalizedText: string;
    canonicalCode?: string | null;
    source: 'human';
    status: 'custom' | 'configured';
  };
}

export interface LabelEditPatchPayload {
  sampleId: SampleId;
  taskMode: 'label_edit';
  labelConfigId?: string;
  labelConfigVersion?: string;
  leaseId?: string;
  baseRevision?: number | string;
  operations: LabelEditOperation[];
}

export interface LabelEditSubmitPayload extends LabelEditPatchPayload {
  submitAction: LabelEditSubmitAction;
  taskStatus: LabelEditTaskStatus;
}

export interface LabelEditValidationIssue {
  operationIndex: number;
  scope: string;
  field: string;
  code: string;
  message: string;
}

export interface LabelEditValidationResult {
  valid: boolean;
  datasetId?: DatasetId;
  sampleId?: SampleId;
  checkedOperationCount?: number;
  errors: LabelEditValidationIssue[];
  warnings: LabelEditValidationIssue[];
  checkedAt?: string;
}

export interface LabelEditState {
  editId: string;
  datasetId: DatasetId;
  sampleId: SampleId;
  userId?: string;
  taskMode: 'label_edit';
  submitAction: LabelEditSubmitAction;
  taskStatus: LabelEditTaskStatus;
  labelConfigId?: string;
  labelConfigVersion?: string;
  leaseId?: string;
  taskRevision?: number;
  operations: LabelEditOperation[];
  updatedAt: string;
}

export interface LabelEditSubmitResult {
  saved: boolean;
  sampleId: SampleId;
  submitAction: LabelEditSubmitAction;
  taskStatus: LabelEditTaskStatus;
  editId?: string;
  operationCount: number;
  updatedAt?: string;
  state?: LabelEditState;
  validation?: LabelEditValidationResult;
}

export interface BatchLabelEditDraftValidation {
  valid: boolean;
  errorCount: number;
  warningCount: number;
  errors: LabelEditValidationIssue[];
  warnings: LabelEditValidationIssue[];
}

export interface BatchLabelEditDraftSample {
  sampleId: SampleId;
  leaseId?: string | null;
  baseRevision?: number | string | null;
  labelConfigId?: string | null;
  labelConfigVersion?: string | null;
  operations: LabelEditOperation[];
  dirty: boolean;
  saved: boolean;
  validation?: BatchLabelEditDraftValidation;
}

export interface BatchLabelEditDraft {
  draftId?: string;
  datasetId: DatasetId;
  userId?: string;
  assignmentId?: string;
  labelConfigId?: string;
  labelConfigVersion?: string;
  totalSampleCount?: number;
  savedSampleCount: number;
  dirtySampleCount?: number;
  validationErrorCount?: number;
  samples: BatchLabelEditDraftSample[];
  updatedAt?: string;
  autosavedAt?: string;
}

export interface BatchLabelEditDraftPayload {
  entries: BatchLabelEditDraftSample[];
}

export interface BatchLabelEditDraftSaveResult {
  saved: boolean;
  datasetId: DatasetId;
  savedSampleCount: number;
  totalSampleCount?: number;
  sampleIds: SampleId[];
  updatedAt?: string;
  draft?: BatchLabelEditDraft;
}

export interface BatchLabelEditSubmitPayload {
  unsavedDirtySampleIds: SampleId[];
  validationErrorSampleIds: SampleId[];
  notes?: string | null;
}

export interface BatchLabelEditSubmitResult {
  submitted: boolean;
  datasetId: DatasetId;
  assignmentId?: string;
  assigneeUserId?: string;
  status?: BatchAssignmentStatus | string;
  submittedAt?: string;
  submittedSampleCount?: number;
  releasedLeaseCount?: number;
  assignment?: BatchQcAssignment;
}

export interface ReviewSampleDetail {
  asset: AssetListItem;
  stage1: PreAnnotationStep1;
  stage2?: PreAnnotationStep2;
  stage2Failure?: Stage2Failure;
  humanReview?: HumanReview;
  auditArtifacts: AuditArtifact[];
  labelEditState?: LabelEditState;
  labelEditHistory: LabelEditState[];
  currentUser?: CurrentUser;
  batchAssignment?: BatchQcAssignment;
  qcTask?: QcTask;
  sampleLease?: SampleLease;
  myDraft?: LabelEditDraft;
  latestSubmission?: LabelEditSubmission;
}

export interface QcQueueItem {
  sampleId: SampleId;
  assetId: AssetId;
  status: QcStatus;
  judgeDecision: JudgeDecision;
  highestConfidence?: number;
  primaryCategory?: string;
  stage2Failure: boolean;
  updatedAt: string;
  task?: QcTask;
  taskStatus?: QcTaskStatus;
  assigneeUserId?: string;
  assigneeDisplayName?: string;
  lease?: SampleLease;
  leaseStatus?: LeaseStatus;
  latestSubmission?: LabelEditSubmission;
  labelConfigVersion?: string;
}

export interface PreannotationSummary {
  datasetId: DatasetId;
  stage1: {
    succeeded: number;
    failed: number;
    bboxValid: number;
  };
  stage2: {
    parsed: number;
    failures: number;
    factVerificationCount: number;
    candidateCount: number;
  };
  categoryDistribution: CountDistribution[];
  verificationDistribution: CountDistribution[];
}

export interface BackendDataset {
  dataset_id: DatasetId;
  name: string;
  root_path: string;
  dataset_type?: string;
  batch_key?: string;
  batch_name?: string;
  lifecycle_status?: DatasetLifecycleStatus;
  active_label_config_version?: string;
  field_schema_version?: string;
  active_import_job_id?: ImportJobId;
  qc_queue_id?: string;
  source_mode?: ImportSourceMode;
  source_uri?: string;
  source_structure?: ImportSourceStructure;
  source_file_count?: number;
  total_assets: number;
  stage1_count: number;
  stage2_success_count: number;
  stage2_failure_count: number;
  created_at: string;
}

export interface BackendImportJob {
  job_id: ImportJobId;
  dataset_id: DatasetId;
  dataset_type?: string;
  batch_key?: string;
  batch_name?: string;
  source_mode?: ImportSourceMode;
  source_uri?: string;
  source_structure?: ImportSourceStructure;
  source_file_count?: number;
  image_count?: number;
  stage1_file_count?: number;
  stage2_file_count?: number;
  stage2_failure_file_count?: number;
  state: ImportJobState;
  expected_assets: number;
  imported_assets: number;
  failure_count: number;
  requested_sample_ids?: SampleId[];
  validation_errors?: string[];
  live_progress?: unknown;
  processing_progress?: unknown;
  import_progress?: unknown;
  progress?: unknown;
}

export interface BackendRawAsset {
  asset_id: AssetId;
  sample_id: SampleId;
  image_url: string;
  width: number;
  height: number;
  source_image_path_internal: string;
}

export interface BackendStage1Relation {
  bbox: number[];
  subject: string;
  relation: string;
  object: string;
  description: string;
}

export interface BackendStage1Preannotation {
  sample_id: SampleId;
  environment_analysis: string;
  scene_elements?: string[];
  key_anchors?: string[];
  key_relations?: BackendStage1Relation[];
  judge_decision?: 'pass' | 'soft_fail' | 'unknown';
}

export type BackendVisibilityLevel = 'clear' | 'partial' | 'tiny' | 'blurry' | 'occluded';

export interface BackendStage2FactVerification {
  bbox: number[];
  relation_index: number;
  subject: string;
  relation: string;
  object: string;
  visibility_level: BackendVisibilityLevel;
  information_loss_type: 'none' | 'occlusion' | 'boundary_truncation';
  subject_visible: boolean;
  subject_match: boolean;
  key_attributes_visible?: string[];
  bbox_observation: string;
  global_context_observation: string;
  verification_result: VerificationResult;
  verification_confidence: number;
}

export interface BackendStage2Candidate {
  violation_category?: string[];
  evidence_relation_indices?: number[];
  evidence_reasoning: string;
  relation_hint: string;
  segmentation_targets?: string[];
  confidence: number;
  sample_category: 'positive samples' | 'negative samples' | 'hard boundary samples';
}

export interface BackendStage2Preannotation {
  sample_id: SampleId;
  fact_verifications?: BackendStage2FactVerification[];
  candidates?: BackendStage2Candidate[];
}

export interface BackendStage2PreannotationFailure {
  sample_id: SampleId;
  error_type: string;
  message: string;
}

export interface BackendHumanReview {
  review_id: string;
  sample_id: SampleId;
  reviewer: string;
  decision: ReviewDecision;
  notes?: string;
  corrected_bboxes?: number[][];
  corrected_categories?: string[];
  created_at: string;
}

export interface BackendAuditArtifact {
  artifact_id: string;
  sample_id: SampleId;
  artifact_type: AuditArtifact['artifactType'];
  storage_url: string;
  checksum: string;
  created_at: string;
}

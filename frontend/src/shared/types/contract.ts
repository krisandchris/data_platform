export type DatasetId = string;
export type DatasetTypeId = string;
export type DatasetBatchId = DatasetId;
export type AssetId = string;
export type SampleId = string;
export type ImportJobId = string;
export type BBox = readonly [x1: number, y1: number, x2: number, y2: number];

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export type UserRole = 'platform_admin' | 'dataset_admin' | 'batch_manager' | 'annotator' | 'qc_lead' | string;
export type UserStatus = 'active' | 'disabled';
export type BatchAssignmentStatus = 'assigned' | 'in_progress' | 'submitted' | 'confirmed' | 'returned' | 'revoked';
export type QcTaskStatus =
  | 'queued'
  | 'assigned'
  | 'in_progress'
  | 'submitted'
  | 'confirmed'
  | 'returned'
  | 'skipped'
  | 'revoked'
  | string;
export type LeaseStatus = 'active' | 'released' | 'expired' | 'revoked';
export type ReviewDecision = 'approved' | 'needs_changes' | 'rejected';
export type JudgeDecision = 'pass' | 'soft_fail' | 'fail' | 'unknown';
export type QcStatus = 'qc_pending' | 'needs_review' | 'passed' | 'rejected' | 'manual_label_required' | string;
export type StageStatus = 'missing' | 'ready' | 'passed' | 'failed';
export type VisibilityLevel = 'clear' | 'partial' | 'tiny' | 'blurry' | 'occluded' | string;
export type VerificationResult = 'supported' | 'weakly_supported' | 'unsupported' | 'unclear';
export type ImportSourceMode = 'local_directory' | 'uploaded_package' | 'object_storage_prefix' | 'manifest_only';
export type ImportSourceStructure = 'images_only' | 'images_with_preannotations';
export type ImportJobState =
  | 'Created'
  | 'Scanning'
  | 'Scanned'
  | 'Validating'
  | 'Validated'
  | 'ValidationFailed'
  | 'ImportFailed'
  | 'Uploading'
  | 'Uploaded'
  | 'Importing'
  | 'Imported'
  | 'Failed';

export interface UserAccount {
  userId: string;
  username?: string;
  displayName?: string;
  email?: string;
  status?: UserStatus;
  authMode?: string;
  roles?: UserRole[];
  permissions?: string[];
}

export interface CurrentUser extends UserAccount {
  roles: UserRole[];
  permissions: string[];
}

export interface RoleBinding {
  bindingId: string;
  userId: string;
  role: UserRole;
  scopeType?: string;
  scopeId?: string;
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
  taskRevision?: number | string;
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

export interface Dataset {
  id: DatasetId;
  name: string;
  datasetType?: DatasetTypeId;
  batchKey?: string;
  status?: string;
  lifecycleStatus?: string;
  rootPath?: string;
  sourceMode?: ImportSourceMode;
  sourceUri?: string;
  sourceStructure?: ImportSourceStructure;
  batchName?: string;
  assetTotal?: number;
  stage1Count?: number;
  stage1Total?: number;
  stage2SuccessCount?: number;
  stage2SuccessTotal?: number;
  stage2FailureCount?: number;
  stage2FailureTotal?: number;
  qcQueueId?: string;
  qcProgress?: {
    total: number;
    pending: number;
    passed: number;
    rejected: number;
    needsHumanReview: number;
    submitted: number;
  };
  activeImportJobId?: string;
  latestImportJob?: ImportJobSummary;
  createdAt?: string;
  updatedAt?: string;
}

export type DatasetBatch = Dataset;

export interface DatasetType {
  datasetType: DatasetTypeId;
  displayName: string;
  fieldSchemaVersion?: string;
  activeLabelConfigVersion?: string;
  status?: string;
  batchCount: number;
  batches: Dataset[];
}

export interface ImportJobSummary {
  id: ImportJobId;
  datasetId: DatasetId;
  title: string;
  state: ImportJobState;
  batchKey?: string;
  batchName?: string;
  createdAt?: string;
  updatedAt?: string;
  processingProgress?: ImportProcessingProgress;
}

export interface CountDistribution {
  key: string;
  label: string;
  count: number;
  ratio: number;
}

export interface ImportWarning {
  id: string;
  severity: 'info' | 'warning' | 'blocking' | 'error' | string;
  title: string;
  message: string;
  details?: string[];
  createdAt?: string;
}

export interface ImportValidationRow {
  sampleId: string;
  imagePath?: string;
  stage1Path?: string;
  stage2Path?: string;
  failurePath?: string;
  status: StageStatus;
  issues?: string[];
}

export interface ImportValidationReport {
  datasetId: DatasetId;
  jobId: ImportJobId;
  valid: boolean;
  totals: DatasetTotals;
  coverage: DatasetCoverage;
  blockingErrors: ImportWarning[];
  warnings: ImportWarning[];
  rows: ImportValidationRow[];
}

export interface DatasetTotals {
  rawAssets: number;
  stage1Parsed: number;
  stage2Parsed: number;
  stage2Failures: number;
}

export interface DatasetCoverage {
  stage1: number;
  stage2: number;
}

export interface ImportMappingStep {
  id: string;
  label: string;
  count: number;
  entity: string;
}

export interface ImportProcessingProgress {
  state: string;
  status?: string;
  phase?: string;
  message?: string;
  processedBytes?: number;
  totalBytes?: number;
  processedItems?: number;
  totalItems?: number;
  percent?: number;
  startedAt?: string;
  updatedAt?: string;
  expiresAt?: string;
  expired?: boolean;
}

export interface ImportJobDetail extends ImportJobSummary {
  activeStep: number;
  sourceMode?: ImportSourceMode;
  sourceUri?: string;
  sourceStructure?: ImportSourceStructure;
  description?: string;
  totals: DatasetTotals;
  coverage: DatasetCoverage;
  warnings: ImportWarning[];
  mappingSteps: ImportMappingStep[];
  validationRows: ImportValidationRow[];
  validationReport?: ImportValidationReport;
  progress?: ImportProcessingProgress;
  processingProgress?: ImportProcessingProgress;
}

export interface ImportJobCreatePayload {
  datasetType: string;
  batchKey: string;
  batchName: string;
  sourceMode?: ImportSourceMode;
  sourceUri?: string;
  sourceStructure: ImportSourceStructure;
  description?: string;
  sourceFileCount?: number;
  imageCount?: number;
  stage1FileCount?: number;
  stage2FileCount?: number;
  stage2FailureFileCount?: number;
}

export interface ImportArchiveUploadProgress {
  phase: 'uploading' | 'processing';
  loadedBytes: number;
  totalBytes?: number;
  percent?: number;
}

export interface ImportArchiveUploadPayload extends ImportJobCreatePayload {
  archiveFile: File | Blob;
  archiveFileName?: string;
  onProgress?: (progress: ImportArchiveUploadProgress) => void;
  onUploadProgress?: (progress: ImportArchiveUploadProgress) => void;
}

export interface StageRelation {
  id: string;
  subject: string;
  relation: string;
  predicate: string;
  object: string;
  description?: string;
  bbox: BBox;
  confidence?: number;
  visibility?: VisibilityLevel;
  source?: string;
  relationIndex: string;
  objectType?: string;
  [key: string]: any;
}

export interface KeyAnchor {
  id: string;
  anchor: string;
  label?: string;
  bbox?: BBox;
}

export interface PreAnnotationStep1 {
  sampleId: SampleId;
  environmentAnalysis?: string;
  sceneElements: string[];
  relations: StageRelation[];
  keyRelations: StageRelation[];
  keyAnchors: KeyAnchor[];
  raw?: unknown;
}

export interface FactVerification {
  relationIndex: string;
  result: VerificationResult;
  reason?: string;
  confidence?: number;
  subjectVisible?: boolean;
  subjectMatch?: boolean;
  keyAttributesVisible: string[];
  visibilityLevel?: string;
  informationLossType?: string;
  verificationResult?: string;
  verificationConfidence?: number;
  bboxObservation?: string;
  globalContextObservation?: string;
  bbox: BBox;
  [key: string]: any;
}

export interface Stage2Candidate {
  id: string;
  category: string;
  violationCategory: string;
  sampleCategory: string;
  bbox: BBox;
  confidence: number;
  reasoning?: string;
  relationIds?: string[];
  evidenceRelationIndices: string[];
  evidenceReasoning: string;
  segmentationTargets: string[];
  relationHint?: string;
  verificationSummary?: string;
  verification?: FactVerification;
  deleted?: boolean;
  [key: string]: any;
}

export interface PreAnnotationStep2 {
  sampleId: SampleId;
  judgeDecision: JudgeDecision;
  candidates: Stage2Candidate[];
  relations?: StageRelation[];
  factVerifications: FactVerification[];
  raw?: unknown;
}

export interface Stage2Failure {
  sampleId: SampleId;
  reason: string;
  message?: string;
  raw?: unknown;
}

export interface HumanReview {
  decision?: ReviewDecision;
  notes?: string;
  reviewer?: string;
  reviewedAt?: string;
  patch?: unknown;
}

export interface AuditArtifact {
  artifactType: string;
  path: string;
  label?: string;
}

export interface LabelConfigOption {
  code: string;
  labelZh?: string;
  labelEn?: string;
  description?: string;
  sortOrder?: number;
  aliases?: string[];
}

export interface LabelConfigField {
  field: string;
  mode: string;
  labelZh?: string;
  labelEn?: string;
  allowCustom?: boolean;
  maxItems?: number;
  options: LabelConfigOption[];
}

export interface LabelConfig {
  configId?: string;
  datasetId: DatasetId;
  schemaVersion?: string;
  datasetType?: string;
  version: string;
  status?: string;
  contentHash?: string;
  createdAt?: string;
  activatedAt?: string;
  fields: LabelConfigField[];
  rawConfig?: unknown;
}

export interface LabelSuggestion {
  value: string;
  label?: string;
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
  labelConfigId?: string | null;
  labelConfigVersion?: string | null;
  leaseId?: string | null;
  baseRevision?: number | string | null;
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
  taskMode: string;
  submitAction: LabelEditSubmitAction;
  taskStatus: LabelEditTaskStatus;
  labelConfigId?: string;
  labelConfigVersion?: string;
  leaseId?: string;
  taskRevision?: number | string;
  operations: LabelEditOperation[];
  updatedAt?: string;
}

export interface LabelEditDraft {
  draftId: string;
  datasetId: DatasetId;
  sampleId: SampleId;
  userId?: string;
  operations: LabelEditOperation[];
  labelConfigId?: string;
  labelConfigVersion?: string;
  leaseId?: string;
  taskRevision?: number | string;
  updatedAt?: string;
}

export interface LabelEditSubmission {
  submissionId: string;
  datasetId: DatasetId;
  sampleId: SampleId;
  userId?: string;
  userDisplayName?: string;
  status: 'submitted' | 'confirmed' | 'returned' | string;
  operations: LabelEditOperation[];
  validation?: LabelEditValidationResult;
  labelConfigId?: string;
  labelConfigVersion?: string;
  taskRevision?: number | string;
  submittedAt?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  returnedAt?: string;
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
  labelConfigId?: string | null;
  labelConfigVersion?: string | null;
  leaseId?: string | null;
  baseRevision?: number | string | null;
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
  status?: string;
  submittedAt?: string;
  submittedSampleCount?: number;
  releasedLeaseCount?: number;
  assignment?: BatchQcAssignment;
}

export interface RawAsset {
  assetId: AssetId;
  sampleId: SampleId;
  datasetId: DatasetId;
  imageUrl?: string;
  width?: number;
  height?: number;
  judgeDecision: string;
  stage2Status: string;
}

export interface ReviewSampleDetail {
  asset: RawAsset;
  stage1: PreAnnotationStep1;
  stage2?: PreAnnotationStep2;
  stage2Failure?: Stage2Failure;
  humanReview?: HumanReview;
  auditArtifacts?: AuditArtifact[];
  sampleLease?: SampleLease;
  myDraft?: LabelEditDraft;
  submissions?: LabelEditSubmission[];
  latestSubmission?: LabelEditSubmission;
  qcTask?: QcTask;
  currentUser?: CurrentUser;
  batchAssignment?: BatchQcAssignment;
}

export interface QcQueueItem {
  sampleId: SampleId;
  assetId: AssetId;
  datasetId: DatasetId;
  status: QcStatus;
  judgeDecision: JudgeDecision;
  violationCategory?: string;
  sampleCategory?: string;
  primaryCategory?: string;
  leaseStatus?: LeaseStatus;
  labelConfigVersion?: string;
  taskStatus?: QcTaskStatus;
  task?: QcTask;
  taskRevision?: number | string;
  assigneeUserId?: string;
  assigneeDisplayName?: string;
  latestSubmission?: LabelEditSubmission;
  latestSubmissionId?: string;
  submittedAt?: string;
  confirmedAt?: string;
  updatedAt?: string;
}

export interface QcWorkspace {
  datasetId: DatasetId;
  assignment?: BatchQcAssignment;
  queue: QcQueueItem[];
  tasks: QcTask[];
  leases: SampleLease[];
}

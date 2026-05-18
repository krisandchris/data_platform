export type DatasetId = string;
export type AssetId = string;
export type SampleId = string;
export type ImportJobId = string;

export type DatasetLifecycleStatus = 'draft' | 'active' | 'archived';
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

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface Dataset {
  id: DatasetId;
  name: string;
  version: string;
  status: DatasetLifecycleStatus;
  description?: string;
  rootPath?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  owner?: string;
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
  createdAt?: string;
}

export interface ImportValidationRow {
  sampleId: SampleId;
  imagePath: string;
  stage1Path?: string;
  stage2Path?: string;
  failurePath?: string;
  status: 'ready' | 'stage2_failed' | 'stage2_missing' | 'orphan_annotation';
}

export interface ImportMappingStep {
  id: string;
  label: string;
  count: number;
  entity: 'RawAsset' | 'PreAnnotationStep1' | 'PreAnnotationStep2' | 'PreAnnotationFailure' | 'AuditArtifact';
}

export interface ImportJobDetail {
  id: ImportJobId;
  datasetId: DatasetId;
  state: ImportJobState;
  activeStep: number;
  createdAt: string;
  updatedAt: string;
  totals: DatasetSummary['totals'];
  coverage: DatasetSummary['coverage'];
  warnings: ImportWarning[];
  validationRows: ImportValidationRow[];
  mappingSteps: ImportMappingStep[];
}

export interface AssetListFilters {
  judgeDecision?: JudgeDecision | 'all';
  stage2State?: 'all' | 'ready' | 'failed';
  qcStatus?: QcStatus | 'all';
  violationCategory?: string | 'all';
  sampleCategory?: string | 'all';
  search?: string;
}

export interface RawAsset {
  id: AssetId;
  datasetId: DatasetId;
  sampleId: SampleId;
  imageUrl?: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
  sourcePath?: string;
  importedAt: string;
}

export interface AssetListItem extends RawAsset {
  stage1Status: StageStatus;
  stage2Status: StageStatus;
  judgeDecision: JudgeDecision;
  qcStatus: QcStatus;
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
  taskMode: 'label_edit';
  submitAction: LabelEditSubmitAction;
  taskStatus: LabelEditTaskStatus;
  labelConfigId?: string;
  labelConfigVersion?: string;
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

export interface ReviewSampleDetail {
  asset: AssetListItem;
  stage1: PreAnnotationStep1;
  stage2?: PreAnnotationStep2;
  stage2Failure?: Stage2Failure;
  humanReview?: HumanReview;
  auditArtifacts: AuditArtifact[];
  labelEditState?: LabelEditState;
  labelEditHistory: LabelEditState[];
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
  total_assets: number;
  stage1_count: number;
  stage2_success_count: number;
  stage2_failure_count: number;
  created_at: string;
}

export interface BackendImportJob {
  job_id: ImportJobId;
  dataset_id: DatasetId;
  state: ImportJobState;
  expected_assets: number;
  imported_assets: number;
  failure_count: number;
  requested_sample_ids?: SampleId[];
  validation_errors?: string[];
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

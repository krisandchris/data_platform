import { ApiClientError, clearSessionToken, HttpClient, saveSessionToken } from './http';
import { fixtureApiClient } from './fixtures';
import { apiMode } from './config';
import { toBrowserMediaUrl } from './media';
import type {
  AssetListFilters,
  AssetListItem,
  AssetSummary,
  AuditArtifact,
  AuditEvent,
  AuditEventFilters,
  BatchAssignmentPayload,
  BatchLabelEditDraft,
  BatchLabelEditDraftPayload,
  BatchLabelEditDraftSaveResult,
  BatchLabelEditDraftSample,
  BatchLabelEditDraftValidation,
  BatchLabelEditSubmitPayload,
  BatchLabelEditSubmitResult,
  BatchAssignmentStatus,
  BatchQcAssignment,
  BackendAuditArtifact,
  BackendDataset,
  BackendHumanReview,
  BackendImportJob,
  BackendRawAsset,
  BackendStage1Preannotation,
  BackendStage2Candidate,
  BackendStage2Preannotation,
  BackendStage2PreannotationFailure,
  BBox,
  CountDistribution,
  CurrentUser,
  Dataset,
  DatasetBatchId,
  DatasetId,
  DatasetSummary,
  DatasetType,
  DatasetTypeCreatePayload,
  DatasetTypeId,
  FactVerification,
  HumanReview,
  ImportArchiveUploadPayload,
  ImportJobCreatePayload,
  ImportJobDetail,
  ImportJobId,
  ImportProcessingProgress,
  ImportJobState,
  ImportJobSummary,
  ImportValidationReport,
  ImportWarning,
  JudgeDecision,
  LabelConfig,
  LabelConfigField,
  LabelConfigIssue,
  LabelConfigOption,
  LabelConfigSaveResult,
  LabelConfigSummary,
  LabelConfigValidationResult,
  LabelEditDraft,
  LabelEditOperation,
  LabelEditPatchPayload,
  LabelEditState,
  LabelEditSubmission,
  LabelEditSubmitPayload,
  LabelEditSubmitResult,
  LabelEditValidationIssue,
  LabelEditValidationResult,
  LabelSuggestion,
  LeaseStatus,
  LoginPayload,
  AnnotationSnapshot,
  AnnotationSnapshotDiff,
  AnnotationSnapshotFieldDiff,
  AnnotationSnapshotCandidateDiff,
  AnnotationSnapshotRelationDiff,
  ModelEvaluationCategoryMetric,
  ModelEvaluationCompareResult,
  ModelEvaluationCreatePayload,
  ModelEvaluationDeltaSample,
  ModelEvaluationMetric,
  ModelEvaluationRun,
  PreannotationSummary,
  PreAnnotationStep1,
  PreAnnotationStep2,
  QcModificationEvent,
  QcModificationEventStats,
  QcProgress,
  QcStatus,
  QcQueueItem,
  QcTask,
  QcTaskStatus,
  QcWorkspace,
  ReviewDecision,
  ReviewSampleDetail,
  RbacCatalog,
  RbacCatalogRole,
  RbacCatalogScope,
  RoleBinding,
  RoleBindingCreatePayload,
  RoleScopeType,
  SampleId,
  SampleLease,
  SamplePoolAttributionTag,
  SamplePoolItem,
  SamplePoolItemDetail,
  SamplePoolListFilters,
  SamplePoolStats,
  Stage2Candidate,
  Stage2Failure,
  StageRelation,
  StageStatus,
  TrainingExportCreatePayload,
  TrainingExportDownload,
  TrainingExportJob,
  UserAccount,
  UserCreatePayload,
  UserRole,
  UserUpdatePayload,
} from '../shared/types/contract';

export interface SubmitReviewPayload {
  decision: ReviewDecision;
  notes?: string;
  reviewer?: string;
  labelConfigId?: string;
  labelConfigVersion?: string;
  patch?: unknown;
}

export interface LabelConfigUploadPayload {
  fileName: string;
  config: unknown;
  activate?: boolean;
  saveAsNewVersion?: boolean;
}

export class LabelEditValidationError extends Error {
  readonly validation: LabelEditValidationResult;
  readonly status = 422;

  constructor(validation: LabelEditValidationResult) {
    super('Label edit validation failed');
    this.name = 'LabelEditValidationError';
    this.validation = validation;
  }
}

export interface UrbanViolationApi {
  login(payload: LoginPayload): Promise<CurrentUser>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<CurrentUser>;
  listUsers(): Promise<UserAccount[]>;
  listBatchAssignableUsers(datasetId: DatasetId): Promise<UserAccount[]>;
  createUser(payload: UserCreatePayload): Promise<UserAccount>;
  updateUser(userId: string, payload: UserUpdatePayload): Promise<UserAccount>;
  listRoleBindings(): Promise<RoleBinding[]>;
  createRoleBinding(payload: RoleBindingCreatePayload): Promise<RoleBinding>;
  deleteRoleBinding(bindingId: string): Promise<void>;
  getRbacCatalog(): Promise<RbacCatalog>;
  listDatasets(): Promise<Dataset[]>;
  listDatasetTypes(): Promise<DatasetType[]>;
  getDatasetType(datasetType: DatasetTypeId): Promise<DatasetType>;
  createDatasetType(payload: DatasetTypeCreatePayload): Promise<DatasetType>;
  deleteDatasetBatch(batchId: DatasetBatchId): Promise<void>;
  getDatasetBatchSummary(batchId: DatasetBatchId): Promise<DatasetSummary>;
  getDatasetSummary(datasetId: DatasetId): Promise<DatasetSummary>;
  getDatasetBatchAssetSummary(batchId: DatasetBatchId): Promise<AssetSummary>;
  getAssetSummary(datasetId: DatasetId): Promise<AssetSummary>;
  listDatasetBatchAssets(batchId: DatasetBatchId, filters?: AssetListFilters): Promise<AssetListItem[]>;
  listAssets(datasetId: DatasetId, filters?: AssetListFilters): Promise<AssetListItem[]>;
  listDatasetBatchImportJobs(batchId: DatasetBatchId): Promise<ImportJobSummary[]>;
  listImportJobs(datasetId: DatasetId): Promise<ImportJobSummary[]>;
  createDatasetBatchImportJob(batchId: DatasetBatchId, payload: ImportJobCreatePayload): Promise<ImportJobDetail>;
  createImportJob(datasetId: DatasetId, payload: ImportJobCreatePayload): Promise<ImportJobDetail>;
  createImportJobArchive(datasetId: DatasetId, payload: ImportArchiveUploadPayload): Promise<ImportJobDetail>;
  getDatasetBatchImportJob(batchId: DatasetBatchId, jobId: ImportJobId): Promise<ImportJobDetail>;
  getImportJob(datasetId: DatasetId, jobId: ImportJobId): Promise<ImportJobDetail>;
  getDatasetBatchPreannotationSummary(batchId: DatasetBatchId): Promise<PreannotationSummary>;
  scanImportJob(datasetId: DatasetId, jobId: ImportJobId): Promise<ImportJobDetail>;
  validateImportJob(datasetId: DatasetId, jobId: ImportJobId): Promise<ImportJobDetail>;
  confirmImportJob(datasetId: DatasetId, jobId: ImportJobId): Promise<ImportJobDetail>;
  retryImportJob(datasetId: DatasetId, jobId: ImportJobId): Promise<ImportJobDetail>;
  getPreannotationSummary(datasetId: DatasetId): Promise<PreannotationSummary>;
  listDatasetBatchQcQueue(batchId: DatasetBatchId): Promise<QcQueueItem[]>;
  listQcQueue(datasetId: DatasetId): Promise<QcQueueItem[]>;
  getDatasetBatchQcWorkspace(batchId: DatasetBatchId): Promise<QcWorkspace>;
  getQcWorkspace(datasetId: DatasetId): Promise<QcWorkspace>;
  getDatasetBatchQcProgress(batchId: DatasetBatchId): Promise<QcProgress>;
  generateQcQueue(datasetId: DatasetId): Promise<QcWorkspace>;
  getQcProgress(datasetId: DatasetId): Promise<QcProgress>;
  getDatasetBatchQcModificationEventStats(batchId: DatasetBatchId): Promise<QcModificationEventStats>;
  getQcModificationEventStats(datasetId: DatasetId): Promise<QcModificationEventStats>;
  listDatasetBatchQcModificationEvents(batchId: DatasetBatchId): Promise<QcModificationEvent[]>;
  listQcModificationEvents(datasetId: DatasetId): Promise<QcModificationEvent[]>;
  listSamplePoolItems(filters?: SamplePoolListFilters): Promise<SamplePoolItem[]>;
  getSamplePoolStats(filters?: SamplePoolListFilters): Promise<SamplePoolStats>;
  getSamplePoolItem(itemId: string): Promise<SamplePoolItemDetail>;
  createTrainingExport(payload: TrainingExportCreatePayload): Promise<TrainingExportJob>;
  listTrainingExports(): Promise<TrainingExportJob[]>;
  getTrainingExport(exportId: string): Promise<TrainingExportJob>;
  downloadTrainingExport(exportId: string): Promise<TrainingExportDownload>;
  getTrainingExportDownloadUrl(exportId: string): string;
  cancelTrainingExport(exportId: string): Promise<TrainingExportJob>;
  createDatasetBatchEvaluation(batchId: DatasetBatchId, payload: ModelEvaluationCreatePayload): Promise<ModelEvaluationRun>;
  createModelEvaluation(datasetId: DatasetId, payload: ModelEvaluationCreatePayload): Promise<ModelEvaluationRun>;
  listDatasetBatchEvaluations(batchId: DatasetBatchId): Promise<ModelEvaluationRun[]>;
  listModelEvaluations(datasetId: DatasetId): Promise<ModelEvaluationRun[]>;
  getDatasetBatchEvaluation(batchId: DatasetBatchId, evaluationId: string): Promise<ModelEvaluationRun>;
  getModelEvaluation(datasetId: DatasetId, evaluationId: string): Promise<ModelEvaluationRun>;
  compareModelEvaluations(leftId: string, rightId: string): Promise<ModelEvaluationCompareResult>;
  listModelEvaluationDeltaSamples(evaluationId: string): Promise<ModelEvaluationDeltaSample[]>;
  listDatasetBatchSnapshots(batchId: DatasetBatchId): Promise<AnnotationSnapshot[]>;
  listSnapshots(datasetId: DatasetId): Promise<AnnotationSnapshot[]>;
  diffDatasetBatchSnapshots(
    batchId: DatasetBatchId,
    leftSnapshotId: string,
    rightSnapshotId: string,
  ): Promise<AnnotationSnapshotDiff>;
  diffSnapshots(datasetId: DatasetId, leftSnapshotId: string, rightSnapshotId: string): Promise<AnnotationSnapshotDiff>;
  getBatchAssignment(datasetId: DatasetId): Promise<BatchQcAssignment | undefined>;
  assignBatch(datasetId: DatasetId, payload: BatchAssignmentPayload): Promise<BatchQcAssignment>;
  reassignBatch(datasetId: DatasetId, payload: BatchAssignmentPayload): Promise<BatchQcAssignment>;
  releaseBatchAssignment(datasetId: DatasetId): Promise<BatchQcAssignment | undefined>;
  listQcTasks(datasetId: DatasetId): Promise<QcTask[]>;
  getReviewSample(datasetId: DatasetId, sampleId: SampleId): Promise<ReviewSampleDetail>;
  acquireSampleLease(datasetId: DatasetId, sampleId: SampleId): Promise<SampleLease>;
  heartbeatSampleLease(datasetId: DatasetId, sampleId: SampleId, leaseId: string): Promise<SampleLease>;
  releaseSampleLease(datasetId: DatasetId, sampleId: SampleId, leaseId: string): Promise<SampleLease | undefined>;
  submitReviewDecision(
    datasetId: DatasetId,
    sampleId: SampleId,
    payload: SubmitReviewPayload,
  ): Promise<HumanReview>;
  validateLabelConfig(
    datasetId: DatasetId,
    payload: Omit<LabelConfigUploadPayload, 'activate'>,
  ): Promise<LabelConfigValidationResult>;
  validateDatasetTypeLabelConfig(
    datasetTypeId: DatasetTypeId,
    payload: Omit<LabelConfigUploadPayload, 'activate'>,
  ): Promise<LabelConfigValidationResult>;
  saveLabelConfig(datasetId: DatasetId, payload: LabelConfigUploadPayload): Promise<LabelConfigSaveResult>;
  saveDatasetTypeLabelConfig(datasetTypeId: DatasetTypeId, payload: LabelConfigUploadPayload): Promise<LabelConfigSaveResult>;
  listLabelConfigs(datasetId: DatasetId): Promise<LabelConfigSaveResult[]>;
  listDatasetTypeLabelConfigs(datasetTypeId: DatasetTypeId): Promise<LabelConfigSaveResult[]>;
  activateLabelConfig(datasetId: DatasetId, configId: string): Promise<LabelConfigSaveResult>;
  activateDatasetTypeLabelConfig(datasetTypeId: DatasetTypeId, configId: string): Promise<LabelConfigSaveResult>;
  reloadActiveLabelConfig(datasetId: DatasetId): Promise<LabelConfigSaveResult>;
  reloadActiveDatasetTypeLabelConfig(datasetTypeId: DatasetTypeId): Promise<LabelConfigSaveResult>;
  getActiveLabelConfig(datasetId: DatasetId): Promise<LabelConfig>;
  getActiveDatasetTypeLabelConfig(datasetTypeId: DatasetTypeId): Promise<LabelConfig>;
  getLabelSuggestions(datasetId: DatasetId, field: string, query?: string): Promise<LabelSuggestion[]>;
  validateLabelEdit(
    datasetId: DatasetId,
    sampleId: SampleId,
    payload: LabelEditPatchPayload,
  ): Promise<LabelEditValidationResult>;
  getMyLabelEditDraft(datasetId: DatasetId, sampleId: SampleId): Promise<LabelEditDraft | undefined>;
  getLabelEditHistory(datasetId: DatasetId, sampleId: SampleId): Promise<LabelEditSubmission[]>;
  submitLabelEdit(
    datasetId: DatasetId,
    sampleId: SampleId,
    payload: LabelEditSubmitPayload,
  ): Promise<LabelEditSubmitResult>;
  getMyBatchLabelEditDraft(datasetId: DatasetId): Promise<BatchLabelEditDraft>;
  saveMyBatchLabelEditDraft(
    datasetId: DatasetId,
    payload: BatchLabelEditDraftPayload,
  ): Promise<BatchLabelEditDraftSaveResult>;
  autosaveMyBatchLabelEditDraft(
    datasetId: DatasetId,
    payload: BatchLabelEditDraftPayload,
  ): Promise<BatchLabelEditDraftSaveResult>;
  submitBatchLabelEdits(
    datasetId: DatasetId,
    payload: BatchLabelEditSubmitPayload,
  ): Promise<BatchLabelEditSubmitResult>;
  confirmLabelEditSubmission(
    datasetId: DatasetId,
    sampleId: SampleId,
    submissionId: string,
  ): Promise<LabelEditSubmission>;
  returnLabelEditSubmission(
    datasetId: DatasetId,
    sampleId: SampleId,
    submissionId: string,
    reason?: string,
  ): Promise<LabelEditSubmission>;
  listAuditEvents(filters?: AuditEventFilters): Promise<AuditEvent[]>;
}

export class HttpUrbanViolationApi implements UrbanViolationApi {
  constructor(private readonly http = new HttpClient()) {}

  async login(payload: LoginPayload): Promise<CurrentUser> {
    const response = await this.http.post<unknown>('/auth/login', {
      user_id: payload.username,
      password: payload.password,
    });
    const record = isRecord(response) ? response : {};
    const token = stringValue(record.token);
    if (token) {
      saveSessionToken(token);
      return this.getCurrentUser();
    }
    return normalizeCurrentUser(response);
  }

  async logout(): Promise<void> {
    try {
      await this.http.post<unknown>('/auth/logout');
    } finally {
      clearSessionToken();
    }
  }

  async getCurrentUser(): Promise<CurrentUser> {
    const response = await this.http.get<unknown>('/me');
    return normalizeCurrentUser(response);
  }

  async listUsers(): Promise<UserAccount[]> {
    const response = await this.http.get<unknown>('/users');
    return listPayload(response, 'users').map((item) => normalizeUserAccount(item));
  }

  async listBatchAssignableUsers(datasetId: DatasetId): Promise<UserAccount[]> {
    const response = await this.http.get<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/qc/assignable-users`,
    );
    return listPayload(response, 'users').map((item) => normalizeUserAccount(item));
  }

  async createUser(payload: UserCreatePayload): Promise<UserAccount> {
    const response = await this.http.post<unknown>('/users', {
      user_id: payload.userId ?? payload.username,
      display_name: payload.displayName,
      email: payload.email,
      password: payload.password,
      status: payload.status,
    });
    return normalizeUserAccount(response);
  }

  async updateUser(userId: string, payload: UserUpdatePayload): Promise<UserAccount> {
    const response = await this.http.patch<unknown>(`/users/${encodeURIComponent(userId)}`, {
      display_name: payload.displayName,
      email: payload.email,
      password: payload.password,
      status: payload.status,
    });
    return normalizeUserAccount(response);
  }

  async listRoleBindings(): Promise<RoleBinding[]> {
    const response = await this.http.get<unknown>('/role-bindings');
    return listPayload(response, 'role_bindings').map((item) => normalizeRoleBinding(item));
  }

  async createRoleBinding(payload: RoleBindingCreatePayload): Promise<RoleBinding> {
    const response = await this.http.post<unknown>('/role-bindings', {
      user_id: payload.userId,
      role: payload.role,
      scope_type: payload.scopeType,
      scope_id: payload.scopeId,
    });
    return normalizeRoleBinding(response);
  }

  async deleteRoleBinding(bindingId: string): Promise<void> {
    await this.http.delete<unknown>(`/role-bindings/${encodeURIComponent(bindingId)}`);
  }

  async getRbacCatalog(): Promise<RbacCatalog> {
    try {
      const response = await this.http.get<unknown>('/rbac/catalog');
      return normalizeRbacCatalog(response);
    } catch (err) {
      if (err instanceof ApiClientError && [404, 405, 501].includes(err.status)) {
        return fallbackRbacCatalog();
      }
      throw err;
    }
  }

  async listDatasets(): Promise<Dataset[]> {
    const payload = await this.http.get<unknown>('/datasets');
    return listPayload(payload, 'datasets').map((item) => normalizeDataset(item));
  }

  async listDatasetTypes(): Promise<DatasetType[]> {
    const payload = await this.http.get<unknown>('/dataset-types');
    return listPayload(payload, 'dataset_types').map((item) => normalizeDatasetType(item));
  }

  async getDatasetType(datasetType: DatasetTypeId): Promise<DatasetType> {
    try {
      const payload = await this.http.get<unknown>(`/dataset-types/${encodeURIComponent(datasetType)}`);
      return normalizeDatasetType(payload);
    } catch (err) {
      if (err instanceof ApiClientError && [404, 405, 501].includes(err.status)) {
        const types = await this.listDatasetTypes();
        const match = types.find((item) => item.datasetType === datasetType);
        if (match) {
          return match;
        }
      }
      throw err;
    }
  }

  async createDatasetType(payload: DatasetTypeCreatePayload): Promise<DatasetType> {
    const response = await this.http.post<unknown>('/dataset-types', {
      dataset_type: payload.datasetType,
      display_name: payload.displayName,
      field_schema_version: payload.fieldSchemaVersion || 'draft',
    });
    return normalizeDatasetType(response);
  }

  async deleteDatasetBatch(batchId: DatasetBatchId): Promise<void> {
    await this.http.delete<unknown>(`/datasets/${encodeURIComponent(batchId)}`);
  }

  async getDatasetBatchSummary(batchId: DatasetBatchId): Promise<DatasetSummary> {
    return this.getDatasetSummary(batchId);
  }

  async getDatasetSummary(datasetId: DatasetId): Promise<DatasetSummary> {
    const payload = await this.http.get<unknown>(`/datasets/${encodeURIComponent(datasetId)}/summary`);
    return normalizeDatasetSummary(payload, datasetId);
  }

  async getDatasetBatchAssetSummary(batchId: DatasetBatchId): Promise<AssetSummary> {
    return this.getAssetSummary(batchId);
  }

  async getAssetSummary(datasetId: DatasetId): Promise<AssetSummary> {
    const payload = await this.http.get<unknown>(`/datasets/${encodeURIComponent(datasetId)}/assets/summary`);
    return normalizeAssetSummary(payload, datasetId);
  }

  async listDatasetBatchAssets(batchId: DatasetBatchId, filters: AssetListFilters = {}): Promise<AssetListItem[]> {
    return this.listAssets(batchId, filters);
  }

  async listAssets(datasetId: DatasetId, filters: AssetListFilters = {}): Promise<AssetListItem[]> {
    const search = new URLSearchParams();
    const queryMap: Record<keyof AssetListFilters, string> = {
      judgeDecision: 'judge_decision',
      stage1Status: 'stage1_status',
      stage2State: 'failure_status',
      qcStatus: 'qc_status',
      violationCategory: 'category',
      sampleCategory: 'sample_category',
      confidenceMin: 'confidence_min',
      confidenceMax: 'confidence_max',
      mediaStatus: 'media_status',
      labelEditStatus: 'label_edit_status',
      search: 'search',
    };

    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all') {
        search.set(queryMap[key as keyof AssetListFilters] ?? key, String(value));
      }
    });

    const query = search.toString();
    const payload = await this.http.get<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/assets${query ? `?${query}` : ''}`,
    );
    return listPayload(payload, 'assets').map((item) => normalizeAssetItem(item, datasetId));
  }

  async listImportJobs(datasetId: DatasetId): Promise<ImportJobSummary[]> {
    const payload = await this.http.get<unknown>(`/datasets/${encodeURIComponent(datasetId)}/import-jobs`);
    return listPayload(payload, 'import_jobs').map((item) => normalizeImportJobSummary(item, datasetId));
  }

  async listDatasetBatchImportJobs(batchId: DatasetBatchId): Promise<ImportJobSummary[]> {
    return this.listImportJobs(batchId);
  }

  async createDatasetBatchImportJob(batchId: DatasetBatchId, payload: ImportJobCreatePayload): Promise<ImportJobDetail> {
    return this.createImportJob(batchId, payload);
  }

  async createImportJob(datasetId: DatasetId, payload: ImportJobCreatePayload): Promise<ImportJobDetail> {
    const response = await this.http.post<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/import-jobs`,
      toBackendImportJobCreatePayload(payload),
    );
    return normalizeImportJob(response, datasetId, 'new-import-job');
  }

  async createImportJobArchive(datasetId: DatasetId, payload: ImportArchiveUploadPayload): Promise<ImportJobDetail> {
    const search = new URLSearchParams();
    search.set('batch_key', payload.batchKey);
    if (payload.batchName) {
      search.set('batch_name', payload.batchName);
    }
    if (payload.datasetType) {
      search.set('dataset_type', payload.datasetType);
    }
    if (payload.sourceStructure) {
      search.set('source_structure', payload.sourceStructure);
    }
    if (payload.description) {
      search.set('description', payload.description);
    }
    search.set('archive_file_name', payload.archiveFileName ?? payload.archiveFile.name);
    const response = await this.http.postRawWithProgress<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/import-jobs/archive?${search.toString()}`,
      payload.archiveFile,
      {
        headers: {
          'content-type': payload.archiveFile.type || 'application/zip',
        },
        onUploadProgress: payload.onUploadProgress,
      },
    );
    return normalizeImportJob(response, datasetId, 'new-import-job');
  }

  async getDatasetBatchImportJob(batchId: DatasetBatchId, jobId: ImportJobId): Promise<ImportJobDetail> {
    return this.getImportJob(batchId, jobId);
  }

  async getImportJob(datasetId: DatasetId, jobId: ImportJobId): Promise<ImportJobDetail> {
    const payload = await this.http.get<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/import-jobs/${encodeURIComponent(jobId)}`,
    );
    return normalizeImportJob(payload, datasetId, jobId);
  }

  async scanImportJob(datasetId: DatasetId, jobId: ImportJobId): Promise<ImportJobDetail> {
    return this.runImportJobAction(datasetId, jobId, 'scan');
  }

  async validateImportJob(datasetId: DatasetId, jobId: ImportJobId): Promise<ImportJobDetail> {
    return this.runImportJobAction(datasetId, jobId, 'validate');
  }

  async confirmImportJob(datasetId: DatasetId, jobId: ImportJobId): Promise<ImportJobDetail> {
    return this.runImportJobAction(datasetId, jobId, 'confirm');
  }

  async retryImportJob(datasetId: DatasetId, jobId: ImportJobId): Promise<ImportJobDetail> {
    return this.runImportJobAction(datasetId, jobId, 'retry');
  }

  private async runImportJobAction(
    datasetId: DatasetId,
    jobId: ImportJobId,
    action: 'scan' | 'validate' | 'confirm' | 'retry',
  ): Promise<ImportJobDetail> {
    const response = await this.http.post<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/import-jobs/${encodeURIComponent(jobId)}/${action}`,
    );
    return normalizeImportJob(response, datasetId, jobId);
  }

  async getPreannotationSummary(datasetId: DatasetId): Promise<PreannotationSummary> {
    const payload = await this.http.get<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/summary`,
    );
    return normalizePreannotationSummary(payload, datasetId);
  }

  async getDatasetBatchPreannotationSummary(batchId: DatasetBatchId): Promise<PreannotationSummary> {
    return this.getPreannotationSummary(batchId);
  }

  async listDatasetBatchQcQueue(batchId: DatasetBatchId): Promise<QcQueueItem[]> {
    return this.listQcQueue(batchId);
  }

  async listQcQueue(datasetId: DatasetId): Promise<QcQueueItem[]> {
    const payload = await this.http.get<unknown>(`/datasets/${encodeURIComponent(datasetId)}/qc`);
    return listPayload(payload, 'queue').map((item) => normalizeQcQueueItem(item, datasetId));
  }

  async getDatasetBatchQcWorkspace(batchId: DatasetBatchId): Promise<QcWorkspace> {
    return this.getQcWorkspace(batchId);
  }

  async getQcWorkspace(datasetId: DatasetId): Promise<QcWorkspace> {
    const payload = await this.http.get<unknown>(`/datasets/${encodeURIComponent(datasetId)}/qc`);
    return normalizeQcWorkspace(payload, datasetId);
  }

  async generateQcQueue(datasetId: DatasetId): Promise<QcWorkspace> {
    const payload = await this.http.post<unknown>(`/datasets/${encodeURIComponent(datasetId)}/qc/generate`);
    return normalizeQcWorkspace(payload, datasetId);
  }

  async getQcProgress(datasetId: DatasetId): Promise<QcProgress> {
    const payload = await this.http.get<unknown>(`/datasets/${encodeURIComponent(datasetId)}/qc/progress`);
    return normalizeQcProgressDetail(payload, datasetId);
  }

  async getDatasetBatchQcProgress(batchId: DatasetBatchId): Promise<QcProgress> {
    return this.getQcProgress(batchId);
  }

  async getDatasetBatchQcModificationEventStats(batchId: DatasetBatchId): Promise<QcModificationEventStats> {
    return this.getQcModificationEventStats(batchId);
  }

  async getQcModificationEventStats(datasetId: DatasetId): Promise<QcModificationEventStats> {
    const payload = await this.http.get<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/qc/modification-events/stats`,
    );
    return normalizeQcModificationEventStats(payload, datasetId);
  }

  async listDatasetBatchQcModificationEvents(batchId: DatasetBatchId): Promise<QcModificationEvent[]> {
    return this.listQcModificationEvents(batchId);
  }

  async listQcModificationEvents(datasetId: DatasetId): Promise<QcModificationEvent[]> {
    const payload = await this.http.get<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/qc/modification-events`,
    );
    return listPayload(payload, 'events').map((item) => normalizeQcModificationEvent(item, datasetId));
  }

  async listSamplePoolItems(filters: SamplePoolListFilters = {}): Promise<SamplePoolItem[]> {
    const payload = await this.http.get<unknown>(`/sample-pool${samplePoolFilterQuery(filters)}`);
    return listPayload(payload, 'items').map((item) => normalizeSamplePoolItem(item));
  }

  async getSamplePoolStats(filters: SamplePoolListFilters = {}): Promise<SamplePoolStats> {
    const payload = await this.http.get<unknown>(`/sample-pool/stats${samplePoolFilterQuery(filters)}`);
    return normalizeSamplePoolStats(payload);
  }

  async getSamplePoolItem(itemId: string): Promise<SamplePoolItemDetail> {
    const payload = await this.http.get<unknown>(`/sample-pool/items/${encodeURIComponent(itemId)}`);
    return normalizeSamplePoolItemDetail(payload, itemId);
  }

  async createTrainingExport(payload: TrainingExportCreatePayload): Promise<TrainingExportJob> {
    const response = await this.http.post<unknown>('/exports', {
      format: payload.format,
      source: payload.source,
      filters: samplePoolFiltersToBackend(payload.filters ?? {}),
    });
    return normalizeTrainingExportJob(response);
  }

  async listTrainingExports(): Promise<TrainingExportJob[]> {
    const payload = await this.http.get<unknown>('/exports');
    return listPayload(payload, 'exports').map((item) => normalizeTrainingExportJob(item));
  }

  async getTrainingExport(exportId: string): Promise<TrainingExportJob> {
    const payload = await this.http.get<unknown>(`/exports/${encodeURIComponent(exportId)}`);
    return normalizeTrainingExportJob(payload, exportId);
  }

  async downloadTrainingExport(exportId: string): Promise<TrainingExportDownload> {
    const path = `/exports/${encodeURIComponent(exportId)}/download`;
    const payload = await this.http.get<unknown>(path);
    return normalizeTrainingExportDownload(payload, exportId, this.http.url(path));
  }

  getTrainingExportDownloadUrl(exportId: string): string {
    return this.http.url(`/exports/${encodeURIComponent(exportId)}/download`);
  }

  async cancelTrainingExport(exportId: string): Promise<TrainingExportJob> {
    const payload = await this.http.post<unknown>(`/exports/${encodeURIComponent(exportId)}/cancel`);
    return normalizeTrainingExportJob(payload, exportId);
  }

  async createDatasetBatchEvaluation(
    batchId: DatasetBatchId,
    payload: ModelEvaluationCreatePayload,
  ): Promise<ModelEvaluationRun> {
    return this.createModelEvaluation(batchId, payload);
  }

  async createModelEvaluation(datasetId: DatasetId, payload: ModelEvaluationCreatePayload): Promise<ModelEvaluationRun> {
    const response = await this.http.post<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/evaluations`,
      toBackendModelEvaluationCreatePayload(payload),
    );
    return normalizeModelEvaluationRun(response, datasetId);
  }

  async listDatasetBatchEvaluations(batchId: DatasetBatchId): Promise<ModelEvaluationRun[]> {
    return this.listModelEvaluations(batchId);
  }

  async listModelEvaluations(datasetId: DatasetId): Promise<ModelEvaluationRun[]> {
    const payload = await this.http.get<unknown>(`/datasets/${encodeURIComponent(datasetId)}/evaluations`);
    return listPayload(payload, 'evaluations').map((item) => normalizeModelEvaluationRun(item, datasetId));
  }

  async getDatasetBatchEvaluation(batchId: DatasetBatchId, evaluationId: string): Promise<ModelEvaluationRun> {
    return this.getModelEvaluation(batchId, evaluationId);
  }

  async getModelEvaluation(datasetId: DatasetId, evaluationId: string): Promise<ModelEvaluationRun> {
    const payload = await this.http.get<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/evaluations/${encodeURIComponent(evaluationId)}`,
    );
    return normalizeModelEvaluationRun(payload, datasetId, evaluationId);
  }

  async compareModelEvaluations(leftId: string, rightId: string): Promise<ModelEvaluationCompareResult> {
    const search = new URLSearchParams({ left_id: leftId, right_id: rightId });
    const payload = await this.http.get<unknown>(`/evaluations/compare?${search.toString()}`);
    return normalizeModelEvaluationCompare(payload, leftId, rightId);
  }

  async listModelEvaluationDeltaSamples(evaluationId: string): Promise<ModelEvaluationDeltaSample[]> {
    const payload = await this.http.get<unknown>(`/evaluations/${encodeURIComponent(evaluationId)}/delta-samples`);
    return listPayload(payload, 'samples').map((item) => normalizeModelEvaluationDeltaSample(item));
  }

  async listDatasetBatchSnapshots(batchId: DatasetBatchId): Promise<AnnotationSnapshot[]> {
    return this.listSnapshots(batchId);
  }

  async listSnapshots(datasetId: DatasetId): Promise<AnnotationSnapshot[]> {
    const payload = await this.http.get<unknown>(`/datasets/${encodeURIComponent(datasetId)}/snapshots`);
    return listPayload(payload, 'snapshots').map((item) => normalizeAnnotationSnapshot(item, datasetId));
  }

  async diffDatasetBatchSnapshots(
    batchId: DatasetBatchId,
    leftSnapshotId: string,
    rightSnapshotId: string,
  ): Promise<AnnotationSnapshotDiff> {
    return this.diffSnapshots(batchId, leftSnapshotId, rightSnapshotId);
  }

  async diffSnapshots(datasetId: DatasetId, leftSnapshotId: string, rightSnapshotId: string): Promise<AnnotationSnapshotDiff> {
    const search = new URLSearchParams({ left_snapshot_id: leftSnapshotId, right_snapshot_id: rightSnapshotId });
    const payload = await this.http.get<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/snapshots/diff?${search.toString()}`,
    );
    return normalizeAnnotationSnapshotDiff(payload, datasetId, leftSnapshotId, rightSnapshotId);
  }

  async getBatchAssignment(datasetId: DatasetId): Promise<BatchQcAssignment | undefined> {
    try {
      const payload = await this.http.get<unknown>(`/datasets/${encodeURIComponent(datasetId)}/qc/assignment`);
      return normalizeBatchAssignment(payload, datasetId);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  async assignBatch(datasetId: DatasetId, payload: BatchAssignmentPayload): Promise<BatchQcAssignment> {
    const response = await this.http.post<unknown>(`/datasets/${encodeURIComponent(datasetId)}/qc/assignment`, {
      assignee_user_id: payload.assigneeUserId,
    });
    return normalizeBatchAssignment(response, datasetId)!;
  }

  async reassignBatch(datasetId: DatasetId, payload: BatchAssignmentPayload): Promise<BatchQcAssignment> {
    const response = await this.http.post<unknown>(`/datasets/${encodeURIComponent(datasetId)}/qc/assignment/reassign`, {
      assignee_user_id: payload.assigneeUserId,
    });
    return normalizeBatchAssignment(response, datasetId)!;
  }

  async releaseBatchAssignment(datasetId: DatasetId): Promise<BatchQcAssignment | undefined> {
    const response = await this.http.post<unknown>(`/datasets/${encodeURIComponent(datasetId)}/qc/assignment/release`, {});
    return normalizeBatchAssignment(response, datasetId);
  }

  async listQcTasks(datasetId: DatasetId): Promise<QcTask[]> {
    const payload = await this.http.get<unknown>(`/datasets/${encodeURIComponent(datasetId)}/qc/tasks`);
    return listPayload(payload, 'tasks').map((item) => normalizeQcTask(item, datasetId));
  }

  async getReviewSample(datasetId: DatasetId, sampleId: SampleId): Promise<ReviewSampleDetail> {
    const payload = await this.http.get<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/samples/${encodeURIComponent(sampleId)}/review`,
    );
    return normalizeReviewSample(payload, datasetId, sampleId);
  }

  async acquireSampleLease(datasetId: DatasetId, sampleId: SampleId): Promise<SampleLease> {
    const response = await this.http.post<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/samples/${encodeURIComponent(sampleId)}/lease`,
    );
    return normalizeSampleLease(response, datasetId, sampleId)!;
  }

  async heartbeatSampleLease(datasetId: DatasetId, sampleId: SampleId, leaseId: string): Promise<SampleLease> {
    const response = await this.http.post<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/samples/${encodeURIComponent(sampleId)}/lease/${encodeURIComponent(leaseId)}/heartbeat`,
    );
    return normalizeSampleLease(response, datasetId, sampleId)!;
  }

  async releaseSampleLease(
    datasetId: DatasetId,
    sampleId: SampleId,
    leaseId: string,
  ): Promise<SampleLease | undefined> {
    const response = await this.http.post<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/samples/${encodeURIComponent(sampleId)}/lease/${encodeURIComponent(leaseId)}/release`,
    );
    return normalizeSampleLease(response, datasetId, sampleId);
  }

  async submitReviewDecision(
    datasetId: DatasetId,
    sampleId: SampleId,
    payload: SubmitReviewPayload,
  ): Promise<HumanReview> {
    const response = await this.http.post<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/samples/${encodeURIComponent(sampleId)}/review`,
      {
        decision: payload.decision,
        notes: payload.notes ?? '',
        reviewer: payload.reviewer ?? 'frontend-user',
        label_config_id: payload.labelConfigId,
        label_config_version: payload.labelConfigVersion,
        patch: payload.patch,
      },
    );
    return normalizeHumanReview(response, sampleId);
  }

  async validateLabelConfig(
    datasetId: DatasetId,
    payload: Omit<LabelConfigUploadPayload, 'activate'>,
  ): Promise<LabelConfigValidationResult> {
    return this.validateDatasetTypeLabelConfig(datasetId, payload);
  }

  async validateDatasetTypeLabelConfig(
    datasetTypeId: DatasetTypeId,
    payload: Omit<LabelConfigUploadPayload, 'activate'>,
  ): Promise<LabelConfigValidationResult> {
    const response = await this.http.post<unknown>(
      `/dataset-types/${encodeURIComponent(datasetTypeId)}/label-configs/validate`,
      {
        file_name: payload.fileName,
        config: payload.config,
      },
    );
    return normalizeLabelConfigValidation(response, datasetTypeId);
  }

  async saveLabelConfig(datasetId: DatasetId, payload: LabelConfigUploadPayload): Promise<LabelConfigSaveResult> {
    return this.saveDatasetTypeLabelConfig(datasetId, payload);
  }

  async saveDatasetTypeLabelConfig(datasetTypeId: DatasetTypeId, payload: LabelConfigUploadPayload): Promise<LabelConfigSaveResult> {
    const requestBody: Record<string, unknown> = {
      file_name: payload.fileName,
      config: payload.config,
      activate: Boolean(payload.activate),
    };
    if (payload.saveAsNewVersion === true) {
      requestBody.save_as_new_version = true;
    }
    const response = await this.http.post<unknown>(
      `/dataset-types/${encodeURIComponent(datasetTypeId)}/label-configs`,
      requestBody,
    );
    return normalizeLabelConfigSaveResult(response, datasetTypeId);
  }

  async listLabelConfigs(datasetId: DatasetId): Promise<LabelConfigSaveResult[]> {
    return this.listDatasetTypeLabelConfigs(datasetId);
  }

  async listDatasetTypeLabelConfigs(datasetTypeId: DatasetTypeId): Promise<LabelConfigSaveResult[]> {
    const response = await this.http.get<unknown>(
      `/dataset-types/${encodeURIComponent(datasetTypeId)}/label-configs`,
    );
    return listPayload(response, 'configs').map((item) => normalizeLabelConfigSaveResult(item, datasetTypeId));
  }

  async activateLabelConfig(datasetId: DatasetId, configId: string): Promise<LabelConfigSaveResult> {
    return this.activateDatasetTypeLabelConfig(datasetId, configId);
  }

  async activateDatasetTypeLabelConfig(datasetTypeId: DatasetTypeId, configId: string): Promise<LabelConfigSaveResult> {
    const response = await this.http.post<unknown>(
      `/dataset-types/${encodeURIComponent(datasetTypeId)}/label-configs/${encodeURIComponent(configId)}/activate`,
    );
    return normalizeLabelConfigSaveResult(response, datasetTypeId);
  }

  async reloadActiveLabelConfig(datasetId: DatasetId): Promise<LabelConfigSaveResult> {
    return this.reloadActiveDatasetTypeLabelConfig(datasetId);
  }

  async reloadActiveDatasetTypeLabelConfig(datasetTypeId: DatasetTypeId): Promise<LabelConfigSaveResult> {
    const response = await this.http.post<unknown>(
      `/dataset-types/${encodeURIComponent(datasetTypeId)}/label-config/active/reload`,
    );
    return normalizeLabelConfigSaveResult(response, datasetTypeId);
  }

  async getActiveLabelConfig(datasetId: DatasetId): Promise<LabelConfig> {
    return this.getActiveDatasetTypeLabelConfig(datasetId);
  }

  async getActiveDatasetTypeLabelConfig(datasetTypeId: DatasetTypeId): Promise<LabelConfig> {
    const response = await this.http.get<unknown>(
      `/dataset-types/${encodeURIComponent(datasetTypeId)}/label-config/active`,
    );
    return normalizeLabelConfig(response, datasetTypeId);
  }

  async getLabelSuggestions(datasetId: DatasetId, field: string, query = ''): Promise<LabelSuggestion[]> {
    const search = new URLSearchParams({ field, q: query });
    const response = await this.http.get<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/label-suggestions?${search.toString()}`,
    );
    return normalizeLabelSuggestions(response);
  }

  async validateLabelEdit(
    datasetId: DatasetId,
    sampleId: SampleId,
    payload: LabelEditPatchPayload,
  ): Promise<LabelEditValidationResult> {
    const response = await this.http.post<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/samples/${encodeURIComponent(sampleId)}/label-edits/validate`,
      toBackendLabelEditPayload(payload),
    );
    return normalizeLabelEditValidation(response);
  }

  async getMyLabelEditDraft(datasetId: DatasetId, sampleId: SampleId): Promise<LabelEditDraft | undefined> {
    const response = await this.http.get<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/samples/${encodeURIComponent(sampleId)}/label-edits/my-draft`,
    );
    return normalizeLabelEditDraft(response, datasetId, sampleId);
  }

  async getLabelEditHistory(datasetId: DatasetId, sampleId: SampleId): Promise<LabelEditSubmission[]> {
    const response = await this.http.get<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/samples/${encodeURIComponent(sampleId)}/label-edits/history`,
    );
    return listPayload(response, 'submissions').map((item) => normalizeLabelEditSubmission(item, datasetId, sampleId));
  }

  async submitLabelEdit(
    datasetId: DatasetId,
    sampleId: SampleId,
    payload: LabelEditSubmitPayload,
  ): Promise<LabelEditSubmitResult> {
    try {
      const response = await this.http.post<unknown>(
        `/datasets/${encodeURIComponent(datasetId)}/samples/${encodeURIComponent(sampleId)}/label-edits`,
        toBackendLabelEditPayload(payload),
      );
      return normalizeLabelEditSubmit(response, payload, sampleId);
    } catch (error) {
      const validation = validationReportFromApiError(error);
      if (validation) {
        throw new LabelEditValidationError(validation);
      }
      throw error;
    }
  }

  async getMyBatchLabelEditDraft(datasetId: DatasetId): Promise<BatchLabelEditDraft> {
    const response = await this.http.get<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/label-edits/my-batch-draft`,
    );
    return normalizeBatchLabelEditDraft(response, datasetId);
  }

  async saveMyBatchLabelEditDraft(
    datasetId: DatasetId,
    payload: BatchLabelEditDraftPayload,
  ): Promise<BatchLabelEditDraftSaveResult> {
    const response = await this.http.put<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/label-edits/my-batch-draft`,
      toBackendBatchLabelEditDraftPayload(payload),
    );
    return normalizeBatchLabelEditDraftSave(response, datasetId, payload);
  }

  async autosaveMyBatchLabelEditDraft(
    datasetId: DatasetId,
    payload: BatchLabelEditDraftPayload,
  ): Promise<BatchLabelEditDraftSaveResult> {
    const response = await this.http.post<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/label-edits/my-batch-draft/autosave`,
      toBackendBatchLabelEditDraftPayload(payload),
    );
    return normalizeBatchLabelEditDraftSave(response, datasetId, payload);
  }

  async submitBatchLabelEdits(
    datasetId: DatasetId,
    payload: BatchLabelEditSubmitPayload,
  ): Promise<BatchLabelEditSubmitResult> {
    const response = await this.http.post<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/label-edits/submit-batch`,
      toBackendBatchLabelEditSubmitPayload(payload),
    );
    return normalizeBatchLabelEditSubmit(response, datasetId);
  }

  async confirmLabelEditSubmission(
    datasetId: DatasetId,
    sampleId: SampleId,
    submissionId: string,
  ): Promise<LabelEditSubmission> {
    const response = await this.http.post<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/samples/${encodeURIComponent(sampleId)}/label-edits/${encodeURIComponent(submissionId)}/confirm`,
    );
    return normalizeLabelEditSubmission(response, datasetId, sampleId);
  }

  async returnLabelEditSubmission(
    datasetId: DatasetId,
    sampleId: SampleId,
    submissionId: string,
    reason = '',
  ): Promise<LabelEditSubmission> {
    const response = await this.http.post<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/samples/${encodeURIComponent(sampleId)}/label-edits/${encodeURIComponent(submissionId)}/return`,
      { reason },
    );
    return normalizeLabelEditSubmission(response, datasetId, sampleId);
  }

  async listAuditEvents(filters: AuditEventFilters = {}): Promise<AuditEvent[]> {
    const search = new URLSearchParams();
    if (filters.datasetId) search.set('dataset_id', filters.datasetId);
    if (filters.sampleId) search.set('sample_id', filters.sampleId);
    if (filters.actorUserId) search.set('actor_user_id', filters.actorUserId);
    if (filters.action) search.set('action', filters.action);
    const query = search.toString();
    const response = await this.http.get<unknown>(`/audit-events${query ? `?${query}` : ''}`);
    return listPayload(response, 'audit_events').map((item) => normalizeAuditEvent(item));
  }
}

export const createUrbanViolationApi = (): UrbanViolationApi =>
  apiMode === 'fixture' ? fixtureApiClient : new HttpUrbanViolationApi();

export const apiClient = createUrbanViolationApi();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const stringValue = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);
const numberValue = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const booleanValue = (value: unknown, fallback = false) => (typeof value === 'boolean' ? value : fallback);
const arrayValue = <T = unknown>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const optionalDisplayString = (value: unknown) => {
  if (typeof value === 'string' && value) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
};

const listPayload = (payload: unknown, preferredKey: string): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!isRecord(payload)) {
    return [];
  }

  const candidates = [preferredKey, 'items', 'results', 'data'];
  for (const key of candidates) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  return [];
};

const samplePoolFilterQuery = (filters: SamplePoolListFilters) => {
  const search = new URLSearchParams(samplePoolFiltersToBackend(filters));
  const query = search.toString();
  return query ? `?${query}` : '';
};

const samplePoolFiltersToBackend = (filters: SamplePoolListFilters) => {
  const payload: Record<string, string> = {};
  const queryMap: Array<[keyof SamplePoolListFilters, string]> = [
    ['datasetType', 'dataset_type'],
    ['batchId', 'batch_id'],
    ['category', 'category'],
    ['attribution', 'attribution'],
    ['eventType', 'event_type'],
    ['reviewer', 'reviewer'],
    ['status', 'status'],
    ['search', 'search'],
  ];
  queryMap.forEach(([key, param]) => {
    const value = filters[key];
    if (value && value !== 'all') {
      payload[param] = String(value);
    }
  });
  return payload;
};

const toBackendModelEvaluationCreatePayload = (payload: ModelEvaluationCreatePayload) => ({
  model_version: payload.modelVersion,
  model_name: payload.modelName,
  source_export_id: payload.sourceExportId,
  source_snapshot_id: payload.sourceSnapshotId,
  notes: payload.notes,
  parameters: payload.parameters,
});

const normalizeRole = (value: unknown): UserRole | undefined => {
  const source = isRecord(value) ? value.role : value;
  const role = stringValue(source);
  return role ? (role as UserRole) : undefined;
};

const normalizeRoleList = (value: unknown): UserRole[] =>
  arrayValue<unknown>(value).flatMap((item) => {
    const role = normalizeRole(item);
    return role ? [role] : [];
  });

const normalizeUserAccount = (value: unknown): UserAccount => {
  const record = isRecord(value) ? value : {};
  const userId = stringValue(record.userId ?? record.user_id ?? record.username, 'unknown-user');
  return {
    userId,
    username: optionalString(record.username) ?? userId,
    displayName: stringValue(record.displayName ?? record.display_name ?? record.name, userId),
    email: optionalString(record.email),
    status: stringValue(record.status, 'active') as UserAccount['status'],
    createdAt: optionalString(record.createdAt ?? record.created_at),
    lastSeenAt: optionalString(record.lastSeenAt ?? record.last_seen_at),
    roles: normalizeRoleList(record.roles),
    roleBindings: listPayload(record.roleBindings ?? record.role_bindings, 'role_bindings').map((item) =>
      normalizeRoleBinding(item),
    ),
  };
};

const normalizeCurrentUser = (value: unknown): CurrentUser => {
  const record = isRecord(value) ? value : {};
  const userSource = isRecord(record.current_user) ? record.current_user : isRecord(record.user) ? record.user : record;
  const user = normalizeUserAccount(userSource);
  const backendRolesAsBindings = arrayValue<unknown>(record.roles).some((item) => isRecord(item))
    ? record.roles
    : undefined;
  const roleBindings = listPayload(
    record.roleBindings ?? record.role_bindings ?? userSource.role_bindings ?? backendRolesAsBindings,
    'role_bindings',
  ).map((item) => normalizeRoleBinding(item));
  const roles = normalizeRoleList(record.roles ?? userSource.roles);
  return {
    ...user,
    roleBindings: roleBindings.length ? roleBindings : user.roleBindings,
    authMode: stringValue(record.authMode ?? record.auth_mode ?? userSource.auth_mode, 'session'),
    roles: roles.length ? roles : user.roles ?? [],
    permissions: normalizeStringList(record.permissions ?? userSource.permissions),
  };
};

const normalizeRoleBinding = (value: unknown): RoleBinding => {
  const record = isRecord(value) ? value : {};
  return {
    bindingId: stringValue(record.bindingId ?? record.binding_id, `binding-${stringValue(record.user_id ?? record.userId)}`),
    userId: stringValue(record.userId ?? record.user_id),
    role: stringValue(record.role, 'annotator') as RoleBinding['role'],
    scopeType: stringValue(record.scopeType ?? record.scope_type, 'dataset_batch') as RoleBinding['scopeType'],
    scopeId: stringValue(record.scopeId ?? record.scope_id, '*'),
    createdAt: optionalString(record.createdAt ?? record.created_at),
    createdBy: optionalString(record.createdBy ?? record.created_by),
  };
};

const defaultRoleCatalog: RbacCatalogRole[] = [
  {
    role: 'platform_admin',
    label: '平台管理员',
    description: '管理账号、角色、审计与全平台配置',
    permissions: [
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
    ],
  },
  {
    role: 'dataset_admin',
    label: '数据集管理员',
    description: '管理数据集类型、标签配置和批次生命周期',
    permissions: [
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
    ],
  },
  {
    role: 'batch_manager',
    label: '批次管理员',
    description: '管理批次分配、质检队列和批次状态',
    permissions: [
      'import_job:manage',
      'batch_assignment:manage',
      'lease:force_release',
      'dataset:read',
      'qc_queue:read',
      'audit:read',
      'qc_progress:read',
      'label_edit:write',
    ],
  },
  {
    role: 'qc_lead',
    label: '质检负责人',
    description: '确认标注修改、退回问题样本和查看审计记录',
    permissions: [
      'dataset:read',
      'qc_queue:read',
      'batch_assignment:manage',
      'lease:force_release',
      'label_edit:write',
      'label_edit:confirm',
      'audit:read',
      'qc_progress:read',
    ],
  },
  {
    role: 'annotator',
    label: '标注员',
    description: '领取样本、编辑标签并提交修改',
    permissions: ['dataset:read', 'qc_queue:read', 'label_edit:write', 'audit:read_own', 'qc_progress:read_own'],
  },
  {
    role: 'auditor',
    label: '审计员',
    description: '查看操作审计和权限变更记录',
    permissions: ['dataset:read', 'qc_queue:read', 'audit:read', 'qc_progress:read'],
  },
];

const defaultScopeCatalog: RbacCatalogScope[] = [
  { scopeType: 'platform', label: '全平台', description: '作用于全部数据集类型与批次' },
  { scopeType: 'dataset_type', label: '数据集类型', description: '作用于一个数据集类型及其批次' },
  { scopeType: 'dataset_batch', label: '数据集批次', description: '仅作用于一个具体批次' },
];

const fallbackRbacCatalog = (): RbacCatalog => ({
  roles: defaultRoleCatalog,
  scopes: defaultScopeCatalog,
  permissions: Array.from(new Set(defaultRoleCatalog.flatMap((role) => role.permissions))),
});

const normalizeRbacRole = (value: unknown): RbacCatalogRole => {
  const record = isRecord(value) ? value : {};
  const role = stringValue(record.role ?? record.value, 'annotator') as UserRole;
  const fallback = defaultRoleCatalog.find((item) => item.role === role);
  return {
    role,
    label: stringValue(record.label ?? record.label_zh ?? record.name, fallback?.label ?? role),
    description: optionalString(record.description ?? record.usage ?? record.help) ?? fallback?.description,
    permissions: normalizeStringList(record.permissions).length
      ? normalizeStringList(record.permissions)
      : fallback?.permissions ?? [],
  };
};

const normalizeRbacScope = (value: unknown): RbacCatalogScope => {
  const record = isRecord(value) ? value : {};
  const scopeType = stringValue(
    isRecord(value) ? record.scopeType ?? record.scope_type ?? record.value : value,
    'dataset_batch',
  ) as RoleScopeType;
  const fallback = defaultScopeCatalog.find((item) => item.scopeType === scopeType);
  return {
    scopeType,
    label: stringValue(record.label ?? record.label_zh ?? record.name, fallback?.label ?? scopeType),
    description: optionalString(record.description ?? record.help) ?? fallback?.description,
  };
};

const normalizeRbacCatalog = (value: unknown): RbacCatalog => {
  const record = isRecord(value) ? value : {};
  const roles = listPayload(record.roles ?? record.role_catalog, 'roles').map((item) => normalizeRbacRole(item));
  const scopes = listPayload(record.scopes ?? record.scope_catalog ?? record.scope_types, 'scopes').map((item) =>
    normalizeRbacScope(item),
  );
  const normalizedRoles = roles.length ? roles : defaultRoleCatalog;
  const normalizedScopes = scopes.length ? scopes : defaultScopeCatalog;
  const permissions = normalizeStringList(record.permissions);
  return {
    roles: normalizedRoles,
    scopes: normalizedScopes,
    permissions: permissions.length
      ? permissions
      : Array.from(new Set(normalizedRoles.flatMap((role) => role.permissions))),
  };
};

const isBackendDataset = (value: unknown): value is BackendDataset =>
  isRecord(value) && typeof value.dataset_id === 'string';

const deriveDatasetType = (datasetId: string, name = '') => {
  if (datasetId.includes('__')) {
    return datasetId.split('__')[0];
  }
  return name || datasetId || 'unknown_type';
};

const deriveBatchKey = (datasetId: string) => {
  if (datasetId.includes('__')) {
    return datasetId.split('__').slice(1).join('__');
  }
  return datasetId || 'default_batch';
};

const normalizeDataset = (value: unknown, fallbackId = 'unknown-dataset'): Dataset => {
  if (isBackendDataset(value)) {
    const datasetType = stringValue(value.dataset_type, deriveDatasetType(value.dataset_id, value.name));
    const batchKey = stringValue(value.batch_key, deriveBatchKey(value.dataset_id));
    const lifecycleStatus = stringValue(value.lifecycle_status, 'active') as Dataset['status'];
    return {
      id: value.dataset_id,
      name: value.name,
      version: 'live',
      status: lifecycleStatus,
      datasetType,
      batchKey,
      batchName: stringValue(value.batch_name, value.name),
      lifecycleStatus,
      displayName: value.name,
      fieldSchemaVersion: optionalString(value.field_schema_version),
      activeLabelConfigVersion: optionalDisplayString(value.active_label_config_version),
      activeImportJobId: optionalString(value.active_import_job_id),
      qcQueueId: optionalString(value.qc_queue_id),
      assetTotal: value.total_assets,
      stage1Total: value.stage1_count,
      stage2SuccessTotal: value.stage2_success_count,
      stage2FailureTotal: value.stage2_failure_count,
      description: `${value.total_assets} assets imported from backend dataset ${value.dataset_id}.`,
      rootPath: value.root_path,
      sourceMode: optionalString(value.source_mode) as Dataset['sourceMode'],
      sourceUri: optionalString(value.source_uri),
      sourceStructure: optionalString(value.source_structure) as Dataset['sourceStructure'],
      sourceFileCount: maybeNumber(value.source_file_count),
      createdAt: value.created_at,
      updatedAt: value.created_at,
      tags: [],
    };
  }

  const record = isRecord(value) ? value : {};
  const id = stringValue(record.id ?? record.datasetId ?? record.dataset_id, fallbackId);
  const name = stringValue(record.name ?? record.display_name, fallbackId);
  const datasetType = stringValue(record.datasetType ?? record.dataset_type, deriveDatasetType(id, name));
  const batchKey = stringValue(record.batchKey ?? record.batch_key, deriveBatchKey(id));
  const lifecycleStatus = stringValue(
    record.lifecycleStatus ?? record.lifecycle_status ?? record.status,
    'active',
  ) as Dataset['status'];
  return {
    id,
    name,
    version: stringValue(record.version, 'live'),
    status: lifecycleStatus,
    datasetType,
    batchKey,
    batchName: optionalString(record.batchName ?? record.batch_name),
    lifecycleStatus,
    displayName: optionalString(record.displayName ?? record.display_name),
    fieldSchemaVersion: optionalString(record.fieldSchemaVersion ?? record.field_schema_version),
    activeLabelConfigVersion: optionalDisplayString(record.activeLabelConfigVersion ?? record.active_label_config_version),
    activeImportJobId: optionalString(record.activeImportJobId ?? record.active_import_job_id),
    qcQueueId: optionalString(record.qcQueueId ?? record.qc_queue_id),
    assetTotal: maybeNumber(record.assetTotal ?? record.asset_total ?? record.total_assets),
    stage1Total: maybeNumber(record.stage1Total ?? record.stage1_total ?? record.stage1_count),
    stage2SuccessTotal: maybeNumber(record.stage2SuccessTotal ?? record.stage2_success_total ?? record.stage2_success_count),
    stage2FailureTotal: maybeNumber(record.stage2FailureTotal ?? record.stage2_failure_total ?? record.stage2_failure_count),
    qcProgress: normalizeQcProgress(record.qcProgress ?? record.qc_progress),
    latestImportJob: isRecord(record.latestImportJob ?? record.latest_import_job)
      ? normalizeImportJobSummary(record.latestImportJob ?? record.latest_import_job, id)
      : undefined,
    description: stringValue(record.description, ''),
    rootPath: stringValue(record.rootPath ?? record.root_path, ''),
    sourceMode: optionalString(record.sourceMode ?? record.source_mode) as Dataset['sourceMode'],
    sourceUri: optionalString(record.sourceUri ?? record.source_uri),
    sourceStructure: optionalString(record.sourceStructure ?? record.source_structure) as Dataset['sourceStructure'],
    sourceFileCount: maybeNumber(record.sourceFileCount ?? record.source_file_count),
    createdAt: stringValue(record.createdAt ?? record.created_at, new Date(0).toISOString()),
    updatedAt: stringValue(record.updatedAt ?? record.updated_at ?? record.createdAt, new Date(0).toISOString()),
    tags: arrayValue<string>(record.tags),
    owner: stringValue(record.owner, ''),
  };
};

const normalizeDatasetType = (value: unknown): DatasetType => {
  const record = isRecord(value) ? value : {};
  const datasetType = stringValue(record.datasetType ?? record.dataset_type, 'unknown_type');
  const batches = listPayload(record.batches, 'batches').map((item) => normalizeDataset(item, datasetType));
  return {
    datasetType,
    displayName: stringValue(record.displayName ?? record.display_name, datasetType),
    fieldSchemaVersion: optionalString(record.fieldSchemaVersion ?? record.field_schema_version),
    activeLabelConfigVersion: optionalDisplayString(record.activeLabelConfigVersion ?? record.active_label_config_version),
    status: optionalString(record.status),
    batchCount: maybeNumber(record.batchCount ?? record.batch_count) ?? batches.length,
    batches,
  };
};

const normalizeQcProgress = (value: unknown): Dataset['qcProgress'] | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  return {
    pending: numberValue(value.pending),
    submitted: numberValue(value.submitted),
    total: maybeNumber(value.total),
  };
};

const normalizeDatasetSummary = (payload: unknown, datasetId: DatasetId): DatasetSummary => {
  const record = isRecord(payload) ? payload : {};
  const dataset = normalizeDataset(record.dataset ?? payload, datasetId);
  const rawTotals = isRecord(record.totals) ? record.totals : record;
  const rawCoverage = isRecord(record.coverage) ? record.coverage : {};
  const stage1Parsed = numberValue(rawTotals.stage1Parsed ?? rawTotals.stage1_count, numberValue(record.stage1_count));
  const stage2Parsed = numberValue(rawTotals.stage2Parsed ?? rawTotals.stage2_success_count, numberValue(record.stage2_success_count));
  const rawAssets = numberValue(rawTotals.rawAssets ?? rawTotals.total_assets, numberValue(record.total_assets));
  const totals = {
    rawAssets,
    stage1Parsed,
    stage2Parsed,
    stage2Failures: numberValue(rawTotals.stage2Failures ?? rawTotals.stage2_failure_count, numberValue(record.stage2_failure_count)),
  };
  const coverage = {
    stage1: numberValue(rawCoverage.stage1, rawAssets > 0 ? stage1Parsed / rawAssets : 0),
    stage2: numberValue(rawCoverage.stage2, rawAssets > 0 ? stage2Parsed / rawAssets : 0),
  };
  const latestImportJobValue = firstRecord(
    record.latestImportJob,
    record.latest_import_job,
    record.activeImportJob,
    record.active_import_job,
  );

  return {
    dataset,
    totals,
    coverage,
    qc: normalizeQcSummary(record.qc),
    judgeDecisionDistribution: normalizeDistributionList(record.judgeDecisionDistribution ?? record.judge_decision_distribution),
    violationCategoryDistribution: normalizeDistributionList(record.violationCategoryDistribution ?? record.violation_category_distribution),
    confidenceDistribution: normalizeDistributionList(record.confidenceDistribution ?? record.confidence_distribution),
    visibilityDistribution: normalizeDistributionList(record.visibilityDistribution ?? record.visibility_distribution),
    sampleCategoryDistribution: normalizeDistributionList(record.sampleCategoryDistribution ?? record.sample_category_distribution),
    importWarnings: normalizeWarnings(record.importWarnings ?? record.import_warnings),
    recentRuns: arrayValue<DatasetSummary['recentRuns'][number]>(record.recentRuns ?? record.recent_runs),
    latestImportJob: latestImportJobValue
      ? normalizeImportJobSummary(latestImportJobValue, dataset.id)
      : dataset.latestImportJob,
    assetSummary: normalizeAssetSummary(record.assetSummary ?? record.asset_summary ?? record, dataset.id, {
      dataset,
      totals,
      coverage,
      qc: normalizeQcSummary(record.qc),
      categoryDistribution: normalizeDistributionList(record.violationCategoryDistribution ?? record.violation_category_distribution),
      sampleCategoryDistribution: normalizeDistributionList(record.sampleCategoryDistribution ?? record.sample_category_distribution),
    }),
    metadata: {
      imageSource: stringValue((record.metadata as Record<string, unknown> | undefined)?.imageSource, 'backend API'),
      region: stringValue((record.metadata as Record<string, unknown> | undefined)?.region, 'unknown'),
      collectionRange: stringValue((record.metadata as Record<string, unknown> | undefined)?.collectionRange, 'unknown'),
      imageResolution: stringValue((record.metadata as Record<string, unknown> | undefined)?.imageResolution, '1280x720'),
      fileFormats: arrayValue<string>((record.metadata as Record<string, unknown> | undefined)?.fileFormats),
    },
  };
};

const normalizeQcSummary = (value: unknown): DatasetSummary['qc'] => {
  const record = isRecord(value) ? value : {};
  return {
    total: numberValue(record.total),
    pending: numberValue(record.pending),
    passed: numberValue(record.passed),
    rejected: numberValue(record.rejected),
    needsHumanReview: numberValue(record.needsHumanReview ?? record.needs_human_review),
  };
};

const normalizeQcModificationEventStats = (
  payload: unknown,
  datasetId: DatasetId,
): QcModificationEventStats => {
  const record = isRecord(payload) ? payload : {};
  const bboxOffsetBands = isRecord(record.bboxOffsetBands ?? record.bbox_offset_bands)
    ? (record.bboxOffsetBands ?? record.bbox_offset_bands) as Record<string, unknown>
    : {};

  return {
    datasetId: stringValue(record.datasetId ?? record.dataset_id, datasetId),
    totalEvents: numberValue(record.totalEvents ?? record.total_events),
    changedSampleCount: numberValue(record.changedSampleCount ?? record.changed_sample_count),
    byEventType: arrayValue<unknown>(record.byEventType ?? record.by_event_type).map((item) => {
      const itemRecord = isRecord(item) ? item : {};
      const eventType = stringValue(itemRecord.eventType ?? itemRecord.event_type, 'unknown');
      return {
        eventType,
        label: stringValue(itemRecord.label, eventType),
        count: numberValue(itemRecord.count),
      };
    }),
    byAttribution: arrayValue<unknown>(record.byAttribution ?? record.by_attribution).map((item) => {
      const itemRecord = isRecord(item) ? item : {};
      const code = stringValue(itemRecord.code, 'unknown');
      return {
        code,
        label: stringValue(itemRecord.label, code),
        count: numberValue(itemRecord.count),
        weightSum: maybeNumber(itemRecord.weightSum ?? itemRecord.weight_sum),
      };
    }),
    bboxOffsetBands: {
      micro: numberValue(bboxOffsetBands.micro),
      medium: numberValue(bboxOffsetBands.medium),
      large: numberValue(bboxOffsetBands.large),
    },
    changedSamples: arrayValue<unknown>(record.changedSamples ?? record.changed_samples).map((item) => {
      const itemRecord = isRecord(item) ? item : {};
      return {
        sampleId: stringValue(itemRecord.sampleId ?? itemRecord.sample_id),
        eventCount: numberValue(itemRecord.eventCount ?? itemRecord.event_count),
        eventTypes: normalizeStringList(itemRecord.eventTypes ?? itemRecord.event_types),
        attributionCodes: normalizeStringList(itemRecord.attributionCodes ?? itemRecord.attribution_codes),
        reviewerId: optionalString(itemRecord.reviewerId ?? itemRecord.reviewer_id),
        confirmedAt: optionalString(itemRecord.confirmedAt ?? itemRecord.confirmed_at),
      };
    }),
    generatedAt: optionalString(record.generatedAt ?? record.generated_at),
  };
};

const normalizeQcModificationEvent = (value: unknown, datasetId: DatasetId): QcModificationEvent => {
  const record = isRecord(value) ? value : {};
  const eventType = stringValue(record.eventType ?? record.event_type, 'unknown');
  const sampleId = stringValue(record.sampleId ?? record.sample_id);
  return {
    eventId: stringValue(record.eventId ?? record.event_id, `${datasetId}-${sampleId}-${eventType}`),
    datasetId: stringValue(record.datasetId ?? record.dataset_id, datasetId),
    sampleId,
    eventType,
    label: stringValue(record.label, eventType),
    attributionCode: optionalString(record.attributionCode ?? record.attribution_code),
    attributionLabel: optionalString(record.attributionLabel ?? record.attribution_label),
    weight: maybeNumber(record.weight),
    reviewerId: optionalString(record.reviewerId ?? record.reviewer_id),
    confirmedAt: optionalString(record.confirmedAt ?? record.confirmed_at),
    createdAt: optionalString(record.createdAt ?? record.created_at),
    details: isRecord(record.details) ? record.details : undefined,
  };
};

const normalizeSamplePoolStats = (payload: unknown): SamplePoolStats => {
  const wrapper = isRecord(payload) ? payload : {};
  const record = firstRecord(wrapper.stats, wrapper.summary, payload) ?? {};
  const byAttribution = arrayValue<unknown>(record.byAttribution ?? record.by_attribution ?? record.attributions)
    .map((item) => normalizeSamplePoolAttribution(item))
    .filter((item) => item.code);
  const involvedBatches = record.involvedBatches ?? record.involved_batches ?? record.batches;
  const primaryAttributionValue = firstRecord(record.primaryAttribution, record.primary_attribution);
  const primaryAttribution = primaryAttributionValue
    ? normalizeSamplePoolAttribution(primaryAttributionValue)
    : byAttribution[0];

  return {
    totalItems: numberValue(record.totalItems ?? record.total_items ?? record.total),
    activeItems: numberValue(
      record.activeItems ?? record.active_items ?? record.active_count,
      numberValue(record.totalActiveItems ?? record.total_active_items),
    ),
    primaryAttribution,
    involvedBatchCount: numberValue(
      record.involvedBatchCount ?? record.involved_batch_count ?? record.batchCount ?? record.batch_count,
      Array.isArray(involvedBatches) ? involvedBatches.length : 0,
    ),
    recentlyAddedAt: optionalString(
      record.recentlyAddedAt ?? record.recently_added_at ?? record.latestAddedAt ?? record.latest_added_at,
    ),
    byAttribution,
    byStatus: arrayValue<unknown>(record.byStatus ?? record.by_status).map((item) => {
      const itemRecord = isRecord(item) ? item : {};
      const status = stringValue(itemRecord.status ?? itemRecord.key, 'active');
      return {
        status,
        label: stringValue(itemRecord.label, status),
        count: numberValue(itemRecord.count),
      };
    }),
    generatedAt: optionalString(record.generatedAt ?? record.generated_at),
  };
};

const normalizeSamplePoolItem = (value: unknown, fallbackItemId = 'sample-pool-item'): SamplePoolItem => {
  const wrapper = isRecord(value) ? value : {};
  const record = firstRecord(wrapper.item, wrapper.pool_item, value) ?? {};
  const datasetId = stringValue(
    record.datasetId ?? record.dataset_id ?? record.batchId ?? record.batch_id ?? record.sourceBatchId ?? record.source_batch_id,
    'unknown-dataset',
  );
  const sampleId = stringValue(record.sampleId ?? record.sample_id, 'unknown-sample');
  const itemId = stringValue(record.itemId ?? record.item_id ?? record.id, `${fallbackItemId}-${sampleId}`);
  const eventTypes = normalizeSamplePoolEventTypes(
    record.eventTypes ?? record.event_types ?? record.modificationEventTypes ?? record.modification_event_types ?? record.events,
  );
  const attributionTags = normalizeSamplePoolAttributionList(
    record.attributionTags ?? record.attribution_tags ?? record.attributions ?? record.attributionCodes ?? record.attribution_codes,
    record.attributionCode ?? record.attribution_code,
    record.attributionLabel ?? record.attribution_label,
  );
  const changedFields = normalizeStringList(record.changedFields ?? record.changed_fields);
  const eventSource = record.events ?? record.modificationEvents ?? record.modification_events;

  return {
    itemId,
    datasetId,
    datasetType: optionalString(record.datasetType ?? record.dataset_type),
    batchId: optionalString(record.batchId ?? record.batch_id ?? record.sourceBatchId ?? record.source_batch_id ?? datasetId),
    batchName: optionalString(record.batchName ?? record.batch_name ?? record.sourceBatchName ?? record.source_batch_name),
    sampleId,
    category: optionalString(record.category ?? record.primaryCategory ?? record.primary_category ?? record.violation_category),
    attributionTags,
    eventTypes,
    eventCount: numberValue(
      record.eventCount ?? record.event_count,
      Array.isArray(eventSource) ? eventSource.length : eventTypes.length,
    ),
    changedFieldCount: numberValue(record.changedFieldCount ?? record.changed_field_count, changedFields.length),
    reviewerId: optionalString(record.reviewerId ?? record.reviewer_id ?? record.reviewer ?? record.annotator_id),
    reviewerDisplayName: optionalString(record.reviewerDisplayName ?? record.reviewer_display_name ?? record.reviewer_name),
    confirmedBy: optionalString(record.confirmedBy ?? record.confirmed_by ?? record.leadUserId ?? record.lead_user_id),
    confirmedByDisplayName: optionalString(
      record.confirmedByDisplayName ?? record.confirmed_by_display_name ?? record.confirmed_by_name,
    ),
    confirmedAt: optionalString(record.confirmedAt ?? record.confirmed_at),
    addedAt: optionalString(record.addedAt ?? record.added_at ?? record.createdAt ?? record.created_at),
    status: stringValue(record.status, 'active'),
    confirmedSnapshotId: optionalString(
      record.confirmedSnapshotId ?? record.confirmed_snapshot_id ?? record.snapshotId ?? record.snapshot_id,
    ),
    sourceEventIds: normalizeStringList(record.sourceEventIds ?? record.source_event_ids ?? record.eventIds ?? record.event_ids),
  };
};

const normalizeSamplePoolItemDetail = (payload: unknown, fallbackItemId: string): SamplePoolItemDetail => {
  const wrapper = isRecord(payload) ? payload : {};
  const item = normalizeSamplePoolItem(firstRecord(wrapper.item, wrapper.pool_item, payload) ?? payload, fallbackItemId);
  return {
    ...item,
    beforeSnapshotId: optionalString(wrapper.beforeSnapshotId ?? wrapper.before_snapshot_id),
    confirmedSnapshotPayload: wrapper.confirmedSnapshotPayload ?? wrapper.confirmed_snapshot_payload,
    baselineSnapshotPayload: wrapper.baselineSnapshotPayload ?? wrapper.baseline_snapshot_payload,
    changedFields: normalizeStringList(wrapper.changedFields ?? wrapper.changed_fields),
    events: listPayload(wrapper.events ?? wrapper.modification_events, 'events').map((event) =>
      normalizeQcModificationEvent(event, item.datasetId),
    ),
    notes: optionalString(wrapper.notes),
  };
};

const normalizeTrainingExportJob = (payload: unknown, fallbackExportId = 'training-export'): TrainingExportJob => {
  const wrapper = isRecord(payload) ? payload : {};
  const record = firstRecord(wrapper.export, wrapper.export_job, wrapper.job, payload) ?? {};
  const exportId = stringValue(
    record.exportId ?? record.export_id ?? record.id ?? record.jobId ?? record.job_id,
    fallbackExportId,
  );
  const filters = normalizeSamplePoolListFilters(
    record.filters ?? record.sourceFilters ?? record.source_filters ?? record.filter,
  );
  const errorValue = record.error ?? record.errorMessage ?? record.error_message ?? record.failureReason ?? record.failure_reason;

  return {
    exportId,
    format: stringValue(record.format ?? record.exportFormat ?? record.export_format, 'coco_json'),
    source: stringValue(record.source ?? record.sourceScope ?? record.source_scope ?? record.poolSource ?? record.pool_source, 'current_filters'),
    filters,
    filterSummary: optionalString(record.filterSummary ?? record.filter_summary ?? record.filtersSummary ?? record.filters_summary),
    sampleCount: maybeNumber(
      record.sampleCount ??
        record.sample_count ??
        record.itemCount ??
        record.item_count ??
        record.totalItems ??
        record.total_items,
    ),
    status: stringValue(record.status ?? record.state, 'pending'),
    createdAt: optionalString(record.createdAt ?? record.created_at),
    completedAt: optionalString(record.completedAt ?? record.completed_at ?? record.finishedAt ?? record.finished_at),
    error: typeof errorValue === 'string' && errorValue ? errorValue : undefined,
    downloadUrl: optionalString(record.downloadUrl ?? record.download_url ?? record.artifactUrl ?? record.artifact_url),
  };
};

const normalizeTrainingExportDownload = (
  payload: unknown,
  exportId: string,
  fallbackUrl: string,
): TrainingExportDownload => {
  const record = firstRecord(payload) ?? {};
  const url = stringValue(record.downloadUrl ?? record.download_url ?? record.url, fallbackUrl);
  return {
    exportId: stringValue(record.exportId ?? record.export_id ?? record.id, exportId),
    url,
    fileName: optionalString(record.fileName ?? record.file_name ?? record.filename),
    content: isRecord(payload) ? undefined : payload,
  };
};

const normalizeModelEvaluationRun = (
  payload: unknown,
  datasetId: DatasetId,
  fallbackEvaluationId = 'model-evaluation',
): ModelEvaluationRun => {
  const wrapper = isRecord(payload) ? payload : {};
  const record = firstRecord(wrapper.evaluation, wrapper.evaluation_run, wrapper.run, wrapper.item, payload) ?? {};
  const evaluationId = stringValue(
    record.evaluationId ?? record.evaluation_id ?? record.id ?? record.runId ?? record.run_id,
    fallbackEvaluationId,
  );
  const modelVersion = stringValue(record.modelVersion ?? record.model_version ?? record.version, '未记录模型版本');
  return {
    evaluationId,
    datasetId: stringValue(record.datasetId ?? record.dataset_id ?? record.batchId ?? record.batch_id, datasetId),
    modelVersion,
    modelName: optionalString(record.modelName ?? record.model_name),
    status: stringValue(record.status ?? record.state, 'completed'),
    sampleCount: maybeNumber(record.sampleCount ?? record.sample_count ?? record.totalSamples ?? record.total_samples),
    sourceExportId: optionalString(record.sourceExportId ?? record.source_export_id),
    sourceExportName: optionalString(record.sourceExportName ?? record.source_export_name),
    sourceSnapshotId: optionalString(record.sourceSnapshotId ?? record.source_snapshot_id),
    sourceSnapshotType: optionalString(record.sourceSnapshotType ?? record.source_snapshot_type),
    metrics: normalizeModelEvaluationMetrics(record.metrics ?? record.metricSummary ?? record.metric_summary),
    metricDeltas: normalizeModelEvaluationMetrics(record.metricDeltas ?? record.metric_deltas ?? record.deltas),
    categoryMetrics: normalizeModelEvaluationCategoryMetrics(
      record.categoryMetrics ?? record.category_metrics ?? record.classificationMetrics ?? record.classification_metrics,
    ),
    changedSampleCount: maybeNumber(record.changedSampleCount ?? record.changed_sample_count),
    createdBy: optionalString(record.createdBy ?? record.created_by),
    createdAt: optionalString(record.createdAt ?? record.created_at),
    completedAt: optionalString(record.completedAt ?? record.completed_at ?? record.finishedAt ?? record.finished_at),
    notes: optionalString(record.notes ?? record.description),
  };
};

const normalizeModelEvaluationCompare = (
  payload: unknown,
  leftId: string,
  rightId: string,
): ModelEvaluationCompareResult => {
  const wrapper = isRecord(payload) ? payload : {};
  const record = firstRecord(wrapper.comparison, wrapper.compare, wrapper.result, wrapper.diff, payload) ?? {};
  const leftRecord = firstRecord(record.left);
  const rightRecord = firstRecord(record.right);
  const changedSamples = isRecord(record.changedSamples ?? record.changed_samples)
    ? (record.changedSamples ?? record.changed_samples) as Record<string, unknown>
    : {};
  const leftOnlyCount = arrayValue(changedSamples.leftOnly ?? changedSamples.left_only).length;
  const rightOnlyCount = arrayValue(changedSamples.rightOnly ?? changedSamples.right_only).length;
  const intersectionCount = arrayValue(changedSamples.intersection).length;
  const changedSamplesTotal = leftOnlyCount + rightOnlyCount + intersectionCount;
  return {
    leftEvaluationId: stringValue(
      record.leftEvaluationId ??
        record.left_evaluation_id ??
        record.leftId ??
        record.left_id ??
        leftRecord?.evaluationId ??
        leftRecord?.evaluation_id ??
        leftRecord?.id ??
        leftRecord?.runId ??
        leftRecord?.run_id,
      leftId,
    ),
    rightEvaluationId: stringValue(
      record.rightEvaluationId ??
        record.right_evaluation_id ??
        record.rightId ??
        record.right_id ??
        rightRecord?.evaluationId ??
        rightRecord?.evaluation_id ??
        rightRecord?.id ??
        rightRecord?.runId ??
        rightRecord?.run_id,
      rightId,
    ),
    leftModelVersion: optionalString(
      record.leftModelVersion ?? record.left_model_version ?? leftRecord?.modelVersion ?? leftRecord?.model_version ?? leftRecord?.version,
    ),
    rightModelVersion: optionalString(
      record.rightModelVersion ?? record.right_model_version ?? rightRecord?.modelVersion ?? rightRecord?.model_version ?? rightRecord?.version,
    ),
    metricDeltas: normalizeModelEvaluationMetricDeltas(
      record.metricDeltas ?? record.metric_deltas ?? record.metricDelta ?? record.metric_delta ?? record.metrics ?? record.deltas,
    ),
    categoryDeltas: normalizeModelEvaluationCategoryMetrics(
      record.categoryDeltas ?? record.category_deltas ?? record.categoryMetrics ?? record.category_metrics,
    ),
    changedSampleCount: maybeNumber(record.changedSampleCount ?? record.changed_sample_count) ??
      (changedSamplesTotal > 0 ? changedSamplesTotal : undefined),
    improvedCount: maybeNumber(record.improvedCount ?? record.improved_count) ??
      (rightOnlyCount > 0 ? rightOnlyCount : undefined),
    regressedCount: maybeNumber(record.regressedCount ?? record.regressed_count) ??
      (leftOnlyCount > 0 ? leftOnlyCount : undefined),
    summary: optionalString(record.summary ?? record.description),
  };
};

const normalizeModelEvaluationDeltaSample = (value: unknown): ModelEvaluationDeltaSample => {
  const record = isRecord(value) ? value : {};
  return {
    sampleId: stringValue(record.sampleId ?? record.sample_id, 'unknown-sample'),
    category: optionalString(record.category ?? record.violationCategory ?? record.violation_category),
    changeType: optionalString(record.changeType ?? record.change_type ?? record.status),
    beforeSnapshotId: optionalString(record.beforeSnapshotId ?? record.before_snapshot_id ?? record.leftSnapshotId ?? record.left_snapshot_id),
    afterSnapshotId: optionalString(record.afterSnapshotId ?? record.after_snapshot_id ?? record.rightSnapshotId ?? record.right_snapshot_id),
    metricImpacts: normalizeModelEvaluationMetrics(record.metricImpacts ?? record.metric_impacts ?? record.metrics),
    reason: optionalString(record.reason ?? record.summary),
  };
};

const normalizeModelEvaluationMetrics = (value: unknown): ModelEvaluationMetric[] => {
  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : isRecord(value)
      ? Object.entries(value)
      : [];

  return entries.map(([fallbackKey, item]) => {
    if (!isRecord(item)) {
      const numeric = typeof item === 'number' && Number.isFinite(item) ? item : 0;
      return {
        key: fallbackKey,
        label: fallbackKey,
        value: numeric,
      };
    }
    const key = stringValue(item.key ?? item.metric ?? item.metricKey ?? item.metric_key ?? item.name, fallbackKey);
    const rightValue = maybeNumber(item.rightValue ?? item.right_value ?? item.after ?? item.current);
    const leftValue = maybeNumber(item.leftValue ?? item.left_value ?? item.before ?? item.baselineValue ?? item.baseline_value);
    const valueNumber = numberValue(item.value ?? item.score ?? rightValue, 0);
    const explicitDelta = maybeNumber(item.delta ?? item.change ?? item.diff);
    return {
      key,
      label: stringValue(item.label ?? item.labelZh ?? item.label_zh ?? item.name, key),
      value: valueNumber,
      baselineValue: leftValue,
      delta: explicitDelta ?? (typeof rightValue === 'number' && typeof leftValue === 'number' ? rightValue - leftValue : undefined),
      unit: optionalString(item.unit),
    };
  });
};

const metricDeltaLabels: Record<string, string> = {
  mAP: 'mAP',
  map: 'mAP',
  precision: '精确率',
  recall: '召回率',
  f1: 'F1',
  false_positive_rate: '误报率',
  hard_sample_hit_rate: '困难样本命中率',
};

const normalizeModelEvaluationMetricDeltas = (value: unknown): ModelEvaluationMetric[] => {
  if (!isRecord(value) || Array.isArray(value)) {
    return normalizeModelEvaluationMetrics(value);
  }

  return Object.entries(value).flatMap(([fallbackKey, item]) => {
    if (typeof item === 'number' && Number.isFinite(item)) {
      return [{
        key: fallbackKey,
        label: metricDeltaLabels[fallbackKey] ?? fallbackKey,
        value: item,
        delta: item,
      }];
    }
    if (!isRecord(item)) {
      return [];
    }
    const metric = normalizeModelEvaluationMetrics([{ ...item, key: item.key ?? fallbackKey }])[0];
    return metric ? [{
      ...metric,
      label: metric.label || metricDeltaLabels[metric.key] || metric.key,
      delta: metric.delta ?? maybeNumber(item.delta ?? item.change ?? item.diff),
    }] : [];
  });
};

const normalizeModelEvaluationCategoryMetrics = (value: unknown): ModelEvaluationCategoryMetric[] => {
  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : isRecord(value)
      ? Object.entries(value)
      : [];

  return entries.map(([fallbackCategory, item]) => {
    if (!isRecord(item)) {
      return { category: fallbackCategory, label: fallbackCategory };
    }
    const category = stringValue(
      item.category ?? item.categoryKey ?? item.category_key ?? item.key ?? item.name,
      fallbackCategory,
    );
    const metricDelta = isRecord(item.metricDelta ?? item.metric_delta)
      ? (item.metricDelta ?? item.metric_delta) as Record<string, unknown>
      : {};
    return {
      category,
      label: optionalString(item.label ?? item.labelZh ?? item.label_zh ?? item.name),
      precision: maybeNumber(item.precision) ?? maybeNumber(metricDelta.precision),
      recall: maybeNumber(item.recall) ?? maybeNumber(metricDelta.recall),
      f1: maybeNumber(item.f1 ?? item.f1Score ?? item.f1_score) ?? maybeNumber(metricDelta.f1),
      accuracy: maybeNumber(item.accuracy),
      sampleCount: maybeNumber(item.sampleCount ?? item.sample_count ?? item.count),
      delta: maybeNumber(item.delta ?? item.change) ?? maybeNumber(metricDelta.f1),
    };
  });
};

const normalizeAnnotationSnapshot = (
  payload: unknown,
  datasetId: DatasetId,
  fallbackSnapshotId = 'annotation-snapshot',
): AnnotationSnapshot => {
  const wrapper = isRecord(payload) ? payload : {};
  const record = firstRecord(wrapper.snapshot, wrapper.item, payload) ?? {};
  const source = isRecord(record.source) ? record.source : {};
  return {
    snapshotId: stringValue(record.snapshotId ?? record.snapshot_id ?? record.id, fallbackSnapshotId),
    datasetId: stringValue(record.datasetId ?? record.dataset_id ?? record.batchId ?? record.batch_id, datasetId),
    sampleId: optionalString(record.sampleId ?? record.sample_id),
    snapshotType: stringValue(record.snapshotType ?? record.snapshot_type ?? record.type, 'baseline'),
    labelConfigId: optionalString(record.labelConfigId ?? record.label_config_id),
    labelConfigVersion: optionalDisplayString(record.labelConfigVersion ?? record.label_config_version),
    sourceSubmissionId: optionalString(record.sourceSubmissionId ?? record.source_submission_id ?? source.submission_id),
    sourceExportId: optionalString(record.sourceExportId ?? record.source_export_id ?? source.export_id),
    sourceModelVersion: optionalString(record.sourceModelVersion ?? record.source_model_version ?? source.model_version),
    sourceEvaluationId: optionalString(record.sourceEvaluationId ?? record.source_evaluation_id ?? source.evaluation_id),
    payloadHash: optionalString(record.payloadHash ?? record.payload_hash),
    payloadRef: optionalString(record.payloadRef ?? record.payload_ref),
    createdBy: optionalString(record.createdBy ?? record.created_by),
    createdAt: optionalString(record.createdAt ?? record.created_at),
    rollbackAvailable: booleanValue(record.rollbackAvailable ?? record.rollback_available ?? record.rollbackEnabled ?? record.rollback_enabled),
  };
};

const normalizeAnnotationSnapshotDiff = (
  payload: unknown,
  datasetId: DatasetId,
  leftSnapshotId: string,
  rightSnapshotId: string,
): AnnotationSnapshotDiff => {
  const wrapper = isRecord(payload) ? payload : {};
  const record = firstRecord(wrapper.diff, wrapper.snapshot_diff, wrapper.result, payload) ?? {};
  const changedFields = normalizeSnapshotFieldDiffs(record.changedFields ?? record.changed_fields ?? record.fields);
  const relations = normalizeSnapshotRelationDiffs(
    record.relations ?? record.relationDiffs ?? record.relation_diffs ?? record.changedRelations ?? record.changed_relations,
  );
  const candidates = normalizeSnapshotCandidateDiffs(
    record.candidates ?? record.candidateDiffs ?? record.candidate_diffs ?? record.changedCandidates ?? record.changed_candidates,
  );
  const operationCount = maybeNumber(record.operationCount ?? record.operation_count);
  return {
    datasetId: optionalString(record.datasetId ?? record.dataset_id) ?? datasetId,
    leftSnapshotId: stringValue(record.leftSnapshotId ?? record.left_snapshot_id ?? record.leftId ?? record.left_id, leftSnapshotId),
    rightSnapshotId: stringValue(record.rightSnapshotId ?? record.right_snapshot_id ?? record.rightId ?? record.right_id, rightSnapshotId),
    changedFieldCount: numberValue(record.changedFieldCount ?? record.changed_field_count, changedFields.length),
    changedRelationCount: numberValue(record.changedRelationCount ?? record.changed_relation_count, relations.length),
    changedCandidateCount: numberValue(record.changedCandidateCount ?? record.changed_candidate_count, candidates.length),
    changedFields,
    relations,
    candidates,
    summary: optionalString(record.summary ?? record.description) ?? (typeof operationCount === 'number' ? `操作数 ${operationCount}` : undefined),
    rollbackAvailable: booleanValue(record.rollbackAvailable ?? record.rollback_available ?? record.rollbackEnabled ?? record.rollback_enabled),
  };
};

const normalizeSnapshotFieldDiffs = (value: unknown): AnnotationSnapshotFieldDiff[] =>
  arrayValue<unknown>(value).map((item) => {
    if (!isRecord(item)) {
      return { field: stringValue(item, 'unknown') };
    }
    const field = stringValue(item.field ?? item.path ?? item.key, 'unknown');
    return {
      field,
      label: optionalString(item.label ?? item.labelZh ?? item.label_zh),
      changeType: optionalString(item.changeType ?? item.change_type ?? item.type),
      before: item.before ?? item.left,
      after: item.after ?? item.right,
    };
  });

const normalizeSnapshotRelationDiffs = (value: unknown): AnnotationSnapshotRelationDiff[] =>
  normalizeSnapshotFieldDiffs(value).map((item, index) => {
    const source = arrayValue<unknown>(value)[index];
    const record = isRecord(source) ? source : {};
    return {
      ...item,
      relationId: optionalString(record.relationId ?? record.relation_id),
      relationIndex: optionalString(record.relationIndex ?? record.relation_index ?? record.targetId ?? record.target_id),
    };
  });

const normalizeSnapshotCandidateDiffs = (value: unknown): AnnotationSnapshotCandidateDiff[] =>
  normalizeSnapshotFieldDiffs(value).map((item, index) => {
    const source = arrayValue<unknown>(value)[index];
    const record = isRecord(source) ? source : {};
    return {
      ...item,
      candidateId: optionalString(record.candidateId ?? record.candidate_id),
      candidateIndex: optionalString(record.candidateIndex ?? record.candidate_index ?? record.targetId ?? record.target_id),
    };
  });

const normalizeSamplePoolListFilters = (value: unknown): SamplePoolListFilters => {
  const record = isRecord(value) ? value : {};
  return {
    datasetType: optionalString(record.datasetType ?? record.dataset_type),
    batchId: optionalString(record.batchId ?? record.batch_id),
    category: optionalString(record.category),
    attribution: optionalString(record.attribution ?? record.attributionCode ?? record.attribution_code),
    eventType: optionalString(record.eventType ?? record.event_type),
    reviewer: optionalString(record.reviewer ?? record.reviewerId ?? record.reviewer_id),
    status: optionalString(record.status),
    search: optionalString(record.search),
  };
};

const normalizeSamplePoolAttributionList = (
  value: unknown,
  fallbackCode?: unknown,
  fallbackLabel?: unknown,
): SamplePoolAttributionTag[] => {
  const tags = Array.isArray(value)
    ? value.map((item) => normalizeSamplePoolAttribution(item)).filter((item) => item.code)
    : normalizeStringList(value).map((code) => normalizeSamplePoolAttribution(code));
  if (tags.length) {
    return tags;
  }
  const code = optionalString(fallbackCode);
  return code ? [normalizeSamplePoolAttribution({ code, label: fallbackLabel })] : [];
};

const normalizeSamplePoolAttribution = (value: unknown): SamplePoolAttributionTag => {
  if (!isRecord(value)) {
    const code = stringValue(value, 'unknown');
    return { code, label: code };
  }
  const code = stringValue(value.code ?? value.attributionCode ?? value.attribution_code ?? value.key, 'unknown');
  return {
    code,
    label: stringValue(value.label ?? value.attributionLabel ?? value.attribution_label ?? value.name, code),
    count: maybeNumber(value.count),
    weightSum: maybeNumber(value.weightSum ?? value.weight_sum),
  };
};

const normalizeSamplePoolEventTypes = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'string') {
        return [item];
      }
      if (isRecord(item)) {
        const eventType = optionalString(item.eventType ?? item.event_type ?? item.type);
        return eventType ? [eventType] : [];
      }
      return [];
    });
  }
  return normalizeStringList(value);
};

const normalizeAssetSummary = (
  value: unknown,
  datasetId: DatasetId,
  fallback?: {
    dataset: Dataset;
    totals: DatasetSummary['totals'];
    coverage: DatasetSummary['coverage'];
    qc: DatasetSummary['qc'];
    categoryDistribution: CountDistribution[];
    sampleCategoryDistribution: CountDistribution[];
  },
): AssetSummary => {
  const record = isRecord(value) ? value : {};
  const media = isRecord(record.media) ? record.media : record;
  const importHealth = isRecord(record.importHealth ?? record.import_health)
    ? (record.importHealth ?? record.import_health) as Record<string, unknown>
    : record;
  const preannotation = isRecord(record.preannotation)
    ? record.preannotation
    : isRecord(record.preannotation_coverage)
      ? record.preannotation_coverage
      : record;
  const modelJudgement = isRecord(record.modelJudgement ?? record.model_judgement)
    ? (record.modelJudgement ?? record.model_judgement) as Record<string, unknown>
    : record;
  const qc = isRecord(record.qc) ? record.qc : {};
  const totals = fallback?.totals;
  const rawTotal = numberValue(media.total ?? media.rawAssets ?? media.raw_assets ?? media.total_assets, totals?.rawAssets ?? 0);
  const stage2Ready = numberValue(
    preannotation.stage2Ready ?? preannotation.stage2_ready ?? preannotation.stage2Parsed ?? preannotation.stage2_success_count,
    totals?.stage2Parsed ?? 0,
  );
  const stage2Failed = numberValue(
    preannotation.stage2Failed ?? preannotation.stage2_failed ?? preannotation.stage2Failures ?? preannotation.stage2_failure_count,
    totals?.stage2Failures ?? 0,
  );

  return {
    datasetId: stringValue(record.datasetId ?? record.dataset_id, datasetId),
    datasetType: optionalString(record.datasetType ?? record.dataset_type ?? fallback?.dataset.datasetType),
    batchKey: optionalString(record.batchKey ?? record.batch_key ?? fallback?.dataset.batchKey),
    media: {
      total: rawTotal,
      valid: numberValue(media.valid ?? media.valid_assets ?? media.valid_count, rawTotal),
      missing: numberValue(media.missing ?? media.missing_assets ?? media.missing_count),
      loadFailed: numberValue(media.loadFailed ?? media.load_failed),
      resolutionAbnormal: numberValue(media.resolutionAbnormal ?? media.resolution_abnormal),
    },
    importHealth: {
      imported: numberValue(importHealth.imported ?? importHealth.imported_assets, rawTotal),
      duplicates: numberValue(importHealth.duplicates ?? importHealth.duplicate_sample_ids),
      orphanAnnotations: numberValue(importHealth.orphanAnnotations ?? importHealth.orphan_annotations),
      pathWarnings: numberValue(importHealth.pathWarnings ?? importHealth.path_warnings),
      schemaWarnings: numberValue(importHealth.schemaWarnings ?? importHealth.schema_warnings),
    },
    preannotation: {
      stage1Ready: numberValue(
        preannotation.stage1Ready ?? preannotation.stage1_ready ?? preannotation.stage1Parsed ?? preannotation.stage1_count,
        totals?.stage1Parsed ?? 0,
      ),
      stage2Ready,
      stage2Failed,
      stage2Missing: numberValue(preannotation.stage2Missing ?? preannotation.stage2_missing, Math.max(rawTotal - stage2Ready - stage2Failed, 0)),
    },
    modelJudgement: {
      pass: numberValue(modelJudgement.pass ?? modelJudgement.passed),
      softFail: numberValue(modelJudgement.softFail ?? modelJudgement.soft_fail),
      unknown: numberValue(modelJudgement.unknown, rawTotal ? 0 : 0),
    },
    qc: {
      queued: numberValue(qc.queued ?? qc.total, fallback?.qc.total ?? 0),
      pending: numberValue(qc.pending, fallback?.qc.pending ?? 0),
      skipped: numberValue(qc.skipped),
      draft: numberValue(qc.draft ?? qc.needsHumanReview ?? qc.needs_human_review, fallback?.qc.needsHumanReview ?? 0),
      submitted: numberValue(qc.submitted ?? qc.passed, fallback ? fallback.qc.passed + fallback.qc.rejected : 0),
    },
    categoryDistribution: normalizeDistributionList(
      record.categoryDistribution ?? record.category_distribution ?? fallback?.categoryDistribution,
    ),
    sampleCategoryDistribution: normalizeDistributionList(
      record.sampleCategoryDistribution ?? record.sample_category_distribution ?? fallback?.sampleCategoryDistribution,
    ),
    updatedAt: optionalString(record.updatedAt ?? record.updated_at),
  };
};

const normalizeDistributionList = (value: unknown): CountDistribution[] =>
  arrayValue<unknown>(value).map((item) => {
    const record = isRecord(item) ? item : {};
    const key = stringValue(record.key, 'unknown');
    return {
      key,
      label: stringValue(record.label, key),
      count: numberValue(record.count),
      ratio: numberValue(record.ratio),
    };
  });

const normalizeWarnings = (value: unknown): ImportWarning[] =>
  arrayValue<unknown>(value).map((item, index) => {
    if (!isRecord(item)) {
      return {
        id: `warning-${index + 1}`,
        severity: 'warning',
        title: 'Backend warning',
        message: optionalDisplayString(item) ?? '',
      };
    }
    const message = optionalDisplayString(
      item.message ?? item.detail ?? item.reason ?? item.error ?? item.description ?? item.text,
    ) ?? '';
    return {
      id: stringValue(item.id, `warning-${index + 1}`),
      severity: stringValue(item.severity, 'warning') as ImportWarning['severity'],
      title: optionalDisplayString(item.title ?? item.name ?? item.code ?? item.type) ?? 'Backend warning',
      message,
      details: normalizeWarningDetails(item),
      createdAt: optionalString(item.createdAt ?? item.created_at),
    };
  });

const normalizeWarningDetails = (record: Record<string, unknown>) => {
  const detailPairs: Array<[string, unknown]> = [
    ['Code', record.code ?? record.error_code ?? record.errorCode],
    ['Sample', record.sample_id ?? record.sampleId],
    ['Path', record.path ?? record.file_path ?? record.filePath ?? record.file],
    ['Field', record.field ?? record.loc],
    ['Count', record.count],
  ];
  const details = detailPairs
    .map(([label, value]) => {
      const detail = optionalDisplayString(value);
      return detail ? `${label}: ${detail}` : '';
    })
    .filter(Boolean);
  const nested = firstRecord(record.details, record.context, record.meta);
  if (nested) {
    Object.entries(nested).forEach(([key, value]) => {
      const detail = optionalDisplayString(value);
      if (detail) {
        details.push(`${key}: ${detail}`);
      }
    });
  }
  return details.length ? details : undefined;
};

const normalizeLabelConfig = (value: unknown, datasetId: DatasetId): LabelConfig => {
  const record = isRecord(value) ? value : {};
  const configSource = firstRecord(record.normalized_config, record.normalizedConfig, record.config, record.raw_config, value);
  const configRecord = configSource ?? {};
  const fields = arrayValue<unknown>(configRecord.fields).map((field) => normalizeLabelConfigField(field));
  return {
    configId: optionalString(record.config_id ?? record.configId ?? configRecord.config_id ?? configRecord.configId),
    datasetId: stringValue(record.dataset_id ?? record.datasetId ?? configRecord.dataset_id ?? configRecord.datasetId, datasetId),
    schemaVersion: optionalString(record.schema_version ?? record.schemaVersion ?? configRecord.schema_version ?? configRecord.schemaVersion),
    datasetType: optionalString(record.dataset_type ?? record.datasetType ?? configRecord.dataset_type ?? configRecord.datasetType),
    version: stringValue(record.version ?? configRecord.version, 'unversioned-label-config'),
    status: optionalString(record.status ?? configRecord.status),
    contentHash: optionalString(record.content_hash ?? record.contentHash ?? configRecord.content_hash ?? configRecord.contentHash),
    createdAt: optionalString(record.created_at ?? record.createdAt ?? configRecord.created_at ?? configRecord.createdAt),
    activatedAt: optionalString(record.activated_at ?? record.activatedAt ?? configRecord.activated_at ?? configRecord.activatedAt),
    fields,
    rawConfig: Object.keys(configRecord).length ? configRecord : value,
  };
};

const normalizeLabelConfigField = (value: unknown): LabelConfigField => {
  const record = isRecord(value) ? value : {};
  return {
    field: stringValue(record.field),
    mode: stringValue(record.mode, 'closed_enum'),
    labelZh: optionalString(record.label_zh ?? record.labelZh),
    labelEn: optionalString(record.label_en ?? record.labelEn),
    allowCustom: booleanValue(record.allow_custom ?? record.allowCustom),
    maxItems: maybeNumber(record.max_items ?? record.maxItems),
    options: arrayValue<unknown>(record.options).map((option) => normalizeLabelConfigOption(option)),
  };
};

const normalizeLabelConfigOption = (value: unknown): LabelConfigOption => {
  const record = isRecord(value) ? value : {};
  return {
    code: stringValue(record.code ?? record.value),
    labelZh: optionalString(record.label_zh ?? record.labelZh),
    labelEn: optionalString(record.label_en ?? record.labelEn),
    description: optionalString(record.description),
    sortOrder: maybeNumber(record.sort_order ?? record.sortOrder),
    aliases: normalizeStringList(record.aliases),
  };
};

const normalizeLabelConfigValidation = (value: unknown, datasetId: DatasetId): LabelConfigValidationResult => {
  const record = isRecord(value) ? value : {};
  const normalizedConfigValue = firstRecord(record.normalized_config, record.normalizedConfig, record.config);
  const normalizedConfig = normalizedConfigValue
    ? normalizeLabelConfig(
        {
          ...record,
          normalized_config: normalizedConfigValue,
        },
        datasetId,
      )
    : undefined;
  return {
    valid: booleanValue(record.valid),
    datasetId: stringValue(record.dataset_id ?? record.datasetId, datasetId),
    schemaVersion: optionalString(record.schema_version ?? record.schemaVersion ?? normalizedConfig?.schemaVersion),
    version: optionalString(record.version ?? record.detected_version ?? record.detectedVersion ?? normalizedConfig?.version),
    contentHash: optionalString(record.content_hash ?? record.contentHash),
    summary: normalizeLabelConfigSummary(record.summary, normalizedConfig),
    errors: normalizeLabelIssues(record.errors),
    warnings: normalizeLabelIssues(record.warnings),
    normalizedConfig,
  };
};

const normalizeLabelConfigSaveResult = (value: unknown, datasetId: DatasetId): LabelConfigSaveResult => {
  const record = isRecord(value) ? value : {};
  const configId = stringValue(record.config_id ?? record.configId, 'unsaved-label-config');
  const config = normalizeLabelConfig(record, datasetId);
  return {
    configId,
    datasetId: stringValue(record.dataset_id ?? record.datasetId, datasetId),
    schemaVersion: optionalString(record.schema_version ?? record.schemaVersion ?? config.schemaVersion),
    version: stringValue(record.version ?? config.version, 'unversioned-label-config'),
    status: stringValue(record.status ?? config.status, 'draft'),
    contentHash: optionalString(record.content_hash ?? record.contentHash ?? config.contentHash),
    createdAt: optionalString(record.created_at ?? record.createdAt ?? config.createdAt),
    activatedAt: optionalString(record.activated_at ?? record.activatedAt ?? config.activatedAt),
    validation: isRecord(record.validation) ? normalizeLabelConfigValidation(record.validation, datasetId) : undefined,
    config: config.fields.length ? config : undefined,
  };
};

const normalizeLabelConfigSummary = (value: unknown, config?: LabelConfig): LabelConfigSummary => {
  const record = isRecord(value) ? value : {};
  const fields = config?.fields ?? [];
  const closedEnumCount = fields.filter((field) => field.mode === 'closed_enum').length;
  const openTagsCount = fields.filter((field) => field.mode === 'open_tags').length;
  const optionCount = fields.reduce((total, field) => total + field.options.length, 0);
  return {
    fieldCount: numberValue(record.field_count ?? record.fieldCount, fields.length),
    closedEnumCount: numberValue(record.closed_enum_count ?? record.closedEnumCount, closedEnumCount),
    openTagsCount: numberValue(record.open_tags_count ?? record.openTagsCount, openTagsCount),
    optionCount: numberValue(record.option_count ?? record.optionCount, optionCount),
  };
};

const normalizeLabelIssues = (value: unknown): LabelConfigIssue[] =>
  arrayValue<unknown>(value).map((item) => {
    if (typeof item === 'string') {
      return { message: item };
    }
    const record = isRecord(item) ? item : {};
    return {
      field: optionalString(record.field),
      code: optionalString(record.code),
      message: stringValue(record.message, JSON.stringify(record)),
    };
  });

const normalizeLabelSuggestions = (value: unknown): LabelSuggestion[] => {
  const items = Array.isArray(value) ? value : listPayload(value, 'suggestions');
  return items.flatMap((item) => {
    if (typeof item === 'string') {
      return [{ value: item }];
    }
    const record = isRecord(item) ? item : {};
    const option = normalizeLabelConfigOption(record);
    const suggestionValue = stringValue(record.value ?? option.code);
    return suggestionValue
      ? [
          {
            value: suggestionValue,
            labelZh: option.labelZh,
            labelEn: option.labelEn,
            source: optionalString(record.source),
          },
        ]
      : [];
  });
};

const toBackendLabelEditPayload = (payload: LabelEditPatchPayload | LabelEditSubmitPayload) => {
  const body: Record<string, unknown> = {
    task_mode: payload.taskMode,
    label_config_id: payload.labelConfigId,
    label_config_version: payload.labelConfigVersion,
    lease_id: payload.leaseId,
    base_revision: payload.baseRevision,
    operations: payload.operations.map((operation) => ({
      scope: operation.scope,
      field: operation.field,
      op: operation.op,
      before: operation.before,
      after: operation.after,
      tag_payload: operation.tagPayload
        ? {
            raw_text: operation.tagPayload.rawText,
            normalized_text: operation.tagPayload.normalizedText,
            canonical_code: operation.tagPayload.canonicalCode ?? null,
            source: operation.tagPayload.source,
            status: operation.tagPayload.status,
          }
        : undefined,
    })),
  };

  if ('submitAction' in payload) {
    body.submit_action = payload.submitAction;
    body.task_status = payload.taskStatus;
  }

  return body;
};

const toBackendLabelEditOperations = (operations: LabelEditOperation[]) =>
  operations.map((operation) => ({
    scope: operation.scope,
    field: operation.field,
    op: operation.op,
    before: operation.before,
    after: operation.after,
    tag_payload: operation.tagPayload
      ? {
          raw_text: operation.tagPayload.rawText,
          normalized_text: operation.tagPayload.normalizedText,
          canonical_code: operation.tagPayload.canonicalCode ?? null,
          source: operation.tagPayload.source,
          status: operation.tagPayload.status,
        }
      : undefined,
  }));

const toBackendBatchValidation = (validation?: BatchLabelEditDraftValidation) => ({
  valid: validation?.valid ?? true,
  error_count: validation?.errorCount ?? validation?.errors.length ?? 0,
  warning_count: validation?.warningCount ?? validation?.warnings.length ?? 0,
  errors: (validation?.errors ?? []).map((issue) => ({
    operation_index: issue.operationIndex,
    scope: issue.scope,
    field: issue.field,
    code: issue.code,
    message: issue.message,
  })),
  warnings: (validation?.warnings ?? []).map((issue) => ({
    operation_index: issue.operationIndex,
    scope: issue.scope,
    field: issue.field,
    code: issue.code,
    message: issue.message,
  })),
});

const toBackendBatchLabelEditDraftPayload = (payload: BatchLabelEditDraftPayload) => ({
  entries: payload.entries.map((entry) => ({
    sample_id: entry.sampleId,
    lease_id: entry.leaseId ?? null,
    base_revision: entry.baseRevision ?? null,
    label_config_id: entry.labelConfigId ?? null,
    label_config_version: entry.labelConfigVersion ?? null,
    operations: toBackendLabelEditOperations(entry.operations),
    dirty: entry.dirty,
    saved: entry.saved,
    validation: toBackendBatchValidation(entry.validation),
  })),
});

const toBackendBatchLabelEditSubmitPayload = (payload: BatchLabelEditSubmitPayload) => ({
  unsaved_dirty_sample_ids: payload.unsavedDirtySampleIds,
  validation_error_sample_ids: payload.validationErrorSampleIds,
  notes: payload.notes ?? null,
});

const toBackendImportJobCreatePayload = (payload: ImportJobCreatePayload) => ({
  dataset_type: payload.datasetType,
  batch_key: payload.batchKey,
  batch_name: payload.batchName,
  source_mode: payload.sourceMode,
  source_uri: payload.sourceUri,
  source_structure: payload.sourceStructure,
  description: payload.description,
  source_file_count: payload.sourceFileCount,
  image_count: payload.imageCount,
  stage1_file_count: payload.stage1FileCount,
  stage2_file_count: payload.stage2FileCount,
  stage2_failure_file_count: payload.stage2FailureFileCount,
});

const normalizeLabelEditIssue = (value: unknown): LabelEditValidationIssue => {
  const record = isRecord(value) ? value : {};
  return {
    operationIndex: numberValue(record.operation_index ?? record.operationIndex),
    scope: stringValue(record.scope),
    field: stringValue(record.field),
    code: stringValue(record.code, 'invalid_field_value'),
    message: stringValue(record.message, JSON.stringify(record)),
  };
};

const normalizeLabelEditIssues = (value: unknown): LabelEditValidationIssue[] =>
  arrayValue<unknown>(value).map((item) => normalizeLabelEditIssue(item));

const labelEditOps = new Set<LabelEditOperation['op']>([
  'replace',
  'add_tag',
  'remove_tag',
  'soft_delete_relation',
  'add_relation',
  'delete_candidate',
]);

const normalizeLabelEditOperation = (value: unknown): LabelEditOperation | undefined => {
  const record = isRecord(value) ? value : undefined;
  if (!record) {
    return undefined;
  }
  const scope = stringValue(record.scope);
  const field = stringValue(record.field);
  const opValue = stringValue(record.op);
  if (!scope || !field || !labelEditOps.has(opValue as LabelEditOperation['op'])) {
    return undefined;
  }
  const tagRecord = firstRecord(record.tagPayload, record.tag_payload);
  return {
    scope,
    field,
    op: opValue as LabelEditOperation['op'],
    before: record.before,
    after: record.after,
    tagPayload: tagRecord
      ? {
          rawText: stringValue(tagRecord.raw_text ?? tagRecord.rawText),
          normalizedText: stringValue(tagRecord.normalized_text ?? tagRecord.normalizedText),
          canonicalCode: optionalString(tagRecord.canonical_code ?? tagRecord.canonicalCode) ?? null,
          source: stringValue(tagRecord.source, 'human') as 'human',
          status: stringValue(tagRecord.status, 'custom') as 'custom' | 'configured',
        }
      : undefined,
  };
};

const normalizeLabelEditOperations = (value: unknown): LabelEditOperation[] =>
  arrayValue<unknown>(value).flatMap((item) => {
    const operation = normalizeLabelEditOperation(item);
    return operation ? [operation] : [];
  });

const normalizeLabelEditValidation = (value: unknown): LabelEditValidationResult => {
  const record = isRecord(value) ? value : {};
  const errors = normalizeLabelEditIssues(record.errors ?? record.field_errors);
  return {
    valid: booleanValue(record.valid, errors.length === 0),
    datasetId: optionalString(record.dataset_id ?? record.datasetId),
    sampleId: optionalString(record.sample_id ?? record.sampleId),
    checkedOperationCount: maybeNumber(record.checked_operation_count ?? record.checkedOperationCount),
    errors,
    warnings: normalizeLabelEditIssues(record.warnings),
    checkedAt: optionalString(record.checked_at ?? record.checkedAt),
  };
};

const normalizeLabelEditState = (value: unknown): LabelEditState | undefined => {
  const record = isRecord(value) ? value : undefined;
  if (!record) {
    return undefined;
  }
  const editId = stringValue(record.edit_id ?? record.editId);
  const sampleId = stringValue(record.sample_id ?? record.sampleId);
  if (!editId || !sampleId) {
    return undefined;
  }
  return {
    editId,
    datasetId: stringValue(record.dataset_id ?? record.datasetId),
    sampleId,
    userId: optionalString(record.user_id ?? record.userId),
    taskMode: stringValue(record.task_mode ?? record.taskMode, 'label_edit') as LabelEditState['taskMode'],
    submitAction: stringValue(record.submit_action ?? record.submitAction, 'save_draft') as LabelEditState['submitAction'],
    taskStatus: stringValue(record.task_status ?? record.taskStatus, 'annotation_draft') as LabelEditState['taskStatus'],
    labelConfigId: optionalString(record.label_config_id ?? record.labelConfigId),
    labelConfigVersion: optionalString(record.label_config_version ?? record.labelConfigVersion),
    leaseId: optionalString(record.lease_id ?? record.leaseId),
    taskRevision: maybeNumber(record.task_revision ?? record.taskRevision),
    operations: normalizeLabelEditOperations(record.operations),
    updatedAt: stringValue(record.updated_at ?? record.updatedAt),
  };
};

const normalizeLabelEditSubmit = (
  value: unknown,
  payload: LabelEditSubmitPayload,
  sampleId: SampleId,
): LabelEditSubmitResult => {
  const record = isRecord(value) ? value : {};
  const state = normalizeLabelEditState(record.state);
  const validationValue = firstRecord(record.validation, record.field_validation);
  return {
    saved: booleanValue(record.saved, true),
    sampleId: state?.sampleId ?? stringValue(record.sample_id ?? record.sampleId, sampleId),
    submitAction: state?.submitAction ?? (stringValue(record.submit_action ?? record.submitAction, payload.submitAction) as LabelEditSubmitResult['submitAction']),
    taskStatus: state?.taskStatus ?? (stringValue(record.task_status ?? record.taskStatus, payload.taskStatus) as LabelEditSubmitResult['taskStatus']),
    editId: state?.editId ?? optionalString(record.patch_id ?? record.patchId),
    operationCount: state?.operations.length ?? numberValue(record.operation_count ?? record.operationCount, payload.operations.length),
    updatedAt: state?.updatedAt ?? optionalString(record.updated_at ?? record.updatedAt),
    state,
    validation: validationValue ? normalizeLabelEditValidation(validationValue) : undefined,
  };
};

const revisionValue = (value: unknown): number | string | undefined =>
  typeof value === 'number' || (typeof value === 'string' && value) ? value : undefined;

const nullableStringValue = (value: unknown): string | null | undefined => {
  if (value === null) {
    return null;
  }
  return optionalString(value);
};

const nullableRevisionValue = (value: unknown): number | string | null | undefined => {
  if (value === null) {
    return null;
  }
  return revisionValue(value);
};

const normalizeBatchLabelEditValidation = (value: unknown): BatchLabelEditDraftValidation | undefined => {
  const record = isRecord(value) ? value : undefined;
  if (!record) {
    return undefined;
  }
  const errors = normalizeLabelEditIssues(record.errors);
  const warnings = normalizeLabelEditIssues(record.warnings);
  return {
    valid: booleanValue(record.valid, errors.length === 0),
    errorCount: numberValue(record.error_count ?? record.errorCount, errors.length),
    warningCount: numberValue(record.warning_count ?? record.warningCount, warnings.length),
    errors,
    warnings,
  };
};

const normalizeBatchLabelEditDraftSample = (value: unknown, fallbackSampleId = ''): BatchLabelEditDraftSample | undefined => {
  const record = isRecord(value) ? value : undefined;
  if (!record) {
    return undefined;
  }
  const sampleId = stringValue(record.sample_id ?? record.sampleId, fallbackSampleId);
  if (!sampleId) {
    return undefined;
  }
  const validationValue = firstRecord(record.validation, record.field_validation);
  return {
    sampleId,
    labelConfigId: nullableStringValue(record.label_config_id ?? record.labelConfigId),
    labelConfigVersion: nullableStringValue(record.label_config_version ?? record.labelConfigVersion),
    leaseId: nullableStringValue(record.lease_id ?? record.leaseId),
    baseRevision: nullableRevisionValue(record.base_revision ?? record.baseRevision),
    operations: normalizeLabelEditOperations(record.operations),
    dirty: booleanValue(record.dirty),
    saved: booleanValue(record.saved),
    validation: validationValue ? normalizeBatchLabelEditValidation(validationValue) : undefined,
  };
};

const normalizeBatchLabelEditDraft = (value: unknown, datasetId: DatasetId): BatchLabelEditDraft => {
  const wrapper = isRecord(value) ? value : {};
  const record = firstRecord(wrapper.draft, wrapper.batch_draft, value) ?? {};
  const rawSamples = Array.isArray(record.entries)
    ? record.entries
    : Array.isArray(record.samples)
      ? record.samples
      : Array.isArray(record.sample_drafts)
        ? record.sample_drafts
        : listPayload(value, 'entries');
  const samples = rawSamples.flatMap((item) => {
    const sample = normalizeBatchLabelEditDraftSample(item);
    return sample ? [sample] : [];
  });
  return {
    draftId: optionalString(record.draft_id ?? record.draftId),
    datasetId: stringValue(record.dataset_id ?? record.datasetId, datasetId),
    userId: optionalString(record.user_id ?? record.userId),
    assignmentId: optionalString(record.assignment_id ?? record.assignmentId),
    labelConfigId: optionalString(record.label_config_id ?? record.labelConfigId),
    labelConfigVersion: optionalString(record.label_config_version ?? record.labelConfigVersion),
    totalSampleCount: maybeNumber(record.sample_count ?? record.sampleCount ?? record.total_sample_count ?? record.totalSampleCount),
    savedSampleCount: numberValue(record.saved_count ?? record.savedCount ?? record.saved_sample_count ?? record.savedSampleCount, samples.filter((sample) => sample.saved).length),
    dirtySampleCount: maybeNumber(record.dirty_count ?? record.dirtyCount ?? record.dirty_sample_count ?? record.dirtySampleCount),
    validationErrorCount: maybeNumber(record.validation_error_count ?? record.validationErrorCount),
    samples,
    updatedAt: optionalString(record.updated_at ?? record.updatedAt),
    autosavedAt: optionalString(record.autosaved_at ?? record.autosavedAt),
  };
};

const normalizeBatchLabelEditDraftSave = (
  value: unknown,
  datasetId: DatasetId,
  payload: BatchLabelEditDraftPayload,
): BatchLabelEditDraftSaveResult => {
  const record = isRecord(value) ? value : {};
  const nestedDraft = firstRecord(record.draft, record.batch_draft);
  const hasTopLevelDraft =
    Array.isArray(record.entries) ||
    Array.isArray(record.samples) ||
    Array.isArray(record.sample_drafts) ||
    record.dataset_id !== undefined ||
    record.datasetId !== undefined;
  const draft = nestedDraft
    ? normalizeBatchLabelEditDraft(nestedDraft, datasetId)
    : hasTopLevelDraft
      ? normalizeBatchLabelEditDraft(record, datasetId)
    : undefined;
  const responseEntries = Array.isArray(record.entries) ? record.entries : [];
  const sampleIds = arrayValue<unknown>(record.sample_ids ?? record.sampleIds)
    .flatMap((item) => (typeof item === 'string' ? [item] : []));
  const entrySampleIds = responseEntries.flatMap((item) => {
    const entry = normalizeBatchLabelEditDraftSample(item);
    return entry ? [entry.sampleId] : [];
  });
  const fallbackSampleIds = payload.entries.map((entry) => entry.sampleId);
  return {
    saved: booleanValue(record.saved, true),
    datasetId: stringValue(record.dataset_id ?? record.datasetId, datasetId),
    savedSampleCount: numberValue(
      record.saved_count ?? record.savedCount ?? record.saved_sample_count ?? record.savedSampleCount,
      draft?.savedSampleCount ?? (sampleIds.length || fallbackSampleIds.length),
    ),
    totalSampleCount: maybeNumber(record.sample_count ?? record.sampleCount ?? record.total_sample_count ?? record.totalSampleCount) ?? draft?.totalSampleCount,
    sampleIds: sampleIds.length ? sampleIds : entrySampleIds.length ? entrySampleIds : draft?.samples.map((sample) => sample.sampleId) ?? fallbackSampleIds,
    updatedAt: optionalString(record.updated_at ?? record.updatedAt) ?? draft?.updatedAt,
    draft,
  };
};

const normalizeBatchLabelEditSubmit = (value: unknown, datasetId: DatasetId): BatchLabelEditSubmitResult => {
  const record = isRecord(value) ? value : {};
  const assignment = normalizeBatchAssignment(record.assignment ?? record.batch_assignment, datasetId);
  return {
    submitted: booleanValue(record.submitted, true),
    datasetId: stringValue(record.dataset_id ?? record.datasetId, datasetId),
    assignmentId: optionalString(record.assignment_id ?? record.assignmentId),
    assigneeUserId: optionalString(record.assignee_user_id ?? record.assigneeUserId),
    status: optionalString(record.status ?? record.batch_status ?? record.assignment_status),
    submittedAt: optionalString(record.submitted_at ?? record.submittedAt),
    submittedSampleCount: maybeNumber(record.submitted_sample_count ?? record.submittedSampleCount),
    releasedLeaseCount: maybeNumber(record.released_lease_count ?? record.releasedLeaseCount),
    assignment,
  };
};

const normalizeBatchAssignment = (value: unknown, datasetId: DatasetId): BatchQcAssignment | undefined => {
  const wrapper = isRecord(value) ? value : {};
  const record = firstRecord(wrapper.assignment, wrapper.batch_assignment, value);
  if (!record) {
    return undefined;
  }
  const assigneeUserId = stringValue(record.assigneeUserId ?? record.assignee_user_id);
  const assignmentId = stringValue(record.assignmentId ?? record.assignment_id);
  if (!assigneeUserId && !assignmentId) {
    return undefined;
  }
  return {
    assignmentId: assignmentId || `assignment-${datasetId}`,
    qcQueueId: optionalString(record.qcQueueId ?? record.qc_queue_id),
    datasetId: stringValue(record.datasetId ?? record.dataset_id, datasetId),
    assigneeUserId,
    assigneeDisplayName: optionalString(record.assigneeDisplayName ?? record.assignee_display_name),
    assignedBy: optionalString(record.assignedBy ?? record.assigned_by),
    assignedByDisplayName: optionalString(record.assignedByDisplayName ?? record.assigned_by_display_name),
    status: stringValue(record.status, 'assigned') as BatchAssignmentStatus,
    assignedAt: optionalString(record.assignedAt ?? record.assigned_at),
    updatedAt: optionalString(record.updatedAt ?? record.updated_at),
    submittedAt: optionalString(record.submittedAt ?? record.submitted_at),
    confirmedAt: optionalString(record.confirmedAt ?? record.confirmed_at),
    returnedAt: optionalString(record.returnedAt ?? record.returned_at),
  };
};

const normalizeQcTask = (value: unknown, datasetId: DatasetId): QcTask => {
  const record = isRecord(value) ? value : {};
  const sampleId = stringValue(record.sampleId ?? record.sample_id);
  return {
    taskId: stringValue(record.taskId ?? record.task_id, `task-${sampleId}`),
    qcQueueId: optionalString(record.qcQueueId ?? record.qc_queue_id),
    datasetId: stringValue(record.datasetId ?? record.dataset_id, datasetId),
    sampleId,
    status: stringValue(record.status, 'queued') as QcTaskStatus,
    assigneeUserId: optionalString(record.assigneeUserId ?? record.assignee_user_id),
    assigneeDisplayName: optionalString(record.assigneeDisplayName ?? record.assignee_display_name),
    claimedAt: optionalString(record.claimedAt ?? record.claimed_at),
    submittedAt: optionalString(record.submittedAt ?? record.submitted_at),
    completedAt: optionalString(record.completedAt ?? record.completed_at),
    confirmedBy: optionalString(record.confirmedBy ?? record.confirmed_by),
    confirmedAt: optionalString(record.confirmedAt ?? record.confirmed_at),
    latestSubmissionId: optionalString(record.latestSubmissionId ?? record.latest_submission_id),
    labelConfigId: optionalString(record.labelConfigId ?? record.label_config_id),
    labelConfigVersion: optionalString(record.labelConfigVersion ?? record.label_config_version),
    taskRevision: maybeNumber(record.taskRevision ?? record.task_revision),
    updatedAt: optionalString(record.updatedAt ?? record.updated_at),
  };
};

const normalizeSampleLease = (
  value: unknown,
  datasetId: DatasetId,
  sampleId: SampleId,
): SampleLease | undefined => {
  const wrapper = isRecord(value) ? value : {};
  const record = firstRecord(wrapper.sample_lease, wrapper.lease, value);
  if (!record) {
    return undefined;
  }
  const leaseId = stringValue(record.leaseId ?? record.lease_id);
  if (!leaseId) {
    return undefined;
  }
  return {
    leaseId,
    datasetId: stringValue(record.datasetId ?? record.dataset_id, datasetId),
    sampleId: stringValue(record.sampleId ?? record.sample_id, sampleId),
    taskId: optionalString(record.taskId ?? record.task_id),
    userId: stringValue(record.userId ?? record.user_id),
    userDisplayName: optionalString(record.userDisplayName ?? record.user_display_name),
    status: stringValue(record.status, 'active') as LeaseStatus,
    acquiredAt: optionalString(record.acquiredAt ?? record.acquired_at),
    expiresAt: optionalString(record.expiresAt ?? record.expires_at),
    heartbeatAt: optionalString(record.heartbeatAt ?? record.heartbeat_at),
  };
};

const normalizeLabelEditDraft = (
  value: unknown,
  datasetId: DatasetId,
  sampleId: SampleId,
): LabelEditDraft | undefined => {
  const wrapper = isRecord(value) ? value : {};
  const record = firstRecord(wrapper.draft, wrapper.my_draft, value);
  if (!record) {
    return undefined;
  }
  const draftId = stringValue(record.draftId ?? record.draft_id ?? record.edit_id ?? record.editId);
  if (!draftId) {
    return undefined;
  }
  return {
    draftId,
    datasetId: stringValue(record.datasetId ?? record.dataset_id, datasetId),
    sampleId: stringValue(record.sampleId ?? record.sample_id, sampleId),
    userId: stringValue(record.userId ?? record.user_id),
    operations: normalizeLabelEditOperations(record.operations),
    labelConfigId: optionalString(record.labelConfigId ?? record.label_config_id),
    labelConfigVersion: optionalString(record.labelConfigVersion ?? record.label_config_version),
    leaseId: optionalString(record.leaseId ?? record.lease_id),
    taskRevision: maybeNumber(record.taskRevision ?? record.task_revision),
    updatedAt: optionalString(record.updatedAt ?? record.updated_at),
  };
};

const normalizeLabelEditSubmission = (
  value: unknown,
  datasetId: DatasetId,
  sampleId: SampleId,
): LabelEditSubmission => {
  const record = isRecord(value) ? value : {};
  const validationValue = firstRecord(record.validation, record.field_validation);
  return {
    submissionId: stringValue(record.submissionId ?? record.submission_id ?? record.edit_id, `submission-${sampleId}`),
    datasetId: stringValue(record.datasetId ?? record.dataset_id, datasetId),
    sampleId: stringValue(record.sampleId ?? record.sample_id, sampleId),
    userId: stringValue(record.userId ?? record.user_id),
    userDisplayName: optionalString(record.userDisplayName ?? record.user_display_name),
    status: stringValue(record.status ?? record.task_status, 'submitted') as LabelEditSubmission['status'],
    operations: normalizeLabelEditOperations(record.operations),
    validation: validationValue ? normalizeLabelEditValidation(validationValue) : undefined,
    labelConfigId: optionalString(record.labelConfigId ?? record.label_config_id),
    labelConfigVersion: optionalString(record.labelConfigVersion ?? record.label_config_version),
    taskRevision: maybeNumber(record.taskRevision ?? record.task_revision),
    submittedAt: optionalString(record.submittedAt ?? record.submitted_at ?? record.updated_at),
    confirmedBy: optionalString(record.confirmedBy ?? record.confirmed_by),
    confirmedAt: optionalString(record.confirmedAt ?? record.confirmed_at),
    returnedAt: optionalString(record.returnedAt ?? record.returned_at),
    returnReason: optionalString(record.returnReason ?? record.return_reason),
  };
};

const normalizeAuditEvent = (value: unknown): AuditEvent => {
  const record = isRecord(value) ? value : {};
  return {
    eventId: stringValue(record.eventId ?? record.event_id ?? record.id, 'audit-event'),
    actorUserId: stringValue(record.actorUserId ?? record.actor_user_id),
    actorDisplayName: optionalString(record.actorDisplayName ?? record.actor_display_name),
    actorRole: normalizeRole(record.actorRole ?? record.actor_role),
    action: stringValue(record.action),
    entityType: stringValue(record.entityType ?? record.entity_type),
    entityId: stringValue(record.entityId ?? record.entity_id),
    datasetId: optionalString(record.datasetId ?? record.dataset_id),
    sampleId: optionalString(record.sampleId ?? record.sample_id),
    before: record.before,
    after: record.after,
    details: isRecord(record.details) ? record.details : undefined,
    createdAt: stringValue(record.createdAt ?? record.created_at),
  };
};

const normalizeQcProgressDetail = (value: unknown, datasetId: DatasetId): QcProgress => {
  const record = isRecord(value) ? value : {};
  const byStatusRecord = isRecord(record.byStatus ?? record.by_status) ? (record.byStatus ?? record.by_status) as Record<string, unknown> : record;
  const byStatus = Object.fromEntries(
    ['assigned', 'in_progress', 'draft_saved', 'skipped', 'submitted', 'confirmed', 'returned', 'queued', 'completed']
      .map((status) => [status, maybeNumber(byStatusRecord[status]) ?? 0])
      .filter(([, count]) => Number(count) > 0),
  ) as QcProgress['byStatus'];
  const byUser = listPayload(record.byUser ?? record.by_user, 'by_user').map((item) => {
    const user = isRecord(item) ? item : {};
    return {
      userId: stringValue(user.userId ?? user.user_id),
      displayName: optionalString(user.displayName ?? user.display_name),
      draftSaved: numberValue(user.draftSaved ?? user.draft_saved),
      submitted: numberValue(user.submitted),
      returned: numberValue(user.returned),
      confirmed: numberValue(user.confirmed),
    };
  });
  return {
    datasetId: stringValue(record.datasetId ?? record.dataset_id, datasetId),
    byStatus,
    byUser,
    total: numberValue(record.total, Object.values(byStatus).reduce((sum, count) => sum + (count ?? 0), 0)),
    updatedAt: optionalString(record.updatedAt ?? record.updated_at),
  };
};

const normalizeQcWorkspace = (value: unknown, datasetId: DatasetId): QcWorkspace => {
  const record = isRecord(value) ? value : {};
  const queue = listPayload(value, 'queue').map((item) => normalizeQcQueueItem(item, datasetId));
  const tasks = listPayload(record.tasks, 'tasks').map((item) => normalizeQcTask(item, datasetId));
  const leases = listPayload(record.leases, 'leases')
    .flatMap((item) => {
      const lease = normalizeSampleLease(item, datasetId, stringValue(isRecord(item) ? item.sample_id ?? item.sampleId : ''));
      return lease ? [lease] : [];
    });
  return {
    datasetId,
    assignment: normalizeBatchAssignment(record.assignment ?? record.batch_assignment, datasetId),
    queue,
    tasks,
    leases,
    progress: isRecord(record.progress) ? normalizeQcProgressDetail(record.progress, datasetId) : undefined,
  };
};

const validationReportFromApiError = (error: unknown): LabelEditValidationResult | undefined => {
  if (!(error instanceof ApiClientError) || error.status !== 422) {
    return undefined;
  }
  const details = error.payload?.details;
  const detail = isRecord(details?.detail) ? details.detail : undefined;
  if (!detail || typeof detail.valid !== 'boolean') {
    return undefined;
  }
  return normalizeLabelEditValidation(detail);
};

const firstRecord = (...values: unknown[]): Record<string, unknown> | undefined =>
  values.find((item): item is Record<string, unknown> => isRecord(item));

const optionalString = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

const normalizeAssetItem = (value: unknown, datasetId: DatasetId): AssetListItem => {
  const record = isRecord(value) ? value : {};
  const backend = record as Partial<BackendRawAsset>;
  const sampleId = stringValue(record.sampleId ?? record.sample_id ?? backend.sample_id, 'unknown-sample');
  const assetId = stringValue(record.id ?? record.assetId ?? record.asset_id ?? backend.asset_id, sampleId);
  const rawStage2Status = stringValue(record.stage2Status ?? record.stage2_status, '');
  const hasStage2Failure = booleanValue(
    record.hasStage2Failure ?? record.has_stage2_failure,
    rawStage2Status === 'failure' || rawStage2Status === 'failed',
  );
  const imageUrl = toBrowserMediaUrl(stringValue(record.imageUrl ?? record.image_url ?? backend.image_url, ''));
  const thumbnailUrl = toBrowserMediaUrl(stringValue(record.thumbnailUrl ?? record.thumbnail_url, ''));

  return {
    id: assetId,
    datasetId: stringValue(record.datasetId ?? record.dataset_id, datasetId),
    datasetType: optionalString(record.datasetType ?? record.dataset_type),
    batchKey: optionalString(record.batchKey ?? record.batch_key),
    sampleId,
    imageUrl,
    thumbnailUrl,
    width: numberValue(record.width ?? backend.width, 1280),
    height: numberValue(record.height ?? backend.height, 720),
    mediaStatus: stringValue(record.mediaStatus ?? record.media_status, imageUrl ? 'valid' : 'unknown') as AssetListItem['mediaStatus'],
    importStatus: stringValue(record.importStatus ?? record.import_status, 'imported'),
    sourcePath: stringValue(record.sourcePath ?? record.source_image_path_internal ?? backend.source_image_path_internal, ''),
    importedAt: stringValue(record.importedAt ?? record.imported_at, ''),
    stage1Status: stringValue(record.stage1Status ?? record.stage1_status, 'ready') as AssetListItem['stage1Status'],
    stage2Status: normalizeStageStatus(rawStage2Status, hasStage2Failure ? 'failed' : 'ready'),
    preannotationStatus: optionalString(record.preannotationStatus ?? record.preannotation_status),
    judgeDecision: stringValue(record.judgeDecision ?? record.judge_decision ?? record.stage2_judge_decision, 'pass') as AssetListItem['judgeDecision'],
    qcStatus: normalizeQcStatus(record.qcStatus ?? record.qc_status),
    labelEditStatus: stringValue(record.labelEditStatus ?? record.label_edit_status, 'none') as AssetListItem['labelEditStatus'],
    hasStage2Failure,
    violationCategories: normalizeStringList(record.violationCategories ?? record.violation_categories),
    sampleCategories: normalizeStringList(record.sampleCategories ?? record.sample_categories),
    candidateCount: numberValue(record.candidateCount ?? record.candidate_count),
    highestConfidence: maybeNumber(record.highestConfidence ?? record.highest_confidence),
    updatedAt: stringValue(record.updatedAt ?? record.updated_at ?? record.importedAt ?? record.imported_at, ''),
  };
};

const normalizeStageStatus = (value: string, fallback: StageStatus): StageStatus => {
  if (value === 'failure') {
    return 'failed';
  }
  if (value === 'success') {
    return 'ready';
  }
  if (value === 'missing' || value === 'ready' || value === 'passed' || value === 'failed') {
    return value;
  }
  return fallback;
};

const normalizeQcStatus = (value: unknown): QcStatus => {
  const status = stringValue(value, 'qc_pending');
  if (status === 'pending') {
    return 'qc_pending';
  }
  if (status === 'reviewed') {
    return 'passed';
  }
  if (
    status === 'qc_pending' ||
    status === 'needs_review' ||
    status === 'passed' ||
    status === 'rejected' ||
    status === 'manual_label_required'
  ) {
    return status;
  }
  return 'qc_pending';
};

const normalizeStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => (typeof item === 'string' ? [item] : []));
  }
  return typeof value === 'string' && value ? [value] : [];
};

const maybeNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const normalizeBBox = (value: unknown): BBox => {
  const numbers = arrayValue<number>(value).filter((item) => typeof item === 'number');
  return numbers.length === 4 ? [numbers[0], numbers[1], numbers[2], numbers[3]] : [0, 0, 0, 0];
};

const normalizeStage1 = (value: unknown, sampleId: SampleId): PreAnnotationStep1 => {
  const record = isRecord(value) ? value : {};
  const backend = record as Partial<BackendStage1Preannotation>;
  const relationsSource = record.keyRelations ?? record.key_relations ?? backend.key_relations;
  const anchorsSource = record.keyAnchors ?? record.key_anchors ?? backend.key_anchors;
  const decision = stringValue(record.judgeDecision ?? record.judge_decision ?? backend.judge_decision, 'unknown');

  return {
    sampleId: stringValue(record.sampleId ?? record.sample_id ?? backend.sample_id, sampleId),
    environmentAnalysis: stringValue(record.environmentAnalysis ?? record.environment_analysis ?? backend.environment_analysis),
    sceneElements: normalizeStringList(record.sceneElements ?? record.scene_elements ?? backend.scene_elements),
    keyAnchors: arrayValue<unknown>(anchorsSource).map((item) => {
      if (typeof item === 'string') {
        return { anchor: item };
      }
      const anchor = isRecord(item) ? item : {};
      return {
        anchor: stringValue(anchor.anchor, ''),
        bbox: Array.isArray(anchor.bbox) ? normalizeBBox(anchor.bbox) : undefined,
      };
    }),
    keyRelations: arrayValue<unknown>(relationsSource).map<StageRelation>((item, index) => {
      const relation = isRecord(item) ? item : {};
      return {
        relationIndex: stringValue(relation.relationIndex ?? relation.relation_index, `R${index + 1}`),
        subject: stringValue(relation.subject),
        relation: stringValue(relation.relation),
        object: stringValue(relation.object),
        description: stringValue(relation.description, ''),
        bbox: normalizeBBox(relation.bbox),
      };
    }),
    judgeReport: {
      decision: (decision === 'unknown' ? 'soft_fail' : decision) as JudgeDecision,
      reason: stringValue(record.judgeReportReason ?? record.judge_report_reason, ''),
    },
  };
};

const normalizeStage2 = (value: unknown, sampleId: SampleId): PreAnnotationStep2 => {
  const record = isRecord(value) ? value : {};
  const backend = record as Partial<BackendStage2Preannotation>;
  const verificationsSource = record.factVerifications ?? record.fact_verifications ?? backend.fact_verifications;
  const candidatesSource = record.candidates ?? backend.candidates;

  return {
    sampleId: stringValue(record.sampleId ?? record.sample_id ?? backend.sample_id, sampleId),
    factVerifications: arrayValue<unknown>(verificationsSource).map<FactVerification>((item) => {
      const verification = isRecord(item) ? item : {};
      const relationIndex = verification.relationIndex ?? verification.relation_index;
      const bboxObservation = stringValue(verification.bboxObservation ?? verification.bbox_observation);
      const globalContextObservation = stringValue(
        verification.globalContextObservation ?? verification.global_context_observation,
      );
      return {
        relationIndex: typeof relationIndex === 'number' ? `R${relationIndex + 1}` : stringValue(relationIndex, 'R1'),
        subject: stringValue(verification.subject),
        relation: stringValue(verification.relation),
        object: stringValue(verification.object),
        bbox: normalizeBBox(verification.bbox),
        visibilityLevel: stringValue(verification.visibilityLevel ?? verification.visibility_level, 'unknown') as FactVerification['visibilityLevel'],
        informationLossType: optionalString(verification.informationLossType ?? verification.information_loss_type),
        subjectVisible: typeof (verification.subjectVisible ?? verification.subject_visible) === 'boolean'
          ? Boolean(verification.subjectVisible ?? verification.subject_visible)
          : undefined,
        subjectMatch: typeof (verification.subjectMatch ?? verification.subject_match) === 'boolean'
          ? Boolean(verification.subjectMatch ?? verification.subject_match)
          : undefined,
        keyAttributesVisible: normalizeStringList(
          verification.keyAttributesVisible ?? verification.key_attributes_visible ?? verification.visible_attributes,
        ),
        bboxObservation,
        globalContextObservation,
        observations: stringValue(
          verification.observations,
          [bboxObservation, globalContextObservation].filter(Boolean).join(' '),
        ),
        verificationResult: stringValue(verification.verificationResult ?? verification.verification_result, 'unclear') as FactVerification['verificationResult'],
        verificationConfidence: numberValue(verification.verificationConfidence ?? verification.verification_confidence),
      };
    }),
    candidates: arrayValue<unknown>(candidatesSource).flatMap((item) => normalizeCandidate(item)),
    judgeReport: isRecord(record.judgeReport)
      ? {
          decision: stringValue(record.judgeReport.decision, 'soft_fail') as JudgeDecision,
          reason: stringValue(record.judgeReport.reason, ''),
        }
      : undefined,
  };
};

const normalizeCandidate = (value: unknown): Stage2Candidate[] => {
  const record = isRecord(value) ? value : {};
  const backend = record as Partial<BackendStage2Candidate>;
  const categories = normalizeStringList(record.violationCategory ?? record.violation_category ?? backend.violation_category);
  const evidenceIndices = arrayValue<string | number>(
    record.evidenceRelationIndices ?? record.evidence_relation_indices ?? backend.evidence_relation_indices,
  ).map((index) => (typeof index === 'number' ? `R${index + 1}` : index));
  const base = {
    evidenceRelationIndices: evidenceIndices,
    evidenceReasoning: stringValue(record.evidenceReasoning ?? record.evidence_reasoning ?? backend.evidence_reasoning),
    relationHint: stringValue(record.relationHint ?? record.relation_hint ?? backend.relation_hint, ''),
    segmentationTargets: normalizeStringList(record.segmentationTargets ?? record.segmentation_targets ?? backend.segmentation_targets),
    confidence: numberValue(record.confidence ?? backend.confidence),
    sampleCategory: stringValue(record.sampleCategory ?? record.sample_category ?? backend.sample_category, 'hard boundary samples'),
  };

  return (categories.length > 0 ? categories : ['uncategorized']).map((category) => ({
    ...base,
    violationCategory: category,
  }));
};

const normalizeStage2Failure = (value: unknown, sampleId: SampleId): Stage2Failure | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const backend = value as Partial<BackendStage2PreannotationFailure>;
  return {
    sampleId: stringValue(value.sampleId ?? value.sample_id ?? backend.sample_id, sampleId),
    errorType: stringValue(value.errorType ?? value.error_type ?? backend.error_type, 'Stage2Failure'),
    message: stringValue(value.message ?? backend.message),
    rawArtifactUrl: toBrowserMediaUrl(stringValue(value.rawArtifactUrl ?? value.raw_artifact_url, '')),
  };
};

const normalizeHumanReview = (value: unknown, sampleId: SampleId): HumanReview => {
  const record = isRecord(value) ? value : {};
  const backend = record as Partial<BackendHumanReview>;
  return {
    id: stringValue(record.id ?? record.review_id ?? backend.review_id, `review-${sampleId}`),
    sampleId: stringValue(record.sampleId ?? record.sample_id ?? backend.sample_id, sampleId),
    decision: stringValue(record.decision ?? backend.decision, 'needs_changes') as ReviewDecision,
    reviewer: stringValue(record.reviewer ?? backend.reviewer, ''),
    reasoning: stringValue(record.reasoning ?? record.notes ?? backend.notes, ''),
    updatedAt: stringValue(record.updatedAt ?? record.updated_at ?? record.created_at ?? backend.created_at, ''),
  };
};

const normalizeAuditArtifacts = (value: unknown): AuditArtifact[] =>
  arrayValue<unknown>(value).map((item) => {
    const record = isRecord(item) ? item : {};
    const backend = record as Partial<BackendAuditArtifact>;
    const artifactType = stringValue(record.artifactType ?? record.artifact_type ?? backend.artifact_type, 'record') as AuditArtifact['artifactType'];
    return {
      id: stringValue(record.id ?? record.artifact_id ?? backend.artifact_id),
      label: stringValue(record.label, artifactType),
      artifactType,
      url: toBrowserMediaUrl(stringValue(record.url ?? record.storage_url ?? backend.storage_url, '')) ?? '',
      createdAt: stringValue(record.createdAt ?? record.created_at ?? backend.created_at, ''),
    };
  });

const normalizeReviewSample = (payload: unknown, datasetId: DatasetId, sampleId: SampleId): ReviewSampleDetail => {
  const record = isRecord(payload) ? payload : {};
  const asset = normalizeAssetItem(record.asset ?? record.raw_asset ?? record.rawAsset ?? payload, datasetId);
  const stage1 = normalizeStage1(record.stage1 ?? record.stage1_preannotation ?? record.stage1Preannotation, sampleId);
  const stage2Value = record.stage2 ?? record.stage2_preannotation ?? record.stage2Preannotation;
  const stage2 = isRecord(stage2Value) ? normalizeStage2(stage2Value, sampleId) : undefined;
  const failure = normalizeStage2Failure(
    record.stage2Failure ?? record.stage2_failure ?? record.stage2PreannotationFailure,
    sampleId,
  );
  const humanReviewValue = record.humanReview ?? record.human_review;
  const myDraft = normalizeLabelEditDraft(record.myDraft ?? record.my_draft, datasetId, sampleId);
  const labelEditState = normalizeLabelEditState(record.labelEditState ?? record.label_edit_state) ?? (myDraft
    ? {
        editId: myDraft.draftId,
        datasetId: myDraft.datasetId,
        sampleId: myDraft.sampleId,
        userId: myDraft.userId,
        taskMode: 'label_edit',
        submitAction: 'save_draft',
        taskStatus: 'annotation_draft',
        labelConfigId: myDraft.labelConfigId,
        labelConfigVersion: myDraft.labelConfigVersion,
        leaseId: myDraft.leaseId,
        taskRevision: myDraft.taskRevision,
        operations: myDraft.operations,
        updatedAt: myDraft.updatedAt ?? '',
      } satisfies LabelEditState
    : undefined);
  const latestSubmissionValue = firstRecord(record.latestSubmission, record.latest_submission);

  return {
    asset,
    stage1,
    stage2,
    stage2Failure: failure,
    humanReview: isRecord(humanReviewValue) ? normalizeHumanReview(humanReviewValue, sampleId) : undefined,
    auditArtifacts: normalizeAuditArtifacts(record.auditArtifacts ?? record.audit_artifacts),
    labelEditState,
    labelEditHistory: arrayValue<unknown>(record.labelEditHistory ?? record.label_edit_history)
      .flatMap((item) => {
        const state = normalizeLabelEditState(item);
        return state ? [state] : [];
      }),
    currentUser: isRecord(record.currentUser ?? record.current_user)
      ? normalizeCurrentUser(record.currentUser ?? record.current_user)
      : undefined,
    batchAssignment: normalizeBatchAssignment(record.batchAssignment ?? record.batch_assignment, datasetId),
    qcTask: isRecord(record.qcTask ?? record.qc_task) ? normalizeQcTask(record.qcTask ?? record.qc_task, datasetId) : undefined,
    sampleLease: normalizeSampleLease(record.sampleLease ?? record.sample_lease, datasetId, sampleId),
    myDraft,
    latestSubmission: latestSubmissionValue ? normalizeLabelEditSubmission(latestSubmissionValue, datasetId, sampleId) : undefined,
  };
};

const normalizeQcQueueItem = (value: unknown, datasetId: DatasetId): QcQueueItem => {
  const record = isRecord(value) ? value : {};
  if ('asset_id' in record || 'assetId' in record) {
    const task = isRecord(record.task ?? record.qc_task)
      ? normalizeQcTask(record.task ?? record.qc_task, datasetId)
      : undefined;
    const lease = normalizeSampleLease(record.lease ?? record.sample_lease, datasetId, stringValue(record.sampleId ?? record.sample_id));
    const latestSubmissionValue = firstRecord(record.latestSubmission, record.latest_submission);
    return {
      sampleId: stringValue(record.sampleId ?? record.sample_id),
      assetId: stringValue(record.assetId ?? record.asset_id),
      status: stringValue(record.status ?? record.qc_status, 'qc_pending') as QcQueueItem['status'],
      judgeDecision: stringValue(record.judgeDecision ?? record.judge_decision, 'pass') as QcQueueItem['judgeDecision'],
      highestConfidence: maybeNumber(record.highestConfidence ?? record.highest_confidence),
      primaryCategory: stringValue(record.primaryCategory ?? record.primary_category, ''),
      stage2Failure: booleanValue(record.stage2Failure ?? record.stage2_failure),
      updatedAt: stringValue(record.updatedAt ?? record.updated_at, ''),
      task,
      taskStatus: (task?.status ?? optionalString(record.task_status)) as QcTaskStatus | undefined,
      assigneeUserId: task?.assigneeUserId ?? optionalString(record.assigneeUserId ?? record.assignee_user_id),
      assigneeDisplayName: task?.assigneeDisplayName ?? optionalString(record.assigneeDisplayName ?? record.assignee_display_name),
      lease,
      leaseStatus: (lease?.status ?? optionalString(record.lease_status)) as LeaseStatus | undefined,
      latestSubmission: latestSubmissionValue
        ? normalizeLabelEditSubmission(latestSubmissionValue, datasetId, stringValue(record.sampleId ?? record.sample_id))
        : undefined,
      labelConfigVersion: task?.labelConfigVersion ?? optionalDisplayString(record.labelConfigVersion ?? record.label_config_version),
    };
  }

  const asset = normalizeAssetItem(value, datasetId);
  const task = isRecord(record.task ?? record.qc_task)
    ? normalizeQcTask(record.task ?? record.qc_task, datasetId)
    : undefined;
  const lease = normalizeSampleLease(record.lease ?? record.sample_lease, datasetId, asset.sampleId);
  const latestSubmissionValue = firstRecord(record.latestSubmission, record.latest_submission);
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
    taskStatus: (task?.status ?? optionalString(record.task_status)) as QcTaskStatus | undefined,
    assigneeUserId: task?.assigneeUserId ?? optionalString(record.assigneeUserId ?? record.assignee_user_id),
    assigneeDisplayName: task?.assigneeDisplayName ?? optionalString(record.assigneeDisplayName ?? record.assignee_display_name),
    lease,
    leaseStatus: (lease?.status ?? optionalString(record.lease_status)) as LeaseStatus | undefined,
    latestSubmission: latestSubmissionValue
      ? normalizeLabelEditSubmission(latestSubmissionValue, datasetId, asset.sampleId)
      : undefined,
    labelConfigVersion: task?.labelConfigVersion ?? optionalDisplayString(record.labelConfigVersion ?? record.label_config_version),
  };
};

const normalizeImportJobSummary = (payload: unknown, datasetId: DatasetId): ImportJobSummary => {
  const detail = normalizeImportJob(payload, datasetId, 'unknown-import-job');
  const validation = detail.validationReport;
  return {
    id: detail.id,
    datasetId: detail.datasetId,
    state: detail.state,
    title: detail.title,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    blockingIssueCount: validation?.blockingErrors.length ?? detail.warnings.filter((item) => item.severity === 'blocking').length,
    warningCount: validation?.warnings.length ?? detail.warnings.filter((item) => item.severity !== 'blocking').length,
    totals: detail.totals,
    processingProgress: detail.processingProgress,
  };
};

const hasImportProgressFlatFields = (record: Record<string, unknown>) => (
  record.progress_percent !== undefined ||
  record.processing_percent !== undefined ||
  record.progressPercent !== undefined ||
  record.processingPercent !== undefined ||
  record.processed_items !== undefined ||
  record.processedItems !== undefined ||
  record.completed_items !== undefined ||
  record.completedItems !== undefined ||
  record.total_items !== undefined ||
  record.totalItems !== undefined ||
  record.progress_message !== undefined ||
  record.progressMessage !== undefined ||
  record.progress_phase !== undefined ||
  record.progressPhase !== undefined ||
  record.progress_expires_at !== undefined ||
  record.progressExpiresAt !== undefined
);

const normalizeImportProcessingProgress = (payload: unknown, fallbackRecord?: Record<string, unknown>): ImportProcessingProgress | undefined => {
  const record = firstRecord(payload) ?? (fallbackRecord && hasImportProgressFlatFields(fallbackRecord) ? fallbackRecord : undefined);
  if (!record) {
    return undefined;
  }
  const ratio = maybeNumber(record.ratio ?? record.fraction ?? record.progress_ratio ?? record.progressRatio);
  const explicitPercent = maybeNumber(
    record.percent ??
      record.percentage ??
      record.progress_percent ??
      record.progressPercent ??
      record.processing_percent ??
      record.processingPercent,
  ) ?? (ratio !== undefined ? ratio * 100 : undefined);
  const processedItems = maybeNumber(
    record.processedItems ??
      record.processed_items ??
      record.completedItems ??
      record.completed_items ??
      record.current ??
      record.current_items,
  );
  const totalItems = maybeNumber(
    record.totalItems ??
      record.total_items ??
      record.total ??
      record.expectedItems ??
      record.expected_items ??
      record.expected,
  );
  const percent = explicitPercent ??
    (processedItems !== undefined && totalItems !== undefined && totalItems > 0
      ? Math.max(0, Math.min(100, Math.round((processedItems / totalItems) * 100)))
      : undefined);
  const progress: ImportProcessingProgress = {
    phase: optionalString(record.phase ?? record.stage ?? record.step ?? record.progress_phase ?? record.progressPhase),
    status: optionalString(record.status ?? record.state),
    message: optionalString(record.message ?? record.detail ?? record.description ?? record.progress_message ?? record.progressMessage),
    processedItems,
    totalItems,
    percent,
    updatedAt: optionalString(record.updatedAt ?? record.updated_at ?? record.progress_updated_at ?? record.progressUpdatedAt),
    expiresAt: optionalString(record.expiresAt ?? record.expires_at ?? record.progress_expires_at ?? record.progressExpiresAt),
    expired: typeof record.expired === 'boolean' ? record.expired : undefined,
  };
  return Object.values(progress).some((value) => value !== undefined) ? progress : undefined;
};

const normalizeImportValidationReport = (
  value: unknown,
  datasetId: DatasetId,
  jobId: ImportJobId,
  fallback: Pick<ImportJobDetail, 'totals' | 'coverage' | 'warnings' | 'validationRows'>,
): ImportValidationReport => {
  const record = isRecord(value) ? value : {};
  const warnings = normalizeWarnings(record.warnings ?? record.non_blocking_warnings ?? record.nonBlockingWarnings);
  const blockingErrors = normalizeWarnings(
    record.blockingErrors ?? record.blocking_errors ?? record.errors ?? record.validation_errors ?? record.validationErrors,
  )
    .map((item) => ({ ...item, severity: 'blocking' as const }));
  const allWarnings = warnings.length ? warnings : fallback.warnings.filter((item) => item.severity !== 'blocking');
  const allBlocking = blockingErrors.length
    ? blockingErrors
    : fallback.warnings.filter((item) => item.severity === 'blocking');

  return {
    datasetId: stringValue(record.datasetId ?? record.dataset_id, datasetId),
    jobId: stringValue(record.jobId ?? record.job_id, jobId),
    valid: booleanValue(record.valid, allBlocking.length === 0),
    totals: normalizeTotals(record.totals ?? record, fallback.totals),
    coverage: normalizeCoverage(record.coverage, fallback.coverage),
    blockingErrors: allBlocking,
    warnings: allWarnings,
    rows: normalizeImportValidationRows(record.rows ?? record.validationRows ?? record.validation_rows).length
      ? normalizeImportValidationRows(record.rows ?? record.validationRows ?? record.validation_rows)
      : fallback.validationRows,
    checkedAt: optionalString(record.checkedAt ?? record.checked_at),
  };
};

const normalizeImportJob = (payload: unknown, datasetId: DatasetId, jobId: ImportJobId): ImportJobDetail => {
  const record = isRecord(payload) ? payload : {};
  const backend = record as Partial<BackendImportJob>;
  const state = stringValue(record.state ?? backend.state, 'Draft') as ImportJobState;
  const rawTotals = isRecord(record.totals) ? record.totals : record;
  const expectedAssets = numberValue(rawTotals.rawAssets ?? rawTotals.raw_assets ?? record.expected_assets ?? record.expectedAssets ?? backend.expected_assets);
  const importedAssets = numberValue(rawTotals.stage1Parsed ?? rawTotals.stage1_parsed ?? record.imported_assets ?? record.importedAssets ?? backend.imported_assets, expectedAssets);
  const stage2Parsed = numberValue(rawTotals.stage2Parsed ?? rawTotals.stage2_parsed ?? record.stage2_success_count ?? record.stage2SuccessCount, importedAssets);
  const failureCount = numberValue(rawTotals.stage2Failures ?? rawTotals.stage2_failures ?? record.failure_count ?? record.failureCount ?? backend.failure_count);
  const validationErrors = arrayValue<string>(record.validation_errors ?? record.validationErrors ?? backend.validation_errors);
  const id = stringValue(record.id ?? record.job_id ?? backend.job_id, jobId);
  const totals = normalizeTotals(rawTotals, {
    rawAssets: expectedAssets,
    stage1Parsed: importedAssets,
    stage2Parsed,
    stage2Failures: failureCount,
  });
  const coverage = normalizeCoverage(record.coverage, {
    stage1: totals.rawAssets > 0 ? totals.stage1Parsed / totals.rawAssets : 0,
    stage2: totals.rawAssets > 0 ? totals.stage2Parsed / totals.rawAssets : 0,
  });
  const warnings = normalizeWarnings(record.warnings ?? record.importWarnings ?? record.import_warnings);
  const normalizedWarnings = warnings.length
    ? warnings
    : validationErrors.map((message, index) => ({
        id: `validation-${index + 1}`,
        severity: 'blocking' as const,
        title: 'Validation error',
        message,
      }));
  const validationRows = normalizeImportValidationRows(record.validationRows ?? record.validation_rows);
  const detail: ImportJobDetail = {
    id,
    datasetId: stringValue(record.datasetId ?? record.dataset_id ?? backend.dataset_id, datasetId),
    datasetType: optionalString(record.datasetType ?? record.dataset_type ?? backend.dataset_type),
    batchKey: optionalString(record.batchKey ?? record.batch_key ?? backend.batch_key),
    title: optionalString(record.title ?? record.name),
    sourceMode: optionalString(record.sourceMode ?? record.source_mode) as ImportJobDetail['sourceMode'],
    sourceUri: optionalString(record.sourceUri ?? record.source_uri ?? record.source_root),
    sourceStructure: optionalString(record.sourceStructure ?? record.source_structure) as ImportJobDetail['sourceStructure'],
    state,
    activeStep: numberValue(record.activeStep ?? record.active_step, importStateStep(state)),
    createdAt: stringValue(record.createdAt ?? record.created_at, ''),
    updatedAt: stringValue(record.updatedAt ?? record.updated_at, ''),
    totals,
    coverage,
    warnings: normalizedWarnings,
    validationRows,
    mappingSteps: normalizeImportMappingSteps(record.mappingSteps ?? record.mapping_steps, {
      expectedAssets: totals.rawAssets,
      importedAssets: totals.stage1Parsed,
      stage2Parsed: totals.stage2Parsed,
      failureCount: totals.stage2Failures,
    }),
    processingProgress: normalizeImportProcessingProgress(
      record.processingProgress ??
        record.processing_progress ??
        record.liveProgress ??
        record.live_progress ??
        record.importProgress ??
        record.import_progress ??
        backend.live_progress ??
        backend.processing_progress ??
        backend.import_progress ??
        record.progress ??
        backend.progress,
      record,
    ),
  };

  const validationReportValue = firstRecord(record.validationReport, record.validation_report, record.report);
  detail.validationReport = normalizeImportValidationReport(validationReportValue ?? record, detail.datasetId, detail.id, detail);
  return detail;
};

const normalizeTotals = (
  value: unknown,
  fallback: DatasetSummary['totals'],
): DatasetSummary['totals'] => {
  const record = isRecord(value) ? value : {};
  return {
    rawAssets: numberValue(record.rawAssets ?? record.raw_assets ?? record.total_assets, fallback.rawAssets),
    stage1Parsed: numberValue(record.stage1Parsed ?? record.stage1_parsed ?? record.stage1_count, fallback.stage1Parsed),
    stage2Parsed: numberValue(record.stage2Parsed ?? record.stage2_parsed ?? record.stage2_success_count, fallback.stage2Parsed),
    stage2Failures: numberValue(record.stage2Failures ?? record.stage2_failures ?? record.stage2_failure_count, fallback.stage2Failures),
  };
};

const normalizeCoverage = (
  value: unknown,
  fallback: DatasetSummary['coverage'],
): DatasetSummary['coverage'] => {
  const record = isRecord(value) ? value : {};
  return {
    stage1: numberValue(record.stage1, fallback.stage1),
    stage2: numberValue(record.stage2, fallback.stage2),
  };
};

const normalizeImportValidationRows = (value: unknown): ImportJobDetail['validationRows'] =>
  arrayValue<unknown>(value).map((item) => {
    const record = isRecord(item) ? item : {};
    return {
      sampleId: stringValue(record.sampleId ?? record.sample_id),
      imagePath: stringValue(record.imagePath ?? record.image_path),
      stage1Path: stringValue(record.stage1Path ?? record.stage1_path, ''),
      stage2Path: stringValue(record.stage2Path ?? record.stage2_path, ''),
      failurePath: stringValue(record.failurePath ?? record.failure_path, ''),
      status: stringValue(record.status, 'ready') as ImportJobDetail['validationRows'][number]['status'],
    };
  });

const normalizeImportMappingSteps = (
  value: unknown,
  fallback: { expectedAssets: number; importedAssets: number; stage2Parsed: number; failureCount: number },
): ImportJobDetail['mappingSteps'] => {
  const items = arrayValue<unknown>(value).map((item) => {
    const record = isRecord(item) ? item : {};
    return {
      id: stringValue(record.id),
      label: stringValue(record.label),
      count: numberValue(record.count),
      entity: stringValue(record.entity, 'RawAsset') as ImportJobDetail['mappingSteps'][number]['entity'],
    };
  });

  return items.length
    ? items
    : [
        { id: 'raw', label: 'Raw assets', count: fallback.expectedAssets, entity: 'RawAsset' },
        { id: 'stage1', label: 'Stage1 records', count: fallback.importedAssets, entity: 'PreAnnotationStep1' },
        { id: 'stage2', label: 'Stage2 records', count: fallback.stage2Parsed, entity: 'PreAnnotationStep2' },
        { id: 'failures', label: 'Stage2 failures', count: fallback.failureCount, entity: 'PreAnnotationFailure' },
      ];
};

const normalizePreannotationSummary = (payload: unknown, datasetId: DatasetId): PreannotationSummary => {
  const record = isRecord(payload) ? payload : {};
  if ('stage1' in record && 'stage2' in record) {
    return record as unknown as PreannotationSummary;
  }

  return {
    datasetId,
    stage1: {
      succeeded: numberValue(record.stage1_count),
      failed: numberValue(record.stage1_failure_count),
      bboxValid: numberValue(record.stage1_bbox_valid_count ?? record.stage1_count),
    },
    stage2: {
      parsed: numberValue(record.stage2_success_count),
      failures: numberValue(record.stage2_failure_count),
      factVerificationCount: numberValue(record.fact_verification_count),
      candidateCount: numberValue(record.candidate_count),
    },
    categoryDistribution: normalizeDistributionList(record.categoryDistribution ?? record.category_distribution),
    verificationDistribution: normalizeDistributionList(record.verificationDistribution ?? record.verification_distribution),
  };
};

const importStateStep = (state: ImportJobState) => {
  if (state === 'Draft') {
    return 1;
  }
  if (state === 'Uploading' || state === 'Uploaded') {
    return 2;
  }
  if (state === 'Scanning' || state === 'Validating' || state === 'ValidationPassed' || state === 'ValidationFailed') {
    return 3;
  }
  if (state === 'PreviewReady') {
    return 4;
  }
  if (state === 'Importing' || state === 'ImportFailed') {
    return 5;
  }
  return 6;
};

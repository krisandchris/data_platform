import { HttpClient } from './http';
import { toBrowserMediaUrl } from './media';
import type {
  BatchAssignmentPayload,
  BatchLabelEditDraft,
  BatchLabelEditDraftPayload,
  BatchLabelEditDraftSaveResult,
  BatchLabelEditDraftSample,
  BatchLabelEditDraftValidation,
  BatchLabelEditSubmitPayload,
  BatchLabelEditSubmitResult,
  BatchQcAssignment,
  BBox,
  CurrentUser,
  Dataset,
  DatasetId,
  DatasetType,
  DatasetTypeId,
  ImportArchiveUploadPayload,
  ImportJobDetail,
  ImportJobId,
  ImportJobState,
  ImportProcessingProgress,
  ImportValidationReport,
  ImportWarning,
  LabelConfig,
  LabelConfigField,
  LabelConfigOption,
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
  PreAnnotationStep1,
  PreAnnotationStep2,
  QcQueueItem,
  QcTask,
  QcTaskStatus,
  QcWorkspace,
  ReviewSampleDetail,
  SampleId,
  SampleLease,
  Stage2Candidate,
  Stage2Failure,
  StageRelation,
  UserAccount,
  UserRole,
} from '../shared/types/contract';

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
  getCurrentUser(): Promise<CurrentUser>;
  listBatchAssignableUsers(datasetId: DatasetId): Promise<UserAccount[]>;
  getDatasetType(datasetType: DatasetTypeId): Promise<DatasetType>;
  createImportJobArchive(datasetId: DatasetId, payload: ImportArchiveUploadPayload): Promise<ImportJobDetail>;
  getDatasetBatchImportJob(batchId: DatasetId, jobId: ImportJobId): Promise<ImportJobDetail>;
  getImportJob(datasetId: DatasetId, jobId: ImportJobId): Promise<ImportJobDetail>;
  scanImportJob(datasetId: DatasetId, jobId: ImportJobId): Promise<ImportJobDetail>;
  validateImportJob(datasetId: DatasetId, jobId: ImportJobId): Promise<ImportJobDetail>;
  confirmImportJob(datasetId: DatasetId, jobId: ImportJobId): Promise<ImportJobDetail>;
  retryImportJob(datasetId: DatasetId, jobId: ImportJobId): Promise<ImportJobDetail>;
  listQcQueue(datasetId: DatasetId): Promise<QcQueueItem[]>;
  getQcWorkspace(datasetId: DatasetId): Promise<QcWorkspace>;
  generateQcQueue(datasetId: DatasetId): Promise<QcWorkspace>;
  assignBatch(datasetId: DatasetId, payload: BatchAssignmentPayload): Promise<BatchQcAssignment>;
  reassignBatch(datasetId: DatasetId, payload: BatchAssignmentPayload): Promise<BatchQcAssignment>;
  releaseBatchAssignment(datasetId: DatasetId): Promise<BatchQcAssignment | undefined>;
  getReviewSample(datasetId: DatasetId, sampleId: SampleId): Promise<ReviewSampleDetail>;
  acquireSampleLease(datasetId: DatasetId, sampleId: SampleId): Promise<SampleLease>;
  heartbeatSampleLease(datasetId: DatasetId, sampleId: SampleId, leaseId: string): Promise<SampleLease>;
  releaseSampleLease(datasetId: DatasetId, sampleId: SampleId, leaseId: string): Promise<SampleLease | undefined>;
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
  saveMyBatchLabelEditDraft(datasetId: DatasetId, payload: BatchLabelEditDraftPayload): Promise<BatchLabelEditDraftSaveResult>;
  autosaveMyBatchLabelEditDraft(datasetId: DatasetId, payload: BatchLabelEditDraftPayload): Promise<BatchLabelEditDraftSaveResult>;
  submitBatchLabelEdits(datasetId: DatasetId, payload: BatchLabelEditSubmitPayload): Promise<BatchLabelEditSubmitResult>;
  confirmLabelEditSubmission(datasetId: DatasetId, sampleId: SampleId, submissionId: string): Promise<LabelEditSubmission>;
  returnLabelEditSubmission(
    datasetId: DatasetId,
    sampleId: SampleId,
    submissionId: string,
    reason?: string,
  ): Promise<LabelEditSubmission>;
}

export class HttpUrbanViolationApi implements UrbanViolationApi {
  constructor(private readonly http = new HttpClient()) {}

  async getCurrentUser(): Promise<CurrentUser> {
    return normalizeCurrentUser(await this.http.get<unknown>('/me'));
  }

  async listBatchAssignableUsers(datasetId: DatasetId): Promise<UserAccount[]> {
    const response = await this.http.get<unknown>(`/datasets/${encodeURIComponent(datasetId)}/qc/assignable-users`);
    return listPayload(response, 'users').map(normalizeUserAccount);
  }

  async getDatasetType(datasetType: DatasetTypeId): Promise<DatasetType> {
    return normalizeDatasetType(await this.http.get<unknown>(`/dataset-types/${encodeURIComponent(datasetType)}`));
  }

  async createImportJobArchive(datasetId: DatasetId, payload: ImportArchiveUploadPayload): Promise<ImportJobDetail> {
    const query = new URLSearchParams({
      dataset_type: payload.datasetType,
      batch_key: payload.batchKey,
      batch_name: payload.batchName,
      source_structure: payload.sourceStructure,
    });
    if (payload.description) query.set('description', payload.description);
    if (payload.archiveFileName) query.set('archive_file_name', payload.archiveFileName);
    const response = await this.http.postRawWithProgress<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/import-jobs/archive?${query}`,
      payload.archiveFile,
      {
        headers: { 'content-type': 'application/zip' },
        onUploadProgress: payload.onProgress || payload.onUploadProgress
          ? (progress) => {
              const nextProgress = {
                phase: 'uploading',
                loadedBytes: progress.loadedBytes,
                totalBytes: progress.totalBytes,
                percent: progress.percent,
              } as const;
              payload.onProgress?.(nextProgress);
              payload.onUploadProgress?.(nextProgress);
            }
          : undefined,
      },
    );
    payload.onProgress?.({ phase: 'processing', loadedBytes: 0, percent: 100 });
    payload.onUploadProgress?.({ phase: 'processing', loadedBytes: 0, percent: 100 });
    return normalizeImportJob(response, datasetId, '');
  }

  async getDatasetBatchImportJob(batchId: DatasetId, jobId: ImportJobId): Promise<ImportJobDetail> {
    return this.getImportJob(batchId, jobId);
  }

  async getImportJob(datasetId: DatasetId, jobId: ImportJobId): Promise<ImportJobDetail> {
    const response = await this.http.get<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/import-jobs/${encodeURIComponent(jobId)}`,
    );
    return normalizeImportJob(response, datasetId, jobId);
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

  async listQcQueue(datasetId: DatasetId): Promise<QcQueueItem[]> {
    const response = await this.http.get<unknown>(`/datasets/${encodeURIComponent(datasetId)}/qc`);
    return listPayload(response, 'queue').map((item) => normalizeQcQueueItem(item, datasetId));
  }

  async getQcWorkspace(datasetId: DatasetId): Promise<QcWorkspace> {
    const response = await this.http.get<unknown>(`/datasets/${encodeURIComponent(datasetId)}/qc`);
    return normalizeQcWorkspace(response, datasetId);
  }

  async generateQcQueue(datasetId: DatasetId): Promise<QcWorkspace> {
    const response = await this.http.post<unknown>(`/datasets/${encodeURIComponent(datasetId)}/qc/generate`);
    return normalizeQcWorkspace(response, datasetId);
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
    const response = await this.http.post<unknown>(`/datasets/${encodeURIComponent(datasetId)}/qc/assignment/release`);
    return normalizeBatchAssignment(response, datasetId);
  }

  async getReviewSample(datasetId: DatasetId, sampleId: SampleId): Promise<ReviewSampleDetail> {
    const response = await this.http.get<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/samples/${encodeURIComponent(sampleId)}/review`,
    );
    return normalizeReviewSample(response, datasetId, sampleId);
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

  async releaseSampleLease(datasetId: DatasetId, sampleId: SampleId, leaseId: string): Promise<SampleLease | undefined> {
    const response = await this.http.post<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/samples/${encodeURIComponent(sampleId)}/lease/${encodeURIComponent(leaseId)}/release`,
    );
    return normalizeSampleLease(response, datasetId, sampleId);
  }

  async getActiveLabelConfig(datasetId: DatasetId): Promise<LabelConfig> {
    const response = await this.http.get<unknown>(`/datasets/${encodeURIComponent(datasetId)}/label-config/active`);
    return normalizeLabelConfig(response, datasetId);
  }

  async getActiveDatasetTypeLabelConfig(datasetTypeId: DatasetTypeId): Promise<LabelConfig> {
    return this.getActiveLabelConfig(datasetTypeId);
  }

  async getLabelSuggestions(datasetId: DatasetId, field: string, query = ''): Promise<LabelSuggestion[]> {
    const params = new URLSearchParams({ field });
    if (query) params.set('query', query);
    const response = await this.http.get<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/label-suggestions?${params}`,
    );
    return listPayload(response, 'suggestions').map(normalizeLabelSuggestion);
  }

  async validateLabelEdit(
    datasetId: DatasetId,
    sampleId: SampleId,
    payload: LabelEditPatchPayload,
  ): Promise<LabelEditValidationResult> {
    const response = await this.http.post<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/samples/${encodeURIComponent(sampleId)}/label-edits/validate`,
      toBackendLabelEditPatch(payload),
    );
    return normalizeLabelEditValidation(response);
  }

  async getMyLabelEditDraft(datasetId: DatasetId, sampleId: SampleId): Promise<LabelEditDraft | undefined> {
    const response = await this.http.get<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/samples/${encodeURIComponent(sampleId)}/label-edits/draft`,
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
    const response = await this.http.post<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/samples/${encodeURIComponent(sampleId)}/label-edits`,
      toBackendLabelEditSubmit(payload),
    );
    const result = normalizeLabelEditSubmit(response, payload, sampleId);
    if (result.validation && !result.validation.valid) {
      throw new LabelEditValidationError(result.validation);
    }
    return result;
  }

  async getMyBatchLabelEditDraft(datasetId: DatasetId): Promise<BatchLabelEditDraft> {
    const response = await this.http.get<unknown>(`/datasets/${encodeURIComponent(datasetId)}/label-edits/batch/draft`);
    return normalizeBatchLabelEditDraft(response, datasetId);
  }

  async saveMyBatchLabelEditDraft(
    datasetId: DatasetId,
    payload: BatchLabelEditDraftPayload,
  ): Promise<BatchLabelEditDraftSaveResult> {
    const response = await this.http.post<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/label-edits/batch/draft`,
      toBackendBatchDraft(payload),
    );
    return normalizeBatchLabelEditDraftSave(response, datasetId, payload);
  }

  async autosaveMyBatchLabelEditDraft(
    datasetId: DatasetId,
    payload: BatchLabelEditDraftPayload,
  ): Promise<BatchLabelEditDraftSaveResult> {
    const response = await this.http.post<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/label-edits/batch/draft/autosave`,
      toBackendBatchDraft(payload),
    );
    return normalizeBatchLabelEditDraftSave(response, datasetId, payload);
  }

  async submitBatchLabelEdits(
    datasetId: DatasetId,
    payload: BatchLabelEditSubmitPayload,
  ): Promise<BatchLabelEditSubmitResult> {
    const response = await this.http.post<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/label-edits/batch/submit`,
      {
        unsaved_dirty_sample_ids: payload.unsavedDirtySampleIds,
        validation_error_sample_ids: payload.validationErrorSampleIds,
        notes: payload.notes ?? null,
      },
    );
    return normalizeBatchLabelEditSubmit(response, datasetId);
  }

  async confirmLabelEditSubmission(
    datasetId: DatasetId,
    sampleId: SampleId,
    submissionId: string,
  ): Promise<LabelEditSubmission> {
    const response = await this.http.post<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/samples/${encodeURIComponent(sampleId)}/label-edits/submissions/${encodeURIComponent(submissionId)}/confirm`,
    );
    return normalizeLabelEditSubmission(response, datasetId, sampleId);
  }

  async returnLabelEditSubmission(
    datasetId: DatasetId,
    sampleId: SampleId,
    submissionId: string,
    reason?: string,
  ): Promise<LabelEditSubmission> {
    const response = await this.http.post<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/samples/${encodeURIComponent(sampleId)}/label-edits/submissions/${encodeURIComponent(submissionId)}/return`,
      { reason },
    );
    return normalizeLabelEditSubmission(response, datasetId, sampleId);
  }

  private async runImportJobAction(datasetId: DatasetId, jobId: ImportJobId, action: string) {
    const response = await this.http.post<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/import-jobs/${encodeURIComponent(jobId)}/${action}`,
    );
    return normalizeImportJob(response, datasetId, jobId);
  }
}

export const createUrbanViolationApi = (): UrbanViolationApi => new HttpUrbanViolationApi();

export const apiClient = createUrbanViolationApi();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const stringValue = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);
const optionalString = (value: unknown) => (typeof value === 'string' && value ? value : undefined);
const numberValue = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const maybeNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
const booleanValue = (value: unknown, fallback = false) => (typeof value === 'boolean' ? value : fallback);
const arrayValue = <T = unknown>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const firstRecord = (...values: unknown[]) => values.find(isRecord) as Record<string, unknown> | undefined;

const listPayload = (payload: unknown, preferredKey: string): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  for (const key of [preferredKey, 'items', 'results', 'data']) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
};

const normalizeStringList = (value: unknown): string[] =>
  arrayValue<unknown>(value).flatMap((item) => (typeof item === 'string' ? [item] : []));

const normalizeRoleList = (value: unknown): UserRole[] =>
  arrayValue<unknown>(value).flatMap((item) => {
    const role = isRecord(item) ? stringValue(item.role) : stringValue(item);
    return role ? [role as UserRole] : [];
  });

const normalizeUserAccount = (value: unknown): UserAccount => {
  const record = isRecord(value) ? value : {};
  const userId = stringValue(record.userId ?? record.user_id ?? record.username, 'offline_reviewer');
  return {
    userId,
    username: optionalString(record.username) ?? userId,
    displayName: optionalString(record.displayName ?? record.display_name ?? record.name) ?? userId,
    email: optionalString(record.email),
    status: stringValue(record.status, 'active') as UserAccount['status'],
    authMode: optionalString(record.authMode ?? record.auth_mode),
    roles: normalizeRoleList(record.roles),
    permissions: normalizeStringList(record.permissions),
  };
};

const normalizeCurrentUser = (value: unknown): CurrentUser => {
  const wrapper = isRecord(value) ? value : {};
  const user = normalizeUserAccount(firstRecord(wrapper.user, wrapper.current_user, value) ?? value);
  return {
    ...user,
    roles: user.roles ?? [],
    permissions: normalizeStringList(wrapper.permissions).length ? normalizeStringList(wrapper.permissions) : user.permissions ?? [],
  };
};

const normalizeDataset = (value: unknown, fallbackId = 'unknown-dataset'): Dataset => {
  const record = isRecord(value) ? value : {};
  const id = stringValue(record.id ?? record.dataset_id ?? record.datasetId, fallbackId);
  return {
    id,
    name: stringValue(record.name ?? record.batch_name, id),
    datasetType: optionalString(record.datasetType ?? record.dataset_type),
    batchKey: optionalString(record.batchKey ?? record.batch_key),
    batchName: optionalString(record.batchName ?? record.batch_name),
    status: optionalString(record.status),
    lifecycleStatus: optionalString(record.lifecycleStatus ?? record.lifecycle_status),
    rootPath: optionalString(record.rootPath ?? record.root_path),
    sourceMode: optionalString(record.sourceMode ?? record.source_mode) as Dataset['sourceMode'],
    sourceUri: optionalString(record.sourceUri ?? record.source_uri),
    sourceStructure: optionalString(record.sourceStructure ?? record.source_structure) as Dataset['sourceStructure'],
    assetTotal: maybeNumber(record.assetTotal ?? record.total_assets),
    stage1Count: maybeNumber(record.stage1Count ?? record.stage1_count),
    stage1Total: maybeNumber(record.stage1Total ?? record.stage1_total ?? record.stage1_count),
    stage2SuccessCount: maybeNumber(record.stage2SuccessCount ?? record.stage2_success_count),
    stage2SuccessTotal: maybeNumber(record.stage2SuccessTotal ?? record.stage2_success_total ?? record.stage2_success_count),
    stage2FailureCount: maybeNumber(record.stage2FailureCount ?? record.stage2_failure_count),
    stage2FailureTotal: maybeNumber(record.stage2FailureTotal ?? record.stage2_failure_total ?? record.stage2_failure_count),
    qcQueueId: optionalString(record.qcQueueId ?? record.qc_queue_id),
    qcProgress: normalizeQcProgress(record.qcProgress ?? record.qc_progress),
    activeImportJobId: optionalString(record.activeImportJobId ?? record.active_import_job_id),
    latestImportJob: normalizeImportJobSummary(record.latestImportJob ?? record.latest_import_job, id),
    createdAt: optionalString(record.createdAt ?? record.created_at),
    updatedAt: optionalString(record.updatedAt ?? record.updated_at),
  };
};

const normalizeDatasetType = (value: unknown): DatasetType => {
  const record = isRecord(value) ? value : {};
  const datasetType = stringValue(record.datasetType ?? record.dataset_type, 'urban_violation');
  const batches = listPayload(record.batches, 'batches').map((item) => normalizeDataset(item, datasetType));
  return {
    datasetType,
    displayName: stringValue(record.displayName ?? record.display_name, datasetType),
    fieldSchemaVersion: optionalString(record.fieldSchemaVersion ?? record.field_schema_version),
    activeLabelConfigVersion: optionalString(record.activeLabelConfigVersion ?? record.active_label_config_version),
    status: optionalString(record.status),
    batchCount: numberValue(record.batchCount ?? record.batch_count, batches.length),
    batches,
  };
};

const normalizeQcProgress = (value: unknown): Dataset['qcProgress'] | undefined => {
  const record = isRecord(value) ? value : undefined;
  if (!record) return undefined;
  return {
    total: numberValue(record.total),
    pending: numberValue(record.pending),
    passed: numberValue(record.passed),
    rejected: numberValue(record.rejected),
    needsHumanReview: numberValue(record.needsHumanReview ?? record.needs_human_review),
    submitted: numberValue(record.submitted),
  };
};

const normalizeImportJobSummary = (value: unknown, datasetId: DatasetId): Dataset['latestImportJob'] => {
  if (!isRecord(value)) return undefined;
  const id = stringValue(value.id ?? value.job_id);
  if (!id) return undefined;
  return {
    id,
    datasetId: stringValue(value.datasetId ?? value.dataset_id, datasetId),
    title: stringValue(value.title ?? value.name, id),
    state: stringValue(value.state, 'Created') as ImportJobState,
    batchKey: optionalString(value.batchKey ?? value.batch_key),
    batchName: optionalString(value.batchName ?? value.batch_name),
    createdAt: optionalString(value.createdAt ?? value.created_at),
    updatedAt: optionalString(value.updatedAt ?? value.updated_at),
    processingProgress: normalizeImportProgress(value.processingProgress ?? value.processing_progress),
  };
};

const normalizeWarnings = (value: unknown): ImportWarning[] =>
  arrayValue<unknown>(value).map((item, index) => {
    const record = isRecord(item) ? item : {};
    return {
      id: stringValue(record.id, `warning-${index + 1}`),
      severity: stringValue(record.severity, 'warning'),
      title: stringValue(record.title ?? record.code ?? record.type, 'Backend warning'),
      message: stringValue(record.message ?? record.detail ?? record.reason, typeof item === 'string' ? item : ''),
      details: normalizeStringList(record.details),
      createdAt: optionalString(record.createdAt ?? record.created_at),
    };
  });

const normalizeImportProgress = (payload: unknown): ImportProcessingProgress | undefined => {
  const record = firstRecord(payload);
  if (!record) return undefined;
  const progress = firstRecord(record.progress, record.processing_progress) ?? record;
  if (!progress.state && !progress.phase && !progress.message) return undefined;
  return {
    state: stringValue(progress.state),
    status: optionalString(progress.status),
    phase: optionalString(progress.phase),
    message: optionalString(progress.message),
    processedBytes: maybeNumber(progress.processed_bytes ?? progress.processedBytes),
    totalBytes: maybeNumber(progress.total_bytes ?? progress.totalBytes),
    processedItems: maybeNumber(progress.processed_items ?? progress.processedItems),
    totalItems: maybeNumber(progress.total_items ?? progress.totalItems),
    percent: maybeNumber(progress.percent),
    startedAt: optionalString(progress.started_at ?? progress.startedAt),
    updatedAt: optionalString(progress.updated_at ?? progress.updatedAt),
    expiresAt: optionalString(progress.expires_at ?? progress.expiresAt),
    expired: booleanValue(progress.expired),
  };
};

const normalizeImportJob = (payload: unknown, datasetId: DatasetId, jobId: ImportJobId): ImportJobDetail => {
  const wrapper = isRecord(payload) ? payload : {};
  const record = firstRecord(wrapper.job, wrapper.import_job, payload) ?? {};
  const totals = firstRecord(record.totals) ?? {};
  const fallbackExpected = numberValue(record.expected_assets ?? record.expectedAssets ?? record.total_assets);
  const rawAssets = numberValue(totals.rawAssets ?? totals.raw_assets ?? record.expected_assets ?? record.expectedAssets, fallbackExpected);
  const stage1Parsed = numberValue(totals.stage1Parsed ?? totals.stage1_parsed ?? record.imported_assets ?? record.importedAssets, rawAssets);
  const stage2Parsed = numberValue(totals.stage2Parsed ?? totals.stage2_parsed ?? record.stage2_success_count ?? record.stage2SuccessCount);
  const stage2Failures = numberValue(totals.stage2Failures ?? totals.stage2_failures ?? record.stage2_failure_count ?? record.stage2FailureCount);
  const validationReport = normalizeValidationReport(record.validationReport ?? record.validation_report, datasetId, jobId);
  return {
    id: stringValue(record.id ?? record.job_id, jobId),
    datasetId: stringValue(record.datasetId ?? record.dataset_id, datasetId),
    title: stringValue(record.title ?? record.name, jobId),
    state: stringValue(record.state, 'Created') as ImportJobState,
    activeStep: numberValue(record.activeStep ?? record.active_step),
    batchKey: optionalString(record.batchKey ?? record.batch_key),
    batchName: optionalString(record.batchName ?? record.batch_name),
    sourceMode: optionalString(record.sourceMode ?? record.source_mode) as ImportJobDetail['sourceMode'],
    sourceUri: optionalString(record.sourceUri ?? record.source_uri),
    sourceStructure: optionalString(record.sourceStructure ?? record.source_structure) as ImportJobDetail['sourceStructure'],
    description: optionalString(record.description),
    totals: { rawAssets, stage1Parsed, stage2Parsed, stage2Failures },
    coverage: {
      stage1: rawAssets ? stage1Parsed / rawAssets : 0,
      stage2: rawAssets ? stage2Parsed / rawAssets : 0,
    },
    warnings: normalizeWarnings(record.warnings),
    mappingSteps: listPayload(record.mappingSteps ?? record.mapping_steps, 'mapping_steps').map((item, index) => {
      const step = isRecord(item) ? item : {};
      return {
        id: stringValue(step.id, `step-${index + 1}`),
        label: stringValue(step.label, `Step ${index + 1}`),
        count: numberValue(step.count),
        entity: stringValue(step.entity, 'RawAsset'),
      };
    }),
    validationRows: normalizeValidationRows(record.validationRows ?? record.validation_rows ?? validationReport?.rows),
    validationReport,
    progress: normalizeImportProgress(record.progress ?? record.processing_progress),
    processingProgress: normalizeImportProgress(record.processingProgress ?? record.processing_progress ?? record.progress),
    createdAt: optionalString(record.createdAt ?? record.created_at),
    updatedAt: optionalString(record.updatedAt ?? record.updated_at),
  };
};

const normalizeValidationRows = (value: unknown): ImportJobDetail['validationRows'] =>
  arrayValue<unknown>(value).map((item) => {
    const record = isRecord(item) ? item : {};
    return {
      sampleId: stringValue(record.sampleId ?? record.sample_id),
      imagePath: optionalString(record.imagePath ?? record.image_path),
      stage1Path: optionalString(record.stage1Path ?? record.stage1_path),
      stage2Path: optionalString(record.stage2Path ?? record.stage2_path),
      failurePath: optionalString(record.failurePath ?? record.failure_path),
      status: stringValue(record.status, 'ready') as ImportJobDetail['validationRows'][number]['status'],
      issues: normalizeStringList(record.issues),
    };
  });

const normalizeValidationReport = (
  value: unknown,
  datasetId: DatasetId,
  jobId: ImportJobId,
): ImportValidationReport | undefined => {
  const record = isRecord(value) ? value : undefined;
  if (!record) return undefined;
  const totalsRecord = firstRecord(record.totals) ?? {};
  const rawAssets = numberValue(totalsRecord.rawAssets ?? totalsRecord.raw_assets ?? record.expected_assets ?? record.expectedAssets);
  const stage1Parsed = numberValue(totalsRecord.stage1Parsed ?? totalsRecord.stage1_parsed ?? record.imported_assets ?? record.importedAssets, rawAssets);
  const stage2Parsed = numberValue(totalsRecord.stage2Parsed ?? totalsRecord.stage2_parsed ?? record.stage2_success_count ?? record.stage2SuccessCount);
  const stage2Failures = numberValue(totalsRecord.stage2Failures ?? totalsRecord.stage2_failures ?? record.stage2_failure_count ?? record.stage2FailureCount);
  return {
    datasetId: stringValue(record.datasetId ?? record.dataset_id, datasetId),
    jobId: stringValue(record.jobId ?? record.job_id, jobId),
    valid: booleanValue(record.valid),
    totals: { rawAssets, stage1Parsed, stage2Parsed, stage2Failures },
    coverage: {
      stage1: rawAssets ? stage1Parsed / rawAssets : 0,
      stage2: rawAssets ? stage2Parsed / rawAssets : 0,
    },
    blockingErrors: normalizeWarnings(record.blockingErrors ?? record.blocking_errors),
    warnings: normalizeWarnings(record.warnings),
    rows: normalizeValidationRows(record.rows),
  };
};

const normalizeLabelConfig = (value: unknown, datasetId: DatasetId): LabelConfig => {
  const record = isRecord(value) ? value : {};
  const config = firstRecord(record.normalized_config, record.normalizedConfig, record.config, record.raw_config, value) ?? {};
  return {
    configId: optionalString(record.config_id ?? record.configId ?? config.config_id ?? config.configId),
    datasetId: stringValue(record.dataset_id ?? record.datasetId ?? config.dataset_id ?? config.datasetId, datasetId),
    schemaVersion: optionalString(record.schema_version ?? record.schemaVersion ?? config.schema_version ?? config.schemaVersion),
    datasetType: optionalString(record.dataset_type ?? record.datasetType ?? config.dataset_type ?? config.datasetType),
    version: stringValue(record.version ?? config.version, 'unversioned-label-config'),
    status: optionalString(record.status ?? config.status),
    contentHash: optionalString(record.content_hash ?? record.contentHash ?? config.content_hash ?? config.contentHash),
    createdAt: optionalString(record.created_at ?? record.createdAt ?? config.created_at ?? config.createdAt),
    activatedAt: optionalString(record.activated_at ?? record.activatedAt ?? config.activated_at ?? config.activatedAt),
    fields: arrayValue<unknown>(config.fields).map(normalizeLabelConfigField),
    rawConfig: Object.keys(config).length ? config : value,
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
    options: arrayValue<unknown>(record.options).map(normalizeLabelConfigOption),
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

const normalizeLabelSuggestion = (value: unknown): LabelSuggestion => {
  const record = isRecord(value) ? value : {};
  const raw = typeof value === 'string' ? value : '';
  return {
    value: stringValue(record.value ?? record.code, raw),
    label: optionalString(record.label ?? record.label_zh ?? record.labelZh),
    source: optionalString(record.source),
  };
};

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
  arrayValue<unknown>(value).map(normalizeLabelEditIssue);

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

const normalizeLabelEditOperation = (value: unknown): LabelEditOperation | undefined => {
  const record = isRecord(value) ? value : undefined;
  if (!record) return undefined;
  const scope = stringValue(record.scope);
  const field = stringValue(record.field);
  const op = stringValue(record.op) as LabelEditOperation['op'];
  if (!scope || !field || !op) return undefined;
  const tag = firstRecord(record.tagPayload, record.tag_payload);
  return {
    scope,
    field,
    op,
    before: record.before,
    after: record.after,
    tagPayload: tag
      ? {
          rawText: stringValue(tag.raw_text ?? tag.rawText),
          normalizedText: stringValue(tag.normalized_text ?? tag.normalizedText),
          canonicalCode: optionalString(tag.canonical_code ?? tag.canonicalCode) ?? null,
          source: 'human',
          status: stringValue(tag.status, 'custom') as 'custom' | 'configured',
        }
      : undefined,
  };
};

const normalizeLabelEditOperations = (value: unknown): LabelEditOperation[] =>
  arrayValue<unknown>(value).flatMap((item) => {
    const operation = normalizeLabelEditOperation(item);
    return operation ? [operation] : [];
  });

const toBackendLabelEditPatch = (payload: LabelEditPatchPayload) => ({
  label_config_id: payload.labelConfigId ?? null,
  label_config_version: payload.labelConfigVersion ?? null,
  lease_id: payload.leaseId ?? null,
  base_revision: payload.baseRevision ?? null,
  operations: payload.operations.map(toBackendLabelEditOperation),
});

const toBackendLabelEditSubmit = (payload: LabelEditSubmitPayload) => ({
  ...toBackendLabelEditPatch(payload),
  submit_action: payload.submitAction,
  task_status: payload.taskStatus,
});

const toBackendLabelEditOperation = (operation: LabelEditOperation) => ({
  scope: operation.scope,
  field: operation.field,
  op: operation.op,
  before: operation.before,
  after: operation.after,
  tag_payload: operation.tagPayload
    ? {
        raw_text: operation.tagPayload.rawText,
        normalized_text: operation.tagPayload.normalizedText,
        canonical_code: operation.tagPayload.canonicalCode,
        source: operation.tagPayload.source,
        status: operation.tagPayload.status,
      }
    : undefined,
});

const toBackendBatchDraft = (payload: BatchLabelEditDraftPayload) => ({
  entries: payload.entries.map((entry) => ({
    sample_id: entry.sampleId,
    label_config_id: entry.labelConfigId ?? null,
    label_config_version: entry.labelConfigVersion ?? null,
    lease_id: entry.leaseId ?? null,
    base_revision: entry.baseRevision ?? null,
    operations: entry.operations.map(toBackendLabelEditOperation),
    dirty: entry.dirty,
    saved: entry.saved,
    validation: entry.validation,
  })),
});

const normalizeLabelEditState = (value: unknown): LabelEditState | undefined => {
  const record = isRecord(value) ? value : undefined;
  if (!record) return undefined;
  const editId = stringValue(record.edit_id ?? record.editId);
  const sampleId = stringValue(record.sample_id ?? record.sampleId);
  if (!editId || !sampleId) return undefined;
  return {
    editId,
    datasetId: stringValue(record.dataset_id ?? record.datasetId),
    sampleId,
    userId: optionalString(record.user_id ?? record.userId),
    taskMode: stringValue(record.task_mode ?? record.taskMode, 'label_edit'),
    submitAction: stringValue(record.submit_action ?? record.submitAction, 'save_draft') as LabelEditState['submitAction'],
    taskStatus: stringValue(record.task_status ?? record.taskStatus, 'annotation_draft') as LabelEditState['taskStatus'],
    labelConfigId: optionalString(record.label_config_id ?? record.labelConfigId),
    labelConfigVersion: optionalString(record.label_config_version ?? record.labelConfigVersion),
    leaseId: optionalString(record.lease_id ?? record.leaseId),
    taskRevision: maybeNumber(record.task_revision ?? record.taskRevision),
    operations: normalizeLabelEditOperations(record.operations),
    updatedAt: optionalString(record.updated_at ?? record.updatedAt),
  };
};

const normalizeLabelEditDraft = (value: unknown, datasetId: DatasetId, sampleId: SampleId): LabelEditDraft | undefined => {
  const record = firstRecord(isRecord(value) ? value.draft : undefined, isRecord(value) ? value.my_draft : undefined, value);
  if (!record) return undefined;
  const draftId = stringValue(record.draftId ?? record.draft_id ?? record.edit_id ?? record.editId);
  if (!draftId) return undefined;
  return {
    draftId,
    datasetId: stringValue(record.datasetId ?? record.dataset_id, datasetId),
    sampleId: stringValue(record.sampleId ?? record.sample_id, sampleId),
    userId: optionalString(record.userId ?? record.user_id),
    operations: normalizeLabelEditOperations(record.operations),
    labelConfigId: optionalString(record.labelConfigId ?? record.label_config_id),
    labelConfigVersion: optionalString(record.labelConfigVersion ?? record.label_config_version),
    leaseId: optionalString(record.leaseId ?? record.lease_id),
    taskRevision: maybeNumber(record.taskRevision ?? record.task_revision),
    updatedAt: optionalString(record.updatedAt ?? record.updated_at),
  };
};

const normalizeLabelEditSubmission = (value: unknown, datasetId: DatasetId, sampleId: SampleId): LabelEditSubmission => {
  const wrapper = isRecord(value) ? value : {};
  const record = firstRecord(wrapper.submission, wrapper.item, value) ?? {};
  const validation = firstRecord(record.validation, record.field_validation);
  return {
    submissionId: stringValue(record.submissionId ?? record.submission_id ?? record.edit_id, `submission-${sampleId}`),
    datasetId: stringValue(record.datasetId ?? record.dataset_id, datasetId),
    sampleId: stringValue(record.sampleId ?? record.sample_id, sampleId),
    userId: optionalString(record.userId ?? record.user_id),
    userDisplayName: optionalString(record.userDisplayName ?? record.user_display_name),
    status: stringValue(record.status ?? record.task_status, 'submitted'),
    operations: normalizeLabelEditOperations(record.operations),
    validation: validation ? normalizeLabelEditValidation(validation) : undefined,
    labelConfigId: optionalString(record.labelConfigId ?? record.label_config_id),
    labelConfigVersion: optionalString(record.labelConfigVersion ?? record.label_config_version),
    taskRevision: maybeNumber(record.taskRevision ?? record.task_revision),
    submittedAt: optionalString(record.submittedAt ?? record.submitted_at ?? record.updated_at),
    confirmedBy: optionalString(record.confirmedBy ?? record.confirmed_by),
    confirmedAt: optionalString(record.confirmedAt ?? record.confirmed_at),
    returnedAt: optionalString(record.returnedAt ?? record.returned_at),
  };
};

const normalizeLabelEditSubmit = (
  value: unknown,
  payload: LabelEditSubmitPayload,
  sampleId: SampleId,
): LabelEditSubmitResult => {
  const record = isRecord(value) ? value : {};
  const state = normalizeLabelEditState(record.state);
  const validation = firstRecord(record.validation, record.field_validation);
  return {
    saved: booleanValue(record.saved, true),
    sampleId: state?.sampleId ?? stringValue(record.sample_id ?? record.sampleId, sampleId),
    submitAction: state?.submitAction ?? payload.submitAction,
    taskStatus: state?.taskStatus ?? payload.taskStatus,
    editId: state?.editId ?? optionalString(record.patch_id ?? record.patchId),
    operationCount: state?.operations.length ?? numberValue(record.operation_count ?? record.operationCount, payload.operations.length),
    updatedAt: state?.updatedAt ?? optionalString(record.updated_at ?? record.updatedAt),
    state,
    validation: validation ? normalizeLabelEditValidation(validation) : undefined,
  };
};

const normalizeBatchDraftSample = (value: unknown): BatchLabelEditDraftSample | undefined => {
  const record = isRecord(value) ? value : undefined;
  if (!record) return undefined;
  const sampleId = stringValue(record.sample_id ?? record.sampleId);
  if (!sampleId) return undefined;
  const validation = firstRecord(record.validation, record.field_validation);
  return {
    sampleId,
    labelConfigId: nullableString(record.label_config_id ?? record.labelConfigId),
    labelConfigVersion: nullableString(record.label_config_version ?? record.labelConfigVersion),
    leaseId: nullableString(record.lease_id ?? record.leaseId),
    baseRevision: nullableRevision(record.base_revision ?? record.baseRevision),
    operations: normalizeLabelEditOperations(record.operations),
    dirty: booleanValue(record.dirty),
    saved: booleanValue(record.saved),
    validation: validation ? normalizeBatchDraftValidation(validation) : undefined,
  };
};

const nullableString = (value: unknown): string | null | undefined => value === null ? null : optionalString(value);
const nullableRevision = (value: unknown): number | string | null | undefined =>
  value === null ? null : typeof value === 'number' || typeof value === 'string' ? value : undefined;

const normalizeBatchDraftValidation = (value: unknown): BatchLabelEditDraftValidation => {
  const record = isRecord(value) ? value : {};
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

const normalizeBatchLabelEditDraft = (value: unknown, datasetId: DatasetId): BatchLabelEditDraft => {
  const wrapper = isRecord(value) ? value : {};
  const record = firstRecord(wrapper.draft, wrapper.batch_draft, value) ?? {};
  const rawSamples = Array.isArray(record.entries)
    ? record.entries
    : Array.isArray(record.samples)
      ? record.samples
      : Array.isArray(record.sample_drafts)
        ? record.sample_drafts
        : [];
  const samples = rawSamples.flatMap((item) => {
    const sample = normalizeBatchDraftSample(item);
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
  const draft = firstRecord(record.draft, record.batch_draft, value)
    ? normalizeBatchLabelEditDraft(firstRecord(record.draft, record.batch_draft, value), datasetId)
    : undefined;
  const sampleIds = normalizeStringList(record.sample_ids ?? record.sampleIds);
  return {
    saved: booleanValue(record.saved, true),
    datasetId: stringValue(record.dataset_id ?? record.datasetId, datasetId),
    savedSampleCount: numberValue(record.saved_count ?? record.savedCount, sampleIds.length || payload.entries.length),
    totalSampleCount: maybeNumber(record.sample_count ?? record.sampleCount ?? record.total_sample_count ?? record.totalSampleCount),
    sampleIds: sampleIds.length ? sampleIds : payload.entries.map((entry) => entry.sampleId),
    updatedAt: optionalString(record.updated_at ?? record.updatedAt),
    draft,
  };
};

const normalizeBatchLabelEditSubmit = (value: unknown, datasetId: DatasetId): BatchLabelEditSubmitResult => {
  const record = isRecord(value) ? value : {};
  return {
    submitted: booleanValue(record.submitted, true),
    datasetId: stringValue(record.dataset_id ?? record.datasetId, datasetId),
    assignmentId: optionalString(record.assignment_id ?? record.assignmentId),
    assigneeUserId: optionalString(record.assignee_user_id ?? record.assigneeUserId),
    status: optionalString(record.status ?? record.batch_status ?? record.assignment_status),
    submittedAt: optionalString(record.submitted_at ?? record.submittedAt),
    submittedSampleCount: maybeNumber(record.submitted_sample_count ?? record.submittedSampleCount),
    releasedLeaseCount: maybeNumber(record.released_lease_count ?? record.releasedLeaseCount),
    assignment: normalizeBatchAssignment(record.assignment ?? record.batch_assignment, datasetId),
  };
};

const normalizeBatchAssignment = (value: unknown, datasetId: DatasetId): BatchQcAssignment | undefined => {
  const record = firstRecord(isRecord(value) ? value.assignment : undefined, isRecord(value) ? value.batch_assignment : undefined, value);
  if (!record) return undefined;
  const assigneeUserId = stringValue(record.assigneeUserId ?? record.assignee_user_id);
  const assignmentId = stringValue(record.assignmentId ?? record.assignment_id);
  if (!assigneeUserId && !assignmentId) return undefined;
  return {
    assignmentId: assignmentId || `assignment-${datasetId}`,
    qcQueueId: optionalString(record.qcQueueId ?? record.qc_queue_id),
    datasetId: stringValue(record.datasetId ?? record.dataset_id, datasetId),
    assigneeUserId,
    assigneeDisplayName: optionalString(record.assigneeDisplayName ?? record.assignee_display_name),
    assignedBy: optionalString(record.assignedBy ?? record.assigned_by),
    assignedByDisplayName: optionalString(record.assignedByDisplayName ?? record.assigned_by_display_name),
    status: stringValue(record.status, 'assigned') as BatchQcAssignment['status'],
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

const normalizeSampleLease = (value: unknown, datasetId: DatasetId, sampleId: SampleId): SampleLease | undefined => {
  const record = firstRecord(isRecord(value) ? value.sample_lease : undefined, isRecord(value) ? value.lease : undefined, value);
  if (!record) return undefined;
  const leaseId = stringValue(record.leaseId ?? record.lease_id);
  if (!leaseId) return undefined;
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

const normalizeQcWorkspace = (value: unknown, datasetId: DatasetId): QcWorkspace => {
  const record = isRecord(value) ? value : {};
  const queue = listPayload(record.queue ?? record.items, 'queue').map((item) => normalizeQcQueueItem(item, datasetId));
  const tasks = listPayload(record.tasks, 'tasks').map((item) => normalizeQcTask(item, datasetId));
  return {
    datasetId: stringValue(record.dataset_id ?? record.datasetId, datasetId),
    assignment: normalizeBatchAssignment(record.assignment ?? record.batch_assignment, datasetId),
    queue,
    tasks,
    leases: listPayload(record.leases, 'leases').flatMap((item) => {
      const lease = normalizeSampleLease(item, datasetId, stringValue(isRecord(item) ? item.sample_id ?? item.sampleId : ''));
      return lease ? [lease] : [];
    }),
  };
};

const normalizeBBox = (value: unknown): BBox | undefined => {
  if (!Array.isArray(value) || value.length < 4) return undefined;
  const next = value.slice(0, 4).map((item) => numberValue(item));
  return [next[0], next[1], next[2], next[3]];
};

const normalizeStageRelation = (value: unknown, index: number): StageRelation => {
  const record = isRecord(value) ? value : {};
  return {
    id: stringValue(record.id ?? record.relation_id, `relation-${index + 1}`),
    subject: stringValue(record.subject),
    relation: stringValue(record.relation ?? record.predicate),
    predicate: stringValue(record.predicate ?? record.relation),
    object: stringValue(record.object),
    description: optionalString(record.description),
    bbox: normalizeBBox(record.bbox) ?? [0, 0, 0, 0],
    confidence: maybeNumber(record.confidence),
    visibility: optionalString(record.visibility),
    source: optionalString(record.source),
    relationIndex: stringValue(record.relationIndex ?? record.relation_index, `R${index + 1}`),
    ...record,
  };
};

const normalizeStage1 = (value: unknown, sampleId: SampleId): PreAnnotationStep1 | undefined => {
  const record = isRecord(value) ? value : undefined;
  if (!record) return undefined;
  return {
    sampleId: stringValue(record.sampleId ?? record.sample_id, sampleId),
    environmentAnalysis: optionalString(record.environmentAnalysis ?? record.environment_analysis),
    sceneElements: normalizeStringList(record.sceneElements ?? record.scene_elements),
    relations: arrayValue<unknown>(record.relations).map(normalizeStageRelation),
    keyRelations: arrayValue<unknown>(record.keyRelations ?? record.key_relations ?? record.relations).map(normalizeStageRelation),
    keyAnchors: arrayValue<unknown>(record.keyAnchors ?? record.key_anchors).map((item, index) => {
      const anchor = isRecord(item) ? item : {};
      const label = stringValue(anchor.anchor ?? anchor.label, `anchor-${index + 1}`);
      return {
        id: stringValue(anchor.id, label),
        anchor: label,
        label: optionalString(anchor.label),
        bbox: normalizeBBox(anchor.bbox),
      };
    }),
    raw: value,
  };
};

const normalizeStage2Candidate = (value: unknown, index: number): Stage2Candidate => {
  const record = isRecord(value) ? value : {};
  return {
    id: stringValue(record.id ?? record.candidate_id, `candidate-${index + 1}`),
    category: stringValue(record.category ?? record.violation_category),
    violationCategory: stringValue(record.violationCategory ?? record.violation_category ?? record.category),
    sampleCategory: stringValue(record.sampleCategory ?? record.sample_category),
    bbox: normalizeBBox(record.bbox) ?? [0, 0, 0, 0],
    confidence: numberValue(record.confidence),
    reasoning: optionalString(record.reasoning),
    relationIds: normalizeStringList(record.relationIds ?? record.relation_ids),
    evidenceRelationIndices: normalizeStringList(record.evidenceRelationIndices ?? record.evidence_relation_indices ?? record.evidence_relations),
    evidenceReasoning: stringValue(record.evidenceReasoning ?? record.evidence_reasoning ?? record.reasoning),
    segmentationTargets: normalizeStringList(record.segmentationTargets ?? record.segmentation_targets),
    relationHint: optionalString(record.relationHint ?? record.relation_hint),
    deleted: booleanValue(record.deleted),
    ...record,
  };
};

const normalizeStage2 = (value: unknown, sampleId: SampleId): PreAnnotationStep2 | undefined => {
  const record = isRecord(value) ? value : undefined;
  if (!record) return undefined;
  return {
    sampleId: stringValue(record.sampleId ?? record.sample_id, sampleId),
    judgeDecision: stringValue(record.judgeDecision ?? record.judge_decision, 'pass') as PreAnnotationStep2['judgeDecision'],
    candidates: arrayValue<unknown>(record.candidates).map(normalizeStage2Candidate),
    relations: arrayValue<unknown>(record.relations).map(normalizeStageRelation),
    factVerifications: arrayValue<unknown>(record.factVerifications ?? record.fact_verifications).map((item, index) => {
      const verification = isRecord(item) ? item : {};
      return {
        relationIndex: stringValue(verification.relationIndex ?? verification.relation_index, `R${index + 1}`),
        result: stringValue(verification.result ?? verification.verification_result, 'unclear'),
        keyAttributesVisible: normalizeStringList(verification.keyAttributesVisible ?? verification.key_attributes_visible),
        bbox: normalizeBBox(verification.bbox) ?? [0, 0, 0, 0],
        ...verification,
      };
    }) as any[],
    raw: value,
  };
};

const normalizeStage2Failure = (value: unknown, sampleId: SampleId): Stage2Failure | undefined => {
  const record = isRecord(value) ? value : undefined;
  if (!record) return undefined;
  return {
    sampleId: stringValue(record.sampleId ?? record.sample_id, sampleId),
    reason: stringValue(record.reason ?? record.error ?? record.message),
    message: optionalString(record.message),
    raw: value,
  };
};

const normalizeReviewSample = (payload: unknown, datasetId: DatasetId, sampleId: SampleId): ReviewSampleDetail => {
  const record = isRecord(payload) ? payload : {};
  const asset = firstRecord(record.asset, record.raw_asset, record.rawAsset, payload) ?? {};
  const resolvedSampleId = stringValue(asset.sampleId ?? asset.sample_id ?? record.sample_id, sampleId);
  const imageUrl = optionalString(asset.imageUrl ?? asset.image_url ?? asset.browser_url ?? asset.media_url);
  return {
    asset: {
      assetId: stringValue(asset.assetId ?? asset.asset_id, resolvedSampleId),
      sampleId: resolvedSampleId,
      datasetId: stringValue(asset.datasetId ?? asset.dataset_id, datasetId),
      imageUrl: imageUrl ? toBrowserMediaUrl(imageUrl) : undefined,
      width: maybeNumber(asset.width),
      height: maybeNumber(asset.height),
      judgeDecision: stringValue(asset.judgeDecision ?? asset.judge_decision, 'unknown'),
      stage2Status: stringValue(asset.stage2Status ?? asset.stage2_status, 'unknown'),
    },
    stage1: normalizeStage1(record.stage1 ?? record.stage1_preannotation ?? record.stage1Preannotation, resolvedSampleId) ?? {
      sampleId: resolvedSampleId,
      sceneElements: [],
      relations: [],
      keyRelations: [],
      keyAnchors: [],
    },
    stage2: normalizeStage2(record.stage2 ?? record.stage2_preannotation ?? record.stage2Preannotation, resolvedSampleId),
    stage2Failure: normalizeStage2Failure(
      record.stage2Failure ?? record.stage2_failure ?? record.stage2PreannotationFailure,
      resolvedSampleId,
    ),
    humanReview: firstRecord(record.humanReview, record.human_review),
    auditArtifacts: arrayValue(record.auditArtifacts ?? record.audit_artifacts),
    sampleLease: normalizeSampleLease(record.sampleLease ?? record.sample_lease, datasetId, resolvedSampleId),
    myDraft: normalizeLabelEditDraft(record.myDraft ?? record.my_draft, datasetId, resolvedSampleId),
    submissions: listPayload(record.submissions, 'submissions').map((item) => normalizeLabelEditSubmission(item, datasetId, resolvedSampleId)),
    latestSubmission: firstRecord(record.latestSubmission, record.latest_submission)
      ? normalizeLabelEditSubmission(record.latestSubmission ?? record.latest_submission, datasetId, resolvedSampleId)
      : undefined,
    qcTask: firstRecord(record.task, record.qc_task) ? normalizeQcTask(record.task ?? record.qc_task, datasetId) : undefined,
    currentUser: firstRecord(record.currentUser, record.current_user)
      ? normalizeCurrentUser(record.currentUser ?? record.current_user)
      : undefined,
    batchAssignment: normalizeBatchAssignment(record.batchAssignment ?? record.batch_assignment, datasetId),
  };
};

const normalizeQcQueueItem = (value: unknown, datasetId: DatasetId): QcQueueItem => {
  const record = isRecord(value) ? value : {};
  const task = firstRecord(record.task, record.qc_task);
  const latestSubmission = firstRecord(record.latestSubmission, record.latest_submission);
  return {
    sampleId: stringValue(record.sampleId ?? record.sample_id),
    assetId: stringValue(record.assetId ?? record.asset_id ?? record.sample_id),
    datasetId: stringValue(record.datasetId ?? record.dataset_id, datasetId),
    status: stringValue(record.status ?? record.qc_status, 'qc_pending') as QcQueueItem['status'],
    judgeDecision: stringValue(record.judgeDecision ?? record.judge_decision, 'pass') as QcQueueItem['judgeDecision'],
    violationCategory: optionalString(record.violationCategory ?? record.violation_category),
    sampleCategory: optionalString(record.sampleCategory ?? record.sample_category),
    primaryCategory: optionalString(record.primaryCategory ?? record.primary_category),
    leaseStatus: optionalString(record.leaseStatus ?? record.lease_status) as any,
    labelConfigVersion: optionalString(record.labelConfigVersion ?? record.label_config_version),
    taskStatus: optionalString(record.taskStatus ?? record.task_status) as QcTaskStatus,
    task: task ? normalizeQcTask(task, datasetId) : undefined,
    taskRevision: maybeNumber(record.taskRevision ?? record.task_revision),
    assigneeUserId: optionalString(record.assigneeUserId ?? record.assignee_user_id),
    assigneeDisplayName: optionalString(record.assigneeDisplayName ?? record.assignee_display_name),
    latestSubmission: latestSubmission
      ? normalizeLabelEditSubmission(latestSubmission, datasetId, stringValue(record.sampleId ?? record.sample_id))
      : undefined,
    latestSubmissionId: optionalString(record.latestSubmissionId ?? record.latest_submission_id),
    submittedAt: optionalString(record.submittedAt ?? record.submitted_at),
    confirmedAt: optionalString(record.confirmedAt ?? record.confirmed_at),
    updatedAt: optionalString(record.updatedAt ?? record.updated_at),
  };
};

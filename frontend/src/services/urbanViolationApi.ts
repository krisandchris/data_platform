import { ApiClientError, HttpClient } from './http';
import { fixtureApiClient } from './fixtures';
import { apiMode } from './config';
import { toBrowserMediaUrl } from './media';
import type {
  AssetListFilters,
  AssetListItem,
  AuditArtifact,
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
  Dataset,
  DatasetId,
  DatasetSummary,
  FactVerification,
  HumanReview,
  ImportJobDetail,
  ImportJobId,
  ImportJobState,
  ImportWarning,
  JudgeDecision,
  LabelConfig,
  LabelConfigField,
  LabelConfigIssue,
  LabelConfigOption,
  LabelConfigSaveResult,
  LabelConfigSummary,
  LabelConfigValidationResult,
  LabelEditOperation,
  LabelEditPatchPayload,
  LabelEditState,
  LabelEditSubmitPayload,
  LabelEditSubmitResult,
  LabelEditValidationIssue,
  LabelEditValidationResult,
  LabelSuggestion,
  PreannotationSummary,
  PreAnnotationStep1,
  PreAnnotationStep2,
  QcStatus,
  QcQueueItem,
  ReviewDecision,
  ReviewSampleDetail,
  SampleId,
  Stage2Candidate,
  Stage2Failure,
  StageRelation,
  StageStatus,
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
  listDatasets(): Promise<Dataset[]>;
  getDatasetSummary(datasetId: DatasetId): Promise<DatasetSummary>;
  listAssets(datasetId: DatasetId, filters?: AssetListFilters): Promise<AssetListItem[]>;
  getImportJob(datasetId: DatasetId, jobId: ImportJobId): Promise<ImportJobDetail>;
  getPreannotationSummary(datasetId: DatasetId): Promise<PreannotationSummary>;
  listQcQueue(datasetId: DatasetId): Promise<QcQueueItem[]>;
  getReviewSample(datasetId: DatasetId, sampleId: SampleId): Promise<ReviewSampleDetail>;
  submitReviewDecision(
    datasetId: DatasetId,
    sampleId: SampleId,
    payload: SubmitReviewPayload,
  ): Promise<HumanReview>;
  validateLabelConfig(
    datasetId: DatasetId,
    payload: Omit<LabelConfigUploadPayload, 'activate'>,
  ): Promise<LabelConfigValidationResult>;
  saveLabelConfig(datasetId: DatasetId, payload: LabelConfigUploadPayload): Promise<LabelConfigSaveResult>;
  activateLabelConfig(datasetId: DatasetId, configId: string): Promise<LabelConfigSaveResult>;
  getActiveLabelConfig(datasetId: DatasetId): Promise<LabelConfig>;
  getLabelSuggestions(datasetId: DatasetId, field: string, query?: string): Promise<LabelSuggestion[]>;
  validateLabelEdit(
    datasetId: DatasetId,
    sampleId: SampleId,
    payload: LabelEditPatchPayload,
  ): Promise<LabelEditValidationResult>;
  submitLabelEdit(
    datasetId: DatasetId,
    sampleId: SampleId,
    payload: LabelEditSubmitPayload,
  ): Promise<LabelEditSubmitResult>;
}

export class HttpUrbanViolationApi implements UrbanViolationApi {
  constructor(private readonly http = new HttpClient()) {}

  async listDatasets(): Promise<Dataset[]> {
    const payload = await this.http.get<unknown>('/datasets');
    return listPayload(payload, 'datasets').map((item) => normalizeDataset(item));
  }

  async getDatasetSummary(datasetId: DatasetId): Promise<DatasetSummary> {
    const payload = await this.http.get<unknown>(`/datasets/${encodeURIComponent(datasetId)}/summary`);
    return normalizeDatasetSummary(payload, datasetId);
  }

  async listAssets(datasetId: DatasetId, filters: AssetListFilters = {}): Promise<AssetListItem[]> {
    const search = new URLSearchParams();
    const queryMap: Record<keyof AssetListFilters, string> = {
      judgeDecision: 'judge_decision',
      stage2State: 'failure_status',
      qcStatus: 'qc_status',
      violationCategory: 'category',
      sampleCategory: 'sample_category',
      search: 'search',
    };

    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all') {
        search.set(queryMap[key as keyof AssetListFilters] ?? key, value);
      }
    });

    const query = search.toString();
    const payload = await this.http.get<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/assets${query ? `?${query}` : ''}`,
    );
    return listPayload(payload, 'assets').map((item) => normalizeAssetItem(item, datasetId));
  }

  async getImportJob(datasetId: DatasetId, jobId: ImportJobId): Promise<ImportJobDetail> {
    const payload = await this.http.get<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/import-jobs/${encodeURIComponent(jobId)}`,
    );
    return normalizeImportJob(payload, datasetId, jobId);
  }

  async getPreannotationSummary(datasetId: DatasetId): Promise<PreannotationSummary> {
    const payload = await this.http.get<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/summary`,
    );
    return normalizePreannotationSummary(payload, datasetId);
  }

  async listQcQueue(datasetId: DatasetId): Promise<QcQueueItem[]> {
    const payload = await this.http.get<unknown>(`/datasets/${encodeURIComponent(datasetId)}/qc`);
    return listPayload(payload, 'queue').map((item) => normalizeQcQueueItem(item, datasetId));
  }

  async getReviewSample(datasetId: DatasetId, sampleId: SampleId): Promise<ReviewSampleDetail> {
    const payload = await this.http.get<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/samples/${encodeURIComponent(sampleId)}/review`,
    );
    return normalizeReviewSample(payload, datasetId, sampleId);
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
    const response = await this.http.post<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/label-configs/validate`,
      {
        file_name: payload.fileName,
        config: payload.config,
      },
    );
    return normalizeLabelConfigValidation(response, datasetId);
  }

  async saveLabelConfig(datasetId: DatasetId, payload: LabelConfigUploadPayload): Promise<LabelConfigSaveResult> {
    const response = await this.http.post<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/label-configs`,
      {
        file_name: payload.fileName,
        config: payload.config,
        activate: Boolean(payload.activate),
      },
    );
    return normalizeLabelConfigSaveResult(response, datasetId);
  }

  async activateLabelConfig(datasetId: DatasetId, configId: string): Promise<LabelConfigSaveResult> {
    const response = await this.http.post<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/label-configs/${encodeURIComponent(configId)}/activate`,
    );
    return normalizeLabelConfigSaveResult(response, datasetId);
  }

  async getActiveLabelConfig(datasetId: DatasetId): Promise<LabelConfig> {
    const response = await this.http.get<unknown>(
      `/datasets/${encodeURIComponent(datasetId)}/label-config/active`,
    );
    return normalizeLabelConfig(response, datasetId);
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

const isBackendDataset = (value: unknown): value is BackendDataset =>
  isRecord(value) && typeof value.dataset_id === 'string';

const normalizeDataset = (value: unknown, fallbackId = 'unknown-dataset'): Dataset => {
  if (isBackendDataset(value)) {
    return {
      id: value.dataset_id,
      name: value.name,
      version: 'live',
      status: 'active',
      description: `${value.total_assets} assets imported from backend dataset ${value.dataset_id}.`,
      rootPath: value.root_path,
      createdAt: value.created_at,
      updatedAt: value.created_at,
      tags: [],
    };
  }

  const record = isRecord(value) ? value : {};
  return {
    id: stringValue(record.id, fallbackId),
    name: stringValue(record.name, fallbackId),
    version: stringValue(record.version, 'live'),
    status: stringValue(record.status, 'active') as Dataset['status'],
    description: stringValue(record.description, ''),
    rootPath: stringValue(record.rootPath ?? record.root_path, ''),
    createdAt: stringValue(record.createdAt ?? record.created_at, new Date(0).toISOString()),
    updatedAt: stringValue(record.updatedAt ?? record.updated_at ?? record.createdAt, new Date(0).toISOString()),
    tags: arrayValue<string>(record.tags),
    owner: stringValue(record.owner, ''),
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

  return {
    dataset,
    totals: {
      rawAssets,
      stage1Parsed,
      stage2Parsed,
      stage2Failures: numberValue(rawTotals.stage2Failures ?? rawTotals.stage2_failure_count, numberValue(record.stage2_failure_count)),
    },
    coverage: {
      stage1: numberValue(rawCoverage.stage1, rawAssets > 0 ? stage1Parsed / rawAssets : 0),
      stage2: numberValue(rawCoverage.stage2, rawAssets > 0 ? stage2Parsed / rawAssets : 0),
    },
    qc: normalizeQcSummary(record.qc),
    judgeDecisionDistribution: normalizeDistributionList(record.judgeDecisionDistribution ?? record.judge_decision_distribution),
    violationCategoryDistribution: normalizeDistributionList(record.violationCategoryDistribution ?? record.violation_category_distribution),
    confidenceDistribution: normalizeDistributionList(record.confidenceDistribution ?? record.confidence_distribution),
    visibilityDistribution: normalizeDistributionList(record.visibilityDistribution ?? record.visibility_distribution),
    sampleCategoryDistribution: normalizeDistributionList(record.sampleCategoryDistribution ?? record.sample_category_distribution),
    importWarnings: normalizeWarnings(record.importWarnings ?? record.import_warnings),
    recentRuns: arrayValue<DatasetSummary['recentRuns'][number]>(record.recentRuns ?? record.recent_runs),
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
    const record = isRecord(item) ? item : {};
    return {
      id: stringValue(record.id, `warning-${index + 1}`),
      severity: stringValue(record.severity, 'warning') as ImportWarning['severity'],
      title: stringValue(record.title, 'Backend warning'),
      message: stringValue(record.message, ''),
      createdAt: stringValue(record.createdAt ?? record.created_at, ''),
    };
  });

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
    taskMode: stringValue(record.task_mode ?? record.taskMode, 'label_edit') as LabelEditState['taskMode'],
    submitAction: stringValue(record.submit_action ?? record.submitAction, 'save_draft') as LabelEditState['submitAction'],
    taskStatus: stringValue(record.task_status ?? record.taskStatus, 'annotation_draft') as LabelEditState['taskStatus'],
    labelConfigId: optionalString(record.label_config_id ?? record.labelConfigId),
    labelConfigVersion: optionalString(record.label_config_version ?? record.labelConfigVersion),
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
    sampleId,
    imageUrl,
    thumbnailUrl,
    width: numberValue(record.width ?? backend.width, 1280),
    height: numberValue(record.height ?? backend.height, 720),
    sourcePath: stringValue(record.sourcePath ?? record.source_image_path_internal ?? backend.source_image_path_internal, ''),
    importedAt: stringValue(record.importedAt ?? record.imported_at, ''),
    stage1Status: stringValue(record.stage1Status ?? record.stage1_status, 'ready') as AssetListItem['stage1Status'],
    stage2Status: normalizeStageStatus(rawStage2Status, hasStage2Failure ? 'failed' : 'ready'),
    judgeDecision: stringValue(record.judgeDecision ?? record.judge_decision ?? record.stage2_judge_decision, 'pass') as AssetListItem['judgeDecision'],
    qcStatus: normalizeQcStatus(record.qcStatus ?? record.qc_status),
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

  return {
    asset,
    stage1,
    stage2,
    stage2Failure: failure,
    humanReview: isRecord(humanReviewValue) ? normalizeHumanReview(humanReviewValue, sampleId) : undefined,
    auditArtifacts: normalizeAuditArtifacts(record.auditArtifacts ?? record.audit_artifacts),
    labelEditState: normalizeLabelEditState(record.labelEditState ?? record.label_edit_state),
    labelEditHistory: arrayValue<unknown>(record.labelEditHistory ?? record.label_edit_history)
      .flatMap((item) => {
        const state = normalizeLabelEditState(item);
        return state ? [state] : [];
      }),
  };
};

const normalizeQcQueueItem = (value: unknown, datasetId: DatasetId): QcQueueItem => {
  const record = isRecord(value) ? value : {};
  if ('asset_id' in record || 'assetId' in record) {
    return {
      sampleId: stringValue(record.sampleId ?? record.sample_id),
      assetId: stringValue(record.assetId ?? record.asset_id),
      status: stringValue(record.status ?? record.qc_status, 'qc_pending') as QcQueueItem['status'],
      judgeDecision: stringValue(record.judgeDecision ?? record.judge_decision, 'pass') as QcQueueItem['judgeDecision'],
      highestConfidence: maybeNumber(record.highestConfidence ?? record.highest_confidence),
      primaryCategory: stringValue(record.primaryCategory ?? record.primary_category, ''),
      stage2Failure: booleanValue(record.stage2Failure ?? record.stage2_failure),
      updatedAt: stringValue(record.updatedAt ?? record.updated_at, ''),
    };
  }

  const asset = normalizeAssetItem(value, datasetId);
  return {
    sampleId: asset.sampleId,
    assetId: asset.id,
    status: asset.qcStatus,
    judgeDecision: asset.judgeDecision,
    highestConfidence: asset.highestConfidence,
    primaryCategory: asset.violationCategories[0],
    stage2Failure: asset.hasStage2Failure,
    updatedAt: asset.updatedAt,
  };
};

const normalizeImportJob = (payload: unknown, datasetId: DatasetId, jobId: ImportJobId): ImportJobDetail => {
  const record = isRecord(payload) ? payload : {};
  const backend = record as Partial<BackendImportJob>;
  const state = stringValue(record.state ?? backend.state, 'Draft') as ImportJobState;
  const expectedAssets = numberValue(record.expected_assets ?? record.expectedAssets ?? backend.expected_assets);
  const importedAssets = numberValue(record.imported_assets ?? record.importedAssets ?? backend.imported_assets);
  const stage2Parsed = numberValue(record.stage2_success_count ?? record.stage2SuccessCount, importedAssets);
  const failureCount = numberValue(record.failure_count ?? record.failureCount ?? backend.failure_count);
  const validationErrors = arrayValue<string>(record.validation_errors ?? record.validationErrors ?? backend.validation_errors);

  if ('totals' in record && 'validationRows' in record) {
    return record as unknown as ImportJobDetail;
  }

  return {
    id: stringValue(record.id ?? record.job_id ?? backend.job_id, jobId),
    datasetId: stringValue(record.datasetId ?? record.dataset_id ?? backend.dataset_id, datasetId),
    state,
    activeStep: importStateStep(state),
    createdAt: stringValue(record.createdAt ?? record.created_at, ''),
    updatedAt: stringValue(record.updatedAt ?? record.updated_at, ''),
    totals: {
      rawAssets: expectedAssets,
      stage1Parsed: importedAssets,
      stage2Parsed,
      stage2Failures: failureCount,
    },
    coverage: {
      stage1: expectedAssets > 0 ? importedAssets / expectedAssets : 0,
      stage2: expectedAssets > 0 ? stage2Parsed / expectedAssets : 0,
    },
    warnings: validationErrors.map((message, index) => ({
      id: `validation-${index + 1}`,
      severity: 'blocking',
      title: 'Validation error',
      message,
    })),
    validationRows: normalizeImportValidationRows(record.validationRows ?? record.validation_rows),
    mappingSteps: normalizeImportMappingSteps(record.mappingSteps ?? record.mapping_steps, {
      expectedAssets,
      importedAssets,
      stage2Parsed,
      failureCount,
    }),
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
  return 5;
};

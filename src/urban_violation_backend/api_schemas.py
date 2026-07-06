"""API request/response schemas for runtime FastAPI endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from urban_violation_backend.schemas import (
    AnnotationSnapshotType,
    BatchAssignmentStatus,
    DatasetLifecycleStatus,
    EvaluationMetrics,
    EvaluationRunStatus,
    ExportFormat,
    ExportJobStatus,
    ExportSourceFilters,
    ExportSourceType,
    HumanReview,
    LeaseStatus,
    ModificationEventType,
    SamplePoolItemStatus,
    QcTaskStatus,
    RoleBinding,
    RoleScopeType,
    Stage1Preannotation,
    Stage2Preannotation,
    Stage2PreannotationFailure,
    StrictModel,
    UserRole,
    UserStatus,
)


class HealthResponse(StrictModel):
    """Health endpoint payload."""

    status: Literal["ok"]
    dataset_id: str
    mode: str | None = None
    data_root: str | None = None
    state_root: str | None = None


class ErrorResponse(StrictModel):
    """Structured API error payload."""

    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class LoginRequest(StrictModel):
    """Internal account login request."""

    user_id: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=1024)


class LoginResponse(StrictModel):
    """Login response with opaque session token."""

    token: str
    expires_at: datetime
    auth_mode: str
    user: "UserAccountResponse"


class LogoutResponse(StrictModel):
    """Logout response."""

    logged_out: bool


class UserAccountCreateRequest(StrictModel):
    """Create one internal account."""

    user_id: str = Field(min_length=1, max_length=80, pattern=r"^[a-z][a-z0-9_\-]*$")
    display_name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=1024)
    status: UserStatus = UserStatus.ACTIVE


class UserAccountPatchRequest(StrictModel):
    """Patch mutable account fields."""

    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    email: str | None = Field(default=None, min_length=3, max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=1024)
    status: UserStatus | None = None


class UserAccountResponse(StrictModel):
    """Public account projection."""

    user_id: str
    display_name: str
    email: str
    status: UserStatus
    created_at: datetime
    updated_at: datetime
    last_seen_at: datetime | None = None


class RoleBindingCreateRequest(StrictModel):
    """Create role binding request."""

    user_id: str = Field(min_length=1, max_length=80)
    role: UserRole
    scope_type: RoleScopeType
    scope_id: str = Field(min_length=1, max_length=180)


class CurrentUserResponse(StrictModel):
    """Current user context and effective permissions."""

    auth_mode: str
    user_id: str
    display_name: str
    email: str
    status: UserStatus
    roles: list[RoleBinding] = Field(default_factory=list)
    permissions: list[str] = Field(default_factory=list)


class RbacRoleCatalogItem(StrictModel):
    """Catalog row for one role and its machine-readable permissions."""

    role: UserRole
    permissions: list[str] = Field(default_factory=list)


class RbacCatalogResponse(StrictModel):
    """RBAC catalog for permission management UI rendering."""

    roles: list[RbacRoleCatalogItem] = Field(default_factory=list)
    scope_types: list[RoleScopeType] = Field(default_factory=list)


class LabelConfigValidateRequest(StrictModel):
    """JSON request body for validating one uploaded label config."""

    file_name: str = Field(min_length=1)
    config: dict[str, Any] = Field(default_factory=dict)


class LabelConfigSaveRequest(LabelConfigValidateRequest):
    """JSON request body for saving one uploaded label config version."""

    activate: bool = False
    save_as_new_version: bool = False


class DatasetTypeCreateRequest(StrictModel):
    """Request body for registering a dataset type before creating batches."""

    dataset_type: str = Field(min_length=1, max_length=80, pattern=r"^[a-z][a-z0-9_]*$")
    display_name: str = Field(min_length=1, max_length=120)
    field_schema_version: str = Field(default="draft", min_length=1, max_length=80)


class LabelEditOperation(BaseModel):
    """One patch operation from frontend reviewDraft payload."""

    model_config = ConfigDict(extra="allow")

    scope: str = Field(min_length=1)
    field: str = Field(min_length=1)
    op: str = Field(min_length=1)
    before: Any | None = None
    after: Any | None = None
    tag_payload: dict[str, Any] | None = None


class LabelEditValidateRequest(StrictModel):
    """Request body for field-level label edit validation."""

    task_mode: Literal["label_edit"] = "label_edit"
    lease_id: str | None = None
    base_revision: int | None = Field(default=None, ge=0)
    draft_revision: int | None = Field(default=None, ge=0)
    label_config_id: str | None = None
    label_config_version: str | None = None
    operations: list[LabelEditOperation] = Field(default_factory=list)


class LabelEditSubmitRequest(LabelEditValidateRequest):
    """Request body for saving or submitting label-edit patch operations."""

    submit_action: Literal["save_draft", "submit_changes"]
    task_status: Literal["annotation_draft", "annotation_submitted"] | None = None


class LabelEditValidationIssue(StrictModel):
    """One field-level validation issue for a patch operation."""

    operation_index: int = Field(ge=0)
    scope: str
    field: str
    code: str
    message: str


class LabelEditValidationResponse(StrictModel):
    """Validation result for label-edit operations."""

    valid: bool
    dataset_id: str
    sample_id: str
    checked_operation_count: int = Field(ge=0)
    errors: list[LabelEditValidationIssue] = Field(default_factory=list)
    warnings: list[LabelEditValidationIssue] = Field(default_factory=list)


class LabelEditState(StrictModel):
    """Stored reviewDraft patch state for one sample."""

    edit_id: str
    dataset_id: str
    sample_id: str
    user_id: str = "dev_user"
    task_mode: Literal["label_edit"]
    submit_action: Literal["save_draft", "submit_changes"]
    task_status: Literal["annotation_draft", "annotation_submitted"]
    label_config_id: str | None = None
    label_config_version: str | None = None
    operations: list[LabelEditOperation] = Field(default_factory=list)
    updated_at: datetime


class LabelEditSubmitResponse(StrictModel):
    """Persist result for label-edit draft save or submit."""

    saved: bool
    state: LabelEditState
    validation: LabelEditValidationResponse | None = None


class BatchQcAssignmentResponse(StrictModel):
    """Batch-level single-assignee state."""

    assignment_id: str
    qc_queue_id: str
    dataset_id: str
    assignee_user_id: str
    assigned_by: str
    status: BatchAssignmentStatus
    assigned_at: datetime
    submitted_at: datetime | None = None
    confirmed_at: datetime | None = None
    returned_at: datetime | None = None
    revoked_at: datetime | None = None


class BatchAssignmentRequest(StrictModel):
    """Assign one batch to one user."""

    assignee_user_id: str = Field(min_length=1, max_length=80)


class BatchAssignmentActionRequest(StrictModel):
    """Batch assignment action with optional reason."""

    assignee_user_id: str | None = Field(default=None, min_length=1, max_length=80)
    reason: str | None = Field(default=None, max_length=400)


class QcTaskResponse(StrictModel):
    """Sample-level task state."""

    task_id: str
    qc_queue_id: str
    dataset_id: str
    sample_id: str
    status: QcTaskStatus
    assignee_user_id: str | None = None
    claimed_at: datetime | None = None
    submitted_at: datetime | None = None
    completed_at: datetime | None = None
    confirmed_by: str | None = None
    confirmed_at: datetime | None = None
    latest_submission_id: str | None = None
    label_config_id: str | None = None
    label_config_version: str | None = None
    task_revision: int = Field(default=0, ge=0)


class SampleLeaseResponse(StrictModel):
    """Sample lease projection."""

    lease_id: str
    dataset_id: str
    sample_id: str
    task_id: str
    user_id: str
    status: LeaseStatus
    acquired_at: datetime
    expires_at: datetime
    heartbeat_at: datetime
    released_at: datetime | None = None
    revoked_at: datetime | None = None


class LeaseAcquireResponse(StrictModel):
    """Lease acquire result."""

    editable: bool
    lease: SampleLeaseResponse


class LabelEditDraftResponse(StrictModel):
    """Current user's draft payload."""

    draft_id: str
    dataset_id: str
    sample_id: str
    user_id: str
    task_id: str
    lease_id: str
    base_revision: int
    label_config_id: str | None = None
    label_config_version: str | None = None
    operations: list[LabelEditOperation] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class BatchDraftValidationState(StrictModel):
    """Validation summary attached to one batch draft sample entry."""

    valid: bool = True
    error_count: int = Field(default=0, ge=0)
    warning_count: int = Field(default=0, ge=0)
    errors: list[LabelEditValidationIssue] = Field(default_factory=list)
    warnings: list[LabelEditValidationIssue] = Field(default_factory=list)


class BatchDraftEntryRequest(StrictModel):
    """One sample-level draft entry in batch save/autosave payload."""

    sample_id: str = Field(min_length=1)
    lease_id: str | None = None
    base_revision: int | None = Field(default=None, ge=0)
    label_config_id: str | None = None
    label_config_version: str | None = None
    operations: list[LabelEditOperation] = Field(default_factory=list)
    dirty: bool = False
    saved: bool = True
    validation: BatchDraftValidationState | None = None


class BatchDraftSaveRequest(StrictModel):
    """Batch draft save/autosave payload."""

    entries: list[BatchDraftEntryRequest] = Field(default_factory=list)


class BatchDraftSampleState(StrictModel):
    """Server-side batch draft state for one sample."""

    sample_id: str
    draft_id: str | None = None
    task_id: str | None = None
    lease_id: str | None = None
    base_revision: int | None = Field(default=None, ge=0)
    label_config_id: str | None = None
    label_config_version: str | None = None
    operations: list[LabelEditOperation] = Field(default_factory=list)
    dirty: bool = False
    saved: bool = True
    validation: BatchDraftValidationState | None = None
    updated_at: datetime | None = None


class BatchDraftSummaryResponse(StrictModel):
    """Current user's batch-level draft workspace summary."""

    dataset_id: str
    user_id: str
    assignment_id: str | None = None
    sample_count: int = Field(default=0, ge=0)
    dirty_count: int = Field(default=0, ge=0)
    saved_count: int = Field(default=0, ge=0)
    validation_error_count: int = Field(default=0, ge=0)
    entries: list[BatchDraftSampleState] = Field(default_factory=list)
    updated_at: datetime | None = None


class BatchSubmitRequest(StrictModel):
    """Batch-level final submit gate payload."""

    unsaved_dirty_sample_ids: list[str] = Field(default_factory=list)
    validation_error_sample_ids: list[str] = Field(default_factory=list)
    notes: str | None = Field(default=None, max_length=400)


class BatchSubmitResponse(StrictModel):
    """Batch-level final submit result."""

    submitted: bool
    dataset_id: str
    assignment_id: str
    assignee_user_id: str
    status: BatchAssignmentStatus
    submitted_sample_count: int = Field(ge=0)
    released_lease_count: int = Field(ge=0)
    submitted_at: datetime


class LabelEditSubmissionResponse(StrictModel):
    """Immutable submission payload."""

    submission_id: str
    dataset_id: str
    sample_id: str
    user_id: str
    task_id: str
    lease_id: str
    base_revision: int
    label_config_id: str | None = None
    label_config_version: str | None = None
    operations: list[LabelEditOperation] = Field(default_factory=list)
    created_at: datetime


class AuditEventResponse(StrictModel):
    """Audit event response."""

    event_id: str
    actor_user_id: str
    actor_roles: list[UserRole] = Field(default_factory=list)
    action: str
    entity: str
    dataset_id: str | None = None
    sample_id: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)
    before: dict[str, Any] | None = None
    after: dict[str, Any] | None = None
    created_at: datetime


class AnnotationSnapshotResponse(StrictModel):
    """Annotation snapshot projection for QC closed-loop traceability."""

    snapshot_id: str
    dataset_id: str
    sample_id: str
    snapshot_type: AnnotationSnapshotType
    source_submission_id: str | None = None
    label_config_id: str | None = None
    label_config_version: str | None = None
    payload_hash: str
    created_by: str
    created_at: datetime
    payload: dict[str, Any] | None = None
    payload_ref: str | None = None


class EvaluationRunCreateRequest(StrictModel):
    """Request body for creating one local evaluation run record."""

    model_version: str = Field(min_length=1, max_length=160)
    baseline_model_version: str | None = Field(default=None, min_length=1, max_length=160)
    source_export_id: str | None = Field(default=None, min_length=1, max_length=160)
    metrics: EvaluationMetrics | None = None
    category_metrics: dict[str, EvaluationMetrics] = Field(default_factory=dict)
    hard_sample_count: int | None = Field(default=None, ge=0)
    changed_sample_ids: list[str] = Field(default_factory=list)
    status: EvaluationRunStatus = EvaluationRunStatus.COMPLETED
    completed_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=4000)


class EvaluationRunResponse(StrictModel):
    """Evaluation run projection."""

    evaluation_id: str
    dataset_id: str
    dataset_type: str
    model_version: str
    baseline_model_version: str | None = None
    source_export_id: str | None = None
    metrics: EvaluationMetrics = Field(default_factory=EvaluationMetrics)
    category_metrics: dict[str, EvaluationMetrics] = Field(default_factory=dict)
    hard_sample_count: int = Field(default=0, ge=0)
    changed_sample_ids: list[str] = Field(default_factory=list)
    created_by: str
    created_at: datetime
    completed_at: datetime | None = None
    status: EvaluationRunStatus
    notes: str | None = None


class EvaluationMetricDelta(StrictModel):
    """Metric deltas between two evaluation runs (right - left)."""

    mAP: float | None = None
    precision: float | None = None
    recall: float | None = None
    f1: float | None = None
    false_positive_rate: float | None = None
    hard_sample_hit_rate: float | None = None


class EvaluationCategoryDelta(StrictModel):
    """One category-level metric delta row."""

    category: str
    metric_delta: EvaluationMetricDelta


class EvaluationChangedSamplesDelta(StrictModel):
    """Set-based sample delta between two runs."""

    left_only: list[str] = Field(default_factory=list)
    right_only: list[str] = Field(default_factory=list)
    intersection: list[str] = Field(default_factory=list)


class EvaluationCompareResponse(StrictModel):
    """Comparison payload for two evaluation runs."""

    left: EvaluationRunResponse
    right: EvaluationRunResponse
    metric_delta: EvaluationMetricDelta
    category_deltas: list[EvaluationCategoryDelta] = Field(default_factory=list)
    changed_samples: EvaluationChangedSamplesDelta
    generated_at: datetime


class EvaluationDeltaSampleRefResponse(StrictModel):
    """Changed sample reference with direct review URL for UI jumps."""

    sample_id: str
    dataset_id: str
    review_url: str


class EvaluationDeltaSamplesResponse(StrictModel):
    """Changed sample refs for one evaluation run."""

    evaluation_id: str
    dataset_id: str
    dataset_type: str
    model_version: str
    total: int = Field(default=0, ge=0)
    samples: list[EvaluationDeltaSampleRefResponse] = Field(default_factory=list)
    generated_at: datetime


class SnapshotDiffResponse(StrictModel):
    """Diff summary between two annotation snapshots."""

    dataset_id: str
    left_snapshot: AnnotationSnapshotResponse
    right_snapshot: AnnotationSnapshotResponse
    operation_count: int = Field(default=0, ge=0)
    changed_fields: list[str] = Field(default_factory=list)
    changed_relations: list[str] = Field(default_factory=list)
    changed_candidates: list[str] = Field(default_factory=list)
    generated_at: datetime


class SnapshotRollbackResponse(StrictModel):
    """Rollback API response when rollback is intentionally disabled."""

    rollback_enabled: Literal[False] = False
    dataset_id: str
    snapshot_id: str
    message: str


class ModificationEventResponse(StrictModel):
    """Derived modification event projection."""

    event_id: str
    event_key: str
    dataset_id: str
    sample_id: str
    reviewer_id: str
    lead_user_id: str | None = None
    submission_id: str
    event_type: ModificationEventType
    target_id: str
    field: str
    before: Any | None = None
    after: Any | None = None
    attribution_code: str
    attribution_label: str
    attribution_weight: float
    created_at: datetime


class ModificationEventTypeCount(StrictModel):
    """Event-type aggregate row."""

    event_type: ModificationEventType
    count: int = Field(ge=0)


class ModificationAttributionCount(StrictModel):
    """Attribution aggregate row."""

    attribution_code: str
    attribution_label: str
    count: int = Field(ge=0)
    weight_sum: float = Field(ge=0.0)


class BboxOffsetBandCount(StrictModel):
    """BBox offset aggregate row."""

    band: Literal["micro", "medium", "large"]
    count: int = Field(ge=0)


class ChangedSampleSummary(StrictModel):
    """Per-sample modification event aggregation."""

    sample_id: str
    event_count: int = Field(ge=0)
    event_types: list[ModificationEventType] = Field(default_factory=list)
    attribution_codes: list[str] = Field(default_factory=list)
    reviewer_id: str
    confirmed_at: datetime | None = None


class ModificationEventStatsResponse(StrictModel):
    """QC modification event aggregate response."""

    dataset_id: str
    total_events: int = Field(ge=0)
    changed_sample_count: int = Field(ge=0)
    by_event_type: list[ModificationEventTypeCount] = Field(default_factory=list)
    by_attribution: list[ModificationAttributionCount] = Field(default_factory=list)
    bbox_offset_bands: list[BboxOffsetBandCount] = Field(default_factory=list)
    changed_samples: list[ChangedSampleSummary] = Field(default_factory=list)
    generated_at: datetime


class SamplePoolItemResponse(StrictModel):
    """Correction sample pool item projection."""

    item_id: str
    dataset_id: str
    dataset_type: str
    sample_id: str
    confirmed_snapshot_id: str
    source_submission_id: str | None = None
    event_ids: list[str] = Field(default_factory=list)
    event_count: int = Field(default=0, ge=0)
    changed_field_count: int = Field(default=0, ge=0)
    event_types: list[ModificationEventType] = Field(default_factory=list)
    attribution_codes: list[str] = Field(default_factory=list)
    category: str | None = None
    primary_category: str | None = None
    reviewer_id: str | None = None
    confirmed_by: str | None = None
    confirmed_at: datetime | None = None
    status: SamplePoolItemStatus
    created_at: datetime
    updated_at: datetime


class SamplePoolFiltersResponse(StrictModel):
    """Echo of applied sample pool list filters."""

    dataset_id: str | None = None
    dataset_type: str | None = None
    sample_id: str | None = None
    category: str | None = None
    attribution_code: str | None = None
    event_type: ModificationEventType | None = None
    reviewer_id: str | None = None
    status: SamplePoolItemStatus | None = None


class SamplePoolListResponse(StrictModel):
    """Sample pool list response."""

    items: list[SamplePoolItemResponse] = Field(default_factory=list)
    total: int = Field(default=0, ge=0)
    filters: SamplePoolFiltersResponse = Field(default_factory=SamplePoolFiltersResponse)
    generated_at: datetime


class SamplePoolDatasetCount(StrictModel):
    """Sample pool distribution by dataset."""

    dataset_id: str
    dataset_type: str
    count: int = Field(default=0, ge=0)


class SamplePoolKeyCount(StrictModel):
    """Generic key/count row used in sample pool statistics."""

    key: str
    count: int = Field(default=0, ge=0)


class SamplePoolStatsResponse(StrictModel):
    """Sample pool aggregate statistics."""

    total_items: int = Field(default=0, ge=0)
    active_items: int = Field(default=0, ge=0)
    by_dataset: list[SamplePoolDatasetCount] = Field(default_factory=list)
    by_category: list[SamplePoolKeyCount] = Field(default_factory=list)
    by_attribution: list[SamplePoolKeyCount] = Field(default_factory=list)
    by_event_type: list[SamplePoolKeyCount] = Field(default_factory=list)
    recent_items: list[SamplePoolItemResponse] = Field(default_factory=list)
    generated_at: datetime


class SamplePoolItemDetailResponse(StrictModel):
    """Sample pool detail with linked events and snapshot metadata."""

    item: SamplePoolItemResponse
    events: list[ModificationEventResponse] = Field(default_factory=list)
    snapshot: AnnotationSnapshotResponse | None = None


class SamplePoolItemUpsertRequest(StrictModel):
    """Manual create/reactivate request for correction sample pool."""

    dataset_id: str = Field(min_length=1, max_length=160)
    sample_id: str = Field(min_length=1, max_length=160)
    source_submission_id: str | None = Field(default=None, min_length=1, max_length=160)
    confirmed_snapshot_id: str | None = Field(default=None, min_length=1, max_length=160)


class QcProgressByStatus(StrictModel):
    """Count by status."""

    status: QcTaskStatus
    count: int = Field(ge=0)


class QcProgressByUser(StrictModel):
    """Count by user."""

    user_id: str
    count: int = Field(ge=0)


class QcProgressResponse(StrictModel):
    """Dataset QC progress summary."""

    dataset_id: str
    assignment: BatchQcAssignmentResponse | None = None
    total_tasks: int = Field(ge=0)
    by_status: list[QcProgressByStatus] = Field(default_factory=list)
    by_user: list[QcProgressByUser] = Field(default_factory=list)


class DatasetSummaryResponse(StrictModel):
    """High-level counters for one dataset."""

    dataset_id: str
    dataset_type: str = "urban_violation"
    display_name: str = "城市违规"
    field_schema_version: str = "2026-05-18"
    active_label_config_version: int | None = None
    batch_key: str = "0508_fixture"
    lifecycle_status: DatasetLifecycleStatus = DatasetLifecycleStatus.IMPORTED
    active_import_job_id: str | None = None
    qc_queue_id: str | None = None
    legacy_dataset_id: str | None = None
    source_mode: Literal["local_directory", "uploaded_package", "object_storage_prefix", "manifest_only"] | None = None
    source_uri: str | None = None
    source_structure: Literal["images_only", "images_with_preannotations"] | None = None
    source_file_count: int = Field(default=0, ge=0)
    name: str
    total_assets: int = Field(ge=0)
    stage1_count: int = Field(ge=0)
    stage2_success_count: int = Field(ge=0)
    stage2_failure_count: int = Field(ge=0)
    reviewed_count: int = Field(ge=0)
    created_at: datetime
    fact_verification_count: int = Field(default=0, ge=0)
    candidate_count: int = Field(default=0, ge=0)
    judge_decision_distribution: list["CountDistributionItem"] = Field(default_factory=list)
    category_distribution: list["CountDistributionItem"] = Field(default_factory=list)
    verification_distribution: list["CountDistributionItem"] = Field(default_factory=list)
    confidence_distribution: list["CountDistributionItem"] = Field(default_factory=list)
    visibility_distribution: list["CountDistributionItem"] = Field(default_factory=list)
    sample_category_distribution: list["CountDistributionItem"] = Field(default_factory=list)


class DatasetTypeResponse(StrictModel):
    """Dataset type registry row with its owned batches."""

    dataset_type: str
    display_name: str
    field_schema_version: str = "draft"
    active_label_config_version: int | None = None
    status: Literal["active", "archived"] = "active"
    batch_count: int = Field(ge=0)
    batches: list[DatasetSummaryResponse] = Field(default_factory=list)


class DatasetDeleteResponse(StrictModel):
    """Delete result for one registered dataset batch."""

    deleted: bool
    dataset_id: str
    dataset_type: str
    batch_key: str


class CountDistributionItem(StrictModel):
    """Simple key/count distribution item for dashboards."""

    key: str
    label: str
    count: int = Field(ge=0)
    ratio: float = Field(ge=0.0)


class AssetListItem(StrictModel):
    """List-row projection for dataset assets."""

    asset_id: str
    sample_id: str
    image_url: str
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    judge_decision: Literal["pass", "soft_fail", "unknown"]
    stage2_status: Literal["success", "failure"]
    violation_categories: list[str] = Field(default_factory=list)
    sample_categories: list[str] = Field(default_factory=list)
    qc_status: Literal["pending", "reviewed"]
    candidate_count: int = Field(default=0, ge=0)
    highest_confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    updated_at: datetime | None = None


class AssetListResponse(StrictModel):
    """Pageless asset list response for fixture data."""

    dataset_id: str
    dataset_type: str = "urban_violation"
    batch_key: str = "0508_fixture"
    total: int = Field(ge=0)
    items: list[AssetListItem] = Field(default_factory=list)


class AssetSummaryMetrics(StrictModel):
    """Batch-scoped summary metrics used by dataset asset overview."""

    total_assets: int = Field(ge=0)
    media_valid_total: int = Field(ge=0)
    media_invalid_total: int = Field(ge=0)
    stage1_total: int = Field(ge=0)
    stage2_success_total: int = Field(ge=0)
    stage2_failure_total: int = Field(ge=0)
    review_pending_total: int = Field(ge=0)
    review_submitted_total: int = Field(ge=0)
    manual_edit_sample_total: int = Field(ge=0)


class AssetSummaryResponse(StrictModel):
    """Batch-scoped asset summary response."""

    dataset_id: str
    dataset_type: str = "urban_violation"
    batch_key: str = "0508_fixture"
    lifecycle_status: DatasetLifecycleStatus = DatasetLifecycleStatus.IMPORTED
    metrics: AssetSummaryMetrics
    judge_decision_distribution: list["CountDistributionItem"] = Field(default_factory=list)
    category_distribution: list["CountDistributionItem"] = Field(default_factory=list)
    sample_category_distribution: list["CountDistributionItem"] = Field(default_factory=list)
    qc_status_distribution: list["CountDistributionItem"] = Field(default_factory=list)


class AssetDetailResponse(StrictModel):
    """Detailed review payload for one sample."""

    dataset_id: str
    dataset_type: str = "urban_violation"
    batch_key: str = "0508_fixture"
    sample_id: str
    asset: AssetListItem
    stage1: Stage1Preannotation
    stage2: Stage2Preannotation | None = None
    stage2_failure: Stage2PreannotationFailure | None = None
    label_edit_state: LabelEditState | None = None
    label_edit_history: list[LabelEditState] = Field(default_factory=list)
    current_user: CurrentUserResponse | None = None
    batch_assignment: BatchQcAssignmentResponse | None = None
    qc_task: QcTaskResponse | None = None
    sample_lease: SampleLeaseResponse | None = None
    my_draft: LabelEditDraftResponse | None = None
    latest_submission: LabelEditSubmissionResponse | None = None
    latest_review: HumanReview | None = None
    review_history: list[HumanReview] = Field(default_factory=list)


class ReviewSubmitRequest(StrictModel):
    """Request body for saving a human review decision."""

    reviewer: str = Field(min_length=1, max_length=80)
    decision: Literal["approved", "needs_changes", "rejected"]
    notes: str = ""
    corrected_categories: list[str] = Field(default_factory=list)
    corrected_bboxes: list[list[int]] = Field(default_factory=list)

    @field_validator("corrected_bboxes")
    @classmethod
    def validate_bboxes(cls, value: list[list[int]]) -> list[list[int]]:
        """Validate corrected bbox shape and coordinate ordering."""
        for bbox in value:
            if len(bbox) != 4:
                raise ValueError("Each corrected bbox must have exactly 4 coordinates")
            x_min, y_min, x_max, y_max = bbox
            if min(bbox) < 0:
                raise ValueError("Corrected bbox coordinates must be non-negative")
            if x_min >= x_max or y_min >= y_max:
                raise ValueError("Corrected bbox must satisfy x_min < x_max and y_min < y_max")
        return value


class ImportJobStatusResponse(StrictModel):
    """Import job status projection."""

    job_id: str
    dataset_id: str
    dataset_type: str = "urban_violation"
    batch_key: str = "0508_fixture"
    batch_name: str | None = None
    source_mode: Literal["local_directory", "uploaded_package", "object_storage_prefix", "manifest_only"] | None = None
    source_uri: str | None = None
    source_structure: Literal["images_only", "images_with_preannotations"] | None = None
    description: str | None = None
    source_file_count: int = Field(default=0, ge=0)
    image_count: int = Field(default=0, ge=0)
    stage1_file_count: int = Field(default=0, ge=0)
    stage2_file_count: int = Field(default=0, ge=0)
    stage2_failure_file_count: int = Field(default=0, ge=0)
    state: str
    lifecycle_status: DatasetLifecycleStatus = DatasetLifecycleStatus.IMPORTED
    expected_assets: int = Field(ge=0)
    imported_assets: int = Field(ge=0)
    stage2_success_count: int = Field(default=0, ge=0)
    failure_count: int = Field(ge=0)
    warning_count: int = Field(default=0, ge=0)
    warnings: list[str] = Field(default_factory=list)
    requested_sample_ids: list[str] = Field(default_factory=list)
    validation_errors: list[str] = Field(default_factory=list)
    validation_rows: list["ImportValidationRow"] = Field(default_factory=list)
    mapping_steps: list["ImportMappingStep"] = Field(default_factory=list)
    live_progress: "ImportLiveProgressResponse | None" = None


class ImportLiveProgressResponse(StrictModel):
    """Optional live import progress from Redis runtime coordination."""

    stage: str = Field(min_length=1, max_length=80)
    state: str = Field(min_length=1, max_length=80)
    current: int = Field(default=0, ge=0)
    total: int = Field(default=0, ge=0)
    message: str = Field(default="", max_length=500)
    updated_at: datetime | None = None


class ImportJobCreateRequest(StrictModel):
    """Create one import job or register a manual batch under a dataset type."""

    requested_sample_ids: list[str] = Field(default_factory=list)
    dataset_type: str | None = Field(default=None, min_length=1, max_length=80, pattern=r"^[a-z][a-z0-9_]*$")
    batch_key: str | None = Field(default=None, min_length=1, max_length=80, pattern=r"^[a-zA-Z0-9_\-]+$")
    batch_name: str | None = Field(default=None, min_length=1, max_length=120)
    source_mode: Literal["local_directory", "uploaded_package", "object_storage_prefix", "manifest_only"] | None = None
    source_uri: str | None = Field(default=None, max_length=1024)
    source_structure: Literal["images_only", "images_with_preannotations"] | None = None
    description: str | None = Field(default=None, max_length=500)
    source_file_count: int = Field(default=0, ge=0)
    image_count: int = Field(default=0, ge=0)
    stage1_file_count: int = Field(default=0, ge=0)
    stage2_file_count: int = Field(default=0, ge=0)
    stage2_failure_file_count: int = Field(default=0, ge=0)


class ImportValidationRow(StrictModel):
    """Manifest pairing row for import validation UI."""

    sample_id: str
    image_path: str
    stage1_path: str | None = None
    stage2_path: str | None = None
    failure_path: str | None = None
    status: Literal["ready", "stage2_failed", "stage2_missing", "orphan_annotation"]


class ImportMappingStep(StrictModel):
    """Entity/file count displayed by the import workflow."""

    id: str
    label: str
    count: int = Field(ge=0)
    entity: Literal["RawAsset", "PreAnnotationStep1", "PreAnnotationStep2", "PreAnnotationFailure", "AuditArtifact"]


class QCQueueItem(StrictModel):
    """Queue row used by the QC endpoint."""

    qc_queue_id: str
    dataset_id: str
    dataset_type: str
    batch_key: str
    label_config_version: str | None = None
    sample_id: str
    asset_id: str
    judge_decision: Literal["pass", "soft_fail", "unknown"]
    stage2_status: Literal["success", "failure"]
    qc_status: Literal["pending", "reviewed"]
    primary_category: str = ""
    highest_confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    stage2_failure: bool = False
    updated_at: datetime | None = None
    task_status: QcTaskStatus = QcTaskStatus.QUEUED
    assignee_user_id: str | None = None
    active_lease_user_id: str | None = None
    latest_submission_id: str | None = None
    latest_submission: LabelEditSubmissionResponse | None = None


class QCQueueResponse(StrictModel):
    """Response model for QC queue listing."""

    dataset_id: str
    dataset_type: str = "urban_violation"
    batch_key: str = "0508_fixture"
    qc_queue_id: str = "qcq_urban_violation_0508_fixture"
    assignment: BatchQcAssignmentResponse | None = None
    total: int = Field(ge=0)
    items: list[QCQueueItem] = Field(default_factory=list)


class SearchResultItem(StrictModel):
    """Search hit projection with minimal sample context."""

    sample_id: str
    image_url: str
    judge_decision: Literal["pass", "soft_fail", "unknown"]
    stage2_status: Literal["success", "failure"]
    matched_in: list[str] = Field(default_factory=list)


class SearchResponse(StrictModel):
    """Search endpoint response."""

    dataset_id: str
    query: str
    total: int = Field(ge=0)
    items: list[SearchResultItem] = Field(default_factory=list)


class ExportJobCreateRequest(StrictModel):
    """Create one export job from a supported source."""

    format: ExportFormat
    source_type: ExportSourceType
    filters: ExportSourceFilters = Field(default_factory=ExportSourceFilters)


class ExportJobResponse(StrictModel):
    """Export job response payload."""

    export_id: str
    format: ExportFormat
    source_type: ExportSourceType
    filters: ExportSourceFilters = Field(default_factory=ExportSourceFilters)
    status: ExportJobStatus
    item_count: int = Field(default=0, ge=0)
    artifact_path: str | None = None
    artifact_name: str | None = None
    artifact_size: int | None = Field(default=None, ge=0)
    artifact_content_type: str | None = None
    created_by: str
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None
    cancelled_at: datetime | None = None
    error_message: str | None = None


class ExportJobListFiltersResponse(StrictModel):
    """Echo of applied export-job list filters."""

    status: ExportJobStatus | None = None
    source_type: ExportSourceType | None = None
    format: ExportFormat | None = None


class ExportJobListResponse(StrictModel):
    """Export job listing response."""

    items: list[ExportJobResponse] = Field(default_factory=list)
    total: int = Field(default=0, ge=0)
    filters: ExportJobListFiltersResponse = Field(default_factory=ExportJobListFiltersResponse)
    generated_at: datetime


class ExportRequest(StrictModel):
    """Request body for fixture export operation."""

    sample_ids: list[str] = Field(default_factory=list)


class ExportResponse(StrictModel):
    """Export creation response."""

    dataset_id: str
    export_job_id: str
    sample_count: int = Field(ge=0)
    sample_ids: list[str] = Field(default_factory=list)

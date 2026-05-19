"""Backend contract schemas for the Urban Violation platform."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ImportJobState(str, Enum):
    """Import job lifecycle states from architecture docs."""

    DRAFT = "Draft"
    UPLOADING = "Uploading"
    UPLOADED = "Uploaded"
    SCANNING = "Scanning"
    VALIDATING = "Validating"
    VALIDATION_PASSED = "ValidationPassed"
    VALIDATION_FAILED = "ValidationFailed"
    PREVIEW_READY = "PreviewReady"
    IMPORTING = "Importing"
    IMPORTED = "Imported"
    IMPORT_FAILED = "ImportFailed"
    QC_QUEUE_GENERATED = "QCQueueGenerated"


class DatasetLifecycleStatus(str, Enum):
    """Dataset batch lifecycle states for import/preannotation/qc orchestration."""

    DRAFT = "draft"
    REGISTERED = "registered"
    SCANNING = "scanning"
    VALIDATION_FAILED = "validation_failed"
    VALIDATED = "validated"
    IMPORTING = "importing"
    IMPORT_FAILED = "import_failed"
    IMPORTED = "imported"
    PREANNOTATION_PENDING = "preannotation_pending"
    PREANNOTATING = "preannotating"
    PREANNOTATION_FAILED = "preannotation_failed"
    PREANNOTATION_READY = "preannotation_ready"
    LABEL_CONFIG_REQUIRED = "label_config_required"
    QC_READY = "qc_ready"
    QC_IN_PROGRESS = "qc_in_progress"
    QC_COMPLETED = "qc_completed"
    EXPORT_READY = "export_ready"
    ARCHIVED = "archived"


class UserRole(str, Enum):
    """Supported platform roles."""

    PLATFORM_ADMIN = "platform_admin"
    DATASET_ADMIN = "dataset_admin"
    BATCH_MANAGER = "batch_manager"
    ANNOTATOR = "annotator"
    QC_LEAD = "qc_lead"
    AUDITOR = "auditor"


class RoleScopeType(str, Enum):
    """RBAC scope levels."""

    PLATFORM = "platform"
    DATASET_TYPE = "dataset_type"
    DATASET_BATCH = "dataset_batch"


class UserStatus(str, Enum):
    """User availability state."""

    ACTIVE = "active"
    DISABLED = "disabled"


class BatchAssignmentStatus(str, Enum):
    """Batch-level QC assignment state."""

    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    CONFIRMED = "confirmed"
    RETURNED = "returned"
    REVOKED = "revoked"


class QcTaskStatus(str, Enum):
    """Sample-level QC task state."""

    QUEUED = "queued"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    DRAFT_SAVED = "draft_saved"
    SKIPPED = "skipped"
    SUBMITTED = "submitted"
    CONFIRMED = "confirmed"
    RETURNED = "returned"
    COMPLETED = "completed"


class LeaseStatus(str, Enum):
    """Sample lease state."""

    ACTIVE = "active"
    RELEASED = "released"
    EXPIRED = "expired"
    REVOKED = "revoked"


class StrictModel(BaseModel):
    """Base model that rejects unknown fields for safer contracts."""

    model_config = ConfigDict(extra="forbid")


class Dataset(StrictModel):
    """Dataset metadata and aggregate counters."""

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
    name: str
    root_path: str
    total_assets: int = Field(ge=0)
    stage1_count: int = Field(ge=0)
    stage2_success_count: int = Field(ge=0)
    stage2_failure_count: int = Field(ge=0)
    created_at: datetime


class ImportJob(StrictModel):
    """State and counters for a dataset import run."""

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
    state: ImportJobState
    expected_assets: int = Field(ge=0)
    imported_assets: int = Field(ge=0)
    failure_count: int = Field(ge=0)
    requested_sample_ids: list[str] = Field(default_factory=list)
    validation_errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class RawAsset(StrictModel):
    """Raw image asset metadata presented to the browser/UI."""

    asset_id: str
    sample_id: str
    image_url: str
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    source_image_path_internal: str


class RelationBBox(StrictModel):
    """Quantized [x_min, y_min, x_max, y_max] pixel-space box."""

    bbox: list[int] = Field(min_length=4, max_length=4)

    @field_validator("bbox")
    @classmethod
    def validate_bbox(cls, value: list[int]) -> list[int]:
        """Ensure bbox ordering and non-negative coordinates."""
        x_min, y_min, x_max, y_max = value
        if min(value) < 0:
            raise ValueError("bbox coordinates must be non-negative")
        if x_min >= x_max or y_min >= y_max:
            raise ValueError("bbox must satisfy x_min < x_max and y_min < y_max")
        return value


class Stage1Relation(RelationBBox):
    """Single stage1 key relation with localized evidence."""

    subject: str
    relation: str
    object: str
    description: str


class Stage1Preannotation(StrictModel):
    """Normalized stage1 preannotation payload."""

    sample_id: str
    environment_analysis: str
    scene_elements: list[str] = Field(default_factory=list)
    key_anchors: list[str] = Field(default_factory=list)
    key_relations: list[Stage1Relation] = Field(default_factory=list)
    judge_decision: Literal["pass", "soft_fail", "unknown"] = "unknown"


class Stage2FactVerification(RelationBBox):
    """Fact verification details from stage2 review."""

    relation_index: int = Field(ge=0)
    subject: str
    relation: str
    object: str
    visibility_level: Literal["clear", "partial", "tiny", "blurry", "occluded"]
    information_loss_type: Literal["none", "occlusion", "boundary_truncation"]
    key_attributes_visible: list[str] = Field(default_factory=list)
    subject_visible: bool
    subject_match: bool
    bbox_observation: str
    global_context_observation: str
    verification_result: Literal["supported", "weakly_supported", "unsupported", "unclear"]
    verification_confidence: float = Field(ge=0.0, le=1.0)


class Stage2Candidate(StrictModel):
    """Violation candidate derived from verified relations."""

    violation_category: list[str] = Field(default_factory=list)
    evidence_relation_indices: list[int] = Field(default_factory=list)
    evidence_reasoning: str
    relation_hint: str
    segmentation_targets: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)
    sample_category: Literal["positive samples", "negative samples", "hard boundary samples"]


class Stage2Preannotation(StrictModel):
    """Successful stage2 preannotation output."""

    sample_id: str
    fact_verifications: list[Stage2FactVerification] = Field(default_factory=list)
    candidates: list[Stage2Candidate] = Field(default_factory=list)


class Stage2PreannotationFailure(StrictModel):
    """Stage2 failure payload kept for diagnostics and remediation."""

    sample_id: str
    error_type: str
    message: str


class HumanReview(StrictModel):
    """Human-in-the-loop QC decision and optional corrections."""

    review_id: str
    sample_id: str
    reviewer: str
    decision: Literal["approved", "needs_changes", "rejected"]
    notes: str = ""
    corrected_categories: list[str] = Field(default_factory=list)
    corrected_bboxes: list[list[int]] = Field(default_factory=list)
    created_at: datetime


class AuditArtifact(StrictModel):
    """Versioned audit evidence for model/human decisions."""

    artifact_id: str
    sample_id: str
    artifact_type: Literal["request", "response", "record", "failure", "review"]
    storage_url: str
    checksum: str
    created_at: datetime


class UserAccount(StrictModel):
    """Internal platform account."""

    user_id: str
    display_name: str
    email: str
    password_hash: str
    status: UserStatus = UserStatus.ACTIVE
    created_at: datetime
    updated_at: datetime
    last_seen_at: datetime | None = None


class RoleBinding(StrictModel):
    """One role assignment over one scope."""

    binding_id: str
    user_id: str
    role: UserRole
    scope_type: RoleScopeType
    scope_id: str
    created_by: str
    created_at: datetime


class AuthSession(StrictModel):
    """Authenticated session row."""

    session_id: str
    user_id: str
    token: str
    auth_mode: str
    created_at: datetime
    expires_at: datetime
    revoked_at: datetime | None = None


class BatchQcAssignment(StrictModel):
    """Batch-level single-assignee row."""

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


class QcTask(StrictModel):
    """Per-sample QC task."""

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
    task_revision: int = 0


class SampleLease(StrictModel):
    """Sample edit lease."""

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


class LabelEditDraft(StrictModel):
    """User-private draft snapshot for one sample."""

    draft_id: str
    dataset_id: str
    sample_id: str
    user_id: str
    task_id: str
    lease_id: str
    base_revision: int
    label_config_id: str | None = None
    label_config_version: str | None = None
    operations: list[dict[str, Any]] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class LabelEditSubmission(StrictModel):
    """Immutable submitted patch snapshot."""

    submission_id: str
    dataset_id: str
    sample_id: str
    user_id: str
    task_id: str
    lease_id: str
    base_revision: int
    label_config_id: str | None = None
    label_config_version: str | None = None
    operations: list[dict[str, Any]] = Field(default_factory=list)
    created_at: datetime


class AuditEvent(StrictModel):
    """Audit trail row for identity, assignment, lease, and edit actions."""

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

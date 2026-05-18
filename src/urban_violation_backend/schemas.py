"""Backend contract schemas for the Urban Violation platform."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
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

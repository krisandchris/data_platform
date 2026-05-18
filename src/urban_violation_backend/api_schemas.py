"""API request/response schemas for runtime FastAPI endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from urban_violation_backend.schemas import (
    HumanReview,
    Stage1Preannotation,
    Stage2Preannotation,
    Stage2PreannotationFailure,
    StrictModel,
)


class HealthResponse(StrictModel):
    """Health endpoint payload."""

    status: Literal["ok"]
    dataset_id: str


class LabelConfigValidateRequest(StrictModel):
    """JSON request body for validating one uploaded label config."""

    file_name: str = Field(min_length=1)
    config: dict[str, Any] = Field(default_factory=dict)


class LabelConfigSaveRequest(LabelConfigValidateRequest):
    """JSON request body for saving one uploaded label config version."""

    activate: bool = False


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


class DatasetSummaryResponse(StrictModel):
    """High-level counters for one dataset."""

    dataset_id: str
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
    total: int = Field(ge=0)
    items: list[AssetListItem] = Field(default_factory=list)


class AssetDetailResponse(StrictModel):
    """Detailed review payload for one sample."""

    dataset_id: str
    sample_id: str
    asset: AssetListItem
    stage1: Stage1Preannotation
    stage2: Stage2Preannotation | None = None
    stage2_failure: Stage2PreannotationFailure | None = None
    label_edit_state: LabelEditState | None = None
    label_edit_history: list[LabelEditState] = Field(default_factory=list)
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
    state: str
    expected_assets: int = Field(ge=0)
    imported_assets: int = Field(ge=0)
    stage2_success_count: int = Field(default=0, ge=0)
    failure_count: int = Field(ge=0)
    requested_sample_ids: list[str] = Field(default_factory=list)
    validation_errors: list[str] = Field(default_factory=list)
    validation_rows: list["ImportValidationRow"] = Field(default_factory=list)
    mapping_steps: list["ImportMappingStep"] = Field(default_factory=list)


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

    sample_id: str
    asset_id: str
    judge_decision: Literal["pass", "soft_fail", "unknown"]
    stage2_status: Literal["success", "failure"]
    qc_status: Literal["pending", "reviewed"]
    primary_category: str = ""
    highest_confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    stage2_failure: bool = False
    updated_at: datetime | None = None


class QCQueueResponse(StrictModel):
    """Response model for QC queue listing."""

    dataset_id: str
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


class ExportRequest(StrictModel):
    """Request body for fixture export operation."""

    sample_ids: list[str] = Field(default_factory=list)


class ExportResponse(StrictModel):
    """Export creation response."""

    dataset_id: str
    export_job_id: str
    sample_count: int = Field(ge=0)
    sample_ids: list[str] = Field(default_factory=list)

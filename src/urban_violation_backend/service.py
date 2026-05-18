"""Fixture-backed runtime service layer for FastAPI routes."""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
import re
from typing import Any, Sequence

from urban_violation_backend.api_schemas import (
    AssetDetailResponse,
    AssetListItem,
    AssetListResponse,
    CountDistributionItem,
    DatasetSummaryResponse,
    ExportResponse,
    ImportMappingStep,
    ImportJobStatusResponse,
    ImportValidationRow,
    LabelEditState,
    LabelEditSubmitRequest,
    LabelEditSubmitResponse,
    LabelEditValidateRequest,
    LabelEditValidationIssue,
    LabelEditValidationResponse,
    LabelConfigSaveRequest,
    LabelConfigValidateRequest,
    QCQueueItem,
    QCQueueResponse,
    ReviewSubmitRequest,
    SearchResponse,
    SearchResultItem,
)
from urban_violation_backend.importer.parser import (
    FixtureSample,
    import_fixture_samples,
    normalize_media_url,
    pair_stage_samples,
    read_stage1_manifest,
    read_stage2_manifest,
)
from urban_violation_backend.labels import (
    ActiveLabelConfigNotFoundError,
    DatasetLabelConfig,
    InMemoryLabelConfigRepository,
    LabelFieldNotFoundError,
    LabelFieldConfig,
    LabelConfigValidationReport,
    LabelConfigVersionNotFoundError,
    LabelSuggestionResponse,
    StoredLabelConfig,
    filter_label_suggestions,
    validate_label_config,
)
from urban_violation_backend.schemas import HumanReview, ImportJob


class DatasetNotFoundError(ValueError):
    """Raised when a requested dataset id is not available."""


class SampleNotFoundError(ValueError):
    """Raised when a requested sample id does not exist."""


class ImportJobNotFoundError(ValueError):
    """Raised when a requested import job id does not exist."""


class MediaAccessError(ValueError):
    """Raised when a media file request is invalid or unsafe."""


class LabelFieldAccessError(ValueError):
    """Raised when a requested label field cannot be served."""


class ActiveLabelConfigAccessError(ValueError):
    """Raised when a dataset has no active label config."""


class LabelConfigVersionAccessError(ValueError):
    """Raised when a label config version cannot be found."""


class LabelConfigValidationFailedError(ValueError):
    """Raised when a submitted label config fails validation."""

    def __init__(self, report: LabelConfigValidationReport) -> None:
        super().__init__("Label config validation failed")
        self.report = report


class LabelEditValidationFailedError(ValueError):
    """Raised when a submit_changes payload fails field-level validation."""

    def __init__(self, report: LabelEditValidationResponse) -> None:
        super().__init__("Label edit validation failed")
        self.report = report


SCOPE_PATTERN = re.compile(r"^(stage1|relation:[A-Za-z0-9_-]+|verification:[A-Za-z0-9_-]+|candidate:[A-Za-z0-9_-]+)$")
SAFE_TAG_PATTERN = re.compile(r"^[\w\u4e00-\u9fff\s\-_/().,:#]+$")
MAX_SHORT_TEXT_LENGTH = 256
MAX_LONG_TEXT_LENGTH = 2000
OPEN_TAG_MAX_LENGTH = 64

STAGE1_FIELDS = {"environment_analysis", "scene_elements", "key_anchors"}
RELATION_FIELDS = {"subject", "relation", "object", "description", "bbox"}
VERIFICATION_FIELDS = {
    "subject",
    "relation",
    "object",
    "bbox",
    "visibility_level",
    "information_loss_type",
    "bbox_observation",
    "global_context_observation",
    "verification_result",
    "verification_confidence",
}
CANDIDATE_FIELDS = {
    "violation_category",
    "evidence_relations",
    "evidence_relation_indices",
    "evidence_reasoning",
    "relation_hint",
    "segmentation_targets",
    "confidence",
    "sample_category",
}


class FixtureRuntimeService:
    """In-memory runtime service over deterministic fixture samples."""

    def __init__(
        self,
        dataset_root: Path,
        sample_ids: Sequence[str] | None,
        dataset_id: str = "urban_violation",
        label_config_repo: InMemoryLabelConfigRepository | None = None,
    ) -> None:
        self._dataset_root = dataset_root.resolve()
        self._dataset_id = dataset_id
        self._label_config_repo = label_config_repo or InMemoryLabelConfigRepository()
        self._bundle = import_fixture_samples(dataset_root=self._dataset_root, sample_ids=sample_ids)
        self._samples: dict[str, FixtureSample] = {
            sample.sample_id: sample for sample in self._bundle.samples
        }
        self._import_job: ImportJob = self._bundle.import_job
        self._reviews: dict[str, list[HumanReview]] = {sample_id: [] for sample_id in self._samples}
        self._label_edits: dict[str, list[LabelEditState]] = {
            sample_id: [] for sample_id in self._samples
        }
        self._review_counter = 0
        self._label_edit_counter = 0
        self._updated_at = datetime.now(timezone.utc)

        stage1_entries = read_stage1_manifest(self._dataset_root)
        stage2_entries = read_stage2_manifest(self._dataset_root)
        self._pairs = {
            pair.sample_id: pair
            for pair in pair_stage_samples(
                stage1_entries,
                stage2_entries,
                sample_ids=list(self._samples.keys()),
            )
        }

        self._image_dir = self._dataset_root / "images"
        self._visualizations_dir = self._dataset_root / "stage1_run_0508" / "visualizations"

    @property
    def dataset_id(self) -> str:
        """Return configured dataset id."""
        return self._dataset_id

    def _require_dataset(self, dataset_id: str) -> None:
        if dataset_id != self._dataset_id:
            raise DatasetNotFoundError(f"Dataset not found: {dataset_id}")

    def _require_sample(self, dataset_id: str, sample_id: str) -> FixtureSample:
        self._require_dataset(dataset_id)
        sample = self._samples.get(sample_id)
        if sample is None:
            raise SampleNotFoundError(f"Sample not found: {sample_id}")
        return sample

    def _build_asset_item(self, sample: FixtureSample) -> AssetListItem:
        reviews = self._reviews[sample.sample_id]
        qc_status = "reviewed" if reviews else "pending"

        categories: list[str] = []
        sample_categories: list[str] = []
        confidences: list[float] = []
        stage2_status = "failure"
        if sample.stage2 is not None:
            stage2_status = "success"
            categories = sorted({cat for c in sample.stage2.candidates for cat in c.violation_category})
            sample_categories = sorted({c.sample_category for c in sample.stage2.candidates})
            confidences = [candidate.confidence for candidate in sample.stage2.candidates]

        return AssetListItem(
            asset_id=sample.raw_asset.asset_id,
            sample_id=sample.sample_id,
            image_url=sample.raw_asset.image_url,
            width=sample.raw_asset.width,
            height=sample.raw_asset.height,
            judge_decision=sample.stage1.judge_decision,
            stage2_status=stage2_status,
            violation_categories=categories,
            sample_categories=sample_categories,
            qc_status=qc_status,
            candidate_count=len(sample.stage2.candidates) if sample.stage2 is not None else 0,
            highest_confidence=max(confidences) if confidences else None,
            updated_at=(reviews[-1].created_at if reviews else self._updated_at),
        )

    def _distribution(self, counter: Counter[str], denominator: int | None = None) -> list[CountDistributionItem]:
        total = denominator if denominator is not None else sum(counter.values())
        return [
            CountDistributionItem(
                key=key,
                label=key,
                count=count,
                ratio=(count / total if total else 0.0),
            )
            for key, count in sorted(counter.items(), key=lambda item: (-item[1], item[0]))
        ]

    def list_datasets(self) -> list[DatasetSummaryResponse]:
        """Return available datasets (single fixture dataset in P0)."""
        return [self.get_dataset_summary(self._dataset_id)]

    def get_dataset_summary(self, dataset_id: str) -> DatasetSummaryResponse:
        """Return aggregate dataset counters."""
        self._require_dataset(dataset_id)
        reviewed_count = sum(1 for history in self._reviews.values() if history)
        dataset = self._bundle.dataset
        judge_counter: Counter[str] = Counter()
        category_counter: Counter[str] = Counter()
        verification_counter: Counter[str] = Counter()
        confidence_counter: Counter[str] = Counter()
        visibility_counter: Counter[str] = Counter()
        sample_category_counter: Counter[str] = Counter()
        fact_verification_count = 0
        candidate_count = 0

        for sample in self._samples.values():
            judge_counter[sample.stage1.judge_decision] += 1
            if sample.stage2 is None:
                continue
            fact_verification_count += len(sample.stage2.fact_verifications)
            candidate_count += len(sample.stage2.candidates)
            for verification in sample.stage2.fact_verifications:
                verification_counter[verification.verification_result] += 1
                visibility_counter[verification.visibility_level] += 1
            for candidate in sample.stage2.candidates:
                sample_category_counter[candidate.sample_category] += 1
                if candidate.confidence >= 0.9:
                    confidence_counter[">=0.90"] += 1
                elif candidate.confidence >= 0.75:
                    confidence_counter["0.75-0.89"] += 1
                else:
                    confidence_counter["<0.75"] += 1
                for category in candidate.violation_category:
                    category_counter[category] += 1

        return DatasetSummaryResponse(
            dataset_id=dataset.dataset_id,
            name=dataset.name,
            total_assets=dataset.total_assets,
            stage1_count=dataset.stage1_count,
            stage2_success_count=dataset.stage2_success_count,
            stage2_failure_count=dataset.stage2_failure_count,
            reviewed_count=reviewed_count,
            created_at=dataset.created_at,
            fact_verification_count=fact_verification_count,
            candidate_count=candidate_count,
            judge_decision_distribution=self._distribution(judge_counter, dataset.total_assets),
            category_distribution=self._distribution(category_counter),
            verification_distribution=self._distribution(verification_counter, fact_verification_count),
            confidence_distribution=self._distribution(confidence_counter, candidate_count),
            visibility_distribution=self._distribution(visibility_counter, fact_verification_count),
            sample_category_distribution=self._distribution(sample_category_counter, candidate_count),
        )

    def validate_label_config(
        self,
        dataset_id: str,
        request: LabelConfigValidateRequest,
    ) -> LabelConfigValidationReport:
        """Validate one uploaded label config without persisting it."""
        self._require_dataset(dataset_id)
        report, _ = validate_label_config(dataset_id=dataset_id, payload=request.config)
        return report

    def save_label_config(
        self,
        dataset_id: str,
        request: LabelConfigSaveRequest,
    ) -> StoredLabelConfig:
        """Validate and save one uploaded label config version."""
        self._require_dataset(dataset_id)
        report, config = validate_label_config(dataset_id=dataset_id, payload=request.config)
        if not report.valid or config is None:
            raise LabelConfigValidationFailedError(report)

        return self._label_config_repo.save(
            dataset_id=dataset_id,
            file_name=request.file_name,
            report=report,
            config=config,
            activate=request.activate,
        )

    def activate_label_config(self, dataset_id: str, config_id: str) -> StoredLabelConfig:
        """Activate a previously saved label config version."""
        self._require_dataset(dataset_id)
        try:
            return self._label_config_repo.activate(dataset_id=dataset_id, config_id=config_id)
        except LabelConfigVersionNotFoundError as exc:
            raise LabelConfigVersionAccessError(str(exc)) from exc

    def get_active_label_config(self, dataset_id: str) -> StoredLabelConfig:
        """Return the currently active label config for one dataset."""
        self._require_dataset(dataset_id)
        try:
            return self._label_config_repo.get_active(dataset_id=dataset_id)
        except ActiveLabelConfigNotFoundError as exc:
            raise ActiveLabelConfigAccessError(str(exc)) from exc

    def get_label_suggestions(
        self,
        dataset_id: str,
        field: str,
        query: str = "",
    ) -> LabelSuggestionResponse:
        """Return filtered options from the active label config only."""
        self._require_dataset(dataset_id)
        try:
            active = self._label_config_repo.get_active(dataset_id=dataset_id)
        except ActiveLabelConfigNotFoundError as exc:
            raise ActiveLabelConfigAccessError(str(exc)) from exc
        try:
            return filter_label_suggestions(
                active.config,
                dataset_id=dataset_id,
                field_name=field,
                query=query,
            )
        except LabelFieldNotFoundError as exc:
            raise LabelFieldAccessError(str(exc)) from exc

    def _build_label_field_map(self, config: DatasetLabelConfig) -> dict[str, LabelFieldConfig]:
        return {field.field: field for field in config.fields}

    def _validate_text_value(
        self,
        value: Any,
        *,
        max_length: int,
        required: bool,
        field_path: str,
    ) -> str | None:
        if not isinstance(value, str):
            return f"{field_path} must be a string"
        trimmed = value.strip()
        if required and not trimmed:
            return f"{field_path} cannot be empty"
        if len(trimmed) > max_length:
            return f"{field_path} exceeds max length {max_length}"
        if any(ch in trimmed for ch in "<>{}`$"):
            return f"{field_path} contains unsafe characters"
        if any(ord(ch) < 32 and ch not in "\t\n\r" for ch in trimmed):
            return f"{field_path} contains control characters"
        return None

    def _validate_open_tags(
        self,
        field_name: str,
        value: Any,
        field_map: dict[str, LabelFieldConfig],
    ) -> str | None:
        if not isinstance(value, list):
            return f"{field_name} must be an array of strings"
        if any(not isinstance(item, str) for item in value):
            return f"{field_name} must contain only strings"

        normalized_seen: set[str] = set()
        for tag in value:
            normalized = tag.strip()
            if not normalized:
                return f"{field_name} cannot contain empty tags"
            if len(normalized) > OPEN_TAG_MAX_LENGTH:
                return f"{field_name} tag exceeds max length {OPEN_TAG_MAX_LENGTH}"
            if not SAFE_TAG_PATTERN.match(normalized):
                return f"{field_name} tag contains unsupported characters"
            lowered = normalized.casefold()
            if lowered in normalized_seen:
                return f"{field_name} contains duplicate tags after normalization"
            normalized_seen.add(lowered)

        field_config = field_map.get(field_name)
        if field_config and field_config.mode != "open_tags":
            return f"{field_name} must be configured as open_tags"
        return None

    def _validate_closed_enum(
        self,
        field_name: str,
        value: Any,
        field_map: dict[str, LabelFieldConfig],
    ) -> str | None:
        field_config = field_map.get(field_name)
        if field_config is None:
            return f"{field_name} is missing in active label config"
        if field_config.mode != "closed_enum":
            return f"{field_name} must be configured as closed_enum"

        allowed_codes = {option.code for option in field_config.options}
        if isinstance(value, str):
            if not value.strip():
                return f"{field_name} cannot be empty"
            if value not in allowed_codes:
                return f"{field_name} must match active label config options"
            return None
        if isinstance(value, list):
            if not value:
                return f"{field_name} cannot be empty"
            if any(not isinstance(item, str) or not item.strip() for item in value):
                return f"{field_name} must contain non-empty string values"
            invalid_values = [item for item in value if item not in allowed_codes]
            if invalid_values:
                return f"{field_name} contains invalid enum values: {', '.join(sorted(set(invalid_values)))}"
            return None
        return f"{field_name} must be a string or string array"

    def _validate_bbox(self, value: Any, field_name: str) -> str | None:
        if not isinstance(value, list) or len(value) != 4:
            return f"{field_name} must be [x1, y1, x2, y2]"
        if any(not isinstance(item, int) for item in value):
            return f"{field_name} coordinates must be integers"
        x1, y1, x2, y2 = value
        if min(value) < 0 or max(value) > 1000:
            return f"{field_name} coordinates must stay in [0, 1000]"
        if x1 >= x2 or y1 >= y2:
            return f"{field_name} must satisfy x1 < x2 and y1 < y2"
        return None

    def _validate_confidence(self, value: Any, field_name: str) -> str | None:
        if not isinstance(value, (int, float)):
            return f"{field_name} must be a number in [0, 1]"
        numeric = float(value)
        if numeric < 0.0 or numeric > 1.0:
            return f"{field_name} must be in [0, 1]"
        return None

    def _validate_scope_field_pair(self, scope: str, field: str) -> str | None:
        if not SCOPE_PATTERN.match(scope):
            return (
                "scope must be one of stage1, relation:R*, verification:R*, candidate:C*"
            )
        if scope == "stage1" and field not in STAGE1_FIELDS:
            return f"Unsupported stage1 field: {field}"
        if scope.startswith("relation:") and field not in RELATION_FIELDS:
            return f"Unsupported relation field: {field}"
        if scope.startswith("verification:") and field not in VERIFICATION_FIELDS:
            return f"Unsupported verification field: {field}"
        if scope.startswith("candidate:") and field not in CANDIDATE_FIELDS:
            return f"Unsupported candidate field: {field}"
        return None

    def _validate_tag_payload(self, field_name: str, tag_payload: dict[str, Any] | None) -> str | None:
        if tag_payload is None:
            return None
        if not isinstance(tag_payload, dict):
            return f"{field_name}.tag_payload must be an object"
        for key in ("raw_text", "normalized_text"):
            if key in tag_payload:
                message = self._validate_text_value(
                    tag_payload[key],
                    max_length=OPEN_TAG_MAX_LENGTH,
                    required=True,
                    field_path=f"{field_name}.tag_payload.{key}",
                )
                if message:
                    return message
        return None

    def validate_label_edits(
        self,
        dataset_id: str,
        sample_id: str,
        request: LabelEditValidateRequest,
    ) -> LabelEditValidationResponse:
        """Validate label-edit patch payload with field-level checks only."""
        self._require_sample(dataset_id, sample_id)
        active_config = self.get_active_label_config(dataset_id)
        field_map = self._build_label_field_map(active_config.config)
        errors: list[LabelEditValidationIssue] = []

        for index, operation in enumerate(request.operations):
            scope = operation.scope
            field = operation.field

            scope_error = self._validate_scope_field_pair(scope, field)
            if scope_error:
                errors.append(
                    LabelEditValidationIssue(
                        operation_index=index,
                        scope=scope,
                        field=field,
                        code="invalid_scope_or_field",
                        message=scope_error,
                    )
                )
                continue

            tag_payload_error = self._validate_tag_payload(field, operation.tag_payload)
            if tag_payload_error:
                errors.append(
                    LabelEditValidationIssue(
                        operation_index=index,
                        scope=scope,
                        field=field,
                        code="invalid_tag_payload",
                        message=tag_payload_error,
                    )
                )
                continue

            after_value = operation.after
            validation_error: str | None = None
            if field in {"environment_analysis", "description", "bbox_observation", "global_context_observation", "evidence_reasoning", "relation_hint"}:
                validation_error = self._validate_text_value(
                    after_value,
                    max_length=MAX_LONG_TEXT_LENGTH,
                    required=False,
                    field_path=field,
                )
            elif field in {"subject", "object"}:
                validation_error = self._validate_text_value(
                    after_value,
                    max_length=MAX_SHORT_TEXT_LENGTH,
                    required=True,
                    field_path=field,
                )
            elif field in {"scene_elements", "segmentation_targets", "key_anchors"}:
                validation_error = self._validate_open_tags(field, after_value, field_map)
            elif field in {"relation", "visibility_level", "verification_result", "violation_category", "sample_category", "information_loss_type"}:
                validation_error = self._validate_closed_enum(field, after_value, field_map)
            elif field == "bbox":
                validation_error = self._validate_bbox(after_value, field)
            elif field in {"confidence", "verification_confidence"}:
                validation_error = self._validate_confidence(after_value, field)
            elif field in {"evidence_relations", "evidence_relation_indices"}:
                if not isinstance(after_value, list):
                    validation_error = f"{field} must be an array"
                elif field == "evidence_relations":
                    if any(not isinstance(item, str) or not item.strip() for item in after_value):
                        validation_error = "evidence_relations must contain non-empty relation ids"
                else:
                    if any(not isinstance(item, int) or item < 0 for item in after_value):
                        validation_error = "evidence_relation_indices must contain non-negative integers"

            if validation_error:
                errors.append(
                    LabelEditValidationIssue(
                        operation_index=index,
                        scope=scope,
                        field=field,
                        code="invalid_field_value",
                        message=validation_error,
                    )
                )

        return LabelEditValidationResponse(
            valid=(len(errors) == 0),
            dataset_id=dataset_id,
            sample_id=sample_id,
            checked_operation_count=len(request.operations),
            errors=errors,
            warnings=[],
        )

    def submit_label_edits(
        self,
        dataset_id: str,
        sample_id: str,
        request: LabelEditSubmitRequest,
    ) -> LabelEditSubmitResponse:
        """Save reviewDraft patch as draft or submitted label-edit state."""
        self._require_sample(dataset_id, sample_id)

        validation: LabelEditValidationResponse | None = None
        if request.submit_action == "submit_changes":
            validation = self.validate_label_edits(
                dataset_id=dataset_id,
                sample_id=sample_id,
                request=LabelEditValidateRequest(
                    task_mode=request.task_mode,
                    label_config_id=request.label_config_id,
                    label_config_version=request.label_config_version,
                    operations=request.operations,
                ),
            )
            if not validation.valid:
                raise LabelEditValidationFailedError(validation)
            task_status = "annotation_submitted"
        else:
            task_status = "annotation_draft"

        if request.task_status is not None and request.task_status != task_status:
            raise ValueError(
                f"task_status mismatch for {request.submit_action}: expected {task_status}, got {request.task_status}"
            )

        self._label_edit_counter += 1
        state = LabelEditState(
            edit_id=f"label-edit-{self._label_edit_counter}",
            dataset_id=dataset_id,
            sample_id=sample_id,
            task_mode=request.task_mode,
            submit_action=request.submit_action,
            task_status=task_status,
            label_config_id=request.label_config_id,
            label_config_version=request.label_config_version,
            operations=request.operations,
            updated_at=datetime.now(timezone.utc),
        )
        self._label_edits[sample_id].append(state)
        return LabelEditSubmitResponse(saved=True, state=state, validation=validation)

    def list_assets(
        self,
        dataset_id: str,
        category: str | None = None,
        judge_decision: str | None = None,
        qc_status: str | None = None,
        failure_status: str | None = None,
        sample_category: str | None = None,
    ) -> AssetListResponse:
        """List assets with query filter support."""
        self._require_dataset(dataset_id)

        items = [self._build_asset_item(sample) for sample in self._samples.values()]

        if category:
            items = [item for item in items if category in item.violation_categories]
        if judge_decision:
            items = [item for item in items if item.judge_decision == judge_decision]
        if qc_status:
            items = [item for item in items if item.qc_status == qc_status]
        if failure_status:
            if failure_status == "failed":
                items = [item for item in items if item.stage2_status == "failure"]
            elif failure_status == "success":
                items = [item for item in items if item.stage2_status == "success"]
        if sample_category:
            items = [item for item in items if sample_category in item.sample_categories]

        items.sort(key=lambda item: item.sample_id)
        return AssetListResponse(dataset_id=dataset_id, total=len(items), items=items)

    def get_asset_detail(self, dataset_id: str, sample_id: str) -> AssetDetailResponse:
        """Return detailed sample view including stage outputs and review history."""
        sample = self._require_sample(dataset_id, sample_id)
        reviews = self._reviews[sample_id]
        label_edits = self._label_edits[sample_id]
        latest_review = reviews[-1] if reviews else None
        latest_label_edit = label_edits[-1] if label_edits else None
        return AssetDetailResponse(
            dataset_id=dataset_id,
            sample_id=sample_id,
            asset=self._build_asset_item(sample),
            stage1=sample.stage1,
            stage2=sample.stage2,
            stage2_failure=sample.stage2_failure,
            label_edit_state=latest_label_edit,
            label_edit_history=label_edits,
            latest_review=latest_review,
            review_history=reviews,
        )

    def submit_review(
        self,
        dataset_id: str,
        sample_id: str,
        request: ReviewSubmitRequest,
    ) -> HumanReview:
        """Persist one review decision in the local in-memory fixture session."""
        self._require_sample(dataset_id, sample_id)
        self._review_counter += 1
        review = HumanReview(
            review_id=f"review-{self._review_counter}",
            sample_id=sample_id,
            reviewer=request.reviewer,
            decision=request.decision,
            notes=request.notes,
            corrected_categories=request.corrected_categories,
            corrected_bboxes=request.corrected_bboxes,
            created_at=datetime.now(timezone.utc),
        )
        self._reviews[sample_id].append(review)
        return review

    def get_import_job(self, dataset_id: str, job_id: str) -> ImportJobStatusResponse:
        """Fetch status for the fixture import job."""
        self._require_dataset(dataset_id)
        if job_id != self._import_job.job_id:
            raise ImportJobNotFoundError(f"Import job not found: {job_id}")
        stage2_success_count = sum(1 for sample in self._samples.values() if sample.stage2 is not None)
        return ImportJobStatusResponse(
            **self._import_job.model_dump(),
            stage2_success_count=stage2_success_count,
            validation_rows=self._build_validation_rows(),
            mapping_steps=[
                ImportMappingStep(id="raw", label="Raw assets", count=len(self._samples), entity="RawAsset"),
                ImportMappingStep(id="stage1", label="Stage1 records", count=len(self._samples), entity="PreAnnotationStep1"),
                ImportMappingStep(id="stage2", label="Stage2 records", count=stage2_success_count, entity="PreAnnotationStep2"),
                ImportMappingStep(
                    id="failures",
                    label="Stage2 failures",
                    count=self._import_job.failure_count,
                    entity="PreAnnotationFailure",
                ),
            ],
        )

    def _build_validation_rows(self) -> list[ImportValidationRow]:
        """Build manifest pairing rows for the import validation page."""
        rows: list[ImportValidationRow] = []
        for sample in sorted(self._samples.values(), key=lambda value: value.sample_id):
            pair = self._pairs[sample.sample_id]
            image_name = Path(sample.raw_asset.source_image_path_internal).name
            stage2_path: str | None = None
            failure_path: str | None = None
            status = "stage2_missing"
            if pair.stage2 is not None and hasattr(pair.stage2, "parsed_path"):
                stage2_path = f"stage2_run_0508/{pair.stage2.parsed_path}"
                status = "ready"
            elif pair.stage2 is not None and hasattr(pair.stage2, "failure_path"):
                failure_path = f"stage2_run_0508/{pair.stage2.failure_path}"
                status = "stage2_failed"
            rows.append(
                ImportValidationRow(
                    sample_id=sample.sample_id,
                    image_path=f"images/{image_name}",
                    stage1_path=f"stage1_run_0508/{pair.stage1.parsed_path}",
                    stage2_path=stage2_path,
                    failure_path=failure_path,
                    status=status,
                )
            )
        return rows

    def list_qc_queue(self, dataset_id: str) -> QCQueueResponse:
        """Return QC queue built from loaded fixture samples."""
        self._require_dataset(dataset_id)
        items: list[QCQueueItem] = []
        for sample in sorted(self._samples.values(), key=lambda value: value.sample_id):
            asset = self._build_asset_item(sample)
            items.append(
                QCQueueItem(
                    sample_id=sample.sample_id,
                    asset_id=sample.raw_asset.asset_id,
                    judge_decision=sample.stage1.judge_decision,
                    stage2_status="success" if sample.stage2 is not None else "failure",
                    qc_status="reviewed" if self._reviews[sample.sample_id] else "pending",
                    primary_category=asset.violation_categories[0] if asset.violation_categories else "",
                    highest_confidence=asset.highest_confidence,
                    stage2_failure=sample.stage2 is None,
                    updated_at=asset.updated_at,
                )
            )
        return QCQueueResponse(dataset_id=dataset_id, total=len(items), items=items)

    def search(self, dataset_id: str, query: str) -> SearchResponse:
        """Search fixture data across sample IDs, categories, relations, and reasoning text."""
        self._require_dataset(dataset_id)
        q = query.strip().lower()
        if not q:
            return SearchResponse(dataset_id=dataset_id, query=query, total=0, items=[])

        results: list[SearchResultItem] = []
        for sample in self._samples.values():
            matched_in: list[str] = []
            if q in sample.sample_id.lower():
                matched_in.append("sample_id")

            for relation in sample.stage1.key_relations:
                if q in relation.description.lower() or q in relation.subject.lower() or q in relation.object.lower():
                    matched_in.append("stage1_relation")
                    break

            if sample.stage2 is not None:
                for candidate in sample.stage2.candidates:
                    if any(q in category.lower() for category in candidate.violation_category):
                        matched_in.append("stage2_category")
                        break
                    if q in candidate.evidence_reasoning.lower():
                        matched_in.append("stage2_reasoning")
                        break

            if matched_in:
                results.append(
                    SearchResultItem(
                        sample_id=sample.sample_id,
                        image_url=sample.raw_asset.image_url,
                        judge_decision=sample.stage1.judge_decision,
                        stage2_status="success" if sample.stage2 is not None else "failure",
                        matched_in=sorted(set(matched_in)),
                    )
                )

        results.sort(key=lambda item: item.sample_id)
        return SearchResponse(dataset_id=dataset_id, query=query, total=len(results), items=results)

    def create_export(self, dataset_id: str, sample_ids: Sequence[str] | None = None) -> ExportResponse:
        """Create a lightweight export job payload for selected fixture samples."""
        self._require_dataset(dataset_id)

        if sample_ids:
            unknown_ids = sorted({sample_id for sample_id in sample_ids if sample_id not in self._samples})
            if unknown_ids:
                raise SampleNotFoundError(f"Unknown sample IDs in export request: {', '.join(unknown_ids)}")
            selected_ids = sorted(set(sample_ids))
        else:
            selected_ids = sorted(self._samples.keys())

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        return ExportResponse(
            dataset_id=dataset_id,
            export_job_id=f"export-{timestamp}",
            sample_count=len(selected_ids),
            sample_ids=selected_ids,
        )

    def resolve_media_file(self, media_kind: str, file_name: str) -> Path:
        """Resolve a requested media file path with traversal-safe constraints."""
        if not file_name or Path(file_name).name != file_name:
            raise MediaAccessError("Invalid media filename")

        if media_kind == "images":
            root = self._image_dir
            candidate = root / file_name
        elif media_kind == "visualizations":
            root = self._visualizations_dir
            sample_id = Path(file_name).stem
            pair = self._pairs.get(sample_id)
            if pair is None:
                raise MediaAccessError("Unknown sample for visualization")
            shard = Path(pair.stage1.record_path).parent.name
            candidate = root / shard / file_name
        else:
            raise MediaAccessError(f"Unsupported media kind: {media_kind}")

        resolved_candidate = candidate.resolve(strict=False)
        resolved_root = root.resolve(strict=True)
        if resolved_root not in resolved_candidate.parents:
            raise MediaAccessError("Requested media path escapes dataset root")
        if not resolved_candidate.is_file():
            raise MediaAccessError("Media file not found")
        return resolved_candidate


DEFAULT_DATASET_ROOT = Path(
    "/mnt/lc/LC/ares_xtws/0_train_data/data_platform/DATASET/urban_violation"
)
DEFAULT_FIXTURE_SAMPLE_IDS = (
    "000142_0_1762483003246",
    "001710_0_1763108687181",
)


def build_fixture_service(
    dataset_root: Path = DEFAULT_DATASET_ROOT,
    sample_ids: Sequence[str] | None = None,
) -> FixtureRuntimeService:
    """Factory for runtime service with deterministic defaults."""
    return FixtureRuntimeService(dataset_root=dataset_root, sample_ids=sample_ids)

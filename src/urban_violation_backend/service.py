"""Fixture-backed runtime service layer for FastAPI routes."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import re
from typing import Any, Sequence

from fastapi import Request

from urban_violation_backend.auth import AuthContext, AuthService
from urban_violation_backend.api_schemas import (
    AuditEventResponse,
    AssetDetailResponse,
    AssetListItem,
    AssetListResponse,
    AssetSummaryMetrics,
    AssetSummaryResponse,
    BatchAssignmentActionRequest,
    BatchAssignmentRequest,
    BatchQcAssignmentResponse,
    CountDistributionItem,
    CurrentUserResponse,
    DatasetTypeCreateRequest,
    DatasetTypeResponse,
    DatasetSummaryResponse,
    ExportResponse,
    ImportJobCreateRequest,
    ImportMappingStep,
    ImportJobStatusResponse,
    ImportValidationRow,
    LabelEditState,
    LabelEditSubmissionResponse,
    LabelEditOperation,
    LabelEditSubmitRequest,
    LabelEditSubmitResponse,
    LabelEditValidateRequest,
    LabelEditValidationIssue,
    LabelEditValidationResponse,
    LabelEditDraftResponse,
    LabelConfigSaveRequest,
    LabelConfigValidateRequest,
    LeaseAcquireResponse,
    QCQueueItem,
    QCQueueResponse,
    QcProgressByStatus,
    QcProgressByUser,
    QcProgressResponse,
    QcTaskResponse,
    ReviewSubmitRequest,
    SampleLeaseResponse,
    SearchResponse,
    SearchResultItem,
    UserAccountCreateRequest,
    UserAccountPatchRequest,
    UserAccountResponse,
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    RoleBindingCreateRequest,
)
from urban_violation_backend.errors import ApiError, conflict, forbidden
from urban_violation_backend.importer.parser import (
    FixtureSample,
    PairedSample,
    discover_stage_run_dir,
    import_fixture_samples,
    normalize_media_url,
    pair_stage_samples,
    read_stage1_manifest,
    read_stage2_manifest,
)
from urban_violation_backend.labels import (
    ActiveLabelConfigNotFoundError,
    DatasetLabelConfig,
    FileBackedLabelConfigRepository,
    InMemoryLabelConfigRepository,
    LabelConfigPersistenceError,
    LabelFieldNotFoundError,
    LabelFieldConfig,
    LabelConfigValidationReport,
    LabelConfigVersionNotFoundError,
    LabelSuggestionResponse,
    StoredLabelConfig,
    filter_label_suggestions,
    validate_label_config,
)
from urban_violation_backend.permissions import PermissionEvaluator
from urban_violation_backend.schemas import (
    AuditEvent,
    BatchAssignmentStatus,
    BatchQcAssignment,
    DatasetLifecycleStatus,
    HumanReview,
    ImportJob,
    ImportJobState,
    LabelEditDraft,
    LabelEditSubmission,
    LeaseStatus,
    QcTask,
    QcTaskStatus,
    RawAsset,
    RoleBinding,
    RoleScopeType,
    SampleLease,
    Stage1Preannotation,
    UserAccount,
    UserRole,
    UserStatus,
)
from urban_violation_backend.state_store import PlatformStateStore


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


class LabelConfigPersistenceAccessError(ValueError):
    """Raised when persisted label config files cannot be reloaded safely."""


class LabelEditValidationFailedError(ValueError):
    """Raised when a submit_changes payload fails field-level validation."""

    def __init__(self, report: LabelEditValidationResponse) -> None:
        super().__init__("Label edit validation failed")
        self.report = report


@dataclass(slots=True)
class RegisteredBatchRuntime:
    """Loaded source-directory data for a manually created dataset batch."""

    dataset_id: str
    dataset_type: str
    batch_key: str
    root: Path
    image_dir: Path
    visualizations_dir: Path | None
    stage1_run_name: str | None
    stage2_run_name: str | None
    stage2_failure_artifact_count: int
    samples: dict[str, FixtureSample] = field(default_factory=dict)
    pairs: dict[str, PairedSample] = field(default_factory=dict)
    reviews: dict[str, list[HumanReview]] = field(default_factory=dict)
    label_edits: dict[str, list[LabelEditState]] = field(default_factory=dict)


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
    "candidate",
    "violation_category",
    "evidence_relations",
    "evidence_relation_indices",
    "evidence_reasoning",
    "relation_hint",
    "segmentation_targets",
    "confidence",
    "sample_category",
}
SUPPORTED_LABEL_EDIT_OPS = {
    "replace",
    "add_tag",
    "remove_tag",
    "soft_delete_relation",
    "add_relation",
    "delete_candidate",
}


class FixtureRuntimeService:
    """In-memory runtime service over deterministic fixture samples."""

    def __init__(
        self,
        dataset_root: Path,
        sample_ids: Sequence[str] | None,
        dataset_id: str = "urban_violation",
        label_config_repo: InMemoryLabelConfigRepository | None = None,
        label_config_store_root: Path | None = None,
        platform_state_root: Path | None = None,
    ) -> None:
        self._dataset_root = dataset_root.resolve()
        self._label_config_store_root = (
            label_config_store_root.resolve()
            if label_config_store_root is not None
            else self._dataset_root.parent.resolve()
        )
        self._dataset_type_registry_path = self._label_config_store_root / "dataset_types.json"
        self._batch_registry_path = self._label_config_store_root / "dataset_batches.json"
        self._dataset_type = dataset_id
        self._legacy_dataset_id = dataset_id
        self._batch_key = "0508_fixture"
        self._dataset_id = f"{self._dataset_type}__{self._batch_key}"
        self._accepted_dataset_ids = {self._dataset_id, self._legacy_dataset_id}
        self._field_schema_version = "2026-05-18"
        self._dataset_type_display_names: dict[str, str] = {
            self._dataset_type: "城市违规",
        }
        self._dataset_type_schema_versions: dict[str, str] = {
            self._dataset_type: self._field_schema_version,
        }
        self._load_dataset_type_registry()
        self._qc_queue_id = f"qcq_{self._dataset_type}_{self._batch_key}"
        self._label_config_repo = label_config_repo or FileBackedLabelConfigRepository(
            self._label_config_store_root
        )
        self._load_dataset_types_from_label_config_repo()
        self._bundle = import_fixture_samples(dataset_root=self._dataset_root, sample_ids=sample_ids)
        self._samples: dict[str, FixtureSample] = {
            sample.sample_id: sample for sample in self._bundle.samples
        }
        self._import_job_counter = 0
        fixture_import_job = self._bundle.import_job.model_copy(
            update={
                "dataset_id": self._dataset_id,
                "dataset_type": self._dataset_type,
                "batch_key": self._batch_key,
                "warnings": [],
            }
        )
        self._import_jobs: dict[str, ImportJob] = {fixture_import_job.job_id: fixture_import_job}
        self._registered_batches: dict[str, DatasetSummaryResponse] = {}
        self._import_job = fixture_import_job
        self._active_import_job_id = fixture_import_job.job_id
        self._reviews: dict[str, list[HumanReview]] = {sample_id: [] for sample_id in self._samples}
        self._label_edits: dict[str, list[LabelEditState]] = {
            sample_id: [] for sample_id in self._samples
        }
        self._review_counter = 0
        self._label_edit_counter = 0
        self._updated_at = datetime.now(timezone.utc)
        self._registered_batch_runtimes: dict[str, RegisteredBatchRuntime] = {}
        self._load_registered_batches()
        self._lifecycle_status = self._derive_lifecycle_status()

        self._stage1_run_dir = discover_stage_run_dir(self._dataset_root, "stage1")
        self._stage2_run_dir = discover_stage_run_dir(self._dataset_root, "stage2")
        stage1_entries = read_stage1_manifest(self._dataset_root, stage1_run_dir=self._stage1_run_dir)
        stage2_entries = read_stage2_manifest(self._dataset_root, stage2_run_dir=self._stage2_run_dir)
        self._pairs = {
            pair.sample_id: pair
            for pair in pair_stage_samples(
                stage1_entries,
                stage2_entries,
                sample_ids=list(self._samples.keys()),
            )
        }

        self._image_dir = self._dataset_root / "images"
        self._visualizations_dir = self._stage1_run_dir / "visualizations"

        env_state_root = os.environ.get("PLATFORM_STATE_ROOT")
        self._platform_state_root = (
            platform_state_root.resolve()
            if platform_state_root is not None
            else (
                Path(env_state_root).resolve()
                if env_state_root
                else (self._label_config_store_root / "platform_state").resolve()
            )
        )
        self._state_store = PlatformStateStore(self._platform_state_root)
        self._auth_service = AuthService(
            store=self._state_store,
            settings=AuthService.default_settings(),
        )
        self._auth_service.ensure_bootstrap_admin()
        self._ensure_qc_tasks()

    def _load_dataset_type_registry(self) -> None:
        if not self._dataset_type_registry_path.is_file():
            return
        payload = json.loads(self._dataset_type_registry_path.read_text(encoding="utf-8"))
        items = payload.get("dataset_types", []) if isinstance(payload, dict) else []
        for item in items:
            if not isinstance(item, dict):
                continue
            dataset_type = item.get("dataset_type")
            display_name = item.get("display_name")
            if not isinstance(dataset_type, str) or not dataset_type:
                continue
            self._dataset_type_display_names[dataset_type] = (
                display_name if isinstance(display_name, str) and display_name else dataset_type
            )
            field_schema_version = item.get("field_schema_version")
            self._dataset_type_schema_versions[dataset_type] = (
                field_schema_version
                if isinstance(field_schema_version, str) and field_schema_version
                else "draft"
            )

    def _load_dataset_types_from_label_config_repo(self) -> None:
        for dataset_type in self._label_config_repo.list_dataset_ids():
            self._dataset_type_display_names.setdefault(dataset_type, dataset_type)
            self._dataset_type_schema_versions.setdefault(dataset_type, "draft")

    def _persist_dataset_type_registry(self) -> None:
        self._label_config_store_root.mkdir(parents=True, exist_ok=True)
        items = [
            {
                "dataset_type": dataset_type,
                "display_name": self._dataset_type_display_names[dataset_type],
                "field_schema_version": self._dataset_type_schema_versions.get(dataset_type, "draft"),
                "status": "active",
            }
            for dataset_type in sorted(self._dataset_type_display_names)
        ]
        tmp_path = self._dataset_type_registry_path.with_suffix(".json.tmp")
        tmp_path.write_text(
            json.dumps({"dataset_types": items}, ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )
        tmp_path.replace(self._dataset_type_registry_path)

    def _load_registered_batches(self) -> None:
        if not self._batch_registry_path.is_file():
            return
        payload = json.loads(self._batch_registry_path.read_text(encoding="utf-8"))
        items = payload.get("batches", []) if isinstance(payload, dict) else []
        for item in items:
            if not isinstance(item, dict):
                continue
            try:
                summary = DatasetSummaryResponse.model_validate(item.get("summary", item))
                job_payload = item.get("import_job")
                job = ImportJob.model_validate(job_payload) if isinstance(job_payload, dict) else None
            except ValueError:
                continue
            self._registered_batches[summary.dataset_id] = summary
            self._accepted_dataset_ids.add(summary.dataset_id)
            self._dataset_type_display_names.setdefault(summary.dataset_type, summary.display_name)
            self._dataset_type_schema_versions.setdefault(
                summary.dataset_type,
                summary.field_schema_version,
            )
            if job is not None:
                self._import_jobs[job.job_id] = job
                self._hydrate_registered_batch_runtime(summary=summary, job=job)

    def _persist_registered_batches(self) -> None:
        self._label_config_store_root.mkdir(parents=True, exist_ok=True)
        items: list[dict[str, Any]] = []
        for summary in sorted(self._registered_batches.values(), key=lambda item: item.dataset_id):
            job = (
                self._import_jobs.get(summary.active_import_job_id)
                if summary.active_import_job_id is not None
                else None
            )
            items.append(
                {
                    "summary": summary.model_dump(mode="json"),
                    "import_job": job.model_dump(mode="json") if job is not None else None,
                }
            )
        tmp_path = self._batch_registry_path.with_suffix(".json.tmp")
        tmp_path.write_text(
            json.dumps({"batches": items}, ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )
        tmp_path.replace(self._batch_registry_path)

    def _resolve_registered_source_root(self, source_uri: str | None) -> Path | None:
        """Resolve a manual batch source URI against common server-side roots."""
        if not source_uri:
            return None
        uri = source_uri.strip()
        if not uri:
            return None
        if uri.startswith("file://"):
            uri = uri.removeprefix("file://")

        raw_path = Path(uri).expanduser()
        candidates: list[Path]
        if raw_path.is_absolute():
            candidates = [raw_path]
        else:
            candidates = [
                Path.cwd() / raw_path,
                self._dataset_root.parent / raw_path,
            ]

        seen: set[Path] = set()
        for candidate in candidates:
            resolved = candidate.resolve(strict=False)
            if resolved in seen:
                continue
            seen.add(resolved)
            if resolved.is_dir():
                return resolved
        return None

    def _runtime_media_base_url(self, dataset_id: str) -> str:
        return f"/api/datasets/{dataset_id}/media/images"

    def _image_root_for_source(self, source_root: Path) -> Path:
        image_dir = source_root / "images"
        return image_dir if image_dir.is_dir() else source_root

    def _load_images_only_runtime(
        self,
        *,
        summary: DatasetSummaryResponse,
        source_root: Path,
    ) -> RegisteredBatchRuntime:
        image_dir = self._image_root_for_source(source_root)
        image_files = sorted(
            path
            for path in image_dir.rglob("*")
            if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
        )
        samples: dict[str, FixtureSample] = {}
        for image_path in image_files:
            sample_id = image_path.stem
            raw_asset = RawAsset(
                asset_id=sample_id,
                sample_id=sample_id,
                image_url=normalize_media_url(
                    str(image_path),
                    media_base_url=self._runtime_media_base_url(summary.dataset_id),
                ),
                width=1280,
                height=720,
                source_image_path_internal=str(image_path),
            )
            samples[sample_id] = FixtureSample(
                sample_id=sample_id,
                raw_asset=raw_asset,
                stage1=Stage1Preannotation(
                    sample_id=sample_id,
                    environment_analysis="",
                    scene_elements=[],
                    key_anchors=[],
                    key_relations=[],
                    judge_decision="unknown",
                ),
                stage2=None,
                stage2_failure=None,
            )
        return RegisteredBatchRuntime(
            dataset_id=summary.dataset_id,
            dataset_type=summary.dataset_type,
            batch_key=summary.batch_key,
            root=source_root,
            image_dir=image_dir,
            visualizations_dir=None,
            stage1_run_name=None,
            stage2_run_name=None,
            stage2_failure_artifact_count=0,
            samples=samples,
            reviews={sample_id: [] for sample_id in samples},
            label_edits={sample_id: [] for sample_id in samples},
        )

    def _load_preannotated_runtime(
        self,
        *,
        summary: DatasetSummaryResponse,
        source_root: Path,
    ) -> RegisteredBatchRuntime:
        stage1_run_dir = discover_stage_run_dir(source_root, "stage1")
        stage2_run_dir = discover_stage_run_dir(source_root, "stage2")
        bundle = import_fixture_samples(
            dataset_root=source_root,
            dataset_id=summary.dataset_id,
            dataset_type=summary.dataset_type,
            batch_key=summary.batch_key,
            name=summary.name,
            media_base_url=self._runtime_media_base_url(summary.dataset_id),
        )
        samples = {sample.sample_id: sample for sample in bundle.samples}
        stage1_entries = read_stage1_manifest(source_root, stage1_run_dir=stage1_run_dir)
        stage2_entries = read_stage2_manifest(source_root, stage2_run_dir=stage2_run_dir)
        pairs = {
            pair.sample_id: pair
            for pair in pair_stage_samples(
                stage1_entries,
                stage2_entries,
                sample_ids=list(samples.keys()),
            )
        }
        return RegisteredBatchRuntime(
            dataset_id=summary.dataset_id,
            dataset_type=summary.dataset_type,
            batch_key=summary.batch_key,
            root=source_root,
            image_dir=source_root / "images",
            visualizations_dir=stage1_run_dir / "visualizations",
            stage1_run_name=stage1_run_dir.name,
            stage2_run_name=stage2_run_dir.name,
            stage2_failure_artifact_count=bundle.dataset.stage2_failure_count,
            samples=samples,
            pairs=pairs,
            reviews={sample_id: [] for sample_id in samples},
            label_edits={sample_id: [] for sample_id in samples},
        )

    def _build_registered_batch_runtime(
        self,
        *,
        summary: DatasetSummaryResponse,
        job: ImportJob,
    ) -> RegisteredBatchRuntime | None:
        source_root = self._resolve_registered_source_root(job.source_uri or summary.source_uri)
        if source_root is None:
            return None
        if (job.source_structure or summary.source_structure) == "images_with_preannotations":
            return self._load_preannotated_runtime(summary=summary, source_root=source_root)
        return self._load_images_only_runtime(summary=summary, source_root=source_root)

    def _hydrate_registered_batch_runtime(
        self,
        *,
        summary: DatasetSummaryResponse,
        job: ImportJob,
    ) -> RegisteredBatchRuntime | None:
        try:
            runtime = self._build_registered_batch_runtime(summary=summary, job=job)
        except (FileNotFoundError, KeyError, ValueError, OSError):
            return None
        if runtime is not None:
            self._registered_batch_runtimes[summary.dataset_id] = runtime
        return runtime

    def _is_fixture_dataset(self, dataset_id: str) -> bool:
        return dataset_id in {self._dataset_id, self._legacy_dataset_id}

    def _job_belongs_to_dataset(self, dataset_id: str, job: ImportJob) -> bool:
        if self._is_fixture_dataset(dataset_id):
            return job.dataset_id == self._dataset_id
        if dataset_id in self._dataset_type_display_names:
            return job.dataset_type == dataset_id
        return job.dataset_id == dataset_id

    def _registered_batch_lifecycle(self, job: ImportJob) -> DatasetLifecycleStatus:
        if job.state in {ImportJobState.DRAFT, ImportJobState.UPLOADING, ImportJobState.UPLOADED}:
            return DatasetLifecycleStatus.REGISTERED
        if job.state in {ImportJobState.SCANNING, ImportJobState.VALIDATING}:
            return DatasetLifecycleStatus.SCANNING
        if job.state == ImportJobState.VALIDATION_FAILED:
            return DatasetLifecycleStatus.VALIDATION_FAILED
        if job.state in {ImportJobState.VALIDATION_PASSED, ImportJobState.PREVIEW_READY}:
            return DatasetLifecycleStatus.VALIDATED
        if job.state == ImportJobState.IMPORTED:
            if job.source_structure == "images_only":
                return DatasetLifecycleStatus.PREANNOTATION_PENDING
            try:
                self._label_config_repo.get_active(dataset_id=job.dataset_type)
            except ActiveLabelConfigNotFoundError:
                return DatasetLifecycleStatus.LABEL_CONFIG_REQUIRED
            tasks = self._state_store.list_tasks(job.dataset_id)
            if not tasks:
                return DatasetLifecycleStatus.PREANNOTATION_READY
            if all(task.status in {QcTaskStatus.COMPLETED, QcTaskStatus.CONFIRMED} for task in tasks):
                return DatasetLifecycleStatus.QC_COMPLETED
            if any(task.status != QcTaskStatus.QUEUED for task in tasks):
                return DatasetLifecycleStatus.QC_IN_PROGRESS
            return DatasetLifecycleStatus.QC_READY
        if job.state == ImportJobState.IMPORT_FAILED:
            return DatasetLifecycleStatus.IMPORT_FAILED
        return DatasetLifecycleStatus.REGISTERED

    def _update_registered_batch_from_job(self, job: ImportJob) -> None:
        summary = self._registered_batches.get(job.dataset_id)
        if summary is None:
            return
        runtime = self._registered_batch_runtimes.get(job.dataset_id)
        total_assets = job.image_count or job.expected_assets
        stage1_count = job.stage1_file_count
        stage2_success_count = job.stage2_file_count
        stage2_failure_count = job.stage2_failure_file_count or job.failure_count
        if runtime is not None:
            total_assets = len(runtime.samples)
            stage1_count = total_assets if runtime.stage1_run_name is not None else 0
            stage2_success_count = sum(
                1 for sample in runtime.samples.values() if sample.stage2 is not None
            )
            stage2_failure_count = runtime.stage2_failure_artifact_count
        updated = summary.model_copy(
            update={
                "lifecycle_status": self._registered_batch_lifecycle(job),
                "active_import_job_id": job.job_id,
                "total_assets": total_assets,
                "stage1_count": stage1_count,
                "stage2_success_count": stage2_success_count,
                "stage2_failure_count": stage2_failure_count,
                "active_label_config_version": self._current_active_label_config_version(job.dataset_type),
            }
        )
        self._registered_batches[job.dataset_id] = updated
        self._persist_registered_batches()

    @property
    def dataset_id(self) -> str:
        """Return legacy dataset id for backward-compatible health payload."""
        return self._legacy_dataset_id

    def _resolve_dataset_type(self, dataset_id: str) -> str:
        """Resolve dataset type from legacy or batch dataset id."""
        if dataset_id in self._dataset_type_display_names:
            return dataset_id
        if dataset_id in self._registered_batches:
            return self._registered_batches[dataset_id].dataset_type
        self._require_dataset(dataset_id)
        return self._dataset_type

    def _require_dataset_or_type(self, dataset_id: str) -> None:
        if dataset_id in self._dataset_type_display_names:
            return
        self._require_dataset(dataset_id)

    def _require_dataset(self, dataset_id: str) -> None:
        if dataset_id not in self._accepted_dataset_ids:
            raise DatasetNotFoundError(f"Dataset not found: {dataset_id}")

    def _current_active_label_config_version(self, dataset_type: str | None = None) -> int | None:
        """Return active label config version number for current dataset type."""
        try:
            active = self._label_config_repo.get_active(dataset_id=dataset_type or self._dataset_type)
        except ActiveLabelConfigNotFoundError:
            return None
        match = re.search(r"(\d+)$", active.version)
        return int(match.group(1)) if match else None

    def _has_active_label_config(self) -> bool:
        try:
            self._label_config_repo.get_active(dataset_id=self._dataset_type)
            return True
        except ActiveLabelConfigNotFoundError:
            return False

    def _derive_lifecycle_status(self) -> DatasetLifecycleStatus:
        """Derive batch lifecycle from latest import job and current review/config state."""
        latest_state = self._import_job.state
        if latest_state in {ImportJobState.DRAFT, ImportJobState.UPLOADING, ImportJobState.UPLOADED}:
            return DatasetLifecycleStatus.REGISTERED
        if latest_state in {ImportJobState.SCANNING, ImportJobState.VALIDATING}:
            return DatasetLifecycleStatus.SCANNING
        if latest_state == ImportJobState.VALIDATION_FAILED:
            return DatasetLifecycleStatus.VALIDATION_FAILED
        if latest_state in {ImportJobState.VALIDATION_PASSED, ImportJobState.PREVIEW_READY}:
            return DatasetLifecycleStatus.VALIDATED
        if latest_state == ImportJobState.IMPORTING:
            return DatasetLifecycleStatus.IMPORTING
        if latest_state == ImportJobState.IMPORT_FAILED:
            return DatasetLifecycleStatus.IMPORT_FAILED

        reviewed_total = sum(1 for history in self._reviews.values() if history)
        if reviewed_total >= len(self._samples) and len(self._samples) > 0:
            return DatasetLifecycleStatus.QC_COMPLETED
        if reviewed_total > 0:
            return DatasetLifecycleStatus.QC_IN_PROGRESS
        if not self._samples:
            return DatasetLifecycleStatus.PREANNOTATION_PENDING

        has_stage_payload = all(sample.stage1 is not None for sample in self._samples.values())
        if not has_stage_payload:
            return DatasetLifecycleStatus.PREANNOTATION_PENDING
        if not self._has_active_label_config():
            return DatasetLifecycleStatus.LABEL_CONFIG_REQUIRED
        return DatasetLifecycleStatus.QC_READY

    def _set_import_job(self, job: ImportJob) -> ImportJob:
        self._import_jobs[job.job_id] = job
        self._import_job = job
        self._active_import_job_id = job.job_id
        self._lifecycle_status = self._derive_lifecycle_status()
        return job

    def _build_stage2_warning_messages(self) -> list[str]:
        failure_count = self._bundle.dataset.stage2_failure_count
        if failure_count == 0:
            return []
        return [
            (
                f"Detected {failure_count} STEP2 failure artifacts; treated as non-blocking diagnostics "
                "and import can continue."
            )
        ]

    def _bind_label_config_to_dataset(
        self,
        stored: StoredLabelConfig,
        dataset_id: str,
    ) -> StoredLabelConfig:
        """Project type-scoped label config to a dataset-scoped response shape."""
        rebound_validation = stored.validation.model_copy(update={"dataset_id": dataset_id})
        return stored.model_copy(update={"dataset_id": dataset_id, "validation": rebound_validation})

    def _require_sample(self, dataset_id: str, sample_id: str) -> FixtureSample:
        self._require_dataset(dataset_id)
        if dataset_id in self._registered_batches:
            runtime = self._registered_batch_runtimes.get(dataset_id)
            if runtime is None:
                raise SampleNotFoundError(f"Sample not found: {sample_id}")
            sample = runtime.samples.get(sample_id)
            if sample is None:
                raise SampleNotFoundError(f"Sample not found: {sample_id}")
            return sample
        sample = self._samples.get(sample_id)
        if sample is None:
            raise SampleNotFoundError(f"Sample not found: {sample_id}")
        return sample

    def _effective_batch_dataset_id(self, dataset_id: str) -> str:
        """Return the concrete batch id used by state-store records."""
        self._require_dataset(dataset_id)
        if dataset_id in self._registered_batches:
            return dataset_id
        return self._dataset_id

    def _queue_id_for_dataset(self, dataset_id: str) -> str:
        if dataset_id in self._registered_batches:
            summary = self._registered_batches[dataset_id]
            return summary.qc_queue_id or f"qcq_{summary.dataset_type}_{summary.batch_key}"
        return self._qc_queue_id

    def _samples_for_dataset(self, dataset_id: str) -> dict[str, FixtureSample]:
        if dataset_id in self._registered_batches:
            runtime = self._registered_batch_runtimes.get(dataset_id)
            return runtime.samples if runtime is not None else {}
        return self._samples

    def _reviews_for_dataset(self, dataset_id: str) -> dict[str, list[HumanReview]]:
        runtime = self._registered_batch_runtimes.get(dataset_id)
        return runtime.reviews if runtime is not None else self._reviews

    def _label_edits_for_dataset(self, dataset_id: str) -> dict[str, list[LabelEditState]]:
        runtime = self._registered_batch_runtimes.get(dataset_id)
        return runtime.label_edits if runtime is not None else self._label_edits

    def _ensure_qc_tasks_for_dataset(self, dataset_id: str) -> list[QcTask]:
        """Create missing QC tasks for the concrete batch and return all tasks."""
        active_dataset_id = self._effective_batch_dataset_id(dataset_id)
        existing = self._state_store.list_tasks(active_dataset_id)
        existing_by_sample = {task.sample_id: task for task in existing}
        queue_id = self._queue_id_for_dataset(dataset_id)
        created: list[QcTask] = []
        for sample in sorted(self._samples_for_dataset(dataset_id).values(), key=lambda value: value.sample_id):
            if sample.sample_id in existing_by_sample:
                continue
            created.append(
                QcTask(
                    task_id=self._state_store.new_id("task"),
                    qc_queue_id=queue_id,
                    dataset_id=active_dataset_id,
                    sample_id=sample.sample_id,
                    status=QcTaskStatus.QUEUED,
                    assignee_user_id=None,
                    claimed_at=None,
                    submitted_at=None,
                    completed_at=None,
                    confirmed_by=None,
                    confirmed_at=None,
                    latest_submission_id=None,
                    label_config_id=None,
                    label_config_version=None,
                    task_revision=0,
                )
            )
        if created:
            existing = [*existing, *created]
            self._state_store.save_tasks(active_dataset_id, existing)
        return existing

    def generate_qc_queue(self, dataset_id: str, *, context: AuthContext) -> QCQueueResponse:
        """Generate batch-scoped QC tasks once STEP outputs and label config are ready."""
        self._require_dataset(dataset_id)
        self._require_permission(context=context, action="batch_assignment:manage", dataset_id=dataset_id)
        if dataset_id in self._registered_batches:
            summary = self._registered_batches[dataset_id]
            if summary.source_structure == "images_only":
                raise conflict(
                    "preannotation_required",
                    "Images-only batch requires STEP1/STEP2 pre-annotation before QC queue generation.",
                    dataset_id=dataset_id,
                )
            if dataset_id not in self._registered_batch_runtimes:
                raise conflict(
                    "source_not_ingested",
                    "Batch source must be ingested before QC queue generation.",
                    dataset_id=dataset_id,
                )
            try:
                self._label_config_repo.get_active(dataset_id=summary.dataset_type)
            except ActiveLabelConfigNotFoundError as exc:
                raise conflict(
                    "label_config_required",
                    "Active label config is required before QC queue generation.",
                    dataset_id=dataset_id,
                    dataset_type=summary.dataset_type,
                ) from exc
            qc_queue_id = self._queue_id_for_dataset(dataset_id)
            self._registered_batches[dataset_id] = summary.model_copy(
                update={"qc_queue_id": qc_queue_id}
            )
            self._persist_registered_batches()
        self._ensure_qc_tasks_for_dataset(dataset_id)
        return self.list_qc_queue(dataset_id=dataset_id, context=context)

    def resolve_auth_context(self, request: Request) -> AuthContext:
        """Resolve request identity from session token or dev headers."""
        return self._auth_service.resolve_context(request)

    def _record_audit(
        self,
        *,
        actor: AuthContext,
        action: str,
        entity: str,
        dataset_id: str | None = None,
        sample_id: str | None = None,
        details: dict[str, Any] | None = None,
        before: dict[str, Any] | None = None,
        after: dict[str, Any] | None = None,
    ) -> None:
        roles = [binding.role for binding in actor.roles]
        event = AuditEvent(
            event_id=self._state_store.new_id("audit"),
            actor_user_id=actor.user_id,
            actor_roles=roles,
            action=action,
            entity=entity,
            dataset_id=dataset_id,
            sample_id=sample_id,
            details=details or {},
            before=before,
            after=after,
            created_at=self._state_store.now(),
        )
        self._state_store.append_audit_event(event)

    def _resolve_dataset_scope(self, dataset_id: str | None) -> tuple[str | None, str | None]:
        if dataset_id is None:
            return None, None
        if dataset_id in self._registered_batches:
            return self._registered_batches[dataset_id].dataset_type, dataset_id
        if dataset_id in self._accepted_dataset_ids:
            return self._dataset_type, self._dataset_id
        if dataset_id in self._dataset_type_display_names:
            return dataset_id, None
        return None, dataset_id

    def _require_permission(
        self,
        *,
        context: AuthContext,
        action: str,
        dataset_id: str | None = None,
    ) -> None:
        dataset_type, dataset_batch = self._resolve_dataset_scope(dataset_id)
        decision = PermissionEvaluator.has_permission(
            bindings=context.roles,
            action=action,
            dataset_type=dataset_type,
            dataset_id=dataset_batch,
        )
        if not decision.allowed:
            raise forbidden(
                message="Insufficient permissions for this action.",
                action=action,
                dataset_id=dataset_id or "",
            )

    def require_permission_for_action(
        self,
        *,
        context: AuthContext,
        action: str,
        dataset_id: str | None = None,
    ) -> None:
        """Public wrapper for route-level permission checks."""
        self._require_permission(context=context, action=action, dataset_id=dataset_id)

    def _to_user_response(self, user: UserAccount) -> UserAccountResponse:
        return UserAccountResponse(
            user_id=user.user_id,
            display_name=user.display_name,
            email=user.email,
            status=user.status,
            created_at=user.created_at,
            updated_at=user.updated_at,
            last_seen_at=user.last_seen_at,
        )

    def _ensure_qc_tasks(self) -> None:
        tasks = self._state_store.list_tasks(self._dataset_id)
        if tasks:
            return
        now = self._state_store.now()
        created: list[QcTask] = []
        for sample in sorted(self._samples.values(), key=lambda value: value.sample_id):
            created.append(
                QcTask(
                    task_id=self._state_store.new_id("task"),
                    qc_queue_id=self._qc_queue_id,
                    dataset_id=self._dataset_id,
                    sample_id=sample.sample_id,
                    status=QcTaskStatus.QUEUED,
                    assignee_user_id=None,
                    claimed_at=None,
                    submitted_at=None,
                    completed_at=None,
                    confirmed_by=None,
                    confirmed_at=None,
                    latest_submission_id=None,
                    label_config_id=None,
                    label_config_version=None,
                    task_revision=0,
                )
            )
        self._state_store.save_tasks(self._dataset_id, created)

    def _task_map(self, dataset_id: str) -> dict[str, QcTask]:
        return {
            task.sample_id: task
            for task in self._state_store.list_tasks(dataset_id)
        }

    def _get_task(self, dataset_id: str, sample_id: str) -> QcTask:
        task = self._task_map(dataset_id).get(sample_id)
        if task is None:
            raise ApiError(
                status_code=404,
                code="not_found",
                message=f"Task not found for sample: {sample_id}",
            )
        return task

    def _save_task(self, dataset_id: str, task: QcTask) -> None:
        tasks = self._state_store.list_tasks(dataset_id)
        replaced = False
        updated: list[QcTask] = []
        for existing in tasks:
            if existing.task_id == task.task_id:
                updated.append(task)
                replaced = True
            else:
                updated.append(existing)
        if not replaced:
            updated.append(task)
        self._state_store.save_tasks(dataset_id, updated)

    def _to_assignment_response(
        self,
        assignment: BatchQcAssignment,
    ) -> BatchQcAssignmentResponse:
        return BatchQcAssignmentResponse(**assignment.model_dump())

    def _to_task_response(self, task: QcTask) -> QcTaskResponse:
        return QcTaskResponse(**task.model_dump())

    def _to_lease_response(self, lease: SampleLease) -> SampleLeaseResponse:
        return SampleLeaseResponse(**lease.model_dump())

    def _to_draft_response(self, draft: LabelEditDraft) -> LabelEditDraftResponse:
        operations = [LabelEditOperation.model_validate(item) for item in draft.operations]
        return LabelEditDraftResponse(
            draft_id=draft.draft_id,
            dataset_id=draft.dataset_id,
            sample_id=draft.sample_id,
            user_id=draft.user_id,
            task_id=draft.task_id,
            lease_id=draft.lease_id,
            base_revision=draft.base_revision,
            label_config_id=draft.label_config_id,
            label_config_version=draft.label_config_version,
            operations=operations,
            created_at=draft.created_at,
            updated_at=draft.updated_at,
        )

    def _to_submission_response(
        self,
        submission: LabelEditSubmission,
    ) -> LabelEditSubmissionResponse:
        operations = [LabelEditOperation.model_validate(item) for item in submission.operations]
        return LabelEditSubmissionResponse(
            submission_id=submission.submission_id,
            dataset_id=submission.dataset_id,
            sample_id=submission.sample_id,
            user_id=submission.user_id,
            task_id=submission.task_id,
            lease_id=submission.lease_id,
            base_revision=submission.base_revision,
            label_config_id=submission.label_config_id,
            label_config_version=submission.label_config_version,
            operations=operations,
            created_at=submission.created_at,
        )

    def _active_lease_for_sample(self, dataset_id: str, sample_id: str) -> SampleLease | None:
        now = self._state_store.now()
        leases = self._state_store.list_leases(dataset_id)
        changed = False
        active: SampleLease | None = None
        updated: list[SampleLease] = []
        for lease in leases:
            current = lease
            if (
                lease.sample_id == sample_id
                and lease.status == LeaseStatus.ACTIVE
                and lease.expires_at <= now
            ):
                current = lease.model_copy(update={"status": LeaseStatus.EXPIRED})
                changed = True
            updated.append(current)
            if (
                current.sample_id == sample_id
                and current.status == LeaseStatus.ACTIVE
                and (active is None or current.expires_at > active.expires_at)
            ):
                active = current
        if changed:
            self._state_store.save_leases(dataset_id, updated)
        return active

    def _build_asset_item(
        self,
        sample: FixtureSample,
        reviews: list[HumanReview] | None = None,
    ) -> AssetListItem:
        reviews = reviews if reviews is not None else self._reviews.get(sample.sample_id, [])
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

    def _runtime_distribution_counters(
        self,
        runtime: RegisteredBatchRuntime,
    ) -> tuple[Counter[str], Counter[str], Counter[str], Counter[str], Counter[str], Counter[str], int, int]:
        judge_counter: Counter[str] = Counter()
        category_counter: Counter[str] = Counter()
        verification_counter: Counter[str] = Counter()
        confidence_counter: Counter[str] = Counter()
        visibility_counter: Counter[str] = Counter()
        sample_category_counter: Counter[str] = Counter()
        fact_verification_count = 0
        candidate_count = 0

        for sample in runtime.samples.values():
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

        return (
            judge_counter,
            category_counter,
            verification_counter,
            confidence_counter,
            visibility_counter,
            sample_category_counter,
            fact_verification_count,
            candidate_count,
        )

    def _build_registered_dataset_summary(
        self,
        summary: DatasetSummaryResponse,
        runtime: RegisteredBatchRuntime,
    ) -> DatasetSummaryResponse:
        total = len(runtime.samples)
        stage1_count = total if runtime.stage1_run_name is not None else 0
        stage2_success_count = sum(1 for sample in runtime.samples.values() if sample.stage2 is not None)
        reviewed_count = sum(1 for history in runtime.reviews.values() if history)
        (
            judge_counter,
            category_counter,
            verification_counter,
            confidence_counter,
            visibility_counter,
            sample_category_counter,
            fact_verification_count,
            candidate_count,
        ) = self._runtime_distribution_counters(runtime)
        job = (
            self._import_jobs.get(summary.active_import_job_id)
            if summary.active_import_job_id is not None
            else None
        )
        return summary.model_copy(
            update={
                "lifecycle_status": (
                    self._registered_batch_lifecycle(job)
                    if job is not None
                    else summary.lifecycle_status
                ),
                "active_label_config_version": self._current_active_label_config_version(
                    summary.dataset_type
                ),
                "total_assets": total,
                "stage1_count": stage1_count,
                "stage2_success_count": stage2_success_count,
                "stage2_failure_count": runtime.stage2_failure_artifact_count,
                "reviewed_count": reviewed_count,
                "fact_verification_count": fact_verification_count,
                "candidate_count": candidate_count,
                "judge_decision_distribution": self._distribution(judge_counter, total),
                "category_distribution": self._distribution(category_counter),
                "verification_distribution": self._distribution(
                    verification_counter,
                    fact_verification_count,
                ),
                "confidence_distribution": self._distribution(confidence_counter, candidate_count),
                "visibility_distribution": self._distribution(
                    visibility_counter,
                    fact_verification_count,
                ),
                "sample_category_distribution": self._distribution(
                    sample_category_counter,
                    candidate_count,
                ),
            }
        )

    def list_datasets(self) -> list[DatasetSummaryResponse]:
        """Return available batch datasets for current dataset type."""
        registered = [
            self._build_registered_dataset_summary(summary, runtime)
            if (runtime := self._registered_batch_runtimes.get(summary.dataset_id)) is not None
            else summary
            for summary in self._registered_batches.values()
        ]
        return [
            self.get_dataset_summary(self._dataset_id),
            *sorted(registered, key=lambda item: item.dataset_id),
        ]

    def list_dataset_types(self) -> list[DatasetTypeResponse]:
        """Return registered dataset types and their concrete batches."""
        responses: list[DatasetTypeResponse] = []
        for dataset_type in sorted(self._dataset_type_display_names):
            batches = []
            if dataset_type == self._dataset_type:
                batches.append(self.get_dataset_summary(self._dataset_id))
            batches.extend(
                sorted(
                    (
                        self._build_registered_dataset_summary(summary, runtime)
                        if (runtime := self._registered_batch_runtimes.get(summary.dataset_id)) is not None
                        else summary.model_copy(
                            update={
                                "active_label_config_version": self._current_active_label_config_version(
                                    summary.dataset_type
                                )
                            }
                        )
                        for summary in self._registered_batches.values()
                        if summary.dataset_type == dataset_type
                    ),
                    key=lambda item: item.dataset_id,
                )
            )
            responses.append(
                DatasetTypeResponse(
                    dataset_type=dataset_type,
                    display_name=self._dataset_type_display_names[dataset_type],
                    field_schema_version=self._dataset_type_schema_versions.get(dataset_type, "draft"),
                    active_label_config_version=self._current_active_label_config_version(dataset_type),
                    status="active",
                    batch_count=len(batches),
                    batches=batches,
                )
            )
        return responses

    def create_dataset_type(self, request: DatasetTypeCreateRequest) -> DatasetTypeResponse:
        """Register an empty dataset type; batches are created under the type later."""
        if request.dataset_type in self._dataset_type_display_names:
            raise ValueError(f"Dataset type already exists: {request.dataset_type}")
        self._dataset_type_display_names[request.dataset_type] = request.display_name
        self._dataset_type_schema_versions[request.dataset_type] = request.field_schema_version
        self._persist_dataset_type_registry()
        return DatasetTypeResponse(
            dataset_type=request.dataset_type,
            display_name=request.display_name,
            field_schema_version=request.field_schema_version,
            active_label_config_version=None,
            status="active",
            batch_count=0,
            batches=[],
        )

    def login(self, request: LoginRequest) -> LoginResponse:
        """Authenticate one internal account and issue a session token."""
        user = self._auth_service.get_user(request.user_id)
        if user is None or user.status != UserStatus.ACTIVE:
            raise ApiError(
                status_code=401,
                code="unauthorized",
                message="Invalid credentials.",
            )
        if not self._auth_service.verify_password(request.password, user.password_hash):
            raise ApiError(
                status_code=401,
                code="unauthorized",
                message="Invalid credentials.",
            )
        session = self._auth_service.create_session(user)
        context = AuthContext(
            auth_mode="session",
            user=user,
            roles=[binding for binding in self._state_store.list_role_bindings() if binding.user_id == user.user_id],
        )
        self._record_audit(
            actor=context,
            action="user.login",
            entity="session",
            details={"auth_mode": "session", "session_id": session.session_id},
        )
        return LoginResponse(
            token=session.token,
            expires_at=session.expires_at,
            auth_mode="session",
            user=self._to_user_response(user),
        )

    def logout(self, context: AuthContext, token: str | None) -> LogoutResponse:
        if not token:
            return LogoutResponse(logged_out=False)
        result = self._auth_service.revoke_session(token)
        if result:
            self._record_audit(
                actor=context,
                action="user.logout",
                entity="session",
                details={"token_revoked": True},
            )
        return LogoutResponse(logged_out=result)

    def get_me(self, context: AuthContext) -> CurrentUserResponse:
        return context.to_current_user_response()

    def list_users(self, context: AuthContext) -> list[UserAccountResponse]:
        self._require_permission(context=context, action="users:manage")
        return [self._to_user_response(user) for user in self._state_store.list_users()]

    def create_user(self, context: AuthContext, request: UserAccountCreateRequest) -> UserAccountResponse:
        self._require_permission(context=context, action="users:manage")
        if self._auth_service.get_user(request.user_id) is not None:
            raise conflict(
                "user_conflict",
                "User already exists.",
                user_id=request.user_id,
            )
        now = self._state_store.now()
        user = UserAccount(
            user_id=request.user_id,
            display_name=request.display_name,
            email=request.email,
            password_hash=self._auth_service.hash_password(request.password),
            status=request.status,
            created_at=now,
            updated_at=now,
            last_seen_at=None,
        )
        self._auth_service.save_user(user)
        self._record_audit(
            actor=context,
            action="user.create",
            entity="user",
            details={"user_id": request.user_id},
            after=self._to_user_response(user).model_dump(mode="json"),
        )
        return self._to_user_response(user)

    def patch_user(
        self,
        context: AuthContext,
        user_id: str,
        request: UserAccountPatchRequest,
    ) -> UserAccountResponse:
        self._require_permission(context=context, action="users:manage")
        user = self._auth_service.get_user(user_id)
        if user is None:
            raise ApiError(status_code=404, code="not_found", message=f"User not found: {user_id}")
        before = self._to_user_response(user).model_dump(mode="json")
        updates: dict[str, Any] = {"updated_at": self._state_store.now()}
        if request.display_name is not None:
            updates["display_name"] = request.display_name
        if request.email is not None:
            updates["email"] = request.email
        if request.status is not None:
            updates["status"] = request.status
        if request.password is not None:
            updates["password_hash"] = self._auth_service.hash_password(request.password)
        patched = user.model_copy(update=updates)
        self._auth_service.save_user(patched)
        self._record_audit(
            actor=context,
            action="user.patch",
            entity="user",
            details={"user_id": user_id},
            before=before,
            after=self._to_user_response(patched).model_dump(mode="json"),
        )
        return self._to_user_response(patched)

    def list_role_bindings(self, context: AuthContext) -> list[RoleBinding]:
        self._require_permission(context=context, action="roles:manage")
        return self._state_store.list_role_bindings()

    def create_role_binding(
        self,
        context: AuthContext,
        request: RoleBindingCreateRequest,
    ) -> RoleBinding:
        self._require_permission(context=context, action="roles:manage")
        if self._auth_service.get_user(request.user_id) is None:
            raise ApiError(
                status_code=404,
                code="not_found",
                message=f"User not found: {request.user_id}",
            )
        bindings = self._state_store.list_role_bindings()
        for binding in bindings:
            if (
                binding.user_id == request.user_id
                and binding.role == request.role
                and binding.scope_type == request.scope_type
                and binding.scope_id == request.scope_id
            ):
                raise conflict(
                    "role_binding_conflict",
                    "Role binding already exists.",
                    user_id=request.user_id,
                )
        new_binding = RoleBinding(
            binding_id=self._state_store.new_id("rb"),
            user_id=request.user_id,
            role=request.role,
            scope_type=request.scope_type,
            scope_id=request.scope_id,
            created_by=context.user_id,
            created_at=self._state_store.now(),
        )
        bindings.append(new_binding)
        self._state_store.save_role_bindings(bindings)
        self._record_audit(
            actor=context,
            action="role_binding.create",
            entity="role_binding",
            details={"binding_id": new_binding.binding_id},
            after=new_binding.model_dump(mode="json"),
        )
        return new_binding

    def delete_role_binding(self, context: AuthContext, binding_id: str) -> bool:
        self._require_permission(context=context, action="roles:manage")
        bindings = self._state_store.list_role_bindings()
        kept: list[RoleBinding] = []
        removed: RoleBinding | None = None
        for binding in bindings:
            if binding.binding_id == binding_id:
                removed = binding
            else:
                kept.append(binding)
        if removed is None:
            return False
        self._state_store.save_role_bindings(kept)
        self._record_audit(
            actor=context,
            action="role_binding.delete",
            entity="role_binding",
            details={"binding_id": binding_id},
            before=removed.model_dump(mode="json"),
        )
        return True

    def get_dataset_summary(self, dataset_id: str) -> DatasetSummaryResponse:
        """Return aggregate dataset counters."""
        self._require_dataset(dataset_id)
        if dataset_id in self._registered_batches:
            summary = self._registered_batches[dataset_id]
            runtime = self._registered_batch_runtimes.get(dataset_id)
            if runtime is not None:
                return self._build_registered_dataset_summary(summary, runtime)
            return summary.model_copy(
                update={
                    "active_label_config_version": self._current_active_label_config_version(
                        summary.dataset_type
                    )
                }
            )
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
            dataset_id=self._dataset_id,
            dataset_type=self._dataset_type,
            display_name=self._dataset_type_display_names[self._dataset_type],
            field_schema_version=self._field_schema_version,
            active_label_config_version=self._current_active_label_config_version(),
            batch_key=self._batch_key,
            lifecycle_status=self._lifecycle_status,
            active_import_job_id=self._active_import_job_id,
            qc_queue_id=self._qc_queue_id,
            legacy_dataset_id=self._legacy_dataset_id,
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
        self._require_dataset_or_type(dataset_id)
        dataset_type = self._resolve_dataset_type(dataset_id)
        report, _ = validate_label_config(dataset_id=dataset_type, payload=request.config)
        return report.model_copy(update={"dataset_id": dataset_id})

    def save_label_config(
        self,
        dataset_id: str,
        request: LabelConfigSaveRequest,
    ) -> StoredLabelConfig:
        """Validate and save one uploaded label config version."""
        self._require_dataset_or_type(dataset_id)
        dataset_type = self._resolve_dataset_type(dataset_id)
        report, config = validate_label_config(dataset_id=dataset_type, payload=request.config)
        if not report.valid or config is None:
            raise LabelConfigValidationFailedError(report)

        stored = self._label_config_repo.save(
            dataset_id=dataset_type,
            file_name=request.file_name,
            report=report,
            config=config,
            activate=request.activate,
        )
        self._lifecycle_status = self._derive_lifecycle_status()
        return self._bind_label_config_to_dataset(stored=stored, dataset_id=dataset_id)

    def activate_label_config(self, dataset_id: str, config_id: str) -> StoredLabelConfig:
        """Activate a previously saved label config version."""
        self._require_dataset_or_type(dataset_id)
        dataset_type = self._resolve_dataset_type(dataset_id)
        try:
            stored = self._label_config_repo.activate(dataset_id=dataset_type, config_id=config_id)
            self._lifecycle_status = self._derive_lifecycle_status()
            return self._bind_label_config_to_dataset(stored=stored, dataset_id=dataset_id)
        except LabelConfigVersionNotFoundError as exc:
            raise LabelConfigVersionAccessError(str(exc)) from exc
        except LabelConfigPersistenceError as exc:
            raise LabelConfigPersistenceAccessError(str(exc)) from exc

    def get_active_label_config(self, dataset_id: str) -> StoredLabelConfig:
        """Return the currently active label config for one dataset."""
        self._require_dataset_or_type(dataset_id)
        dataset_type = self._resolve_dataset_type(dataset_id)
        try:
            stored = self._label_config_repo.get_active(dataset_id=dataset_type)
            return self._bind_label_config_to_dataset(stored=stored, dataset_id=dataset_id)
        except ActiveLabelConfigNotFoundError as exc:
            raise ActiveLabelConfigAccessError(str(exc)) from exc
        except (LabelConfigPersistenceError, LabelConfigVersionNotFoundError) as exc:
            raise LabelConfigPersistenceAccessError(str(exc)) from exc

    def list_label_configs(self, dataset_id: str) -> list[StoredLabelConfig]:
        """Return all saved label config versions for one dataset type."""
        self._require_dataset_or_type(dataset_id)
        dataset_type = self._resolve_dataset_type(dataset_id)
        return [
            self._bind_label_config_to_dataset(stored=stored, dataset_id=dataset_id)
            for stored in self._label_config_repo.list_configs(dataset_type)
        ]

    def reload_active_label_config(self, dataset_id: str) -> StoredLabelConfig:
        """Reload the active label config from persistent storage into runtime cache."""
        self._require_dataset_or_type(dataset_id)
        dataset_type = self._resolve_dataset_type(dataset_id)
        try:
            stored = self._label_config_repo.reload_active(dataset_type)
            self._lifecycle_status = self._derive_lifecycle_status()
            return self._bind_label_config_to_dataset(stored=stored, dataset_id=dataset_id)
        except ActiveLabelConfigNotFoundError as exc:
            raise ActiveLabelConfigAccessError(str(exc)) from exc
        except (LabelConfigPersistenceError, LabelConfigVersionNotFoundError) as exc:
            raise LabelConfigPersistenceAccessError(str(exc)) from exc

    def get_label_suggestions(
        self,
        dataset_id: str,
        field: str,
        query: str = "",
    ) -> LabelSuggestionResponse:
        """Return filtered options from the active label config only."""
        self._require_dataset_or_type(dataset_id)
        dataset_type = self._resolve_dataset_type(dataset_id)
        try:
            active = self._label_config_repo.get_active(dataset_id=dataset_type)
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
            op = operation.op

            if op not in SUPPORTED_LABEL_EDIT_OPS:
                errors.append(
                    LabelEditValidationIssue(
                        operation_index=index,
                        scope=scope,
                        field=field,
                        code="invalid_operation",
                        message=f"Unsupported label edit operation: {op}",
                    )
                )
                continue

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

            if field == "candidate" and op != "delete_candidate":
                errors.append(
                    LabelEditValidationIssue(
                        operation_index=index,
                        scope=scope,
                        field=field,
                        code="invalid_operation",
                        message="candidate field only supports delete_candidate",
                    )
                )
                continue

            if op == "delete_candidate":
                if not scope.startswith("candidate:") or field != "candidate":
                    errors.append(
                        LabelEditValidationIssue(
                            operation_index=index,
                            scope=scope,
                            field=field,
                            code="invalid_scope_or_field",
                            message="delete_candidate must use scope candidate:C* and field candidate",
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
        *,
        context: AuthContext,
    ) -> LabelEditSubmitResponse:
        """Save reviewDraft patch as draft or submitted label-edit state."""
        self._require_sample(dataset_id, sample_id)
        self._require_permission(context=context, action="label_edit:write", dataset_id=dataset_id)
        active_dataset_id = self._effective_batch_dataset_id(dataset_id)
        label_edits = self._label_edits_for_dataset(dataset_id)

        assignment = self._state_store.get_assignment(active_dataset_id)
        if assignment is None:
            raise conflict(
                "batch_assignment_required",
                "Batch assignment is required before editing.",
                dataset_id=active_dataset_id,
            )
        if assignment.assignee_user_id != context.user_id:
            raise conflict(
                "batch_assigned_to_other_user",
                "Batch is assigned to another user.",
                dataset_id=active_dataset_id,
                assignee_user_id=assignment.assignee_user_id,
            )

        if request.lease_id is None:
            raise conflict(
                "lease_required",
                "Active sample lease is required.",
                dataset_id=active_dataset_id,
                sample_id=sample_id,
            )

        active_lease = self._active_lease_for_sample(active_dataset_id, sample_id)
        if active_lease is None:
            raise conflict(
                "lease_required",
                "Active sample lease is required.",
                dataset_id=active_dataset_id,
                sample_id=sample_id,
            )
        if active_lease.lease_id != request.lease_id:
            raise conflict(
                "lease_required",
                "Lease id does not match active lease.",
                lease_id=request.lease_id,
            )
        if active_lease.user_id != context.user_id:
            raise conflict(
                "lease_owned_by_other_user",
                "Lease is owned by another user.",
                lease_user_id=active_lease.user_id,
            )
        if active_lease.status != LeaseStatus.ACTIVE:
            raise conflict(
                "lease_expired",
                "Lease is not active.",
                lease_id=active_lease.lease_id,
            )

        task = self._get_task(active_dataset_id, sample_id)
        base_revision = request.base_revision if request.base_revision is not None else task.task_revision
        if base_revision != task.task_revision:
            raise conflict(
                "base_revision_conflict",
                "Base revision is stale.",
                expected_revision=task.task_revision,
                actual_revision=base_revision,
            )

        if task.label_config_version and request.label_config_version:
            if task.label_config_version != request.label_config_version:
                raise conflict(
                    "label_config_changed",
                    "Task label config version changed.",
                    expected=task.label_config_version,
                    actual=request.label_config_version,
                )

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

        now = self._state_store.now()
        next_revision = task.task_revision + 1
        label_config_id = request.label_config_id or task.label_config_id
        label_config_version = request.label_config_version or task.label_config_version

        self._label_edit_counter += 1
        state = LabelEditState(
            edit_id=f"label-edit-{self._label_edit_counter}",
            dataset_id=dataset_id,
            sample_id=sample_id,
            user_id=context.user_id,
            task_mode=request.task_mode,
            submit_action=request.submit_action,
            task_status=task_status,
            label_config_id=label_config_id,
            label_config_version=label_config_version,
            operations=request.operations,
            updated_at=now,
        )
        label_edits.setdefault(sample_id, []).append(state)

        if request.submit_action == "save_draft":
            draft = LabelEditDraft(
                draft_id=self._state_store.new_id("draft"),
                dataset_id=active_dataset_id,
                sample_id=sample_id,
                user_id=context.user_id,
                task_id=task.task_id,
                lease_id=active_lease.lease_id,
                base_revision=base_revision,
                label_config_id=label_config_id,
                label_config_version=label_config_version,
                operations=[op.model_dump(mode="json") for op in request.operations],
                created_at=now,
                updated_at=now,
            )
            self._state_store.save_draft(draft)
            updated_task = task.model_copy(
                update={
                    "status": QcTaskStatus.DRAFT_SAVED,
                    "claimed_at": task.claimed_at or now,
                    "task_revision": next_revision,
                    "label_config_id": label_config_id,
                    "label_config_version": label_config_version,
                }
            )
            self._save_task(active_dataset_id, updated_task)
            self._record_audit(
                actor=context,
                action="label_edit.save_draft",
                entity="label_edit_draft",
                dataset_id=active_dataset_id,
                sample_id=sample_id,
                details={"task_id": task.task_id, "draft_id": draft.draft_id},
            )
        else:
            submission = LabelEditSubmission(
                submission_id=self._state_store.new_id("subm"),
                dataset_id=active_dataset_id,
                sample_id=sample_id,
                user_id=context.user_id,
                task_id=task.task_id,
                lease_id=active_lease.lease_id,
                base_revision=base_revision,
                label_config_id=label_config_id,
                label_config_version=label_config_version,
                operations=[op.model_dump(mode="json") for op in request.operations],
                created_at=now,
            )
            self._state_store.save_submission(submission)
            updated_task = task.model_copy(
                update={
                    "status": QcTaskStatus.SUBMITTED,
                    "submitted_at": now,
                    "latest_submission_id": submission.submission_id,
                    "task_revision": next_revision,
                    "label_config_id": label_config_id,
                    "label_config_version": label_config_version,
                }
            )
            self._save_task(active_dataset_id, updated_task)
            leases = self._state_store.list_leases(active_dataset_id)
            normalized: list[SampleLease] = []
            for lease in leases:
                if lease.lease_id == active_lease.lease_id:
                    normalized.append(
                        lease.model_copy(
                            update={
                                "status": LeaseStatus.RELEASED,
                                "released_at": now,
                            }
                        )
                    )
                else:
                    normalized.append(lease)
            self._state_store.save_leases(active_dataset_id, normalized)
            self._record_audit(
                actor=context,
                action="label_edit.submit",
                entity="label_edit_submission",
                dataset_id=active_dataset_id,
                sample_id=sample_id,
                details={"task_id": task.task_id, "submission_id": submission.submission_id},
            )

        return LabelEditSubmitResponse(saved=True, state=state, validation=validation)

    def get_batch_assignment(
        self,
        dataset_id: str,
        *,
        context: AuthContext,
    ) -> BatchQcAssignmentResponse | None:
        self._require_dataset(dataset_id)
        self._require_permission(context=context, action="qc_queue:read", dataset_id=dataset_id)
        assignment = self._state_store.get_assignment(self._effective_batch_dataset_id(dataset_id))
        if assignment is None:
            return None
        return self._to_assignment_response(assignment)

    def assign_batch(
        self,
        dataset_id: str,
        request: BatchAssignmentRequest,
        *,
        context: AuthContext,
        allow_reassign: bool,
    ) -> BatchQcAssignmentResponse:
        self._require_dataset(dataset_id)
        self._require_permission(context=context, action="batch_assignment:manage", dataset_id=dataset_id)
        if dataset_id in self._registered_batches and self._registered_batches[dataset_id].qc_queue_id is None:
            raise conflict(
                "qc_queue_required",
                "Generate QC queue before assigning this batch.",
                dataset_id=dataset_id,
            )
        self._ensure_qc_tasks_for_dataset(dataset_id)
        active_dataset_id = self._effective_batch_dataset_id(dataset_id)
        qc_queue_id = self._queue_id_for_dataset(dataset_id)
        assignee = self._auth_service.get_user(request.assignee_user_id)
        if assignee is None or assignee.status != UserStatus.ACTIVE:
            raise conflict(
                "batch_assignment_required",
                "Assignee user does not exist or is disabled.",
                assignee_user_id=request.assignee_user_id,
            )

        current = self._state_store.get_assignment(active_dataset_id)
        active_statuses = {
            BatchAssignmentStatus.ASSIGNED,
            BatchAssignmentStatus.IN_PROGRESS,
            BatchAssignmentStatus.SUBMITTED,
            BatchAssignmentStatus.RETURNED,
        }
        now = self._state_store.now()
        if current is not None and current.status in active_statuses and not allow_reassign:
            raise conflict(
                "batch_assigned_to_other_user",
                "Batch already assigned.",
                dataset_id=active_dataset_id,
                assignee_user_id=current.assignee_user_id,
            )

        if current is not None and current.status in active_statuses and allow_reassign:
            self._revoke_all_active_leases(dataset_id=active_dataset_id, revoked_by=context)
            current = current.model_copy(
                update={
                    "status": BatchAssignmentStatus.REVOKED,
                    "revoked_at": now,
                }
            )

        assignment = BatchQcAssignment(
            assignment_id=self._state_store.new_id("assign"),
            qc_queue_id=qc_queue_id,
            dataset_id=active_dataset_id,
            assignee_user_id=request.assignee_user_id,
            assigned_by=context.user_id,
            status=BatchAssignmentStatus.ASSIGNED,
            assigned_at=now,
            submitted_at=None,
            confirmed_at=None,
            returned_at=None,
            revoked_at=None,
        )
        self._state_store.save_assignment(assignment)
        tasks = self._state_store.list_tasks(active_dataset_id)
        updated_tasks = [
            task.model_copy(
                update={
                    "assignee_user_id": request.assignee_user_id,
                    "status": (
                        QcTaskStatus.COMPLETED
                        if task.status == QcTaskStatus.COMPLETED
                        else QcTaskStatus.ASSIGNED
                    ),
                }
            )
            for task in tasks
        ]
        self._state_store.save_tasks(active_dataset_id, updated_tasks)
        self._record_audit(
            actor=context,
            action=("batch_assignment.reassign" if allow_reassign else "batch_assignment.assign"),
            entity="batch_assignment",
            dataset_id=active_dataset_id,
            details={"assignee_user_id": request.assignee_user_id},
            after=assignment.model_dump(mode="json"),
        )
        return self._to_assignment_response(assignment)

    def release_batch_assignment(
        self,
        dataset_id: str,
        *,
        context: AuthContext,
        reason: str | None = None,
    ) -> BatchQcAssignmentResponse:
        self._require_dataset(dataset_id)
        self._require_permission(context=context, action="batch_assignment:manage", dataset_id=dataset_id)
        active_dataset_id = self._effective_batch_dataset_id(dataset_id)
        current = self._state_store.get_assignment(active_dataset_id)
        if current is None:
            raise conflict(
                "batch_assignment_required",
                "No active assignment exists.",
                dataset_id=active_dataset_id,
            )
        now = self._state_store.now()
        released = current.model_copy(
            update={
                "status": BatchAssignmentStatus.REVOKED,
                "revoked_at": now,
            }
        )
        self._state_store.save_assignment(released)
        tasks = self._state_store.list_tasks(active_dataset_id)
        self._state_store.save_tasks(
            active_dataset_id,
            [
                task.model_copy(
                    update={
                        "assignee_user_id": None,
                        "status": (
                            QcTaskStatus.COMPLETED
                            if task.status == QcTaskStatus.COMPLETED
                            else QcTaskStatus.QUEUED
                        ),
                    }
                )
                for task in tasks
            ],
        )
        self._revoke_all_active_leases(dataset_id=active_dataset_id, revoked_by=context)
        self._record_audit(
            actor=context,
            action="batch_assignment.release",
            entity="batch_assignment",
            dataset_id=active_dataset_id,
            details={"reason": reason or ""},
            before=current.model_dump(mode="json"),
            after=released.model_dump(mode="json"),
        )
        return self._to_assignment_response(released)

    def _revoke_all_active_leases(self, dataset_id: str, revoked_by: AuthContext) -> None:
        now = self._state_store.now()
        leases = self._state_store.list_leases(dataset_id)
        changed = False
        updated: list[SampleLease] = []
        for lease in leases:
            if lease.status == LeaseStatus.ACTIVE:
                changed = True
                updated.append(
                    lease.model_copy(
                        update={
                            "status": LeaseStatus.REVOKED,
                            "revoked_at": now,
                        }
                    )
                )
            else:
                updated.append(lease)
        if changed:
            self._state_store.save_leases(dataset_id, updated)
            self._record_audit(
                actor=revoked_by,
                action="sample_lease.revoke_all",
                entity="sample_lease",
                dataset_id=dataset_id,
                details={"count": sum(1 for lease in leases if lease.status == LeaseStatus.ACTIVE)},
            )

    def acquire_sample_lease(
        self,
        dataset_id: str,
        sample_id: str,
        *,
        context: AuthContext,
    ) -> LeaseAcquireResponse:
        self._require_sample(dataset_id, sample_id)
        self._require_permission(context=context, action="label_edit:write", dataset_id=dataset_id)
        active_dataset_id = self._effective_batch_dataset_id(dataset_id)

        assignment = self._state_store.get_assignment(active_dataset_id)
        if assignment is None:
            raise conflict(
                "batch_assignment_required",
                "Batch assignment is required before lease acquire.",
                dataset_id=active_dataset_id,
            )
        if assignment.assignee_user_id != context.user_id:
            raise conflict(
                "batch_assigned_to_other_user",
                "Batch is assigned to another user.",
                dataset_id=active_dataset_id,
                assignee_user_id=assignment.assignee_user_id,
            )

        task = self._get_task(active_dataset_id, sample_id)
        active = self._active_lease_for_sample(active_dataset_id, sample_id)
        now = self._state_store.now()
        if active is not None and active.user_id != context.user_id:
            raise conflict(
                "lease_owned_by_other_user",
                "Active lease is owned by another user.",
                sample_id=sample_id,
                lease_user_id=active.user_id,
            )
        if active is not None and active.user_id == context.user_id:
            extended = active.model_copy(
                update={
                    "heartbeat_at": now,
                    "expires_at": now + timedelta(minutes=10),
                }
            )
            leases = [
                extended if lease.lease_id == active.lease_id else lease
                for lease in self._state_store.list_leases(active_dataset_id)
            ]
            self._state_store.save_leases(active_dataset_id, leases)
            return LeaseAcquireResponse(editable=True, lease=self._to_lease_response(extended))

        lease = SampleLease(
            lease_id=self._state_store.new_id("lease"),
            dataset_id=active_dataset_id,
            sample_id=sample_id,
            task_id=task.task_id,
            user_id=context.user_id,
            status=LeaseStatus.ACTIVE,
            acquired_at=now,
            expires_at=now + timedelta(minutes=10),
            heartbeat_at=now,
            released_at=None,
            revoked_at=None,
        )
        leases = self._state_store.list_leases(active_dataset_id)
        leases.append(lease)
        self._state_store.save_leases(active_dataset_id, leases)
        updated_task = task.model_copy(update={"status": QcTaskStatus.IN_PROGRESS, "claimed_at": now})
        self._save_task(active_dataset_id, updated_task)
        self._record_audit(
            actor=context,
            action="sample_lease.acquire",
            entity="sample_lease",
            dataset_id=active_dataset_id,
            sample_id=sample_id,
            details={"lease_id": lease.lease_id},
        )
        return LeaseAcquireResponse(editable=True, lease=self._to_lease_response(lease))

    def heartbeat_sample_lease(
        self,
        dataset_id: str,
        sample_id: str,
        lease_id: str,
        *,
        context: AuthContext,
    ) -> SampleLeaseResponse:
        self._require_sample(dataset_id, sample_id)
        active_dataset_id = self._effective_batch_dataset_id(dataset_id)
        leases = self._state_store.list_leases(active_dataset_id)
        now = self._state_store.now()
        updated: list[SampleLease] = []
        matched: SampleLease | None = None
        for lease in leases:
            current = lease
            if lease.lease_id == lease_id:
                if lease.user_id != context.user_id:
                    raise conflict(
                        "lease_owned_by_other_user",
                        "Cannot heartbeat lease owned by another user.",
                        lease_id=lease_id,
                    )
                if lease.status != LeaseStatus.ACTIVE or lease.expires_at <= now:
                    raise conflict(
                        "lease_expired",
                        "Lease is expired.",
                        lease_id=lease_id,
                    )
                current = lease.model_copy(
                    update={
                        "heartbeat_at": now,
                        "expires_at": now + timedelta(minutes=10),
                    }
                )
                matched = current
            updated.append(current)
        if matched is None:
            raise conflict("lease_required", "Lease not found.", lease_id=lease_id)
        self._state_store.save_leases(active_dataset_id, updated)
        self._record_audit(
            actor=context,
            action="sample_lease.heartbeat",
            entity="sample_lease",
            dataset_id=active_dataset_id,
            sample_id=sample_id,
            details={"lease_id": lease_id},
        )
        return self._to_lease_response(matched)

    def release_sample_lease(
        self,
        dataset_id: str,
        sample_id: str,
        lease_id: str,
        *,
        context: AuthContext,
    ) -> SampleLeaseResponse:
        self._require_sample(dataset_id, sample_id)
        active_dataset_id = self._effective_batch_dataset_id(dataset_id)
        leases = self._state_store.list_leases(active_dataset_id)
        now = self._state_store.now()
        updated: list[SampleLease] = []
        matched: SampleLease | None = None
        for lease in leases:
            current = lease
            if lease.lease_id == lease_id:
                if lease.user_id != context.user_id:
                    self._require_permission(context=context, action="lease:force_release", dataset_id=dataset_id)
                current = lease.model_copy(
                    update={
                        "status": LeaseStatus.RELEASED,
                        "released_at": now,
                    }
                )
                matched = current
            updated.append(current)
        if matched is None:
            raise conflict("lease_required", "Lease not found.", lease_id=lease_id)
        self._state_store.save_leases(active_dataset_id, updated)
        self._record_audit(
            actor=context,
            action="sample_lease.release",
            entity="sample_lease",
            dataset_id=active_dataset_id,
            sample_id=sample_id,
            details={"lease_id": lease_id},
        )
        return self._to_lease_response(matched)

    def get_my_draft(
        self,
        dataset_id: str,
        sample_id: str,
        *,
        context: AuthContext,
    ) -> LabelEditDraftResponse | None:
        self._require_sample(dataset_id, sample_id)
        active_dataset_id = self._effective_batch_dataset_id(dataset_id)
        draft = self._state_store.get_draft(active_dataset_id, sample_id, context.user_id)
        if draft is None:
            return None
        return self._to_draft_response(draft)

    def get_label_edit_history(
        self,
        dataset_id: str,
        sample_id: str,
        *,
        context: AuthContext,
    ) -> list[LabelEditSubmissionResponse]:
        self._require_sample(dataset_id, sample_id)
        self._require_permission(context=context, action="dataset:read", dataset_id=dataset_id)
        active_dataset_id = self._effective_batch_dataset_id(dataset_id)
        return [
            self._to_submission_response(item)
            for item in self._state_store.list_submissions(active_dataset_id, sample_id)
        ]

    def confirm_submission(
        self,
        dataset_id: str,
        sample_id: str,
        submission_id: str,
        *,
        context: AuthContext,
    ) -> LabelEditSubmissionResponse:
        self._require_sample(dataset_id, sample_id)
        self._require_permission(context=context, action="label_edit:confirm", dataset_id=dataset_id)
        active_dataset_id = self._effective_batch_dataset_id(dataset_id)
        submission = self._state_store.get_submission(active_dataset_id, sample_id, submission_id)
        if submission is None:
            raise ApiError(
                status_code=404,
                code="not_found",
                message=f"Submission not found: {submission_id}",
            )
        task = self._get_task(active_dataset_id, sample_id)
        if task.status != QcTaskStatus.SUBMITTED:
            raise conflict(
                "submission_not_submitted",
                "Task is not in submitted status.",
                task_status=task.status.value,
            )
        now = self._state_store.now()
        updated_task = task.model_copy(
            update={
                "status": QcTaskStatus.COMPLETED,
                "confirmed_by": context.user_id,
                "confirmed_at": now,
                "completed_at": now,
            }
        )
        self._save_task(active_dataset_id, updated_task)
        self._record_audit(
            actor=context,
            action="label_edit.confirm",
            entity="label_edit_submission",
            dataset_id=active_dataset_id,
            sample_id=sample_id,
            details={"submission_id": submission_id},
        )
        return self._to_submission_response(submission)

    def return_submission(
        self,
        dataset_id: str,
        sample_id: str,
        submission_id: str,
        *,
        context: AuthContext,
    ) -> LabelEditSubmissionResponse:
        self._require_sample(dataset_id, sample_id)
        self._require_permission(context=context, action="label_edit:confirm", dataset_id=dataset_id)
        active_dataset_id = self._effective_batch_dataset_id(dataset_id)
        submission = self._state_store.get_submission(active_dataset_id, sample_id, submission_id)
        if submission is None:
            raise ApiError(
                status_code=404,
                code="not_found",
                message=f"Submission not found: {submission_id}",
            )
        task = self._get_task(active_dataset_id, sample_id)
        if task.status not in {QcTaskStatus.SUBMITTED, QcTaskStatus.COMPLETED}:
            raise conflict(
                "submission_not_submitted",
                "Task is not in submitted/confirmed status.",
                task_status=task.status.value,
            )
        now = self._state_store.now()
        updated_task = task.model_copy(
            update={
                "status": QcTaskStatus.RETURNED,
                "confirmed_by": context.user_id,
                "confirmed_at": now,
            }
        )
        self._save_task(active_dataset_id, updated_task)
        self._record_audit(
            actor=context,
            action="label_edit.returned",
            entity="label_edit_submission",
            dataset_id=active_dataset_id,
            sample_id=sample_id,
            details={"submission_id": submission_id},
        )
        return self._to_submission_response(submission)

    def list_audit_events(
        self,
        *,
        context: AuthContext,
        dataset_id: str | None = None,
        sample_id: str | None = None,
        actor_user_id: str | None = None,
        action: str | None = None,
    ) -> list[AuditEventResponse]:
        try:
            self._require_permission(context=context, action="audit:read", dataset_id=dataset_id)
            restrict_to_self = False
        except ApiError:
            self._require_permission(context=context, action="audit:read_own", dataset_id=dataset_id)
            if actor_user_id != context.user_id:
                raise forbidden(
                    message="Self audit access requires actor_user_id to match current user.",
                    action="audit:read_own",
                    actor_user_id=actor_user_id,
                )
            restrict_to_self = True
        events = self._state_store.list_audit_events()
        filtered: list[AuditEventResponse] = []
        for event in events:
            if dataset_id and event.dataset_id != dataset_id:
                continue
            if sample_id and event.sample_id != sample_id:
                continue
            if actor_user_id and event.actor_user_id != actor_user_id:
                continue
            if action and event.action != action:
                continue
            if restrict_to_self and event.actor_user_id != context.user_id:
                continue
            filtered.append(AuditEventResponse(**event.model_dump()))
        return filtered

    def get_qc_progress(self, dataset_id: str, *, context: AuthContext) -> QcProgressResponse:
        self._require_dataset(dataset_id)
        try:
            self._require_permission(context=context, action="qc_progress:read", dataset_id=dataset_id)
            restrict_to_self = False
        except ApiError:
            self._require_permission(context=context, action="qc_progress:read_own", dataset_id=dataset_id)
            restrict_to_self = True
        active_dataset_id = self._effective_batch_dataset_id(dataset_id)
        tasks = self._state_store.list_tasks(active_dataset_id)
        if restrict_to_self:
            tasks = [task for task in tasks if task.assignee_user_id == context.user_id]
        status_counter: Counter[QcTaskStatus] = Counter(task.status for task in tasks)
        user_counter: Counter[str] = Counter(
            task.assignee_user_id for task in tasks if task.assignee_user_id is not None
        )
        assignment = self._state_store.get_assignment(active_dataset_id)
        return QcProgressResponse(
            dataset_id=active_dataset_id,
            assignment=(self._to_assignment_response(assignment) if assignment else None),
            total_tasks=len(tasks),
            by_status=[
                QcProgressByStatus(status=status, count=count)
                for status, count in sorted(status_counter.items(), key=lambda item: item[0].value)
            ],
            by_user=[
                QcProgressByUser(user_id=user_id, count=count)
                for user_id, count in sorted(user_counter.items(), key=lambda item: item[0])
            ],
        )

    def list_qc_tasks(self, dataset_id: str, *, context: AuthContext) -> list[QcTaskResponse]:
        self._require_dataset(dataset_id)
        self._require_permission(context=context, action="qc_queue:read", dataset_id=dataset_id)
        active_dataset_id = self._effective_batch_dataset_id(dataset_id)
        return [
            self._to_task_response(task)
            for task in sorted(
                self._state_store.list_tasks(active_dataset_id),
                key=lambda item: item.sample_id,
            )
        ]

    def list_assets(
        self,
        dataset_id: str,
        category: str | None = None,
        judge_decision: str | None = None,
        qc_status: str | None = None,
        failure_status: str | None = None,
        sample_category: str | None = None,
        step1_status: str | None = None,
        step2_status: str | None = None,
        model_decision: str | None = None,
        confidence_min: float | None = None,
        confidence_max: float | None = None,
        media_status: str | None = None,
        edited_status: str | None = None,
    ) -> AssetListResponse:
        """List assets with query filter support."""
        self._require_dataset(dataset_id)
        edited_histories = self._label_edits
        response_dataset_id = self._dataset_id
        response_dataset_type = self._dataset_type
        response_batch_key = self._batch_key
        has_stage1_payload = True
        if dataset_id in self._registered_batches:
            summary = self._registered_batches[dataset_id]
            runtime = self._registered_batch_runtimes.get(dataset_id)
            if runtime is None:
                return AssetListResponse(
                    dataset_id=summary.dataset_id,
                    dataset_type=summary.dataset_type,
                    batch_key=summary.batch_key,
                    total=0,
                    items=[],
                )
            edited_histories = runtime.label_edits
            response_dataset_id = summary.dataset_id
            response_dataset_type = summary.dataset_type
            response_batch_key = summary.batch_key
            has_stage1_payload = runtime.stage1_run_name is not None
            items = [
                self._build_asset_item(sample, runtime.reviews.get(sample.sample_id, []))
                for sample in runtime.samples.values()
            ]
        else:
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
        if step1_status:
            if step1_status == "available":
                if not has_stage1_payload:
                    items = []
            elif step1_status == "missing":
                if has_stage1_payload:
                    items = []
        if step2_status:
            items = [item for item in items if item.stage2_status == step2_status]
        if model_decision:
            items = [item for item in items if item.judge_decision == model_decision]
        if confidence_min is not None:
            items = [
                item
                for item in items
                if item.highest_confidence is not None and item.highest_confidence >= confidence_min
            ]
        if confidence_max is not None:
            items = [
                item
                for item in items
                if item.highest_confidence is not None and item.highest_confidence <= confidence_max
            ]
        if media_status:
            if media_status == "invalid":
                items = []
            elif media_status != "valid":
                items = []
        if edited_status:
            edited_sample_ids = {sample_id for sample_id, history in edited_histories.items() if history}
            if edited_status == "edited":
                items = [item for item in items if item.sample_id in edited_sample_ids]
            elif edited_status == "unedited":
                items = [item for item in items if item.sample_id not in edited_sample_ids]

        items.sort(key=lambda item: item.sample_id)
        return AssetListResponse(
            dataset_id=response_dataset_id,
            dataset_type=response_dataset_type,
            batch_key=response_batch_key,
            total=len(items),
            items=items,
        )

    def get_asset_summary(self, dataset_id: str) -> AssetSummaryResponse:
        """Return batch-scoped summary metrics for asset browsing."""
        self._require_dataset(dataset_id)
        if dataset_id in self._registered_batches:
            summary = self._registered_batches[dataset_id]
            runtime = self._registered_batch_runtimes.get(dataset_id)
            if runtime is not None:
                items = [
                    self._build_asset_item(sample, runtime.reviews.get(sample.sample_id, []))
                    for sample in runtime.samples.values()
                ]
                total = len(items)
                review_submitted = sum(1 for item in items if item.qc_status == "reviewed")
                stage2_success = sum(1 for item in items if item.stage2_status == "success")
                judge_counter: Counter[str] = Counter(item.judge_decision for item in items)
                category_counter: Counter[str] = Counter()
                sample_category_counter: Counter[str] = Counter()
                qc_status_counter: Counter[str] = Counter(item.qc_status for item in items)
                for item in items:
                    category_counter.update(item.violation_categories)
                    sample_category_counter.update(item.sample_categories)
                return AssetSummaryResponse(
                    dataset_id=summary.dataset_id,
                    dataset_type=summary.dataset_type,
                    batch_key=summary.batch_key,
                    lifecycle_status=summary.lifecycle_status,
                    metrics=AssetSummaryMetrics(
                        total_assets=total,
                        media_valid_total=total,
                        media_invalid_total=0,
                        stage1_total=total if runtime.stage1_run_name is not None else 0,
                        stage2_success_total=stage2_success,
                        stage2_failure_total=runtime.stage2_failure_artifact_count,
                        review_pending_total=total - review_submitted,
                        review_submitted_total=review_submitted,
                        manual_edit_sample_total=sum(
                            1 for history in runtime.label_edits.values() if history
                        ),
                    ),
                    judge_decision_distribution=self._distribution(judge_counter, total),
                    category_distribution=self._distribution(category_counter),
                    sample_category_distribution=self._distribution(sample_category_counter),
                    qc_status_distribution=self._distribution(qc_status_counter, total),
                )
            return AssetSummaryResponse(
                dataset_id=summary.dataset_id,
                dataset_type=summary.dataset_type,
                batch_key=summary.batch_key,
                lifecycle_status=summary.lifecycle_status,
                metrics=AssetSummaryMetrics(
                    total_assets=summary.total_assets,
                    media_valid_total=summary.total_assets,
                    media_invalid_total=0,
                    stage1_total=summary.stage1_count,
                    stage2_success_total=summary.stage2_success_count,
                    stage2_failure_total=summary.stage2_failure_count,
                    review_pending_total=0,
                    review_submitted_total=0,
                    manual_edit_sample_total=0,
                ),
                judge_decision_distribution=[],
                category_distribution=[],
                sample_category_distribution=[],
                qc_status_distribution=[],
            )
        items = [self._build_asset_item(sample) for sample in self._samples.values()]
        total = len(items)
        review_submitted = sum(1 for item in items if item.qc_status == "reviewed")
        review_pending = total - review_submitted
        stage2_success = sum(1 for item in items if item.stage2_status == "success")
        stage2_failure = total - stage2_success
        edited_count = sum(1 for history in self._label_edits.values() if history)
        judge_counter: Counter[str] = Counter(item.judge_decision for item in items)
        category_counter: Counter[str] = Counter()
        sample_category_counter: Counter[str] = Counter()
        qc_status_counter: Counter[str] = Counter(item.qc_status for item in items)

        for item in items:
            category_counter.update(item.violation_categories)
            sample_category_counter.update(item.sample_categories)

        return AssetSummaryResponse(
            dataset_id=self._dataset_id,
            dataset_type=self._dataset_type,
            batch_key=self._batch_key,
            lifecycle_status=self._lifecycle_status,
            metrics=AssetSummaryMetrics(
                total_assets=total,
                media_valid_total=total,
                media_invalid_total=0,
                stage1_total=total,
                stage2_success_total=stage2_success,
                stage2_failure_total=stage2_failure,
                review_pending_total=review_pending,
                review_submitted_total=review_submitted,
                manual_edit_sample_total=edited_count,
            ),
            judge_decision_distribution=self._distribution(judge_counter, total),
            category_distribution=self._distribution(category_counter),
            sample_category_distribution=self._distribution(sample_category_counter),
            qc_status_distribution=self._distribution(qc_status_counter, total),
        )

    def get_asset_detail(
        self,
        dataset_id: str,
        sample_id: str,
        *,
        context: AuthContext | None = None,
    ) -> AssetDetailResponse:
        """Return detailed sample view including stage outputs and review history."""
        sample = self._require_sample(dataset_id, sample_id)
        runtime = self._registered_batch_runtimes.get(dataset_id)
        active_dataset_id = self._dataset_id
        response_dataset_id = self._dataset_id
        response_dataset_type = self._dataset_type
        response_batch_key = self._batch_key
        if runtime is not None:
            active_dataset_id = runtime.dataset_id
            response_dataset_id = runtime.dataset_id
            response_dataset_type = runtime.dataset_type
            response_batch_key = runtime.batch_key
            reviews = runtime.reviews.get(sample_id, [])
            label_edits = runtime.label_edits.get(sample_id, [])
        else:
            reviews = self._reviews[sample_id]
            label_edits = self._label_edits[sample_id]
        latest_review = reviews[-1] if reviews else None
        latest_label_edit = label_edits[-1] if label_edits else None
        assignment = self._state_store.get_assignment(active_dataset_id)
        task = self._task_map(active_dataset_id).get(sample_id)
        active_lease = self._active_lease_for_sample(active_dataset_id, sample_id)
        my_draft: LabelEditDraftResponse | None = None
        latest_submission: LabelEditSubmissionResponse | None = None
        current_user: CurrentUserResponse | None = None
        if context is not None:
            current_user = context.to_current_user_response()
            draft = self._state_store.get_draft(active_dataset_id, sample_id, context.user_id)
            if draft is not None:
                my_draft = self._to_draft_response(draft)
            submissions = self._state_store.list_submissions(active_dataset_id, sample_id)
            if submissions:
                latest_submission = self._to_submission_response(submissions[-1])
        return AssetDetailResponse(
            dataset_id=response_dataset_id,
            dataset_type=response_dataset_type,
            batch_key=response_batch_key,
            sample_id=sample_id,
            asset=self._build_asset_item(sample, reviews),
            stage1=sample.stage1,
            stage2=sample.stage2,
            stage2_failure=sample.stage2_failure,
            label_edit_state=latest_label_edit,
            label_edit_history=label_edits,
            current_user=current_user,
            batch_assignment=(
                self._to_assignment_response(assignment) if assignment is not None else None
            ),
            qc_task=self._to_task_response(task) if task is not None else None,
            sample_lease=self._to_lease_response(active_lease) if active_lease is not None else None,
            my_draft=my_draft,
            latest_submission=latest_submission,
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
        self._lifecycle_status = self._derive_lifecycle_status()
        return review

    def _get_import_job(self, dataset_id: str, job_id: str) -> ImportJob:
        self._require_dataset_or_type(dataset_id)
        job = self._import_jobs.get(job_id)
        if job is None:
            raise ImportJobNotFoundError(f"Import job not found: {job_id}")
        if not self._job_belongs_to_dataset(dataset_id, job):
            raise ImportJobNotFoundError(f"Import job not found: {job_id}")
        return job

    def _build_mapping_steps(self, job: ImportJob) -> list[ImportMappingStep]:
        if job.dataset_id != self._dataset_id:
            return [
                ImportMappingStep(id="raw", label="Raw assets", count=job.image_count, entity="RawAsset"),
                ImportMappingStep(
                    id="stage1",
                    label="Stage1 records",
                    count=job.stage1_file_count,
                    entity="PreAnnotationStep1",
                ),
                ImportMappingStep(
                    id="stage2",
                    label="Stage2 records",
                    count=job.stage2_file_count,
                    entity="PreAnnotationStep2",
                ),
                ImportMappingStep(
                    id="failures",
                    label="Stage2 failures",
                    count=job.stage2_failure_file_count or job.failure_count,
                    entity="PreAnnotationFailure",
                ),
                ImportMappingStep(
                    id="audit",
                    label="Import diagnostics",
                    count=len(job.warnings),
                    entity="AuditArtifact",
                ),
            ]

        stage2_success_count = sum(1 for sample in self._samples.values() if sample.stage2 is not None)
        return [
            ImportMappingStep(id="raw", label="Raw assets", count=job.imported_assets, entity="RawAsset"),
            ImportMappingStep(id="stage1", label="Stage1 records", count=job.imported_assets, entity="PreAnnotationStep1"),
            ImportMappingStep(id="stage2", label="Stage2 records", count=stage2_success_count, entity="PreAnnotationStep2"),
            ImportMappingStep(
                id="failures",
                label="Stage2 failures",
                count=job.failure_count,
                entity="PreAnnotationFailure",
            ),
            ImportMappingStep(
                id="audit",
                label="Import diagnostics",
                count=len(job.warnings),
                entity="AuditArtifact",
            ),
        ]

    def _build_import_job_status(self, job: ImportJob) -> ImportJobStatusResponse:
        fixture_job = job.dataset_id == self._dataset_id
        runtime = self._registered_batch_runtimes.get(job.dataset_id)
        stage2_success_count = (
            sum(1 for sample in self._samples.values() if sample.stage2 is not None)
            if fixture_job
            else sum(1 for sample in runtime.samples.values() if sample.stage2 is not None)
            if runtime is not None
            else job.stage2_file_count
        )
        lifecycle_status = (
            self._lifecycle_status
            if fixture_job
            else self._registered_batches.get(job.dataset_id, None).lifecycle_status
            if job.dataset_id in self._registered_batches
            else self._registered_batch_lifecycle(job)
        )
        if fixture_job:
            validation_rows = self._build_validation_rows()
        elif runtime is not None:
            validation_rows = self._build_registered_validation_rows(runtime)
        else:
            validation_rows = []
        payload = job.model_dump()
        payload.update(
            {
                "dataset_id": job.dataset_id,
                "dataset_type": job.dataset_type,
                "batch_key": job.batch_key,
                "lifecycle_status": lifecycle_status,
                "stage2_success_count": stage2_success_count,
                "warning_count": len(job.warnings),
                "warnings": job.warnings,
                "validation_rows": validation_rows,
                "mapping_steps": self._build_mapping_steps(job),
            }
        )
        return ImportJobStatusResponse(
            **payload
        )

    def list_import_jobs(self, dataset_id: str) -> list[ImportJobStatusResponse]:
        """List all import jobs for the current batch."""
        self._require_dataset_or_type(dataset_id)
        jobs = sorted(
            (job for job in self._import_jobs.values() if self._job_belongs_to_dataset(dataset_id, job)),
            key=lambda value: value.job_id,
        )
        return [self._build_import_job_status(job) for job in jobs]

    def create_import_job(
        self,
        dataset_id: str,
        request: ImportJobCreateRequest,
    ) -> ImportJobStatusResponse:
        """Create a draft import job or register a manual batch in memory and registry."""
        self._require_dataset_or_type(dataset_id)
        if request.batch_key:
            return self._create_registered_batch_import_job(dataset_id=dataset_id, request=request)

        self._import_job_counter += 1
        requested_sample_ids = request.requested_sample_ids or sorted(self._samples.keys())
        job = ImportJob(
            job_id=f"fixture-import-{self._batch_key}-{self._import_job_counter}",
            dataset_id=self._dataset_id,
            dataset_type=self._dataset_type,
            batch_key=self._batch_key,
            state=ImportJobState.DRAFT,
            expected_assets=len(requested_sample_ids),
            imported_assets=0,
            failure_count=0,
            requested_sample_ids=requested_sample_ids,
            validation_errors=[],
            warnings=[],
        )
        self._set_import_job(job)
        return self._build_import_job_status(job)

    def _create_registered_batch_import_job(
        self,
        *,
        dataset_id: str,
        request: ImportJobCreateRequest,
    ) -> ImportJobStatusResponse:
        dataset_type = request.dataset_type or (
            dataset_id if dataset_id in self._dataset_type_display_names else self._resolve_dataset_type(dataset_id)
        )
        if dataset_type not in self._dataset_type_display_names:
            raise DatasetNotFoundError(f"Dataset type not found: {dataset_type}")
        batch_key = request.batch_key or ""
        batch_dataset_id = f"{dataset_type}__{batch_key}"
        if batch_dataset_id == self._dataset_id or batch_dataset_id in self._registered_batches:
            raise ValueError(f"Dataset batch already exists: {batch_dataset_id}")

        self._import_job_counter += 1
        image_count = request.image_count or len(request.requested_sample_ids)
        job = ImportJob(
            job_id=f"manual-import-{dataset_type}-{batch_key}-{self._import_job_counter}",
            dataset_id=batch_dataset_id,
            dataset_type=dataset_type,
            batch_key=batch_key,
            batch_name=request.batch_name,
            source_mode=request.source_mode,
            source_uri=request.source_uri,
            source_structure=request.source_structure,
            description=request.description,
            source_file_count=request.source_file_count,
            image_count=image_count,
            stage1_file_count=request.stage1_file_count,
            stage2_file_count=request.stage2_file_count,
            stage2_failure_file_count=request.stage2_failure_file_count,
            state=ImportJobState.DRAFT,
            expected_assets=image_count,
            imported_assets=0,
            failure_count=request.stage2_failure_file_count,
            requested_sample_ids=request.requested_sample_ids,
            validation_errors=[],
            warnings=[],
        )
        now = datetime.now(timezone.utc)
        summary = DatasetSummaryResponse(
            dataset_id=batch_dataset_id,
            dataset_type=dataset_type,
            display_name=self._dataset_type_display_names[dataset_type],
            field_schema_version=self._dataset_type_schema_versions.get(dataset_type, "draft"),
            active_label_config_version=self._current_active_label_config_version(dataset_type),
            batch_key=batch_key,
            lifecycle_status=DatasetLifecycleStatus.REGISTERED,
            active_import_job_id=job.job_id,
            qc_queue_id=None,
            legacy_dataset_id=None,
            source_mode=request.source_mode,
            source_uri=request.source_uri,
            source_structure=request.source_structure,
            source_file_count=request.source_file_count,
            name=request.batch_name or batch_key,
            total_assets=image_count,
            stage1_count=request.stage1_file_count,
            stage2_success_count=request.stage2_file_count,
            stage2_failure_count=request.stage2_failure_file_count,
            reviewed_count=0,
            created_at=now,
            fact_verification_count=0,
            candidate_count=0,
            judge_decision_distribution=[],
            category_distribution=[],
            verification_distribution=[],
            confidence_distribution=[],
            visibility_distribution=[],
            sample_category_distribution=[],
        )
        runtime: RegisteredBatchRuntime | None = None
        runtime_warnings: list[str] = []
        try:
            runtime = self._build_registered_batch_runtime(summary=summary, job=job)
        except (FileNotFoundError, KeyError, ValueError, OSError) as exc:
            runtime_warnings.append(f"Source directory could not be ingested: {exc}")

        if runtime is not None:
            actual_total = len(runtime.samples)
            actual_stage1 = actual_total if runtime.stage1_run_name is not None else 0
            actual_stage2_success = sum(
                1 for sample in runtime.samples.values() if sample.stage2 is not None
            )
            actual_stage2_failures = runtime.stage2_failure_artifact_count
            if request.source_structure == "images_only":
                runtime_warnings.append(
                    "Batch contains images only; STEP1/STEP2 pre-annotation is required before QC."
                )
            elif actual_stage2_failures:
                runtime_warnings.append(
                    f"Detected {actual_stage2_failures} STEP2 failure artifacts; preserved as import diagnostics."
                )
            job = job.model_copy(
                update={
                    "state": ImportJobState.IMPORTED,
                    "expected_assets": actual_total,
                    "imported_assets": actual_total,
                    "image_count": actual_total,
                    "stage1_file_count": actual_stage1,
                    "stage2_file_count": actual_stage2_success,
                    "stage2_failure_file_count": actual_stage2_failures,
                    "failure_count": actual_stage2_failures,
                    "warnings": runtime_warnings,
                    "validation_errors": [],
                }
            )
            summary = summary.model_copy(
                update={
                    "lifecycle_status": self._registered_batch_lifecycle(job),
                    "total_assets": actual_total,
                    "stage1_count": actual_stage1,
                    "stage2_success_count": actual_stage2_success,
                    "stage2_failure_count": actual_stage2_failures,
                }
            )
        elif request.source_uri and not runtime_warnings:
            runtime_warnings.append(
                "Source directory was registered but is not readable by the backend; "
                "asset ingestion will remain pending until the server can access it."
            )
            job = job.model_copy(update={"warnings": runtime_warnings})

        self._accepted_dataset_ids.add(batch_dataset_id)
        self._registered_batches[batch_dataset_id] = summary
        if runtime is not None:
            self._registered_batch_runtimes[batch_dataset_id] = runtime
        self._import_jobs[job.job_id] = job
        self._persist_registered_batches()
        return self._build_import_job_status(job)

    def get_import_job(self, dataset_id: str, job_id: str) -> ImportJobStatusResponse:
        """Fetch one import job state for current batch."""
        job = self._get_import_job(dataset_id=dataset_id, job_id=job_id)
        return self._build_import_job_status(job)

    def scan_import_job(self, dataset_id: str, job_id: str) -> ImportJobStatusResponse:
        """Execute scan phase; records interim state only."""
        job = self._get_import_job(dataset_id=dataset_id, job_id=job_id)
        scanned = job.model_copy(update={"state": ImportJobState.SCANNING, "imported_assets": 0})
        if scanned.dataset_id == self._dataset_id:
            self._set_import_job(scanned)
        else:
            self._import_jobs[scanned.job_id] = scanned
            self._update_registered_batch_from_job(scanned)
        return self._build_import_job_status(scanned)

    def validate_import_job(self, dataset_id: str, job_id: str) -> ImportJobStatusResponse:
        """Execute validate phase; STEP2 failures are non-blocking warnings."""
        job = self._get_import_job(dataset_id=dataset_id, job_id=job_id)
        if job.dataset_id != self._dataset_id:
            warnings: list[str] = []
            if job.source_structure == "images_only":
                warnings.append("Batch contains images only; STEP1/STEP2 pre-annotation is required before QC.")
            elif job.stage2_failure_file_count:
                warnings.append(
                    f"Detected {job.stage2_failure_file_count} STEP2 failure artifacts; preserved as import diagnostics."
                )
            validated = job.model_copy(
                update={
                    "state": ImportJobState.VALIDATION_PASSED,
                    "failure_count": job.stage2_failure_file_count,
                    "warnings": warnings,
                    "validation_errors": [],
                }
            )
            self._import_jobs[validated.job_id] = validated
            self._update_registered_batch_from_job(validated)
            return self._build_import_job_status(validated)

        validated = job.model_copy(
            update={
                "state": ImportJobState.VALIDATION_PASSED,
                "failure_count": self._bundle.dataset.stage2_failure_count,
                "warnings": self._build_stage2_warning_messages(),
                "validation_errors": [],
            }
        )
        self._set_import_job(validated)
        return self._build_import_job_status(validated)

    def confirm_import_job(self, dataset_id: str, job_id: str) -> ImportJobStatusResponse:
        """Execute confirm/import phase and persist as latest batch import."""
        job = self._get_import_job(dataset_id=dataset_id, job_id=job_id)
        if job.dataset_id != self._dataset_id:
            confirmed = job.model_copy(
                update={
                    "state": ImportJobState.IMPORTED,
                    "imported_assets": job.image_count or job.expected_assets,
                    "failure_count": job.stage2_failure_file_count,
                    "validation_errors": [],
                }
            )
            self._import_jobs[confirmed.job_id] = confirmed
            self._update_registered_batch_from_job(confirmed)
            return self._build_import_job_status(confirmed)

        confirmed = job.model_copy(
            update={
                "state": ImportJobState.IMPORTED,
                "imported_assets": len(self._samples),
                "failure_count": self._bundle.dataset.stage2_failure_count,
                "warnings": self._build_stage2_warning_messages(),
                "validation_errors": [],
            }
        )
        self._set_import_job(confirmed)
        return self._build_import_job_status(confirmed)

    def retry_import_job(self, dataset_id: str, job_id: str) -> ImportJobStatusResponse:
        """Reset one job to draft for a new scan/validate/confirm round."""
        job = self._get_import_job(dataset_id=dataset_id, job_id=job_id)
        retried = job.model_copy(
            update={
                "state": ImportJobState.DRAFT,
                "imported_assets": 0,
                "warnings": [],
                "validation_errors": [],
            }
        )
        if retried.dataset_id == self._dataset_id:
            self._set_import_job(retried)
        else:
            self._import_jobs[retried.job_id] = retried
            self._update_registered_batch_from_job(retried)
        return self._build_import_job_status(retried)

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
                stage2_path = f"{self._stage2_run_dir.name}/{pair.stage2.parsed_path}"
                status = "ready"
            elif pair.stage2 is not None and hasattr(pair.stage2, "failure_path"):
                failure_path = f"{self._stage2_run_dir.name}/{pair.stage2.failure_path}"
                status = "stage2_failed"
            rows.append(
                ImportValidationRow(
                    sample_id=sample.sample_id,
                    image_path=f"images/{image_name}",
                    stage1_path=f"{self._stage1_run_dir.name}/{pair.stage1.parsed_path}",
                    stage2_path=stage2_path,
                    failure_path=failure_path,
                    status=status,
                )
            )
        return rows

    def _build_registered_validation_rows(
        self,
        runtime: RegisteredBatchRuntime,
    ) -> list[ImportValidationRow]:
        """Build import validation rows for a manually ingested batch."""
        rows: list[ImportValidationRow] = []
        for sample in sorted(runtime.samples.values(), key=lambda value: value.sample_id):
            image_name = Path(sample.raw_asset.source_image_path_internal).name
            pair = runtime.pairs.get(sample.sample_id)
            stage1_path: str | None = None
            stage2_path: str | None = None
            failure_path: str | None = None
            status: str = "stage2_missing"
            if pair is not None and runtime.stage1_run_name is not None:
                stage1_path = f"{runtime.stage1_run_name}/{pair.stage1.parsed_path}"
            if pair is not None and runtime.stage2_run_name is not None:
                if pair.stage2 is not None and hasattr(pair.stage2, "parsed_path"):
                    stage2_path = f"{runtime.stage2_run_name}/{pair.stage2.parsed_path}"
                    status = "ready"
                elif pair.stage2 is not None and hasattr(pair.stage2, "failure_path"):
                    failure_path = f"{runtime.stage2_run_name}/{pair.stage2.failure_path}"
                    status = "stage2_failed"
            rows.append(
                ImportValidationRow(
                    sample_id=sample.sample_id,
                    image_path=f"images/{image_name}",
                    stage1_path=stage1_path,
                    stage2_path=stage2_path,
                    failure_path=failure_path,
                    status=status,  # type: ignore[arg-type]
                )
            )
        return rows

    def list_qc_queue(
        self,
        dataset_id: str,
        *,
        context: AuthContext | None = None,
    ) -> QCQueueResponse:
        """Return QC queue built from loaded fixture samples."""
        self._require_dataset(dataset_id)
        if context is not None:
            self._require_permission(context=context, action="qc_queue:read", dataset_id=dataset_id)
        if dataset_id in self._registered_batches:
            summary = self._registered_batches[dataset_id]
            runtime = self._registered_batch_runtimes.get(dataset_id)
            if summary.qc_queue_id is None:
                return QCQueueResponse(
                    dataset_id=summary.dataset_id,
                    dataset_type=summary.dataset_type,
                    batch_key=summary.batch_key,
                    qc_queue_id=self._queue_id_for_dataset(dataset_id),
                    assignment=None,
                    total=0,
                    items=[],
                )
            active_dataset_id = self._effective_batch_dataset_id(dataset_id)
            task_map = self._task_map(active_dataset_id)
            assignment = self._state_store.get_assignment(active_dataset_id)
            label_config_version: str | None = None
            try:
                label_config_version = self._label_config_repo.get_active(
                    dataset_id=summary.dataset_type
                ).version
            except ActiveLabelConfigNotFoundError:
                label_config_version = None
            items: list[QCQueueItem] = []
            if runtime is not None:
                for sample in sorted(runtime.samples.values(), key=lambda value: value.sample_id):
                    asset = self._build_asset_item(sample, runtime.reviews.get(sample.sample_id, []))
                    task = task_map.get(sample.sample_id)
                    active_lease = self._active_lease_for_sample(active_dataset_id, sample.sample_id)
                    items.append(
                        QCQueueItem(
                            qc_queue_id=summary.qc_queue_id or self._queue_id_for_dataset(dataset_id),
                            dataset_id=active_dataset_id,
                            dataset_type=summary.dataset_type,
                            batch_key=summary.batch_key,
                            label_config_version=label_config_version,
                            sample_id=sample.sample_id,
                            asset_id=sample.raw_asset.asset_id,
                            judge_decision=sample.stage1.judge_decision,
                            stage2_status="success" if sample.stage2 is not None else "failure",
                            qc_status="reviewed" if runtime.reviews.get(sample.sample_id) else "pending",
                            primary_category=asset.violation_categories[0] if asset.violation_categories else "",
                            highest_confidence=asset.highest_confidence,
                            stage2_failure=sample.stage2 is None,
                            updated_at=asset.updated_at,
                            task_status=task.status if task is not None else QcTaskStatus.QUEUED,
                            assignee_user_id=task.assignee_user_id if task is not None else None,
                            active_lease_user_id=active_lease.user_id if active_lease is not None else None,
                            latest_submission_id=(task.latest_submission_id if task is not None else None),
                        )
                    )
            return QCQueueResponse(
                dataset_id=summary.dataset_id,
                dataset_type=summary.dataset_type,
                batch_key=summary.batch_key,
                qc_queue_id=summary.qc_queue_id or f"qcq_{summary.dataset_type}_{summary.batch_key}",
                assignment=(self._to_assignment_response(assignment) if assignment else None),
                total=len(items),
                items=items,
            )
        label_config_version: str | None = None
        try:
            label_config_version = self._label_config_repo.get_active(
                dataset_id=self._dataset_type
            ).version
        except ActiveLabelConfigNotFoundError:
            label_config_version = None
        task_map = self._task_map(self._dataset_id)
        assignment = self._state_store.get_assignment(self._dataset_id)
        items: list[QCQueueItem] = []
        for sample in sorted(self._samples.values(), key=lambda value: value.sample_id):
            asset = self._build_asset_item(sample)
            task = task_map.get(sample.sample_id)
            active_lease = self._active_lease_for_sample(self._dataset_id, sample.sample_id)
            items.append(
                QCQueueItem(
                    qc_queue_id=self._qc_queue_id,
                    dataset_id=self._dataset_id,
                    dataset_type=self._dataset_type,
                    batch_key=self._batch_key,
                    label_config_version=label_config_version,
                    sample_id=sample.sample_id,
                    asset_id=sample.raw_asset.asset_id,
                    judge_decision=sample.stage1.judge_decision,
                    stage2_status="success" if sample.stage2 is not None else "failure",
                    qc_status="reviewed" if self._reviews[sample.sample_id] else "pending",
                    primary_category=asset.violation_categories[0] if asset.violation_categories else "",
                    highest_confidence=asset.highest_confidence,
                    stage2_failure=sample.stage2 is None,
                    updated_at=asset.updated_at,
                    task_status=task.status if task is not None else QcTaskStatus.QUEUED,
                    assignee_user_id=task.assignee_user_id if task is not None else None,
                    active_lease_user_id=active_lease.user_id if active_lease is not None else None,
                    latest_submission_id=(task.latest_submission_id if task is not None else None),
                )
            )
        return QCQueueResponse(
            dataset_id=self._dataset_id,
            dataset_type=self._dataset_type,
            batch_key=self._batch_key,
            qc_queue_id=self._qc_queue_id,
            assignment=(self._to_assignment_response(assignment) if assignment else None),
            total=len(items),
            items=items,
        )

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

    def resolve_media_file(
        self,
        media_kind: str,
        file_name: str,
        dataset_id: str | None = None,
    ) -> Path:
        """Resolve a requested media file path with traversal-safe constraints."""
        if not file_name or Path(file_name).name != file_name:
            raise MediaAccessError("Invalid media filename")

        runtime = self._registered_batch_runtimes.get(dataset_id or "")
        if media_kind == "images":
            root = runtime.image_dir if runtime is not None else self._image_dir
            candidate = root / file_name
        elif media_kind == "visualizations":
            root = (
                runtime.visualizations_dir
                if runtime is not None and runtime.visualizations_dir is not None
                else self._visualizations_dir
            )
            sample_id = Path(file_name).stem
            pair = runtime.pairs.get(sample_id) if runtime is not None else self._pairs.get(sample_id)
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
    label_config_store_root: Path | None = None,
    platform_state_root: Path | None = None,
) -> FixtureRuntimeService:
    """Factory for runtime service with deterministic defaults."""
    env_store_root = os.environ.get("LABEL_CONFIG_STORE_ROOT")
    resolved_store_root = label_config_store_root or (Path(env_store_root) if env_store_root else None)
    return FixtureRuntimeService(
        dataset_root=dataset_root,
        sample_ids=sample_ids,
        label_config_store_root=resolved_store_root,
        platform_state_root=platform_state_root,
    )

"""FastAPI routes for the offline validation/QC workbench."""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse

from urban_violation_backend.api_schemas import (
    AssetDetailResponse,
    BatchAssignmentActionRequest,
    BatchAssignmentRequest,
    BatchDraftSaveRequest,
    BatchDraftSummaryResponse,
    BatchQcAssignmentResponse,
    BatchSubmitRequest,
    BatchSubmitResponse,
    CurrentUserResponse,
    ErrorResponse,
    HealthResponse,
    ImportJobCreateRequest,
    ImportJobStatusResponse,
    LabelEditDraftResponse,
    LabelEditSubmissionResponse,
    LabelEditSubmitRequest,
    LabelEditSubmitResponse,
    LabelEditValidateRequest,
    LabelEditValidationResponse,
    LeaseAcquireResponse,
    QCQueueResponse,
    QcTaskResponse,
    SampleLeaseResponse,
    UserAccountResponse,
    DatasetTypeResponse,
)
from urban_violation_backend.errors import ApiError
from urban_violation_backend.labels import LabelSuggestionResponse, StoredLabelConfig
from urban_violation_backend.service import (
    ActiveLabelConfigAccessError,
    ArchiveUploadError,
    DatasetNotFoundError,
    FixtureRuntimeService,
    ImportJobNotFoundError,
    LabelConfigPersistenceAccessError,
    LabelConfigVersionAccessError,
    LabelEditValidationFailedError,
    LabelFieldAccessError,
    MediaAccessError,
    SampleNotFoundError,
)


def build_router(service: FixtureRuntimeService) -> APIRouter:
    """Build the offline API router with injected runtime service."""
    router = APIRouter()

    def get_service() -> FixtureRuntimeService:
        return service

    def get_context(
        request: Request,
        runtime: FixtureRuntimeService = Depends(get_service),
    ):
        return runtime.resolve_auth_context(request)

    @router.get("/health", response_model=HealthResponse, response_model_exclude_none=True)
    async def health(runtime: FixtureRuntimeService = Depends(get_service)) -> HealthResponse:
        return HealthResponse(
            status="ok",
            dataset_id=runtime.dataset_id,
            mode=runtime.runtime_mode,
            data_root=(
                str(runtime.data_root)
                if runtime.runtime_mode == "offline_single_user" and os.environ.get("OFFLINE_DATA_ROOT")
                else None
            ),
            state_root=str(runtime.state_root) if runtime.runtime_mode == "offline_single_user" else None,
        )

    @router.get("/api/me", response_model=CurrentUserResponse)
    async def me(context=Depends(get_context)) -> CurrentUserResponse:
        return context.to_current_user_response()

    @router.get("/api/dataset-types/{dataset_type}", response_model=DatasetTypeResponse)
    async def get_dataset_type(
        dataset_type: str,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> DatasetTypeResponse:
        try:
            return runtime.get_dataset_type(dataset_type)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.get("/api/datasets/{dataset_id}/label-config/active", response_model=StoredLabelConfig)
    async def active_label_config(
        dataset_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> StoredLabelConfig:
        try:
            return runtime.get_active_label_config(dataset_id=dataset_id)
        except (DatasetNotFoundError, LabelConfigVersionAccessError, LabelConfigPersistenceAccessError) as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.get("/api/dataset-types/{dataset_type}/label-config/active", response_model=StoredLabelConfig)
    async def active_type_label_config(
        dataset_type: str,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> StoredLabelConfig:
        try:
            return runtime.get_active_label_config(dataset_id=dataset_type)
        except (DatasetNotFoundError, LabelConfigVersionAccessError, LabelConfigPersistenceAccessError) as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.get("/api/datasets/{dataset_id}/label-suggestions", response_model=list[LabelSuggestionResponse])
    async def label_suggestions(
        dataset_id: str,
        field: str = Query(..., min_length=1, max_length=120),
        query: str = Query(default="", max_length=120),
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> list[LabelSuggestionResponse]:
        try:
            return runtime.get_label_suggestions(dataset_id=dataset_id, field=field, query=query)
        except (DatasetNotFoundError, LabelFieldAccessError) as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.post(
        "/api/datasets/{dataset_id}/import-jobs/archive",
        response_model=ImportJobStatusResponse,
        status_code=status.HTTP_201_CREATED,
    )
    async def create_import_job_from_archive(
        dataset_id: str,
        request: Request,
        batch_key: str = Query(..., min_length=1, max_length=80, pattern=r"^[a-zA-Z0-9_\-]+$"),
        batch_name: str | None = Query(default=None, min_length=1, max_length=120),
        dataset_type: str | None = Query(default=None, min_length=1, max_length=80, pattern=r"^[a-z][a-z0-9_]*$"),
        source_structure: str | None = Query(default=None, pattern=r"^(images_only|images_with_preannotations)$"),
        description: str | None = Query(default=None, max_length=500),
        archive_file_name: str | None = Query(default=None, max_length=255),
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> ImportJobStatusResponse:
        try:
            runtime.require_permission_for_action(context=context, action="import_job:manage", dataset_id=dataset_id)
            archive_path = runtime.prepare_import_archive_upload_path(
                dataset_id=dataset_id,
                dataset_type=dataset_type,
                batch_key=batch_key,
                archive_file_name=archive_file_name,
            )
            tmp_path = archive_path.with_name(f".{archive_path.name}.uploading")
            bytes_written = 0
            max_bytes = runtime.max_import_archive_bytes()
            try:
                with tmp_path.open("wb") as target:
                    async for chunk in request.stream():
                        if not chunk:
                            continue
                        bytes_written += len(chunk)
                        if bytes_written > max_bytes:
                            raise ArchiveUploadError("Uploaded archive exceeds the configured size limit.")
                        target.write(chunk)
                if bytes_written == 0:
                    raise ArchiveUploadError("Uploaded archive is empty.")
                tmp_path.replace(archive_path)
            except Exception:
                tmp_path.unlink(missing_ok=True)
                raise
            payload = ImportJobCreateRequest(
                dataset_type=dataset_type,
                batch_key=batch_key,
                batch_name=batch_name,
                source_mode="uploaded_package",
                source_structure=source_structure,
                description=description,
            )
            return runtime.create_import_job_from_archive(dataset_id=dataset_id, request=payload, archive_path=archive_path)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except ArchiveUploadError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    @router.get("/api/datasets/{dataset_id}/import-jobs/{job_id}", response_model=ImportJobStatusResponse)
    async def import_job_status(
        dataset_id: str,
        job_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> ImportJobStatusResponse:
        try:
            return runtime.get_import_job(dataset_id=dataset_id, job_id=job_id)
        except (DatasetNotFoundError, ImportJobNotFoundError) as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    def import_job_action(action: str, dataset_id: str, job_id: str, runtime: FixtureRuntimeService, context):
        runtime.require_permission_for_action(context=context, action="import_job:manage", dataset_id=dataset_id)
        try:
            if action == "scan":
                return runtime.scan_import_job(dataset_id=dataset_id, job_id=job_id)
            if action == "validate":
                return runtime.validate_import_job(dataset_id=dataset_id, job_id=job_id)
            if action == "confirm":
                return runtime.confirm_import_job(dataset_id=dataset_id, job_id=job_id)
            return runtime.retry_import_job(dataset_id=dataset_id, job_id=job_id)
        except (DatasetNotFoundError, ImportJobNotFoundError) as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.post("/api/datasets/{dataset_id}/import-jobs/{job_id}/scan", response_model=ImportJobStatusResponse)
    async def scan_import_job(dataset_id: str, job_id: str, runtime: FixtureRuntimeService = Depends(get_service), context=Depends(get_context)):
        return import_job_action("scan", dataset_id, job_id, runtime, context)

    @router.post("/api/datasets/{dataset_id}/import-jobs/{job_id}/validate", response_model=ImportJobStatusResponse)
    async def validate_import_job(dataset_id: str, job_id: str, runtime: FixtureRuntimeService = Depends(get_service), context=Depends(get_context)):
        return import_job_action("validate", dataset_id, job_id, runtime, context)

    @router.post("/api/datasets/{dataset_id}/import-jobs/{job_id}/confirm", response_model=ImportJobStatusResponse)
    async def confirm_import_job(dataset_id: str, job_id: str, runtime: FixtureRuntimeService = Depends(get_service), context=Depends(get_context)):
        return import_job_action("confirm", dataset_id, job_id, runtime, context)

    @router.post("/api/datasets/{dataset_id}/import-jobs/{job_id}/retry", response_model=ImportJobStatusResponse)
    async def retry_import_job(dataset_id: str, job_id: str, runtime: FixtureRuntimeService = Depends(get_service), context=Depends(get_context)):
        return import_job_action("retry", dataset_id, job_id, runtime, context)

    @router.get("/api/datasets/{dataset_id}/qc", response_model=QCQueueResponse)
    async def qc_queue(dataset_id: str, runtime: FixtureRuntimeService = Depends(get_service), context=Depends(get_context)) -> QCQueueResponse:
        try:
            return runtime.list_qc_queue(dataset_id=dataset_id, context=context)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.post("/api/datasets/{dataset_id}/qc/generate", response_model=QCQueueResponse)
    async def generate_qc_queue(dataset_id: str, runtime: FixtureRuntimeService = Depends(get_service), context=Depends(get_context)) -> QCQueueResponse:
        try:
            return runtime.generate_qc_queue(dataset_id=dataset_id, context=context)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.get("/api/datasets/{dataset_id}/qc/assignable-users", response_model=list[UserAccountResponse])
    async def qc_assignable_users(dataset_id: str, runtime: FixtureRuntimeService = Depends(get_service), context=Depends(get_context)) -> list[UserAccountResponse]:
        return runtime.list_assignable_users(dataset_id=dataset_id, context=context)

    @router.get("/api/datasets/{dataset_id}/qc/assignment", response_model=BatchQcAssignmentResponse | None)
    async def get_batch_assignment(dataset_id: str, runtime: FixtureRuntimeService = Depends(get_service), context=Depends(get_context)) -> BatchQcAssignmentResponse | None:
        return runtime.get_batch_assignment(dataset_id=dataset_id, context=context)

    @router.post("/api/datasets/{dataset_id}/qc/assignment", response_model=BatchQcAssignmentResponse)
    async def assign_batch(dataset_id: str, payload: BatchAssignmentRequest, runtime: FixtureRuntimeService = Depends(get_service), context=Depends(get_context)) -> BatchQcAssignmentResponse:
        return runtime.assign_batch(dataset_id=dataset_id, request=payload, context=context, allow_reassign=False)

    @router.post("/api/datasets/{dataset_id}/qc/assignment/reassign", response_model=BatchQcAssignmentResponse)
    async def reassign_batch(dataset_id: str, payload: BatchAssignmentActionRequest, runtime: FixtureRuntimeService = Depends(get_service), context=Depends(get_context)) -> BatchQcAssignmentResponse:
        if payload.assignee_user_id is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="assignee_user_id is required")
        return runtime.assign_batch(
            dataset_id=dataset_id,
            request=BatchAssignmentRequest(assignee_user_id=payload.assignee_user_id),
            context=context,
            allow_reassign=True,
        )

    @router.post("/api/datasets/{dataset_id}/qc/assignment/release", response_model=BatchQcAssignmentResponse)
    async def release_batch_assignment(
        dataset_id: str,
        payload: BatchAssignmentActionRequest | None = None,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> BatchQcAssignmentResponse:
        return runtime.release_batch_assignment(
            dataset_id=dataset_id,
            context=context,
            reason=(payload.reason if payload is not None else None),
        )

    @router.get("/api/datasets/{dataset_id}/qc/tasks", response_model=list[QcTaskResponse])
    async def list_qc_tasks(dataset_id: str, runtime: FixtureRuntimeService = Depends(get_service), context=Depends(get_context)) -> list[QcTaskResponse]:
        return runtime.list_qc_tasks(dataset_id=dataset_id, context=context)

    @router.get("/api/datasets/{dataset_id}/samples/{sample_id}/review", response_model=AssetDetailResponse)
    async def review_detail(dataset_id: str, sample_id: str, runtime: FixtureRuntimeService = Depends(get_service), context=Depends(get_context)) -> AssetDetailResponse:
        try:
            return runtime.get_asset_detail(dataset_id=dataset_id, sample_id=sample_id, context=context)
        except (DatasetNotFoundError, SampleNotFoundError) as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.post("/api/datasets/{dataset_id}/samples/{sample_id}/lease", response_model=LeaseAcquireResponse)
    async def acquire_lease(dataset_id: str, sample_id: str, runtime: FixtureRuntimeService = Depends(get_service), context=Depends(get_context)) -> LeaseAcquireResponse:
        return runtime.acquire_sample_lease(dataset_id=dataset_id, sample_id=sample_id, context=context)

    @router.post("/api/datasets/{dataset_id}/samples/{sample_id}/lease/{lease_id}/heartbeat", response_model=SampleLeaseResponse)
    async def heartbeat_lease(dataset_id: str, sample_id: str, lease_id: str, runtime: FixtureRuntimeService = Depends(get_service), context=Depends(get_context)) -> SampleLeaseResponse:
        return runtime.heartbeat_sample_lease(dataset_id=dataset_id, sample_id=sample_id, lease_id=lease_id, context=context)

    @router.post("/api/datasets/{dataset_id}/samples/{sample_id}/lease/{lease_id}/release", response_model=SampleLeaseResponse)
    async def release_lease(dataset_id: str, sample_id: str, lease_id: str, runtime: FixtureRuntimeService = Depends(get_service), context=Depends(get_context)) -> SampleLeaseResponse:
        return runtime.release_sample_lease(dataset_id=dataset_id, sample_id=sample_id, lease_id=lease_id, context=context)

    @router.post("/api/datasets/{dataset_id}/samples/{sample_id}/label-edits/validate", response_model=LabelEditValidationResponse)
    async def validate_label_edits(dataset_id: str, sample_id: str, payload: LabelEditValidateRequest, runtime: FixtureRuntimeService = Depends(get_service)) -> LabelEditValidationResponse:
        try:
            return runtime.validate_label_edits(dataset_id=dataset_id, sample_id=sample_id, request=payload)
        except (DatasetNotFoundError, SampleNotFoundError, ActiveLabelConfigAccessError) as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.post("/api/datasets/{dataset_id}/samples/{sample_id}/label-edits", response_model=LabelEditSubmitResponse)
    async def submit_label_edits(
        dataset_id: str,
        sample_id: str,
        payload: LabelEditSubmitRequest,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> LabelEditSubmitResponse:
        try:
            return runtime.submit_label_edits(dataset_id=dataset_id, sample_id=sample_id, request=payload, context=context)
        except (DatasetNotFoundError, SampleNotFoundError, ActiveLabelConfigAccessError) as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except LabelEditValidationFailedError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=exc.report.model_dump(mode="json")) from exc
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc

    @router.get("/api/datasets/{dataset_id}/samples/{sample_id}/label-edits/my-draft", response_model=LabelEditDraftResponse | None)
    async def my_draft(dataset_id: str, sample_id: str, runtime: FixtureRuntimeService = Depends(get_service), context=Depends(get_context)) -> LabelEditDraftResponse | None:
        return runtime.get_my_draft(dataset_id=dataset_id, sample_id=sample_id, context=context)

    @router.get("/api/datasets/{dataset_id}/samples/{sample_id}/label-edits/history", response_model=list[LabelEditSubmissionResponse])
    async def label_edit_history(dataset_id: str, sample_id: str, runtime: FixtureRuntimeService = Depends(get_service), context=Depends(get_context)) -> list[LabelEditSubmissionResponse]:
        return runtime.get_label_edit_history(dataset_id=dataset_id, sample_id=sample_id, context=context)

    @router.get("/api/datasets/{dataset_id}/label-edits/my-batch-draft", response_model=BatchDraftSummaryResponse)
    async def my_batch_draft(dataset_id: str, runtime: FixtureRuntimeService = Depends(get_service), context=Depends(get_context)) -> BatchDraftSummaryResponse:
        try:
            return runtime.get_my_batch_draft(dataset_id=dataset_id, context=context)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.put("/api/datasets/{dataset_id}/label-edits/my-batch-draft", response_model=BatchDraftSummaryResponse)
    async def save_batch_draft(dataset_id: str, payload: BatchDraftSaveRequest, runtime: FixtureRuntimeService = Depends(get_service), context=Depends(get_context)) -> BatchDraftSummaryResponse:
        try:
            return runtime.save_my_batch_draft(dataset_id=dataset_id, request=payload, context=context, source="manual")
        except (DatasetNotFoundError, SampleNotFoundError) as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.post("/api/datasets/{dataset_id}/label-edits/my-batch-draft/autosave", response_model=BatchDraftSummaryResponse)
    async def autosave_batch_draft(dataset_id: str, payload: BatchDraftSaveRequest, runtime: FixtureRuntimeService = Depends(get_service), context=Depends(get_context)) -> BatchDraftSummaryResponse:
        try:
            return runtime.save_my_batch_draft(dataset_id=dataset_id, request=payload, context=context, source="autosave")
        except (DatasetNotFoundError, SampleNotFoundError) as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.post("/api/datasets/{dataset_id}/label-edits/submit-batch", response_model=BatchSubmitResponse)
    async def submit_batch_label_edits(dataset_id: str, payload: BatchSubmitRequest, runtime: FixtureRuntimeService = Depends(get_service), context=Depends(get_context)) -> BatchSubmitResponse:
        try:
            return runtime.submit_label_edit_batch(dataset_id=dataset_id, request=payload, context=context)
        except (DatasetNotFoundError, ActiveLabelConfigAccessError) as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except LabelEditValidationFailedError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=exc.report.model_dump(mode="json")) from exc
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc

    @router.post("/api/datasets/{dataset_id}/samples/{sample_id}/label-edits/{submission_id}/confirm", response_model=LabelEditSubmissionResponse)
    async def confirm_submission(dataset_id: str, sample_id: str, submission_id: str, runtime: FixtureRuntimeService = Depends(get_service), context=Depends(get_context)) -> LabelEditSubmissionResponse:
        return runtime.confirm_submission(dataset_id=dataset_id, sample_id=sample_id, submission_id=submission_id, context=context)

    @router.post("/api/datasets/{dataset_id}/samples/{sample_id}/label-edits/{submission_id}/return", response_model=LabelEditSubmissionResponse)
    async def return_submission(dataset_id: str, sample_id: str, submission_id: str, runtime: FixtureRuntimeService = Depends(get_service), context=Depends(get_context)) -> LabelEditSubmissionResponse:
        return runtime.return_submission(dataset_id=dataset_id, sample_id=sample_id, submission_id=submission_id, context=context)

    @router.get("/media/images/{file_name}")
    async def media_image(file_name: str, dataset_id: str | None = Query(default=None), runtime: FixtureRuntimeService = Depends(get_service)) -> FileResponse:
        try:
            return FileResponse(runtime.resolve_media_file("images", file_name, dataset_id=dataset_id))
        except MediaAccessError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.get("/api/datasets/{dataset_id}/media/images/{file_name}")
    async def dataset_media_image(dataset_id: str, file_name: str, runtime: FixtureRuntimeService = Depends(get_service)) -> FileResponse:
        try:
            return FileResponse(runtime.resolve_media_file("images", file_name, dataset_id=dataset_id))
        except MediaAccessError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.get("/media/visualizations/{file_name}")
    async def media_visualization(file_name: str, dataset_id: str | None = Query(default=None), runtime: FixtureRuntimeService = Depends(get_service)) -> FileResponse:
        try:
            return FileResponse(runtime.resolve_media_file("visualizations", file_name, dataset_id=dataset_id))
        except MediaAccessError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.get("/api/datasets/{dataset_id}/media/visualizations/{file_name}")
    async def dataset_media_visualization(dataset_id: str, file_name: str, runtime: FixtureRuntimeService = Depends(get_service)) -> FileResponse:
        try:
            return FileResponse(runtime.resolve_media_file("visualizations", file_name, dataset_id=dataset_id))
        except MediaAccessError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return router


def api_error_response(exc: ApiError) -> ErrorResponse:
    """Convert a domain API error to its wire payload."""
    return ErrorResponse(code=exc.code, message=exc.message, details=exc.details)

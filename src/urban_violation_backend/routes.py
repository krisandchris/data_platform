"""FastAPI route definitions for Urban Violation fixture runtime API."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse

from urban_violation_backend.api_schemas import (
    AssetDetailResponse,
    AssetListResponse,
    DatasetSummaryResponse,
    ExportRequest,
    ExportResponse,
    HealthResponse,
    ImportJobStatusResponse,
    LabelEditSubmitRequest,
    LabelEditSubmitResponse,
    LabelEditValidateRequest,
    LabelEditValidationResponse,
    LabelConfigSaveRequest,
    LabelConfigValidateRequest,
    QCQueueResponse,
    ReviewSubmitRequest,
    SearchResponse,
)
from urban_violation_backend.labels import (
    LabelConfigValidationReport,
    LabelSuggestionResponse,
    StoredLabelConfig,
)
from urban_violation_backend.schemas import HumanReview
from urban_violation_backend.service import (
    ActiveLabelConfigAccessError,
    DatasetNotFoundError,
    FixtureRuntimeService,
    ImportJobNotFoundError,
    LabelEditValidationFailedError,
    LabelConfigValidationFailedError,
    LabelConfigVersionAccessError,
    LabelFieldAccessError,
    MediaAccessError,
    SampleNotFoundError,
)


def build_router(service: FixtureRuntimeService) -> APIRouter:
    """Build and return the API router with injected runtime service."""
    router = APIRouter()

    def get_service() -> FixtureRuntimeService:
        return service

    @router.get("/health", response_model=HealthResponse)
    async def health(runtime: FixtureRuntimeService = Depends(get_service)) -> HealthResponse:
        return HealthResponse(status="ok", dataset_id=runtime.dataset_id)

    @router.get("/api/datasets", response_model=list[DatasetSummaryResponse])
    async def list_datasets(
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> list[DatasetSummaryResponse]:
        return runtime.list_datasets()

    @router.get("/api/datasets/{dataset_id}/summary", response_model=DatasetSummaryResponse)
    async def dataset_summary(
        dataset_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> DatasetSummaryResponse:
        try:
            return runtime.get_dataset_summary(dataset_id)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.post(
        "/api/datasets/{dataset_id}/label-configs/validate",
        response_model=LabelConfigValidationReport,
    )
    async def validate_label_config(
        dataset_id: str,
        payload: LabelConfigValidateRequest,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> LabelConfigValidationReport:
        try:
            return runtime.validate_label_config(dataset_id=dataset_id, request=payload)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.post(
        "/api/datasets/{dataset_id}/label-configs",
        response_model=StoredLabelConfig,
    )
    async def save_label_config(
        dataset_id: str,
        payload: LabelConfigSaveRequest,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> StoredLabelConfig:
        try:
            return runtime.save_label_config(dataset_id=dataset_id, request=payload)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except LabelConfigValidationFailedError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=exc.report.model_dump(mode="json"),
            ) from exc

    @router.post(
        "/api/datasets/{dataset_id}/label-configs/{config_id}/activate",
        response_model=StoredLabelConfig,
    )
    async def activate_label_config(
        dataset_id: str,
        config_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> StoredLabelConfig:
        try:
            return runtime.activate_label_config(dataset_id=dataset_id, config_id=config_id)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except LabelConfigVersionAccessError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.get(
        "/api/datasets/{dataset_id}/label-config/active",
        response_model=StoredLabelConfig,
    )
    async def get_active_label_config(
        dataset_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> StoredLabelConfig:
        try:
            return runtime.get_active_label_config(dataset_id=dataset_id)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except ActiveLabelConfigAccessError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.get(
        "/api/datasets/{dataset_id}/label-suggestions",
        response_model=LabelSuggestionResponse,
    )
    async def label_suggestions(
        dataset_id: str,
        field: str = Query(..., min_length=1),
        q: str = Query(default=""),
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> LabelSuggestionResponse:
        try:
            return runtime.get_label_suggestions(dataset_id=dataset_id, field=field, query=q)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except ActiveLabelConfigAccessError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except LabelFieldAccessError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.get("/api/datasets/{dataset_id}/assets", response_model=AssetListResponse)
    async def list_assets(
        dataset_id: str,
        category: str | None = Query(default=None),
        judge_decision: str | None = Query(default=None),
        qc_status: str | None = Query(default=None),
        failure_status: str | None = Query(default=None),
        sample_category: str | None = Query(default=None),
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> AssetListResponse:
        try:
            return runtime.list_assets(
                dataset_id=dataset_id,
                category=category,
                judge_decision=judge_decision,
                qc_status=qc_status,
                failure_status=failure_status,
                sample_category=sample_category,
            )
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.get(
        "/api/datasets/{dataset_id}/assets/{sample_id}",
        response_model=AssetDetailResponse,
    )
    async def asset_detail(
        dataset_id: str,
        sample_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> AssetDetailResponse:
        try:
            return runtime.get_asset_detail(dataset_id=dataset_id, sample_id=sample_id)
        except (DatasetNotFoundError, SampleNotFoundError) as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.get(
        "/api/datasets/{dataset_id}/samples/{sample_id}/review",
        response_model=AssetDetailResponse,
    )
    async def review_detail(
        dataset_id: str,
        sample_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> AssetDetailResponse:
        try:
            return runtime.get_asset_detail(dataset_id=dataset_id, sample_id=sample_id)
        except (DatasetNotFoundError, SampleNotFoundError) as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.post(
        "/api/datasets/{dataset_id}/samples/{sample_id}/label-edits/validate",
        response_model=LabelEditValidationResponse,
    )
    async def validate_label_edits(
        dataset_id: str,
        sample_id: str,
        payload: LabelEditValidateRequest,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> LabelEditValidationResponse:
        try:
            return runtime.validate_label_edits(
                dataset_id=dataset_id,
                sample_id=sample_id,
                request=payload,
            )
        except (DatasetNotFoundError, SampleNotFoundError) as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except ActiveLabelConfigAccessError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.post(
        "/api/datasets/{dataset_id}/samples/{sample_id}/label-edits",
        response_model=LabelEditSubmitResponse,
    )
    async def submit_label_edits(
        dataset_id: str,
        sample_id: str,
        payload: LabelEditSubmitRequest,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> LabelEditSubmitResponse:
        try:
            return runtime.submit_label_edits(
                dataset_id=dataset_id,
                sample_id=sample_id,
                request=payload,
            )
        except (DatasetNotFoundError, SampleNotFoundError) as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except ActiveLabelConfigAccessError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except LabelEditValidationFailedError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=exc.report.model_dump(mode="json"),
            ) from exc
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.post(
        "/api/datasets/{dataset_id}/samples/{sample_id}/review",
        response_model=HumanReview,
    )
    async def submit_review(
        dataset_id: str,
        sample_id: str,
        payload: ReviewSubmitRequest,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> HumanReview:
        try:
            return runtime.submit_review(dataset_id=dataset_id, sample_id=sample_id, request=payload)
        except (DatasetNotFoundError, SampleNotFoundError) as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.get(
        "/api/datasets/{dataset_id}/import-jobs/{job_id}",
        response_model=ImportJobStatusResponse,
    )
    async def import_job_status(
        dataset_id: str,
        job_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> ImportJobStatusResponse:
        try:
            return runtime.get_import_job(dataset_id=dataset_id, job_id=job_id)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except ImportJobNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.get("/api/datasets/{dataset_id}/qc", response_model=QCQueueResponse)
    async def qc_queue(
        dataset_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> QCQueueResponse:
        try:
            return runtime.list_qc_queue(dataset_id=dataset_id)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.get("/api/datasets/{dataset_id}/search", response_model=SearchResponse)
    async def search(
        dataset_id: str,
        q: str = Query(default=""),
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> SearchResponse:
        try:
            return runtime.search(dataset_id=dataset_id, query=q)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.post("/api/datasets/{dataset_id}/exports", response_model=ExportResponse)
    async def create_export(
        dataset_id: str,
        payload: ExportRequest,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> ExportResponse:
        try:
            return runtime.create_export(dataset_id=dataset_id, sample_ids=payload.sample_ids)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except SampleNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    @router.get("/media/images/{file_name}")
    async def media_image(
        file_name: str,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> FileResponse:
        try:
            file_path = runtime.resolve_media_file("images", file_name)
            return FileResponse(file_path)
        except MediaAccessError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.get("/media/visualizations/{file_name}")
    async def media_visualization(
        file_name: str,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> FileResponse:
        try:
            file_path = runtime.resolve_media_file("visualizations", file_name)
            return FileResponse(file_path)
        except MediaAccessError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return router

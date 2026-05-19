"""FastAPI route definitions for Urban Violation fixture runtime API."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse

from urban_violation_backend.api_schemas import (
    AuditEventResponse,
    AssetDetailResponse,
    AssetListResponse,
    AssetSummaryResponse,
    BatchAssignmentActionRequest,
    BatchAssignmentRequest,
    BatchQcAssignmentResponse,
    CurrentUserResponse,
    DatasetTypeCreateRequest,
    DatasetTypeResponse,
    DatasetSummaryResponse,
    ErrorResponse,
    ExportRequest,
    ExportResponse,
    HealthResponse,
    ImportJobCreateRequest,
    ImportJobStatusResponse,
    LabelEditDraftResponse,
    LabelEditSubmissionResponse,
    LabelEditSubmitRequest,
    LabelEditSubmitResponse,
    LabelEditValidateRequest,
    LabelEditValidationResponse,
    LabelConfigSaveRequest,
    LabelConfigValidateRequest,
    LeaseAcquireResponse,
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    QCQueueResponse,
    QcProgressResponse,
    QcTaskResponse,
    ReviewSubmitRequest,
    RoleBindingCreateRequest,
    SampleLeaseResponse,
    SearchResponse,
    UserAccountCreateRequest,
    UserAccountPatchRequest,
    UserAccountResponse,
)
from urban_violation_backend.errors import ApiError
from urban_violation_backend.labels import (
    LabelConfigValidationReport,
    LabelSuggestionResponse,
    StoredLabelConfig,
)
from urban_violation_backend.schemas import HumanReview, RoleBinding
from urban_violation_backend.service import (
    ActiveLabelConfigAccessError,
    DatasetNotFoundError,
    FixtureRuntimeService,
    ImportJobNotFoundError,
    LabelEditValidationFailedError,
    LabelConfigValidationFailedError,
    LabelConfigPersistenceAccessError,
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

    def get_context(
        request: Request,
        runtime: FixtureRuntimeService = Depends(get_service),
    ):
        return runtime.resolve_auth_context(request)

    @router.get("/health", response_model=HealthResponse)
    async def health(runtime: FixtureRuntimeService = Depends(get_service)) -> HealthResponse:
        return HealthResponse(status="ok", dataset_id=runtime.dataset_id)

    @router.post("/api/auth/login", response_model=LoginResponse)
    async def login(
        payload: LoginRequest,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> LoginResponse:
        return runtime.login(payload)

    @router.post("/api/auth/logout", response_model=LogoutResponse)
    async def logout(
        request: Request,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> LogoutResponse:
        token = request.headers.get("X-Session-Token")
        auth = request.headers.get("Authorization")
        if token is None and auth and auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1].strip()
        return runtime.logout(context=context, token=token)

    @router.get("/api/me", response_model=CurrentUserResponse)
    async def me(context=Depends(get_context)) -> CurrentUserResponse:
        return context.to_current_user_response()

    @router.get("/api/users", response_model=list[UserAccountResponse])
    async def list_users(
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> list[UserAccountResponse]:
        return runtime.list_users(context=context)

    @router.post("/api/users", response_model=UserAccountResponse, status_code=status.HTTP_201_CREATED)
    async def create_user(
        payload: UserAccountCreateRequest,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> UserAccountResponse:
        return runtime.create_user(context=context, request=payload)

    @router.patch("/api/users/{user_id}", response_model=UserAccountResponse)
    async def patch_user(
        user_id: str,
        payload: UserAccountPatchRequest,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> UserAccountResponse:
        return runtime.patch_user(context=context, user_id=user_id, request=payload)

    @router.get("/api/role-bindings", response_model=list[RoleBinding])
    async def list_role_bindings(
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> list[RoleBinding]:
        return runtime.list_role_bindings(context=context)

    @router.post("/api/role-bindings", response_model=RoleBinding, status_code=status.HTTP_201_CREATED)
    async def create_role_binding(
        payload: RoleBindingCreateRequest,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> RoleBinding:
        return runtime.create_role_binding(context=context, request=payload)

    @router.delete("/api/role-bindings/{binding_id}", response_model=dict[str, bool])
    async def delete_role_binding(
        binding_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> dict[str, bool]:
        return {"deleted": runtime.delete_role_binding(context=context, binding_id=binding_id)}

    @router.get("/api/datasets", response_model=list[DatasetSummaryResponse])
    async def list_datasets(
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> list[DatasetSummaryResponse]:
        return runtime.list_datasets()

    @router.get("/api/dataset-types", response_model=list[DatasetTypeResponse])
    async def list_dataset_types(
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> list[DatasetTypeResponse]:
        return runtime.list_dataset_types()

    @router.post(
        "/api/dataset-types",
        response_model=DatasetTypeResponse,
        status_code=status.HTTP_201_CREATED,
    )
    async def create_dataset_type(
        payload: DatasetTypeCreateRequest,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> DatasetTypeResponse:
        try:
            runtime.require_permission_for_action(context=context, action="dataset_type:create")
            return runtime.create_dataset_type(payload)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

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
        "/api/dataset-types/{dataset_type}/label-configs/validate",
        response_model=LabelConfigValidationReport,
    )
    async def validate_type_label_config(
        dataset_type: str,
        payload: LabelConfigValidateRequest,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> LabelConfigValidationReport:
        try:
            return runtime.validate_label_config(dataset_id=dataset_type, request=payload)
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
        context=Depends(get_context),
    ) -> StoredLabelConfig:
        try:
            runtime.require_permission_for_action(
                context=context,
                action="label_config:manage",
                dataset_id=dataset_id,
            )
            return runtime.save_label_config(dataset_id=dataset_id, request=payload)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except LabelConfigValidationFailedError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=exc.report.model_dump(mode="json"),
            ) from exc

    @router.post(
        "/api/dataset-types/{dataset_type}/label-configs",
        response_model=StoredLabelConfig,
    )
    async def save_type_label_config(
        dataset_type: str,
        payload: LabelConfigSaveRequest,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> StoredLabelConfig:
        try:
            runtime.require_permission_for_action(
                context=context,
                action="label_config:manage",
                dataset_id=dataset_type,
            )
            return runtime.save_label_config(dataset_id=dataset_type, request=payload)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except LabelConfigValidationFailedError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=exc.report.model_dump(mode="json"),
            ) from exc

    @router.get(
        "/api/datasets/{dataset_id}/label-configs",
        response_model=list[StoredLabelConfig],
    )
    async def list_label_configs(
        dataset_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> list[StoredLabelConfig]:
        try:
            return runtime.list_label_configs(dataset_id=dataset_id)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.get(
        "/api/dataset-types/{dataset_type}/label-configs",
        response_model=list[StoredLabelConfig],
    )
    async def list_type_label_configs(
        dataset_type: str,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> list[StoredLabelConfig]:
        try:
            return runtime.list_label_configs(dataset_id=dataset_type)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.post(
        "/api/datasets/{dataset_id}/label-configs/{config_id}/activate",
        response_model=StoredLabelConfig,
    )
    async def activate_label_config(
        dataset_id: str,
        config_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> StoredLabelConfig:
        try:
            runtime.require_permission_for_action(
                context=context,
                action="label_config:manage",
                dataset_id=dataset_id,
            )
            return runtime.activate_label_config(dataset_id=dataset_id, config_id=config_id)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except LabelConfigVersionAccessError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except LabelConfigPersistenceAccessError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    @router.post(
        "/api/dataset-types/{dataset_type}/label-configs/{config_id}/activate",
        response_model=StoredLabelConfig,
    )
    async def activate_type_label_config(
        dataset_type: str,
        config_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> StoredLabelConfig:
        try:
            runtime.require_permission_for_action(
                context=context,
                action="label_config:manage",
                dataset_id=dataset_type,
            )
            return runtime.activate_label_config(dataset_id=dataset_type, config_id=config_id)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except LabelConfigVersionAccessError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except LabelConfigPersistenceAccessError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

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
        except LabelConfigPersistenceAccessError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    @router.get(
        "/api/dataset-types/{dataset_type}/label-config/active",
        response_model=StoredLabelConfig,
    )
    async def get_active_type_label_config(
        dataset_type: str,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> StoredLabelConfig:
        try:
            return runtime.get_active_label_config(dataset_id=dataset_type)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except ActiveLabelConfigAccessError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except LabelConfigPersistenceAccessError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    @router.post(
        "/api/datasets/{dataset_id}/label-config/active/reload",
        response_model=StoredLabelConfig,
    )
    async def reload_active_label_config(
        dataset_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> StoredLabelConfig:
        try:
            return runtime.reload_active_label_config(dataset_id=dataset_id)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except ActiveLabelConfigAccessError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except LabelConfigPersistenceAccessError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    @router.post(
        "/api/dataset-types/{dataset_type}/label-config/active/reload",
        response_model=StoredLabelConfig,
    )
    async def reload_active_type_label_config(
        dataset_type: str,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> StoredLabelConfig:
        try:
            return runtime.reload_active_label_config(dataset_id=dataset_type)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except ActiveLabelConfigAccessError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except LabelConfigPersistenceAccessError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

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
        step1_status: str | None = Query(default=None),
        step2_status: str | None = Query(default=None),
        model_decision: str | None = Query(default=None),
        confidence_min: float | None = Query(default=None, ge=0.0, le=1.0),
        confidence_max: float | None = Query(default=None, ge=0.0, le=1.0),
        media_status: str | None = Query(default=None),
        edited_status: str | None = Query(default=None),
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
                step1_status=step1_status,
                step2_status=step2_status,
                model_decision=model_decision,
                confidence_min=confidence_min,
                confidence_max=confidence_max,
                media_status=media_status,
                edited_status=edited_status,
            )
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.get(
        "/api/datasets/{dataset_id}/assets/summary",
        response_model=AssetSummaryResponse,
    )
    async def assets_summary(
        dataset_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> AssetSummaryResponse:
        try:
            return runtime.get_asset_summary(dataset_id=dataset_id)
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
        context=Depends(get_context),
    ) -> AssetDetailResponse:
        try:
            return runtime.get_asset_detail(dataset_id=dataset_id, sample_id=sample_id, context=context)
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
        context=Depends(get_context),
    ) -> LabelEditSubmitResponse:
        try:
            return runtime.submit_label_edits(
                dataset_id=dataset_id,
                sample_id=sample_id,
                request=payload,
                context=context,
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
        "/api/datasets/{dataset_id}/import-jobs",
        response_model=list[ImportJobStatusResponse],
    )
    async def list_import_jobs(
        dataset_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> list[ImportJobStatusResponse]:
        try:
            return runtime.list_import_jobs(dataset_id=dataset_id)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.post(
        "/api/datasets/{dataset_id}/import-jobs",
        response_model=ImportJobStatusResponse,
        status_code=status.HTTP_201_CREATED,
    )
    async def create_import_job(
        dataset_id: str,
        payload: ImportJobCreateRequest,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> ImportJobStatusResponse:
        try:
            runtime.require_permission_for_action(
                context=context,
                action="import_job:manage",
                dataset_id=dataset_id,
            )
            return runtime.create_import_job(dataset_id=dataset_id, request=payload)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

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

    @router.post(
        "/api/datasets/{dataset_id}/import-jobs/{job_id}/scan",
        response_model=ImportJobStatusResponse,
    )
    async def scan_import_job(
        dataset_id: str,
        job_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> ImportJobStatusResponse:
        try:
            runtime.require_permission_for_action(
                context=context,
                action="import_job:manage",
                dataset_id=dataset_id,
            )
            return runtime.scan_import_job(dataset_id=dataset_id, job_id=job_id)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except ImportJobNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.post(
        "/api/datasets/{dataset_id}/import-jobs/{job_id}/validate",
        response_model=ImportJobStatusResponse,
    )
    async def validate_import_job(
        dataset_id: str,
        job_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> ImportJobStatusResponse:
        try:
            runtime.require_permission_for_action(
                context=context,
                action="import_job:manage",
                dataset_id=dataset_id,
            )
            return runtime.validate_import_job(dataset_id=dataset_id, job_id=job_id)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except ImportJobNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.post(
        "/api/datasets/{dataset_id}/import-jobs/{job_id}/confirm",
        response_model=ImportJobStatusResponse,
    )
    async def confirm_import_job(
        dataset_id: str,
        job_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> ImportJobStatusResponse:
        try:
            runtime.require_permission_for_action(
                context=context,
                action="import_job:manage",
                dataset_id=dataset_id,
            )
            return runtime.confirm_import_job(dataset_id=dataset_id, job_id=job_id)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except ImportJobNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.post(
        "/api/datasets/{dataset_id}/import-jobs/{job_id}/retry",
        response_model=ImportJobStatusResponse,
    )
    async def retry_import_job(
        dataset_id: str,
        job_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> ImportJobStatusResponse:
        try:
            runtime.require_permission_for_action(
                context=context,
                action="import_job:manage",
                dataset_id=dataset_id,
            )
            return runtime.retry_import_job(dataset_id=dataset_id, job_id=job_id)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except ImportJobNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.get("/api/datasets/{dataset_id}/qc", response_model=QCQueueResponse)
    async def qc_queue(
        dataset_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> QCQueueResponse:
        try:
            return runtime.list_qc_queue(dataset_id=dataset_id, context=context)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.post("/api/datasets/{dataset_id}/qc/generate", response_model=QCQueueResponse)
    async def generate_qc_queue(
        dataset_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> QCQueueResponse:
        try:
            return runtime.generate_qc_queue(dataset_id=dataset_id, context=context)
        except DatasetNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.get(
        "/api/datasets/{dataset_id}/qc/assignment",
        response_model=BatchQcAssignmentResponse | None,
    )
    async def get_batch_assignment(
        dataset_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> BatchQcAssignmentResponse | None:
        return runtime.get_batch_assignment(dataset_id=dataset_id, context=context)

    @router.post(
        "/api/datasets/{dataset_id}/qc/assignment",
        response_model=BatchQcAssignmentResponse,
    )
    async def assign_batch(
        dataset_id: str,
        payload: BatchAssignmentRequest,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> BatchQcAssignmentResponse:
        return runtime.assign_batch(
            dataset_id=dataset_id,
            request=payload,
            context=context,
            allow_reassign=False,
        )

    @router.post(
        "/api/datasets/{dataset_id}/qc/assignment/reassign",
        response_model=BatchQcAssignmentResponse,
    )
    async def reassign_batch(
        dataset_id: str,
        payload: BatchAssignmentActionRequest,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> BatchQcAssignmentResponse:
        if payload.assignee_user_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="assignee_user_id is required",
            )
        return runtime.assign_batch(
            dataset_id=dataset_id,
            request=BatchAssignmentRequest(assignee_user_id=payload.assignee_user_id),
            context=context,
            allow_reassign=True,
        )

    @router.post(
        "/api/datasets/{dataset_id}/qc/assignment/release",
        response_model=BatchQcAssignmentResponse,
    )
    async def release_batch_assignment(
        dataset_id: str,
        payload: BatchAssignmentActionRequest,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> BatchQcAssignmentResponse:
        return runtime.release_batch_assignment(
            dataset_id=dataset_id,
            context=context,
            reason=payload.reason,
        )

    @router.get("/api/datasets/{dataset_id}/qc/tasks", response_model=list[QcTaskResponse])
    async def list_qc_tasks(
        dataset_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> list[QcTaskResponse]:
        return runtime.list_qc_tasks(dataset_id=dataset_id, context=context)

    @router.post(
        "/api/datasets/{dataset_id}/samples/{sample_id}/lease",
        response_model=LeaseAcquireResponse,
    )
    async def acquire_lease(
        dataset_id: str,
        sample_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> LeaseAcquireResponse:
        return runtime.acquire_sample_lease(dataset_id=dataset_id, sample_id=sample_id, context=context)

    @router.post(
        "/api/datasets/{dataset_id}/samples/{sample_id}/lease/{lease_id}/heartbeat",
        response_model=SampleLeaseResponse,
    )
    async def heartbeat_lease(
        dataset_id: str,
        sample_id: str,
        lease_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> SampleLeaseResponse:
        return runtime.heartbeat_sample_lease(
            dataset_id=dataset_id,
            sample_id=sample_id,
            lease_id=lease_id,
            context=context,
        )

    @router.post(
        "/api/datasets/{dataset_id}/samples/{sample_id}/lease/{lease_id}/release",
        response_model=SampleLeaseResponse,
    )
    async def release_lease(
        dataset_id: str,
        sample_id: str,
        lease_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> SampleLeaseResponse:
        return runtime.release_sample_lease(
            dataset_id=dataset_id,
            sample_id=sample_id,
            lease_id=lease_id,
            context=context,
        )

    @router.get(
        "/api/datasets/{dataset_id}/samples/{sample_id}/label-edits/my-draft",
        response_model=LabelEditDraftResponse | None,
    )
    async def my_draft(
        dataset_id: str,
        sample_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> LabelEditDraftResponse | None:
        return runtime.get_my_draft(dataset_id=dataset_id, sample_id=sample_id, context=context)

    @router.get(
        "/api/datasets/{dataset_id}/samples/{sample_id}/label-edits/history",
        response_model=list[LabelEditSubmissionResponse],
    )
    async def label_edit_history(
        dataset_id: str,
        sample_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> list[LabelEditSubmissionResponse]:
        return runtime.get_label_edit_history(dataset_id=dataset_id, sample_id=sample_id, context=context)

    @router.post(
        "/api/datasets/{dataset_id}/samples/{sample_id}/label-edits/{submission_id}/confirm",
        response_model=LabelEditSubmissionResponse,
    )
    async def confirm_submission(
        dataset_id: str,
        sample_id: str,
        submission_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> LabelEditSubmissionResponse:
        return runtime.confirm_submission(
            dataset_id=dataset_id,
            sample_id=sample_id,
            submission_id=submission_id,
            context=context,
        )

    @router.post(
        "/api/datasets/{dataset_id}/samples/{sample_id}/label-edits/{submission_id}/return",
        response_model=LabelEditSubmissionResponse,
    )
    async def return_submission(
        dataset_id: str,
        sample_id: str,
        submission_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> LabelEditSubmissionResponse:
        return runtime.return_submission(
            dataset_id=dataset_id,
            sample_id=sample_id,
            submission_id=submission_id,
            context=context,
        )

    @router.get("/api/audit-events", response_model=list[AuditEventResponse])
    async def audit_events(
        dataset_id: str | None = Query(default=None),
        sample_id: str | None = Query(default=None),
        actor_user_id: str | None = Query(default=None),
        action: str | None = Query(default=None),
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> list[AuditEventResponse]:
        return runtime.list_audit_events(
            context=context,
            dataset_id=dataset_id,
            sample_id=sample_id,
            actor_user_id=actor_user_id,
            action=action,
        )

    @router.get("/api/datasets/{dataset_id}/qc/progress", response_model=QcProgressResponse)
    async def qc_progress(
        dataset_id: str,
        runtime: FixtureRuntimeService = Depends(get_service),
        context=Depends(get_context),
    ) -> QcProgressResponse:
        return runtime.get_qc_progress(dataset_id=dataset_id, context=context)

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
        dataset_id: str | None = Query(default=None),
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> FileResponse:
        try:
            file_path = runtime.resolve_media_file("images", file_name, dataset_id=dataset_id)
            return FileResponse(file_path)
        except MediaAccessError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.get("/api/datasets/{dataset_id}/media/images/{file_name}")
    async def dataset_media_image(
        dataset_id: str,
        file_name: str,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> FileResponse:
        try:
            file_path = runtime.resolve_media_file("images", file_name, dataset_id=dataset_id)
            return FileResponse(file_path)
        except MediaAccessError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.get("/media/visualizations/{file_name}")
    async def media_visualization(
        file_name: str,
        dataset_id: str | None = Query(default=None),
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> FileResponse:
        try:
            file_path = runtime.resolve_media_file("visualizations", file_name, dataset_id=dataset_id)
            return FileResponse(file_path)
        except MediaAccessError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.get("/api/datasets/{dataset_id}/media/visualizations/{file_name}")
    async def dataset_media_visualization(
        dataset_id: str,
        file_name: str,
        runtime: FixtureRuntimeService = Depends(get_service),
    ) -> FileResponse:
        try:
            file_path = runtime.resolve_media_file("visualizations", file_name, dataset_id=dataset_id)
            return FileResponse(file_path)
        except MediaAccessError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return router

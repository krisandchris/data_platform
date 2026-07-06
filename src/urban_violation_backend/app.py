"""Application entrypoint for the Urban Violation fixture runtime API."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from urban_violation_backend.api_schemas import ErrorResponse
from urban_violation_backend.errors import ApiError
from urban_violation_backend.routes import build_router
from urban_violation_backend.service import build_fixture_service

APP_VERSION = "0.0.2"

OFFLINE_DISABLED_PREFIXES = (
    "/api/rbac",
    "/api/users",
    "/api/role-bindings",
    "/api/audit-events",
    "/api/sample-pool",
    "/api/exports",
)
OFFLINE_DISABLED_DATASET_SUFFIXES = (
    "/summary",
    "/assets",
    "/assets/summary",
    "/preannotations",
    "/evaluations",
    "/snapshots",
    "/search",
    "/exports",
)


def _offline_endpoint_disabled(method: str, path: str) -> bool:
    if method == "OPTIONS":
        return False
    if path == "/api/datasets":
        return True
    if path.startswith(OFFLINE_DISABLED_PREFIXES):
        return True
    if method == "DELETE" and path.startswith("/api/datasets/"):
        return True
    if not path.startswith("/api/datasets/"):
        return False
    return any(path.endswith(suffix) or f"{suffix}/" in path for suffix in OFFLINE_DISABLED_DATASET_SUFFIXES)


def create_app(
    *,
    dataset_root: Path | None = None,
    label_config_store_root: Path | None = None,
    platform_state_root: Path | None = None,
    platform_state_backend: str | None = None,
    database_url: str | None = None,
    platform_db_auto_migrate: bool | None = None,
    enable_fixture_batch: bool | None = None,
) -> FastAPI:
    """Create the FastAPI application with fixture service wiring."""
    service = build_fixture_service(
        **({"dataset_root": dataset_root} if dataset_root is not None else {}),
        label_config_store_root=label_config_store_root,
        platform_state_root=platform_state_root,
        platform_state_backend=platform_state_backend,
        database_url=database_url,
        platform_db_auto_migrate=platform_db_auto_migrate,
        enable_fixture_batch=enable_fixture_batch,
    )
    app = FastAPI(
        title="Urban Violation Backend API",
        version=APP_VERSION,
        description="Fixture-backed runtime API for frontend and integration tests.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def offline_api_surface_guard(request: Request, call_next):
        if service.runtime_mode == "offline_single_user" and _offline_endpoint_disabled(request.method, request.url.path):
            payload = ErrorResponse(
                code="offline_endpoint_disabled",
                message="Endpoint is disabled in offline single-user mode.",
            )
            return JSONResponse(status_code=404, content=payload.model_dump(mode="json"))
        return await call_next(request)

    @app.exception_handler(ApiError)
    async def api_error_handler(_: Request, exc: ApiError) -> JSONResponse:
        payload = ErrorResponse(code=exc.code, message=exc.message, details=exc.details)
        return JSONResponse(
            status_code=exc.status_code,
            content=payload.model_dump(mode="json"),
        )

    app.include_router(build_router(service))
    return app


app = create_app()

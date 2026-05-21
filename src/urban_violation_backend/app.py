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


def create_app(
    *,
    dataset_root: Path | None = None,
    label_config_store_root: Path | None = None,
    platform_state_root: Path | None = None,
    enable_fixture_batch: bool | None = None,
) -> FastAPI:
    """Create the FastAPI application with fixture service wiring."""
    service = build_fixture_service(
        **({"dataset_root": dataset_root} if dataset_root is not None else {}),
        label_config_store_root=label_config_store_root,
        platform_state_root=platform_state_root,
        enable_fixture_batch=enable_fixture_batch,
    )
    app = FastAPI(
        title="Urban Violation Backend API",
        version="0.1.0",
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

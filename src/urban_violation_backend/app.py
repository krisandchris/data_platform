"""Application entrypoint for the Urban Violation fixture runtime API."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from urban_violation_backend.routes import build_router
from urban_violation_backend.service import build_fixture_service


def create_app() -> FastAPI:
    """Create the FastAPI application with fixture service wiring."""
    service = build_fixture_service()
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
    app.include_router(build_router(service))
    return app


app = create_app()

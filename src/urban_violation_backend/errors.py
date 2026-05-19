"""Structured API error primitives."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class ApiError(Exception):
    """Application-level error mapped to structured API responses."""

    status_code: int
    code: str
    message: str
    details: dict[str, Any] = field(default_factory=dict)


def unauthorized(message: str = "Authentication required.", **details: Any) -> ApiError:
    return ApiError(status_code=401, code="unauthorized", message=message, details=details)


def forbidden(message: str = "Insufficient permissions.", **details: Any) -> ApiError:
    return ApiError(status_code=403, code="forbidden", message=message, details=details)


def conflict(code: str, message: str, **details: Any) -> ApiError:
    return ApiError(status_code=409, code=code, message=message, details=details)

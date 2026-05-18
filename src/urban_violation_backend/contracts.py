"""Contract artifact helpers."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from urban_violation_backend.app import create_app


def build_contract_schema() -> dict[str, Any]:
    """Return OpenAPI schema bundle for backend runtime APIs."""
    app = create_app()
    return app.openapi()


def write_contract_schema(output_path: Path) -> None:
    """Write OpenAPI schema to disk for frontend/integration agents."""
    payload = build_contract_schema()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )

from __future__ import annotations

import json
from pathlib import Path


CONFIG_PATH = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "urban_violation_backend"
    / "dataset_configs"
    / "urban_violation.json"
)


def _field(payload: dict, field_name: str) -> dict:
    return next(field for field in payload["fields"] if field["field"] == field_name)


def test_builtin_relation_config_does_not_expose_legacy_occupying() -> None:
    payload = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    relation_codes = {option["code"] for option in _field(payload, "relation")["options"]}

    assert "占据" in relation_codes
    assert "occupying" not in relation_codes


def test_builtin_segmentation_targets_include_motor_vehicle_next_to_nonmotor_vehicle() -> None:
    payload = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    options = _field(payload, "segmentation_targets")["options"]
    codes = [option["code"] for option in options]

    assert codes.index("motor_vehicle") == codes.index("nonmotor_vehicle") + 1
    motor_vehicle = options[codes.index("motor_vehicle")]
    assert motor_vehicle["label_zh"] == "机动车"
    assert motor_vehicle["label_en"] == "motor vehicle"

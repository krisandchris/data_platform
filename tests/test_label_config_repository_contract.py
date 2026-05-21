from __future__ import annotations

from urban_violation_backend.labels import (
    FileBackedLabelConfigRepository,
    LabelConfigVersionConflictError,
    validate_label_config,
)


DATASET_ID = "urban_violation"


def _base_payload() -> dict:
    return {
        "schema_version": "2026-05-18",
        "dataset_type": DATASET_ID,
        "version": "v1",
        "fields": [
            {
                "field": "violation_category",
                "mode": "closed_enum",
                "label_zh": "违规类型",
                "allow_custom": False,
                "options": [
                    {"code": "illegal_parking", "label_zh": "违停", "sort_order": 0},
                    {"code": "lane_occupation", "label_zh": "占道", "sort_order": 1},
                ],
            },
            {
                "field": "scene_elements",
                "mode": "open_tags",
                "label_zh": "场景元素",
                "allow_custom": True,
                "options": [{"code": "road", "label_zh": "道路", "sort_order": 0}],
            },
        ],
    }


def _validated(payload: dict):
    report, config = validate_label_config(DATASET_ID, payload)
    assert report.valid
    assert config is not None
    return report, config


def test_save_defaults_to_active_and_dedup_same_hash(tmp_path):
    repo = FileBackedLabelConfigRepository(tmp_path)
    payload = _base_payload()
    report, config = _validated(payload)

    first = repo.save(
        dataset_id=DATASET_ID,
        file_name="label_config.json",
        report=report,
        config=config,
        activate=False,
    )
    assert first.status == "active"
    assert repo.get_active(DATASET_ID).config_id == first.config_id

    second = repo.save(
        dataset_id=DATASET_ID,
        file_name="label_config-copy.json",
        report=report,
        config=config,
        activate=True,
    )
    assert second.config_id == first.config_id
    assert len(repo.list_configs(DATASET_ID)) == 1


def test_same_version_different_content_conflicts(tmp_path):
    repo = FileBackedLabelConfigRepository(tmp_path)
    base_payload = _base_payload()
    base_report, base_config = _validated(base_payload)
    repo.save(
        dataset_id=DATASET_ID,
        file_name="label_config-v1.json",
        report=base_report,
        config=base_config,
        activate=True,
    )

    changed_payload = _base_payload()
    changed_payload["fields"][0]["label_zh"] = "违规类型-变更"
    changed_report, changed_config = _validated(changed_payload)

    try:
        repo.save(
            dataset_id=DATASET_ID,
            file_name="label_config-v1-changed.json",
            report=changed_report,
            config=changed_config,
            activate=True,
        )
    except LabelConfigVersionConflictError:
        pass
    else:
        raise AssertionError("Expected LabelConfigVersionConflictError for same version with different hash")


def test_reload_active_does_not_create_new_version(tmp_path):
    repo = FileBackedLabelConfigRepository(tmp_path)
    report, config = _validated(_base_payload())
    saved = repo.save(
        dataset_id=DATASET_ID,
        file_name="label_config.json",
        report=report,
        config=config,
        activate=True,
    )

    reloaded = repo.reload_active(DATASET_ID)
    assert reloaded.config_id == saved.config_id
    versions = repo.list_configs(DATASET_ID)
    assert len(versions) == 1
    assert versions[0].config_id == saved.config_id

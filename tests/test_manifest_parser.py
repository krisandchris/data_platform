"""Tests for manifest parsing and deterministic fixture import."""

from __future__ import annotations

from pathlib import Path

from urban_violation_backend.importer.parser import (
    Stage2ManifestFailureEntry,
    Stage2ManifestSuccessEntry,
    import_fixture_samples,
    normalize_media_url,
    pair_stage_samples,
    read_stage1_manifest,
    read_stage1_manifest_with_failures,
    read_stage2_manifest,
)


DATASET_ROOT = Path(
    "/mnt/lc/LC/ares_xtws/0_train_data/data_platform/DATASET/urban_violation"
)
DATASET_ROOT_0520 = Path(
    "/mnt/lc/LC/ares_xtws/0_train_data/data_platform/DATASET/urban_violation_0520"
)
SUCCESS_SAMPLE_ID = "000142_0_1762483003246"
FAILURE_SAMPLE_ID = "001710_0_1763108687181"


def test_read_manifest_required_ids_present() -> None:
    stage1_entries = read_stage1_manifest(DATASET_ROOT)
    stage2_entries = read_stage2_manifest(DATASET_ROOT)

    assert SUCCESS_SAMPLE_ID in stage1_entries
    assert SUCCESS_SAMPLE_ID in stage2_entries
    assert FAILURE_SAMPLE_ID in stage1_entries
    assert FAILURE_SAMPLE_ID in stage2_entries


def test_pair_samples_has_expected_stage2_states() -> None:
    stage1_entries = read_stage1_manifest(DATASET_ROOT)
    stage2_entries = read_stage2_manifest(DATASET_ROOT)

    pairs = pair_stage_samples(
        stage1_entries,
        stage2_entries,
        sample_ids=[SUCCESS_SAMPLE_ID, FAILURE_SAMPLE_ID],
    )

    assert len(pairs) == 2
    pair_map = {pair.sample_id: pair for pair in pairs}
    assert isinstance(pair_map[SUCCESS_SAMPLE_ID].stage2, Stage2ManifestSuccessEntry)
    assert isinstance(pair_map[FAILURE_SAMPLE_ID].stage2, Stage2ManifestFailureEntry)


def test_stage2_duplicate_ids_resolve_deterministically() -> None:
    manifest_path = DATASET_ROOT / "stage2_run_0508" / "meta" / "manifest.jsonl"
    duplicate_lines = [
        line
        for line in manifest_path.read_text(encoding="utf-8").splitlines()
        if FAILURE_SAMPLE_ID in line
    ]
    assert len(duplicate_lines) >= 2

    stage2_entries = read_stage2_manifest(DATASET_ROOT)
    assert isinstance(stage2_entries[FAILURE_SAMPLE_ID], Stage2ManifestFailureEntry)


def test_import_fixture_samples_success_and_failure_payloads() -> None:
    bundle = import_fixture_samples(
        dataset_root=DATASET_ROOT,
        sample_ids=[SUCCESS_SAMPLE_ID, FAILURE_SAMPLE_ID],
    )

    assert bundle.import_job.imported_assets == 2
    assert bundle.import_job.failure_count == 1

    sample_map = {sample.sample_id: sample for sample in bundle.samples}

    success_sample = sample_map[SUCCESS_SAMPLE_ID]
    assert success_sample.stage2 is not None
    assert success_sample.stage2_failure is None
    assert success_sample.raw_asset.image_url.startswith("/media/images/")
    assert success_sample.raw_asset.image_url.endswith("000142_0_1762483003246.jpg")

    failed_sample = sample_map[FAILURE_SAMPLE_ID]
    assert failed_sample.stage2 is None
    assert failed_sample.stage2_failure is not None
    assert failed_sample.stage2_failure.error_type == "ValueError"
    assert "boundary_truncation but supported" in failed_sample.stage2_failure.message


def test_import_fixture_samples_defaults_to_full_dataset() -> None:
    bundle = import_fixture_samples(dataset_root=DATASET_ROOT)

    assert bundle.import_job.imported_assets == 797
    assert bundle.dataset.stage1_count == 797
    assert bundle.dataset.stage2_success_count == 780
    assert bundle.dataset.stage2_failure_count == 19


def test_stage1_manifest_retry_history_uses_final_row_semantics_for_0520() -> None:
    stage1_entries, stage1_failed_entries = read_stage1_manifest_with_failures(DATASET_ROOT_0520)

    assert len(stage1_entries) == 505
    assert len(stage1_failed_entries) == 0
    assert (
        "RAW001B5000001_20260324_172936_front_01010100150000010101_20260324172947A604"
        in stage1_entries
    )


def test_import_fixture_samples_handles_stage2_missing_row_for_0520() -> None:
    bundle = import_fixture_samples(dataset_root=DATASET_ROOT_0520)

    assert bundle.import_job.imported_assets == 505
    assert bundle.dataset.stage1_count == 505
    assert bundle.dataset.stage2_success_count == 496
    assert bundle.dataset.stage2_failure_count == 8

    stage2_missing_count = sum(
        1
        for sample in bundle.samples
        if sample.stage2 is None
        and sample.stage2_failure is not None
        and sample.stage2_failure.error_type == "Stage2MissingError"
    )
    assert stage2_missing_count == 1


def test_normalize_media_url_is_browser_safe() -> None:
    src = "/mnt/lc/LC/ares_xtws/0_train_data/violate/data_engine/img/test/000142_0_1762483003246.jpg"
    normalized = normalize_media_url(src)

    assert normalized == "/media/images/000142_0_1762483003246.jpg"
    assert not normalized.startswith("/mnt/")

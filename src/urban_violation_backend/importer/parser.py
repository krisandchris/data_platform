"""Manifest-driven dataset parser and deterministic fixture importer."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Sequence
from urllib.parse import quote

from pydantic import BaseModel, ConfigDict, Field

from urban_violation_backend.schemas import (
    Dataset,
    ImportJob,
    ImportJobState,
    RawAsset,
    Stage1Preannotation,
    Stage2Preannotation,
    Stage2PreannotationFailure,
)


class StrictModel(BaseModel):
    """Parser-side strict model that rejects unknown fields."""

    model_config = ConfigDict(extra="forbid")


class Stage1ManifestEntry(StrictModel):
    """Single row in stage1 manifest.jsonl."""

    id: str
    request_path: str
    response_path: str
    parsed_path: str
    record_path: str


class Stage2ManifestSuccessEntry(StrictModel):
    """Successful stage2 manifest row."""

    id: str
    input_path: str
    request_path: str
    response_path: str
    parsed_path: str
    record_path: str


class Stage2ManifestFailureEntry(StrictModel):
    """Failed stage2 manifest row."""

    id: str
    status: str = "failed"
    input_path: str
    request_path: str
    failure_path: str


class PairedSample(StrictModel):
    """Pairing view across stage1 and stage2 manifests."""

    sample_id: str
    stage1: Stage1ManifestEntry
    stage2: Stage2ManifestSuccessEntry | Stage2ManifestFailureEntry | None


class FixtureSample(StrictModel):
    """Deterministic fixture sample view used for inspection/import tests."""

    sample_id: str
    raw_asset: RawAsset
    stage1: Stage1Preannotation
    stage2: Stage2Preannotation | None = None
    stage2_failure: Stage2PreannotationFailure | None = None


class FixtureImportBundle(StrictModel):
    """Fixture import summary with contract models."""

    dataset: Dataset
    import_job: ImportJob
    samples: list[FixtureSample] = Field(default_factory=list)


def _manifest_line_iter(manifest_path: Path) -> Iterable[tuple[int, str]]:
    """Yield non-empty manifest lines with one-based line numbers."""
    with manifest_path.open("r", encoding="utf-8") as handle:
        for idx, line in enumerate(handle, start=1):
            stripped = line.strip()
            if stripped:
                yield idx, stripped


def read_stage1_manifest(dataset_root: Path) -> dict[str, Stage1ManifestEntry]:
    """Read stage1 manifest as a map keyed by sample id."""
    manifest_path = dataset_root / "stage1_run_0508" / "meta" / "manifest.jsonl"
    entries: dict[str, Stage1ManifestEntry] = {}
    for line_no, line in _manifest_line_iter(manifest_path):
        try:
            entry = Stage1ManifestEntry.model_validate_json(line)
        except Exception as exc:  # pragma: no cover - defensive context enrichment
            raise ValueError(f"Invalid stage1 manifest line {line_no}: {exc}") from exc
        entries[entry.id] = entry
    return entries


def read_stage2_manifest(
    dataset_root: Path,
) -> dict[str, Stage2ManifestSuccessEntry | Stage2ManifestFailureEntry]:
    """Read stage2 manifest with deterministic last-write-wins for duplicate ids."""
    manifest_path = dataset_root / "stage2_run_0508" / "meta" / "manifest.jsonl"
    entries: dict[str, Stage2ManifestSuccessEntry | Stage2ManifestFailureEntry] = {}
    for line_no, line in _manifest_line_iter(manifest_path):
        try:
            payload = json.loads(line)
        except json.JSONDecodeError as exc:  # pragma: no cover - defensive
            raise ValueError(f"Invalid JSON in stage2 manifest line {line_no}: {exc}") from exc

        if payload.get("status") == "failed":
            entry = Stage2ManifestFailureEntry.model_validate(payload)
        else:
            entry = Stage2ManifestSuccessEntry.model_validate(payload)
        entries[entry.id] = entry
    return entries


def pair_stage_samples(
    stage1_entries: dict[str, Stage1ManifestEntry],
    stage2_entries: dict[str, Stage2ManifestSuccessEntry | Stage2ManifestFailureEntry],
    sample_ids: Sequence[str] | None = None,
) -> list[PairedSample]:
    """Pair stage1 and stage2 entries for all or selected sample ids."""
    target_ids = sorted(sample_ids) if sample_ids else sorted(stage1_entries.keys())
    pairs: list[PairedSample] = []
    for sample_id in target_ids:
        if sample_id not in stage1_entries:
            raise KeyError(f"Sample {sample_id} missing in stage1 manifest")
        pairs.append(
            PairedSample(
                sample_id=sample_id,
                stage1=stage1_entries[sample_id],
                stage2=stage2_entries.get(sample_id),
            )
        )
    return pairs


def normalize_media_url(source_path: str, media_base_url: str = "/media/images") -> str:
    """Convert an internal image path to a browser-safe URL without leaking filesystem paths."""
    file_name = Path(source_path).name
    if not file_name:
        raise ValueError("source_path must include a filename")
    return f"{media_base_url.rstrip('/')}/{quote(file_name, safe='._-')}"


def _read_json_file(path: Path) -> dict:
    """Load a JSON file from disk as a dictionary."""
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _load_stage1_preannotation(dataset_root: Path, entry: Stage1ManifestEntry) -> Stage1Preannotation:
    """Load stage1 parsed + record files into normalized contract schema."""
    parsed_payload = _read_json_file(dataset_root / "stage1_run_0508" / entry.parsed_path)
    record_payload = _read_json_file(dataset_root / "stage1_run_0508" / entry.record_path)

    metadata = record_payload.get("metadata", {})
    judge_report = metadata.get("judge_report", {}) if isinstance(metadata, dict) else {}
    decision = judge_report.get("final_decision", "unknown")
    if decision not in {"pass", "soft_fail", "unknown"}:
        decision = "unknown"

    return Stage1Preannotation(
        sample_id=entry.id,
        environment_analysis=parsed_payload.get("environment_analysis", ""),
        scene_elements=parsed_payload.get("scene_elements", []),
        key_anchors=parsed_payload.get("key_anchors", []),
        key_relations=parsed_payload.get("key_relations", []),
        judge_decision=decision,
    )


def _extract_source_image_path(dataset_root: Path, stage1_record_path: str, stage2_input_path: str) -> str:
    """Extract source image path from stage1 record and fall back to stage2 input."""
    stage1_record = _read_json_file(dataset_root / "stage1_run_0508" / stage1_record_path)
    images = stage1_record.get("images", []) if isinstance(stage1_record, dict) else []
    if images and isinstance(images[0], str):
        return images[0]

    stage2_input = _read_json_file(dataset_root / "stage2_run_0508" / stage2_input_path)
    image_path = stage2_input.get("image_path") if isinstance(stage2_input, dict) else None
    if isinstance(image_path, str) and image_path:
        return image_path
    raise ValueError("Unable to resolve source image path from stage1 record or stage2 input")


def _load_stage2(
    dataset_root: Path,
    entry: Stage2ManifestSuccessEntry | Stage2ManifestFailureEntry,
) -> tuple[Stage2Preannotation | None, Stage2PreannotationFailure | None]:
    """Load stage2 success or failure payload from manifest entry."""
    if isinstance(entry, Stage2ManifestFailureEntry):
        failure_payload = _read_json_file(dataset_root / "stage2_run_0508" / entry.failure_path)
        failure = Stage2PreannotationFailure(
            sample_id=entry.id,
            error_type=failure_payload.get("error_type", "UnknownError"),
            message=failure_payload.get("message", "Unknown stage2 failure"),
        )
        return None, failure

    parsed_payload = _read_json_file(dataset_root / "stage2_run_0508" / entry.parsed_path)
    parsed_payload = {
        key: parsed_payload[key]
        for key in ("sample_id", "fact_verifications", "candidates")
        if key in parsed_payload
    }
    stage2 = Stage2Preannotation.model_validate(parsed_payload)
    return stage2, None


def count_stage2_failure_artifacts(dataset_root: Path) -> int:
    """Count preserved stage2 failure artifacts on disk, including retry history."""
    return len(list((dataset_root / "stage2_run_0508" / "failures").glob("*/*.json")))


def import_fixture_samples(dataset_root: Path, sample_ids: Sequence[str] | None = None) -> FixtureImportBundle:
    """Import all dataset samples, or a deterministic subset when sample ids are provided."""
    stage1_entries = read_stage1_manifest(dataset_root)
    stage2_entries = read_stage2_manifest(dataset_root)
    target_sample_ids = list(sample_ids) if sample_ids is not None else sorted(stage1_entries)
    pairs = pair_stage_samples(stage1_entries, stage2_entries, sample_ids=target_sample_ids)

    fixtures: list[FixtureSample] = []
    for pair in pairs:
        if pair.stage2 is None:
            raise KeyError(f"Sample {pair.sample_id} missing in stage2 manifest")

        stage1 = _load_stage1_preannotation(dataset_root, pair.stage1)
        stage2, stage2_failure = _load_stage2(dataset_root, pair.stage2)

        source_image_path = _extract_source_image_path(
            dataset_root,
            stage1_record_path=pair.stage1.record_path,
            stage2_input_path=pair.stage2.input_path,
        )
        raw_asset = RawAsset(
            asset_id=pair.sample_id,
            sample_id=pair.sample_id,
            image_url=normalize_media_url(source_image_path),
            width=1280,
            height=720,
            source_image_path_internal=source_image_path,
        )
        fixtures.append(
            FixtureSample(
                sample_id=pair.sample_id,
                raw_asset=raw_asset,
                stage1=stage1,
                stage2=stage2,
                stage2_failure=stage2_failure,
            )
        )

    failure_count = (
        count_stage2_failure_artifacts(dataset_root)
        if sample_ids is None
        else sum(1 for item in fixtures if item.stage2_failure is not None)
    )
    success_count = sum(1 for item in fixtures if item.stage2 is not None)
    now = datetime.now(tz=timezone.utc)

    dataset = Dataset(
        dataset_id="urban_violation",
        name="Urban Violation",
        root_path=str(dataset_root),
        total_assets=len(fixtures),
        stage1_count=len(fixtures),
        stage2_success_count=success_count,
        stage2_failure_count=failure_count,
        created_at=now,
    )
    import_job = ImportJob(
        job_id="fixture-import-urban-violation",
        dataset_id=dataset.dataset_id,
        state=ImportJobState.IMPORTED,
        expected_assets=len(target_sample_ids),
        imported_assets=len(fixtures),
        failure_count=failure_count,
        requested_sample_ids=list(target_sample_ids),
    )

    return FixtureImportBundle(dataset=dataset, import_job=import_job, samples=fixtures)

"""Label config schemas, validation, and in-memory repository."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from pydantic import Field, ValidationError, field_validator, model_validator

from urban_violation_backend.schemas import StrictModel


REQUIRED_OPEN_TAG_FIELDS = frozenset({"scene_elements", "segmentation_targets"})
REQUIRED_CLOSED_ENUM_FIELDS = frozenset(
    {
        "violation_category",
        "sample_category",
        "relation",
        "verification_result",
        "visibility_level",
        "review_decision",
    }
)


class LabelConfigError(ValueError):
    """Raised when label config cannot be served."""


class LabelFieldNotFoundError(ValueError):
    """Raised when a label field is not present in the active config."""


class LabelConfigVersionNotFoundError(ValueError):
    """Raised when a specific config version is not found for a dataset."""


class ActiveLabelConfigNotFoundError(ValueError):
    """Raised when a dataset has no activated label config."""


class LabelConfigPersistenceError(ValueError):
    """Raised when a persisted label config cannot be loaded safely."""


class LabelConfigVersionConflictError(ValueError):
    """Raised when same config.version has different content_hash."""


class LabelOption(StrictModel):
    """One selectable dictionary value or one open-tag suggestion."""

    code: str = Field(min_length=1)
    label_zh: str = Field(min_length=1)
    label_en: str | None = None
    description: str = ""
    status: Literal["active", "deprecated", "draft"] = "active"
    sort_order: int = Field(default=0, ge=0)
    aliases: list[str] = Field(default_factory=list)


class LabelFieldConfig(StrictModel):
    """Configuration for one editable label field."""

    field: str = Field(min_length=1)
    mode: Literal["closed_enum", "open_tags"]
    label_zh: str = Field(min_length=1)
    label_en: str | None = None
    allow_custom: bool = False
    max_items: int | None = Field(default=None, ge=1)
    options: list[LabelOption] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_mode_contract(self) -> "LabelFieldConfig":
        """Ensure field mode and custom-entry behavior cannot conflict."""
        if self.mode == "closed_enum" and self.allow_custom:
            raise ValueError(f"Closed enum field cannot allow custom values: {self.field}")
        if self.mode == "closed_enum" and not self.options:
            raise ValueError(f"Closed enum field must define options: {self.field}")
        if self.mode == "open_tags" and not self.allow_custom:
            raise ValueError(f"Open tag field must allow custom values: {self.field}")
        return self

    @field_validator("options")
    @classmethod
    def sort_options(cls, value: list[LabelOption]) -> list[LabelOption]:
        """Return options in stable display order."""
        return sorted(value, key=lambda item: (item.sort_order, item.code))


class DatasetLabelConfig(StrictModel):
    """Dataset-level label dictionary and open-tag suggestion config."""

    schema_version: str = Field(min_length=1)
    dataset_type: str = Field(min_length=1)
    version: str = Field(min_length=1)
    fields: list[LabelFieldConfig] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_field_rules(self) -> "DatasetLabelConfig":
        """Validate duplicates and required field-mode constraints."""
        field_names = [field.field for field in self.fields]
        duplicate_fields = sorted({name for name in field_names if field_names.count(name) > 1})
        if duplicate_fields:
            raise ValueError(f"Duplicate label fields: {', '.join(duplicate_fields)}")

        for field in self.fields:
            codes = [option.code for option in field.options]
            duplicate_codes = sorted({code for code in codes if codes.count(code) > 1})
            if duplicate_codes:
                raise ValueError(
                    f"Duplicate option codes for {field.field}: {', '.join(duplicate_codes)}"
                )

        field_by_name = {field.field: field for field in self.fields}
        for field_name in REQUIRED_OPEN_TAG_FIELDS:
            field = field_by_name.get(field_name)
            if field is None:
                continue
            if field.mode != "open_tags":
                raise ValueError(f"Field must be open_tags: {field_name}")

        for field_name in REQUIRED_CLOSED_ENUM_FIELDS:
            field = field_by_name.get(field_name)
            if field is None:
                continue
            if field.mode != "closed_enum":
                raise ValueError(f"Field must be closed_enum: {field_name}")

        return self

    def get_field(self, field_name: str) -> LabelFieldConfig:
        """Return one field config by name."""
        for field in self.fields:
            if field.field == field_name:
                return field
        raise LabelFieldNotFoundError(f"Label field not configured: {field_name}")


class LabelValidationIssue(StrictModel):
    """Validation error or warning item for one path/field."""

    field: str
    message: str


class LabelConfigSummary(StrictModel):
    """Aggregated config counters used by frontend preview."""

    field_count: int = Field(ge=0)
    closed_enum_count: int = Field(ge=0)
    open_tags_count: int = Field(ge=0)
    option_count: int = Field(ge=0)


class LabelConfigValidationReport(StrictModel):
    """Validation report returned by the validate endpoint."""

    valid: bool
    dataset_id: str
    schema_version: str
    version: str
    content_hash: str
    summary: LabelConfigSummary
    errors: list[LabelValidationIssue] = Field(default_factory=list)
    warnings: list[LabelValidationIssue] = Field(default_factory=list)
    normalized_config: dict[str, Any] = Field(default_factory=dict)


class StoredLabelConfig(StrictModel):
    """Persisted config metadata and normalized config payload."""

    config_id: str
    dataset_id: str
    schema_version: str
    version: str
    status: Literal["draft", "active", "archived"]
    content_hash: str
    created_at: datetime
    activated_at: datetime | None = None
    file_name: str
    validation: LabelConfigValidationReport
    config: DatasetLabelConfig


class LabelSuggestionResponse(StrictModel):
    """Filtered suggestion payload for one label field."""

    dataset_id: str
    schema_version: str
    version: str
    field: str
    mode: Literal["closed_enum", "open_tags"]
    allow_custom: bool
    query: str
    suggestions: list[LabelOption] = Field(default_factory=list)


class InMemoryLabelConfigRepository:
    """In-memory label config version store keyed by dataset id."""

    def __init__(self) -> None:
        self._counter = 0
        self._configs_by_dataset: dict[str, dict[str, StoredLabelConfig]] = {}
        self._active_config_id_by_dataset: dict[str, str] = {}

    def list_dataset_ids(self) -> list[str]:
        """Return dataset/type ids that have saved configs."""
        return sorted(self._configs_by_dataset)

    def list_configs(self, dataset_id: str) -> list[StoredLabelConfig]:
        """Return all saved config versions for one dataset/type."""
        return sorted(
            self._configs_by_dataset.get(dataset_id, {}).values(),
            key=lambda item: (item.created_at, item.config_id),
        )

    def save(
        self,
        dataset_id: str,
        file_name: str,
        report: LabelConfigValidationReport,
        config: DatasetLabelConfig,
        activate: bool,
        save_as_new_version: bool = False,
    ) -> StoredLabelConfig:
        """Save one validated config and optionally activate it."""
        _ = save_as_new_version  # backward-compat: accepted but cannot bypass dedup
        dataset_store = self._configs_by_dataset.setdefault(dataset_id, {})
        self._normalize_dataset_records(dataset_id)
        dataset_store = self._configs_by_dataset.setdefault(dataset_id, {})
        for existing in dataset_store.values():
            if existing.content_hash == report.content_hash:
                return self.activate(dataset_id=dataset_id, config_id=existing.config_id)
        for existing in dataset_store.values():
            if existing.version == config.version and existing.content_hash != report.content_hash:
                raise LabelConfigVersionConflictError(
                    f"Label config version conflict: dataset={dataset_id}, version={config.version}"
                )

        self._counter += 1
        config_id = f"label-config-{self._counter}"
        created_at = datetime.now(timezone.utc)

        stored = StoredLabelConfig(
            config_id=config_id,
            dataset_id=dataset_id,
            schema_version=config.schema_version,
            version=config.version,
            status="draft",
            content_hash=report.content_hash,
            created_at=created_at,
            file_name=file_name,
            validation=report,
            config=config,
        )
        dataset_store[config_id] = stored
        # Default save path activates the canonical entry.
        _ = activate
        return self.activate(dataset_id=dataset_id, config_id=config_id)

    def activate(self, dataset_id: str, config_id: str) -> StoredLabelConfig:
        """Activate an existing config version for a dataset."""
        dataset_store = self._configs_by_dataset.get(dataset_id)
        if dataset_store is None or config_id not in dataset_store:
            raise LabelConfigVersionNotFoundError(
                f"Label config version not found: dataset={dataset_id}, config_id={config_id}"
            )

        activated_at = datetime.now(timezone.utc)
        for existing_config_id, current in list(dataset_store.items()):
            if existing_config_id == config_id:
                dataset_store[existing_config_id] = current.model_copy(
                    update={"status": "active", "activated_at": activated_at}
                )
            elif current.status == "active":
                dataset_store[existing_config_id] = current.model_copy(update={"status": "archived"})

        self._active_config_id_by_dataset[dataset_id] = config_id
        return dataset_store[config_id]

    def get_active(self, dataset_id: str) -> StoredLabelConfig:
        """Return the active config for a dataset or raise explicit error."""
        active_config_id = self._active_config_id_by_dataset.get(dataset_id)
        if active_config_id is None:
            raise ActiveLabelConfigNotFoundError(
                f"Active label config not found for dataset: {dataset_id}"
            )

        dataset_store = self._configs_by_dataset.get(dataset_id, {})
        active = dataset_store.get(active_config_id)
        if active is None:
            raise ActiveLabelConfigNotFoundError(
                f"Active label config not found for dataset: {dataset_id}"
            )
        return active

    def reload_active(self, dataset_id: str) -> StoredLabelConfig:
        """Reload active config into runtime cache; memory backend is already current."""
        self._normalize_dataset_records(dataset_id)
        return self.get_active(dataset_id)

    def _normalize_dataset_records(self, dataset_id: str) -> bool:
        """Repair duplicate same-hash records and normalize active/status state."""
        dataset_store = self._configs_by_dataset.setdefault(dataset_id, {})
        if not dataset_store:
            self._active_config_id_by_dataset.pop(dataset_id, None)
            return False
        old_store = dict(dataset_store)
        old_active = self._active_config_id_by_dataset.get(dataset_id)

        grouped: dict[str, list[StoredLabelConfig]] = {}
        for row in dataset_store.values():
            grouped.setdefault(row.content_hash, []).append(row)

        canonical_by_id: dict[str, StoredLabelConfig] = {}
        for rows in grouped.values():
            rows_sorted = sorted(rows, key=lambda item: (item.created_at, item.config_id))
            preferred = next((item for item in rows_sorted if item.config_id == old_active), None)
            if preferred is None:
                preferred = next((item for item in rows_sorted if item.status == "active"), None)
            canonical = preferred or rows_sorted[0]
            canonical_by_id[canonical.config_id] = canonical

        resolved_active_id: str | None = None
        if old_active in canonical_by_id:
            resolved_active_id = old_active
        if resolved_active_id is None:
            active_rows = [item for item in canonical_by_id.values() if item.status == "active"]
            if active_rows:
                active_rows.sort(key=lambda item: ((item.activated_at or item.created_at), item.config_id), reverse=True)
                resolved_active_id = active_rows[0].config_id
        if resolved_active_id is None and canonical_by_id:
            fallback = max(canonical_by_id.values(), key=lambda item: (item.created_at, item.config_id))
            resolved_active_id = fallback.config_id

        normalized: dict[str, StoredLabelConfig] = {}
        for config_id, row in canonical_by_id.items():
            if config_id == resolved_active_id:
                normalized[config_id] = row.model_copy(
                    update={
                        "status": "active",
                        "activated_at": (row.activated_at or row.created_at),
                    }
                )
            else:
                normalized[config_id] = row.model_copy(
                    update={
                        "status": ("archived" if row.status == "active" else row.status),
                    }
                )
        self._configs_by_dataset[dataset_id] = normalized
        if resolved_active_id is not None:
            self._active_config_id_by_dataset[dataset_id] = resolved_active_id
        else:
            self._active_config_id_by_dataset.pop(dataset_id, None)
        self._counter = max(
            self._counter,
            max((_extract_config_counter(config_id) for config_id in normalized), default=0),
        )
        return old_store != normalized or old_active != resolved_active_id


class FileBackedLabelConfigRepository(InMemoryLabelConfigRepository):
    """Label config repository persisted under DATASET/{dataset_type}/label_configs."""

    def __init__(self, store_root: Path) -> None:
        super().__init__()
        self._store_root = store_root.resolve()
        self._load_all_datasets()

    def list_dataset_ids(self) -> list[str]:
        """Return dataset/type ids from memory and persisted directories."""
        persisted = {
            path.parent.name
            for path in self._store_root.glob("*/label_configs")
            if path.is_dir()
        }
        return sorted(set(super().list_dataset_ids()) | persisted)

    def list_configs(self, dataset_id: str) -> list[StoredLabelConfig]:
        """Return saved config versions, loading persisted entries on demand."""
        self._load_dataset(dataset_id)
        return super().list_configs(dataset_id)

    def save(
        self,
        dataset_id: str,
        file_name: str,
        report: LabelConfigValidationReport,
        config: DatasetLabelConfig,
        activate: bool,
        save_as_new_version: bool = False,
    ) -> StoredLabelConfig:
        """Save one config version and persist the version registry."""
        self._load_dataset(dataset_id)
        stored = super().save(
            dataset_id=dataset_id,
            file_name=file_name,
            report=report,
            config=config,
            activate=activate,
            save_as_new_version=save_as_new_version,
        )
        self._persist_dataset(dataset_id)
        return stored

    def activate(self, dataset_id: str, config_id: str) -> StoredLabelConfig:
        """Activate a version and persist the active pointer."""
        self._load_dataset(dataset_id)
        stored = super().activate(dataset_id=dataset_id, config_id=config_id)
        self._persist_dataset(dataset_id)
        return stored

    def get_active(self, dataset_id: str) -> StoredLabelConfig:
        """Return active config, restoring it from disk after service restart."""
        try:
            return super().get_active(dataset_id)
        except ActiveLabelConfigNotFoundError:
            return self.reload_active(dataset_id)

    def reload_active(self, dataset_id: str) -> StoredLabelConfig:
        """Reload active config from active.json and version file into memory."""
        self._load_dataset(dataset_id)
        active_path = self._active_path(dataset_id)
        if not active_path.is_file():
            raise ActiveLabelConfigNotFoundError(
                f"Active label config not found for dataset: {dataset_id}"
            )

        active_pointer = self._read_json(active_path)
        config_id = active_pointer.get("config_id")
        if not isinstance(config_id, str) or not config_id:
            raise LabelConfigPersistenceError(f"Invalid active config pointer: {active_path}")

        version_path = self._version_path(dataset_id, config_id)
        if not version_path.is_file():
            raise LabelConfigVersionNotFoundError(
                f"Active label config version file not found: {version_path}"
            )

        stored = StoredLabelConfig.model_validate(self._read_json(version_path))
        expected_dataset = active_pointer.get("dataset_type")
        if expected_dataset != dataset_id or stored.dataset_id != dataset_id:
            raise LabelConfigPersistenceError(
                f"Persisted label config dataset mismatch for {dataset_id}"
            )
        expected_hash = active_pointer.get("content_hash")
        if expected_hash and expected_hash != stored.content_hash:
            raise LabelConfigPersistenceError(
                f"Persisted label config hash mismatch for {dataset_id}/{config_id}"
            )

        dataset_store = self._configs_by_dataset.setdefault(dataset_id, {})
        dataset_store[config_id] = stored.model_copy(update={"status": "active"})
        self._active_config_id_by_dataset[dataset_id] = config_id
        self._counter = max(self._counter, _extract_config_counter(config_id))
        changed = self._normalize_dataset_records(dataset_id)
        if changed:
            self._persist_dataset(dataset_id)
        return self._configs_by_dataset[dataset_id][self._active_config_id_by_dataset[dataset_id]]

    def _load_all_datasets(self) -> None:
        for dataset_id in self.list_dataset_ids():
            self._load_dataset(dataset_id)

    def _load_dataset(self, dataset_id: str) -> None:
        versions_dir = self._versions_dir(dataset_id)
        if not versions_dir.is_dir():
            return

        dataset_store = self._configs_by_dataset.setdefault(dataset_id, {})
        for version_path in sorted(versions_dir.glob("*.json")):
            stored = StoredLabelConfig.model_validate(self._read_json(version_path))
            if stored.dataset_id != dataset_id:
                raise LabelConfigPersistenceError(
                    f"Persisted label config dataset mismatch: {version_path}"
                )
            dataset_store[stored.config_id] = stored
            self._counter = max(self._counter, _extract_config_counter(stored.config_id))

        active_path = self._active_path(dataset_id)
        if active_path.is_file():
            active_pointer = self._read_json(active_path)
            config_id = active_pointer.get("config_id")
            if isinstance(config_id, str) and config_id in dataset_store:
                self._active_config_id_by_dataset[dataset_id] = config_id
        changed = self._normalize_dataset_records(dataset_id)
        if changed:
            self._persist_dataset(dataset_id)

    def _persist_dataset(self, dataset_id: str) -> None:
        dataset_store = self._configs_by_dataset.get(dataset_id, {})
        if not dataset_store:
            return

        versions_dir = self._versions_dir(dataset_id)
        versions_dir.mkdir(parents=True, exist_ok=True)
        for version_path in versions_dir.glob("*.json"):
            if version_path.stem not in dataset_store:
                version_path.unlink()
        for stored in dataset_store.values():
            self._write_json(self._version_path(dataset_id, stored.config_id), stored.model_dump(mode="json"))

        versions = [
            {
                "config_id": stored.config_id,
                "version": stored.version,
                "status": stored.status,
                "content_hash": stored.content_hash,
                "file_name": stored.file_name,
                "created_at": stored.created_at.isoformat(),
                "activated_at": stored.activated_at.isoformat() if stored.activated_at else None,
            }
            for stored in super().list_configs(dataset_id)
        ]
        self._write_json(
            self._registry_path(dataset_id),
            {"dataset_type": dataset_id, "versions": versions},
        )

        active_config_id = self._active_config_id_by_dataset.get(dataset_id)
        if active_config_id:
            active = dataset_store[active_config_id]
            self._write_json(
                self._active_path(dataset_id),
                {
                    "dataset_type": dataset_id,
                    "config_id": active.config_id,
                    "version": active.version,
                    "content_hash": active.content_hash,
                    "activated_at": active.activated_at.isoformat() if active.activated_at else None,
                },
            )

    def _dataset_dir(self, dataset_id: str) -> Path:
        return self._store_root / dataset_id / "label_configs"

    def _registry_path(self, dataset_id: str) -> Path:
        return self._dataset_dir(dataset_id) / "registry.json"

    def _active_path(self, dataset_id: str) -> Path:
        return self._dataset_dir(dataset_id) / "active.json"

    def _versions_dir(self, dataset_id: str) -> Path:
        return self._dataset_dir(dataset_id) / "versions"

    def _version_path(self, dataset_id: str, config_id: str) -> Path:
        return self._versions_dir(dataset_id) / f"{config_id}.json"

    def _read_json(self, path: Path) -> dict[str, Any]:
        return json.loads(path.read_text(encoding="utf-8"))

    def _write_json(self, path: Path, payload: dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = path.with_suffix(f"{path.suffix}.tmp")
        tmp_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )
        tmp_path.replace(path)


def validate_label_config(
    dataset_id: str,
    payload: dict[str, Any],
) -> tuple[LabelConfigValidationReport, DatasetLabelConfig | None]:
    """Validate one label config payload and return report plus parsed config."""
    content_hash = _build_content_hash(payload)
    validation_errors: list[LabelValidationIssue] = []

    try:
        parsed = DatasetLabelConfig.model_validate(payload)
    except ValidationError as exc:
        parsed = None
        validation_errors.extend(_normalize_validation_errors(exc))
    else:
        if parsed.dataset_type != dataset_id:
            validation_errors.append(
                LabelValidationIssue(
                    field="dataset_type",
                    message=(
                        "dataset_type mismatch: "
                        f"expected {dataset_id}, got {parsed.dataset_type}"
                    ),
                )
            )

    summary = _build_summary(parsed)
    report = LabelConfigValidationReport(
        valid=(len(validation_errors) == 0),
        dataset_id=dataset_id,
        schema_version=(parsed.schema_version if parsed else _extract_string(payload, "schema_version")),
        version=(parsed.version if parsed else _extract_string(payload, "version")),
        content_hash=content_hash,
        summary=summary,
        errors=validation_errors,
        warnings=[],
        normalized_config=(parsed.model_dump(mode="json") if parsed is not None else {}),
    )
    return report, (parsed if report.valid else None)


def filter_label_suggestions(
    config: DatasetLabelConfig,
    dataset_id: str,
    field_name: str,
    query: str = "",
) -> LabelSuggestionResponse:
    """Return configured label options matching a user query."""
    field = config.get_field(field_name)
    normalized_query = query.strip().lower()

    if not normalized_query:
        suggestions = field.options
    else:
        suggestions = [
            option
            for option in field.options
            if _option_matches_query(option=option, query=normalized_query)
        ]

    return LabelSuggestionResponse(
        dataset_id=dataset_id,
        schema_version=config.schema_version,
        version=config.version,
        field=field.field,
        mode=field.mode,
        allow_custom=field.allow_custom,
        query=query,
        suggestions=suggestions,
    )


def _build_summary(config: DatasetLabelConfig | None) -> LabelConfigSummary:
    """Build preview counters from a parsed config."""
    if config is None:
        return LabelConfigSummary(
            field_count=0,
            closed_enum_count=0,
            open_tags_count=0,
            option_count=0,
        )

    closed_enum_count = 0
    open_tags_count = 0
    option_count = 0
    for field in config.fields:
        option_count += len(field.options)
        if field.mode == "closed_enum":
            closed_enum_count += 1
        else:
            open_tags_count += 1

    return LabelConfigSummary(
        field_count=len(config.fields),
        closed_enum_count=closed_enum_count,
        open_tags_count=open_tags_count,
        option_count=option_count,
    )


def _build_content_hash(payload: dict[str, Any]) -> str:
    """Return deterministic content hash for one input payload."""
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def _extract_string(payload: dict[str, Any], key: str) -> str:
    """Extract best-effort string for error-report envelope fields."""
    value = payload.get(key)
    return value if isinstance(value, str) else ""


def _extract_config_counter(config_id: str) -> int:
    """Return numeric suffix from a generated config id."""
    suffix = config_id.rsplit("-", 1)[-1]
    return int(suffix) if suffix.isdigit() else 0


def _normalize_validation_errors(exc: ValidationError) -> list[LabelValidationIssue]:
    """Convert Pydantic errors to stable API-facing issue items."""
    issues: list[LabelValidationIssue] = []
    for error in exc.errors(include_url=False):
        location = ".".join(str(part) for part in error.get("loc", ()))
        issues.append(
            LabelValidationIssue(
                field=location,
                message=error.get("msg", "invalid value"),
            )
        )
    return issues


def _option_matches_query(option: LabelOption, query: str) -> bool:
    """Return whether a dictionary option matches the normalized query."""
    searchable_values = [
        option.code,
        option.label_zh,
        option.label_en or "",
        option.description,
        *option.aliases,
    ]
    return any(query in value.lower() for value in searchable_values)

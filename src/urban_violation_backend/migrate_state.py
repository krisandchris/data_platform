"""File-state import CLI for TASK-019 Phase 6."""

from __future__ import annotations

import argparse
from collections import defaultdict
from dataclasses import dataclass, field
from enum import Enum
import json
import os
from pathlib import Path
from typing import Any, Iterable, Sequence

from pydantic import BaseModel, ConfigDict, ValidationError, model_validator

from urban_violation_backend.db import (
    DatabaseBackedPlatformStateStore,
    DatabaseFoundationRegistryRepository,
    DatabaseLabelConfigRepository,
    build_engine,
    build_session_factory,
    redact_database_url,
    run_migrations_to_head,
)
from urban_violation_backend.labels import ActiveLabelConfigNotFoundError, StoredLabelConfig
from urban_violation_backend.schemas import (
    AnnotationSnapshot,
    AuditEvent,
    AuthSession,
    BatchQcAssignment,
    CorrectionSamplePoolItem,
    EvaluationRun,
    ExportJob,
    LabelEditDraft,
    LabelEditSubmission,
    ModificationEvent,
    QcTask,
    RoleBinding,
    SampleLease,
    UserAccount,
)
from urban_violation_backend.state_store import PlatformStateStore


class ImportFileStateArgs(BaseModel):
    """Validated CLI arguments for `import-file-state`."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    platform_state_root: Path
    label_config_store_root: Path
    dataset_root: Path
    database_url: str | None = None
    dry_run: bool = False
    report: Path | None = None
    run_migrations: bool = False

    @model_validator(mode="after")
    def validate_paths(self) -> "ImportFileStateArgs":
        """Require existing file-backed roots to avoid accidental filesystem writes."""
        if not self.platform_state_root.exists() or not self.platform_state_root.is_dir():
            raise ValueError(f"platform_state_root is not a directory: {self.platform_state_root}")
        if not self.label_config_store_root.exists() or not self.label_config_store_root.is_dir():
            raise ValueError(f"label_config_store_root is not a directory: {self.label_config_store_root}")
        if not self.dataset_root.exists() or not self.dataset_root.is_dir():
            raise ValueError(f"dataset_root is not a directory: {self.dataset_root}")
        if self.database_url is not None and not self.database_url.strip():
            raise ValueError("database_url cannot be blank")
        return self


@dataclass(slots=True)
class DomainCounters:
    """Per-domain import counters and conflict tracking."""

    source_count: int = 0
    inserted: int = 0
    matched: int = 0
    conflicts: int = 0
    conflict_ids: list[str] = field(default_factory=list)


@dataclass(slots=True)
class ImportReport:
    """Aggregated import report details."""

    dry_run: bool
    platform_state_root: str
    label_config_store_root: str
    dataset_root: str
    database_url: str
    domains: dict[str, DomainCounters] = field(default_factory=dict)
    filesystem_references: dict[str, list[str]] = field(default_factory=dict)

    def domain(self, name: str) -> DomainCounters:
        """Return mutable counters for one domain."""
        if name not in self.domains:
            self.domains[name] = DomainCounters()
        return self.domains[name]

    @property
    def total_conflicts(self) -> int:
        """Return total conflicts across all domains."""
        return sum(item.conflicts for item in self.domains.values())

    @property
    def total_inserted(self) -> int:
        """Return total inserted rows across all domains."""
        return sum(item.inserted for item in self.domains.values())

    @property
    def total_matched(self) -> int:
        """Return total idempotent matches across all domains."""
        return sum(item.matched for item in self.domains.values())

    @property
    def total_source(self) -> int:
        """Return total source rows seen across all domains."""
        return sum(item.source_count for item in self.domains.values())

    def to_payload(self) -> dict[str, Any]:
        """Render JSON-serializable report payload."""
        domains = {
            name: {
                "source_count": counters.source_count,
                "inserted": counters.inserted,
                "matched": counters.matched,
                "conflicts": counters.conflicts,
                "conflict_ids": counters.conflict_ids,
            }
            for name, counters in sorted(self.domains.items())
        }
        return {
            "status": "conflict" if self.total_conflicts else "ok",
            "dry_run": self.dry_run,
            "paths": {
                "platform_state_root": self.platform_state_root,
                "label_config_store_root": self.label_config_store_root,
                "dataset_root": self.dataset_root,
            },
            "database_url": self.database_url,
            "summary": {
                "source_count": self.total_source,
                "inserted": self.total_inserted,
                "matched": self.total_matched,
                "conflicts": self.total_conflicts,
            },
            "domains": domains,
            "unsupported_domains": [],
            "filesystem_only_domains": [
                "raw_dataset_files",
                "uploaded_archives",
                "extracted_source_files",
                "media_files",
                "export_artifact_blobs",
            ],
            "filesystem_references": self.filesystem_references,
            "notes": [
                "File-backed roots and DATASET files are read-only inputs for this command.",
                "Conflicts are reported and skipped; no silent overwrite is performed.",
            ],
        }


def _canonical_payload(value: Any) -> str:
    """Build stable JSON text for structural comparisons."""
    normalized = _normalize_payload(value)
    return json.dumps(normalized, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _normalize_payload(value: Any) -> Any:
    """Normalize values to JSON-serializable primitives for equality checks."""
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {str(key): _normalize_payload(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_normalize_payload(item) for item in value]
    return value


def _mark_conflict(report: ImportReport, domain: str, identity: str) -> None:
    """Increment conflict counters for one domain/id."""
    counters = report.domain(domain)
    counters.conflicts += 1
    counters.conflict_ids.append(identity)


def _record_compare(
    *,
    report: ImportReport,
    domain: str,
    identity: str,
    source_value: Any,
    target_value: Any | None,
) -> bool:
    """Record source-vs-target equality and return whether insert is allowed."""
    counters = report.domain(domain)
    counters.source_count += 1
    if target_value is None:
        counters.inserted += 1
        return True
    if _canonical_payload(source_value) == _canonical_payload(target_value):
        counters.matched += 1
        return False
    _mark_conflict(report, domain, identity)
    return False


def _load_json(path: Path, *, default: Any) -> Any:
    """Read JSON file with fallback default when the file does not exist."""
    if not path.is_file():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def _scan_qc_dataset_ids(platform_state_root: Path) -> set[str]:
    """Return dataset ids discovered from `platform_state_root/qc/*`."""
    qc_root = platform_state_root / "qc"
    if not qc_root.is_dir():
        return set()
    return {path.name for path in qc_root.iterdir() if path.is_dir()}


def _read_file_drafts(platform_state_root: Path, dataset_ids: Iterable[str]) -> list[LabelEditDraft]:
    """Load per-sample draft files from file-backed state roots."""
    drafts: list[LabelEditDraft] = []
    for dataset_id in sorted(set(dataset_ids)):
        draft_dir = platform_state_root / "qc" / dataset_id / "drafts"
        if not draft_dir.is_dir():
            continue
        for path in sorted(draft_dir.glob("*.json")):
            if path.name.startswith("_batch."):
                continue
            payload = json.loads(path.read_text(encoding="utf-8"))
            drafts.append(LabelEditDraft.model_validate(payload))
    return drafts


def _read_file_batch_drafts(
    platform_state_root: Path,
    dataset_ids: Iterable[str],
) -> dict[str, dict[str, dict[str, Any]]]:
    """Load batch draft payloads keyed as dataset_id -> user_id -> payload."""
    result: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    for dataset_id in sorted(set(dataset_ids)):
        draft_dir = platform_state_root / "qc" / dataset_id / "drafts"
        if not draft_dir.is_dir():
            continue
        for path in sorted(draft_dir.glob("_batch.*.json")):
            suffix = path.stem.removeprefix("_batch.")
            if not suffix:
                continue
            payload = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(payload, dict):
                raise ValueError(f"Invalid batch draft payload (expected object): {path}")
            result[dataset_id][suffix] = payload
    return result


def _read_file_submissions(platform_state_root: Path, dataset_ids: Iterable[str]) -> list[LabelEditSubmission]:
    """Load submission files from file-backed state roots."""
    submissions: list[LabelEditSubmission] = []
    for dataset_id in sorted(set(dataset_ids)):
        sub_dir = platform_state_root / "qc" / dataset_id / "submissions"
        if not sub_dir.is_dir():
            continue
        for path in sorted(sub_dir.glob("*.json")):
            payload = json.loads(path.read_text(encoding="utf-8"))
            submissions.append(LabelEditSubmission.model_validate(payload))
    return submissions


def _read_dataset_type_rows(label_config_store_root: Path) -> list[dict[str, Any]]:
    """Load dataset type registry rows from file-backed registry."""
    payload = _load_json(label_config_store_root / "dataset_types.json", default={})
    if not isinstance(payload, dict):
        return []
    rows = payload.get("dataset_types")
    if not isinstance(rows, list):
        return []
    return [item for item in rows if isinstance(item, dict)]


def _read_registered_batches(label_config_store_root: Path) -> list[dict[str, Any]]:
    """Load registered batch rows from file-backed registry."""
    payload = _load_json(label_config_store_root / "batches.json", default={})
    if not isinstance(payload, dict):
        return []
    rows = payload.get("batches")
    if not isinstance(rows, list):
        return []
    return [item for item in rows if isinstance(item, dict)]


def _read_source_label_configs(
    label_config_store_root: Path,
) -> tuple[dict[str, list[StoredLabelConfig]], dict[str, str]]:
    """Load label-config versions and active pointers without mutating source files."""
    configs_by_dataset: dict[str, list[StoredLabelConfig]] = {}
    active_by_dataset: dict[str, str] = {}

    for dataset_dir in sorted(path for path in label_config_store_root.iterdir() if path.is_dir()):
        dataset_id = dataset_dir.name
        label_root = dataset_dir / "label_configs"
        versions_dir = label_root / "versions"
        if not versions_dir.is_dir():
            continue

        rows: list[StoredLabelConfig] = []
        for version_path in sorted(versions_dir.glob("*.json")):
            payload = json.loads(version_path.read_text(encoding="utf-8"))
            row = StoredLabelConfig.model_validate(payload)
            if row.dataset_id != dataset_id:
                raise ValueError(
                    f"Label config dataset mismatch in {version_path}: "
                    f"expected={dataset_id} got={row.dataset_id}"
                )
            rows.append(row)
        if rows:
            configs_by_dataset[dataset_id] = rows

        active_path = label_root / "active.json"
        if active_path.is_file():
            payload = json.loads(active_path.read_text(encoding="utf-8"))
            config_id = payload.get("config_id")
            if isinstance(config_id, str) and config_id:
                active_by_dataset[dataset_id] = config_id

    return configs_by_dataset, active_by_dataset


def _sorted_values_by_key(mapping: dict[str, Any]) -> list[Any]:
    """Return map values sorted by key for deterministic bulk save calls."""
    return [mapping[key] for key in sorted(mapping)]


def _import_identity_domains(
    *,
    report: ImportReport,
    source_store: PlatformStateStore,
    target_store: DatabaseBackedPlatformStateStore,
) -> None:
    """Import users, role bindings, sessions, and audit events."""

    source_users = source_store.list_users()
    target_users = {item.user_id: item for item in target_store.list_users()}
    merged_users = dict(target_users)
    for user in source_users:
        if _record_compare(
            report=report,
            domain="users",
            identity=user.user_id,
            source_value=user,
            target_value=target_users.get(user.user_id),
        ):
            merged_users[user.user_id] = user
    if not report.dry_run and len(merged_users) != len(target_users):
        target_store.save_users(_sorted_values_by_key(merged_users))

    source_bindings = source_store.list_role_bindings()
    target_bindings = {item.binding_id: item for item in target_store.list_role_bindings()}
    merged_bindings = dict(target_bindings)
    for binding in source_bindings:
        if _record_compare(
            report=report,
            domain="role_bindings",
            identity=binding.binding_id,
            source_value=binding,
            target_value=target_bindings.get(binding.binding_id),
        ):
            merged_bindings[binding.binding_id] = binding
    if not report.dry_run and len(merged_bindings) != len(target_bindings):
        target_store.save_role_bindings(_sorted_values_by_key(merged_bindings))

    source_sessions = source_store.list_sessions()
    target_sessions = {item.session_id: item for item in target_store.list_sessions()}
    merged_sessions = dict(target_sessions)
    for auth_session in source_sessions:
        if _record_compare(
            report=report,
            domain="sessions",
            identity=auth_session.session_id,
            source_value=auth_session,
            target_value=target_sessions.get(auth_session.session_id),
        ):
            merged_sessions[auth_session.session_id] = auth_session
    if not report.dry_run and len(merged_sessions) != len(target_sessions):
        target_store.save_sessions(_sorted_values_by_key(merged_sessions))

    source_audit = source_store.list_audit_events()
    target_audit = {item.event_id: item for item in target_store.list_audit_events()}
    for event in source_audit:
        should_insert = _record_compare(
            report=report,
            domain="audit_events",
            identity=event.event_id,
            source_value=event,
            target_value=target_audit.get(event.event_id),
        )
        if should_insert and not report.dry_run:
            target_store.append_audit_event(event)


def _import_registry_domains(
    *,
    report: ImportReport,
    label_config_store_root: Path,
    registry_repo: DatabaseFoundationRegistryRepository,
) -> list[str]:
    """Import dataset type registry and registered batch/import job state."""
    source_types = _read_dataset_type_rows(label_config_store_root)
    target_types = {
        str(item.get("dataset_type")): item
        for item in registry_repo.load_dataset_type_registry()
        if isinstance(item, dict) and item.get("dataset_type")
    }
    merged_types = dict(target_types)
    for row in source_types:
        dataset_type = str(row.get("dataset_type", ""))
        if not dataset_type:
            continue
        if _record_compare(
            report=report,
            domain="dataset_type_registry",
            identity=dataset_type,
            source_value=row,
            target_value=target_types.get(dataset_type),
        ):
            merged_types[dataset_type] = row
    if not report.dry_run and len(merged_types) != len(target_types):
        registry_repo.save_dataset_type_registry(_sorted_values_by_key(merged_types))

    source_batches = _read_registered_batches(label_config_store_root)
    target_batches = {
        str(item.get("summary", {}).get("dataset_id")): item
        for item in registry_repo.load_registered_batches()
        if isinstance(item, dict)
        and isinstance(item.get("summary"), dict)
        and item.get("summary", {}).get("dataset_id")
    }
    merged_batches = dict(target_batches)
    dataset_ids: list[str] = []
    for row in source_batches:
        summary = row.get("summary") if isinstance(row, dict) else None
        if not isinstance(summary, dict):
            continue
        dataset_id = str(summary.get("dataset_id", ""))
        if not dataset_id:
            continue
        dataset_ids.append(dataset_id)
        if _record_compare(
            report=report,
            domain="registered_batches",
            identity=dataset_id,
            source_value=row,
            target_value=target_batches.get(dataset_id),
        ):
            merged_batches[dataset_id] = row
    if not report.dry_run and len(merged_batches) != len(target_batches):
        registry_repo.save_registered_batches(_sorted_values_by_key(merged_batches))

    return sorted(set(dataset_ids))


def _import_label_configs(
    *,
    report: ImportReport,
    source_configs_by_dataset: dict[str, list[StoredLabelConfig]],
    source_active_by_dataset: dict[str, str],
    target_repo: DatabaseLabelConfigRepository,
) -> None:
    """Import label configs and active pointers while preserving config ids."""
    for dataset_id in sorted(source_configs_by_dataset):
        source_configs = source_configs_by_dataset[dataset_id]
        target_configs = {item.config_id: item for item in target_repo.list_configs(dataset_id)}

        for source_config in source_configs:
            domain = "label_configs"
            identity = source_config.config_id
            should_insert = _record_compare(
                report=report,
                domain=domain,
                identity=identity,
                source_value=source_config,
                target_value=target_configs.get(identity),
            )
            if should_insert and not report.dry_run:
                outcome = target_repo.import_with_preserved_id(source_config)
                if outcome == "conflict":
                    counters = report.domain(domain)
                    counters.inserted -= 1
                    _mark_conflict(report, domain, identity)

        active_domain = "label_config_active_pointers"
        active_counters = report.domain(active_domain)
        source_active_config_id = source_active_by_dataset.get(dataset_id)
        if not source_active_config_id:
            continue

        active_counters.source_count += 1
        try:
            target_active = target_repo.get_active(dataset_id)
        except ActiveLabelConfigNotFoundError:
            target_active = None

        if target_active is None:
            active_counters.inserted += 1
            if not report.dry_run:
                outcome = target_repo.import_active_pointer(
                    dataset_id=dataset_id,
                    config_id=source_active_config_id,
                )
                if outcome == "matched":
                    active_counters.inserted -= 1
                    active_counters.matched += 1
                elif outcome == "conflict":
                    active_counters.inserted -= 1
                    _mark_conflict(report, active_domain, dataset_id)
            continue

        if target_active.config_id == source_active_config_id:
            active_counters.matched += 1
            continue

        _mark_conflict(report, active_domain, dataset_id)


def _import_assignment(
    *,
    report: ImportReport,
    source_assignment: BatchQcAssignment | None,
    target_store: DatabaseBackedPlatformStateStore,
    dataset_id: str,
) -> None:
    """Import one dataset assignment."""
    if source_assignment is None:
        return
    target_assignment = target_store.get_assignment(dataset_id)
    if _record_compare(
        report=report,
        domain="qc_assignments",
        identity=dataset_id,
        source_value=source_assignment,
        target_value=target_assignment,
    ) and not report.dry_run:
        target_store.save_assignment(source_assignment)


def _import_keyed_models(
    *,
    report: ImportReport,
    domain: str,
    source_rows: Sequence[Any],
    target_rows: Sequence[Any],
    key_getter: Any,
    apply_save: Any,
) -> None:
    """Generic import helper for domain rows addressed by one stable key."""
    target_map = {str(key_getter(item)): item for item in target_rows}
    merged_map = dict(target_map)
    for source in source_rows:
        identity = str(key_getter(source))
        if _record_compare(
            report=report,
            domain=domain,
            identity=identity,
            source_value=source,
            target_value=target_map.get(identity),
        ):
            merged_map[identity] = source
    if not report.dry_run and len(merged_map) != len(target_map):
        apply_save(_sorted_values_by_key(merged_map))


def _import_qc_state(
    *,
    report: ImportReport,
    source_store: PlatformStateStore,
    target_store: DatabaseBackedPlatformStateStore,
    dataset_ids: Iterable[str],
) -> None:
    """Import QC assignments/tasks/leases and editor state."""
    dataset_set = set(dataset_ids)

    file_drafts = _read_file_drafts(source_store.root, dataset_set)
    batch_drafts = _read_file_batch_drafts(source_store.root, dataset_set)
    submissions = _read_file_submissions(source_store.root, dataset_set)

    for dataset_id in sorted(dataset_set):
        _import_assignment(
            report=report,
            source_assignment=source_store.get_assignment(dataset_id),
            target_store=target_store,
            dataset_id=dataset_id,
        )

        source_tasks = source_store.list_tasks(dataset_id)
        target_tasks = target_store.list_tasks(dataset_id)
        _import_keyed_models(
            report=report,
            domain="qc_tasks",
            source_rows=source_tasks,
            target_rows=target_tasks,
            key_getter=lambda row: row.task_id,
            apply_save=lambda merged: target_store.save_tasks(dataset_id, merged),
        )

        source_leases = source_store.list_leases(dataset_id)
        target_leases = target_store.list_leases(dataset_id)
        _import_keyed_models(
            report=report,
            domain="qc_leases",
            source_rows=source_leases,
            target_rows=target_leases,
            key_getter=lambda row: row.lease_id,
            apply_save=lambda merged: target_store.save_leases(dataset_id, merged),
        )

        source_snapshots = source_store.list_annotation_snapshots(dataset_id)
        target_snapshots = {
            item.snapshot_id: item for item in target_store.list_annotation_snapshots(dataset_id)
        }
        for snapshot in source_snapshots:
            should_insert = _record_compare(
                report=report,
                domain="annotation_snapshots",
                identity=snapshot.snapshot_id,
                source_value=snapshot,
                target_value=target_snapshots.get(snapshot.snapshot_id),
            )
            if should_insert and not report.dry_run:
                target_store.save_annotation_snapshot(snapshot)

        source_events = source_store.list_modification_events(dataset_id)
        target_events = {
            item.event_id: item for item in target_store.list_modification_events(dataset_id)
        }
        for event in source_events:
            should_insert = _record_compare(
                report=report,
                domain="modification_events",
                identity=event.event_id,
                source_value=event,
                target_value=target_events.get(event.event_id),
            )
            if should_insert and not report.dry_run:
                target_store.save_modification_events(dataset_id, [event])

        source_evaluations = source_store.list_evaluations(dataset_id)
        target_evaluations = {
            item.evaluation_id: item for item in target_store.list_evaluations(dataset_id)
        }
        for evaluation in source_evaluations:
            should_insert = _record_compare(
                report=report,
                domain="evaluations",
                identity=evaluation.evaluation_id,
                source_value=evaluation,
                target_value=target_evaluations.get(evaluation.evaluation_id),
            )
            if should_insert and not report.dry_run:
                target_store.save_evaluation(evaluation)

        source_batch_drafts = batch_drafts.get(dataset_id, {})
        for user_id, payload in source_batch_drafts.items():
            identity = f"{dataset_id}:{user_id}"
            target_payload = target_store.get_batch_draft(dataset_id, user_id)
            should_insert = _record_compare(
                report=report,
                domain="qc_batch_drafts",
                identity=identity,
                source_value=payload,
                target_value=target_payload,
            )
            if should_insert and not report.dry_run:
                target_store.save_batch_draft(dataset_id, user_id, payload)

    for draft in file_drafts:
        identity = f"{draft.dataset_id}:{draft.sample_id}:{draft.user_id}"
        target_draft = target_store.get_draft(draft.dataset_id, draft.sample_id, draft.user_id)
        should_insert = _record_compare(
            report=report,
            domain="qc_drafts",
            identity=identity,
            source_value=draft,
            target_value=target_draft,
        )
        if should_insert and not report.dry_run:
            target_store.save_draft(draft)

    for submission in submissions:
        identity = submission.submission_id
        target_submission = target_store.get_submission(
            submission.dataset_id,
            submission.sample_id,
            submission.submission_id,
        )
        should_insert = _record_compare(
            report=report,
            domain="qc_submissions",
            identity=identity,
            source_value=submission,
            target_value=target_submission,
        )
        if should_insert and not report.dry_run:
            target_store.save_submission(submission)


def _import_pool_export_eval(
    *,
    report: ImportReport,
    source_store: PlatformStateStore,
    target_store: DatabaseBackedPlatformStateStore,
) -> None:
    """Import sample pool items, export jobs, and evaluations."""
    source_pool = source_store.list_sample_pool_items()
    target_pool = {item.item_id: item for item in target_store.list_sample_pool_items()}
    target_pool_by_key = {item.item_key: item for item in target_store.list_sample_pool_items()}
    for item in source_pool:
        identity = item.item_id
        if identity in target_pool:
            _record_compare(
                report=report,
                domain="sample_pool_items",
                identity=identity,
                source_value=item,
                target_value=target_pool[identity],
            )
            continue

        same_key = target_pool_by_key.get(item.item_key)
        counters = report.domain("sample_pool_items")
        counters.source_count += 1
        if same_key is not None and same_key.item_id != item.item_id:
            _mark_conflict(report, "sample_pool_items", identity)
            continue

        counters.inserted += 1
        if not report.dry_run:
            target_store.upsert_sample_pool_item(item)

    source_exports = source_store.list_export_jobs()
    target_exports = {item.export_id: item for item in target_store.list_export_jobs()}
    for export_job in source_exports:
        should_insert = _record_compare(
            report=report,
            domain="export_jobs",
            identity=export_job.export_id,
            source_value=export_job,
            target_value=target_exports.get(export_job.export_id),
        )
        if should_insert and not report.dry_run:
            target_store.save_export_job(export_job)


def _collect_filesystem_references(
    *,
    report: ImportReport,
    registered_batches: list[dict[str, Any]],
    source_store: PlatformStateStore,
) -> None:
    """Collect important filesystem references for migration auditing."""
    source_paths: set[str] = set()
    for row in registered_batches:
        summary = row.get("summary") if isinstance(row, dict) else None
        if isinstance(summary, dict):
            source_uri = summary.get("source_uri")
            if isinstance(source_uri, str) and source_uri:
                source_paths.add(source_uri)
        import_job = row.get("import_job") if isinstance(row, dict) else None
        if isinstance(import_job, dict):
            source_uri = import_job.get("source_uri")
            if isinstance(source_uri, str) and source_uri:
                source_paths.add(source_uri)

    export_artifact_paths = sorted(
        {
            job.artifact_path
            for job in source_store.list_export_jobs()
            if isinstance(job.artifact_path, str) and job.artifact_path
        }
    )

    report.filesystem_references = {
        "dataset_root": [str(report.dataset_root)],
        "import_source_uris": sorted(source_paths),
        "export_artifact_paths": export_artifact_paths,
    }


def run_import_file_state(args: ImportFileStateArgs) -> tuple[ImportReport, int]:
    """Execute one file-state import run and return report plus exit code."""
    database_url = args.database_url or os.environ.get("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL is required (pass --database-url or set environment variable)")

    if args.run_migrations:
        run_migrations_to_head(database_url)

    engine = build_engine(database_url)
    session_factory = build_session_factory(engine)

    source_store = PlatformStateStore(args.platform_state_root)
    source_label_configs, source_active_label_configs = _read_source_label_configs(
        args.label_config_store_root
    )

    target_store = DatabaseBackedPlatformStateStore(args.platform_state_root, session_factory)
    target_label_repo = DatabaseLabelConfigRepository(session_factory)
    registry_repo = DatabaseFoundationRegistryRepository(session_factory)

    report = ImportReport(
        dry_run=args.dry_run,
        platform_state_root=str(args.platform_state_root),
        label_config_store_root=str(args.label_config_store_root),
        dataset_root=str(args.dataset_root),
        database_url=redact_database_url(database_url),
    )

    registered_batches = _read_registered_batches(args.label_config_store_root)
    batch_dataset_ids = {
        str(summary.get("dataset_id"))
        for row in registered_batches
        if isinstance(row, dict)
        for summary in [row.get("summary")]
        if isinstance(summary, dict) and summary.get("dataset_id")
    }

    dataset_ids = set(batch_dataset_ids)
    dataset_ids.update(_scan_qc_dataset_ids(args.platform_state_root))
    dataset_ids.update({item.dataset_id for item in source_store.list_sample_pool_items()})
    dataset_ids.update({item.dataset_id for item in source_store.list_all_evaluations()})

    _import_identity_domains(report=report, source_store=source_store, target_store=target_store)
    imported_batch_dataset_ids = _import_registry_domains(
        report=report,
        label_config_store_root=args.label_config_store_root,
        registry_repo=registry_repo,
    )
    dataset_ids.update(imported_batch_dataset_ids)

    _import_label_configs(
        report=report,
        source_configs_by_dataset=source_label_configs,
        source_active_by_dataset=source_active_label_configs,
        target_repo=target_label_repo,
    )
    _import_qc_state(
        report=report,
        source_store=source_store,
        target_store=target_store,
        dataset_ids=dataset_ids,
    )
    _import_pool_export_eval(report=report, source_store=source_store, target_store=target_store)
    _collect_filesystem_references(
        report=report,
        registered_batches=registered_batches,
        source_store=source_store,
    )

    exit_code = 3 if report.total_conflicts > 0 else 0
    return report, exit_code


def _build_parser() -> argparse.ArgumentParser:
    """Build CLI parser for migration commands."""
    parser = argparse.ArgumentParser(description="Urban Violation backend state migration tools")
    subparsers = parser.add_subparsers(dest="command", required=True)

    import_cmd = subparsers.add_parser(
        "import-file-state",
        help="Import file-backed mutable state into database repositories",
    )
    import_cmd.add_argument("--platform-state-root", type=Path, required=True)
    import_cmd.add_argument("--label-config-store-root", type=Path, required=True)
    import_cmd.add_argument("--dataset-root", type=Path, required=True)
    import_cmd.add_argument("--database-url", type=str, default=None)
    import_cmd.add_argument("--dry-run", action="store_true")
    import_cmd.add_argument("--report", type=Path, default=None)
    import_cmd.add_argument(
        "--run-migrations",
        action="store_true",
        help="Run Alembic migrations to head before import",
    )

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Program entrypoint for `python -m urban_violation_backend.migrate_state`."""
    parser = _build_parser()
    namespace = parser.parse_args(argv)

    if namespace.command != "import-file-state":
        parser.error(f"Unsupported command: {namespace.command}")
        return 2

    try:
        args = ImportFileStateArgs(
            platform_state_root=namespace.platform_state_root,
            label_config_store_root=namespace.label_config_store_root,
            dataset_root=namespace.dataset_root,
            database_url=namespace.database_url,
            dry_run=bool(namespace.dry_run),
            report=namespace.report,
            run_migrations=bool(namespace.run_migrations),
        )
        report, exit_code = run_import_file_state(args)
    except (ValidationError, ValueError) as exc:
        print(json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False))
        return 2

    payload = report.to_payload()
    if args.report is not None:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
    print(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())

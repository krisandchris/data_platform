"""File-backed platform state store for multi-user collaboration."""

from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any
from uuid import uuid4

from urban_violation_backend.schemas import (
    AnnotationSnapshot,
    AnnotationSnapshotType,
    AuditEvent,
    AuthSession,
    BatchQcAssignment,
    CorrectionSamplePoolItem,
    ExportJob,
    LabelEditDraft,
    LabelEditSubmission,
    ModificationEvent,
    QcTask,
    RoleBinding,
    SamplePoolItemStatus,
    SampleLease,
    UserAccount,
)


class PlatformStateStore:
    """Persist mutable runtime state outside raw DATASET fixture files."""

    def __init__(self, root: Path) -> None:
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.users_path = self.root / "users.json"
        self.role_bindings_path = self.root / "role_bindings.json"
        self.sessions_path = self.root / "sessions.json"
        self.audit_path = self.root / "audit_events.jsonl"

    @staticmethod
    def now() -> datetime:
        return datetime.now(timezone.utc)

    @staticmethod
    def new_id(prefix: str) -> str:
        return f"{prefix}_{uuid4().hex[:18]}"

    def _read_json(self, path: Path, default: Any) -> Any:
        if not path.is_file():
            return default
        return json.loads(path.read_text(encoding="utf-8"))

    def _write_json(self, path: Path, payload: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = path.with_suffix(f"{path.suffix}.tmp")
        tmp_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )
        tmp_path.replace(path)

    def _qc_dir(self, dataset_id: str) -> Path:
        return self.root / "qc" / dataset_id

    def _assignment_path(self, dataset_id: str) -> Path:
        return self._qc_dir(dataset_id) / "assignment.json"

    def _tasks_path(self, dataset_id: str) -> Path:
        return self._qc_dir(dataset_id) / "tasks.json"

    def _leases_path(self, dataset_id: str) -> Path:
        return self._qc_dir(dataset_id) / "leases.json"

    def _drafts_dir(self, dataset_id: str) -> Path:
        return self._qc_dir(dataset_id) / "drafts"

    def _submissions_dir(self, dataset_id: str) -> Path:
        return self._qc_dir(dataset_id) / "submissions"

    def _snapshots_path(self, dataset_id: str) -> Path:
        return self._qc_dir(dataset_id) / "annotation_snapshots.jsonl"

    def _modification_events_path(self, dataset_id: str) -> Path:
        return self._qc_dir(dataset_id) / "modification_events.jsonl"

    def _sample_pool_dir(self) -> Path:
        return self.root / "sample_pool"

    def _sample_pool_items_path(self) -> Path:
        return self._sample_pool_dir() / "items.json"

    def _exports_dir(self) -> Path:
        return self.root / "exports"

    def _export_jobs_path(self) -> Path:
        return self._exports_dir() / "jobs.json"

    def export_artifacts_dir(self) -> Path:
        path = self._exports_dir() / "artifacts"
        path.mkdir(parents=True, exist_ok=True)
        return path

    def list_users(self) -> list[UserAccount]:
        payload = self._read_json(self.users_path, default=[])
        return [UserAccount.model_validate(item) for item in payload]

    def save_users(self, users: list[UserAccount]) -> None:
        self._write_json(
            self.users_path,
            [user.model_dump(mode="json") for user in users],
        )

    def list_role_bindings(self) -> list[RoleBinding]:
        payload = self._read_json(self.role_bindings_path, default=[])
        return [RoleBinding.model_validate(item) for item in payload]

    def save_role_bindings(self, bindings: list[RoleBinding]) -> None:
        self._write_json(
            self.role_bindings_path,
            [binding.model_dump(mode="json") for binding in bindings],
        )

    def list_sessions(self) -> list[AuthSession]:
        payload = self._read_json(self.sessions_path, default=[])
        return [AuthSession.model_validate(item) for item in payload]

    def save_sessions(self, sessions: list[AuthSession]) -> None:
        self._write_json(
            self.sessions_path,
            [session.model_dump(mode="json") for session in sessions],
        )

    def append_audit_event(self, event: AuditEvent) -> None:
        self.audit_path.parent.mkdir(parents=True, exist_ok=True)
        with self.audit_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(event.model_dump(mode="json"), ensure_ascii=False) + "\n")

    def _append_jsonl(self, path: Path, payload: dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload, ensure_ascii=False) + "\n")

    def list_audit_events(self) -> list[AuditEvent]:
        if not self.audit_path.is_file():
            return []
        events: list[AuditEvent] = []
        for line in self.audit_path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            events.append(AuditEvent.model_validate(json.loads(stripped)))
        return events

    def list_annotation_snapshots(
        self,
        dataset_id: str,
        *,
        sample_id: str | None = None,
        snapshot_type: AnnotationSnapshotType | None = None,
    ) -> list[AnnotationSnapshot]:
        path = self._snapshots_path(dataset_id)
        if not path.is_file():
            return []
        items: list[AnnotationSnapshot] = []
        for line in path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            snapshot = AnnotationSnapshot.model_validate(json.loads(stripped))
            if sample_id and snapshot.sample_id != sample_id:
                continue
            if snapshot_type and snapshot.snapshot_type != snapshot_type:
                continue
            items.append(snapshot)
        items.sort(key=lambda item: item.created_at)
        return items

    def save_annotation_snapshot(self, snapshot: AnnotationSnapshot) -> AnnotationSnapshot:
        existing = self.list_annotation_snapshots(
            snapshot.dataset_id,
            sample_id=snapshot.sample_id,
            snapshot_type=snapshot.snapshot_type,
        )
        for item in existing:
            if (
                item.payload_hash == snapshot.payload_hash
                and item.source_submission_id == snapshot.source_submission_id
                and item.label_config_id == snapshot.label_config_id
                and item.label_config_version == snapshot.label_config_version
            ):
                return item
        self._append_jsonl(
            self._snapshots_path(snapshot.dataset_id),
            snapshot.model_dump(mode="json"),
        )
        return snapshot

    def list_modification_events(
        self,
        dataset_id: str,
        *,
        sample_id: str | None = None,
        submission_id: str | None = None,
    ) -> list[ModificationEvent]:
        path = self._modification_events_path(dataset_id)
        if not path.is_file():
            return []
        items: list[ModificationEvent] = []
        for line in path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            event = ModificationEvent.model_validate(json.loads(stripped))
            if sample_id and event.sample_id != sample_id:
                continue
            if submission_id and event.submission_id != submission_id:
                continue
            items.append(event)
        items.sort(key=lambda item: item.created_at)
        return items

    def save_modification_events(self, dataset_id: str, events: list[ModificationEvent]) -> list[ModificationEvent]:
        if not events:
            return []
        existing = self.list_modification_events(dataset_id)
        existing_keys = {item.event_key for item in existing}
        inserted: list[ModificationEvent] = []
        for event in events:
            if event.event_key in existing_keys:
                continue
            self._append_jsonl(
                self._modification_events_path(dataset_id),
                event.model_dump(mode="json"),
            )
            existing_keys.add(event.event_key)
            inserted.append(event)
        return inserted

    def list_sample_pool_items(self) -> list[CorrectionSamplePoolItem]:
        payload = self._read_json(self._sample_pool_items_path(), default=[])
        items = [CorrectionSamplePoolItem.model_validate(item) for item in payload]
        items.sort(key=lambda item: (item.updated_at, item.created_at, item.item_id), reverse=True)
        return items

    def get_sample_pool_item(self, item_id: str) -> CorrectionSamplePoolItem | None:
        for item in self.list_sample_pool_items():
            if item.item_id == item_id:
                return item
        return None

    def get_sample_pool_item_by_key(self, item_key: str) -> CorrectionSamplePoolItem | None:
        for item in self.list_sample_pool_items():
            if item.item_key == item_key:
                return item
        return None

    def upsert_sample_pool_item(self, item: CorrectionSamplePoolItem) -> CorrectionSamplePoolItem:
        items = self.list_sample_pool_items()
        replaced = False
        merged = item
        updated_items: list[CorrectionSamplePoolItem] = []
        for existing in items:
            if existing.item_key == item.item_key:
                merged = item.model_copy(update={"item_id": existing.item_id, "created_at": existing.created_at})
                updated_items.append(merged)
                replaced = True
                continue
            updated_items.append(existing)
        if not replaced:
            updated_items.append(item)
        self._write_json(
            self._sample_pool_items_path(),
            [row.model_dump(mode="json") for row in updated_items],
        )
        return merged

    def soft_remove_sample_pool_item(
        self,
        item_id: str,
        *,
        removed_at: datetime,
    ) -> CorrectionSamplePoolItem | None:
        items = self.list_sample_pool_items()
        updated: list[CorrectionSamplePoolItem] = []
        removed_item: CorrectionSamplePoolItem | None = None
        for item in items:
            if item.item_id != item_id:
                updated.append(item)
                continue
            removed_item = item.model_copy(
                update={"status": SamplePoolItemStatus.REMOVED, "updated_at": removed_at}
            )
            updated.append(removed_item)
        if removed_item is None:
            return None
        self._write_json(
            self._sample_pool_items_path(),
            [row.model_dump(mode="json") for row in updated],
        )
        return removed_item

    def list_export_jobs(self) -> list[ExportJob]:
        payload = self._read_json(self._export_jobs_path(), default=[])
        items = [ExportJob.model_validate(item) for item in payload]
        items.sort(key=lambda item: (item.created_at, item.export_id), reverse=True)
        return items

    def get_export_job(self, export_id: str) -> ExportJob | None:
        for job in self.list_export_jobs():
            if job.export_id == export_id:
                return job
        return None

    def save_export_job(self, job: ExportJob) -> ExportJob:
        jobs = self.list_export_jobs()
        updated: list[ExportJob] = []
        replaced = False
        for existing in jobs:
            if existing.export_id == job.export_id:
                updated.append(job)
                replaced = True
                continue
            updated.append(existing)
        if not replaced:
            updated.append(job)
        self._write_json(
            self._export_jobs_path(),
            [row.model_dump(mode="json") for row in updated],
        )
        return job

    def get_assignment(self, dataset_id: str) -> BatchQcAssignment | None:
        payload = self._read_json(self._assignment_path(dataset_id), default=None)
        if payload is None:
            return None
        return BatchQcAssignment.model_validate(payload)

    def save_assignment(self, assignment: BatchQcAssignment | None) -> None:
        dataset_id = assignment.dataset_id if assignment is not None else None
        if dataset_id is None:
            return
        self._write_json(
            self._assignment_path(dataset_id),
            assignment.model_dump(mode="json"),
        )

    def clear_assignment(self, dataset_id: str) -> None:
        path = self._assignment_path(dataset_id)
        if path.exists():
            path.unlink()

    def list_tasks(self, dataset_id: str) -> list[QcTask]:
        payload = self._read_json(self._tasks_path(dataset_id), default=[])
        return [QcTask.model_validate(item) for item in payload]

    def save_tasks(self, dataset_id: str, tasks: list[QcTask]) -> None:
        self._write_json(
            self._tasks_path(dataset_id),
            [task.model_dump(mode="json") for task in tasks],
        )

    def list_leases(self, dataset_id: str) -> list[SampleLease]:
        payload = self._read_json(self._leases_path(dataset_id), default=[])
        return [SampleLease.model_validate(item) for item in payload]

    def save_leases(self, dataset_id: str, leases: list[SampleLease]) -> None:
        self._write_json(
            self._leases_path(dataset_id),
            [lease.model_dump(mode="json") for lease in leases],
        )

    def _draft_path(self, dataset_id: str, sample_id: str, user_id: str) -> Path:
        safe_sample = sample_id.replace("/", "_")
        safe_user = user_id.replace("/", "_")
        return self._drafts_dir(dataset_id) / f"{safe_sample}.{safe_user}.json"

    def get_draft(self, dataset_id: str, sample_id: str, user_id: str) -> LabelEditDraft | None:
        path = self._draft_path(dataset_id, sample_id, user_id)
        payload = self._read_json(path, default=None)
        if payload is None:
            return None
        return LabelEditDraft.model_validate(payload)

    def save_draft(self, draft: LabelEditDraft) -> None:
        self._write_json(
            self._draft_path(draft.dataset_id, draft.sample_id, draft.user_id),
            draft.model_dump(mode="json"),
        )

    def _submission_path(self, dataset_id: str, sample_id: str, submission_id: str) -> Path:
        safe_sample = sample_id.replace("/", "_")
        safe_submission = submission_id.replace("/", "_")
        return self._submissions_dir(dataset_id) / f"{safe_sample}.{safe_submission}.json"

    def save_submission(self, submission: LabelEditSubmission) -> None:
        self._write_json(
            self._submission_path(
                submission.dataset_id,
                submission.sample_id,
                submission.submission_id,
            ),
            submission.model_dump(mode="json"),
        )

    def list_submissions(self, dataset_id: str, sample_id: str) -> list[LabelEditSubmission]:
        root = self._submissions_dir(dataset_id)
        if not root.is_dir():
            return []
        prefix = f"{sample_id.replace('/', '_')}."
        records: list[LabelEditSubmission] = []
        for path in sorted(root.glob(f"{prefix}*.json")):
            payload = self._read_json(path, default=None)
            if payload is None:
                continue
            records.append(LabelEditSubmission.model_validate(payload))
        records.sort(key=lambda item: item.created_at)
        return records

    def get_submission(
        self,
        dataset_id: str,
        sample_id: str,
        submission_id: str,
    ) -> LabelEditSubmission | None:
        payload = self._read_json(
            self._submission_path(dataset_id, sample_id, submission_id),
            default=None,
        )
        if payload is None:
            return None
        return LabelEditSubmission.model_validate(payload)

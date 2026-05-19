"""File-backed platform state store for multi-user collaboration."""

from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any
from uuid import uuid4

from urban_violation_backend.schemas import (
    AuditEvent,
    AuthSession,
    BatchQcAssignment,
    LabelEditDraft,
    LabelEditSubmission,
    QcTask,
    RoleBinding,
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

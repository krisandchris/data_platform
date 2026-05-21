"""Database-backed foundation repositories for TASK-019 Phase 3."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from urban_violation_backend.api_schemas import DatasetSummaryResponse
from urban_violation_backend.db.engine import SessionFactory, session_scope
from urban_violation_backend.db.models import (
    AnnotationSnapshotRow,
    AuditEventRow,
    DatasetBatchRow,
    DatasetTypeRegistryRow,
    EvaluationRunRow,
    ExportJobRow,
    ImportJobRow,
    LabelConfigActiveRow,
    LabelConfigRow,
    ModificationEventRow,
    PlatformRoleBindingRow,
    PlatformSessionRow,
    PlatformUserRow,
    QcAssignmentRow,
    QcBatchDraftRow,
    QcDraftRow,
    QcLeaseRow,
    QcSubmissionRow,
    QcTaskRow,
    SamplePoolItemRow,
)
from urban_violation_backend.labels import (
    ActiveLabelConfigNotFoundError,
    DatasetLabelConfig,
    LabelConfigRepositoryProtocol,
    LabelConfigValidationReport,
    LabelConfigVersionConflictError,
    LabelConfigVersionNotFoundError,
    StoredLabelConfig,
)
from urban_violation_backend.schemas import (
    AnnotationSnapshot,
    AnnotationSnapshotType,
    AuditEvent,
    AuthSession,
    BatchQcAssignment,
    CorrectionSamplePoolItem,
    EvaluationRun,
    ExportJob,
    ImportJob,
    LabelEditDraft,
    LabelEditSubmission,
    ModificationEvent,
    QcTask,
    RoleBinding,
    SampleLease,
    SamplePoolItemStatus,
    UserAccount,
)
from urban_violation_backend.state_store import PlatformStateStore


def _as_utc(value: datetime | None) -> datetime | None:
    """Normalize DB-loaded datetimes to aware UTC values."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


class FoundationRegistryRepositoryProtocol(Protocol):
    """Persistence boundary for dataset-type and batch/import-job registries."""

    def load_dataset_type_registry(self) -> list[dict[str, Any]]: ...

    def save_dataset_type_registry(self, rows: list[dict[str, Any]]) -> None: ...

    def load_registered_batches(self) -> list[dict[str, Any]]: ...

    def save_registered_batches(self, rows: list[dict[str, Any]]) -> None: ...


class DatabaseFoundationRegistryRepository:
    """Database-backed dataset-type and batch/import-job registry store."""

    def __init__(self, session_factory: SessionFactory) -> None:
        self._session_factory = session_factory

    def load_dataset_type_registry(self) -> list[dict[str, Any]]:
        """Load dataset type registry rows with stable ordering."""
        with session_scope(self._session_factory) as session:
            rows = session.scalars(
                select(DatasetTypeRegistryRow).order_by(DatasetTypeRegistryRow.dataset_type)
            ).all()
            return [
                {
                    "dataset_type": row.dataset_type,
                    "display_name": row.display_name,
                    "field_schema_version": row.field_schema_version,
                    "status": row.status,
                }
                for row in rows
            ]

    def save_dataset_type_registry(self, rows: list[dict[str, Any]]) -> None:
        """Replace dataset type registry rows transactionally."""
        now = datetime.now(timezone.utc)
        with session_scope(self._session_factory) as session:
            existing_created_map = {
                row.dataset_type: row.created_at
                for row in session.scalars(select(DatasetTypeRegistryRow)).all()
            }
            session.execute(delete(DatasetTypeRegistryRow))
            for payload in rows:
                dataset_type = str(payload.get("dataset_type", ""))
                if not dataset_type:
                    continue
                session.add(
                    DatasetTypeRegistryRow(
                        dataset_type=dataset_type,
                        display_name=str(payload.get("display_name") or dataset_type),
                        field_schema_version=str(payload.get("field_schema_version") or "draft"),
                        status=str(payload.get("status") or "active"),
                        created_at=existing_created_map.get(dataset_type, now),
                        updated_at=now,
                    )
                )

    def load_registered_batches(self) -> list[dict[str, Any]]:
        """Load registered batch summary/import-job payload rows."""
        with session_scope(self._session_factory) as session:
            batch_rows = session.scalars(
                select(DatasetBatchRow).order_by(DatasetBatchRow.dataset_id)
            ).all()
            job_rows = session.scalars(select(ImportJobRow)).all()
            jobs_by_id = {row.job_id: row.job_payload for row in job_rows}

            result: list[dict[str, Any]] = []
            for batch in batch_rows:
                summary_payload = dict(batch.summary_payload)
                active_job_id = summary_payload.get("active_import_job_id")
                job_payload = jobs_by_id.get(str(active_job_id)) if active_job_id else None
                result.append({"summary": summary_payload, "import_job": job_payload})
            return result

    def save_registered_batches(self, rows: list[dict[str, Any]]) -> None:
        """Replace registered batch and import-job metadata transactionally."""
        now = datetime.now(timezone.utc)
        with session_scope(self._session_factory) as session:
            session.execute(delete(DatasetBatchRow))
            session.execute(delete(ImportJobRow))

            for payload in rows:
                summary_payload = payload.get("summary")
                if not isinstance(summary_payload, dict):
                    continue

                try:
                    summary = DatasetSummaryResponse.model_validate(summary_payload)
                except ValueError:
                    continue

                session.add(
                    DatasetBatchRow(
                        dataset_id=summary.dataset_id,
                        dataset_type=summary.dataset_type,
                        summary_payload=summary.model_dump(mode="json"),
                        updated_at=now,
                    )
                )

                job_payload = payload.get("import_job")
                if not isinstance(job_payload, dict):
                    continue
                try:
                    job = ImportJob.model_validate(job_payload)
                except ValueError:
                    continue
                session.add(
                    ImportJobRow(
                        job_id=job.job_id,
                        dataset_id=job.dataset_id,
                        job_payload=job.model_dump(mode="json"),
                        updated_at=now,
                    )
                )


class DatabaseLabelConfigRepository(LabelConfigRepositoryProtocol):
    """Database-backed label config repository with activation semantics."""

    def __init__(self, session_factory: SessionFactory) -> None:
        self._session_factory = session_factory

    def list_dataset_ids(self) -> list[str]:
        """Return dataset ids that have at least one stored config."""
        with session_scope(self._session_factory) as session:
            rows = session.scalars(select(LabelConfigRow.dataset_id).distinct()).all()
            return sorted(rows)

    def list_configs(self, dataset_id: str) -> list[StoredLabelConfig]:
        """List all versions for one dataset."""
        with session_scope(self._session_factory) as session:
            rows = session.scalars(
                select(LabelConfigRow)
                .where(LabelConfigRow.dataset_id == dataset_id)
                .order_by(LabelConfigRow.created_at, LabelConfigRow.config_id)
            ).all()
            return [self._to_stored_model(row) for row in rows]

    def save(
        self,
        dataset_id: str,
        file_name: str,
        report: LabelConfigValidationReport,
        config: DatasetLabelConfig,
        activate: bool,
        save_as_new_version: bool = False,
    ) -> StoredLabelConfig:
        """Save one config version with same-hash dedup and same-version conflict checks."""
        _ = activate
        _ = save_as_new_version

        with session_scope(self._session_factory) as session:
            existing_same_hash = session.scalar(
                select(LabelConfigRow).where(
                    LabelConfigRow.dataset_id == dataset_id,
                    LabelConfigRow.content_hash == report.content_hash,
                )
            )
            if existing_same_hash is not None:
                return self._activate_in_session(
                    session=session,
                    dataset_id=dataset_id,
                    config_id=existing_same_hash.config_id,
                )

            existing_same_version = session.scalar(
                select(LabelConfigRow).where(
                    LabelConfigRow.dataset_id == dataset_id,
                    LabelConfigRow.version == config.version,
                )
            )
            if (
                existing_same_version is not None
                and existing_same_version.content_hash != report.content_hash
            ):
                raise LabelConfigVersionConflictError(
                    f"Label config version conflict: dataset={dataset_id}, version={config.version}"
                )

            row = LabelConfigRow(
                config_id=f"label-config-{uuid4().hex[:18]}",
                dataset_id=dataset_id,
                schema_version=config.schema_version,
                version=config.version,
                status="draft",
                content_hash=report.content_hash,
                created_at=datetime.now(timezone.utc),
                activated_at=None,
                file_name=file_name,
                validation_payload=report.model_dump(mode="json"),
                config_payload=config.model_dump(mode="json"),
            )
            session.add(row)
            session.flush()
            return self._activate_in_session(session=session, dataset_id=dataset_id, config_id=row.config_id)

    def activate(self, dataset_id: str, config_id: str) -> StoredLabelConfig:
        """Set one config as active for the dataset."""
        with session_scope(self._session_factory) as session:
            return self._activate_in_session(session=session, dataset_id=dataset_id, config_id=config_id)

    def get_active(self, dataset_id: str) -> StoredLabelConfig:
        """Return active config or raise explicit not-found error."""
        with session_scope(self._session_factory) as session:
            pointer = session.get(LabelConfigActiveRow, dataset_id)
            if pointer is None:
                raise ActiveLabelConfigNotFoundError(
                    f"Active label config not found for dataset: {dataset_id}"
                )
            row = session.get(LabelConfigRow, pointer.config_id)
            if row is None or row.dataset_id != dataset_id:
                raise ActiveLabelConfigNotFoundError(
                    f"Active label config not found for dataset: {dataset_id}"
                )
            return self._to_stored_model(row)

    def reload_active(self, dataset_id: str) -> StoredLabelConfig:
        """Reload active config from authoritative database state."""
        return self.get_active(dataset_id)

    def _activate_in_session(
        self,
        *,
        session: Session,
        dataset_id: str,
        config_id: str,
    ) -> StoredLabelConfig:
        row = session.get(LabelConfigRow, config_id)
        if row is None or row.dataset_id != dataset_id:
            raise LabelConfigVersionNotFoundError(
                f"Label config version not found: dataset={dataset_id}, config_id={config_id}"
            )

        now = datetime.now(timezone.utc)
        rows = session.scalars(
            select(LabelConfigRow).where(LabelConfigRow.dataset_id == dataset_id)
        ).all()
        for item in rows:
            if item.config_id == config_id:
                item.status = "active"
                item.activated_at = now
            elif item.status == "active":
                item.status = "archived"

        pointer = session.get(LabelConfigActiveRow, dataset_id)
        if pointer is None:
            pointer = LabelConfigActiveRow(dataset_id=dataset_id, config_id=config_id, updated_at=now)
            session.add(pointer)
        else:
            pointer.config_id = config_id
            pointer.updated_at = now

        session.flush()
        return self._to_stored_model(row)

    def _to_stored_model(self, row: LabelConfigRow) -> StoredLabelConfig:
        return StoredLabelConfig(
            config_id=row.config_id,
            dataset_id=row.dataset_id,
            schema_version=row.schema_version,
            version=row.version,
            status=row.status,
            content_hash=row.content_hash,
            created_at=_as_utc(row.created_at),
            activated_at=_as_utc(row.activated_at),
            file_name=row.file_name,
            validation=LabelConfigValidationReport.model_validate(row.validation_payload),
            config=DatasetLabelConfig.model_validate(row.config_payload),
        )


class DatabaseBackedPlatformStateStore(PlatformStateStore):
    """Hybrid store: DB-backed foundation domains and file-backed later domains."""

    def __init__(self, root: Path, session_factory: SessionFactory) -> None:
        super().__init__(root)
        self._session_factory = session_factory

    def list_users(self) -> list[UserAccount]:
        with session_scope(self._session_factory) as session:
            rows = session.scalars(
                select(PlatformUserRow).order_by(PlatformUserRow.created_at, PlatformUserRow.user_id)
            ).all()
            return [
                UserAccount.model_validate(
                    {
                        "user_id": row.user_id,
                        "display_name": row.display_name,
                        "email": row.email,
                        "password_hash": row.password_hash,
                        "status": row.status,
                        "created_at": _as_utc(row.created_at),
                        "updated_at": _as_utc(row.updated_at),
                        "last_seen_at": _as_utc(row.last_seen_at),
                    }
                )
                for row in rows
            ]

    def save_users(self, users: list[UserAccount]) -> None:
        with session_scope(self._session_factory) as session:
            session.execute(delete(PlatformUserRow))
            for user in users:
                session.add(
                    PlatformUserRow(
                        user_id=user.user_id,
                        display_name=user.display_name,
                        email=user.email,
                        password_hash=user.password_hash,
                        status=user.status.value,
                        created_at=user.created_at,
                        updated_at=user.updated_at,
                        last_seen_at=user.last_seen_at,
                    )
                )

    def list_role_bindings(self) -> list[RoleBinding]:
        with session_scope(self._session_factory) as session:
            rows = session.scalars(
                select(PlatformRoleBindingRow).order_by(
                    PlatformRoleBindingRow.created_at,
                    PlatformRoleBindingRow.binding_id,
                )
            ).all()
            return [
                RoleBinding.model_validate(
                    {
                        "binding_id": row.binding_id,
                        "user_id": row.user_id,
                        "role": row.role,
                        "scope_type": row.scope_type,
                        "scope_id": row.scope_id,
                        "created_by": row.created_by,
                        "created_at": _as_utc(row.created_at),
                    }
                )
                for row in rows
            ]

    def save_role_bindings(self, bindings: list[RoleBinding]) -> None:
        with session_scope(self._session_factory) as session:
            session.execute(delete(PlatformRoleBindingRow))
            for binding in bindings:
                session.add(
                    PlatformRoleBindingRow(
                        binding_id=binding.binding_id,
                        user_id=binding.user_id,
                        role=binding.role.value,
                        scope_type=binding.scope_type.value,
                        scope_id=binding.scope_id,
                        created_by=binding.created_by,
                        created_at=binding.created_at,
                    )
                )

    def list_sessions(self) -> list[AuthSession]:
        with session_scope(self._session_factory) as session:
            rows = session.scalars(
                select(PlatformSessionRow).order_by(
                    PlatformSessionRow.created_at,
                    PlatformSessionRow.session_id,
                )
            ).all()
            return [
                AuthSession.model_validate(
                    {
                        "session_id": row.session_id,
                        "user_id": row.user_id,
                        "token": row.token,
                        "auth_mode": row.auth_mode,
                        "created_at": _as_utc(row.created_at),
                        "expires_at": _as_utc(row.expires_at),
                        "revoked_at": _as_utc(row.revoked_at),
                    }
                )
                for row in rows
            ]

    def save_sessions(self, sessions: list[AuthSession]) -> None:
        with session_scope(self._session_factory) as session:
            session.execute(delete(PlatformSessionRow))
            for auth_session in sessions:
                session.add(
                    PlatformSessionRow(
                        session_id=auth_session.session_id,
                        user_id=auth_session.user_id,
                        token=auth_session.token,
                        auth_mode=auth_session.auth_mode,
                        created_at=auth_session.created_at,
                        expires_at=auth_session.expires_at,
                        revoked_at=auth_session.revoked_at,
                    )
                )

    def append_audit_event(self, event: AuditEvent) -> None:
        with session_scope(self._session_factory) as session:
            session.add(
                AuditEventRow(
                    event_id=event.event_id,
                    actor_user_id=event.actor_user_id,
                    actor_roles=[role.value for role in event.actor_roles],
                    action=event.action,
                    entity=event.entity,
                    dataset_id=event.dataset_id,
                    sample_id=event.sample_id,
                    details=event.details,
                    before_payload=event.before,
                    after_payload=event.after,
                    created_at=event.created_at,
                )
            )

    def list_audit_events(self) -> list[AuditEvent]:
        with session_scope(self._session_factory) as session:
            rows = session.scalars(
                select(AuditEventRow).order_by(AuditEventRow.created_at, AuditEventRow.event_id)
            ).all()
            return [
                AuditEvent.model_validate(
                    {
                        "event_id": row.event_id,
                        "actor_user_id": row.actor_user_id,
                        "actor_roles": row.actor_roles,
                        "action": row.action,
                        "entity": row.entity,
                        "dataset_id": row.dataset_id,
                        "sample_id": row.sample_id,
                        "details": row.details,
                        "before": row.before_payload,
                        "after": row.after_payload,
                        "created_at": _as_utc(row.created_at),
                    }
                )
                for row in rows
            ]

    def list_annotation_snapshots(
        self,
        dataset_id: str,
        *,
        sample_id: str | None = None,
        snapshot_type: AnnotationSnapshotType | None = None,
    ) -> list[AnnotationSnapshot]:
        with session_scope(self._session_factory) as session:
            stmt = (
                select(AnnotationSnapshotRow)
                .where(AnnotationSnapshotRow.dataset_id == dataset_id)
                .order_by(AnnotationSnapshotRow.created_at, AnnotationSnapshotRow.snapshot_id)
            )
            if sample_id is not None:
                stmt = stmt.where(AnnotationSnapshotRow.sample_id == sample_id)
            if snapshot_type is not None:
                stmt = stmt.where(AnnotationSnapshotRow.snapshot_type == snapshot_type.value)
            rows = session.scalars(stmt).all()
            return [AnnotationSnapshot.model_validate(row.snapshot_payload) for row in rows]

    def save_annotation_snapshot(self, snapshot: AnnotationSnapshot) -> AnnotationSnapshot:
        with session_scope(self._session_factory) as session:
            existing_rows = session.scalars(
                select(AnnotationSnapshotRow).where(
                    AnnotationSnapshotRow.dataset_id == snapshot.dataset_id,
                    AnnotationSnapshotRow.sample_id == snapshot.sample_id,
                    AnnotationSnapshotRow.snapshot_type == snapshot.snapshot_type.value,
                )
            ).all()
            for row in existing_rows:
                candidate = AnnotationSnapshot.model_validate(row.snapshot_payload)
                if (
                    candidate.payload_hash == snapshot.payload_hash
                    and candidate.source_submission_id == snapshot.source_submission_id
                    and candidate.label_config_id == snapshot.label_config_id
                    and candidate.label_config_version == snapshot.label_config_version
                ):
                    return candidate

            session.add(
                AnnotationSnapshotRow(
                    snapshot_id=snapshot.snapshot_id,
                    dataset_id=snapshot.dataset_id,
                    sample_id=snapshot.sample_id,
                    snapshot_type=snapshot.snapshot_type.value,
                    payload_hash=snapshot.payload_hash,
                    source_submission_id=snapshot.source_submission_id,
                    label_config_id=snapshot.label_config_id,
                    label_config_version=snapshot.label_config_version,
                    created_at=snapshot.created_at,
                    snapshot_payload=snapshot.model_dump(mode="json"),
                )
            )
            return snapshot

    def list_modification_events(
        self,
        dataset_id: str,
        *,
        sample_id: str | None = None,
        submission_id: str | None = None,
    ) -> list[ModificationEvent]:
        with session_scope(self._session_factory) as session:
            stmt = (
                select(ModificationEventRow)
                .where(ModificationEventRow.dataset_id == dataset_id)
                .order_by(ModificationEventRow.created_at, ModificationEventRow.event_id)
            )
            if sample_id is not None:
                stmt = stmt.where(ModificationEventRow.sample_id == sample_id)
            if submission_id is not None:
                stmt = stmt.where(ModificationEventRow.submission_id == submission_id)
            rows = session.scalars(stmt).all()
            return [ModificationEvent.model_validate(row.event_payload) for row in rows]

    def save_modification_events(
        self,
        dataset_id: str,
        events: list[ModificationEvent],
    ) -> list[ModificationEvent]:
        if not events:
            return []
        with session_scope(self._session_factory) as session:
            existing_keys = set(
                session.scalars(
                    select(ModificationEventRow.event_key).where(
                        ModificationEventRow.dataset_id == dataset_id
                    )
                ).all()
            )
            inserted: list[ModificationEvent] = []
            for event in events:
                if event.event_key in existing_keys:
                    continue
                session.add(
                    ModificationEventRow(
                        event_id=event.event_id,
                        event_key=event.event_key,
                        dataset_id=event.dataset_id,
                        sample_id=event.sample_id,
                        submission_id=event.submission_id,
                        created_at=event.created_at,
                        event_payload=event.model_dump(mode="json"),
                    )
                )
                existing_keys.add(event.event_key)
                inserted.append(event)
            return inserted

    def list_sample_pool_items(self) -> list[CorrectionSamplePoolItem]:
        with session_scope(self._session_factory) as session:
            rows = session.scalars(
                select(SamplePoolItemRow).order_by(
                    SamplePoolItemRow.updated_at.desc(),
                    SamplePoolItemRow.created_at.desc(),
                    SamplePoolItemRow.item_id.desc(),
                )
            ).all()
            return [CorrectionSamplePoolItem.model_validate(row.item_payload) for row in rows]

    def get_sample_pool_item(self, item_id: str) -> CorrectionSamplePoolItem | None:
        with session_scope(self._session_factory) as session:
            row = session.get(SamplePoolItemRow, item_id)
            if row is None:
                return None
            return CorrectionSamplePoolItem.model_validate(row.item_payload)

    def get_sample_pool_item_by_key(self, item_key: str) -> CorrectionSamplePoolItem | None:
        with session_scope(self._session_factory) as session:
            row = session.scalar(
                select(SamplePoolItemRow).where(SamplePoolItemRow.item_key == item_key)
            )
            if row is None:
                return None
            return CorrectionSamplePoolItem.model_validate(row.item_payload)

    def upsert_sample_pool_item(self, item: CorrectionSamplePoolItem) -> CorrectionSamplePoolItem:
        with session_scope(self._session_factory) as session:
            existing = session.scalar(
                select(SamplePoolItemRow).where(SamplePoolItemRow.item_key == item.item_key)
            )
            if existing is None:
                session.add(
                    SamplePoolItemRow(
                        item_id=item.item_id,
                        item_key=item.item_key,
                        dataset_id=item.dataset_id,
                        status=item.status.value,
                        created_at=item.created_at,
                        updated_at=item.updated_at,
                        item_payload=item.model_dump(mode="json"),
                    )
                )
                return item

            merged = item.model_copy(
                update={
                    "item_id": existing.item_id,
                    "created_at": _as_utc(existing.created_at),
                }
            )
            existing.dataset_id = merged.dataset_id
            existing.status = merged.status.value
            existing.created_at = merged.created_at
            existing.updated_at = merged.updated_at
            existing.item_payload = merged.model_dump(mode="json")
            return merged

    def soft_remove_sample_pool_item(
        self,
        item_id: str,
        *,
        removed_at: datetime,
    ) -> CorrectionSamplePoolItem | None:
        with session_scope(self._session_factory) as session:
            row = session.get(SamplePoolItemRow, item_id)
            if row is None:
                return None
            item = CorrectionSamplePoolItem.model_validate(row.item_payload)
            removed = item.model_copy(
                update={"status": SamplePoolItemStatus.REMOVED, "updated_at": removed_at}
            )
            row.status = removed.status.value
            row.updated_at = removed.updated_at
            row.item_payload = removed.model_dump(mode="json")
            return removed

    def list_export_jobs(self) -> list[ExportJob]:
        with session_scope(self._session_factory) as session:
            rows = session.scalars(
                select(ExportJobRow).order_by(
                    ExportJobRow.created_at.desc(),
                    ExportJobRow.export_id.desc(),
                )
            ).all()
            return [ExportJob.model_validate(row.export_payload) for row in rows]

    def get_export_job(self, export_id: str) -> ExportJob | None:
        with session_scope(self._session_factory) as session:
            row = session.get(ExportJobRow, export_id)
            if row is None:
                return None
            return ExportJob.model_validate(row.export_payload)

    def save_export_job(self, job: ExportJob) -> ExportJob:
        with session_scope(self._session_factory) as session:
            row = session.get(ExportJobRow, job.export_id)
            if row is None:
                row = ExportJobRow(
                    export_id=job.export_id,
                    status=job.status.value,
                    created_at=job.created_at,
                    export_payload=job.model_dump(mode="json"),
                )
                session.add(row)
                return job

            row.status = job.status.value
            row.created_at = job.created_at
            row.export_payload = job.model_dump(mode="json")
            return job

    def list_evaluations(self, dataset_id: str) -> list[EvaluationRun]:
        with session_scope(self._session_factory) as session:
            rows = session.scalars(
                select(EvaluationRunRow)
                .where(EvaluationRunRow.dataset_id == dataset_id)
                .order_by(EvaluationRunRow.created_at.desc(), EvaluationRunRow.evaluation_id.desc())
            ).all()
            return [EvaluationRun.model_validate(row.evaluation_payload) for row in rows]

    def list_all_evaluations(self) -> list[EvaluationRun]:
        with session_scope(self._session_factory) as session:
            rows = session.scalars(
                select(EvaluationRunRow).order_by(
                    EvaluationRunRow.created_at.desc(),
                    EvaluationRunRow.evaluation_id.desc(),
                )
            ).all()
            return [EvaluationRun.model_validate(row.evaluation_payload) for row in rows]

    def get_evaluation(self, dataset_id: str, evaluation_id: str) -> EvaluationRun | None:
        with session_scope(self._session_factory) as session:
            row = session.get(EvaluationRunRow, evaluation_id)
            if row is None or row.dataset_id != dataset_id:
                return None
            return EvaluationRun.model_validate(row.evaluation_payload)

    def get_evaluation_by_id(self, evaluation_id: str) -> EvaluationRun | None:
        with session_scope(self._session_factory) as session:
            row = session.get(EvaluationRunRow, evaluation_id)
            if row is None:
                return None
            return EvaluationRun.model_validate(row.evaluation_payload)

    def save_evaluation(self, run: EvaluationRun) -> EvaluationRun:
        with session_scope(self._session_factory) as session:
            row = session.get(EvaluationRunRow, run.evaluation_id)
            if row is None:
                row = EvaluationRunRow(
                    evaluation_id=run.evaluation_id,
                    dataset_id=run.dataset_id,
                    status=run.status.value,
                    created_at=run.created_at,
                    completed_at=run.completed_at,
                    evaluation_payload=run.model_dump(mode="json"),
                )
                session.add(row)
                return run

            row.dataset_id = run.dataset_id
            row.status = run.status.value
            row.created_at = run.created_at
            row.completed_at = run.completed_at
            row.evaluation_payload = run.model_dump(mode="json")
            return run

    def get_assignment(self, dataset_id: str) -> BatchQcAssignment | None:
        with session_scope(self._session_factory) as session:
            row = session.get(QcAssignmentRow, dataset_id)
            if row is None:
                return None
            return BatchQcAssignment.model_validate(row.assignment_payload)

    def save_assignment(self, assignment: BatchQcAssignment | None) -> None:
        if assignment is None:
            return
        with session_scope(self._session_factory) as session:
            row = session.get(QcAssignmentRow, assignment.dataset_id)
            if row is None:
                session.add(
                    QcAssignmentRow(
                        dataset_id=assignment.dataset_id,
                        assignment_payload=assignment.model_dump(mode="json"),
                        updated_at=self.now(),
                    )
                )
                return
            row.assignment_payload = assignment.model_dump(mode="json")
            row.updated_at = self.now()

    def clear_assignment(self, dataset_id: str) -> None:
        with session_scope(self._session_factory) as session:
            session.execute(delete(QcAssignmentRow).where(QcAssignmentRow.dataset_id == dataset_id))

    def clear_qc_dataset_state(self, dataset_id: str) -> None:
        with session_scope(self._session_factory) as session:
            session.execute(delete(QcAssignmentRow).where(QcAssignmentRow.dataset_id == dataset_id))
            session.execute(delete(QcTaskRow).where(QcTaskRow.dataset_id == dataset_id))
            session.execute(delete(QcLeaseRow).where(QcLeaseRow.dataset_id == dataset_id))
            session.execute(delete(QcDraftRow).where(QcDraftRow.dataset_id == dataset_id))
            session.execute(delete(QcBatchDraftRow).where(QcBatchDraftRow.dataset_id == dataset_id))
            session.execute(delete(QcSubmissionRow).where(QcSubmissionRow.dataset_id == dataset_id))
            session.execute(delete(AnnotationSnapshotRow).where(AnnotationSnapshotRow.dataset_id == dataset_id))
            session.execute(delete(ModificationEventRow).where(ModificationEventRow.dataset_id == dataset_id))
            session.execute(delete(EvaluationRunRow).where(EvaluationRunRow.dataset_id == dataset_id))

    def remove_sample_pool_items_for_dataset(self, dataset_id: str) -> int:
        with session_scope(self._session_factory) as session:
            rows = session.scalars(
                select(SamplePoolItemRow.item_id).where(SamplePoolItemRow.dataset_id == dataset_id)
            ).all()
            if not rows:
                return 0
            session.execute(delete(SamplePoolItemRow).where(SamplePoolItemRow.dataset_id == dataset_id))
            return len(rows)

    def list_tasks(self, dataset_id: str) -> list[QcTask]:
        with session_scope(self._session_factory) as session:
            rows = session.scalars(
                select(QcTaskRow)
                .where(QcTaskRow.dataset_id == dataset_id)
                .order_by(QcTaskRow.task_order, QcTaskRow.task_id)
            ).all()
            return [QcTask.model_validate(row.task_payload) for row in rows]

    def save_tasks(self, dataset_id: str, tasks: list[QcTask]) -> None:
        with session_scope(self._session_factory) as session:
            session.execute(delete(QcTaskRow).where(QcTaskRow.dataset_id == dataset_id))
            now = self.now()
            for idx, task in enumerate(tasks):
                session.add(
                    QcTaskRow(
                        dataset_id=dataset_id,
                        task_id=task.task_id,
                        sample_id=task.sample_id,
                        task_order=idx,
                        task_payload=task.model_dump(mode="json"),
                        updated_at=now,
                    )
                )

    def list_leases(self, dataset_id: str) -> list[SampleLease]:
        with session_scope(self._session_factory) as session:
            rows = session.scalars(
                select(QcLeaseRow)
                .where(QcLeaseRow.dataset_id == dataset_id)
                .order_by(QcLeaseRow.lease_order, QcLeaseRow.lease_id)
            ).all()
            return [SampleLease.model_validate(row.lease_payload) for row in rows]

    def save_leases(self, dataset_id: str, leases: list[SampleLease]) -> None:
        with session_scope(self._session_factory) as session:
            session.execute(delete(QcLeaseRow).where(QcLeaseRow.dataset_id == dataset_id))
            now = self.now()
            for idx, lease in enumerate(leases):
                session.add(
                    QcLeaseRow(
                        dataset_id=dataset_id,
                        lease_id=lease.lease_id,
                        sample_id=lease.sample_id,
                        user_id=lease.user_id,
                        lease_order=idx,
                        lease_payload=lease.model_dump(mode="json"),
                        updated_at=now,
                    )
                )

    def get_draft(self, dataset_id: str, sample_id: str, user_id: str) -> LabelEditDraft | None:
        with session_scope(self._session_factory) as session:
            row = session.get(
                QcDraftRow,
                {
                    "dataset_id": dataset_id,
                    "sample_id": sample_id,
                    "user_id": user_id,
                },
            )
            if row is None:
                return None
            return LabelEditDraft.model_validate(row.draft_payload)

    def list_drafts_for_user(self, dataset_id: str, user_id: str) -> list[LabelEditDraft]:
        with session_scope(self._session_factory) as session:
            rows = session.scalars(
                select(QcDraftRow)
                .where(QcDraftRow.dataset_id == dataset_id, QcDraftRow.user_id == user_id)
                .order_by(QcDraftRow.updated_at, QcDraftRow.sample_id)
            ).all()
            return [LabelEditDraft.model_validate(row.draft_payload) for row in rows]

    def save_draft(self, draft: LabelEditDraft) -> None:
        with session_scope(self._session_factory) as session:
            row = session.get(
                QcDraftRow,
                {
                    "dataset_id": draft.dataset_id,
                    "sample_id": draft.sample_id,
                    "user_id": draft.user_id,
                },
            )
            if row is None:
                session.add(
                    QcDraftRow(
                        dataset_id=draft.dataset_id,
                        sample_id=draft.sample_id,
                        user_id=draft.user_id,
                        draft_payload=draft.model_dump(mode="json"),
                        updated_at=draft.updated_at,
                    )
                )
                return
            row.draft_payload = draft.model_dump(mode="json")
            row.updated_at = draft.updated_at

    def delete_draft(self, dataset_id: str, sample_id: str, user_id: str) -> None:
        with session_scope(self._session_factory) as session:
            session.execute(
                delete(QcDraftRow).where(
                    QcDraftRow.dataset_id == dataset_id,
                    QcDraftRow.sample_id == sample_id,
                    QcDraftRow.user_id == user_id,
                )
            )

    def get_batch_draft(self, dataset_id: str, user_id: str) -> dict[str, Any] | None:
        with session_scope(self._session_factory) as session:
            row = session.get(
                QcBatchDraftRow,
                {"dataset_id": dataset_id, "user_id": user_id},
            )
            if row is None:
                return None
            return dict(row.draft_payload)

    def save_batch_draft(self, dataset_id: str, user_id: str, payload: dict[str, Any]) -> None:
        with session_scope(self._session_factory) as session:
            row = session.get(QcBatchDraftRow, {"dataset_id": dataset_id, "user_id": user_id})
            if row is None:
                session.add(
                    QcBatchDraftRow(
                        dataset_id=dataset_id,
                        user_id=user_id,
                        draft_payload=payload,
                        updated_at=self.now(),
                    )
                )
                return
            row.draft_payload = payload
            row.updated_at = self.now()

    def save_submission(self, submission: LabelEditSubmission) -> None:
        with session_scope(self._session_factory) as session:
            row = session.get(QcSubmissionRow, submission.submission_id)
            if row is None:
                session.add(
                    QcSubmissionRow(
                        submission_id=submission.submission_id,
                        dataset_id=submission.dataset_id,
                        sample_id=submission.sample_id,
                        created_at=submission.created_at,
                        submission_payload=submission.model_dump(mode="json"),
                    )
                )
                return
            row.dataset_id = submission.dataset_id
            row.sample_id = submission.sample_id
            row.created_at = submission.created_at
            row.submission_payload = submission.model_dump(mode="json")

    def list_submissions(self, dataset_id: str, sample_id: str) -> list[LabelEditSubmission]:
        with session_scope(self._session_factory) as session:
            rows = session.scalars(
                select(QcSubmissionRow)
                .where(
                    QcSubmissionRow.dataset_id == dataset_id,
                    QcSubmissionRow.sample_id == sample_id,
                )
                .order_by(QcSubmissionRow.created_at, QcSubmissionRow.submission_id)
            ).all()
            return [LabelEditSubmission.model_validate(row.submission_payload) for row in rows]

    def get_submission(
        self,
        dataset_id: str,
        sample_id: str,
        submission_id: str,
    ) -> LabelEditSubmission | None:
        with session_scope(self._session_factory) as session:
            row = session.get(QcSubmissionRow, submission_id)
            if row is None:
                return None
            if row.dataset_id != dataset_id or row.sample_id != sample_id:
                return None
            return LabelEditSubmission.model_validate(row.submission_payload)

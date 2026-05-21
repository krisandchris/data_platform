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
    AuditEventRow,
    DatasetBatchRow,
    DatasetTypeRegistryRow,
    ImportJobRow,
    LabelConfigActiveRow,
    LabelConfigRow,
    PlatformRoleBindingRow,
    PlatformSessionRow,
    PlatformUserRow,
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
from urban_violation_backend.schemas import AuditEvent, AuthSession, ImportJob, RoleBinding, UserAccount
from urban_violation_backend.state_store import PlatformStateStore


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
            created_at=row.created_at,
            activated_at=row.activated_at,
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
                        "created_at": row.created_at,
                        "updated_at": row.updated_at,
                        "last_seen_at": row.last_seen_at,
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
                        "created_at": row.created_at,
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
                        "created_at": row.created_at,
                        "expires_at": row.expires_at,
                        "revoked_at": row.revoked_at,
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
                        "created_at": row.created_at,
                    }
                )
                for row in rows
            ]

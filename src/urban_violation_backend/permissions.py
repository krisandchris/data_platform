"""Scoped RBAC evaluation helpers."""

from __future__ import annotations

from dataclasses import dataclass

from urban_violation_backend.schemas import RoleBinding, RoleScopeType, UserRole


ROLE_PERMISSIONS: dict[UserRole, set[str]] = {
    UserRole.PLATFORM_ADMIN: {
        "users:manage",
        "roles:manage",
        "dataset_type:create",
        "label_config:manage",
        "import_job:manage",
        "batch_assignment:manage",
        "lease:force_release",
        "label_edit:write",
        "label_edit:confirm",
        "audit:read",
        "qc_progress:read",
        "dataset:read",
        "qc_queue:read",
    },
    UserRole.DATASET_ADMIN: {
        "dataset_type:create",
        "label_config:manage",
        "import_job:manage",
        "batch_assignment:manage",
        "lease:force_release",
        "label_edit:write",
        "audit:read",
        "qc_progress:read",
        "dataset:read",
        "qc_queue:read",
    },
    UserRole.BATCH_MANAGER: {
        "import_job:manage",
        "batch_assignment:manage",
        "lease:force_release",
        "dataset:read",
        "qc_queue:read",
        "audit:read",
        "qc_progress:read",
        "label_edit:write",
    },
    UserRole.ANNOTATOR: {
        "dataset:read",
        "qc_queue:read",
        "label_edit:write",
        "audit:read_own",
        "qc_progress:read_own",
    },
    UserRole.QC_LEAD: {
        "dataset:read",
        "qc_queue:read",
        "batch_assignment:manage",
        "lease:force_release",
        "label_edit:write",
        "label_edit:confirm",
        "audit:read",
        "qc_progress:read",
    },
    UserRole.AUDITOR: {
        "dataset:read",
        "qc_queue:read",
        "audit:read",
        "qc_progress:read",
    },
}


@dataclass(slots=True)
class PermissionDecision:
    allowed: bool
    matched_binding: RoleBinding | None


class PermissionEvaluator:
    """Evaluate action grants with platform/type/batch scopes."""

    @staticmethod
    def has_permission(
        *,
        bindings: list[RoleBinding],
        action: str,
        dataset_type: str | None = None,
        dataset_id: str | None = None,
    ) -> PermissionDecision:
        for binding in bindings:
            if action not in ROLE_PERMISSIONS.get(binding.role, set()):
                continue
            if PermissionEvaluator._scope_matches(
                binding=binding,
                dataset_type=dataset_type,
                dataset_id=dataset_id,
            ):
                return PermissionDecision(allowed=True, matched_binding=binding)
        return PermissionDecision(allowed=False, matched_binding=None)

    @staticmethod
    def _scope_matches(
        *,
        binding: RoleBinding,
        dataset_type: str | None,
        dataset_id: str | None,
    ) -> bool:
        if binding.scope_type == RoleScopeType.PLATFORM:
            return True

        if binding.scope_type == RoleScopeType.DATASET_TYPE:
            if binding.scope_id == "*":
                return True
            if dataset_type is None:
                return False
            return binding.scope_id == dataset_type

        if binding.scope_type == RoleScopeType.DATASET_BATCH:
            if binding.scope_id == "*":
                return True
            if dataset_id is None:
                return False
            return binding.scope_id == dataset_id

        return False

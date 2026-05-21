# Users, RBAC, Audit API

Last updated: 2026-05-20

## Permission Model

| Role | Main permissions |
| --- | --- |
| `platform_admin` | Full platform management, including users, roles, dataset type creation, batch deletion, label config, import, assignment, lease force release, label edit write/confirm, audit, QC progress, dataset/QC read. |
| `dataset_admin` | Dataset type creation, label config, import, assignment, lease force release, label edit write, audit, QC progress, dataset/QC read. |
| `batch_manager` | Import, assignment, lease force release, label edit write, audit, QC progress, dataset/QC read. |
| `qc_lead` | Assignment, lease force release, label edit write/confirm, audit, QC progress, dataset/QC read. |
| `annotator` | Dataset/QC read, label edit write, own audit, own QC progress. |
| `auditor` | Dataset/QC read, audit read, QC progress read. |

Scope types:

- `platform`
- `dataset_type`
- `dataset_batch`

## Endpoints

| Method | Path | Request schema | Response schema | Permission |
| --- | --- | --- | --- | --- |
| `GET` | `/api/rbac/catalog` | none | `RbacCatalogResponse` | login required |
| `GET` | `/api/users` | none | `list[UserAccountResponse]` | `users:manage` or scoped read fallback |
| `POST` | `/api/users` | `UserAccountCreateRequest` | `UserAccountResponse` | `users:manage` |
| `PATCH` | `/api/users/{user_id}` | `UserAccountPatchRequest` | `UserAccountResponse` | `users:manage` |
| `GET` | `/api/role-bindings` | none | `list[RoleBinding]` | `roles:manage` |
| `POST` | `/api/role-bindings` | `RoleBindingCreateRequest` | `RoleBinding` | `roles:manage` |
| `DELETE` | `/api/role-bindings/{binding_id}` | none | `dict[str, bool]` | `roles:manage` |
| `GET` | `/api/audit-events` | query filters | `list[AuditEventResponse]` | `audit:read` or own-audit boundary |

Audit filters:

- `dataset_id`
- `sample_id`
- `actor_user_id`
- `action`

Design notes:

- Frontend can hide controls, but backend permission checks are authoritative.
- Audit events must preserve actor, action, dataset/sample scope when available, and payload details useful for traceability.

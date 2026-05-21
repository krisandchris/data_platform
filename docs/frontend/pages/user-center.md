# User Center Pages

Last updated: 2026-05-20

## 账户信息

Route: `/account`

Component: `AccountPage.vue`

Fields:

- Current user id, username, display name, email, status.
- Roles, role bindings, permissions.

Interactions:

- Navigate to permission management when allowed.
- Navigate to audit when allowed.
- Logout and return to login.

API:

- `GET /api/me`
- `POST /api/auth/logout`

## 权限管理

Route: `/account/permissions`

Component: `UsersPage.vue`

Fields:

- User account identity, status, roles, bindings.
- Role binding id, user id, role, scope type, scope id.
- RBAC catalog roles/scopes/permissions.

Interactions:

- Create user.
- Edit user profile/status/password.
- Create role binding.
- Delete role binding.
- Use modal forms for detailed edits/settings.

API:

- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/{user_id}`
- `GET /api/role-bindings`
- `POST /api/role-bindings`
- `DELETE /api/role-bindings/{binding_id}`
- `GET /api/rbac/catalog`

Boundary:

- Requires `users:manage` or `roles:manage`.

## 审计记录

Route: `/account/audit`

Component: `AuditPage.vue`

Fields:

- Audit event id.
- Action.
- Actor.
- Dataset id.
- Sample id.
- Payload.
- Created at.

Interactions:

- Filter by dataset, sample, actor, and action.
- Inspect event payload.

API:

- `GET /api/audit-events`

Boundary:

- Requires `audit:read`.

# Frontend API And Permissions

Last updated: 2026-05-20

## API Client

Source: `frontend/src/services/urbanViolationApi.ts`

Rules:

- Use relative `/api` paths through `HttpClient`.
- Do not hardcode backend hostnames in page components.
- Normalize backend snake_case payloads at the client boundary.
- Keep shared TypeScript contracts in `frontend/src/shared/types/contract.ts`.

## Route Permissions

| Page | Permission gate |
| --- | --- |
| `/login` | public |
| Dataset and batch pages | login required, backend enforces operation permissions |
| `/account/permissions` | `users:manage` or `roles:manage` |
| `/account/audit` | `audit:read` |
| Sample review editing | assignment, lease, active label config, `label_edit:write` |
| Submitted edit confirmation | `label_edit:confirm` |

## Operation Boundaries

- Frontend hides unavailable controls for clarity.
- Backend remains authoritative for all writes.
- Dataset type creation, label config management, import management, queue generation, assignment, batch deletion, label edit write, and confirmation must handle backend denial cleanly.

## Error Handling

- Preserve backend error text when useful.
- For validation errors, show field-level issues where possible.
- For auth errors, redirect to login only when the session is missing or invalid.

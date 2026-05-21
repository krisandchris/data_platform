# Auth And Session API

Last updated: 2026-05-20

Purpose: service health and internal account login/session handling.

| Method | Path | Request schema | Response schema | Notes |
| --- | --- | --- | --- | --- |
| `GET` | `/health` | none | `HealthResponse` | Liveness and basic runtime health. |
| `POST` | `/api/auth/login` | `LoginRequest` | `LoginResponse` | Internal account login; returns session token. |
| `POST` | `/api/auth/logout` | none | `LogoutResponse` | Invalidates current session when possible. |
| `GET` | `/api/me` | none | `CurrentUserResponse` | Current user, roles, bindings, permissions. |

Boundary:

- `/api/auth/login` is public.
- Other product routes require a resolved auth context.
- Frontend route guards use `/api/me` to decide whether to enter the platform.
- Local `scripts/dev-stack.sh` and `scripts/agent-dev-stack.sh` default to `PLATFORM_AUTH_MODE=session` and `PLATFORM_DEV_ANON=0`, so users must log in before entering the platform.
- Development header mode can still be explicitly enabled by overriding `PLATFORM_AUTH_MODE=dev_header` and, if needed, `PLATFORM_DEV_ANON=1`.

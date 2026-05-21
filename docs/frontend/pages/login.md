# Login Page

Last updated: 2026-05-20

Route: `/login`

Component: `frontend/src/features/auth/LoginPage.vue`

## Current Responsibility

The login page is the independent platform entry. Users must authenticate before entering `/datasets` or any platform page.

Local `scripts/dev-stack.sh` and `scripts/agent-dev-stack.sh` start the backend in `session` auth mode by default, with anonymous dev auth disabled, so the local platform also exercises this login gate.

## Target Layout

```text
+--------------------------------------------------------------------------------+
| Full-screen login surface                                                       |
|                                                                                |
| Left visual zone                         Right login panel                       |
| - city data grid / inspection signal      - 城市治理数据平台                    |
| - dataset/QC/security status motifs       - 账号                                |
| - restrained technical visual language    - 密码                                |
|                                          - 登录                                |
|                                          - error / loading state                |
|                                          - optional dev user switch             |
+--------------------------------------------------------------------------------+
```

Mobile:

```text
+--------------------------------------+
| Compact brand header                  |
| Login panel                           |
| Optional dev switch below form        |
+--------------------------------------+
```

## Visual Direction

- Independent full-screen page, not embedded in the app shell.
- Tone: restrained, technical, operations-focused.
- Avoid marketing hero copy and decorative card-heavy layout.
- Use a dark neutral operational background with precise cyan/green status accents.
- Do not use purple gradients, oversized landing-page slogans, or decorative blob/orb backgrounds.
- Login panel should be compact and clear, with visible input labels and high contrast.

## Data Fields

- `username`
- `password`
- `message`
- `redirect` query
- optional dev users list in dev mode

## Interaction Flow

1. User opens any protected route.
2. Router guard calls `ensureCurrentUser()`.
3. If no user exists, redirect to `/login?redirect=<original route>`.
4. User submits username/password.
5. Frontend calls login API and stores returned session token.
6. Frontend reloads current user through `/api/me`.
7. Success routes to `redirect` query or `/datasets`.

## States

- Initial: empty form, login button enabled.
- Pending: login button disabled, loading indicator shown.
- Invalid credentials: backend error shown above or below form.
- Missing backend/session failure: show concrete connection/session error.
- Already logged in: redirect to requested route or `/datasets`.
- Dev mode: quick user switch is visible only in local fixture/dev mode.

## API

- `POST /api/auth/login`
- `GET /api/me`
- Optional dev-mode user switch may call `GET /api/users`.

## Permission Boundary

- `/login` is public.
- Successful login does not grant page access by itself; route guards and backend permissions still govern page entry and operations.

## Implementation Notes For Frontend Agent

- Keep `/login` outside `AppShell`.
- Do not show sidebar/topbar on `/login`.
- On successful login, use existing redirect query handling.
- Preserve dev user switch only behind the existing dev/fixture mode condition. The default local stack still requires a real login unless explicitly overridden.
- All visible text should be Chinese.
- Add tests for protected-route redirect, login success redirect, failed-login message, and logged-in user redirect.

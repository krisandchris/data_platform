# Shell And Navigation

Last updated: 2026-05-20

## Default Workspace Shell

```text
+----------------------+-----------------------------------------------+
| Sidebar              | Topbar: route context, system status, user    |
| - 数据集中心          +-----------------------------------------------+
| - 修正样本池          | Page content                                  |
| - 当前批次            |                                               |
| - 用户中心            |                                               |
| - 收起/展开           |                                               |
+----------------------+-----------------------------------------------+
```

Rules:

- Sidebar collapsed state is stored in `localStorage` key `uvp.sidebarCollapsed`.
- Current-batch links are derived from route param `:id`.
- User chip always links to `/account`.
- `/users` redirects to `/account/permissions`.
- `/audit` redirects to `/account/audit`.

## Review Focus Shell

```text
+---------------------------------------------------------------------+
| 样本审阅工作台，无全局侧栏，无顶栏                                    |
+---------------------------------------------------------------------+
```

Rules:

- `/datasets/:id/samples/:sampleId/review` hides global sidebar and topbar.
- Review focus mode keeps the user inside sample review content and avoids unrelated navigation chrome.

## Route Guards

- `/login` is public.
- Other routes require `GET /api/me` to resolve a current user.
- Missing user redirects to `/login?redirect=<target>`.
- `/account/permissions` requires `users:manage` or `roles:manage`.
- `/account/audit` requires `audit:read`.

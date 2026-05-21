# Frontend Documentation

Last updated: 2026-05-20

This directory documents the Vue frontend by page hierarchy. The README is only an index; page-level behavior, fields, API calls, states, and permissions live in the linked files.

## Source Entry Points

- Router: `frontend/src/app/router.ts`
- App shell: `frontend/src/app/layouts/AppShell.vue`
- API client: `frontend/src/services/urbanViolationApi.ts`
- Shared contracts: `frontend/src/shared/types/contract.ts`
- Fixture fallback: `frontend/src/services/fixtures.ts`

## Page Hierarchy

```text
/
└── /datasets

/login

/datasets
├── /datasets/types/:datasetType
│   └── /datasets/types/:datasetType/label-config
└── /datasets/:id/overview
    ├── /datasets/:id/assets
    ├── /datasets/:id/import-jobs/:jobId
    ├── /datasets/:id/preannotations
    ├── /datasets/:id/qc
    │   └── /datasets/:id/samples/:sampleId/review
    └── /datasets/:id/samples/:sampleId/review

/sample-pool

/account
├── /account/permissions
└── /account/audit
```

## Document Map

- [Shell And Navigation](./shell-and-navigation.md)
- [Login Page](./pages/login.md)
- [Dataset Type Pages](./pages/dataset-type-pages.md)
- [Batch Workspace Pages](./pages/batch-workspace-pages.md)
- [Sample Review Page](./pages/sample-review.md)
- [Sample Pool Page](./pages/sample-pool.md)
- [User Center Pages](./pages/user-center.md)
- [Shared Components And States](./shared-components-and-states.md)
- [Frontend API And Permissions](./api-and-permissions.md)

## Implementation Boundaries

- Batch pages must use concrete batch ids such as `urban_violation__0508_fixture`.
- Dataset type pages use type ids such as `urban_violation` or `ares_detection`.
- Label config is type-scoped and belongs under `/datasets/types/:datasetType/label-config`.
- The sample review workbench layout and bbox behavior are protected unless explicitly changed by the user.

## Verification

```bash
cd frontend
npm ci
npm run test
npm run build
```

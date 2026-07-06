# Handoff

## Agent Role
Frontend Agent

## Branch
`agent/TASK-030/frontend/offline-prune`

## Worktree
`../_worktrees/data_platform/frontend-offline-prune`

## Scope Completed
- Deleted non-core frontend pages, fixture API, and non-core tests.
- Fixed router and app shell to offline-only navigation.
- Slimmed `UrbanViolationApi` and shared TypeScript contract types to retained offline flows.

## Changed Files
- `frontend/src/app/**`: offline-only router/shell.
- `frontend/src/features/**`: retained import/QC/review/upload pages only.
- `frontend/src/services/urbanViolationApi.ts`: offline-only API client.
- `frontend/src/shared/types/contract.ts`: retained offline contract.
- `frontend/src/test/**`: focused offline tests.

## Shared Contracts Changed
Yes. Frontend shared TypeScript contract was reduced to retained offline API/page types.

## Dependencies Changed
No

## Verification
- Command: `npm run test -- src/test/apiClient.test.ts src/test/routesAndPages.test.ts src/test/bboxOverlay.test.ts src/test/media.test.ts`
  Result: passed, 27 tests.
- Command: `npm run build`
  Result: passed.

## Known Risks
- Tests intentionally no longer cover deleted full-platform UI.
- Vue test warnings remain for unmatched hidden route and direct component mounting without route injection; assertions pass.

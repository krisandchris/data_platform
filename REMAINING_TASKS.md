# Remaining Tasks - Urban Violation Platform

Last updated: 2026-05-15

## Current Baseline

- `main`: `02fba2c` before this status update
- Backend branch: `agent/backend-implementation` at `f6a76ee`
- Frontend branch: `agent/frontend-implementation` at `5d55505`
- Integration branch: `agent/integration-testing` at `501578a`

All worktrees were clean when this list was created.

## Phase 8 P0 Execution Status

Completed:
- Backend runtime API over fixture import.
- Frontend live API integration with explicit fixture fallback.
- Integration contract tests activated against backend URL.
- Integration E2E route/filter/review-route smoke activated against frontend/backend URLs.
- Integration product validation clarified and completed at integration commit `ee3deb5`, validating backend commit `f6a76ee` and frontend commit `5d55505` as running services.

Validated:
- Backend contract tests: 6 passed.
- E2E smoke: 3 passed, 1 skipped.

Residual:
- Review submit/audit refresh remains skip-safe and is tracked under P1 Review And Audit Workflow.

## P0 - Contract Convergence

Owner: backend leads, frontend and integration consume.

Tasks:
- Promote backend `backend_contracts/schema.json` to the shared contract source.
- Compare frontend `frontend/src/shared/types/contract.ts` against backend schema and remove incompatible temporary fields or naming drift.
- Decide how contract artifacts move across branches:
  - merge backend contract into `main`, then rebase frontend/integration, or
  - cherry-pick only contract artifacts into frontend/integration.
- Add a contract version field and changelog.
- Convert integration skeleton tests from skipped placeholders into schema/response assertions once an API server exists.

Acceptance:
- One canonical contract artifact exists in a shared location.
- Frontend types are either generated from or manually verified against the canonical contract.
- Integration contract tests fail on schema drift.

## P0 - Backend Runtime API

Owner: backend branch.

Tasks:
- Add FastAPI app entrypoint and route modules.
- Implement dataset summary, asset list/detail, import job status, review detail, review submit, QC queue, search, and export endpoints.
- Add persistent storage strategy:
  - lightweight SQLite for local development, or
  - PostgreSQL-compatible SQLAlchemy models with local fallback.
- Implement import command/job that loads the deterministic fixture and then supports full dataset smoke import.
- Serve image/visualization assets through browser-safe URLs.
- Add API tests for each route using fixture samples.

Acceptance:
- `uv run pytest` includes API tests.
- Server can be started locally.
- Fixture import returns expected samples:
  - success sample `000142_0_1762483003246`
  - failure sample `001710_0_1763108687181`
- API never returns local absolute filesystem paths as media URLs.

## P0 - Frontend Live API Integration

Owner: frontend branch.

Tasks:
- Replace temporary fixture adapter with real backend API configuration.
- Keep fixture adapter only as dev/test fallback.
- Wire all documented routes to live backend responses.
- Add route-level loading, error, empty, and failure states.
- Expand frontend tests for:
  - routing
  - asset filters
  - import status display
  - review decision submission
  - bbox overlay scaling from 1280x720 coordinate space.

Acceptance:
- `npm ci`, `npm run build`, and `npm run test` pass.
- Frontend can run against the backend dev server without response shape patches.
- Review page renders backend media URLs and stage1/stage2 annotations.

## P0 - Integration End-To-End Loop

Owner: integration branch.

Tasks:
- Parameterize tests with `BACKEND_URL` and `FRONTEND_URL`.
- Add backend contract tests against running API.
- Add frontend E2E tests for:
  - dashboard
  - import validation
  - asset filtering
  - review workbench
  - review submit and audit refresh.
- Add a smoke workflow that starts backend, starts frontend, runs fixture import, then runs contract/E2E tests.

Acceptance:
- Fixture validator still passes.
- Contract tests no longer skip when `BACKEND_URL` is set.
- E2E tests no longer skip when both URLs are set.
- Test report separates product bugs, environment issues, and open questions.

## P1 - Full Dataset Import And QC Semantics

Owner: backend plus integration.

Tasks:
- Run full dataset smoke import.
- Confirm final counts:
  - 797 raw assets
  - 797 stage1 records
  - 780 successful stage2 records
  - 19 stage2 failures preserved.
- Decide whether stage2 failure entries enter QC queue or a separate remediation queue.
- Treat `soft_fail` as QC/review signal, not import failure.
- Add summary endpoint fields for rerun nuance:
  - stage2 current success count
  - stage2 failure count
  - rerun attempted/succeeded/failed counts.

Acceptance:
- Full import is repeatable or documented as environment-bound.
- Summary metrics match dataset findings.
- QC queue behavior is explicit and tested.

## P1 - Review And Audit Workflow

Owner: backend and frontend.

Tasks:
- Define human review payload and persistence model.
- Add audit artifact retrieval for raw request, response, parsed, record, and failure files.
- Add UI affordances for editing/confirming:
  - bbox
  - category
  - evidence reasoning
  - review decision.
- Add optimistic or confirmed post-submit state refresh.

Acceptance:
- Review submit creates a durable `HumanReview`.
- Audit trail shows the submitted review and source artifacts.
- Integration test validates submit and refresh.

## P1 - Search And Export

Owner: backend first, frontend after API.

Tasks:
- Implement basic search over sample ID, category, relation text, and reasoning text.
- Implement export job creation for filtered/reviewed samples.
- Add frontend search controls and export actions.
- Add integration tests for search and export contract.

Acceptance:
- Search returns deterministic fixture results.
- Export endpoint returns a stable job/result artifact.
- UI can trigger export from filtered asset list.

## P2 - Product Hardening

Tasks:
- Decide display label dictionary for machine categories such as `nonmotor_vehicle_illegal_parking`.
- Decide raw request/response storage policy.
- Add authentication/permissions only after core data flow is stable.
- Address frontend `npm audit` moderate vulnerabilities without forced breaking upgrades.
- Add CI scripts once branch contents are merged.
- Update project README with local setup commands for backend, frontend, and integration tests.

Acceptance:
- Setup from clean clone is documented.
- Dependency security posture is documented or remediated.
- CI can run backend tests, frontend build/tests, and integration fixture validation.

## Recommended Next Execution Order

1. Merge or share backend contract artifact.
2. Implement backend runtime API over fixture import.
3. Rebase/update frontend branch to consume live backend contract.
4. Turn integration contract tests from skipped to active.
5. Run fixture E2E.
6. Expand backend importer to full dataset smoke.
7. Add review persistence and audit workflow.
8. Add search/export.

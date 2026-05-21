# TASK-018 Backend Handoff

## Agent Role
Backend Agent

## Branch
`agent/TASK-018/backend/no-fixture`

## Worktree
`/mnt/lc/LC/ares_xtws/0_train_data/_worktrees/data_platform/TASK-018-backend-no-fixture`

## Scope Completed
- Added `PLATFORM_ENABLE_FIXTURE_BATCH` to control whether the protected built-in `urban_violation__0508_fixture` batch is loaded.
- Docker Compose now defaults `PLATFORM_ENABLE_FIXTURE_BATCH=0`, so a clean deployment keeps the `urban_violation` dataset type and label config store but lists no default fixture batch.
- Preserved the previous fixture-enabled default for explicit app construction and fixture-based tests.
- Updated deployment docs and backend regression coverage.

## Changed Files
- `src/urban_violation_backend/service.py`
- `src/urban_violation_backend/app.py`
- `tests/test_api.py`
- `docker-compose.yml`
- `docs/architecture/deployment.md`
- `.agent/task_plan.md`
- `.agent/findings.md`
- `.agent/progress.md`
- `.agent/handoff.md`

## Shared Contracts Changed
No API schema shape changed. Runtime configuration changed through a new environment variable.

## Dependencies Changed
No.

## Verification
- `uv run pytest tests/test_api.py -k "disable_fixture_batch or fixture_batch_from_env or dataset_type_registry or health_and_dataset_summary"` -> passed (`4 passed`, `77 deselected`).
- Initial `uv run pytest` in the fresh worktree failed because ignored local test data `DATASET/urban` was not present.
- Temporarily symlinked the main workspace `DATASET/` for test-only access, reran `uv run pytest` -> passed (`89 passed`), then removed the symlink.

## Known Risks
- Docker containers must be recreated for the new `PLATFORM_ENABLE_FIXTURE_BATCH=0` default to affect a running deployment.
- Existing runtime state that already registered the built-in fixture batch may still contain persisted records; the change prevents clean-start fixture loading and default listing.

## Rollback Plan
- Set `PLATFORM_ENABLE_FIXTURE_BATCH=1` in the deployment environment to restore default fixture loading without reverting code.
- Revert this branch if the config switch itself needs removal.

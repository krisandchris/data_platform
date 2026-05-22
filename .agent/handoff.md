# TASK-019 Phase 6 Integration Handoff

## Lead Scope

Integration branch: `integration/TASK-019`

Phase 6 delivers the file-state-to-database import path needed before enabling database-backed runtime state in production-like deployments.

## Agent Branches Integrated

- `agent/TASK-019/backend/import-tool`
  - Implemented `urban_violation_backend.migrate_state import-file-state`.
  - Added conflict-safe import behavior, JSON reporting, filesystem reference reporting, and focused backend tests.
- `agent/TASK-019/qa/import-tool-tests`
  - Added migration/import QA coverage expectations.
  - During integration, the QA scenarios were reconciled into the executable backend test file now that the real importer module exists.

## Command Surface

```bash
uv run python -m urban_violation_backend.migrate_state import-file-state \
  --platform-state-root ... \
  --label-config-store-root ... \
  --dataset-root ... \
  [--database-url ...] \
  [--dry-run] \
  [--report ...] \
  [--run-migrations]
```

`DATABASE_URL` is supported when `--database-url` is omitted.

## Imported Domains

- users, role bindings, sessions, audit events
- dataset type registry and registered batches/import jobs
- label config versions and active pointers
- QC assignments, tasks, leases, per-sample drafts, batch drafts, submissions
- annotation snapshots and modification events
- sample pool items, export jobs, evaluations

## Conflict And Safety Behavior

- Same ID and same content is reported as `matched`.
- Same ID and different content is reported as `conflict`.
- Conflicting database rows are skipped and are not overwritten.
- The command exits with code `3` when conflicts are detected.
- File-backed roots and `DATASET` files are treated as read-only import inputs.

## Files Changed

- `src/urban_violation_backend/migrate_state.py`
- `src/urban_violation_backend/db/foundation.py`
- `tests/test_migrate_state_import_tool.py`
- `.agent/task_plan.md`
- `.agent/findings.md`
- `.agent/progress.md`
- `.agent/handoff.md`

## Verification Status

Backend branch verification before integration:

```bash
uv run pytest tests/test_migrate_state_import_tool.py -q
uv run pytest tests/test_db_foundation_backend.py -q
git diff --check
```

Integration verification is still in progress after resolving the QA merge.

## Remaining Risks

- The importer preserves database rows on conflict but does not provide an automated merge/repair mode. Operators must inspect the JSON report and resolve conflicts manually.
- Batch draft user-id recovery still depends on `_batch.<user_id>.json` file naming from the file store.
- Filesystem artifacts such as raw datasets, uploaded archives, extracted sources, media files, and export blobs remain filesystem-managed and are reported as references rather than imported into the database.

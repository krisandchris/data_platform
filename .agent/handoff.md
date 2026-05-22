# TASK-019 Phase 6 Backend Agent Handoff

## Agent Role

Backend Agent

## Branch

`agent/TASK-019/backend/import-tool`

## Scope Delivered

Implemented Phase 6 file-state import command and focused backend tests for dry-run/apply/idempotency/conflict behavior.

## Command Surface

Implemented module command:

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

`DATABASE_URL` env is supported when `--database-url` is omitted.

## JSON Report Schema (top-level)

- `status`: `ok` or `conflict`
- `dry_run`: boolean
- `paths`: `platform_state_root`, `label_config_store_root`, `dataset_root`
- `database_url`: redacted URL
- `summary`: `source_count`, `inserted`, `matched`, `conflicts`
- `domains`: per-domain counters + `conflict_ids`
- `unsupported_domains`: explicit list (currently empty)
- `filesystem_only_domains`: explicit list of non-DB migrated filesystem domains
- `filesystem_references`: detected import `source_uri` and `export_artifact_paths`
- `notes`: operator-facing safety notes

Conflict policy:

- same-id same-content -> `matched`
- same-id different-content -> conflict (reported, skipped, no overwrite)
- command exit code is `3` when any conflict exists

## Imported Domains

- users, role bindings, sessions, audit events
- dataset type registry
- registered batches + import jobs (from `batches.json`)
- label config versions + active pointers (preserved IDs)
- QC assignments, tasks, leases, drafts, batch drafts, submissions
- annotation snapshots, modification events
- sample pool items
- export jobs
- evaluations

## Files Changed

- `src/urban_violation_backend/migrate_state.py`
- `src/urban_violation_backend/db/foundation.py`
- `tests/test_migrate_state_import_tool.py`
- `.agent/progress.md`
- `.agent/findings.md`
- `.agent/handoff.md`

## Verification

Passed:

```bash
uv run pytest tests/test_migrate_state_import_tool.py -q
uv run pytest tests/test_db_foundation_backend.py -q
git diff --check
```

## Risks / Unsupported Coverage

- Batch draft user-id decoding still depends on `_batch.<user_id>.json` naming convention from the file store; if user ids relied on slash escaping in filenames, fidelity could be limited.
- `unsupported_domains` is currently empty because all required Phase 6 database domains are imported; non-target filesystem domains are explicitly listed under `filesystem_only_domains` and remain read-only.

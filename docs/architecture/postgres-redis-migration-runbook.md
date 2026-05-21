# PostgreSQL + Redis Migration Runbook

Last updated: 2026-05-22

Task ID: `TASK-019`

## Scope

This runbook is the operator draft for migrating an existing file-backed deployment to PostgreSQL + Redis.

Current TASK-019 status: Phase 3 introduces PostgreSQL foundation only. It does not switch Docker defaults to database mode, does not implement Redis, does not provide the file-state import tool, and does not move QC/review state out of the file-backed store. Treat Phase 3 as an implementation verification checkpoint, not as a production database rollout.

It intentionally separates:

- durable platform records, which move to PostgreSQL;
- short-lived coordination state, which may use Redis;
- source files and generated artifacts, which stay on the filesystem.

Phase 3 backend foundation has landed with direct Alembic commands, `alembic/` migration files, and database foundation test selectors documented below.

## Phase 3 Foundation Scope

Phase 3 can database-back these foundation domains:

- users, role bindings, sessions, and account status;
- dataset type registry;
- dataset batch registry and filesystem source pointers;
- import job metadata, lifecycle status, validation summaries, and diagnostics;
- label config versions, normalized config payload, content hash, and active pointer;
- audit events.

Phase 3 does not database-back these QC/review domains yet:

- QC assignments, tasks, lease history, and active editor leases;
- drafts, batch drafts, submissions, snapshots, and modification events;
- sample pool items;
- export job metadata and generated export artifact pointers;
- evaluation run metadata.

During Phase 3, database-backed foundation records may coexist with file-backed QC/review records. The next backend phase owns the full QC/review migration.

## Expected Phase 3 Environment Variables

| Variable | Expected values | Required when | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | SQLAlchemy database URL, for PostgreSQL use `postgresql+psycopg://user:password@host:5432/dbname` | Running Alembic or database-backed foundation mode | SQLite URLs such as `sqlite+pysqlite:///...` are used only for local tests. |
| `PLATFORM_STATE_BACKEND` | `file` or `database` | Selecting state backend | `file` remains the default for local and Docker deployment until rollout phase. |
| `PLATFORM_DB_AUTO_MIGRATE` | `0` or `1` | Backend startup | Use `0` by default. Use `1` only in controlled verification because it upgrades the configured database to Alembic head at startup. |

Do not require `REDIS_URL` or `PLATFORM_REDIS_ENABLED` for Phase 3. Redis is a later phase.

## Phase 3 Foundation Verification

Run these checks only after the backend database foundation branch has landed on the branch being verified.

1. Confirm file-backed behavior still passes:

   ```bash
   uv run pytest
   ```

2. Prepare an empty PostgreSQL database for verification. Use a local temporary database or a reviewed external service URL. Do not change repository Docker Compose defaults for Phase 3.

3. Inspect and run Alembic migrations. The migration directory is `alembic/`, and `alembic/env.py` reads `DATABASE_URL` when set:

   ```bash
   DATABASE_URL="$DATABASE_URL" uv run alembic heads
   DATABASE_URL="$DATABASE_URL" uv run alembic current
   DATABASE_URL="$DATABASE_URL" uv run alembic upgrade head
   DATABASE_URL="$DATABASE_URL" uv run alembic current
   ```

4. Run database foundation tests:

   ```bash
   uv run pytest -k "state_store_contract or label_config_repository_contract or db_foundation" -q
   ```

   To activate PostgreSQL-specific QA coverage, provide `TEST_DATABASE_URL`:

   ```bash
   TEST_DATABASE_URL="$DATABASE_URL" uv run pytest tests/test_db_foundation_api.py tests/test_db_foundation_contract.py -q
   ```

5. Foundation acceptance checks:

   - Alembic upgrade succeeds on an empty database.
   - The head revision is visible after upgrade.
   - Database mode can bootstrap or read admin/session foundation state.
   - Login/session, dataset type registry, dataset batch registry, import job metadata, label config, and audit foundation checks pass.
   - File-backed mode remains green.
   - QC/review workflows are either still file-backed in mixed mode or explicitly outside the Phase 3 database gate.
   - Docker Compose still defaults to file-backed runtime state.
   - No Redis dependency, Redis service, or Redis runtime behavior is required.

6. Phase 3 integration is complete only after the Lead Agent records final command results in `.agent/handoff.md`.

## Non-Goals

The migration must not move these into PostgreSQL:

- `DATASET/` source data;
- uploaded zip archives;
- extracted uploaded batch source directories;
- source images, STEP outputs, visualizations, and other media files;
- generated export artifact files.

Redis must not become the authority for drafts, submissions, audit, users, roles, sessions, label config, dataset type metadata, batch metadata, import job final state, sample pool items, export metadata, or evaluation metadata.

## Preconditions

Before starting a production migration after all TASK-019 phases:

- All TASK-019 implementation branches have been integrated and verified.
- `uv run pytest` passes in file-backed and database modes.
- Alembic migrations upgrade an empty PostgreSQL database to head.
- The file-state import command supports `--dry-run`, idempotent import, and conflict reporting.
- Docker Compose includes `postgres` and `redis` services or equivalent external service URLs.
- Operators have a maintenance window with writes blocked.
- Operators know the current paths for:
  - `DATASET_HOST_ROOT`
  - `PLATFORM_STATE_HOST_ROOT`
  - `LABEL_CONFIG_HOST_ROOT`
  - export artifact root if it is separated later

These production prerequisites are not met by Phase 3 alone.

## 1. Freeze Writes

Announce the maintenance window and stop frontend write traffic.

For a Compose deployment:

```bash
scripts/docker-compose-auto-subnet.py ps
scripts/docker-compose-auto-subnet.py down
```

If read-only access must stay up, run only a reviewed read-only backend mode. Do not run file-backed write traffic while the import tool is reading the state roots.

## 2. Backup Current File State

Create a dated backup directory:

```bash
BACKUP_ROOT=/srv/urban-platform/backups/$(date -u +%Y%m%dT%H%M%SZ)
sudo mkdir -p "$BACKUP_ROOT"
sudo chown "$(id -u):$(id -g)" "$BACKUP_ROOT"
```

Record the code and sanitized runtime configuration:

```bash
git rev-parse HEAD > "$BACKUP_ROOT/git-head.txt"
scripts/docker-compose-auto-subnet.py config \
  | sed -E 's/(PASSWORD|TOKEN|SECRET|DATABASE_URL|REDIS_URL)(:|=).*/\1\2<redacted>/g' \
  > "$BACKUP_ROOT/docker-compose.config.txt"
env | sort \
  | sed -E 's/(PASSWORD|TOKEN|SECRET|DATABASE_URL|REDIS_URL)=.*/\1=<redacted>/g' \
  > "$BACKUP_ROOT/operator-env.redacted.txt"
```

Back up mutable file-backed state:

```bash
sudo tar -C /srv/urban-platform/runtime \
  -czf "$BACKUP_ROOT/runtime-state.tgz" \
  platform_state \
  label_config_state
```

Back up or snapshot source data separately according to site policy:

```bash
sudo tar -C /srv/urban-platform \
  -czf "$BACKUP_ROOT/dataset-readonly-snapshot.tgz" \
  DATASET
```

The dataset backup may be replaced by a storage-level snapshot if `DATASET/` is very large. The migration tool must not require a database copy of these files.

Generate checksums for the backup artifacts:

```bash
sha256sum "$BACKUP_ROOT"/*.tgz > "$BACKUP_ROOT/SHA256SUMS"
```

## 3. Prepare PostgreSQL And Redis

Future production rollout step. For Phase 3, prepare only a temporary PostgreSQL database for migration verification and do not require Redis.

For Phase 3 verification, export only the PostgreSQL URL:

```bash
export DATABASE_URL='postgresql+psycopg://urban_platform:change-me@localhost:5432/urban_platform'
```

The exact driver prefix and host value must match the backend branch and local verification database.

For final production rollout after Redis and import phases, start PostgreSQL and Redis with empty or explicitly selected volumes:

```bash
scripts/docker-compose-auto-subnet.py up -d postgres redis
scripts/docker-compose-auto-subnet.py ps
```

For production external services after all phases, export:

```bash
export DATABASE_URL='postgresql+psycopg://urban_platform:change-me@postgres:5432/urban_platform'
export REDIS_URL='redis://redis:6379/0'
```

Use the actual secret and host values from deployment configuration. Do not commit credentials.

## 4. Run Alembic Migrations

Phase 3 uses the direct Alembic command surface:

From the backend environment or backend container, inspect the target migration state:

```bash
uv run alembic heads
uv run alembic current
```

Upgrade:

```bash
DATABASE_URL="$DATABASE_URL" uv run alembic upgrade head
DATABASE_URL="$DATABASE_URL" uv run alembic current
```

Expected result:

- `alembic current` reports the head revision.
- During Phase 3, an empty database contains foundation tables for identity, RBAC, sessions, registry, import job metadata, label config, and audit after upgrade.
- After all TASK-019 phases are complete, an empty database also contains QC, draft, submission, snapshot, sample pool, export, and evaluation tables.

Use `PLATFORM_DB_AUTO_MIGRATE=1` only if the final implementation documents and tests container startup migration behavior. The safer operator path is explicit migration before switching traffic.

## 5. Dry-Run File-State Import

Future production rollout step. The file-state import tool is not part of Phase 3 PostgreSQL foundation. Do not run a production import until the backend import-tool phase has landed and the command name is confirmed.

The import tool must provide an equivalent command surface:

```bash
DATABASE_URL="$DATABASE_URL" \
uv run python -m urban_violation_backend.migrate_state import-file-state \
  --platform-state-root /srv/urban-platform/runtime/platform_state \
  --label-config-store-root /srv/urban-platform/runtime/label_config_state \
  --dataset-root /srv/urban-platform/DATASET/urban_violation \
  --dry-run \
  --report "$BACKUP_ROOT/file-state-import.dry-run.json"
```

Dry-run acceptance:

- Reports counts for every imported class.
- Reports uploaded package paths and export artifact paths as filesystem references, not database blobs.
- Reports no same-ID different-content conflicts.
- Reports no planned mutation under `DATASET/`.
- Can be re-run without changing files or database rows.

If conflicts are reported, stop and preserve the dry-run report. Do not use Redis or manual SQL to patch durable conflicts.

## 6. Import File State

Future production rollout step. This is blocked until the file-state import tool exists and has passed dry-run, idempotency, and conflict-report tests.

Run the import:

```bash
DATABASE_URL="$DATABASE_URL" \
uv run python -m urban_violation_backend.migrate_state import-file-state \
  --platform-state-root /srv/urban-platform/runtime/platform_state \
  --label-config-store-root /srv/urban-platform/runtime/label_config_state \
  --dataset-root /srv/urban-platform/DATASET/urban_violation \
  --report "$BACKUP_ROOT/file-state-import.apply.json"
```

Re-run the same command once to verify idempotency:

```bash
DATABASE_URL="$DATABASE_URL" \
uv run python -m urban_violation_backend.migrate_state import-file-state \
  --platform-state-root /srv/urban-platform/runtime/platform_state \
  --label-config-store-root /srv/urban-platform/runtime/label_config_state \
  --dataset-root /srv/urban-platform/DATASET/urban_violation \
  --report "$BACKUP_ROOT/file-state-import.idempotency.json"
```

Acceptance:

- The second run reports zero new rows or explicitly idempotent same-content matches.
- The import does not delete or rewrite file-backed state.
- The import does not mutate raw dataset files, uploaded archives, extracted source files, media files, or export artifacts.
- Batch records retain source pointers that allow `RegisteredBatchRuntime` hydration from the filesystem.

## 7. Database-Mode Verification Before Traffic

Future production rollout step. For Phase 3, use the smaller foundation verification checklist near the top of this runbook. Do not require Redis, full QC/review persistence, or production traffic switching during Phase 3.

Start the backend in database mode against the migrated database:

```bash
PLATFORM_STATE_BACKEND=database \
PLATFORM_REDIS_ENABLED=1 \
DATABASE_URL="$DATABASE_URL" \
REDIS_URL="$REDIS_URL" \
DATASET_ROOT=/srv/urban-platform/DATASET/urban_violation \
PLATFORM_STATE_ROOT=/srv/urban-platform/runtime/platform_state \
LABEL_CONFIG_STORE_ROOT=/srv/urban-platform/runtime/label_config_state \
uv run uvicorn urban_violation_backend.app:app --host 127.0.0.1 --port 8000
```

Smoke expectations:

- `/health` is healthy.
- Login works with imported or bootstrapped admin credentials.
- Dataset type and batch lists match the import report.
- Active label configs match the file-backed source.
- Review assignments, drafts, submissions, audit, sample pool, exports, and evaluations are readable.
- Media URLs still resolve through backend media routes.
- Export downloads resolve generated files from the filesystem.

Redis restart check:

```bash
scripts/docker-compose-auto-subnet.py restart redis
```

After Redis restart:

- durable drafts, submissions, audit, label configs, and batch metadata still exist;
- active locks or live progress may be gone;
- the UI can reacquire leases or show stable processing state.

## 8. Docker Rollout

Future production rollout step. Phase 3 must not change Docker defaults to database mode and must not add Redis as a required runtime service.

Switch Compose to the migrated target defaults only after the import and verification steps pass:

```text
PLATFORM_STATE_BACKEND=database
PLATFORM_REDIS_ENABLED=1
DATABASE_URL=<postgres service URL>
REDIS_URL=<redis service URL>
```

Keep filesystem mounts:

```text
DATASET_HOST_ROOT:/data/datasets:ro
PLATFORM_STATE_HOST_ROOT:/data/platform_state
LABEL_CONFIG_HOST_ROOT:/data/label_config_state
```

After the Compose update:

```bash
scripts/docker-compose-auto-subnet.py config
scripts/docker-compose-auto-subnet.py build
scripts/docker-compose-auto-subnet.py up -d
scripts/docker-compose-auto-subnet.py ps
curl http://127.0.0.1:8080/health
curl -i http://127.0.0.1:8080/api/me
```

Browser smoke:

- `/login` loads.
- Admin login works.
- Dataset center lists migrated dataset types and batches.
- Label config history and active config load.
- Import page can show existing jobs and live progress when available.
- Review page can acquire a lease, save a draft, and submit according to permissions.
- Audit page shows migrated and new events.
- Export download returns artifact files.

Restart persistence checks:

```bash
scripts/docker-compose-auto-subnet.py restart backend
scripts/docker-compose-auto-subnet.py restart redis
```

State that must survive:

- users, roles, and durable sessions;
- label configs and active pointers;
- dataset type and batch metadata;
- import job final state;
- drafts, submissions, snapshots, modification events, sample pool, export metadata, evaluations, and audit.

State that may not survive Redis restart:

- active lease lock;
- live progress hints;
- short-lived cache entries.

## 9. Rollback

Rollback before database-mode writes:

1. Stop database-mode containers.
2. Revert Compose/env to file-backed mode:

   ```text
   PLATFORM_STATE_BACKEND=file
   PLATFORM_REDIS_ENABLED=0
   ```

3. Point mounts back to the backed-up file state roots.
4. Start the previous backend/frontend containers.
5. Verify login, dataset list, label config, review draft, and audit with file-backed state.

Rollback after database-mode writes:

- Freeze writes first.
- Decide which state is authoritative: the pre-cutover file backup or the PostgreSQL database after cutover.
- If reverting to file-backed mode, any database-only writes after cutover will not appear unless a tested reverse export tool exists.
- Preserve a PostgreSQL dump before destructive rollback:

  ```bash
  docker compose exec -T postgres pg_dump -U urban_platform urban_platform \
    > "$BACKUP_ROOT/postgres-before-rollback.sql"
  ```

- Restore the file-backed runtime tarball if the runtime roots were changed:

  ```bash
  sudo tar -C /srv/urban-platform/runtime \
    -xzf "$BACKUP_ROOT/runtime-state.tgz"
  ```

- Clear Redis locks and progress only after the backend is stopped:

  ```bash
  docker compose exec -T redis redis-cli FLUSHDB
  ```

Alembic downgrade:

- Use only when the implementation provides a tested downgrade path and the application code is compatible with the target revision.
- Prefer restoring the database from a dump over manual schema edits.

Rollback must not delete or rewrite `DATASET/`, uploaded package source trees, media files, or export artifacts.

## 10. Post-Migration Records

Store these with the deployment record:

- Git commit deployed.
- Alembic head revision.
- Import dry-run report.
- Import apply report.
- Idempotency report.
- Backup artifact checksums.
- Docker Compose config output.
- Smoke command results.
- Redis restart result.
- Rollback decision and tested rollback command results.

## Related Documents

- [State Persistence Boundaries](./state-persistence-boundaries.md)
- [PostgreSQL + Redis Migration Agent Sequence](./state_migration_agent_sequence.md)
- [Docker LAN Deployment](./deployment.md)

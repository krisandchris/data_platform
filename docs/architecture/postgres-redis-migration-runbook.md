# PostgreSQL + Redis Migration Runbook

Last updated: 2026-05-22

Task ID: `TASK-019`

## Scope

This runbook is the operator draft for migrating an existing file-backed deployment to PostgreSQL + Redis.

Current TASK-019 status: Phase 7 is the Docker rollout phase. Phases 3-6
introduced PostgreSQL foundation, QC/review database state, Redis runtime
coordination, and the explicit file-state import tool. Phase 7 changes the
operator Docker posture to PostgreSQL + Redis by default after import, restart,
rollback, and smoke checks pass.

Lead reconciliation note: this docs worktree and the currently visible backend
rollout branch still show the pre-Phase-7 two-service `docker-compose.yml`, and
backend/QA handoffs are pending. Reconcile the exact `postgres` and `redis`
image tags, named volume names, password variable names, health checks, and
final smoke results before merging the integration branch.

It intentionally separates:

- durable platform records, which move to PostgreSQL;
- short-lived coordination state, which may use Redis;
- source files and generated artifacts, which stay on the filesystem.

Phase 3 backend foundation has landed with direct Alembic commands, `alembic/` migration files, and database foundation test selectors documented below.

Phase 4 backend, QA, frontend compatibility, and docs branches have been merged into `main`. The Phase 4 Alembic head revision is `20260522_0002` on top of the Phase 3 foundation revision `20260522_0001`.

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

## Phase 4 QC/Review Scope

Phase 4 database-backs these durable QC/review domains in `PLATFORM_STATE_BACKEND=database` mode:

- QC assignments and task records;
- sample lease history and current lease rows;
- sample drafts, batch drafts, and submissions;
- annotation snapshots and modification events;
- correction sample pool items;
- export job metadata and generated artifact pointers;
- evaluation run metadata and metrics payloads.

Phase 4 does not move these into PostgreSQL:

- raw `DATASET/` source files;
- uploaded package archives;
- extracted uploaded batch source directories;
- source images, STEP outputs, visualizations, and media bytes;
- generated export artifact files.

Phase 4 also does not implement Redis. Active lease coordination may be represented by PostgreSQL state during this phase, but Redis-backed lease locks, distributed locks, live import progress, and session caches remain Phase 5 work.

Docker Compose defaults must remain file-backed during Phase 4. Operators may start a database-mode backend explicitly for verification, but repository Docker defaults must not switch to `PLATFORM_STATE_BACKEND=database` until the Docker rollout phase.

## Phase 5 Redis Runtime Scope

Phase 5 enables Redis as an optional runtime coordinator in database mode. Redis may coordinate active locks and live progress, but PostgreSQL remains authoritative for durable workflow state.

Phase 5 may use Redis for:

- active sample lease locks with owner and TTL;
- owner-checked lease heartbeat and release coordination;
- short-lived distributed locks for QC queue generation and import job execution;
- live upload, extraction, scan, validation, and import progress hints;
- optional read-through caches, such as session lookup caches backed by PostgreSQL.

Phase 5 must not use Redis as the only copy of:

- drafts, batch drafts, submissions, snapshots, modification events, or audit;
- users, roles, durable sessions, dataset type metadata, batch metadata, label config versions, or active label config pointers;
- import job final state, QC task state, sample pool items, export metadata, or evaluation metadata.

Redis loss, TTL expiry, or a Redis restart may invalidate only active locks, live progress hints, and optional caches. After Redis loss, operators should expect users to reacquire leases or see stable "processing" states until PostgreSQL-backed final status is available. Durable PostgreSQL rows and filesystem artifacts must remain intact.

Docker Compose production defaults still do not switch in Phase 5. The production Compose switch to PostgreSQL + Redis remains Phase 7 unless backend and QA explicitly land, verify, and hand off a different behavior.

## Phase 6 File-State Import Scope

Phase 6 adds an explicit operator-run import command for moving existing file-backed runtime records into PostgreSQL-backed repositories. It is not a container startup hook and must not run automatically on every backend boot.

Confirmed Phase 6 command:

```bash
uv run python -m urban_violation_backend.migrate_state import-file-state
```

The command is implemented by `urban_violation_backend.migrate_state` and supports dry-run, apply, JSON report output, optional migration execution, and conflict exit code `3`.

Expected Phase 6 import coverage:

- users, role bindings, durable sessions, and audit events;
- dataset type registry, registered batches, import jobs, and source filesystem references;
- label config versions, normalized payloads, content hashes, and active pointers;
- QC assignments, tasks, lease history, sample drafts, batch drafts, and submissions;
- annotation snapshots, modification events, correction sample pool items, export jobs, and evaluation runs.

The import command writes only to the configured target database and to the requested report path. It must not mutate:

- `DATASET/` or `DATASET_ROOT`;
- uploaded zip archives;
- extracted uploaded batch source trees;
- source images, STEP outputs, visualizations, and media files;
- generated export artifact files;
- file-backed runtime roots such as `PLATFORM_STATE_ROOT` and `LABEL_CONFIG_STORE_ROOT`.

The import stores filesystem paths, sizes, hashes, counters, validation summaries, and metadata needed to keep existing media/export/download behavior working. It must not copy large file bytes into PostgreSQL.

## Phase 7 Docker Rollout Scope

Phase 7 is the operator cutover from the file-backed Docker default to
database-backed Docker runtime:

- Compose includes `postgres`, `redis`, `backend`, and `frontend` services.
- The backend default is `PLATFORM_STATE_BACKEND=database`.
- The backend default is `PLATFORM_REDIS_ENABLED=1`.
- `DATABASE_URL` points at the Compose `postgres` service or an approved
  external PostgreSQL service.
- `REDIS_URL` points at the Compose `redis` service or an approved external
  Redis service.
- `DATASET_ROOT`, `PLATFORM_STATE_ROOT`, and `LABEL_CONFIG_STORE_ROOT` remain
  mounted filesystem paths.

Phase 7 does not move raw datasets, uploaded archives, extracted uploaded
source trees, media bytes, or generated export artifacts into PostgreSQL.
PostgreSQL stores durable metadata and workflow records; Redis stores only
short-lived coordination. Reverse export from PostgreSQL back to file-backed
state is not implemented, so rollback after database-mode writes requires an
explicit authority decision.

Expected Phase 7 Compose services:

| Service | Purpose | Persistence | Health gate |
| --- | --- | --- | --- |
| `postgres` | Durable PostgreSQL state authority | Named volume such as `postgres_data:/var/lib/postgresql/data` | `pg_isready` for configured user/database |
| `redis` | Active locks, live progress hints, optional caches | Optional named volume such as `redis_data:/data`; not durable authority | `redis-cli ping` |
| `backend` | FastAPI/Uvicorn API in database mode | Host mounts for dataset/runtime files; PostgreSQL for durable records | `/health` over port `8000` inside the container |
| `frontend` | Nginx Vue production build and same-origin proxy | Rebuildable image content | Depends on healthy backend; external `/health` proxies to backend |

## Expected Phase 3 Environment Variables

| Variable | Expected values | Required when | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | SQLAlchemy database URL, for PostgreSQL use `postgresql+psycopg://user:password@host:5432/dbname` | Running Alembic or database-backed foundation mode | SQLite URLs such as `sqlite+pysqlite:///...` are used only for local tests. |
| `PLATFORM_STATE_BACKEND` | `file` or `database` | Selecting state backend | `file` remains the default for local and Docker deployment until rollout phase. |
| `PLATFORM_DB_AUTO_MIGRATE` | `0` or `1` | Backend startup | Use `0` by default. Use `1` only in controlled verification because it upgrades the configured database to Alembic head at startup. |

Do not require `REDIS_URL` or `PLATFORM_REDIS_ENABLED` for Phase 3. Redis is a later phase.

## Expected Phase 4 Environment Variables

Backend-confirmation-dependent: Phase 4 should use the same database selection surface as Phase 3 unless the backend handoff documents an approved change.

| Variable | Expected values | Required when | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | SQLAlchemy database URL, for PostgreSQL use `postgresql+psycopg://user:password@host:5432/dbname` | Running Alembic or database-backed QC/review verification | SQLite URLs may be used only for local tests if supported by the backend test harness. |
| `PLATFORM_STATE_BACKEND` | `file` or `database` | Selecting state backend | `file` remains the default for local and Docker deployment until rollout phase. |
| `PLATFORM_DB_AUTO_MIGRATE` | `0` or `1` | Backend startup | Keep `0` for operator verification unless the backend branch documents tested startup migration behavior. |

Do not require `REDIS_URL` or `PLATFORM_REDIS_ENABLED` for Phase 4. Redis is Phase 5.

## Expected Phase 5 Redis Environment Variables

Backend-confirmation-dependent: this section uses the env names from the Phase 5 plan. Reconcile exact TTL knobs and test selectors with backend and QA handoffs after their Redis branches land.

| Variable | Expected values | Required when | Notes |
| --- | --- | --- | --- |
| `PLATFORM_STATE_BACKEND` | `file` or `database` | Selecting state backend | Use `database` for Redis runtime verification. Docker defaults remain `file` until Phase 7. |
| `DATABASE_URL` | SQLAlchemy database URL, for PostgreSQL use `postgresql+psycopg://user:password@host:5432/dbname` | Running database-backed mode, Alembic, or Redis runtime smoke | PostgreSQL remains the durable authority. |
| `PLATFORM_REDIS_ENABLED` | `0` or `1` | Selecting Redis runtime coordination | `0` keeps Redis optional/disabled. `1` enables Redis-backed runtime coordination when `REDIS_URL` is configured. |
| `REDIS_URL` | Redis connection URL, for example `redis://localhost:6379/15` or a secured site URL | Redis-enabled backend runtime | Use a dedicated database/index for smoke validation. Redact credentials in logs and backups. |
| `TEST_DATABASE_URL` | PostgreSQL test database URL | Real PostgreSQL integration tests | Tests may use SQLite fallback when this is unset, but PostgreSQL-only checks require this URL. |
| `TEST_REDIS_URL` | Redis test URL | Real Redis integration tests | Use an isolated Redis DB because TTL, restart, and `FLUSHDB` checks can remove active locks/progress. |

TTL behavior:

- Active lock, distributed lock, progress, and cache keys must have TTLs. No Redis key should be required for durable recovery after the TTL expires.
- TTL expiry must be treated like Redis loss: active locks, live progress hints, and optional caches may disappear; PostgreSQL-backed state must remain readable.
- If backend adds TTL env vars, document their exact names and default values in the backend handoff before operators tune them.

Security cautions:

- Do not commit `DATABASE_URL`, `REDIS_URL`, passwords, tokens, or managed-service endpoints.
- Bind local Redis only to trusted loopback or private networks. Do not expose unauthenticated Redis on a LAN or public interface.
- Use Redis ACL/password and TLS when required by the deployment environment or managed service.
- Do not run `FLUSHDB`, restart, or TTL-loss checks against a shared production Redis database. Use an isolated smoke database/index.
- Redact `DATABASE_URL` and `REDIS_URL` in support bundles, logs, CI output, and deployment records.

## Expected Phase 6 Import Environment Variables And Roots

This section documents the confirmed Phase 6 CLI surface.

| Variable or flag | Required when | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | Alembic, dry-run planning against target DB, apply import, and post-import database-mode verification | Target PostgreSQL database URL. Do not commit it or include credentials in logs. |
| `PLATFORM_STATE_BACKEND=database` | Starting the backend after import | Selects PostgreSQL-backed durable state for post-import reads and continued writes. Do not set this as Docker default until Phase 7. |
| `PLATFORM_DB_AUTO_MIGRATE=0` | Operator-controlled import | Keep startup migration disabled and run `uv run alembic upgrade head` explicitly before import. Use `1` only if a later backend handoff documents tested startup migration behavior. |
| `PLATFORM_REDIS_ENABLED=0` | Running the import command | Redis is not required for the import. Enable Redis only for separate Phase 5/Phase 7 runtime verification. |
| `REDIS_URL` | Redis-enabled post-import runtime verification | Optional for import. Required only when `PLATFORM_REDIS_ENABLED=1`. |
| `--platform-state-root` | Dry-run and apply | Required source file-backed state root containing users, sessions, audit, QC, drafts, submissions, sample pool, exports, and evaluations. Operators may pass the value from `PLATFORM_STATE_ROOT` explicitly. |
| `--label-config-store-root` | Dry-run and apply | Required source label config and dataset registry state root. Operators may pass the value from `LABEL_CONFIG_STORE_ROOT` explicitly. |
| `--dataset-root` | Dry-run, apply, and post-import runtime verification | Required readonly source dataset root, for example `/srv/urban-platform/DATASET/urban_violation`. Operators may pass the value from `DATASET_ROOT` explicitly. |
| `--dry-run` | Planning import | Build and validate the import plan without creating or changing database rows. |
| `--report` | Dry-run, apply, and idempotency check | Writes a JSON report for operator records. Use a path under the backup root, not under `DATASET/`. |
| `--run-migrations` | Optional operator path | Runs Alembic migrations to head before import. Prefer explicit `uv run alembic upgrade head` when operators want a separate migration checkpoint. |

Docker host-root variables such as `DATASET_HOST_ROOT`, `PLATFORM_STATE_HOST_ROOT`, and `LABEL_CONFIG_HOST_ROOT` are Compose mount inputs. The import command should use the mounted container paths or direct host paths that correspond to those roots. `DATASET_HOST_ROOT` remains the parent directory containing `urban_violation/`; do not pass the dataset child as the Compose host root.

## Expected Phase 7 Docker Environment Variables And Volumes

Backend runtime defaults after Phase 7 cutover:

| Variable | Expected default | Notes |
| --- | --- | --- |
| `PLATFORM_STATE_BACKEND` | `database` | PostgreSQL is the durable state authority. |
| `DATABASE_URL` | `postgresql+psycopg://urban_platform:<password>@postgres:5432/urban_platform` | Use the exact Compose or external-service secret. Redact in logs. |
| `PLATFORM_DB_AUTO_MIGRATE` | `0` unless backend handoff confirms startup migration | This runbook uses explicit Alembic migration before traffic. |
| `PLATFORM_REDIS_ENABLED` | `1` | Enables Redis runtime coordination. |
| `REDIS_URL` | `redis://redis:6379/0` | Redis is not durable authority. |
| `PLATFORM_REDIS_LEASE_TTL_SECONDS` | `600` | Active lease lock TTL. |
| `PLATFORM_REDIS_LOCK_TTL_SECONDS` | `120` | Distributed operation lock TTL. |
| `PLATFORM_REDIS_IMPORT_PROGRESS_TTL_SECONDS` | `1800` | Live import progress hint TTL. |
| `PLATFORM_REDIS_SESSION_CACHE_TTL_SECONDS` | `300` | Optional session lookup cache TTL. |
| `DATASET_ROOT` | `/data/datasets/urban_violation` | Readonly dataset path inside backend container. |
| `PLATFORM_STATE_ROOT` | `/data/platform_state` | Runtime file root for uploads, extracted sources, export artifacts, and emergency file-backed rollback source. |
| `LABEL_CONFIG_STORE_ROOT` | `/data/label_config_state` | Legacy label config/runtime registry file root for import and rollback reference. |

Compose host inputs and volumes:

| Name | Expected target | Notes |
| --- | --- | --- |
| `DATASET_HOST_ROOT` | `/data/datasets:ro` | Host parent directory that contains `urban_violation/`. |
| `PLATFORM_STATE_HOST_ROOT` | `/data/platform_state` | Host runtime file root. |
| `LABEL_CONFIG_HOST_ROOT` | `/data/label_config_state` | Host legacy label config/runtime registry root. |
| `postgres_data` | `/var/lib/postgresql/data` | PostgreSQL named volume unless using an external service. |
| `redis_data` | `/data` | Optional Redis named volume; Redis values remain disposable. |

Lead reconciliation required: update this table if the final Compose branch uses
different names for PostgreSQL password variables, volume names, image tags, or
Redis persistence settings.

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

## Phase 4 QC/Review Verification

Backend-confirmation-dependent: run this section only after the backend `qc-state` branch has landed on the branch being verified and the backend/QA handoff identifies the exact test selectors or files.

1. Confirm file-backed behavior still passes:

   ```bash
   PLATFORM_STATE_BACKEND=file uv run pytest
   ```

2. Prepare an empty PostgreSQL database for verification. Do not change repository Docker Compose defaults for Phase 4.

3. Inspect and run Alembic migrations:

   ```bash
   DATABASE_URL="$DATABASE_URL" uv run alembic heads
   DATABASE_URL="$DATABASE_URL" uv run alembic current
   DATABASE_URL="$DATABASE_URL" uv run alembic upgrade head
   DATABASE_URL="$DATABASE_URL" uv run alembic current
   ```

4. Run backend-confirmed Phase 4 database tests. Until the backend branch lands, treat the command below as a selector pattern to reconcile with backend/QA handoff, not as a guaranteed current test name:

   ```bash
   TEST_DATABASE_URL="$DATABASE_URL" \
   PLATFORM_STATE_BACKEND=database \
   uv run pytest -k "qc_state or review_state or state_store_contract" -q
   ```

5. Validate QC assignments and tasks:

   - Generate or load a QC queue for a concrete batch.
   - Assign, reassign, and release a batch through `/api/datasets/{dataset_id}/qc/assignment`.
   - List `/api/datasets/{dataset_id}/qc/tasks` before and after backend restart.
   - Confirm assignment status, task revision, assignee, and latest submission pointers persist in database mode.

6. Validate leases:

   - Acquire, heartbeat, release, and force-release sample leases through the existing lease endpoints.
   - Confirm owner checks still reject non-owner heartbeat and release attempts.
   - Restart the backend and verify durable lease rows and terminal lease statuses remain visible.
   - Do not run a Redis restart check for Phase 4; Redis is not implemented until Phase 5.

7. Validate drafts, batch drafts, and submissions:

   - Save a sample draft, retrieve it through `my-draft`, and verify it survives backend restart.
   - Save and autosave a batch draft through `my-batch-draft`; repeat the autosave to verify idempotent replacement semantics.
   - Submit the assigned batch and verify submission history, task status, assignment status, and released lease count.
   - Confirm stale revision, missing assignment, missing active label config, unsaved dirty edits, and validation-error gates remain enforced.

8. Validate snapshots and modification events:

   - Confirm or return a submission through the lead confirmation endpoints.
   - Verify baseline and confirmed snapshots are readable through both snapshot endpoint families.
   - Verify modification events and stats are derived from persisted snapshots/submissions, not frontend-only event capture.
   - Repeat confirmation or event insertion paths covered by tests to verify duplicate event keys are not inserted twice.

9. Validate sample pool:

   - Confirm a submission that produces modification events.
   - Verify `/api/sample-pool`, `/api/sample-pool/stats`, item detail, item upsert/reactivation, and soft removal.
   - Restart the backend and verify item status, event links, attribution codes, and confirmed snapshot pointers persist.

10. Validate exports:

    - Create, list, detail, cancel if supported, and download export jobs through `/api/exports`.
    - Verify export job metadata persists in PostgreSQL.
    - Verify the generated artifact path points to a filesystem file and the download endpoint streams that file.
    - Do not expect export artifact bytes to appear in PostgreSQL.

11. Validate evaluations:

    - Create, list, and detail evaluation runs.
    - Run compare and delta-sample endpoints when source data is available.
    - Restart the backend and verify metrics, changed sample IDs, source export references, and status persist.

12. Phase 4 acceptance checks:

    - File-backed mode remains green.
    - Database mode supports review assignment, lease, draft, batch submit, confirmation/return, snapshot/event, sample pool, export metadata, and evaluation metadata flows.
    - Existing API response shapes stay compatible for frontend review, sample pool, export, and evaluation pages.
    - Raw files and generated export artifacts remain filesystem content.
    - Docker Compose still defaults to file-backed runtime state.
    - No Redis dependency, Redis service, or Redis runtime behavior is required.
    - Backend-confirmation-dependent test names, table names, and migration revision IDs are reconciled from backend/QA handoffs before production planning.

## Phase 5 Redis Runtime Verification

Backend/QA-confirmation-dependent: run this section only after the backend Redis runtime and QA Redis integration branches have landed on the branch being verified. Until then, treat test selectors below as the intended command shape, not guaranteed current test names.

1. Confirm file-backed behavior still passes without Redis:

   ```bash
   PLATFORM_STATE_BACKEND=file \
   PLATFORM_REDIS_ENABLED=0 \
   uv run pytest
   ```

2. Prepare isolated PostgreSQL and Redis services for smoke validation. Use a throwaway PostgreSQL database and a dedicated Redis DB/index. Do not point `TEST_REDIS_URL` at a shared production Redis database.

   ```bash
   export TEST_DATABASE_URL='postgresql+psycopg://urban_platform:change-me@localhost:5432/urban_platform_test'
   export TEST_REDIS_URL='redis://localhost:6379/15'
   export DATABASE_URL="$TEST_DATABASE_URL"
   export REDIS_URL="$TEST_REDIS_URL"
   ```

3. Run Alembic on the smoke database:

   ```bash
   DATABASE_URL="$TEST_DATABASE_URL" uv run alembic upgrade head
   DATABASE_URL="$TEST_DATABASE_URL" uv run alembic current
   ```

4. Run deterministic Phase 5 regressions without live service URLs, then run the live smoke tests against the isolated services:

   ```bash
   uv run pytest -k "redis_runtime or db_qc_state" -q

   TEST_DATABASE_URL="$TEST_DATABASE_URL" \
   TEST_REDIS_URL="$TEST_REDIS_URL" \
   PLATFORM_STATE_BACKEND=database \
   PLATFORM_REDIS_ENABLED=1 \
   uv run pytest tests/test_postgres_redis_smoke.py tests/test_redis_runtime_backend.py::test_real_redis_smoke_if_available -q
   ```

5. Validate lease coordination:

   - Acquire a sample lease with user A and verify concurrent acquire by user B is rejected while the Redis lock is active.
   - Heartbeat and release as the lease owner.
   - Verify heartbeat and release by a non-owner are rejected.
   - Let the active lock TTL expire or restart the isolated Redis service, then verify the user can reacquire according to backend rules.
   - Confirm PostgreSQL still records durable lease history and audit outcomes.

6. Validate distributed locks:

   - Start duplicate QC queue generation attempts for the same batch and verify only one generator wins.
   - Start duplicate import execution attempts for the same import job and verify only one executor owns the short-lived lock.
   - Confirm final task/import job state is persisted in PostgreSQL, not Redis.

7. Validate live progress:

   - Start an upload/import flow that reports backend processing progress.
   - Confirm progress is visible while Redis values exist.
   - Delete or let progress keys expire in the isolated smoke Redis DB and verify the API/frontend falls back to stable job state such as "processing" or final PostgreSQL status.

8. Redis loss acceptance:

   ```bash
   redis-cli -u "$TEST_REDIS_URL" FLUSHDB
   ```

   After Redis loss:

   - durable users, roles, sessions, label configs, batch metadata, QC assignments, drafts, submissions, snapshots, audit, sample pool, exports, and evaluations remain readable from PostgreSQL;
   - active locks, live progress hints, and optional caches may be missing;
   - users can reacquire locks according to backend lease rules;
   - final import job and task status remain PostgreSQL-backed;
   - Docker Compose defaults are still not changed to PostgreSQL + Redis.

9. Phase 5 acceptance checks:

   - File-backed mode remains green with `PLATFORM_REDIS_ENABLED=0`.
   - Database mode remains green with PostgreSQL as durable authority.
   - Redis-backed active locks are cross-process safe.
   - Redis loss affects only active locks, live progress hints, and optional cache entries.
   - Missing Redis progress does not break import/job UI fallback behavior.
   - Docker production switch remains blocked until Phase 7.

## Non-Goals

The migration must not move these into PostgreSQL:

- `DATASET/` source data;
- uploaded zip archives;
- extracted uploaded batch source directories;
- source images, STEP outputs, visualizations, and other media files;
- generated export artifact files.

Redis must not become the authority for drafts, submissions, audit, users, roles, sessions, label config, dataset type metadata, batch metadata, import job final state, sample pool items, export metadata, or evaluation metadata.

## Preconditions

Before starting a production migration and Phase 7 Docker cutover:

- All TASK-019 implementation branches have been integrated and verified.
- `uv run pytest` passes in file-backed and database modes.
- Alembic migrations upgrade an empty PostgreSQL database to head.
- The file-state import command supports `--dry-run`, idempotent import, and conflict reporting.
- Docker Compose includes `postgres` and `redis` services or approved external service URLs.
- Compose exposes a documented file-backed emergency rollback path.
- Operators have a maintenance window with writes blocked.
- Operators know the current paths for:
  - `DATASET_HOST_ROOT`
  - `PLATFORM_STATE_HOST_ROOT`
  - `LABEL_CONFIG_HOST_ROOT`
  - export artifact root if it is separated later
- Operators have selected the authoritative state source for rollback if new
  database-mode writes occur after cutover.

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

Phase 7 starts PostgreSQL and Redis before backend traffic. Use empty or
explicitly selected volumes for a new cutover, or approved external service URLs
if the deployment does not use Compose-managed state services.

For Compose-managed services, export the secrets and host roots, then start only
the data services first:

```bash
export POSTGRES_PASSWORD='<replace-me>'
export DATABASE_URL='postgresql+psycopg://urban_platform:<replace-me>@postgres:5432/urban_platform'
export REDIS_URL='redis://redis:6379/0'
export PLATFORM_STATE_BACKEND=database
export PLATFORM_REDIS_ENABLED=1

scripts/docker-compose-auto-subnet.py up -d postgres redis
scripts/docker-compose-auto-subnet.py ps
```

Expected health:

- `postgres` is healthy before Alembic runs.
- `redis` responds to `PING`.
- Redis may be empty. PostgreSQL may be empty before migrations/import or may
  contain a reviewed restored dump.

For production external services, export the external URLs instead:

```bash
export DATABASE_URL='postgresql+psycopg://urban_platform:change-me@postgres:5432/urban_platform'
export REDIS_URL='redis://redis:6379/0'
```

Use the actual secret and host values from deployment configuration. Do not commit credentials, and redact both URLs in support artifacts.

## 4. Run Alembic Migrations

Use the direct Alembic command surface. From a local backend environment,
inspect the target migration state:

```bash
DATABASE_URL="$DATABASE_URL" uv run alembic heads
DATABASE_URL="$DATABASE_URL" uv run alembic current
```

Upgrade:

```bash
DATABASE_URL="$DATABASE_URL" uv run alembic upgrade head
DATABASE_URL="$DATABASE_URL" uv run alembic current
```

For Compose rollout after `postgres` is healthy, run the same migration through
the backend image before starting normal backend traffic:

```bash
scripts/docker-compose-auto-subnet.py build backend
scripts/docker-compose-auto-subnet.py run --rm backend uv run alembic upgrade head
scripts/docker-compose-auto-subnet.py run --rm backend uv run alembic current
```

Expected result:

- `alembic current` reports the head revision.
- During Phase 3, an empty database contains foundation tables for identity, RBAC, sessions, registry, import job metadata, label config, and audit after upgrade.
- During Phase 4, an empty database also contains QC assignment, task, lease, draft, submission, snapshot, modification event, sample pool, export metadata, and evaluation metadata tables after upgrade to revision `20260522_0002`.
- During Phase 7, the migrated database contains imported file-backed records plus any new database-mode writes after cutover.

Use `PLATFORM_DB_AUTO_MIGRATE=1` only if the final implementation documents and tests container startup migration behavior. The safer operator path is explicit migration before switching traffic.

## 5. Dry-Run File-State Import

Phase 6 operator workflow. The file-state import tool is not part of Phase 3 PostgreSQL foundation, Phase 4 QC/review state migration, or Phase 5 Redis runtime coordination. Run it only after backups and Alembic migration checks are complete.

Run dry-run first against the exact database that would receive the import:

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

- The command exits successfully.
- The report includes counts for each supported state class, including zero counts for empty classes where the implementation reports them.
- The report identifies uploaded package paths, extracted source paths, media paths, and export artifact paths as filesystem references, not database blobs.
- The report shows `dry_run` or equivalent report metadata so operators can prove no apply was attempted.
- The report shows no same-ID different-content conflicts.
- The report shows no planned mutation under `DATASET/`, `PLATFORM_STATE_ROOT`, or `LABEL_CONFIG_STORE_ROOT`.
- Re-running dry-run does not change files or database rows.

If conflicts are reported:

1. Stop the migration and preserve the dry-run report.
2. Confirm whether the target database is empty or already contains a previous import attempt.
3. If the target database is disposable, restore it from the pre-import dump or recreate it and re-run Alembic.
4. If the conflict represents real source-vs-target disagreement, decide the authoritative copy before applying any import.
5. Do not use Redis to patch durable conflicts. Avoid manual SQL unless the Lead Agent and database owner explicitly approve a documented repair.

Conflict reports identify the state class and stable id or natural key in per-domain `conflict_ids`. Operators should inspect the source file and target database row for those ids before deciding the authoritative copy.

## 6. Import File State

Phase 6 operator workflow. Use the same source roots and target database that passed dry-run.

Run the import:

```bash
DATABASE_URL="$DATABASE_URL" \
uv run python -m urban_violation_backend.migrate_state import-file-state \
  --platform-state-root /srv/urban-platform/runtime/platform_state \
  --label-config-store-root /srv/urban-platform/runtime/label_config_state \
  --dataset-root /srv/urban-platform/DATASET/urban_violation \
  --report "$BACKUP_ROOT/file-state-import.apply.json"
```

Review the apply report before starting database-mode traffic. Expected apply report content:

- inserted row counts by state class;
- same-content match counts for rows that already existed and were not changed;
- skipped or unsupported state classes, if any;
- conflict count and conflict details;
- filesystem references preserved for uploaded archives, extracted source trees, media, and export artifacts;
- non-mutation summary for source roots.

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

- The first apply reports no conflicts.
- The second run reports zero new rows or explicitly idempotent same-content matches.
- Same-ID same-content records are accepted as idempotent.
- Same-ID different-content records are reported as conflicts and are not silently overwritten.
- Dry-run and apply do not delete or rewrite file-backed state.
- Dry-run and apply do not mutate raw dataset files, uploaded archives, extracted source files, media files, or export artifacts.
- Batch records retain source pointers that allow `RegisteredBatchRuntime` hydration from the filesystem.
- If the import reports unsupported state classes, do not cut over production traffic until the owner accepts the gap in writing.

## 7. Database-Mode Verification Before Traffic

Run this checkpoint after Alembic and file-state import pass, before opening
normal frontend traffic. The goal is to prove the migrated PostgreSQL database,
Redis runtime coordination, and filesystem artifact references work together.

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

Post-import read checks:

- Compare dataset type, batch, label config, import job, audit, QC task, draft, submission, sample pool, export, and evaluation counts against the import report.
- Inspect at least one migrated batch with source media and confirm backend media URLs return content.
- Inspect at least one generated export job and confirm the download endpoint streams the existing artifact file.
- Confirm active label config pointers match the source `LABEL_CONFIG_STORE_ROOT`.
- Confirm file-backed roots still exist and their file modification times were not advanced by the import, except for operator-created backup/report files outside those roots.

Post-import continued-write checks:

- Create a new durable action in database mode, such as saving a draft, submitting a review fixture, saving a new label config version, or writing an audit-covered management action.
- Restart the backend and verify the new database-mode write remains visible.
- Do not expect the new database-mode write to appear in the old file-backed roots. Reverse export back to file-backed state is not implemented in Phase 6.

Redis restart check:

```bash
scripts/docker-compose-auto-subnet.py restart redis
```

After Redis restart:

- durable drafts, submissions, audit, label configs, and batch metadata still exist;
- active locks or live progress may be gone;
- the UI can reacquire leases or show stable processing state.

## 8. Docker Rollout

Start the Phase 7 Compose stack only after backup, migration, import, and
database-mode verification pass. Phase 7 Compose defaults should already encode:

```text
PLATFORM_STATE_BACKEND=database
PLATFORM_REDIS_ENABLED=1
DATABASE_URL=<postgres service URL>
REDIS_URL=<redis service URL>
```

Keep filesystem mounts in place:

```text
DATASET_HOST_ROOT:/data/datasets:ro
PLATFORM_STATE_HOST_ROOT:/data/platform_state
LABEL_CONFIG_HOST_ROOT:/data/label_config_state
```

Start all services:

```bash
scripts/docker-compose-auto-subnet.py config
scripts/docker-compose-auto-subnet.py build
scripts/docker-compose-auto-subnet.py up -d
scripts/docker-compose-auto-subnet.py ps
curl http://127.0.0.1:8080/health
curl -i http://127.0.0.1:8080/api/me
```

Expected Compose services and health:

- `postgres` is healthy before backend starts.
- `redis` is healthy before backend starts.
- `backend` exposes `8000` internally and passes `/health`.
- `frontend` exposes `${FRONTEND_HTTP_PORT:-8080}:80` and proxies `/health`,
  `/api/`, and `/media/` to `backend`.

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
scripts/docker-compose-auto-subnet.py restart postgres
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

State that must remain filesystem-backed:

- raw `DATASET/` source data;
- uploaded package archives;
- extracted uploaded source trees;
- media files served by backend routes;
- generated export artifacts.

## 9. Rollback

Rollback always starts by freezing writes and preserving the newest state copy.
After any database-mode traffic, decide whether PostgreSQL or the pre-cutover
file backup is authoritative before changing services. Reverse export from
PostgreSQL back to file-backed JSON roots is not implemented.

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

Rollback after dry-run only:

- Dry-run should not create database rows or modify source files. Keep or archive the dry-run report, restore no file-backed state unless an operator made unrelated changes during the window, and return traffic to file-backed mode.

Rollback after import apply but before database-mode traffic:

- Stop the backend if it was started for verification.
- Restore or recreate the target database from the pre-import state. If the database was dedicated to the import, dropping and recreating it from migrations is usually cleaner than deleting individual rows.
- Keep the file-backed runtime roots as the traffic authority.
- Preserve the apply and idempotency reports for diagnosis.

Rollback after database-mode writes:

- Freeze writes first.
- Decide which state is authoritative: the pre-cutover file backup or the PostgreSQL database after cutover.
- If reverting to file-backed mode, any database-only writes after cutover will not appear in the file-backed runtime roots. A tested reverse export tool is not implemented in Phase 6.
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

Emergency file-backed rollback:

1. Stop `frontend` and `backend` so no database-mode writes continue.
2. Dump PostgreSQL even if the rollback target is file-backed.
3. Restore `platform_state` and `label_config_state` from the pre-cutover
   backup or point host-root variables at a read-only copy of that backup for
   validation.
4. Start a file-backed backend with `PLATFORM_STATE_BACKEND=file`,
   `PLATFORM_REDIS_ENABLED=0`, and no `DATABASE_URL` requirement. If the final
   Compose file does not expose these as environment overrides, use the last
   verified file-backed Compose commit or a Lead-approved override file.
5. Verify login, dataset list, active label config, one review draft, one audit
   event, one media URL, and one export download before reopening traffic.
6. Record which post-cutover PostgreSQL-only writes were abandoned or require
   manual re-entry.

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

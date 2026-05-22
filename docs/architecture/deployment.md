# Docker LAN Deployment

This deployment profile runs the Phase 7 platform on a LAN host with PostgreSQL
as the durable state backend and Redis as short-lived runtime coordination:

- `postgres`: PostgreSQL stores durable mutable platform records.
- `redis`: Redis stores only active locks, live progress hints, and optional caches.
- `backend`: FastAPI runs under Uvicorn in database mode.
- `frontend`: Nginx serves the Vue production build and proxies backend traffic.
- `DATASET/`: mounted from the host as readonly source data.
- Runtime file roots: mounted from the host for uploaded archives, extracted
  sources, media, generated export artifacts, and emergency file-backed rollback
  references.

Phase 7 switches the Compose default to `PLATFORM_STATE_BACKEND=database` and
`PLATFORM_REDIS_ENABLED=1` after Alembic migrations, file-state import, Redis
loss checks, Docker smoke checks, and rollback review pass. See
[State Persistence Boundaries](./state-persistence-boundaries.md) and
[PostgreSQL + Redis Migration Runbook](./postgres-redis-migration-runbook.md).

The public LAN entrypoint is HTTP on port `8080` by default:

```bash
http://<server-ip>:8080
```

## Host Directories

Create the host directories before the first start:

```bash
sudo mkdir -p /srv/urban-platform/DATASET
sudo mkdir -p /srv/urban-platform/runtime/platform_state
sudo mkdir -p /srv/urban-platform/runtime/label_config_state
sudo mkdir -p /srv/urban-platform/backups
```

Place or bind the raw dataset tree so the backend can read:

```text
/srv/urban-platform/DATASET/urban_violation
```

The Compose file keeps these host filesystem mounts:

```text
/srv/urban-platform/DATASET:/data/datasets:ro
/srv/urban-platform/runtime/platform_state:/data/platform_state
/srv/urban-platform/runtime/label_config_state:/data/label_config_state
```

Phase 7 PostgreSQL service data uses a Docker named volume by default:

```text
postgres_data:/var/lib/postgresql/data
```

Redis does not use a named durable-data volume in the default Compose file.
This is intentional: Redis is not durable platform storage.

## Configuration

Phase 7 backend environment variables:

| Variable | Default in compose | Purpose |
| --- | --- | --- |
| `DATASET_ROOT` | `/data/datasets/urban_violation` | Readonly source dataset root used by the fixture/import runtime. |
| `PLATFORM_STATE_ROOT` | `/data/platform_state` | Writable runtime file root for uploads, extracted source trees, export artifacts, and emergency file-backed rollback input. It is not the durable authority in database mode. |
| `LABEL_CONFIG_STORE_ROOT` | `/data/label_config_state` | Legacy label config and dataset registry file root used by import and emergency file-backed rollback. It is not the durable authority in database mode. |
| `PLATFORM_STATE_BACKEND` | `database` | Selects PostgreSQL-backed durable state. |
| `DATABASE_URL` | `postgresql+psycopg://platform:<password>@postgres:5432/urban_platform` | PostgreSQL URL for backend runtime, Alembic, and import verification. Redact credentials in logs. |
| `PLATFORM_DB_AUTO_MIGRATE` | `1` | Runs Alembic migrations to head at backend startup. Set to `0` only when operators run migrations explicitly. |
| `PLATFORM_REDIS_ENABLED` | `1` | Enables Redis-backed runtime coordination. |
| `REDIS_URL` | `redis://redis:6379/0` | Redis URL for active locks, distributed locks, live progress hints, and optional caches. |
| `PLATFORM_REDIS_LEASE_TTL_SECONDS` | `600` | Active lease lock TTL. |
| `PLATFORM_REDIS_LOCK_TTL_SECONDS` | `120` | Distributed operation lock TTL. |
| `PLATFORM_REDIS_IMPORT_PROGRESS_TTL_SECONDS` | `1800` | Live import progress hint TTL. |
| `PLATFORM_REDIS_SESSION_CACHE_TTL_SECONDS` | `300` | Optional session lookup cache TTL. |
| `PLATFORM_IMPORT_ARCHIVE_MAX_BYTES` | `8589934592` | Maximum uploaded batch zip size in bytes. Compose default is 8 GiB. |
| `PLATFORM_IMPORT_ARCHIVE_EXTRACT_MAX_BYTES` | `34359738368` | Maximum extracted archive content size in bytes. Compose default is 32 GiB. |
| `PLATFORM_ENABLE_FIXTURE_BATCH` | `0` | Controls whether the built-in `urban_violation__0508_fixture` batch is loaded. Docker deployment disables it so only uploaded/registered batches appear. |
| `PLATFORM_AUTH_MODE` | `session` | Enables session-token login. |
| `PLATFORM_DEV_ANON` | `0` | Disables anonymous development access. |
| `PLATFORM_INIT_ADMIN_ID` | `platform_admin` | Bootstrap administrator id. |
| `PLATFORM_INIT_ADMIN_PASSWORD` | `admin123456` | Bootstrap administrator password. Override this before production use. |

Phase 7 service variables:

| Variable | Default in compose | Purpose |
| --- | --- | --- |
| `POSTGRES_DB` | `urban_platform` | PostgreSQL database created by the `postgres` service on first volume initialization. |
| `POSTGRES_USER` | `platform` | PostgreSQL application user. |
| `POSTGRES_PASSWORD` | `platform_dev_password` | Development fallback password used to build `DATABASE_URL`. Override before production use. |
| `DATASET_HOST_ROOT` | `/srv/urban-platform/DATASET` | Host parent directory mounted to `/data/datasets:ro`. Must contain `urban_violation/`. |
| `PLATFORM_STATE_HOST_ROOT` | `/srv/urban-platform/runtime/platform_state` | Host file root mounted to `/data/platform_state`. |
| `LABEL_CONFIG_HOST_ROOT` | `/srv/urban-platform/runtime/label_config_state` | Host file root mounted to `/data/label_config_state`. |
| `FRONTEND_HTTP_PORT` | `8080` | LAN HTTP port exposed by the frontend container. |
| `PLATFORM_DOCKER_SUBNET` | selected by helper | Bridge network subnet injected by `scripts/docker-compose-auto-subnet.py`. |

Redis must not be treated as durable platform storage. Redis loss may remove only active locks, live progress hints, and optional cache entries. Drafts, submissions, audit, label configs, users, roles, sessions, batch metadata, import job final state, sample pool, exports, and evaluations must remain PostgreSQL-backed in database mode.

Test-only variables:

| Variable | Purpose |
| --- | --- |
| `TEST_DATABASE_URL` | Real PostgreSQL smoke database URL for integration tests. Do not commit. |
| `TEST_REDIS_URL` | Isolated Redis smoke URL for integration tests. Do not point at shared production Redis because loss checks may expire keys or run `FLUSHDB`. |

File-state import flags still matter during migration and emergency rollback:

| Flag | Purpose |
| --- | --- |
| `--platform-state-root` | Source file-backed runtime state root read by the import command. |
| `--label-config-store-root` | Source label config and dataset registry root read by the import command. |
| `--dataset-root` | Readonly source dataset root used to preserve filesystem references. |

Confirmed Phase 6 command surface:

```bash
DATABASE_URL="$DATABASE_URL" \
uv run python -m urban_violation_backend.migrate_state import-file-state \
  --platform-state-root /srv/urban-platform/runtime/platform_state \
  --label-config-store-root /srv/urban-platform/runtime/label_config_state \
  --dataset-root /srv/urban-platform/DATASET/urban_violation \
  --dry-run \
  --report "$BACKUP_ROOT/file-state-import.dry-run.json"
```

The import command must not mutate `DATASET/`, uploaded archives, extracted uploaded source trees, media files, generated export artifacts, `PLATFORM_STATE_ROOT`, or `LABEL_CONFIG_STORE_ROOT`. It writes only to the target database and the requested report path. Reverse export from PostgreSQL back to file-backed state is not implemented in Phase 6, so rollback after database-mode writes requires choosing whether PostgreSQL or the pre-cutover file backup is authoritative.

Security cautions:

- Keep Redis bound to loopback or trusted private networks during local smoke runs.
- Use managed-service security controls, Redis ACL/password, and TLS when required by the deployment environment.
- Redact `DATABASE_URL`, `REDIS_URL`, `TEST_DATABASE_URL`, and `TEST_REDIS_URL` in logs and support bundles.
- Do not run Redis restart or `FLUSHDB` validation against a shared Redis database.

Host path and port overrides:

```bash
DATASET_HOST_ROOT=/data/DATASET \
PLATFORM_STATE_HOST_ROOT=/data/urban-runtime/platform_state \
LABEL_CONFIG_HOST_ROOT=/data/urban-runtime/label_config_state \
POSTGRES_PASSWORD='<replace-me>' \
FRONTEND_HTTP_PORT=8080 \
scripts/docker-compose-auto-subnet.py up -d
```

Docker network selection:

```bash
scripts/docker-compose-auto-subnet.py list-used
scripts/docker-compose-auto-subnet.py print-subnet
scripts/docker-compose-auto-subnet.py up -d
```

The helper inspects existing Docker network IPAM subnets and host routes, then injects an unused subnet from the private `172.16.0.0/12` range as `PLATFORM_DOCKER_SUBNET`. It avoids low boundary `/24` ranges such as the `.0.0/24` slice unless no better candidate is available. If this project's `platform` network already exists, the helper reuses that existing subnet so later `ps`, `up`, and `down` commands stay stable. The compose file requires this variable so it does not silently fall back to a hardcoded subnet.

Manual override remains available when needed:

```bash
PLATFORM_DOCKER_SUBNET=172.30.250.0/24 docker compose up -d
```

## Build And Start

For the default Phase 7 rollout, build and start the full stack. The backend
runs Alembic migrations automatically because `PLATFORM_DB_AUTO_MIGRATE=1` by
default:

```bash
scripts/docker-compose-auto-subnet.py build
scripts/docker-compose-auto-subnet.py up -d
scripts/docker-compose-auto-subnet.py ps
curl http://127.0.0.1:8080/health
```

For operator-controlled migrations, override auto-migration and run Alembic
explicitly before starting backend/frontend:

```bash
PLATFORM_DB_AUTO_MIGRATE=0 scripts/docker-compose-auto-subnet.py up -d postgres redis
PLATFORM_DB_AUTO_MIGRATE=0 scripts/docker-compose-auto-subnet.py run --rm backend uv run alembic upgrade head
PLATFORM_DB_AUTO_MIGRATE=0 scripts/docker-compose-auto-subnet.py up -d backend frontend
```

Open:

```bash
http://127.0.0.1:8080/login
```

The frontend build uses `VITE_API_BASE_URL=/api`, so browser API calls stay same-origin through Nginx.

For later restarts after the database is already migrated:

```bash
scripts/docker-compose-auto-subnet.py up -d
scripts/docker-compose-auto-subnet.py ps
```

Expected service health model:

| Service | Expected health gate |
| --- | --- |
| `postgres` | `pg_isready` against the configured database/user. |
| `redis` | `redis-cli ping` returns `PONG`. |
| `backend` | `GET http://127.0.0.1:8000/health` succeeds inside the container after PostgreSQL and Redis are reachable. |
| `frontend` | Depends on healthy backend and serves Nginx on `FRONTEND_HTTP_PORT`. |

## Batch Archive Upload Size

The Nginx entrypoint accepts batch zip uploads up to `8192m` by default. For `/api/` requests, Nginx disables request buffering so large zip bodies stream to the backend instead of first being fully buffered in the Nginx container.

The backend compose defaults allow an 8 GiB zip and up to 32 GiB after extraction:

```bash
PLATFORM_IMPORT_ARCHIVE_MAX_BYTES=8589934592
PLATFORM_IMPORT_ARCHIVE_EXTRACT_MAX_BYTES=34359738368
```

For frequent 3-5 GiB uploads, make sure `PLATFORM_STATE_HOST_ROOT` points to a host disk with enough free space for both uploaded archives and extracted runtime data. If larger packages are required, increase both the Nginx `client_max_body_size` in `deploy/docker/nginx.conf` and the backend compose limits, then rebuild and recreate containers.

## Proxy Rules

Nginx handles:

| Public path | Backend target |
| --- | --- |
| `/health` | `http://backend:8000/health` |
| `/api/` | `http://backend:8000/api/` |
| `/media/` | `http://backend:8000/media/` |

All other non-file paths fall back to `index.html` for Vue router history mode.

## Smoke Checks

Minimum checks after startup:

```bash
docker compose ps
curl http://127.0.0.1:8080/health
curl -i http://127.0.0.1:8080/api/me
```

Expected behavior:

- `/health` returns backend status.
- Unauthenticated protected API requests return an auth error.
- `/login` loads in the browser.
- After logging in with the configured administrator, `/datasets` opens.
- A clean Docker deployment keeps the `urban_violation` dataset type and label config registry but does not list the built-in fixture batch unless `PLATFORM_ENABLE_FIXTURE_BATCH=1` is set.
- Media URLs such as `/api/datasets/{batch_id}/media/images/{file_name}` load through the frontend origin.

PostgreSQL/Redis smoke checks:

```bash
export TEST_DATABASE_URL='postgresql+psycopg://urban_platform:change-me@localhost:5432/urban_platform_test'
export TEST_REDIS_URL='redis://localhost:6379/15'
DATABASE_URL="$TEST_DATABASE_URL" uv run alembic upgrade head
TEST_DATABASE_URL="$TEST_DATABASE_URL" \
TEST_REDIS_URL="$TEST_REDIS_URL" \
PLATFORM_STATE_BACKEND=database \
PLATFORM_REDIS_ENABLED=1 \
uv run pytest tests/test_postgres_redis_smoke.py tests/test_redis_runtime_backend.py::test_real_redis_smoke_if_available -q
```

After Redis restart, TTL expiry, or isolated smoke `FLUSHDB`, durable PostgreSQL-backed records must still be visible. Only active lease locks, live progress hints, and optional caches may be missing.

Persistence checks:

- Upload a label config, restart containers, and confirm the active config still exists.
- Create or register a batch, restart containers, and confirm batch registry state remains.
- Save a draft or autosave in the review workbench, restart containers, and confirm the draft can be reloaded.
- Restart `postgres` and confirm durable state remains visible after the service is healthy again.
- Restart `redis` and confirm durable state remains visible; active locks and live progress may be lost.
- Deleting a platform batch must remove runtime registry/state only; the mounted raw `DATASET/` directory is readonly and must not be modified.
- Uploaded archives, extracted uploaded batch source, media files, and generated export artifacts remain on mounted filesystems and are not moved into PostgreSQL by TASK-019.

## Regression Checks

Run repository checks before shipping deployment changes:

```bash
uv run pytest
cd frontend && npm run test && npm run build
scripts/docker-compose-auto-subnet.py build
scripts/docker-compose-auto-subnet.py up -d
curl http://127.0.0.1:8080/health
scripts/docker-compose-auto-subnet.py restart backend
scripts/docker-compose-auto-subnet.py restart redis
scripts/docker-compose-auto-subnet.py down
```

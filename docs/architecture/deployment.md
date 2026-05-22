# Docker LAN Deployment

This deployment profile runs the platform as two containers on a LAN host:

- `frontend`: Nginx serves the Vue production build and proxies backend traffic.
- `backend`: FastAPI runs under Uvicorn.
- `DATASET/`: mounted from the host as readonly source data.
- Runtime state: mounted from the host as writable state for accounts, sessions, permissions, batches, drafts, label config, QC state, and audit records.

Current Compose deployment is file-backed. TASK-019 Phase 3 introduces PostgreSQL foundation code and migrations, Phase 4 adds QC/review PostgreSQL state, and Phase 5 validates optional Redis runtime coordination. These phases do not switch Docker defaults, do not make Redis a required production service, and do not make the production database rollout. TASK-019 will add PostgreSQL and Redis to Docker defaults only in the Phase 7 Docker rollout after database migrations, QC/review state migration, file-state import, Redis restart behavior, Docker rollout checks, and rollback have passed. See [State Persistence Boundaries](./state-persistence-boundaries.md) and [PostgreSQL + Redis Migration Runbook](./postgres-redis-migration-runbook.md).

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
```

Place or bind the raw dataset tree so the backend can read:

```text
/srv/urban-platform/DATASET/urban_violation
```

The compose file mounts:

```text
/srv/urban-platform/DATASET:/data/datasets:ro
/srv/urban-platform/runtime/platform_state:/data/platform_state
/srv/urban-platform/runtime/label_config_state:/data/label_config_state
```

## Configuration

Important backend environment variables:

| Variable | Default in compose | Purpose |
| --- | --- | --- |
| `DATASET_ROOT` | `/data/datasets/urban_violation` | Readonly source dataset root used by the fixture/import runtime. |
| `PLATFORM_STATE_ROOT` | `/data/platform_state` | Writable runtime state for users, sessions, permissions, drafts, QC, and audit. |
| `LABEL_CONFIG_STORE_ROOT` | `/data/label_config_state` | Writable label config and dataset registry state. |
| `PLATFORM_IMPORT_ARCHIVE_MAX_BYTES` | `8589934592` | Maximum uploaded batch zip size in bytes. Compose default is 8 GiB. |
| `PLATFORM_IMPORT_ARCHIVE_EXTRACT_MAX_BYTES` | `34359738368` | Maximum extracted archive content size in bytes. Compose default is 32 GiB. |
| `PLATFORM_ENABLE_FIXTURE_BATCH` | `0` | Controls whether the built-in `urban_violation__0508_fixture` batch is loaded. Docker deployment disables it so only uploaded/registered batches appear. |
| `PLATFORM_AUTH_MODE` | `session` | Enables session-token login. |
| `PLATFORM_DEV_ANON` | `0` | Disables anonymous development access. |
| `PLATFORM_INIT_ADMIN_ID` | `platform_admin` | Bootstrap administrator id. |
| `PLATFORM_INIT_ADMIN_PASSWORD` | `admin123456` | Bootstrap administrator password. Override this before production use. |

PostgreSQL foundation and QC/review variables are expected by TASK-019 database-mode verification, but they are not Docker defaults yet:

| Variable | Current Docker posture | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Unset in current file-backed Compose defaults | PostgreSQL URL for Alembic and database-backed mode. Required only when `PLATFORM_STATE_BACKEND=database`. |
| `PLATFORM_STATE_BACKEND` | `file` | Selects `file` or `database`. Keep `file` for Docker deployment until the rollout phase. |
| `PLATFORM_DB_AUTO_MIGRATE` | `0` | Controls startup migration behavior if backend implements it. Prefer explicit Alembic commands for operator verification. |

Phase 5 Redis variables are optional verification variables only until Phase 7:

| Variable | Current Docker posture | Purpose |
| --- | --- | --- |
| `PLATFORM_REDIS_ENABLED` | `0` or unset | Enables Redis-backed runtime coordination only when explicitly set to `1`. Keep disabled for current file-backed Docker deployment. |
| `REDIS_URL` | Unset in current file-backed Compose defaults | Redis connection URL for active locks, distributed locks, live progress hints, and optional caches. Required only when Redis mode is explicitly enabled. |
| `TEST_DATABASE_URL` | Operator/test env only | Real PostgreSQL smoke database URL for integration tests. Do not commit. |
| `TEST_REDIS_URL` | Operator/test env only | Isolated Redis smoke URL for integration tests. Do not point at shared production Redis because loss checks may expire keys or run `FLUSHDB`. |

Redis must not be treated as durable platform storage. Redis loss may remove only active locks, live progress hints, and optional cache entries. Drafts, submissions, audit, label configs, users, roles, sessions, batch metadata, import job final state, sample pool, exports, and evaluations must remain PostgreSQL-backed in database mode.

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

```bash
scripts/docker-compose-auto-subnet.py build
scripts/docker-compose-auto-subnet.py up -d
scripts/docker-compose-auto-subnet.py ps
curl http://127.0.0.1:8080/health
```

Open:

```bash
http://127.0.0.1:8080/login
```

The frontend build uses `VITE_API_BASE_URL=/api`, so browser API calls stay same-origin through Nginx.

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

Phase 5 PostgreSQL/Redis smoke checks are opt-in and should be run outside the current file-backed Compose defaults unless the Lead Agent is explicitly reviewing the Redis branches:

```bash
export TEST_DATABASE_URL='postgresql+psycopg://urban_platform:change-me@localhost:5432/urban_platform_test'
export TEST_REDIS_URL='redis://localhost:6379/15'
DATABASE_URL="$TEST_DATABASE_URL" uv run alembic upgrade head
TEST_DATABASE_URL="$TEST_DATABASE_URL" \
TEST_REDIS_URL="$TEST_REDIS_URL" \
PLATFORM_STATE_BACKEND=database \
PLATFORM_REDIS_ENABLED=1 \
uv run pytest -k "redis_runtime or redis_lease or import_progress or qc_queue_lock" -q
```

After Redis restart, TTL expiry, or isolated smoke `FLUSHDB`, durable PostgreSQL-backed records must still be visible. Only active lease locks, live progress hints, and optional caches may be missing.

Persistence checks:

- Upload a label config, restart containers, and confirm the active config still exists.
- Create or register a batch, restart containers, and confirm batch registry state remains.
- Save a draft or autosave in the review workbench, restart containers, and confirm the draft can be reloaded.
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
scripts/docker-compose-auto-subnet.py down
```

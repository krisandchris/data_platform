# Docker LAN Deployment

This deployment profile runs the platform as two containers on a LAN host:

- `frontend`: Nginx serves the Vue production build and proxies backend traffic.
- `backend`: FastAPI runs under Uvicorn.
- `DATASET/`: mounted from the host as readonly source data.
- Runtime state: mounted from the host as writable state for accounts, sessions, permissions, batches, drafts, label config, QC state, and audit records.

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
| `PLATFORM_AUTH_MODE` | `session` | Enables session-token login. |
| `PLATFORM_DEV_ANON` | `0` | Disables anonymous development access. |
| `PLATFORM_INIT_ADMIN_ID` | `platform_admin` | Bootstrap administrator id. |
| `PLATFORM_INIT_ADMIN_PASSWORD` | `admin123456` | Bootstrap administrator password. Override this before production use. |

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
scripts/docker-compose-auto-subnet.py print-subnet
scripts/docker-compose-auto-subnet.py up -d
```

The helper inspects existing Docker network IPAM subnets and host routes, then injects an unused subnet from the private `172.16.0.0/12` range as `PLATFORM_DOCKER_SUBNET`. If this project's `platform` network already exists, the helper reuses that existing subnet so later `ps`, `up`, and `down` commands stay stable. The compose file requires this variable so it does not silently fall back to a hardcoded subnet.

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
- Media URLs such as `/api/datasets/{batch_id}/media/images/{file_name}` load through the frontend origin.

Persistence checks:

- Upload a label config, restart containers, and confirm the active config still exists.
- Create or register a batch, restart containers, and confirm batch registry state remains.
- Save a draft or autosave in the review workbench, restart containers, and confirm the draft can be reloaded.
- Deleting a platform batch must remove runtime registry/state only; the mounted raw `DATASET/` directory is readonly and must not be modified.

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

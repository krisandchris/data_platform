from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import time
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[1]
COMPOSE_HELPER = ROOT / "scripts" / "docker-compose-auto-subnet.py"
COMPOSE_FILE = ROOT / "docker-compose.yml"
BACKEND_DOCKERFILE = ROOT / "deploy" / "docker" / "backend.Dockerfile"
LIVE_SMOKE_FLAG = "QA_RUN_DOCKER_ROLLOUT_SMOKE"
LIVE_SMOKE_ISOLATED_FLAG = "QA_DOCKER_SMOKE_CONFIRM_ISOLATED"


def _compose_fixture_env(tmp_path: Path) -> dict[str, str]:
    dataset_host = tmp_path / "dataset_host"
    runtime_host = tmp_path / "runtime"
    platform_state_host = runtime_host / "platform_state"
    label_config_host = runtime_host / "label_config_state"
    (dataset_host / "urban_violation").mkdir(parents=True, exist_ok=True)
    platform_state_host.mkdir(parents=True, exist_ok=True)
    label_config_host.mkdir(parents=True, exist_ok=True)

    env = os.environ.copy()
    env.update(
        {
            "PLATFORM_DOCKER_SUBNET": env.get("PLATFORM_DOCKER_SUBNET", "172.30.250.0/24"),
            "DATASET_HOST_ROOT": str(dataset_host),
            "PLATFORM_STATE_HOST_ROOT": str(platform_state_host),
            "LABEL_CONFIG_HOST_ROOT": str(label_config_host),
            "COMPOSE_PROJECT_NAME": env.get("COMPOSE_PROJECT_NAME", "task019qa_config"),
            "FRONTEND_HTTP_PORT": env.get("FRONTEND_HTTP_PORT", "10880"),
        }
    )
    return env


def _run_compose_helper(args: list[str], *, env: dict[str, str], timeout: int = 120) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [str(COMPOSE_HELPER), *args],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        timeout=timeout,
        check=False,
    )


def _docker_ready() -> tuple[bool, str]:
    if shutil.which("docker") is None:
        return False, "docker binary is not available"
    probe = subprocess.run(["docker", "info"], text=True, capture_output=True, check=False)
    if probe.returncode != 0:
        detail = probe.stderr.strip() or probe.stdout.strip() or "docker info failed"
        return False, f"docker daemon is not reachable: {detail}"
    return True, "ok"


def _render_compose_config(tmp_path: Path) -> dict[str, Any]:
    ready, reason = _docker_ready()
    if not ready:
        pytest.skip(f"Compose config verification skipped: {reason}")

    env = _compose_fixture_env(tmp_path)
    rendered = _run_compose_helper(["config", "--format", "json"], env=env)
    if rendered.returncode != 0:
        detail = rendered.stderr.strip() or rendered.stdout.strip()
        pytest.fail(f"compose config render failed: {detail}")
    return json.loads(rendered.stdout)


def _find_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _live_smoke_env(tmp_path: Path) -> dict[str, str]:
    env = _compose_fixture_env(tmp_path)
    project = env.get("COMPOSE_PROJECT_NAME", "").strip() or f"task019qa_smoke_{int(time.time())}"
    if not project.startswith("task019qa_"):
        project = f"task019qa_{project}"
    env["COMPOSE_PROJECT_NAME"] = project
    env["FRONTEND_HTTP_PORT"] = str(_find_port())
    env.setdefault("PLATFORM_INIT_ADMIN_ID", "platform_admin")
    env.setdefault("PLATFORM_INIT_ADMIN_PASSWORD", "admin123456")
    return env


def _require_live_smoke_opt_in() -> None:
    if os.environ.get(LIVE_SMOKE_FLAG, "").strip() != "1":
        pytest.skip(
            f"Live Docker smoke skipped: set {LIVE_SMOKE_FLAG}=1 to run isolated container checks."
        )
    if os.environ.get(LIVE_SMOKE_ISOLATED_FLAG, "").strip() != "1":
        pytest.skip(
            f"Live Docker smoke skipped: set {LIVE_SMOKE_ISOLATED_FLAG}=1 to confirm isolated local Docker resources."
        )


def _wait_http_ok(url: str, *, timeout_seconds: int = 180) -> dict[str, Any]:
    deadline = time.monotonic() + timeout_seconds
    last_error = "unknown"
    while time.monotonic() < deadline:
        attempt = subprocess.run(
            ["curl", "--noproxy", "*", "-fsS", url],
            text=True,
            capture_output=True,
            check=False,
            timeout=15,
        )
        if attempt.returncode == 0:
            return json.loads(attempt.stdout)
        last_error = attempt.stderr.strip() or attempt.stdout.strip() or f"curl failed with code {attempt.returncode}"
        time.sleep(2)
    pytest.fail(f"timeout waiting for healthy endpoint {url}: {last_error}")


def test_docker_compose_phase7_defaults_are_four_service_database_redis(tmp_path: Path) -> None:
    config = _render_compose_config(tmp_path)
    services = config.get("services", {})

    assert "backend" in services
    assert "frontend" in services
    assert "postgres" in services
    assert "redis" in services

    backend = services["backend"]
    backend_env = backend.get("environment", {})
    assert backend_env.get("PLATFORM_AUTH_MODE") == "session"
    assert backend_env.get("PLATFORM_DEV_ANON") == "0"
    assert backend_env.get("PLATFORM_ENABLE_FIXTURE_BATCH") in {"0", 0}
    assert str(backend_env.get("PLATFORM_STATE_BACKEND", "")).lower() == "database"
    assert str(backend_env.get("PLATFORM_REDIS_ENABLED", "")).strip() in {"1", "true", "True"}
    assert "DATABASE_URL" in backend_env
    assert "postgres" in str(backend_env["DATABASE_URL"]).lower()
    assert "REDIS_URL" in backend_env
    assert "redis://" in str(backend_env["REDIS_URL"]).lower()
    assert "healthcheck" in backend

    depends_on = backend.get("depends_on", {})
    assert depends_on.get("postgres", {}).get("condition") == "service_healthy"
    assert depends_on.get("redis", {}).get("condition") == "service_healthy"

    postgres = services["postgres"]
    redis = services["redis"]
    assert "healthcheck" in postgres
    assert "healthcheck" in redis
    assert postgres.get("volumes"), "Postgres service must persist data via a mounted volume."

    volumes = backend.get("volumes", [])
    volume_targets = {
        item.get("target") if isinstance(item, dict) else str(item).split(":")[1]
        for item in volumes
    }
    assert "/data/datasets" in volume_targets
    assert "/data/platform_state" in volume_targets
    assert "/data/label_config_state" in volume_targets


def test_docker_compose_file_backed_rollback_overrides_are_renderable(tmp_path: Path) -> None:
    config = _render_compose_config(tmp_path)
    rollback_env = _compose_fixture_env(tmp_path)
    rollback_env["PLATFORM_STATE_BACKEND"] = "file"
    rollback_env["PLATFORM_REDIS_ENABLED"] = "0"
    rollback_rendered = _run_compose_helper(["config", "--format", "json"], env=rollback_env)
    assert rollback_rendered.returncode == 0, rollback_rendered.stderr
    rollback_config = json.loads(rollback_rendered.stdout)

    services = rollback_config.get("services", {})
    assert "postgres" in services
    assert "redis" in services
    backend = services["backend"]
    backend_env = backend.get("environment", {})
    assert str(backend_env.get("PLATFORM_STATE_BACKEND", "")).lower() == "file"
    assert str(backend_env.get("PLATFORM_REDIS_ENABLED", "")).strip() in {"0", "false", "False"}
    # Rollback mode still renders the same four services; operators can keep this as non-destructive fallback wiring.
    assert "DATABASE_URL" in backend_env
    assert "REDIS_URL" in backend_env


def test_backend_dockerfile_keeps_alembic_migration_entrypoints_packaged() -> None:
    content = BACKEND_DOCKERFILE.read_text(encoding="utf-8")
    assert "COPY alembic" in content
    assert "COPY alembic.ini" in content
    assert "uv sync --frozen --no-dev" in content


def test_docker_rollout_live_smoke_env_gated(tmp_path: Path) -> None:
    _require_live_smoke_opt_in()
    ready, reason = _docker_ready()
    if not ready:
        pytest.skip(f"Live Docker smoke skipped: {reason}")

    if shutil.which("curl") is None:
        pytest.skip("Live Docker smoke skipped: curl is required.")

    env = _live_smoke_env(tmp_path)
    port = env["FRONTEND_HTTP_PORT"]
    base = f"http://127.0.0.1:{port}"

    down_result: subprocess.CompletedProcess[str] | None = None
    try:
        rendered = _run_compose_helper(["config"], env=env)
        assert rendered.returncode == 0, rendered.stderr

        build = _run_compose_helper(["build"], env=env, timeout=900)
        assert build.returncode == 0, build.stderr

        up = _run_compose_helper(["up", "-d"], env=env, timeout=300)
        assert up.returncode == 0, up.stderr

        ps = _run_compose_helper(["ps", "--format", "json"], env=env)
        assert ps.returncode == 0, ps.stderr

        health = _wait_http_ok(f"{base}/health")
        assert health.get("status") == "ok"

        login = subprocess.run(
            [
                "curl",
                "--noproxy",
                "*",
                "-fsS",
                "-X",
                "POST",
                "-H",
                "Content-Type: application/json",
                "--data",
                json.dumps(
                    {
                        "user_id": env["PLATFORM_INIT_ADMIN_ID"],
                        "password": env["PLATFORM_INIT_ADMIN_PASSWORD"],
                    }
                ),
                f"{base}/api/auth/login",
            ],
            text=True,
            capture_output=True,
            check=False,
            timeout=20,
        )
        assert login.returncode == 0, login.stderr
        login_payload = json.loads(login.stdout)
        token = login_payload.get("token")
        assert token, f"login did not return a token: {login_payload}"

        me = subprocess.run(
            ["curl", "--noproxy", "*", "-fsS", "-H", f"X-Session-Token: {token}", f"{base}/api/me"],
            text=True,
            capture_output=True,
            check=False,
            timeout=20,
        )
        assert me.returncode == 0, me.stderr

        datasets = subprocess.run(
            ["curl", "--noproxy", "*", "-fsS", "-H", f"X-Session-Token: {token}", f"{base}/api/datasets"],
            text=True,
            capture_output=True,
            check=False,
            timeout=20,
        )
        assert datasets.returncode == 0, datasets.stderr
        assert isinstance(json.loads(datasets.stdout), list)

        label_configs = subprocess.run(
            [
                "curl",
                "--noproxy",
                "*",
                "-fsS",
                "-H",
                f"X-Session-Token: {token}",
                f"{base}/api/datasets/urban_violation/label-configs",
            ],
            text=True,
            capture_output=True,
            check=False,
            timeout=20,
        )
        assert label_configs.returncode == 0, label_configs.stderr
        assert isinstance(json.loads(label_configs.stdout), list)

        restart_backend = _run_compose_helper(["restart", "backend"], env=env, timeout=180)
        assert restart_backend.returncode == 0, restart_backend.stderr
        restarted_health = _wait_http_ok(f"{base}/health")
        assert restarted_health.get("status") == "ok"

        post_restart_me = subprocess.run(
            ["curl", "--noproxy", "*", "-fsS", "-H", f"X-Session-Token: {token}", f"{base}/api/me"],
            text=True,
            capture_output=True,
            check=False,
            timeout=20,
        )
        assert post_restart_me.returncode == 0, post_restart_me.stderr

        if "redis" in json.loads(_run_compose_helper(["config", "--format", "json"], env=env).stdout).get("services", {}):
            restart_redis = _run_compose_helper(["restart", "redis"], env=env, timeout=180)
            assert restart_redis.returncode == 0, restart_redis.stderr
            redis_boundary = subprocess.run(
                ["curl", "--noproxy", "*", "-fsS", "-H", f"X-Session-Token: {token}", f"{base}/api/datasets"],
                text=True,
                capture_output=True,
                check=False,
                timeout=20,
            )
            assert redis_boundary.returncode == 0, redis_boundary.stderr

    finally:
        down_result = _run_compose_helper(["down", "-v", "--remove-orphans"], env=env, timeout=240)
        if down_result.returncode != 0:
            pytest.fail(f"docker cleanup failed: {down_result.stderr.strip() or down_result.stdout.strip()}")

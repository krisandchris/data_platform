#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

STACK="${1:-${SMOKE_STACK:-main}}"
if [[ "$STACK" == "--help" || "$STACK" == "-h" || "$STACK" == "help" ]]; then
  cat <<'USAGE'
Usage:
  scripts/integration-smoke.sh [main|agent]

Environment:
  SMOKE_BROWSER=1|0                 Run browser screenshots after API smoke. Default: 1.
  SMOKE_KEEP_STATE=1                Preserve smoke runtime/state directory. Default: 0.
  SMOKE_RUNTIME_DIR=/path           Override runtime directory.
  SMOKE_STATE_ROOT=/path            Override PLATFORM_STATE_ROOT.
  SMOKE_LABEL_CONFIG_STORE_ROOT=/path
                                      Override LABEL_CONFIG_STORE_ROOT.
  SMOKE_PLAYWRIGHT_VERSION=1.60.0   Playwright CLI version used through npx.

Stacks:
  main   accepted-code stack via scripts/dev-stack.sh on 8000/5173.
  agent  agent worktree stack via scripts/agent-dev-stack.sh on 18031/15195.
USAGE
  exit 0
fi

case "$STACK" in
  main)
    STACK_SCRIPT="$ROOT_DIR/scripts/dev-stack.sh"
    DEFAULT_RUNTIME_DIR="$ROOT_DIR/.runtime/integration-smoke-main"
    BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:8000}"
    FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:5173}"
    ;;
  agent)
    STACK_SCRIPT="$ROOT_DIR/scripts/agent-dev-stack.sh"
    DEFAULT_RUNTIME_DIR="$ROOT_DIR/.runtime/integration-smoke-agent"
    BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:18031}"
    FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:15195}"
    ;;
  *)
    echo "[integration-smoke] unknown stack: $STACK" >&2
    echo "Use: scripts/integration-smoke.sh [main|agent]" >&2
    exit 2
    ;;
esac

RUNTIME_DIR="${SMOKE_RUNTIME_DIR:-$DEFAULT_RUNTIME_DIR}"
PLATFORM_STATE_ROOT="${SMOKE_STATE_ROOT:-$RUNTIME_DIR/platform_state}"
LABEL_CONFIG_STORE_ROOT="${SMOKE_LABEL_CONFIG_STORE_ROOT:-$RUNTIME_DIR/label_config_state}"
ARTIFACT_DIR="$RUNTIME_DIR/artifacts"
SUMMARY_JSON="$ARTIFACT_DIR/api-smoke-summary.json"
SMOKE_BROWSER="${SMOKE_BROWSER:-1}"
SMOKE_KEEP_STATE="${SMOKE_KEEP_STATE:-0}"
SMOKE_PLAYWRIGHT_VERSION="${SMOKE_PLAYWRIGHT_VERSION:-1.60.0}"

info() {
  printf '[integration-smoke] %s\n' "$*"
}

warn() {
  printf '[integration-smoke] WARN: %s\n' "$*" >&2
}

stop_stacks() {
  set +e
  RUNTIME_DIR="$RUNTIME_DIR" "$STACK_SCRIPT" stop >/dev/null 2>&1
  "$ROOT_DIR/scripts/dev-stack.sh" stop >/dev/null 2>&1
  "$ROOT_DIR/scripts/agent-dev-stack.sh" stop >/dev/null 2>&1
  set -e
}

check_ports_released() {
  local ports=':(8000|5173|18030|15194|18031|15195)([[:space:]]|$)'
  if ss -ltnp | grep -E "$ports" >/tmp/uvp-integration-smoke-ports.txt; then
    cat /tmp/uvp-integration-smoke-ports.txt >&2
    return 1
  fi
}

cleanup() {
  local status=$?
  stop_stacks || true
  if ! check_ports_released; then
    warn "project ports still have listeners after cleanup"
    status=1
  fi
  if [[ "$status" -eq 0 ]]; then
    info "services stopped and project ports released"
  fi
  exit "$status"
}

run_browser_smoke() {
  command -v npx >/dev/null 2>&1 || {
    warn "npx is not available; skipping browser smoke"
    return 1
  }

  local overview_url="$FRONTEND_URL/datasets/urban_violation__0508_fixture/overview"
  local pool_url="$FRONTEND_URL/sample-pool"
  local playwright=(npx --yes "playwright@$SMOKE_PLAYWRIGHT_VERSION")

  info "browser smoke: overview model evaluation"
  (
    cd "$ROOT_DIR/frontend"
    if [[ -s "$HOME/.nvm/nvm.sh" && -f "$ROOT_DIR/.nvmrc" ]]; then
      # shellcheck source=/dev/null
      . "$HOME/.nvm/nvm.sh"
      nvm use "$(tr -d '[:space:]' < "$ROOT_DIR/.nvmrc")" >/dev/null
    fi
    "${playwright[@]}" screenshot \
      --wait-for-selector "text=模型评估" \
      --timeout 30000 \
      "$overview_url" \
      "$ARTIFACT_DIR/overview-model-evaluation.png"
    "${playwright[@]}" screenshot \
      --wait-for-selector "text=版本历史" \
      --timeout 30000 \
      "$overview_url" \
      "$ARTIFACT_DIR/overview-version-history.png"
    "${playwright[@]}" screenshot \
      --wait-for-selector "text=导出管理" \
      --timeout 30000 \
      "$pool_url" \
      "$ARTIFACT_DIR/sample-pool-export.png"
  )
}

trap cleanup EXIT

if [[ "$SMOKE_KEEP_STATE" != "1" ]]; then
  rm -rf "$RUNTIME_DIR"
fi
mkdir -p "$ARTIFACT_DIR" "$PLATFORM_STATE_ROOT"

info "stack=$STACK runtime=$RUNTIME_DIR"
info "state=$PLATFORM_STATE_ROOT"
info "label_config_state=$LABEL_CONFIG_STORE_ROOT"

stop_stacks

RUNTIME_DIR="$RUNTIME_DIR" \
  PLATFORM_STATE_ROOT="$PLATFORM_STATE_ROOT" \
  LABEL_CONFIG_STORE_ROOT="$LABEL_CONFIG_STORE_ROOT" \
  "$STACK_SCRIPT" start
RUNTIME_DIR="$RUNTIME_DIR" "$STACK_SCRIPT" status

curl --noproxy '*' -fsS "$BACKEND_URL/health" >/dev/null
curl --noproxy '*' -fsS "$FRONTEND_URL/" >/dev/null

python3 "$ROOT_DIR/scripts/integration-api-smoke.py" \
  --base-url "$BACKEND_URL" \
  --label-config "$ROOT_DIR/DATASET/urban_violation/label_config.json" \
  --output "$SUMMARY_JSON"

if [[ "$SMOKE_BROWSER" == "1" ]]; then
  run_browser_smoke
else
  info "browser smoke skipped by SMOKE_BROWSER=0"
fi

info "artifacts=$ARTIFACT_DIR"
info "PASS"

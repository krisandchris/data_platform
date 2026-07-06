#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
RUNTIME_DIR="${RUNTIME_DIR:-$ROOT_DIR/.runtime/offline-stack}"
OFFLINE_DATA_ROOT="${OFFLINE_DATA_ROOT:-${DATASET_ROOT:-$ROOT_DIR/DATASET/urban_violation}}"
OFFLINE_STATE_ROOT="${OFFLINE_STATE_ROOT:-$ROOT_DIR/.runtime/offline_state}"
OFFLINE_LABEL_CONFIG_PATH="${OFFLINE_LABEL_CONFIG_PATH:-$OFFLINE_DATA_ROOT/label_config.json}"
OFFLINE_DATASET_ID="${OFFLINE_DATASET_ID:-urban_violation}"

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8001}"
FRONTEND_HOST="${FRONTEND_HOST:-0.0.0.0}"
FRONTEND_PUBLIC_HOST="${FRONTEND_PUBLIC_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
START_TIMEOUT="${START_TIMEOUT:-120}"
LOG_LINES="${LOG_LINES:-80}"

BACKEND_PID_FILE="$RUNTIME_DIR/backend.pid"
FRONTEND_PID_FILE="$RUNTIME_DIR/frontend.pid"
BACKEND_LOG="$RUNTIME_DIR/backend.log"
FRONTEND_LOG="$RUNTIME_DIR/frontend.log"
STACK_ENV_FILE="$RUNTIME_DIR/offline-stack.env"

BACKEND_URL="http://$BACKEND_HOST:$BACKEND_PORT"
FRONTEND_URL="http://$FRONTEND_PUBLIC_HOST:$FRONTEND_PORT"
QC_URL="$FRONTEND_URL/datasets/$OFFLINE_DATASET_ID/qc"

usage() {
  cat <<'USAGE'
Usage:
  scripts/offline-stack.sh start
  scripts/offline-stack.sh stop
  scripts/offline-stack.sh restart
  scripts/offline-stack.sh status
  scripts/offline-stack.sh urls

Environment overrides:
  OFFLINE_DATA_ROOT=DATASET/urban_violation
  OFFLINE_STATE_ROOT=.runtime/offline_state
  OFFLINE_LABEL_CONFIG_PATH=$OFFLINE_DATA_ROOT/label_config.json
  OFFLINE_DATASET_ID=urban_violation
  BACKEND_PORT=8001 FRONTEND_PORT=5173
USAGE
}

info() {
  printf '[offline-stack] %s\n' "$*"
}

warn() {
  printf '[offline-stack] WARN: %s\n' "$*" >&2
}

die() {
  printf '[offline-stack] ERROR: %s\n' "$*" >&2
  exit 1
}

pid_from_file() {
  local file="$1"
  [[ -f "$file" ]] || return 1
  local pid
  pid="$(tr -d '[:space:]' < "$file")"
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  printf '%s\n' "$pid"
}

is_running() {
  local pid="${1:-}"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

pid_file_running() {
  local file="$1"
  local pid
  pid="$(pid_from_file "$file" 2>/dev/null || true)"
  is_running "$pid"
}

connect_host() {
  if [[ "$1" == "0.0.0.0" || "$1" == "::" ]]; then
    printf '127.0.0.1\n'
  else
    printf '%s\n' "$1"
  fi
}

port_open() {
  local host
  host="$(connect_host "$1")"
  (echo > "/dev/tcp/$host/$2") >/dev/null 2>&1
}

curl_quiet() {
  curl --noproxy '*' -fsS "$1" >/dev/null 2>&1
}

wait_for_url() {
  local label="$1"
  local url="$2"
  local deadline=$((SECONDS + START_TIMEOUT))
  while (( SECONDS < deadline )); do
    if curl_quiet "$url"; then
      info "$label ready: $url"
      return 0
    fi
    sleep 1
  done
  return 1
}

tail_log() {
  local label="$1"
  local file="$2"
  [[ -f "$file" ]] || return 0
  printf '\n--- %s log: %s ---\n' "$label" "$file" >&2
  tail -n "$LOG_LINES" "$file" >&2
}

ensure_command() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

use_node_version() {
  local nvm_dir="${NVM_DIR:-$HOME/.nvm}"
  if [[ -f "$ROOT_DIR/.nvmrc" && -s "$nvm_dir/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    . "$nvm_dir/nvm.sh"
    nvm use "$(tr -d '[:space:]' < "$ROOT_DIR/.nvmrc")"
  fi
}

ensure_frontend_dependencies() {
  use_node_version >/dev/null
  ensure_command npm
  [[ -d "$FRONTEND_DIR/node_modules" ]] || (cd "$FRONTEND_DIR" && npm ci)
}

start_detached() {
  if command -v setsid >/dev/null 2>&1; then
    exec setsid "$@"
  fi
  exec nohup "$@"
}

write_stack_env() {
  {
    printf 'OFFLINE_DATA_ROOT=%q\n' "$OFFLINE_DATA_ROOT"
    printf 'OFFLINE_STATE_ROOT=%q\n' "$OFFLINE_STATE_ROOT"
    printf 'OFFLINE_LABEL_CONFIG_PATH=%q\n' "$OFFLINE_LABEL_CONFIG_PATH"
    printf 'OFFLINE_DATASET_ID=%q\n' "$OFFLINE_DATASET_ID"
    printf 'BACKEND_URL=%q\n' "$BACKEND_URL"
    printf 'FRONTEND_URL=%q\n' "$FRONTEND_URL"
    printf 'QC_URL=%q\n' "$QC_URL"
  } > "$STACK_ENV_FILE"
}

load_stack_env() {
  [[ -f "$STACK_ENV_FILE" ]] || return 0
  # shellcheck source=/dev/null
  . "$STACK_ENV_FILE"
}

print_urls() {
  printf 'Backend health: %s/health\n' "$BACKEND_URL"
  printf 'Frontend:       %s\n' "$FRONTEND_URL"
  printf 'QC workbench:   %s\n' "$QC_URL"
  printf 'Data root:      %s\n' "$OFFLINE_DATA_ROOT"
  printf 'State root:     %s\n' "$OFFLINE_STATE_ROOT"
}

start_backend() {
  mkdir -p "$RUNTIME_DIR" "$OFFLINE_STATE_ROOT"
  ensure_command uv
  ensure_command curl

  if pid_file_running "$BACKEND_PID_FILE"; then
    info "backend already running with pid $(pid_from_file "$BACKEND_PID_FILE")"
    return
  fi
  rm -f "$BACKEND_PID_FILE"
  port_open "$BACKEND_HOST" "$BACKEND_PORT" && die "backend port is already in use: $BACKEND_HOST:$BACKEND_PORT"

  info "starting backend on $BACKEND_URL"
  (
    cd "$ROOT_DIR"
    export OFFLINE_DATA_ROOT OFFLINE_STATE_ROOT OFFLINE_LABEL_CONFIG_PATH
    export PLATFORM_AUTH_MODE=offline_single_user
    export PLATFORM_STATE_BACKEND=file
    export PLATFORM_REDIS_ENABLED=0
    export PLATFORM_DEV_ANON=0
    start_detached uv run uvicorn urban_violation_backend.app:app --host "$BACKEND_HOST" --port "$BACKEND_PORT"
  ) > "$BACKEND_LOG" 2>&1 &
  printf '%s\n' "$!" > "$BACKEND_PID_FILE"

  if ! wait_for_url backend "$BACKEND_URL/health"; then
    tail_log backend "$BACKEND_LOG"
    stop_process backend "$BACKEND_PID_FILE"
    die "backend did not become ready within ${START_TIMEOUT}s"
  fi
}

start_frontend() {
  mkdir -p "$RUNTIME_DIR"
  ensure_command curl
  ensure_frontend_dependencies

  if pid_file_running "$FRONTEND_PID_FILE"; then
    info "frontend already running with pid $(pid_from_file "$FRONTEND_PID_FILE")"
    return
  fi
  rm -f "$FRONTEND_PID_FILE"
  port_open "$FRONTEND_PUBLIC_HOST" "$FRONTEND_PORT" && die "frontend port is already in use: $FRONTEND_PUBLIC_HOST:$FRONTEND_PORT"

  info "starting frontend on $FRONTEND_URL"
  (
    cd "$FRONTEND_DIR"
    use_node_version
    export VITE_API_BASE_URL="${VITE_API_BASE_URL:-/api}"
    export VITE_API_PROXY_TARGET="${VITE_API_PROXY_TARGET:-$BACKEND_URL}"
    export VITE_RUNTIME_MODE=offline_single_user
    export VITE_OFFLINE_DATASET_ID="$OFFLINE_DATASET_ID"
    start_detached npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT" --strictPort
  ) > "$FRONTEND_LOG" 2>&1 &
  printf '%s\n' "$!" > "$FRONTEND_PID_FILE"

  if ! wait_for_url frontend "$FRONTEND_URL"; then
    tail_log frontend "$FRONTEND_LOG"
    stop_process frontend "$FRONTEND_PID_FILE"
    die "frontend did not become ready within ${START_TIMEOUT}s"
  fi
}

stop_process() {
  local label="$1"
  local pid_file="$2"
  local pid
  pid="$(pid_from_file "$pid_file" 2>/dev/null || true)"
  if ! is_running "$pid"; then
    rm -f "$pid_file"
    info "$label stopped"
    return
  fi

  info "stopping $label pid $pid"
  kill "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
  for _ in {1..20}; do
    is_running "$pid" || break
    sleep 0.25
  done
  is_running "$pid" && kill -9 "-$pid" 2>/dev/null || true
  rm -f "$pid_file"
  info "$label stopped"
}

status_one() {
  local label="$1"
  local pid_file="$2"
  local url="$3"
  local pid
  pid="$(pid_from_file "$pid_file" 2>/dev/null || true)"
  if is_running "$pid"; then
    printf '%-8s running pid=%s url=%s\n' "$label" "$pid" "$url"
  else
    printf '%-8s stopped url=%s\n' "$label" "$url"
  fi
}

start_stack() {
  start_backend
  start_frontend
  write_stack_env
  print_urls
}

stop_stack() {
  load_stack_env
  stop_process frontend "$FRONTEND_PID_FILE"
  stop_process backend "$BACKEND_PID_FILE"
  rm -f "$STACK_ENV_FILE"
}

status_stack() {
  load_stack_env
  status_one backend "$BACKEND_PID_FILE" "$BACKEND_URL"
  status_one frontend "$FRONTEND_PID_FILE" "$FRONTEND_URL"
}

case "${1:-}" in
  start)
    start_stack
    ;;
  stop)
    stop_stack
    ;;
  restart)
    stop_stack
    start_stack
    ;;
  status)
    status_stack
    ;;
  urls)
    load_stack_env
    print_urls
    ;;
  -h|--help|help|'')
    usage
    ;;
  *)
    usage
    die "unknown command: $1"
    ;;
esac

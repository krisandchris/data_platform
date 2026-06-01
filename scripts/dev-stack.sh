#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
RUNTIME_DIR="${RUNTIME_DIR:-$ROOT_DIR/.runtime}"
PLATFORM_STATE_ROOT="${PLATFORM_STATE_ROOT:-$RUNTIME_DIR/platform_state}"
LABEL_CONFIG_STORE_ROOT="${LABEL_CONFIG_STORE_ROOT:-$RUNTIME_DIR/label_config_state}"
PLATFORM_AUTH_MODE="${PLATFORM_AUTH_MODE:-session}"
PLATFORM_DEV_ANON="${PLATFORM_DEV_ANON:-0}"

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8001}"
FRONTEND_HOST="${FRONTEND_HOST:-0.0.0.0}"
FRONTEND_PUBLIC_HOST="${FRONTEND_PUBLIC_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
START_TIMEOUT="${START_TIMEOUT:-240}"
LOG_LINES="${LOG_LINES:-80}"

BACKEND_PID_FILE="$RUNTIME_DIR/backend.pid"
FRONTEND_PID_FILE="$RUNTIME_DIR/frontend.pid"
BACKEND_LOG="$RUNTIME_DIR/backend.log"
FRONTEND_LOG="$RUNTIME_DIR/frontend.log"
STACK_ENV_FILE="$RUNTIME_DIR/dev-stack.env"

BACKEND_URL="http://$BACKEND_HOST:$BACKEND_PORT"
FRONTEND_URL="http://$FRONTEND_PUBLIC_HOST:$FRONTEND_PORT"
REVIEW_URL="$FRONTEND_URL/datasets/urban_violation/samples/000142_0_1762483003246/review"

usage() {
  cat <<'USAGE'
Usage:
  scripts/dev-stack.sh start
  scripts/dev-stack.sh stop
  scripts/dev-stack.sh restart
  scripts/dev-stack.sh status
  scripts/dev-stack.sh logs [backend|frontend|all]
  scripts/dev-stack.sh urls

Environment overrides:
  BACKEND_HOST=127.0.0.1 BACKEND_PORT=8001
  FRONTEND_HOST=0.0.0.0 FRONTEND_PUBLIC_HOST=127.0.0.1 FRONTEND_PORT=5173
  RUNTIME_DIR=.runtime START_TIMEOUT=240 LOG_LINES=80
  PLATFORM_STATE_ROOT=.runtime/platform_state
  LABEL_CONFIG_STORE_ROOT=.runtime/label_config_state
  PLATFORM_AUTH_MODE=session
  PLATFORM_DEV_ANON=0

Frontend defaults to Vite proxy mode:
  VITE_API_BASE_URL=/api
  VITE_API_PROXY_TARGET=http://BACKEND_HOST:BACKEND_PORT
USAGE
}

info() {
  printf '[dev-stack] %s\n' "$*"
}

warn() {
  printf '[dev-stack] WARN: %s\n' "$*" >&2
}

die() {
  printf '[dev-stack] ERROR: %s\n' "$*" >&2
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
  local host="$1"
  if [[ "$host" == "0.0.0.0" || "$host" == "::" ]]; then
    printf '127.0.0.1\n'
  else
    printf '%s\n' "$host"
  fi
}

port_open() {
  local host
  host="$(connect_host "$1")"
  local port="$2"
  (echo > "/dev/tcp/$host/$port") >/dev/null 2>&1
}

curl_quiet() {
  local url="$1"
  curl --noproxy '*' -fsS "$url" >/dev/null 2>&1
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
  if [[ -f "$file" ]]; then
    printf '\n--- %s log: %s ---\n' "$label" "$file" >&2
    tail -n "$LOG_LINES" "$file" >&2
  else
    warn "$label log does not exist yet: $file"
  fi
}

ensure_command() {
  local name="$1"
  command -v "$name" >/dev/null 2>&1 || die "Missing required command: $name"
}

use_node_version() {
  local nvm_dir="${NVM_DIR:-$HOME/.nvm}"
  if [[ -f "$ROOT_DIR/.nvmrc" && -s "$nvm_dir/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    . "$nvm_dir/nvm.sh"
    local requested_node
    requested_node="$(tr -d '[:space:]' < "$ROOT_DIR/.nvmrc")"
    if nvm use "$requested_node"; then
      return
    fi
    warn "nvm could not use $requested_node; using current node/npm from PATH"
    return
  fi

  if [[ -f "$ROOT_DIR/.nvmrc" ]]; then
    warn "nvm not found at $nvm_dir; using current node/npm from PATH"
  fi
}

ensure_frontend_dependencies() {
  use_node_version >/dev/null
  ensure_command npm

  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    info "frontend/node_modules missing; running npm ci"
    (cd "$FRONTEND_DIR" && npm ci)
  fi
}

start_detached() {
  if command -v setsid >/dev/null 2>&1; then
    exec setsid "$@"
  fi

  exec nohup "$@"
}

write_stack_env() {
  {
    printf 'BACKEND_HOST=%q\n' "$BACKEND_HOST"
    printf 'BACKEND_PORT=%q\n' "$BACKEND_PORT"
    printf 'FRONTEND_HOST=%q\n' "$FRONTEND_HOST"
    printf 'FRONTEND_PUBLIC_HOST=%q\n' "$FRONTEND_PUBLIC_HOST"
    printf 'FRONTEND_PORT=%q\n' "$FRONTEND_PORT"
    printf 'PLATFORM_STATE_ROOT=%q\n' "$PLATFORM_STATE_ROOT"
    printf 'LABEL_CONFIG_STORE_ROOT=%q\n' "$LABEL_CONFIG_STORE_ROOT"
    printf 'PLATFORM_AUTH_MODE=%q\n' "$PLATFORM_AUTH_MODE"
    printf 'PLATFORM_DEV_ANON=%q\n' "$PLATFORM_DEV_ANON"
    printf 'BACKEND_URL=%q\n' "$BACKEND_URL"
    printf 'FRONTEND_URL=%q\n' "$FRONTEND_URL"
    printf 'REVIEW_URL=%q\n' "$REVIEW_URL"
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
  printf 'Review sample:  %s\n' "$REVIEW_URL"
  printf 'Logs:           %s\n' "$RUNTIME_DIR"
}

start_backend() {
  mkdir -p "$RUNTIME_DIR" "$PLATFORM_STATE_ROOT" "$LABEL_CONFIG_STORE_ROOT"
  ensure_command uv
  ensure_command curl

  if pid_file_running "$BACKEND_PID_FILE"; then
    info "backend already running with pid $(pid_from_file "$BACKEND_PID_FILE")"
    return 0
  fi
  rm -f "$BACKEND_PID_FILE"

  if port_open "$BACKEND_HOST" "$BACKEND_PORT"; then
    die "backend port is already in use: $(connect_host "$BACKEND_HOST"):$BACKEND_PORT"
  fi

  info "starting backend on $BACKEND_URL"
  (
    cd "$ROOT_DIR"
    export PLATFORM_STATE_ROOT
    export LABEL_CONFIG_STORE_ROOT
    export PLATFORM_AUTH_MODE
    export PLATFORM_DEV_ANON
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
    return 0
  fi
  rm -f "$FRONTEND_PID_FILE"

  if port_open "$FRONTEND_PUBLIC_HOST" "$FRONTEND_PORT"; then
    die "frontend port is already in use: $FRONTEND_PUBLIC_HOST:$FRONTEND_PORT"
  fi

  info "starting frontend on $FRONTEND_URL"
  (
    cd "$FRONTEND_DIR"
    use_node_version
    export VITE_API_BASE_URL="${VITE_API_BASE_URL:-/api}"
    export VITE_API_PROXY_TARGET="${VITE_API_PROXY_TARGET:-$BACKEND_URL}"
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

  if [[ -z "$pid" ]]; then
    rm -f "$pid_file"
    info "$label stopped"
    return 0
  fi

  if ! is_running "$pid"; then
    rm -f "$pid_file"
    info "$label stopped"
    return 0
  fi

  info "stopping $label pid $pid"
  kill "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true

  for _ in {1..20}; do
    if ! is_running "$pid"; then
      rm -f "$pid_file"
      info "$label stopped"
      return 0
    fi
    sleep 0.25
  done

  warn "$label pid $pid did not stop after TERM; sending KILL"
  kill -9 "-$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
  rm -f "$pid_file"
  info "$label stopped"
}

stop_matching_processes() {
  local label="$1"
  local needle="$2"
  local port_arg="$3"
  local pid args

  while read -r pid args; do
    [[ "$pid" =~ ^[0-9]+$ ]] || continue
    [[ "$pid" != "$$" ]] || continue
    [[ "$args" == *"$needle"* ]] || continue
    [[ "$args" == *"$port_arg"* ]] || continue

    info "stopping residual $label pid $pid"
    kill "$pid" 2>/dev/null || true
    for _ in {1..20}; do
      if ! is_running "$pid"; then
        break
      fi
      sleep 0.25
    done
    if is_running "$pid"; then
      warn "residual $label pid $pid did not stop after TERM; sending KILL"
      kill -9 "$pid" 2>/dev/null || true
    fi
  done < <(ps -eo pid=,args=)
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
  stop_matching_processes frontend "$FRONTEND_DIR/node_modules/.bin/vite" "--port $FRONTEND_PORT"
  stop_process backend "$BACKEND_PID_FILE"
  stop_matching_processes backend "urban_violation_backend.app:app" "--port $BACKEND_PORT"
  rm -f "$STACK_ENV_FILE"
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

status_stack() {
  load_stack_env
  status_one backend "$BACKEND_PID_FILE" "$BACKEND_URL"
  status_one frontend "$FRONTEND_PID_FILE" "$FRONTEND_URL"
}

show_logs() {
  local target="${1:-all}"
  case "$target" in
    backend)
      tail_log backend "$BACKEND_LOG"
      ;;
    frontend)
      tail_log frontend "$FRONTEND_LOG"
      ;;
    all)
      tail_log backend "$BACKEND_LOG"
      tail_log frontend "$FRONTEND_LOG"
      ;;
    *)
      usage
      die "unknown logs target: $target"
      ;;
  esac
}

command="${1:-}"
case "$command" in
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
  logs)
    show_logs "${2:-all}"
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
    die "unknown command: $command"
    ;;
esac

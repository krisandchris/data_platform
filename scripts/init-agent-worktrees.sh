#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PARENT_DIR="$(cd "$ROOT_DIR/.." && pwd)"

BACKEND_WORKTREE="${BACKEND_WORKTREE:-$PARENT_DIR/data_platform_backend_agent}"
FRONTEND_WORKTREE="${FRONTEND_WORKTREE:-$PARENT_DIR/data_platform_frontend_agent}"
INTEGRATION_WORKTREE="${INTEGRATION_WORKTREE:-$PARENT_DIR/data_platform_integration_agent}"

BACKEND_BRANCH="${BACKEND_BRANCH:-agent/backend-implementation}"
FRONTEND_BRANCH="${FRONTEND_BRANCH:-agent/frontend-implementation}"
INTEGRATION_BRANCH="${INTEGRATION_BRANCH:-agent/integration-testing}"

BASE_REF="${BASE_REF:-main}"
DATASET_SOURCE="${DATASET_SOURCE:-$ROOT_DIR/DATASET}"
INSTALL_DEPS="${INSTALL_DEPS:-0}"
SYNC_EXISTING="${SYNC_EXISTING:-1}"

usage() {
  cat <<'USAGE'
Usage:
  scripts/init-agent-worktrees.sh [init|status|sync]

Commands:
  init     Create missing backend/frontend/integration worktrees and DATASET links.
  status   Show expected worktree, branch, DATASET, and dependency state.
  sync     Fast-forward existing clean worktrees from main.

Environment:
  BACKEND_WORKTREE=../data_platform_backend_agent
  FRONTEND_WORKTREE=../data_platform_frontend_agent
  INTEGRATION_WORKTREE=../data_platform_integration_agent
  BACKEND_BRANCH=agent/backend-implementation
  FRONTEND_BRANCH=agent/frontend-implementation
  INTEGRATION_BRANCH=agent/integration-testing
  BASE_REF=main
  DATASET_SOURCE=./DATASET
  INSTALL_DEPS=1      Run uv sync and frontend npm ci in each worktree.
  SYNC_EXISTING=0     Do not fast-forward existing clean worktrees during init.
USAGE
}

info() {
  printf '[init-agent-worktrees] %s\n' "$*"
}

warn() {
  printf '[init-agent-worktrees] WARN: %s\n' "$*" >&2
}

die() {
  printf '[init-agent-worktrees] ERROR: %s\n' "$*" >&2
  exit 1
}

ensure_command() {
  local name="$1"
  command -v "$name" >/dev/null 2>&1 || die "Missing required command: $name"
}

is_clean() {
  local worktree="$1"
  [[ -z "$(git -C "$worktree" status --porcelain)" ]]
}

is_git_worktree() {
  local path="$1"
  git -C "$path" rev-parse --is-inside-work-tree >/dev/null 2>&1
}

current_branch() {
  local worktree="$1"
  git -C "$worktree" branch --show-current
}

ensure_base_ref() {
  git -C "$ROOT_DIR" rev-parse --verify "$BASE_REF" >/dev/null 2>&1 ||
    die "Base ref does not exist: $BASE_REF"
}

warn_main_dirty() {
  if ! is_clean "$ROOT_DIR"; then
    warn "Main workspace has local changes; new worktrees are still created from $BASE_REF."
  fi
}

create_or_reuse_worktree() {
  local label="$1"
  local path="$2"
  local branch="$3"

  if [[ -e "$path" ]] && ! is_git_worktree "$path"; then
    die "$label path exists but is not a git worktree: $path"
  fi

  if is_git_worktree "$path"; then
    info "$label worktree exists: $path ($(current_branch "$path"))"
    return 0
  fi

  if git -C "$ROOT_DIR" show-ref --verify --quiet "refs/heads/$branch"; then
    info "creating $label worktree from existing branch $branch"
    git -C "$ROOT_DIR" worktree add "$path" "$branch"
  else
    info "creating $label worktree from $BASE_REF on new branch $branch"
    git -C "$ROOT_DIR" worktree add -b "$branch" "$path" "$BASE_REF"
  fi
}

sync_worktree() {
  local label="$1"
  local path="$2"
  local branch="$3"

  is_git_worktree "$path" || die "$label worktree not found: $path"
  [[ "$(current_branch "$path")" == "$branch" ]] ||
    die "$label worktree is on $(current_branch "$path"), expected $branch"

  if ! is_clean "$path"; then
    warn "$label worktree has local changes; leaving it unsynced: $path"
    return 0
  fi

  info "fast-forwarding $label worktree from $BASE_REF"
  git -C "$path" merge --ff-only "$BASE_REF"
}

ensure_dataset_link() {
  local label="$1"
  local path="$2"
  local link="$path/DATASET"

  if [[ ! -e "$DATASET_SOURCE" ]]; then
    warn "DATASET source not found; skipping $label DATASET link: $DATASET_SOURCE"
    return 0
  fi

  if [[ -L "$link" ]]; then
    local target
    target="$(readlink "$link")"
    if [[ "$target" == "$DATASET_SOURCE" ]]; then
      info "$label DATASET link already points to $DATASET_SOURCE"
      return 0
    fi
    die "$label DATASET symlink points to $target, expected $DATASET_SOURCE"
  fi

  if [[ -e "$link" ]]; then
    die "$label DATASET exists and is not a symlink: $link"
  fi

  info "linking $label DATASET -> $DATASET_SOURCE"
  ln -s "$DATASET_SOURCE" "$link"
}

install_dependencies() {
  local label="$1"
  local path="$2"

  [[ "$INSTALL_DEPS" == "1" ]] || return 0

  ensure_command uv
  info "installing backend dependencies in $label worktree"
  git -C "$path" status --short >/dev/null
  (cd "$path" && uv sync)

  if [[ -f "$path/frontend/package-lock.json" ]]; then
    ensure_command npm
    info "installing frontend dependencies in $label worktree"
    (cd "$path/frontend" && npm ci)
  fi
}

show_one_status() {
  local label="$1"
  local path="$2"
  local branch="$3"
  local dataset="$path/DATASET"

  printf '%-12s path=%s\n' "$label" "$path"
  if is_git_worktree "$path"; then
    printf '%-12s branch=%s expected=%s\n' '' "$(current_branch "$path")" "$branch"
    printf '%-12s clean=%s\n' '' "$(is_clean "$path" && printf yes || printf no)"
  else
    printf '%-12s missing\n' ''
  fi

  if [[ -L "$dataset" ]]; then
    printf '%-12s DATASET -> %s\n' '' "$(readlink "$dataset")"
  elif [[ -e "$dataset" ]]; then
    printf '%-12s DATASET exists but is not a symlink\n' ''
  else
    printf '%-12s DATASET missing\n' ''
  fi

  if [[ -d "$path/.venv" ]]; then
    printf '%-12s python deps=.venv present\n' ''
  fi
  if [[ -d "$path/frontend/node_modules" ]]; then
    printf '%-12s frontend deps=node_modules present\n' ''
  fi
}

init_all() {
  ensure_command git
  ensure_base_ref
  warn_main_dirty

  create_or_reuse_worktree backend "$BACKEND_WORKTREE" "$BACKEND_BRANCH"
  create_or_reuse_worktree frontend "$FRONTEND_WORKTREE" "$FRONTEND_BRANCH"
  create_or_reuse_worktree integration "$INTEGRATION_WORKTREE" "$INTEGRATION_BRANCH"

  if [[ "$SYNC_EXISTING" == "1" ]]; then
    sync_worktree backend "$BACKEND_WORKTREE" "$BACKEND_BRANCH"
    sync_worktree frontend "$FRONTEND_WORKTREE" "$FRONTEND_BRANCH"
    sync_worktree integration "$INTEGRATION_WORKTREE" "$INTEGRATION_BRANCH"
  fi

  ensure_dataset_link backend "$BACKEND_WORKTREE"
  ensure_dataset_link frontend "$FRONTEND_WORKTREE"
  ensure_dataset_link integration "$INTEGRATION_WORKTREE"

  install_dependencies backend "$BACKEND_WORKTREE"
  install_dependencies frontend "$FRONTEND_WORKTREE"
  install_dependencies integration "$INTEGRATION_WORKTREE"

  info "initialized agent worktrees"
  status_all
}

sync_all() {
  ensure_command git
  ensure_base_ref
  sync_worktree backend "$BACKEND_WORKTREE" "$BACKEND_BRANCH"
  sync_worktree frontend "$FRONTEND_WORKTREE" "$FRONTEND_BRANCH"
  sync_worktree integration "$INTEGRATION_WORKTREE" "$INTEGRATION_BRANCH"
}

status_all() {
  show_one_status backend "$BACKEND_WORKTREE" "$BACKEND_BRANCH"
  show_one_status frontend "$FRONTEND_WORKTREE" "$FRONTEND_BRANCH"
  show_one_status integration "$INTEGRATION_WORKTREE" "$INTEGRATION_BRANCH"
}

command="${1:-init}"
case "$command" in
  init)
    init_all
    ;;
  status)
    status_all
    ;;
  sync)
    sync_all
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage
    die "unknown command: $command"
    ;;
esac

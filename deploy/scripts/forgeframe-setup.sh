#!/usr/bin/env bash
# forgeframe-setup.sh — Unified interactive installer for ForgeFrame.
#
# Usage:
#   forgeframe setup                  # Interactive mode selector
#   forgeframe setup --compose        # Skip mode picker, go straight to Docker Compose
#   forgeframe setup --host-native    # Skip mode picker, go straight to host-native
#   forgeframe setup --dev            # Skip mode picker, go straight to dev environment
#   forgeframe setup --limited        # Skip mode picker, go straight to limited exception
#   forgeframe setup --non-interactive --compose --fqdn ...  # CI/CD mode
#
# Dependencies: gum (auto-downloaded as prebuilt binary from GitHub releases),
#               existing ForgeFrame scripts under deploy/scripts/.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=./lib/forgeframe-env.sh
source "$ROOT_DIR/deploy/scripts/lib/forgeframe-env.sh"
FORGEFRAME_NULL_DEVICE="$(forgeframe_null_device)"

# ---- config ----
NON_INTERACTIVE="${FORGEFRAME_NON_INTERACTIVE:-0}"
MODE=""
SKIP_GUM=0
FF_VERSION="$(python3 -c "import json;print(json.load(open('$ROOT_DIR/frontend/package.json'))['version'])" 2>"$FORGEFRAME_NULL_DEVICE")" || FF_VERSION="unknown"

log()  { printf '[forgeframe-setup] %s\n' "$*" >&2; }
fail() { printf '[forgeframe-setup][ERROR] %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Usage: forgeframe setup [options]

Options:
  --compose             Docker Compose (production-like) deployment
  --host-native         Host-native (systemd, production) deployment
  --dev                 Dev environment (local development)
  --limited             Limited exception (file/SQLite storage)
  --non-interactive     Skip all interactive prompts (for CI/CD)
  --skip-gum            Skip gum availability check (already installed)
  --fqdn VALUE          Public FQDN (non-interactive mode)
  --acme-email VALUE    ACME operator email (non-interactive mode)
  --pg-password VALUE   PostgreSQL password (non-interactive mode)
  --help                Show this help

When no mode flag is given, the installer presents an interactive menu.
EOF
}

# ---- arg parsing ----
FQDN=""
ACME_EMAIL=""
PG_PASSWORD=""

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --compose)       MODE="compose"; shift ;;
    --host-native)   MODE="host-native"; shift ;;
    --dev)           MODE="dev"; shift ;;
    --limited)       MODE="limited"; shift ;;
    --non-interactive) NON_INTERACTIVE=1; shift ;;
    --skip-gum)      SKIP_GUM=1; shift ;;
    --fqdn)          FQDN="$2"; shift 2 ;;
    --acme-email)    ACME_EMAIL="$2"; shift 2 ;;
    --pg-password)   PG_PASSWORD="$2"; shift 2 ;;
    -h|--help)       usage; exit 0 ;;
    *)               fail "Unknown option: $1. Use --help for usage." ;;
  esac
done

# Auto-detect non-TTY environments (CI/CD, piped commands)
if [[ "$NON_INTERACTIVE" != "1" && ! -t 0 ]]; then
  log "Not a TTY — switching to non-interactive mode."
  NON_INTERACTIVE=1
fi

# ---- gum check ----
if [[ "$SKIP_GUM" != "1" && "$NON_INTERACTIVE" != "1" ]]; then
  forgeframe_ensure_gum || fail "Gum is required for the interactive installer. Install it manually or use --non-interactive."
fi

gum_style() {
  [[ "$NON_INTERACTIVE" == "1" ]] && return 0
  gum style "$@"
}

gum_choose() {
  [[ "$NON_INTERACTIVE" == "1" ]] && return 0
  gum choose \
    --cursor.foreground "$FF_CYAN" \
    --selected.foreground "$FF_CYAN" \
    --item.foreground 251 \
    --header.foreground "$FF_AMBER" \
    "$@"
}

gum_confirm() {
  [[ "$NON_INTERACTIVE" == "1" ]] && return 0
  gum confirm \
    --prompt.foreground "$FF_CYAN" \
    --selected.foreground "$FF_GREEN" \
    --unselected.foreground 243 \
    "$@"
}

gum_input() {
  [[ "$NON_INTERACTIVE" == "1" ]] && return 0
  gum input \
    --prompt.foreground "$FF_CYAN" \
    --cursor.foreground "$FF_CYAN" \
    "$@"
}

gum_spin() {
  local title="$1"; shift
  if [[ "$NON_INTERACTIVE" == "1" ]]; then
    log "Running: $*"
    "$@"
    return $?
  fi
  gum spin --spinner dot --title "$title" -- "$@"
}

# ---- welcome header ----
FF_CYAN=37
FF_GREEN=42
FF_AMBER=214

if [[ "$NON_INTERACTIVE" != "1" ]]; then
  gum_style \
    --foreground "$FF_CYAN" --border-foreground "$FF_CYAN" --border double \
    --align center --width 60 --padding "1 2" \
    "ForgeFrame Setup" "v${FF_VERSION}"
fi

# ---- mode selection ----
if [[ -z "$MODE" ]]; then
  if [[ "$NON_INTERACTIVE" == "1" ]]; then
    fail "A mode flag (--compose, --host-native, --dev, or --limited) is required in non-interactive mode."
  fi
  selected=$(gum_choose \
    --header "Select deployment method:" \
    "Docker Compose (production-like)" \
    "Host-native (systemd, production)" \
    "Dev environment (local development)" \
    "Limited exception (file/SQLite storage)")
  case "$selected" in
    Docker*)  MODE="compose" ;;
    Host*)    MODE="host-native" ;;
    Dev*)     MODE="dev" ;;
    Limited*) MODE="limited" ;;
    *)        fail "Unknown selection: $selected" ;;
  esac
fi

log "Selected mode: $MODE"

# ================================================================
#  MODE: Docker Compose
# ================================================================
setup_compose() {
  gum_style --foreground "$FF_CYAN" "Docker Compose Setup"

  FORGEFRAME_PUBLIC_FQDN="${FQDN:-$(gum_input --placeholder "forgeframe.example.com" --value "${FORGEFRAME_PUBLIC_FQDN:-}")}"
  FORGEFRAME_PUBLIC_TLS_ACME_EMAIL="${ACME_EMAIL:-$(gum_input --placeholder "admin@example.com" --value "${FORGEFRAME_PUBLIC_TLS_ACME_EMAIL:-}")}"

  local tls_enabled=1
  if [[ "$NON_INTERACTIVE" != "1" ]]; then
    gum_confirm "Expose on public HTTPS (80/443)?" || tls_enabled=0
  fi

  local configure_ollama=0
  if [[ "$NON_INTERACTIVE" != "1" ]]; then
    gum_confirm "Configure Ollama endpoint?" && configure_ollama=1
  fi

  if [[ "$configure_ollama" == "1" ]]; then
    local ollama_url
    ollama_url="$(gum_input --placeholder "http://127.0.0.1:11434/v1" --value "${FORGEFRAME_OLLAMA_BASE_URL:-http://127.0.0.1:11434/v1}")"
    export FORGEFRAME_OLLAMA_BASE_URL="$ollama_url"
  fi

  # PG settings
  local pg_password="${PG_PASSWORD:-}"
  if [[ -z "$pg_password" && "$NON_INTERACTIVE" != "1" ]]; then
    pg_password="$(gum_input --password --placeholder "postgres password (blank = auto-generate)")"
  fi
  if [[ -n "$pg_password" ]]; then
    export FORGEFRAME_PG_PASSWORD="$pg_password"
  fi

  export FORGEFRAME_PUBLIC_FQDN
  export FORGEFRAME_PUBLIC_TLS_ACME_EMAIL

  gum_spin "Starting Docker Compose..." \
    bash "$ROOT_DIR/deploy/scripts/bootstrap-compose-forgeframe.sh"
}

# ================================================================
#  MODE: Host-native (systemd)
# ================================================================
setup_host_native() {
  gum_style --foreground "$FF_CYAN" "Host-Native (systemd) Setup"

  FORGEFRAME_PUBLIC_FQDN="${FQDN:-$(gum_input --placeholder "forgeframe.example.com" --value "${FORGEFRAME_PUBLIC_FQDN:-}")}"
  FORGEFRAME_PUBLIC_TLS_ACME_EMAIL="${ACME_EMAIL:-$(gum_input --placeholder "admin@example.com" --value "${FORGEFRAME_PUBLIC_TLS_ACME_EMAIL:-}")}"

  local admin_username
  admin_username="$(gum_input --placeholder "admin" --value "${FORGEFRAME_BOOTSTRAP_ADMIN_USERNAME:-admin}")"
  local admin_password=""
  if [[ "$NON_INTERACTIVE" != "1" ]]; then
    admin_password="$(gum_input --password --placeholder "admin password (blank = auto-generate)")"
  fi

  local pg_mode
  if [[ "$NON_INTERACTIVE" == "1" ]]; then
    pg_mode="${FORGEFRAME_PG_MODE:-native}"
  else
    pg_mode=$(gum_choose --header "PostgreSQL mode:" "native" "existing" "docker")
    # Make the file mode explicitly gate-able — only when --limited is passed separately
  fi

  local pg_password="${PG_PASSWORD:-}"
  if [[ -z "$pg_password" && "$NON_INTERACTIVE" != "1" ]]; then
    pg_password="$(gum_input --password --placeholder "postgres password (blank = auto-generate)")"
  fi

  # Export env vars for install-forgeframe.sh --guided
  export FORGEFRAME_NON_INTERACTIVE=1
  export FORGEFRAME_PUBLIC_FQDN
  export FORGEFRAME_PUBLIC_TLS_ACME_EMAIL
  export FORGEFRAME_BOOTSTRAP_ADMIN_USERNAME="$admin_username"
  [[ -n "$admin_password" ]] && export FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD="$admin_password"
  export FORGEFRAME_PG_MODE="$pg_mode"
  [[ -n "$pg_password" ]] && export FORGEFRAME_PG_PASSWORD="$pg_password"

  gum_spin "Running host-native installer..." \
    bash "$ROOT_DIR/deploy/scripts/install-forgeframe.sh" --guided
}

# ================================================================
#  MODE: Dev environment
# ================================================================
setup_dev() {
  gum_style --foreground "$FF_CYAN" "Dev Environment Setup"

  local python_bin="${FORGEFRAME_PYTHON_BIN:-$(command -v python3)}"
  local backend_port="${FORGEFRAME_DEV_BACKEND_PORT:-8000}"
  local frontend_port="${FORGEFRAME_DEV_FRONTEND_PORT:-5173}"
  local SKIP_BACKEND=0 SKIP_FRONTEND=0

  if [[ "$NON_INTERACTIVE" != "1" ]]; then
    gum_confirm "Set up backend virtualenv?" || { log "Skipping backend setup."; SKIP_BACKEND=1; }
    gum_confirm "Set up frontend dependencies?" || { log "Skipping frontend setup."; SKIP_FRONTEND=1; }
  fi

  # Backend venv
  if [[ "${SKIP_BACKEND:-0}" != "1" ]]; then
    gum_spin "Creating virtualenv..." \
      "$python_bin" -m venv "$ROOT_DIR/.venv"
    gum_spin "Installing backend dependencies..." \
      bash -c "cd '$ROOT_DIR/backend' && '$ROOT_DIR/.venv/bin/pip' install -e '.[dev]'"
  fi

  # Frontend deps
  if [[ "${SKIP_FRONTEND:-0}" != "1" ]]; then
    gum_spin "Installing frontend dependencies..." \
      bash -c "cd '$ROOT_DIR/frontend' && npm install"
  fi

  # UX Review Mode
  if [[ "$NON_INTERACTIVE" != "1" ]]; then
    if gum_confirm "Enable UX Review Mode (dev-only inspection overlay)?"; then
      if ! grep -qxF 'VITE_ENABLE_UX_REVIEW=true' "$ROOT_DIR/frontend/.env" 2>/dev/null; then
        echo "VITE_ENABLE_UX_REVIEW=true" >> "$ROOT_DIR/frontend/.env"
      fi
      log "UX Review Mode enabled in frontend/.env"
    fi
  elif [[ "${FORGEFRAME_ENABLE_UX_REVIEW:-0}" == "1" ]]; then
    if ! grep -qxF 'VITE_ENABLE_UX_REVIEW=true' "$ROOT_DIR/frontend/.env" 2>/dev/null; then
      echo "VITE_ENABLE_UX_REVIEW=true" >> "$ROOT_DIR/frontend/.env"
    fi
    log "UX Review Mode enabled in frontend/.env"
  fi

  gum_style --foreground "$FF_GREEN" "Dev environment ready!"
  gum_style --foreground "$FF_AMBER" "Run:"
  gum_style "  ./deploy/scripts/dev-backend.sh   (API on :${backend_port})"
  gum_style "  ./deploy/scripts/dev-frontend.sh  (Vite on :${frontend_port})"
}

# ================================================================
#  MODE: Limited exception (file/SQLite)
# ================================================================
setup_limited() {
  gum_style --foreground "$FF_CYAN" "Limited Exception (file/SQLite) Setup"

  if [[ "$NON_INTERACTIVE" != "1" ]]; then
    gum_confirm "Limited exception mode uses file/SQLite storage. Not for production. Continue?" || exit 1
  fi

  gum_spin "Setting up limited exception..." \
    bash "$ROOT_DIR/deploy/scripts/install-forgeframe.sh" --allow-file-storage --skip-system-deps --skip-systemctl
}

# ================================================================
#  DISPATCH
# ================================================================
case "$MODE" in
  compose)      setup_compose ;;
  host-native)  setup_host_native ;;
  dev)          setup_dev ;;
  limited)      setup_limited ;;
  *)            fail "Unknown mode: $MODE" ;;
esac

# ---- post-install summary ----
if [[ "$MODE" != "dev" && "$NON_INTERACTIVE" != "1" ]]; then
  printf '\n'
  gum_style \
    --foreground "$FF_CYAN" --border-foreground "$FF_CYAN" --border rounded \
    --align center --width 60 --padding "1 2" \
    "ForgeFrame Setup Complete" "v${FF_VERSION}"

  case "$MODE" in
    compose)
      gum format -- "- Frontend: http://127.0.0.1:${FORGEFRAME_APP_PORT:-8000}/app/"
      gum format -- "- API base: http://127.0.0.1:${FORGEFRAME_APP_PORT:-8000}/v1"
      ;;
    host-native)
      gum format -- "- Frontend: https://${FORGEFRAME_PUBLIC_FQDN:-<your-fqdn>}/"
      gum format -- "- Admin user: ${FORGEFRAME_BOOTSTRAP_ADMIN_USERNAME:-admin}"
      gum format -- "- Env file: ${FORGEFRAME_ENV_FILE:-/etc/forgeframe/forgeframe.env}"
      ;;
    limited)
      gum format -- "- Limited file/SQLite runtime: ./deploy/scripts/start-forgeframe.sh"
      gum format -- "- Not suitable for production workloads."
      ;;
  esac

  gum format -- '---'
  gum format -- "See **docs/** for operational guides and the frontend UI documentation."
fi

log "ForgeFrame setup (${MODE}) completed successfully."

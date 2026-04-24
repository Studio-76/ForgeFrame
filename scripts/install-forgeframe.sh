#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST_ENV_EXAMPLE="$ROOT_DIR/deploy/env/forgeframe-host.env.example"
SYSTEMD_TEMPLATE_DIR="$ROOT_DIR/deploy/systemd"

INSTALL_ROOT="${FORGEFRAME_INSTALL_ROOT:-$ROOT_DIR}"
CONFIG_DIR="${FORGEFRAME_CONFIG_DIR:-/etc/forgeframe}"
STATE_DIR="${FORGEFRAME_STATE_DIR:-/var/lib/forgeframe}"
LOG_DIR="${FORGEFRAME_LOG_DIR:-/var/log/forgeframe}"
UNIT_DIR="${FORGEFRAME_SYSTEMD_UNIT_DIR:-/etc/systemd/system}"
ENV_FILE="${FORGEFRAME_ENV_FILE:-$CONFIG_DIR/forgeframe.env}"
SYSTEM_USER="${FORGEFRAME_SYSTEM_USER:-forgeframe}"
SYSTEM_GROUP="${FORGEFRAME_SYSTEM_GROUP:-forgeframe}"
SKIP_PYTHON_ENV="${FORGEFRAME_INSTALL_SKIP_PYTHON_ENV:-0}"
SKIP_FRONTEND_BUILD="${FORGEFRAME_INSTALL_SKIP_FRONTEND_BUILD:-0}"
SKIP_SYSTEMCTL="${FORGEFRAME_INSTALL_SKIP_SYSTEMCTL:-0}"
DRY_RUN=0

log() { printf '[forgeframe-install] %s\n' "$*"; }
fail() { printf '[forgeframe-install][ERROR] %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Usage: scripts/install-forgeframe.sh [options]

Options:
  --install-root PATH   Override the ForgeFrame working tree used by systemd.
  --config-dir PATH     Override the directory that stores forgeframe.env.
  --state-dir PATH      Override the state directory for ForgeFrame runtime data.
  --log-dir PATH        Override the log directory.
  --unit-dir PATH       Override the systemd unit installation directory.
  --env-file PATH       Override the installed host-native environment file path.
  --system-user NAME    Override the runtime system user.
  --system-group NAME   Override the runtime system group.
  --dry-run             Print the planned host-native installation without changing the host.
  --skip-python-env     Skip venv creation and backend dependency installation.
  --skip-frontend-build Skip frontend build installation checks.
  --skip-systemctl      Skip daemon-reload after installing systemd units.
EOF
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --install-root)
      INSTALL_ROOT="$2"
      shift 2
      ;;
    --config-dir)
      CONFIG_DIR="$2"
      shift 2
      ;;
    --state-dir)
      STATE_DIR="$2"
      shift 2
      ;;
    --log-dir)
      LOG_DIR="$2"
      shift 2
      ;;
    --unit-dir)
      UNIT_DIR="$2"
      shift 2
      ;;
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --system-user)
      SYSTEM_USER="$2"
      shift 2
      ;;
    --system-group)
      SYSTEM_GROUP="$2"
      shift 2
      ;;
    --skip-python-env)
      SKIP_PYTHON_ENV=1
      shift
      ;;
    --skip-frontend-build)
      SKIP_FRONTEND_BUILD=1
      shift
      ;;
    --skip-systemctl)
      SKIP_SYSTEMCTL=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown option: $1"
      ;;
  esac
done

[[ "$(uname -s)" == "Linux" ]] || fail "Host-native installation is only supported on Linux."
command -v python3 >/dev/null 2>&1 || fail "python3 is required."

INSTALL_ROOT="$(python3 -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).expanduser().resolve())' "$INSTALL_ROOT")"
CONFIG_DIR="$(python3 -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).expanduser().resolve())' "$CONFIG_DIR")"
STATE_DIR="$(python3 -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).expanduser().resolve())' "$STATE_DIR")"
LOG_DIR="$(python3 -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).expanduser().resolve())' "$LOG_DIR")"
UNIT_DIR="$(python3 -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).expanduser().resolve())' "$UNIT_DIR")"
ENV_FILE="$(python3 -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).expanduser().resolve())' "$ENV_FILE")"

if [[ "$DRY_RUN" == "1" ]]; then
  log "dry_run install_root=$INSTALL_ROOT config_dir=$CONFIG_DIR state_dir=$STATE_DIR log_dir=$LOG_DIR unit_dir=$UNIT_DIR env_file=$ENV_FILE user=$SYSTEM_USER group=$SYSTEM_GROUP"
  exit 0
fi

[[ -f "$HOST_ENV_EXAMPLE" ]] || fail "Missing host-native environment example: $HOST_ENV_EXAMPLE"
[[ -d "$SYSTEMD_TEMPLATE_DIR" ]] || fail "Missing systemd template directory: $SYSTEMD_TEMPLATE_DIR"

mkdir -p "$CONFIG_DIR" "$STATE_DIR" "$LOG_DIR" "$UNIT_DIR"
mkdir -p "$INSTALL_ROOT/backend/.forgeframe"
mkdir -p "$STATE_DIR/acme-webroot" "$STATE_DIR/tls" "$CONFIG_DIR/tls/live"

if [[ "$(id -u)" -eq 0 ]]; then
  if ! getent group "$SYSTEM_GROUP" >/dev/null 2>&1; then
    groupadd --system "$SYSTEM_GROUP"
    log "Created system group $SYSTEM_GROUP"
  fi
  if ! id -u "$SYSTEM_USER" >/dev/null 2>&1; then
    useradd --system --gid "$SYSTEM_GROUP" --home-dir "$STATE_DIR" --shell /usr/sbin/nologin "$SYSTEM_USER"
    log "Created system user $SYSTEM_USER"
  fi
  chown -R "$SYSTEM_USER:$SYSTEM_GROUP" "$STATE_DIR" "$LOG_DIR" "$INSTALL_ROOT/backend/.forgeframe"
else
  log "Running without root; using existing user/group ownership and skipping system user creation."
  SYSTEM_USER="$(id -un)"
  SYSTEM_GROUP="$(id -gn)"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$HOST_ENV_EXAMPLE" "$ENV_FILE"
  log "Installed host-native environment template at $ENV_FILE"
fi

python3 - "$ENV_FILE" "$INSTALL_ROOT" "$CONFIG_DIR" "$STATE_DIR" <<'PY'
import secrets
import sys
from pathlib import Path

env_path = Path(sys.argv[1])
install_root = sys.argv[2]
config_dir = sys.argv[3]
state_dir = sys.argv[4]

lines = env_path.read_text(encoding="utf-8").splitlines()
entries: dict[str, str] = {}
positions: dict[str, int] = {}
for index, line in enumerate(lines):
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in line:
        continue
    key, _, raw_value = line.partition("=")
    entries[key.strip()] = raw_value.strip()
    positions[key.strip()] = index

def set_or_add(key: str, value: str) -> None:
    rendered = f"{key}={value}"
    if key in positions:
        lines[positions[key]] = rendered
    else:
        positions[key] = len(lines)
        lines.append(rendered)
    entries[key] = value

pg_password = entries.get("FORGEFRAME_POSTGRES_URL", "")
if "replace-with-a-generated-postgres-password" in pg_password or "replace-with-postgresql-url" in pg_password or not pg_password:
    generated = f"fg-pg-{secrets.token_urlsafe(18)}"
    base_url = f"postgresql://forgeframe:{generated}@127.0.0.1:5432/forgeframe"
else:
    base_url = entries["FORGEFRAME_POSTGRES_URL"]

bootstrap_password = entries.get("FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD", "")
if bootstrap_password in {"", "replace-with-a-generated-bootstrap-password", "forgeframe-admin", "forgegate-admin"}:
    bootstrap_password = f"fg-admin-{secrets.token_urlsafe(18)}"

set_or_add("FORGEFRAME_HOST", entries.get("FORGEFRAME_HOST", "127.0.0.1") or "127.0.0.1")
set_or_add("FORGEFRAME_PORT", entries.get("FORGEFRAME_PORT", "8080") or "8080")
set_or_add("FORGEFRAME_FRONTEND_DIST_PATH", f"{install_root}/frontend/dist")
set_or_add(
    "FORGEFRAME_PUBLIC_FQDN",
    entries.get("FORGEFRAME_PUBLIC_FQDN", "replace-with-public-fqdn.example.invalid")
    or "replace-with-public-fqdn.example.invalid",
)
set_or_add("FORGEFRAME_PUBLIC_HTTPS_HOST", entries.get("FORGEFRAME_PUBLIC_HTTPS_HOST", "0.0.0.0") or "0.0.0.0")
set_or_add("FORGEFRAME_PUBLIC_HTTPS_PORT", entries.get("FORGEFRAME_PUBLIC_HTTPS_PORT", "443") or "443")
set_or_add("FORGEFRAME_PUBLIC_HTTP_HELPER_HOST", entries.get("FORGEFRAME_PUBLIC_HTTP_HELPER_HOST", "0.0.0.0") or "0.0.0.0")
set_or_add("FORGEFRAME_PUBLIC_HTTP_HELPER_PORT", entries.get("FORGEFRAME_PUBLIC_HTTP_HELPER_PORT", "80") or "80")
set_or_add("FORGEFRAME_PUBLIC_ADMIN_BASE", entries.get("FORGEFRAME_PUBLIC_ADMIN_BASE", "/admin") or "/admin")
set_or_add("FORGEFRAME_PUBLIC_TLS_MODE", entries.get("FORGEFRAME_PUBLIC_TLS_MODE", "integrated_acme") or "integrated_acme")
set_or_add("FORGEFRAME_PUBLIC_TLS_CERT_PATH", entries.get("FORGEFRAME_PUBLIC_TLS_CERT_PATH", f"{config_dir}/tls/live/fullchain.pem") or f"{config_dir}/tls/live/fullchain.pem")
set_or_add("FORGEFRAME_PUBLIC_TLS_KEY_PATH", entries.get("FORGEFRAME_PUBLIC_TLS_KEY_PATH", f"{config_dir}/tls/live/privkey.pem") or f"{config_dir}/tls/live/privkey.pem")
set_or_add("FORGEFRAME_PUBLIC_TLS_WEBROOT_PATH", entries.get("FORGEFRAME_PUBLIC_TLS_WEBROOT_PATH", f"{state_dir}/acme-webroot") or f"{state_dir}/acme-webroot")
set_or_add("FORGEFRAME_PUBLIC_TLS_STATE_PATH", entries.get("FORGEFRAME_PUBLIC_TLS_STATE_PATH", f"{state_dir}/tls") or f"{state_dir}/tls")
set_or_add("FORGEFRAME_PUBLIC_TLS_LAST_ERROR_PATH", entries.get("FORGEFRAME_PUBLIC_TLS_LAST_ERROR_PATH", f"{state_dir}/tls/last_error.txt") or f"{state_dir}/tls/last_error.txt")
set_or_add("FORGEFRAME_PUBLIC_TLS_RENEWAL_WINDOW_DAYS", entries.get("FORGEFRAME_PUBLIC_TLS_RENEWAL_WINDOW_DAYS", "30") or "30")
set_or_add(
    "FORGEFRAME_PUBLIC_TLS_ACME_EMAIL",
    entries.get("FORGEFRAME_PUBLIC_TLS_ACME_EMAIL", "replace-with-acme-email@example.invalid")
    or "replace-with-acme-email@example.invalid",
)
set_or_add("FORGEFRAME_PUBLIC_TLS_ACME_DIRECTORY_URL", entries.get("FORGEFRAME_PUBLIC_TLS_ACME_DIRECTORY_URL", "https://acme-v02.api.letsencrypt.org/directory") or "https://acme-v02.api.letsencrypt.org/directory")
set_or_add("FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD", bootstrap_password)
set_or_add("FORGEFRAME_POSTGRES_URL", base_url)
for key in (
    "FORGEFRAME_HARNESS_POSTGRES_URL",
    "FORGEFRAME_CONTROL_PLANE_POSTGRES_URL",
    "FORGEFRAME_OBSERVABILITY_POSTGRES_URL",
    "FORGEFRAME_GOVERNANCE_POSTGRES_URL",
    "FORGEFRAME_INSTANCES_POSTGRES_URL",
    "FORGEFRAME_EXECUTION_POSTGRES_URL",
):
    set_or_add(key, entries.get(key, "") or base_url)
set_or_add("FORGEFRAME_OLLAMA_BASE_URL", entries.get("FORGEFRAME_OLLAMA_BASE_URL", "http://127.0.0.1:11434/v1") or "http://127.0.0.1:11434/v1")
set_or_add("FORGEFRAME_EXECUTION_WORKER_INSTANCE_ID", entries.get("FORGEFRAME_EXECUTION_WORKER_INSTANCE_ID", "") or "")
set_or_add("FORGEFRAME_EXECUTION_WORKER_COMPANY_ID", entries.get("FORGEFRAME_EXECUTION_WORKER_COMPANY_ID", "") or "")
set_or_add("FORGEFRAME_EXECUTION_WORKER_KEY", entries.get("FORGEFRAME_EXECUTION_WORKER_KEY", "forgeframe-worker") or "forgeframe-worker")
set_or_add("FORGEFRAME_EXECUTION_WORKER_EXECUTION_LANE", entries.get("FORGEFRAME_EXECUTION_WORKER_EXECUTION_LANE", "background_agentic") or "background_agentic")
set_or_add("FORGEFRAME_EXECUTION_WORKER_RUN_KIND", entries.get("FORGEFRAME_EXECUTION_WORKER_RUN_KIND", "responses_background") or "responses_background")
set_or_add("FORGEFRAME_EXECUTION_WORKER_POLL_INTERVAL_SECONDS", entries.get("FORGEFRAME_EXECUTION_WORKER_POLL_INTERVAL_SECONDS", "2") or "2")
set_or_add("FORGEFRAME_EXECUTION_WORKER_LEASE_TTL_SECONDS", entries.get("FORGEFRAME_EXECUTION_WORKER_LEASE_TTL_SECONDS", "300") or "300")
set_or_add("FORGEFRAME_EXECUTION_WORKER_HEARTBEAT_TTL_SECONDS", entries.get("FORGEFRAME_EXECUTION_WORKER_HEARTBEAT_TTL_SECONDS", "360") or "360")

env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
PY

if [[ "$SKIP_PYTHON_ENV" != "1" ]]; then
  if [[ ! -d "$INSTALL_ROOT/.venv" ]]; then
    python3 -m venv "$INSTALL_ROOT/.venv"
    log "Created virtual environment at $INSTALL_ROOT/.venv"
  fi
  "$INSTALL_ROOT/.venv/bin/pip" install --upgrade pip >/dev/null
  "$INSTALL_ROOT/.venv/bin/pip" install -e "$INSTALL_ROOT/backend" >/dev/null
  log "Installed backend dependencies into $INSTALL_ROOT/.venv"
fi

if [[ "$SKIP_FRONTEND_BUILD" != "1" ]]; then
  if [[ ! -f "$INSTALL_ROOT/frontend/dist/index.html" ]]; then
    command -v npm >/dev/null 2>&1 || fail "npm is required to build the frontend dist."
    (cd "$INSTALL_ROOT/frontend" && npm ci >/dev/null && npm run build >/dev/null)
    log "Built frontend dist into $INSTALL_ROOT/frontend/dist"
  else
    log "Using existing frontend dist at $INSTALL_ROOT/frontend/dist"
  fi
fi

for template in "$SYSTEMD_TEMPLATE_DIR"/*.service "$SYSTEMD_TEMPLATE_DIR"/*.timer; do
  [[ -f "$template" ]] || continue
  target="$UNIT_DIR/$(basename "$template")"
  sed \
    -e "s#@@INSTALL_ROOT@@#$INSTALL_ROOT#g" \
    -e "s#@@ENV_FILE@@#$ENV_FILE#g" \
    -e "s#@@STATE_DIR@@#$STATE_DIR#g" \
    -e "s#@@LOG_DIR@@#$LOG_DIR#g" \
    -e "s#@@SYSTEM_USER@@#$SYSTEM_USER#g" \
    -e "s#@@SYSTEM_GROUP@@#$SYSTEM_GROUP#g" \
    "$template" >"$target"
  log "Installed $(basename "$template") to $target"
done

if [[ "$SKIP_SYSTEMCTL" != "1" ]]; then
  command -v systemctl >/dev/null 2>&1 || fail "systemctl is required for the normative host-native install path."
  systemctl daemon-reload
  log "Ran systemctl daemon-reload"
fi

log "Host-native installation artifacts are ready."
log "Internal runtime path: systemctl enable --now forgeframe-api.service forgeframe-worker.service forgeframe-retention.timer"
log "Public runtime path: replace FORGEFRAME_PUBLIC_FQDN and FORGEFRAME_PUBLIC_TLS_ACME_EMAIL in $ENV_FILE, then enable forgeframe-http-helper.service, run scripts/renew-certificates.sh, and start forgeframe-public.service plus forgeframe-acme.timer"

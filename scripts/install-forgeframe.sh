#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=./lib/forgeframe-env.sh
source "$ROOT_DIR/scripts/lib/forgeframe-env.sh"

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
SKIP_SYSTEM_DEPS="${FORGEFRAME_INSTALL_SKIP_SYSTEM_DEPS:-0}"
SKIP_PYTHON_ENV="${FORGEFRAME_INSTALL_SKIP_PYTHON_ENV:-0}"
SKIP_FRONTEND_BUILD="${FORGEFRAME_INSTALL_SKIP_FRONTEND_BUILD:-0}"
SKIP_SYSTEMCTL="${FORGEFRAME_INSTALL_SKIP_SYSTEMCTL:-0}"
DRY_RUN=0
GUIDED=0
PORT_INCREMENT="${FORGEFRAME_INSTALL_PORT_INCREMENT:-10}"
APT_UPDATED=0
SELECTED_PYTHON_BIN="${FORGEFRAME_PYTHON_BIN:-}"

INSTALLER_PUBLIC_FQDN=""
INSTALLER_ACME_EMAIL=""
INSTALLER_ADMIN_USERNAME=""
INSTALLER_ADMIN_PASSWORD=""
INSTALLER_API_PORT=""
INSTALLER_PG_MODE=""
INSTALLER_PG_HOST=""
INSTALLER_PG_PORT=""
INSTALLER_PG_DB=""
INSTALLER_PG_USER=""
INSTALLER_PG_PASSWORD=""
INSTALLER_PG_CONTAINER_NAME=""
INSTALLER_PG_CLUSTER_NAME=""
INSTALLER_OLLAMA_BASE_URL=""

log() { printf '[forgeframe-install] %s\n' "$*"; }
fail() { printf '[forgeframe-install][ERROR] %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Usage: scripts/install-forgeframe.sh [options]

Options:
  --guided              Ask the operator for all login-critical host install values.
  --install-root PATH   Override the ForgeFrame working tree used by systemd.
  --config-dir PATH     Override the directory that stores forgeframe.env.
  --state-dir PATH      Override the state directory for ForgeFrame runtime data.
  --log-dir PATH        Override the log directory.
  --unit-dir PATH       Override the systemd unit installation directory.
  --env-file PATH       Override the installed host-native environment file path.
  --system-user NAME    Override the runtime system user.
  --system-group NAME   Override the runtime system group.
  --skip-system-deps    Do not install or upgrade missing host packages.
  --dry-run             Print the planned host-native installation without changing the host.
  --skip-python-env     Skip venv creation and backend dependency installation.
  --skip-frontend-build Skip frontend build installation checks.
  --skip-systemctl      Skip daemon-reload after installing systemd units.
EOF
}

require_root_for_system_packages() {
  [[ "$SKIP_SYSTEM_DEPS" == "1" ]] && return 0
  [[ "$(id -u)" -eq 0 ]] || fail "Installing missing system dependencies requires root. Re-run as root or pass --skip-system-deps."
}

apt_install_packages() {
  local packages=("$@")

  (( ${#packages[@]} > 0 )) || return 0
  [[ "$SKIP_SYSTEM_DEPS" == "1" ]] && return 0
  command -v apt-get >/dev/null 2>&1 || fail "Automatic system dependency installation currently supports apt-based Linux hosts only."
  require_root_for_system_packages
  if [[ "$APT_UPDATED" != "1" ]]; then
    DEBIAN_FRONTEND=noninteractive apt-get update >/dev/null
    APT_UPDATED=1
  fi
  DEBIAN_FRONTEND=noninteractive apt-get install -y "${packages[@]}" >/dev/null
}

apt_package_available() {
  command -v apt-cache >/dev/null 2>&1 || return 1
  apt-cache show "$1" >/dev/null 2>&1
}

ensure_bootstrap_python() {
  if command -v python3 >/dev/null 2>&1; then
    return 0
  fi
  apt_install_packages python3 python3-venv python3-pip
  command -v python3 >/dev/null 2>&1 || fail "python3 is required."
}

python_version_supported() {
  local python_bin="$1"

  "$python_bin" - <<'PY'
import sys

major, minor = sys.version_info[:2]
raise SystemExit(0 if (major, minor) >= (3, 11) else 1)
PY
}

python_major_minor() {
  local python_bin="$1"

  "$python_bin" - <<'PY'
import sys

major, minor = sys.version_info[:2]
print(f"{major}.{minor}")
PY
}

ensure_supported_python_runtime() {
  local candidate

  if [[ -n "$SELECTED_PYTHON_BIN" && -x "$SELECTED_PYTHON_BIN" ]] && python_version_supported "$SELECTED_PYTHON_BIN"; then
    return 0
  fi

  if command -v python3 >/dev/null 2>&1 && python_version_supported "$(command -v python3)"; then
    SELECTED_PYTHON_BIN="$(command -v python3)"
  fi
  if [[ -n "$SELECTED_PYTHON_BIN" ]]; then
    return 0
  fi

  for candidate in /usr/bin/python3.12 /usr/bin/python3.11 python3.12 python3.11; do
    if command -v "$candidate" >/dev/null 2>&1 && python_version_supported "$(command -v "$candidate")"; then
      SELECTED_PYTHON_BIN="$(command -v "$candidate")"
      return 0
    fi
  done

  if [[ "$SKIP_SYSTEM_DEPS" == "1" ]]; then
    fail "ForgeFrame requires Python 3.11 or newer on the target host. No compatible interpreter was found and --skip-system-deps forbids automatic installation."
  fi

  for candidate in python3.12 python3.11; do
    if apt_package_available "$candidate"; then
      apt_install_packages "$candidate"
      if apt_package_available "${candidate}-venv"; then
        apt_install_packages "${candidate}-venv"
      fi
      if command -v "$candidate" >/dev/null 2>&1 && python_version_supported "$(command -v "$candidate")"; then
        SELECTED_PYTHON_BIN="$(command -v "$candidate")"
        break
      fi
    fi
  done

  [[ -n "$SELECTED_PYTHON_BIN" ]] || fail "ForgeFrame requires Python 3.11 or newer on the target host."
}

ensure_python_venv_support() {
  local version
  local versioned_venv

  ensure_supported_python_runtime
  apt_install_packages python3-venv python3-pip
  version="$(python_major_minor "$SELECTED_PYTHON_BIN")"
  versioned_venv="python${version}-venv"
  if apt_package_available "$versioned_venv"; then
    apt_install_packages "$versioned_venv"
  fi
}

node_major_version() {
  node -p "process.versions.node.split('.')[0]"
}

ensure_nodejs_runtime() {
  local node_major=""

  if command -v node >/dev/null 2>&1; then
    node_major="$(node_major_version 2>/dev/null || true)"
  fi
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 && [[ "$node_major" =~ ^[0-9]+$ ]] && (( node_major >= 20 )); then
    return 0
  fi

  apt_install_packages ca-certificates curl gnupg
  require_root_for_system_packages
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  APT_UPDATED=0
  apt_install_packages nodejs

  node_major="$(node_major_version 2>/dev/null || true)"
  command -v npm >/dev/null 2>&1 || fail "npm is required after installing nodejs."
  [[ "$node_major" =~ ^[0-9]+$ ]] && (( node_major >= 20 )) || fail "ForgeFrame frontend build requires Node.js 20 or newer."
}

ensure_docker_runtime() {
  if ! command -v docker >/dev/null 2>&1; then
    apt_install_packages docker.io
  fi
  if command -v systemctl >/dev/null 2>&1 && ! docker info >/dev/null 2>&1; then
    systemctl enable --now docker >/dev/null 2>&1 || fail "docker is installed but could not be started."
  fi
  docker info >/dev/null 2>&1 || fail "docker is installed but the daemon is not reachable."
  command -v docker >/dev/null 2>&1 || fail "docker is required when PostgreSQL mode is 'docker'."
}

ensure_native_postgres_packages() {
  apt_install_packages postgresql postgresql-client postgresql-common
}

ensure_base_host_packages() {
  apt_install_packages curl ca-certificates openssl certbot postgresql-client
}

ensure_system_dependencies() {
  local pg_mode="${INSTALLER_PG_MODE:-${FORGEFRAME_PG_MODE:-native}}"

  if [[ "$SKIP_SYSTEM_DEPS" == "1" ]]; then
    ensure_supported_python_runtime
    return 0
  fi

  ensure_python_venv_support
  ensure_base_host_packages
  if [[ "$SKIP_FRONTEND_BUILD" != "1" ]]; then
    ensure_nodejs_runtime
  fi
  case "$pg_mode" in
    native)
      ensure_native_postgres_packages
      ;;
    docker)
      ensure_docker_runtime
      ;;
  esac
}

write_local_env_mirrors() {
  local mirror_paths=(
    "$INSTALL_ROOT/.env.host"
    "$INSTALL_ROOT/.env"
    "$INSTALL_ROOT/backend/.env"
  )
  local mirror_path

  [[ -f "$ENV_FILE" ]] || fail "Cannot mirror installer environment because $ENV_FILE does not exist."

  for mirror_path in "${mirror_paths[@]}"; do
    mkdir -p "$(dirname "$mirror_path")"
    cp "$ENV_FILE" "$mirror_path"
    chmod 600 "$mirror_path"
    if [[ "$(id -u)" -eq 0 ]]; then
      chown "$SYSTEM_USER:$SYSTEM_GROUP" "$mirror_path"
    fi
    log "Wrote ignored runtime env mirror $mirror_path"
  done
}

write_local_env_examples() {
  local example_paths=(
    "$INSTALL_ROOT/.env.host.example"
    "$INSTALL_ROOT/.env.example"
    "$INSTALL_ROOT/backend/.env.example"
  )
  local example_path

  [[ -f "$ENV_FILE" ]] || fail "Cannot render local env examples because $ENV_FILE does not exist."

  for example_path in "${example_paths[@]}"; do
    mkdir -p "$(dirname "$example_path")"
    python3 - "$ENV_FILE" "$example_path" <<'PY'
import sys
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit, urlunsplit

source_path = Path(sys.argv[1])
target_path = Path(sys.argv[2])
lines = source_path.read_text(encoding="utf-8").splitlines()

secret_placeholders = {
    "FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD": "replace-with-a-generated-bootstrap-password",
    "FORGEFRAME_PG_PASSWORD": "replace-with-a-generated-postgres-password",
    "FORGEFRAME_OPENAI_API_KEY": "replace-with-openai-api-key",
    "FORGEFRAME_OPENAI_CODEX_API_KEY": "replace-with-openai-codex-api-key",
    "FORGEFRAME_OPENAI_CODEX_OAUTH_ACCESS_TOKEN": "replace-with-openai-codex-oauth-access-token",
    "FORGEFRAME_GEMINI_API_KEY": "replace-with-gemini-api-key",
    "FORGEFRAME_GEMINI_OAUTH_ACCESS_TOKEN": "replace-with-gemini-oauth-access-token",
    "FORGEFRAME_ANTHROPIC_API_KEY": "replace-with-anthropic-api-key",
    "FORGEFRAME_ANTHROPIC_BEARER_TOKEN": "replace-with-anthropic-bearer-token",
    "FORGEFRAME_BEDROCK_ACCESS_KEY_ID": "replace-with-bedrock-access-key-id",
    "FORGEFRAME_BEDROCK_SECRET_ACCESS_KEY": "replace-with-bedrock-secret-access-key",
    "FORGEFRAME_BEDROCK_SESSION_TOKEN": "replace-with-bedrock-session-token",
    "FORGEFRAME_ANTIGRAVITY_OAUTH_ACCESS_TOKEN": "replace-with-antigravity-oauth-access-token",
    "FORGEFRAME_GITHUB_COPILOT_OAUTH_ACCESS_TOKEN": "replace-with-github-copilot-oauth-access-token",
    "FORGEFRAME_CLAUDE_CODE_OAUTH_ACCESS_TOKEN": "replace-with-claude-code-oauth-access-token",
    "FORGEFRAME_NOUS_OAUTH_ACCESS_TOKEN": "replace-with-nous-oauth-access-token",
    "FORGEFRAME_NOUS_OAUTH_RUNTIME_AGENT_KEY": "replace-with-nous-runtime-agent-key",
    "FORGEFRAME_QWEN_OAUTH_ACCESS_TOKEN": "replace-with-qwen-oauth-access-token",
}
postgres_url_keys = {
    "FORGEFRAME_POSTGRES_URL",
    "FORGEFRAME_HARNESS_POSTGRES_URL",
    "FORGEFRAME_CONTROL_PLANE_POSTGRES_URL",
    "FORGEFRAME_OBSERVABILITY_POSTGRES_URL",
    "FORGEFRAME_GOVERNANCE_POSTGRES_URL",
    "FORGEFRAME_INSTANCES_POSTGRES_URL",
    "FORGEFRAME_EXECUTION_POSTGRES_URL",
}


def scrub_postgres_url(value: str) -> str:
    stripped = value.strip().strip("'").strip('"')
    if not stripped:
        return "postgresql://forgeframe:replace-with-a-generated-postgres-password@127.0.0.1:5432/forgeframe"
    parts = urlsplit(stripped)
    username = unquote(parts.username) if parts.username else "forgeframe"
    password = "replace-with-a-generated-postgres-password"
    hostname = parts.hostname or "127.0.0.1"
    port = f":{parts.port}" if parts.port else ""
    netloc = f"{quote(username, safe='')}:{quote(password, safe='')}@{hostname}{port}"
    path = parts.path or "/forgeframe"
    return urlunsplit((parts.scheme or "postgresql", netloc, path, parts.query, parts.fragment))


updated_lines: list[str] = []
for raw_line in lines:
    line = raw_line.strip()
    if not line or line.startswith("#") or "=" not in raw_line:
      updated_lines.append(raw_line)
      continue

    key, _, raw_value = raw_line.partition("=")
    normalized_key = key.strip()
    value = raw_value.strip()
    if normalized_key in postgres_url_keys:
        value = scrub_postgres_url(value)
    elif normalized_key in secret_placeholders:
        value = secret_placeholders[normalized_key]
    updated_lines.append(f"{normalized_key}={value}")

target_path.write_text("\n".join(updated_lines) + "\n", encoding="utf-8")
PY
    chmod 644 "$example_path"
    if [[ "$(id -u)" -eq 0 ]]; then
      chown "$SYSTEM_USER:$SYSTEM_GROUP" "$example_path"
    fi
    log "Wrote local env example $example_path"
  done
}

require_valid_port() {
  local value="$1"
  local label="$2"

  [[ "$value" =~ ^[0-9]+$ ]] || fail "$label must be a numeric TCP port."
  (( value >= 1 && value <= 65535 )) || fail "$label must be between 1 and 65535."
}

port_listener_details() {
  local port="$1"

  if command -v ss >/dev/null 2>&1; then
    ss -ltnp "( sport = :${port} )" 2>/dev/null | tail -n +2 || true
    return 0
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
    return 0
  fi
  if command -v netstat >/dev/null 2>&1; then
    netstat -ltnp 2>/dev/null | awk -v target=":${port}" '$4 ~ target { print }' || true
    return 0
  fi
  python3 - "$port" <<'PY'
import socket
import sys

port = int(sys.argv[1])
families = [socket.AF_INET]
if socket.has_ipv6:
    families.append(socket.AF_INET6)

for family in families:
    sock = socket.socket(family, socket.SOCK_STREAM)
    sock.settimeout(0.2)
    host = "127.0.0.1" if family == socket.AF_INET else "::1"
    try:
        if sock.connect_ex((host, port)) == 0:
            print(f"listener:{host}:{port}")
            raise SystemExit(0)
    finally:
        sock.close()
PY
}

port_is_occupied() {
  local port="$1"
  [[ -n "$(port_listener_details "$port")" ]]
}

describe_port_listener() {
  local port="$1"
  local details

  details="$(port_listener_details "$port")"
  if [[ -n "$details" ]]; then
    printf '%s\n' "$details" | head -n 1
    return 0
  fi
  printf 'unknown listener on TCP/%s\n' "$port"
}

resolve_shifted_port() {
  local candidate="$1"
  local label="$2"

  require_valid_port "$candidate" "$label"
  require_valid_port "$PORT_INCREMENT" "FORGEFRAME_INSTALL_PORT_INCREMENT"

  while port_is_occupied "$candidate"; do
    local next_port=$((candidate + PORT_INCREMENT))
    (( next_port <= 65535 )) || fail "$label exceeded the TCP port range while applying the +${PORT_INCREMENT} collision policy."
    log "$label port $candidate is already occupied by $(describe_port_listener "$candidate"); switching to $next_port"
    candidate="$next_port"
  done

  printf '%s\n' "$candidate"
}

require_enforced_port() {
  local port="$1"
  local label="$2"

  require_valid_port "$port" "$label"
  if port_is_occupied "$port"; then
    fail "$label port $port is occupied by $(describe_port_listener "$port") and must remain fixed."
  fi
}

prompt_value() {
  local label="$1"
  local default_value="$2"
  local target_var="$3"
  local response

  if [[ -n "$default_value" ]]; then
    read -r -p "$label [$default_value]: " response
    response="${response:-$default_value}"
  else
    read -r -p "$label: " response
  fi

  printf -v "$target_var" '%s' "$response"
}

prompt_required() {
  local label="$1"
  local default_value="$2"
  local target_var="$3"

  while true; do
    prompt_value "$label" "$default_value" "$target_var"
    if [[ -n "${!target_var}" ]]; then
      return 0
    fi
    log "$label is required."
  done
}

prompt_secret_optional() {
  local label="$1"
  local target_var="$2"
  local response
  local confirm

  while true; do
    read -r -s -p "$label (leave blank to keep or auto-generate): " response
    printf '\n'
    if [[ -z "$response" ]]; then
      printf -v "$target_var" '%s' ""
      return 0
    fi
    read -r -s -p "Confirm $label: " confirm
    printf '\n'
    if [[ "$response" == "$confirm" ]]; then
      printf -v "$target_var" '%s' "$response"
      return 0
    fi
    log "$label values did not match."
  done
}

prompt_yes_no() {
  local label="$1"
  local default_value="$2"
  local target_var="$3"
  local response
  local normalized

  while true; do
    read -r -p "$label [$default_value]: " response
    response="${response:-$default_value}"
    normalized="$(printf '%s' "$response" | tr '[:upper:]' '[:lower:]')"
    case "$normalized" in
      y|yes)
        printf -v "$target_var" '%s' "1"
        return 0
        ;;
      n|no)
        printf -v "$target_var" '%s' "0"
        return 0
        ;;
    esac
    log "Please answer yes or no."
  done
}

prompt_postgres_mode() {
  local default_value="$1"
  local response
  local normalized

  while true; do
    read -r -p "PostgreSQL mode [native/existing/docker] [$default_value]: " response
    response="${response:-$default_value}"
    normalized="$(printf '%s' "$response" | tr '[:upper:]' '[:lower:]')"
    case "$normalized" in
      native|n|0)
        INSTALLER_PG_MODE="native"
        return 0
        ;;
      existing|e|1)
        INSTALLER_PG_MODE="existing"
        return 0
        ;;
      docker|d|2)
        INSTALLER_PG_MODE="docker"
        return 0
        ;;
    esac
    log "Choose 'native' for a Debian/Ubuntu-managed local PostgreSQL cluster, 'existing' for a reachable endpoint, or 'docker' for a dedicated local PostgreSQL container."
  done
}

wait_for_tcp_endpoint() {
  local host="$1"
  local port="$2"
  local attempts="$3"
  local label="$4"

  require_valid_port "$port" "$label"
  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if python3 - "$host" "$port" <<'PY'
import socket
import sys

host = sys.argv[1]
port = int(sys.argv[2])
families = [socket.AF_UNSPEC]

try:
    infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
except socket.gaierror:
    raise SystemExit(1)

for family, socktype, proto, _, sockaddr in infos:
    sock = socket.socket(family, socktype, proto)
    sock.settimeout(1.0)
    try:
        if sock.connect_ex(sockaddr) == 0:
            raise SystemExit(0)
    finally:
        sock.close()

raise SystemExit(1)
PY
    then
      return 0
    fi
    sleep 1
  done

  fail "$label did not become reachable on ${host}:${port}."
}

validate_pg_identifier() {
  local value="$1"
  local label="$2"

  [[ "$value" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || fail "$label '$value' is not a safe PostgreSQL identifier."
}

run_postgres_superuser() {
  if [[ "$(id -u)" -eq 0 ]]; then
    runuser -u postgres -- "$@"
    return 0
  fi
  if command -v sudo >/dev/null 2>&1; then
    sudo -u postgres "$@"
    return 0
  fi
  fail "Provisioning native PostgreSQL requires root or sudo access to the postgres system account."
}

detect_native_postgres_version() {
  local version=""

  if command -v pg_lsclusters >/dev/null 2>&1; then
    version="$(pg_lsclusters --no-header 2>/dev/null | awk 'NR==1 {print $1; exit}')"
  fi
  if [[ -z "$version" && -d /usr/lib/postgresql ]]; then
    version="$(find /usr/lib/postgresql -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null | sort -V | tail -n 1)"
  fi
  [[ -n "$version" ]] || fail "Unable to determine the installed PostgreSQL server version."
  printf '%s\n' "$version"
}

provision_native_postgres() {
  local version
  local cluster_name="$INSTALLER_PG_CLUSTER_NAME"
  local existing_line=""
  local existing_port=""

  validate_pg_identifier "$INSTALLER_PG_USER" "PostgreSQL role"
  validate_pg_identifier "$INSTALLER_PG_DB" "PostgreSQL database"
  [[ -n "$cluster_name" ]] || cluster_name="forgeframe"

  version="$(detect_native_postgres_version)"
  if command -v pg_lsclusters >/dev/null 2>&1; then
    existing_line="$(pg_lsclusters --no-header 2>/dev/null | awk -v name="$cluster_name" '$2 == name {print; exit}')"
  fi

  if [[ -n "$existing_line" ]]; then
    existing_port="$(awk '{print $3}' <<<"$existing_line")"
    if [[ "$existing_port" != "$INSTALLER_PG_PORT" ]]; then
      fail "Native PostgreSQL cluster '$cluster_name' already exists on port $existing_port, not the requested $INSTALLER_PG_PORT."
    fi
  else
    command -v pg_createcluster >/dev/null 2>&1 || fail "pg_createcluster is required to provision a native PostgreSQL cluster."
    pg_createcluster "$version" "$cluster_name" --port "$INSTALLER_PG_PORT" >/dev/null || fail "Failed to create PostgreSQL cluster '$cluster_name'."
  fi

  pg_ctlcluster "$version" "$cluster_name" start >/dev/null || fail "Failed to start PostgreSQL cluster '$cluster_name'."
  wait_for_tcp_endpoint "127.0.0.1" "$INSTALLER_PG_PORT" 60 "Native PostgreSQL cluster"

  run_postgres_superuser psql -d postgres -v ON_ERROR_STOP=1 -v ff_user="$INSTALLER_PG_USER" -v ff_password="$INSTALLER_PG_PASSWORD" <<'SQL' >/dev/null
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'ff_user') THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', :'ff_user', :'ff_password');
  ELSE
    EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'ff_user', :'ff_password');
  END IF;
END
$do$;
SQL

  run_postgres_superuser psql -d postgres -v ON_ERROR_STOP=1 -v ff_db="$INSTALLER_PG_DB" -v ff_user="$INSTALLER_PG_USER" <<'SQL' >/dev/null
SELECT format('CREATE DATABASE %I OWNER %I', :'ff_db', :'ff_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'ff_db') \gexec
SQL

  log "Provisioned native PostgreSQL cluster $cluster_name on 127.0.0.1:$INSTALLER_PG_PORT"
}

provision_managed_postgres() {
  local container_name="$INSTALLER_PG_CONTAINER_NAME"
  local host_port="$INSTALLER_PG_PORT"
  local data_dir="$STATE_DIR/postgres"
  local mapped_port

  command -v docker >/dev/null 2>&1 || fail "docker is required when PostgreSQL mode is 'docker'."
  mkdir -p "$data_dir"

  if docker inspect "$container_name" >/dev/null 2>&1; then
    mapped_port="$(
      docker inspect --format '{{with index .NetworkSettings.Ports "5432/tcp"}}{{(index . 0).HostPort}}{{end}}' "$container_name" 2>/dev/null || true
    )"
    if [[ -n "$mapped_port" && "$mapped_port" != "$host_port" ]]; then
      fail "Managed PostgreSQL container '$container_name' already exists with host port $mapped_port, not the requested $host_port."
    fi
    docker start "$container_name" >/dev/null || fail "Failed to start existing PostgreSQL container '$container_name'."
    log "Reused managed PostgreSQL container $container_name on 127.0.0.1:$host_port"
  else
    docker run -d \
      --name "$container_name" \
      --restart unless-stopped \
      -e "POSTGRES_DB=$INSTALLER_PG_DB" \
      -e "POSTGRES_USER=$INSTALLER_PG_USER" \
      -e "POSTGRES_PASSWORD=$INSTALLER_PG_PASSWORD" \
      -p "127.0.0.1:${host_port}:5432" \
      -v "$data_dir:/var/lib/postgresql/data" \
      postgres:16 >/dev/null || fail "Failed to create managed PostgreSQL container '$container_name'."
    log "Created managed PostgreSQL container $container_name on 127.0.0.1:$host_port"
  fi

  wait_for_tcp_endpoint "127.0.0.1" "$host_port" 60 "Managed PostgreSQL"
}

guided_collect_inputs() {
  local default_fqdn="${FORGEFRAME_PUBLIC_FQDN:-}"
  local default_acme_email="${FORGEFRAME_PUBLIC_TLS_ACME_EMAIL:-}"
  local default_admin_username="${FORGEFRAME_BOOTSTRAP_ADMIN_USERNAME:-admin}"
  local default_api_port="${FORGEFRAME_PORT:-8080}"
  local default_pg_mode="${FORGEFRAME_PG_MODE:-native}"
  local default_pg_host="${FORGEFRAME_PG_HOST:-127.0.0.1}"
  local default_pg_port="${FORGEFRAME_PG_PORT:-5432}"
  local default_pg_db="${FORGEFRAME_PG_DB:-forgeframe}"
  local default_pg_user="${FORGEFRAME_PG_USER:-forgeframe}"
  local default_pg_container="${FORGEFRAME_PG_CONTAINER_NAME:-forgeframe-postgres}"
  local default_pg_cluster="${FORGEFRAME_PG_CLUSTER_NAME:-forgeframe}"
  local configure_ollama
  local ollama_host
  local ollama_port
  local ollama_scheme
  local ollama_path

  if forgeframe_is_placeholder_value "$default_fqdn"; then
    default_fqdn=""
  fi
  if forgeframe_is_placeholder_value "$default_acme_email"; then
    default_acme_email=""
  fi
  if ! [[ "$default_api_port" =~ ^[0-9]+$ ]]; then
    default_api_port="8080"
  fi
  if ! [[ "$default_pg_port" =~ ^[0-9]+$ ]]; then
    default_pg_port="5432"
  fi

  printf '\n'
  log "Guided host-native installation"
  log "Public HTTPS stays fixed on 443 and the ACME helper stays fixed on 80. Internal listener collisions are shifted by +${PORT_INCREMENT}."
  require_enforced_port 80 "Public HTTP helper"
  require_enforced_port 443 "Public HTTPS"

  prompt_required "Public FQDN for https://<fqdn>/" "$default_fqdn" INSTALLER_PUBLIC_FQDN
  prompt_required "ACME operator email" "$default_acme_email" INSTALLER_ACME_EMAIL
  prompt_required "Bootstrap admin username" "$default_admin_username" INSTALLER_ADMIN_USERNAME
  prompt_secret_optional "Bootstrap admin password" INSTALLER_ADMIN_PASSWORD

  INSTALLER_API_PORT="$(resolve_shifted_port "$default_api_port" "ForgeFrame internal API")"
  log "Internal API port resolved to $INSTALLER_API_PORT"

  prompt_postgres_mode "$default_pg_mode"
  prompt_required "PostgreSQL database name" "$default_pg_db" INSTALLER_PG_DB
  prompt_required "PostgreSQL database user" "$default_pg_user" INSTALLER_PG_USER
  prompt_secret_optional "PostgreSQL database password" INSTALLER_PG_PASSWORD

  if [[ "$INSTALLER_PG_MODE" == "native" ]]; then
    prompt_required "Native PostgreSQL cluster name" "$default_pg_cluster" INSTALLER_PG_CLUSTER_NAME
    INSTALLER_PG_PORT="$(resolve_shifted_port "$default_pg_port" "Native PostgreSQL cluster")"
    INSTALLER_PG_HOST="127.0.0.1"
    INSTALLER_PG_CONTAINER_NAME=""
    log "Native PostgreSQL port resolved to $INSTALLER_PG_PORT"
  elif [[ "$INSTALLER_PG_MODE" == "docker" ]]; then
    prompt_required "Managed PostgreSQL container name" "$default_pg_container" INSTALLER_PG_CONTAINER_NAME
    INSTALLER_PG_PORT="$(resolve_shifted_port "$default_pg_port" "Managed PostgreSQL")"
    INSTALLER_PG_HOST="127.0.0.1"
    INSTALLER_PG_CLUSTER_NAME=""
    log "Managed PostgreSQL host port resolved to $INSTALLER_PG_PORT"
  else
    prompt_required "Existing PostgreSQL host" "$default_pg_host" INSTALLER_PG_HOST
    prompt_required "Existing PostgreSQL TCP port" "$default_pg_port" INSTALLER_PG_PORT
    require_valid_port "$INSTALLER_PG_PORT" "Existing PostgreSQL TCP port"
    INSTALLER_PG_CONTAINER_NAME=""
    INSTALLER_PG_CLUSTER_NAME=""
  fi

  prompt_yes_no "Preconfigure a local Ollama/OpenAI-compatible endpoint now?" "n" configure_ollama
  if [[ "$configure_ollama" == "1" ]]; then
    ollama_scheme="http"
    ollama_host="127.0.0.1"
    ollama_port="11434"
    ollama_path="/v1"
    prompt_required "Ollama endpoint scheme" "$ollama_scheme" ollama_scheme
    prompt_required "Ollama endpoint host" "$ollama_host" ollama_host
    prompt_required "Ollama endpoint port" "$ollama_port" ollama_port
    require_valid_port "$ollama_port" "Ollama endpoint port"
    prompt_required "Ollama endpoint path" "$ollama_path" ollama_path
    INSTALLER_OLLAMA_BASE_URL="${ollama_scheme}://${ollama_host}:${ollama_port}${ollama_path}"
  else
    INSTALLER_OLLAMA_BASE_URL=""
  fi
}

collect_default_install_inputs() {
  local default_api_port="${FORGEFRAME_PORT:-8080}"
  local default_pg_mode="${FORGEFRAME_PG_MODE:-native}"
  local default_pg_host="${FORGEFRAME_PG_HOST:-127.0.0.1}"
  local default_pg_port="${FORGEFRAME_PG_PORT:-5432}"
  local default_pg_db="${FORGEFRAME_PG_DB:-forgeframe}"
  local default_pg_user="${FORGEFRAME_PG_USER:-forgeframe}"
  local default_pg_container="${FORGEFRAME_PG_CONTAINER_NAME:-forgeframe-postgres}"
  local default_pg_cluster="${FORGEFRAME_PG_CLUSTER_NAME:-forgeframe}"

  require_enforced_port 80 "Public HTTP helper"
  require_enforced_port 443 "Public HTTPS"

  INSTALLER_API_PORT="$(resolve_shifted_port "$default_api_port" "ForgeFrame internal API")"
  INSTALLER_PG_MODE="$default_pg_mode"
  INSTALLER_PG_HOST="$default_pg_host"
  INSTALLER_PG_DB="$default_pg_db"
  INSTALLER_PG_USER="$default_pg_user"
  INSTALLER_PG_CONTAINER_NAME="$default_pg_container"
  INSTALLER_PG_CLUSTER_NAME="$default_pg_cluster"

  case "$INSTALLER_PG_MODE" in
    native)
      INSTALLER_PG_HOST="127.0.0.1"
      INSTALLER_PG_PORT="$(resolve_shifted_port "$default_pg_port" "Native PostgreSQL cluster")"
      ;;
    docker)
      INSTALLER_PG_HOST="127.0.0.1"
      INSTALLER_PG_PORT="$(resolve_shifted_port "$default_pg_port" "Managed PostgreSQL")"
      ;;
    existing)
      INSTALLER_PG_PORT="$default_pg_port"
      ;;
    *)
      fail "Unsupported PostgreSQL mode '$INSTALLER_PG_MODE'."
      ;;
  esac
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --guided)
      GUIDED=1
      shift
      ;;
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
    --skip-system-deps)
      SKIP_SYSTEM_DEPS=1
      shift
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
if [[ -f /etc/os-release ]]; then
  # shellcheck disable=SC1091
  source /etc/os-release
  case "${ID:-}" in
    ubuntu|debian)
      ;;
    *)
      fail "Automatic host preparation currently supports Ubuntu or Debian only."
      ;;
  esac
else
  fail "Unable to determine Linux distribution from /etc/os-release."
fi

ensure_bootstrap_python

INSTALL_ROOT="$(python3 -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).expanduser().resolve())' "$INSTALL_ROOT")"
CONFIG_DIR="$(python3 -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).expanduser().resolve())' "$CONFIG_DIR")"
STATE_DIR="$(python3 -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).expanduser().resolve())' "$STATE_DIR")"
LOG_DIR="$(python3 -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).expanduser().resolve())' "$LOG_DIR")"
UNIT_DIR="$(python3 -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).expanduser().resolve())' "$UNIT_DIR")"
ENV_FILE="$(python3 -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).expanduser().resolve())' "$ENV_FILE")"

if [[ "$DRY_RUN" == "1" ]]; then
  log "dry_run guided=$GUIDED install_root=$INSTALL_ROOT config_dir=$CONFIG_DIR state_dir=$STATE_DIR log_dir=$LOG_DIR unit_dir=$UNIT_DIR env_file=$ENV_FILE user=$SYSTEM_USER group=$SYSTEM_GROUP"
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

forgeframe_load_env_file "$ENV_FILE" >/dev/null 2>&1 || true
if [[ "$GUIDED" == "1" ]]; then
  guided_collect_inputs
else
  collect_default_install_inputs
fi
ensure_system_dependencies

export FORGEFRAME_INSTALL_GUIDED="$GUIDED"
export FORGEFRAME_INSTALL_PUBLIC_FQDN="$INSTALLER_PUBLIC_FQDN"
export FORGEFRAME_INSTALL_ACME_EMAIL="$INSTALLER_ACME_EMAIL"
export FORGEFRAME_INSTALL_ADMIN_USERNAME="$INSTALLER_ADMIN_USERNAME"
export FORGEFRAME_INSTALL_ADMIN_PASSWORD="$INSTALLER_ADMIN_PASSWORD"
export FORGEFRAME_INSTALL_API_PORT="$INSTALLER_API_PORT"
export FORGEFRAME_INSTALL_PG_MODE="$INSTALLER_PG_MODE"
export FORGEFRAME_INSTALL_PG_HOST="$INSTALLER_PG_HOST"
export FORGEFRAME_INSTALL_PG_PORT="$INSTALLER_PG_PORT"
export FORGEFRAME_INSTALL_PG_DB="$INSTALLER_PG_DB"
export FORGEFRAME_INSTALL_PG_USER="$INSTALLER_PG_USER"
export FORGEFRAME_INSTALL_PG_PASSWORD="$INSTALLER_PG_PASSWORD"
export FORGEFRAME_INSTALL_PG_CONTAINER_NAME="$INSTALLER_PG_CONTAINER_NAME"
export FORGEFRAME_INSTALL_PG_CLUSTER_NAME="$INSTALLER_PG_CLUSTER_NAME"
export FORGEFRAME_INSTALL_OLLAMA_BASE_URL="$INSTALLER_OLLAMA_BASE_URL"
export FORGEFRAME_INSTALL_PYTHON_BIN="$SELECTED_PYTHON_BIN"

python3 - "$ENV_FILE" "$INSTALL_ROOT" "$CONFIG_DIR" "$STATE_DIR" <<'PY'
import os
import secrets
import shlex
import sys
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit

env_path = Path(sys.argv[1])
install_root = sys.argv[2]
config_dir = sys.argv[3]
state_dir = sys.argv[4]
guided = os.environ.get("FORGEFRAME_INSTALL_GUIDED") == "1"

lines = env_path.read_text(encoding="utf-8").splitlines()
entries: dict[str, str] = {}
positions: dict[str, int] = {}
for index, line in enumerate(lines):
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in line:
        continue
    key, _, raw_value = line.partition("=")
    normalized_key = key.strip()
    entries[normalized_key] = raw_value.strip().strip("'").strip('"')
    positions[normalized_key] = index


def render(value: str) -> str:
    return shlex.quote(value)


def set_or_add(key: str, value: str) -> None:
    rendered = f"{key}={render(value)}"
    if key in positions:
        lines[positions[key]] = rendered
    else:
        positions[key] = len(lines)
        lines.append(rendered)
    entries[key] = value


def generate_token(prefix: str) -> str:
    return f"{prefix}{secrets.token_urlsafe(18)}"


def secure_bootstrap_password(existing: str, requested: str) -> str:
    normalized_existing = existing.strip().lower()
    if requested.strip():
        return requested.strip()
    if normalized_existing not in {
        "",
        "replace-with-a-generated-bootstrap-password",
        "forgeframe-admin",
        "forgegate-admin",
    }:
        return existing.strip()
    return generate_token("fg-admin-")


def secure_pg_password(existing: str, requested: str) -> str:
    normalized_existing = existing.strip().lower()
    if requested.strip():
        return requested.strip()
    if normalized_existing not in {
        "",
        "replace-with-a-generated-postgres-password",
        "forgeframe",
        "forgegate",
    }:
        return existing.strip()
    return generate_token("fg-pg-")


existing_pg_url = entries.get("FORGEFRAME_POSTGRES_URL", "")
bootstrap_password = secure_bootstrap_password(
    entries.get("FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD", ""),
    os.environ.get("FORGEFRAME_INSTALL_ADMIN_PASSWORD", ""),
)
bootstrap_username = (os.environ.get("FORGEFRAME_INSTALL_ADMIN_USERNAME", "").strip() or entries.get("FORGEFRAME_BOOTSTRAP_ADMIN_USERNAME", "").strip() or "admin")
selected_python_bin = os.environ.get("FORGEFRAME_INSTALL_PYTHON_BIN", "").strip() or entries.get("FORGEFRAME_PYTHON_BIN", "").strip()

if guided:
    pg_mode = os.environ.get("FORGEFRAME_INSTALL_PG_MODE", "").strip() or entries.get("FORGEFRAME_PG_MODE", "").strip() or "native"
    pg_host = os.environ.get("FORGEFRAME_INSTALL_PG_HOST", "").strip() or entries.get("FORGEFRAME_PG_HOST", "").strip() or "127.0.0.1"
    pg_port = os.environ.get("FORGEFRAME_INSTALL_PG_PORT", "").strip() or entries.get("FORGEFRAME_PG_PORT", "").strip() or "5432"
    pg_db = os.environ.get("FORGEFRAME_INSTALL_PG_DB", "").strip() or entries.get("FORGEFRAME_PG_DB", "").strip() or "forgeframe"
    pg_user = os.environ.get("FORGEFRAME_INSTALL_PG_USER", "").strip() or entries.get("FORGEFRAME_PG_USER", "").strip() or "forgeframe"
    pg_password = secure_pg_password(entries.get("FORGEFRAME_PG_PASSWORD", ""), os.environ.get("FORGEFRAME_INSTALL_PG_PASSWORD", ""))
    base_url = "postgresql://{user}:{password}@{host}:{port}/{database}".format(
        user=quote(pg_user, safe=""),
        password=quote(pg_password, safe=""),
        host=pg_host,
        port=pg_port,
        database=quote(pg_db, safe=""),
    )
    set_or_add("FORGEFRAME_PG_MODE", pg_mode)
    set_or_add("FORGEFRAME_PG_HOST", pg_host)
    set_or_add("FORGEFRAME_PG_PORT", pg_port)
    set_or_add("FORGEFRAME_PG_DB", pg_db)
    set_or_add("FORGEFRAME_PG_USER", pg_user)
    set_or_add("FORGEFRAME_PG_PASSWORD", pg_password)
    set_or_add("FORGEFRAME_PG_CONTAINER_NAME", os.environ.get("FORGEFRAME_INSTALL_PG_CONTAINER_NAME", "").strip())
    set_or_add("FORGEFRAME_PG_CLUSTER_NAME", os.environ.get("FORGEFRAME_INSTALL_PG_CLUSTER_NAME", "").strip())
    set_or_add("FORGEFRAME_POSTGRES_URL", base_url)
    set_or_add("FORGEFRAME_HARNESS_POSTGRES_URL", base_url)
    set_or_add("FORGEFRAME_CONTROL_PLANE_POSTGRES_URL", base_url)
    set_or_add("FORGEFRAME_OBSERVABILITY_POSTGRES_URL", base_url)
    set_or_add("FORGEFRAME_GOVERNANCE_POSTGRES_URL", base_url)
    set_or_add("FORGEFRAME_INSTANCES_POSTGRES_URL", base_url)
    set_or_add("FORGEFRAME_EXECUTION_POSTGRES_URL", base_url)
    set_or_add("FORGEFRAME_HOST", "127.0.0.1")
    set_or_add("FORGEFRAME_PORT", os.environ.get("FORGEFRAME_INSTALL_API_PORT", "").strip() or entries.get("FORGEFRAME_PORT", "8080") or "8080")
    set_or_add("FORGEFRAME_FRONTEND_DIST_PATH", f"{install_root}/frontend/dist")
    set_or_add("FORGEFRAME_PUBLIC_FQDN", os.environ.get("FORGEFRAME_INSTALL_PUBLIC_FQDN", "").strip())
    set_or_add("FORGEFRAME_PUBLIC_HTTPS_HOST", "0.0.0.0")
    set_or_add("FORGEFRAME_PUBLIC_HTTPS_PORT", "443")
    set_or_add("FORGEFRAME_PUBLIC_HTTP_HELPER_HOST", "0.0.0.0")
    set_or_add("FORGEFRAME_PUBLIC_HTTP_HELPER_PORT", "80")
    set_or_add("FORGEFRAME_PUBLIC_ADMIN_BASE", entries.get("FORGEFRAME_PUBLIC_ADMIN_BASE", "/admin") or "/admin")
    set_or_add("FORGEFRAME_PUBLIC_TLS_MODE", "integrated_acme")
    set_or_add("FORGEFRAME_PUBLIC_TLS_CERT_PATH", entries.get("FORGEFRAME_PUBLIC_TLS_CERT_PATH", f"{config_dir}/tls/live/fullchain.pem") or f"{config_dir}/tls/live/fullchain.pem")
    set_or_add("FORGEFRAME_PUBLIC_TLS_KEY_PATH", entries.get("FORGEFRAME_PUBLIC_TLS_KEY_PATH", f"{config_dir}/tls/live/privkey.pem") or f"{config_dir}/tls/live/privkey.pem")
    set_or_add("FORGEFRAME_PUBLIC_TLS_WEBROOT_PATH", entries.get("FORGEFRAME_PUBLIC_TLS_WEBROOT_PATH", f"{state_dir}/acme-webroot") or f"{state_dir}/acme-webroot")
    set_or_add("FORGEFRAME_PUBLIC_TLS_STATE_PATH", entries.get("FORGEFRAME_PUBLIC_TLS_STATE_PATH", f"{state_dir}/tls") or f"{state_dir}/tls")
    set_or_add("FORGEFRAME_PUBLIC_TLS_LAST_ERROR_PATH", entries.get("FORGEFRAME_PUBLIC_TLS_LAST_ERROR_PATH", f"{state_dir}/tls/last_error.txt") or f"{state_dir}/tls/last_error.txt")
    set_or_add("FORGEFRAME_PUBLIC_TLS_RENEWAL_WINDOW_DAYS", entries.get("FORGEFRAME_PUBLIC_TLS_RENEWAL_WINDOW_DAYS", "30") or "30")
    set_or_add("FORGEFRAME_PUBLIC_TLS_ACME_EMAIL", os.environ.get("FORGEFRAME_INSTALL_ACME_EMAIL", "").strip())
    set_or_add("FORGEFRAME_PUBLIC_TLS_ACME_DIRECTORY_URL", entries.get("FORGEFRAME_PUBLIC_TLS_ACME_DIRECTORY_URL", "https://acme-v02.api.letsencrypt.org/directory") or "https://acme-v02.api.letsencrypt.org/directory")
    set_or_add("FORGEFRAME_BOOTSTRAP_ADMIN_USERNAME", bootstrap_username)
    set_or_add("FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD", bootstrap_password)
    set_or_add("FORGEFRAME_OLLAMA_BASE_URL", os.environ.get("FORGEFRAME_INSTALL_OLLAMA_BASE_URL", "").strip())
else:
    pg_mode = os.environ.get("FORGEFRAME_INSTALL_PG_MODE", "").strip() or entries.get("FORGEFRAME_PG_MODE", "").strip() or "native"
    pg_host = os.environ.get("FORGEFRAME_INSTALL_PG_HOST", "").strip() or entries.get("FORGEFRAME_PG_HOST", "").strip() or "127.0.0.1"
    pg_port = os.environ.get("FORGEFRAME_INSTALL_PG_PORT", "").strip() or entries.get("FORGEFRAME_PG_PORT", "").strip() or "5432"
    pg_db = os.environ.get("FORGEFRAME_INSTALL_PG_DB", "").strip() or entries.get("FORGEFRAME_PG_DB", "").strip() or "forgeframe"
    pg_user = os.environ.get("FORGEFRAME_INSTALL_PG_USER", "").strip() or entries.get("FORGEFRAME_PG_USER", "").strip() or "forgeframe"
    existing_pg_password = entries.get("FORGEFRAME_PG_PASSWORD", "")
    if existing_pg_url:
        parts = urlsplit(existing_pg_url)
        pg_host = os.environ.get("FORGEFRAME_INSTALL_PG_HOST", "").strip() or entries.get("FORGEFRAME_PG_HOST", "").strip() or parts.hostname or pg_host
        pg_port = os.environ.get("FORGEFRAME_INSTALL_PG_PORT", "").strip() or entries.get("FORGEFRAME_PG_PORT", "").strip() or (str(parts.port) if parts.port else pg_port)
        pg_db = os.environ.get("FORGEFRAME_INSTALL_PG_DB", "").strip() or entries.get("FORGEFRAME_PG_DB", "").strip() or (unquote(parts.path.lstrip("/")) if parts.path else pg_db)
        pg_user = os.environ.get("FORGEFRAME_INSTALL_PG_USER", "").strip() or entries.get("FORGEFRAME_PG_USER", "").strip() or (unquote(parts.username) if parts.username else pg_user)
        existing_pg_password = existing_pg_password or (unquote(parts.password) if parts.password else "")
    pg_password = secure_pg_password(existing_pg_password, os.environ.get("FORGEFRAME_INSTALL_PG_PASSWORD", ""))
    if "replace-with-a-generated-postgres-password" in existing_pg_url or "replace-with-postgresql-url" in existing_pg_url or not existing_pg_url:
        base_url = "postgresql://{user}:{password}@{host}:{port}/{database}".format(
            user=quote(pg_user, safe=""),
            password=quote(pg_password, safe=""),
            host=pg_host,
            port=pg_port,
            database=quote(pg_db, safe=""),
        )
    else:
        base_url = existing_pg_url

    set_or_add("FORGEFRAME_HOST", entries.get("FORGEFRAME_HOST", "127.0.0.1") or "127.0.0.1")
    set_or_add("FORGEFRAME_PORT", os.environ.get("FORGEFRAME_INSTALL_API_PORT", "").strip() or entries.get("FORGEFRAME_PORT", "8080") or "8080")
    set_or_add("FORGEFRAME_FRONTEND_DIST_PATH", f"{install_root}/frontend/dist")
    set_or_add("FORGEFRAME_PG_MODE", pg_mode)
    set_or_add("FORGEFRAME_PG_HOST", pg_host)
    set_or_add("FORGEFRAME_PG_PORT", pg_port)
    set_or_add("FORGEFRAME_PG_DB", pg_db)
    set_or_add("FORGEFRAME_PG_USER", pg_user)
    set_or_add("FORGEFRAME_PG_PASSWORD", pg_password)
    set_or_add("FORGEFRAME_PG_CONTAINER_NAME", os.environ.get("FORGEFRAME_INSTALL_PG_CONTAINER_NAME", "").strip() or entries.get("FORGEFRAME_PG_CONTAINER_NAME", "") or "")
    set_or_add("FORGEFRAME_PG_CLUSTER_NAME", os.environ.get("FORGEFRAME_INSTALL_PG_CLUSTER_NAME", "").strip() or entries.get("FORGEFRAME_PG_CLUSTER_NAME", "forgeframe") or "forgeframe")
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
    set_or_add("FORGEFRAME_BOOTSTRAP_ADMIN_USERNAME", bootstrap_username)
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

if selected_python_bin:
    set_or_add("FORGEFRAME_PYTHON_BIN", selected_python_bin)
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

forgeframe_load_env_file "$ENV_FILE" || fail "Unable to load $ENV_FILE after writing installer values."
write_local_env_mirrors
write_local_env_examples

INSTALLER_PG_MODE="${INSTALLER_PG_MODE:-${FORGEFRAME_PG_MODE:-native}}"
INSTALLER_PG_HOST="${INSTALLER_PG_HOST:-${FORGEFRAME_PG_HOST:-127.0.0.1}}"
INSTALLER_PG_PORT="${INSTALLER_PG_PORT:-${FORGEFRAME_PG_PORT:-5432}}"
INSTALLER_PG_DB="${INSTALLER_PG_DB:-${FORGEFRAME_PG_DB:-forgeframe}}"
INSTALLER_PG_USER="${INSTALLER_PG_USER:-${FORGEFRAME_PG_USER:-forgeframe}}"
INSTALLER_PG_PASSWORD="${INSTALLER_PG_PASSWORD:-${FORGEFRAME_PG_PASSWORD:-}}"
INSTALLER_PG_CONTAINER_NAME="${INSTALLER_PG_CONTAINER_NAME:-${FORGEFRAME_PG_CONTAINER_NAME:-forgeframe-postgres}}"
INSTALLER_PG_CLUSTER_NAME="${INSTALLER_PG_CLUSTER_NAME:-${FORGEFRAME_PG_CLUSTER_NAME:-forgeframe}}"

case "$INSTALLER_PG_MODE" in
  native)
    provision_native_postgres
    ;;
  docker)
    provision_managed_postgres
    ;;
  existing)
    wait_for_tcp_endpoint "$INSTALLER_PG_HOST" "$INSTALLER_PG_PORT" 15 "Configured PostgreSQL"
    log "Verified PostgreSQL reachability on ${INSTALLER_PG_HOST}:${INSTALLER_PG_PORT}"
    ;;
  *)
    fail "Unsupported PostgreSQL mode '$INSTALLER_PG_MODE'."
    ;;
esac

if [[ "$SKIP_PYTHON_ENV" != "1" ]]; then
  if [[ ! -d "$INSTALL_ROOT/.venv" ]]; then
    "$SELECTED_PYTHON_BIN" -m venv "$INSTALL_ROOT/.venv"
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

if [[ "$GUIDED" == "1" ]]; then
  log "Guided host-native installation artifacts are ready."
  log "Resolved ports: public HTTPS 443, ACME helper 80, internal API ${FORGEFRAME_PORT:-8080}, PostgreSQL ${FORGEFRAME_PG_HOST:-127.0.0.1}:${FORGEFRAME_PG_PORT:-5432}"
  log "forgeframe.env written to $ENV_FILE"
  log "Ignored .env mirrors written to $INSTALL_ROOT/.env.host, $INSTALL_ROOT/.env, and $INSTALL_ROOT/backend/.env"
  log "Local .env.example files written to $INSTALL_ROOT/.env.host.example, $INSTALL_ROOT/.env.example, and $INSTALL_ROOT/backend/.env.example"
else
  log "Host-native installation artifacts are ready."
fi
log "Internal runtime path: systemctl enable --now forgeframe-api.service forgeframe-worker.service forgeframe-retention.timer"
log "Public runtime path: replace FORGEFRAME_PUBLIC_FQDN and FORGEFRAME_PUBLIC_TLS_ACME_EMAIL in $ENV_FILE, then enable forgeframe-http-helper.service, run scripts/renew-certificates.sh, and start forgeframe-public.service plus forgeframe-acme.timer"

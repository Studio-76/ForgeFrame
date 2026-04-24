#!/usr/bin/env bash

forgeframe_default_env_file() {
  local root_dir="$1"

  if [[ -n "${FORGEFRAME_ENV_FILE:-}" ]]; then
    printf '%s\n' "$FORGEFRAME_ENV_FILE"
    return 0
  fi
  if [[ -f "/etc/forgeframe/forgeframe.env" ]]; then
    printf '%s\n' "/etc/forgeframe/forgeframe.env"
    return 0
  fi
  if [[ -f "$root_dir/.env.host" ]]; then
    printf '%s\n' "$root_dir/.env.host"
    return 0
  fi
  printf '%s\n' "$root_dir/.env.compose"
}

forgeframe_ensure_compose_env_file() {
  local env_file="$1"
  local env_example="$2"

  if [[ -f "$env_file" ]]; then
    return 0
  fi
  [[ -f "$env_example" ]] || return 1
  cp "$env_example" "$env_file"
}

forgeframe_sync_legacy_env_prefixes() {
  local key
  local suffix
  local target

  while IFS= read -r key; do
    suffix="${key#FORGEGATE_}"
    target="FORGEFRAME_${suffix}"
    if [[ -z "${!target-}" ]]; then
      printf -v "$target" '%s' "${!key}"
      export "$target"
    fi
  done < <(compgen -A variable FORGEGATE_)
}

forgeframe_warn_legacy_env_prefixes() {
  local key
  local legacy_keys=()

  while IFS= read -r key; do
    legacy_keys+=("$key")
  done < <(compgen -A variable FORGEGATE_)

  if (( ${#legacy_keys[@]} > 0 )) && [[ -z "${FORGEFRAME_LEGACY_ENV_WARNING_EMITTED:-}" ]]; then
    printf '[forgeframe-env][WARN] %s\n' "Legacy FORGEGATE_* variables are deprecated and will stop working after 2026-12-31: ${legacy_keys[*]}" >&2
    export FORGEFRAME_LEGACY_ENV_WARNING_EMITTED=1
  fi
}

forgeframe_load_env_file() {
  local env_file="$1"

  [[ -f "$env_file" ]] || return 1

  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a

  forgeframe_sync_legacy_env_prefixes
  forgeframe_warn_legacy_env_prefixes
}

forgeframe_is_placeholder_value() {
  local value="${1:-}"
  local normalized

  normalized="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]' | xargs)"
  [[ -z "$normalized" ]] && return 0
  [[ "$normalized" == replace-with-* ]] && return 0
  [[ "$normalized" == *".example.invalid" ]] && return 0
  [[ "$normalized" == *"@example.invalid" ]] && return 0
  return 1
}

forgeframe_has_configured_public_fqdn() {
  ! forgeframe_is_placeholder_value "${FORGEFRAME_PUBLIC_FQDN:-}"
}

forgeframe_has_configured_public_acme_email() {
  ! forgeframe_is_placeholder_value "${FORGEFRAME_PUBLIC_TLS_ACME_EMAIL:-}"
}

forgeframe_prepare_compose_env() {
  local env_file="$1"

  python3 - "$env_file" <<'PY'
import secrets
import sys
from pathlib import Path

path = Path(sys.argv[1])
if not path.exists():
    raise SystemExit(1)

insecure_admin_passwords = {
    "",
    "forgegate-admin",
    "forgeframe-admin",
    "replace-with-a-strong-password",
    "replace-with-a-generated-bootstrap-password",
}
insecure_postgres_passwords = {
    "",
    "forgegate",
    "forgeframe",
    "replace-with-a-generated-postgres-password",
}
url_keys = (
    "FORGEFRAME_POSTGRES_URL",
    "FORGEFRAME_HARNESS_POSTGRES_URL",
    "FORGEFRAME_CONTROL_PLANE_POSTGRES_URL",
    "FORGEFRAME_OBSERVABILITY_POSTGRES_URL",
    "FORGEFRAME_GOVERNANCE_POSTGRES_URL",
    "FORGEFRAME_INSTANCES_POSTGRES_URL",
    "FORGEFRAME_EXECUTION_POSTGRES_URL",
)

lines = path.read_text(encoding="utf-8").splitlines()
entries: dict[str, str] = {}
positions: dict[str, int] = {}
updated_lines = list(lines)

for index, line in enumerate(lines):
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in line:
        continue
    key, _, raw_value = line.partition("=")
    normalized_key = key.strip()
    entries[normalized_key] = raw_value.strip()
    positions[normalized_key] = index


def set_or_add(key: str, value: str) -> None:
    rendered = f"{key}={value}"
    entries[key] = value
    if key in positions:
        updated_lines[positions[key]] = rendered
    else:
        positions[key] = len(updated_lines)
        updated_lines.append(rendered)


pg_user = entries.get("FORGEFRAME_PG_USER", "").strip() or "forgeframe"
pg_db = entries.get("FORGEFRAME_PG_DB", "").strip() or "forgeframe"
pg_password = entries.get("FORGEFRAME_PG_PASSWORD", "").strip()
bootstrap_username = entries.get("FORGEFRAME_BOOTSTRAP_ADMIN_USERNAME", "").strip() or "admin"
bootstrap_password = entries.get("FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD", "").strip()

generated_labels: list[str] = []
if pg_password in insecure_postgres_passwords:
    pg_password = f"fg-pg-{secrets.token_urlsafe(18)}"
    generated_labels.append("postgres password")
if bootstrap_password in insecure_admin_passwords:
    bootstrap_password = f"fg-admin-{secrets.token_urlsafe(18)}"
    generated_labels.append("bootstrap admin password")

base_postgres_url = f"postgresql+psycopg://{pg_user}:{pg_password}@postgres:5432/{pg_db}"

set_or_add("FORGEFRAME_PG_USER", pg_user)
set_or_add("FORGEFRAME_PG_PASSWORD", pg_password)
set_or_add("FORGEFRAME_PG_DB", pg_db)
set_or_add("FORGEFRAME_POSTGRES_URL", base_postgres_url)
for key in url_keys[1:]:
    if key in entries:
        set_or_add(key, base_postgres_url)
set_or_add("FORGEFRAME_HARNESS_POSTGRES_URL", base_postgres_url)
set_or_add("FORGEFRAME_CONTROL_PLANE_POSTGRES_URL", base_postgres_url)
set_or_add("FORGEFRAME_OBSERVABILITY_POSTGRES_URL", base_postgres_url)
set_or_add("FORGEFRAME_GOVERNANCE_POSTGRES_URL", base_postgres_url)
set_or_add("FORGEFRAME_BOOTSTRAP_ADMIN_USERNAME", bootstrap_username)
set_or_add("FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD", bootstrap_password)

path.write_text("\n".join(updated_lines) + "\n", encoding="utf-8")
for label in generated_labels:
    print(label)
PY
}

forgeframe_update_env_value() {
  local env_file="$1"
  local key="$2"
  local value="$3"

  python3 - "$env_file" "$key" "$value" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
key = sys.argv[2]
value = sys.argv[3]

lines = path.read_text(encoding="utf-8").splitlines()
for index, line in enumerate(lines):
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in line:
        continue
    existing_key, _, _ = line.partition("=")
    if existing_key.strip() == key:
        lines[index] = f"{key}={value}"
        break
else:
    lines.append(f"{key}={value}")

path.write_text("\n".join(lines) + "\n", encoding="utf-8")
PY
}

forgeframe_login_and_rotate_bootstrap_admin_if_required() {
  local base_url="$1"
  local env_file="$2"
  local auth_file="$3"
  local auth_header_file="$4"
  local login_status
  local must_rotate
  local new_password

  login_status="$(
    curl -sS -o "$auth_file" -w '%{http_code}' -X POST "${base_url}/admin/auth/login" \
      -H 'Content-Type: application/json' \
      -d "{\"username\":\"${FORGEFRAME_BOOTSTRAP_ADMIN_USERNAME:-admin}\",\"password\":\"${FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD}\"}"
  )" || return 1
  [[ "$login_status" == "201" ]] || return 1

  must_rotate="$(
    python3 - "$auth_file" "$auth_header_file" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
Path(sys.argv[2]).write_text(f"Authorization: Bearer {payload['access_token']}\n", encoding="utf-8")
print("1" if payload.get("user", {}).get("must_rotate_password") else "0")
PY
  )" || return 1

  if [[ "$must_rotate" != "1" ]]; then
    return 0
  fi

  new_password="$(
    python3 - <<'PY'
import secrets

print(f"fg-admin-{secrets.token_urlsafe(18)}")
PY
  )" || return 1

  curl -sS -o /dev/null -X POST "${base_url}/admin/auth/rotate-password" \
    -H "$(cat "$auth_header_file")" \
    -H 'Content-Type: application/json' \
    -d "{\"current_password\":\"${FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD}\",\"new_password\":\"${new_password}\"}" || return 1

  forgeframe_update_env_value "$env_file" "FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD" "$new_password" || return 1
  export FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD="$new_password"
  if [[ -n "${FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD:-}" ]]; then
    export FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD="$new_password"
  fi
}

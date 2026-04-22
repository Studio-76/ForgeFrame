#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.yml"
BACKUP_RESTORE_REPORT_PATH="${FORGEGATE_BACKUP_RESTORE_REPORT_PATH:-/tmp/forgegate-backup-restore-smoke.json}"
RETENTION_REPORT_PATH="${FORGEGATE_RETENTION_RELEASE_REPORT_PATH:-/tmp/forgegate-retention-release-validation.json}"

log() {
  printf "[forgegate-release-validate] %s\n" "$*"
}

fail() {
  printf "[forgegate-release-validate][ERROR] %s\n" "$*" >&2
  exit 1
}

run_step() {
  local script_name="$1"
  log "Running $script_name"
  bash "$ROOT_DIR/scripts/$script_name"
}

resolve_path() {
  local raw_path="$1"
  local target_dir
  local target_name

  target_dir="$(dirname "$raw_path")"
  target_name="$(basename "$raw_path")"
  mkdir -p "$target_dir"
  target_dir="$(cd "$target_dir" && pwd -P)"
  printf '%s/%s\n' "$target_dir" "$target_name"
}

run_retention_validation() {
  local backup_report_dir
  local retention_report_dir
  local -a volume_args

  command -v docker >/dev/null 2>&1 || fail "docker command is required for retention safeguard validation."

  BACKUP_RESTORE_REPORT_PATH="$(resolve_path "$BACKUP_RESTORE_REPORT_PATH")"
  RETENTION_REPORT_PATH="$(resolve_path "$RETENTION_REPORT_PATH")"

  [[ -f "$BACKUP_RESTORE_REPORT_PATH" ]] || fail "Expected backup/restore smoke report at $BACKUP_RESTORE_REPORT_PATH"

  backup_report_dir="$(dirname "$BACKUP_RESTORE_REPORT_PATH")"
  retention_report_dir="$(dirname "$RETENTION_REPORT_PATH")"
  volume_args=(-v "$backup_report_dir:$backup_report_dir")
  if [[ "$retention_report_dir" != "$backup_report_dir" ]]; then
    volume_args+=(-v "$retention_report_dir:$retention_report_dir")
  fi

  log "Running retention purge-guard validation (dry-run)"
  docker compose -f "$COMPOSE_FILE" run --rm --no-deps "${volume_args[@]}" forgegate \
    python /app/scripts/run-history-retention.py \
      --purge-archive \
      --backup-restore-report "$BACKUP_RESTORE_REPORT_PATH" \
      --report-path "$RETENTION_REPORT_PATH"
}

run_step test-backend.sh
run_step test-frontend.sh
run_step compose-smoke.sh
run_step compose-client-compat-signoff.sh
run_step compose-backup-restore-smoke.sh
run_retention_validation

log "Release validation completed."
log "Artifacts:"
log "  $BACKUP_RESTORE_REPORT_PATH"
log "  $RETENTION_REPORT_PATH"

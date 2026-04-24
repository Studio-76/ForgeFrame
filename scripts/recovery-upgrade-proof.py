#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, inspect, text

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.settings.config import get_settings
from app.storage.migrator import storage_postgres_targets

MIGRATION_TABLES = ("forgeframe_schema_migrations", "forgegate_schema_migrations")
CRITICAL_OBJECT_TABLES = (
    "runs",
    "run_commands",
    "run_attempts",
    "run_approval_links",
    "memory_entries",
    "skills",
    "skill_versions",
    "skill_activations",
    "learning_events",
    "assistant_profiles",
)
ACTIVE_QUEUE_STATES = {
    "queued",
    "dispatching",
    "executing",
    "waiting_on_approval",
    "cancel_requested",
    "retry_backoff",
    "compensating",
}


def _utcnow() -> str:
    return datetime.now(tz=UTC).isoformat()


def _execution_database_url() -> str:
    settings = get_settings()
    if settings.execution_postgres_url.strip():
        return settings.execution_postgres_url.strip()
    if settings.harness_storage_backend == "postgresql" and settings.harness_postgres_url.strip():
        return settings.harness_postgres_url.strip()
    sqlite_path = (ROOT / settings.execution_sqlite_path).resolve()
    sqlite_path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite+pysqlite:///{sqlite_path}"


def _database_targets() -> list[str]:
    settings = get_settings()
    targets = list(storage_postgres_targets(settings))
    execution_target = _execution_database_url()
    if execution_target and execution_target not in targets:
        targets.append(execution_target)
    return targets


def _table_exists(connection, table_name: str) -> bool:
    schema_name = "public" if connection.dialect.name.startswith("postgresql") else None
    return inspect(connection).has_table(table_name, schema=schema_name)


def _safe_count(connection, table_name: str) -> int:
    if not _table_exists(connection, table_name):
        return 0
    return int(connection.execute(text(f'SELECT COUNT(*) FROM "{table_name}"')).scalar_one())


def _queue_state_counts(connection) -> dict[str, int]:
    if not _table_exists(connection, "runs"):
        return {}
    rows = connection.execute(text('SELECT state, COUNT(*) AS count FROM "runs" GROUP BY state')).all()
    return {str(state): int(count) for state, count in rows}


def _migration_state(connection) -> tuple[int | None, list[int]]:
    versions: set[int] = set()
    for migration_table in MIGRATION_TABLES:
        if not _table_exists(connection, migration_table):
            continue
        versions.update(
            int(row[0]) for row in connection.execute(text(f'SELECT version FROM "{migration_table}" ORDER BY version ASC'))
        )
    if not versions:
        return None, []
    ordered_versions = sorted(versions)
    return ordered_versions[-1], ordered_versions


def _source_identity(connection, database_url: str) -> dict[str, str]:
    if connection.dialect.name.startswith("postgresql"):
        row = connection.execute(
            text(
                """
                SELECT
                  current_database() AS database,
                  (SELECT system_identifier::text FROM pg_control_system()) AS cluster_system_identifier
                """
            )
        ).mappings().one()
        return {
            "source_database": str(row["database"]),
            "cluster_system_identifier": str(row["cluster_system_identifier"]),
            "deployment_slug": "",
            "public_fqdn": "",
        }
    return {
        "source_database": str(Path(database_url.removeprefix("sqlite+pysqlite:///")).name) if database_url.startswith("sqlite") else database_url,
        "cluster_system_identifier": "",
        "deployment_slug": "",
        "public_fqdn": "",
    }


def capture_snapshot(*, label: str | None) -> dict[str, Any]:
    targets: list[dict[str, Any]] = []
    merged_object_counts = {table_name: 0 for table_name in CRITICAL_OBJECT_TABLES}
    merged_queue_state_counts: dict[str, int] = {}
    latest_migration_version: int | None = None
    applied_versions: set[int] = set()
    source_identity: dict[str, str] | None = None

    for database_url in _database_targets():
        engine = create_engine(database_url, pool_pre_ping=database_url.startswith("postgresql"))
        with engine.connect() as connection:
            object_counts = {table_name: _safe_count(connection, table_name) for table_name in CRITICAL_OBJECT_TABLES}
            queue_state_counts = _queue_state_counts(connection)
            migration_version, migration_versions = _migration_state(connection)
            identity = _source_identity(connection, database_url)
            targets.append(
                {
                    "database_url": database_url,
                    "source_identity": identity,
                    "migration_version": migration_version,
                    "applied_migration_versions": migration_versions,
                    "critical_object_counts": object_counts,
                    "queue_state_counts": queue_state_counts,
                }
            )
            for key, value in object_counts.items():
                merged_object_counts[key] = merged_object_counts.get(key, 0) + int(value)
            for key, value in queue_state_counts.items():
                merged_queue_state_counts[key] = merged_queue_state_counts.get(key, 0) + int(value)
            if migration_version is not None:
                latest_migration_version = max(latest_migration_version or migration_version, migration_version)
            applied_versions.update(migration_versions)
            if source_identity is None and any(identity.values()):
                source_identity = identity

    return {
        "captured_at": _utcnow(),
        "label": label or "",
        "source_identity": source_identity or {
            "source_database": "",
            "cluster_system_identifier": "",
            "deployment_slug": "",
            "public_fqdn": "",
        },
        "migration": {
            "latest_version": latest_migration_version,
            "applied_versions": sorted(applied_versions),
        },
        "critical_object_counts": merged_object_counts,
        "queue_state_counts": merged_queue_state_counts,
        "database_targets": targets,
    }


def _object_mismatches(before_counts: dict[str, Any], after_counts: dict[str, Any]) -> list[str]:
    mismatches: list[str] = []
    for table_name in CRITICAL_OBJECT_TABLES:
        before_count = int(before_counts.get(table_name, 0))
        after_count = int(after_counts.get(table_name, 0))
        if after_count < before_count:
            mismatches.append(f"count_decreased:{table_name}:{before_count}->{after_count}")
    return mismatches


def _source_identity_mismatches(before: dict[str, Any], after: dict[str, Any]) -> list[str]:
    mismatches: list[str] = []
    if before.get("source_database") and after.get("source_database") and before["source_database"] != after["source_database"]:
        mismatches.append("source_database_changed_across_upgrade")
    if (
        before.get("cluster_system_identifier")
        and after.get("cluster_system_identifier")
        and before["cluster_system_identifier"] != after["cluster_system_identifier"]
    ):
        mismatches.append("cluster_system_identifier_changed_across_upgrade")
    return mismatches


def _queue_drain_ok(before_counts: dict[str, Any], after_counts: dict[str, Any]) -> bool:
    before_active = sum(int(before_counts.get(key, 0)) for key in ACTIVE_QUEUE_STATES)
    after_active = sum(int(after_counts.get(key, 0)) for key in ACTIVE_QUEUE_STATES)
    return before_active == 0 and after_active == 0


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    checkpoint = json.loads(Path(args.checkpoint).read_text(encoding="utf-8"))
    before = dict(checkpoint)
    after = capture_snapshot(label=args.label)
    mismatches = _object_mismatches(
        dict(before.get("critical_object_counts") or {}),
        dict(after.get("critical_object_counts") or {}),
    )
    mismatches.extend(
        _source_identity_mismatches(
            dict(before.get("source_identity") or {}),
            dict(after.get("source_identity") or {}),
        )
    )
    before_migration = (
        before.get("migration", {}).get("latest_version")
        if isinstance(before.get("migration"), dict)
        else before.get("migration_version")
    )
    after_migration = after["migration"]["latest_version"]
    if before_migration is not None and after_migration is not None and int(after_migration) < int(before_migration):
        mismatches.append("migration_version_regressed")
    queue_drain_ok = _queue_drain_ok(
        dict(before.get("queue_state_counts") or {}),
        dict(after.get("queue_state_counts") or {}),
    )
    no_loss_ok = not any(
        item.startswith("count_decreased:") or item == "migration_version_regressed"
        for item in mismatches
    )
    status = args.status
    if not status:
        if args.upgrade_result == "succeeded" and no_loss_ok and queue_drain_ok and not mismatches:
            status = "ok"
        elif args.upgrade_result == "failed" or "migration_version_regressed" in mismatches or not no_loss_ok:
            status = "failed"
        else:
            status = "warning"
    return {
        "release_id": args.release_id,
        "target_version": args.target_version,
        "status": status,
        "upgrade_result": args.upgrade_result,
        "rollback_classification": args.rollback_classification,
        "failure_classification": args.failure_classification,
        "bootstrap_recovery_state": args.bootstrap_recovery_state,
        "queue_drain_ok": queue_drain_ok,
        "no_loss_ok": no_loss_ok,
        "generated_at": _utcnow(),
        "before": before,
        "after": after,
        "mismatch_reasons": sorted(dict.fromkeys(mismatches)),
        "notes": args.notes or "",
    }


def _write_output(payload: dict[str, Any], output: str | None) -> None:
    text_output = json.dumps(payload, indent=2)
    print(text_output)
    if output:
        Path(output).write_text(text_output + "\n", encoding="utf-8")


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Capture pre/post upgrade checkpoints and build a ForgeFrame no-loss proof report.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    capture = subparsers.add_parser("capture", help="Capture a pre-upgrade checkpoint.")
    capture.add_argument("--label", default="", help="Optional checkpoint label.")
    capture.add_argument("--output", help="Optional JSON output path.")

    compare = subparsers.add_parser("compare", help="Compare a checkpoint against the current state and emit an upgrade proof report.")
    compare.add_argument("--checkpoint", required=True, help="Path to the JSON checkpoint created with capture.")
    compare.add_argument("--release-id", required=True, help="Operator release identifier.")
    compare.add_argument("--target-version", required=True, help="Target ForgeFrame version.")
    compare.add_argument("--upgrade-result", choices=["succeeded", "failed", "rolled_back", "partial_failure"], required=True)
    compare.add_argument("--status", choices=["ok", "warning", "failed"], help="Optional explicit report status override.")
    compare.add_argument("--rollback-classification", default="not_needed", help="Rollback classification for failed or partial upgrades.")
    compare.add_argument("--failure-classification", default="none", help="Failure classification for partial or failed upgrades.")
    compare.add_argument("--bootstrap-recovery-state", default="recovered", help="Bootstrap/deploy recovery outcome after the upgrade.")
    compare.add_argument("--label", default="", help="Optional post-upgrade capture label.")
    compare.add_argument("--notes", default="", help="Optional operator notes.")
    compare.add_argument("--output", help="Optional JSON output path.")

    return parser


def main() -> int:
    parser = _build_parser()
    args = parser.parse_args()
    if args.command == "capture":
        payload = capture_snapshot(label=args.label)
        _write_output(payload, args.output)
        return 0
    payload = build_report(args)
    _write_output(payload, args.output)
    return 0 if payload["status"] == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())

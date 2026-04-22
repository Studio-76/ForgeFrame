#!/usr/bin/env python3
"""Archive and purge operational history tables with a backup/restore safety gate."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import inspect, text

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.settings.config import get_settings
from app.storage.db import build_postgres_engine
from app.storage.migrator import storage_postgres_targets
from app.storage.retention_controls import (
    RetentionPolicy,
    assess_backup_restore_guard,
    default_retention_policies,
    redact_database_url,
    select_policies,
)


def _safe_ident(value: str) -> str:
    if not value or not value.replace("_", "").isalnum() or value[0].isdigit():
        raise ValueError(f"Unsafe SQL identifier: {value!r}")
    return f'"{value}"'


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", help="Optional PostgreSQL URL override. Defaults to the configured storage targets.")
    parser.add_argument("--policy", action="append", default=[], help="Retention policy key to run. May be passed multiple times.")
    parser.add_argument("--apply", action="store_true", help="Apply archive moves. Default is dry-run only.")
    parser.add_argument(
        "--purge-archive",
        action="store_true",
        help="Allow permanent deletion from archive tables. Requires a fresh backup/restore smoke report.",
    )
    parser.add_argument(
        "--backup-restore-report",
        help="Path to a JSON report from scripts/compose-backup-restore-smoke.sh. Required with --purge-archive.",
    )
    parser.add_argument(
        "--max-backup-report-age-hours",
        type=int,
        default=24,
        help="Maximum age of the backup/restore smoke report when --purge-archive is used.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=1000,
        help="Maximum rows archived or purged per SQL batch.",
    )
    parser.add_argument("--report-path", help="Optional path to write the JSON report.")
    return parser.parse_args()


def _targets(args: argparse.Namespace) -> list[str]:
    if args.database_url:
        return [args.database_url]
    settings = get_settings()
    return storage_postgres_targets(settings)


def _target_database_identity(database_url: str) -> dict[str, str]:
    engine = build_postgres_engine(database_url)
    with engine.connect() as connection:
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
        "database": str(row["database"]),
        "cluster_system_identifier": str(row["cluster_system_identifier"]),
        "database_url": redact_database_url(database_url),
    }


def _table_exists(engine, table_name: str) -> bool:
    return inspect(engine).has_table(table_name, schema="public")


def _timestamp_sql(policy: RetentionPolicy) -> str:
    return policy.timestamp_sql or _safe_ident(policy.timestamp_column)


def _eligibility_sql(policy: RetentionPolicy, *, cutoff_param: str = ":cutoff") -> str:
    clauses = [f"{_timestamp_sql(policy)} < {cutoff_param}"]
    if policy.eligibility_predicate_sql:
        clauses.append(f"({policy.eligibility_predicate_sql})")
    return " AND ".join(clauses)


def _eligible_stats(connection, *, table_name: str, policy: RetentionPolicy, cutoff: datetime) -> dict[str, Any]:
    row = (
        connection.execute(
            text(
                f"""
                SELECT
                  COUNT(*) AS eligible_rows,
                  MIN({_timestamp_sql(policy)}) AS oldest_eligible_at,
                  MAX({_timestamp_sql(policy)}) AS newest_eligible_at
                FROM public.{_safe_ident(table_name)}
                WHERE {_eligibility_sql(policy)}
                """
            ),
            {"cutoff": cutoff},
        )
        .mappings()
        .one()
    )
    return {
        "eligible_rows": int(row["eligible_rows"]),
        "oldest_eligible_at": row["oldest_eligible_at"].isoformat() if row["oldest_eligible_at"] is not None else None,
        "newest_eligible_at": row["newest_eligible_at"].isoformat() if row["newest_eligible_at"] is not None else None,
    }


def _ensure_archive_table(connection, policy: RetentionPolicy) -> None:
    connection.execute(
        text(
            f"""
            CREATE TABLE IF NOT EXISTS public.{_safe_ident(policy.archive_table)}
            (LIKE public.{_safe_ident(policy.source_table)} INCLUDING ALL)
            """
        )
    )


def _archive_batches(connection, *, policy: RetentionPolicy, cutoff: datetime, batch_size: int) -> int:
    moved_total = 0
    while True:
        moved = connection.execute(
            text(
                f"""
                WITH moved AS (
                  DELETE FROM public.{_safe_ident(policy.source_table)}
                  WHERE ctid IN (
                    SELECT ctid
                    FROM public.{_safe_ident(policy.source_table)}
                    WHERE {_eligibility_sql(policy)}
                    ORDER BY {_timestamp_sql(policy)} ASC
                    LIMIT :batch_size
                  )
                  RETURNING *
                ),
                archived AS (
                  INSERT INTO public.{_safe_ident(policy.archive_table)}
                  SELECT *
                  FROM moved
                  RETURNING 1
                )
                SELECT COUNT(*) AS moved_rows
                FROM archived
                """
            ),
            {"cutoff": cutoff, "batch_size": batch_size},
        ).scalar_one()
        moved_total += int(moved)
        if int(moved) == 0:
            break
    return moved_total


def _purge_batches(connection, *, table_name: str, policy: RetentionPolicy, cutoff: datetime, batch_size: int) -> int:
    purged_total = 0
    while True:
        purged = connection.execute(
            text(
                f"""
                WITH purged AS (
                  DELETE FROM public.{_safe_ident(table_name)}
                  WHERE ctid IN (
                    SELECT ctid
                    FROM public.{_safe_ident(table_name)}
                    WHERE {_eligibility_sql(policy)}
                    ORDER BY {_timestamp_sql(policy)} ASC
                    LIMIT :batch_size
                  )
                  RETURNING 1
                )
                SELECT COUNT(*) AS purged_rows
                FROM purged
                """
            ),
            {"cutoff": cutoff, "batch_size": batch_size},
        ).scalar_one()
        purged_total += int(purged)
        if int(purged) == 0:
            break
    return purged_total


def _run_policy(
    engine,
    *,
    policy: RetentionPolicy,
    apply_changes: bool,
    purge_archive: bool,
    batch_size: int,
) -> dict[str, Any]:
    now = datetime.now(tz=UTC)
    item: dict[str, Any] = {
        "key": policy.key,
        "active": policy.active,
        "description": policy.description,
        "source_table": policy.source_table,
        "archive_table": policy.archive_table,
        "timestamp_column": policy.timestamp_column,
        "timestamp_sql": policy.timestamp_sql,
        "eligibility_predicate_sql": policy.eligibility_predicate_sql,
        "hot_retention_days": policy.hot_retention_days,
        "archive_retention_days": policy.archive_retention_days,
        "hot_cutoff": policy.hot_cutoff(now).isoformat(),
        "archive_cutoff": policy.archive_cutoff(now).isoformat() if policy.archive_cutoff(now) is not None else None,
        "archived_rows": 0,
        "purged_archive_rows": 0,
    }

    if not policy.active:
        item["status"] = "planned"
        item["activation_note"] = policy.activation_note
        return item

    item["source_table_present"] = _table_exists(engine, policy.source_table)
    item["archive_table_present"] = _table_exists(engine, policy.archive_table)
    if not item["source_table_present"]:
        item["status"] = "missing_source_table"
        return item

    hot_cutoff = policy.hot_cutoff(now)
    with engine.connect() as connection:
        item["hot_eligible"] = _eligible_stats(
            connection,
            table_name=policy.source_table,
            policy=policy,
            cutoff=hot_cutoff,
        )
        archive_cutoff = policy.archive_cutoff(now)
        if item["archive_table_present"] and archive_cutoff is not None:
            item["archive_eligible"] = _eligible_stats(
                connection,
                table_name=policy.archive_table,
                policy=policy,
                cutoff=archive_cutoff,
            )
        else:
            item["archive_eligible"] = {
                "eligible_rows": 0,
                "oldest_eligible_at": None,
                "newest_eligible_at": None,
            }

    if not apply_changes:
        item["status"] = "dry_run"
        return item

    with engine.begin() as connection:
        _ensure_archive_table(connection, policy)
        item["archive_table_present"] = True
        item["archived_rows"] = _archive_batches(
            connection,
            policy=policy,
            cutoff=hot_cutoff,
            batch_size=batch_size,
        )
        if purge_archive and policy.archive_cutoff(now) is not None:
            item["purged_archive_rows"] = _purge_batches(
                connection,
                table_name=policy.archive_table,
                policy=policy,
                cutoff=policy.archive_cutoff(now),
                batch_size=batch_size,
            )

    item["status"] = "applied"
    return item


def _load_guard(
    path: str | None,
    *,
    expected_database_identities: list[dict[str, str]],
    max_age_hours: int,
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "required": True,
        "path": path,
        "expected_database_identities": expected_database_identities,
    }
    if not path:
        result["ok"] = False
        result["reason"] = "backup_restore_report_required"
        return result

    report_path = Path(path)
    if not report_path.exists():
        result["ok"] = False
        result["reason"] = "backup_restore_report_missing"
        return result

    try:
        payload = json.loads(report_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        result["ok"] = False
        result["reason"] = "backup_restore_report_invalid_json"
        return result

    guard = assess_backup_restore_guard(
        payload,
        expected_database_identities=expected_database_identities,
        max_age_hours=max_age_hours,
    )
    result.update(
        {
            "ok": guard.ok,
            "reason": guard.reason,
            "checked_at": guard.checked_at,
            "age_hours": guard.age_hours,
            "reported_database_identities": payload.get("validated_source_databases"),
        }
    )
    return result


def main() -> int:
    args = _parse_args()
    policies = select_policies(default_retention_policies(), args.policy)
    targets = _targets(args)
    if not targets:
        payload = {
            "status": "skipped",
            "reason": "no_postgresql_storage_targets",
            "generated_at": datetime.now(tz=UTC).isoformat(),
        }
        text_output = json.dumps(payload, indent=2)
        print(text_output)
        if args.report_path:
            Path(args.report_path).write_text(text_output + "\n", encoding="utf-8")
        return 0

    guard: dict[str, Any] | None = None
    target_database_identities: list[dict[str, str]] | None = None
    if args.purge_archive:
        target_database_identities = [_target_database_identity(target) for target in targets]
        guard = _load_guard(
            args.backup_restore_report,
            expected_database_identities=target_database_identities,
            max_age_hours=max(1, args.max_backup_report_age_hours),
        )
        if not guard.get("ok"):
            payload = {
                "status": "blocked",
                "reason": "backup_restore_guard_failed",
                "generated_at": datetime.now(tz=UTC).isoformat(),
                "purge_archive": True,
                "target_database_identities": target_database_identities,
                "backup_restore_guard": guard,
            }
            text_output = json.dumps(payload, indent=2)
            print(text_output)
            if args.report_path:
                Path(args.report_path).write_text(text_output + "\n", encoding="utf-8")
            return 2

    reports: list[dict[str, Any]] = []
    attention_required = False
    for target in targets:
        engine = build_postgres_engine(target)
        policy_reports: list[dict[str, Any]] = []
        for policy in policies:
            policy_report = _run_policy(
                engine,
                policy=policy,
                apply_changes=args.apply,
                purge_archive=args.purge_archive,
                batch_size=max(1, args.batch_size),
            )
            if policy_report.get("status") == "missing_source_table":
                attention_required = True
            policy_reports.append(policy_report)
        reports.append(
            {
                "database_url": redact_database_url(target),
                "policy_reports": policy_reports,
            }
        )

    payload = {
        "status": "attention_required" if attention_required else "ok",
        "mode": "apply" if args.apply else "dry_run",
        "purge_archive": args.purge_archive,
        "generated_at": datetime.now(tz=UTC).isoformat(),
        "target_database_identities": target_database_identities,
        "backup_restore_guard": guard,
        "reports": reports,
    }
    text_output = json.dumps(payload, indent=2)
    print(text_output)
    if args.report_path:
        Path(args.report_path).write_text(text_output + "\n", encoding="utf-8")
    return 2 if attention_required and args.apply else 0


if __name__ == "__main__":
    raise SystemExit(main())

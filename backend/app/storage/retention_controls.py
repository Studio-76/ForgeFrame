"""Retention policy helpers for ForgeFrame operational history."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Iterable, Sequence

from sqlalchemy.engine import make_url


@dataclass(frozen=True)
class RetentionPolicy:
    key: str
    source_table: str
    archive_table: str
    timestamp_column: str
    hot_retention_days: int
    archive_retention_days: int | None
    description: str
    timestamp_sql: str | None = None
    eligibility_predicate_sql: str | None = None
    archive_priority: int = 100
    active: bool = True
    activation_note: str | None = None

    def hot_cutoff(self, now: datetime) -> datetime:
        return now - timedelta(days=self.hot_retention_days)

    def archive_cutoff(self, now: datetime) -> datetime | None:
        if self.archive_retention_days is None:
            return None
        return now - timedelta(days=self.archive_retention_days)


@dataclass(frozen=True)
class BackupRestoreGuardResult:
    ok: bool
    reason: str
    checked_at: str | None = None
    age_hours: float | None = None


def default_retention_policies() -> tuple[RetentionPolicy, ...]:
    """Return active FOR-214 policies plus inactive placeholders for later history scopes."""

    return (
        RetentionPolicy(
            key="run_approval_links",
            source_table="run_approval_links",
            archive_table="run_approval_links_archive",
            timestamp_column="decided_at",
            timestamp_sql="COALESCE(resume_enqueued_at, decided_at, opened_at)",
            eligibility_predicate_sql="gate_status IN ('approved', 'rejected', 'timed_out', 'cancelled')",
            hot_retention_days=90,
            archive_retention_days=365,
            description="Completed approval-gate history tied to archived runs.",
            archive_priority=10,
            active=False,
            activation_note="Execution-pack retention remains out of scope for FOR-214. Keep this path planned until a dedicated follow-up issue activates it.",
        ),
        RetentionPolicy(
            key="run_outbox",
            source_table="run_outbox",
            archive_table="run_outbox_archive",
            timestamp_column="published_at",
            timestamp_sql="COALESCE(dead_lettered_at, published_at, created_at)",
            eligibility_predicate_sql="publish_state IN ('published', 'dead')",
            hot_retention_days=14,
            archive_retention_days=90,
            description="Terminal outbox publications and dead-letter rows. Pending or leased work stays hot.",
            archive_priority=10,
            active=False,
            activation_note="Execution-pack retention remains out of scope for FOR-214. Keep this path planned until a dedicated follow-up issue activates it.",
        ),
        RetentionPolicy(
            key="run_external_calls",
            source_table="run_external_calls",
            archive_table="run_external_calls_archive",
            timestamp_column="finished_at",
            timestamp_sql="COALESCE(finished_at, started_at, created_at)",
            eligibility_predicate_sql="call_status IN ('succeeded', 'retryable_failure', 'terminal_failure', 'cancelled')",
            hot_retention_days=30,
            archive_retention_days=180,
            description="Finished provider-call ledger for incident review, billing review, and compensation analysis.",
            archive_priority=10,
            active=False,
            activation_note="Execution-pack retention remains out of scope for FOR-214. Keep this path planned until a dedicated follow-up issue activates it.",
        ),
        RetentionPolicy(
            key="run_attempts",
            source_table="run_attempts",
            archive_table="run_attempts_archive",
            timestamp_column="finished_at",
            timestamp_sql="COALESCE(finished_at, updated_at, created_at)",
            eligibility_predicate_sql="attempt_state IN ('succeeded', 'failed', 'cancelled', 'timed_out', 'compensated', 'dead_lettered')",
            hot_retention_days=90,
            archive_retention_days=365,
            description="Per-attempt execution history for terminal run attempts.",
            archive_priority=20,
            active=False,
            activation_note="Execution-pack retention remains out of scope for FOR-214. Keep this path planned until a dedicated follow-up issue activates it.",
        ),
        RetentionPolicy(
            key="run_commands",
            source_table="run_commands",
            archive_table="run_commands_archive",
            timestamp_column="completed_at",
            timestamp_sql="COALESCE(completed_at, issued_at)",
            eligibility_predicate_sql="command_status IN ('completed', 'rejected')",
            hot_retention_days=90,
            archive_retention_days=365,
            description="Terminal command-admission history for duplicate and replay analysis.",
            archive_priority=20,
            active=False,
            activation_note="Execution-pack retention remains out of scope for FOR-214. Keep this path planned until a dedicated follow-up issue activates it.",
        ),
        RetentionPolicy(
            key="runs",
            source_table="runs",
            archive_table="runs_archive",
            timestamp_column="terminal_at",
            timestamp_sql="COALESCE(terminal_at, updated_at, created_at)",
            eligibility_predicate_sql="state IN ('succeeded', 'failed', 'cancelled', 'timed_out', 'compensated', 'dead_lettered')",
            hot_retention_days=90,
            archive_retention_days=365,
            description="Long-lived transactional run history for completed or terminal runs.",
            archive_priority=30,
            active=False,
            activation_note="Execution-pack retention remains out of scope for FOR-214. Keep this path planned until a dedicated follow-up issue activates it.",
        ),
        RetentionPolicy(
            key="harness_runs",
            source_table="harness_runs",
            archive_table="harness_runs_archive",
            timestamp_column="executed_at",
            hot_retention_days=30,
            archive_retention_days=180,
            description="Harness verify/probe/sync/runtime history for operator incident review.",
            archive_priority=40,
            active=False,
            activation_note="Harness history retention is a follow-up track. FOR-214 only activates raw observability and OAuth history retention.",
        ),
        RetentionPolicy(
            key="harness_snapshots",
            source_table="harness_snapshots",
            archive_table="harness_snapshots_archive",
            timestamp_column="created_at",
            hot_retention_days=14,
            archive_retention_days=90,
            description="Periodic control-plane snapshots exported by the harness service.",
            archive_priority=50,
            active=False,
            activation_note="Harness history retention is a follow-up track. FOR-214 only activates raw observability and OAuth history retention.",
        ),
        RetentionPolicy(
            key="usage_events",
            source_table="usage_events",
            archive_table="usage_events_archive",
            timestamp_column="created_at",
            hot_retention_days=30,
            archive_retention_days=180,
            description="Client/provider usage ledger for recent operational analytics.",
            archive_priority=60,
        ),
        RetentionPolicy(
            key="error_events",
            source_table="error_events",
            archive_table="error_events_archive",
            timestamp_column="created_at",
            hot_retention_days=30,
            archive_retention_days=180,
            description="Runtime and health-check error ledger used for incident review.",
            archive_priority=60,
        ),
        RetentionPolicy(
            key="health_events",
            source_table="health_events",
            archive_table="health_events_archive",
            timestamp_column="created_at",
            hot_retention_days=30,
            archive_retention_days=180,
            description="Provider/model health status timeline.",
            archive_priority=60,
        ),
        RetentionPolicy(
            key="oauth_operations",
            source_table="oauth_operations",
            archive_table="oauth_operations_archive",
            timestamp_column="executed_at",
            hot_retention_days=90,
            archive_retention_days=365,
            description="OAuth/account probe and bridge-sync history.",
            archive_priority=70,
        ),
    )


def select_policies(
    policies: Sequence[RetentionPolicy],
    requested_keys: Iterable[str] | None = None,
) -> list[RetentionPolicy]:
    available = {policy.key: policy for policy in policies}
    policy_order = {policy.key: index for index, policy in enumerate(policies)}
    if not requested_keys:
        return sorted(
            (policy for policy in policies if policy.active),
            key=lambda policy: (policy.archive_priority, policy_order[policy.key]),
        )

    selected: list[RetentionPolicy] = []
    missing: list[str] = []
    for key in requested_keys:
        policy = available.get(key)
        if policy is None:
            missing.append(key)
            continue
        selected.append(policy)
    if missing:
        available_keys = ", ".join(sorted(available))
        raise ValueError(f"Unknown retention policy key(s): {', '.join(sorted(missing))}. Available: {available_keys}")
    return sorted(selected, key=lambda policy: (policy.archive_priority, policy_order[policy.key]))


def redact_database_url(database_url: str) -> str:
    return make_url(database_url).render_as_string(hide_password=True)


def _normalize_validated_source_databases(value: Any) -> list[dict[str, str]] | None:
    if not isinstance(value, list) or not value:
        return None

    normalized: list[dict[str, str]] = []
    seen_keys: set[tuple[str, str]] = set()
    for item in value:
        if not isinstance(item, dict):
            return None
        database = item.get("database")
        cluster_system_identifier = item.get("cluster_system_identifier")
        if not isinstance(database, str) or not database.strip():
            return None
        if not isinstance(cluster_system_identifier, str) or not cluster_system_identifier.strip():
            return None
        normalized_item = {
            "database": database.strip(),
            "cluster_system_identifier": cluster_system_identifier.strip(),
        }
        key = (
            normalized_item["database"],
            normalized_item["cluster_system_identifier"],
        )
        if key in seen_keys:
            continue
        seen_keys.add(key)
        normalized.append(normalized_item)

    return sorted(normalized, key=lambda item: (item["database"], item["cluster_system_identifier"]))


def assess_backup_restore_guard(
    payload: dict[str, Any],
    *,
    expected_database_identities: Sequence[dict[str, str]] | None = None,
    now: datetime | None = None,
    max_age_hours: int = 24,
) -> BackupRestoreGuardResult:
    current_time = (now or datetime.now(tz=UTC)).astimezone(UTC)
    if payload.get("status") != "ok":
        return BackupRestoreGuardResult(ok=False, reason="backup_restore_report_status_not_ok")

    checked_at_raw = payload.get("checked_at") or payload.get("restored_at") or payload.get("created_at")
    if not isinstance(checked_at_raw, str) or not checked_at_raw.strip():
        return BackupRestoreGuardResult(ok=False, reason="backup_restore_report_missing_timestamp")

    try:
        checked_at = datetime.fromisoformat(checked_at_raw)
    except ValueError:
        return BackupRestoreGuardResult(ok=False, reason="backup_restore_report_invalid_timestamp")
    if checked_at.tzinfo is None:
        checked_at = checked_at.replace(tzinfo=UTC)
    checked_at = checked_at.astimezone(UTC)

    age = current_time - checked_at
    age_hours = max(0.0, age.total_seconds() / 3600)
    if age > timedelta(hours=max_age_hours):
        return BackupRestoreGuardResult(
            ok=False,
            reason="backup_restore_report_too_old",
            checked_at=checked_at.isoformat(),
            age_hours=age_hours,
        )

    if expected_database_identities is not None:
        normalized_expected = _normalize_validated_source_databases(list(expected_database_identities))
        if normalized_expected is None:
            raise ValueError("expected_database_identities must contain database and cluster_system_identifier entries.")
        reported_raw = payload.get("validated_source_databases")
        if reported_raw is None:
            return BackupRestoreGuardResult(
                ok=False,
                reason="backup_restore_report_missing_source_database_identities",
                checked_at=checked_at.isoformat(),
                age_hours=age_hours,
            )
        normalized_reported = _normalize_validated_source_databases(reported_raw)
        if normalized_reported is None:
            return BackupRestoreGuardResult(
                ok=False,
                reason="backup_restore_report_invalid_source_database_identities",
                checked_at=checked_at.isoformat(),
                age_hours=age_hours,
            )
        if normalized_reported != normalized_expected:
            return BackupRestoreGuardResult(
                ok=False,
                reason="backup_restore_report_source_database_mismatch",
                checked_at=checked_at.isoformat(),
                age_hours=age_hours,
            )

    return BackupRestoreGuardResult(
        ok=True,
        reason="ok",
        checked_at=checked_at.isoformat(),
        age_hours=age_hours,
    )

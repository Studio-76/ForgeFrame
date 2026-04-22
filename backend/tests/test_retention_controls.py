from datetime import UTC, datetime, timedelta

import pytest

from app.storage.retention_controls import (
    assess_backup_restore_guard,
    default_retention_policies,
    redact_database_url,
    select_policies,
)


def test_default_retention_policies_cover_current_execution_and_history_axes() -> None:
    policies = {policy.key: policy for policy in default_retention_policies()}

    assert policies["runs"].active is False
    assert policies["runs"].activation_note is not None
    assert policies["run_attempts"].timestamp_column == "finished_at"
    assert policies["run_approval_links"].eligibility_predicate_sql is not None
    assert policies["run_commands"].active is False
    assert policies["run_commands"].timestamp_column == "completed_at"
    assert policies["run_outbox"].active is False
    assert policies["run_outbox"].eligibility_predicate_sql == "publish_state IN ('published', 'dead')"
    assert policies["run_external_calls"].archive_table == "run_external_calls_archive"
    assert policies["harness_runs"].active is False
    assert policies["usage_events"].hot_retention_days == 30
    assert policies["usage_events"].active is True
    assert policies["oauth_operations"].archive_retention_days == 365
    assert policies["oauth_operations"].active is True


def test_select_policies_rejects_unknown_keys() -> None:
    with pytest.raises(ValueError):
        select_policies(default_retention_policies(), ["missing"])


def test_select_policies_defaults_to_active_for214_tables_only() -> None:
    selected = select_policies(default_retention_policies())

    assert [policy.key for policy in selected] == [
        "usage_events",
        "error_events",
        "health_events",
        "oauth_operations",
    ]


def test_select_policies_preserves_explicit_ordering_for_planned_follow_on_tables() -> None:
    selected = select_policies(default_retention_policies(), ["runs", "run_attempts", "run_outbox"])

    assert [policy.key for policy in selected] == ["run_outbox", "run_attempts", "runs"]


def test_backup_restore_guard_accepts_recent_success_report() -> None:
    now = datetime(2026, 4, 21, 19, 0, tzinfo=UTC)

    result = assess_backup_restore_guard(
        {
            "status": "ok",
            "checked_at": (now - timedelta(hours=2)).isoformat(),
        },
        now=now,
        max_age_hours=24,
    )

    assert result.ok is True
    assert result.reason == "ok"
    assert result.age_hours is not None and result.age_hours < 3


def test_backup_restore_guard_requires_matching_source_database_identity() -> None:
    now = datetime(2026, 4, 21, 19, 0, tzinfo=UTC)
    expected_database_identities = [
        {
            "database": "forgegate",
            "cluster_system_identifier": "7426941660718540057",
        }
    ]

    matching = assess_backup_restore_guard(
        {
            "status": "ok",
            "checked_at": (now - timedelta(hours=2)).isoformat(),
            "validated_source_databases": [
                {
                    "database": "forgegate",
                    "cluster_system_identifier": "7426941660718540057",
                }
            ],
        },
        now=now,
        expected_database_identities=expected_database_identities,
    )
    missing = assess_backup_restore_guard(
        {
            "status": "ok",
            "checked_at": (now - timedelta(hours=2)).isoformat(),
        },
        now=now,
        expected_database_identities=expected_database_identities,
    )
    mismatched = assess_backup_restore_guard(
        {
            "status": "ok",
            "checked_at": (now - timedelta(hours=2)).isoformat(),
            "validated_source_databases": [
                {
                    "database": "forgegate_restore_smoke",
                    "cluster_system_identifier": "7426941660718540057",
                }
            ],
        },
        now=now,
        expected_database_identities=expected_database_identities,
    )

    assert matching.ok is True
    assert matching.reason == "ok"
    assert missing.ok is False
    assert missing.reason == "backup_restore_report_missing_source_database_identities"
    assert mismatched.ok is False
    assert mismatched.reason == "backup_restore_report_source_database_mismatch"


def test_backup_restore_guard_rejects_failed_or_stale_report() -> None:
    now = datetime(2026, 4, 21, 19, 0, tzinfo=UTC)

    failed = assess_backup_restore_guard({"status": "failed"}, now=now)
    stale = assess_backup_restore_guard(
        {
            "status": "ok",
            "checked_at": (now - timedelta(hours=30)).isoformat(),
        },
        now=now,
        max_age_hours=24,
    )

    assert failed.ok is False
    assert failed.reason == "backup_restore_report_status_not_ok"
    assert stale.ok is False
    assert stale.reason == "backup_restore_report_too_old"


def test_redact_database_url_hides_password() -> None:
    redacted = redact_database_url("postgresql+psycopg://forgegate:secret@localhost:5432/forgegate")

    assert "secret" not in redacted
    assert "***" in redacted

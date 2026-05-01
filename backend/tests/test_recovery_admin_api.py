from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import pytest
from conftest import admin_headers as shared_admin_headers
from fastapi.testclient import TestClient

from app.main import app


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


def _target_config(target_class: str, tmp_path: Path) -> dict[str, object]:
    if target_class == "local_secondary_disk":
        path = tmp_path / "local-secondary"
        path.mkdir(parents=True, exist_ok=True)
        return {"path": str(path)}
    if target_class == "nas_share":
        path = tmp_path / "nas-share"
        path.mkdir(parents=True, exist_ok=True)
        return {"path": str(path)}
    if target_class == "second_host":
        return {"host": "localhost", "path": "/srv/forgeframe"}
    if target_class == "offsite_copy":
        return {
            "host": "localhost",
            "destination_uri": "ssh://localhost/srv/forgeframe-offsite",
        }
    if target_class == "object_storage":
        return {"provider": "s3", "bucket": "forgeframe-prod", "prefix": "nightly"}
    raise AssertionError(f"Unsupported target class {target_class}")


@pytest.mark.parametrize(
    "target_class",
    [
        "local_secondary_disk",
        "second_host",
        "nas_share",
        "offsite_copy",
        "object_storage",
    ],
)
def test_recovery_admin_api_supports_backup_and_restore_evidence_for_every_target_class(
    target_class: str,
    tmp_path: Path,
) -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    policy_id = f"policy_{target_class}_{uuid4().hex[:8]}"
    created = client.post(
        "/admin/recovery/backup-policies",
        headers=headers,
        json={
            "policy_id": policy_id,
            "label": f"Policy {target_class}",
            "target_class": target_class,
            "target_label": f"Target {target_class}",
            "target_config": _target_config(target_class, tmp_path),
            "protected_data_classes": ["database", "artifact_metadata"],
            "expected_source_identity": {
                "source_database": "forgeframe",
                "cluster_system_identifier": "cluster-123",
                "deployment_slug": "forgeframe-prod",
                "public_fqdn": "forgeframe.example.com",
            },
            "schedule_hint": "nightly",
            "max_backup_age_hours": 24,
            "max_restore_age_hours": 168,
            "notes": "Spec 10 target-class coverage.",
        },
    )
    assert created.status_code == 201
    assert created.json()["policy"]["policy"]["target_class"] == target_class

    backup = client.post(
        "/admin/recovery/backup-reports/import",
        headers=headers,
        json={
            "policy_id": policy_id,
            "manifest": {
                "backup_path": f"/var/backups/forgeframe/{target_class}.dump",
                "manifest_path": f"/var/backups/forgeframe/{target_class}.dump.json",
                "database": "forgeframe",
                "cluster_system_identifier": "cluster-123",
                "deployment_slug": "forgeframe-prod",
                "public_fqdn": "forgeframe.example.com",
                "created_at": datetime.now(tz=UTC).isoformat(),
                "byte_size": 2048,
                "checksum_sha256": f"checksum-{target_class}",
            },
            "protected_data_classes": ["database", "artifact_metadata"],
        },
    )
    assert backup.status_code == 201
    assert backup.json()["report"]["source_identity_match"] is True
    assert backup.json()["report"]["coverage_match"] is True

    restore = client.post(
        "/admin/recovery/restore-reports/import",
        headers=headers,
        json={
            "policy_id": policy_id,
            "report": {
                "restored_database": f"forgeframe_restore_{target_class}",
                "source_database": "forgeframe",
                "source_cluster_system_identifier": "cluster-123",
                "deployment_slug": "forgeframe-prod",
                "public_fqdn": "forgeframe.example.com",
                "validated_source_databases": [
                    {
                        "database": "forgeframe",
                        "cluster_system_identifier": "cluster-123",
                    },
                ],
                "tables_compared": 12,
                "checked_at": datetime.now(tz=UTC).isoformat(),
            },
            "protected_data_classes": ["database", "artifact_metadata"],
        },
    )
    assert restore.status_code == 201
    assert restore.json()["report"]["source_identity_match"] is True
    assert restore.json()["report"]["coverage_match"] is True

    overview = client.get("/admin/recovery/", headers=headers)
    assert overview.status_code == 200
    payload = overview.json()
    policy = next(item for item in payload["policies"] if item["policy"]["policy_id"] == policy_id)
    assert policy["policy"]["target_class"] == target_class
    assert policy["latest_backup"]["status"] == "ok"
    assert policy["latest_restore"]["tables_compared"] == 12
    assert policy["source_identity_verified"] is True
    assert policy["backup_fresh"] is True
    assert policy["restore_fresh"] is True


def test_recovery_admin_api_detects_stale_reports_coverage_gaps_and_source_identity_mismatches(
    tmp_path: Path,
) -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    policy_id = f"policy_stale_{uuid4().hex[:8]}"
    created = client.post(
        "/admin/recovery/backup-policies",
        headers=headers,
        json={
            "policy_id": policy_id,
            "label": "Stale backup policy",
            "target_class": "local_secondary_disk",
            "target_config": {"path": str(tmp_path)},
            "protected_data_classes": [
                "database",
                "artifact_metadata",
                "blob_contents",
            ],
            "expected_source_identity": {
                "source_database": "forgeframe",
                "cluster_system_identifier": "cluster-123",
            },
            "max_backup_age_hours": 1,
            "max_restore_age_hours": 1,
        },
    )
    assert created.status_code == 201

    old_timestamp = (datetime.now(tz=UTC) - timedelta(hours=8)).isoformat()
    backup = client.post(
        "/admin/recovery/backup-reports/import",
        headers=headers,
        json={
            "policy_id": policy_id,
            "manifest": {
                "backup_path": "/var/backups/forgeframe/stale.dump",
                "manifest_path": "/var/backups/forgeframe/stale.dump.json",
                "database": "forgeframe",
                "cluster_system_identifier": "cluster-123",
                "created_at": old_timestamp,
            },
            "protected_data_classes": ["database"],
        },
    )
    assert backup.status_code == 201

    restore = client.post(
        "/admin/recovery/restore-reports/import",
        headers=headers,
        json={
            "policy_id": policy_id,
            "report": {
                "restored_database": "forgeframe_restore_stale",
                "source_database": "wrong-db",
                "source_cluster_system_identifier": "wrong-cluster",
                "validated_source_databases": [
                    {
                        "database": "wrong-db",
                        "cluster_system_identifier": "wrong-cluster",
                    },
                ],
                "checked_at": old_timestamp,
                "tables_compared": 3,
            },
            "protected_data_classes": ["database"],
        },
    )
    assert restore.status_code == 201
    assert restore.json()["report"]["source_identity_match"] is False
    assert restore.json()["report"]["coverage_match"] is False

    overview = client.get("/admin/recovery/", headers=headers)
    assert overview.status_code == 200
    policy = next(item for item in overview.json()["policies"] if item["policy"]["policy_id"] == policy_id)
    assert policy["overall_status"] == "blocked"
    assert policy["backup_fresh"] is False
    assert policy["restore_fresh"] is False
    assert "backup_report_stale" in policy["mismatches"]
    assert "restore_report_stale" in policy["mismatches"]
    assert "source_database_mismatch" in policy["mismatches"]
    assert "cluster_system_identifier_mismatch" in policy["mismatches"]
    assert "missing_coverage:artifact_metadata" in policy["mismatches"]
    assert "missing_coverage:blob_contents" in policy["mismatches"]


def test_recovery_admin_api_rejects_structurally_invalid_backup_and_restore_reports(
    tmp_path: Path,
) -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    policy_id = f"policy_invalid_reports_{uuid4().hex[:8]}"

    created = client.post(
        "/admin/recovery/backup-policies",
        headers=headers,
        json={
            "policy_id": policy_id,
            "label": "Invalid report policy",
            "target_class": "local_secondary_disk",
            "target_config": {"path": str(tmp_path)},
            "protected_data_classes": ["database"],
            "expected_source_identity": {
                "source_database": "forgeframe",
                "cluster_system_identifier": "cluster-123",
            },
        },
    )
    assert created.status_code == 201

    invalid_backup = client.post(
        "/admin/recovery/backup-reports/import",
        headers=headers,
        json={
            "policy_id": policy_id,
            "manifest": {
                "database": "forgeframe",
                "cluster_system_identifier": "cluster-123",
            },
        },
    )
    assert invalid_backup.status_code == 400
    assert invalid_backup.json()["error"]["type"] == "recovery_backup_report_invalid"
    assert "backup_path" in invalid_backup.json()["error"]["message"]

    invalid_restore = client.post(
        "/admin/recovery/restore-reports/import",
        headers=headers,
        json={
            "policy_id": policy_id,
            "report": {
                "source_database": "forgeframe",
                "source_cluster_system_identifier": "cluster-123",
            },
        },
    )
    assert invalid_restore.status_code == 400
    assert invalid_restore.json()["error"]["type"] == "recovery_restore_report_invalid"
    assert "restored_database" in invalid_restore.json()["error"]["message"]

    invalid_restore_tables = client.post(
        "/admin/recovery/restore-reports/import",
        headers=headers,
        json={
            "policy_id": policy_id,
            "report": {
                "restored_database": "forgeframe_restore_invalid",
                "source_database": "forgeframe",
                "source_cluster_system_identifier": "cluster-123",
                "tables_compared": 1.5,
            },
        },
    )
    assert invalid_restore_tables.status_code == 400
    assert invalid_restore_tables.json()["error"]["type"] == "recovery_restore_report_invalid"
    assert "tables_compared" in invalid_restore_tables.json()["error"]["message"]

    missing_backup_policy = client.post(
        "/admin/recovery/backup-reports/import",
        headers=headers,
        json={
            "policy_id": "policy_missing",
            "manifest": {
                "backup_path": "/var/backups/forgeframe/latest.dump",
                "manifest_path": "/var/backups/forgeframe/latest.dump.json",
                "database": "forgeframe",
                "cluster_system_identifier": "cluster-123",
            },
        },
    )
    assert missing_backup_policy.status_code == 404
    assert missing_backup_policy.json()["error"]["type"] == "recovery_policy_not_found"

    missing_restore_policy = client.post(
        "/admin/recovery/restore-reports/import",
        headers=headers,
        json={
            "policy_id": "policy_missing",
            "report": {
                "restored_database": "forgeframe_restore_missing",
                "source_database": "forgeframe",
                "source_cluster_system_identifier": "cluster-123",
                "tables_compared": 12,
            },
        },
    )
    assert missing_restore_policy.status_code == 404
    assert missing_restore_policy.json()["error"]["type"] == "recovery_policy_not_found"


def test_recovery_admin_api_treats_paused_policies_as_non_effective_protection(
    tmp_path: Path,
) -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    policy_id = f"policy_paused_{uuid4().hex[:8]}"
    before = client.get("/admin/recovery/", headers=headers)
    assert before.status_code == 200
    before_payload = before.json()

    created = client.post(
        "/admin/recovery/backup-policies",
        headers=headers,
        json={
            "policy_id": policy_id,
            "label": "Paused backup policy",
            "status": "paused",
            "target_class": "local_secondary_disk",
            "target_config": {"path": str(tmp_path)},
            "protected_data_classes": ["database"],
            "expected_source_identity": {
                "source_database": "forgeframe",
                "cluster_system_identifier": "cluster-123",
            },
        },
    )
    assert created.status_code == 201

    backup = client.post(
        "/admin/recovery/backup-reports/import",
        headers=headers,
        json={
            "policy_id": policy_id,
            "manifest": {
                "backup_path": "/var/backups/forgeframe/paused.dump",
                "manifest_path": "/var/backups/forgeframe/paused.dump.json",
                "database": "forgeframe",
                "cluster_system_identifier": "cluster-123",
                "created_at": datetime.now(tz=UTC).isoformat(),
            },
            "protected_data_classes": ["database"],
        },
    )
    assert backup.status_code == 201

    restore = client.post(
        "/admin/recovery/restore-reports/import",
        headers=headers,
        json={
            "policy_id": policy_id,
            "report": {
                "restored_database": "forgeframe_restore_paused",
                "source_database": "forgeframe",
                "source_cluster_system_identifier": "cluster-123",
                "validated_source_databases": [
                    {
                        "database": "forgeframe",
                        "cluster_system_identifier": "cluster-123",
                    },
                ],
                "checked_at": datetime.now(tz=UTC).isoformat(),
                "tables_compared": 12,
            },
            "protected_data_classes": ["database"],
        },
    )
    assert restore.status_code == 201

    overview = client.get("/admin/recovery/", headers=headers)
    assert overview.status_code == 200
    payload = overview.json()
    policy = next(item for item in payload["policies"] if item["policy"]["policy_id"] == policy_id)
    assert policy["overall_status"] == "warning"
    assert "policy_paused_non_effective" in policy["mismatches"]
    assert payload["summary"]["active_policies"] == before_payload["summary"]["active_policies"]
    assert payload["summary"]["healthy_policies"] == before_payload["summary"]["healthy_policies"]
    assert payload["summary"]["fresh_backup_policies"] == before_payload["summary"]["fresh_backup_policies"]
    assert payload["summary"]["fresh_restore_policies"] == before_payload["summary"]["fresh_restore_policies"]
    assert payload["summary"]["source_identity_verified_policies"] == before_payload["summary"]["source_identity_verified_policies"]


def test_recovery_admin_api_rejects_semantically_invalid_upgrade_reports() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    response = client.post(
        "/admin/recovery/upgrade-reports/import",
        headers=headers,
        json={
            "report": {
                "release_id": f"release-{uuid4().hex[:8]}",
                "target_version": "0.6.0",
                "upgrade_result": "succeeded",
                "rollback_classification": "manual_failover",
                "failure_classification": "fatal",
                "before": {
                    "source_identity": {
                        "source_database": "forgeframe",
                        "cluster_system_identifier": "cluster-123",
                    },
                    "migration": {"latest_version": 28},
                    "critical_object_counts": {"runs": 12},
                    "queue_state_counts": {"queued": 0, "executing": 0},
                },
                "after": {
                    "source_identity": {
                        "source_database": "forgeframe",
                        "cluster_system_identifier": "cluster-123",
                    },
                    "migration": {"latest_version": 29},
                    "critical_object_counts": {"runs": 12},
                    "queue_state_counts": {"queued": 0, "executing": 0},
                },
            },
        },
    )
    assert response.status_code == 400
    assert response.json()["error"]["type"] == "recovery_upgrade_report_invalid"
    assert "rollback_classification" in response.json()["error"]["message"]

    empty_snapshot_response = client.post(
        "/admin/recovery/upgrade-reports/import",
        headers=headers,
        json={
            "report": {
                "release_id": f"release-{uuid4().hex[:8]}",
                "target_version": "0.6.0",
                "upgrade_result": "succeeded",
                "rollback_classification": "not_needed",
                "failure_classification": "none",
                "before": {},
                "after": {},
            },
        },
    )
    assert empty_snapshot_response.status_code == 400
    assert empty_snapshot_response.json()["error"]["type"] == "recovery_upgrade_report_invalid"
    assert "before or before_snapshot" in empty_snapshot_response.json()["error"]["message"]


def test_runtime_health_surface_includes_recovery_protection_signal() -> None:
    client = TestClient(app)
    health = client.get("/health")
    assert health.status_code == 200
    payload = health.json()
    check_ids = {item["id"] for item in payload["readiness"]["checks"]}
    assert "recovery_protection" in check_ids
    assert "upgrade_integrity" in check_ids


def test_recovery_admin_api_persists_upgrade_no_loss_proof_and_surfaces_release_posture() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    response = client.post(
        "/admin/recovery/upgrade-reports/import",
        headers=headers,
        json={
            "report": {
                "release_id": "release-2026-04-23",
                "target_version": "0.6.0",
                "upgrade_result": "succeeded",
                "rollback_classification": "not_needed",
                "failure_classification": "none",
                "bootstrap_recovery_state": "recovered",
                "before": {
                    "captured_at": "2026-04-23T08:00:00Z",
                    "source_identity": {
                        "source_database": "forgeframe",
                        "cluster_system_identifier": "cluster-123",
                        "deployment_slug": "forgeframe-prod",
                        "public_fqdn": "forgeframe.example.com",
                    },
                    "migration": {"latest_version": 28, "applied_versions": [1, 2, 28]},
                    "critical_object_counts": {
                        "runs": 12,
                        "run_commands": 12,
                        "run_attempts": 12,
                        "run_approval_links": 3,
                        "memory_entries": 8,
                        "skills": 2,
                        "skill_versions": 2,
                        "skill_activations": 1,
                        "learning_events": 4,
                        "assistant_profiles": 1,
                    },
                    "queue_state_counts": {"queued": 0, "executing": 0},
                },
                "after": {
                    "captured_at": "2026-04-23T08:10:00Z",
                    "source_identity": {
                        "source_database": "forgeframe",
                        "cluster_system_identifier": "cluster-123",
                        "deployment_slug": "forgeframe-prod",
                        "public_fqdn": "forgeframe.example.com",
                    },
                    "migration": {"latest_version": 29, "applied_versions": [1, 2, 29]},
                    "critical_object_counts": {
                        "runs": 12,
                        "run_commands": 12,
                        "run_attempts": 12,
                        "run_approval_links": 3,
                        "memory_entries": 8,
                        "skills": 2,
                        "skill_versions": 2,
                        "skill_activations": 1,
                        "learning_events": 4,
                        "assistant_profiles": 1,
                    },
                    "queue_state_counts": {"queued": 0, "executing": 0},
                },
            }
        },
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload["report"]["status"] == "ok"
    assert payload["report"]["no_loss_ok"] is True
    assert payload["report"]["queue_drain_ok"] is True
    assert payload["report"]["source_identity_stable"] is True
    assert payload["upgrade_posture"]["runtime_status"] == "ok"

    overview = client.get("/admin/recovery/", headers=headers)
    assert overview.status_code == 200
    overview_payload = overview.json()
    assert overview_payload["upgrade_posture"]["latest_release_id"] == "release-2026-04-23"
    assert overview_payload["upgrade_posture"]["runtime_status"] == "ok"
    assert overview_payload["recent_upgrades"][0]["upgrade_result"] == "succeeded"


def test_recovery_admin_api_blocks_upgrade_posture_when_counts_drop_or_source_changes() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    response = client.post(
        "/admin/recovery/upgrade-reports/import",
        headers=headers,
        json={
            "report": {
                "release_id": "release-2026-04-24",
                "target_version": "0.6.1",
                "upgrade_result": "partial_failure",
                "rollback_classification": "restore_backup",
                "failure_classification": "migration_failed",
                "bootstrap_recovery_state": "manual_follow_up",
                "before": {
                    "captured_at": "2026-04-24T08:00:00Z",
                    "source_identity": {
                        "source_database": "forgeframe",
                        "cluster_system_identifier": "cluster-123",
                    },
                    "migration": {"latest_version": 29},
                    "critical_object_counts": {
                        "runs": 12,
                        "run_approval_links": 3,
                        "memory_entries": 8,
                        "skills": 2,
                    },
                    "queue_state_counts": {"queued": 1, "executing": 0},
                },
                "after": {
                    "captured_at": "2026-04-24T08:15:00Z",
                    "source_identity": {
                        "source_database": "forgeframe_restore",
                        "cluster_system_identifier": "cluster-999",
                    },
                    "migration": {"latest_version": 28},
                    "critical_object_counts": {
                        "runs": 11,
                        "run_approval_links": 2,
                        "memory_entries": 7,
                        "skills": 1,
                    },
                    "queue_state_counts": {"queued": 0, "executing": 1},
                },
            }
        },
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload["report"]["status"] == "failed"
    assert payload["report"]["no_loss_ok"] is False
    assert payload["report"]["queue_drain_ok"] is False
    assert payload["report"]["source_identity_stable"] is False
    assert "migration_version_regressed" in payload["report"]["mismatch_reasons"]
    assert "count_decreased:runs:12->11" in payload["report"]["mismatch_reasons"]
    assert "source_database_changed_across_upgrade" in payload["report"]["mismatch_reasons"]
    assert payload["upgrade_posture"]["runtime_status"] == "blocked"

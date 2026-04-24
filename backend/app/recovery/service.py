"""Recovery-domain service for backup and restore product truth."""

from __future__ import annotations

import socket
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.recovery.models import (
    BACKUP_TARGET_CLASSES,
    PROTECTED_DATA_CLASSES,
    CreateRecoveryBackupPolicy,
    ImportRecoveryBackupReport,
    ImportRecoveryRestoreReport,
    ImportRecoveryUpgradeReport,
    RecoveryBackupPolicyRecord,
    RecoveryBackupReportRecord,
    RecoveryOverviewRecord,
    RecoveryOverviewSummary,
    RecoveryPolicySummary,
    RecoveryPolicyValidation,
    RecoveryRestoreReportRecord,
    RecoverySourceIdentity,
    RecoveryUpgradePosture,
    RecoveryUpgradeReportRecord,
    RecoveryUpgradeSnapshot,
    UpdateRecoveryBackupPolicy,
)
from app.storage.recovery_repository import (
    RecoveryBackupPolicyORM,
    RecoveryBackupReportORM,
    RecoveryRestoreReportORM,
    RecoveryUpgradeReportORM,
)


def _now() -> datetime:
    return datetime.now(tz=UTC)


def _now_iso() -> str:
    return _now().isoformat()


def _parse_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    parsed = datetime.fromisoformat(normalized.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


CRITICAL_OBJECT_CLASSES = (
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


def _trim_dict_strings(payload: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for key, value in payload.items():
        if isinstance(value, str):
            normalized[key] = value.strip()
        else:
            normalized[key] = value
    return normalized


class RecoveryAdminService:
    def __init__(self, session_factory: sessionmaker) -> None:
        self._session_factory = session_factory

    def _policy_record(self, row: RecoveryBackupPolicyORM) -> RecoveryBackupPolicyRecord:
        return RecoveryBackupPolicyRecord(
            policy_id=row.id,
            label=row.label,
            status=row.status,
            target_class=row.target_class,
            target_label=row.target_label,
            target_config=dict(row.target_config_json or {}),
            protected_data_classes=list(row.protected_data_classes_json or []),
            expected_source_identity=RecoverySourceIdentity(**dict(row.expected_source_identity_json or {})),
            schedule_hint=row.schedule_hint,
            max_backup_age_hours=row.max_backup_age_hours,
            max_restore_age_hours=row.max_restore_age_hours,
            notes=row.notes,
            created_at=row.created_at.astimezone(UTC).isoformat(),
            updated_at=row.updated_at.astimezone(UTC).isoformat(),
        )

    def _backup_report_record(self, row: RecoveryBackupReportORM) -> RecoveryBackupReportRecord:
        return RecoveryBackupReportRecord(
            report_id=row.id,
            policy_id=row.policy_id,
            status=row.status,
            protected_data_classes=list(row.protected_data_classes_json or []),
            source_identity=RecoverySourceIdentity(**dict(row.source_identity_json or {})),
            target_locator=row.target_locator,
            backup_path=row.backup_path,
            manifest_path=row.manifest_path,
            byte_size=row.byte_size,
            checksum_sha256=row.checksum_sha256,
            source_identity_match=bool(row.source_identity_match),
            coverage_match=bool(row.coverage_match),
            mismatch_reasons=list(row.mismatch_reasons_json or []),
            raw_report=dict(row.raw_report_json or {}),
            created_at=row.created_at.astimezone(UTC).isoformat(),
            imported_at=row.imported_at.astimezone(UTC).isoformat(),
            notes=row.notes,
        )

    def _restore_report_record(self, row: RecoveryRestoreReportORM) -> RecoveryRestoreReportRecord:
        return RecoveryRestoreReportRecord(
            report_id=row.id,
            policy_id=row.policy_id,
            status=row.status,
            protected_data_classes=list(row.protected_data_classes_json or []),
            source_identity=RecoverySourceIdentity(**dict(row.source_identity_json or {})),
            validated_source_identities=[
                RecoverySourceIdentity(**dict(item))
                for item in list(row.validated_source_identities_json or [])
            ],
            restored_database=row.restored_database,
            tables_compared=row.tables_compared,
            source_identity_match=bool(row.source_identity_match),
            coverage_match=bool(row.coverage_match),
            mismatch_reasons=list(row.mismatch_reasons_json or []),
            raw_report=dict(row.raw_report_json or {}),
            created_at=row.created_at.astimezone(UTC).isoformat(),
            imported_at=row.imported_at.astimezone(UTC).isoformat(),
            notes=row.notes,
        )

    def _upgrade_snapshot(self, payload: dict[str, Any]) -> RecoveryUpgradeSnapshot:
        normalized = dict(payload or {})
        migration = normalized.get("migration")
        if isinstance(migration, dict):
            if "latest_version" in migration and "migration_version" not in normalized:
                normalized["migration_version"] = migration.get("latest_version")
            if "applied_versions" in migration and "applied_migration_versions" not in normalized:
                normalized["applied_migration_versions"] = migration.get("applied_versions")
        return RecoveryUpgradeSnapshot(
            captured_at=normalized.get("captured_at") or normalized.get("generated_at"),
            source_identity=RecoverySourceIdentity(**dict(normalized.get("source_identity") or {})),
            migration_version=(
                int(normalized["migration_version"])
                if normalized.get("migration_version") is not None
                else None
            ),
            applied_migration_versions=list(normalized.get("applied_migration_versions") or []),
            critical_object_counts=dict(normalized.get("critical_object_counts") or {}),
            queue_state_counts=dict(normalized.get("queue_state_counts") or {}),
            database_targets=list(normalized.get("database_targets") or []),
        )

    def _upgrade_report_record(self, row: RecoveryUpgradeReportORM) -> RecoveryUpgradeReportRecord:
        return RecoveryUpgradeReportRecord(
            report_id=row.id,
            release_id=row.release_id,
            target_version=row.target_version,
            status=row.status,
            upgrade_result=row.upgrade_result,
            rollback_classification=row.rollback_classification,
            failure_classification=row.failure_classification,
            bootstrap_recovery_state=row.bootstrap_recovery_state,
            before_snapshot=self._upgrade_snapshot(dict(row.before_snapshot_json or {})),
            after_snapshot=self._upgrade_snapshot(dict(row.after_snapshot_json or {})),
            no_loss_ok=bool(row.no_loss_ok),
            queue_drain_ok=bool(row.queue_drain_ok),
            source_identity_stable=bool(row.source_identity_stable),
            mismatch_reasons=list(row.mismatch_reasons_json or []),
            raw_report=dict(row.raw_report_json or {}),
            created_at=row.created_at.astimezone(UTC).isoformat(),
            imported_at=row.imported_at.astimezone(UTC).isoformat(),
            notes=row.notes,
        )

    def _policy_target_locator(self, policy: RecoveryBackupPolicyRecord) -> str:
        config = policy.target_config
        if policy.target_class in {"local_secondary_disk", "nas_share"}:
            return str(config.get("path") or config.get("mount_path") or policy.target_label).strip()
        if policy.target_class in {"second_host", "offsite_copy"}:
            host = str(config.get("host") or "").strip()
            destination = str(config.get("path") or config.get("destination_uri") or "").strip()
            if host and destination:
                return f"{host}:{destination}"
            return host or destination or policy.target_label
        if policy.target_class == "object_storage":
            provider = str(config.get("provider") or config.get("endpoint_url") or "object-storage").strip()
            bucket = str(config.get("bucket") or "").strip()
            prefix = str(config.get("prefix") or "").strip()
            return f"{provider}:{bucket}/{prefix}".rstrip("/")
        return policy.target_label

    def _validate_target_config(self, policy: RecoveryBackupPolicyRecord) -> RecoveryPolicyValidation:
        reasons: list[str] = []
        target_locator = self._policy_target_locator(policy)
        config = _trim_dict_strings(dict(policy.target_config))
        state = "ok"

        if policy.target_class in {"local_secondary_disk", "nas_share"}:
            path_value = str(config.get("path") or config.get("mount_path") or "").strip()
            if not path_value:
                reasons.append("target_path_missing")
                state = "blocked"
            else:
                candidate = Path(path_value)
                if not candidate.is_absolute():
                    reasons.append("target_path_not_absolute")
                    state = "blocked"
                elif not candidate.exists():
                    reasons.append("target_path_missing_on_host")
                    state = "warning"
                elif not candidate.is_dir():
                    reasons.append("target_path_not_directory")
                    state = "blocked"
        elif policy.target_class == "second_host":
            host = str(config.get("host") or "").strip()
            remote_path = str(config.get("path") or config.get("destination_uri") or "").strip()
            if not host:
                reasons.append("second_host_missing")
                state = "blocked"
            if not remote_path:
                reasons.append("second_host_path_missing")
                state = "blocked"
            if host:
                try:
                    socket.getaddrinfo(host, None)
                except OSError:
                    reasons.append("second_host_dns_unresolved")
                    state = "warning" if state != "blocked" else state
        elif policy.target_class == "offsite_copy":
            host = str(config.get("host") or "").strip()
            destination_uri = str(config.get("destination_uri") or config.get("path") or "").strip()
            if not destination_uri:
                reasons.append("offsite_destination_missing")
                state = "blocked"
            if not host and "://" not in destination_uri:
                reasons.append("offsite_transport_not_explicit")
                state = "warning" if state != "blocked" else state
            if host:
                try:
                    socket.getaddrinfo(host, None)
                except OSError:
                    reasons.append("offsite_host_dns_unresolved")
                    state = "warning" if state != "blocked" else state
        elif policy.target_class == "object_storage":
            bucket = str(config.get("bucket") or "").strip()
            provider = str(config.get("provider") or "").strip()
            endpoint = str(config.get("endpoint_url") or "").strip()
            if not bucket:
                reasons.append("object_storage_bucket_missing")
                state = "blocked"
            if not provider and not endpoint:
                reasons.append("object_storage_provider_missing")
                state = "blocked"
        else:
            reasons.append("unsupported_target_class")
            state = "blocked"

        if not policy.protected_data_classes:
            reasons.append("protected_data_classes_missing")
            state = "blocked"
        if policy.expected_source_identity.source_database and not policy.expected_source_identity.cluster_system_identifier:
            reasons.append("cluster_system_identifier_not_pinned")
            state = "warning" if state != "blocked" else state

        return RecoveryPolicyValidation(
            state=state,  # type: ignore[arg-type]
            reasons=reasons,
            target_locator=target_locator,
            checked_at=_now_iso(),
        )

    def _extract_source_identity(self, raw_report: dict[str, Any]) -> RecoverySourceIdentity:
        source_database = str(
            raw_report.get("source_database")
            or raw_report.get("database")
            or ""
        ).strip()
        cluster_system_identifier = str(
            raw_report.get("source_cluster_system_identifier")
            or raw_report.get("cluster_system_identifier")
            or ""
        ).strip()
        deployment_slug = str(raw_report.get("deployment_slug") or "").strip()
        public_fqdn = str(raw_report.get("public_fqdn") or "").strip()
        metadata: dict[str, Any] = {}
        for key in ("validated_source_databases", "source_identity", "target_locator"):
            if key in raw_report:
                metadata[key] = raw_report[key]
        return RecoverySourceIdentity(
            source_database=source_database,
            cluster_system_identifier=cluster_system_identifier,
            deployment_slug=deployment_slug,
            public_fqdn=public_fqdn,
            metadata=metadata,
        )

    def _extract_validated_source_identities(self, raw_report: dict[str, Any]) -> list[RecoverySourceIdentity]:
        validated = raw_report.get("validated_source_databases")
        identities: list[RecoverySourceIdentity] = []
        if isinstance(validated, list):
            for item in validated:
                if not isinstance(item, dict):
                    continue
                identities.append(
                    RecoverySourceIdentity(
                        source_database=str(item.get("database") or item.get("source_database") or "").strip(),
                        cluster_system_identifier=str(
                            item.get("cluster_system_identifier")
                            or item.get("source_cluster_system_identifier")
                            or ""
                        ).strip(),
                    )
                )
        return identities

    def _report_timestamp(self, raw_report: dict[str, Any], reported_at: str | None) -> datetime:
        for key in ("created_at", "checked_at", "restored_at", "completed_at", "generated_at", "captured_at"):
            parsed = _parse_datetime(str(raw_report.get(key) or "").strip() or None)
            if parsed is not None:
                return parsed
        explicit = _parse_datetime(reported_at)
        if explicit is not None:
            return explicit
        return _now()

    def _protected_data_classes(self, raw_report: dict[str, Any], explicit: list[str] | None) -> list[str]:
        if explicit:
            return explicit
        values = raw_report.get("protected_data_classes") or raw_report.get("covered_data_classes")
        if isinstance(values, list):
            normalized = [str(item).strip() for item in values if str(item).strip() in PROTECTED_DATA_CLASSES]
            if normalized:
                return normalized
        return ["database"]

    def _source_identity_match(
        self,
        expected: RecoverySourceIdentity,
        observed: RecoverySourceIdentity,
        validated_identities: list[RecoverySourceIdentity] | None = None,
    ) -> tuple[bool, list[str]]:
        mismatches: list[str] = []
        if expected.source_database and expected.source_database != observed.source_database:
            mismatches.append("source_database_mismatch")
        if expected.cluster_system_identifier and expected.cluster_system_identifier != observed.cluster_system_identifier:
            mismatches.append("cluster_system_identifier_mismatch")
        if expected.public_fqdn and expected.public_fqdn != observed.public_fqdn:
            mismatches.append("public_fqdn_mismatch")
        if expected.deployment_slug and expected.deployment_slug != observed.deployment_slug:
            mismatches.append("deployment_slug_mismatch")
        if validated_identities:
            expected_pair = (expected.source_database, expected.cluster_system_identifier)
            if any(expected_pair) and not any(
                identity.source_database == expected.source_database
                and identity.cluster_system_identifier == expected.cluster_system_identifier
                for identity in validated_identities
            ):
                mismatches.append("validated_source_identity_missing")
        return not mismatches, mismatches

    def _coverage_match(self, policy: RecoveryBackupPolicyRecord, covered: list[str]) -> tuple[bool, list[str]]:
        missing = [item for item in policy.protected_data_classes if item not in covered]
        if not missing:
            return True, []
        return False, [f"missing_coverage:{item}" for item in missing]

    def _load_policy_row(self, session: Session, policy_id: str) -> RecoveryBackupPolicyORM:
        row = session.get(RecoveryBackupPolicyORM, policy_id)
        if row is None:
            raise ValueError(f"Recovery backup policy '{policy_id}' was not found.")
        return row

    def _latest_backup_row(self, session: Session, policy_id: str) -> RecoveryBackupReportORM | None:
        return session.execute(
            select(RecoveryBackupReportORM)
            .where(RecoveryBackupReportORM.policy_id == policy_id)
            .order_by(RecoveryBackupReportORM.created_at.desc(), RecoveryBackupReportORM.imported_at.desc())
            .limit(1)
        ).scalar_one_or_none()

    def _latest_restore_row(self, session: Session, policy_id: str) -> RecoveryRestoreReportORM | None:
        return session.execute(
            select(RecoveryRestoreReportORM)
            .where(RecoveryRestoreReportORM.policy_id == policy_id)
            .order_by(RecoveryRestoreReportORM.created_at.desc(), RecoveryRestoreReportORM.imported_at.desc())
            .limit(1)
        ).scalar_one_or_none()

    def _latest_upgrade_rows(self, session: Session, *, limit: int = 5) -> list[RecoveryUpgradeReportORM]:
        return session.execute(
            select(RecoveryUpgradeReportORM)
            .order_by(RecoveryUpgradeReportORM.created_at.desc(), RecoveryUpgradeReportORM.imported_at.desc())
            .limit(limit)
        ).scalars().all()

    def _object_count_mismatches(
        self,
        before_counts: dict[str, int],
        after_counts: dict[str, int],
    ) -> list[str]:
        mismatches: list[str] = []
        for object_class in CRITICAL_OBJECT_CLASSES:
            before_count = int(before_counts.get(object_class, 0))
            after_count = int(after_counts.get(object_class, 0))
            if after_count < before_count:
                mismatches.append(f"count_decreased:{object_class}:{before_count}->{after_count}")
        return mismatches

    def _queue_drain_ok(
        self,
        before_counts: dict[str, int],
        after_counts: dict[str, int],
        explicit_value: object | None,
    ) -> bool:
        if isinstance(explicit_value, bool):
            return explicit_value
        before_active = sum(int(before_counts.get(state, 0)) for state in ACTIVE_QUEUE_STATES)
        after_active = sum(int(after_counts.get(state, 0)) for state in ACTIVE_QUEUE_STATES)
        return before_active == 0 and after_active == 0

    def _source_identity_stable(
        self,
        before_identity: RecoverySourceIdentity,
        after_identity: RecoverySourceIdentity,
    ) -> tuple[bool, list[str]]:
        mismatches: list[str] = []
        if before_identity.source_database and after_identity.source_database and before_identity.source_database != after_identity.source_database:
            mismatches.append("source_database_changed_across_upgrade")
        if (
            before_identity.cluster_system_identifier
            and after_identity.cluster_system_identifier
            and before_identity.cluster_system_identifier != after_identity.cluster_system_identifier
        ):
            mismatches.append("cluster_system_identifier_changed_across_upgrade")
        return not mismatches, mismatches

    def _upgrade_posture(self, reports: list[RecoveryUpgradeReportRecord]) -> RecoveryUpgradePosture:
        if not reports:
            return RecoveryUpgradePosture(
                total_reports=0,
                runtime_status="blocked",
                blockers=["upgrade_evidence_missing"],
            )
        latest = reports[0]
        blockers = list(latest.mismatch_reasons)
        if latest.status != "ok":
            blockers.append(f"latest_upgrade_status:{latest.status}")
        if latest.upgrade_result != "succeeded":
            blockers.append(f"latest_upgrade_result:{latest.upgrade_result}")
        if not latest.no_loss_ok:
            blockers.append("no_loss_assertion_failed")
        if not latest.queue_drain_ok:
            blockers.append("queue_drain_not_verified")
        if not latest.source_identity_stable:
            blockers.append("source_identity_not_stable")
        runtime_status = "ok"
        if blockers:
            runtime_status = "blocked" if latest.status == "failed" or not latest.no_loss_ok else "warning"
        return RecoveryUpgradePosture(
            total_reports=len(reports),
            latest_release_id=latest.release_id,
            latest_target_version=latest.target_version or None,
            latest_status=latest.status,
            latest_upgrade_result=latest.upgrade_result,
            latest_created_at=latest.created_at,
            latest_imported_at=latest.imported_at,
            latest_no_loss_ok=latest.no_loss_ok,
            latest_queue_drain_ok=latest.queue_drain_ok,
            latest_source_identity_stable=latest.source_identity_stable,
            runtime_status=runtime_status,  # type: ignore[arg-type]
            blockers=sorted(dict.fromkeys(blockers)),
        )

    def _build_policy_summary(self, session: Session, row: RecoveryBackupPolicyORM) -> RecoveryPolicySummary:
        policy = self._policy_record(row)
        validation = self._validate_target_config(policy)
        latest_backup_row = self._latest_backup_row(session, policy.policy_id)
        latest_restore_row = self._latest_restore_row(session, policy.policy_id)
        latest_backup = self._backup_report_record(latest_backup_row) if latest_backup_row is not None else None
        latest_restore = self._restore_report_record(latest_restore_row) if latest_restore_row is not None else None
        now = _now()
        mismatches = list(validation.reasons)

        backup_fresh = False
        if latest_backup is not None:
            backup_created_at = _parse_datetime(latest_backup.created_at) or now
            backup_fresh = (now - backup_created_at) <= timedelta(hours=policy.max_backup_age_hours)
            if latest_backup.status != "ok":
                mismatches.append(f"backup_status:{latest_backup.status}")
            if not latest_backup.source_identity_match:
                mismatches.extend(reason for reason in latest_backup.mismatch_reasons if reason not in mismatches)
            if not latest_backup.coverage_match:
                mismatches.extend(reason for reason in latest_backup.mismatch_reasons if reason not in mismatches)
            if not backup_fresh and policy.status == "active":
                mismatches.append("backup_report_stale")
        elif policy.status == "active":
            mismatches.append("backup_report_missing")

        restore_fresh = False
        if latest_restore is not None:
            restore_created_at = _parse_datetime(latest_restore.created_at) or now
            restore_fresh = (now - restore_created_at) <= timedelta(hours=policy.max_restore_age_hours)
            if latest_restore.status != "ok":
                mismatches.append(f"restore_status:{latest_restore.status}")
            if not latest_restore.source_identity_match:
                mismatches.extend(reason for reason in latest_restore.mismatch_reasons if reason not in mismatches)
            if not latest_restore.coverage_match:
                mismatches.extend(reason for reason in latest_restore.mismatch_reasons if reason not in mismatches)
            if not restore_fresh and policy.status == "active":
                mismatches.append("restore_report_stale")
        elif policy.status == "active":
            mismatches.append("restore_report_missing")

        source_identity_verified = bool(
            latest_backup is not None
            and latest_restore is not None
            and latest_backup.source_identity_match
            and latest_restore.source_identity_match
        )

        overall_status = "ok"
        if validation.state == "blocked" or any(reason.endswith("_missing") for reason in mismatches):
            overall_status = "blocked"
        elif mismatches or validation.state == "warning":
            overall_status = "warning"

        return RecoveryPolicySummary(
            policy=policy,
            validation=validation,
            latest_backup=latest_backup,
            latest_restore=latest_restore,
            backup_fresh=backup_fresh,
            restore_fresh=restore_fresh,
            source_identity_verified=source_identity_verified,
            mismatches=sorted(dict.fromkeys(mismatches)),
            overall_status=overall_status,  # type: ignore[arg-type]
        )

    def list_overview(self) -> RecoveryOverviewRecord:
        with self._session_factory() as session:
            rows = session.execute(
                select(RecoveryBackupPolicyORM).order_by(RecoveryBackupPolicyORM.label.asc(), RecoveryBackupPolicyORM.created_at.asc())
            ).scalars().all()
            policies = [self._build_policy_summary(session, row) for row in rows]
            recent_upgrades = [self._upgrade_report_record(row) for row in self._latest_upgrade_rows(session)]

        target_classes_present = sorted(
            {policy.policy.target_class for policy in policies},
            key=lambda item: BACKUP_TARGET_CLASSES.index(item),
        )
        protected_data_classes_present = sorted(
            {item for policy in policies for item in policy.policy.protected_data_classes},
            key=lambda item: PROTECTED_DATA_CLASSES.index(item),
        )
        missing_target_classes = [
            item for item in BACKUP_TARGET_CLASSES if item not in target_classes_present
        ]
        missing_protected_data_classes = [
            item for item in PROTECTED_DATA_CLASSES if item not in protected_data_classes_present
        ]
        healthy = [policy for policy in policies if policy.overall_status == "ok"]
        warning = [policy for policy in policies if policy.overall_status == "warning"]
        blocked = [policy for policy in policies if policy.overall_status == "blocked"]
        runtime_status = "ok" if policies and not warning and not blocked else "warning"
        if not policies or blocked:
            runtime_status = "blocked"
        upgrade_posture = self._upgrade_posture(recent_upgrades)

        return RecoveryOverviewRecord(
            summary=RecoveryOverviewSummary(
                total_policies=len(policies),
                active_policies=sum(1 for policy in policies if policy.policy.status == "active"),
                healthy_policies=len(healthy),
                warning_policies=len(warning),
                blocked_policies=len(blocked),
                fresh_backup_policies=sum(1 for policy in policies if policy.backup_fresh),
                fresh_restore_policies=sum(1 for policy in policies if policy.restore_fresh),
                source_identity_verified_policies=sum(1 for policy in policies if policy.source_identity_verified),
                target_classes_present=target_classes_present,  # type: ignore[arg-type]
                missing_target_classes=missing_target_classes,  # type: ignore[arg-type]
                protected_data_classes_present=protected_data_classes_present,  # type: ignore[arg-type]
                missing_protected_data_classes=missing_protected_data_classes,  # type: ignore[arg-type]
                runtime_status=runtime_status,  # type: ignore[arg-type]
                checked_at=_now_iso(),
            ),
            upgrade_posture=upgrade_posture,
            recent_upgrades=recent_upgrades,
            policies=policies,
        )

    def create_policy(self, payload: CreateRecoveryBackupPolicy) -> RecoveryPolicySummary:
        now = _now()
        policy_id = (payload.policy_id or f"backup_policy_{uuid4().hex[:12]}").strip()
        with self._session_factory() as session:
            if session.get(RecoveryBackupPolicyORM, policy_id) is not None:
                raise ValueError(f"Recovery backup policy '{policy_id}' already exists.")
            row = RecoveryBackupPolicyORM(
                id=policy_id,
                label=payload.label.strip(),
                status=payload.status,
                target_class=payload.target_class,
                target_label=payload.target_label.strip(),
                target_config_json=dict(payload.target_config),
                protected_data_classes_json=list(payload.protected_data_classes),
                expected_source_identity_json=payload.expected_source_identity.model_dump(mode="json"),
                schedule_hint=payload.schedule_hint.strip(),
                max_backup_age_hours=payload.max_backup_age_hours,
                max_restore_age_hours=payload.max_restore_age_hours,
                notes=payload.notes.strip(),
                created_at=now,
                updated_at=now,
            )
            session.add(row)
            session.commit()
            session.refresh(row)
            return self._build_policy_summary(session, row)

    def update_policy(self, policy_id: str, payload: UpdateRecoveryBackupPolicy) -> RecoveryPolicySummary:
        with self._session_factory() as session:
            row = self._load_policy_row(session, policy_id)
            updates = payload.model_dump(exclude_none=True)
            for key, value in updates.items():
                if key == "target_config":
                    row.target_config_json = dict(value)
                elif key == "protected_data_classes":
                    row.protected_data_classes_json = list(value)
                elif key == "expected_source_identity":
                    row.expected_source_identity_json = dict(value)
                elif key == "label":
                    row.label = str(value).strip()
                elif key == "target_label":
                    row.target_label = str(value).strip()
                elif key == "schedule_hint":
                    row.schedule_hint = str(value).strip()
                elif key == "notes":
                    row.notes = str(value).strip()
                else:
                    setattr(row, key, value)
            row.updated_at = _now()
            session.add(row)
            session.commit()
            session.refresh(row)
            return self._build_policy_summary(session, row)

    def import_backup_report(self, payload: ImportRecoveryBackupReport) -> tuple[RecoveryBackupReportRecord, RecoveryPolicySummary]:
        with self._session_factory() as session:
            policy_row = self._load_policy_row(session, payload.policy_id)
            policy = self._policy_record(policy_row)
            raw_report = dict(payload.manifest)
            protected_data_classes = self._protected_data_classes(raw_report, payload.protected_data_classes)
            source_identity = self._extract_source_identity(raw_report)
            source_identity_match, identity_mismatches = self._source_identity_match(policy.expected_source_identity, source_identity)
            coverage_match, coverage_mismatches = self._coverage_match(policy, protected_data_classes)
            row = RecoveryBackupReportORM(
                id=f"backup_report_{uuid4().hex[:12]}",
                policy_id=policy.policy_id,
                status=payload.status,
                protected_data_classes_json=protected_data_classes,
                source_identity_json=source_identity.model_dump(mode="json"),
                target_locator=self._policy_target_locator(policy),
                backup_path=str(raw_report.get("backup_path") or "").strip(),
                manifest_path=str(raw_report.get("manifest_path") or "").strip(),
                byte_size=int(raw_report["byte_size"]) if raw_report.get("byte_size") is not None else None,
                checksum_sha256=(str(raw_report.get("checksum_sha256") or "").strip() or None),
                source_identity_match=source_identity_match,
                coverage_match=coverage_match,
                mismatch_reasons_json=sorted(dict.fromkeys(identity_mismatches + coverage_mismatches)),
                raw_report_json=raw_report,
                created_at=self._report_timestamp(raw_report, payload.reported_at),
                imported_at=_now(),
                notes=payload.notes.strip(),
            )
            session.add(row)
            policy_row.updated_at = _now()
            session.add(policy_row)
            session.commit()
            session.refresh(row)
            summary = self._build_policy_summary(session, policy_row)
            return self._backup_report_record(row), summary

    def import_restore_report(self, payload: ImportRecoveryRestoreReport) -> tuple[RecoveryRestoreReportRecord, RecoveryPolicySummary]:
        with self._session_factory() as session:
            policy_row = self._load_policy_row(session, payload.policy_id)
            policy = self._policy_record(policy_row)
            raw_report = dict(payload.report)
            protected_data_classes = self._protected_data_classes(raw_report, payload.protected_data_classes)
            source_identity = self._extract_source_identity(raw_report)
            validated_identities = self._extract_validated_source_identities(raw_report)
            source_identity_match, identity_mismatches = self._source_identity_match(
                policy.expected_source_identity,
                source_identity,
                validated_identities,
            )
            coverage_match, coverage_mismatches = self._coverage_match(policy, protected_data_classes)
            row = RecoveryRestoreReportORM(
                id=f"restore_report_{uuid4().hex[:12]}",
                policy_id=policy.policy_id,
                status=payload.status,
                protected_data_classes_json=protected_data_classes,
                source_identity_json=source_identity.model_dump(mode="json"),
                validated_source_identities_json=[identity.model_dump(mode="json") for identity in validated_identities],
                restored_database=str(raw_report.get("restored_database") or raw_report.get("target_database") or "").strip(),
                tables_compared=int(raw_report.get("tables_compared") or 0),
                source_identity_match=source_identity_match,
                coverage_match=coverage_match,
                mismatch_reasons_json=sorted(dict.fromkeys(identity_mismatches + coverage_mismatches)),
                raw_report_json=raw_report,
                created_at=self._report_timestamp(raw_report, payload.reported_at),
                imported_at=_now(),
                notes=payload.notes.strip(),
            )
            session.add(row)
            policy_row.updated_at = _now()
            session.add(policy_row)
            session.commit()
            session.refresh(row)
            summary = self._build_policy_summary(session, policy_row)
            return self._restore_report_record(row), summary

    def import_upgrade_report(self, payload: ImportRecoveryUpgradeReport) -> tuple[RecoveryUpgradeReportRecord, RecoveryUpgradePosture]:
        raw_report = dict(payload.report)
        release_id = str(raw_report.get("release_id") or raw_report.get("release") or "").strip()
        if not release_id:
            raise ValueError("Upgrade report must contain release_id.")
        upgrade_result = str(raw_report.get("upgrade_result") or raw_report.get("result") or "").strip() or "partial_failure"
        if upgrade_result not in {"succeeded", "failed", "rolled_back", "partial_failure"}:
            raise ValueError(f"Unsupported upgrade_result '{upgrade_result}'.")
        before_snapshot = self._upgrade_snapshot(dict(raw_report.get("before") or raw_report.get("before_snapshot") or {}))
        after_snapshot = self._upgrade_snapshot(dict(raw_report.get("after") or raw_report.get("after_snapshot") or {}))
        if before_snapshot.migration_version is not None and after_snapshot.migration_version is not None:
            migration_regressed = after_snapshot.migration_version < before_snapshot.migration_version
        else:
            migration_regressed = False
        object_mismatches = self._object_count_mismatches(
            before_snapshot.critical_object_counts,
            after_snapshot.critical_object_counts,
        )
        source_identity_stable, source_identity_mismatches = self._source_identity_stable(
            before_snapshot.source_identity,
            after_snapshot.source_identity,
        )
        queue_drain_ok = self._queue_drain_ok(
            before_snapshot.queue_state_counts,
            after_snapshot.queue_state_counts,
            raw_report.get("queue_drain_ok"),
        )
        bootstrap_recovery_state = str(
            raw_report.get("bootstrap_recovery_state")
            or raw_report.get("restart_recovery_state")
            or ""
        ).strip()
        explicit_no_loss_ok = raw_report.get("no_loss_ok")
        no_loss_ok = bool(explicit_no_loss_ok) if isinstance(explicit_no_loss_ok, bool) else not object_mismatches
        mismatches = list(object_mismatches) + list(source_identity_mismatches)
        if migration_regressed:
            mismatches.append("migration_version_regressed")
        if not queue_drain_ok:
            mismatches.append("queue_drain_not_verified")
        if upgrade_result != "succeeded" and not str(raw_report.get("rollback_classification") or "").strip():
            mismatches.append("rollback_classification_missing")
        if upgrade_result != "succeeded" and not str(raw_report.get("failure_classification") or "").strip():
            mismatches.append("failure_classification_missing")
        if bootstrap_recovery_state and bootstrap_recovery_state not in {"recovered", "not_required", "manual_follow_up"}:
            mismatches.append(f"bootstrap_recovery_state:{bootstrap_recovery_state}")
        derived_status = payload.status
        if derived_status is None:
            if upgrade_result == "succeeded" and no_loss_ok and queue_drain_ok and source_identity_stable and not mismatches:
                derived_status = "ok"
            elif upgrade_result == "failed" or migration_regressed or not no_loss_ok:
                derived_status = "failed"
            else:
                derived_status = "warning"
        with self._session_factory() as session:
            row = RecoveryUpgradeReportORM(
                id=f"upgrade_report_{uuid4().hex[:12]}",
                release_id=release_id,
                target_version=str(raw_report.get("target_version") or raw_report.get("app_version") or "").strip(),
                status=derived_status,
                upgrade_result=upgrade_result,
                rollback_classification=str(raw_report.get("rollback_classification") or "").strip(),
                failure_classification=str(raw_report.get("failure_classification") or "").strip(),
                bootstrap_recovery_state=bootstrap_recovery_state,
                before_snapshot_json=before_snapshot.model_dump(mode="json"),
                after_snapshot_json=after_snapshot.model_dump(mode="json"),
                no_loss_ok=no_loss_ok and not object_mismatches,
                queue_drain_ok=queue_drain_ok,
                source_identity_stable=source_identity_stable,
                mismatch_reasons_json=sorted(dict.fromkeys(mismatches)),
                raw_report_json=raw_report,
                created_at=self._report_timestamp(raw_report, payload.reported_at),
                imported_at=_now(),
                notes=payload.notes.strip(),
            )
            session.add(row)
            session.commit()
            session.refresh(row)
            report = self._upgrade_report_record(row)
            recent_reports = [self._upgrade_report_record(item) for item in self._latest_upgrade_rows(session)]
            posture = self._upgrade_posture(recent_reports)
            return report, posture


@lru_cache(maxsize=1)
def get_recovery_admin_service() -> RecoveryAdminService:
    from app.execution.dependencies import get_execution_session_factory

    return RecoveryAdminService(get_execution_session_factory())


def clear_recovery_admin_service_cache() -> None:
    get_recovery_admin_service.cache_clear()


__all__ = [
    "RecoveryAdminService",
    "clear_recovery_admin_service_cache",
    "get_recovery_admin_service",
]

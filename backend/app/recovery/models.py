"""Recovery-domain models for backup, restore, and resilience evidence."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

BACKUP_TARGET_CLASSES = (
    "local_secondary_disk",
    "second_host",
    "nas_share",
    "offsite_copy",
    "object_storage",
)
PROTECTED_DATA_CLASSES = (
    "database",
    "artifact_metadata",
    "blob_contents",
    "configuration_state",
    "secret_metadata",
)
RECOVERY_POLICY_STATUSES = ("active", "paused")
RECOVERY_REPORT_STATUSES = ("ok", "warning", "failed")
RECOVERY_SUMMARY_STATUSES = ("ok", "warning", "blocked")
RECOVERY_UPGRADE_RESULTS = ("succeeded", "failed", "rolled_back", "partial_failure")

BackupTargetClass = Literal[
    "local_secondary_disk",
    "second_host",
    "nas_share",
    "offsite_copy",
    "object_storage",
]
ProtectedDataClass = Literal[
    "database",
    "artifact_metadata",
    "blob_contents",
    "configuration_state",
    "secret_metadata",
]
RecoveryPolicyStatus = Literal["active", "paused"]
RecoveryReportStatus = Literal["ok", "warning", "failed"]
RecoverySummaryStatus = Literal["ok", "warning", "blocked"]
RecoveryUpgradeResult = Literal["succeeded", "failed", "rolled_back", "partial_failure"]


def _normalize_string_list(values: object, *, field_name: str) -> list[str]:
    if values is None:
        return []
    if not isinstance(values, (list, tuple)):
        raise ValueError(f"{field_name} must be an array of strings.")
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in values:
        item = str(raw).strip()
        if not item or item in seen:
            continue
        normalized.append(item)
        seen.add(item)
    return normalized


def _normalize_iso_datetime(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    parsed = datetime.fromisoformat(normalized.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC).isoformat()


class RecoverySourceIdentity(BaseModel):
    source_database: str = ""
    cluster_system_identifier: str = ""
    deployment_slug: str = ""
    public_fqdn: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("source_database", "cluster_system_identifier", "deployment_slug", "public_fqdn")
    @classmethod
    def _normalize_text(cls, value: str) -> str:
        return value.strip()


class RecoveryPolicyValidation(BaseModel):
    state: RecoverySummaryStatus
    reasons: list[str] = Field(default_factory=list)
    target_locator: str = ""
    checked_at: str


class RecoveryBackupPolicyRecord(BaseModel):
    policy_id: str
    label: str
    status: RecoveryPolicyStatus = "active"
    target_class: BackupTargetClass
    target_label: str = ""
    target_config: dict[str, Any] = Field(default_factory=dict)
    protected_data_classes: list[ProtectedDataClass] = Field(default_factory=lambda: ["database"])
    expected_source_identity: RecoverySourceIdentity = Field(default_factory=RecoverySourceIdentity)
    schedule_hint: str = ""
    max_backup_age_hours: int = Field(default=24, ge=1, le=24 * 365)
    max_restore_age_hours: int = Field(default=24 * 7, ge=1, le=24 * 365)
    notes: str = ""
    created_at: str
    updated_at: str

    @field_validator("policy_id", "label", "target_label", "schedule_hint", "notes")
    @classmethod
    def _normalize_optional_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("protected_data_classes", mode="before")
    @classmethod
    def _normalize_data_classes(cls, value: object) -> list[str]:
        normalized = _normalize_string_list(value, field_name="protected_data_classes")
        invalid = sorted(set(normalized) - set(PROTECTED_DATA_CLASSES))
        if invalid:
            raise ValueError(f"Unknown protected data classes: {', '.join(invalid)}")
        return normalized or ["database"]


class RecoveryBackupReportRecord(BaseModel):
    report_id: str
    policy_id: str
    status: RecoveryReportStatus
    protected_data_classes: list[ProtectedDataClass] = Field(default_factory=lambda: ["database"])
    source_identity: RecoverySourceIdentity = Field(default_factory=RecoverySourceIdentity)
    target_locator: str = ""
    backup_path: str = ""
    manifest_path: str = ""
    byte_size: int | None = None
    checksum_sha256: str | None = None
    source_identity_match: bool = True
    coverage_match: bool = True
    mismatch_reasons: list[str] = Field(default_factory=list)
    raw_report: dict[str, Any] = Field(default_factory=dict)
    created_at: str
    imported_at: str
    notes: str = ""

    @field_validator("protected_data_classes", mode="before")
    @classmethod
    def _normalize_report_data_classes(cls, value: object) -> list[str]:
        normalized = _normalize_string_list(value, field_name="protected_data_classes")
        invalid = sorted(set(normalized) - set(PROTECTED_DATA_CLASSES))
        if invalid:
            raise ValueError(f"Unknown protected data classes: {', '.join(invalid)}")
        return normalized or ["database"]

    @field_validator("mismatch_reasons", mode="before")
    @classmethod
    def _normalize_mismatch_reasons(cls, value: object) -> list[str]:
        return _normalize_string_list(value, field_name="mismatch_reasons")

    @field_validator("report_id", "policy_id", "target_locator", "backup_path", "manifest_path", "notes")
    @classmethod
    def _normalize_report_text(cls, value: str) -> str:
        return value.strip()


class RecoveryRestoreReportRecord(BaseModel):
    report_id: str
    policy_id: str
    status: RecoveryReportStatus
    protected_data_classes: list[ProtectedDataClass] = Field(default_factory=lambda: ["database"])
    source_identity: RecoverySourceIdentity = Field(default_factory=RecoverySourceIdentity)
    validated_source_identities: list[RecoverySourceIdentity] = Field(default_factory=list)
    restored_database: str = ""
    tables_compared: int = 0
    source_identity_match: bool = True
    coverage_match: bool = True
    mismatch_reasons: list[str] = Field(default_factory=list)
    raw_report: dict[str, Any] = Field(default_factory=dict)
    created_at: str
    imported_at: str
    notes: str = ""

    @field_validator("protected_data_classes", mode="before")
    @classmethod
    def _normalize_restore_data_classes(cls, value: object) -> list[str]:
        normalized = _normalize_string_list(value, field_name="protected_data_classes")
        invalid = sorted(set(normalized) - set(PROTECTED_DATA_CLASSES))
        if invalid:
            raise ValueError(f"Unknown protected data classes: {', '.join(invalid)}")
        return normalized or ["database"]

    @field_validator("mismatch_reasons", mode="before")
    @classmethod
    def _normalize_restore_mismatches(cls, value: object) -> list[str]:
        return _normalize_string_list(value, field_name="mismatch_reasons")

    @field_validator("report_id", "policy_id", "restored_database", "notes")
    @classmethod
    def _normalize_restore_text(cls, value: str) -> str:
        return value.strip()


class RecoveryUpgradeSnapshot(BaseModel):
    captured_at: str | None = None
    source_identity: RecoverySourceIdentity = Field(default_factory=RecoverySourceIdentity)
    migration_version: int | None = None
    applied_migration_versions: list[int] = Field(default_factory=list)
    critical_object_counts: dict[str, int] = Field(default_factory=dict)
    queue_state_counts: dict[str, int] = Field(default_factory=dict)
    database_targets: list[dict[str, Any]] = Field(default_factory=list)

    @field_validator("captured_at")
    @classmethod
    def _normalize_snapshot_captured_at(cls, value: str | None) -> str | None:
        return _normalize_iso_datetime(value)

    @field_validator("applied_migration_versions", mode="before")
    @classmethod
    def _normalize_applied_migration_versions(cls, value: object) -> list[int]:
        if value is None:
            return []
        if not isinstance(value, (list, tuple)):
            raise ValueError("applied_migration_versions must be an array of integers.")
        normalized: list[int] = []
        for raw in value:
            normalized.append(int(raw))
        return normalized

    @field_validator("critical_object_counts", "queue_state_counts", mode="before")
    @classmethod
    def _normalize_snapshot_counts(cls, value: object) -> dict[str, int]:
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise ValueError("Snapshot count payloads must be objects.")
        normalized: dict[str, int] = {}
        for raw_key, raw_value in value.items():
            key = str(raw_key).strip()
            if not key:
                continue
            normalized[key] = int(raw_value)
        return normalized

    @field_validator("database_targets", mode="before")
    @classmethod
    def _normalize_database_targets(cls, value: object) -> list[dict[str, Any]]:
        if value is None:
            return []
        if not isinstance(value, list):
            raise ValueError("database_targets must be an array of objects.")
        normalized: list[dict[str, Any]] = []
        for item in value:
            if isinstance(item, dict):
                normalized.append(dict(item))
        return normalized


class RecoveryUpgradeReportRecord(BaseModel):
    report_id: str
    release_id: str
    target_version: str = ""
    status: RecoveryReportStatus
    upgrade_result: RecoveryUpgradeResult
    rollback_classification: str = ""
    failure_classification: str = ""
    bootstrap_recovery_state: str = ""
    before_snapshot: RecoveryUpgradeSnapshot = Field(default_factory=RecoveryUpgradeSnapshot)
    after_snapshot: RecoveryUpgradeSnapshot = Field(default_factory=RecoveryUpgradeSnapshot)
    no_loss_ok: bool = False
    queue_drain_ok: bool = False
    source_identity_stable: bool = False
    mismatch_reasons: list[str] = Field(default_factory=list)
    raw_report: dict[str, Any] = Field(default_factory=dict)
    created_at: str
    imported_at: str
    notes: str = ""

    @field_validator("mismatch_reasons", mode="before")
    @classmethod
    def _normalize_upgrade_mismatches(cls, value: object) -> list[str]:
        return _normalize_string_list(value, field_name="mismatch_reasons")

    @field_validator(
        "report_id",
        "release_id",
        "target_version",
        "rollback_classification",
        "failure_classification",
        "bootstrap_recovery_state",
        "notes",
    )
    @classmethod
    def _normalize_upgrade_text(cls, value: str) -> str:
        return value.strip()


class RecoveryUpgradePosture(BaseModel):
    total_reports: int = 0
    latest_release_id: str | None = None
    latest_target_version: str | None = None
    latest_status: RecoveryReportStatus | None = None
    latest_upgrade_result: RecoveryUpgradeResult | None = None
    latest_created_at: str | None = None
    latest_imported_at: str | None = None
    latest_no_loss_ok: bool = False
    latest_queue_drain_ok: bool = False
    latest_source_identity_stable: bool = False
    runtime_status: RecoverySummaryStatus = "blocked"
    blockers: list[str] = Field(default_factory=list)


class RecoveryPolicySummary(BaseModel):
    policy: RecoveryBackupPolicyRecord
    validation: RecoveryPolicyValidation
    latest_backup: RecoveryBackupReportRecord | None = None
    latest_restore: RecoveryRestoreReportRecord | None = None
    backup_fresh: bool = False
    restore_fresh: bool = False
    source_identity_verified: bool = False
    mismatches: list[str] = Field(default_factory=list)
    overall_status: RecoverySummaryStatus = "warning"


class RecoveryOverviewSummary(BaseModel):
    total_policies: int = 0
    active_policies: int = 0
    healthy_policies: int = 0
    warning_policies: int = 0
    blocked_policies: int = 0
    fresh_backup_policies: int = 0
    fresh_restore_policies: int = 0
    source_identity_verified_policies: int = 0
    target_classes_present: list[BackupTargetClass] = Field(default_factory=list)
    missing_target_classes: list[BackupTargetClass] = Field(default_factory=list)
    protected_data_classes_present: list[ProtectedDataClass] = Field(default_factory=list)
    missing_protected_data_classes: list[ProtectedDataClass] = Field(default_factory=list)
    runtime_status: RecoverySummaryStatus = "warning"
    checked_at: str


class RecoveryOverviewRecord(BaseModel):
    summary: RecoveryOverviewSummary
    upgrade_posture: RecoveryUpgradePosture = Field(default_factory=RecoveryUpgradePosture)
    recent_upgrades: list[RecoveryUpgradeReportRecord] = Field(default_factory=list)
    policies: list[RecoveryPolicySummary] = Field(default_factory=list)


class CreateRecoveryBackupPolicy(BaseModel):
    policy_id: str | None = Field(default=None, min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=191)
    status: RecoveryPolicyStatus = "active"
    target_class: BackupTargetClass
    target_label: str = Field(default="", max_length=191)
    target_config: dict[str, Any] = Field(default_factory=dict)
    protected_data_classes: list[ProtectedDataClass] = Field(default_factory=lambda: ["database"])
    expected_source_identity: RecoverySourceIdentity = Field(default_factory=RecoverySourceIdentity)
    schedule_hint: str = Field(default="", max_length=191)
    max_backup_age_hours: int = Field(default=24, ge=1, le=24 * 365)
    max_restore_age_hours: int = Field(default=24 * 7, ge=1, le=24 * 365)
    notes: str = Field(default="", max_length=4000)

    @field_validator("protected_data_classes", mode="before")
    @classmethod
    def _normalize_create_data_classes(cls, value: object) -> list[str]:
        normalized = _normalize_string_list(value, field_name="protected_data_classes")
        invalid = sorted(set(normalized) - set(PROTECTED_DATA_CLASSES))
        if invalid:
            raise ValueError(f"Unknown protected data classes: {', '.join(invalid)}")
        return normalized or ["database"]


class UpdateRecoveryBackupPolicy(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=191)
    status: RecoveryPolicyStatus | None = None
    target_label: str | None = Field(default=None, max_length=191)
    target_config: dict[str, Any] | None = None
    protected_data_classes: list[ProtectedDataClass] | None = None
    expected_source_identity: RecoverySourceIdentity | None = None
    schedule_hint: str | None = Field(default=None, max_length=191)
    max_backup_age_hours: int | None = Field(default=None, ge=1, le=24 * 365)
    max_restore_age_hours: int | None = Field(default=None, ge=1, le=24 * 365)
    notes: str | None = Field(default=None, max_length=4000)

    @field_validator("protected_data_classes", mode="before")
    @classmethod
    def _normalize_update_data_classes(cls, value: object) -> list[str] | None:
        if value is None:
            return None
        normalized = _normalize_string_list(value, field_name="protected_data_classes")
        invalid = sorted(set(normalized) - set(PROTECTED_DATA_CLASSES))
        if invalid:
            raise ValueError(f"Unknown protected data classes: {', '.join(invalid)}")
        return normalized or ["database"]


class ImportRecoveryBackupReport(BaseModel):
    policy_id: str = Field(min_length=1, max_length=64)
    status: RecoveryReportStatus = "ok"
    manifest: dict[str, Any] = Field(default_factory=dict)
    protected_data_classes: list[ProtectedDataClass] | None = None
    notes: str = Field(default="", max_length=4000)
    reported_at: str | None = None

    @field_validator("protected_data_classes", mode="before")
    @classmethod
    def _normalize_import_data_classes(cls, value: object) -> list[str] | None:
        if value is None:
            return None
        normalized = _normalize_string_list(value, field_name="protected_data_classes")
        invalid = sorted(set(normalized) - set(PROTECTED_DATA_CLASSES))
        if invalid:
            raise ValueError(f"Unknown protected data classes: {', '.join(invalid)}")
        return normalized or ["database"]

    @field_validator("reported_at")
    @classmethod
    def _normalize_import_reported_at(cls, value: str | None) -> str | None:
        return _normalize_iso_datetime(value)


class ImportRecoveryRestoreReport(BaseModel):
    policy_id: str = Field(min_length=1, max_length=64)
    status: RecoveryReportStatus = "ok"
    report: dict[str, Any] = Field(default_factory=dict)
    protected_data_classes: list[ProtectedDataClass] | None = None
    notes: str = Field(default="", max_length=4000)
    reported_at: str | None = None

    @field_validator("protected_data_classes", mode="before")
    @classmethod
    def _normalize_import_restore_data_classes(cls, value: object) -> list[str] | None:
        if value is None:
            return None
        normalized = _normalize_string_list(value, field_name="protected_data_classes")
        invalid = sorted(set(normalized) - set(PROTECTED_DATA_CLASSES))
        if invalid:
            raise ValueError(f"Unknown protected data classes: {', '.join(invalid)}")
        return normalized or ["database"]

    @field_validator("reported_at")
    @classmethod
    def _normalize_import_restore_reported_at(cls, value: str | None) -> str | None:
        return _normalize_iso_datetime(value)


class ImportRecoveryUpgradeReport(BaseModel):
    status: RecoveryReportStatus | None = None
    report: dict[str, Any] = Field(default_factory=dict)
    notes: str = Field(default="", max_length=4000)
    reported_at: str | None = None

    @field_validator("reported_at")
    @classmethod
    def _normalize_import_upgrade_reported_at(cls, value: str | None) -> str | None:
        return _normalize_iso_datetime(value)


__all__ = [
    "BACKUP_TARGET_CLASSES",
    "PROTECTED_DATA_CLASSES",
    "RECOVERY_POLICY_STATUSES",
    "RECOVERY_REPORT_STATUSES",
    "RECOVERY_SUMMARY_STATUSES",
    "BackupTargetClass",
    "CreateRecoveryBackupPolicy",
    "ImportRecoveryBackupReport",
    "ImportRecoveryRestoreReport",
    "ImportRecoveryUpgradeReport",
    "ProtectedDataClass",
    "RecoveryBackupPolicyRecord",
    "RecoveryBackupReportRecord",
    "RecoveryOverviewRecord",
    "RecoveryOverviewSummary",
    "RecoveryPolicySummary",
    "RecoveryPolicyValidation",
    "RecoveryPolicyStatus",
    "RecoveryReportStatus",
    "RecoveryRestoreReportRecord",
    "RecoverySourceIdentity",
    "RecoverySummaryStatus",
    "RecoveryUpgradePosture",
    "RecoveryUpgradeReportRecord",
    "RecoveryUpgradeResult",
    "RecoveryUpgradeSnapshot",
    "RECOVERY_UPGRADE_RESULTS",
    "UpdateRecoveryBackupPolicy",
]

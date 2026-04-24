"""SQLAlchemy substrate for recovery, backup, and restore evidence."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.recovery.models import (
    BACKUP_TARGET_CLASSES,
    RECOVERY_POLICY_STATUSES,
    RECOVERY_REPORT_STATUSES,
    RECOVERY_UPGRADE_RESULTS,
)
from app.storage.harness_repository import Base


def _enum_check(name: str, column: str, values: tuple[str, ...]) -> CheckConstraint:
    joined = ", ".join(f"'{value}'" for value in values)
    return CheckConstraint(f"{column} IN ({joined})", name=name)


def _now() -> datetime:
    return datetime.now(tz=UTC)


class RecoveryBackupPolicyORM(Base):
    __tablename__ = "recovery_backup_policies"
    __table_args__ = (
        _enum_check("recovery_backup_policy_status_ck", "status", RECOVERY_POLICY_STATUSES),
        _enum_check("recovery_backup_policy_target_class_ck", "target_class", BACKUP_TARGET_CLASSES),
        CheckConstraint("max_backup_age_hours >= 1", name="recovery_backup_policy_max_backup_age_hours_ck"),
        CheckConstraint("max_restore_age_hours >= 1", name="recovery_backup_policy_max_restore_age_hours_ck"),
        Index("recovery_backup_policy_target_class_idx", "target_class", "status", "updated_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    label: Mapped[str] = mapped_column(String(191), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    target_class: Mapped[str] = mapped_column(String(32), nullable=False)
    target_label: Mapped[str] = mapped_column(String(191), nullable=False, default="")
    target_config_json: Mapped[dict[str, Any]] = mapped_column(
        "target_config",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    protected_data_classes_json: Mapped[list[str]] = mapped_column(
        "protected_data_classes",
        JSONB().with_variant(JSON(), "sqlite"),
        default=list,
        nullable=False,
    )
    expected_source_identity_json: Mapped[dict[str, Any]] = mapped_column(
        "expected_source_identity",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    schedule_hint: Mapped[str] = mapped_column(String(191), nullable=False, default="")
    max_backup_age_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=24)
    max_restore_age_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=24 * 7)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class RecoveryBackupReportORM(Base):
    __tablename__ = "recovery_backup_reports"
    __table_args__ = (
        _enum_check("recovery_backup_report_status_ck", "status", RECOVERY_REPORT_STATUSES),
        Index("recovery_backup_report_policy_created_idx", "policy_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    policy_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("recovery_backup_policies.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="ok")
    protected_data_classes_json: Mapped[list[str]] = mapped_column(
        "protected_data_classes",
        JSONB().with_variant(JSON(), "sqlite"),
        default=list,
        nullable=False,
    )
    source_identity_json: Mapped[dict[str, Any]] = mapped_column(
        "source_identity",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    target_locator: Mapped[str] = mapped_column(Text, nullable=False, default="")
    backup_path: Mapped[str] = mapped_column(Text, nullable=False, default="")
    manifest_path: Mapped[str] = mapped_column(Text, nullable=False, default="")
    byte_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    checksum_sha256: Mapped[str | None] = mapped_column(String(128), nullable=True)
    source_identity_match: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    coverage_match: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    mismatch_reasons_json: Mapped[list[str]] = mapped_column(
        "mismatch_reasons",
        JSONB().with_variant(JSON(), "sqlite"),
        default=list,
        nullable=False,
    )
    raw_report_json: Mapped[dict[str, Any]] = mapped_column(
        "raw_report",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")


class RecoveryRestoreReportORM(Base):
    __tablename__ = "recovery_restore_reports"
    __table_args__ = (
        _enum_check("recovery_restore_report_status_ck", "status", RECOVERY_REPORT_STATUSES),
        Index("recovery_restore_report_policy_created_idx", "policy_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    policy_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("recovery_backup_policies.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="ok")
    protected_data_classes_json: Mapped[list[str]] = mapped_column(
        "protected_data_classes",
        JSONB().with_variant(JSON(), "sqlite"),
        default=list,
        nullable=False,
    )
    source_identity_json: Mapped[dict[str, Any]] = mapped_column(
        "source_identity",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    validated_source_identities_json: Mapped[list[dict[str, Any]]] = mapped_column(
        "validated_source_identities",
        JSONB().with_variant(JSON(), "sqlite"),
        default=list,
        nullable=False,
    )
    restored_database: Mapped[str] = mapped_column(String(191), nullable=False, default="")
    tables_compared: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    source_identity_match: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    coverage_match: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    mismatch_reasons_json: Mapped[list[str]] = mapped_column(
        "mismatch_reasons",
        JSONB().with_variant(JSON(), "sqlite"),
        default=list,
        nullable=False,
    )
    raw_report_json: Mapped[dict[str, Any]] = mapped_column(
        "raw_report",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")


class RecoveryUpgradeReportORM(Base):
    __tablename__ = "recovery_upgrade_reports"
    __table_args__ = (
        _enum_check("recovery_upgrade_report_status_ck", "status", RECOVERY_REPORT_STATUSES),
        _enum_check("recovery_upgrade_report_result_ck", "upgrade_result", RECOVERY_UPGRADE_RESULTS),
        Index("recovery_upgrade_report_created_idx", "created_at", "imported_at"),
        Index("recovery_upgrade_report_release_idx", "release_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    release_id: Mapped[str] = mapped_column(String(191), nullable=False)
    target_version: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="warning")
    upgrade_result: Mapped[str] = mapped_column(String(32), nullable=False, default="partial_failure")
    rollback_classification: Mapped[str] = mapped_column(String(191), nullable=False, default="")
    failure_classification: Mapped[str] = mapped_column(String(191), nullable=False, default="")
    bootstrap_recovery_state: Mapped[str] = mapped_column(String(191), nullable=False, default="")
    before_snapshot_json: Mapped[dict[str, Any]] = mapped_column(
        "before_snapshot",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    after_snapshot_json: Mapped[dict[str, Any]] = mapped_column(
        "after_snapshot",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    no_loss_ok: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    queue_drain_ok: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    source_identity_stable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    mismatch_reasons_json: Mapped[list[str]] = mapped_column(
        "mismatch_reasons",
        JSONB().with_variant(JSON(), "sqlite"),
        default=list,
        nullable=False,
    )
    raw_report_json: Mapped[dict[str, Any]] = mapped_column(
        "raw_report",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")


__all__ = [
    "RecoveryBackupPolicyORM",
    "RecoveryBackupReportORM",
    "RecoveryRestoreReportORM",
    "RecoveryUpgradeReportORM",
]

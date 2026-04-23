"""SQLAlchemy substrate for artifact persistence and target attachments."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKeyConstraint, Integer, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.artifacts.models import ARTIFACT_ATTACHMENT_TARGET_KINDS, ARTIFACT_STATUSES, ARTIFACT_TYPES
from app.storage.harness_repository import Base


def _enum_check(name: str, column: str, values: tuple[str, ...], *, nullable: bool = False) -> CheckConstraint:
    joined = ", ".join(f"'{value}'" for value in values)
    predicate = f"{column} IN ({joined})"
    if nullable:
        predicate = f"{column} IS NULL OR {predicate}"
    return CheckConstraint(predicate, name=name)


def _now() -> datetime:
    return datetime.now(tz=UTC)


class ArtifactORM(Base):
    __tablename__ = "artifacts"
    __table_args__ = (
        ForeignKeyConstraint(
            ["company_id", "workspace_id"],
            ["workspaces.company_id", "workspaces.id"],
            name="artifacts_company_workspace_fk",
        ),
        _enum_check("artifacts_type_ck", "artifact_type", ARTIFACT_TYPES),
        _enum_check("artifacts_status_ck", "status", ARTIFACT_STATUSES),
        CheckConstraint("size_bytes IS NULL OR size_bytes >= 0", name="artifacts_size_bytes_nonnegative_ck"),
        Index("artifacts_company_id_id_uq", "company_id", "id", unique=True),
        Index("artifacts_company_workspace_created_idx", "company_id", "workspace_id", "created_at"),
        Index("artifacts_instance_status_created_idx", "instance_id", "status", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    instance_id: Mapped[str] = mapped_column(String(191), nullable=False)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    workspace_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    artifact_type: Mapped[str] = mapped_column(String(64), nullable=False)
    label: Mapped[str] = mapped_column(String(191), nullable=False)
    uri: Mapped[str] = mapped_column(Text, nullable=False)
    media_type: Mapped[str | None] = mapped_column(String(191), nullable=True)
    preview_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    created_by_type: Mapped[str] = mapped_column(String(32), nullable=False, default="system")
    created_by_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class ArtifactAttachmentORM(Base):
    __tablename__ = "artifact_attachments"
    __table_args__ = (
        ForeignKeyConstraint(
            ["company_id", "artifact_id"],
            ["artifacts.company_id", "artifacts.id"],
            name="artifact_attachments_company_artifact_fk",
            ondelete="CASCADE",
        ),
        _enum_check("artifact_attachments_target_kind_ck", "target_kind", ARTIFACT_ATTACHMENT_TARGET_KINDS),
        Index(
            "artifact_attachments_company_artifact_target_role_uq",
            "company_id",
            "artifact_id",
            "target_kind",
            "target_id",
            "role",
            unique=True,
        ),
        Index("artifact_attachments_target_lookup_idx", "company_id", "target_kind", "target_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    artifact_id: Mapped[str] = mapped_column(String(64), nullable=False)
    target_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    target_id: Mapped[str] = mapped_column(String(191), nullable=False)
    role: Mapped[str] = mapped_column(String(64), nullable=False, default="related")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

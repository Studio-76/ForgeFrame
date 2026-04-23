"""SQLAlchemy substrate for workspace and handoff persistence."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKeyConstraint, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.storage.harness_repository import Base
from app.workspaces.models import (
    WORKSPACE_EVENT_KINDS,
    WORKSPACE_HANDOFF_STATUSES,
    WORKSPACE_PREVIEW_STATUSES,
    WORKSPACE_REVIEW_STATUSES,
    WORKSPACE_STATUSES,
)


def _enum_check(name: str, column: str, values: tuple[str, ...], *, nullable: bool = False) -> CheckConstraint:
    joined = ", ".join(f"'{value}'" for value in values)
    predicate = f"{column} IN ({joined})"
    if nullable:
        predicate = f"{column} IS NULL OR {predicate}"
    return CheckConstraint(predicate, name=name)


def _now() -> datetime:
    return datetime.now(tz=UTC)


class WorkspaceORM(Base):
    __tablename__ = "workspaces"
    __table_args__ = (
        _enum_check("workspaces_status_ck", "status", WORKSPACE_STATUSES),
        _enum_check("workspaces_preview_status_ck", "preview_status", WORKSPACE_PREVIEW_STATUSES),
        _enum_check("workspaces_review_status_ck", "review_status", WORKSPACE_REVIEW_STATUSES),
        _enum_check("workspaces_handoff_status_ck", "handoff_status", WORKSPACE_HANDOFF_STATUSES),
        Index("workspaces_company_id_id_uq", "company_id", "id", unique=True),
        Index("workspaces_instance_status_idx", "instance_id", "status", "updated_at"),
        Index("workspaces_company_issue_idx", "company_id", "issue_id", "updated_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    instance_id: Mapped[str] = mapped_column(String(191), nullable=False)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    issue_id: Mapped[str | None] = mapped_column(String(191), nullable=True)
    title: Mapped[str] = mapped_column(String(191), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    preview_status: Mapped[str] = mapped_column(String(32), nullable=False, default="missing")
    review_status: Mapped[str] = mapped_column(String(32), nullable=False, default="not_requested")
    handoff_status: Mapped[str] = mapped_column(String(32), nullable=False, default="not_ready")
    owner_type: Mapped[str] = mapped_column(String(32), nullable=False, default="system")
    owner_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    active_run_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    latest_approval_id: Mapped[str | None] = mapped_column(String(191), nullable=True)
    preview_artifact_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    handoff_artifact_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    pr_reference: Mapped[str | None] = mapped_column(Text, nullable=True)
    handoff_reference: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class WorkspaceEventORM(Base):
    __tablename__ = "workspace_events"
    __table_args__ = (
        ForeignKeyConstraint(
            ["company_id", "workspace_id"],
            ["workspaces.company_id", "workspaces.id"],
            name="workspace_events_company_workspace_fk",
            ondelete="CASCADE",
        ),
        _enum_check("workspace_events_kind_ck", "event_kind", WORKSPACE_EVENT_KINDS),
        Index("workspace_events_company_workspace_created_idx", "company_id", "workspace_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    workspace_id: Mapped[str] = mapped_column(String(64), nullable=False)
    event_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    artifact_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    approval_id: Mapped[str | None] = mapped_column(String(191), nullable=True)
    run_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    actor_type: Mapped[str] = mapped_column(String(32), nullable=False, default="system")
    actor_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

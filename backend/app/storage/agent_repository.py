"""SQLAlchemy substrate for instance-scoped agent records."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, CheckConstraint, DateTime, ForeignKeyConstraint, Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.agents.models import AGENT_PARTICIPATION_MODES, AGENT_ROLE_KINDS, AGENT_STATUSES
from app.storage.harness_repository import Base


def _enum_check(name: str, column: str, values: tuple[str, ...], *, nullable: bool = False) -> CheckConstraint:
    joined = ", ".join(f"'{value}'" for value in values)
    predicate = f"{column} IN ({joined})"
    if nullable:
        predicate = f"{column} IS NULL OR {predicate}"
    return CheckConstraint(predicate, name=name)


def _now() -> datetime:
    return datetime.now(tz=UTC)


class AgentORM(Base):
    __tablename__ = "agents"
    __table_args__ = (
        ForeignKeyConstraint(
            ["company_id", "assistant_profile_id"],
            ["assistant_profiles.company_id", "assistant_profiles.id"],
            name="agents_company_assistant_profile_fk",
            ondelete="SET NULL",
        ),
        _enum_check("agents_role_kind_ck", "role_kind", AGENT_ROLE_KINDS),
        _enum_check("agents_status_ck", "status", AGENT_STATUSES),
        _enum_check("agents_participation_mode_ck", "participation_mode", AGENT_PARTICIPATION_MODES),
        Index("agents_company_id_id_uq", "company_id", "id", unique=True),
        Index("agents_instance_status_idx", "instance_id", "status", "updated_at"),
        Index("agents_instance_default_operator_idx", "instance_id", "is_default_operator"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    instance_id: Mapped[str] = mapped_column(String(191), nullable=False)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    display_name: Mapped[str] = mapped_column(String(191), nullable=False)
    default_name: Mapped[str] = mapped_column(String(191), nullable=False)
    role_kind: Mapped[str] = mapped_column(String(32), nullable=False, default="specialist")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    participation_mode: Mapped[str] = mapped_column(String(32), nullable=False, default="direct")
    allowed_targets_json: Mapped[list[str]] = mapped_column(
        "allowed_targets",
        JSONB().with_variant(JSON(), "sqlite"),
        default=list,
        nullable=False,
    )
    assistant_profile_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_default_operator: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

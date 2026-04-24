"""SQLAlchemy substrate for versioned skill records."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKeyConstraint, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.skills.models import SKILL_ACTIVATION_STATUSES, SKILL_SCOPES, SKILL_STATUSES, SKILL_USAGE_OUTCOMES
from app.storage.harness_repository import Base


def _enum_check(name: str, column: str, values: tuple[str, ...], *, nullable: bool = False) -> CheckConstraint:
    joined = ", ".join(f"'{value}'" for value in values)
    predicate = f"{column} IN ({joined})"
    if nullable:
        predicate = f"{column} IS NULL OR {predicate}"
    return CheckConstraint(predicate, name=name)


def _now() -> datetime:
    return datetime.now(tz=UTC)


class SkillORM(Base):
    __tablename__ = "skills"
    __table_args__ = (
        ForeignKeyConstraint(
            ["company_id", "scope_agent_id"],
            ["agents.company_id", "agents.id"],
            name="skills_company_scope_agent_fk",
            ondelete="SET NULL",
        ),
        _enum_check("skills_scope_ck", "scope", SKILL_SCOPES),
        _enum_check("skills_status_ck", "status", SKILL_STATUSES),
        Index("skills_company_id_id_uq", "company_id", "id", unique=True),
        Index("skills_instance_scope_status_idx", "instance_id", "scope", "status", "updated_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    instance_id: Mapped[str] = mapped_column(String(191), nullable=False)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    display_name: Mapped[str] = mapped_column(String(191), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    scope: Mapped[str] = mapped_column(String(32), nullable=False, default="instance")
    scope_agent_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    current_version_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    provenance_json: Mapped[dict[str, Any]] = mapped_column(
        "provenance",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    activation_conditions_json: Mapped[dict[str, Any]] = mapped_column(
        "activation_conditions",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    instruction_core: Mapped[str] = mapped_column(Text, nullable=False)
    telemetry_json: Mapped[dict[str, Any]] = mapped_column(
        "telemetry",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class SkillVersionORM(Base):
    __tablename__ = "skill_versions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["company_id", "skill_id"],
            ["skills.company_id", "skills.id"],
            name="skill_versions_company_skill_fk",
            ondelete="CASCADE",
        ),
        _enum_check("skill_versions_status_ck", "status", SKILL_STATUSES),
        Index("skill_versions_company_skill_version_uq", "company_id", "skill_id", "version_number", unique=True),
        Index("skill_versions_instance_skill_created_idx", "instance_id", "skill_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    skill_id: Mapped[str] = mapped_column(String(64), nullable=False)
    instance_id: Mapped[str] = mapped_column(String(191), nullable=False)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    instruction_core: Mapped[str] = mapped_column(Text, nullable=False)
    provenance_json: Mapped[dict[str, Any]] = mapped_column(
        "provenance",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    activation_conditions_json: Mapped[dict[str, Any]] = mapped_column(
        "activation_conditions",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class SkillActivationORM(Base):
    __tablename__ = "skill_activations"
    __table_args__ = (
        ForeignKeyConstraint(
            ["company_id", "skill_id"],
            ["skills.company_id", "skills.id"],
            name="skill_activations_company_skill_fk",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["company_id", "version_id"],
            ["skill_versions.company_id", "skill_versions.id"],
            name="skill_activations_company_version_fk",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["company_id", "scope_agent_id"],
            ["agents.company_id", "agents.id"],
            name="skill_activations_company_scope_agent_fk",
            ondelete="SET NULL",
        ),
        _enum_check("skill_activations_scope_ck", "scope", SKILL_SCOPES),
        _enum_check("skill_activations_status_ck", "status", SKILL_ACTIVATION_STATUSES),
        Index("skill_activations_company_skill_status_idx", "company_id", "skill_id", "status", "activated_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    skill_id: Mapped[str] = mapped_column(String(64), nullable=False)
    version_id: Mapped[str] = mapped_column(String(64), nullable=False)
    instance_id: Mapped[str] = mapped_column(String(191), nullable=False)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    scope: Mapped[str] = mapped_column(String(32), nullable=False, default="instance")
    scope_agent_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    activation_conditions_json: Mapped[dict[str, Any]] = mapped_column(
        "activation_conditions",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    activated_by_type: Mapped[str] = mapped_column(String(32), nullable=False, default="system")
    activated_by_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    activated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )


class SkillUsageEventORM(Base):
    __tablename__ = "skill_usage_events"
    __table_args__ = (
        ForeignKeyConstraint(
            ["company_id", "skill_id"],
            ["skills.company_id", "skills.id"],
            name="skill_usage_company_skill_fk",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["company_id", "version_id"],
            ["skill_versions.company_id", "skill_versions.id"],
            name="skill_usage_company_version_fk",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["company_id", "activation_id"],
            ["skill_activations.company_id", "skill_activations.id"],
            name="skill_usage_company_activation_fk",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["company_id", "agent_id"],
            ["agents.company_id", "agents.id"],
            name="skill_usage_company_agent_fk",
            ondelete="SET NULL",
        ),
        _enum_check("skill_usage_outcome_ck", "outcome", SKILL_USAGE_OUTCOMES),
        Index("skill_usage_instance_skill_created_idx", "instance_id", "skill_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    skill_id: Mapped[str] = mapped_column(String(64), nullable=False)
    version_id: Mapped[str] = mapped_column(String(64), nullable=False)
    activation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    instance_id: Mapped[str] = mapped_column(String(191), nullable=False)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    agent_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    run_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    conversation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    outcome: Mapped[str] = mapped_column(String(32), nullable=False)
    details_json: Mapped[dict[str, Any]] = mapped_column(
        "details",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

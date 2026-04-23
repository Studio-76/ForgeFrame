"""SQLAlchemy substrate for assistant profiles and personal-assistant rules."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, CheckConstraint, DateTime, ForeignKeyConstraint, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.assistant_profiles.models import ASSISTANT_PROFILE_STATUSES, ASSISTANT_TONES
from app.storage.harness_repository import Base


def _enum_check(name: str, column: str, values: tuple[str, ...], *, nullable: bool = False) -> CheckConstraint:
    joined = ", ".join(f"'{value}'" for value in values)
    predicate = f"{column} IN ({joined})"
    if nullable:
        predicate = f"{column} IS NULL OR {predicate}"
    return CheckConstraint(predicate, name=name)


def _now() -> datetime:
    return datetime.now(tz=UTC)


class AssistantProfileORM(Base):
    __tablename__ = "assistant_profiles"
    __table_args__ = (
        ForeignKeyConstraint(
            ["company_id", "preferred_contact_id"],
            ["contacts.company_id", "contacts.id"],
            name="assistant_profiles_company_preferred_contact_fk",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["company_id", "mail_source_id"],
            ["knowledge_sources.company_id", "knowledge_sources.id"],
            name="assistant_profiles_company_mail_source_fk",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["company_id", "calendar_source_id"],
            ["knowledge_sources.company_id", "knowledge_sources.id"],
            name="assistant_profiles_company_calendar_source_fk",
            ondelete="SET NULL",
        ),
        _enum_check("assistant_profiles_status_ck", "status", ASSISTANT_PROFILE_STATUSES),
        _enum_check("assistant_profiles_tone_ck", "tone", ASSISTANT_TONES),
        Index("assistant_profiles_company_id_id_uq", "company_id", "id", unique=True),
        Index("assistant_profiles_instance_status_idx", "instance_id", "status", "assistant_mode_enabled"),
        Index("assistant_profiles_instance_default_idx", "instance_id", "is_default"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    instance_id: Mapped[str] = mapped_column(String(191), nullable=False)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    display_name: Mapped[str] = mapped_column(String(191), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    assistant_mode_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")
    locale: Mapped[str] = mapped_column(String(16), nullable=False, default="en-US")
    tone: Mapped[str] = mapped_column(String(32), nullable=False, default="neutral")
    preferred_contact_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    mail_source_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    calendar_source_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    preferences_json: Mapped[dict[str, Any]] = mapped_column(
        "preferences",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    communication_rules_json: Mapped[dict[str, Any]] = mapped_column(
        "communication_rules",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    quiet_hours_json: Mapped[dict[str, Any]] = mapped_column(
        "quiet_hours",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    delivery_preferences_json: Mapped[dict[str, Any]] = mapped_column(
        "delivery_preferences",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    action_policies_json: Mapped[dict[str, Any]] = mapped_column(
        "action_policies",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    delegation_rules_json: Mapped[dict[str, Any]] = mapped_column(
        "delegation_rules",
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
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


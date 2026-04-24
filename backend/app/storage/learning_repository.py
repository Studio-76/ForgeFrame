"""SQLAlchemy substrate for learning events."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, CheckConstraint, DateTime, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.learning.models import LEARNING_DECISIONS, LEARNING_STATUSES, LEARNING_TRIGGER_KINDS
from app.storage.harness_repository import Base


def _enum_check(name: str, column: str, values: tuple[str, ...], *, nullable: bool = False) -> CheckConstraint:
    joined = ", ".join(f"'{value}'" for value in values)
    predicate = f"{column} IN ({joined})"
    if nullable:
        predicate = f"{column} IS NULL OR {predicate}"
    return CheckConstraint(predicate, name=name)


def _now() -> datetime:
    return datetime.now(tz=UTC)


class LearningEventORM(Base):
    __tablename__ = "learning_events"
    __table_args__ = (
        _enum_check("learning_events_trigger_kind_ck", "trigger_kind", LEARNING_TRIGGER_KINDS),
        _enum_check("learning_events_suggested_decision_ck", "suggested_decision", LEARNING_DECISIONS),
        _enum_check("learning_events_status_ck", "status", LEARNING_STATUSES),
        Index("learning_events_company_id_id_uq", "company_id", "id", unique=True),
        Index("learning_events_instance_status_created_idx", "instance_id", "status", "created_at"),
        Index("learning_events_instance_trigger_created_idx", "instance_id", "trigger_kind", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    instance_id: Mapped[str] = mapped_column(String(191), nullable=False)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    trigger_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    suggested_decision: Mapped[str] = mapped_column(String(32), nullable=False, default="review_required")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False, default="")
    agent_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    run_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    conversation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    evidence_json: Mapped[dict[str, Any]] = mapped_column(
        "evidence",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    proposed_memory_json: Mapped[dict[str, Any]] = mapped_column(
        "proposed_memory",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    proposed_skill_json: Mapped[dict[str, Any]] = mapped_column(
        "proposed_skill",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    promoted_memory_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    promoted_skill_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    human_override: Mapped[bool] = mapped_column(default=False, nullable=False)
    decision_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

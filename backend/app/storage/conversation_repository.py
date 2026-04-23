"""SQLAlchemy substrate for conversations, thread history, and inbox persistence."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKeyConstraint, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.conversations.models import (
    CONVERSATION_STATUSES,
    INBOX_STATUSES,
    MESSAGE_ROLES,
    SESSION_KINDS,
    THREAD_STATUSES,
    TRIAGE_STATUSES,
    WORK_ITEM_PRIORITIES,
)
from app.storage.harness_repository import Base


def _enum_check(name: str, column: str, values: tuple[str, ...], *, nullable: bool = False) -> CheckConstraint:
    joined = ", ".join(f"'{value}'" for value in values)
    predicate = f"{column} IN ({joined})"
    if nullable:
        predicate = f"{column} IS NULL OR {predicate}"
    return CheckConstraint(predicate, name=name)


def _now() -> datetime:
    return datetime.now(tz=UTC)


class ConversationORM(Base):
    __tablename__ = "conversations"
    __table_args__ = (
        _enum_check("conversations_status_ck", "status", CONVERSATION_STATUSES),
        _enum_check("conversations_triage_status_ck", "triage_status", TRIAGE_STATUSES),
        _enum_check("conversations_priority_ck", "priority", WORK_ITEM_PRIORITIES),
        Index("conversations_company_id_id_uq", "company_id", "id", unique=True),
        Index("conversations_instance_triage_updated_idx", "instance_id", "triage_status", "updated_at"),
        Index("conversations_company_links_idx", "company_id", "workspace_id", "run_id", "approval_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    instance_id: Mapped[str] = mapped_column(String(191), nullable=False)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    workspace_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    subject: Mapped[str] = mapped_column(String(191), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="open")
    triage_status: Mapped[str] = mapped_column(String(32), nullable=False, default="new")
    priority: Mapped[str] = mapped_column(String(32), nullable=False, default="normal")
    contact_ref: Mapped[str | None] = mapped_column(String(191), nullable=True)
    run_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    artifact_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    approval_id: Mapped[str | None] = mapped_column(String(191), nullable=True)
    decision_id: Mapped[str | None] = mapped_column(String(191), nullable=True)
    active_thread_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    latest_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class ConversationThreadORM(Base):
    __tablename__ = "conversation_threads"
    __table_args__ = (
        ForeignKeyConstraint(
            ["company_id", "conversation_id"],
            ["conversations.company_id", "conversations.id"],
            name="conversation_threads_company_conversation_fk",
            ondelete="CASCADE",
        ),
        _enum_check("conversation_threads_status_ck", "status", THREAD_STATUSES),
        Index("conversation_threads_company_conversation_updated_idx", "company_id", "conversation_id", "updated_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    conversation_id: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(191), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="open")
    latest_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class ConversationSessionORM(Base):
    __tablename__ = "conversation_sessions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["company_id", "conversation_id"],
            ["conversations.company_id", "conversations.id"],
            name="conversation_sessions_company_conversation_fk",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["company_id", "thread_id"],
            ["conversation_threads.company_id", "conversation_threads.id"],
            name="conversation_sessions_company_thread_fk",
            ondelete="CASCADE",
        ),
        _enum_check("conversation_sessions_kind_ck", "session_kind", SESSION_KINDS),
        Index("conversation_sessions_company_thread_started_idx", "company_id", "thread_id", "started_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    conversation_id: Mapped[str] = mapped_column(String(64), nullable=False)
    thread_id: Mapped[str] = mapped_column(String(64), nullable=False)
    session_kind: Mapped[str] = mapped_column(String(32), nullable=False, default="operator")
    continuity_key: Mapped[str | None] = mapped_column(String(191), nullable=True)
    started_by_type: Mapped[str] = mapped_column(String(32), nullable=False, default="system")
    started_by_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ConversationMessageORM(Base):
    __tablename__ = "conversation_messages"
    __table_args__ = (
        ForeignKeyConstraint(
            ["company_id", "conversation_id"],
            ["conversations.company_id", "conversations.id"],
            name="conversation_messages_company_conversation_fk",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["company_id", "thread_id"],
            ["conversation_threads.company_id", "conversation_threads.id"],
            name="conversation_messages_company_thread_fk",
            ondelete="CASCADE",
        ),
        _enum_check("conversation_messages_role_ck", "message_role", MESSAGE_ROLES),
        Index("conversation_messages_company_thread_created_idx", "company_id", "thread_id", "created_at"),
        Index("conversation_messages_company_session_created_idx", "company_id", "session_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    conversation_id: Mapped[str] = mapped_column(String(64), nullable=False)
    thread_id: Mapped[str] = mapped_column(String(64), nullable=False)
    session_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    message_role: Mapped[str] = mapped_column(String(32), nullable=False, default="system")
    author_type: Mapped[str] = mapped_column(String(32), nullable=False, default="system")
    author_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    structured_payload_json: Mapped[dict[str, Any]] = mapped_column(
        "structured_payload",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class InboxItemORM(Base):
    __tablename__ = "inbox_items"
    __table_args__ = (
        ForeignKeyConstraint(
            ["company_id", "conversation_id"],
            ["conversations.company_id", "conversations.id"],
            name="inbox_items_company_conversation_fk",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["company_id", "thread_id"],
            ["conversation_threads.company_id", "conversation_threads.id"],
            name="inbox_items_company_thread_fk",
            ondelete="SET NULL",
        ),
        _enum_check("inbox_items_triage_status_ck", "triage_status", TRIAGE_STATUSES),
        _enum_check("inbox_items_priority_ck", "priority", WORK_ITEM_PRIORITIES),
        _enum_check("inbox_items_status_ck", "status", INBOX_STATUSES),
        Index("inbox_items_instance_triage_updated_idx", "instance_id", "triage_status", "updated_at"),
        Index("inbox_items_company_links_idx", "company_id", "conversation_id", "thread_id", "workspace_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    instance_id: Mapped[str] = mapped_column(String(191), nullable=False)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    conversation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    thread_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    workspace_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    title: Mapped[str] = mapped_column(String(191), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    triage_status: Mapped[str] = mapped_column(String(32), nullable=False, default="new")
    priority: Mapped[str] = mapped_column(String(32), nullable=False, default="normal")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="open")
    contact_ref: Mapped[str | None] = mapped_column(String(191), nullable=True)
    run_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    artifact_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    approval_id: Mapped[str | None] = mapped_column(String(191), nullable=True)
    decision_id: Mapped[str | None] = mapped_column(String(191), nullable=True)
    latest_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

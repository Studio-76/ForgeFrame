"""SQLAlchemy substrate for contacts, knowledge sources, and memory entries."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKeyConstraint, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.knowledge.models import (
    CONTACT_STATUSES,
    KNOWLEDGE_SOURCE_KINDS,
    KNOWLEDGE_SOURCE_STATUSES,
    MEMORY_KINDS,
    MEMORY_SENSITIVITIES,
    MEMORY_STATUSES,
    VISIBILITY_SCOPES,
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


class KnowledgeSourceORM(Base):
    __tablename__ = "knowledge_sources"
    __table_args__ = (
        _enum_check("knowledge_sources_kind_ck", "source_kind", KNOWLEDGE_SOURCE_KINDS),
        _enum_check("knowledge_sources_status_ck", "status", KNOWLEDGE_SOURCE_STATUSES),
        _enum_check("knowledge_sources_visibility_ck", "visibility_scope", VISIBILITY_SCOPES),
        Index("knowledge_sources_company_id_id_uq", "company_id", "id", unique=True),
        Index("knowledge_sources_instance_kind_status_idx", "instance_id", "source_kind", "status"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    instance_id: Mapped[str] = mapped_column(String(191), nullable=False)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    source_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    label: Mapped[str] = mapped_column(String(191), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    connection_target: Mapped[str] = mapped_column(String(400), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    visibility_scope: Mapped[str] = mapped_column(String(32), nullable=False, default="team")
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class ContactORM(Base):
    __tablename__ = "contacts"
    __table_args__ = (
        ForeignKeyConstraint(
            ["company_id", "source_id"],
            ["knowledge_sources.company_id", "knowledge_sources.id"],
            name="contacts_company_source_fk",
            ondelete="SET NULL",
        ),
        _enum_check("contacts_status_ck", "status", CONTACT_STATUSES),
        _enum_check("contacts_visibility_ck", "visibility_scope", VISIBILITY_SCOPES),
        Index("contacts_company_id_id_uq", "company_id", "id", unique=True),
        Index("contacts_company_ref_uq", "company_id", "contact_ref", unique=True),
        Index("contacts_instance_status_idx", "instance_id", "status", "updated_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    instance_id: Mapped[str] = mapped_column(String(191), nullable=False)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    contact_ref: Mapped[str] = mapped_column(String(191), nullable=False)
    source_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    display_name: Mapped[str] = mapped_column(String(191), nullable=False)
    primary_email: Mapped[str | None] = mapped_column(String(191), nullable=True)
    primary_phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    organization: Mapped[str | None] = mapped_column(String(191), nullable=True)
    title: Mapped[str | None] = mapped_column(String(191), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    visibility_scope: Mapped[str] = mapped_column(String(32), nullable=False, default="team")
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class MemoryEntryORM(Base):
    __tablename__ = "memory_entries"
    __table_args__ = (
        ForeignKeyConstraint(
            ["company_id", "source_id"],
            ["knowledge_sources.company_id", "knowledge_sources.id"],
            name="memory_entries_company_source_fk",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["company_id", "contact_id"],
            ["contacts.company_id", "contacts.id"],
            name="memory_entries_company_contact_fk",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["company_id", "conversation_id"],
            ["conversations.company_id", "conversations.id"],
            name="memory_entries_company_conversation_fk",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["company_id", "task_id"],
            ["tasks.company_id", "tasks.id"],
            name="memory_entries_company_task_fk",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["company_id", "notification_id"],
            ["notifications.company_id", "notifications.id"],
            name="memory_entries_company_notification_fk",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["company_id", "workspace_id"],
            ["workspaces.company_id", "workspaces.id"],
            name="memory_entries_company_workspace_fk",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["company_id", "supersedes_memory_id"],
            ["memory_entries.company_id", "memory_entries.id"],
            name="memory_entries_company_supersedes_fk",
            ondelete="SET NULL",
        ),
        CheckConstraint("supersedes_memory_id IS NULL OR supersedes_memory_id <> id", name="memory_entries_supersedes_self_ck"),
        _enum_check("memory_entries_kind_ck", "memory_kind", MEMORY_KINDS),
        _enum_check("memory_entries_status_ck", "status", MEMORY_STATUSES),
        _enum_check("memory_entries_visibility_ck", "visibility_scope", VISIBILITY_SCOPES),
        _enum_check("memory_entries_sensitivity_ck", "sensitivity", MEMORY_SENSITIVITIES),
        CheckConstraint("deleted_at IS NULL OR status = 'deleted'", name="memory_entries_deleted_status_ck"),
        Index("memory_entries_company_id_id_uq", "company_id", "id", unique=True),
        Index("memory_entries_instance_status_idx", "instance_id", "status", "updated_at"),
        Index("memory_entries_company_links_idx", "company_id", "source_id", "contact_id", "conversation_id", "task_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    instance_id: Mapped[str] = mapped_column(String(191), nullable=False)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    source_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    contact_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    conversation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    task_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    notification_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    workspace_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    memory_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(191), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    visibility_scope: Mapped[str] = mapped_column(String(32), nullable=False, default="team")
    sensitivity: Mapped[str] = mapped_column(String(32), nullable=False, default="normal")
    correction_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    supersedes_memory_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

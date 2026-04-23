"""SQLAlchemy substrate for tasks, reminders, automations, notifications, and channels."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, CheckConstraint, DateTime, ForeignKeyConstraint, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.storage.harness_repository import Base
from app.tasks.models import (
    AUTOMATION_ACTION_KINDS,
    AUTOMATION_STATUSES,
    DELIVERY_CHANNEL_KINDS,
    DELIVERY_CHANNEL_STATUSES,
    NOTIFICATION_DELIVERY_STATUSES,
    REMINDER_STATUSES,
    TASK_KINDS,
    TASK_STATUSES,
    WORK_ITEM_PRIORITIES,
)


def _enum_check(name: str, column: str, values: tuple[str, ...], *, nullable: bool = False) -> CheckConstraint:
    joined = ", ".join(f"'{value}'" for value in values)
    predicate = f"{column} IN ({joined})"
    if nullable:
        predicate = f"{column} IS NULL OR {predicate}"
    return CheckConstraint(predicate, name=name)


def _now() -> datetime:
    return datetime.now(tz=UTC)


class TaskORM(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        ForeignKeyConstraint(
            ["company_id", "conversation_id"],
            ["conversations.company_id", "conversations.id"],
            name="tasks_company_conversation_fk",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["company_id", "inbox_id"],
            ["inbox_items.company_id", "inbox_items.id"],
            name="tasks_company_inbox_fk",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["company_id", "workspace_id"],
            ["workspaces.company_id", "workspaces.id"],
            name="tasks_company_workspace_fk",
            ondelete="SET NULL",
        ),
        _enum_check("tasks_task_kind_ck", "task_kind", TASK_KINDS),
        _enum_check("tasks_status_ck", "status", TASK_STATUSES),
        _enum_check("tasks_priority_ck", "priority", WORK_ITEM_PRIORITIES),
        Index("tasks_company_id_id_uq", "company_id", "id", unique=True),
        Index("tasks_instance_status_due_idx", "instance_id", "status", "due_at"),
        Index("tasks_company_links_idx", "company_id", "conversation_id", "inbox_id", "workspace_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    instance_id: Mapped[str] = mapped_column(String(191), nullable=False)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    task_kind: Mapped[str] = mapped_column(String(32), nullable=False, default="task")
    title: Mapped[str] = mapped_column(String(191), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="open")
    priority: Mapped[str] = mapped_column(String(32), nullable=False, default="normal")
    owner_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    conversation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    inbox_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    workspace_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class DeliveryChannelORM(Base):
    __tablename__ = "delivery_channels"
    __table_args__ = (
        CheckConstraint("fallback_channel_id IS NULL OR fallback_channel_id <> id", name="delivery_channels_fallback_self_ck"),
        _enum_check("delivery_channels_kind_ck", "channel_kind", DELIVERY_CHANNEL_KINDS),
        _enum_check("delivery_channels_status_ck", "status", DELIVERY_CHANNEL_STATUSES),
        Index("delivery_channels_company_id_id_uq", "company_id", "id", unique=True),
        Index("delivery_channels_instance_status_idx", "instance_id", "status", "updated_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    instance_id: Mapped[str] = mapped_column(String(191), nullable=False)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    channel_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    label: Mapped[str] = mapped_column(String(191), nullable=False)
    target: Mapped[str] = mapped_column(String(400), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    fallback_channel_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class AutomationORM(Base):
    __tablename__ = "automations"
    __table_args__ = (
        _enum_check("automations_status_ck", "status", AUTOMATION_STATUSES),
        _enum_check("automations_action_kind_ck", "action_kind", AUTOMATION_ACTION_KINDS),
        CheckConstraint("cadence_minutes >= 1 AND cadence_minutes <= 10080", name="automations_cadence_minutes_ck"),
        ForeignKeyConstraint(
            ["company_id", "channel_id"],
            ["delivery_channels.company_id", "delivery_channels.id"],
            name="automations_company_channel_fk",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["company_id", "fallback_channel_id"],
            ["delivery_channels.company_id", "delivery_channels.id"],
            name="automations_company_fallback_channel_fk",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["company_id", "target_task_id"],
            ["tasks.company_id", "tasks.id"],
            name="automations_company_task_fk",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["company_id", "target_conversation_id"],
            ["conversations.company_id", "conversations.id"],
            name="automations_company_conversation_fk",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["company_id", "target_inbox_id"],
            ["inbox_items.company_id", "inbox_items.id"],
            name="automations_company_inbox_fk",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["company_id", "target_workspace_id"],
            ["workspaces.company_id", "workspaces.id"],
            name="automations_company_workspace_fk",
            ondelete="SET NULL",
        ),
        Index("automations_company_id_id_uq", "company_id", "id", unique=True),
        Index("automations_instance_status_next_run_idx", "instance_id", "status", "next_run_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    instance_id: Mapped[str] = mapped_column(String(191), nullable=False)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(191), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    action_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    cadence_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    next_run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    target_task_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    target_conversation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    target_inbox_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    target_workspace_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    channel_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    fallback_channel_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    preview_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    task_template_title: Mapped[str | None] = mapped_column(String(191), nullable=True)
    task_template_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    notification_title: Mapped[str | None] = mapped_column(String(191), nullable=True)
    notification_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_task_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_reminder_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_notification_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class NotificationORM(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        _enum_check("notifications_delivery_status_ck", "delivery_status", NOTIFICATION_DELIVERY_STATUSES),
        _enum_check("notifications_priority_ck", "priority", WORK_ITEM_PRIORITIES),
        CheckConstraint("retry_count >= 0", name="notifications_retry_count_ck"),
        CheckConstraint("max_retries >= 0", name="notifications_max_retries_ck"),
        ForeignKeyConstraint(
            ["company_id", "task_id"],
            ["tasks.company_id", "tasks.id"],
            name="notifications_company_task_fk",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["company_id", "channel_id"],
            ["delivery_channels.company_id", "delivery_channels.id"],
            name="notifications_company_channel_fk",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["company_id", "fallback_channel_id"],
            ["delivery_channels.company_id", "delivery_channels.id"],
            name="notifications_company_fallback_channel_fk",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["company_id", "conversation_id"],
            ["conversations.company_id", "conversations.id"],
            name="notifications_company_conversation_fk",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["company_id", "inbox_id"],
            ["inbox_items.company_id", "inbox_items.id"],
            name="notifications_company_inbox_fk",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["company_id", "workspace_id"],
            ["workspaces.company_id", "workspaces.id"],
            name="notifications_company_workspace_fk",
            ondelete="SET NULL",
        ),
        Index("notifications_company_id_id_uq", "company_id", "id", unique=True),
        Index("notifications_instance_status_attempt_idx", "instance_id", "delivery_status", "next_attempt_at"),
        Index("notifications_company_links_idx", "company_id", "task_id", "reminder_id", "conversation_id", "inbox_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    instance_id: Mapped[str] = mapped_column(String(191), nullable=False)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    task_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reminder_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    conversation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    inbox_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    workspace_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    channel_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    fallback_channel_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    title: Mapped[str] = mapped_column(String(191), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    delivery_status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    priority: Mapped[str] = mapped_column(String(32), nullable=False, default="normal")
    preview_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)


class ReminderORM(Base):
    __tablename__ = "reminders"
    __table_args__ = (
        _enum_check("reminders_status_ck", "status", REMINDER_STATUSES),
        ForeignKeyConstraint(
            ["company_id", "task_id"],
            ["tasks.company_id", "tasks.id"],
            name="reminders_company_task_fk",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["company_id", "automation_id"],
            ["automations.company_id", "automations.id"],
            name="reminders_company_automation_fk",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["company_id", "notification_id"],
            ["notifications.company_id", "notifications.id"],
            name="reminders_company_notification_fk",
            ondelete="SET NULL",
        ),
        Index("reminders_company_id_id_uq", "company_id", "id", unique=True),
        Index("reminders_instance_status_due_idx", "instance_id", "status", "due_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    instance_id: Mapped[str] = mapped_column(String(191), nullable=False)
    company_id: Mapped[str] = mapped_column(String(64), nullable=False)
    task_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    automation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    notification_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    title: Mapped[str] = mapped_column(String(191), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="scheduled")
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    triggered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB().with_variant(JSON(), "sqlite"),
        default=dict,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

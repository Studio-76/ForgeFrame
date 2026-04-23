"""Tasking, reminder, automation, notification, and channel contracts."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


WORK_ITEM_PRIORITIES = ("low", "normal", "high", "critical")
WorkItemPriority = Literal["low", "normal", "high", "critical"]

TASK_KINDS = ("task", "follow_up")
TaskKind = Literal["task", "follow_up"]

TASK_STATUSES = ("open", "in_progress", "blocked", "done", "cancelled")
TaskStatus = Literal["open", "in_progress", "blocked", "done", "cancelled"]

REMINDER_STATUSES = ("scheduled", "due", "triggered", "dismissed", "cancelled")
ReminderStatus = Literal["scheduled", "due", "triggered", "dismissed", "cancelled"]

AUTOMATION_STATUSES = ("active", "paused", "archived")
AutomationStatus = Literal["active", "paused", "archived"]

AUTOMATION_ACTION_KINDS = ("create_follow_up", "create_reminder", "create_notification")
AutomationActionKind = Literal["create_follow_up", "create_reminder", "create_notification"]

DELIVERY_CHANNEL_KINDS = ("in_app", "email", "webhook", "slack")
DeliveryChannelKind = Literal["in_app", "email", "webhook", "slack"]

DELIVERY_CHANNEL_STATUSES = ("active", "disabled", "degraded")
DeliveryChannelStatus = Literal["active", "disabled", "degraded"]

NOTIFICATION_DELIVERY_STATUSES = (
    "draft",
    "preview",
    "confirmed",
    "queued",
    "delivering",
    "delivered",
    "failed",
    "fallback_queued",
    "rejected",
    "cancelled",
)
NotificationDeliveryStatus = Literal[
    "draft",
    "preview",
    "confirmed",
    "queued",
    "delivering",
    "delivered",
    "failed",
    "fallback_queued",
    "rejected",
    "cancelled",
]


class DeliveryChannelSummary(BaseModel):
    channel_id: str
    instance_id: str
    company_id: str
    channel_kind: DeliveryChannelKind
    label: str
    target: str
    status: DeliveryChannelStatus
    fallback_channel_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    notification_count: int = 0
    created_at: datetime
    updated_at: datetime


class NotificationSummary(BaseModel):
    notification_id: str
    instance_id: str
    company_id: str
    task_id: str | None = None
    reminder_id: str | None = None
    conversation_id: str | None = None
    inbox_id: str | None = None
    workspace_id: str | None = None
    channel_id: str | None = None
    fallback_channel_id: str | None = None
    title: str
    body: str
    delivery_status: NotificationDeliveryStatus
    priority: WorkItemPriority
    preview_required: bool = True
    retry_count: int = 0
    max_retries: int = 0
    next_attempt_at: datetime | None = None
    last_attempt_at: datetime | None = None
    delivered_at: datetime | None = None
    rejected_at: datetime | None = None
    last_error: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class ReminderSummary(BaseModel):
    reminder_id: str
    instance_id: str
    company_id: str
    task_id: str | None = None
    automation_id: str | None = None
    notification_id: str | None = None
    title: str
    summary: str = ""
    status: ReminderStatus
    due_at: datetime
    triggered_at: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class AutomationSummary(BaseModel):
    automation_id: str
    instance_id: str
    company_id: str
    title: str
    summary: str = ""
    status: AutomationStatus
    action_kind: AutomationActionKind
    cadence_minutes: int
    next_run_at: datetime
    last_run_at: datetime | None = None
    target_task_id: str | None = None
    target_conversation_id: str | None = None
    target_inbox_id: str | None = None
    target_workspace_id: str | None = None
    channel_id: str | None = None
    fallback_channel_id: str | None = None
    preview_required: bool = True
    last_task_id: str | None = None
    last_reminder_id: str | None = None
    last_notification_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class TaskSummary(BaseModel):
    task_id: str
    instance_id: str
    company_id: str
    task_kind: TaskKind
    title: str
    summary: str = ""
    status: TaskStatus
    priority: WorkItemPriority
    owner_id: str | None = None
    conversation_id: str | None = None
    inbox_id: str | None = None
    workspace_id: str | None = None
    due_at: datetime | None = None
    completed_at: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    reminder_count: int = 0
    notification_count: int = 0
    created_at: datetime
    updated_at: datetime


class TaskDetail(TaskSummary):
    reminders: list[ReminderSummary] = Field(default_factory=list)
    notifications: list[NotificationSummary] = Field(default_factory=list)


class ReminderDetail(ReminderSummary):
    task: TaskSummary | None = None
    notification: NotificationSummary | None = None


class AutomationDetail(AutomationSummary):
    task: TaskSummary | None = None
    channel: DeliveryChannelSummary | None = None


class NotificationDetail(NotificationSummary):
    task: TaskSummary | None = None
    reminder: ReminderSummary | None = None
    channel: DeliveryChannelSummary | None = None


class ChannelDetail(DeliveryChannelSummary):
    recent_notifications: list[NotificationSummary] = Field(default_factory=list)


class CreateTask(BaseModel):
    task_id: str | None = Field(default=None, min_length=1, max_length=64)
    task_kind: TaskKind = "task"
    title: str = Field(min_length=1, max_length=191)
    summary: str = Field(default="", max_length=4000)
    status: TaskStatus = "open"
    priority: WorkItemPriority = "normal"
    owner_id: str | None = Field(default=None, max_length=64)
    conversation_id: str | None = Field(default=None, max_length=64)
    inbox_id: str | None = Field(default=None, max_length=64)
    workspace_id: str | None = Field(default=None, max_length=64)
    due_at: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class UpdateTask(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=191)
    summary: str | None = Field(default=None, max_length=4000)
    status: TaskStatus | None = None
    priority: WorkItemPriority | None = None
    owner_id: str | None = Field(default=None, max_length=64)
    conversation_id: str | None = Field(default=None, max_length=64)
    inbox_id: str | None = Field(default=None, max_length=64)
    workspace_id: str | None = Field(default=None, max_length=64)
    due_at: datetime | None = None
    completed_at: datetime | None = None
    metadata: dict[str, Any] | None = None


class CreateReminder(BaseModel):
    reminder_id: str | None = Field(default=None, min_length=1, max_length=64)
    task_id: str | None = Field(default=None, max_length=64)
    automation_id: str | None = Field(default=None, max_length=64)
    title: str = Field(min_length=1, max_length=191)
    summary: str = Field(default="", max_length=4000)
    due_at: datetime
    metadata: dict[str, Any] = Field(default_factory=dict)


class UpdateReminder(BaseModel):
    task_id: str | None = Field(default=None, max_length=64)
    title: str | None = Field(default=None, min_length=1, max_length=191)
    summary: str | None = Field(default=None, max_length=4000)
    status: ReminderStatus | None = None
    due_at: datetime | None = None
    triggered_at: datetime | None = None
    notification_id: str | None = Field(default=None, max_length=64)
    metadata: dict[str, Any] | None = None


class CreateAutomation(BaseModel):
    automation_id: str | None = Field(default=None, min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=191)
    summary: str = Field(default="", max_length=4000)
    action_kind: AutomationActionKind
    cadence_minutes: int = Field(ge=1, le=10080)
    next_run_at: datetime
    target_task_id: str | None = Field(default=None, max_length=64)
    target_conversation_id: str | None = Field(default=None, max_length=64)
    target_inbox_id: str | None = Field(default=None, max_length=64)
    target_workspace_id: str | None = Field(default=None, max_length=64)
    channel_id: str | None = Field(default=None, max_length=64)
    fallback_channel_id: str | None = Field(default=None, max_length=64)
    preview_required: bool = True
    task_template_title: str | None = Field(default=None, max_length=191)
    task_template_summary: str | None = Field(default=None, max_length=4000)
    notification_title: str | None = Field(default=None, max_length=191)
    notification_body: str | None = Field(default=None, max_length=4000)
    metadata: dict[str, Any] = Field(default_factory=dict)


class UpdateAutomation(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=191)
    summary: str | None = Field(default=None, max_length=4000)
    status: AutomationStatus | None = None
    cadence_minutes: int | None = Field(default=None, ge=1, le=10080)
    next_run_at: datetime | None = None
    target_task_id: str | None = Field(default=None, max_length=64)
    target_conversation_id: str | None = Field(default=None, max_length=64)
    target_inbox_id: str | None = Field(default=None, max_length=64)
    target_workspace_id: str | None = Field(default=None, max_length=64)
    channel_id: str | None = Field(default=None, max_length=64)
    fallback_channel_id: str | None = Field(default=None, max_length=64)
    preview_required: bool | None = None
    task_template_title: str | None = Field(default=None, max_length=191)
    task_template_summary: str | None = Field(default=None, max_length=4000)
    notification_title: str | None = Field(default=None, max_length=191)
    notification_body: str | None = Field(default=None, max_length=4000)
    metadata: dict[str, Any] | None = None


class CreateDeliveryChannel(BaseModel):
    channel_id: str | None = Field(default=None, min_length=1, max_length=64)
    channel_kind: DeliveryChannelKind
    label: str = Field(min_length=1, max_length=191)
    target: str = Field(min_length=1, max_length=400)
    status: DeliveryChannelStatus = "active"
    fallback_channel_id: str | None = Field(default=None, max_length=64)
    metadata: dict[str, Any] = Field(default_factory=dict)


class UpdateDeliveryChannel(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=191)
    target: str | None = Field(default=None, min_length=1, max_length=400)
    status: DeliveryChannelStatus | None = None
    fallback_channel_id: str | None = Field(default=None, max_length=64)
    metadata: dict[str, Any] | None = None


class CreateNotification(BaseModel):
    notification_id: str | None = Field(default=None, min_length=1, max_length=64)
    task_id: str | None = Field(default=None, max_length=64)
    reminder_id: str | None = Field(default=None, max_length=64)
    conversation_id: str | None = Field(default=None, max_length=64)
    inbox_id: str | None = Field(default=None, max_length=64)
    workspace_id: str | None = Field(default=None, max_length=64)
    channel_id: str | None = Field(default=None, max_length=64)
    fallback_channel_id: str | None = Field(default=None, max_length=64)
    title: str = Field(min_length=1, max_length=191)
    body: str = Field(min_length=1, max_length=4000)
    priority: WorkItemPriority = "normal"
    preview_required: bool = True
    max_retries: int = Field(default=0, ge=0, le=10)
    metadata: dict[str, Any] = Field(default_factory=dict)


class UpdateNotification(BaseModel):
    channel_id: str | None = Field(default=None, max_length=64)
    fallback_channel_id: str | None = Field(default=None, max_length=64)
    title: str | None = Field(default=None, min_length=1, max_length=191)
    body: str | None = Field(default=None, min_length=1, max_length=4000)
    delivery_status: NotificationDeliveryStatus | None = None
    priority: WorkItemPriority | None = None
    preview_required: bool | None = None
    max_retries: int | None = Field(default=None, ge=0, le=10)
    last_error: str | None = Field(default=None, max_length=4000)
    metadata: dict[str, Any] | None = None


class NotificationActionResult(BaseModel):
    notification: NotificationDetail
    action: str

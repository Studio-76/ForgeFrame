"""Admin-facing tasking, reminder, automation, notification, and channel service."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.conversations.models import ConversationSummary, InboxSummary
from app.instances.models import InstanceRecord
from app.storage.conversation_repository import ConversationORM, InboxItemORM
from app.storage.tasking_repository import (
    AutomationORM,
    DeliveryChannelORM,
    NotificationORM,
    ReminderORM,
    TaskORM,
)
from app.storage.workspace_repository import WorkspaceORM
from app.tasks.models import (
    AutomationDetail,
    AutomationSummary,
    ChannelDetail,
    CreateAutomation,
    CreateDeliveryChannel,
    CreateNotification,
    CreateReminder,
    CreateTask,
    DeliveryChannelSummary,
    NotificationActionResult,
    NotificationDetail,
    NotificationSummary,
    ReminderDetail,
    ReminderSummary,
    TaskDetail,
    TaskSummary,
    UpdateAutomation,
    UpdateDeliveryChannel,
    UpdateNotification,
    UpdateReminder,
    UpdateTask,
)

SessionFactory = Callable[[], Session]


class TaskAutomationAdminService:
    def __init__(self, session_factory: SessionFactory) -> None:
        self._session_factory = session_factory

    @staticmethod
    def _now() -> datetime:
        return datetime.now(tz=UTC)

    @staticmethod
    def _new_id(prefix: str) -> str:
        return f"{prefix}_{uuid4().hex[:20]}"

    @staticmethod
    def _load_conversation(session: Session, *, instance: InstanceRecord, conversation_id: str) -> ConversationORM:
        row = session.get(ConversationORM, conversation_id)
        if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
            raise ValueError(f"Conversation '{conversation_id}' was not found.")
        return row

    @staticmethod
    def _load_inbox(session: Session, *, instance: InstanceRecord, inbox_id: str) -> InboxItemORM:
        row = session.get(InboxItemORM, inbox_id)
        if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
            raise ValueError(f"Inbox item '{inbox_id}' was not found.")
        return row

    @staticmethod
    def _load_workspace(session: Session, *, company_id: str, workspace_id: str) -> WorkspaceORM:
        row = session.get(WorkspaceORM, workspace_id)
        if row is None or row.company_id != company_id:
            raise ValueError(f"Workspace '{workspace_id}' was not found.")
        return row

    @staticmethod
    def _load_task(session: Session, *, instance: InstanceRecord, task_id: str) -> TaskORM:
        row = session.get(TaskORM, task_id)
        if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
            raise ValueError(f"Task '{task_id}' was not found.")
        return row

    @staticmethod
    def _load_reminder(session: Session, *, instance: InstanceRecord, reminder_id: str) -> ReminderORM:
        row = session.get(ReminderORM, reminder_id)
        if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
            raise ValueError(f"Reminder '{reminder_id}' was not found.")
        return row

    @staticmethod
    def _load_channel(session: Session, *, instance: InstanceRecord, channel_id: str) -> DeliveryChannelORM:
        row = session.get(DeliveryChannelORM, channel_id)
        if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
            raise ValueError(f"Channel '{channel_id}' was not found.")
        return row

    @staticmethod
    def _load_notification(session: Session, *, instance: InstanceRecord, notification_id: str) -> NotificationORM:
        row = session.get(NotificationORM, notification_id)
        if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
            raise ValueError(f"Notification '{notification_id}' was not found.")
        return row

    @staticmethod
    def _load_automation(session: Session, *, instance: InstanceRecord, automation_id: str) -> AutomationORM:
        row = session.get(AutomationORM, automation_id)
        if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
            raise ValueError(f"Automation '{automation_id}' was not found.")
        return row

    def _validate_work_links(
        self,
        session: Session,
        *,
        instance: InstanceRecord,
        conversation_id: str | None = None,
        inbox_id: str | None = None,
        workspace_id: str | None = None,
    ) -> None:
        if conversation_id:
            self._load_conversation(session, instance=instance, conversation_id=conversation_id)
        if inbox_id:
            self._load_inbox(session, instance=instance, inbox_id=inbox_id)
        if workspace_id:
            self._load_workspace(session, company_id=instance.company_id, workspace_id=workspace_id)

    def _validate_channel_links(
        self,
        session: Session,
        *,
        instance: InstanceRecord,
        channel_id: str | None = None,
        fallback_channel_id: str | None = None,
    ) -> None:
        if channel_id:
            self._load_channel(session, instance=instance, channel_id=channel_id)
        if fallback_channel_id:
            self._load_channel(session, instance=instance, channel_id=fallback_channel_id)
        if channel_id and fallback_channel_id and channel_id == fallback_channel_id:
            raise ValueError("Primary and fallback channel must not be identical.")

    def _materialize_due_reminders(self, session: Session, *, instance: InstanceRecord) -> None:
        now = self._now()
        for reminder in session.execute(
            select(ReminderORM).where(
                ReminderORM.company_id == instance.company_id,
                ReminderORM.instance_id == instance.instance_id,
                ReminderORM.status == "scheduled",
                ReminderORM.due_at <= now,
            )
        ).scalars().all():
            reminder.status = "due"
            reminder.updated_at = now

    def _task_summary(self, session: Session, row: TaskORM) -> TaskSummary:
        reminder_count = session.scalar(
            select(func.count()).select_from(ReminderORM).where(
                ReminderORM.company_id == row.company_id,
                ReminderORM.task_id == row.id,
            )
        ) or 0
        notification_count = session.scalar(
            select(func.count()).select_from(NotificationORM).where(
                NotificationORM.company_id == row.company_id,
                NotificationORM.task_id == row.id,
            )
        ) or 0
        return TaskSummary(
            task_id=row.id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            task_kind=row.task_kind,  # type: ignore[arg-type]
            title=row.title,
            summary=row.summary,
            status=row.status,  # type: ignore[arg-type]
            priority=row.priority,  # type: ignore[arg-type]
            owner_id=row.owner_id,
            conversation_id=row.conversation_id,
            inbox_id=row.inbox_id,
            workspace_id=row.workspace_id,
            due_at=row.due_at,
            completed_at=row.completed_at,
            metadata=dict(row.metadata_json or {}),
            reminder_count=int(reminder_count),
            notification_count=int(notification_count),
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    @staticmethod
    def _reminder_summary(row: ReminderORM) -> ReminderSummary:
        return ReminderSummary(
            reminder_id=row.id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            task_id=row.task_id,
            automation_id=row.automation_id,
            notification_id=row.notification_id,
            title=row.title,
            summary=row.summary,
            status=row.status,  # type: ignore[arg-type]
            due_at=row.due_at,
            triggered_at=row.triggered_at,
            metadata=dict(row.metadata_json or {}),
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    @staticmethod
    def _channel_summary(row: DeliveryChannelORM, *, notification_count: int) -> DeliveryChannelSummary:
        return DeliveryChannelSummary(
            channel_id=row.id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            channel_kind=row.channel_kind,  # type: ignore[arg-type]
            label=row.label,
            target=row.target,
            status=row.status,  # type: ignore[arg-type]
            fallback_channel_id=row.fallback_channel_id,
            metadata=dict(row.metadata_json or {}),
            notification_count=notification_count,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    @staticmethod
    def _notification_summary(row: NotificationORM) -> NotificationSummary:
        return NotificationSummary(
            notification_id=row.id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            task_id=row.task_id,
            reminder_id=row.reminder_id,
            conversation_id=row.conversation_id,
            inbox_id=row.inbox_id,
            workspace_id=row.workspace_id,
            channel_id=row.channel_id,
            fallback_channel_id=row.fallback_channel_id,
            title=row.title,
            body=row.body,
            delivery_status=row.delivery_status,  # type: ignore[arg-type]
            priority=row.priority,  # type: ignore[arg-type]
            preview_required=row.preview_required,
            retry_count=row.retry_count,
            max_retries=row.max_retries,
            next_attempt_at=row.next_attempt_at,
            last_attempt_at=row.last_attempt_at,
            delivered_at=row.delivered_at,
            rejected_at=row.rejected_at,
            last_error=row.last_error,
            metadata=dict(row.metadata_json or {}),
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    @staticmethod
    def _automation_summary(row: AutomationORM) -> AutomationSummary:
        return AutomationSummary(
            automation_id=row.id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            title=row.title,
            summary=row.summary,
            status=row.status,  # type: ignore[arg-type]
            action_kind=row.action_kind,  # type: ignore[arg-type]
            cadence_minutes=row.cadence_minutes,
            next_run_at=row.next_run_at,
            last_run_at=row.last_run_at,
            target_task_id=row.target_task_id,
            target_conversation_id=row.target_conversation_id,
            target_inbox_id=row.target_inbox_id,
            target_workspace_id=row.target_workspace_id,
            channel_id=row.channel_id,
            fallback_channel_id=row.fallback_channel_id,
            preview_required=row.preview_required,
            last_task_id=row.last_task_id,
            last_reminder_id=row.last_reminder_id,
            last_notification_id=row.last_notification_id,
            metadata=dict(row.metadata_json or {}),
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    def list_tasks(self, *, instance: InstanceRecord, status: str | None = None, limit: int = 100) -> list[TaskSummary]:
        with self._session_factory() as session:
            stmt = select(TaskORM).where(TaskORM.company_id == instance.company_id, TaskORM.instance_id == instance.instance_id)
            if status is not None:
                stmt = stmt.where(TaskORM.status == status)
            rows = session.execute(stmt.order_by(TaskORM.updated_at.desc()).limit(max(1, min(limit, 200)))).scalars().all()
            return [self._task_summary(session, row) for row in rows]

    def get_task(self, *, instance: InstanceRecord, task_id: str) -> TaskDetail:
        with self._session_factory() as session:
            row = self._load_task(session, instance=instance, task_id=task_id)
            summary = self._task_summary(session, row)
            reminders = session.execute(
                select(ReminderORM).where(ReminderORM.company_id == instance.company_id, ReminderORM.task_id == task_id).order_by(ReminderORM.due_at.asc())
            ).scalars().all()
            notifications = session.execute(
                select(NotificationORM).where(NotificationORM.company_id == instance.company_id, NotificationORM.task_id == task_id).order_by(NotificationORM.updated_at.desc())
            ).scalars().all()
            return TaskDetail(
                **summary.model_dump(),
                reminders=[self._reminder_summary(item) for item in reminders],
                notifications=[self._notification_summary(item) for item in notifications],
            )

    def create_task(self, *, instance: InstanceRecord, payload: CreateTask) -> TaskDetail:
        with self._session_factory() as session, session.begin():
            self._validate_work_links(
                session,
                instance=instance,
                conversation_id=payload.conversation_id,
                inbox_id=payload.inbox_id,
                workspace_id=payload.workspace_id,
            )
            task_id = (payload.task_id or "").strip() or self._new_id("task")
            existing = session.get(TaskORM, task_id)
            if existing is not None and existing.company_id == instance.company_id:
                raise ValueError(f"Task '{task_id}' already exists.")
            now = self._now()
            row = TaskORM(
                id=task_id,
                instance_id=instance.instance_id,
                company_id=instance.company_id,
                task_kind=payload.task_kind,
                title=payload.title.strip(),
                summary=payload.summary.strip(),
                status=payload.status,
                priority=payload.priority,
                owner_id=payload.owner_id,
                conversation_id=payload.conversation_id,
                inbox_id=payload.inbox_id,
                workspace_id=payload.workspace_id,
                due_at=payload.due_at,
                metadata_json=dict(payload.metadata),
                created_at=now,
                updated_at=now,
            )
            session.add(row)
        return self.get_task(instance=instance, task_id=task_id)

    def update_task(self, *, instance: InstanceRecord, task_id: str, payload: UpdateTask) -> TaskDetail:
        with self._session_factory() as session, session.begin():
            row = self._load_task(session, instance=instance, task_id=task_id)
            self._validate_work_links(
                session,
                instance=instance,
                conversation_id=payload.conversation_id if payload.conversation_id is not None else row.conversation_id,
                inbox_id=payload.inbox_id if payload.inbox_id is not None else row.inbox_id,
                workspace_id=payload.workspace_id if payload.workspace_id is not None else row.workspace_id,
            )
            row.title = payload.title.strip() if payload.title is not None else row.title
            row.summary = payload.summary.strip() if payload.summary is not None else row.summary
            row.status = payload.status or row.status
            row.priority = payload.priority or row.priority
            row.owner_id = payload.owner_id if payload.owner_id is not None else row.owner_id
            row.conversation_id = payload.conversation_id if payload.conversation_id is not None else row.conversation_id
            row.inbox_id = payload.inbox_id if payload.inbox_id is not None else row.inbox_id
            row.workspace_id = payload.workspace_id if payload.workspace_id is not None else row.workspace_id
            row.due_at = payload.due_at if payload.due_at is not None else row.due_at
            row.completed_at = payload.completed_at if payload.completed_at is not None else row.completed_at
            row.metadata_json = dict(payload.metadata) if payload.metadata is not None else dict(row.metadata_json or {})
            row.updated_at = self._now()
        return self.get_task(instance=instance, task_id=task_id)

    def list_reminders(self, *, instance: InstanceRecord, status: str | None = None, limit: int = 100) -> list[ReminderSummary]:
        with self._session_factory() as session, session.begin():
            self._materialize_due_reminders(session, instance=instance)
            stmt = select(ReminderORM).where(ReminderORM.company_id == instance.company_id, ReminderORM.instance_id == instance.instance_id)
            if status is not None:
                stmt = stmt.where(ReminderORM.status == status)
            rows = session.execute(stmt.order_by(ReminderORM.due_at.asc()).limit(max(1, min(limit, 200)))).scalars().all()
            return [self._reminder_summary(row) for row in rows]

    def get_reminder(self, *, instance: InstanceRecord, reminder_id: str) -> ReminderDetail:
        with self._session_factory() as session, session.begin():
            self._materialize_due_reminders(session, instance=instance)
            row = self._load_reminder(session, instance=instance, reminder_id=reminder_id)
            summary = self._reminder_summary(row)
            task = self._task_summary(session, self._load_task(session, instance=instance, task_id=row.task_id)) if row.task_id else None
            notification = self._notification_summary(self._load_notification(session, instance=instance, notification_id=row.notification_id)) if row.notification_id else None
            return ReminderDetail(**summary.model_dump(), task=task, notification=notification)

    def create_reminder(self, *, instance: InstanceRecord, payload: CreateReminder) -> ReminderDetail:
        with self._session_factory() as session, session.begin():
            if payload.task_id:
                self._load_task(session, instance=instance, task_id=payload.task_id)
            if payload.automation_id:
                self._load_automation(session, instance=instance, automation_id=payload.automation_id)
            reminder_id = (payload.reminder_id or "").strip() or self._new_id("reminder")
            existing = session.get(ReminderORM, reminder_id)
            if existing is not None and existing.company_id == instance.company_id:
                raise ValueError(f"Reminder '{reminder_id}' already exists.")
            now = self._now()
            status = "due" if payload.due_at <= now else "scheduled"
            session.add(
                ReminderORM(
                    id=reminder_id,
                    instance_id=instance.instance_id,
                    company_id=instance.company_id,
                    task_id=payload.task_id,
                    automation_id=payload.automation_id,
                    title=payload.title.strip(),
                    summary=payload.summary.strip(),
                    status=status,
                    due_at=payload.due_at,
                    metadata_json=dict(payload.metadata),
                    created_at=now,
                    updated_at=now,
                )
            )
        return self.get_reminder(instance=instance, reminder_id=reminder_id)

    def update_reminder(self, *, instance: InstanceRecord, reminder_id: str, payload: UpdateReminder) -> ReminderDetail:
        with self._session_factory() as session, session.begin():
            row = self._load_reminder(session, instance=instance, reminder_id=reminder_id)
            if payload.task_id:
                self._load_task(session, instance=instance, task_id=payload.task_id)
            if payload.notification_id:
                self._load_notification(session, instance=instance, notification_id=payload.notification_id)
            row.task_id = payload.task_id if payload.task_id is not None else row.task_id
            row.title = payload.title.strip() if payload.title is not None else row.title
            row.summary = payload.summary.strip() if payload.summary is not None else row.summary
            row.status = payload.status or row.status
            row.due_at = payload.due_at if payload.due_at is not None else row.due_at
            row.triggered_at = payload.triggered_at if payload.triggered_at is not None else row.triggered_at
            row.notification_id = payload.notification_id if payload.notification_id is not None else row.notification_id
            row.metadata_json = dict(payload.metadata) if payload.metadata is not None else dict(row.metadata_json or {})
            row.updated_at = self._now()
        return self.get_reminder(instance=instance, reminder_id=reminder_id)

    def list_channels(self, *, instance: InstanceRecord, status: str | None = None, limit: int = 100) -> list[DeliveryChannelSummary]:
        with self._session_factory() as session:
            stmt = select(DeliveryChannelORM).where(DeliveryChannelORM.company_id == instance.company_id, DeliveryChannelORM.instance_id == instance.instance_id)
            if status is not None:
                stmt = stmt.where(DeliveryChannelORM.status == status)
            rows = session.execute(stmt.order_by(DeliveryChannelORM.updated_at.desc()).limit(max(1, min(limit, 200)))).scalars().all()
            return [
                self._channel_summary(
                    row,
                    notification_count=int(session.scalar(select(func.count()).select_from(NotificationORM).where(NotificationORM.company_id == instance.company_id, NotificationORM.channel_id == row.id)) or 0),
                )
                for row in rows
            ]

    def get_channel(self, *, instance: InstanceRecord, channel_id: str) -> ChannelDetail:
        with self._session_factory() as session:
            row = self._load_channel(session, instance=instance, channel_id=channel_id)
            summary = self._channel_summary(
                row,
                notification_count=int(session.scalar(select(func.count()).select_from(NotificationORM).where(NotificationORM.company_id == instance.company_id, NotificationORM.channel_id == row.id)) or 0),
            )
            recent = session.execute(
                select(NotificationORM).where(NotificationORM.company_id == instance.company_id, NotificationORM.channel_id == channel_id).order_by(NotificationORM.updated_at.desc()).limit(20)
            ).scalars().all()
            return ChannelDetail(**summary.model_dump(), recent_notifications=[self._notification_summary(item) for item in recent])

    def create_channel(self, *, instance: InstanceRecord, payload: CreateDeliveryChannel) -> ChannelDetail:
        with self._session_factory() as session, session.begin():
            channel_id = (payload.channel_id or "").strip() or self._new_id("channel")
            if payload.fallback_channel_id and payload.fallback_channel_id == channel_id:
                raise ValueError("Primary and fallback channel must not be identical.")
            self._validate_channel_links(session, instance=instance, fallback_channel_id=payload.fallback_channel_id)
            existing = session.get(DeliveryChannelORM, channel_id)
            if existing is not None and existing.company_id == instance.company_id:
                raise ValueError(f"Channel '{channel_id}' already exists.")
            now = self._now()
            session.add(
                DeliveryChannelORM(
                    id=channel_id,
                    instance_id=instance.instance_id,
                    company_id=instance.company_id,
                    channel_kind=payload.channel_kind,
                    label=payload.label.strip(),
                    target=payload.target.strip(),
                    status=payload.status,
                    fallback_channel_id=payload.fallback_channel_id,
                    metadata_json=dict(payload.metadata),
                    created_at=now,
                    updated_at=now,
                )
            )
        return self.get_channel(instance=instance, channel_id=channel_id)

    def update_channel(self, *, instance: InstanceRecord, channel_id: str, payload: UpdateDeliveryChannel) -> ChannelDetail:
        with self._session_factory() as session, session.begin():
            row = self._load_channel(session, instance=instance, channel_id=channel_id)
            fallback_channel_id = payload.fallback_channel_id if payload.fallback_channel_id is not None else row.fallback_channel_id
            self._validate_channel_links(session, instance=instance, fallback_channel_id=fallback_channel_id)
            row.label = payload.label.strip() if payload.label is not None else row.label
            row.target = payload.target.strip() if payload.target is not None else row.target
            row.status = payload.status or row.status
            row.fallback_channel_id = fallback_channel_id
            row.metadata_json = dict(payload.metadata) if payload.metadata is not None else dict(row.metadata_json or {})
            row.updated_at = self._now()
        return self.get_channel(instance=instance, channel_id=channel_id)

    def list_notifications(
        self,
        *,
        instance: InstanceRecord,
        delivery_status: str | None = None,
        priority: str | None = None,
        limit: int = 100,
    ) -> list[NotificationSummary]:
        with self._session_factory() as session:
            stmt = select(NotificationORM).where(NotificationORM.company_id == instance.company_id, NotificationORM.instance_id == instance.instance_id)
            if delivery_status is not None:
                stmt = stmt.where(NotificationORM.delivery_status == delivery_status)
            if priority is not None:
                stmt = stmt.where(NotificationORM.priority == priority)
            rows = session.execute(stmt.order_by(NotificationORM.updated_at.desc()).limit(max(1, min(limit, 200)))).scalars().all()
            return [self._notification_summary(row) for row in rows]

    def get_notification(self, *, instance: InstanceRecord, notification_id: str) -> NotificationDetail:
        with self._session_factory() as session:
            row = self._load_notification(session, instance=instance, notification_id=notification_id)
            summary = self._notification_summary(row)
            task = self._task_summary(session, self._load_task(session, instance=instance, task_id=row.task_id)) if row.task_id else None
            reminder = self._reminder_summary(self._load_reminder(session, instance=instance, reminder_id=row.reminder_id)) if row.reminder_id else None
            channel = self._channel_summary(
                self._load_channel(session, instance=instance, channel_id=row.channel_id),
                notification_count=int(session.scalar(select(func.count()).select_from(NotificationORM).where(NotificationORM.company_id == instance.company_id, NotificationORM.channel_id == row.channel_id)) or 0),
            ) if row.channel_id else None
            return NotificationDetail(**summary.model_dump(), task=task, reminder=reminder, channel=channel)

    def create_notification(self, *, instance: InstanceRecord, payload: CreateNotification) -> NotificationDetail:
        with self._session_factory() as session, session.begin():
            if payload.task_id:
                self._load_task(session, instance=instance, task_id=payload.task_id)
            if payload.reminder_id:
                self._load_reminder(session, instance=instance, reminder_id=payload.reminder_id)
            self._validate_work_links(
                session,
                instance=instance,
                conversation_id=payload.conversation_id,
                inbox_id=payload.inbox_id,
                workspace_id=payload.workspace_id,
            )
            self._validate_channel_links(
                session,
                instance=instance,
                channel_id=payload.channel_id,
                fallback_channel_id=payload.fallback_channel_id,
            )
            notification_id = (payload.notification_id or "").strip() or self._new_id("notification")
            existing = session.get(NotificationORM, notification_id)
            if existing is not None and existing.company_id == instance.company_id:
                raise ValueError(f"Notification '{notification_id}' already exists.")
            now = self._now()
            delivery_status = "preview" if payload.preview_required else "queued"
            next_attempt_at = None if payload.preview_required else now
            session.add(
                NotificationORM(
                    id=notification_id,
                    instance_id=instance.instance_id,
                    company_id=instance.company_id,
                    task_id=payload.task_id,
                    reminder_id=payload.reminder_id,
                    conversation_id=payload.conversation_id,
                    inbox_id=payload.inbox_id,
                    workspace_id=payload.workspace_id,
                    channel_id=payload.channel_id,
                    fallback_channel_id=payload.fallback_channel_id,
                    title=payload.title.strip(),
                    body=payload.body.strip(),
                    delivery_status=delivery_status,
                    priority=payload.priority,
                    preview_required=payload.preview_required,
                    max_retries=payload.max_retries,
                    next_attempt_at=next_attempt_at,
                    metadata_json=dict(payload.metadata),
                    created_at=now,
                    updated_at=now,
                )
            )
        return self.get_notification(instance=instance, notification_id=notification_id)

    def update_notification(self, *, instance: InstanceRecord, notification_id: str, payload: UpdateNotification) -> NotificationDetail:
        with self._session_factory() as session, session.begin():
            row = self._load_notification(session, instance=instance, notification_id=notification_id)
            channel_id = payload.channel_id if payload.channel_id is not None else row.channel_id
            fallback_channel_id = payload.fallback_channel_id if payload.fallback_channel_id is not None else row.fallback_channel_id
            self._validate_channel_links(session, instance=instance, channel_id=channel_id, fallback_channel_id=fallback_channel_id)
            row.channel_id = channel_id
            row.fallback_channel_id = fallback_channel_id
            row.title = payload.title.strip() if payload.title is not None else row.title
            row.body = payload.body.strip() if payload.body is not None else row.body
            row.delivery_status = payload.delivery_status or row.delivery_status
            row.priority = payload.priority or row.priority
            row.preview_required = payload.preview_required if payload.preview_required is not None else row.preview_required
            row.max_retries = payload.max_retries if payload.max_retries is not None else row.max_retries
            row.last_error = payload.last_error if payload.last_error is not None else row.last_error
            row.metadata_json = dict(payload.metadata) if payload.metadata is not None else dict(row.metadata_json or {})
            row.updated_at = self._now()
        return self.get_notification(instance=instance, notification_id=notification_id)

    def confirm_notification(self, *, instance: InstanceRecord, notification_id: str) -> NotificationActionResult:
        with self._session_factory() as session, session.begin():
            row = self._load_notification(session, instance=instance, notification_id=notification_id)
            row.rejected_at = None
            row.last_error = None
            row.delivery_status = "queued"
            row.next_attempt_at = self._now()
            row.updated_at = self._now()
        return NotificationActionResult(notification=self.get_notification(instance=instance, notification_id=notification_id), action="confirm")

    def reject_notification(self, *, instance: InstanceRecord, notification_id: str) -> NotificationActionResult:
        with self._session_factory() as session, session.begin():
            row = self._load_notification(session, instance=instance, notification_id=notification_id)
            now = self._now()
            row.delivery_status = "rejected"
            row.rejected_at = now
            row.updated_at = now
        return NotificationActionResult(notification=self.get_notification(instance=instance, notification_id=notification_id), action="reject")

    def retry_notification(self, *, instance: InstanceRecord, notification_id: str) -> NotificationActionResult:
        with self._session_factory() as session, session.begin():
            row = self._load_notification(session, instance=instance, notification_id=notification_id)
            now = self._now()
            row.retry_count += 1
            row.last_attempt_at = now
            row.updated_at = now
            if row.retry_count >= row.max_retries and row.fallback_channel_id and row.channel_id != row.fallback_channel_id:
                row.channel_id = row.fallback_channel_id
                row.delivery_status = "fallback_queued"
                row.next_attempt_at = now
            elif row.retry_count > row.max_retries:
                row.delivery_status = "failed"
                row.next_attempt_at = None
            else:
                row.delivery_status = "queued"
                row.next_attempt_at = now
        return NotificationActionResult(notification=self.get_notification(instance=instance, notification_id=notification_id), action="retry")

    def list_automations(self, *, instance: InstanceRecord, status: str | None = None, limit: int = 100) -> list[AutomationSummary]:
        with self._session_factory() as session:
            stmt = select(AutomationORM).where(AutomationORM.company_id == instance.company_id, AutomationORM.instance_id == instance.instance_id)
            if status is not None:
                stmt = stmt.where(AutomationORM.status == status)
            rows = session.execute(stmt.order_by(AutomationORM.next_run_at.asc()).limit(max(1, min(limit, 200)))).scalars().all()
            return [self._automation_summary(row) for row in rows]

    def get_automation(self, *, instance: InstanceRecord, automation_id: str) -> AutomationDetail:
        with self._session_factory() as session:
            row = self._load_automation(session, instance=instance, automation_id=automation_id)
            summary = self._automation_summary(row)
            task = self._task_summary(session, self._load_task(session, instance=instance, task_id=row.target_task_id)) if row.target_task_id else None
            channel = self._channel_summary(
                self._load_channel(session, instance=instance, channel_id=row.channel_id),
                notification_count=int(session.scalar(select(func.count()).select_from(NotificationORM).where(NotificationORM.company_id == instance.company_id, NotificationORM.channel_id == row.channel_id)) or 0),
            ) if row.channel_id else None
            return AutomationDetail(**summary.model_dump(), task=task, channel=channel)

    def create_automation(self, *, instance: InstanceRecord, payload: CreateAutomation) -> AutomationDetail:
        with self._session_factory() as session, session.begin():
            if payload.target_task_id:
                self._load_task(session, instance=instance, task_id=payload.target_task_id)
            self._validate_work_links(
                session,
                instance=instance,
                conversation_id=payload.target_conversation_id,
                inbox_id=payload.target_inbox_id,
                workspace_id=payload.target_workspace_id,
            )
            self._validate_channel_links(
                session,
                instance=instance,
                channel_id=payload.channel_id,
                fallback_channel_id=payload.fallback_channel_id,
            )
            automation_id = (payload.automation_id or "").strip() or self._new_id("automation")
            existing = session.get(AutomationORM, automation_id)
            if existing is not None and existing.company_id == instance.company_id:
                raise ValueError(f"Automation '{automation_id}' already exists.")
            now = self._now()
            session.add(
                AutomationORM(
                    id=automation_id,
                    instance_id=instance.instance_id,
                    company_id=instance.company_id,
                    title=payload.title.strip(),
                    summary=payload.summary.strip(),
                    action_kind=payload.action_kind,
                    cadence_minutes=payload.cadence_minutes,
                    next_run_at=payload.next_run_at,
                    target_task_id=payload.target_task_id,
                    target_conversation_id=payload.target_conversation_id,
                    target_inbox_id=payload.target_inbox_id,
                    target_workspace_id=payload.target_workspace_id,
                    channel_id=payload.channel_id,
                    fallback_channel_id=payload.fallback_channel_id,
                    preview_required=payload.preview_required,
                    task_template_title=payload.task_template_title,
                    task_template_summary=payload.task_template_summary,
                    notification_title=payload.notification_title,
                    notification_body=payload.notification_body,
                    metadata_json=dict(payload.metadata),
                    created_at=now,
                    updated_at=now,
                )
            )
        return self.get_automation(instance=instance, automation_id=automation_id)

    def update_automation(self, *, instance: InstanceRecord, automation_id: str, payload: UpdateAutomation) -> AutomationDetail:
        with self._session_factory() as session, session.begin():
            row = self._load_automation(session, instance=instance, automation_id=automation_id)
            target_task_id = payload.target_task_id if payload.target_task_id is not None else row.target_task_id
            if target_task_id:
                self._load_task(session, instance=instance, task_id=target_task_id)
            self._validate_work_links(
                session,
                instance=instance,
                conversation_id=payload.target_conversation_id if payload.target_conversation_id is not None else row.target_conversation_id,
                inbox_id=payload.target_inbox_id if payload.target_inbox_id is not None else row.target_inbox_id,
                workspace_id=payload.target_workspace_id if payload.target_workspace_id is not None else row.target_workspace_id,
            )
            channel_id = payload.channel_id if payload.channel_id is not None else row.channel_id
            fallback_channel_id = payload.fallback_channel_id if payload.fallback_channel_id is not None else row.fallback_channel_id
            self._validate_channel_links(session, instance=instance, channel_id=channel_id, fallback_channel_id=fallback_channel_id)
            row.title = payload.title.strip() if payload.title is not None else row.title
            row.summary = payload.summary.strip() if payload.summary is not None else row.summary
            row.status = payload.status or row.status
            row.cadence_minutes = payload.cadence_minutes if payload.cadence_minutes is not None else row.cadence_minutes
            row.next_run_at = payload.next_run_at if payload.next_run_at is not None else row.next_run_at
            row.target_task_id = target_task_id
            row.target_conversation_id = payload.target_conversation_id if payload.target_conversation_id is not None else row.target_conversation_id
            row.target_inbox_id = payload.target_inbox_id if payload.target_inbox_id is not None else row.target_inbox_id
            row.target_workspace_id = payload.target_workspace_id if payload.target_workspace_id is not None else row.target_workspace_id
            row.channel_id = channel_id
            row.fallback_channel_id = fallback_channel_id
            row.preview_required = payload.preview_required if payload.preview_required is not None else row.preview_required
            row.task_template_title = payload.task_template_title if payload.task_template_title is not None else row.task_template_title
            row.task_template_summary = payload.task_template_summary if payload.task_template_summary is not None else row.task_template_summary
            row.notification_title = payload.notification_title if payload.notification_title is not None else row.notification_title
            row.notification_body = payload.notification_body if payload.notification_body is not None else row.notification_body
            row.metadata_json = dict(payload.metadata) if payload.metadata is not None else dict(row.metadata_json or {})
            row.updated_at = self._now()
        return self.get_automation(instance=instance, automation_id=automation_id)

    def trigger_automation(self, *, instance: InstanceRecord, automation_id: str) -> AutomationDetail:
        with self._session_factory() as session, session.begin():
            row = self._load_automation(session, instance=instance, automation_id=automation_id)
            now = self._now()
            if row.action_kind == "create_follow_up":
                task_id = self._new_id("task")
                session.add(
                    TaskORM(
                        id=task_id,
                        instance_id=instance.instance_id,
                        company_id=instance.company_id,
                        task_kind="follow_up",
                        title=(row.task_template_title or row.title).strip(),
                        summary=(row.task_template_summary or row.summary).strip(),
                        status="open",
                        priority="normal",
                        conversation_id=row.target_conversation_id,
                        inbox_id=row.target_inbox_id,
                        workspace_id=row.target_workspace_id,
                        due_at=now,
                        metadata_json={},
                        created_at=now,
                        updated_at=now,
                    )
                )
                row.last_task_id = task_id
            elif row.action_kind == "create_reminder":
                reminder_id = self._new_id("reminder")
                session.add(
                    ReminderORM(
                        id=reminder_id,
                        instance_id=instance.instance_id,
                        company_id=instance.company_id,
                        task_id=row.target_task_id,
                        automation_id=row.id,
                        title=(row.task_template_title or row.title).strip(),
                        summary=(row.task_template_summary or row.summary).strip(),
                        status="due",
                        due_at=now,
                        metadata_json={},
                        created_at=now,
                        updated_at=now,
                    )
                )
                row.last_reminder_id = reminder_id
            else:
                notification_id = self._new_id("notification")
                session.add(
                    NotificationORM(
                        id=notification_id,
                        instance_id=instance.instance_id,
                        company_id=instance.company_id,
                        task_id=row.target_task_id,
                        conversation_id=row.target_conversation_id,
                        inbox_id=row.target_inbox_id,
                        workspace_id=row.target_workspace_id,
                        channel_id=row.channel_id,
                        fallback_channel_id=row.fallback_channel_id,
                        title=(row.notification_title or row.title).strip(),
                        body=(row.notification_body or row.summary or row.title).strip(),
                        delivery_status="preview" if row.preview_required else "queued",
                        priority="normal",
                        preview_required=row.preview_required,
                        max_retries=1,
                        next_attempt_at=None if row.preview_required else now,
                        metadata_json={},
                        created_at=now,
                        updated_at=now,
                    )
                )
                row.last_notification_id = notification_id
            row.last_run_at = now
            row.next_run_at = now + timedelta(minutes=row.cadence_minutes)
            row.updated_at = now
        return self.get_automation(instance=instance, automation_id=automation_id)

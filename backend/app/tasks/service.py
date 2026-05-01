"""Admin-facing tasking, reminder, automation, notification, and channel service."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlsplit
from uuid import uuid4

from pydantic import ValidationError
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

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
    ChannelCredentialPosture,
    ChannelDetail,
    CreateAutomation,
    CreateDeliveryChannel,
    CreateNotification,
    CreateReminder,
    CreateTask,
    DeliveryChannelSummary,
    NotificationActionResult,
    NotificationDeliveryAttempt,
    NotificationDeliveryEvidence,
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
_NOTIFICATION_INTERNAL_METADATA_KEY = "_forgeframe_delivery"
_NOTIFICATION_ATTEMPTS_KEY = "attempts"
_NOTIFICATION_CONFIGURED_CHANNEL_ID_KEY = "configured_channel_id"
_CHANNEL_SECRET_KEY_TOKENS = (
    "secret",
    "token",
    "password",
    "api_key",
    "apikey",
    "authorization",
    "auth",
    "webhook_url",
    "signing_key",
    "signing_secret",
)
_CHANNEL_REFERENCE_KEY_TOKENS = (
    "credential_ref",
    "secret_ref",
    "vault_ref",
    "oauth_ref",
    "key_ref",
)


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
    def _channel_key_is_reference(key: str) -> bool:
        normalized = key.strip().lower()
        return normalized.endswith("_ref") or normalized in _CHANNEL_REFERENCE_KEY_TOKENS

    @classmethod
    def _channel_key_is_secret(cls, key: str) -> bool:
        normalized = key.strip().lower()
        if cls._channel_key_is_reference(normalized):
            return False
        return any(token in normalized for token in _CHANNEL_SECRET_KEY_TOKENS)

    @classmethod
    def _channel_sanitize_metadata_value(
        cls,
        value: object,
        *,
        path: str,
        redacted_fields: list[str],
        reference_fields: list[str],
    ) -> object:
        if isinstance(value, dict):
            sanitized: dict[str, Any] = {}
            for raw_key, raw_item in value.items():
                if not isinstance(raw_key, str):
                    continue
                next_path = f"{path}.{raw_key}" if path else raw_key
                if cls._channel_key_is_secret(raw_key):
                    redacted_fields.append(next_path)
                    sanitized[raw_key] = "[redacted]"
                    continue
                if cls._channel_key_is_reference(raw_key):
                    reference_fields.append(next_path)
                sanitized[raw_key] = cls._channel_sanitize_metadata_value(
                    raw_item,
                    path=next_path,
                    redacted_fields=redacted_fields,
                    reference_fields=reference_fields,
                )
            return sanitized
        if isinstance(value, list):
            return [
                cls._channel_sanitize_metadata_value(
                    item,
                    path=f"{path}[]",
                    redacted_fields=redacted_fields,
                    reference_fields=reference_fields,
                )
                for item in value
            ]
        return value

    @classmethod
    def _channel_public_metadata(cls, row: DeliveryChannelORM) -> tuple[dict[str, Any], list[str], list[str]]:
        redacted_fields: list[str] = []
        reference_fields: list[str] = []
        sanitized = cls._channel_sanitize_metadata_value(
            dict(row.metadata_json or {}),
            path="",
            redacted_fields=redacted_fields,
            reference_fields=reference_fields,
        )
        return (
            dict(sanitized) if isinstance(sanitized, dict) else {},
            redacted_fields,
            reference_fields,
        )

    @staticmethod
    def _channel_scope_reference(metadata: dict[str, Any]) -> str | None:
        for key in ("contact_ref", "contact_id", "scope_ref"):
            value = metadata.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    @classmethod
    def _channel_scope_label(cls, metadata: dict[str, Any]) -> str:
        if cls._channel_scope_reference(metadata):
            return "contact-bound"
        scope = metadata.get("scope")
        if isinstance(scope, str):
            normalized = scope.strip().lower().replace("_", "-")
            if normalized in {"contact", "contact-bound", "contact-specific"}:
                return "contact-bound"
            if normalized in {"instance", "instance-default", "instance default"}:
                return "instance default"
            if normalized:
                return normalized
        return "instance default"

    @staticmethod
    def _channel_target_display(row: DeliveryChannelORM) -> str:
        if row.channel_kind != "webhook":
            return row.target
        parsed = urlsplit(row.target)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}/[redacted]"
        return "[masked webhook target]"

    @classmethod
    def _channel_credential_posture(cls, row: DeliveryChannelORM) -> ChannelCredentialPosture:
        metadata, redacted_fields, reference_fields = cls._channel_public_metadata(row)
        del metadata  # posture uses only the classified key sets
        target_masked = row.channel_kind == "webhook"
        if row.channel_kind == "in_app" and not redacted_fields and not reference_fields:
            storage_state = "not_applicable"
            summary = "In-app channels stay inside ForgeFrame and do not require outward delivery credentials."
        elif redacted_fields:
            storage_state = "inline_secret_redacted"
            summary = "Secret-bearing metadata was detected and redacted. Move credentials behind references or a delivery bridge."
        elif reference_fields:
            storage_state = "external_reference"
            summary = "Credential posture is expressed through external references. Secret values stay outside the admin UI."
        elif target_masked:
            storage_state = "masked_target_only"
            summary = "Webhook destinations are masked after save. Enter a new endpoint only when rotating the integration."
        else:
            storage_state = "no_secret_material"
            summary = "No secret-bearing fields are currently persisted for this channel."
        return ChannelCredentialPosture(
            storage_state=storage_state,
            target_masked=target_masked,
            redacted_fields=redacted_fields,
            external_reference_fields=reference_fields,
            summary=summary,
        )

    @staticmethod
    def _channel_rank_map(rows: Sequence[DeliveryChannelORM]) -> dict[str, int]:
        parents_by_child: dict[str, list[str]] = {}
        for row in rows:
            if row.fallback_channel_id:
                parents_by_child.setdefault(row.fallback_channel_id, []).append(row.id)

        cache: dict[str, int] = {}
        visiting: set[str] = set()

        def rank_for(channel_id: str) -> int:
            if channel_id in cache:
                return cache[channel_id]
            if channel_id in visiting:
                return 0
            visiting.add(channel_id)
            parents = parents_by_child.get(channel_id, [])
            result = 0 if not parents else min(rank_for(parent_id) for parent_id in parents) + 1
            visiting.remove(channel_id)
            cache[channel_id] = result
            return result

        for row in rows:
            rank_for(row.id)
        return cache

    def _channel_notification_stats(self, session: Session, *, instance: InstanceRecord, channel_id: str) -> dict[str, Any]:
        notification_count = int(
            session.scalar(
                select(func.count())
                .select_from(NotificationORM)
                .where(
                    NotificationORM.company_id == instance.company_id,
                    NotificationORM.channel_id == channel_id,
                )
            )
            or 0
        )
        last_success_at = session.scalar(
            select(func.max(NotificationORM.delivered_at)).where(
                NotificationORM.company_id == instance.company_id,
                NotificationORM.channel_id == channel_id,
            )
        )
        last_failure_at = session.scalar(
            select(func.max(NotificationORM.updated_at)).where(
                NotificationORM.company_id == instance.company_id,
                NotificationORM.channel_id == channel_id,
                or_(
                    NotificationORM.last_error.is_not(None),
                    NotificationORM.delivery_status.in_((
                        "failed",
                        "cancelled",
                        "rejected",
                    )),
                ),
            )
        )
        last_error_row = (
            session
            .execute(
                select(NotificationORM)
                .where(
                    NotificationORM.company_id == instance.company_id,
                    NotificationORM.channel_id == channel_id,
                    NotificationORM.last_error.is_not(None),
                )
                .order_by(NotificationORM.updated_at.desc())
                .limit(1)
            )
            .scalars()
            .first()
        )
        return {
            "notification_count": notification_count,
            "last_success_at": last_success_at,
            "last_failure_at": last_failure_at,
            "last_error": last_error_row.last_error if last_error_row is not None else None,
        }

    @classmethod
    def _channel_summary(
        cls,
        row: DeliveryChannelORM,
        *,
        notification_count: int,
        fallback_rank: int,
        last_success_at: datetime | None,
        last_failure_at: datetime | None,
        last_error: str | None,
    ) -> DeliveryChannelSummary:
        public_metadata, _redacted_fields, _reference_fields = cls._channel_public_metadata(row)
        return DeliveryChannelSummary(
            channel_id=row.id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            channel_kind=row.channel_kind,
            label=row.label,
            target=cls._channel_target_display(row),
            status=row.status,
            fallback_channel_id=row.fallback_channel_id,
            metadata=public_metadata,
            scope_label=cls._channel_scope_label(dict(row.metadata_json or {})),
            fallback_rank=fallback_rank,
            notification_count=notification_count,
            last_success_at=last_success_at,
            last_failure_at=last_failure_at,
            last_error=last_error,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    def _channel_summary_for_row(
        self,
        session: Session,
        *,
        instance: InstanceRecord,
        row: DeliveryChannelORM,
        rank_map: dict[str, int] | None = None,
    ) -> DeliveryChannelSummary:
        effective_rank_map = rank_map
        if effective_rank_map is None:
            all_rows = (
                session
                .execute(
                    select(DeliveryChannelORM).where(
                        DeliveryChannelORM.company_id == instance.company_id,
                        DeliveryChannelORM.instance_id == instance.instance_id,
                    )
                )
                .scalars()
                .all()
            )
            effective_rank_map = self._channel_rank_map(all_rows)
        stats = self._channel_notification_stats(session, instance=instance, channel_id=row.id)
        return self._channel_summary(
            row,
            fallback_rank=effective_rank_map.get(row.id, 0),
            notification_count=stats["notification_count"],
            last_success_at=stats["last_success_at"],
            last_failure_at=stats["last_failure_at"],
            last_error=stats["last_error"],
        )

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
        for reminder in (
            session
            .execute(
                select(ReminderORM).where(
                    ReminderORM.company_id == instance.company_id,
                    ReminderORM.instance_id == instance.instance_id,
                    ReminderORM.status == "scheduled",
                    ReminderORM.due_at <= now,
                )
            )
            .scalars()
            .all()
        ):
            reminder.status = "due"
            reminder.updated_at = now

    def _task_summary(self, session: Session, row: TaskORM) -> TaskSummary:
        reminder_count = (
            session.scalar(
                select(func.count())
                .select_from(ReminderORM)
                .where(
                    ReminderORM.company_id == row.company_id,
                    ReminderORM.task_id == row.id,
                )
            )
            or 0
        )
        notification_count = (
            session.scalar(
                select(func.count())
                .select_from(NotificationORM)
                .where(
                    NotificationORM.company_id == row.company_id,
                    NotificationORM.task_id == row.id,
                )
            )
            or 0
        )
        return TaskSummary(
            task_id=row.id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            task_kind=row.task_kind,
            title=row.title,
            summary=row.summary,
            status=row.status,
            priority=row.priority,
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
            status=row.status,
            due_at=row.due_at,
            triggered_at=row.triggered_at,
            metadata=dict(row.metadata_json or {}),
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    @staticmethod
    def _notification_public_metadata(row: NotificationORM) -> dict[str, Any]:
        metadata = dict(row.metadata_json or {})
        metadata.pop(_NOTIFICATION_INTERNAL_METADATA_KEY, None)
        return metadata

    @staticmethod
    def _notification_internal_metadata(row: NotificationORM) -> dict[str, Any]:
        metadata = dict(row.metadata_json or {})
        internal = metadata.get(_NOTIFICATION_INTERNAL_METADATA_KEY)
        return dict(internal) if isinstance(internal, dict) else {}

    @classmethod
    def _notification_attempts(cls, row: NotificationORM) -> list[NotificationDeliveryAttempt]:
        internal = cls._notification_internal_metadata(row)
        raw_attempts = internal.get(_NOTIFICATION_ATTEMPTS_KEY)
        if not isinstance(raw_attempts, list):
            return []
        attempts: list[NotificationDeliveryAttempt] = []
        for item in raw_attempts:
            if not isinstance(item, dict):
                continue
            try:
                attempts.append(NotificationDeliveryAttempt.model_validate(item))
            except ValidationError:
                continue
        return attempts

    @classmethod
    def _notification_configured_channel_id(cls, row: NotificationORM) -> str | None:
        internal = cls._notification_internal_metadata(row)
        configured_channel_id = internal.get(_NOTIFICATION_CONFIGURED_CHANNEL_ID_KEY)
        if isinstance(configured_channel_id, str) and configured_channel_id:
            return configured_channel_id
        return row.channel_id

    @classmethod
    def _notification_set_attempts(
        cls,
        row: NotificationORM,
        *,
        user_metadata: dict[str, Any] | None = None,
        attempts: list[NotificationDeliveryAttempt] | None = None,
        configured_channel_id: str | None = None,
    ) -> None:
        public_metadata = dict(user_metadata) if user_metadata is not None else cls._notification_public_metadata(row)
        effective_configured_channel_id = configured_channel_id if configured_channel_id is not None else cls._notification_configured_channel_id(row)
        raw_attempts = [attempt.model_dump(mode="json") for attempt in (attempts if attempts is not None else cls._notification_attempts(row))]
        internal_metadata: dict[str, Any] = {}
        if raw_attempts:
            internal_metadata[_NOTIFICATION_ATTEMPTS_KEY] = raw_attempts
        if effective_configured_channel_id:
            internal_metadata[_NOTIFICATION_CONFIGURED_CHANNEL_ID_KEY] = effective_configured_channel_id
        if internal_metadata:
            public_metadata[_NOTIFICATION_INTERNAL_METADATA_KEY] = internal_metadata
        row.metadata_json = public_metadata

    @staticmethod
    def _notification_evidence(
        row: NotificationORM,
        *,
        channel: DeliveryChannelSummary | None,
    ) -> NotificationDeliveryEvidence:
        if row.delivery_status in {"draft", "preview"}:
            effect_state = "preview_only"
            live_delivery = False
            next_step = "Confirm the preview to enter the live delivery queue, or reject it before any outward send."
            evidence_note = "No outward delivery has happened. The record is still a preview-only outbox item."
        elif row.delivery_status in {
            "confirmed",
            "queued",
            "delivering",
            "fallback_queued",
        }:
            effect_state = "queued"
            live_delivery = True
            next_step = "Monitor the queue and retry only if the provider or channel fails."
            evidence_note = "The notification is positioned for live delivery. Any further outcome depends on the delivery channel."
        elif row.delivery_status == "delivered":
            effect_state = "sent"
            live_delivery = True
            next_step = "Delivery completed. Review linked task or reminder context if follow-up is still needed."
            evidence_note = "A delivered timestamp is present, so the record is treated as externally sent."
        elif row.delivery_status == "rejected":
            effect_state = "rejected"
            live_delivery = False
            next_step = "Edit the message or routing, then confirm it again when the preview is acceptable."
            evidence_note = "The notification was blocked before live delivery resumed."
        elif row.delivery_status == "cancelled":
            effect_state = "cancelled"
            live_delivery = False
            next_step = "Create a replacement notification or move the linked task forward through another route."
            evidence_note = "Delivery is intentionally cancelled; no additional send is scheduled."
        else:
            effect_state = "failed"
            live_delivery = False
            next_step = "Inspect the last error, adjust channel or fallback routing, then retry deliberately."
            evidence_note = "The retry budget or latest delivery path failed and no healthy send is currently confirmed."
        return NotificationDeliveryEvidence(
            effect_state=effect_state,
            live_delivery=live_delivery,
            current_target=channel.target if channel is not None else None,
            next_step=next_step,
            evidence_note=evidence_note,
        )

    @classmethod
    def _append_notification_attempt(
        cls,
        row: NotificationORM,
        *,
        attempt_kind: str,
        delivery_status: str,
        happened_at: datetime,
        detail: str,
        next_step: str | None,
        channel: DeliveryChannelORM | None,
    ) -> None:
        attempts = cls._notification_attempts(row)
        attempts.append(
            NotificationDeliveryAttempt(
                attempt_id=f"attempt_{uuid4().hex[:12]}",
                attempt_kind=attempt_kind,
                delivery_status=delivery_status,
                happened_at=happened_at,
                channel_id=channel.id if channel is not None else row.channel_id,
                channel_label=channel.label if channel is not None else None,
                channel_target=channel.target if channel is not None else None,
                detail=detail,
                next_step=next_step,
            )
        )
        cls._notification_set_attempts(row, attempts=attempts[-20:])

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
            configured_channel_id=TaskAutomationAdminService._notification_configured_channel_id(row),
            fallback_channel_id=row.fallback_channel_id,
            title=row.title,
            body=row.body,
            delivery_status=row.delivery_status,
            priority=row.priority,
            preview_required=row.preview_required,
            retry_count=row.retry_count,
            max_retries=row.max_retries,
            next_attempt_at=row.next_attempt_at,
            last_attempt_at=row.last_attempt_at,
            delivered_at=row.delivered_at,
            rejected_at=row.rejected_at,
            last_error=row.last_error,
            metadata=TaskAutomationAdminService._notification_public_metadata(row),
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
            status=row.status,
            action_kind=row.action_kind,
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
            stmt = select(TaskORM).where(
                TaskORM.company_id == instance.company_id,
                TaskORM.instance_id == instance.instance_id,
            )
            if status is not None:
                stmt = stmt.where(TaskORM.status == status)
            rows = session.execute(stmt.order_by(TaskORM.updated_at.desc()).limit(max(1, min(limit, 200)))).scalars().all()
            return [self._task_summary(session, row) for row in rows]

    def get_task(self, *, instance: InstanceRecord, task_id: str) -> TaskDetail:
        with self._session_factory() as session:
            row = self._load_task(session, instance=instance, task_id=task_id)
            summary = self._task_summary(session, row)
            reminders = (
                session
                .execute(
                    select(ReminderORM)
                    .where(
                        ReminderORM.company_id == instance.company_id,
                        ReminderORM.task_id == task_id,
                    )
                    .order_by(ReminderORM.due_at.asc())
                )
                .scalars()
                .all()
            )
            notifications = (
                session
                .execute(
                    select(NotificationORM)
                    .where(
                        NotificationORM.company_id == instance.company_id,
                        NotificationORM.task_id == task_id,
                    )
                    .order_by(NotificationORM.updated_at.desc())
                )
                .scalars()
                .all()
            )
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
            stmt = select(ReminderORM).where(
                ReminderORM.company_id == instance.company_id,
                ReminderORM.instance_id == instance.instance_id,
            )
            if status is not None:
                stmt = stmt.where(ReminderORM.status == status)
            rows = session.execute(stmt.order_by(ReminderORM.due_at.asc()).limit(max(1, min(limit, 200)))).scalars().all()
            return [self._reminder_summary(row) for row in rows]

    def get_reminder(self, *, instance: InstanceRecord, reminder_id: str) -> ReminderDetail:
        with self._session_factory() as session, session.begin():
            self._materialize_due_reminders(session, instance=instance)
            row = self._load_reminder(session, instance=instance, reminder_id=reminder_id)
            summary = self._reminder_summary(row)
            task = (
                self._task_summary(
                    session,
                    self._load_task(session, instance=instance, task_id=row.task_id),
                )
                if row.task_id
                else None
            )
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

    def list_channels(
        self,
        *,
        instance: InstanceRecord,
        status: str | None = None,
        kind: str | None = None,
        limit: int = 100,
    ) -> list[DeliveryChannelSummary]:
        with self._session_factory() as session:
            stmt = select(DeliveryChannelORM).where(
                DeliveryChannelORM.company_id == instance.company_id,
                DeliveryChannelORM.instance_id == instance.instance_id,
            )
            if status is not None:
                stmt = stmt.where(DeliveryChannelORM.status == status)
            if kind is not None:
                stmt = stmt.where(DeliveryChannelORM.channel_kind == kind)
            rows = session.execute(stmt.order_by(DeliveryChannelORM.updated_at.desc()).limit(max(1, min(limit, 200)))).scalars().all()
            all_rows = (
                session
                .execute(
                    select(DeliveryChannelORM).where(
                        DeliveryChannelORM.company_id == instance.company_id,
                        DeliveryChannelORM.instance_id == instance.instance_id,
                    )
                )
                .scalars()
                .all()
            )
            rank_map = self._channel_rank_map(all_rows)
            return [self._channel_summary_for_row(session, instance=instance, row=row, rank_map=rank_map) for row in rows]

    def get_channel(self, *, instance: InstanceRecord, channel_id: str) -> ChannelDetail:
        with self._session_factory() as session:
            row = self._load_channel(session, instance=instance, channel_id=channel_id)
            all_rows = (
                session
                .execute(
                    select(DeliveryChannelORM).where(
                        DeliveryChannelORM.company_id == instance.company_id,
                        DeliveryChannelORM.instance_id == instance.instance_id,
                    )
                )
                .scalars()
                .all()
            )
            rank_map = self._channel_rank_map(all_rows)
            row_by_id = {item.id: item for item in all_rows}
            summary = self._channel_summary_for_row(session, instance=instance, row=row, rank_map=rank_map)
            recent = (
                session
                .execute(
                    select(NotificationORM)
                    .where(
                        NotificationORM.company_id == instance.company_id,
                        NotificationORM.channel_id == channel_id,
                    )
                    .order_by(NotificationORM.updated_at.desc())
                    .limit(20)
                )
                .scalars()
                .all()
            )
            fallback_chain: list[DeliveryChannelSummary] = []
            visited: set[str] = set()
            current: DeliveryChannelORM | None = row
            while current is not None and current.id not in visited:
                visited.add(current.id)
                fallback_chain.append(self._channel_summary_for_row(session, instance=instance, row=current, rank_map=rank_map))
                if not current.fallback_channel_id:
                    break
                current = row_by_id.get(current.fallback_channel_id)
            fallback_sources = [self._channel_summary_for_row(session, instance=instance, row=item, rank_map=rank_map) for item in all_rows if item.fallback_channel_id == row.id]
            public_metadata, _redacted_fields, _reference_fields = self._channel_public_metadata(row)
            return ChannelDetail(
                **summary.model_dump(),
                recent_notifications=[self._notification_summary(item) for item in recent],
                credential_posture=self._channel_credential_posture(row),
                advanced_metadata=public_metadata,
                scope_reference=self._channel_scope_reference(dict(row.metadata_json or {})),
                fallback_chain=fallback_chain,
                fallback_sources=fallback_sources,
                test_delivery_supported=False,
                test_delivery_state="not_ready",
                test_delivery_reason="Backend does not expose a dedicated channel test-send endpoint.",
            )

    def create_channel(self, *, instance: InstanceRecord, payload: CreateDeliveryChannel) -> ChannelDetail:
        with self._session_factory() as session, session.begin():
            channel_id = (payload.channel_id or "").strip() or self._new_id("channel")
            if payload.fallback_channel_id and payload.fallback_channel_id == channel_id:
                raise ValueError("Primary and fallback channel must not be identical.")
            self._validate_channel_links(
                session,
                instance=instance,
                fallback_channel_id=payload.fallback_channel_id,
            )
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

    def update_channel(
        self,
        *,
        instance: InstanceRecord,
        channel_id: str,
        payload: UpdateDeliveryChannel,
    ) -> ChannelDetail:
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
            stmt = select(NotificationORM).where(
                NotificationORM.company_id == instance.company_id,
                NotificationORM.instance_id == instance.instance_id,
            )
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
            configured_channel_id = self._notification_configured_channel_id(row)
            task = (
                self._task_summary(
                    session,
                    self._load_task(session, instance=instance, task_id=row.task_id),
                )
                if row.task_id
                else None
            )
            reminder = self._reminder_summary(self._load_reminder(session, instance=instance, reminder_id=row.reminder_id)) if row.reminder_id else None
            channel = (
                self._channel_summary_for_row(
                    session,
                    instance=instance,
                    row=self._load_channel(session, instance=instance, channel_id=row.channel_id),
                )
                if row.channel_id
                else None
            )
            configured_channel = (
                self._channel_summary_for_row(
                    session,
                    instance=instance,
                    row=self._load_channel(session, instance=instance, channel_id=configured_channel_id),
                )
                if configured_channel_id
                else None
            )
            fallback_channel = (
                self._channel_summary_for_row(
                    session,
                    instance=instance,
                    row=self._load_channel(session, instance=instance, channel_id=row.fallback_channel_id),
                )
                if row.fallback_channel_id
                else None
            )
            return NotificationDetail(
                **summary.model_dump(),
                task=task,
                reminder=reminder,
                channel=channel,
                configured_channel=configured_channel,
                fallback_channel=fallback_channel,
                delivery_attempts=self._notification_attempts(row),
                delivery_evidence=self._notification_evidence(row, channel=channel),
            )

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
            row = NotificationORM(
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
            session.add(row)
            self._notification_set_attempts(row, configured_channel_id=row.channel_id)
            self._append_notification_attempt(
                row,
                attempt_kind="preview" if payload.preview_required else "manual_override",
                delivery_status=delivery_status,
                happened_at=now,
                detail="Created as preview-only outbox content." if payload.preview_required else "Created directly in the live delivery queue.",
                next_step="Confirm the preview before outward delivery." if payload.preview_required else "Monitor the queued send or retry if the provider fails.",
                channel=self._load_channel(session, instance=instance, channel_id=row.channel_id) if row.channel_id else None,
            )
        return self.get_notification(instance=instance, notification_id=notification_id)

    def update_notification(
        self,
        *,
        instance: InstanceRecord,
        notification_id: str,
        payload: UpdateNotification,
    ) -> NotificationDetail:
        with self._session_factory() as session, session.begin():
            row = self._load_notification(session, instance=instance, notification_id=notification_id)
            previous_status = row.delivery_status
            channel_id = payload.channel_id if payload.channel_id is not None else row.channel_id
            fallback_channel_id = payload.fallback_channel_id if payload.fallback_channel_id is not None else row.fallback_channel_id
            self._validate_channel_links(
                session,
                instance=instance,
                channel_id=channel_id,
                fallback_channel_id=fallback_channel_id,
            )
            row.channel_id = channel_id
            row.fallback_channel_id = fallback_channel_id
            row.title = payload.title.strip() if payload.title is not None else row.title
            row.body = payload.body.strip() if payload.body is not None else row.body
            row.delivery_status = payload.delivery_status or row.delivery_status
            row.priority = payload.priority or row.priority
            row.preview_required = payload.preview_required if payload.preview_required is not None else row.preview_required
            row.max_retries = payload.max_retries if payload.max_retries is not None else row.max_retries
            row.last_error = payload.last_error if payload.last_error is not None else row.last_error
            if payload.delivery_status == "delivered":
                row.delivered_at = self._now()
                row.next_attempt_at = None
            elif payload.delivery_status == "rejected":
                row.rejected_at = self._now()
                row.next_attempt_at = None
            elif payload.delivery_status in {
                "queued",
                "confirmed",
                "delivering",
                "fallback_queued",
            }:
                row.rejected_at = None
                row.next_attempt_at = row.next_attempt_at or self._now()
            elif payload.delivery_status in {"failed", "cancelled"}:
                row.next_attempt_at = None
            if payload.metadata is not None:
                self._notification_set_attempts(
                    row,
                    user_metadata=dict(payload.metadata),
                    configured_channel_id=payload.channel_id if payload.channel_id is not None else None,
                )
            elif payload.channel_id is not None:
                self._notification_set_attempts(row, configured_channel_id=payload.channel_id)
            row.updated_at = self._now()
            if payload.delivery_status is not None and payload.delivery_status != previous_status:
                self._append_notification_attempt(
                    row,
                    attempt_kind="manual_override",
                    delivery_status=row.delivery_status,
                    happened_at=row.updated_at,
                    detail=f"Operator changed delivery state from {previous_status} to {row.delivery_status}.",
                    next_step=self._notification_evidence(
                        row,
                        channel=self._channel_summary_for_row(
                            session,
                            instance=instance,
                            row=self._load_channel(session, instance=instance, channel_id=row.channel_id),
                        )
                        if row.channel_id
                        else None,
                    ).next_step,
                    channel=self._load_channel(session, instance=instance, channel_id=row.channel_id) if row.channel_id else None,
                )
        return self.get_notification(instance=instance, notification_id=notification_id)

    def confirm_notification(self, *, instance: InstanceRecord, notification_id: str) -> NotificationActionResult:
        with self._session_factory() as session, session.begin():
            row = self._load_notification(session, instance=instance, notification_id=notification_id)
            now = self._now()
            row.rejected_at = None
            row.last_error = None
            row.delivery_status = "queued"
            row.next_attempt_at = now
            row.updated_at = now
            self._append_notification_attempt(
                row,
                attempt_kind="approval",
                delivery_status="queued",
                happened_at=now,
                detail="Preview approved and moved into the live delivery queue.",
                next_step="Wait for the live send or retry if the provider path fails.",
                channel=self._load_channel(session, instance=instance, channel_id=row.channel_id) if row.channel_id else None,
            )
        return NotificationActionResult(
            notification=self.get_notification(instance=instance, notification_id=notification_id),
            action="confirm",
        )

    def reject_notification(self, *, instance: InstanceRecord, notification_id: str) -> NotificationActionResult:
        with self._session_factory() as session, session.begin():
            row = self._load_notification(session, instance=instance, notification_id=notification_id)
            now = self._now()
            row.delivery_status = "rejected"
            row.rejected_at = now
            row.updated_at = now
            row.next_attempt_at = None
            self._append_notification_attempt(
                row,
                attempt_kind="approval",
                delivery_status="rejected",
                happened_at=now,
                detail="Preview rejected before live delivery continued.",
                next_step="Edit the notification content or routing, then confirm it again when it is ready.",
                channel=self._load_channel(session, instance=instance, channel_id=row.channel_id) if row.channel_id else None,
            )
        return NotificationActionResult(
            notification=self.get_notification(instance=instance, notification_id=notification_id),
            action="reject",
        )

    def retry_notification(self, *, instance: InstanceRecord, notification_id: str) -> NotificationActionResult:
        with self._session_factory() as session, session.begin():
            row = self._load_notification(session, instance=instance, notification_id=notification_id)
            now = self._now()
            row.retry_count += 1
            row.last_attempt_at = now
            row.updated_at = now
            detail = "Retry requested on the current delivery channel."
            next_step = "Wait for the queued retry to execute."
            if row.retry_count >= row.max_retries and row.fallback_channel_id and row.channel_id != row.fallback_channel_id:
                row.channel_id = row.fallback_channel_id
                row.delivery_status = "fallback_queued"
                row.next_attempt_at = now
                detail = "Primary delivery exhausted its retry budget and moved to the fallback channel."
                next_step = "Monitor the fallback channel and inspect its health before forcing another retry."
            elif row.retry_count > row.max_retries:
                row.delivery_status = "failed"
                row.next_attempt_at = None
                detail = "Retry budget is exhausted and no additional automatic send is queued."
                next_step = "Fix the routing or clear the failure condition before retrying again."
            else:
                row.delivery_status = "queued"
                row.next_attempt_at = now
            self._append_notification_attempt(
                row,
                attempt_kind="fallback" if row.delivery_status == "fallback_queued" else "retry",
                delivery_status=row.delivery_status,
                happened_at=now,
                detail=detail,
                next_step=next_step,
                channel=self._load_channel(session, instance=instance, channel_id=row.channel_id) if row.channel_id else None,
            )
        return NotificationActionResult(
            notification=self.get_notification(instance=instance, notification_id=notification_id),
            action="retry",
        )

    def list_automations(self, *, instance: InstanceRecord, status: str | None = None, limit: int = 100) -> list[AutomationSummary]:
        with self._session_factory() as session:
            stmt = select(AutomationORM).where(
                AutomationORM.company_id == instance.company_id,
                AutomationORM.instance_id == instance.instance_id,
            )
            if status is not None:
                stmt = stmt.where(AutomationORM.status == status)
            rows = session.execute(stmt.order_by(AutomationORM.next_run_at.asc()).limit(max(1, min(limit, 200)))).scalars().all()
            return [self._automation_summary(row) for row in rows]

    def get_automation(self, *, instance: InstanceRecord, automation_id: str) -> AutomationDetail:
        with self._session_factory() as session:
            row = self._load_automation(session, instance=instance, automation_id=automation_id)
            summary = self._automation_summary(row)
            task = (
                self._task_summary(
                    session,
                    self._load_task(session, instance=instance, task_id=row.target_task_id),
                )
                if row.target_task_id
                else None
            )
            channel = (
                self._channel_summary_for_row(
                    session,
                    instance=instance,
                    row=self._load_channel(session, instance=instance, channel_id=row.channel_id),
                )
                if row.channel_id
                else None
            )
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
            self._validate_channel_links(
                session,
                instance=instance,
                channel_id=channel_id,
                fallback_channel_id=fallback_channel_id,
            )
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

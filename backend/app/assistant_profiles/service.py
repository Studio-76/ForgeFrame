"""Admin-facing assistant-profile and personal-assistant-mode service."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.assistant_profiles.models import (
    ActionPolicies,
    AssistantActionEvaluation,
    AssistantProfileDetail,
    AssistantProfileSummary,
    CommunicationRules,
    CreateAssistantProfile,
    DelegationRules,
    DeliveryPreferences,
    EvaluateAssistantAction,
    QuietHoursSettings,
    UpdateAssistantProfile,
)
from app.instances.models import InstanceRecord
from app.knowledge.models import RecordLink
from app.storage.assistant_profile_repository import AssistantProfileORM
from app.storage.knowledge_repository import ContactORM, KnowledgeSourceORM
from app.storage.tasking_repository import DeliveryChannelORM

SessionFactory = Callable[[], Session]

_PRIORITY_RANK = {
    "low": 0,
    "normal": 1,
    "high": 2,
    "critical": 3,
}
_WEEKDAY_NAMES = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


class AssistantProfileAdminService:
    def __init__(self, session_factory: SessionFactory) -> None:
        self._session_factory = session_factory

    @staticmethod
    def _now() -> datetime:
        return datetime.now(tz=UTC)

    @staticmethod
    def _new_id(prefix: str) -> str:
        return f"{prefix}_{uuid4().hex[:20]}"

    @staticmethod
    def _record_link(record_id: str, label: str, status: str | None = None) -> RecordLink:
        return RecordLink(record_id=record_id, label=label, status=status)

    @staticmethod
    def _communication_rules(payload: dict[str, object] | None) -> CommunicationRules:
        return CommunicationRules.model_validate(payload or {})

    @staticmethod
    def _quiet_hours(payload: dict[str, object] | None) -> QuietHoursSettings:
        return QuietHoursSettings.model_validate(payload or {})

    @staticmethod
    def _delivery_preferences(payload: dict[str, object] | None) -> DeliveryPreferences:
        return DeliveryPreferences.model_validate(payload or {})

    @staticmethod
    def _action_policies(payload: dict[str, object] | None) -> ActionPolicies:
        return ActionPolicies.model_validate(payload or {})

    @staticmethod
    def _delegation_rules(payload: dict[str, object] | None) -> DelegationRules:
        return DelegationRules.model_validate(payload or {})

    @staticmethod
    def _priority_at_least(priority: str, minimum: str) -> bool:
        return _PRIORITY_RANK.get(priority, 0) >= _PRIORITY_RANK.get(minimum, 0)

    def _load_contact(self, session: Session, *, instance: InstanceRecord, contact_id: str) -> ContactORM:
        return self._load_contact_by_scope(session, company_id=instance.company_id, instance_id=instance.instance_id, contact_id=contact_id)

    @staticmethod
    def _load_contact_by_scope(session: Session, *, company_id: str, instance_id: str, contact_id: str) -> ContactORM:
        row = session.get(ContactORM, contact_id)
        if row is None or row.company_id != company_id or row.instance_id != instance_id:
            raise ValueError(f"Contact '{contact_id}' was not found.")
        return row

    def _load_channel(self, session: Session, *, instance: InstanceRecord, channel_id: str) -> DeliveryChannelORM:
        return self._load_channel_by_scope(session, company_id=instance.company_id, instance_id=instance.instance_id, channel_id=channel_id)

    @staticmethod
    def _load_channel_by_scope(session: Session, *, company_id: str, instance_id: str, channel_id: str) -> DeliveryChannelORM:
        row = session.get(DeliveryChannelORM, channel_id)
        if row is None or row.company_id != company_id or row.instance_id != instance_id:
            raise ValueError(f"Channel '{channel_id}' was not found.")
        return row

    def _load_source(
        self,
        session: Session,
        *,
        instance: InstanceRecord,
        source_id: str,
        expected_kind: str | None = None,
    ) -> KnowledgeSourceORM:
        return self._load_source_by_scope(
            session,
            company_id=instance.company_id,
            instance_id=instance.instance_id,
            source_id=source_id,
            expected_kind=expected_kind,
        )

    @staticmethod
    def _load_source_by_scope(
        session: Session,
        *,
        company_id: str,
        instance_id: str,
        source_id: str,
        expected_kind: str | None = None,
    ) -> KnowledgeSourceORM:
        row = session.get(KnowledgeSourceORM, source_id)
        if row is None or row.company_id != company_id or row.instance_id != instance_id:
            raise ValueError(f"Knowledge source '{source_id}' was not found.")
        if expected_kind is not None and row.source_kind != expected_kind:
            raise ValueError(f"Knowledge source '{source_id}' is not a '{expected_kind}' source.")
        return row

    def _load_profile(self, session: Session, *, instance: InstanceRecord, assistant_profile_id: str) -> AssistantProfileORM:
        row = session.get(AssistantProfileORM, assistant_profile_id)
        if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
            raise ValueError(f"Assistant profile '{assistant_profile_id}' was not found.")
        return row

    def _validate_profile_links(
        self,
        session: Session,
        *,
        instance: InstanceRecord,
        preferred_contact_id: str | None,
        mail_source_id: str | None,
        calendar_source_id: str | None,
        delivery_preferences: DeliveryPreferences,
        action_policies: ActionPolicies,
        delegation_rules: DelegationRules,
    ) -> None:
        if preferred_contact_id:
            self._load_contact(session, instance=instance, contact_id=preferred_contact_id)
        if delegation_rules.delegate_contact_id:
            self._load_contact(session, instance=instance, contact_id=delegation_rules.delegate_contact_id)
        if delegation_rules.escalation_contact_id:
            self._load_contact(session, instance=instance, contact_id=delegation_rules.escalation_contact_id)
        if mail_source_id:
            self._load_source(session, instance=instance, source_id=mail_source_id, expected_kind="mail")
        if calendar_source_id:
            self._load_source(session, instance=instance, source_id=calendar_source_id, expected_kind="calendar")

        if delivery_preferences.primary_channel_id:
            self._load_channel(session, instance=instance, channel_id=delivery_preferences.primary_channel_id)
        if delivery_preferences.fallback_channel_id:
            self._load_channel(session, instance=instance, channel_id=delivery_preferences.fallback_channel_id)
        if (
            delivery_preferences.primary_channel_id
            and delivery_preferences.fallback_channel_id
            and delivery_preferences.primary_channel_id == delivery_preferences.fallback_channel_id
        ):
            raise ValueError("Primary and fallback channel must not be identical.")

        for channel_id in delivery_preferences.allowed_channel_ids:
            self._load_channel(session, instance=instance, channel_id=channel_id)
        for channel_id in action_policies.direct_channel_ids:
            self._load_channel(session, instance=instance, channel_id=channel_id)

        if (
            delivery_preferences.allowed_channel_ids
            and delivery_preferences.primary_channel_id
            and delivery_preferences.primary_channel_id not in delivery_preferences.allowed_channel_ids
        ):
            raise ValueError("Primary channel must be part of allowed channel ids when allow-listing is enabled.")
        if (
            delivery_preferences.allowed_channel_ids
            and delivery_preferences.fallback_channel_id
            and delivery_preferences.fallback_channel_id not in delivery_preferences.allowed_channel_ids
        ):
            raise ValueError("Fallback channel must be part of allowed channel ids when allow-listing is enabled.")

    def _clear_existing_default(self, session: Session, *, instance: InstanceRecord, current_profile_id: str | None = None) -> None:
        for existing in session.execute(
            select(AssistantProfileORM).where(
                AssistantProfileORM.company_id == instance.company_id,
                AssistantProfileORM.instance_id == instance.instance_id,
                AssistantProfileORM.is_default.is_(True),
            )
        ).scalars().all():
            if current_profile_id is not None and existing.id == current_profile_id:
                continue
            existing.is_default = False
            existing.updated_at = self._now()

    def _summary(self, row: AssistantProfileORM) -> AssistantProfileSummary:
        communication_rules = self._communication_rules(row.communication_rules_json)
        delivery_preferences = self._delivery_preferences(row.delivery_preferences_json)
        return AssistantProfileSummary(
            assistant_profile_id=row.id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            display_name=row.display_name,
            summary=row.summary,
            status=row.status,  # type: ignore[arg-type]
            assistant_mode_enabled=row.assistant_mode_enabled,
            is_default=row.is_default,
            timezone=row.timezone,
            locale=row.locale,
            tone=row.tone,  # type: ignore[arg-type]
            preferred_contact_id=row.preferred_contact_id,
            primary_channel_id=delivery_preferences.primary_channel_id,
            fallback_channel_id=delivery_preferences.fallback_channel_id,
            mail_source_id=row.mail_source_id,
            calendar_source_id=row.calendar_source_id,
            metadata=dict(row.metadata_json or {}),
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    def _detail(self, session: Session, row: AssistantProfileORM) -> AssistantProfileDetail:
        summary = self._summary(row)
        communication_rules = self._communication_rules(row.communication_rules_json)
        quiet_hours = self._quiet_hours(row.quiet_hours_json)
        delivery_preferences = self._delivery_preferences(row.delivery_preferences_json)
        action_policies = self._action_policies(row.action_policies_json)
        delegation_rules = self._delegation_rules(row.delegation_rules_json)

        preferred_contact = None
        if row.preferred_contact_id:
            contact = self._load_contact_by_scope(session, company_id=row.company_id, instance_id=row.instance_id, contact_id=row.preferred_contact_id)
            preferred_contact = self._record_link(contact.id, contact.display_name, contact.status)

        delegate_contact = None
        if delegation_rules.delegate_contact_id:
            contact = self._load_contact_by_scope(session, company_id=row.company_id, instance_id=row.instance_id, contact_id=delegation_rules.delegate_contact_id)
            delegate_contact = self._record_link(contact.id, contact.display_name, contact.status)

        escalation_contact = None
        if delegation_rules.escalation_contact_id:
            contact = self._load_contact_by_scope(session, company_id=row.company_id, instance_id=row.instance_id, contact_id=delegation_rules.escalation_contact_id)
            escalation_contact = self._record_link(contact.id, contact.display_name, contact.status)

        primary_channel = None
        if delivery_preferences.primary_channel_id:
            channel = self._load_channel_by_scope(session, company_id=row.company_id, instance_id=row.instance_id, channel_id=delivery_preferences.primary_channel_id)
            primary_channel = self._record_link(channel.id, channel.label, channel.status)

        fallback_channel = None
        if delivery_preferences.fallback_channel_id:
            channel = self._load_channel_by_scope(session, company_id=row.company_id, instance_id=row.instance_id, channel_id=delivery_preferences.fallback_channel_id)
            fallback_channel = self._record_link(channel.id, channel.label, channel.status)

        mail_source = None
        if row.mail_source_id:
            source = self._load_source_by_scope(session, company_id=row.company_id, instance_id=row.instance_id, source_id=row.mail_source_id)
            mail_source = self._record_link(source.id, source.label, source.status)

        calendar_source = None
        if row.calendar_source_id:
            source = self._load_source_by_scope(session, company_id=row.company_id, instance_id=row.instance_id, source_id=row.calendar_source_id)
            calendar_source = self._record_link(source.id, source.label, source.status)

        return AssistantProfileDetail(
            **summary.model_dump(),
            preferred_contact=preferred_contact,
            delegate_contact=delegate_contact,
            escalation_contact=escalation_contact,
            primary_channel=primary_channel,
            fallback_channel=fallback_channel,
            mail_source=mail_source,
            calendar_source=calendar_source,
            preferences=dict(row.preferences_json or {}),
            communication_rules=communication_rules,
            quiet_hours=quiet_hours,
            delivery_preferences=delivery_preferences,
            action_policies=action_policies,
            delegation_rules=delegation_rules,
        )

    def list_profiles(self, *, instance: InstanceRecord, status: str | None = None, limit: int = 100) -> list[AssistantProfileSummary]:
        with self._session_factory() as session:
            stmt = select(AssistantProfileORM).where(
                AssistantProfileORM.company_id == instance.company_id,
                AssistantProfileORM.instance_id == instance.instance_id,
            )
            if status is not None:
                stmt = stmt.where(AssistantProfileORM.status == status)
            rows = session.execute(
                stmt.order_by(AssistantProfileORM.is_default.desc(), AssistantProfileORM.updated_at.desc()).limit(max(1, min(limit, 200)))
            ).scalars().all()
            return [self._summary(row) for row in rows]

    def get_profile(self, *, instance: InstanceRecord, assistant_profile_id: str) -> AssistantProfileDetail:
        with self._session_factory() as session:
            row = self._load_profile(session, instance=instance, assistant_profile_id=assistant_profile_id)
            return self._detail(session, row)

    def create_profile(self, *, instance: InstanceRecord, payload: CreateAssistantProfile) -> AssistantProfileDetail:
        with self._session_factory() as session, session.begin():
            delivery_preferences = payload.delivery_preferences
            action_policies = payload.action_policies
            delegation_rules = payload.delegation_rules
            self._validate_profile_links(
                session,
                instance=instance,
                preferred_contact_id=payload.preferred_contact_id,
                mail_source_id=payload.mail_source_id,
                calendar_source_id=payload.calendar_source_id,
                delivery_preferences=delivery_preferences,
                action_policies=action_policies,
                delegation_rules=delegation_rules,
            )
            assistant_profile_id = (payload.assistant_profile_id or "").strip() or self._new_id("assistant_profile")
            existing = session.get(AssistantProfileORM, assistant_profile_id)
            if existing is not None and existing.company_id == instance.company_id:
                raise ValueError(f"Assistant profile '{assistant_profile_id}' already exists.")
            if payload.is_default:
                self._clear_existing_default(session, instance=instance)
            now = self._now()
            row = AssistantProfileORM(
                id=assistant_profile_id,
                instance_id=instance.instance_id,
                company_id=instance.company_id,
                display_name=payload.display_name.strip(),
                summary=payload.summary.strip(),
                status=payload.status,
                assistant_mode_enabled=payload.assistant_mode_enabled,
                is_default=payload.is_default,
                timezone=payload.timezone,
                locale=payload.locale,
                tone=payload.tone,
                preferred_contact_id=payload.preferred_contact_id,
                mail_source_id=payload.mail_source_id,
                calendar_source_id=payload.calendar_source_id,
                preferences_json=dict(payload.preferences),
                communication_rules_json=payload.communication_rules.model_dump(mode="json"),
                quiet_hours_json=payload.quiet_hours.model_dump(mode="json"),
                delivery_preferences_json=payload.delivery_preferences.model_dump(mode="json"),
                action_policies_json=payload.action_policies.model_dump(mode="json"),
                delegation_rules_json=payload.delegation_rules.model_dump(mode="json"),
                metadata_json=dict(payload.metadata),
                created_at=now,
                updated_at=now,
            )
            session.add(row)
        return self.get_profile(instance=instance, assistant_profile_id=assistant_profile_id)

    def update_profile(self, *, instance: InstanceRecord, assistant_profile_id: str, payload: UpdateAssistantProfile) -> AssistantProfileDetail:
        with self._session_factory() as session, session.begin():
            row = self._load_profile(session, instance=instance, assistant_profile_id=assistant_profile_id)
            delivery_preferences = payload.delivery_preferences or self._delivery_preferences(row.delivery_preferences_json)
            action_policies = payload.action_policies or self._action_policies(row.action_policies_json)
            delegation_rules = payload.delegation_rules or self._delegation_rules(row.delegation_rules_json)
            preferred_contact_id = payload.preferred_contact_id if payload.preferred_contact_id is not None else row.preferred_contact_id
            mail_source_id = payload.mail_source_id if payload.mail_source_id is not None else row.mail_source_id
            calendar_source_id = payload.calendar_source_id if payload.calendar_source_id is not None else row.calendar_source_id
            self._validate_profile_links(
                session,
                instance=instance,
                preferred_contact_id=preferred_contact_id,
                mail_source_id=mail_source_id,
                calendar_source_id=calendar_source_id,
                delivery_preferences=delivery_preferences,
                action_policies=action_policies,
                delegation_rules=delegation_rules,
            )
            if payload.is_default:
                self._clear_existing_default(session, instance=instance, current_profile_id=row.id)
            row.display_name = payload.display_name.strip() if payload.display_name is not None else row.display_name
            row.summary = payload.summary.strip() if payload.summary is not None else row.summary
            row.status = payload.status or row.status
            row.assistant_mode_enabled = payload.assistant_mode_enabled if payload.assistant_mode_enabled is not None else row.assistant_mode_enabled
            row.is_default = payload.is_default if payload.is_default is not None else row.is_default
            row.timezone = payload.timezone if payload.timezone is not None else row.timezone
            row.locale = payload.locale if payload.locale is not None else row.locale
            row.tone = payload.tone if payload.tone is not None else row.tone
            row.preferred_contact_id = preferred_contact_id
            row.mail_source_id = mail_source_id
            row.calendar_source_id = calendar_source_id
            row.preferences_json = dict(payload.preferences) if payload.preferences is not None else dict(row.preferences_json or {})
            row.communication_rules_json = payload.communication_rules.model_dump(mode="json") if payload.communication_rules is not None else dict(row.communication_rules_json or {})
            row.quiet_hours_json = payload.quiet_hours.model_dump(mode="json") if payload.quiet_hours is not None else dict(row.quiet_hours_json or {})
            row.delivery_preferences_json = delivery_preferences.model_dump(mode="json")
            row.action_policies_json = action_policies.model_dump(mode="json")
            row.delegation_rules_json = delegation_rules.model_dump(mode="json")
            row.metadata_json = dict(payload.metadata) if payload.metadata is not None else dict(row.metadata_json or {})
            row.updated_at = self._now()
        return self.get_profile(instance=instance, assistant_profile_id=assistant_profile_id)

    def _quiet_hours_active(self, settings: QuietHoursSettings, *, at: datetime) -> bool:
        if not settings.enabled:
            return False
        try:
            zone = ZoneInfo(settings.timezone)
        except ZoneInfoNotFoundError:
            zone = UTC
        localized = at.astimezone(zone)
        weekday = _WEEKDAY_NAMES[localized.weekday()]
        minute_of_day = localized.hour * 60 + localized.minute

        if settings.start_minute == settings.end_minute:
            return weekday in settings.days

        if settings.start_minute < settings.end_minute:
            return weekday in settings.days and settings.start_minute <= minute_of_day < settings.end_minute

        previous_weekday = _WEEKDAY_NAMES[(localized.weekday() - 1) % 7]
        return (
            (weekday in settings.days and minute_of_day >= settings.start_minute)
            or (previous_weekday in settings.days and minute_of_day < settings.end_minute)
        )

    def evaluate_action(
        self,
        *,
        instance: InstanceRecord,
        assistant_profile_id: str,
        payload: EvaluateAssistantAction,
    ) -> AssistantActionEvaluation:
        with self._session_factory() as session:
            row = self._load_profile(session, instance=instance, assistant_profile_id=assistant_profile_id)
            delivery_preferences = self._delivery_preferences(row.delivery_preferences_json)
            action_policies = self._action_policies(row.action_policies_json)
            quiet_hours = self._quiet_hours(row.quiet_hours_json)
            delegation_rules = self._delegation_rules(row.delegation_rules_json)
            evaluated_at = payload.occurred_at or self._now()
            reasons: list[str] = []

            if row.status != "active":
                reasons.append("profile_paused")
            if not row.assistant_mode_enabled:
                reasons.append("assistant_mode_disabled")

            effective_channel_id = payload.channel_id or delivery_preferences.primary_channel_id
            if payload.channel_id:
                self._load_channel(session, instance=instance, channel_id=payload.channel_id)
            if payload.target_contact_id:
                self._load_contact(session, instance=instance, contact_id=payload.target_contact_id)

            if payload.action_mode == "suggest" and not action_policies.suggestions_enabled:
                reasons.append("suggestions_disabled")
            if payload.action_mode == "ask" and not action_policies.questions_enabled:
                reasons.append("questions_disabled")

            if payload.action_kind in {"draft_message", "send_notification"} and not action_policies.allow_mail_actions:
                reasons.append("mail_actions_disabled")
            if payload.action_kind == "schedule_calendar" and not action_policies.allow_calendar_actions:
                reasons.append("calendar_actions_disabled")
            if payload.action_kind == "create_follow_up" and not action_policies.allow_task_actions:
                reasons.append("task_actions_disabled")
            if payload.action_kind == "delegate_follow_up" and not delegation_rules.allow_external_delegation:
                reasons.append("delegation_disabled")

            if payload.requires_external_delivery and not effective_channel_id:
                reasons.append("channel_required")
            if effective_channel_id and delivery_preferences.allowed_channel_ids and effective_channel_id not in delivery_preferences.allowed_channel_ids:
                reasons.append("channel_not_allowed")
            if payload.action_mode == "direct" and effective_channel_id and action_policies.direct_channel_ids and effective_channel_id not in action_policies.direct_channel_ids:
                reasons.append("direct_channel_not_allowed")

            quiet_hours_active = self._quiet_hours_active(quiet_hours, at=evaluated_at)
            quiet_hours_override = (
                quiet_hours.allow_priority_override
                and self._priority_at_least(payload.priority, quiet_hours.override_min_priority)
            )
            if quiet_hours_active and payload.requires_external_delivery and delivery_preferences.mute_during_quiet_hours and not quiet_hours_override:
                reasons.append("quiet_hours_active")
            if quiet_hours_active and quiet_hours_override:
                reasons.append("quiet_hours_priority_override")

            decision = "allow"
            preview_required = False
            approval_required = False
            if payload.action_mode == "direct":
                if action_policies.direct_action_policy == "never":
                    reasons.append("direct_actions_disabled")
                elif action_policies.direct_action_policy == "preview_required":
                    decision = "requires_preview"
                    preview_required = True
                elif action_policies.direct_action_policy == "approval_required":
                    decision = "requires_approval"
                    approval_required = True
                    if action_policies.require_approval_reference and not payload.approval_reference:
                        reasons.append("approval_reference_required")
                elif payload.requires_external_delivery and delivery_preferences.preview_by_default:
                    decision = "requires_preview"
                    preview_required = True

            blocking_reasons = {
                "profile_paused",
                "assistant_mode_disabled",
                "suggestions_disabled",
                "questions_disabled",
                "mail_actions_disabled",
                "calendar_actions_disabled",
                "task_actions_disabled",
                "delegation_disabled",
                "channel_required",
                "channel_not_allowed",
                "direct_channel_not_allowed",
                "quiet_hours_active",
                "direct_actions_disabled",
            }
            if any(reason in blocking_reasons for reason in reasons):
                decision = "blocked"
                preview_required = False
                approval_required = False

            return AssistantActionEvaluation(
                assistant_profile_id=row.id,
                decision=decision,  # type: ignore[arg-type]
                action_mode=payload.action_mode,
                action_kind=payload.action_kind,
                priority=payload.priority,
                evaluated_at=evaluated_at,
                effective_channel_id=effective_channel_id,
                fallback_channel_id=delivery_preferences.fallback_channel_id,
                quiet_hours_active=quiet_hours_active,
                preview_required=preview_required,
                approval_required=approval_required,
                delegate_contact_id=delegation_rules.delegate_contact_id,
                reasons=reasons,
                metadata=dict(payload.metadata),
            )

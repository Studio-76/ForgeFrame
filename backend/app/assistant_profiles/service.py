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
    AssistantProfileRiskWarning,
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
    def _metadata_dict(payload: dict[str, object] | None) -> dict[str, object]:
        return dict(payload or {})

    @staticmethod
    def _profile_scope(metadata: dict[str, object] | None) -> str:
        governance = metadata.get("governance") if isinstance(metadata, dict) else None
        if isinstance(governance, dict):
            value = governance.get("profile_scope")
            if value in {"personal", "team"}:
                return value
        return "personal"

    @staticmethod
    def _memory_scope(metadata: dict[str, object] | None) -> str:
        governance = metadata.get("governance") if isinstance(metadata, dict) else None
        if isinstance(governance, dict):
            value = governance.get("memory_scope")
            if value in {"disabled", "personal", "team"}:
                return value
        return "personal"

    @staticmethod
    def _last_evaluation(
        metadata: dict[str, object] | None,
    ) -> AssistantActionEvaluation | None:
        if not isinstance(metadata, dict):
            return None
        raw = metadata.get("last_evaluation")
        if not isinstance(raw, dict):
            return None
        return AssistantActionEvaluation.model_validate(raw)

    @staticmethod
    def _profile_scope_label(scope: str) -> str:
        if scope == "team":
            return "Team profile"
        return "Personal profile"

    @staticmethod
    def _memory_scope_label(scope: str) -> str:
        if scope == "disabled":
            return "No memory persistence"
        if scope == "team":
            return "Team memory"
        return "Profile memory"

    @staticmethod
    def _operating_mode(action_policies: ActionPolicies, *, status: str, assistant_mode_enabled: bool) -> tuple[str, str]:
        if status != "active" or not assistant_mode_enabled:
            return ("disabled", "Disabled")
        if action_policies.direct_action_policy == "allow":
            return ("direct_autonomous", "Direct automation")
        if action_policies.direct_action_policy == "approval_required":
            return ("approval_gated", "Approval gated")
        if action_policies.direct_action_policy == "preview_required":
            return ("preview_gated", "Preview gated")
        if action_policies.suggestions_enabled and action_policies.questions_enabled:
            return ("advisory_only", "Advisory only")
        if action_policies.questions_enabled:
            return ("ask_first", "Ask first")
        if action_policies.suggestions_enabled:
            return ("suggest_only", "Suggest only")
        return ("disabled", "Disabled")

    @staticmethod
    def _quiet_hours_summary(settings: QuietHoursSettings) -> str:
        if not settings.enabled:
            return "Quiet hours disabled"
        day_summary = ",".join(settings.days) if settings.days else "no-days"
        start_hour, start_minute = divmod(settings.start_minute, 60)
        end_hour, end_minute = divmod(settings.end_minute, 60)
        return f"{settings.timezone} {start_hour:02d}:{start_minute:02d}-{end_hour:02d}:{end_minute:02d} ({day_summary})"

    @staticmethod
    def _direct_action_policy_label(policy: str) -> str:
        if policy == "allow":
            return "Direct allowed"
        if policy == "approval_required":
            return "Approval required"
        if policy == "never":
            return "Direct blocked"
        return "Preview required"

    @staticmethod
    def _risk_warning(
        action_policies: ActionPolicies,
        delegation_rules: DelegationRules,
    ) -> AssistantProfileRiskWarning | None:
        reasons: list[str] = []
        level = "guarded"
        if action_policies.direct_action_policy == "allow":
            level = "high"
            reasons.append("Direct actions can execute without preview or approval.")
        elif action_policies.direct_action_policy == "approval_required":
            reasons.append("Direct actions remain available when an approval reference is present.")
        elif action_policies.direct_action_policy == "preview_required":
            reasons.append("Direct actions remain available after a preview gate.")

        if delegation_rules.allow_external_delegation:
            reasons.append("External delegation to contacts is enabled.")
        if action_policies.allow_calendar_actions and action_policies.direct_action_policy != "never":
            reasons.append("Calendar actions can create or change external commitments.")
        if action_policies.allow_mail_actions and action_policies.direct_action_policy != "never":
            reasons.append("Mail and notification actions can leave the system boundary.")

        if not reasons:
            return None
        return AssistantProfileRiskWarning(
            level=level,
            title="Direct external action rights",
            reasons=reasons,
        )

    @staticmethod
    def _action_coverage(action_policies: ActionPolicies, delegation_rules: DelegationRules) -> tuple[list[str], list[str]]:
        coverage = {
            "draft_message": action_policies.allow_mail_actions,
            "send_notification": action_policies.allow_mail_actions,
            "create_follow_up": action_policies.allow_task_actions,
            "schedule_calendar": action_policies.allow_calendar_actions,
            "delegate_follow_up": delegation_rules.allow_external_delegation,
        }
        allowed = [action_kind for action_kind, is_allowed in coverage.items() if is_allowed]
        blocked = [action_kind for action_kind, is_allowed in coverage.items() if not is_allowed]
        return allowed, blocked

    def _channel_links(
        self,
        session: Session,
        *,
        company_id: str,
        instance_id: str,
        channel_ids: list[str],
    ) -> list[RecordLink]:
        links: list[RecordLink] = []
        seen: set[str] = set()
        for channel_id in channel_ids:
            if channel_id in seen:
                continue
            seen.add(channel_id)
            channel = self._load_channel_by_scope(
                session,
                company_id=company_id,
                instance_id=instance_id,
                channel_id=channel_id,
            )
            links.append(self._record_link(channel.id, channel.label, channel.status))
        return links

    @staticmethod
    def _priority_at_least(priority: str, minimum: str) -> bool:
        return _PRIORITY_RANK.get(priority, 0) >= _PRIORITY_RANK.get(minimum, 0)

    def _load_contact(self, session: Session, *, instance: InstanceRecord, contact_id: str) -> ContactORM:
        return self._load_contact_by_scope(
            session,
            company_id=instance.company_id,
            instance_id=instance.instance_id,
            contact_id=contact_id,
        )

    @staticmethod
    def _load_contact_by_scope(session: Session, *, company_id: str, instance_id: str, contact_id: str) -> ContactORM:
        row = session.get(ContactORM, contact_id)
        if row is None or row.company_id != company_id or row.instance_id != instance_id:
            raise ValueError(f"Contact '{contact_id}' was not found.")
        return row

    def _load_channel(self, session: Session, *, instance: InstanceRecord, channel_id: str) -> DeliveryChannelORM:
        return self._load_channel_by_scope(
            session,
            company_id=instance.company_id,
            instance_id=instance.instance_id,
            channel_id=channel_id,
        )

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
            self._load_contact(
                session,
                instance=instance,
                contact_id=delegation_rules.delegate_contact_id,
            )
        if delegation_rules.escalation_contact_id:
            self._load_contact(
                session,
                instance=instance,
                contact_id=delegation_rules.escalation_contact_id,
            )
        if mail_source_id:
            self._load_source(
                session,
                instance=instance,
                source_id=mail_source_id,
                expected_kind="mail",
            )
        if calendar_source_id:
            self._load_source(
                session,
                instance=instance,
                source_id=calendar_source_id,
                expected_kind="calendar",
            )

        if delivery_preferences.primary_channel_id:
            self._load_channel(
                session,
                instance=instance,
                channel_id=delivery_preferences.primary_channel_id,
            )
        if delivery_preferences.fallback_channel_id:
            self._load_channel(
                session,
                instance=instance,
                channel_id=delivery_preferences.fallback_channel_id,
            )
        if delivery_preferences.primary_channel_id and delivery_preferences.fallback_channel_id and delivery_preferences.primary_channel_id == delivery_preferences.fallback_channel_id:
            raise ValueError("Primary and fallback channel must not be identical.")

        for channel_id in delivery_preferences.allowed_channel_ids:
            self._load_channel(session, instance=instance, channel_id=channel_id)
        for channel_id in action_policies.direct_channel_ids:
            self._load_channel(session, instance=instance, channel_id=channel_id)

        if delivery_preferences.allowed_channel_ids and delivery_preferences.primary_channel_id and delivery_preferences.primary_channel_id not in delivery_preferences.allowed_channel_ids:
            raise ValueError("Primary channel must be part of allowed channel ids when allow-listing is enabled.")
        if delivery_preferences.allowed_channel_ids and delivery_preferences.fallback_channel_id and delivery_preferences.fallback_channel_id not in delivery_preferences.allowed_channel_ids:
            raise ValueError("Fallback channel must be part of allowed channel ids when allow-listing is enabled.")

    def _clear_existing_default(
        self,
        session: Session,
        *,
        instance: InstanceRecord,
        current_profile_id: str | None = None,
    ) -> None:
        for existing in (
            session
            .execute(
                select(AssistantProfileORM).where(
                    AssistantProfileORM.company_id == instance.company_id,
                    AssistantProfileORM.instance_id == instance.instance_id,
                    AssistantProfileORM.is_default.is_(True),
                )
            )
            .scalars()
            .all()
        ):
            if current_profile_id is not None and existing.id == current_profile_id:
                continue
            existing.is_default = False
            existing.updated_at = self._now()

    def _summary(self, row: AssistantProfileORM) -> AssistantProfileSummary:
        quiet_hours = self._quiet_hours(row.quiet_hours_json)
        delivery_preferences = self._delivery_preferences(row.delivery_preferences_json)
        action_policies = self._action_policies(row.action_policies_json)
        delegation_rules = self._delegation_rules(row.delegation_rules_json)
        metadata = self._metadata_dict(row.metadata_json)
        profile_scope = self._profile_scope(metadata)
        memory_scope = self._memory_scope(metadata)
        operating_mode, operating_mode_label = self._operating_mode(
            action_policies,
            status=row.status,
            assistant_mode_enabled=row.assistant_mode_enabled,
        )
        return AssistantProfileSummary(
            assistant_profile_id=row.id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            display_name=row.display_name,
            summary=row.summary,
            status=row.status,
            assistant_mode_enabled=row.assistant_mode_enabled,
            is_default=row.is_default,
            timezone=row.timezone,
            locale=row.locale,
            tone=row.tone,
            preferred_contact_id=row.preferred_contact_id,
            primary_channel_id=delivery_preferences.primary_channel_id,
            fallback_channel_id=delivery_preferences.fallback_channel_id,
            mail_source_id=row.mail_source_id,
            calendar_source_id=row.calendar_source_id,
            profile_scope=profile_scope,
            profile_scope_label=self._profile_scope_label(profile_scope),
            memory_scope=memory_scope,
            memory_scope_label=self._memory_scope_label(memory_scope),
            operating_mode=operating_mode,
            operating_mode_label=operating_mode_label,
            quiet_hours_summary=self._quiet_hours_summary(quiet_hours),
            direct_action_policy=action_policies.direct_action_policy,
            direct_action_policy_label=self._direct_action_policy_label(action_policies.direct_action_policy),
            last_evaluation=self._last_evaluation(metadata),
            risk_warning=self._risk_warning(action_policies, delegation_rules),
            metadata=metadata,
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
        allowed_action_kinds, blocked_action_kinds = self._action_coverage(action_policies, delegation_rules)

        preferred_contact = None
        if row.preferred_contact_id:
            contact = self._load_contact_by_scope(
                session,
                company_id=row.company_id,
                instance_id=row.instance_id,
                contact_id=row.preferred_contact_id,
            )
            preferred_contact = self._record_link(contact.id, contact.display_name, contact.status)

        delegate_contact = None
        if delegation_rules.delegate_contact_id:
            contact = self._load_contact_by_scope(
                session,
                company_id=row.company_id,
                instance_id=row.instance_id,
                contact_id=delegation_rules.delegate_contact_id,
            )
            delegate_contact = self._record_link(contact.id, contact.display_name, contact.status)

        escalation_contact = None
        if delegation_rules.escalation_contact_id:
            contact = self._load_contact_by_scope(
                session,
                company_id=row.company_id,
                instance_id=row.instance_id,
                contact_id=delegation_rules.escalation_contact_id,
            )
            escalation_contact = self._record_link(contact.id, contact.display_name, contact.status)

        primary_channel = None
        if delivery_preferences.primary_channel_id:
            channel = self._load_channel_by_scope(
                session,
                company_id=row.company_id,
                instance_id=row.instance_id,
                channel_id=delivery_preferences.primary_channel_id,
            )
            primary_channel = self._record_link(channel.id, channel.label, channel.status)

        fallback_channel = None
        if delivery_preferences.fallback_channel_id:
            channel = self._load_channel_by_scope(
                session,
                company_id=row.company_id,
                instance_id=row.instance_id,
                channel_id=delivery_preferences.fallback_channel_id,
            )
            fallback_channel = self._record_link(channel.id, channel.label, channel.status)

        mail_source = None
        if row.mail_source_id:
            source = self._load_source_by_scope(
                session,
                company_id=row.company_id,
                instance_id=row.instance_id,
                source_id=row.mail_source_id,
            )
            mail_source = self._record_link(source.id, source.label, source.status)

        calendar_source = None
        if row.calendar_source_id:
            source = self._load_source_by_scope(
                session,
                company_id=row.company_id,
                instance_id=row.instance_id,
                source_id=row.calendar_source_id,
            )
            calendar_source = self._record_link(source.id, source.label, source.status)

        allowed_channels = self._channel_links(
            session,
            company_id=row.company_id,
            instance_id=row.instance_id,
            channel_ids=delivery_preferences.allowed_channel_ids,
        )
        direct_channels = self._channel_links(
            session,
            company_id=row.company_id,
            instance_id=row.instance_id,
            channel_ids=action_policies.direct_channel_ids,
        )

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
            allowed_action_kinds=allowed_action_kinds,
            blocked_action_kinds=blocked_action_kinds,
            allowed_channels=allowed_channels,
            direct_channels=direct_channels,
        )

    def list_profiles(self, *, instance: InstanceRecord, status: str | None = None, limit: int = 100) -> list[AssistantProfileSummary]:
        with self._session_factory() as session:
            stmt = select(AssistantProfileORM).where(
                AssistantProfileORM.company_id == instance.company_id,
                AssistantProfileORM.instance_id == instance.instance_id,
            )
            if status is not None:
                stmt = stmt.where(AssistantProfileORM.status == status)
            rows = (
                session
                .execute(
                    stmt.order_by(
                        AssistantProfileORM.is_default.desc(),
                        AssistantProfileORM.updated_at.desc(),
                    ).limit(max(1, min(limit, 200)))
                )
                .scalars()
                .all()
            )
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
                metadata_json={
                    **dict(payload.metadata),
                    "governance": {
                        "profile_scope": payload.profile_scope,
                        "memory_scope": payload.memory_scope,
                    },
                },
                created_at=now,
                updated_at=now,
            )
            session.add(row)
        return self.get_profile(instance=instance, assistant_profile_id=assistant_profile_id)

    def update_profile(
        self,
        *,
        instance: InstanceRecord,
        assistant_profile_id: str,
        payload: UpdateAssistantProfile,
    ) -> AssistantProfileDetail:
        with self._session_factory() as session, session.begin():
            row = self._load_profile(session, instance=instance, assistant_profile_id=assistant_profile_id)
            delivery_preferences = payload.delivery_preferences or self._delivery_preferences(row.delivery_preferences_json)
            action_policies = payload.action_policies or self._action_policies(row.action_policies_json)
            delegation_rules = payload.delegation_rules or self._delegation_rules(row.delegation_rules_json)
            preferred_contact_id = payload.preferred_contact_id if "preferred_contact_id" in payload.model_fields_set else row.preferred_contact_id
            mail_source_id = payload.mail_source_id if "mail_source_id" in payload.model_fields_set else row.mail_source_id
            calendar_source_id = payload.calendar_source_id if "calendar_source_id" in payload.model_fields_set else row.calendar_source_id
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
            next_metadata = dict(payload.metadata) if payload.metadata is not None else dict(row.metadata_json or {})
            next_metadata["governance"] = {
                "profile_scope": payload.profile_scope if payload.profile_scope is not None else self._profile_scope(next_metadata),
                "memory_scope": payload.memory_scope if payload.memory_scope is not None else self._memory_scope(next_metadata),
            }
            if "last_evaluation" in (row.metadata_json or {}) and "last_evaluation" not in next_metadata:
                next_metadata["last_evaluation"] = dict((row.metadata_json or {}).get("last_evaluation") or {})
            row.metadata_json = next_metadata
            row.updated_at = self._now()
        return self.get_profile(instance=instance, assistant_profile_id=assistant_profile_id)

    def _quiet_hours_active(self, settings: QuietHoursSettings, *, at: datetime) -> bool:
        if not settings.enabled:
            return False
        try:
            zone = ZoneInfo(settings.timezone)
        except ZoneInfoNotFoundError:
            zone = ZoneInfo("UTC")
        localized = at.astimezone(zone)
        weekday = _WEEKDAY_NAMES[localized.weekday()]
        minute_of_day = localized.hour * 60 + localized.minute

        if settings.start_minute == settings.end_minute:
            return weekday in settings.days

        if settings.start_minute < settings.end_minute:
            return weekday in settings.days and settings.start_minute <= minute_of_day < settings.end_minute

        previous_weekday = _WEEKDAY_NAMES[(localized.weekday() - 1) % 7]
        return (weekday in settings.days and minute_of_day >= settings.start_minute) or (previous_weekday in settings.days and minute_of_day < settings.end_minute)

    def evaluate_action(
        self,
        *,
        instance: InstanceRecord,
        assistant_profile_id: str,
        payload: EvaluateAssistantAction,
    ) -> AssistantActionEvaluation:
        with self._session_factory() as session, session.begin():
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
            quiet_hours_override = quiet_hours.allow_priority_override and self._priority_at_least(payload.priority, quiet_hours.override_min_priority)
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

            evaluation = AssistantActionEvaluation(
                assistant_profile_id=row.id,
                decision=decision,
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
            next_metadata = dict(row.metadata_json or {})
            next_metadata["last_evaluation"] = evaluation.model_dump(mode="json")
            row.metadata_json = next_metadata
            row.updated_at = self._now()
            return evaluation

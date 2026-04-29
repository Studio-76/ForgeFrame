"""Admin-facing agent inventory and default-operator service."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.agents.models import AgentDetail, AgentSummary, CreateAgent, UpdateAgent
from app.instances.models import InstanceRecord
from app.knowledge.models import RecordLink
from app.storage.agent_repository import AgentORM
from app.storage.assistant_profile_repository import AssistantProfileORM
from app.storage.conversation_repository import ConversationEventORM, ConversationMentionORM, ConversationParticipantORM

SessionFactory = Callable[[], Session]


class AgentAdminService:
    def __init__(self, session_factory: SessionFactory) -> None:
        self._session_factory = session_factory

    @staticmethod
    def _now() -> datetime:
        return datetime.now(tz=UTC)

    @staticmethod
    def _new_id(prefix: str) -> str:
        return f"{prefix}_{uuid4().hex[:20]}"

    @staticmethod
    def _normalize_allowed_targets(values: list[str] | None) -> list[str]:
        normalized = []
        seen: set[str] = set()
        for raw in values or []:
            value = raw.strip()
            if not value or value in seen:
                continue
            seen.add(value)
            normalized.append(value)
        return normalized

    @staticmethod
    def _record_link(record_id: str, label: str, status: str | None = None) -> RecordLink:
        return RecordLink(record_id=record_id, label=label, status=status)

    def _load_profile(self, session: Session, *, instance: InstanceRecord, assistant_profile_id: str) -> AssistantProfileORM:
        row = session.get(AssistantProfileORM, assistant_profile_id)
        if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
            raise ValueError(f"Assistant profile '{assistant_profile_id}' was not found.")
        return row

    def _load_agent(self, session: Session, *, instance: InstanceRecord, agent_id: str) -> AgentORM:
        row = session.get(AgentORM, agent_id)
        if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
            raise ValueError(f"Agent '{agent_id}' was not found.")
        return row

    @staticmethod
    def _addressability(row: AgentORM) -> tuple[bool, str]:
        if row.status != "active":
            return False, "Paused or archived agents stay visible in history but are not offered for active conversation routing."
        if row.participation_mode == "direct":
            return True, "Addressable for assignment, mentions, and active conversation participation."
        if row.participation_mode == "mentioned_only":
            return True, "Addressable as a mention target only; ownership and handoff controls stay disabled."
        if row.participation_mode == "roundtable":
            return True, "Addressable for mentions and broadcast/roundtable participation, but not as a dedicated owner."
        if row.participation_mode == "handoff_only":
            return True, "Addressable only for handoff or blocker ownership, not for mention-based routing."
        return False, "Conversation addressability is not available for this backend participation mode."

    def _summary(self, session: Session, row: AgentORM) -> AgentSummary:
        conversation_count = session.scalar(
            select(func.count(func.distinct(ConversationParticipantORM.conversation_id))).where(
                ConversationParticipantORM.company_id == row.company_id,
                ConversationParticipantORM.agent_id == row.id,
            )
        ) or 0
        mention_count = session.scalar(
            select(func.count()).select_from(ConversationMentionORM).where(
                ConversationMentionORM.company_id == row.company_id,
                ConversationMentionORM.agent_id == row.id,
            )
        ) or 0
        participant_last_activity = session.scalar(
            select(func.max(ConversationParticipantORM.updated_at)).where(
                ConversationParticipantORM.company_id == row.company_id,
                ConversationParticipantORM.agent_id == row.id,
            )
        )
        mention_last_activity = session.scalar(
            select(func.max(ConversationMentionORM.created_at)).where(
                ConversationMentionORM.company_id == row.company_id,
                ConversationMentionORM.agent_id == row.id,
            )
        )
        event_last_activity = session.scalar(
            select(func.max(ConversationEventORM.created_at)).where(
                ConversationEventORM.company_id == row.company_id,
                or_(ConversationEventORM.source_agent_id == row.id, ConversationEventORM.target_agent_id == row.id),
            )
        )
        addressable_in_conversations, addressability_reason = self._addressability(row)
        last_activity_candidates = [
            row.updated_at,
            participant_last_activity,
            mention_last_activity,
            event_last_activity,
        ]
        last_activity_at = max((item for item in last_activity_candidates if item is not None), default=row.updated_at)
        return AgentSummary(
            agent_id=row.id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            display_name=row.display_name,
            default_name=row.default_name,
            role_kind=row.role_kind,  # type: ignore[arg-type]
            status=row.status,  # type: ignore[arg-type]
            participation_mode=row.participation_mode,  # type: ignore[arg-type]
            allowed_targets=list(row.allowed_targets_json or []),
            assistant_profile_id=row.assistant_profile_id,
            is_default_operator=row.is_default_operator,
            conversation_count=int(conversation_count),
            mention_count=int(mention_count),
            last_activity_at=last_activity_at,
            addressable_in_conversations=addressable_in_conversations,
            addressability_reason=addressability_reason,
            metadata=dict(row.metadata_json or {}),
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    def _detail(self, session: Session, row: AgentORM) -> AgentDetail:
        summary = self._summary(session, row)
        assistant_profile = None
        if row.assistant_profile_id:
            profile = session.get(AssistantProfileORM, row.assistant_profile_id)
            if profile is not None and profile.company_id == row.company_id and profile.instance_id == row.instance_id:
                assistant_profile = self._record_link(profile.id, profile.display_name, profile.status)
        return AgentDetail(**summary.model_dump(), assistant_profile=assistant_profile)

    def _clear_default_operator(self, session: Session, *, instance: InstanceRecord, current_agent_id: str | None = None) -> None:
        for existing in session.execute(
            select(AgentORM).where(
                AgentORM.company_id == instance.company_id,
                AgentORM.instance_id == instance.instance_id,
                AgentORM.is_default_operator.is_(True),
            )
        ).scalars().all():
            if current_agent_id is not None and existing.id == current_agent_id:
                continue
            existing.is_default_operator = False
            if existing.role_kind == "operator":
                existing.role_kind = "specialist"
            existing.updated_at = self._now()

    def inspect_default_operator(self, *, instance: InstanceRecord) -> AgentDetail | None:
        with self._session_factory() as session:
            row = session.execute(
                select(AgentORM).where(
                    AgentORM.company_id == instance.company_id,
                    AgentORM.instance_id == instance.instance_id,
                    AgentORM.is_default_operator.is_(True),
                )
            ).scalars().first()
            if row is None:
                return None
            return self._detail(session, row)

    def ensure_default_operator_with_status(self, *, instance: InstanceRecord) -> tuple[AgentDetail, bool]:
        existing = self.inspect_default_operator(instance=instance)
        if existing is not None:
            return existing, False
        with self._session_factory() as session, session.begin():
            current = session.execute(
                select(AgentORM).where(
                    AgentORM.company_id == instance.company_id,
                    AgentORM.instance_id == instance.instance_id,
                    AgentORM.is_default_operator.is_(True),
                )
            ).scalars().first()
            if current is None:
                current = AgentORM(
                    id=self._new_id("agent"),
                    instance_id=instance.instance_id,
                    company_id=instance.company_id,
                    display_name="Operator",
                    default_name="Operator",
                    role_kind="operator",
                    status="active",
                    participation_mode="direct",
                    allowed_targets_json=[],
                    assistant_profile_id=None,
                    is_default_operator=True,
                    metadata_json={"autocreated": True, "source": "instance_bootstrap"},
                    created_at=self._now(),
                    updated_at=self._now(),
                )
                session.add(current)
        operator = self.inspect_default_operator(instance=instance)
        if operator is None:
            raise ValueError(f"Default operator for instance '{instance.instance_id}' could not be resolved.")
        return operator, True

    def ensure_default_operator(self, *, instance: InstanceRecord) -> AgentDetail:
        operator, _created = self.ensure_default_operator_with_status(instance=instance)
        return operator

    def list_agents(
        self,
        *,
        instance: InstanceRecord,
        status: str | None = None,
        limit: int = 100,
        ensure_default_operator: bool = False,
    ) -> list[AgentSummary]:
        if ensure_default_operator:
            self.ensure_default_operator(instance=instance)
        with self._session_factory() as session:
            stmt = select(AgentORM).where(
                AgentORM.company_id == instance.company_id,
                AgentORM.instance_id == instance.instance_id,
            )
            if status is not None:
                stmt = stmt.where(AgentORM.status == status)
            rows = session.execute(
                stmt.order_by(AgentORM.is_default_operator.desc(), AgentORM.updated_at.desc()).limit(max(1, min(limit, 200)))
            ).scalars().all()
            return [self._summary(session, row) for row in rows]

    def get_agent(self, *, instance: InstanceRecord, agent_id: str) -> AgentDetail:
        with self._session_factory() as session:
            row = self._load_agent(session, instance=instance, agent_id=agent_id)
            return self._detail(session, row)

    def create_agent(self, *, instance: InstanceRecord, payload: CreateAgent) -> AgentDetail:
        self.ensure_default_operator(instance=instance)
        with self._session_factory() as session, session.begin():
            agent_id = (payload.agent_id or "").strip() or self._new_id("agent")
            existing = session.get(AgentORM, agent_id)
            if existing is not None and existing.company_id == instance.company_id:
                raise ValueError(f"Agent '{agent_id}' already exists.")
            if payload.assistant_profile_id:
                self._load_profile(session, instance=instance, assistant_profile_id=payload.assistant_profile_id)
            if payload.is_default_operator:
                self._clear_default_operator(session, instance=instance)
            row = AgentORM(
                id=agent_id,
                instance_id=instance.instance_id,
                company_id=instance.company_id,
                display_name=payload.display_name.strip(),
                default_name=("Operator" if payload.is_default_operator else (payload.default_name or payload.display_name).strip()),
                role_kind="operator" if payload.is_default_operator else payload.role_kind,
                status=payload.status,
                participation_mode=payload.participation_mode,
                allowed_targets_json=self._normalize_allowed_targets(payload.allowed_targets),
                assistant_profile_id=payload.assistant_profile_id,
                is_default_operator=payload.is_default_operator,
                metadata_json=dict(payload.metadata),
                created_at=self._now(),
                updated_at=self._now(),
            )
            session.add(row)
        return self.get_agent(instance=instance, agent_id=agent_id)

    def update_agent(self, *, instance: InstanceRecord, agent_id: str, payload: UpdateAgent) -> AgentDetail:
        self.ensure_default_operator(instance=instance)
        with self._session_factory() as session, session.begin():
            row = self._load_agent(session, instance=instance, agent_id=agent_id)
            next_default = payload.is_default_operator if payload.is_default_operator is not None else row.is_default_operator
            if payload.assistant_profile_id:
                self._load_profile(session, instance=instance, assistant_profile_id=payload.assistant_profile_id)
            if next_default:
                self._clear_default_operator(session, instance=instance, current_agent_id=row.id)
            next_display_name = payload.display_name.strip() if payload.display_name is not None else row.display_name
            if row.is_default_operator and payload.default_name is not None and payload.default_name.strip() != "Operator":
                raise ValueError("The default operator keeps 'Operator' as its default name.")
            row.display_name = next_display_name
            row.default_name = (
                "Operator"
                if next_default
                else (payload.default_name.strip() if payload.default_name is not None else row.default_name)
            )
            row.role_kind = ("operator" if next_default else (payload.role_kind or row.role_kind))
            row.status = payload.status or row.status
            row.participation_mode = payload.participation_mode or row.participation_mode
            row.allowed_targets_json = (
                self._normalize_allowed_targets(payload.allowed_targets)
                if payload.allowed_targets is not None
                else list(row.allowed_targets_json or [])
            )
            row.assistant_profile_id = payload.assistant_profile_id if payload.assistant_profile_id is not None else row.assistant_profile_id
            row.is_default_operator = next_default
            row.metadata_json = dict(payload.metadata) if payload.metadata is not None else dict(row.metadata_json or {})
            row.updated_at = self._now()
        return self.get_agent(instance=instance, agent_id=agent_id)

    def archive_agent(
        self,
        *,
        instance: InstanceRecord,
        agent_id: str,
        replacement_agent_id: str | None = None,
        reason: str | None = None,
    ) -> AgentDetail:
        self.ensure_default_operator(instance=instance)
        with self._session_factory() as session, session.begin():
            row = self._load_agent(session, instance=instance, agent_id=agent_id)
            replacement: AgentORM | None = None
            if row.is_default_operator:
                if not replacement_agent_id:
                    raise ValueError("The default operator can only be archived after naming a replacement agent.")
                replacement = self._load_agent(session, instance=instance, agent_id=replacement_agent_id)
                if replacement.id == row.id:
                    raise ValueError("Replacement agent must differ from the current default operator.")
                self._clear_default_operator(session, instance=instance)
                replacement.is_default_operator = True
                replacement.role_kind = "operator"
                replacement.default_name = "Operator"
                replacement.status = "active"
                replacement.updated_at = self._now()
            row.status = "archived"
            row.is_default_operator = False
            metadata = dict(row.metadata_json or {})
            if reason:
                metadata["archive_reason"] = reason
            if replacement is not None:
                metadata["replacement_agent_id"] = replacement.id
            row.metadata_json = metadata
            row.updated_at = self._now()
        return self.get_agent(instance=instance, agent_id=agent_id)

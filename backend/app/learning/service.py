"""Admin-facing learning-persistence and promotion service."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.agents.service import AgentAdminService
from app.instances.models import InstanceRecord
from app.knowledge.models import CreateMemory
from app.knowledge.service import KnowledgeContextAdminService
from app.learning.models import CreateLearningEvent, DecideLearningEvent, LearningEventDetail, LearningEventSummary
from app.skills.models import CreateSkill
from app.skills.service import SkillAdminService
from app.storage.agent_repository import AgentORM
from app.storage.conversation_repository import ConversationORM
from app.storage.execution_repository import RunORM
from app.storage.knowledge_repository import MemoryEntryORM
from app.storage.learning_repository import LearningEventORM
from app.storage.skill_repository import SkillORM

SessionFactory = Callable[[], Session]


class LearningAdminService:
    def __init__(self, session_factory: SessionFactory) -> None:
        self._session_factory = session_factory
        self._knowledge = KnowledgeContextAdminService(session_factory)
        self._skills = SkillAdminService(session_factory)
        self._agents = AgentAdminService(session_factory)

    @staticmethod
    def _now() -> datetime:
        return datetime.now(tz=UTC)

    @staticmethod
    def _new_id(prefix: str) -> str:
        return f"{prefix}_{uuid4().hex[:20]}"

    def _load_agent(self, session: Session, *, instance: InstanceRecord, agent_id: str) -> AgentORM:
        row = session.get(AgentORM, agent_id)
        if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
            raise ValueError(f"Agent '{agent_id}' was not found.")
        return row

    def _load_conversation(self, session: Session, *, instance: InstanceRecord, conversation_id: str) -> ConversationORM:
        row = session.get(ConversationORM, conversation_id)
        if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
            raise ValueError(f"Conversation '{conversation_id}' was not found.")
        return row

    def _load_run(self, session: Session, *, instance: InstanceRecord, run_id: str) -> RunORM:
        row = session.get(RunORM, run_id)
        if row is None or row.company_id != instance.company_id:
            raise ValueError(f"Run '{run_id}' was not found.")
        return row

    def _load_event(self, session: Session, *, instance: InstanceRecord, event_id: str) -> LearningEventORM:
        row = session.get(LearningEventORM, event_id)
        if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
            raise ValueError(f"Learning event '{event_id}' was not found.")
        return row

    @staticmethod
    def _summary(row: LearningEventORM) -> LearningEventSummary:
        return LearningEventSummary(
            learning_event_id=row.id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            trigger_kind=row.trigger_kind,  # type: ignore[arg-type]
            suggested_decision=row.suggested_decision,  # type: ignore[arg-type]
            status=row.status,  # type: ignore[arg-type]
            summary=row.summary,
            explanation=row.explanation,
            agent_id=row.agent_id,
            run_id=row.run_id,
            conversation_id=row.conversation_id,
            evidence=dict(row.evidence_json or {}),
            proposed_memory=dict(row.proposed_memory_json or {}),
            proposed_skill=dict(row.proposed_skill_json or {}),
            promoted_memory_id=row.promoted_memory_id,
            promoted_skill_id=row.promoted_skill_id,
            human_override=row.human_override,
            decision_note=row.decision_note,
            created_at=row.created_at,
            decided_at=row.decided_at,
        )

    def _detail(self, session: Session, row: LearningEventORM) -> LearningEventDetail:
        summary = self._summary(row)
        agent = None
        if row.agent_id:
            agent_row = session.get(AgentORM, row.agent_id)
            if agent_row is not None and agent_row.company_id == row.company_id and agent_row.instance_id == row.instance_id:
                agent = {"record_id": agent_row.id, "label": agent_row.display_name, "status": agent_row.status}
        conversation = None
        if row.conversation_id:
            conversation_row = session.get(ConversationORM, row.conversation_id)
            if conversation_row is not None and conversation_row.company_id == row.company_id and conversation_row.instance_id == row.instance_id:
                conversation = {"record_id": conversation_row.id, "label": conversation_row.subject, "status": conversation_row.status}
        run = None
        if row.run_id:
            run_row = session.get(RunORM, row.run_id)
            if run_row is not None and run_row.company_id == row.company_id:
                run = {"record_id": run_row.id, "label": run_row.run_kind, "status": run_row.lifecycle_status}
        promoted_memory = None
        if row.promoted_memory_id:
            memory_row = session.get(MemoryEntryORM, row.promoted_memory_id)
            if memory_row is not None and memory_row.company_id == row.company_id:
                promoted_memory = {"record_id": memory_row.id, "label": memory_row.title, "status": memory_row.truth_state}
        promoted_skill = None
        if row.promoted_skill_id:
            skill_row = session.get(SkillORM, row.promoted_skill_id)
            if skill_row is not None and skill_row.company_id == row.company_id:
                promoted_skill = {"record_id": skill_row.id, "label": skill_row.display_name, "status": skill_row.status}
        return LearningEventDetail(
            **summary.model_dump(),
            agent=agent,
            run=run,
            conversation=conversation,
            promoted_memory=promoted_memory,
            promoted_skill=promoted_skill,
        )

    def list_events(self, *, instance: InstanceRecord, status: str | None = None, trigger_kind: str | None = None, limit: int = 100) -> list[LearningEventSummary]:
        with self._session_factory() as session:
            stmt = select(LearningEventORM).where(
                LearningEventORM.company_id == instance.company_id,
                LearningEventORM.instance_id == instance.instance_id,
            )
            if status is not None:
                stmt = stmt.where(LearningEventORM.status == status)
            if trigger_kind is not None:
                stmt = stmt.where(LearningEventORM.trigger_kind == trigger_kind)
            rows = session.execute(
                stmt.order_by(LearningEventORM.created_at.desc()).limit(max(1, min(limit, 200)))
            ).scalars().all()
            return [self._summary(row) for row in rows]

    def get_event(self, *, instance: InstanceRecord, event_id: str) -> LearningEventDetail:
        with self._session_factory() as session:
            row = self._load_event(session, instance=instance, event_id=event_id)
            return self._detail(session, row)

    def create_event(self, *, instance: InstanceRecord, payload: CreateLearningEvent) -> LearningEventDetail:
        with self._session_factory() as session, session.begin():
            if payload.agent_id:
                self._load_agent(session, instance=instance, agent_id=payload.agent_id)
            if payload.conversation_id:
                self._load_conversation(session, instance=instance, conversation_id=payload.conversation_id)
            if payload.run_id:
                self._load_run(session, instance=instance, run_id=payload.run_id)
            event_id = self._new_id("learning")
            session.add(
                LearningEventORM(
                    id=event_id,
                    instance_id=instance.instance_id,
                    company_id=instance.company_id,
                    trigger_kind=payload.trigger_kind,
                    suggested_decision=payload.suggested_decision,
                    status="pending",
                    summary=payload.summary.strip(),
                    explanation=payload.explanation.strip(),
                    agent_id=payload.agent_id,
                    run_id=payload.run_id,
                    conversation_id=payload.conversation_id,
                    evidence_json=dict(payload.evidence),
                    proposed_memory_json=dict(payload.proposed_memory),
                    proposed_skill_json=dict(payload.proposed_skill),
                    created_at=self._now(),
                )
            )
        return self.get_event(instance=instance, event_id=event_id)

    def scan_patterns(self, *, instance: InstanceRecord) -> list[LearningEventSummary]:
        created_event_ids: list[str] = []
        with self._session_factory() as session, session.begin():
            repeated_titles = session.execute(
                select(MemoryEntryORM.title, func.count(MemoryEntryORM.id))
                .where(
                    MemoryEntryORM.company_id == instance.company_id,
                    MemoryEntryORM.instance_id == instance.instance_id,
                    MemoryEntryORM.status == "corrected",
                )
                .group_by(MemoryEntryORM.title)
                .having(func.count(MemoryEntryORM.id) >= 2)
            ).all()
            for title, count in repeated_titles:
                exists = session.execute(
                    select(LearningEventORM).where(
                        LearningEventORM.company_id == instance.company_id,
                        LearningEventORM.instance_id == instance.instance_id,
                        LearningEventORM.trigger_kind == "pattern_detected",
                        LearningEventORM.summary == f"Repeated correction pattern: {title}",
                        LearningEventORM.status.in_(("pending", "review_required")),
                    )
                ).scalars().first()
                if exists is not None:
                    continue
                event_id = self._new_id("learning")
                session.add(
                    LearningEventORM(
                        id=event_id,
                        instance_id=instance.instance_id,
                        company_id=instance.company_id,
                        trigger_kind="pattern_detected",
                        suggested_decision="review_required",
                        status="pending",
                        summary=f"Repeated correction pattern: {title}",
                        explanation="ForgeFrame observed repeated corrected memory titles and surfaced a review item for durable learning.",
                        evidence_json={"title": title, "correction_count": int(count)},
                        proposed_memory_json={},
                        proposed_skill_json={"display_name": title, "summary": "Skill draft suggested from repeated memory corrections."},
                        created_at=self._now(),
                    )
                )
                created_event_ids.append(event_id)
        return [self.get_event(instance=instance, event_id=event_id) for event_id in created_event_ids]

    def decide_event(self, *, instance: InstanceRecord, event_id: str, payload: DecideLearningEvent) -> LearningEventDetail:
        with self._session_factory() as session, session.begin():
            row = self._load_event(session, instance=instance, event_id=event_id)
            if row.status not in {"pending", "review_required"}:
                raise ValueError("Only pending learning events can be decided.")

            decision = payload.decision
            if decision == "discard":
                row.status = "discarded"
            elif decision == "history_only":
                row.status = "applied"
            elif decision == "review_required":
                row.status = "review_required"
            row.human_override = payload.human_override or decision != row.suggested_decision
            row.decision_note = payload.decision_note
            row.decided_at = self._now()

        if payload.decision in {"boot_memory", "durable_memory"}:
            memory_seed = dict(row.proposed_memory_json or {})
            memory_seed.update(payload.memory_payload)
            created = self._knowledge.create_memory(
                instance=instance,
                payload=CreateMemory(
                    source_id=memory_seed.get("source_id"),
                    contact_id=memory_seed.get("contact_id"),
                    conversation_id=row.conversation_id,
                    task_id=memory_seed.get("task_id"),
                    notification_id=memory_seed.get("notification_id"),
                    workspace_id=memory_seed.get("workspace_id"),
                    memory_kind=memory_seed.get("memory_kind", "summary"),
                    title=memory_seed.get("title") or row.summary,
                    body=memory_seed.get("body") or row.explanation or row.summary,
                    visibility_scope=memory_seed.get("visibility_scope", "team"),
                    sensitivity=memory_seed.get("sensitivity", "normal"),
                    source_trust_class=memory_seed.get("source_trust_class", "runtime_inferred"),
                    learned_from_event_id=row.id,
                    human_override=payload.human_override,
                    metadata={
                        **dict(memory_seed.get("metadata") or {}),
                        "learning_decision": payload.decision,
                        "learning_event_id": row.id,
                        "memory_tier": "boot" if payload.decision == "boot_memory" else "durable",
                    },
                ),
            )
            with self._session_factory() as session, session.begin():
                row = self._load_event(session, instance=instance, event_id=event_id)
                row.status = "applied"
                row.promoted_memory_id = created.memory_id
                row.human_override = payload.human_override or row.human_override
                row.decision_note = payload.decision_note
                row.decided_at = self._now()
        elif payload.decision == "skill_draft":
            skill_seed = dict(row.proposed_skill_json or {})
            skill_seed.update(payload.skill_payload)
            created = self._skills.create_skill(
                instance=instance,
                payload=CreateSkill(
                    display_name=skill_seed.get("display_name") or row.summary[:191],
                    summary=skill_seed.get("summary") or row.explanation[:4000],
                    scope=skill_seed.get("scope", "instance"),
                    scope_agent_id=skill_seed.get("scope_agent_id"),
                    status="draft",
                    provenance={
                        **dict(skill_seed.get("provenance") or {}),
                        "learning_event_id": row.id,
                    },
                    activation_conditions=dict(skill_seed.get("activation_conditions") or {}),
                    instruction_core=skill_seed.get("instruction_core") or row.explanation or row.summary,
                    metadata={
                        **dict(skill_seed.get("metadata") or {}),
                        "learning_event_id": row.id,
                    },
                ),
            )
            with self._session_factory() as session, session.begin():
                row = self._load_event(session, instance=instance, event_id=event_id)
                row.status = "applied"
                row.promoted_skill_id = created.skill_id
                row.human_override = payload.human_override or row.human_override
                row.decision_note = payload.decision_note
                row.decided_at = self._now()
        return self.get_event(instance=instance, event_id=event_id)

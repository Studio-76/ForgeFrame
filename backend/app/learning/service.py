"""Admin-facing learning-persistence and promotion service."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.agents.service import AgentAdminService
from app.instances.models import InstanceRecord
from app.knowledge.models import CreateMemory
from app.knowledge.service import KnowledgeContextAdminService
from app.learning.models import (
    CreateLearningEvent,
    DecideLearningEvent,
    LearningEventDetail,
    LearningEventSummary,
    LearningOutcomeSummary,
    LearningProposalSummary,
    LearningRiskSummary,
    LearningSourceSummary,
)
from app.skills.models import CreateSkill
from app.skills.service import SkillAdminService
from app.storage.agent_repository import AgentORM
from app.storage.conversation_repository import ConversationORM
from app.storage.execution_repository import RunORM
from app.storage.knowledge_repository import MemoryEntryORM
from app.storage.learning_repository import LearningEventORM
from app.storage.skill_repository import SkillORM

SessionFactory = Callable[[], Session]

DECISION_LABELS = {
    "discard": "Reject learning event",
    "history_only": "Approve as history only",
    "boot_memory": "Promote to boot memory",
    "durable_memory": "Promote to durable memory",
    "skill_draft": "Promote to skill draft",
    "review_required": "Require human review",
}

DECISION_SURFACES = {
    "discard": "rejection",
    "history_only": "history",
    "boot_memory": "memory",
    "durable_memory": "memory",
    "skill_draft": "skill",
    "review_required": "review",
}

DECISION_LANES = {
    "discard": ("auto_reject", "Auto reject"),
    "history_only": ("auto_suggest", "Auto suggest"),
    "boot_memory": ("auto_promote", "Auto promote"),
    "durable_memory": ("auto_promote", "Auto promote"),
    "skill_draft": ("auto_draft", "Auto draft"),
    "review_required": ("review_required", "Review required"),
}

REVIEW_BUCKET_LABELS = {
    "suggested": "Suggested",
    "review_required": "Review required",
    "approved_promoted": "Approved / promoted",
    "rejected": "Rejected",
}

MEMORY_VISIBILITY_LABELS = {
    "personal": "Personal visibility",
    "team": "Team visibility",
    "restricted": "Restricted visibility",
}

MEMORY_TRUST_LABELS = {
    "human_verified": "Human verified",
    "runtime_inferred": "Runtime inferred",
    "external_unverified": "External unverified",
}

SKILL_SCOPE_LABELS = {
    "instance": "Instance draft",
    "agent": "Agent draft",
}


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
    def _has_payload_content(payload: dict[str, Any] | None) -> bool:
        if not payload:
            return False
        for value in payload.values():
            if isinstance(value, str):
                if value.strip():
                    return True
                continue
            if isinstance(value, dict):
                if LearningAdminService._has_payload_content(value):
                    return True
                continue
            if isinstance(value, list):
                if any(item not in (None, "", {}, []) for item in value):
                    return True
                continue
            if value is not None:
                return True
        return False

    @staticmethod
    def _validate_proposal_shape(
        *,
        decision: str,
        proposed_memory: dict[str, Any],
        proposed_skill: dict[str, Any],
    ) -> None:
        has_memory = LearningAdminService._has_payload_content(proposed_memory)
        has_skill = LearningAdminService._has_payload_content(proposed_skill)
        if has_memory and has_skill:
            raise ValueError("Learning events must propose either memory or skill promotion, not both.")
        if decision in {"boot_memory", "durable_memory"} and has_skill:
            raise ValueError("Memory-promotion suggestions cannot carry a skill proposal.")
        if decision == "skill_draft" and has_memory:
            raise ValueError("Skill-draft suggestions cannot carry a memory proposal.")
        if decision in {"discard", "history_only"} and (has_memory or has_skill):
            raise ValueError("Reject/history-only learning events cannot carry promotion payloads.")

    @staticmethod
    def _validate_decision_payload(*, decision: str, memory_payload: dict[str, Any], skill_payload: dict[str, Any]) -> None:
        has_memory = LearningAdminService._has_payload_content(memory_payload)
        has_skill = LearningAdminService._has_payload_content(skill_payload)
        if decision in {"boot_memory", "durable_memory"} and has_skill:
            raise ValueError("Memory promotion cannot be decided with a skill payload.")
        if decision == "skill_draft" and has_memory:
            raise ValueError("Skill-draft promotion cannot be decided with a memory payload.")
        if decision in {"discard", "history_only", "review_required"} and (has_memory or has_skill):
            raise ValueError("Reject/history/review decisions cannot carry promotion payloads.")

    @staticmethod
    def _memory_visibility_label(value: str | None) -> str:
        return MEMORY_VISIBILITY_LABELS.get(value or "", "Team visibility")

    @staticmethod
    def _memory_trust_label(value: str | None) -> str | None:
        if not value:
            return None
        return MEMORY_TRUST_LABELS.get(value, value.replace("_", " "))

    @staticmethod
    def _skill_scope_label(value: str | None) -> str:
        return SKILL_SCOPE_LABELS.get(value or "", "Instance draft")

    @staticmethod
    def _review_bucket(row: LearningEventORM) -> tuple[str, str]:
        if row.status == "discarded":
            return "rejected", REVIEW_BUCKET_LABELS["rejected"]
        if row.status == "applied":
            return "approved_promoted", REVIEW_BUCKET_LABELS["approved_promoted"]
        if row.status == "review_required":
            return "review_required", REVIEW_BUCKET_LABELS["review_required"]
        return "suggested", REVIEW_BUCKET_LABELS["suggested"]

    @staticmethod
    def _suggested_lane(decision: str) -> tuple[str, str]:
        return DECISION_LANES.get(decision, ("review_required", "Review required"))

    def _source_summary(self, session: Session, row: LearningEventORM) -> LearningSourceSummary:
        evidence = dict(row.evidence_json or {})
        agent_row = session.get(AgentORM, row.agent_id) if row.agent_id else None
        run_row = session.get(RunORM, row.run_id) if row.run_id else None
        conversation_row = session.get(ConversationORM, row.conversation_id) if row.conversation_id else None

        details: list[str] = []
        if conversation_row is not None and conversation_row.company_id == row.company_id and conversation_row.instance_id == row.instance_id:
            details.append(f"Conversation {conversation_row.id}")
            label = f"Conversation: {conversation_row.subject or conversation_row.id}"
            kind = "conversation"
        elif run_row is not None and run_row.company_id == row.company_id:
            details.append(f"Run {run_row.id}")
            label = f"Run: {run_row.run_kind}"
            kind = "run"
        elif agent_row is not None and agent_row.company_id == row.company_id and agent_row.instance_id == row.instance_id:
            details.append(f"Agent {agent_row.id}")
            label = f"Agent: {agent_row.display_name}"
            kind = "agent"
        elif row.trigger_kind == "pattern_detected":
            title = str(evidence.get("title") or "repeated pattern")
            label = f"Pattern scan: {title}"
            kind = "pattern_scan"
        elif row.trigger_kind == "session_rotation":
            label = "Conversation session rotation"
            kind = "session_rotation"
        else:
            label = "Operator-submitted learning review"
            kind = "operator_action"

        if run_row is not None and run_row.company_id == row.company_id:
            details.append(f"{run_row.run_kind} {run_row.id}")
        if agent_row is not None and agent_row.company_id == row.company_id and agent_row.instance_id == row.instance_id:
            details.append(agent_row.display_name)
        if thread_id := evidence.get("thread_id"):
            details.append(f"thread {thread_id}")
        if session_id := evidence.get("session_id"):
            details.append(f"session {session_id}")
        if correction_count := evidence.get("correction_count"):
            details.append(f"{correction_count} repeated corrections")
        if trigger := evidence.get("trigger"):
            details.append(str(trigger))

        unique_details = list(dict.fromkeys(details))
        return LearningSourceSummary(
            kind=kind,
            label=label,
            detail=" · ".join(unique_details) if unique_details else None,
        )

    def _proposal_summary(self, row: LearningEventORM) -> LearningProposalSummary:
        memory_seed = dict(row.proposed_memory_json or {})
        skill_seed = dict(row.proposed_skill_json or {})
        decision = row.suggested_decision
        target_label = DECISION_LABELS.get(decision, decision.replace("_", " "))

        if decision in {"boot_memory", "durable_memory"}:
            title = str(memory_seed.get("title") or row.summary)
            return LearningProposalSummary(
                target_kind=decision,
                target_label=target_label,
                surface="memory",
                scope_label=self._memory_visibility_label(str(memory_seed.get("visibility_scope") or "team")),
                content_summary=title,
                trust_label=self._memory_trust_label(str(memory_seed.get("source_trust_class") or "runtime_inferred")),
            )

        if decision == "skill_draft":
            display_name = str(skill_seed.get("display_name") or row.summary)
            return LearningProposalSummary(
                target_kind="skill_draft",
                target_label=target_label,
                surface="skill",
                scope_label=self._skill_scope_label(str(skill_seed.get("scope") or "instance")),
                content_summary=display_name,
                trust_label=None,
            )

        if decision == "history_only":
            return LearningProposalSummary(
                target_kind="history_only",
                target_label=target_label,
                surface="history",
                scope_label="No persistent promotion",
                content_summary=row.summary,
                trust_label=None,
            )

        if decision == "discard":
            return LearningProposalSummary(
                target_kind="discard",
                target_label=target_label,
                surface="rejection",
                scope_label="Reject and archive",
                content_summary=row.summary,
                trust_label=None,
            )

        scope_label = "Manual review before promotion"
        content_summary = row.summary
        trust_label = None
        if self._has_payload_content(memory_seed):
            scope_label = self._memory_visibility_label(str(memory_seed.get("visibility_scope") or "team"))
            content_summary = str(memory_seed.get("title") or row.summary)
            trust_label = self._memory_trust_label(str(memory_seed.get("source_trust_class") or "runtime_inferred"))
        elif self._has_payload_content(skill_seed):
            scope_label = self._skill_scope_label(str(skill_seed.get("scope") or "instance"))
            content_summary = str(skill_seed.get("display_name") or row.summary)

        return LearningProposalSummary(
            target_kind="review_required",
            target_label=target_label,
            surface="review",
            scope_label=scope_label,
            content_summary=content_summary,
            trust_label=trust_label,
        )

    def _resolved_decision(self, session: Session, row: LearningEventORM) -> tuple[str | None, str | None]:
        if row.status == "discarded":
            return "discard", "Reject and archive"
        if row.status == "review_required":
            return "review_required", "Manual review before promotion"
        if row.promoted_skill_id:
            skill_row = session.get(SkillORM, row.promoted_skill_id)
            scope = skill_row.scope if skill_row is not None and skill_row.company_id == row.company_id else "instance"
            return "skill_draft", self._skill_scope_label(scope)
        if row.promoted_memory_id:
            memory_row = session.get(MemoryEntryORM, row.promoted_memory_id)
            if memory_row is not None and memory_row.company_id == row.company_id:
                memory_tier = str((memory_row.metadata_json or {}).get("memory_tier") or "")
                decision = "boot_memory" if memory_tier == "boot" else "durable_memory"
                return decision, self._memory_visibility_label(memory_row.visibility_scope)
            if row.suggested_decision in {"boot_memory", "durable_memory"}:
                return row.suggested_decision, self._memory_visibility_label(None)
        if row.status == "applied":
            return "history_only", "No persistent promotion"
        return None, None

    def _outcome_summary(self, session: Session, row: LearningEventORM) -> LearningOutcomeSummary:
        decision, scope_label = self._resolved_decision(session, row)
        if decision is None:
            return LearningOutcomeSummary(
                target_kind=None,
                target_label="Pending operator decision",
                surface="pending",
                scope_label=None,
            )
        return LearningOutcomeSummary(
            target_kind=decision,
            target_label=DECISION_LABELS.get(decision, decision.replace("_", " ")),
            surface=DECISION_SURFACES.get(decision, "review"),
            scope_label=scope_label,
        )

    def _risk_summary(self, row: LearningEventORM) -> LearningRiskSummary:
        decision = row.suggested_decision
        memory_seed = dict(row.proposed_memory_json or {})
        skill_seed = dict(row.proposed_skill_json or {})
        reasons: list[str] = []
        high_risk = False
        medium_risk = False

        if decision == "durable_memory":
            reasons.append("Suggested durable promotion would change long-term memory truth.")
            high_risk = True
        elif decision == "boot_memory":
            reasons.append("Suggested boot promotion would persist startup context.")
            medium_risk = True
        elif decision == "skill_draft":
            reasons.append("Suggested skill draft could alter future agent behavior.")
            medium_risk = True

        if str(memory_seed.get("visibility_scope") or "") == "restricted":
            reasons.append("Proposed memory is restricted in visibility.")
            high_risk = True
        if str(memory_seed.get("sensitivity") or "") in {"sensitive", "restricted"}:
            reasons.append("Proposed memory carries elevated sensitivity.")
            high_risk = True
        if str(memory_seed.get("source_trust_class") or "") in {
            "runtime_inferred",
            "external_unverified",
        } and decision in {"boot_memory", "durable_memory"}:
            reasons.append("Proposed memory relies on inferred or unverified source trust.")
            medium_risk = True
        if str(skill_seed.get("scope") or "") == "agent":
            reasons.append("Proposed skill targets a specific agent execution path.")
            high_risk = True
        if row.status in {"pending", "review_required"} or decision == "review_required":
            reasons.append("Operator review is still required before safe promotion.")
            medium_risk = True
        if row.human_override:
            reasons.append("A human override changed the default learning path.")
            medium_risk = True
        if not row.explanation.strip():
            reasons.append("No explanation was recorded for this learning event.")
            medium_risk = True
        if not dict(row.evidence_json or {}):
            reasons.append("No structured evidence was recorded.")
            medium_risk = True

        if not reasons:
            return LearningRiskSummary(
                level="low",
                reasons=["Explainability payload and promotion path are low risk."],
            )
        if high_risk:
            return LearningRiskSummary(level="high", reasons=reasons)
        if medium_risk:
            return LearningRiskSummary(level="medium", reasons=reasons)
        return LearningRiskSummary(level="low", reasons=reasons)

    def _summary(self, session: Session, row: LearningEventORM) -> LearningEventSummary:
        review_bucket, review_bucket_label = self._review_bucket(row)
        suggested_lane, suggested_lane_label = self._suggested_lane(row.suggested_decision)
        return LearningEventSummary(
            learning_event_id=row.id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            trigger_kind=row.trigger_kind,
            suggested_decision=row.suggested_decision,
            status=row.status,
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
            review_bucket=review_bucket,
            review_bucket_label=review_bucket_label,
            suggested_lane=suggested_lane,
            suggested_lane_label=suggested_lane_label,
            source=self._source_summary(session, row),
            proposal=self._proposal_summary(row),
            outcome=self._outcome_summary(session, row),
            risk=self._risk_summary(row),
            created_at=row.created_at,
            decided_at=row.decided_at,
        )

    def _detail(self, session: Session, row: LearningEventORM) -> LearningEventDetail:
        summary = self._summary(session, row)
        agent = None
        if row.agent_id:
            agent_row = session.get(AgentORM, row.agent_id)
            if agent_row is not None and agent_row.company_id == row.company_id and agent_row.instance_id == row.instance_id:
                agent = {
                    "record_id": agent_row.id,
                    "label": agent_row.display_name,
                    "status": agent_row.status,
                }
        conversation = None
        if row.conversation_id:
            conversation_row = session.get(ConversationORM, row.conversation_id)
            if conversation_row is not None and conversation_row.company_id == row.company_id and conversation_row.instance_id == row.instance_id:
                conversation = {
                    "record_id": conversation_row.id,
                    "label": conversation_row.subject,
                    "status": conversation_row.status,
                }
        run = None
        if row.run_id:
            run_row = session.get(RunORM, row.run_id)
            if run_row is not None and run_row.company_id == row.company_id:
                run = {
                    "record_id": run_row.id,
                    "label": run_row.run_kind,
                    "status": run_row.lifecycle_status,
                }
        promoted_memory = None
        if row.promoted_memory_id:
            memory_row = session.get(MemoryEntryORM, row.promoted_memory_id)
            if memory_row is not None and memory_row.company_id == row.company_id:
                promoted_memory = {
                    "record_id": memory_row.id,
                    "label": memory_row.title,
                    "status": memory_row.truth_state,
                }
        promoted_skill = None
        if row.promoted_skill_id:
            skill_row = session.get(SkillORM, row.promoted_skill_id)
            if skill_row is not None and skill_row.company_id == row.company_id:
                promoted_skill = {
                    "record_id": skill_row.id,
                    "label": skill_row.display_name,
                    "status": skill_row.status,
                }
        return LearningEventDetail(
            **summary.model_dump(),
            agent=agent,
            run=run,
            conversation=conversation,
            promoted_memory=promoted_memory,
            promoted_skill=promoted_skill,
        )

    def list_events(
        self,
        *,
        instance: InstanceRecord,
        status: str | None = None,
        trigger_kind: str | None = None,
        limit: int = 100,
    ) -> list[LearningEventSummary]:
        with self._session_factory() as session:
            stmt = select(LearningEventORM).where(
                LearningEventORM.company_id == instance.company_id,
                LearningEventORM.instance_id == instance.instance_id,
            )
            if status is not None:
                stmt = stmt.where(LearningEventORM.status == status)
            if trigger_kind is not None:
                stmt = stmt.where(LearningEventORM.trigger_kind == trigger_kind)
            rows = session.execute(stmt.order_by(LearningEventORM.created_at.desc()).limit(max(1, min(limit, 200)))).scalars().all()
            return [self._summary(session, row) for row in rows]

    def get_event(self, *, instance: InstanceRecord, event_id: str) -> LearningEventDetail:
        with self._session_factory() as session:
            row = self._load_event(session, instance=instance, event_id=event_id)
            return self._detail(session, row)

    def create_event(self, *, instance: InstanceRecord, payload: CreateLearningEvent) -> LearningEventDetail:
        summary = payload.summary.strip()
        explanation = payload.explanation.strip()
        proposed_memory = dict(payload.proposed_memory)
        proposed_skill = dict(payload.proposed_skill)
        self._validate_proposal_shape(
            decision=payload.suggested_decision,
            proposed_memory=proposed_memory,
            proposed_skill=proposed_skill,
        )
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
                    summary=summary,
                    explanation=explanation,
                    agent_id=payload.agent_id,
                    run_id=payload.run_id,
                    conversation_id=payload.conversation_id,
                    evidence_json=dict(payload.evidence),
                    proposed_memory_json=proposed_memory,
                    proposed_skill_json=proposed_skill,
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
                exists = (
                    session
                    .execute(
                        select(LearningEventORM).where(
                            LearningEventORM.company_id == instance.company_id,
                            LearningEventORM.instance_id == instance.instance_id,
                            LearningEventORM.trigger_kind == "pattern_detected",
                            LearningEventORM.summary == f"Repeated correction pattern: {title}",
                            LearningEventORM.status.in_(("pending", "review_required")),
                        )
                    )
                    .scalars()
                    .first()
                )
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
                        proposed_skill_json={
                            "display_name": title,
                            "summary": "Skill draft suggested from repeated memory corrections.",
                        },
                        created_at=self._now(),
                    )
                )
                created_event_ids.append(event_id)
        return [self.get_event(instance=instance, event_id=event_id) for event_id in created_event_ids]

    def decide_event(self, *, instance: InstanceRecord, event_id: str, payload: DecideLearningEvent) -> LearningEventDetail:
        self._validate_decision_payload(
            decision=payload.decision,
            memory_payload=dict(payload.memory_payload),
            skill_payload=dict(payload.skill_payload),
        )
        with self._session_factory() as session:
            row = self._load_event(session, instance=instance, event_id=event_id)
            if row.status not in {"pending", "review_required"}:
                raise ValueError("Only pending learning events can be decided.")
            suggested_decision = row.suggested_decision
            proposed_memory_seed = dict(row.proposed_memory_json or {})
            proposed_skill_seed = dict(row.proposed_skill_json or {})

        effective_override = payload.human_override or payload.decision != suggested_decision

        if payload.decision == "discard":
            with self._session_factory() as session, session.begin():
                row = self._load_event(session, instance=instance, event_id=event_id)
                if row.status not in {"pending", "review_required"}:
                    raise ValueError("Only pending learning events can be decided.")
                row.status = "discarded"
                row.human_override = effective_override
                row.decision_note = payload.decision_note
                row.decided_at = self._now()
        elif payload.decision == "history_only":
            with self._session_factory() as session, session.begin():
                row = self._load_event(session, instance=instance, event_id=event_id)
                if row.status not in {"pending", "review_required"}:
                    raise ValueError("Only pending learning events can be decided.")
                row.status = "applied"
                row.human_override = effective_override
                row.decision_note = payload.decision_note
                row.decided_at = self._now()
        elif payload.decision == "review_required":
            with self._session_factory() as session, session.begin():
                row = self._load_event(session, instance=instance, event_id=event_id)
                if row.status not in {"pending", "review_required"}:
                    raise ValueError("Only pending learning events can be decided.")
                row.status = "review_required"
                row.human_override = effective_override
                row.decision_note = payload.decision_note
                row.decided_at = self._now()
        elif payload.decision in {"boot_memory", "durable_memory"}:
            memory_seed = proposed_memory_seed
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
                if row.status not in {"pending", "review_required"}:
                    raise ValueError("Only pending learning events can be decided.")
                row.status = "applied"
                row.promoted_memory_id = created.memory_id
                row.human_override = effective_override
                row.decision_note = payload.decision_note
                row.decided_at = self._now()
        elif payload.decision == "skill_draft":
            skill_seed = proposed_skill_seed
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
                if row.status not in {"pending", "review_required"}:
                    raise ValueError("Only pending learning events can be decided.")
                row.status = "applied"
                row.promoted_skill_id = created.skill_id
                row.human_override = effective_override
                row.decision_note = payload.decision_note
                row.decided_at = self._now()
        return self.get_event(instance=instance, event_id=event_id)

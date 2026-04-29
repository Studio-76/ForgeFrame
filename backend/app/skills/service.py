"""Admin-facing skills-system service."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.instances.models import InstanceRecord
from app.knowledge.models import RecordLink
from app.skills.models import (
    ActivateSkillVersion,
    CreateSkill,
    RecordSkillUsage,
    SkillApprovalSummary,
    SkillActivationRecord,
    SkillDetail,
    SkillProvenanceSummary,
    SkillSummary,
    SkillTelemetrySummary,
    SkillUsageEventRecord,
    SkillVersionRecord,
    UpdateSkill,
)
from app.storage.agent_repository import AgentORM
from app.storage.skill_repository import SkillActivationORM, SkillORM, SkillUsageEventORM, SkillVersionORM

SessionFactory = Callable[[], Session]


class SkillAdminService:
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

    def _load_agent(self, session: Session, *, instance: InstanceRecord, agent_id: str) -> AgentORM:
        row = session.get(AgentORM, agent_id)
        if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
            raise ValueError(f"Agent '{agent_id}' was not found.")
        return row

    def _validate_scope(self, session: Session, *, instance: InstanceRecord, scope: str, scope_agent_id: str | None) -> None:
        if scope == "agent":
            if not scope_agent_id:
                raise ValueError("Agent-scoped skills require a scope agent.")
            self._load_agent(session, instance=instance, agent_id=scope_agent_id)
            return
        if scope_agent_id:
            raise ValueError("Instance-scoped skills cannot pin a scope agent.")

    def _load_skill(self, session: Session, *, instance: InstanceRecord, skill_id: str) -> SkillORM:
        row = session.get(SkillORM, skill_id)
        if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
            raise ValueError(f"Skill '{skill_id}' was not found.")
        return row

    @staticmethod
    def _scope_label(scope: str, scope_agent_label: str | None = None) -> str:
        if scope == "agent":
            return f"Agent scope · {scope_agent_label or 'agent required'}"
        return "Instance scope"

    @staticmethod
    def _approval_summary(status: str) -> SkillApprovalSummary:
        if status == "draft":
            return SkillApprovalSummary(
                posture="draft",
                label="Draft registry entry",
                note="Draft skills are registered but not yet approved for activation.",
            )
        if status == "review":
            return SkillApprovalSummary(
                posture="review_required",
                label="Review required",
                note="This skill is waiting for approval or operator review before active use.",
            )
        if status == "archived":
            return SkillApprovalSummary(
                posture="archived",
                label="Archived",
                note="Archiving keeps versions and telemetry but removes the skill from active use.",
            )
        return SkillApprovalSummary(
            posture="approved",
            label="Approved / active",
            note="This skill has cleared review and currently participates in activation state.",
        )

    @staticmethod
    def _provenance_summary(provenance: dict[str, object]) -> SkillProvenanceSummary:
        if learning_event_id := provenance.get("learning_event_id"):
            return SkillProvenanceSummary(
                kind="learning",
                label="Promoted from learning",
                detail=f"learning event {learning_event_id}",
            )
        if memory_id := provenance.get("memory_id"):
            return SkillProvenanceSummary(
                kind="memory",
                label="Derived from memory",
                detail=f"memory {memory_id}",
            )
        if source_id := provenance.get("source_id"):
            return SkillProvenanceSummary(
                kind="knowledge_source",
                label="Backed by knowledge source",
                detail=f"source {source_id}",
            )
        if plugin_id := provenance.get("plugin_id") or provenance.get("plugin_name"):
            return SkillProvenanceSummary(
                kind="plugin",
                label="Plugin-managed",
                detail=str(plugin_id),
            )
        if source := provenance.get("source"):
            if str(source) == "operator":
                return SkillProvenanceSummary(
                    kind="operator",
                    label="Operator-authored",
                    detail="Manual registry entry",
                )
            return SkillProvenanceSummary(
                kind="unknown",
                label="External provenance",
                detail=str(source),
            )
        return SkillProvenanceSummary(
            kind="unknown",
            label="Registry entry",
            detail="No explicit plugin, harness, target, or learning provenance was recorded.",
        )

    @staticmethod
    def _telemetry_summary(telemetry: dict[str, object]) -> SkillTelemetrySummary:
        last_outcome = telemetry.get("last_outcome")
        return SkillTelemetrySummary(
            usage_count=int(telemetry.get("usage_count", 0) or 0),
            last_outcome=last_outcome if last_outcome in {"success", "blocked", "error"} else None,
            success_count=int(telemetry.get("success_count", 0) or 0),
            blocked_count=int(telemetry.get("blocked_count", 0) or 0),
            error_count=int(telemetry.get("error_count", 0) or 0),
        )

    def _active_scope_labels(self, session: Session, row: SkillORM) -> list[str]:
        labels: list[str] = []
        active_rows = session.execute(
            select(SkillActivationORM).where(
                SkillActivationORM.company_id == row.company_id,
                SkillActivationORM.skill_id == row.id,
                SkillActivationORM.status == "active",
            ).order_by(SkillActivationORM.activated_at.desc())
        ).scalars().all()
        for activation in active_rows:
            agent_label = None
            if activation.scope_agent_id:
                agent = session.get(AgentORM, activation.scope_agent_id)
                if agent is not None and agent.company_id == row.company_id and agent.instance_id == row.instance_id:
                    agent_label = agent.display_name
            labels.append(self._scope_label(activation.scope, agent_label))
        return list(dict.fromkeys(labels))

    def _load_version(self, session: Session, *, instance: InstanceRecord, version_id: str) -> SkillVersionORM:
        row = session.get(SkillVersionORM, version_id)
        if row is None or row.company_id != instance.company_id or row.instance_id != instance.instance_id:
            raise ValueError(f"Skill version '{version_id}' was not found.")
        return row

    def _summary(self, session: Session, row: SkillORM) -> SkillSummary:
        active_activation_count = int(
            session.scalar(
                select(func.count()).select_from(SkillActivationORM).where(
                    SkillActivationORM.company_id == row.company_id,
                    SkillActivationORM.skill_id == row.id,
                    SkillActivationORM.status == "active",
                )
            )
            or 0,
        )
        scope_agent_label = None
        if row.scope_agent_id:
            scope_agent = session.get(AgentORM, row.scope_agent_id)
            if scope_agent is not None and scope_agent.company_id == row.company_id and scope_agent.instance_id == row.instance_id:
                scope_agent_label = scope_agent.display_name
        telemetry = dict(row.telemetry_json or {})
        provenance = dict(row.provenance_json or {})
        return SkillSummary(
            skill_id=row.id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            display_name=row.display_name,
            summary=row.summary,
            scope=row.scope,  # type: ignore[arg-type]
            scope_label=self._scope_label(row.scope, scope_agent_label),
            scope_agent_id=row.scope_agent_id,
            current_version_number=row.current_version_number,
            status=row.status,  # type: ignore[arg-type]
            approval=self._approval_summary(row.status),
            provenance=provenance,
            provenance_summary=self._provenance_summary(provenance),
            activation_conditions=dict(row.activation_conditions_json or {}),
            instruction_core=row.instruction_core,
            telemetry=telemetry,
            telemetry_summary=self._telemetry_summary(telemetry),
            metadata=dict(row.metadata_json or {}),
            last_used_at=row.last_used_at,
            active_activation_count=active_activation_count,
            active_scope_labels=self._active_scope_labels(session, row),
            last_outcome=telemetry.get("last_outcome") if telemetry.get("last_outcome") in {"success", "blocked", "error"} else None,  # type: ignore[arg-type]
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    @staticmethod
    def _version_record(row: SkillVersionORM) -> SkillVersionRecord:
        return SkillVersionRecord(
            version_id=row.id,
            skill_id=row.skill_id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            version_number=row.version_number,
            status=row.status,  # type: ignore[arg-type]
            summary=row.summary,
            instruction_core=row.instruction_core,
            provenance=dict(row.provenance_json or {}),
            activation_conditions=dict(row.activation_conditions_json or {}),
            metadata=dict(row.metadata_json or {}),
            created_at=row.created_at,
        )

    @staticmethod
    def _activation_record(row: SkillActivationORM, scope_label: str) -> SkillActivationRecord:
        return SkillActivationRecord(
            activation_id=row.id,
            skill_id=row.skill_id,
            version_id=row.version_id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            scope=row.scope,  # type: ignore[arg-type]
            scope_label=scope_label,
            scope_agent_id=row.scope_agent_id,
            status=row.status,  # type: ignore[arg-type]
            activation_conditions=dict(row.activation_conditions_json or {}),
            activated_by_type=row.activated_by_type,
            activated_by_id=row.activated_by_id,
            activated_at=row.activated_at,
            deactivated_at=row.deactivated_at,
            metadata=dict(row.metadata_json or {}),
        )

    @staticmethod
    def _usage_record(row: SkillUsageEventORM, version_number: int | None) -> SkillUsageEventRecord:
        return SkillUsageEventRecord(
            usage_event_id=row.id,
            skill_id=row.skill_id,
            version_id=row.version_id,
            version_number=version_number,
            activation_id=row.activation_id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            agent_id=row.agent_id,
            run_id=row.run_id,
            conversation_id=row.conversation_id,
            outcome=row.outcome,  # type: ignore[arg-type]
            details=dict(row.details_json or {}),
            created_at=row.created_at,
        )

    def _detail(self, session: Session, row: SkillORM) -> SkillDetail:
        summary = self._summary(session, row)
        versions = session.execute(
            select(SkillVersionORM).where(
                SkillVersionORM.company_id == row.company_id,
                SkillVersionORM.skill_id == row.id,
            ).order_by(SkillVersionORM.version_number.desc())
        ).scalars().all()
        activations = session.execute(
            select(SkillActivationORM).where(
                SkillActivationORM.company_id == row.company_id,
                SkillActivationORM.skill_id == row.id,
            ).order_by(SkillActivationORM.activated_at.desc())
        ).scalars().all()
        usage_rows = session.execute(
            select(SkillUsageEventORM).where(
                SkillUsageEventORM.company_id == row.company_id,
                SkillUsageEventORM.skill_id == row.id,
            ).order_by(SkillUsageEventORM.created_at.desc()).limit(25)
        ).scalars().all()
        versions_by_id = {item.id: item for item in versions}
        scope_agent = None
        if row.scope_agent_id:
            agent = session.get(AgentORM, row.scope_agent_id)
            if agent is not None and agent.company_id == row.company_id and agent.instance_id == row.instance_id:
                scope_agent = self._record_link(agent.id, agent.display_name, agent.status)
        activation_records: list[SkillActivationRecord] = []
        for item in activations:
            agent_label = None
            if item.scope_agent_id:
                agent = session.get(AgentORM, item.scope_agent_id)
                if agent is not None and agent.company_id == row.company_id and agent.instance_id == row.instance_id:
                    agent_label = agent.display_name
            activation_records.append(self._activation_record(item, self._scope_label(item.scope, agent_label)))
        return SkillDetail(
            **summary.model_dump(),
            scope_agent=scope_agent,
            versions=[self._version_record(item) for item in versions],
            activations=activation_records,
            recent_usage=[self._usage_record(item, versions_by_id.get(item.version_id).version_number if versions_by_id.get(item.version_id) is not None else None) for item in usage_rows],
        )

    def list_skills(self, *, instance: InstanceRecord, status: str | None = None, scope: str | None = None, limit: int = 100) -> list[SkillSummary]:
        with self._session_factory() as session:
            stmt = select(SkillORM).where(
                SkillORM.company_id == instance.company_id,
                SkillORM.instance_id == instance.instance_id,
            )
            if status is not None:
                stmt = stmt.where(SkillORM.status == status)
            if scope is not None:
                stmt = stmt.where(SkillORM.scope == scope)
            rows = session.execute(
                stmt.order_by(SkillORM.updated_at.desc()).limit(max(1, min(limit, 200)))
            ).scalars().all()
            return [self._summary(session, row) for row in rows]

    def get_skill(self, *, instance: InstanceRecord, skill_id: str) -> SkillDetail:
        with self._session_factory() as session:
            row = self._load_skill(session, instance=instance, skill_id=skill_id)
            return self._detail(session, row)

    def _create_version_from_skill(self, session: Session, row: SkillORM, *, version_number: int | None = None) -> SkillVersionORM:
        version = SkillVersionORM(
            id=self._new_id("skillver"),
            skill_id=row.id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            version_number=version_number or row.current_version_number,
            status=row.status,
            summary=row.summary,
            instruction_core=row.instruction_core,
            provenance_json=dict(row.provenance_json or {}),
            activation_conditions_json=dict(row.activation_conditions_json or {}),
            metadata_json=dict(row.metadata_json or {}),
            created_at=self._now(),
        )
        session.add(version)
        return version

    def create_skill(self, *, instance: InstanceRecord, payload: CreateSkill) -> SkillDetail:
        with self._session_factory() as session, session.begin():
            self._validate_scope(session, instance=instance, scope=payload.scope, scope_agent_id=payload.scope_agent_id)
            skill_id = (payload.skill_id or "").strip() or self._new_id("skill")
            existing = session.get(SkillORM, skill_id)
            if existing is not None and existing.company_id == instance.company_id:
                raise ValueError(f"Skill '{skill_id}' already exists.")
            row = SkillORM(
                id=skill_id,
                instance_id=instance.instance_id,
                company_id=instance.company_id,
                display_name=payload.display_name.strip(),
                summary=payload.summary.strip(),
                scope=payload.scope,
                scope_agent_id=payload.scope_agent_id,
                current_version_number=1,
                status=payload.status,
                provenance_json=dict(payload.provenance),
                activation_conditions_json=dict(payload.activation_conditions),
                instruction_core=payload.instruction_core.strip(),
                telemetry_json={},
                metadata_json=dict(payload.metadata),
                created_at=self._now(),
                updated_at=self._now(),
            )
            session.add(row)
            self._create_version_from_skill(session, row)
        return self.get_skill(instance=instance, skill_id=skill_id)

    def update_skill(self, *, instance: InstanceRecord, skill_id: str, payload: UpdateSkill) -> SkillDetail:
        with self._session_factory() as session, session.begin():
            row = self._load_skill(session, instance=instance, skill_id=skill_id)
            next_scope = payload.scope or row.scope
            scope_agent_set = "scope_agent_id" in payload.model_fields_set
            next_scope_agent_id = payload.scope_agent_id if scope_agent_set else row.scope_agent_id
            self._validate_scope(session, instance=instance, scope=next_scope, scope_agent_id=next_scope_agent_id)
            versioned_change = (
                payload.summary is not None
                or payload.provenance is not None
                or payload.activation_conditions is not None
                or payload.instruction_core is not None
                or payload.status is not None
            )
            row.display_name = payload.display_name.strip() if payload.display_name is not None else row.display_name
            row.scope = next_scope
            row.scope_agent_id = next_scope_agent_id
            if payload.summary is not None:
                row.summary = payload.summary.strip()
            if payload.status is not None:
                row.status = payload.status
            if payload.provenance is not None:
                row.provenance_json = dict(payload.provenance)
            if payload.activation_conditions is not None:
                row.activation_conditions_json = dict(payload.activation_conditions)
            if payload.instruction_core is not None:
                row.instruction_core = payload.instruction_core.strip()
            if payload.metadata is not None:
                row.metadata_json = dict(payload.metadata)
            if versioned_change:
                row.current_version_number += 1
                self._create_version_from_skill(session, row, version_number=row.current_version_number)
            row.updated_at = self._now()
        return self.get_skill(instance=instance, skill_id=skill_id)

    def activate_skill(self, *, instance: InstanceRecord, skill_id: str, payload: ActivateSkillVersion, actor_type: str, actor_id: str | None) -> SkillDetail:
        with self._session_factory() as session, session.begin():
            row = self._load_skill(session, instance=instance, skill_id=skill_id)
            version: SkillVersionORM
            if payload.version_id:
                version = self._load_version(session, instance=instance, version_id=payload.version_id)
                if version.skill_id != row.id:
                    raise ValueError(f"Skill version '{payload.version_id}' does not belong to skill '{skill_id}'.")
            else:
                version = session.execute(
                    select(SkillVersionORM).where(
                        SkillVersionORM.company_id == instance.company_id,
                        SkillVersionORM.skill_id == row.id,
                        SkillVersionORM.version_number == row.current_version_number,
                    )
                ).scalars().one()
            scope = payload.scope or row.scope
            scope_agent_id = payload.scope_agent_id if payload.scope_agent_id is not None else row.scope_agent_id
            self._validate_scope(session, instance=instance, scope=scope, scope_agent_id=scope_agent_id)
            for activation in session.execute(
                select(SkillActivationORM).where(
                    SkillActivationORM.company_id == instance.company_id,
                    SkillActivationORM.skill_id == row.id,
                    SkillActivationORM.status == "active",
                )
            ).scalars().all():
                activation.status = "inactive"
                activation.deactivated_at = self._now()
            session.add(
                SkillActivationORM(
                    id=self._new_id("skillact"),
                    skill_id=row.id,
                    version_id=version.id,
                    instance_id=row.instance_id,
                    company_id=row.company_id,
                    scope=scope,
                    scope_agent_id=scope_agent_id,
                    status="active",
                    activation_conditions_json=dict(payload.activation_conditions),
                    activated_by_type=actor_type,
                    activated_by_id=actor_id,
                    activated_at=self._now(),
                    metadata_json=dict(payload.metadata),
                )
            )
            row.status = "active"
            row.updated_at = self._now()
        return self.get_skill(instance=instance, skill_id=skill_id)

    def archive_skill(self, *, instance: InstanceRecord, skill_id: str) -> SkillDetail:
        with self._session_factory() as session, session.begin():
            row = self._load_skill(session, instance=instance, skill_id=skill_id)
            row.status = "archived"
            row.updated_at = self._now()
            for activation in session.execute(
                select(SkillActivationORM).where(
                    SkillActivationORM.company_id == instance.company_id,
                    SkillActivationORM.skill_id == row.id,
                    SkillActivationORM.status == "active",
                )
            ).scalars().all():
                activation.status = "archived"
                activation.deactivated_at = self._now()
        return self.get_skill(instance=instance, skill_id=skill_id)

    def record_usage(self, *, instance: InstanceRecord, skill_id: str, payload: RecordSkillUsage) -> SkillDetail:
        with self._session_factory() as session, session.begin():
            row = self._load_skill(session, instance=instance, skill_id=skill_id)
            version = (
                self._load_version(session, instance=instance, version_id=payload.version_id)
                if payload.version_id
                else session.execute(
                    select(SkillVersionORM).where(
                        SkillVersionORM.company_id == instance.company_id,
                        SkillVersionORM.skill_id == row.id,
                        SkillVersionORM.version_number == row.current_version_number,
                    )
                ).scalars().one()
            )
            if version.skill_id != row.id:
                raise ValueError(f"Skill version '{version.id}' does not belong to skill '{skill_id}'.")
            if payload.agent_id:
                self._load_agent(session, instance=instance, agent_id=payload.agent_id)
                if row.scope == "agent" and row.scope_agent_id and payload.agent_id != row.scope_agent_id:
                    raise ValueError("Agent-scoped skill usage must stay within the scoped agent.")
            session.add(
                SkillUsageEventORM(
                    id=self._new_id("skilluse"),
                    skill_id=row.id,
                    version_id=version.id,
                    activation_id=payload.activation_id,
                    instance_id=row.instance_id,
                    company_id=row.company_id,
                    agent_id=payload.agent_id,
                    run_id=payload.run_id,
                    conversation_id=payload.conversation_id,
                    outcome=payload.outcome,
                    details_json=dict(payload.details),
                    created_at=self._now(),
                )
            )
            telemetry = dict(row.telemetry_json or {})
            telemetry["usage_count"] = int(telemetry.get("usage_count", 0)) + 1
            telemetry["last_outcome"] = payload.outcome
            outcome_key = f"{payload.outcome}_count"
            telemetry[outcome_key] = int(telemetry.get(outcome_key, 0)) + 1
            row.telemetry_json = telemetry
            row.last_used_at = self._now()
            row.updated_at = self._now()
        return self.get_skill(instance=instance, skill_id=skill_id)

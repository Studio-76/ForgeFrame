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
    SkillActivationRecord,
    SkillDetail,
    SkillSummary,
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
        return SkillSummary(
            skill_id=row.id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            display_name=row.display_name,
            summary=row.summary,
            scope=row.scope,  # type: ignore[arg-type]
            scope_agent_id=row.scope_agent_id,
            current_version_number=row.current_version_number,
            status=row.status,  # type: ignore[arg-type]
            provenance=dict(row.provenance_json or {}),
            activation_conditions=dict(row.activation_conditions_json or {}),
            instruction_core=row.instruction_core,
            telemetry=dict(row.telemetry_json or {}),
            metadata=dict(row.metadata_json or {}),
            last_used_at=row.last_used_at,
            active_activation_count=active_activation_count,
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
    def _activation_record(row: SkillActivationORM) -> SkillActivationRecord:
        return SkillActivationRecord(
            activation_id=row.id,
            skill_id=row.skill_id,
            version_id=row.version_id,
            instance_id=row.instance_id,
            company_id=row.company_id,
            scope=row.scope,  # type: ignore[arg-type]
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
    def _usage_record(row: SkillUsageEventORM) -> SkillUsageEventRecord:
        return SkillUsageEventRecord(
            usage_event_id=row.id,
            skill_id=row.skill_id,
            version_id=row.version_id,
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
        scope_agent = None
        if row.scope_agent_id:
            agent = session.get(AgentORM, row.scope_agent_id)
            if agent is not None and agent.company_id == row.company_id and agent.instance_id == row.instance_id:
                scope_agent = self._record_link(agent.id, agent.display_name, agent.status)
        return SkillDetail(
            **summary.model_dump(),
            scope_agent=scope_agent,
            versions=[self._version_record(item) for item in versions],
            activations=[self._activation_record(item) for item in activations],
            recent_usage=[self._usage_record(item) for item in usage_rows],
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
            next_scope_agent_id = payload.scope_agent_id if payload.scope_agent_id is not None else row.scope_agent_id
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
            row.telemetry_json = telemetry
            row.last_used_at = self._now()
            row.updated_at = self._now()
        return self.get_skill(instance=instance, skill_id=skill_id)

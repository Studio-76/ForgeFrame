"""Versioned skills-system contracts."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.knowledge.models import RecordLink


SKILL_SCOPES = ("instance", "agent")
SkillScope = Literal["instance", "agent"]

SKILL_STATUSES = ("draft", "review", "active", "archived")
SkillStatus = Literal["draft", "review", "active", "archived"]

SKILL_ACTIVATION_STATUSES = ("active", "inactive", "archived")
SkillActivationStatus = Literal["active", "inactive", "archived"]

SKILL_USAGE_OUTCOMES = ("success", "blocked", "error")
SkillUsageOutcome = Literal["success", "blocked", "error"]


class SkillVersionRecord(BaseModel):
    version_id: str
    skill_id: str
    instance_id: str
    company_id: str
    version_number: int
    status: SkillStatus
    summary: str
    instruction_core: str
    provenance: dict[str, Any] = Field(default_factory=dict)
    activation_conditions: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class SkillActivationRecord(BaseModel):
    activation_id: str
    skill_id: str
    version_id: str
    instance_id: str
    company_id: str
    scope: SkillScope
    scope_agent_id: str | None = None
    status: SkillActivationStatus
    activation_conditions: dict[str, Any] = Field(default_factory=dict)
    activated_by_type: str
    activated_by_id: str | None = None
    activated_at: datetime
    deactivated_at: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class SkillUsageEventRecord(BaseModel):
    usage_event_id: str
    skill_id: str
    version_id: str
    activation_id: str | None = None
    instance_id: str
    company_id: str
    agent_id: str | None = None
    run_id: str | None = None
    conversation_id: str | None = None
    outcome: SkillUsageOutcome
    details: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class SkillSummary(BaseModel):
    skill_id: str
    instance_id: str
    company_id: str
    display_name: str
    summary: str
    scope: SkillScope
    scope_agent_id: str | None = None
    current_version_number: int
    status: SkillStatus
    provenance: dict[str, Any] = Field(default_factory=dict)
    activation_conditions: dict[str, Any] = Field(default_factory=dict)
    instruction_core: str
    telemetry: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
    last_used_at: datetime | None = None
    active_activation_count: int = 0
    created_at: datetime
    updated_at: datetime


class SkillDetail(SkillSummary):
    scope_agent: RecordLink | None = None
    versions: list[SkillVersionRecord] = Field(default_factory=list)
    activations: list[SkillActivationRecord] = Field(default_factory=list)
    recent_usage: list[SkillUsageEventRecord] = Field(default_factory=list)


class CreateSkill(BaseModel):
    skill_id: str | None = Field(default=None, min_length=1, max_length=64)
    display_name: str = Field(min_length=1, max_length=191)
    summary: str = Field(default="", max_length=4000)
    scope: SkillScope = "instance"
    scope_agent_id: str | None = Field(default=None, max_length=64)
    status: SkillStatus = "draft"
    provenance: dict[str, Any] = Field(default_factory=dict)
    activation_conditions: dict[str, Any] = Field(default_factory=dict)
    instruction_core: str = Field(min_length=1, max_length=16000)
    metadata: dict[str, Any] = Field(default_factory=dict)


class UpdateSkill(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=191)
    summary: str | None = Field(default=None, max_length=4000)
    scope: SkillScope | None = None
    scope_agent_id: str | None = Field(default=None, max_length=64)
    status: SkillStatus | None = None
    provenance: dict[str, Any] | None = None
    activation_conditions: dict[str, Any] | None = None
    instruction_core: str | None = Field(default=None, min_length=1, max_length=16000)
    metadata: dict[str, Any] | None = None


class ActivateSkillVersion(BaseModel):
    version_id: str | None = Field(default=None, max_length=64)
    scope: SkillScope | None = None
    scope_agent_id: str | None = Field(default=None, max_length=64)
    activation_conditions: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class RecordSkillUsage(BaseModel):
    version_id: str | None = Field(default=None, max_length=64)
    activation_id: str | None = Field(default=None, max_length=64)
    agent_id: str | None = Field(default=None, max_length=64)
    run_id: str | None = Field(default=None, max_length=64)
    conversation_id: str | None = Field(default=None, max_length=64)
    outcome: SkillUsageOutcome
    details: dict[str, Any] = Field(default_factory=dict)

"""Instance-scoped agent contracts."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.knowledge.models import RecordLink


AGENT_ROLE_KINDS = ("operator", "specialist", "reviewer", "worker", "observer")
AgentRoleKind = Literal["operator", "specialist", "reviewer", "worker", "observer"]

AGENT_STATUSES = ("active", "paused", "archived")
AgentStatus = Literal["active", "paused", "archived"]

AGENT_PARTICIPATION_MODES = ("direct", "mentioned_only", "roundtable", "handoff_only")
AgentParticipationMode = Literal["direct", "mentioned_only", "roundtable", "handoff_only"]


class AgentSummary(BaseModel):
    agent_id: str
    instance_id: str
    company_id: str
    display_name: str
    default_name: str
    role_kind: AgentRoleKind
    status: AgentStatus
    participation_mode: AgentParticipationMode
    allowed_targets: list[str] = Field(default_factory=list)
    assistant_profile_id: str | None = None
    is_default_operator: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class AgentDetail(AgentSummary):
    assistant_profile: RecordLink | None = None


class CreateAgent(BaseModel):
    agent_id: str | None = Field(default=None, min_length=1, max_length=64)
    display_name: str = Field(min_length=1, max_length=191)
    default_name: str | None = Field(default=None, min_length=1, max_length=191)
    role_kind: AgentRoleKind = "specialist"
    status: AgentStatus = "active"
    participation_mode: AgentParticipationMode = "direct"
    allowed_targets: list[str] = Field(default_factory=list)
    assistant_profile_id: str | None = Field(default=None, max_length=64)
    is_default_operator: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)


class UpdateAgent(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=191)
    default_name: str | None = Field(default=None, min_length=1, max_length=191)
    role_kind: AgentRoleKind | None = None
    status: AgentStatus | None = None
    participation_mode: AgentParticipationMode | None = None
    allowed_targets: list[str] | None = None
    assistant_profile_id: str | None = Field(default=None, max_length=64)
    is_default_operator: bool | None = None
    metadata: dict[str, Any] | None = None


class ArchiveAgent(BaseModel):
    replacement_agent_id: str | None = Field(default=None, max_length=64)
    reason: str | None = Field(default=None, max_length=4000)


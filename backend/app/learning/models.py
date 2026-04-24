"""Learning-event and promotion contracts."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.knowledge.models import RecordLink


LEARNING_TRIGGER_KINDS = ("run_completion", "session_rotation", "pattern_detected", "operator_action")
LearningTriggerKind = Literal["run_completion", "session_rotation", "pattern_detected", "operator_action"]

LEARNING_DECISIONS = ("discard", "history_only", "boot_memory", "durable_memory", "skill_draft", "review_required")
LearningDecision = Literal["discard", "history_only", "boot_memory", "durable_memory", "skill_draft", "review_required"]

LEARNING_STATUSES = ("pending", "applied", "discarded", "review_required")
LearningStatus = Literal["pending", "applied", "discarded", "review_required"]


class LearningEventSummary(BaseModel):
    learning_event_id: str
    instance_id: str
    company_id: str
    trigger_kind: LearningTriggerKind
    suggested_decision: LearningDecision
    status: LearningStatus
    summary: str
    explanation: str
    agent_id: str | None = None
    run_id: str | None = None
    conversation_id: str | None = None
    evidence: dict[str, Any] = Field(default_factory=dict)
    proposed_memory: dict[str, Any] = Field(default_factory=dict)
    proposed_skill: dict[str, Any] = Field(default_factory=dict)
    promoted_memory_id: str | None = None
    promoted_skill_id: str | None = None
    human_override: bool = False
    decision_note: str | None = None
    created_at: datetime
    decided_at: datetime | None = None


class LearningEventDetail(LearningEventSummary):
    agent: RecordLink | None = None
    run: RecordLink | None = None
    conversation: RecordLink | None = None
    promoted_memory: RecordLink | None = None
    promoted_skill: RecordLink | None = None


class CreateLearningEvent(BaseModel):
    trigger_kind: LearningTriggerKind
    summary: str = Field(min_length=1, max_length=4000)
    explanation: str = Field(default="", max_length=12000)
    suggested_decision: LearningDecision = "review_required"
    agent_id: str | None = Field(default=None, max_length=64)
    run_id: str | None = Field(default=None, max_length=64)
    conversation_id: str | None = Field(default=None, max_length=64)
    evidence: dict[str, Any] = Field(default_factory=dict)
    proposed_memory: dict[str, Any] = Field(default_factory=dict)
    proposed_skill: dict[str, Any] = Field(default_factory=dict)


class DecideLearningEvent(BaseModel):
    decision: LearningDecision
    decision_note: str | None = Field(default=None, max_length=4000)
    human_override: bool = False
    memory_payload: dict[str, Any] = Field(default_factory=dict)
    skill_payload: dict[str, Any] = Field(default_factory=dict)

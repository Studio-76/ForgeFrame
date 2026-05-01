"""Learning-event and promotion contracts."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.knowledge.models import RecordLink

LEARNING_TRIGGER_KINDS = (
    "run_completion",
    "session_rotation",
    "pattern_detected",
    "operator_action",
)
LearningTriggerKind = Literal["run_completion", "session_rotation", "pattern_detected", "operator_action"]

LEARNING_DECISIONS = (
    "discard",
    "history_only",
    "boot_memory",
    "durable_memory",
    "skill_draft",
    "review_required",
)
LearningDecision = Literal[
    "discard",
    "history_only",
    "boot_memory",
    "durable_memory",
    "skill_draft",
    "review_required",
]

LEARNING_STATUSES = ("pending", "applied", "discarded", "review_required")
LearningStatus = Literal["pending", "applied", "discarded", "review_required"]

LEARNING_REVIEW_BUCKETS = (
    "suggested",
    "review_required",
    "approved_promoted",
    "rejected",
)
LearningReviewBucket = Literal["suggested", "review_required", "approved_promoted", "rejected"]

LEARNING_DECISION_LANES = (
    "auto_reject",
    "auto_draft",
    "auto_suggest",
    "review_required",
    "auto_promote",
)
LearningDecisionLane = Literal["auto_reject", "auto_draft", "auto_suggest", "review_required", "auto_promote"]

LEARNING_RISK_LEVELS = ("low", "medium", "high")
LearningRiskLevel = Literal["low", "medium", "high"]

LearningProposalSurface = Literal["memory", "skill", "history", "rejection", "review"]
LearningOutcomeSurface = Literal["pending", "memory", "skill", "history", "rejection", "review"]


class LearningSourceSummary(BaseModel):
    kind: str
    label: str
    detail: str | None = None


class LearningProposalSummary(BaseModel):
    target_kind: LearningDecision
    target_label: str
    surface: LearningProposalSurface
    scope_label: str
    content_summary: str
    trust_label: str | None = None


class LearningOutcomeSummary(BaseModel):
    target_kind: LearningDecision | None = None
    target_label: str
    surface: LearningOutcomeSurface
    scope_label: str | None = None


class LearningRiskSummary(BaseModel):
    level: LearningRiskLevel
    reasons: list[str] = Field(default_factory=list)


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
    review_bucket: LearningReviewBucket
    review_bucket_label: str
    suggested_lane: LearningDecisionLane
    suggested_lane_label: str
    source: LearningSourceSummary
    proposal: LearningProposalSummary
    outcome: LearningOutcomeSummary
    risk: LearningRiskSummary
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

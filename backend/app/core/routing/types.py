"""Routing types for ForgeFrame runtime dispatch."""

from pydantic import BaseModel, Field

from app.core.model_registry.models import RuntimeModel, RuntimeTarget


class RouteCandidate(BaseModel):
    target_key: str
    model_id: str
    provider: str
    label: str | None = None
    priority: int = 0
    ready: bool
    health_status: str = "unknown"
    availability_status: str = "unknown"
    queue_eligible: bool = False
    cost_class: str = "medium"
    latency_class: str = "medium"
    capability_match: bool = True
    stage_eligible: bool = False
    selected: bool = False
    cost_score: int = 0
    quality_score: int = 0
    latency_score: int = 0
    score: int = 0
    exclusion_reasons: list[str] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)


class RouteDecision(BaseModel):
    decision_id: str
    instance_id: str
    requested_model: str | None
    resolved_model: RuntimeModel
    resolved_target: RuntimeTarget
    reason: str
    policy: str = "smart_execution_routing"
    policy_stage: str = "preferred"
    classification: str = "simple"
    classification_summary: str = ""
    classification_rules: list[str] = Field(default_factory=list)
    execution_lane: str = "sync_interactive"
    summary: str = ""
    fallback_used: bool = False
    requirement: dict[str, object] = Field(default_factory=dict)
    selection_basis: dict[str, object] = Field(default_factory=dict)
    structured_explainability: dict[str, object] = Field(default_factory=dict)
    raw_explainability: dict[str, object] = Field(default_factory=dict)
    considered_candidates: list[RouteCandidate] = Field(default_factory=list)
    created_at: str

"""Routing types for ForgeGate runtime dispatch."""

from pydantic import BaseModel, Field

from app.core.model_registry.models import RuntimeModel


class RouteCandidate(BaseModel):
    model_id: str
    provider: str
    ready: bool
    health_status: str = "unknown"
    availability_status: str = "unknown"
    capability_match: bool = True
    cost_score: int = 0
    quality_score: int = 0
    latency_score: int = 0
    score: int = 0
    reasons: list[str] = Field(default_factory=list)


class RouteDecision(BaseModel):
    requested_model: str | None
    resolved_model: RuntimeModel
    reason: str
    policy: str = "strict_requested_model_smart_default"
    fallback_used: bool = False
    requirement: dict[str, object] = Field(default_factory=dict)
    selection_basis: dict[str, object] = Field(default_factory=dict)
    considered_candidates: list[RouteCandidate] = Field(default_factory=list)

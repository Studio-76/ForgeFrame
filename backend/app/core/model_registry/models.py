"""Model registry domain models for ForgeFrame runtime."""

from typing import Literal

from pydantic import BaseModel, Field


class RuntimeModel(BaseModel):
    id: str
    provider: str
    owned_by: str
    display_name: str
    category: str = "general"
    routing_key: str | None = None
    capabilities: dict[str, object] = Field(default_factory=dict)
    active: bool = True
    source: Literal["static", "discovered", "manual", "templated"] = "static"
    discovery_status: str = "catalog"
    runtime_status: Literal["planned", "partial", "ready", "failed", "stale", "unavailable"] = "planned"
    availability_status: Literal["unknown", "healthy", "degraded", "unavailable", "stale"] = "unknown"
    status_reason: str | None = None
    last_seen_at: str | None = None
    last_probe_at: str | None = None
    stale_since: str | None = None


class ModelsListResponse(BaseModel):
    object: str = "list"
    data: list[RuntimeModel]


class RuntimeTarget(BaseModel):
    target_key: str
    provider: str
    model_id: str
    model_routing_key: str
    label: str
    instance_id: str
    product_axis: str
    auth_type: str
    credential_type: str
    capability_profile: dict[str, object] = Field(default_factory=dict)
    cost_class: str = "medium"
    latency_class: str = "medium"
    enabled: bool = True
    priority: int = 100
    queue_eligible: bool = False
    stream_capable: bool = False
    tool_capable: bool = False
    vision_capable: bool = False
    fallback_allowed: bool = True
    fallback_target_keys: list[str] = Field(default_factory=list)
    escalation_allowed: bool = True
    escalation_target_keys: list[str] = Field(default_factory=list)
    health_status: str = "unknown"
    availability_status: str = "unknown"
    readiness_status: str = "planned"
    status_reason: str | None = None
    last_seen_at: str | None = None
    last_probe_at: str | None = None
    stale_since: str | None = None
    model: RuntimeModel

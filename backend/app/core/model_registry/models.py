"""Model registry domain models for ForgeGate runtime."""

from typing import Literal

from pydantic import BaseModel


class RuntimeModel(BaseModel):
    id: str
    provider: str
    owned_by: str
    display_name: str
    category: str = "general"
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

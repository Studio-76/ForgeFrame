"""Routing types for ForgeGate runtime dispatch."""

from pydantic import BaseModel

from app.core.model_registry.models import RuntimeModel


class RouteDecision(BaseModel):
    requested_model: str | None
    resolved_model: RuntimeModel
    reason: str

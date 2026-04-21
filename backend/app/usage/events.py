"""Usage and observability event models."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class ClientIdentity(BaseModel):
    client_id: str = "unknown_client"
    consumer: str = "unknown_consumer"
    integration: str = "unknown_integration"


class UsageEvent(BaseModel):
    provider: str
    model: str
    credential_type: str
    auth_source: str
    client_id: str = "unknown_client"
    consumer: str = "unknown_consumer"
    integration: str = "unknown_integration"
    traffic_type: Literal["runtime", "health_check"] = "runtime"
    check_type: str | None = None
    input_tokens: int
    output_tokens: int
    total_tokens: int
    actual_cost: float
    hypothetical_cost: float
    avoided_cost: float
    created_at: str


class ErrorEvent(BaseModel):
    provider: str | None = None
    model: str | None = None
    client_id: str
    consumer: str = "unknown_consumer"
    integration: str = "unknown_integration"
    route: str
    stream_mode: Literal["stream", "non_stream"]
    traffic_type: Literal["runtime", "health_check"] = "runtime"
    error_type: str
    status_code: int
    integration_class: str | None = None
    template_id: str | None = None
    test_phase: str | None = None
    profile_key: str | None = None
    created_at: str


class HealthEvent(BaseModel):
    provider: str
    model: str
    check_type: Literal["provider", "discovery", "synthetic_probe"]
    status: str
    readiness_reason: str | None = None
    last_error: str | None = None
    created_at: str

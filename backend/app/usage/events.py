"""Usage and observability event models."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from app.tenancy import DEFAULT_BOOTSTRAP_TENANT_ID


class ClientIdentity(BaseModel):
    client_id: str = "unknown_client"
    consumer: str = "unknown_consumer"
    integration: str = "unknown_integration"
    tenant_id: str = DEFAULT_BOOTSTRAP_TENANT_ID


class UsageEvent(BaseModel):
    tenant_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    provider: str
    model: str
    credential_type: str
    auth_source: str
    route: str | None = None
    client_id: str = "unknown_client"
    consumer: str = "unknown_consumer"
    integration: str = "unknown_integration"
    traffic_type: Literal["runtime", "health_check"] = "runtime"
    stream_mode: Literal["stream", "non_stream"] | None = None
    check_type: str | None = None
    tool_call_count: int = 0
    input_tokens: int
    output_tokens: int
    total_tokens: int
    actual_cost: float
    hypothetical_cost: float
    avoided_cost: float
    request_id: str | None = None
    correlation_id: str | None = None
    causation_id: str | None = None
    trace_id: str | None = None
    span_id: str | None = None
    duration_ms: int | None = None
    created_at: str


class ErrorEvent(BaseModel):
    tenant_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
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
    request_id: str | None = None
    correlation_id: str | None = None
    causation_id: str | None = None
    trace_id: str | None = None
    span_id: str | None = None
    duration_ms: int | None = None
    created_at: str


class HealthEvent(BaseModel):
    tenant_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    provider: str
    model: str
    route: str | None = None
    check_type: Literal["provider", "discovery", "synthetic_probe"]
    status: str
    readiness_reason: str | None = None
    last_error: str | None = None
    request_id: str | None = None
    correlation_id: str | None = None
    causation_id: str | None = None
    trace_id: str | None = None
    span_id: str | None = None
    duration_ms: int | None = None
    created_at: str

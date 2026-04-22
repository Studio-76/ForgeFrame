"""Shared request and telemetry context helpers."""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Literal

from fastapi import Request

from app.idempotency import RequestEnvelope, get_request_envelope

ServiceKind = Literal["runtime_api", "control_plane", "worker"]

TRACE_CONTEXT_FIELDS = (
    "request_id",
    "correlation_id",
    "causation_id",
    "trace_id",
    "span_id",
)

TRACE_PROPAGATION_HEADERS = (
    "X-ForgeGate-Request-Id",
    "X-ForgeGate-Correlation-Id",
    "X-ForgeGate-Causation-Id",
    "X-ForgeGate-Trace-Id",
    "X-ForgeGate-Span-Id",
    "Idempotency-Key",
)

STRUCTURED_LOG_FIELDS = (
    "tenant_id",
    "client_id",
    "provider",
    "model",
    "route",
    "request_id",
    "correlation_id",
    "causation_id",
    "trace_id",
    "span_id",
    "traffic_type",
    "stream_mode",
    "status_code",
    "error_type",
    "duration_ms",
)


@dataclass(frozen=True)
class TelemetryContext:
    route: str
    operation: str
    service_name: str
    service_kind: ServiceKind
    request_id: str | None = None
    correlation_id: str | None = None
    causation_id: str | None = None
    trace_id: str | None = None
    span_id: str | None = None
    duration_ms: int | None = None

    @classmethod
    def from_envelope(
        cls,
        envelope: RequestEnvelope,
        *,
        route: str,
        operation: str,
        service_name: str,
        service_kind: ServiceKind,
    ) -> TelemetryContext:
        return cls(
            route=route,
            operation=operation,
            service_name=service_name,
            service_kind=service_kind,
            request_id=envelope.request_id,
            correlation_id=envelope.correlation_id,
            causation_id=envelope.causation_id,
            trace_id=envelope.trace_id or envelope.correlation_id,
            span_id=getattr(envelope, "span_id", None) or envelope.request_id,
        )

    def with_duration(self, duration_ms: float | int | None) -> TelemetryContext:
        if duration_ms is None:
            return self
        normalized = max(0, int(round(float(duration_ms))))
        return replace(self, duration_ms=normalized)

    def as_request_metadata(self) -> dict[str, str]:
        metadata = {
            "route": self.route,
            "operation": self.operation,
            "service_name": self.service_name,
            "service_kind": self.service_kind,
        }
        for key in TRACE_CONTEXT_FIELDS:
            value = getattr(self, key)
            if value:
                metadata[key] = value
        return metadata


def telemetry_context_from_request(
    request: Request,
    *,
    route: str | None = None,
    operation: str,
    service_name: str,
    service_kind: ServiceKind,
) -> TelemetryContext:
    envelope = get_request_envelope(request)
    return TelemetryContext.from_envelope(
        envelope,
        route=route or request.url.path or "/",
        operation=operation,
        service_name=service_name,
        service_kind=service_kind,
    )

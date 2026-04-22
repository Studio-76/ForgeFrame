"""Tracing posture helpers for operator observability views."""

from __future__ import annotations


def build_tracing_operability_snapshot() -> dict[str, object]:
    return {
        "configured": True,
        "exporter": "header_propagation",
        "release_scope": "backend_runtime_and_control_plane",
        "accepted_headers": ["X-ForgeGate-Trace-Id", "X-ForgeGate-Span-Id", "traceparent"],
        "emitted_headers": [
            "X-ForgeGate-Request-Id",
            "X-ForgeGate-Correlation-Id",
            "X-ForgeGate-Causation-Id",
            "X-ForgeGate-Trace-Id",
            "X-ForgeGate-Span-Id",
        ],
        "context_fields": ["request_id", "correlation_id", "causation_id", "trace_id", "span_id"],
        "async_bridges": [
            "request_idempotency_records.request_metadata",
            "provider_request_metadata_headers",
            "observability_event_payloads",
        ],
        "details": (
            "ForgeGate propagates trace context from HTTP ingress into provider calls, "
            "request-idempotency persistence, and emitted observability events."
        ),
    }

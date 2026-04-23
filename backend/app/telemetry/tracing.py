"""Tracing posture helpers for operator observability views."""

from __future__ import annotations


def build_tracing_operability_snapshot() -> dict[str, object]:
    return {
        "configured": True,
        "exporter": "header_propagation",
        "release_scope": "backend_runtime_and_control_plane",
        "accepted_headers": ["X-ForgeFrame-Trace-Id", "X-ForgeFrame-Span-Id", "traceparent"],
        "emitted_headers": [
            "X-ForgeFrame-Request-Id",
            "X-ForgeFrame-Correlation-Id",
            "X-ForgeFrame-Causation-Id",
            "X-ForgeFrame-Trace-Id",
            "X-ForgeFrame-Span-Id",
        ],
        "context_fields": ["request_id", "correlation_id", "causation_id", "trace_id", "span_id"],
        "async_bridges": [
            "request_idempotency_records.request_metadata",
            "provider_request_metadata_headers",
            "observability_event_payloads",
        ],
        "details": (
            "ForgeFrame propagates trace context from HTTP ingress into provider calls, "
            "request-idempotency persistence, and emitted observability events."
        ),
    }

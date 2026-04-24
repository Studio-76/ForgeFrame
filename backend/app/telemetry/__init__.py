"""Telemetry helpers exposed to admin/operator surfaces."""

from app.telemetry.context import TelemetryContext, telemetry_context_from_request


def build_logging_operability_snapshot(*args, **kwargs):
    from app.telemetry.logging import build_logging_operability_snapshot as _impl

    return _impl(*args, **kwargs)


def build_metrics_operability_snapshot(*args, **kwargs):
    from app.telemetry.metrics import build_metrics_operability_snapshot as _impl

    return _impl(*args, **kwargs)


def build_tracing_operability_snapshot(*args, **kwargs):
    from app.telemetry.tracing import build_tracing_operability_snapshot as _impl

    return _impl(*args, **kwargs)

__all__ = [
    "TelemetryContext",
    "build_logging_operability_snapshot",
    "build_metrics_operability_snapshot",
    "build_tracing_operability_snapshot",
    "telemetry_context_from_request",
]

"""Persistent usage/error/health analytics store for control-plane observability."""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from math import ceil
from typing import Literal, Protocol, TypeVar, cast

from pydantic import BaseModel

from app.providers import ChatDispatchResult, ProviderStreamEvent
from app.settings.config import get_settings
from app.storage.observability_repository import ObservabilityRepository, get_observability_repository
from app.telemetry.context import TelemetryContext
from app.tenancy import effective_tenant_filter, normalize_tenant_id
from app.usage.events import ClientIdentity, ErrorEvent, HealthEvent, UsageEvent
from app.usage.models import CostBreakdown, TokenUsage

TModel = TypeVar("TModel", bound=BaseModel)


class SqlBackedObservabilityRepository(Protocol):
    def effective_history_tenant_id(self, requested_tenant_id: str | None) -> str | None: ...

    def aggregate_summary(self, *, window_seconds: int | None, tenant_id: str | None) -> dict[str, object]: ...

    def timeline(self, *, window_seconds: int, bucket_seconds: int, tenant_id: str | None) -> list[dict[str, object]]: ...

    def provider_drilldown(
        self,
        provider: str,
        *,
        window_seconds: int | None,
        tenant_id: str | None,
    ) -> dict[str, object]: ...

    def client_drilldown(
        self,
        client_id: str,
        *,
        window_seconds: int | None,
        tenant_id: str | None,
    ) -> dict[str, object]: ...

    def latest_usage_event(
        self,
        provider: str,
        *,
        tenant_id: str | None = None,
        stream_mode: str | None = None,
        require_tool_calls: bool = False,
    ) -> UsageEvent | None: ...

    def latest_error_event(
        self,
        provider: str,
        *,
        tenant_id: str | None = None,
        stream_mode: str | None = None,
    ) -> ErrorEvent | None: ...


class UsageAnalyticsStore:
    def __init__(self, repository: ObservabilityRepository, *, default_tenant_id: str):
        self._repository = repository
        self._default_tenant_id = normalize_tenant_id(default_tenant_id)

    def _now_iso(self) -> str:
        return datetime.now(tz=UTC).isoformat()

    def _tenant_id(self, tenant_id: str | None = None) -> str:
        return normalize_tenant_id(tenant_id, fallback_tenant_id=self._default_tenant_id)

    def _sql_repository(self) -> SqlBackedObservabilityRepository | None:
        required = (
            "effective_history_tenant_id",
            "aggregate_summary",
            "timeline",
            "provider_drilldown",
            "client_drilldown",
            "latest_usage_event",
            "latest_error_event",
        )
        if all(callable(getattr(self._repository, name, None)) for name in required):
            return cast(SqlBackedObservabilityRepository, self._repository)
        return None

    def _usage_events(self) -> list[UsageEvent]:
        return self._repository.load_usage_events()

    def _error_events(self) -> list[ErrorEvent]:
        return self._repository.load_error_events()

    def _health_events(self) -> list[HealthEvent]:
        return self._repository.load_health_events()

    def _effective_query_tenant_id(
        self,
        *entry_groups: list[BaseModel],
        tenant_id: str | None = None,
    ) -> str | None:
        tenant_ids = [
            self._tenant_id(getattr(entry, "tenant_id", None))
            for group in entry_groups
            for entry in group
        ]
        return effective_tenant_filter(tenant_ids, tenant_id)

    def _effective_history_tenant_id(self, *, tenant_id: str | None = None) -> str | None:
        sql_repository = self._sql_repository()
        if sql_repository is not None:
            return sql_repository.effective_history_tenant_id(tenant_id)
        return self._effective_query_tenant_id(
            self._usage_events(),
            self._error_events(),
            self._health_events(),
            tenant_id=tenant_id,
        )

    def effective_history_tenant_id(self, *, tenant_id: str | None = None) -> str | None:
        return self._effective_history_tenant_id(tenant_id=tenant_id)

    def _apply_tenant_filter(self, entries: list[TModel], tenant_id: str | None) -> list[TModel]:
        if tenant_id is None:
            return entries
        return [
            entry
            for entry in entries
            if self._tenant_id(getattr(entry, "tenant_id", None)) == tenant_id
        ]

    @staticmethod
    def _context_fields(context: TelemetryContext | None) -> dict[str, object]:
        if context is None:
            return {}
        return {
            "request_id": context.request_id,
            "correlation_id": context.correlation_id,
            "causation_id": context.causation_id,
            "trace_id": context.trace_id,
            "span_id": context.span_id,
            "duration_ms": context.duration_ms,
        }

    def record_non_stream_result(
        self,
        result: ChatDispatchResult,
        client: ClientIdentity | None = None,
        *,
        context: TelemetryContext | None = None,
    ) -> None:
        identity = client or ClientIdentity()
        event = UsageEvent(
            tenant_id=self._tenant_id(identity.tenant_id),
            provider=result.provider,
            model=result.model,
            credential_type=result.credential_type,
            auth_source=result.auth_source,
            route=context.route if context is not None else None,
            client_id=identity.client_id,
            consumer=identity.consumer,
            integration=identity.integration,
            traffic_type="runtime",
            stream_mode="non_stream",
            tool_call_count=len(result.tool_calls),
            input_tokens=result.usage.input_tokens,
            output_tokens=result.usage.output_tokens,
            total_tokens=result.usage.total_tokens,
            actual_cost=result.cost.actual_cost,
            hypothetical_cost=result.cost.hypothetical_cost,
            avoided_cost=result.cost.avoided_cost,
            **self._context_fields(context),
            created_at=self._now_iso(),
        )
        self._repository.append_usage_event(event)

    def record_runtime_error(
        self,
        *,
        provider: str | None,
        model: str | None,
        client: ClientIdentity,
        route: str,
        stream_mode: Literal["stream", "non_stream"],
        error_type: str,
        status_code: int,
        context: TelemetryContext | None = None,
    ) -> None:
        event = ErrorEvent(
            tenant_id=self._tenant_id(client.tenant_id),
            provider=provider,
            model=model,
            client_id=client.client_id,
            consumer=client.consumer,
            integration=client.integration,
            route=route,
            stream_mode=stream_mode,
            traffic_type="runtime",
            error_type=error_type,
            status_code=status_code,
            integration_class=None,
            template_id=None,
            test_phase=None,
            profile_key=None,
            **self._context_fields(context),
            created_at=self._now_iso(),
        )
        self._repository.append_error_event(event)

    def record_stream_done_event(
        self,
        *,
        provider: str,
        model: str,
        event: ProviderStreamEvent,
        client: ClientIdentity | None = None,
        context: TelemetryContext | None = None,
    ) -> None:
        if not event.usage or not event.cost:
            return
        identity = client or ClientIdentity()
        usage_event = UsageEvent(
            tenant_id=self._tenant_id(identity.tenant_id),
            provider=provider,
            model=model,
            credential_type=str(event.credential_type or "unknown"),
            auth_source=str(event.auth_source or "unknown"),
            route=context.route if context is not None else None,
            client_id=identity.client_id,
            consumer=identity.consumer,
            integration=identity.integration,
            traffic_type="runtime",
            stream_mode="stream",
            tool_call_count=len(event.tool_calls),
            input_tokens=event.usage.input_tokens,
            output_tokens=event.usage.output_tokens,
            total_tokens=event.usage.total_tokens,
            actual_cost=event.cost.actual_cost,
            hypothetical_cost=event.cost.hypothetical_cost,
            avoided_cost=event.cost.avoided_cost,
            **self._context_fields(context),
            created_at=self._now_iso(),
        )
        self._repository.append_usage_event(usage_event)

    def record_health_check(
        self,
        *,
        provider: str,
        model: str,
        usage: TokenUsage,
        cost: CostBreakdown,
        check_type: str,
        credential_type: str,
        auth_source: str,
        tenant_id: str | None = None,
        context: TelemetryContext | None = None,
    ) -> None:
        event = UsageEvent(
            tenant_id=self._tenant_id(tenant_id),
            provider=provider,
            model=model,
            credential_type=credential_type,
            auth_source=auth_source,
            route=context.route if context is not None else "/admin/providers/health/run",
            client_id="control_plane",
            consumer="admin",
            integration="health_scheduler",
            traffic_type="health_check",
            stream_mode="non_stream",
            check_type=check_type,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            total_tokens=usage.total_tokens,
            actual_cost=cost.actual_cost,
            hypothetical_cost=cost.hypothetical_cost,
            avoided_cost=cost.avoided_cost,
            request_id=context.request_id if context is not None else None,
            correlation_id=context.correlation_id if context is not None else None,
            causation_id=context.causation_id if context is not None else None,
            trace_id=context.trace_id if context is not None else None,
            span_id=context.span_id if context is not None else None,
            duration_ms=context.duration_ms if context is not None else None,
            created_at=self._now_iso(),
        )
        self._repository.append_usage_event(event)

    def record_health_check_error(
        self,
        *,
        provider: str,
        model: str,
        check_type: str,
        error_type: str,
        status_code: int = 503,
        tenant_id: str | None = None,
        context: TelemetryContext | None = None,
    ) -> None:
        event = ErrorEvent(
            tenant_id=self._tenant_id(tenant_id),
            provider=provider,
            model=model,
            client_id="control_plane",
            consumer="admin",
            integration="health_scheduler",
            route="/admin/providers/health/run",
            stream_mode="non_stream",
            traffic_type="health_check",
            error_type=f"{check_type}:{error_type}",
            status_code=status_code,
            integration_class="health_check",
            template_id=None,
            test_phase=check_type,
            profile_key=None,
            request_id=context.request_id if context is not None else None,
            correlation_id=context.correlation_id if context is not None else None,
            causation_id=context.causation_id if context is not None else None,
            trace_id=context.trace_id if context is not None else None,
            span_id=context.span_id if context is not None else None,
            duration_ms=context.duration_ms if context is not None else None,
            created_at=self._now_iso(),
        )
        self._repository.append_error_event(event)

    def record_integration_error(
        self,
        *,
        provider: str | None,
        model: str | None,
        integration_class: str,
        template_id: str | None,
        test_phase: str,
        error_type: str,
        status_code: int,
        client_id: str,
        profile_key: str | None,
        tenant_id: str | None = None,
        context: TelemetryContext | None = None,
    ) -> None:
        event = ErrorEvent(
            tenant_id=self._tenant_id(tenant_id),
            provider=provider,
            model=model,
            client_id=client_id,
            consumer="admin",
            integration="harness",
            route="/admin/providers/harness/verify",
            stream_mode="non_stream",
            traffic_type="runtime",
            error_type=error_type,
            status_code=status_code,
            integration_class=integration_class,
            template_id=template_id,
            test_phase=test_phase,
            profile_key=profile_key,
            request_id=context.request_id if context is not None else None,
            correlation_id=context.correlation_id if context is not None else None,
            causation_id=context.causation_id if context is not None else None,
            trace_id=context.trace_id if context is not None else None,
            span_id=context.span_id if context is not None else None,
            duration_ms=context.duration_ms if context is not None else None,
            created_at=self._now_iso(),
        )
        self._repository.append_error_event(event)

    def record_health_status(
        self,
        *,
        provider: str,
        model: str,
        check_type: Literal["provider", "discovery", "synthetic_probe"],
        status: str,
        readiness_reason: str | None,
        last_error: str | None,
        tenant_id: str | None = None,
        context: TelemetryContext | None = None,
    ) -> None:
        event = HealthEvent(
            tenant_id=self._tenant_id(tenant_id),
            provider=provider,
            model=model,
            route=context.route if context is not None else "/admin/providers/health/run",
            check_type=check_type,
            status=status,
            readiness_reason=readiness_reason,
            last_error=last_error,
            request_id=context.request_id if context is not None else None,
            correlation_id=context.correlation_id if context is not None else None,
            causation_id=context.causation_id if context is not None else None,
            trace_id=context.trace_id if context is not None else None,
            span_id=context.span_id if context is not None else None,
            duration_ms=context.duration_ms if context is not None else None,
            created_at=self._now_iso(),
        )
        self._repository.append_health_event(event)

    def _parse_dt(self, value: str) -> datetime:
        return datetime.fromisoformat(value)

    def _window_filter(self, entries: list[TModel], window_seconds: int | None) -> list[TModel]:
        if window_seconds is None:
            return entries
        cutoff = datetime.now(tz=UTC) - timedelta(seconds=window_seconds)
        return [entry for entry in entries if self._parse_dt(getattr(entry, "created_at")) >= cutoff]

    @staticmethod
    def _duration_percentile(samples: list[int], percentile: float) -> int | None:
        if not samples:
            return None
        index = max(0, ceil(percentile * len(samples)) - 1)
        return samples[index]

    @classmethod
    def _runtime_duration_summary(
        cls,
        events: list[UsageEvent],
        errors: list[ErrorEvent],
    ) -> dict[str, object]:
        samples = sorted(
            int(duration_ms)
            for entry in [*events, *errors]
            if getattr(entry, "traffic_type", None) == "runtime"
            and (duration_ms := getattr(entry, "duration_ms", None)) is not None
        )
        if not samples:
            return {
                "sample_count": 0,
                "avg": None,
                "p50": None,
                "p95": None,
                "max": None,
            }
        return {
            "sample_count": len(samples),
            "avg": round(sum(samples) / len(samples), 2),
            "p50": cls._duration_percentile(samples, 0.50),
            "p95": cls._duration_percentile(samples, 0.95),
            "max": samples[-1],
        }

    def list_usage_events(self, *, tenant_id: str | None = None) -> list[UsageEvent]:
        events = self._usage_events()
        if tenant_id is None:
            return list(events)
        effective_tenant_id = self._effective_history_tenant_id(tenant_id=tenant_id)
        return list(self._apply_tenant_filter(events, effective_tenant_id))

    def list_error_events(self, *, tenant_id: str | None = None) -> list[ErrorEvent]:
        errors = self._error_events()
        if tenant_id is None:
            return list(errors)
        effective_tenant_id = self._effective_history_tenant_id(tenant_id=tenant_id)
        return list(self._apply_tenant_filter(errors, effective_tenant_id))

    def list_health_events(self, *, tenant_id: str | None = None) -> list[HealthEvent]:
        health_events = self._health_events()
        if tenant_id is None:
            return list(health_events)
        effective_tenant_id = self._effective_history_tenant_id(tenant_id=tenant_id)
        return list(self._apply_tenant_filter(health_events, effective_tenant_id))

    def latest_usage_event(
        self,
        provider: str,
        *,
        tenant_id: str | None = None,
        stream_mode: str | None = None,
        require_tool_calls: bool = False,
    ) -> UsageEvent | None:
        sql_repository = self._sql_repository()
        if sql_repository is not None:
            return sql_repository.latest_usage_event(
                provider,
                tenant_id=tenant_id,
                stream_mode=stream_mode,
                require_tool_calls=require_tool_calls,
            )
        events = self._usage_events()
        filtered = [
            event
            for event in events
            if event.provider == provider
            and event.traffic_type == "runtime"
            and (tenant_id is None or self._tenant_id(getattr(event, "tenant_id", None)) == tenant_id)
            and (
                stream_mode is None
                or (event.stream_mode == stream_mode)
                or (
                    event.stream_mode is None
                    and stream_mode == "stream"
                    and event.credential_type == "stream"
                )
                or (
                    event.stream_mode is None
                    and stream_mode == "non_stream"
                    and event.credential_type != "stream"
                )
            )
            and (not require_tool_calls or int(getattr(event, "tool_call_count", 0)) > 0)
        ]
        return filtered[-1] if filtered else None

    def latest_error_event(
        self,
        provider: str,
        *,
        tenant_id: str | None = None,
        stream_mode: str | None = None,
    ) -> ErrorEvent | None:
        sql_repository = self._sql_repository()
        if sql_repository is not None:
            return sql_repository.latest_error_event(
                provider,
                tenant_id=tenant_id,
                stream_mode=stream_mode,
            )
        errors = self._error_events()
        filtered = [
            event
            for event in errors
            if event.provider == provider
            and event.traffic_type == "runtime"
            and (tenant_id is None or self._tenant_id(getattr(event, "tenant_id", None)) == tenant_id)
            and (stream_mode is None or event.stream_mode == stream_mode)
        ]
        return filtered[-1] if filtered else None

    def aggregate(self, window_seconds: int | None = None, *, tenant_id: str | None = None) -> dict[str, object]:
        sql_repository = self._sql_repository()
        effective_tenant_id = self._effective_history_tenant_id(tenant_id=tenant_id)
        if sql_repository is not None:
            return sql_repository.aggregate_summary(
                window_seconds=window_seconds,
                tenant_id=effective_tenant_id,
            )
        events = self._window_filter(self._usage_events(), window_seconds)
        errors = self._window_filter(self._error_events(), window_seconds)
        health = self._window_filter(self._health_events(), window_seconds)
        events = self._apply_tenant_filter(events, effective_tenant_id)
        errors = self._apply_tenant_filter(errors, effective_tenant_id)
        health = self._apply_tenant_filter(health, effective_tenant_id)

        grouped_provider = defaultdict(lambda: {"requests": 0, "tokens": 0, "actual_cost": 0.0, "hypothetical_cost": 0.0, "avoided_cost": 0.0})
        grouped_model = defaultdict(lambda: {"requests": 0, "tokens": 0})
        grouped_auth = defaultdict(lambda: {"requests": 0, "tokens": 0})
        grouped_client = defaultdict(lambda: {"requests": 0, "tokens": 0, "actual_cost": 0.0, "hypothetical_cost": 0.0, "avoided_cost": 0.0})
        grouped_traffic = defaultdict(lambda: {"requests": 0, "tokens": 0, "actual_cost": 0.0, "hypothetical_cost": 0.0, "avoided_cost": 0.0})
        grouped_error_provider = defaultdict(lambda: {"errors": 0})
        grouped_error_model = defaultdict(lambda: {"errors": 0})
        grouped_error_client = defaultdict(lambda: {"errors": 0})
        grouped_error_traffic = defaultdict(lambda: {"errors": 0})
        grouped_error_type = defaultdict(lambda: {"errors": 0})
        grouped_error_integration = defaultdict(lambda: {"errors": 0})
        grouped_error_profile = defaultdict(lambda: {"errors": 0})

        for event in events:
            grouped_provider[event.provider]["requests"] += 1
            grouped_provider[event.provider]["tokens"] += event.total_tokens
            grouped_provider[event.provider]["actual_cost"] += event.actual_cost
            grouped_provider[event.provider]["hypothetical_cost"] += event.hypothetical_cost
            grouped_provider[event.provider]["avoided_cost"] += event.avoided_cost

            grouped_model[event.model]["requests"] += 1
            grouped_model[event.model]["tokens"] += event.total_tokens

            grouped_auth[f"{event.credential_type}:{event.auth_source}"]["requests"] += 1
            grouped_auth[f"{event.credential_type}:{event.auth_source}"]["tokens"] += event.total_tokens

            grouped_client[event.client_id]["requests"] += 1
            grouped_client[event.client_id]["tokens"] += event.total_tokens
            grouped_client[event.client_id]["actual_cost"] += event.actual_cost
            grouped_client[event.client_id]["hypothetical_cost"] += event.hypothetical_cost
            grouped_client[event.client_id]["avoided_cost"] += event.avoided_cost

            grouped_traffic[event.traffic_type]["requests"] += 1
            grouped_traffic[event.traffic_type]["tokens"] += event.total_tokens
            grouped_traffic[event.traffic_type]["actual_cost"] += event.actual_cost
            grouped_traffic[event.traffic_type]["hypothetical_cost"] += event.hypothetical_cost
            grouped_traffic[event.traffic_type]["avoided_cost"] += event.avoided_cost

        for error in errors:
            grouped_error_provider[error.provider or "unknown"]["errors"] += 1
            grouped_error_model[error.model or "unknown"]["errors"] += 1
            grouped_error_client[error.client_id]["errors"] += 1
            grouped_error_traffic[error.traffic_type]["errors"] += 1
            grouped_error_type[f"{error.error_type}:{error.status_code}"]["errors"] += 1
            integration_key = f"{error.integration_class or 'runtime'}:{error.template_id or 'none'}:{error.test_phase or 'none'}"
            grouped_error_integration[integration_key]["errors"] += 1
            grouped_error_profile[error.profile_key or "none"]["errors"] += 1

        latest_health: dict[tuple[str, str], HealthEvent] = {}
        for event in health:
            latest_health[(event.provider, event.model)] = event
        runtime_duration_ms = self._runtime_duration_summary(events, errors)

        return {
            "event_count": len(events),
            "error_event_count": len(errors),
            "health_event_count": len(health),
            "by_provider": [{"provider": key, **value} for key, value in grouped_provider.items()],
            "by_model": [{"model": key, **value} for key, value in grouped_model.items()],
            "by_auth": [{"auth_key": key, **value} for key, value in grouped_auth.items()],
            "by_client": [{"client_id": key, **value} for key, value in grouped_client.items()],
            "by_traffic_type": [{"traffic_type": key, **value} for key, value in grouped_traffic.items()],
            "errors_by_provider": [{"provider": key, **value} for key, value in grouped_error_provider.items()],
            "errors_by_model": [{"model": key, **value} for key, value in grouped_error_model.items()],
            "errors_by_client": [{"client_id": key, **value} for key, value in grouped_error_client.items()],
            "errors_by_traffic_type": [{"traffic_type": key, **value} for key, value in grouped_error_traffic.items()],
            "errors_by_type": [{"error_key": key, **value} for key, value in grouped_error_type.items()],
            "errors_by_integration": [{"integration_key": key, **value} for key, value in grouped_error_integration.items()],
            "errors_by_profile": [{"profile_key": key, **value} for key, value in grouped_error_profile.items()],
            "runtime_duration_ms": runtime_duration_ms,
            "latest_health": [
                {
                    "provider": event.provider,
                    "model": event.model,
                    "check_type": event.check_type,
                    "status": event.status,
                    "readiness_reason": event.readiness_reason,
                    "last_error": event.last_error,
                    "checked_at": event.created_at,
                }
                for event in latest_health.values()
            ],
        }

    def timeline(
        self,
        *,
        window_seconds: int = 24 * 3600,
        bucket_seconds: int = 3600,
        tenant_id: str | None = None,
    ) -> list[dict[str, object]]:
        now = datetime.now(tz=UTC)
        bucket_count = max(1, window_seconds // bucket_seconds)
        sql_repository = self._sql_repository()
        effective_tenant_id = self._effective_history_tenant_id(tenant_id=tenant_id)
        if sql_repository is not None:
            return sql_repository.timeline(
                window_seconds=window_seconds,
                bucket_seconds=bucket_seconds,
                tenant_id=effective_tenant_id,
            )
        events = self._window_filter(self._usage_events(), window_seconds)
        errors = self._window_filter(self._error_events(), window_seconds)
        events = self._apply_tenant_filter(events, effective_tenant_id)
        errors = self._apply_tenant_filter(errors, effective_tenant_id)
        buckets = []
        for index in range(bucket_count):
            bucket_start = now - timedelta(seconds=(bucket_count - index) * bucket_seconds)
            bucket_end = bucket_start + timedelta(seconds=bucket_seconds)
            bucket_events = [event for event in events if bucket_start <= self._parse_dt(event.created_at) < bucket_end]
            bucket_errors = [event for event in errors if bucket_start <= self._parse_dt(event.created_at) < bucket_end]
            buckets.append(
                {
                    "bucket_start": bucket_start.isoformat(),
                    "bucket_end": bucket_end.isoformat(),
                    "requests": len(bucket_events),
                    "errors": len(bucket_errors),
                    "actual_cost": sum(event.actual_cost for event in bucket_events),
                    "hypothetical_cost": sum(event.hypothetical_cost for event in bucket_events),
                    "avoided_cost": sum(event.avoided_cost for event in bucket_events),
                    "error_rate": (len(bucket_errors) / max(1, len(bucket_events) + len(bucket_errors))),
                }
            )
        return buckets

    def provider_drilldown(
        self,
        provider: str,
        *,
        window_seconds: int | None = None,
        tenant_id: str | None = None,
    ) -> dict[str, object]:
        sql_repository = self._sql_repository()
        effective_tenant_id = self._effective_history_tenant_id(tenant_id=tenant_id)
        if sql_repository is not None:
            return sql_repository.provider_drilldown(
                provider,
                window_seconds=window_seconds,
                tenant_id=effective_tenant_id,
            )
        events = [event for event in self._window_filter(self._usage_events(), window_seconds) if event.provider == provider]
        errors = [event for event in self._window_filter(self._error_events(), window_seconds) if event.provider == provider]
        health = [event for event in self._window_filter(self._health_events(), window_seconds) if event.provider == provider]
        events = self._apply_tenant_filter(events, effective_tenant_id)
        errors = self._apply_tenant_filter(errors, effective_tenant_id)
        health = self._apply_tenant_filter(health, effective_tenant_id)
        models: dict[str, dict[str, object]] = {}
        clients: dict[str, dict[str, object]] = {}
        for event in events:
            model_row = models.setdefault(event.model, {"model": event.model, "requests": 0, "tokens": 0, "actual_cost": 0.0})
            model_row["requests"] = int(model_row["requests"]) + 1
            model_row["tokens"] = int(model_row["tokens"]) + event.total_tokens
            model_row["actual_cost"] = float(model_row["actual_cost"]) + event.actual_cost
            client_row = clients.setdefault(event.client_id, {"client_id": event.client_id, "requests": 0, "tokens": 0, "actual_cost": 0.0, "errors": 0})
            client_row["requests"] = int(client_row["requests"]) + 1
            client_row["tokens"] = int(client_row["tokens"]) + event.total_tokens
            client_row["actual_cost"] = float(client_row["actual_cost"]) + event.actual_cost
        for error in errors:
            client_id = error.client_id
            client_row = clients.setdefault(client_id, {"client_id": client_id, "requests": 0, "tokens": 0, "actual_cost": 0.0, "errors": 0})
            client_row["errors"] = int(client_row["errors"]) + 1
            model_key = error.model or "unknown"
            model_row = models.setdefault(model_key, {"model": model_key, "requests": 0, "tokens": 0, "actual_cost": 0.0, "errors": 0})
            model_row["errors"] = int(model_row.get("errors", 0)) + 1
        return {
            "provider": provider,
            "requests": len(events),
            "errors": len(errors),
            "latest_health": [item.model_dump() for item in sorted(health, key=lambda event: event.created_at, reverse=True)[:20]],
            "models": sorted(models.values(), key=lambda item: (int(item.get("errors", 0)), int(item["requests"])), reverse=True),
            "clients": sorted(clients.values(), key=lambda item: (int(item.get("errors", 0)), float(item.get("actual_cost", 0.0))), reverse=True),
        }

    def client_drilldown(
        self,
        client_id: str,
        *,
        window_seconds: int | None = None,
        tenant_id: str | None = None,
    ) -> dict[str, object]:
        sql_repository = self._sql_repository()
        effective_tenant_id = self._effective_history_tenant_id(tenant_id=tenant_id)
        if sql_repository is not None:
            return sql_repository.client_drilldown(
                client_id,
                window_seconds=window_seconds,
                tenant_id=effective_tenant_id,
            )
        events = [event for event in self._window_filter(self._usage_events(), window_seconds) if event.client_id == client_id]
        errors = [event for event in self._window_filter(self._error_events(), window_seconds) if event.client_id == client_id]
        events = self._apply_tenant_filter(events, effective_tenant_id)
        errors = self._apply_tenant_filter(errors, effective_tenant_id)
        providers: dict[str, dict[str, object]] = {}
        for event in events:
            row = providers.setdefault(event.provider, {"provider": event.provider, "requests": 0, "tokens": 0, "actual_cost": 0.0})
            row["requests"] = int(row["requests"]) + 1
            row["tokens"] = int(row["tokens"]) + event.total_tokens
            row["actual_cost"] = float(row["actual_cost"]) + event.actual_cost
        for error in errors:
            provider_key = error.provider or "unknown"
            row = providers.setdefault(provider_key, {"provider": provider_key, "requests": 0, "tokens": 0, "actual_cost": 0.0, "errors": 0})
            row["errors"] = int(row.get("errors", 0)) + 1
        return {
            "client_id": client_id,
            "requests": len(events),
            "errors": len(errors),
            "providers": sorted(providers.values(), key=lambda item: (int(item.get("errors", 0)), int(item["requests"])), reverse=True),
            "recent_errors": [item.model_dump() for item in sorted(errors, key=lambda event: event.created_at, reverse=True)[:25]],
            "recent_usage": [item.model_dump() for item in sorted(events, key=lambda event: event.created_at, reverse=True)[:25]],
        }

    def alert_indicators(self, *, tenant_id: str | None = None) -> list[dict[str, object]]:
        last_hour = self.aggregate(window_seconds=3600, tenant_id=tenant_id)
        requests = int(last_hour["event_count"])
        errors = int(last_hour["error_event_count"])
        error_rate = errors / max(1, (requests + errors))
        alerts: list[dict[str, object]] = []
        if error_rate >= 0.25 and errors >= 3:
            alerts.append({"severity": "critical", "type": "error_rate_spike", "message": "Error rate exceeded 25% in last hour.", "value": error_rate})
        elif error_rate >= 0.1 and errors >= 2:
            alerts.append({"severity": "warning", "type": "error_rate_rising", "message": "Error rate exceeded 10% in last hour.", "value": error_rate})

        health_failures = sum(item["errors"] for item in last_hour["errors_by_traffic_type"] if item["traffic_type"] == "health_check")
        if health_failures >= 5:
            alerts.append({"severity": "warning", "type": "health_failures", "message": "Health checks report repeated failures.", "value": health_failures})

        health_cost = next((item["actual_cost"] for item in last_hour["by_traffic_type"] if item["traffic_type"] == "health_check"), 0.0)
        runtime_cost = next((item["actual_cost"] for item in last_hour["by_traffic_type"] if item["traffic_type"] == "runtime"), 0.0)
        if health_cost > runtime_cost and health_cost > 0:
            alerts.append({"severity": "warning", "type": "health_cost_pressure", "message": "Health-check costs exceeded runtime costs in last hour.", "value": health_cost})
        if requests == 0 and errors > 0:
            alerts.append({"severity": "warning", "type": "control_plane_only_errors", "message": "Only error traffic was recorded in the last hour.", "value": errors})
        top_provider = max(last_hour["errors_by_provider"], key=lambda item: item["errors"], default=None)
        if top_provider and int(top_provider["errors"]) >= 3:
            alerts.append({"severity": "warning", "type": "provider_hotspot", "message": f"Provider {top_provider['provider']} is the current error hotspot.", "value": top_provider["errors"]})

        return alerts


@lru_cache(maxsize=1)
def get_usage_analytics_store() -> UsageAnalyticsStore:
    settings = get_settings()
    return UsageAnalyticsStore(
        repository=get_observability_repository(settings),
        default_tenant_id=settings.bootstrap_tenant_id,
    )

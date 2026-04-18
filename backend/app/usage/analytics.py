"""In-memory usage analytics aggregation for phase-6 control-plane foundations."""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime
from functools import lru_cache
from typing import Literal

from pydantic import BaseModel

from app.providers import ChatDispatchResult, ProviderStreamEvent
from app.usage.models import CostBreakdown, TokenUsage


class UsageEvent(BaseModel):
    provider: str
    model: str
    credential_type: str
    auth_source: str
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
    client: str
    route: str
    stream_mode: Literal["stream", "non_stream"]
    traffic_type: Literal["runtime", "health_check"] = "runtime"
    error_type: str
    status_code: int
    created_at: str


class UsageAnalyticsStore:
    def __init__(self):
        self._events: list[UsageEvent] = []
        self._errors: list[ErrorEvent] = []

    def record_non_stream_result(self, result: ChatDispatchResult) -> None:
        self._events.append(
            UsageEvent(
                provider=result.provider,
                model=result.model,
                credential_type=result.credential_type,
                auth_source=result.auth_source,
                traffic_type="runtime",
                input_tokens=result.usage.input_tokens,
                output_tokens=result.usage.output_tokens,
                total_tokens=result.usage.total_tokens,
                actual_cost=result.cost.actual_cost,
                hypothetical_cost=result.cost.hypothetical_cost,
                avoided_cost=result.cost.avoided_cost,
                created_at=datetime.now(tz=UTC).isoformat(),
            )
        )

    def record_runtime_error(
        self,
        *,
        provider: str | None,
        model: str | None,
        client: str,
        route: str,
        stream_mode: Literal["stream", "non_stream"],
        error_type: str,
        status_code: int,
    ) -> None:
        self._errors.append(
            ErrorEvent(
                provider=provider,
                model=model,
                client=client,
                route=route,
                stream_mode=stream_mode,
                traffic_type="runtime",
                error_type=error_type,
                status_code=status_code,
                created_at=datetime.now(tz=UTC).isoformat(),
            )
        )

    def record_stream_done_event(self, *, provider: str, model: str, event: ProviderStreamEvent) -> None:
        if not event.usage or not event.cost:
            return
        self._events.append(
            UsageEvent(
                provider=provider,
                model=model,
                credential_type="stream",
                auth_source="runtime_stream",
                traffic_type="runtime",
                input_tokens=event.usage.input_tokens,
                output_tokens=event.usage.output_tokens,
                total_tokens=event.usage.total_tokens,
                actual_cost=event.cost.actual_cost,
                hypothetical_cost=event.cost.hypothetical_cost,
                avoided_cost=event.cost.avoided_cost,
                created_at=datetime.now(tz=UTC).isoformat(),
            )
        )

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
    ) -> None:
        self._events.append(
            UsageEvent(
                provider=provider,
                model=model,
                credential_type=credential_type,
                auth_source=auth_source,
                traffic_type="health_check",
                check_type=check_type,
                input_tokens=usage.input_tokens,
                output_tokens=usage.output_tokens,
                total_tokens=usage.total_tokens,
                actual_cost=cost.actual_cost,
                hypothetical_cost=cost.hypothetical_cost,
                avoided_cost=cost.avoided_cost,
                created_at=datetime.now(tz=UTC).isoformat(),
            )
        )

    def record_health_check_error(
        self,
        *,
        provider: str,
        model: str,
        check_type: str,
        error_type: str,
        status_code: int = 503,
    ) -> None:
        self._errors.append(
            ErrorEvent(
                provider=provider,
                model=model,
                client="control_plane",
                route="/admin/providers/health/run",
                stream_mode="non_stream",
                traffic_type="health_check",
                error_type=f"{check_type}:{error_type}",
                status_code=status_code,
                created_at=datetime.now(tz=UTC).isoformat(),
            )
        )

    def aggregate(self) -> dict[str, object]:
        grouped_provider = defaultdict(lambda: {"requests": 0, "tokens": 0, "actual_cost": 0.0, "hypothetical_cost": 0.0, "avoided_cost": 0.0})
        grouped_model = defaultdict(lambda: {"requests": 0, "tokens": 0})
        grouped_auth = defaultdict(lambda: {"requests": 0, "tokens": 0})
        grouped_traffic = defaultdict(lambda: {"requests": 0, "tokens": 0, "actual_cost": 0.0, "hypothetical_cost": 0.0, "avoided_cost": 0.0})
        grouped_error_provider = defaultdict(lambda: {"errors": 0})
        grouped_error_model = defaultdict(lambda: {"errors": 0})
        grouped_error_client = defaultdict(lambda: {"errors": 0})
        grouped_error_traffic = defaultdict(lambda: {"errors": 0})
        grouped_error_type = defaultdict(lambda: {"errors": 0})

        for event in self._events:
            provider_item = grouped_provider[event.provider]
            provider_item["requests"] += 1
            provider_item["tokens"] += event.total_tokens
            provider_item["actual_cost"] += event.actual_cost
            provider_item["hypothetical_cost"] += event.hypothetical_cost
            provider_item["avoided_cost"] += event.avoided_cost

            model_item = grouped_model[event.model]
            model_item["requests"] += 1
            model_item["tokens"] += event.total_tokens

            auth_item = grouped_auth[f"{event.credential_type}:{event.auth_source}"]
            auth_item["requests"] += 1
            auth_item["tokens"] += event.total_tokens

            traffic_item = grouped_traffic[event.traffic_type]
            traffic_item["requests"] += 1
            traffic_item["tokens"] += event.total_tokens
            traffic_item["actual_cost"] += event.actual_cost
            traffic_item["hypothetical_cost"] += event.hypothetical_cost
            traffic_item["avoided_cost"] += event.avoided_cost

        for error in self._errors:
            grouped_error_provider[error.provider or "unknown"]["errors"] += 1
            grouped_error_model[error.model or "unknown"]["errors"] += 1
            grouped_error_client[error.client]["errors"] += 1
            grouped_error_traffic[error.traffic_type]["errors"] += 1
            grouped_error_type[f"{error.error_type}:{error.status_code}"]["errors"] += 1

        return {
            "event_count": len(self._events),
            "by_provider": [{"provider": key, **value} for key, value in grouped_provider.items()],
            "by_model": [{"model": key, **value} for key, value in grouped_model.items()],
            "by_auth": [{"auth_key": key, **value} for key, value in grouped_auth.items()],
            "by_traffic_type": [{"traffic_type": key, **value} for key, value in grouped_traffic.items()],
            "error_event_count": len(self._errors),
            "errors_by_provider": [{"provider": key, **value} for key, value in grouped_error_provider.items()],
            "errors_by_model": [{"model": key, **value} for key, value in grouped_error_model.items()],
            "errors_by_client": [{"client": key, **value} for key, value in grouped_error_client.items()],
            "errors_by_traffic_type": [{"traffic_type": key, **value} for key, value in grouped_error_traffic.items()],
            "errors_by_type": [{"error_key": key, **value} for key, value in grouped_error_type.items()],
        }


@lru_cache(maxsize=1)
def get_usage_analytics_store() -> UsageAnalyticsStore:
    return UsageAnalyticsStore()

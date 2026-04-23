"""Dedicated execution worker runtime and background response processing."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Callable, Literal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dispatch import DispatchService
from app.core.model_registry import ModelRegistry
from app.core.routing import RoutingBudgetExceededError, RoutingCircuitOpenError, RoutingNoCandidateError, RoutingService
from app.execution.service import ClaimResult, ExecutionTransitionService
from app.instances.service import InstanceService, get_instance_service
from app.providers import ProviderError, ProviderRegistry
from app.request_metadata import merge_request_metadata
from app.responses.models import build_response_object, build_response_output_items
from app.responses.service import QueuedResponseExecutionPayload, ResponseNotFoundError, ResponsesService
from app.responses.translation import response_input_items_to_chat_messages
from app.settings.config import Settings
from app.storage.execution_repository import ExecutionWorkerORM
from app.telemetry.context import TelemetryContext
from app.usage.analytics import ClientIdentity, get_usage_analytics_store

SessionFactory = Callable[[], Session]
WorkerDispatchFactory = Callable[[str], DispatchService]
WorkerCycleOutcome = Literal["idle", "completed", "retry_scheduled", "failed"]

_PUBLIC_RUNTIME_ERROR_CODE_MAP: dict[str, str] = {
    "background_admission_failed": "dispatch_blocked",
    "routing_budget_exceeded": "budget_exceeded",
    "routing_circuit_open": "circuit_open",
    "routing_no_candidate": "dispatch_blocked",
}

_PROVIDER_ERROR_MESSAGES: dict[str, str] = {
    "budget_exceeded": "Routing is blocked by the current ForgeFrame budget posture.",
    "circuit_open": "Routing is blocked because the relevant ForgeFrame target circuits are open.",
    "dispatch_blocked": "ForgeFrame could not admit this request onto any policy-compliant runtime path.",
    "queue_timeout": "ForgeFrame could not complete queue admission within the allowed window.",
    "provider_authentication_error": "Selected provider rejected ForgeFrame credentials.",
    "provider_bad_request": "Selected provider rejected the request.",
    "provider_configuration_error": "Selected provider is not configured for runtime use.",
    "provider_conflict": "Selected provider reported a request conflict.",
    "provider_model_not_found": "Selected provider could not find the requested model.",
    "provider_not_implemented": "Selected provider does not support this runtime operation.",
    "provider_not_ready": "Selected provider is not ready for runtime use.",
    "provider_payload_too_large": "Selected provider rejected the request payload as too large.",
    "provider_protocol_error": "Selected provider returned an invalid response.",
    "provider_rate_limited": "Selected provider rate limited the request.",
    "provider_request_timeout": "Selected provider request timed out.",
    "provider_resource_gone": "Selected provider reported that the requested resource is gone.",
    "provider_stream_interrupted": "Selected provider stream was interrupted.",
    "provider_timeout": "Selected provider timed out while processing the request.",
    "provider_unavailable": "Selected provider is temporarily unavailable.",
    "provider_unsupported_feature": "Requested runtime feature is not supported by the selected provider.",
    "provider_unsupported_media_type": "Selected provider rejected the request media type.",
    "provider_upstream_error": "Selected provider failed while processing the request.",
    "provider_validation_error": "Selected provider rejected the request payload.",
}


def _public_runtime_error_code(error_type: str | None) -> str | None:
    if error_type is None:
        return None
    return _PUBLIC_RUNTIME_ERROR_CODE_MAP.get(error_type, error_type)


def _public_runtime_exception_message(exc: Exception) -> str:
    error_type = getattr(exc, "error_type", None)
    normalized = _public_runtime_error_code(error_type)
    if normalized:
        return _PROVIDER_ERROR_MESSAGES.get(normalized, "Selected provider failed while processing the request.")
    return "Queued background execution failed."


@dataclass(frozen=True)
class ExecutionWorkerStatus:
    worker_key: str
    worker_state: str
    instance_id: str
    execution_lane: str
    active_attempts: int
    current_run_id: str | None
    current_attempt_id: str | None
    last_heartbeat_at: datetime | None
    heartbeat_expires_at: datetime | None
    last_claimed_at: datetime | None
    last_completed_at: datetime | None
    last_error_code: str | None
    last_error_detail: str | None


@dataclass(frozen=True)
class ExecutionWorkerCycleResult:
    worker_key: str
    worker_state: str
    execution_lane: str
    processed: bool
    outcome: WorkerCycleOutcome
    run_id: str | None = None
    attempt_id: str | None = None
    response_id: str | None = None
    detail: str | None = None


class ExecutionWorkerService:
    """Owns dedicated worker lifecycle truth and background response execution."""

    _TRANSIENT_PROVIDER_ERRORS = {
        "provider_not_ready",
        "provider_unavailable",
        "provider_timeout",
        "provider_request_timeout",
        "provider_rate_limited",
        "provider_upstream_error",
    }
    _VALIDATION_PROVIDER_ERRORS = {
        "provider_bad_request",
        "provider_validation_error",
        "provider_model_not_found",
        "provider_unsupported_feature",
        "provider_payload_too_large",
        "provider_unsupported_media_type",
    }
    _TERMINAL_PROVIDER_ERRORS = {
        "provider_authentication_error",
        "provider_configuration_error",
        "provider_not_implemented",
        "provider_protocol_error",
        "provider_resource_gone",
        "provider_conflict",
    }

    def __init__(
        self,
        session_factory: SessionFactory,
        *,
        settings: Settings,
        execution: ExecutionTransitionService,
        responses: ResponsesService,
        instance_service: InstanceService | None = None,
        provider_registry: ProviderRegistry | None = None,
        dispatch_factory: WorkerDispatchFactory | None = None,
        analytics_store: Any | None = None,
    ) -> None:
        self._session_factory = session_factory
        self._settings = settings
        self._execution = execution
        self._responses = responses
        self._instance_service = instance_service or get_instance_service()
        self._provider_registry = provider_registry
        self._dispatch_factory = dispatch_factory or self._default_dispatch_factory
        self._dispatch_cache: dict[str, DispatchService] = {}
        self._analytics_store = analytics_store

    @staticmethod
    def _now(now: datetime | None = None) -> datetime:
        if now is None:
            return datetime.now(tz=UTC)
        if now.tzinfo is None:
            raise ValueError("timestamps must be timezone-aware")
        return now.astimezone(UTC)

    @staticmethod
    def _new_id(prefix: str) -> str:
        return f"{prefix}_{uuid4().hex}"

    def _default_dispatch_factory(self, instance_id: str) -> DispatchService:
        cached = self._dispatch_cache.get(instance_id)
        if cached is not None:
            return cached
        provider_registry = self._provider_registry or ProviderRegistry(self._settings)
        self._provider_registry = provider_registry
        registry = ModelRegistry(self._settings, instance_id=instance_id)
        routing = RoutingService(
            registry,
            provider_registry,
            self._settings,
            instance_id=instance_id,
        )
        dispatch = DispatchService(routing, provider_registry)
        self._dispatch_cache[instance_id] = dispatch
        return dispatch

    def _resolve_instance_id(self, *, company_id: str, instance_id: str | None = None) -> str:
        if instance_id and instance_id.strip():
            return instance_id.strip()
        return self._instance_service.resolve_instance(company_id=company_id).instance_id

    def _analytics(self):
        return self._analytics_store or get_usage_analytics_store()

    @staticmethod
    def _status_from_row(row: ExecutionWorkerORM) -> ExecutionWorkerStatus:
        return ExecutionWorkerStatus(
            worker_key=row.worker_key,
            worker_state=row.worker_state,
            instance_id=row.instance_id,
            execution_lane=row.execution_lane,
            active_attempts=row.active_attempts,
            current_run_id=row.current_run_id,
            current_attempt_id=row.current_attempt_id,
            last_heartbeat_at=row.last_heartbeat_at,
            heartbeat_expires_at=row.heartbeat_expires_at,
            last_claimed_at=row.last_claimed_at,
            last_completed_at=row.last_completed_at,
            last_error_code=row.last_error_code,
            last_error_detail=row.last_error_detail,
        )

    def _upsert_worker(
        self,
        *,
        company_id: str,
        worker_key: str,
        instance_id: str | None,
        execution_lane: str,
        worker_state: str,
        heartbeat_ttl_seconds: int,
        active_attempts: int = 0,
        current_run_id: str | None = None,
        current_attempt_id: str | None = None,
        lease_token: str | None = None,
        process_id: int | None = None,
        error_code: str | None = None,
        error_detail: str | None = None,
        clear_error: bool = False,
        record_claim: bool = False,
        record_completion: bool = False,
        now: datetime | None = None,
    ) -> ExecutionWorkerStatus:
        current_time = self._now(now)
        resolved_instance_id = self._resolve_instance_id(company_id=company_id, instance_id=instance_id)
        with self._session_factory() as session, session.begin():
            row = session.execute(
                select(ExecutionWorkerORM).where(
                    ExecutionWorkerORM.company_id == company_id,
                    ExecutionWorkerORM.worker_key == worker_key,
                )
            ).scalars().first()
            if row is None:
                row = ExecutionWorkerORM(
                    id=self._new_id("worker"),
                    company_id=company_id,
                    instance_id=resolved_instance_id,
                    worker_key=worker_key,
                    execution_lane=execution_lane,
                    worker_state=worker_state,
                    active_attempts=max(0, active_attempts),
                    current_run_id=current_run_id,
                    current_attempt_id=current_attempt_id,
                    lease_token=lease_token,
                    process_id=process_id,
                    started_at=current_time if worker_state != "stopped" else None,
                    stopped_at=current_time if worker_state == "stopped" else None,
                    last_claimed_at=current_time if record_claim else None,
                    last_completed_at=current_time if record_completion else None,
                    last_heartbeat_at=current_time,
                    heartbeat_expires_at=current_time + timedelta(seconds=max(0, heartbeat_ttl_seconds)),
                    last_error_code=error_code,
                    last_error_detail=error_detail,
                    created_at=current_time,
                    updated_at=current_time,
                )
                session.add(row)
                session.flush()
                return self._status_from_row(row)

            row.instance_id = resolved_instance_id
            row.execution_lane = execution_lane
            row.worker_state = worker_state
            row.active_attempts = max(0, active_attempts)
            row.current_run_id = current_run_id
            row.current_attempt_id = current_attempt_id
            row.lease_token = lease_token
            row.process_id = process_id if process_id is not None else row.process_id
            row.last_heartbeat_at = current_time
            row.heartbeat_expires_at = current_time + timedelta(seconds=max(0, heartbeat_ttl_seconds))
            if row.started_at is None and worker_state != "stopped":
                row.started_at = current_time
            if worker_state == "stopped":
                row.stopped_at = current_time
            elif worker_state in {"starting", "idle", "busy"}:
                row.stopped_at = None
            if record_claim:
                row.last_claimed_at = current_time
            if record_completion:
                row.last_completed_at = current_time
            if clear_error:
                row.last_error_code = None
                row.last_error_detail = None
            else:
                if error_code is not None:
                    row.last_error_code = error_code
                if error_detail is not None:
                    row.last_error_detail = error_detail
            row.updated_at = current_time
            session.flush()
            return self._status_from_row(row)

    def start_worker(
        self,
        *,
        company_id: str,
        worker_key: str,
        execution_lane: str,
        instance_id: str | None = None,
        heartbeat_ttl_seconds: int = 90,
        process_id: int | None = None,
        now: datetime | None = None,
    ) -> ExecutionWorkerStatus:
        return self._upsert_worker(
            company_id=company_id,
            worker_key=worker_key,
            instance_id=instance_id,
            execution_lane=execution_lane,
            worker_state="starting",
            heartbeat_ttl_seconds=heartbeat_ttl_seconds,
            active_attempts=0,
            current_run_id=None,
            current_attempt_id=None,
            lease_token=None,
            process_id=process_id,
            clear_error=True,
            now=now,
        )

    def heartbeat_worker(
        self,
        *,
        company_id: str,
        worker_key: str,
        execution_lane: str,
        worker_state: str = "idle",
        instance_id: str | None = None,
        heartbeat_ttl_seconds: int = 90,
        active_attempts: int = 0,
        current_run_id: str | None = None,
        current_attempt_id: str | None = None,
        lease_token: str | None = None,
        process_id: int | None = None,
        error_code: str | None = None,
        error_detail: str | None = None,
        clear_error: bool = False,
        record_claim: bool = False,
        record_completion: bool = False,
        now: datetime | None = None,
    ) -> ExecutionWorkerStatus:
        return self._upsert_worker(
            company_id=company_id,
            worker_key=worker_key,
            instance_id=instance_id,
            execution_lane=execution_lane,
            worker_state=worker_state,
            heartbeat_ttl_seconds=heartbeat_ttl_seconds,
            active_attempts=active_attempts,
            current_run_id=current_run_id,
            current_attempt_id=current_attempt_id,
            lease_token=lease_token,
            process_id=process_id,
            error_code=error_code,
            error_detail=error_detail,
            clear_error=clear_error,
            record_claim=record_claim,
            record_completion=record_completion,
            now=now,
        )

    def fail_worker(
        self,
        *,
        company_id: str,
        worker_key: str,
        execution_lane: str,
        instance_id: str | None = None,
        heartbeat_ttl_seconds: int = 90,
        current_run_id: str | None = None,
        current_attempt_id: str | None = None,
        error_code: str,
        error_detail: str,
        process_id: int | None = None,
        now: datetime | None = None,
    ) -> ExecutionWorkerStatus:
        return self._upsert_worker(
            company_id=company_id,
            worker_key=worker_key,
            instance_id=instance_id,
            execution_lane=execution_lane,
            worker_state="failed",
            heartbeat_ttl_seconds=heartbeat_ttl_seconds,
            active_attempts=1 if current_attempt_id else 0,
            current_run_id=current_run_id,
            current_attempt_id=current_attempt_id,
            lease_token=None,
            process_id=process_id,
            error_code=error_code,
            error_detail=error_detail,
            clear_error=False,
            now=now,
        )

    def stop_worker(
        self,
        *,
        company_id: str,
        worker_key: str,
        execution_lane: str,
        instance_id: str | None = None,
        reason: str | None = None,
        process_id: int | None = None,
        now: datetime | None = None,
    ) -> ExecutionWorkerStatus:
        return self._upsert_worker(
            company_id=company_id,
            worker_key=worker_key,
            instance_id=instance_id,
            execution_lane=execution_lane,
            worker_state="stopped",
            heartbeat_ttl_seconds=0,
            active_attempts=0,
            current_run_id=None,
            current_attempt_id=None,
            lease_token=None,
            process_id=process_id,
            error_code="worker_stopped" if reason else None,
            error_detail=reason,
            clear_error=reason is None,
            now=now,
        )

    @staticmethod
    def _in_progress_body(payload: QueuedResponseExecutionPayload) -> dict[str, Any]:
        return build_response_object(
            response_id=payload.response_id,
            created_at=payload.created_at,
            status="in_progress",
            background=True,
            model=payload.request.model,
            metadata=payload.request.metadata,
        ).model_dump(mode="json")

    @staticmethod
    def _completed_body(
        payload: QueuedResponseExecutionPayload,
        *,
        model: str,
        text: str,
        tool_calls: list[dict[str, Any]] | None,
        usage: Any,
        cost: Any,
    ) -> dict[str, Any]:
        output, output_text = build_response_output_items(text=text, tool_calls=tool_calls)
        return build_response_object(
            response_id=payload.response_id,
            created_at=payload.created_at,
            status="completed",
            background=True,
            model=model,
            metadata=payload.request.metadata,
            output=output,
            output_text=output_text,
            usage=usage,
            cost=cost,
        ).model_dump(mode="json")

    @staticmethod
    def _retry_scheduled_body(
        payload: QueuedResponseExecutionPayload,
        *,
        error_code: str,
        error_message: str,
        retry_delay_seconds: int | None,
    ) -> dict[str, Any]:
        return build_response_object(
            response_id=payload.response_id,
            created_at=payload.created_at,
            status="queued",
            background=True,
            model=payload.request.model,
            metadata=payload.request.metadata,
            incomplete_details={
                "reason": "retry_scheduled",
                "error_code": error_code,
                "error_message": error_message,
                "retry_delay_seconds": retry_delay_seconds,
            },
        ).model_dump(mode="json")

    @staticmethod
    def _failed_body(
        payload: QueuedResponseExecutionPayload,
        *,
        error_code: str,
        error_message: str,
    ) -> dict[str, Any]:
        return build_response_object(
            response_id=payload.response_id,
            created_at=payload.created_at,
            status="failed",
            background=True,
            model=payload.request.model,
            metadata=payload.request.metadata,
            error={"code": error_code, "message": error_message},
        ).model_dump(mode="json")

    @staticmethod
    def _client_identity(payload: QueuedResponseExecutionPayload) -> ClientIdentity:
        client = dict(payload.request.client or {})
        return ClientIdentity(
            client_id=str(client.get("client_id") or f"background::{payload.response_id}"),
            consumer=str(client.get("consumer") or "background_worker"),
            integration=str(client.get("integration") or "responses_background"),
            tenant_id=payload.instance_id,
        )

    @staticmethod
    def _telemetry_context(
        payload: QueuedResponseExecutionPayload,
        *,
        duration_ms: int | None = None,
    ) -> TelemetryContext:
        context = TelemetryContext(
            route=payload.request_path,
            operation="responses.background.execute",
            service_name="forgeframe-execution-worker",
            service_kind="worker",
        )
        return context.with_duration(duration_ms)

    @staticmethod
    def _failure_status_code(exc: Exception, *, error_code: str, retryable: bool) -> int:
        upstream_status = getattr(exc, "upstream_status_code", None)
        if isinstance(upstream_status, int) and upstream_status >= 400:
            return upstream_status
        explicit = {
            "budget_exceeded": 429,
            "circuit_open": 503,
            "dispatch_blocked": 503,
            "queue_timeout": 504,
            "provider_authentication_error": 401,
            "provider_bad_request": 400,
            "provider_configuration_error": 503,
            "provider_conflict": 409,
            "provider_model_not_found": 404,
            "provider_not_implemented": 501,
            "provider_not_ready": 503,
            "provider_payload_too_large": 413,
            "provider_protocol_error": 502,
            "provider_rate_limited": 429,
            "provider_request_timeout": 408,
            "provider_resource_gone": 410,
            "provider_stream_interrupted": 502,
            "provider_timeout": 504,
            "provider_unavailable": 503,
            "provider_unsupported_feature": 400,
            "provider_unsupported_media_type": 415,
            "provider_upstream_error": 502,
            "provider_validation_error": 422,
            "invalid_request": 422,
        }
        return explicit.get(error_code, 503 if retryable else 500)

    def _success_summary(
        self,
        *,
        claim: ClaimResult,
        payload: QueuedResponseExecutionPayload,
        result: Any,
        decision: Any | None,
    ) -> dict[str, Any]:
        usage = result.usage.model_dump(mode="json") if hasattr(result.usage, "model_dump") else dict(result.usage or {})
        cost = result.cost.model_dump(mode="json") if hasattr(result.cost, "model_dump") else dict(result.cost or {})
        summary: dict[str, Any] = {
            "response_id": payload.response_id,
            "processing_mode": "background",
            "provider_key": result.provider,
            "resolved_model": result.model,
            "execution_lane": claim.execution_lane,
            "usage": usage,
            "cost": cost,
            "dispatch": {
                "stage": "completed",
                "run_id": claim.run_id,
                "attempt_id": claim.attempt_id,
                "execution_lane": claim.execution_lane,
            },
            "wake_gate": {
                "claim_allowed": True,
                "spurious_wake_blocked": False,
            },
        }
        if decision is not None:
            summary["routing"] = {
                "decision_id": getattr(decision, "decision_id", None),
                "summary": getattr(decision, "summary", None),
                "classification": getattr(decision, "classification", None),
                "policy_stage": getattr(decision, "policy_stage", None),
                "selected_target_key": getattr(getattr(decision, "resolved_target", None), "target_key", None),
                "structured_explainability": getattr(decision, "structured_explainability", {}),
                "raw_explainability": getattr(decision, "raw_explainability", {}),
            }
        return summary

    def _classify_failure(
        self,
        exc: Exception,
    ) -> tuple[str, str, str, str, bool, int | None]:
        error_type = getattr(exc, "error_type", None)
        error_code = _public_runtime_error_code(error_type) or "background_worker_failed"
        error_message = _public_runtime_exception_message(exc)
        error_detail = str(exc) or error_message
        retry_after_seconds = getattr(exc, "retry_after_seconds", None)

        if isinstance(exc, RoutingBudgetExceededError):
            return "policy", error_code, error_message, error_detail, False, None
        if isinstance(exc, RoutingCircuitOpenError):
            return "provider_transient", error_code, error_message, error_detail, True, None
        if isinstance(exc, RoutingNoCandidateError):
            return "policy", error_code, error_message, error_detail, False, None
        if isinstance(exc, ProviderError):
            if exc.retryable or exc.error_type in self._TRANSIENT_PROVIDER_ERRORS:
                return "provider_transient", error_code, error_message, error_detail, True, retry_after_seconds
            if exc.error_type in self._VALIDATION_PROVIDER_ERRORS:
                return "validation", error_code, error_message, error_detail, False, None
            if exc.error_type in self._TERMINAL_PROVIDER_ERRORS:
                return "provider_terminal", error_code, error_message, error_detail, False, None
            return "provider_terminal", error_code, error_message, error_detail, False, None
        if isinstance(exc, ValueError):
            return "validation", "invalid_request", str(exc), str(exc), False, None
        return "internal", error_code, error_message, error_detail, False, None

    def _record_failure(
        self,
        *,
        company_id: str,
        worker_key: str,
        execution_lane: str,
        claim: ClaimResult,
        payload: QueuedResponseExecutionPayload | None,
        exc: Exception,
        heartbeat_ttl_seconds: int,
        current_time: datetime,
    ) -> ExecutionWorkerCycleResult:
        failure_class, error_code, error_message, error_detail, retryable, retry_after_seconds = self._classify_failure(exc)
        if payload is not None:
            analytics = self._analytics()
            request_metadata = merge_request_metadata(
                payload.request.metadata,
                {
                    "instance_id": payload.instance_id,
                    "execution_run_id": claim.run_id,
                    "attempt_id": claim.attempt_id,
                    "worker_key": worker_key,
                    "response_id": payload.response_id,
                },
            )
            analytics.record_runtime_error(
                provider=getattr(exc, "provider", None),
                model=payload.request.model,
                client=self._client_identity(payload),
                route=payload.request_path,
                stream_mode="non_stream",
                error_type=error_code,
                status_code=self._failure_status_code(exc, error_code=error_code, retryable=retryable),
                context=self._telemetry_context(payload),
                request_metadata=request_metadata,
            )
        try:
            failure = self._execution.record_attempt_failure(
                company_id=company_id,
                run_id=claim.run_id,
                attempt_id=claim.attempt_id,
                lease_token=claim.lease_token,
                failure_class=failure_class,
                error_code=error_code,
                error_detail=error_detail,
                retryable=retryable,
                max_attempts=self._settings.execution_max_attempts,
                backoff_base_seconds=self._settings.execution_retry_backoff_base_seconds,
                backoff_max_seconds=self._settings.execution_retry_backoff_max_seconds,
                backoff_jitter_ratio=self._settings.execution_retry_backoff_jitter_ratio,
                retry_after_seconds=retry_after_seconds,
                now=current_time,
            )
        except Exception as transition_exc:
            self.fail_worker(
                company_id=company_id,
                worker_key=worker_key,
                execution_lane=execution_lane,
                instance_id=payload.instance_id if payload is not None else None,
                heartbeat_ttl_seconds=heartbeat_ttl_seconds,
                current_run_id=claim.run_id,
                current_attempt_id=claim.attempt_id,
                error_code="worker_transition_failure",
                error_detail=str(transition_exc),
                now=current_time,
            )
            raise

        if payload is not None:
            if failure.retry_scheduled:
                body = self._retry_scheduled_body(
                    payload,
                    error_code=error_code,
                    error_message=error_message,
                    retry_delay_seconds=failure.retry_delay_seconds,
                )
                lifecycle_status = "queued"
                error_json = {
                    "code": error_code,
                    "message": error_message,
                    "retry_scheduled": True,
                    "retry_delay_seconds": failure.retry_delay_seconds,
                }
            else:
                body = self._failed_body(
                    payload,
                    error_code=error_code,
                    error_message=error_message,
                )
                lifecycle_status = "failed"
                error_json = {"code": error_code, "message": error_message}
            self._responses.save_response_snapshot(
                response_id=payload.response_id,
                company_id=company_id,
                instance_id=payload.instance_id,
                account_id=None,
                request_path=payload.request_path,
                processing_mode="background",
                stream=False,
                request=payload.request,
                body=body,
                lifecycle_status=lifecycle_status,
                error_json=error_json,
                execution_run_id=claim.run_id,
                now=current_time,
            )

        self.heartbeat_worker(
            company_id=company_id,
            worker_key=worker_key,
            instance_id=payload.instance_id if payload is not None else None,
            execution_lane=execution_lane,
            worker_state="idle",
            heartbeat_ttl_seconds=heartbeat_ttl_seconds,
            active_attempts=0,
            current_run_id=None,
            current_attempt_id=None,
            lease_token=None,
            error_code=error_code,
            error_detail=error_detail,
            clear_error=False,
            now=current_time,
        )
        return ExecutionWorkerCycleResult(
            worker_key=worker_key,
            worker_state="idle",
            execution_lane=execution_lane,
            processed=True,
            outcome="retry_scheduled" if failure.retry_scheduled else "failed",
            run_id=claim.run_id,
            attempt_id=claim.attempt_id,
            response_id=payload.response_id if payload is not None else None,
            detail=error_code,
        )

    def run_background_cycle(
        self,
        *,
        company_id: str,
        worker_key: str,
        execution_lane: str = "background_agentic",
        run_kind: str = "responses_background",
        instance_id: str | None = None,
        process_id: int | None = None,
        lease_ttl_seconds: int = 300,
        heartbeat_ttl_seconds: int = 360,
        now: datetime | None = None,
    ) -> ExecutionWorkerCycleResult:
        current_time = self._now(now)
        resolved_instance_id = self._resolve_instance_id(company_id=company_id, instance_id=instance_id)
        self.heartbeat_worker(
            company_id=company_id,
            worker_key=worker_key,
            instance_id=resolved_instance_id,
            execution_lane=execution_lane,
            worker_state="idle",
            heartbeat_ttl_seconds=heartbeat_ttl_seconds,
            active_attempts=0,
            current_run_id=None,
            current_attempt_id=None,
            lease_token=None,
            process_id=process_id,
            clear_error=True,
            now=current_time,
        )

        claim = self._execution.claim_next_attempt(
            company_id=company_id,
            worker_key=worker_key,
            execution_lane=execution_lane,
            run_kind=run_kind,
            lease_ttl_seconds=lease_ttl_seconds,
            now=current_time,
        )
        if claim is None:
            return ExecutionWorkerCycleResult(
                worker_key=worker_key,
                worker_state="idle",
                execution_lane=execution_lane,
                processed=False,
                outcome="idle",
                detail="no_claimable_attempt",
            )

        self.heartbeat_worker(
            company_id=company_id,
            worker_key=worker_key,
            instance_id=resolved_instance_id,
            execution_lane=execution_lane,
            worker_state="busy",
            heartbeat_ttl_seconds=heartbeat_ttl_seconds,
            active_attempts=1,
            current_run_id=claim.run_id,
            current_attempt_id=claim.attempt_id,
            lease_token=claim.lease_token,
            process_id=process_id,
            clear_error=True,
            record_claim=True,
            now=current_time,
        )

        payload: QueuedResponseExecutionPayload | None = None
        try:
            payload = self._responses.get_background_execution_payload(
                company_id=company_id,
                execution_run_id=claim.run_id,
            )
            analytics = self._analytics()
            client_identity = self._client_identity(payload)
            request_metadata = merge_request_metadata(
                self._telemetry_context(payload).as_request_metadata(),
                payload.request.metadata,
                {
                    "instance_id": payload.instance_id,
                    "execution_run_id": claim.run_id,
                    "attempt_id": claim.attempt_id,
                    "worker_key": worker_key,
                    "response_id": payload.response_id,
                },
            )
            dispatch = self._dispatch_factory(payload.instance_id)
            self._execution.mark_attempt_executing(
                company_id=company_id,
                run_id=claim.run_id,
                attempt_id=claim.attempt_id,
                lease_token=claim.lease_token,
                step_key="responses_background_dispatch",
                now=current_time,
            )
            self._responses.save_response_snapshot(
                response_id=payload.response_id,
                company_id=company_id,
                instance_id=payload.instance_id,
                account_id=None,
                request_path=payload.request_path,
                processing_mode="background",
                stream=False,
                request=payload.request,
                body=self._in_progress_body(payload),
                lifecycle_status="in_progress",
                execution_run_id=claim.run_id,
                now=current_time,
            )
            translated_messages = response_input_items_to_chat_messages(
                payload.request.input_items,
                instructions=payload.request.instructions,
            )
            dispatch_result, _decision = dispatch.dispatch_chat(
                requested_model=payload.request.model,
                messages=translated_messages,
                stream=False,
                tools=payload.request.tools,
                tool_choice=payload.request.tool_choice,
                request_metadata=request_metadata,
                response_controls=self._responses.response_controls_for_request(payload.request),
            )
            completed_body = self._completed_body(
                payload,
                model=dispatch_result.model,
                text=dispatch_result.content,
                tool_calls=dispatch_result.tool_calls,
                usage=dispatch_result.usage,
                cost=dispatch_result.cost,
            )
            self._responses.save_response_snapshot(
                response_id=payload.response_id,
                company_id=company_id,
                instance_id=payload.instance_id,
                account_id=None,
                request_path=payload.request_path,
                processing_mode="background",
                stream=False,
                request=payload.request,
                body=completed_body,
                lifecycle_status="completed",
                resolved_model=dispatch_result.model,
                provider_key=dispatch_result.provider,
                execution_run_id=claim.run_id,
                now=current_time,
            )
            analytics.record_non_stream_result(
                dispatch_result,
                client=client_identity,
                context=self._telemetry_context(payload),
                request_metadata=request_metadata,
            )
            self._execution.complete_attempt_success(
                company_id=company_id,
                run_id=claim.run_id,
                attempt_id=claim.attempt_id,
                lease_token=claim.lease_token,
                result_summary=self._success_summary(
                    claim=claim,
                    payload=payload,
                    result=dispatch_result,
                    decision=_decision,
                ),
                now=current_time,
            )
            self.heartbeat_worker(
                company_id=company_id,
                worker_key=worker_key,
                instance_id=payload.instance_id,
                execution_lane=execution_lane,
                worker_state="idle",
                heartbeat_ttl_seconds=heartbeat_ttl_seconds,
                active_attempts=0,
                current_run_id=None,
                current_attempt_id=None,
                lease_token=None,
                process_id=process_id,
                clear_error=True,
                record_completion=True,
                now=current_time,
            )
            return ExecutionWorkerCycleResult(
                worker_key=worker_key,
                worker_state="idle",
                execution_lane=execution_lane,
                processed=True,
                outcome="completed",
                run_id=claim.run_id,
                attempt_id=claim.attempt_id,
                response_id=payload.response_id,
                detail="completed",
            )
        except ResponseNotFoundError as exc:
            return self._record_failure(
                company_id=company_id,
                worker_key=worker_key,
                execution_lane=execution_lane,
                claim=claim,
                payload=None,
                exc=exc,
                heartbeat_ttl_seconds=heartbeat_ttl_seconds,
                current_time=current_time,
            )
        except Exception as exc:
            return self._record_failure(
                company_id=company_id,
                worker_key=worker_key,
                execution_lane=execution_lane,
                claim=claim,
                payload=payload,
                exc=exc,
                heartbeat_ttl_seconds=heartbeat_ttl_seconds,
                current_time=current_time,
            )


__all__ = [
    "ExecutionWorkerCycleResult",
    "ExecutionWorkerService",
    "ExecutionWorkerStatus",
]

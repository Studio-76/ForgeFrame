"""Native runtime responses entrypoint on `/v1/responses`."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterator
from time import monotonic
from typing import Any

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse, StreamingResponse

from app.authz import RequestActor
from app.api.runtime.access import (
    allowed_provider_set,
    ensure_runtime_model_access,
    list_public_runtime_model_ids,
    requested_model_blocked_by_disabled_public_bridge,
)
from app.api.runtime.chat import _duration_ms, _error_response, _provider_exception_to_http, _routing_headers
from app.api.runtime.dependencies import (
    get_dispatch_service,
    get_model_registry,
    get_responses_service,
    get_routing_service,
    get_runtime_gateway_identity,
    get_runtime_request_path_decision,
    get_settings,
    require_runtime_permission,
    runtime_request_path_metadata,
)
from app.api.runtime.errors import (
    public_background_error_type,
    public_runtime_exception_message,
    public_runtime_provider_message,
)
from app.api.runtime.schemas import ResponsesRequest
from app.core.dispatch import DispatchService
from app.core.model_registry import ModelRegistry
from app.core.routing import RoutingService
from app.governance.errors import RuntimeAuthorizationError
from app.governance.models import RuntimeGatewayIdentity, RuntimeRequestPathDecision
from app.governance.service import GovernanceService, get_governance_service
from app.responses.models import (
    NormalizedResponsesRequest,
    build_response_object,
    build_response_output_items,
    new_response_created,
    new_response_id,
)
from app.responses.service import ResponseNotFoundError, ResponsesRequestValidationError, ResponsesService
from app.responses.translation import response_input_items_to_chat_messages
from app.request_metadata import merge_request_metadata
from app.settings.config import Settings
from app.telemetry.context import telemetry_context_from_request
from app.tenancy import normalize_tenant_id
from app.usage.analytics import ClientIdentity, get_usage_analytics_store

router = APIRouter(tags=["runtime-responses"])


def _resolve_client_identity(
    request: Request,
    payload: ResponsesRequest,
    gateway_identity: RuntimeGatewayIdentity | None,
    *,
    default_tenant_id: str,
) -> ClientIdentity:
    if gateway_identity is not None:
        return ClientIdentity(
            client_id=gateway_identity.client_id,
            consumer=gateway_identity.consumer,
            integration=gateway_identity.integration,
            tenant_id=gateway_identity.account_id or default_tenant_id,
        )
    return ClientIdentity(
        client_id=(
            payload.client.get("client_id")
            or request.headers.get("x-forgeframe-client")
            or request.headers.get("x-forgegate-client")
            or request.headers.get("user-agent")
            or "unknown_client"
        ),
        consumer=(
            payload.client.get("consumer")
            or request.headers.get("x-forgeframe-consumer")
            or request.headers.get("x-forgegate-consumer")
            or "unknown_consumer"
        ),
        integration=(
            payload.client.get("integration")
            or request.headers.get("x-forgeframe-integration")
            or request.headers.get("x-forgegate-integration")
            or "unknown_integration"
        ),
        tenant_id=default_tenant_id,
    )


def _runtime_company_id(
    *,
    gateway_identity: RuntimeGatewayIdentity | None,
    settings: Settings,
) -> str:
    return normalize_tenant_id(
        gateway_identity.account_id if gateway_identity is not None else settings.bootstrap_tenant_id,
        fallback_tenant_id=settings.bootstrap_tenant_id,
    )


def _runtime_instance_id(
    *,
    gateway_identity: RuntimeGatewayIdentity | None,
    settings: Settings,
) -> str:
    return normalize_tenant_id(
        gateway_identity.instance_id if gateway_identity is not None else settings.bootstrap_tenant_id,
        fallback_tenant_id=settings.bootstrap_tenant_id,
    )


def _runtime_account_id(gateway_identity: RuntimeGatewayIdentity | None) -> str | None:
    if gateway_identity is None:
        return None
    return gateway_identity.account_id


def _request_fingerprint(request: NormalizedResponsesRequest) -> str:
    serialized = json.dumps(
        request.model_dump(mode="json"),
        ensure_ascii=True,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _responses_validation_error_response(exc: ResponsesRequestValidationError) -> JSONResponse:
    extra: dict[str, object] = {}
    if exc.param:
        extra["param"] = exc.param
    if exc.code:
        extra["code"] = exc.code
    return _error_response(
        status_code=exc.status_code,
        error_type=exc.error_type,
        message=exc.message,
        **extra,
    )


def _response_not_found(response_id: str) -> JSONResponse:
    return _error_response(
        status_code=status.HTTP_404_NOT_FOUND,
        error_type="response_not_found",
        message=f"Response '{response_id}' was not found.",
    )


def _response_in_progress_payload(
    *,
    response_id: str,
    created_at: int,
    model: str | None,
    metadata: dict[str, Any],
    native_mapping: dict[str, Any],
) -> dict[str, object]:
    return build_response_object(
        response_id=response_id,
        created_at=created_at,
        status="in_progress",
        background=False,
        model=model,
        metadata=metadata,
        native_mapping=native_mapping,
    ).model_dump(mode="json")


def _response_completed_payload(
    *,
    response_id: str,
    created_at: int,
    model: str | None,
    metadata: dict[str, Any],
    text: str,
    tool_calls: list[dict[str, Any]] | None,
    usage: Any,
    cost: Any,
    native_mapping: dict[str, Any],
) -> dict[str, object]:
    output, output_text = build_response_output_items(
        text=text,
        tool_calls=tool_calls,
    )
    return build_response_object(
        response_id=response_id,
        created_at=created_at,
        status="completed",
        background=False,
        model=model,
        metadata=metadata,
        output=output,
        output_text=output_text,
        usage=usage,
        cost=cost,
        native_mapping=native_mapping,
    ).model_dump(mode="json")


def _response_failed_payload(
    *,
    response_id: str,
    created_at: int,
    model: str | None,
    metadata: dict[str, Any],
    error_code: str,
    error_message: str,
    native_mapping: dict[str, Any],
) -> dict[str, object]:
    return build_response_object(
        response_id=response_id,
        created_at=created_at,
        status="failed",
        background=False,
        model=model,
        metadata=metadata,
        error={"code": error_code, "message": error_message},
        native_mapping=native_mapping,
    ).model_dump(mode="json")


def _responses_control_payload(request: NormalizedResponsesRequest) -> dict[str, object]:
    return ResponsesService.response_controls_for_request(request)


@router.post("/responses", response_model=None)
def create_response(
    payload: ResponsesRequest,
    request: Request,
    registry: ModelRegistry = Depends(get_model_registry),
    dispatch: DispatchService = Depends(get_dispatch_service),
    routing: RoutingService = Depends(get_routing_service),
    responses: ResponsesService = Depends(get_responses_service),
    settings: Settings = Depends(get_settings),
    gateway_identity: RuntimeGatewayIdentity | None = Depends(get_runtime_gateway_identity),
    request_path_decision: RuntimeRequestPathDecision | None = Depends(get_runtime_request_path_decision),
    governance: GovernanceService = Depends(get_governance_service),
    _runtime_actor: RequestActor | None = Depends(require_runtime_permission("runtime.responses.write")),
) -> object:
    try:
        normalized_request = responses.normalize_request(payload)
    except ResponsesRequestValidationError as exc:
        return _responses_validation_error_response(exc)

    analytics = get_usage_analytics_store()
    runtime_route = request.url.path or "/v1/responses"
    started_at = monotonic()
    telemetry_context = telemetry_context_from_request(
        request,
        route=runtime_route,
        operation="runtime.responses.create",
        service_name="forgeframe-runtime-api",
        service_kind="runtime_api",
    )
    client_identity = _resolve_client_identity(
        request,
        payload,
        gateway_identity,
        default_tenant_id=settings.bootstrap_tenant_id,
    )
    requested_model = normalized_request.model
    stream_mode = "stream" if normalized_request.stream else "non_stream"
    company_id = _runtime_company_id(
        gateway_identity=gateway_identity,
        settings=settings,
    )
    instance_id = _runtime_instance_id(
        gateway_identity=gateway_identity,
        settings=settings,
    )
    account_id = _runtime_account_id(gateway_identity)
    path_metadata = runtime_request_path_metadata(request_path_decision)
    normalized_request = normalized_request.model_copy(
        update={
            "metadata": merge_request_metadata(normalized_request.metadata, path_metadata),
            "background": (
                True
                if request_path_decision is not None and request_path_decision.request_path == "queue_background"
                else normalized_request.background
            ),
        }
    )
    if (
        request_path_decision is not None
        and request_path_decision.request_path == "queue_background"
        and normalized_request.stream
    ):
        return _error_response(
            status_code=status.HTTP_409_CONFLICT,
            error_type="request_path_blocked",
            message="Queue-background runtime path cannot be combined with stream=true.",
        )
    runtime_request_metadata = merge_request_metadata(
        telemetry_context.as_request_metadata(),
        normalized_request.metadata,
        {
            "instance_id": instance_id,
            "company_id": company_id,
            "account_id": account_id,
        },
    )

    try:
        ensure_runtime_model_access(
            requested_model=requested_model,
            registry=registry,
            identity=gateway_identity,
            governance=governance,
        )
    except RuntimeAuthorizationError as exc:
        analytics.record_runtime_error(
            provider=None,
            model=requested_model,
            client=client_identity,
            route=runtime_route,
            stream_mode=stream_mode,
            error_type=exc.error_type,
            status_code=exc.status_code,
            context=telemetry_context.with_duration(_duration_ms(started_at)),
            request_metadata=runtime_request_metadata,
        )
        return _error_response(
            status_code=exc.status_code,
            error_type=exc.error_type,
            message=public_runtime_exception_message(exc),
        )

    public_model_ids: list[str] | None = None
    if requested_model_blocked_by_disabled_public_bridge(
        requested_model=requested_model,
        registry=registry,
        settings=settings,
    ):
        public_model_ids = list_public_runtime_model_ids(
            routing=routing,
            identity=gateway_identity,
            route_context=path_metadata,
        )
        analytics.record_runtime_error(
            provider=None,
            model=requested_model,
            client=client_identity,
            route=runtime_route,
            stream_mode=stream_mode,
            error_type="model_not_found",
            status_code=status.HTTP_404_NOT_FOUND,
            context=telemetry_context.with_duration(_duration_ms(started_at)),
            request_metadata=runtime_request_metadata,
        )
        return _error_response(
            status_code=status.HTTP_404_NOT_FOUND,
            error_type="model_not_found",
            message=f"Requested model '{requested_model}' is not available.",
            available_models=public_model_ids,
        )
    if requested_model and not registry.has_model(requested_model) and not settings.runtime_allow_unknown_models:
        analytics.record_runtime_error(
            provider=None,
            model=requested_model,
            client=client_identity,
            route=runtime_route,
            stream_mode=stream_mode,
            error_type="model_not_found",
            status_code=status.HTTP_404_NOT_FOUND,
            context=telemetry_context.with_duration(_duration_ms(started_at)),
            request_metadata=runtime_request_metadata,
        )
        return _error_response(
            status_code=status.HTTP_404_NOT_FOUND,
            error_type="model_not_found",
            message=f"Requested model '{requested_model}' is not available.",
            available_models=public_model_ids if public_model_ids is not None else list_public_runtime_model_ids(
                routing=routing,
                identity=gateway_identity,
                route_context=path_metadata,
            ),
        )

    if normalized_request.background:
        try:
            response, _run_id = responses.create_background_response(
                company_id=company_id,
                instance_id=instance_id,
                account_id=account_id,
                request_path=runtime_route,
                request=normalized_request,
                request_fingerprint_hash=_request_fingerprint(normalized_request),
            )
        except Exception as exc:
            error_type = public_background_error_type(exc)
            analytics.record_runtime_error(
                provider=None,
                model=requested_model,
                client=client_identity,
                route=runtime_route,
                stream_mode="non_stream",
                error_type=error_type,
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                context=telemetry_context.with_duration(_duration_ms(started_at)),
                request_metadata=runtime_request_metadata,
            )
            return _error_response(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                error_type=error_type,
                message=public_runtime_provider_message(error_type),
            )
        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content=response.model_dump(mode="json"),
            headers={
                "Location": f"{settings.api_base}/responses/{response.id}",
                "X-ForgeFrame-Request-Path": request_path_decision.request_path if request_path_decision is not None else "queue_background",
            },
        )

    try:
        translated_messages = response_input_items_to_chat_messages(
            normalized_request.input_items,
            instructions=normalized_request.instructions,
        )
    except ValueError as exc:
        return _error_response(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            error_type="invalid_request",
            message=str(exc),
        )

    response_id = new_response_id()
    response_created = new_response_created()
    response_controls = _responses_control_payload(normalized_request)
    allowed_providers = allowed_provider_set(gateway_identity)
    response_request_metadata = merge_request_metadata(
        runtime_request_metadata,
        {"response_id": response_id},
    )

    if normalized_request.stream:
        try:
            model, provider, events, decision = dispatch.dispatch_chat_stream(
                requested_model=requested_model,
                messages=translated_messages,
                tools=normalized_request.tools,
                tool_choice=normalized_request.tool_choice,
                allowed_providers=allowed_providers,
                request_metadata=response_request_metadata,
                response_controls=response_controls,
            )
        except Exception as exc:
            status_code, error_type, provider, message, extra = _provider_exception_to_http(exc)
            analytics.record_runtime_error(
                provider=provider,
                model=requested_model,
                client=client_identity,
                route=runtime_route,
                stream_mode="stream",
                error_type=error_type,
                status_code=status_code,
                context=telemetry_context.with_duration(_duration_ms(started_at)),
                request_metadata=response_request_metadata,
            )
            return _error_response(
                status_code=status_code,
                error_type=error_type,
                message=message,
                **extra,
            )

        created_payload = _response_in_progress_payload(
            response_id=response_id,
            created_at=response_created,
            model=model,
            metadata=normalized_request.metadata,
            native_mapping=responses.build_sync_runtime_native_mapping(
                request_path=runtime_route,
                response_id=response_id,
                stream=True,
                requested_model=requested_model,
                resolved_model=model,
                provider_key=provider,
                note="The streaming /v1/responses path is still on the OpenAI-compatible envelope and has not created a durable native ForgeFrame object.",
            ),
        )
        responses.save_response_snapshot(
            response_id=response_id,
            company_id=company_id,
            instance_id=instance_id,
            account_id=account_id,
            request_path=runtime_route,
            processing_mode="sync",
            stream=True,
            request=normalized_request,
            body=created_payload,
            lifecycle_status="in_progress",
            resolved_model=model,
            provider_key=provider,
        )

        def _sse_body() -> Iterator[str]:
            collected = ""
            yield (
                "event: response.created\ndata: "
                f"{JSONResponse(content=created_payload).body.decode()}\n\n"
            )
            try:
                for event in events:
                    if event.event == "delta":
                        collected += event.delta
                        yield (
                            "event: response.output_text.delta\ndata: "
                            f"{JSONResponse(content={'id': response_id, 'delta': event.delta}).body.decode()}\n\n"
                        )
                        continue

                    if event.event == "error":
                        error_code = event.error_type or "provider_stream_interrupted"
                        analytics.record_runtime_error(
                            provider=provider,
                            model=model,
                            client=client_identity,
                            route=runtime_route,
                            stream_mode="stream",
                            error_type=error_code,
                            status_code=status.HTTP_502_BAD_GATEWAY,
                            context=telemetry_context.with_duration(_duration_ms(started_at)),
                            request_metadata=response_request_metadata,
                        )
                        failed_payload = _response_failed_payload(
                            response_id=response_id,
                            created_at=response_created,
                            model=model,
                            metadata=normalized_request.metadata,
                            error_code=error_code,
                            error_message=public_runtime_provider_message(event.error_type),
                            native_mapping=responses.build_sync_runtime_native_mapping(
                                request_path=runtime_route,
                                response_id=response_id,
                                stream=True,
                                requested_model=requested_model,
                                resolved_model=model,
                                provider_key=provider,
                                note="The streaming /v1/responses path failed before any durable native ForgeFrame follow-object was created.",
                            ),
                        )
                        responses.save_response_snapshot(
                            response_id=response_id,
                            company_id=company_id,
                            instance_id=instance_id,
                            account_id=account_id,
                            request_path=runtime_route,
                            processing_mode="sync",
                            stream=True,
                            request=normalized_request,
                            body=failed_payload,
                            lifecycle_status="failed",
                            resolved_model=model,
                            provider_key=provider,
                            error_json=failed_payload.get("error"),
                        )
                        yield (
                            "event: response.error\ndata: "
                            f"{JSONResponse(content=failed_payload).body.decode()}\n\n"
                        )
                        break

                    if event.event == "done":
                        analytics.record_stream_done_event(
                            provider=provider,
                            model=model,
                            event=event,
                            client=client_identity,
                            context=telemetry_context.with_duration(_duration_ms(started_at)),
                            request_metadata=response_request_metadata,
                        )
                        completed_payload = _response_completed_payload(
                            response_id=response_id,
                            created_at=response_created,
                            model=model,
                            metadata=normalized_request.metadata,
                            text=collected,
                            tool_calls=list(event.tool_calls or []),
                            usage=event.usage or {},
                            cost=event.cost or {},
                            native_mapping=responses.build_sync_runtime_native_mapping(
                                request_path=runtime_route,
                                response_id=response_id,
                                stream=True,
                                requested_model=requested_model,
                                resolved_model=model,
                                provider_key=provider,
                            ),
                        )
                        responses.save_response_snapshot(
                            response_id=response_id,
                            company_id=company_id,
                            instance_id=instance_id,
                            account_id=account_id,
                            request_path=runtime_route,
                            processing_mode="sync",
                            stream=True,
                            request=normalized_request,
                            body=completed_payload,
                            lifecycle_status="completed",
                            resolved_model=model,
                            provider_key=provider,
                        )
                        yield (
                            "event: response.completed\ndata: "
                            f"{JSONResponse(content=completed_payload).body.decode()}\n\n"
                        )
                        break
            except Exception as exc:
                status_code, error_type, mapped_provider, message, _extra = _provider_exception_to_http(exc)
                analytics.record_runtime_error(
                    provider=mapped_provider or provider,
                    model=model,
                    client=client_identity,
                    route=runtime_route,
                    stream_mode="stream",
                    error_type=error_type,
                    status_code=status_code,
                    context=telemetry_context.with_duration(_duration_ms(started_at)),
                    request_metadata=response_request_metadata,
                )
                failed_payload = _response_failed_payload(
                    response_id=response_id,
                    created_at=response_created,
                    model=model,
                    metadata=normalized_request.metadata,
                    error_code=error_type,
                    error_message=message,
                    native_mapping=responses.build_sync_runtime_native_mapping(
                        request_path=runtime_route,
                        response_id=response_id,
                        stream=True,
                        requested_model=requested_model,
                        resolved_model=model,
                        provider_key=mapped_provider or provider,
                        note="The streaming /v1/responses path failed before any durable native ForgeFrame follow-object was created.",
                    ),
                )
                responses.save_response_snapshot(
                    response_id=response_id,
                    company_id=company_id,
                    instance_id=instance_id,
                    account_id=account_id,
                    request_path=runtime_route,
                    processing_mode="sync",
                    stream=True,
                    request=normalized_request,
                    body=failed_payload,
                    lifecycle_status="failed",
                    resolved_model=model,
                    provider_key=mapped_provider or provider,
                    error_json=failed_payload.get("error"),
                )
                yield (
                    "event: response.error\ndata: "
                    f"{JSONResponse(content=failed_payload).body.decode()}\n\n"
                )
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            _sse_body(),
            media_type="text/event-stream",
            headers=_routing_headers(
                decision.decision_id,
                decision.resolved_target.target_key,
                request_path_decision.request_path if request_path_decision is not None else None,
            ),
        )

    try:
        result, decision = dispatch.dispatch_chat(
            requested_model=requested_model,
            messages=translated_messages,
            stream=False,
            tools=normalized_request.tools,
            tool_choice=normalized_request.tool_choice,
            allowed_providers=allowed_providers,
            request_metadata=response_request_metadata,
            response_controls=response_controls,
        )
    except Exception as exc:
        status_code, error_type, provider, message, extra = _provider_exception_to_http(exc)
        analytics.record_runtime_error(
            provider=provider,
            model=requested_model,
            client=client_identity,
            route=runtime_route,
            stream_mode="non_stream",
            error_type=error_type,
            status_code=status_code,
            context=telemetry_context.with_duration(_duration_ms(started_at)),
            request_metadata=response_request_metadata,
        )
        failed_payload = _response_failed_payload(
            response_id=response_id,
            created_at=response_created,
            model=requested_model,
            metadata=normalized_request.metadata,
            error_code=error_type,
            error_message=message,
            native_mapping=responses.build_sync_runtime_native_mapping(
                request_path=runtime_route,
                response_id=response_id,
                stream=False,
                requested_model=requested_model,
                provider_key=provider,
                note="The synchronous /v1/responses path failed before any durable native ForgeFrame follow-object was created.",
            ),
        )
        responses.save_response_snapshot(
            response_id=response_id,
            company_id=company_id,
            instance_id=instance_id,
            account_id=account_id,
            request_path=runtime_route,
            processing_mode="sync",
            stream=False,
            request=normalized_request,
            body=failed_payload,
            lifecycle_status="failed",
            resolved_model=requested_model,
            provider_key=provider,
            error_json=failed_payload.get("error"),
        )
        return _error_response(
            status_code=status_code,
            error_type=error_type,
            message=message,
            **extra,
        )

    completed_payload = _response_completed_payload(
        response_id=response_id,
        created_at=response_created,
        model=result.model,
        metadata=normalized_request.metadata,
        text=result.content,
        tool_calls=result.tool_calls,
        usage=result.usage,
        cost=result.cost,
        native_mapping=responses.build_sync_runtime_native_mapping(
            request_path=runtime_route,
            response_id=response_id,
            stream=False,
            requested_model=requested_model,
            resolved_model=result.model,
            provider_key=result.provider,
        ),
    )
    responses.save_response_snapshot(
        response_id=response_id,
        company_id=company_id,
        instance_id=instance_id,
        account_id=account_id,
        request_path=runtime_route,
        processing_mode="sync",
        stream=False,
        request=normalized_request,
        body=completed_payload,
        lifecycle_status="completed",
        resolved_model=result.model,
        provider_key=result.provider,
    )
    analytics.record_non_stream_result(
        result,
        client=client_identity,
        context=telemetry_context.with_duration(_duration_ms(started_at)),
        request_metadata=response_request_metadata,
    )
    return JSONResponse(
        content=completed_payload,
        headers=_routing_headers(
            decision.decision_id,
            decision.resolved_target.target_key,
            request_path_decision.request_path if request_path_decision is not None else None,
        ),
    )


@router.get("/responses/{response_id}", response_model=None)
def get_response(
    response_id: str,
    settings: Settings = Depends(get_settings),
    responses: ResponsesService = Depends(get_responses_service),
    gateway_identity: RuntimeGatewayIdentity | None = Depends(get_runtime_gateway_identity),
    _runtime_actor: RequestActor | None = Depends(require_runtime_permission("runtime.responses.read")),
) -> object:
    company_id = _runtime_company_id(
        gateway_identity=gateway_identity,
        settings=settings,
    )
    try:
        payload = responses.get_response(company_id=company_id, response_id=response_id)
    except ResponseNotFoundError:
        return _response_not_found(response_id)
    return JSONResponse(content=payload)


@router.get("/responses/{response_id}/input_items", response_model=None)
def get_response_input_items(
    response_id: str,
    settings: Settings = Depends(get_settings),
    responses: ResponsesService = Depends(get_responses_service),
    gateway_identity: RuntimeGatewayIdentity | None = Depends(get_runtime_gateway_identity),
    _runtime_actor: RequestActor | None = Depends(require_runtime_permission("runtime.responses.read")),
) -> object:
    company_id = _runtime_company_id(
        gateway_identity=gateway_identity,
        settings=settings,
    )
    try:
        payload = responses.get_response_input_items(company_id=company_id, response_id=response_id)
    except ResponseNotFoundError:
        return _response_not_found(response_id)
    return JSONResponse(content=payload)

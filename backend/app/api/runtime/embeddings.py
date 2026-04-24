"""Runtime embeddings entrypoint on `/v1/embeddings`."""

from __future__ import annotations

from time import monotonic
from typing import Any

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse

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
    get_routing_service,
    get_runtime_gateway_identity,
    get_runtime_request_path_decision,
    get_settings,
    require_runtime_permission,
    runtime_request_path_metadata,
)
from app.api.runtime.schemas import EmbeddingsRequest
from app.core.dispatch import DispatchService
from app.core.model_registry import ModelRegistry
from app.core.routing import RoutingService
from app.governance.errors import RuntimeAuthorizationError
from app.governance.models import RuntimeGatewayIdentity, RuntimeRequestPathDecision
from app.governance.service import GovernanceService, get_governance_service
from app.request_metadata import merge_request_metadata
from app.settings.config import Settings
from app.telemetry.context import telemetry_context_from_request
from app.usage.analytics import ClientIdentity, get_usage_analytics_store
from app.providers.base import floats_to_base64_embedding

from .responses import _resolve_client_identity, _runtime_account_id, _runtime_company_id, _runtime_instance_id

router = APIRouter(tags=["runtime-embeddings"])


def _normalize_embedding_input(raw_input: Any) -> list[object]:
    if isinstance(raw_input, str):
        return [raw_input]
    if isinstance(raw_input, list):
        if not raw_input:
            raise ValueError("input must not be empty.")
        if all(isinstance(item, int) and not isinstance(item, bool) for item in raw_input):
            return [list(raw_input)]
        return list(raw_input)
    raise ValueError("input must be a string, a token array, or a list of embedding inputs.")


@router.post("/embeddings", response_model=None)
def create_embeddings(
    payload: EmbeddingsRequest,
    request: Request,
    registry: ModelRegistry = Depends(get_model_registry),
    dispatch: DispatchService = Depends(get_dispatch_service),
    routing: RoutingService = Depends(get_routing_service),
    settings: Settings = Depends(get_settings),
    gateway_identity: RuntimeGatewayIdentity | None = Depends(get_runtime_gateway_identity),
    request_path_decision: RuntimeRequestPathDecision | None = Depends(get_runtime_request_path_decision),
    governance: GovernanceService = Depends(get_governance_service),
    _runtime_actor: RequestActor | None = Depends(require_runtime_permission("runtime.chat.write")),
) -> object:
    analytics = get_usage_analytics_store()
    runtime_route = request.url.path or "/v1/embeddings"
    started_at = monotonic()
    telemetry_context = telemetry_context_from_request(
        request,
        route=runtime_route,
        operation="runtime.embeddings.create",
        service_name="forgeframe-runtime-api",
        service_kind="runtime_api",
    )
    client_identity = _resolve_client_identity(
        request,
        payload,
        gateway_identity,
        default_tenant_id=settings.bootstrap_tenant_id,
    )
    requested_model = payload.model
    company_id = _runtime_company_id(gateway_identity=gateway_identity, settings=settings)
    instance_id = _runtime_instance_id(gateway_identity=gateway_identity, settings=settings)
    account_id = _runtime_account_id(gateway_identity)
    path_metadata = runtime_request_path_metadata(request_path_decision)
    request_metadata = merge_request_metadata(
        telemetry_context.as_request_metadata(),
        path_metadata,
        {
            "instance_id": instance_id,
            "company_id": company_id,
            "account_id": account_id,
        },
    )
    if request_path_decision is not None and request_path_decision.request_path == "queue_background":
        return _error_response(
            status_code=status.HTTP_409_CONFLICT,
            error_type="request_path_blocked",
            message="Queue-background runtime keys must use /v1/responses.",
        )

    try:
        input_items = _normalize_embedding_input(payload.input)
    except ValueError as exc:
        return _error_response(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            error_type="invalid_request",
            message=str(exc),
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
            stream_mode="non_stream",
            error_type=exc.error_type,
            status_code=exc.status_code,
            context=telemetry_context.with_duration(_duration_ms(started_at)),
            request_metadata=request_metadata,
        )
        return _error_response(
            status_code=exc.status_code,
            error_type=exc.error_type,
            message=str(exc),
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
        return _error_response(
            status_code=status.HTTP_404_NOT_FOUND,
            error_type="model_not_found",
            message=f"Requested model '{requested_model}' is not available.",
            available_models=public_model_ids,
        )
    if requested_model and not registry.has_model(requested_model) and not settings.runtime_allow_unknown_models:
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

    try:
        result, decision = dispatch.dispatch_embeddings(
            requested_model=requested_model,
            input_items=input_items,
            encoding_format=payload.encoding_format or "float",
            dimensions=payload.dimensions,
            allowed_providers=allowed_provider_set(gateway_identity),
            request_metadata=request_metadata,
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
            request_metadata=request_metadata,
        )
        return _error_response(
            status_code=status_code,
            error_type=error_type,
            message=message,
            **extra,
        )

    data: list[dict[str, object]] = []
    for index, embedding in enumerate(result.embeddings):
        embedding_payload = embedding
        if (payload.encoding_format or "float") == "base64" and isinstance(embedding, list):
            embedding_payload = floats_to_base64_embedding([float(value) for value in embedding])
        data.append({"object": "embedding", "index": index, "embedding": embedding_payload})

    analytics.record_embedding_result(
        provider=result.provider,
        model=result.model,
        usage=result.usage,
        cost=result.cost,
        credential_type=result.credential_type,
        auth_source=result.auth_source,
        client=client_identity,
        context=telemetry_context.with_duration(_duration_ms(started_at)),
        request_metadata=request_metadata,
    )
    return JSONResponse(
        content={
            "object": "list",
            "data": data,
            "model": result.model,
            "usage": {
                "prompt_tokens": result.usage.input_tokens,
                "total_tokens": result.usage.total_tokens,
            },
        },
        headers=_routing_headers(
            decision.decision_id,
            decision.resolved_target.target_key,
            request_path_decision.request_path if request_path_decision is not None else None,
        ),
    )

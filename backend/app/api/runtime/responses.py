"""Runtime responses endpoint for broader OpenAI-compatible client behavior."""

from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.api.runtime.chat import _provider_exception_to_http, create_chat_completion
from app.api.runtime.dependencies import (
    get_dispatch_service,
    get_model_registry,
    get_runtime_gateway_identity,
    get_settings,
)
from app.api.runtime.schemas import ChatCompletionsRequest, ResponsesRequest
from app.core.dispatch import DispatchService
from app.core.model_registry import ModelRegistry
from app.core.response_normalization import build_responses_payload
from app.governance.models import RuntimeGatewayIdentity
from app.providers import ProviderStreamInterruptedError
from app.settings.config import Settings
from app.usage.analytics import ClientIdentity, get_usage_analytics_store

router = APIRouter(tags=["runtime-responses"])


def _normalize_responses_input(input_value: object) -> str:
    if isinstance(input_value, dict):
        if input_value.get("type") in {"input_text", "text"}:
            return str(input_value.get("text", ""))
        content = input_value.get("content")
        if isinstance(content, list):
            blocks: list[str] = []
            for block in content:
                if isinstance(block, dict) and block.get("type") in {"input_text", "text"}:
                    blocks.append(str(block.get("text", "")))
            return "\n".join(part for part in blocks if part.strip()) or " "
        if content is not None:
            return str(content)
        return str(input_value)
    if isinstance(input_value, list):
        text_parts: list[str] = []
        for item in input_value:
            if isinstance(item, dict):
                content = item.get("content")
                if isinstance(content, list):
                    block_texts = []
                    for block in content:
                        if isinstance(block, dict) and block.get("type") in {"input_text", "text"}:
                            block_texts.append(str(block.get("text", "")))
                    text_parts.append("\n".join(part for part in block_texts if part.strip()))
                    continue
                if content is None:
                    raise ValueError("List input objects must contain a 'content' field.")
                text_parts.append(str(content))
                continue
            text_parts.append(str(item))
        return "\n".join(part for part in text_parts if part.strip()) or " "
    return str(input_value)


@router.post("/responses", response_model=None)
def create_response(
    payload: ResponsesRequest,
    request: Request,
    registry: ModelRegistry = Depends(get_model_registry),
    dispatch: DispatchService = Depends(get_dispatch_service),
    settings: Settings = Depends(get_settings),
    gateway_identity: RuntimeGatewayIdentity | None = Depends(get_runtime_gateway_identity),
) -> object:
    if payload.max_output_tokens is not None and payload.max_output_tokens <= 0:
        return JSONResponse(status_code=400, content={"error": {"type": "invalid_request", "message": "max_output_tokens must be > 0 when provided."}})
    if payload.temperature is not None and not 0 <= payload.temperature <= 2:
        return JSONResponse(status_code=400, content={"error": {"type": "invalid_request", "message": "temperature must be between 0 and 2."}})

    input_value = payload.input
    try:
        resolved_input = _normalize_responses_input(input_value)
    except ValueError as exc:
        return JSONResponse(status_code=422, content={"error": {"type": "unsupported_input", "message": str(exc)}})
    if not resolved_input.strip():
        return JSONResponse(status_code=400, content={"error": {"type": "invalid_request", "message": "input must not be empty."}})

    if payload.instructions:
        resolved_input = f"{payload.instructions}\n\n{resolved_input}"

    analytics = get_usage_analytics_store()
    client_identity = (
        ClientIdentity(
            client_id=gateway_identity.client_id,
            consumer=gateway_identity.consumer,
            integration=gateway_identity.integration,
        )
        if gateway_identity is not None
        else ClientIdentity(
            client_id=payload.client.get("client_id") or request.headers.get("x-forgegate-client") or "unknown_client",
            consumer=payload.client.get("consumer") or request.headers.get("x-forgegate-consumer") or "unknown_consumer",
            integration=payload.client.get("integration") or request.headers.get("x-forgegate-integration") or "unknown_integration",
        )
    )

    if payload.stream:
        try:
            model, provider, events = dispatch.dispatch_chat_stream(
                requested_model=payload.model,
                messages=[{"role": "user", "content": resolved_input}],
                tools=payload.tools,
                tool_choice=payload.tool_choice,
            )
        except Exception as exc:
            status_code, error_type, _, message, extra = _provider_exception_to_http(exc)
            return JSONResponse(status_code=status_code, content={"error": {"type": error_type, "message": message, **extra}})

        response_id = f"resp_{uuid4().hex}"

        def _sse_body():
            yield f"event: response.created\ndata: {JSONResponse(content={'id': response_id, 'object': 'response', 'status': 'in_progress', 'model': model}).body.decode()}\n\n"
            collected = ""
            usage_payload: dict[str, object] = {}
            try:
                for event in events:
                    if event.event == "delta":
                        collected += event.delta
                        yield f"event: response.output_text.delta\ndata: {JSONResponse(content={'id': response_id, 'delta': event.delta}).body.decode()}\n\n"
                        continue
                    if event.event == "done":
                        analytics.record_stream_done_event(provider=provider, model=model, event=event, client=client_identity)
                        usage_payload = event.usage.model_dump() if event.usage else {}
                        final_payload = {
                            "id": response_id,
                            "object": "response",
                            "status": "completed",
                            "model": model,
                            "output": [{"type": "output_text", "text": collected}] if collected.strip() else [],
                            "output_text": collected,
                            "provider": provider,
                            "usage": usage_payload,
                            "cost": event.cost.model_dump() if event.cost else {},
                        }
                        yield f"event: response.completed\ndata: {JSONResponse(content=final_payload).body.decode()}\n\n"
                        break
            except ProviderStreamInterruptedError as exc:
                analytics.record_runtime_error(
                    provider=provider,
                    model=model,
                    client=client_identity,
                    route="/v1/responses",
                    stream_mode="stream",
                    error_type=exc.error_type,
                    status_code=502,
                )
                yield f"event: response.error\ndata: {JSONResponse(content={'error': {'type': exc.error_type, 'message': str(exc)}}).body.decode()}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(_sse_body(), media_type="text/event-stream")

    chat_payload = ChatCompletionsRequest(
        model=payload.model,
        messages=[{"role": "user", "content": resolved_input}],
        stream=False,
        tools=payload.tools,
        tool_choice=payload.tool_choice,
        client=payload.client if gateway_identity is None else {
            "client_id": gateway_identity.client_id,
            "consumer": gateway_identity.consumer,
            "integration": gateway_identity.integration,
        },
    )
    chat_result = create_chat_completion(chat_payload, request, registry, dispatch, settings, gateway_identity)
    if not isinstance(chat_result, dict):
        return chat_result
    from app.providers import ChatDispatchResult

    result = ChatDispatchResult(
        model=str(chat_result.get("model")),
        provider=str(chat_result.get("provider")),
        content=str(chat_result["choices"][0]["message"].get("content", "")),
        finish_reason=str(chat_result["choices"][0].get("finish_reason", "stop")),
        credential_type=str(chat_result.get("credential_type", "unknown")),
        auth_source=str(chat_result.get("auth_source", "unknown")),
        tool_calls=chat_result["choices"][0]["message"].get("tool_calls", []),
        usage=chat_result.get("usage", {}),
        cost=chat_result.get("cost", {}),
    )
    return build_responses_payload(result)

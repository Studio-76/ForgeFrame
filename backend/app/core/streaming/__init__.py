"""Streaming contracts/utilities for runtime SSE responses."""

from __future__ import annotations

import json
from collections.abc import Iterable, Iterator

from app.api.runtime.errors import public_runtime_provider_message
from app.providers import ProviderStreamEvent


def _sse_data(payload: dict[str, object]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def provider_events_to_sse(
    events: Iterable[ProviderStreamEvent],
    *,
    model: str,
    completion_id: str,
    created: int,
) -> Iterator[str]:
    for event in events:
        if event.event == "delta":
            yield _sse_data(
                {
                    "id": completion_id,
                    "object": "chat.completion.chunk",
                    "created": created,
                    "model": model,
                    "choices": [
                        {
                            "index": 0,
                            "delta": {"content": event.delta},
                            "finish_reason": None,
                        }
                    ],
                }
            )
            continue

        if event.event == "done":
            delta_payload: dict[str, object] = {}
            if event.tool_calls:
                delta_payload["tool_calls"] = event.tool_calls
            yield _sse_data(
                {
                    "id": completion_id,
                    "object": "chat.completion.chunk",
                    "created": created,
                    "model": model,
                    "choices": [
                        {
                            "index": 0,
                            "delta": delta_payload,
                            "finish_reason": event.finish_reason or "stop",
                            "usage": event.usage.model_dump() if event.usage else None,
                            "cost": event.cost.model_dump() if event.cost else None,
                        }
                    ],
                }
            )
            yield "data: [DONE]\n\n"
            return

        yield _sse_data(
            {
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": model,
                "error": {
                    "type": event.error_type or "provider_stream_interrupted",
                    "message": public_runtime_provider_message(event.error_type),
                },
            }
        )
        yield "data: [DONE]\n\n"
        return

    yield _sse_data(
        {
            "id": completion_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": model,
            "error": {
                "type": "provider_stream_interrupted",
                "message": "Provider stream closed without done event.",
            },
        }
    )
    yield "data: [DONE]\n\n"

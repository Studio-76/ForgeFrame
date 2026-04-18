"""Streaming contracts/utilities for runtime SSE responses."""

from __future__ import annotations

import json
from collections.abc import Iterable, Iterator

from app.providers import ProviderStreamEvent


def _sse_data(payload: dict[str, object]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def provider_events_to_sse(
    events: Iterable[ProviderStreamEvent], *, model: str, provider: str
) -> Iterator[str]:
    for event in events:
        if event.event == "delta":
            yield _sse_data(
                {
                    "id": "chatcmpl-forgegate-stream",
                    "object": "chat.completion.chunk",
                    "model": model,
                    "provider": provider,
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
            yield _sse_data(
                {
                    "id": "chatcmpl-forgegate-stream",
                    "object": "chat.completion.chunk",
                    "model": model,
                    "provider": provider,
                    "choices": [
                        {
                            "index": 0,
                            "delta": {},
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
                "id": "chatcmpl-forgegate-stream",
                "object": "chat.completion.chunk",
                "model": model,
                "provider": provider,
                "error": {
                    "type": event.error_type or "provider_stream_interrupted",
                    "message": event.error_message or "Provider stream interrupted.",
                },
            }
        )
        yield "data: [DONE]\n\n"
        return

    yield _sse_data(
        {
            "id": "chatcmpl-forgegate-stream",
            "object": "chat.completion.chunk",
            "model": model,
            "provider": provider,
            "error": {
                "type": "provider_stream_interrupted",
                "message": "Provider stream closed without done event.",
            },
        }
    )
    yield "data: [DONE]\n\n"

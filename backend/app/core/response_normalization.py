"""Shared normalization helpers for chat and responses payloads."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from app.providers import ChatDispatchResult


def new_chat_completion_id() -> str:
    return f"chatcmpl-{uuid4().hex}"


def new_chat_completion_created() -> int:
    return int(datetime.now(tz=UTC).timestamp())


def build_chat_completion_payload(
    result: ChatDispatchResult,
    *,
    completion_id: str | None = None,
    created: int | None = None,
) -> dict[str, object]:
    return {
        "id": completion_id or new_chat_completion_id(),
        "object": "chat.completion",
        "created": created if created is not None else new_chat_completion_created(),
        "model": result.model,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": result.content,
                    **({"tool_calls": result.tool_calls} if result.tool_calls else {}),
                },
                "finish_reason": result.finish_reason,
            }
        ],
        "usage": result.usage.model_dump(),
        "cost": result.cost.model_dump(),
    }


def build_responses_output_items(result: ChatDispatchResult) -> list[dict[str, object]]:
    output_items: list[dict[str, object]] = []
    if str(result.content).strip():
        output_items.append({"type": "output_text", "text": result.content})
    for call in result.tool_calls:
        output_items.append({"type": "tool_call", "tool_call": call})
    return output_items


def build_responses_payload(result: ChatDispatchResult, *, response_id: str | None = None, status: str = "completed") -> dict[str, object]:
    output_items = build_responses_output_items(result)
    output_text = "".join(
        item["text"]
        for item in output_items
        if item.get("type") == "output_text" and isinstance(item.get("text"), str)
    )
    # Runtime success payloads stay client-facing; routing and auth provenance
    # belongs in observability/control-plane surfaces instead.
    return {
        "id": response_id or f"resp_{uuid4().hex}",
        "object": "response",
        "created_at": datetime.now(tz=UTC).isoformat().replace("+00:00", "Z"),
        "status": status,
        "model": result.model,
        "output": output_items,
        "output_text": output_text,
        "usage": result.usage.model_dump(),
        "cost": result.cost.model_dump(),
    }

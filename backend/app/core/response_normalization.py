"""Shared normalization helpers for chat and responses payloads."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from app.providers import ChatDispatchResult


def build_chat_completion_payload(result: ChatDispatchResult) -> dict[str, object]:
    return {
        "id": "chatcmpl-forgegate",
        "object": "chat.completion",
        "model": result.model,
        "provider": result.provider,
        "credential_type": result.credential_type,
        "auth_source": result.auth_source,
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
        "provider": result.provider,
        "credential_type": result.credential_type,
        "auth_source": result.auth_source,
    }

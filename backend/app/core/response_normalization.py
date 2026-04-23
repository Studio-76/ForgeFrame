"""Shared normalization helpers for chat and responses payloads."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from app.providers import ChatDispatchResult
from app.responses.models import build_response_object, build_response_output_items


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
    output_items, _output_text = build_response_output_items(
        text=result.content,
        tool_calls=result.tool_calls,
    )
    return output_items


def build_responses_payload(result: ChatDispatchResult, *, response_id: str | None = None, status: str = "completed") -> dict[str, object]:
    output_items, output_text = build_response_output_items(
        text=result.content,
        tool_calls=result.tool_calls,
    )
    return build_response_object(
        response_id=response_id or f"resp_{uuid4().hex}",
        created_at=int(datetime.now(tz=UTC).timestamp()),
        status=status,  # type: ignore[arg-type]
        background=False,
        model=result.model,
        output=output_items,
        output_text=output_text,
        usage=result.usage,
        cost=result.cost,
    ).model_dump(mode="json")

"""Native response-domain contracts and serialization helpers."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field

from app.product_taxonomy import RuntimeNativeMapping, attach_runtime_native_mapping
from app.usage.models import CostBreakdown, TokenUsage

ResponseProcessingMode = Literal["sync", "background"]
ResponseStatus = Literal["queued", "in_progress", "completed", "failed", "incomplete"]
ResponseItemStatus = Literal["in_progress", "completed", "incomplete"]


class ResponseError(BaseModel):
    code: str
    message: str


class NormalizedResponsesRequest(BaseModel):
    model: str | None = None
    instructions: str | None = None
    input_items: list[dict[str, Any]] = Field(default_factory=list)
    stream: bool = False
    background: bool = False
    tools: list[dict[str, Any]] = Field(default_factory=list)
    tool_choice: str | dict[str, Any] | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    client: dict[str, str] = Field(default_factory=dict)
    max_output_tokens: int | None = None
    temperature: float | None = None


class ResponseObject(BaseModel):
    id: str
    object: Literal["response"] = "response"
    created_at: int
    status: ResponseStatus
    background: bool = False
    model: str | None = None
    error: ResponseError | None = None
    incomplete_details: dict[str, Any] | None = None
    output: list[dict[str, Any]] = Field(default_factory=list)
    output_text: str = ""
    usage: TokenUsage = Field(default_factory=TokenUsage)
    cost: CostBreakdown = Field(default_factory=CostBreakdown)
    metadata: dict[str, Any] = Field(default_factory=dict)


def new_response_id() -> str:
    return f"resp_{uuid4().hex}"


def new_response_created() -> int:
    return int(datetime.now(tz=UTC).timestamp())


def _new_item_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"


def build_message_output_item(
    text: str,
    *,
    item_id: str | None = None,
    status: ResponseItemStatus = "completed",
) -> dict[str, Any]:
    return {
        "id": item_id or _new_item_id("msg"),
        "type": "message",
        "status": status,
        "role": "assistant",
        "content": [
            {
                "type": "output_text",
                "text": text,
                "annotations": [],
            }
        ],
    }


def build_function_call_item(
    tool_call: dict[str, Any],
    *,
    status: ResponseItemStatus = "completed",
) -> dict[str, Any]:
    function = tool_call.get("function") if isinstance(tool_call.get("function"), dict) else {}
    call_id = str(tool_call.get("id") or tool_call.get("call_id") or _new_item_id("fc"))
    return {
        "id": call_id,
        "type": "function_call",
        "call_id": call_id,
        "name": str(function.get("name", "") or ""),
        "arguments": str(function.get("arguments", "") or ""),
        "status": status,
    }


def build_response_output_items(
    *,
    text: str,
    tool_calls: list[dict[str, Any]] | None = None,
) -> tuple[list[dict[str, Any]], str]:
    output: list[dict[str, Any]] = []
    output_text = text if text.strip() else ""
    if output_text:
        output.append(build_message_output_item(output_text))
    for tool_call in tool_calls or []:
        output.append(build_function_call_item(tool_call))
    return output, output_text


def build_response_object(
    *,
    response_id: str,
    created_at: int,
    status: ResponseStatus,
    background: bool,
    model: str | None,
    metadata: dict[str, Any] | None = None,
    output: list[dict[str, Any]] | None = None,
    output_text: str = "",
    usage: TokenUsage | dict[str, Any] | None = None,
    cost: CostBreakdown | dict[str, Any] | None = None,
    error: ResponseError | dict[str, Any] | None = None,
    incomplete_details: dict[str, Any] | None = None,
    native_mapping: RuntimeNativeMapping | dict[str, Any] | None = None,
) -> ResponseObject:
    normalized_error: ResponseError | None
    if error is None:
        normalized_error = None
    elif isinstance(error, ResponseError):
        normalized_error = error
    else:
        normalized_error = ResponseError.model_validate(error)

    normalized_usage = usage if isinstance(usage, TokenUsage) else TokenUsage.model_validate(usage or {})
    normalized_cost = cost if isinstance(cost, CostBreakdown) else CostBreakdown.model_validate(cost or {})
    return ResponseObject(
        id=response_id,
        created_at=created_at,
        status=status,
        background=background,
        model=model,
        error=normalized_error,
        incomplete_details=incomplete_details,
        output=list(output or []),
        output_text=output_text,
        usage=normalized_usage,
        cost=normalized_cost,
        metadata=attach_runtime_native_mapping(dict(metadata or {}), native_mapping),
    )

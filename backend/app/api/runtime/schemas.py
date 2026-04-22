"""Runtime API schemas for OpenAI-compatible baseline endpoints."""

import json
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="allow")

    role: Literal["system", "user", "assistant", "tool"]
    content: Any = None


class ChatCompletionsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: str | None = None
    messages: list[ChatMessage] = Field(min_length=1)
    stream: bool = False
    tools: list[dict[str, Any]] = Field(default_factory=list)
    tool_choice: str | dict[str, Any] | None = None
    client: dict[str, str] = Field(default_factory=dict)


class ResponsesRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    model: str | None = None
    input: Any
    instructions: str | None = None
    max_output_tokens: int | None = None
    temperature: float | None = None
    stream: bool = False
    tools: list[dict[str, Any]] = Field(default_factory=list)
    tool_choice: str | dict[str, Any] | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    client: dict[str, str] = Field(default_factory=dict)


class ErrorEnvelope(BaseModel):
    error: dict[str, Any]


class RuntimeModelRecord(BaseModel):
    id: str
    object: Literal["model"] = "model"
    owned_by: str


class RuntimeModelsResponse(BaseModel):
    object: Literal["list"] = "list"
    data: list[RuntimeModelRecord]


_CHAT_CONTENT_BLOCK_TYPES = {"text", "input_text", "image_url", "input_image"}


def _chat_message_path(index: int) -> str:
    return f"messages[{index}]"


def _unsupported_fields_error(path: str, fields: set[str]) -> ValueError:
    listed = ", ".join(sorted(fields))
    suffix = "field" if len(fields) == 1 else "fields"
    return ValueError(f"{path} includes unsupported {suffix}: {listed}.")


def _normalize_chat_content_block(block: object, *, message_index: int, block_index: int) -> dict[str, object]:
    path = f"{_chat_message_path(message_index)}.content[{block_index}]"
    if not isinstance(block, dict):
        raise ValueError(f"{path} must be an object.")

    block_type = str(block.get("type", "") or "")
    if block_type not in _CHAT_CONTENT_BLOCK_TYPES:
        raise ValueError(f"{path} uses unsupported content block type '{block_type or 'unknown'}'.")

    if block_type in {"text", "input_text"}:
        unexpected_fields = set(block) - {"type", "text"}
        if unexpected_fields:
            raise _unsupported_fields_error(path, unexpected_fields)
        return {"type": "text", "text": str(block.get("text", ""))}

    unexpected_fields = set(block) - {"type", "image_url", "url", "detail", "file_id"}
    if unexpected_fields:
        raise _unsupported_fields_error(path, unexpected_fields)
    if block.get("file_id") is not None:
        raise ValueError(f"{path}.file_id is not supported on the current runtime path.")

    raw_image_url = block.get("image_url", block.get("url"))
    detail = block.get("detail")
    if isinstance(raw_image_url, dict):
        nested_unexpected_fields = set(raw_image_url) - {"url", "detail", "file_id"}
        if nested_unexpected_fields:
            raise _unsupported_fields_error(f"{path}.image_url", nested_unexpected_fields)
        if raw_image_url.get("file_id") is not None:
            raise ValueError(f"{path}.image_url.file_id is not supported on the current runtime path.")
        if detail is None:
            detail = raw_image_url.get("detail")
        raw_image_url = raw_image_url.get("url")

    image_url = str(raw_image_url or "").strip()
    if not image_url:
        raise ValueError(f"{path} must include a non-empty image_url.")
    normalized_block: dict[str, object] = {"type": "image_url", "image_url": {"url": image_url}}
    if detail is not None:
        normalized_block["image_url"]["detail"] = detail
    return normalized_block


def _normalize_chat_message_content(content: object, *, message_index: int) -> object:
    path = f"{_chat_message_path(message_index)}.content"
    if content is None or isinstance(content, str):
        return content
    if isinstance(content, dict):
        return [_normalize_chat_content_block(content, message_index=message_index, block_index=0)]
    if isinstance(content, list):
        return [
            _normalize_chat_content_block(block, message_index=message_index, block_index=block_index)
            for block_index, block in enumerate(content)
        ]
    raise ValueError(f"{path} must be a string, null, or a list of supported content blocks.")


def _normalize_chat_tool_calls(raw_tool_calls: object, *, message_index: int) -> list[dict[str, object]]:
    path = f"{_chat_message_path(message_index)}.tool_calls"
    if not isinstance(raw_tool_calls, list):
        raise ValueError(f"{path} must be a list.")

    normalized: list[dict[str, object]] = []
    for tool_call_index, tool_call in enumerate(raw_tool_calls):
        tool_call_path = f"{path}[{tool_call_index}]"
        if not isinstance(tool_call, dict):
            raise ValueError(f"{tool_call_path} must be an object.")

        unexpected_fields = set(tool_call) - {"id", "type", "function"}
        if unexpected_fields:
            raise _unsupported_fields_error(tool_call_path, unexpected_fields)

        tool_call_id = str(tool_call.get("id", "") or "").strip()
        if not tool_call_id:
            raise ValueError(f"{tool_call_path}.id must be a non-empty string.")

        tool_call_type = str(tool_call.get("type", "") or "").strip()
        if tool_call_type != "function":
            raise ValueError(f"{tool_call_path}.type must be 'function'.")

        function = tool_call.get("function")
        if not isinstance(function, dict):
            raise ValueError(f"{tool_call_path}.function must be an object.")

        unexpected_function_fields = set(function) - {"name", "arguments"}
        if unexpected_function_fields:
            raise _unsupported_fields_error(f"{tool_call_path}.function", unexpected_function_fields)

        function_name = str(function.get("name", "") or "").strip()
        if not function_name:
            raise ValueError(f"{tool_call_path}.function.name must be a non-empty string.")

        raw_arguments = function.get("arguments", "{}")
        if raw_arguments is None:
            arguments = "{}"
        elif isinstance(raw_arguments, str):
            arguments = raw_arguments
        elif isinstance(raw_arguments, dict):
            arguments = json.dumps(raw_arguments, ensure_ascii=True, separators=(",", ":"))
        else:
            raise ValueError(f"{tool_call_path}.function.arguments must be a string or object.")

        normalized.append(
            {
                "id": tool_call_id,
                "type": "function",
                "function": {
                    "name": function_name,
                    "arguments": arguments,
                },
            }
        )
    return normalized


def normalize_chat_messages(messages: list[ChatMessage]) -> list[dict[str, object]]:
    normalized: list[dict[str, object]] = []
    for index, message in enumerate(messages):
        message_path = _chat_message_path(index)
        extras = dict(message.model_extra or {})
        allowed_extra_fields: set[str] = set()
        if message.role == "assistant":
            allowed_extra_fields.add("tool_calls")
        if message.role == "tool":
            allowed_extra_fields.add("tool_call_id")

        unexpected_fields = set(extras) - allowed_extra_fields
        if unexpected_fields:
            raise _unsupported_fields_error(message_path, unexpected_fields)

        normalized_message: dict[str, object] = {
            "role": message.role,
            "content": _normalize_chat_message_content(message.content, message_index=index),
        }

        if "tool_calls" in extras:
            normalized_message["tool_calls"] = _normalize_chat_tool_calls(extras["tool_calls"], message_index=index)

        if "tool_call_id" in extras:
            raw_tool_call_id = extras["tool_call_id"]
            tool_call_id = str(raw_tool_call_id or "").strip()
            if not tool_call_id:
                raise ValueError(f"{message_path}.tool_call_id must be a non-empty string.")
            normalized_message["tool_call_id"] = tool_call_id

        normalized.append(normalized_message)

    return normalized

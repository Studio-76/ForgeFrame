"""Helpers for OpenAI-compatible streaming chunk assembly."""

from __future__ import annotations


def merge_openai_tool_call_chunks(
    merged: dict[int, dict[str, object]],
    chunks: object,
) -> None:
    if not isinstance(chunks, list):
        return
    for fallback_index, chunk in enumerate(chunks):
        if not isinstance(chunk, dict):
            continue
        raw_index = chunk.get("index", fallback_index)
        try:
            index = int(raw_index)
        except (TypeError, ValueError):
            index = fallback_index
        current = merged.setdefault(
            index,
            {
                "id": "",
                "type": "function",
                "function": {"name": "", "arguments": ""},
            },
        )
        chunk_id = chunk.get("id")
        if chunk_id:
            current["id"] = str(chunk_id)
        chunk_type = chunk.get("type")
        if chunk_type:
            current["type"] = str(chunk_type)
        function_delta = chunk.get("function")
        if isinstance(function_delta, dict):
            function_payload = current.setdefault("function", {"name": "", "arguments": ""})
            if not isinstance(function_payload, dict):
                function_payload = {"name": "", "arguments": ""}
                current["function"] = function_payload
            name_part = function_delta.get("name")
            if name_part:
                function_payload["name"] = f"{function_payload.get('name', '')}{name_part}"
            arguments_part = function_delta.get("arguments")
            if arguments_part is not None:
                function_payload["arguments"] = f"{function_payload.get('arguments', '')}{arguments_part}"
        for key, value in chunk.items():
            if key in {"index", "id", "type", "function"} or value is None:
                continue
            current[key] = value


def finalize_openai_tool_calls(merged: dict[int, dict[str, object]]) -> list[dict[str, object]]:
    return [merged[index] for index in sorted(merged)]

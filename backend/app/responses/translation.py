"""Translation helpers between native responses items and provider chat messages."""

from __future__ import annotations

from typing import Any


def _normalize_chat_content_block(block: dict[str, Any]) -> dict[str, Any]:
    block_type = str(block.get("type", "") or "")
    if block_type in {"input_text", "text", "output_text"}:
        return {"type": "text", "text": str(block.get("text", "") or "")}
    if block_type in {"input_image", "image_url"}:
        image_url = str(block.get("image_url") or block.get("url") or "").strip()
        payload: dict[str, Any] = {"type": "image_url", "image_url": {"url": image_url}}
        detail = block.get("detail")
        if detail is not None:
            payload["image_url"]["detail"] = detail
        return payload
    raise ValueError(f"Unsupported response content block type '{block_type or 'unknown'}'.")


def _response_output_to_chat_content(output: str | list[dict[str, Any]]) -> str | list[dict[str, Any]]:
    if isinstance(output, str):
        return output
    return [_normalize_chat_content_block(block) for block in output]


def _message_blocks_to_chat_content(blocks: list[dict[str, Any]]) -> str | list[dict[str, Any]]:
    if blocks and all(str(block.get("type", "") or "") in {"input_text", "text", "output_text"} for block in blocks):
        return "".join(str(block.get("text", "") or "") for block in blocks)
    return [_normalize_chat_content_block(block) for block in blocks]


def response_input_items_to_chat_messages(
    input_items: list[dict[str, Any]],
    *,
    instructions: str | None = None,
) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = []
    if instructions and instructions.strip():
        messages.append({"role": "system", "content": instructions})

    for item in input_items:
        item_type = str(item.get("type", "") or "")
        if item_type == "message":
            role = str(item.get("role", "user") or "user")
            if role == "developer":
                role = "system"
            content = _message_blocks_to_chat_content(list(item.get("content") or []))
            messages.append({"role": role, "content": content})
            continue
        if item_type == "function_call":
            messages.append(
                {
                    "role": "assistant",
                    "content": "",
                    "tool_calls": [
                        {
                            "id": str(item.get("call_id") or item.get("id") or ""),
                            "type": "function",
                            "function": {
                                "name": str(item.get("name", "") or ""),
                                "arguments": str(item.get("arguments", "") or ""),
                            },
                        }
                    ],
                }
            )
            continue
        if item_type == "function_call_output":
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": str(item.get("call_id") or ""),
                    "content": _response_output_to_chat_content(item.get("output", "")),
                }
            )
            continue
        raise ValueError(f"Unsupported response input item type '{item_type or 'unknown'}'.")

    return messages

"""Helpers for inferring runtime message feature requirements."""

from __future__ import annotations


def _content_requires_vision(content: object) -> bool:
    if isinstance(content, list):
        return any(_content_requires_vision(item) for item in content)
    if not isinstance(content, dict):
        return False

    block_type = str(content.get("type", "") or "")
    if block_type in {"image", "image_url", "input_image"}:
        return True
    if "image_url" in content or "file_id" in content:
        return True

    nested_content = content.get("content")
    if nested_content is not None:
        return _content_requires_vision(nested_content)
    return False


def messages_require_vision(messages: list[dict]) -> bool:
    return any(_content_requires_vision(message.get("content")) for message in messages)

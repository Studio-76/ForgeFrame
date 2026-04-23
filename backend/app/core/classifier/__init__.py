"""Deterministic request classification for Smart Execution Routing."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


ClassificationLabel = Literal["simple", "non_simple"]


@dataclass(frozen=True)
class RoutingRequestFeatures:
    message_count: int
    text_characters: int
    has_tools: bool
    require_vision: bool
    stream: bool
    max_output_tokens: int | None
    has_system_prompt: bool


@dataclass(frozen=True)
class ClassificationResult:
    label: ClassificationLabel
    confidence: float
    summary: str
    rules: tuple[str, ...] = field(default_factory=tuple)
    features: RoutingRequestFeatures | None = None


def _message_text_length(messages: list[dict]) -> int:
    total = 0
    for message in messages:
        content = message.get("content")
        if isinstance(content, str):
            total += len(content)
            continue
        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict):
                    total += len(str(item.get("text", "")))
                else:
                    total += len(str(item))
            continue
        if content is not None:
            total += len(str(content))
    return total


def extract_request_features(
    messages: list[dict],
    *,
    tools: list[dict] | None = None,
    require_vision: bool = False,
    stream: bool = False,
    response_controls: dict[str, object] | None = None,
) -> RoutingRequestFeatures:
    normalized_controls = response_controls or {}
    max_output_tokens = normalized_controls.get("max_output_tokens")
    parsed_max_output_tokens = int(max_output_tokens) if isinstance(max_output_tokens, int) else None
    return RoutingRequestFeatures(
        message_count=len(messages),
        text_characters=_message_text_length(messages),
        has_tools=bool(tools),
        require_vision=require_vision,
        stream=stream,
        max_output_tokens=parsed_max_output_tokens,
        has_system_prompt=any(str(message.get("role", "")) == "system" for message in messages),
    )


def classify_request(
    messages: list[dict],
    *,
    tools: list[dict] | None = None,
    require_vision: bool = False,
    stream: bool = False,
    response_controls: dict[str, object] | None = None,
) -> ClassificationResult:
    features = extract_request_features(
        messages,
        tools=tools,
        require_vision=require_vision,
        stream=stream,
        response_controls=response_controls,
    )
    rules: list[str] = []

    if features.require_vision:
        rules.append("vision_input_requires_non_simple")
    if features.has_tools:
        rules.append("tool_calling_requires_non_simple")
    if features.message_count >= 6:
        rules.append("conversation_depth_requires_non_simple")
    if features.text_characters >= 3500:
        rules.append("prompt_size_requires_non_simple")
    if features.max_output_tokens is not None and features.max_output_tokens >= 1200:
        rules.append("large_output_budget_requires_non_simple")

    if rules:
        return ClassificationResult(
            label="non_simple",
            confidence=1.0,
            summary="Deterministic routing rules classified this request as non-simple.",
            rules=tuple(rules),
            features=features,
        )

    simple_rules = ["default_simple_path"]
    if features.stream:
        simple_rules.append("streaming_kept_interactive")
    if features.has_system_prompt:
        simple_rules.append("system_prompt_present")
    return ClassificationResult(
        label="simple",
        confidence=1.0,
        summary="No non-simple routing rule matched, so the request stays on the simple path.",
        rules=tuple(simple_rules),
        features=features,
    )


def default_classification() -> ClassificationResult:
    return ClassificationResult(
        label="simple",
        confidence=0.0,
        summary="No request was inspected yet.",
        rules=("unclassified_default",),
        features=None,
    )

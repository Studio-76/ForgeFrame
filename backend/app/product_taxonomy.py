"""Formal native ForgeFrame taxonomy and runtime mapping helpers."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

NATIVE_MAPPING_METADATA_KEY = "forgeframe_native_mapping"

NativeProductObjectKind = Literal[
    "response",
    "response_item",
    "response_tool_call",
    "response_tool_output",
    "response_stream_event",
    "conversation",
    "thread",
    "participant",
    "task",
    "run",
    "dispatch_job",
    "approval",
    "action_draft",
    "artifact",
    "skill",
    "memory_entry",
]

NativeEventKind = Literal[
    "learning_event",
    "mention_event",
    "handoff_event",
    "blocker_event",
    "review_request_event",
    "resumed_transition",
    "retried_transition",
    "escalated_transition",
]

NativeCommandKind = Literal[
    "approve",
    "reject",
    "promote_memory",
    "promote_skill",
    "start_run",
    "cancel_run",
    "escalate_run",
]

NativeViewKind = Literal[
    "action_preview",
    "conversation_lens",
    "search_projection",
    "recall_projection",
]


class NativeProductObjectRef(BaseModel):
    kind: NativeProductObjectKind
    object_id: str
    relation: str
    lifecycle_state: str | None = None
    label: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)


class NativeEventRecord(BaseModel):
    event_kind: NativeEventKind
    related_object_kind: NativeProductObjectKind | None = None
    related_object_id: str | None = None
    status: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)


class NativeCommandRecord(BaseModel):
    command_kind: NativeCommandKind
    command_id: str | None = None
    status: str | None = None
    actor_type: str | None = None
    actor_id: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)


class NativeViewRecord(BaseModel):
    view_kind: NativeViewKind
    available: bool
    label: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)


class RuntimeNativeMapping(BaseModel):
    object: Literal["forgeframe.native_mapping"] = "forgeframe.native_mapping"
    mapping_version: Literal["2026-04-v1"] = "2026-04-v1"
    contract_surface: Literal["openai_responses", "forgeframe_execution"] = "openai_responses"
    request_path: str
    response_id: str | None = None
    processing_mode: Literal["sync", "background"]
    stream: bool = False
    background: bool = False
    primary_native_object_kind: NativeProductObjectKind | None = None
    objects: list[NativeProductObjectRef] = Field(default_factory=list)
    events: list[NativeEventRecord] = Field(default_factory=list)
    commands: list[NativeCommandRecord] = Field(default_factory=list)
    views: list[NativeViewRecord] = Field(default_factory=list)
    route_context: dict[str, Any] = Field(default_factory=dict)
    notes: list[str] = Field(default_factory=list)


def normalize_runtime_native_mapping(
    native_mapping: RuntimeNativeMapping | dict[str, Any] | None,
) -> dict[str, Any]:
    if native_mapping is None:
        return {}
    if isinstance(native_mapping, RuntimeNativeMapping):
        return native_mapping.model_dump(mode="json")
    if not native_mapping:
        return {}
    return RuntimeNativeMapping.model_validate(native_mapping).model_dump(mode="json")


def extract_runtime_native_mapping(metadata: Any) -> dict[str, Any]:
    if not isinstance(metadata, dict):
        return {}
    raw = metadata.get(NATIVE_MAPPING_METADATA_KEY)
    if not isinstance(raw, dict):
        return {}
    return normalize_runtime_native_mapping(raw)


def attach_runtime_native_mapping(
    metadata: dict[str, Any] | None,
    native_mapping: RuntimeNativeMapping | dict[str, Any] | None,
) -> dict[str, Any]:
    merged = dict(metadata or {})
    normalized = normalize_runtime_native_mapping(native_mapping)
    if normalized:
        merged[NATIVE_MAPPING_METADATA_KEY] = normalized
    return merged

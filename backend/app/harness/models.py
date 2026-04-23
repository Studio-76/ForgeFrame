"""Harness domain models for generic provider/model onboarding."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


IntegrationClass = Literal["openai_compatible", "templated_http", "static_catalog"]


class HarnessRequestMapping(BaseModel):
    method: Literal["POST", "GET"] = "POST"
    path: str = "/chat/completions"
    headers: dict[str, str] = Field(default_factory=dict)
    body_template: dict[str, Any] = Field(
        default_factory=lambda: {
            "model": "{{model}}",
            "messages": "{{messages}}",
            "stream": "{{stream}}",
        }
    )


class HarnessResponseMapping(BaseModel):
    text_path: str = "choices.0.message.content"
    finish_reason_path: str = "choices.0.finish_reason"
    model_path: str = "model"
    prompt_tokens_path: str = "usage.prompt_tokens"
    completion_tokens_path: str = "usage.completion_tokens"
    total_tokens_path: str = "usage.total_tokens"
    tool_calls_path: str = "choices.0.message.tool_calls"


class HarnessErrorMapping(BaseModel):
    message_path: str = "error.message"
    type_path: str = "error.type"


class HarnessStreamMapping(BaseModel):
    enabled: bool = False
    data_prefix: str = "data:"
    done_marker: str = "[DONE]"
    delta_path: str = "choices.0.delta.content"
    tool_calls_path: str = "choices.0.delta.tool_calls"
    finish_reason_path: str = "choices.0.finish_reason"
    usage_prompt_tokens_path: str = "usage.prompt_tokens"
    usage_completion_tokens_path: str = "usage.completion_tokens"
    usage_total_tokens_path: str = "usage.total_tokens"


class HarnessCapabilityProfile(BaseModel):
    streaming: bool = False
    tool_calling: bool = False
    vision: bool = False
    discovery_support: bool = False
    model_source: Literal["static", "manual", "discovered", "templated"] = "manual"


class HarnessProviderProfile(BaseModel):
    provider_key: str
    label: str
    integration_class: IntegrationClass
    endpoint_base_url: str
    auth_scheme: Literal["none", "bearer", "api_key_header"] = "none"
    auth_value: str = ""
    auth_header: str = "Authorization"
    template_id: str | None = None
    enabled: bool = True
    models: list[str] = Field(default_factory=list)
    discovery_enabled: bool = False
    request_mapping: HarnessRequestMapping = Field(default_factory=HarnessRequestMapping)
    response_mapping: HarnessResponseMapping = Field(default_factory=HarnessResponseMapping)
    error_mapping: HarnessErrorMapping = Field(default_factory=HarnessErrorMapping)
    stream_mapping: HarnessStreamMapping = Field(default_factory=HarnessStreamMapping)
    capabilities: HarnessCapabilityProfile = Field(default_factory=HarnessCapabilityProfile)


class HarnessModelInventoryItem(BaseModel):
    model: str
    source: Literal["static", "manual", "discovered", "templated"] = "manual"
    active: bool = True
    status: Literal["ready", "warning", "error", "stale"] = "ready"
    readiness_reason: str | None = None
    discovered_at: str | None = None
    synced_at: str | None = None


class HarnessProfileRecord(HarnessProviderProfile):
    created_at: str = ""
    updated_at: str = ""
    config_revision: int = 1
    config_revision_parent: int | None = None
    config_history: list[dict[str, Any]] = Field(default_factory=list)
    last_exported_at: str | None = None
    last_imported_at: str | None = None
    lifecycle_status: Literal["draft", "ready", "degraded", "error", "disabled"] = "draft"
    last_verified_at: str | None = None
    last_verify_status: Literal["never", "ok", "warning", "failed"] = "never"
    last_probe_at: str | None = None
    last_probe_status: Literal["never", "ok", "failed"] = "never"
    last_sync_at: str | None = None
    last_sync_status: str = "never"
    last_sync_error: str | None = None
    last_error: str | None = None
    last_used_at: str | None = None
    last_used_model: str | None = None
    verify_success_count: int = 0
    verify_failure_count: int = 0
    probe_success_count: int = 0
    probe_failure_count: int = 0
    request_count: int = 0
    stream_request_count: int = 0
    total_tokens: int = 0
    total_actual_cost: float = 0.0
    total_hypothetical_cost: float = 0.0
    total_avoided_cost: float = 0.0
    needs_attention: bool = False
    model_inventory: list[HarnessModelInventoryItem] = Field(default_factory=list)


class HarnessVerificationRequest(BaseModel):
    provider_key: str
    model: str | None = None
    test_message: str = "Hello from ForgeFrame harness"
    include_preview: bool = True
    live_probe: bool = False
    check_stream: bool = True


class HarnessPreviewRequest(BaseModel):
    provider_key: str
    model: str
    message: str = "Hello from ForgeFrame"
    messages: list[dict[str, Any]] = Field(default_factory=list)
    stream: bool = False
    tools: list[dict[str, Any]] = Field(default_factory=list)
    tool_choice: str | dict[str, Any] | None = None
    temperature: float | None = None
    max_output_tokens: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class HarnessVerificationResult(BaseModel):
    provider_key: str
    integration_class: IntegrationClass
    steps: list[dict[str, Any]]
    preview_request: dict[str, Any] | None = None
    preview_response: dict[str, Any] | None = None
    success: bool


class HarnessVerificationRun(BaseModel):
    run_id: str | None = None
    provider_key: str
    integration_class: IntegrationClass
    model: str | None = None
    mode: Literal["verify", "dry_run", "probe", "preview", "sync", "runtime_non_stream", "runtime_stream"]
    status: Literal["ok", "warning", "failed"] = "ok"
    success: bool
    steps: list[dict[str, Any]]
    error: str | None = None
    executed_at: str
    duration_ms: int | None = None
    client_id: str | None = None
    consumer: str | None = None
    integration: str | None = None


class HarnessTemplate(BaseModel):
    id: str
    label: str
    integration_class: IntegrationClass
    description: str
    profile_defaults: HarnessProviderProfile


class HarnessImportRequest(BaseModel):
    snapshot: dict[str, Any]
    dry_run: bool = True

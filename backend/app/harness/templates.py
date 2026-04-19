"""Built-in harness templates for generic providers."""

from __future__ import annotations

from app.harness.models import (
    HarnessCapabilityProfile,
    HarnessProviderProfile,
    HarnessTemplate,
)


BUILTIN_TEMPLATES: dict[str, HarnessTemplate] = {
    "openai_compatible": HarnessTemplate(
        id="openai_compatible",
        label="OpenAI Compatible API",
        integration_class="openai_compatible",
        description="Generic OpenAI-like /chat/completions endpoint with optional streaming.",
        profile_defaults=HarnessProviderProfile(
            provider_key="generic_openai_like",
            label="Generic OpenAI-like",
            integration_class="openai_compatible",
            endpoint_base_url="https://example.invalid/v1",
            auth_scheme="bearer",
            capabilities=HarnessCapabilityProfile(streaming=True, discovery_support=True, model_source="manual"),
        ),
    ),
    "templated_http": HarnessTemplate(
        id="templated_http",
        label="Templated HTTP Provider",
        integration_class="templated_http",
        description="Raw HTTP mapping with declarative request/response extraction.",
        profile_defaults=HarnessProviderProfile(
            provider_key="generic_http",
            label="Generic HTTP",
            integration_class="templated_http",
            endpoint_base_url="https://example.invalid/api",
            auth_scheme="api_key_header",
            auth_header="X-API-Key",
            capabilities=HarnessCapabilityProfile(streaming=False, discovery_support=False, model_source="templated"),
        ),
    ),
    "static_catalog": HarnessTemplate(
        id="static_catalog",
        label="Static Model Catalog",
        integration_class="static_catalog",
        description="Manual static model source for provider/model onboarding without discovery.",
        profile_defaults=HarnessProviderProfile(
            provider_key="static_models",
            label="Static Models",
            integration_class="static_catalog",
            endpoint_base_url="https://example.invalid/static",
            auth_scheme="none",
            capabilities=HarnessCapabilityProfile(streaming=False, discovery_support=False, model_source="static"),
        ),
    ),
    "ollama_local": HarnessTemplate(
        id="ollama_local",
        label="Ollama Local Runtime",
        integration_class="openai_compatible",
        description="Dedicated local Ollama template via /v1/chat/completions-compatible path.",
        profile_defaults=HarnessProviderProfile(
            provider_key="ollama_local",
            label="Ollama Local",
            integration_class="openai_compatible",
            endpoint_base_url="http://host.docker.internal:11434/v1",
            auth_scheme="none",
            models=["llama3.2"],
            stream_mapping={"enabled": True},
            capabilities=HarnessCapabilityProfile(streaming=True, discovery_support=True, model_source="manual"),
        ),
    ),
}

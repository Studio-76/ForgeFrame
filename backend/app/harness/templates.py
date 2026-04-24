"""Built-in harness templates for generic providers."""

from __future__ import annotations

from app.harness.models import (
    HarnessCapabilityProfile,
    HarnessProviderProfile,
    HarnessTemplate,
)
from app.harness.openai_provider_presets import OPENAI_PROVIDER_PRESET_TEMPLATES


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
    "antigravity_oauth_bridge": HarnessTemplate(
        id="antigravity_oauth_bridge",
        label="Antigravity OAuth Bridge",
        integration_class="openai_compatible",
        description="OAuth/account bridge template for Antigravity OpenAI-compatible endpoint.",
        profile_defaults=HarnessProviderProfile(
            provider_key="antigravity_oauth_bridge",
            label="Antigravity OAuth Bridge",
            integration_class="openai_compatible",
            endpoint_base_url="https://api.antigravity.example/v1",
            auth_scheme="bearer",
            models=["antigravity-beta"],
            stream_mapping={"enabled": True},
            capabilities=HarnessCapabilityProfile(streaming=True, discovery_support=False, model_source="manual"),
        ),
    ),
    "github_copilot_oauth_bridge": HarnessTemplate(
        id="github_copilot_oauth_bridge",
        label="GitHub Copilot OAuth Bridge",
        integration_class="openai_compatible",
        description="OAuth/account bridge template for GitHub Copilot endpoint.",
        profile_defaults=HarnessProviderProfile(
            provider_key="github_copilot_oauth_bridge",
            label="GitHub Copilot OAuth Bridge",
            integration_class="openai_compatible",
            endpoint_base_url="https://api.githubcopilot.example/v1",
            auth_scheme="bearer",
            models=["copilot-chat"],
            stream_mapping={"enabled": True},
            capabilities=HarnessCapabilityProfile(streaming=True, discovery_support=False, model_source="manual"),
        ),
    ),
    "claude_code_oauth_bridge": HarnessTemplate(
        id="claude_code_oauth_bridge",
        label="Claude Code OAuth Bridge",
        integration_class="openai_compatible",
        description="OAuth/account bridge template for Claude Code endpoint.",
        profile_defaults=HarnessProviderProfile(
            provider_key="claude_code_oauth_bridge",
            label="Claude Code OAuth Bridge",
            integration_class="openai_compatible",
            endpoint_base_url="https://api.claudecode.example/v1",
            auth_scheme="bearer",
            models=["claude-code"],
            stream_mapping={"enabled": True},
            capabilities=HarnessCapabilityProfile(streaming=True, discovery_support=False, model_source="manual"),
        ),
    ),
    "nous_oauth_bridge": HarnessTemplate(
        id="nous_oauth_bridge",
        label="Nous OAuth Bridge",
        integration_class="openai_compatible",
        description="OAuth/account bridge template for Nous Portal with separate runtime agent-key truth.",
        profile_defaults=HarnessProviderProfile(
            provider_key="nous_oauth_bridge",
            label="Nous OAuth Bridge",
            integration_class="openai_compatible",
            endpoint_base_url="https://inference-api.nousresearch.com/v1",
            auth_scheme="bearer",
            model_slug_policy="infer_vendor_if_missing",
            model_prefix="openai",
            models=["openai/gpt-5.4"],
            stream_mapping={"enabled": True},
            capabilities=HarnessCapabilityProfile(
                streaming=True,
                tool_calling=True,
                responses=False,
                discovery_support=False,
                model_source="manual",
                unsupported_features=[
                    "runtime requires minted agent key or equivalent live evidence",
                    "live account/runtime proof remains blocked without portal credentials",
                ],
            ),
        ),
    ),
    "qwen_oauth_bridge": HarnessTemplate(
        id="qwen_oauth_bridge",
        label="Qwen OAuth Bridge",
        integration_class="openai_compatible",
        description="OAuth/account bridge template for Qwen Portal with required QwenCode headers.",
        profile_defaults=HarnessProviderProfile(
            provider_key="qwen_oauth_bridge",
            label="Qwen OAuth Bridge",
            integration_class="openai_compatible",
            endpoint_base_url="https://portal.qwen.ai/v1",
            auth_scheme="bearer",
            models=["qwen-max"],
            request_mapping={
                "headers": {
                    "User-Agent": "QwenCode/0.14.1 (forgeframe; bridge)",
                    "X-DashScope-CacheControl": "enable",
                    "X-DashScope-UserAgent": "QwenCode/0.14.1 (forgeframe; bridge)",
                    "X-DashScope-AuthType": "qwen-oauth",
                }
            },
            stream_mapping={"enabled": True},
            capabilities=HarnessCapabilityProfile(
                streaming=True,
                tool_calling=True,
                responses=False,
                discovery_support=False,
                model_source="manual",
                unsupported_features=[
                    "portal-specific oauth headers required",
                    "live account/runtime proof remains blocked without portal credentials",
                ],
            ),
        ),
    ),
    **{template.id: template for template in OPENAI_PROVIDER_PRESET_TEMPLATES.values()},
}

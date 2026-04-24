"""Provider adapter registry for ForgeFrame runtime."""

from app.harness.service import HarnessService, get_harness_service
from app.providers.anthropic.adapter import AnthropicAdapter
from app.providers.base import ProviderAdapter
from app.providers.bedrock.adapter import BedrockAdapter
from app.providers.forgeframe_baseline import ForgeFrameBaselineAdapter
from app.providers.gemini.adapter import GeminiAdapter
from app.providers.generic_harness.adapter import GenericHarnessAdapter
from app.providers.ollama.adapter import OllamaAdapter
from app.providers.openai_api.adapter import OpenAIAPIAdapter
from app.providers.openai_codex.adapter import OpenAICodexAdapter
from app.settings.config import Settings


class ProviderRegistry:
    def __init__(self, settings: Settings, harness_service: HarnessService | None = None):
        harness = harness_service or get_harness_service()
        candidate_adapters: dict[str, ProviderAdapter] = {
            "forgeframe_baseline": ForgeFrameBaselineAdapter(settings),
            "openai_api": OpenAIAPIAdapter(settings),
            "openai_codex": OpenAICodexAdapter(settings),
            "gemini": GeminiAdapter(settings),
            "anthropic": AnthropicAdapter(settings),
            "bedrock": BedrockAdapter(settings),
            "generic_harness": GenericHarnessAdapter(settings, harness),
            "ollama": OllamaAdapter(settings),
        }
        self._adapters = {
            name: adapter
            for name, adapter in candidate_adapters.items()
            if settings.is_provider_enabled(name)
        }

    def get(self, provider_name: str) -> ProviderAdapter:
        try:
            return self._adapters[provider_name]
        except KeyError as exc:
            raise ValueError(f"Unknown or disabled provider adapter: {provider_name}") from exc

    def is_provider_ready(self, provider_name: str) -> bool:
        adapter = self.get(provider_name)
        return adapter.is_ready()

    def get_provider_status(self, provider_name: str) -> dict[str, object]:
        adapter = self.get(provider_name)
        status_capabilities = getattr(adapter, "status_capabilities", None)
        if callable(status_capabilities):
            capabilities = dict(status_capabilities())
        else:
            capabilities = adapter.capabilities.model_dump()
        return {
            "ready": adapter.is_ready(),
            "readiness_reason": adapter.readiness_reason(),
            "capabilities": capabilities,
            "discovery_supported": capabilities.get("discovery_support", False),
            "oauth_required": capabilities.get("oauth_required", False),
        }

    def list_provider_statuses(self) -> list[dict[str, object]]:
        return [
            {
                "provider": provider_name,
                **self.get_provider_status(provider_name),
            }
            for provider_name in sorted(self._adapters)
        ]

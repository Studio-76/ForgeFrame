"""Provider adapter registry for ForgeGate runtime."""

from app.providers.anthropic.adapter import AnthropicAdapter
from app.providers.base import ProviderAdapter
from app.providers.forgegate_baseline import ForgeGateBaselineAdapter
from app.providers.gemini.adapter import GeminiAdapter
from app.providers.openai_api.adapter import OpenAIAPIAdapter
from app.providers.openai_codex.adapter import OpenAICodexAdapter
from app.settings.config import Settings


class ProviderRegistry:
    def __init__(self, settings: Settings):
        candidate_adapters: dict[str, ProviderAdapter] = {
            "forgegate_baseline": ForgeGateBaselineAdapter(settings),
            "openai_api": OpenAIAPIAdapter(settings),
            "openai_codex": OpenAICodexAdapter(settings),
            "gemini": GeminiAdapter(),
            "anthropic": AnthropicAdapter(),
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
        capabilities = adapter.capabilities.model_dump()
        return {
            "ready": adapter.is_ready(),
            "readiness_reason": adapter.readiness_reason(),
            "capabilities": capabilities,
            "discovery_supported": capabilities.get("discovery_support", False),
            "oauth_required": capabilities.get("oauth_required", False),
        }

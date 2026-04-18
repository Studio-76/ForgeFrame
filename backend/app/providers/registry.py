"""Provider adapter registry for ForgeGate runtime."""

from app.providers.anthropic.adapter import AnthropicAdapter
from app.providers.base import ProviderAdapter
from app.providers.gemini.adapter import GeminiAdapter
from app.providers.openai_api.adapter import OpenAIAPIAdapter
from app.providers.openai_codex.adapter import OpenAICodexAdapter


class ProviderRegistry:
    def __init__(self):
        self._adapters: dict[str, ProviderAdapter] = {
            "openai_api": OpenAIAPIAdapter(),
            "openai_codex": OpenAICodexAdapter(),
            "gemini": GeminiAdapter(),
            "anthropic": AnthropicAdapter(),
        }

    def get(self, provider_name: str) -> ProviderAdapter:
        try:
            return self._adapters[provider_name]
        except KeyError as exc:
            raise ValueError(f"Unknown provider adapter: {provider_name}") from exc

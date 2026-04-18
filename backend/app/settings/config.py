"""Central ForgeGate runtime configuration (phase-5 streaming/codex baseline)."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="FORGEGATE_", env_file=".env", extra="ignore")

    app_name: str = "ForgeGate — Smart AI Gateway"
    app_version: str = "0.5.0"
    debug: bool = False

    host: str = "0.0.0.0"
    port: int = 8000
    api_base: str = "/v1"

    default_model: str = "forgegate-baseline-chat-v1"
    default_provider: str = "forgegate_baseline"
    runtime_allow_unknown_models: bool = False

    forgegate_baseline_enabled: bool = True
    openai_api_enabled: bool = True
    openai_codex_enabled: bool = True
    gemini_enabled: bool = True
    anthropic_enabled: bool = True
    generic_harness_enabled: bool = True

    openai_api_key: str = ""
    openai_api_base_url: str = "https://api.openai.com/v1"
    openai_timeout_seconds: int = 30

    openai_codex_auth_mode: Literal["oauth", "api_key"] = "oauth"
    openai_codex_oauth_mode: Literal["browser_callback", "manual_redirect_completion", "device_hosted_code"] = "manual_redirect_completion"
    openai_codex_oauth_access_token: str = ""
    openai_codex_api_key: str = ""
    openai_codex_discovery_enabled: bool = False
    openai_codex_discovery_required: bool = False
    openai_codex_discovered_models: tuple[str, ...] = ()

    pricing_openai_input_per_1m_tokens: float = 0.4
    pricing_openai_output_per_1m_tokens: float = 1.6
    pricing_codex_hypothetical_input_per_1m_tokens: float = 1.5
    pricing_codex_hypothetical_output_per_1m_tokens: float = 6.0
    pricing_internal_hypothetical_input_per_1m_tokens: float = 0.2
    pricing_internal_hypothetical_output_per_1m_tokens: float = 0.8
    observability_events_path: str = "backend/.forgegate/observability_events.jsonl"

    model_catalog: tuple[tuple[str, str, str], ...] = Field(
        default=(
            ("forgegate-baseline-chat-v1", "forgegate_baseline", "ForgeGate"),
            ("gpt-4.1-mini", "openai_api", "OpenAI"),
            ("gpt-4.1", "openai_api", "OpenAI"),
            ("gpt-5.3-codex", "openai_codex", "OpenAI Codex"),
            ("gemini-2.5-flash", "gemini", "Google"),
            ("claude-sonnet-4-5", "anthropic", "Anthropic"),
            ("generic-placeholder-chat", "generic_harness", "Generic Harness"),
        )
    )

    def is_provider_enabled(self, provider_name: str) -> bool:
        flag_map = {
            "forgegate_baseline": self.forgegate_baseline_enabled,
            "openai_api": self.openai_api_enabled,
            "openai_codex": self.openai_codex_enabled,
            "gemini": self.gemini_enabled,
            "anthropic": self.anthropic_enabled,
            "generic_harness": self.generic_harness_enabled,
        }
        return flag_map.get(provider_name, False)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

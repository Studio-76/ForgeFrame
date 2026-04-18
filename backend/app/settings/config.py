"""Central ForgeGate runtime configuration (phase-3 baseline)."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="FORGEGATE_", env_file=".env", extra="ignore")

    app_name: str = "ForgeGate — Smart AI Gateway"
    app_version: str = "0.3.1"
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

    model_catalog: tuple[tuple[str, str, str], ...] = Field(
        default=(
            ("forgegate-baseline-chat-v1", "forgegate_baseline", "ForgeGate"),
            ("gpt-4.1-mini", "openai_api", "OpenAI"),
            ("gpt-5.3-codex", "openai_codex", "OpenAI Codex"),
            ("gemini-2.5-flash", "gemini", "Google"),
            ("claude-sonnet-4-5", "anthropic", "Anthropic"),
        )
    )

    def is_provider_enabled(self, provider_name: str) -> bool:
        flag_map = {
            "forgegate_baseline": self.forgegate_baseline_enabled,
            "openai_api": self.openai_api_enabled,
            "openai_codex": self.openai_codex_enabled,
            "gemini": self.gemini_enabled,
            "anthropic": self.anthropic_enabled,
        }
        return flag_map.get(provider_name, False)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

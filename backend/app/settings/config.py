"""Central ForgeGate runtime configuration."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.tenancy import DEFAULT_BOOTSTRAP_TENANT_ID


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="FORGEGATE_", env_file=".env", extra="ignore")

    app_name: str = "ForgeGate — Smart AI Gateway"
    app_version: str = "0.6.0"
    debug: bool = False

    host: str = "0.0.0.0"
    port: int = 8000
    api_base: str = "/v1"

    default_model: str = "forgegate-baseline-chat-v1"
    default_provider: str = "forgegate_baseline"
    runtime_allow_unknown_models: bool = False
    runtime_auth_required: bool = False
    routing_strategy: Literal["balanced", "quality", "cost"] = "balanced"
    routing_require_healthy: bool = False
    routing_allow_degraded_fallback: bool = True

    admin_auth_enabled: bool = True
    bootstrap_admin_username: str = "admin"
    bootstrap_admin_password: str = "forgegate-admin"
    admin_session_ttl_hours: int = 12
    admin_login_rate_limit_attempts: int = 5
    admin_login_rate_limit_window_minutes: int = 15
    runtime_key_ttl_days: int = 90
    runtime_key_rotation_warning_days: int = 14
    impersonation_session_max_minutes: int = 30
    break_glass_session_max_minutes: int = 60
    audit_event_retention_limit: int = 1000

    forgegate_baseline_enabled: bool = True
    openai_api_enabled: bool = True
    openai_codex_enabled: bool = True
    gemini_enabled: bool = True
    anthropic_enabled: bool = False
    generic_harness_enabled: bool = True
    generic_harness_allow_model_fallback: bool = False
    ollama_enabled: bool = True

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
    openai_codex_bridge_enabled: bool = False
    openai_codex_base_url: str = "https://api.openai.com/v1"
    openai_codex_timeout_seconds: int = 45
    openai_codex_probe_model: str = "gpt-5.3-codex"

    gemini_auth_mode: Literal["oauth", "api_key"] = "oauth"
    gemini_oauth_access_token: str = ""
    gemini_api_key: str = ""
    gemini_probe_enabled: bool = False
    gemini_probe_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    gemini_probe_model: str = "gemini-2.5-flash"
    gemini_timeout_seconds: int = 45

    anthropic_api_key: str = ""
    anthropic_base_url: str = "https://api.anthropic.com/v1"
    anthropic_timeout_seconds: int = 45
    anthropic_version: str = "2023-06-01"
    anthropic_probe_model: str = "claude-3-5-sonnet-latest"
    anthropic_discovered_models: tuple[str, ...] = ("claude-3-5-sonnet-latest",)

    # Bridge-only OAuth/account targets are not runtime providers. Their
    # operator controls are explicit probe/profile toggles instead of generic
    # provider-enabled flags.
    antigravity_oauth_access_token: str = ""
    antigravity_probe_enabled: bool = False
    antigravity_probe_base_url: str = "https://api.antigravity.example/v1"
    antigravity_probe_model: str = "antigravity-beta"
    antigravity_bridge_profile_enabled: bool = False

    github_copilot_oauth_access_token: str = ""
    github_copilot_probe_enabled: bool = False
    github_copilot_probe_base_url: str = "https://api.githubcopilot.example/v1"
    github_copilot_probe_model: str = "copilot-chat"
    github_copilot_bridge_profile_enabled: bool = False

    claude_code_oauth_access_token: str = ""
    claude_code_probe_enabled: bool = False
    claude_code_probe_base_url: str = "https://api.claudecode.example/v1"
    claude_code_probe_model: str = "claude-code"
    claude_code_bridge_profile_enabled: bool = False

    ollama_base_url: str = "http://host.docker.internal:11434/v1"
    ollama_default_model: str = "llama3.2"
    ollama_timeout_seconds: int = 45
    oauth_account_probe_timeout_seconds: int = 30

    pricing_openai_input_per_1m_tokens: float = 0.4
    pricing_openai_output_per_1m_tokens: float = 1.6
    pricing_codex_hypothetical_input_per_1m_tokens: float = 1.5
    pricing_codex_hypothetical_output_per_1m_tokens: float = 6.0
    pricing_internal_hypothetical_input_per_1m_tokens: float = 0.2
    pricing_internal_hypothetical_output_per_1m_tokens: float = 0.8
    bootstrap_tenant_id: str = DEFAULT_BOOTSTRAP_TENANT_ID
    observability_storage_backend: Literal["postgresql", "file"] = "postgresql"
    observability_postgres_url: str = ""
    observability_events_path: str = "backend/.forgegate/observability_events.jsonl"
    oauth_operations_path: str = "backend/.forgegate/oauth_operations.jsonl"
    harness_profiles_path: str = "backend/.forgegate/harness_profiles.json"
    harness_runs_path: str = "backend/.forgegate/harness_runs.json"
    harness_storage_backend: Literal["postgresql", "file"] = "postgresql"
    harness_postgres_url: str = "postgresql+psycopg://forgegate:forgegate@localhost:5432/forgegate"
    control_plane_storage_backend: Literal["postgresql", "file"] = "postgresql"
    control_plane_postgres_url: str = ""
    control_plane_state_path: str = "backend/.forgegate/control_plane_state.json"
    governance_storage_backend: Literal["postgresql", "file"] = "postgresql"
    governance_postgres_url: str = ""
    governance_relational_dual_write_enabled: bool = True
    governance_relational_reads_enabled: bool = False
    governance_state_path: str = "backend/.forgegate/governance_state.json"
    execution_postgres_url: str = ""
    execution_sqlite_path: str = "backend/.forgegate/execution.sqlite"
    execution_max_attempts: int = 3
    execution_retry_backoff_base_seconds: int = 30
    execution_retry_backoff_max_seconds: int = 900
    execution_retry_backoff_jitter_ratio: float = 0.2
    frontend_dist_path: str = "frontend/dist"

    bootstrap_model_catalog: tuple[tuple[str, str, str], ...] = Field(
        default=(
            ("forgegate-baseline-chat-v1", "forgegate_baseline", "ForgeGate"),
            ("gpt-4.1-mini", "openai_api", "OpenAI"),
            ("gpt-4.1", "openai_api", "OpenAI"),
            ("gpt-5.3-codex", "openai_codex", "OpenAI Codex"),
            ("gemini-2.5-flash", "gemini", "Google"),
            ("generic-placeholder-chat", "generic_harness", "Generic Harness"),
            ("llama3.2", "ollama", "Ollama"),
        )
    )

    @staticmethod
    def _validate_postgres_target(setting_name: str, database_url: str) -> None:
        normalized = database_url.strip()
        if not normalized:
            raise ValueError(f"{setting_name} must be set when PostgreSQL storage is enabled.")
        if not normalized.startswith("postgresql"):
            raise ValueError(f"{setting_name} must use a postgresql:// or postgresql+ driver URL.")

    @model_validator(mode="after")
    def validate_operational_contract(self) -> "Settings":
        if self.admin_auth_enabled:
            if not self.bootstrap_admin_username.strip():
                raise ValueError("FORGEGATE_BOOTSTRAP_ADMIN_USERNAME must be set when admin auth is enabled.")
            if not self.bootstrap_admin_password.strip():
                raise ValueError("FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD must be set when admin auth is enabled.")

        if not self.is_provider_enabled(self.default_provider):
            raise ValueError("FORGEGATE_DEFAULT_PROVIDER must reference an enabled provider.")

        if self.harness_storage_backend == "postgresql":
            self._validate_postgres_target("FORGEGATE_HARNESS_POSTGRES_URL", self.harness_postgres_url)

        for backend_name, storage_backend, database_url in [
            (
                "FORGEGATE_CONTROL_PLANE_POSTGRES_URL",
                self.control_plane_storage_backend,
                self.control_plane_postgres_url.strip() or self.harness_postgres_url,
            ),
            (
                "FORGEGATE_OBSERVABILITY_POSTGRES_URL",
                self.observability_storage_backend,
                self.observability_postgres_url.strip() or self.harness_postgres_url,
            ),
            (
                "FORGEGATE_GOVERNANCE_POSTGRES_URL",
                self.governance_storage_backend,
                self.governance_postgres_url.strip() or self.harness_postgres_url,
            ),
        ]:
            if storage_backend == "postgresql":
                self._validate_postgres_target(backend_name, database_url)

        return self

    def is_provider_enabled(self, provider_name: str) -> bool:
        flag_map = {
            "forgegate_baseline": self.forgegate_baseline_enabled,
            "openai_api": self.openai_api_enabled,
            "openai_codex": self.openai_codex_enabled,
            "gemini": self.gemini_enabled,
            "anthropic": self.anthropic_enabled,
            "generic_harness": self.generic_harness_enabled,
            "ollama": self.ollama_enabled,
        }
        return flag_map.get(provider_name, False)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    base = Settings()
    try:
        from app.settings.service import load_persisted_setting_overrides

        overrides = load_persisted_setting_overrides(base)
    except Exception:
        overrides = {}
    if not overrides:
        return base
    return base.model_copy(update=overrides)

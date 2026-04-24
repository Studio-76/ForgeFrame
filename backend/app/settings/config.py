"""Central ForgeFrame runtime configuration."""

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal, get_origin

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.public_surface import has_configured_public_acme_email, has_configured_public_fqdn
from app.tenancy import DEFAULT_BOOTSTRAP_TENANT_ID

PRIMARY_ENV_PREFIX = "FORGEFRAME_"
LEGACY_ENV_PREFIX = "FORGEGATE_"
_ENV_FILES = (".env",)

def _coerce_env_value(value: str) -> str:
    return value.strip().strip('"').strip("'")


def _load_env_file_values() -> dict[str, str]:
    values: dict[str, str] = {}
    for env_file in _ENV_FILES:
        path = Path(env_file)
        if not path.exists():
            continue
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, raw_value = line.partition("=")
            normalized_key = key.strip()
            normalized_value = _coerce_env_value(raw_value)
            values.setdefault(normalized_key, normalized_value)
    return values


def _legacy_brand_env_fallbacks(*, explicit_values: dict[str, Any]) -> dict[str, Any]:
    raw_values = _load_env_file_values()
    raw_values.update(os.environ)

    legacy_aliases: dict[str, tuple[str, ...]] = {
        "forgeframe_baseline_enabled": (
            "FORGEFRAME_FORGEGATE_BASELINE_ENABLED",
            "FORGEGATE_FORGEGATE_BASELINE_ENABLED",
        ),
    }
    legacy_fallbacks: dict[str, Any] = {}
    for field_name in Settings.model_fields:
        if field_name in explicit_values:
            continue

        suffix = field_name.upper()
        primary_key = f"{PRIMARY_ENV_PREFIX}{suffix}"
        legacy_key = f"{LEGACY_ENV_PREFIX}{suffix}"
        if primary_key in raw_values:
            continue

        legacy_value = next(
            (
                raw_values[key]
                for key in (legacy_key, *legacy_aliases.get(field_name, ()))
                if key in raw_values
            ),
            None,
        )
        if legacy_value is not None:
            origin = get_origin(Settings.model_fields[field_name].annotation)
            if origin in {dict, list, tuple}:
                try:
                    legacy_fallbacks[field_name] = json.loads(legacy_value)
                    continue
                except json.JSONDecodeError:
                    pass
            legacy_fallbacks[field_name] = legacy_value

    return legacy_fallbacks


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="FORGEFRAME_", env_file=".env", extra="ignore")

    def __init__(self, **values):
        super().__init__(**(_legacy_brand_env_fallbacks(explicit_values=values) | values))

    app_name: str = "ForgeFrame — Autonomous AI Runtime Platform"
    app_version: str = "0.6.0"
    debug: bool = False

    host: str = "127.0.0.1"
    port: int = 8080
    api_base: str = "/v1"
    public_fqdn: str = ""
    public_https_host: str = "0.0.0.0"
    public_https_port: int = 443
    public_http_helper_host: str = "0.0.0.0"
    public_http_helper_port: int = 80
    public_admin_base: str = "/admin"
    public_tls_mode: Literal["disabled", "manual", "integrated_acme"] = "disabled"
    public_tls_cert_path: str = "/etc/forgeframe/tls/live/fullchain.pem"
    public_tls_key_path: str = "/etc/forgeframe/tls/live/privkey.pem"
    public_tls_webroot_path: str = "/var/lib/forgeframe/acme-webroot"
    public_tls_state_path: str = "/var/lib/forgeframe/tls"
    public_tls_last_error_path: str = "/var/lib/forgeframe/tls/last_error.txt"
    public_tls_renewal_window_days: int = 30
    public_tls_acme_email: str = ""
    public_tls_acme_directory_url: str = "https://acme-v02.api.letsencrypt.org/directory"

    default_model: str = "forgeframe-baseline-chat-v1"
    default_provider: str = "forgeframe_baseline"
    runtime_allow_unknown_models: bool = False
    runtime_auth_required: bool = True
    routing_strategy: Literal["balanced", "quality", "cost"] = "balanced"
    routing_require_healthy: bool = False
    routing_allow_degraded_fallback: bool = True

    admin_auth_enabled: bool = True
    bootstrap_admin_username: str = "admin"
    bootstrap_admin_password: str = ""
    admin_session_ttl_hours: int = 12
    admin_login_rate_limit_attempts: int = 5
    admin_login_rate_limit_window_minutes: int = 15
    runtime_key_ttl_days: int = 90
    runtime_key_rotation_warning_days: int = 14
    impersonation_session_max_minutes: int = 30
    break_glass_session_max_minutes: int = 60
    audit_event_retention_limit: int = 1000

    forgeframe_baseline_enabled: bool = True
    openai_api_enabled: bool = True
    openai_codex_enabled: bool = True
    gemini_enabled: bool = True
    anthropic_enabled: bool = False
    bedrock_enabled: bool = False
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
    anthropic_auth_mode: Literal["api_key", "bearer"] = "api_key"
    anthropic_bearer_token: str = ""
    anthropic_base_url: str = "https://api.anthropic.com/v1"
    anthropic_timeout_seconds: int = 45
    anthropic_version: str = "2023-06-01"
    anthropic_probe_model: str = "claude-3-5-sonnet-latest"
    anthropic_discovered_models: tuple[str, ...] = ("claude-3-5-sonnet-latest",)

    bedrock_base_url: str = "https://bedrock-runtime.us-east-1.amazonaws.com"
    bedrock_region: str = "us-east-1"
    bedrock_access_key_id: str = ""
    bedrock_secret_access_key: str = ""
    bedrock_session_token: str = ""
    bedrock_timeout_seconds: int = 45

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

    nous_oauth_access_token: str = ""
    nous_oauth_runtime_agent_key: str = ""
    nous_oauth_probe_enabled: bool = False
    nous_oauth_probe_base_url: str = "https://inference-api.nousresearch.com/v1"
    nous_oauth_probe_model: str = "openai/gpt-5.4"
    nous_oauth_bridge_profile_enabled: bool = False
    nous_oauth_agent_key_min_ttl_seconds: int = 1800

    qwen_oauth_access_token: str = ""
    qwen_oauth_probe_enabled: bool = False
    qwen_oauth_probe_base_url: str = "https://portal.qwen.ai/v1"
    qwen_oauth_probe_model: str = "qwen-max"
    qwen_oauth_bridge_profile_enabled: bool = False

    ollama_base_url: str = "http://127.0.0.1:11434/v1"
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
    observability_events_path: str = "backend/.forgeframe/observability_events.jsonl"
    oauth_operations_path: str = "backend/.forgeframe/oauth_operations.jsonl"
    harness_profiles_path: str = "backend/.forgeframe/harness_profiles.json"
    harness_runs_path: str = "backend/.forgeframe/harness_runs.json"
    harness_storage_backend: Literal["postgresql", "file"] = "postgresql"
    harness_postgres_url: str = ""
    control_plane_storage_backend: Literal["postgresql", "file"] = "postgresql"
    control_plane_postgres_url: str = ""
    control_plane_state_path: str = "backend/.forgeframe/control_plane_state.json"
    instances_storage_backend: Literal["postgresql", "file"] = "postgresql"
    instances_postgres_url: str = ""
    instances_state_path: str = "backend/.forgeframe/instances_state.json"
    governance_storage_backend: Literal["postgresql", "file"] = "postgresql"
    governance_postgres_url: str = ""
    governance_relational_dual_write_enabled: bool = True
    governance_relational_reads_enabled: bool = True
    governance_state_path: str = "backend/.forgeframe/governance_state.json"
    execution_postgres_url: str = ""
    execution_sqlite_path: str = "backend/.forgeframe/execution.sqlite"
    execution_max_attempts: int = 3
    execution_retry_backoff_base_seconds: int = 30
    execution_retry_backoff_max_seconds: int = 900
    execution_retry_backoff_jitter_ratio: float = 0.2
    execution_worker_instance_id: str = ""
    execution_worker_company_id: str = ""
    execution_worker_key: str = "forgeframe-worker"
    execution_worker_execution_lane: str = "background_agentic"
    execution_worker_run_kind: str = "responses_background"
    execution_worker_poll_interval_seconds: float = 2.0
    execution_worker_lease_ttl_seconds: int = 300
    execution_worker_heartbeat_ttl_seconds: int = 360
    frontend_dist_path: str = "frontend/dist"

    bootstrap_model_catalog: tuple[tuple[str, str, str], ...] = Field(
        default=(
            ("forgeframe-baseline-chat-v1", "forgeframe_baseline", "ForgeFrame"),
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
                raise ValueError("FORGEFRAME_BOOTSTRAP_ADMIN_USERNAME must be set when admin auth is enabled.")
            if not self.bootstrap_admin_password.strip():
                raise ValueError("FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD must be set when admin auth is enabled.")

        if not self.is_provider_enabled(self.default_provider):
            raise ValueError("FORGEFRAME_DEFAULT_PROVIDER must reference an enabled provider.")

        if self.harness_storage_backend == "postgresql":
            self._validate_postgres_target("FORGEFRAME_HARNESS_POSTGRES_URL", self.harness_postgres_url)

        for backend_name, storage_backend, database_url in [
            (
                "FORGEFRAME_CONTROL_PLANE_POSTGRES_URL",
                self.control_plane_storage_backend,
                self.control_plane_postgres_url.strip() or self.harness_postgres_url,
            ),
            (
                "FORGEFRAME_OBSERVABILITY_POSTGRES_URL",
                self.observability_storage_backend,
                self.observability_postgres_url.strip() or self.harness_postgres_url,
            ),
            (
                "FORGEFRAME_GOVERNANCE_POSTGRES_URL",
                self.governance_storage_backend,
                self.governance_postgres_url.strip() or self.harness_postgres_url,
            ),
            (
                "FORGEFRAME_INSTANCES_POSTGRES_URL",
                self.instances_storage_backend,
                self.instances_postgres_url.strip() or self.governance_postgres_url.strip() or self.harness_postgres_url,
            ),
        ]:
            if storage_backend == "postgresql":
                self._validate_postgres_target(backend_name, database_url)

        if self.public_tls_mode == "integrated_acme":
            if not has_configured_public_fqdn(self.public_fqdn):
                raise ValueError("FORGEFRAME_PUBLIC_FQDN must be set when integrated ACME/TLS mode is enabled.")
            if not has_configured_public_acme_email(self.public_tls_acme_email):
                raise ValueError("FORGEFRAME_PUBLIC_TLS_ACME_EMAIL must be set when integrated ACME/TLS mode is enabled.")

        return self

    def is_provider_enabled(self, provider_name: str) -> bool:
        flag_map = {
            "forgeframe_baseline": self.forgeframe_baseline_enabled,
            "openai_api": self.openai_api_enabled,
            "openai_codex": self.openai_codex_enabled,
            "gemini": self.gemini_enabled,
            "anthropic": self.anthropic_enabled,
            "bedrock": self.bedrock_enabled,
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

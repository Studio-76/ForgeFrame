"""Seed loading for the V9 provider catalog and evidence baseline."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
import re


@dataclass(frozen=True)
class ProviderCatalogSeedRow:
    provider_id: str
    display_name: str
    raw_class: str
    provider_class: str
    source_kind: str
    source_docs: tuple[str, ...]
    local_reference_paths: tuple[str, ...]
    auth_modes_supported: tuple[str, ...]
    api_modes_supported: tuple[str, ...]
    primary_contracts: tuple[str, ...]
    base_url_default: str | None
    base_url_override_env: str | None
    token_env_vars: tuple[str, ...]
    model_name_policy: str
    streaming_support_claim: str
    tools_support_claim: str
    responses_support_claim: str


_OPENAI_COMPAT_CLASSES = {
    "native_openai",
    "openai_compatible",
    "openai_compatible_special",
    "openai_compatible_or_native",
    "openai_compatible_router",
    "openai_compatible_aggregator",
    "openai_compatible_aggregator_oauth",
    "openai_or_anthropic_compatible",
    "openai_compatible_local",
    "openai_compatible_local_or_remote",
}

_OPENAI_COMPAT_AGGREGATOR_CLASSES = {
    "openai_compatible_aggregator",
    "openai_compatible_aggregator_oauth",
    "openai_compatible_router",
}

_LOCAL_CLASSES = {"openai_compatible_local", "openai_compatible_local_or_remote"}

_PROVIDER_CLASS_OVERRIDES = {
    "anthropic_messages": "anthropic_messages",
    "anthropic_compatible": "anthropic_messages",
    "gemini_native": "gemini_native",
    "bedrock_converse": "bedrock_converse",
    "gateway_api": "agent_endpoint_compat",
    "mixed_gateway_api": "agent_endpoint_compat",
    "agent_endpoint_compat": "agent_endpoint_compat",
    "client_config_reference": "client_config_reference",
    "client_or_provider_compat": "client_config_reference",
    "oauth_pkce_account_runtime": "oauth_account_runtime",
    "oauth_bearer": "oauth_account_runtime",
    "github_oauth_pat_app_token_acp": "oauth_cli_bridge",
    "oauth_cli_or_agent_sdk": "oauth_cli_bridge",
    "google_oauth_desktop_agent": "oauth_cli_bridge",
    "google_oauth_cli_code_assist": "oauth_cli_bridge",
    "oauth_device_code_agent_key": "oauth_cli_bridge",
}

_PROVIDER_ID_CLASS_OVERRIDES = {
    "opencode_zen": "openai_compatible_aggregator",
    "opencode_go": "openai_compatible_aggregator",
    "nous_oauth": "oauth_account_runtime",
    "qwen_oauth": "oauth_account_runtime",
    "minimax": "openai_compatible",
}

_BASE_URL_ENV_OVERRIDES = {
    "openai": "FORGEGATE_OPENAI_API_BASE_URL",
    "openai_codex": "FORGEGATE_OPENAI_CODEX_BASE_URL",
    "gemini_native": "FORGEGATE_GEMINI_PROBE_BASE_URL",
    "google_gemini_oauth": "FORGEGATE_GEMINI_PROBE_BASE_URL",
    "anthropic": "FORGEGATE_ANTHROPIC_BASE_URL",
    "bedrock": "FORGEFRAME_BEDROCK_BASE_URL",
    "ollama": "FORGEGATE_OLLAMA_BASE_URL",
}

_REFERENCE_HINTS = {
    "openai": ("reference/Provider/API-OpenAI.md", "reference/OpenAI/API/OpenAI"),
    "azure_openai": ("reference/Provider/API-AzureOpenAI.md", "reference/OpenAI/API/AzureOpenAI"),
    "anthropic": ("reference/Provider/API-Anthropic.md", "reference/OpenAI/API/Anthropic"),
    "gemini_openai": ("reference/Provider/API-GeminiOpenAICompatible.md", "reference/OpenAI/API/GoogleGemini"),
    "gemini_native": ("reference/Provider/API-Gemini.md", "reference/Provider/Gemini", "reference/OpenAI/API/GoogleGemini"),
    "google_vertex_ai": ("reference/Provider/API-GoogleVertexAI.md", "reference/OpenAI/API/GoogleVertexAI"),
    "bedrock": ("reference/Provider/API-Bedrock.md",),
    "groq": ("reference/Provider/API-Groq.md", "reference/OpenAI/API/Groq"),
    "deepseek": ("reference/Provider/API-DeepSeek.md",),
    "mistral": ("reference/Provider/API-Mistral.md", "reference/OpenAI/API/Mistral"),
    "together": ("reference/Provider/API-TogetherAI.md", "reference/OpenAI/API/TogetherAI"),
    "fireworks": ("reference/Provider/API-FireworksAI.md", "reference/OpenAI/API/FireworksAI"),
    "cerebras": ("reference/Provider/API-Cerebras.md", "reference/OpenAI/API/Cerebras"),
    "openrouter": ("reference/Provider/API-OpenRouter.md", "reference/OpenAI/API/OpenRouter"),
    "vercel_ai_gateway": ("reference/Provider/API-VercelAIGateway.md",),
    "nous": ("reference/Provider/API-NousPortal.md", "reference/Oauth/OAUTH-NousPortal.md"),
    "kilocode": ("reference/Provider/API-KiloCode.md",),
    "huggingface": ("reference/Provider/API-HuggingFace.md",),
    "nvidia_nim": ("reference/Provider/API-NvidiaNIM.md",),
    "arcee": ("reference/Provider/API-ArceeAI.md",),
    "alibaba_dashscope": ("reference/Provider/API-AlibabaDashScope.md",),
    "kimi_moonshot": ("reference/Provider/API-KimiMoonshot.md",),
    "minimax": ("reference/Provider/API-MiniMax.md",),
    "perplexity": ("reference/Provider/API-Perplexity.md", "reference/OpenAI/API/Perplexity"),
    "ollama": ("reference/Provider/API-Ollama.md", "reference/OpenAI/API/Ollama"),
    "ollama_cloud": ("reference/Provider/API-OllamaCloud.md",),
    "localai": ("reference/Provider/API-LocalAI.md", "reference/OpenAI/API/LocalAI"),
    "llama_cpp": ("reference/Provider/API-LlamaCpp.md", "reference/OpenAI/API/LlamaCpp"),
    "llama_cpp_python": ("reference/Provider/API-LlamaCppPython.md", "reference/OpenAI/API/LlamaCppPython"),
    "vllm": ("reference/Provider/API-vLLM.md", "reference/OpenAI/API/vLLM"),
    "xai": ("reference/Provider/API-xAI.md", "reference/OpenAI/API/xAI"),
    "zai": ("reference/Provider/API-ZAI.md",),
    "xiaomi_mimo": ("reference/Provider/API-XiaomiMiMo.md",),
    "opencode_zen": ("reference/Provider/API-OpenCodeZen.md",),
    "opencode_go": ("reference/Provider/API-OpenCodeGo.md",),
    "openwebui": ("reference/Provider/API-OpenWebUI.md", "reference/OpenAI/API/OpenWebUI"),
    "continue_openai": ("reference/Provider/API-ContinueOpenAI.md", "reference/OpenAI/API/Continue"),
    "microsoft_agent_framework": ("reference/Provider/API-MicrosoftAgentFramework.md", "reference/OpenAI/API/MicrosoftAgentFramework"),
    "openai_codex": ("reference/Provider/API-OpenAICodex.md", "reference/Provider/OpenAICodex", "reference/Oauth/OpenAICodex"),
    "github_copilot": ("reference/Provider/API-GitHubCopilot.md", "reference/Provider/GitHubCopilot", "reference/Oauth/GitHubCopilot"),
    "claude_code": ("reference/Provider/API-ClaudeCode.md", "reference/Provider/ClaudeCode", "reference/Oauth/ClaudeCode"),
    "antigravity": ("reference/Provider/API-Antigravity.md", "reference/Provider/Antigravity", "reference/Oauth/Antigravity"),
    "google_gemini_oauth": ("reference/Oauth/OAUTH-GoogleGemini.md", "reference/Oauth/Gemini", "reference/Provider/Gemini"),
    "nous_oauth": ("reference/Oauth/OAUTH-NousPortal.md", "reference/Provider/API-NousPortal.md"),
    "qwen_oauth": ("reference/Oauth/OAUTH-Qwen.md",),
}


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _matrices_root() -> Path:
    return _repo_root() / "docs" / "v9-provider-work" / "forgeframe_provider_specs_tickets" / "Matrices"


def _reference_root() -> Path:
    return _repo_root() / "reference"


def _normalize_provider_class(provider_id: str, raw_class: str) -> str:
    if provider_id in _PROVIDER_ID_CLASS_OVERRIDES:
        return _PROVIDER_ID_CLASS_OVERRIDES[provider_id]
    if raw_class in _PROVIDER_CLASS_OVERRIDES:
        return _PROVIDER_CLASS_OVERRIDES[raw_class]
    if raw_class in _OPENAI_COMPAT_AGGREGATOR_CLASSES:
        return "openai_compatible_aggregator"
    if raw_class in _LOCAL_CLASSES:
        return "openai_compatible_local"
    if raw_class in _OPENAI_COMPAT_CLASSES:
        return "openai_compatible"
    return "unsupported_documented"


def _split_cell(value: str) -> tuple[str, ...]:
    normalized = value.replace(" + ", ",").replace(" or ", ",").replace(";", ",")
    items = [item.strip() for item in normalized.split(",")]
    return tuple(item for item in items if item)


def _extract_env_vars(value: str) -> tuple[str, ...]:
    env_vars = re.findall(r"\b[A-Z][A-Z0-9_]{2,}\b", value)
    seen: set[str] = set()
    ordered: list[str] = []
    for item in env_vars:
        if item not in seen:
            ordered.append(item)
            seen.add(item)
    return tuple(ordered)


def _extract_auth_modes(value: str) -> tuple[str, ...]:
    lowered = value.lower()
    modes: list[str] = []
    if "oauth" in lowered:
        modes.append("oauth")
    if "pkce" in lowered:
        modes.append("pkce")
    if "device" in lowered:
        modes.append("device_code")
    if "pat" in lowered:
        modes.append("personal_access_token")
    if "entra" in lowered:
        modes.append("entra_token")
    if "iam" in lowered or "aws sdk" in lowered:
        modes.append("iam")
    if "bearer" in lowered:
        modes.append("bearer_token")
    if "api key" in lowered or "_api_key" in lowered.lower():
        modes.append("api_key")
    if "none" in lowered or "local configured" in lowered:
        modes.append("none")
    if not modes:
        modes.append("configured_auth")
    return tuple(dict.fromkeys(modes))


def _extract_api_modes(value: str, docs: tuple[str, ...], provider_class: str) -> tuple[str, ...]:
    lowered = value.lower()
    modes: list[str] = []
    if "chat/completions" in lowered:
        modes.append("chat_completions")
    if "/responses" in lowered:
        modes.append("responses")
    if "/models" in lowered:
        modes.append("models")
    if "/files" in lowered:
        modes.append("files")
    if "embeddings" in lowered:
        modes.append("embeddings")
    if "images" in lowered:
        modes.append("images")
    if "videos" in lowered:
        modes.append("videos")
    if "/messages" in lowered:
        modes.append("messages")
    if "converse" in lowered:
        modes.append("converse")
    if "sdk" in lowered or any("sdk" in item.lower() for item in docs):
        modes.append("sdk")
    if "cli" in lowered or any("cli" in item.lower() for item in docs):
        modes.append("cli")
    if "agent" in lowered or provider_class in {"oauth_cli_bridge", "external_process", "agent_endpoint_compat"}:
        modes.append("agent")
    return tuple(dict.fromkeys(modes))


def _parse_base_url(value: str) -> str | None:
    match = re.search(r"https?://[^\s,|]+", value)
    return match.group(0) if match else None


def _claim_for_streaming(provider_class: str, api_modes: tuple[str, ...], primary_contract: str) -> str:
    lowered = primary_contract.lower()
    if "stream" in lowered or provider_class in {"openai_compatible", "openai_compatible_aggregator", "openai_compatible_local", "anthropic_messages", "gemini_native", "bedrock_converse", "oauth_account_runtime"}:
        return "documented"
    if provider_class in {"oauth_cli_bridge", "external_process"}:
        return "bridge-only"
    if "chat_completions" in api_modes or "responses" in api_modes:
        return "expected-via-openai-compatible-contract"
    return "unknown"


def _claim_for_tools(provider_class: str, api_modes: tuple[str, ...], primary_contract: str) -> str:
    lowered = primary_contract.lower()
    if provider_class in {"openai_compatible", "openai_compatible_aggregator", "openai_compatible_local", "anthropic_messages", "gemini_native", "oauth_account_runtime"}:
        return "documented"
    if "tool" in lowered or "function" in lowered:
        return "documented"
    if provider_class in {"oauth_cli_bridge", "external_process"}:
        return "bridge-only"
    if "chat_completions" in api_modes or "messages" in api_modes:
        return "possible-but-unproven"
    return "unknown"


def _claim_for_responses(api_modes: tuple[str, ...], provider_class: str) -> str:
    if "responses" in api_modes:
        return "documented"
    if provider_class in {"openai_compatible", "openai_compatible_aggregator", "openai_compatible_local"}:
        return "possible-via-generic-openai-compatible-framework"
    if provider_class in {"oauth_cli_bridge", "external_process", "client_config_reference"}:
        return "not-applicable"
    return "unknown"


def _model_name_policy(provider_class: str) -> str:
    if provider_class in {"openai_compatible", "openai_compatible_aggregator", "openai_compatible_local"}:
        return "caller-supplied provider model identifier"
    if provider_class == "gemini_native":
        return "Gemini model path or alias supplied by caller"
    if provider_class == "anthropic_messages":
        return "Anthropic model identifier supplied by caller"
    if provider_class == "bedrock_converse":
        return "Bedrock model ID supplied by caller"
    if provider_class in {"oauth_cli_bridge", "external_process"}:
        return "provider-controlled or bridge-configured"
    return "provider-defined"


def _resolve_reference_paths(provider_id: str, source_docs: tuple[str, ...]) -> tuple[str, ...]:
    repo_root = _repo_root()
    resolved: list[str] = []
    seen: set[str] = set()

    def _append_path(candidate: Path) -> None:
        if not candidate.exists():
            return
        if candidate.is_dir():
            for child in sorted(path for path in candidate.rglob("*") if path.is_file()):
                relative = child.relative_to(repo_root).as_posix()
                if relative not in seen:
                    resolved.append(relative)
                    seen.add(relative)
            return
        relative = candidate.relative_to(repo_root).as_posix()
        if relative not in seen:
            resolved.append(relative)
            seen.add(relative)

    for source_doc in source_docs:
        doc_name = source_doc.strip()
        if not doc_name:
            continue
        for base in (_reference_root() / "Provider", _reference_root() / "Oauth", _reference_root() / "OpenAI" / "API"):
            direct = base / doc_name
            if direct.exists():
                _append_path(direct)
    for hint in _REFERENCE_HINTS.get(provider_id, ()):
        _append_path(repo_root / hint)
    return tuple(resolved)


def _parse_markdown_matrix(path: Path, *, source_kind: str, contract_column: str) -> list[ProviderCatalogSeedRow]:
    rows: list[ProviderCatalogSeedRow] = []
    lines = path.read_text(encoding="utf-8").splitlines()
    table_lines = [line.strip() for line in lines if line.strip().startswith("|")]
    if len(table_lines) < 3:
        return rows
    header = [cell.strip() for cell in table_lines[0].strip("|").split("|")]
    for raw_line in table_lines[2:]:
        values = [cell.strip() for cell in raw_line.strip("|").split("|")]
        if len(values) != len(header):
            continue
        row = dict(zip(header, values, strict=True))
        provider_id = row["Provider ID"].strip()
        display_name = row["Name"].strip()
        raw_class = row["Class"].strip()
        provider_class = _normalize_provider_class(provider_id, raw_class)
        source_docs = _split_cell(row["Source docs"])
        primary_contracts = _split_cell(row[contract_column])
        auth_modes = _extract_auth_modes(row.get("Auth", row.get("Integration truth", "")))
        token_env_vars = _extract_env_vars(row.get("Auth", row.get("Integration truth", "")))
        api_modes = _extract_api_modes(row[contract_column], source_docs, provider_class)
        primary_contract_text = row[contract_column]
        rows.append(
            ProviderCatalogSeedRow(
                provider_id=provider_id,
                display_name=display_name,
                raw_class=raw_class,
                provider_class=provider_class,
                source_kind=source_kind,
                source_docs=source_docs,
                local_reference_paths=_resolve_reference_paths(provider_id, source_docs),
                auth_modes_supported=auth_modes,
                api_modes_supported=api_modes,
                primary_contracts=primary_contracts,
                base_url_default=_parse_base_url(primary_contract_text),
                base_url_override_env=_BASE_URL_ENV_OVERRIDES.get(provider_id),
                token_env_vars=token_env_vars,
                model_name_policy=_model_name_policy(provider_class),
                streaming_support_claim=_claim_for_streaming(provider_class, api_modes, primary_contract_text),
                tools_support_claim=_claim_for_tools(provider_class, api_modes, primary_contract_text),
                responses_support_claim=_claim_for_responses(api_modes, provider_class),
            )
        )
    return rows


@lru_cache(maxsize=1)
def load_provider_catalog_seed() -> tuple[ProviderCatalogSeedRow, ...]:
    api_rows = _parse_markdown_matrix(
        _matrices_root() / "API_PROVIDER_MATRIX.md",
        source_kind="api_matrix",
        contract_column="Primary contract",
    )
    oauth_rows = _parse_markdown_matrix(
        _matrices_root() / "OAUTH_PROVIDER_MATRIX.md",
        source_kind="oauth_matrix",
        contract_column="Integration truth",
    )
    combined = {row.provider_id: row for row in (*api_rows, *oauth_rows)}
    return tuple(sorted(combined.values(), key=lambda item: item.provider_id))

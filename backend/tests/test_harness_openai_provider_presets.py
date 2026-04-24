from pathlib import Path

from app.harness.models import HarnessPreviewRequest, HarnessProviderProfile, HarnessRequestMapping
from app.harness.service import HarnessService
from app.harness.store import HarnessStore
from app.storage.harness_repository import FileHarnessRepository, HarnessStoragePaths


def build_service(tmp_path: Path) -> HarnessService:
    repo = FileHarnessRepository(
        paths=HarnessStoragePaths(
            profiles_path=tmp_path / "profiles.json",
            runs_path=tmp_path / "runs.json",
        )
    )
    return HarnessService(HarnessStore(repository=repo))


def test_openai_provider_presets_are_listed_with_defaults(tmp_path: Path) -> None:
    service = build_service(tmp_path)

    templates = {item["id"]: item for item in service.list_templates()}

    assert "openai_provider_openrouter" in templates
    assert "openai_provider_nous" in templates
    assert "openai_provider_groq" in templates
    assert "openai_provider_vllm" in templates
    assert "openai_provider_opencode_zen" in templates
    assert "openai_provider_opencode_go" in templates

    openrouter = templates["openai_provider_openrouter"]["profile_defaults"]
    assert openrouter["endpoint_base_url"] == "https://openrouter.ai/api/v1"
    assert openrouter["model_slug_policy"] == "infer_vendor_if_missing"
    assert openrouter["model_prefix"] == "openai"
    assert openrouter["request_mapping"]["headers"]["HTTP-Referer"] == "https://forgeframe.local"

    nous = templates["openai_provider_nous"]["profile_defaults"]
    assert nous["endpoint_base_url"] == "https://inference-api.nousresearch.com/v1"
    assert nous["model_slug_policy"] == "infer_vendor_if_missing"

    opencode_go = templates["openai_provider_opencode_go"]["profile_defaults"]
    assert opencode_go["endpoint_base_url"] == "https://opencode.ai/zen/go/v1"
    assert opencode_go["capabilities"]["unsupported_features"] == [
        "mixed `/messages` branch is not wired; this preset only targets the OpenAI-like path"
    ]


def test_openrouter_preset_applies_model_slug_and_special_headers(tmp_path: Path) -> None:
    service = build_service(tmp_path)
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="openrouter",
            label="OpenRouter",
            template_id="openai_provider_openrouter",
            integration_class="openai_compatible",
            endpoint_base_url="https://openrouter.ai/api/v1",
            auth_scheme="bearer",
            auth_value="token",
            models=["gpt-4o-mini"],
        )
    )

    preview = service.build_request_preview(
        HarnessPreviewRequest(provider_key="openrouter", model="gpt-4o-mini", message="hello"),
    )

    assert preview["url"] == "https://openrouter.ai/api/v1/chat/completions"
    assert preview["headers"]["Authorization"] == "Bearer token"
    assert preview["headers"]["HTTP-Referer"] == "https://forgeframe.local"
    assert preview["headers"]["X-OpenRouter-Title"] == "ForgeFrame"
    assert preview["json"]["model"] == "openai/gpt-4o-mini"


def test_aggregator_presets_infer_vendor_slug_for_common_models(tmp_path: Path) -> None:
    service = build_service(tmp_path)
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="nous",
            label="Nous Portal",
            template_id="openai_provider_nous",
            integration_class="openai_compatible",
            endpoint_base_url="https://inference-api.nousresearch.com/v1",
            auth_scheme="bearer",
            auth_value="token",
            models=["claude-sonnet-4.6", "grok-4.20-beta"],
        )
    )

    claude_preview = service.build_request_preview(
        HarnessPreviewRequest(provider_key="nous", model="claude-sonnet-4.6", message="hello"),
    )
    grok_preview = service.build_request_preview(
        HarnessPreviewRequest(provider_key="nous", model="grok-4.20-beta", message="hello"),
    )

    assert claude_preview["json"]["model"] == "anthropic/claude-sonnet-4.6"
    assert grok_preview["json"]["model"] == "x-ai/grok-4.20-beta"


def test_opencode_go_preset_keeps_openai_like_path_and_infers_glm_vendor(tmp_path: Path) -> None:
    service = build_service(tmp_path)
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="opencode_go",
            label="OpenCode Go",
            template_id="openai_provider_opencode_go",
            integration_class="openai_compatible",
            endpoint_base_url="https://opencode.ai/zen/go/v1",
            auth_scheme="bearer",
            auth_value="token",
            models=["glm-4.5"],
        )
    )

    preview = service.build_request_preview(
        HarnessPreviewRequest(provider_key="opencode_go", model="glm-4.5", message="hello"),
    )

    assert preview["url"] == "https://opencode.ai/zen/go/v1/chat/completions"
    assert preview["json"]["model"] == "z-ai/glm-4.5"


def test_join_policy_dedupes_duplicate_v1_segments(tmp_path: Path) -> None:
    service = build_service(tmp_path)
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="dedupe",
            label="Dedupe",
            template_id=None,
            integration_class="openai_compatible",
            endpoint_base_url="https://example.invalid/v1",
            auth_scheme="bearer",
            auth_value="token",
            models=["demo-model"],
            request_mapping=HarnessRequestMapping(
                path="/v1/chat/completions",
                path_join_policy="dedupe_openai_v1",
            ),
        )
    )

    preview = service.build_request_preview(
        HarnessPreviewRequest(provider_key="dedupe", model="demo-model", message="hello"),
    )

    assert preview["url"] == "https://example.invalid/v1/chat/completions"

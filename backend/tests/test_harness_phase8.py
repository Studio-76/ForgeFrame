from pathlib import Path

import pytest

from app.harness.models import HarnessPreviewRequest, HarnessProviderProfile, HarnessVerificationRequest
from app.harness.service import HarnessService
from app.harness.store import HarnessStore
from app.providers import ProviderRegistry
from app.providers.base import ChatDispatchRequest, ProviderUnsupportedFeatureError
from app.providers.generic_harness.adapter import GenericHarnessAdapter
from app.settings.config import Settings
from app.storage.harness_repository import FileHarnessRepository, HarnessStoragePaths


def build_service(tmp_path: Path) -> HarnessService:
    repo = FileHarnessRepository(paths=HarnessStoragePaths(profiles_path=tmp_path / "profiles.json", runs_path=tmp_path / "runs.json"))
    store = HarnessStore(repository=repo)
    return HarnessService(store)


def test_harness_templates_and_profile_verification_dry_run(tmp_path: Path) -> None:
    service = build_service(tmp_path)
    templates = service.list_templates()
    assert any(item["id"] == "openai_compatible" for item in templates)

    profile = HarnessProviderProfile(
        provider_key="generic_local",
        label="Generic Local",
        integration_class="openai_compatible",
        endpoint_base_url="https://example.invalid/v1",
        auth_scheme="bearer",
        auth_value="token",
        models=["local-model"],
    )
    service.upsert_profile(profile)

    result = service.verify_profile(HarnessVerificationRequest(provider_key="generic_local"))
    assert result.success is True
    steps = {step["step"]: step["status"] for step in result.steps}
    assert steps["test_connection"] == "ok"
    assert steps["response_mapping"] == "ok"


def test_harness_profiles_are_persistent(tmp_path: Path) -> None:
    service = build_service(tmp_path)
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="persisted",
            label="Persisted",
            integration_class="templated_http",
            endpoint_base_url="https://example.invalid/api",
            auth_scheme="none",
            models=["model-a", "model-b"],
        )
    )
    new_service = build_service(tmp_path)
    profile = new_service.get_profile("persisted")
    assert profile.models == ["model-a", "model-b"]
    assert profile.lifecycle_status in {"draft", "ready"}


def test_harness_preview_renders_template_tokens(tmp_path: Path) -> None:
    service = build_service(tmp_path)
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="generic_local",
            label="Generic Local",
            integration_class="templated_http",
            endpoint_base_url="https://example.invalid/api",
            auth_scheme="none",
            models=["model-a"],
        )
    )

    preview = service.build_request_preview(HarnessPreviewRequest(provider_key="generic_local", model="model-a", message="hi", stream=False))
    assert preview["json"]["model"] == "model-a"
    assert preview["json"]["messages"][0]["content"] == "hi"


def test_harness_preview_preserves_explicit_message_sequence(tmp_path: Path) -> None:
    service = build_service(tmp_path)
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="generic_local",
            label="Generic Local",
            integration_class="templated_http",
            endpoint_base_url="https://example.invalid/api",
            auth_scheme="none",
            models=["model-a"],
        )
    )

    messages = [
        {"role": "system", "content": "Stay terse."},
        {"role": "user", "content": "What changed?"},
        {"role": "assistant", "content": "The generic harness path changed."},
        {"role": "user", "content": "Summarize it."},
    ]

    preview = service.build_request_preview(
        HarnessPreviewRequest(
            provider_key="generic_local",
            model="model-a",
            message="ignored fallback",
            messages=messages,
            stream=False,
        )
    )

    assert preview["json"]["messages"] == messages


def test_harness_preview_includes_responses_control_fields(tmp_path: Path) -> None:
    service = build_service(tmp_path)
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="generic_local",
            label="Generic Local",
            integration_class="templated_http",
            endpoint_base_url="https://example.invalid/api",
            auth_scheme="none",
            models=["model-a"],
        )
    )

    preview = service.build_request_preview(
        HarnessPreviewRequest(
            provider_key="generic_local",
            model="model-a",
            message="hi",
            stream=False,
            temperature=0.4,
            max_output_tokens=21,
            metadata={"ticket": "FOR-409"},
        )
    )

    assert preview["json"]["temperature"] == 0.4
    assert preview["json"]["max_tokens"] == 21
    assert preview["json"]["metadata"] == {"ticket": "FOR-409"}


def test_generic_harness_adapter_stream_mapping(tmp_path: Path) -> None:
    service = build_service(tmp_path)
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="streaming",
            label="Streaming",
            integration_class="openai_compatible",
            endpoint_base_url="https://example.invalid/v1",
            auth_scheme="none",
            models=["stream-model"],
            stream_mapping={"enabled": True},
            capabilities={"streaming": True, "model_source": "manual"},
        )
    )

    settings = Settings()
    adapter = GenericHarnessAdapter(settings, service)

    def fake_execute_stream(provider_key: str, *, model: str, messages: list[dict]):
        yield {"event": "delta", "delta": "hello"}
        yield {"event": "done", "finish_reason": "stop", "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}, "content": "hello"}

    service.execute_stream = fake_execute_stream  # type: ignore[method-assign]
    events = list(adapter.stream_chat_completion(request=type("Req", (), {"model": "stream-model", "messages": [{"role": "user", "content": "x"}], "stream": True})()))

    assert events[0].event == "delta"
    assert events[-1].event == "done"


def test_generic_harness_adapter_status_capabilities_require_declared_streaming_support(tmp_path: Path) -> None:
    service = build_service(tmp_path)
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="declared-non-stream",
            label="Declared Non Stream",
            integration_class="openai_compatible",
            endpoint_base_url="https://example.invalid/v1",
            auth_scheme="none",
            models=["batch-model"],
            stream_mapping={"enabled": True},
            capabilities={"streaming": False, "tool_calling": False, "model_source": "manual"},
        )
    )

    adapter = GenericHarnessAdapter(Settings(), service)
    capabilities = adapter.status_capabilities()

    assert capabilities["active_profile_count"] == 1
    assert capabilities["auth_mechanism"] == "none"
    assert capabilities["auth_mechanisms"] == ["none"]
    assert capabilities["streaming"] is False
    assert capabilities["streaming_level"] == "none"
    assert capabilities["tool_calling"] is False
    assert capabilities["tool_calling_level"] == "none"
    assert adapter.can_dispatch_model("batch-model", require_streaming=True) == (
        False,
        "streaming_not_enabled_in_profile",
    )


def test_generic_harness_adapter_status_capabilities_keep_partial_truth_for_mixed_profiles(tmp_path: Path) -> None:
    service = build_service(tmp_path)
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="stream-tool",
            label="Stream Tool",
            integration_class="openai_compatible",
            endpoint_base_url="https://example.invalid/v1",
            auth_scheme="none",
            models=["stream-tool-model"],
            stream_mapping={"enabled": True},
            capabilities={"streaming": True, "tool_calling": True, "model_source": "manual"},
        )
    )
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="batch-only",
            label="Batch Only",
            integration_class="openai_compatible",
            endpoint_base_url="https://example.invalid/v1",
            auth_scheme="bearer",
            auth_value="batch-secret",
            models=["batch-only-model"],
            stream_mapping={"enabled": False},
            capabilities={"streaming": False, "tool_calling": False, "model_source": "manual"},
        )
    )

    adapter = GenericHarnessAdapter(Settings(), service)
    capabilities = adapter.status_capabilities()

    assert capabilities["active_profile_count"] == 2
    assert capabilities["auth_mechanism"] == "mixed"
    assert capabilities["auth_mechanisms"] == ["bearer", "none"]
    assert capabilities["streaming"] is True
    assert capabilities["streaming_level"] == "partial"
    assert capabilities["streaming_profile_count"] == 1
    assert capabilities["tool_calling"] is True
    assert capabilities["tool_calling_level"] == "partial"
    assert capabilities["tool_calling_profile_count"] == 1
    assert adapter.can_dispatch_model("stream-tool-model", require_streaming=True) == (True, None)
    assert adapter.can_dispatch_model("batch-only-model", require_streaming=True) == (
        False,
        "streaming_not_enabled_in_profile",
    )


def test_generic_harness_adapter_status_capabilities_aggregate_vision_truth_from_runtime_profiles(tmp_path: Path) -> None:
    service = build_service(tmp_path)
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="vision-enabled",
            label="Vision Enabled",
            integration_class="openai_compatible",
            endpoint_base_url="https://example.invalid/v1",
            auth_scheme="none",
            models=["vision-model"],
            capabilities={"streaming": False, "tool_calling": False, "vision": True, "model_source": "manual"},
        )
    )
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="vision-disabled",
            label="Vision Disabled",
            integration_class="openai_compatible",
            endpoint_base_url="https://example.invalid/v1",
            auth_scheme="none",
            models=["batch-model"],
            capabilities={"streaming": False, "tool_calling": False, "vision": False, "model_source": "manual"},
        )
    )

    settings = Settings()
    adapter = GenericHarnessAdapter(settings, service)
    provider_status = ProviderRegistry(settings, harness_service=service).get_provider_status("generic_harness")
    capabilities = adapter.status_capabilities()

    assert capabilities["active_profile_count"] == 2
    assert capabilities["vision"] is True
    assert capabilities["vision_level"] == "partial"
    assert capabilities["vision_profile_count"] == 1
    assert provider_status["capabilities"]["vision"] is True
    assert provider_status["capabilities"]["vision_level"] == "partial"


def test_generic_harness_adapter_status_capabilities_require_enabled_declared_discovery_support(tmp_path: Path) -> None:
    service = build_service(tmp_path)
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="discovery-disabled",
            label="Discovery Disabled",
            integration_class="openai_compatible",
            endpoint_base_url="https://example.invalid/v1",
            auth_scheme="none",
            models=["catalog-model"],
            discovery_enabled=False,
            capabilities={"streaming": False, "tool_calling": False, "discovery_support": True, "model_source": "manual"},
        )
    )

    adapter = GenericHarnessAdapter(Settings(), service)
    capabilities = adapter.status_capabilities()

    assert capabilities["discovery_support"] is False

    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="discovery-disabled",
            label="Discovery Enabled",
            integration_class="openai_compatible",
            endpoint_base_url="https://example.invalid/v1",
            auth_scheme="none",
            models=["catalog-model"],
            discovery_enabled=True,
            capabilities={"streaming": False, "tool_calling": False, "discovery_support": True, "model_source": "manual"},
        )
    )

    capabilities = adapter.status_capabilities()

    assert capabilities["discovery_support"] is True

    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="discovery-disabled",
            label="Discovery Unsupported",
            integration_class="openai_compatible",
            endpoint_base_url="https://example.invalid/v1",
            auth_scheme="none",
            models=["catalog-model"],
            discovery_enabled=True,
            capabilities={"streaming": False, "tool_calling": False, "discovery_support": False, "model_source": "manual"},
        )
    )

    capabilities = adapter.status_capabilities()

    assert capabilities["discovery_support"] is False


def test_generic_harness_adapter_requires_owned_models_without_fallback(tmp_path: Path) -> None:
    service = build_service(tmp_path)
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="empty-profile",
            label="Empty Profile",
            integration_class="openai_compatible",
            endpoint_base_url="https://example.invalid/v1",
            auth_scheme="none",
            models=[],
            capabilities={"streaming": True, "tool_calling": True, "model_source": "manual"},
        )
    )

    settings = Settings()
    adapter = GenericHarnessAdapter(settings, service)
    provider_status = ProviderRegistry(settings, harness_service=service).get_provider_status("generic_harness")
    capabilities = adapter.status_capabilities()

    assert adapter.is_ready() is False
    assert adapter.readiness_reason() == "Harness profiles exist, but no enabled profile owns any models."
    assert provider_status["ready"] is False
    assert provider_status["readiness_reason"] == "Harness profiles exist, but no enabled profile owns any models."
    assert capabilities["auth_mechanism"] == "none"
    assert capabilities["auth_mechanisms"] == ["none"]
    assert capabilities["active_profile_count"] == 1
    assert capabilities["streaming_profile_count"] == 0
    assert capabilities["tool_calling_profile_count"] == 0
    assert adapter.can_dispatch_model("ad-hoc-model") == (
        False,
        "Harness profiles exist, but no enabled profile owns any models.",
    )


def test_generic_harness_adapter_keeps_blind_dispatch_when_model_fallback_is_enabled(tmp_path: Path) -> None:
    service = build_service(tmp_path)
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="fallback-profile",
            label="Fallback Profile",
            integration_class="openai_compatible",
            endpoint_base_url="https://example.invalid/v1",
            auth_scheme="none",
            models=[],
            capabilities={"streaming": True, "tool_calling": False, "model_source": "manual"},
        )
    )

    settings = Settings(generic_harness_allow_model_fallback=True)
    adapter = GenericHarnessAdapter(settings, service)
    provider_status = ProviderRegistry(settings, harness_service=service).get_provider_status("generic_harness")
    capabilities = adapter.status_capabilities()

    assert adapter.is_ready() is True
    assert adapter.readiness_reason() is None
    assert provider_status["ready"] is True
    assert provider_status["readiness_reason"] is None
    assert capabilities["active_profile_count"] == 1
    assert adapter.can_dispatch_model("ad-hoc-model") == (True, None)


def test_generic_harness_adapter_non_stream_legacy_signature_compatibility(tmp_path: Path) -> None:
    service = build_service(tmp_path)
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="legacy",
            label="Legacy",
            integration_class="openai_compatible",
            endpoint_base_url="https://example.invalid/v1",
            auth_scheme="none",
            models=["legacy-model"],
            capabilities={"tool_calling": True, "model_source": "manual"},
        )
    )

    settings = Settings()
    adapter = GenericHarnessAdapter(settings, service)

    def fake_execute_non_stream(provider_key: str, *, model: str, messages: list[dict]):
        assert provider_key == "legacy"
        assert model == "legacy-model"
        assert messages[-1]["content"] == "x"
        return {
            "model": model,
            "content": "legacy-ok",
            "finish_reason": "stop",
            "prompt_tokens": 1,
            "completion_tokens": 1,
            "total_tokens": 2,
        }

    service.execute_non_stream = fake_execute_non_stream  # type: ignore[method-assign]
    result = adapter.create_chat_completion(
        ChatDispatchRequest(
            model="legacy-model",
            messages=[{"role": "user", "content": "x"}],
            tools=[{"type": "function", "function": {"name": "lookup"}}],
            tool_choice="auto",
            request_metadata={"request_id": "req_legacy_harness_1"},
        )
    )

    assert result.content == "legacy-ok"
    assert result.usage.total_tokens == 2


def test_generic_harness_adapter_rejects_image_messages_when_profile_lacks_vision(tmp_path: Path) -> None:
    service = build_service(tmp_path)
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="no-vision",
            label="No Vision",
            integration_class="openai_compatible",
            endpoint_base_url="https://example.invalid/v1",
            auth_scheme="none",
            models=["legacy-model"],
            capabilities={"vision": False, "model_source": "manual"},
        )
    )

    adapter = GenericHarnessAdapter(Settings(), service)

    assert adapter.can_dispatch_model("legacy-model", require_vision=True) == (False, "vision_not_enabled_in_profile")
    with pytest.raises(ProviderUnsupportedFeatureError, match="vision"):
        adapter.create_chat_completion(
            ChatDispatchRequest(
                model="legacy-model",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Describe this image."},
                            {"type": "image_url", "image_url": {"url": "https://example.invalid/runtime-proof.png"}},
                        ],
                    }
                ],
            )
        )


def test_generic_harness_adapter_non_stream_internal_type_error_is_not_retried(tmp_path: Path) -> None:
    service = build_service(tmp_path)
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="typeerror",
            label="TypeError",
            integration_class="openai_compatible",
            endpoint_base_url="https://example.invalid/v1",
            auth_scheme="none",
            models=["typeerror-model"],
            capabilities={"tool_calling": True, "model_source": "manual"},
        )
    )

    settings = Settings()
    adapter = GenericHarnessAdapter(settings, service)
    call_count = 0

    def fake_execute_non_stream(
        provider_key: str,
        *,
        model: str,
        messages: list[dict],
        tools: list[dict] | None = None,
        tool_choice=None,
        request_metadata: dict[str, str] | None = None,
    ):
        nonlocal call_count
        call_count += 1
        del provider_key, model, messages, tools, tool_choice, request_metadata
        raise TypeError("internal non-stream type error")

    service.execute_non_stream = fake_execute_non_stream  # type: ignore[method-assign]

    with pytest.raises(TypeError, match="internal non-stream type error"):
        adapter.create_chat_completion(
            ChatDispatchRequest(
                model="typeerror-model",
                messages=[{"role": "user", "content": "x"}],
                tools=[{"type": "function", "function": {"name": "lookup"}}],
                tool_choice="auto",
                request_metadata={"request_id": "req_typeerror_non_stream_1"},
            )
        )

    assert call_count == 1


def test_generic_harness_adapter_stream_internal_type_error_is_not_retried(tmp_path: Path) -> None:
    service = build_service(tmp_path)
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="stream-typeerror",
            label="Stream TypeError",
            integration_class="openai_compatible",
            endpoint_base_url="https://example.invalid/v1",
            auth_scheme="none",
            models=["stream-typeerror-model"],
            stream_mapping={"enabled": True},
            capabilities={"streaming": True, "tool_calling": True, "model_source": "manual"},
        )
    )

    settings = Settings()
    adapter = GenericHarnessAdapter(settings, service)
    call_count = 0

    def fake_execute_stream(
        provider_key: str,
        *,
        model: str,
        messages: list[dict],
        tools: list[dict] | None = None,
        tool_choice=None,
        request_metadata: dict[str, str] | None = None,
    ):
        nonlocal call_count
        call_count += 1
        del provider_key, model, messages, tools, tool_choice, request_metadata
        raise TypeError("internal stream type error")

    service.execute_stream = fake_execute_stream  # type: ignore[method-assign]

    with pytest.raises(TypeError, match="internal stream type error"):
        list(
            adapter.stream_chat_completion(
                ChatDispatchRequest(
                    model="stream-typeerror-model",
                    messages=[{"role": "user", "content": "x"}],
                    stream=True,
                    tools=[{"type": "function", "function": {"name": "lookup"}}],
                    tool_choice="auto",
                    request_metadata={"request_id": "req_typeerror_stream_1"},
                )
            )
        )

    assert call_count == 1



def test_harness_store_recovers_from_corrupt_file(tmp_path: Path) -> None:
    profiles_path = tmp_path / "profiles.json"
    runs_path = tmp_path / "runs.json"
    profiles_path.write_text("{broken", encoding="utf-8")
    runs_path.write_text("[]", encoding="utf-8")
    repo = FileHarnessRepository(paths=HarnessStoragePaths(profiles_path=profiles_path, runs_path=runs_path))
    store = HarnessStore(repository=repo)
    assert store.list_profiles() == []
    assert profiles_path.with_suffix(".json.corrupt").exists()


def test_verify_with_live_probe_records_step(tmp_path: Path) -> None:
    service = build_service(tmp_path)
    service.upsert_profile(
        HarnessProviderProfile(
            provider_key="probeable",
            label="Probeable",
            integration_class="templated_http",
            endpoint_base_url="https://example.invalid/api",
            auth_scheme="none",
            models=["m1"],
        )
    )

    def fake_probe(payload):
        return {"status_code": 200}

    service.probe = fake_probe  # type: ignore[method-assign]
    result = service.verify_profile(HarnessVerificationRequest(provider_key="probeable", live_probe=True))
    assert any(step["step"] == "live_probe" for step in result.steps)

from pathlib import Path

from app.harness.models import HarnessPreviewRequest, HarnessProviderProfile, HarnessVerificationRequest
from app.harness.service import HarnessService
from app.harness.store import HarnessStore
from app.providers.generic_harness.adapter import GenericHarnessAdapter
from app.settings.config import Settings
from app.storage.harness_repository import HarnessStoragePaths


def build_service(tmp_path: Path) -> HarnessService:
    store = HarnessStore(paths=HarnessStoragePaths(profiles_path=tmp_path / "profiles.json", runs_path=tmp_path / "runs.json"))
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

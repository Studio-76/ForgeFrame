from app.harness.models import HarnessProviderProfile, HarnessVerificationRequest
from app.harness.service import HarnessService


def test_harness_templates_and_profile_verification_dry_run() -> None:
    service = HarnessService()
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
    assert steps["test_chat"] == "dry_run"


def test_harness_preview_renders_template_tokens() -> None:
    service = HarnessService()
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

    preview = service.build_request_preview("generic_local", model="model-a", message="hi", stream=False)
    assert preview["json"]["model"] == "model-a"
    assert preview["json"]["messages"][0]["content"] == "hi"

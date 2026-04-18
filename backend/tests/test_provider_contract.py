from app.providers.base import ProviderCapabilities, ProviderNotImplementedError
from app.providers.forgegate_baseline import ForgeGateBaselineAdapter


def test_baseline_provider_capabilities_are_declared() -> None:
    adapter = ForgeGateBaselineAdapter()
    assert isinstance(adapter.capabilities, ProviderCapabilities)
    assert adapter.capabilities.streaming is False


def test_not_implemented_error_has_structured_metadata() -> None:
    error = ProviderNotImplementedError("openai_api")
    assert error.provider == "openai_api"
    assert error.error_type == "provider_not_implemented"

from app.providers.base import (
    ProviderCapabilities,
    ProviderConfigurationError,
    ProviderNotImplementedError,
)
from app.providers.forgegate_baseline import ForgeGateBaselineAdapter
from app.providers.openai_api.adapter import OpenAIAPIAdapter
from app.settings.config import Settings


def test_baseline_provider_capabilities_are_declared() -> None:
    adapter = ForgeGateBaselineAdapter()
    assert isinstance(adapter.capabilities, ProviderCapabilities)
    assert adapter.capabilities.streaming is False
    assert adapter.capabilities.external is False


def test_openai_provider_capabilities_and_readiness() -> None:
    adapter = OpenAIAPIAdapter(Settings(openai_api_key="abc"))
    assert adapter.capabilities.external is True
    assert adapter.is_ready() is True


def test_not_implemented_error_has_structured_metadata() -> None:
    error = ProviderNotImplementedError("openai_api")
    assert error.provider == "openai_api"
    assert error.error_type == "provider_not_implemented"


def test_provider_configuration_error_type() -> None:
    error = ProviderConfigurationError("openai_api", "missing key")
    assert error.error_type == "provider_configuration_error"

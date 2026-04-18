from app.core.model_registry import ModelRegistry
from app.settings.config import Settings


def test_model_registry_default_model_is_available() -> None:
    settings = Settings()
    registry = ModelRegistry(settings)

    default_model = registry.default_model()
    assert default_model.id == settings.default_model
    assert registry.has_model(default_model.id)


def test_model_registry_lists_active_models() -> None:
    settings = Settings()
    registry = ModelRegistry(settings)

    models = registry.list_active_models()
    assert len(models) >= 1
    assert all(model.active for model in models)


def test_model_registry_prefers_default_provider_when_default_model_missing() -> None:
    settings = Settings(default_model="missing-model", default_provider="openai_api")
    registry = ModelRegistry(settings)
    assert registry.default_model().provider == "openai_api"

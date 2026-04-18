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

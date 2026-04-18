"""In-memory model registry baseline for ForgeGate phase 3."""

from app.core.model_registry.models import RuntimeModel
from app.settings.config import Settings


class ModelRegistry:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._models = self._build_registry()

    def _build_registry(self) -> dict[str, RuntimeModel]:
        models: dict[str, RuntimeModel] = {}
        for model_id, provider, owned_by in self._settings.model_catalog:
            if not self._settings.is_provider_enabled(provider):
                continue
            models[model_id] = RuntimeModel(
                id=model_id,
                provider=provider,
                owned_by=owned_by,
                display_name=model_id,
            )
        return models

    def list_active_models(self) -> list[RuntimeModel]:
        return [m for m in self._models.values() if m.active]

    def has_model(self, model_id: str) -> bool:
        model = self._models.get(model_id)
        return bool(model and model.active)

    def get_model(self, model_id: str) -> RuntimeModel | None:
        model = self._models.get(model_id)
        if model and model.active:
            return model
        return None

    def default_model(self) -> RuntimeModel:
        model = self.get_model(self._settings.default_model)
        if model:
            return model

        active = self.list_active_models()
        if not active:
            raise RuntimeError("No active models configured in ForgeGate registry.")
        return active[0]

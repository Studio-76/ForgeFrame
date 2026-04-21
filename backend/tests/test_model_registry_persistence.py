import json
from pathlib import Path

from app.core.model_registry import ModelRegistry
from app.settings.config import Settings


def test_model_registry_bootstraps_control_plane_state_when_missing(monkeypatch, tmp_path: Path) -> None:
    state_path = tmp_path / "control_plane_state.json"
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STATE_PATH", str(state_path))

    settings = Settings()
    registry = ModelRegistry(settings)

    assert registry.has_model(settings.default_model)
    assert state_path.exists()

    payload = json.loads(state_path.read_text(encoding="utf-8"))
    providers = payload["providers"]
    baseline_provider = next(item for item in providers if item["provider"] == "forgegate_baseline")
    assert any(model["id"] == settings.default_model for model in baseline_provider["managed_models"])


def test_model_registry_prefers_persisted_provider_state_over_bootstrap_catalog(monkeypatch, tmp_path: Path) -> None:
    state_path = tmp_path / "control_plane_state.json"
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STATE_PATH", str(state_path))

    state_path.write_text(
        json.dumps(
            {
                "schema_version": 2,
                "providers": [
                    {
                        "provider": "forgegate_baseline",
                        "label": "ForgeGate",
                        "enabled": True,
                        "integration_class": "native",
                        "managed_models": [
                            {
                                "id": "persisted-baseline-model",
                                "source": "static",
                                "discovery_status": "catalog",
                                "active": True,
                                "owned_by": "ForgeGate",
                                "display_name": "persisted-baseline-model",
                                "category": "general",
                            }
                        ],
                    }
                ],
                "health_config": {
                    "provider_health_enabled": True,
                    "model_health_enabled": True,
                    "interval_seconds": 300,
                    "probe_mode": "discovery",
                    "selected_models": [],
                },
                "health_records": [],
                "last_bootstrap_readiness": None,
                "updated_at": "",
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    settings = Settings()
    registry = ModelRegistry(settings)

    assert registry.has_model("persisted-baseline-model")
    assert not registry.has_model("forgegate-baseline-chat-v1")


def test_model_registry_respects_persisted_provider_disable(monkeypatch, tmp_path: Path) -> None:
    state_path = tmp_path / "control_plane_state.json"
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STATE_PATH", str(state_path))

    state_path.write_text(
        json.dumps(
            {
                "schema_version": 2,
                "providers": [
                    {
                        "provider": "openai_api",
                        "label": "OpenAI",
                        "enabled": False,
                        "integration_class": "native",
                        "managed_models": [
                            {
                                "id": "gpt-4.1-mini",
                                "source": "static",
                                "discovery_status": "catalog",
                                "active": True,
                                "owned_by": "OpenAI",
                                "display_name": "gpt-4.1-mini",
                                "category": "general",
                            }
                        ],
                    }
                ],
                "health_config": {
                    "provider_health_enabled": True,
                    "model_health_enabled": True,
                    "interval_seconds": 300,
                    "probe_mode": "discovery",
                    "selected_models": [],
                },
                "health_records": [],
                "last_bootstrap_readiness": None,
                "updated_at": "",
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    settings = Settings()
    registry = ModelRegistry(settings)

    assert not registry.has_model("gpt-4.1-mini")

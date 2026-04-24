import json
from pathlib import Path

from app.core.model_registry import ModelRegistry
from app.settings.config import Settings
from app.tenancy import DEFAULT_BOOTSTRAP_TENANT_ID


def test_model_registry_bootstraps_control_plane_state_when_missing(monkeypatch, tmp_path: Path) -> None:
    state_path = tmp_path / "control_plane_state.json"
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STATE_PATH", str(state_path))

    settings = Settings()
    registry = ModelRegistry(settings)

    assert registry.has_model(settings.default_model)
    assert state_path.exists()

    payload = json.loads(state_path.read_text(encoding="utf-8"))
    instance_state = payload["states"][DEFAULT_BOOTSTRAP_TENANT_ID]
    providers = instance_state["providers"]
    baseline_provider = next(item for item in providers if item["provider"] == "forgeframe_baseline")
    assert any(model["id"] == settings.default_model for model in baseline_provider["managed_models"])
    assert any(target["target_key"] == "forgeframe_baseline::forgeframe-baseline-chat-v1" for target in instance_state["provider_targets"])


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
                        "provider": "forgeframe_baseline",
                        "label": "ForgeFrame",
                        "enabled": True,
                        "integration_class": "native",
                        "managed_models": [
                            {
                                "id": "persisted-baseline-model",
                                "source": "static",
                                "discovery_status": "catalog",
                                "active": True,
                                "owned_by": "ForgeFrame",
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
    assert not registry.has_model("forgeframe-baseline-chat-v1")


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


def test_model_registry_keeps_provider_specific_models_distinct_when_ids_overlap(monkeypatch, tmp_path: Path) -> None:
    state_path = tmp_path / "control_plane_state.json"
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEGATE_CONTROL_PLANE_STATE_PATH", str(state_path))

    state_path.write_text(
        json.dumps(
            {
                "schema_version": 3,
                "instance_id": DEFAULT_BOOTSTRAP_TENANT_ID,
                "providers": [
                    {
                        "provider": "openai_api",
                        "label": "OpenAI",
                        "enabled": True,
                        "integration_class": "native",
                        "managed_models": [
                            {
                                "id": "shared-model",
                                "source": "static",
                                "discovery_status": "catalog",
                                "active": True,
                                "owned_by": "OpenAI",
                                "display_name": "shared-model",
                                "category": "general",
                                "routing_key": "openai_api/shared-model",
                                "capabilities": {"streaming": True},
                            }
                        ],
                    },
                    {
                        "provider": "generic_harness",
                        "label": "Generic Harness",
                        "enabled": True,
                        "integration_class": "native",
                        "managed_models": [
                            {
                                "id": "shared-model",
                                "source": "manual",
                                "discovery_status": "synced",
                                "active": True,
                                "owned_by": "Generic Harness",
                                "display_name": "shared-model",
                                "category": "general",
                                "routing_key": "generic_harness/shared-model",
                                "capabilities": {"streaming": False},
                            }
                        ],
                    },
                ],
                "provider_targets": [
                    {
                        "target_key": "openai_api::shared-model",
                        "provider": "openai_api",
                        "model_id": "shared-model",
                        "model_routing_key": "openai_api/shared-model",
                        "label": "OpenAI · shared-model",
                        "instance_id": DEFAULT_BOOTSTRAP_TENANT_ID,
                    },
                    {
                        "target_key": "generic_harness::shared-model",
                        "provider": "generic_harness",
                        "model_id": "shared-model",
                        "model_routing_key": "generic_harness/shared-model",
                        "label": "Generic Harness · shared-model",
                        "instance_id": DEFAULT_BOOTSTRAP_TENANT_ID,
                    },
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

    assert registry.get_model_by_routing_key("openai_api/shared-model") is not None
    assert registry.get_model_by_routing_key("generic_harness/shared-model") is not None
    openai_target = next(target for target in registry.list_targets() if target.target_key == "openai_api::shared-model")
    harness_target = next(target for target in registry.list_targets() if target.target_key == "generic_harness::shared-model")
    assert openai_target.model.provider == "openai_api"
    assert harness_target.model.provider == "generic_harness"

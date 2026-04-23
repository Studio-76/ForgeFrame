import json
from pathlib import Path

from app.storage.control_plane_repository import ControlPlaneStatePaths, FileControlPlaneStateRepository


def test_file_control_plane_repository_upgrades_legacy_model_payload(tmp_path: Path) -> None:
    state_path = tmp_path / "control_plane_state.json"
    state_path.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "providers": [
                    {
                        "provider": "forgeframe_baseline",
                        "label": "ForgeFrame",
                        "enabled": True,
                        "integration_class": "native",
                        "managed_models": [
                            {
                                "id": "forgeframe-baseline-chat-v1",
                                "source": "static",
                                "discovery_status": "catalog",
                                "active": True,
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

    repository = FileControlPlaneStateRepository(paths=ControlPlaneStatePaths(state_path=state_path))
    state = repository.load_state()

    assert state is not None
    assert state.schema_version == 3
    model = state.providers[0].managed_models[0]
    assert model.owned_by == "ForgeFrame"
    assert model.display_name == "forgeframe-baseline-chat-v1"
    assert model.category == "general"
    assert model.routing_key == "forgeframe_baseline/forgeframe-baseline-chat-v1"
    assert state.provider_targets[0].target_key == "forgeframe_baseline::forgeframe-baseline-chat-v1"



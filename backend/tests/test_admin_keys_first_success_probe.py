from conftest import admin_headers as shared_admin_headers
from fastapi.testclient import TestClient

from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.governance.service import get_governance_service
from app.instances.service import clear_instance_service_cache
from app.main import app


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


def _scoped_path(path: str, instance_id: str | None = None) -> str:
    if not instance_id:
        return path
    separator = "&" if "?" in path else "?"
    return f"{path}{separator}instanceId={instance_id}"


def _create_instance(client: TestClient, *, instance_id: str, display_name: str) -> None:
    response = client.post(
        "/admin/instances/",
        headers=_admin_headers(client),
        json={
            "instance_id": instance_id,
            "display_name": display_name,
            "tenant_id": instance_id,
            "company_id": instance_id,
            "deployment_mode": "linux_host_native",
            "exposure_mode": "same_origin",
            "metadata": {},
        },
    )
    assert response.status_code == 201, response.text


def _issue_runtime_key(client: TestClient, *, instance_id: str | None = None) -> str:
    headers = _admin_headers(client)
    account_response = client.post(
        _scoped_path("/admin/accounts/", instance_id),
        headers=headers,
        json={"label": "Probe Account"},
    )
    assert account_response.status_code == 201
    account_id = account_response.json()["account"]["account_id"]

    key_response = client.post(
        _scoped_path("/admin/keys/", instance_id),
        headers=headers,
        json={
            "label": "Probe Runtime Key",
            "account_id": account_id,
            "scopes": ["models:read", "chat:write", "responses:write"],
        },
    )
    assert key_response.status_code == 201
    return key_response.json()["issued"]["token"]


def test_admin_first_success_probe_rejects_invalid_runtime_key(monkeypatch) -> None:
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()
    clear_instance_service_cache()
    client = TestClient(app)

    response = client.post(
        "/admin/keys/first-success/probe",
        headers=_admin_headers(client),
        json={"runtime_key": "invalid"},
    )

    assert response.status_code == 400
    payload = response.json()
    assert payload["error"]["type"] == "runtime_key_invalid"


def test_admin_first_success_probe_runs_models_probe_with_valid_runtime_key(
    monkeypatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()
    clear_instance_service_cache()
    client = TestClient(app)
    runtime_key = _issue_runtime_key(client)

    response = client.post(
        "/admin/keys/first-success/probe",
        headers=_admin_headers(client),
        json={"runtime_key": runtime_key, "chat_probe": True},
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["probe"]["models_probe"]["attempted"] is True
    assert payload["probe"]["models_probe"]["ok"] is True
    assert payload["probe"]["models_probe"]["status_code"] == 200
    assert payload["probe"]["success"] is True


def test_admin_first_success_probe_persists_last_result_per_instance_and_survives_reload(
    monkeypatch,
) -> None:
    monkeypatch.setenv("FORGEGATE_RUNTIME_AUTH_REQUIRED", "true")
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()
    clear_instance_service_cache()
    client = TestClient(app)

    _create_instance(client, instance_id="instance_alpha", display_name="Instance Alpha")
    _create_instance(client, instance_id="instance_beta", display_name="Instance Beta")
    alpha_runtime_key = _issue_runtime_key(client, instance_id="instance_alpha")
    beta_runtime_key = _issue_runtime_key(client, instance_id="instance_beta")

    alpha_response = client.post(
        _scoped_path("/admin/keys/first-success/probe", "instance_alpha"),
        headers=_admin_headers(client),
        json={"runtime_key": alpha_runtime_key, "chat_probe": True},
    )
    beta_response = client.post(
        _scoped_path("/admin/keys/first-success/probe", "instance_beta"),
        headers=_admin_headers(client),
        json={"runtime_key": beta_runtime_key, "chat_probe": True},
    )

    assert alpha_response.status_code == 200, alpha_response.text
    assert beta_response.status_code == 200, beta_response.text
    alpha_probe = alpha_response.json()["probe"]
    beta_probe = beta_response.json()["probe"]

    instances_response = client.get("/admin/instances/", headers=_admin_headers(client))
    assert instances_response.status_code == 200, instances_response.text
    instances_by_id = {item["instance_id"]: item for item in instances_response.json()["instances"]}
    assert instances_by_id["instance_alpha"]["metadata"]["onboarding_last_first_success_probe"] == alpha_probe
    assert instances_by_id["instance_beta"]["metadata"]["onboarding_last_first_success_probe"] == beta_probe

    get_governance_service.cache_clear()
    clear_instance_service_cache()
    reloaded_client = TestClient(app)
    reloaded_instances_response = reloaded_client.get("/admin/instances/", headers=_admin_headers(reloaded_client))
    assert reloaded_instances_response.status_code == 200, reloaded_instances_response.text
    reloaded_by_id = {item["instance_id"]: item for item in reloaded_instances_response.json()["instances"]}
    assert reloaded_by_id["instance_alpha"]["metadata"]["onboarding_last_first_success_probe"] == alpha_probe
    assert reloaded_by_id["instance_beta"]["metadata"]["onboarding_last_first_success_probe"] == beta_probe

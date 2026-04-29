from fastapi.testclient import TestClient

from conftest import admin_headers as shared_admin_headers
from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.governance.service import get_governance_service
from app.main import app


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


def _issue_runtime_key(client: TestClient) -> str:
    headers = _admin_headers(client)
    account_response = client.post("/admin/accounts/", headers=headers, json={"label": "Redaction Account"})
    assert account_response.status_code == 201, account_response.text
    account_id = account_response.json()["account"]["account_id"]

    key_response = client.post(
        "/admin/keys/",
        headers=headers,
        json={
            "label": "Redaction Key",
            "account_id": account_id,
            "scopes": ["models:read", "chat:write", "responses:write"],
        },
    )
    assert key_response.status_code == 201, key_response.text
    issued = key_response.json()["issued"]
    assert issued["key_id"]
    assert issued["token"]
    assert "secret_hash" not in issued
    return issued["key_id"]


def test_admin_runtime_key_responses_never_serialize_secret_hash() -> None:
    clear_runtime_dependency_caches()
    get_governance_service.cache_clear()
    client = TestClient(app)
    headers = _admin_headers(client)
    key_id = _issue_runtime_key(client)

    keys_response = client.get("/admin/keys/", headers=headers)
    assert keys_response.status_code == 200, keys_response.text
    keys_payload = keys_response.json()
    assert keys_payload["keys"]
    assert "secret_hash" not in keys_payload["keys"][0]

    disable_response = client.post(f"/admin/keys/{key_id}/disable", headers=headers, json={})
    assert disable_response.status_code == 200, disable_response.text
    assert disable_response.json()["key"]["status"] == "disabled"
    assert "secret_hash" not in disable_response.json()["key"]

    activate_response = client.post(f"/admin/keys/{key_id}/activate", headers=headers, json={})
    assert activate_response.status_code == 200, activate_response.text
    assert activate_response.json()["key"]["status"] == "active"
    assert "secret_hash" not in activate_response.json()["key"]

    policy_response = client.patch(
        f"/admin/keys/{key_id}/request-path-policy",
        headers=headers,
        json={
            "allowed_request_paths": ["smart_routing", "review_required"],
            "default_request_path": "smart_routing",
            "pinned_target_key": None,
            "local_only_policy": "require_local_target",
            "review_required_conditions": ["budget_exceeded"],
        },
    )
    assert policy_response.status_code == 200, policy_response.text
    assert policy_response.json()["key"]["allowed_request_paths"] == ["smart_routing", "review_required"]
    assert "secret_hash" not in policy_response.json()["key"]

    revoke_response = client.post(f"/admin/keys/{key_id}/revoke", headers=headers, json={})
    assert revoke_response.status_code == 200, revoke_response.text
    assert revoke_response.json()["key"]["status"] == "revoked"
    assert "secret_hash" not in revoke_response.json()["key"]

from conftest import admin_headers as shared_admin_headers
from fastapi.testclient import TestClient

from app.main import app


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


def test_settings_inventory_includes_group_source_and_risk_metadata() -> None:
    client = TestClient(app)
    response = client.get("/admin/settings/", headers=_admin_headers(client))

    assert response.status_code == 200
    payload = response.json()
    by_key = {item["key"]: item for item in payload["settings"]}

    tls = by_key["public_tls_mode"]
    assert tls["group"] == "tls"
    assert tls["group_label"] == "TLS"
    assert tls["source"] in {"default", "override"}
    assert tls["source_label"] in {"Environment default", "Persisted override"}
    assert tls["risk_level"] == "high"
    assert tls["risk_label"] == "High risk"
    assert tls["confirmation_required"] is True
    assert tls["allowed_values"] == ["disabled", "manual", "integrated_acme"]

    observability = by_key["audit_event_retention_limit"]
    assert observability["group"] == "observability"
    assert observability["value_type"] == "int"
    assert observability["mutable"] is True


def test_patch_and_reset_settings_return_operation_and_refreshed_values() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)

    patched = client.patch(
        "/admin/settings/",
        headers=headers,
        json={"updates": {"public_tls_mode": "manual"}},
    )
    assert patched.status_code == 200
    patched_payload = patched.json()
    assert patched_payload["updated"] == ["public_tls_mode"]
    assert patched_payload["operation"]["kind"] == "patch"
    assert patched_payload["operation"]["highest_risk"] == "high"
    assert patched_payload["operation"]["requires_confirmation"] is True

    patched_row = next(item for item in patched_payload["settings"] if item["key"] == "public_tls_mode")
    assert patched_row["effective_value"] == "manual"
    assert patched_row["source"] == "override"
    assert patched_row["overridden"] is True

    reset = client.delete("/admin/settings/public_tls_mode", headers=headers)
    assert reset.status_code == 200
    reset_payload = reset.json()
    assert reset_payload["reset"] == "public_tls_mode"
    assert reset_payload["operation"]["kind"] == "reset"
    assert reset_payload["operation"]["highest_risk"] == "high"

    reset_row = next(item for item in reset_payload["settings"] if item["key"] == "public_tls_mode")
    assert reset_row["effective_value"] == reset_row["default_value"]
    assert reset_row["source"] == "default"
    assert reset_row["overridden"] is False


def test_settings_patch_rejects_invalid_values() -> None:
    client = TestClient(app)
    response = client.patch(
        "/admin/settings/",
        headers=_admin_headers(client),
        json={"updates": {"audit_event_retention_limit": 50}},
    )

    assert response.status_code == 409
    assert response.json()["error"]["type"] == "setting_invalid"

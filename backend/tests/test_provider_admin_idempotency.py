import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.admin.control_plane import get_control_plane_service
from app.main import app


def _admin_headers(client: TestClient) -> dict[str, str]:
    bootstrap_password = os.environ["FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD"]
    response = client.post(
        "/admin/auth/login",
        json={"username": "admin", "password": bootstrap_password},
    )
    assert response.status_code == 201
    access_token = response.json()["access_token"]
    if response.json()["user"]["must_rotate_password"] is True:
        rotated_password = f"{bootstrap_password}-rotated"
        rotate = client.post(
            "/admin/auth/rotate-password",
            headers={"Authorization": f"Bearer {access_token}"},
            json={"current_password": bootstrap_password, "new_password": rotated_password},
        )
        assert rotate.status_code == 200
        relogin = client.post(
            "/admin/auth/login",
            json={"username": "admin", "password": rotated_password},
        )
        assert relogin.status_code == 201
        access_token = relogin.json()["access_token"]
    return {"Authorization": f"Bearer {access_token}"}


def _health_event_count(client: TestClient, headers: dict[str, str]) -> int:
    response = client.get("/admin/usage/", headers=headers)
    assert response.status_code == 200
    return int(response.json()["metrics"]["recorded_health_event_count"])


def _oauth_operation_count(client: TestClient, headers: dict[str, str]) -> int:
    response = client.get("/admin/providers/oauth-account/operations", headers=headers)
    assert response.status_code == 200
    return int(response.json()["total_operations"])


def test_admin_provider_sync_replays_original_outcome_for_matching_idempotency_key() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    provider_name = f"idem_sync_{uuid4().hex[:8]}"

    create = client.post(
        "/admin/providers/",
        headers=admin_headers,
        json={
            "provider": provider_name,
            "label": "Idempotent Sync Provider",
            "config": {"endpoint": "https://example.invalid"},
        },
    )
    assert create.status_code == 201

    headers = {
        **admin_headers,
        "Idempotency-Key": f"idem_provider_sync_{uuid4().hex[:8]}",
        "X-Request-Id": "req_provider_sync_replay_1",
    }
    first = client.post("/admin/providers/sync", json={"provider": provider_name}, headers=headers)
    second = client.post("/admin/providers/sync", json={"provider": provider_name}, headers=headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json() == first.json()
    assert second.headers["X-ForgeGate-Idempotent-Replay"] == "true"
    assert second.headers["Idempotency-Key"] == headers["Idempotency-Key"]

    providers = client.get("/admin/providers/", headers=admin_headers)
    assert providers.status_code == 200
    synced_provider = next(
        item for item in providers.json()["providers"] if item["provider"] == provider_name
    )
    assert synced_provider["last_sync_at"] == first.json()["sync_at"]


def test_admin_provider_sync_rejects_idempotency_fingerprint_mismatch() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    provider_a = f"idem_sync_a_{uuid4().hex[:8]}"
    provider_b = f"idem_sync_b_{uuid4().hex[:8]}"

    for provider_name in (provider_a, provider_b):
        response = client.post(
            "/admin/providers/",
            headers=admin_headers,
            json={
                "provider": provider_name,
                "label": provider_name,
                "config": {"endpoint": "https://example.invalid"},
            },
        )
        assert response.status_code == 201

    headers = {**admin_headers, "Idempotency-Key": f"idem_provider_sync_conflict_{uuid4().hex[:8]}"}
    first = client.post("/admin/providers/sync", json={"provider": provider_a}, headers=headers)
    second = client.post("/admin/providers/sync", json={"provider": provider_b}, headers=headers)

    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["error"]["type"] == "idempotency_fingerprint_mismatch"

    providers = client.get("/admin/providers/", headers=admin_headers)
    assert providers.status_code == 200
    provider_snapshots = {item["provider"]: item for item in providers.json()["providers"]}
    assert provider_snapshots[provider_a]["last_sync_at"] == first.json()["sync_at"]
    assert provider_snapshots[provider_b]["last_sync_at"] is None


def test_admin_provider_health_run_replays_original_outcome_without_repeating_side_effects() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    headers = {**admin_headers, "Idempotency-Key": f"idem_health_run_{uuid4().hex[:8]}"}

    before = _health_event_count(client, admin_headers)
    first = client.post("/admin/providers/health/run", headers=headers, json={})
    after_first = _health_event_count(client, admin_headers)
    second = client.post("/admin/providers/health/run", headers=headers, json={})
    after_second = _health_event_count(client, admin_headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json() == first.json()
    assert second.headers["X-ForgeGate-Idempotent-Replay"] == "true"
    assert after_first > before
    assert after_second == after_first


def test_admin_oauth_probe_replays_original_outcome_without_repeating_operation_log() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    headers = {**admin_headers, "Idempotency-Key": f"idem_oauth_probe_{uuid4().hex[:8]}"}

    before = _oauth_operation_count(client, admin_headers)
    first = client.post("/admin/providers/oauth-account/probe/antigravity", headers=headers, json={})
    after_first = _oauth_operation_count(client, admin_headers)
    second = client.post("/admin/providers/oauth-account/probe/antigravity", headers=headers, json={})
    after_second = _oauth_operation_count(client, admin_headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json() == first.json()
    assert second.headers["X-ForgeGate-Idempotent-Replay"] == "true"
    assert after_first == before + 1
    assert after_second == after_first


def test_admin_oauth_bridge_sync_replays_original_outcome_without_repeating_operation_log() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    headers = {**admin_headers, "Idempotency-Key": f"idem_bridge_sync_{uuid4().hex[:8]}"}

    before = _oauth_operation_count(client, admin_headers)
    first = client.post("/admin/providers/oauth-account/bridge-profiles/sync", headers=headers, json={})
    after_first = _oauth_operation_count(client, admin_headers)
    second = client.post("/admin/providers/oauth-account/bridge-profiles/sync", headers=headers, json={})
    after_second = _oauth_operation_count(client, admin_headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json() == first.json()
    assert second.headers["X-ForgeGate-Idempotent-Replay"] == "true"
    assert after_first == before + 3
    assert after_second == after_first


def test_admin_harness_profile_upsert_replays_redacted_outcome_for_matching_idempotency_key() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    provider_key = f"idem_harness_{uuid4().hex[:8]}"
    headers = {**admin_headers, "Idempotency-Key": f"idem_harness_upsert_{uuid4().hex[:8]}"}
    payload = {
        "provider_key": provider_key,
        "label": "Idempotent Harness Profile",
        "integration_class": "openai_compatible",
        "endpoint_base_url": "https://example.invalid/v1",
        "auth_scheme": "bearer",
        "auth_value": "super-secret-token",
        "models": ["model-a"],
        "request_mapping": {"headers": {"Authorization": "Bearer another-secret", "X-Custom": "keep"}},
    }

    first = client.put(f"/admin/providers/harness/profiles/{provider_key}", headers=headers, json=payload)
    second = client.put(f"/admin/providers/harness/profiles/{provider_key}", headers=headers, json=payload)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json() == first.json()
    assert second.headers["X-ForgeGate-Idempotent-Replay"] == "true"
    assert first.json()["profile"]["auth_value"] == "***redacted***"
    assert first.json()["profile"]["request_mapping"]["headers"]["Authorization"] == "***redacted***"
    assert first.json()["profile"]["request_mapping"]["headers"]["X-Custom"] == "keep"


def test_admin_harness_profile_reads_redact_secrets_in_lists_snapshots_and_redacted_exports() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    provider_key = f"idem_harness_reads_{uuid4().hex[:8]}"

    create = client.put(
        f"/admin/providers/harness/profiles/{provider_key}",
        headers=admin_headers,
        json={
            "provider_key": provider_key,
            "label": "Readable Harness Profile",
            "integration_class": "openai_compatible",
            "endpoint_base_url": "https://example.invalid/v1",
            "auth_scheme": "bearer",
            "auth_value": "top-secret-token-a",
            "models": ["model-a"],
            "request_mapping": {
                "headers": {
                    "Authorization": "Bearer nested-secret-a",
                    "X-Custom": "keep-me",
                }
            },
        },
    )
    assert create.status_code == 200

    update = client.put(
        f"/admin/providers/harness/profiles/{provider_key}",
        headers=admin_headers,
        json={
            "provider_key": provider_key,
            "label": "Readable Harness Profile",
            "integration_class": "openai_compatible",
            "endpoint_base_url": "https://example.invalid/v2",
            "auth_scheme": "bearer",
            "auth_value": "top-secret-token-b",
            "models": ["model-b"],
            "request_mapping": {
                "headers": {
                    "Authorization": "Bearer nested-secret-b",
                    "X-Custom": "keep-me",
                }
            },
        },
    )
    assert update.status_code == 200

    profiles_response = client.get("/admin/providers/harness/profiles", headers=admin_headers)
    snapshot_response = client.get("/admin/providers/harness/snapshot", headers=admin_headers)
    export_response = client.get("/admin/providers/harness/export?redact_secrets=true", headers=admin_headers)

    assert profiles_response.status_code == 200
    assert snapshot_response.status_code == 200
    assert export_response.status_code == 200
    assert "top-secret-token-a" not in profiles_response.text
    assert "top-secret-token-b" not in profiles_response.text
    assert "nested-secret-a" not in profiles_response.text
    assert "nested-secret-b" not in profiles_response.text
    assert "top-secret-token-a" not in snapshot_response.text
    assert "top-secret-token-b" not in snapshot_response.text
    assert "nested-secret-a" not in snapshot_response.text
    assert "nested-secret-b" not in snapshot_response.text
    assert "top-secret-token-a" not in export_response.text
    assert "top-secret-token-b" not in export_response.text
    assert "nested-secret-a" not in export_response.text
    assert "nested-secret-b" not in export_response.text

    listed_profile = next(
        item for item in profiles_response.json()["profiles"] if item["provider_key"] == provider_key
    )
    assert listed_profile["auth_value"] == "***redacted***"
    assert listed_profile["request_mapping"]["headers"]["Authorization"] == "***redacted***"
    assert listed_profile["request_mapping"]["headers"]["X-Custom"] == "keep-me"
    assert listed_profile["config_history"][0]["profile"]["auth_value"] == "***redacted***"
    assert listed_profile["config_history"][0]["profile"]["request_mapping"]["headers"]["Authorization"] == "***redacted***"

    snapshot_profile = next(
        item for item in snapshot_response.json()["snapshot"]["profiles"] if item["provider_key"] == provider_key
    )
    assert snapshot_profile["auth_value"] == "***redacted***"
    assert snapshot_profile["request_mapping"]["headers"]["Authorization"] == "***redacted***"
    assert snapshot_profile["config_history"][0]["profile"]["auth_value"] == "***redacted***"

    export_profile = next(
        item["profile"]
        for item in export_response.json()["snapshot"]["profiles"]
        if item["provider_key"] == provider_key
    )
    assert export_response.json()["snapshot"]["redacted"] is True
    assert export_profile["auth_value"] == "***redacted***"
    assert export_profile["request_mapping"]["headers"]["Authorization"] == "***redacted***"


def test_admin_harness_profile_upsert_rejects_idempotency_fingerprint_mismatch() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    provider_key = f"idem_harness_conflict_{uuid4().hex[:8]}"
    headers = {**admin_headers, "Idempotency-Key": f"idem_harness_conflict_{uuid4().hex[:8]}"}
    first_payload = {
        "provider_key": provider_key,
        "label": "Conflict Profile",
        "integration_class": "openai_compatible",
        "endpoint_base_url": "https://example.invalid/v1",
        "auth_scheme": "bearer",
        "auth_value": "secret-a",
        "models": ["model-a"],
    }
    second_payload = {**first_payload, "auth_value": "secret-b"}

    first = client.put(f"/admin/providers/harness/profiles/{provider_key}", headers=headers, json=first_payload)
    second = client.put(f"/admin/providers/harness/profiles/{provider_key}", headers=headers, json=second_payload)

    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["error"]["type"] == "idempotency_fingerprint_mismatch"


def test_admin_harness_profile_deactivate_replays_original_outcome_without_repeating_side_effects() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    provider_key = f"idem_harness_deactivate_{uuid4().hex[:8]}"

    created = client.put(
        f"/admin/providers/harness/profiles/{provider_key}",
        headers=admin_headers,
        json={
            "provider_key": provider_key,
            "label": "Deactivate Profile",
            "integration_class": "openai_compatible",
            "endpoint_base_url": "https://example.invalid/v1",
            "auth_scheme": "bearer",
            "auth_value": "secret-token",
            "models": ["model-a"],
        },
    )
    assert created.status_code == 200

    headers = {**admin_headers, "Idempotency-Key": f"idem_harness_deactivate_{uuid4().hex[:8]}"}
    first = client.post(f"/admin/providers/harness/profiles/{provider_key}/deactivate", headers=headers, json={})
    profiles_after_first = client.get("/admin/providers/harness/profiles", headers=admin_headers)
    second = client.post(f"/admin/providers/harness/profiles/{provider_key}/deactivate", headers=headers, json={})
    profiles_after_second = client.get("/admin/providers/harness/profiles", headers=admin_headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json() == first.json()
    assert second.headers["X-ForgeGate-Idempotent-Replay"] == "true"
    assert first.json()["profile"]["auth_value"] == "***redacted***"

    first_profile = next(
        item for item in profiles_after_first.json()["profiles"] if item["provider_key"] == provider_key
    )
    second_profile = next(
        item for item in profiles_after_second.json()["profiles"] if item["provider_key"] == provider_key
    )
    assert first_profile["updated_at"] == second_profile["updated_at"]
    assert second_profile["enabled"] is False


def test_admin_harness_import_replays_original_outcome_without_repeating_side_effects() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    provider_key = f"idem_harness_import_{uuid4().hex[:8]}"
    headers = {**admin_headers, "Idempotency-Key": f"idem_harness_import_{uuid4().hex[:8]}"}
    payload = {
        "snapshot": {
            "profiles": [
                {
                    "profile": {
                        "provider_key": provider_key,
                        "label": "Imported Profile",
                        "integration_class": "openai_compatible",
                        "endpoint_base_url": "https://example.invalid/v1",
                        "auth_scheme": "bearer",
                        "auth_value": "import-secret",
                        "models": ["model-a"],
                    }
                }
            ]
        },
        "dry_run": False,
    }

    first = client.post("/admin/providers/harness/import", headers=headers, json=payload)
    profiles_after_first = client.get("/admin/providers/harness/profiles", headers=admin_headers)
    second = client.post("/admin/providers/harness/import", headers=headers, json=payload)
    profiles_after_second = client.get("/admin/providers/harness/profiles", headers=admin_headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json() == first.json()
    assert second.headers["X-ForgeGate-Idempotent-Replay"] == "true"

    first_profile = next(
        item for item in profiles_after_first.json()["profiles"] if item["provider_key"] == provider_key
    )
    second_profile = next(
        item for item in profiles_after_second.json()["profiles"] if item["provider_key"] == provider_key
    )
    assert first_profile["last_imported_at"] == second_profile["last_imported_at"]


def test_admin_harness_preview_replays_redacted_outcome_for_matching_idempotency_key() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    provider_key = f"idem_harness_preview_{uuid4().hex[:8]}"
    created = client.put(
        f"/admin/providers/harness/profiles/{provider_key}",
        headers=admin_headers,
        json={
            "provider_key": provider_key,
            "label": "Preview Profile",
            "integration_class": "openai_compatible",
            "endpoint_base_url": "https://example.invalid/v1",
            "auth_scheme": "bearer",
            "auth_value": "preview-secret",
            "models": ["model-a"],
            "request_mapping": {"headers": {"Authorization": "Bearer inline-secret", "X-Custom": "keep"}},
        },
    )
    assert created.status_code == 200

    headers = {**admin_headers, "Idempotency-Key": f"idem_harness_preview_{uuid4().hex[:8]}"}
    payload = {"provider_key": provider_key, "model": "model-a", "message": "preview me", "stream": False}
    first = client.post("/admin/providers/harness/preview", headers=headers, json=payload)
    second = client.post("/admin/providers/harness/preview", headers=headers, json=payload)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json() == first.json()
    assert second.headers["X-ForgeGate-Idempotent-Replay"] == "true"
    assert first.json()["preview"]["headers"]["Authorization"] == "***redacted***"
    assert first.json()["preview"]["headers"]["X-Custom"] == "keep"


def test_admin_harness_dry_run_replays_redacted_outcome_without_repeating_side_effects() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    provider_key = f"idem_harness_dry_run_{uuid4().hex[:8]}"
    created = client.put(
        f"/admin/providers/harness/profiles/{provider_key}",
        headers=admin_headers,
        json={
            "provider_key": provider_key,
            "label": "Dry Run Profile",
            "integration_class": "openai_compatible",
            "endpoint_base_url": "https://example.invalid/v1",
            "auth_scheme": "bearer",
            "auth_value": "dry-run-secret",
            "models": ["model-a"],
        },
    )
    assert created.status_code == 200

    headers = {**admin_headers, "Idempotency-Key": f"idem_harness_dry_run_{uuid4().hex[:8]}"}
    payload = {"provider_key": provider_key, "model": "model-a", "message": "dry run", "stream": False}
    first = client.post("/admin/providers/harness/dry-run", headers=headers, json=payload)
    runs_after_first = client.get(f"/admin/providers/harness/runs?provider_key={provider_key}", headers=admin_headers)
    second = client.post("/admin/providers/harness/dry-run", headers=headers, json=payload)
    runs_after_second = client.get(f"/admin/providers/harness/runs?provider_key={provider_key}", headers=admin_headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json() == first.json()
    assert second.headers["X-ForgeGate-Idempotent-Replay"] == "true"
    assert first.json()["preview_request"]["headers"]["Authorization"] == "***redacted***"
    assert len(runs_after_first.json()["runs"]) == len(runs_after_second.json()["runs"])


def test_admin_harness_verify_replays_redacted_outcome_without_repeating_side_effects() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    provider_key = f"idem_harness_verify_{uuid4().hex[:8]}"
    created = client.put(
        f"/admin/providers/harness/profiles/{provider_key}",
        headers=admin_headers,
        json={
            "provider_key": provider_key,
            "label": "Verify Profile",
            "integration_class": "openai_compatible",
            "endpoint_base_url": "https://example.invalid/v1",
            "auth_scheme": "bearer",
            "auth_value": "verify-secret",
            "models": ["model-a"],
        },
    )
    assert created.status_code == 200

    headers = {**admin_headers, "Idempotency-Key": f"idem_harness_verify_{uuid4().hex[:8]}"}
    payload = {"provider_key": provider_key, "model": "model-a", "include_preview": True, "live_probe": False}
    first = client.post("/admin/providers/harness/verify", headers=headers, json=payload)
    runs_after_first = client.get(f"/admin/providers/harness/runs?provider_key={provider_key}", headers=admin_headers)
    second = client.post("/admin/providers/harness/verify", headers=headers, json=payload)
    runs_after_second = client.get(f"/admin/providers/harness/runs?provider_key={provider_key}", headers=admin_headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json() == first.json()
    assert second.headers["X-ForgeGate-Idempotent-Replay"] == "true"
    assert first.json()["verification"]["preview_request"]["headers"]["Authorization"] == "***redacted***"
    assert len(runs_after_first.json()["runs"]) == len(runs_after_second.json()["runs"])


def test_admin_harness_probe_rejects_idempotency_key_until_raw_upstream_redaction_exists(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    probe_service = get_control_plane_service()
    called = {"value": False}

    def _fake_probe(payload):  # pragma: no cover - exercised through the route
        called["value"] = True
        return {"status_code": 200, "parsed": {"status": "ok"}, "raw": {"status": "ok"}, "run": {"status": "ok"}}

    monkeypatch.setattr(probe_service, "harness_probe", _fake_probe)

    response = client.post(
        "/admin/providers/harness/probe",
        headers={**admin_headers, "Idempotency-Key": f"idem_harness_probe_{uuid4().hex[:8]}"},
        json={"provider_key": "probe-profile", "model": "model-a", "message": "probe me", "stream": False},
    )

    assert response.status_code == 400
    assert response.json()["error"]["type"] == "idempotency_not_supported"
    assert called["value"] is False

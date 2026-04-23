import json
import os
from uuid import uuid4

from fastapi.testclient import TestClient

from conftest import admin_headers as shared_admin_headers, login_headers_allowing_password_rotation
from app.api.admin.control_plane import get_control_plane_service
from app.harness.models import HarnessVerificationRun
from app.main import app


def _login_headers(client: TestClient, *, username: str, password: str) -> dict[str, str]:
    return login_headers_allowing_password_rotation(client, username=username, password=password)


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


def _create_user_headers(
    client: TestClient,
    creator_headers: dict[str, str],
    *,
    role: str,
) -> tuple[dict[str, object], dict[str, str]]:
    suffix = uuid4().hex[:8]
    password = f"ForgeFrame-{role}-pass-123"
    created = client.post(
        "/admin/security/users",
        headers=creator_headers,
        json={
            "username": f"{role}-{suffix}",
            "display_name": f"{role.title()} {suffix}",
            "role": role,
            "password": password,
        },
    )
    assert created.status_code == 201
    return created.json()["user"], _login_headers(
        client,
        username=created.json()["user"]["username"],
        password=password,
    )


def _activate_impersonation_headers(
    client: TestClient,
    requester_headers: dict[str, str],
    approver_headers: dict[str, str],
    *,
    target_user_id: str,
) -> dict[str, str]:
    request = client.post(
        "/admin/security/impersonations",
        headers=requester_headers,
        json={
            "target_user_id": target_user_id,
            "approval_reference": "INC-HARNESS-EXPORT",
            "justification": "Verify harness export access posture for a read-only impersonation session.",
            "notification_targets": ["slack://security-audit"],
            "duration_minutes": 15,
        },
    )
    assert request.status_code == 202
    request_id = request.json()["request"]["request_id"]

    approval = client.post(
        f"/admin/security/elevated-access-requests/{request_id}/approve",
        headers=approver_headers,
        json={"decision_note": "Approved for harness export contract verification."},
    )
    assert approval.status_code == 200

    issued = client.post(
        f"/admin/security/elevated-access-requests/{request_id}/issue",
        headers=requester_headers,
    )
    assert issued.status_code == 201
    return {"Authorization": f"Bearer {issued.json()['access_token']}"}


def _seed_harness_profile(
    client: TestClient,
    headers: dict[str, str],
    *,
    provider_key: str,
    auth_value: str,
) -> None:
    response = client.put(
        f"/admin/providers/harness/profiles/{provider_key}",
        headers=headers,
        json={
            "provider_key": provider_key,
            "label": f"Harness {provider_key}",
            "integration_class": "openai_compatible",
            "endpoint_base_url": "https://example.invalid/v1",
            "auth_scheme": "bearer",
            "auth_value": auth_value,
            "models": ["model-alpha"],
        },
    )
    assert response.status_code == 200


class _MockProbeResponse:
    def __init__(self, *, status_code: int, payload: dict[str, object]) -> None:
        self.status_code = status_code
        self._payload = payload
        self.headers = {"content-type": "application/json"}
        self.text = json.dumps(payload)

    def json(self) -> dict[str, object]:
        return self._payload


def _find_exported_profile(payload: dict[str, object], provider_key: str) -> dict[str, object]:
    profiles = payload["snapshot"]["profiles"]
    assert isinstance(profiles, list)
    profile = next(item for item in profiles if item["provider_key"] == provider_key)
    assert isinstance(profile, dict)
    return profile


def test_standard_admin_session_can_request_full_harness_export() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    provider_key = f"admin-export-{uuid4().hex[:8]}"
    secret = f"secret-{uuid4().hex[:8]}"
    _seed_harness_profile(client, admin_headers, provider_key=provider_key, auth_value=secret)

    response = client.get(
        "/admin/providers/harness/export?redact_secrets=false",
        headers=admin_headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["snapshot"]["redacted"] is False
    exported = _find_exported_profile(payload, provider_key)
    assert exported["profile"]["auth_value"] == secret


def test_operator_standard_session_gets_redacted_export_but_not_full_snapshot() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    provider_key = f"operator-export-{uuid4().hex[:8]}"
    secret = f"secret-{uuid4().hex[:8]}"
    _seed_harness_profile(client, admin_headers, provider_key=provider_key, auth_value=secret)
    _, operator_headers = _create_user_headers(client, admin_headers, role="operator")

    redacted = client.get("/admin/providers/harness/export", headers=operator_headers)
    assert redacted.status_code == 200
    redacted_payload = redacted.json()
    assert redacted_payload["snapshot"]["redacted"] is True
    exported = _find_exported_profile(redacted_payload, provider_key)
    assert exported["profile"]["auth_value"] == "***redacted***"

    full = client.get(
        "/admin/providers/harness/export?redact_secrets=false",
        headers=operator_headers,
    )
    assert full.status_code == 403
    error = full.json()["error"]
    assert error["type"] == "admin_role_required"
    assert error["message"] == "Full secret-bearing harness exports require an admin session."


def test_read_only_impersonation_can_only_access_redacted_harness_export() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    provider_key = f"read-only-export-{uuid4().hex[:8]}"
    secret = f"secret-{uuid4().hex[:8]}"
    _seed_harness_profile(client, admin_headers, provider_key=provider_key, auth_value=secret)
    target_user, _ = _create_user_headers(client, admin_headers, role="operator")
    _, approver_headers = _create_user_headers(client, admin_headers, role="admin")
    impersonation_headers = _activate_impersonation_headers(
        client,
        admin_headers,
        approver_headers,
        target_user_id=str(target_user["user_id"]),
    )

    redacted = client.get("/admin/providers/harness/export", headers=impersonation_headers)
    assert redacted.status_code == 200
    redacted_payload = redacted.json()
    assert redacted_payload["snapshot"]["redacted"] is True
    exported = _find_exported_profile(redacted_payload, provider_key)
    assert exported["profile"]["auth_value"] == "***redacted***"

    full = client.get(
        "/admin/providers/harness/export?redact_secrets=false",
        headers=impersonation_headers,
    )
    assert full.status_code == 403
    error = full.json()["error"]
    assert error["type"] == "impersonation_session_read_only"
    assert error["message"] == "Read-only sessions cannot request full secret-bearing harness exports."


def test_probe_and_run_history_redact_echoed_secrets_for_operator_and_read_only_sessions(
    monkeypatch,
) -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    provider_key = f"probe-redaction-{uuid4().hex[:8]}"
    secret = f"secret-{uuid4().hex[:8]}"
    _seed_harness_profile(client, admin_headers, provider_key=provider_key, auth_value=secret)

    _, operator_headers = _create_user_headers(client, admin_headers, role="operator")
    target_user, _ = _create_user_headers(client, admin_headers, role="operator")
    _, approver_headers = _create_user_headers(client, admin_headers, role="admin")
    impersonation_headers = _activate_impersonation_headers(
        client,
        admin_headers,
        approver_headers,
        target_user_id=str(target_user["user_id"]),
    )

    def _mock_request(method: str, url: str, *, headers: dict[str, str], json: dict[str, object], timeout: int):
        assert method == "POST"
        assert url.endswith("/chat/completions")
        assert timeout == 30
        assert json["model"] == "model-alpha"
        assert headers["Authorization"] == f"Bearer {secret}"
        return _MockProbeResponse(
            status_code=401,
            payload={
                "model": "model-alpha",
                "choices": [
                    {
                        "message": {
                            "content": f"echo Bearer {secret}",
                        },
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
                "echoed_authorization": headers["Authorization"],
                "auth_value": secret,
                "error": {
                    "message": f"Authorization rejected for Bearer {secret}; auth_value={secret}",
                    "type": "probe_failed",
                },
            },
        )

    monkeypatch.setattr("app.harness.service.httpx.request", _mock_request)

    probe = client.post(
        "/admin/providers/harness/probe",
        headers=operator_headers,
        json={
            "provider_key": provider_key,
            "model": "model-alpha",
            "message": "probe me",
            "stream": False,
        },
    )

    assert probe.status_code == 200
    assert secret not in probe.text
    assert f"Bearer {secret}" not in probe.text
    probe_payload = probe.json()
    assert probe_payload["status_code"] == 401
    assert probe_payload["raw"]["echoed_authorization"] == "***redacted***"
    assert probe_payload["raw"]["auth_value"] == "***redacted***"
    assert probe_payload["parsed"]["content"] == "echo Bearer ***redacted***"
    assert probe_payload["parsed"]["raw"]["echoed_authorization"] == "***redacted***"
    assert "***redacted***" in probe_payload["run"]["error"]

    runs = client.get(
        f"/admin/providers/harness/runs?provider_key={provider_key}",
        headers=impersonation_headers,
    )

    assert runs.status_code == 200
    assert secret not in runs.text
    assert f"Bearer {secret}" not in runs.text
    runs_payload = runs.json()
    run = next(item for item in runs_payload["runs"] if item["mode"] == "probe")
    assert "***redacted***" in run["error"]
    assert runs_payload["ops"]["last_failed_run"]["run_id"] == run["run_id"]
    assert "***redacted***" in runs_payload["ops"]["last_failed_run"]["error"]


def test_provider_truth_axes_redact_historical_harness_failures_for_operator_and_read_only_sessions() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    provider_key = f"truth-redaction-{uuid4().hex[:8]}"
    secret = f"secret-{uuid4().hex[:8]}"
    _seed_harness_profile(client, admin_headers, provider_key=provider_key, auth_value=secret)

    _, operator_headers = _create_user_headers(client, admin_headers, role="operator")
    target_user, _ = _create_user_headers(client, admin_headers, role="operator")
    _, approver_headers = _create_user_headers(client, admin_headers, role="admin")
    impersonation_headers = _activate_impersonation_headers(
        client,
        admin_headers,
        approver_headers,
        target_user_id=str(target_user["user_id"]),
    )

    historical_run = get_control_plane_service()._harness._store.record_run(  # type: ignore[attr-defined]
        HarnessVerificationRun(
            provider_key=provider_key,
            integration_class="openai_compatible",
            mode="probe",
            status="failed",
            success=False,
            steps=[
                {
                    "step": "probe",
                    "status": "failed",
                    "detail": f"Authorization rejected for Bearer {secret}; auth_value={secret}",
                    "headers": {"Authorization": f"Bearer {secret}"},
                    "auth_value": secret,
                }
            ],
            error=f"Authorization rejected for Bearer {secret}; auth_value={secret}",
            executed_at="2099-01-01T00:00:00+00:00",
            client_id="historical-redaction",
            consumer="tests",
            integration="pytest",
        )
    )

    for headers in (operator_headers, impersonation_headers):
        providers = client.get("/admin/providers/", headers=headers)
        assert providers.status_code == 200
        assert secret not in providers.text
        assert f"Bearer {secret}" not in providers.text
        truth_axes = providers.json()["truth_axes"]
        generic_truth = next(item for item in truth_axes if item["provider"]["provider"] == "generic_harness")
        last_failed_run = generic_truth["harness"]["last_failed_run"]
        assert last_failed_run["run_id"] == historical_run.run_id
        assert last_failed_run["error"] == "Authorization rejected for Bearer ***redacted***; auth_value=***redacted***"
        assert last_failed_run["steps"][0]["detail"] == "Authorization rejected for Bearer ***redacted***; auth_value=***redacted***"
        assert last_failed_run["steps"][0]["headers"]["Authorization"] == "***redacted***"
        assert last_failed_run["steps"][0]["auth_value"] == "***redacted***"

        runs = client.get(
            f"/admin/providers/harness/runs?provider_key={provider_key}",
            headers=headers,
        )
        assert runs.status_code == 200
        assert secret not in runs.text
        assert f"Bearer {secret}" not in runs.text
        runs_payload = runs.json()
        run = next(item for item in runs_payload["runs"] if item["run_id"] == historical_run.run_id)
        assert run["error"] == "Authorization rejected for Bearer ***redacted***; auth_value=***redacted***"
        assert run["steps"][0]["detail"] == "Authorization rejected for Bearer ***redacted***; auth_value=***redacted***"
        assert run["steps"][0]["headers"]["Authorization"] == "***redacted***"
        assert run["steps"][0]["auth_value"] == "***redacted***"
        assert runs_payload["ops"]["last_failed_run"]["run_id"] == historical_run.run_id
        assert runs_payload["ops"]["last_failed_run"]["error"] == run["error"]


def test_provider_admin_routes_require_instance_membership_and_keep_write_denied_for_operator_memberships() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    operator_user, operator_headers = _create_user_headers(client, admin_headers, role="operator")
    operator_password = "ForgeFrame-operator-pass-123"

    created_instance = client.post(
        "/admin/instances/",
        headers=admin_headers,
        json={
            "instance_id": "providers_alpha",
            "display_name": "Providers Alpha",
            "tenant_id": "providers_alpha",
            "company_id": "providers_alpha",
        },
    )
    assert created_instance.status_code == 201
    instance_id = created_instance.json()["instance"]["instance_id"]

    denied_listing = client.get(
        "/admin/providers/",
        headers=operator_headers,
        params={"instanceId": instance_id},
    )
    assert denied_listing.status_code == 403
    assert denied_listing.json()["detail"] == "instance_membership_required"

    granted = client.put(
        f"/admin/security/users/{operator_user['user_id']}/memberships/{instance_id}",
        headers=admin_headers,
        json={"role": "operator", "status": "active"},
    )
    assert granted.status_code == 200

    operator_headers = _login_headers(
        client,
        username=str(operator_user["username"]),
        password=operator_password,
    )

    listing = client.get(
        "/admin/providers/",
        headers=operator_headers,
        params={"instanceId": instance_id},
    )
    assert listing.status_code == 200
    assert listing.json()["instance"]["instance_id"] == instance_id

    denied_create = client.post(
        "/admin/providers/",
        headers=operator_headers,
        params={"instanceId": instance_id},
        json={
            "provider": f"scoped_provider_{uuid4().hex[:8]}",
            "label": "Scoped Provider",
            "integration_class": "native",
            "config": {},
        },
    )
    assert denied_create.status_code == 403
    assert denied_create.json()["detail"] == "missing_instance_permission:providers.write"


def test_viewer_session_cannot_access_harness_export() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    _, viewer_headers = _create_user_headers(client, admin_headers, role="viewer")

    response = client.get("/admin/providers/harness/export", headers=viewer_headers)

    assert response.status_code == 403
    assert response.json()["detail"] == "missing_instance_permission:providers.read"

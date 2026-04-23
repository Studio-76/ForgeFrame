import os
from uuid import uuid4

from fastapi.testclient import TestClient

from conftest import admin_headers as shared_admin_headers, login_headers_allowing_password_rotation
from app.execution.dependencies import get_execution_transition_service
from app.governance.service import get_governance_service
from app.main import app


def _login_headers(client: TestClient, *, username: str, password: str) -> dict[str, str]:
    return login_headers_allowing_password_rotation(client, username=username, password=password)


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


def _operator_headers(client: TestClient) -> dict[str, str]:
    admin_headers = _admin_headers(client)
    suffix = uuid4().hex[:8]
    username = f"operator-{suffix}"
    password = "Operator-User-123"
    created_user = client.post(
        "/admin/security/users",
        headers=admin_headers,
        json={
            "username": username,
            "display_name": "Replay Operator",
            "role": "operator",
            "password": password,
        },
    )
    assert created_user.status_code == 201

    return _login_headers(client, username=username, password=password)


def _create_instance(
    client: TestClient,
    headers: dict[str, str],
    *,
    instance_id: str,
    company_id: str,
    tenant_id: str | None = None,
) -> str:
    response = client.post(
        "/admin/instances/",
        headers=headers,
        json={
            "instance_id": instance_id,
            "display_name": instance_id,
            "tenant_id": tenant_id or instance_id,
            "company_id": company_id,
            "deployment_mode": "restricted_eval",
            "exposure_mode": "local_only",
        },
    )
    assert response.status_code == 201
    return response.json()["instance"]["instance_id"]


def _execution_scope(instance_id: str, **params: str) -> dict[str, str]:
    return {"instanceId": instance_id, **params}


def _impersonation_headers(client: TestClient, *, role: str = "operator") -> dict[str, str]:
    admin_headers = _admin_headers(client)
    suffix = uuid4().hex[:8]
    created_user = client.post(
        "/admin/security/users",
        headers=admin_headers,
        json={
            "username": f"impersonated-{role}-{suffix}",
            "display_name": f"Impersonated {role.title()}",
            "role": role,
            "password": "Impersonated-User-123",
        },
    )
    assert created_user.status_code == 201
    target_headers = _login_headers(client, username=f"impersonated-{role}-{suffix}", password="Impersonated-User-123")
    target_logout = client.post("/admin/auth/logout", headers=target_headers)
    assert target_logout.status_code == 200

    approver = client.post(
        "/admin/security/users",
        headers=admin_headers,
        json={
            "username": f"approver-{suffix}",
            "display_name": "Replay Approver",
            "role": "admin",
            "password": "Replay-Approver-123",
        },
    )
    assert approver.status_code == 201
    approver_headers = _login_headers(
        client,
        username=f"approver-{suffix}",
        password="Replay-Approver-123",
    )

    impersonation = client.post(
        "/admin/security/impersonations",
        headers=admin_headers,
        json={
            "target_user_id": created_user.json()["user"]["user_id"],
            "approval_reference": "INC-EXEC-REPLAY",
            "justification": "Verify impersonation replay write protections.",
            "notification_targets": ["slack://security-audit"],
            "duration_minutes": 15,
        },
    )
    assert impersonation.status_code == 202
    request_id = impersonation.json()["request"]["request_id"]

    approval = client.post(
        f"/admin/security/elevated-access-requests/{request_id}/approve",
        headers=approver_headers,
        json={"decision_note": "Approved for execution replay verification coverage."},
    )
    assert approval.status_code == 200

    issued = client.post(
        f"/admin/security/elevated-access-requests/{request_id}/issue",
        headers=admin_headers,
    )
    assert issued.status_code == 201
    return {"Authorization": f"Bearer {issued.json()['access_token']}"}


def _seed_dead_letter_run(*, company_id: str = "forgegate") -> str:
    service = get_execution_transition_service()
    created = service.admit_create(
        company_id=company_id,
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key="idem_seed_dead_letter",
        request_fingerprint_hash="fp_seed_dead_letter",
        run_kind="provider_dispatch",
        issue_id="FOR-27",
    )
    claim = service.claim_next_attempt(company_id=company_id, worker_key="worker_alpha")
    assert claim is not None
    service.mark_attempt_executing(
        company_id=company_id,
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="provider_call",
    )
    service.record_attempt_failure(
        company_id=company_id,
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        failure_class="provider_terminal",
        error_code="provider_authentication_error",
        error_detail="credentials rejected by upstream",
        retryable=False,
    )
    return created.run_id


def _dead_letter_next_attempt(*, company_id: str, run_id: str, worker_key: str = "worker_alpha") -> None:
    service = get_execution_transition_service()
    claim = service.claim_next_attempt(company_id=company_id, worker_key=worker_key)
    assert claim is not None
    assert claim.run_id == run_id
    service.mark_attempt_executing(
        company_id=company_id,
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        step_key="provider_call",
    )
    service.record_attempt_failure(
        company_id=company_id,
        run_id=claim.run_id,
        attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        failure_class="provider_terminal",
        error_code="provider_authentication_error",
        error_detail="credentials rejected by upstream",
        retryable=False,
    )


def test_admin_execution_runs_expose_dead_letter_detail() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_alpha", company_id="company_alpha")
    run_id = _seed_dead_letter_run(company_id="company_alpha")

    listing = client.get(
        "/admin/execution/runs",
        params=_execution_scope(instance_id, state="dead_lettered"),
        headers=headers,
    )

    assert listing.status_code == 200
    runs = listing.json()["runs"]
    run = next(item for item in runs if item["run_id"] == run_id)
    assert run["state"] == "dead_lettered"
    assert run["status_reason"] == "terminal_failure"
    assert run["replayable"] is True
    assert run["current_attempt"]["attempt_state"] == "dead_lettered"

    detail = client.get(
        f"/admin/execution/runs/{run_id}",
        params=_execution_scope(instance_id),
        headers=headers,
    )

    assert detail.status_code == 200
    payload = detail.json()["run"]
    assert payload["run_id"] == run_id
    assert payload["attempts"][0]["attempt_state"] == "dead_lettered"
    assert payload["result_summary"]["error_code"] == "provider_authentication_error"
    assert any(item["event_type"] == "dead_letter" for item in payload["outbox"])


def test_admin_execution_replay_persists_reason_and_audit_event() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_alpha", company_id="company_alpha")
    run_id = _seed_dead_letter_run(company_id="company_alpha")

    replay = client.post(
        f"/admin/execution/runs/{run_id}/replay",
        json={"reason": "Replay after provider credentials were rotated and verified."},
        params=_execution_scope(instance_id),
        headers=headers,
    )

    assert replay.status_code == 200
    replay_payload = replay.json()["replay"]
    assert replay_payload["run_id"] == run_id
    assert replay_payload["run_state"] == "queued"
    assert replay_payload["deduplicated"] is False
    assert replay_payload["audit"]["action"] == "execution_run_replay"
    assert replay_payload["audit"]["target_type"] == "execution_run"
    assert replay_payload["audit"]["target_id"] == run_id
    assert replay_payload["audit"]["instance_id"] == instance_id
    assert replay_payload["audit"]["company_id"] == "company_alpha"
    assert replay_payload["audit"]["event_id"].startswith("audit_")

    detail = client.get(
        f"/admin/execution/runs/{run_id}",
        params=_execution_scope(instance_id),
        headers=headers,
    )
    assert detail.status_code == 200
    run = detail.json()["run"]
    assert run["state"] == "queued"
    assert run["commands"][0]["response_snapshot"]["replay_reason"] == "Replay after provider credentials were rotated and verified."
    assert run["attempts"][0]["attempt_no"] == 2

    replay_audit = next(item for item in get_governance_service().list_audit_events(limit=20, company_id="company_alpha") if item.action == "execution_run_replay")
    assert replay_audit.metadata["reason"] == "Replay after provider credentials were rotated and verified."
    assert replay_audit.target_id == run_id


def test_operator_execution_replay_allows_non_impersonated_sessions() -> None:
    client = TestClient(app)
    operator_headers = _operator_headers(client)
    admin_headers = _admin_headers(client)
    instance_id = _create_instance(client, admin_headers, instance_id="instance_alpha", company_id="company_alpha")
    run_id = _seed_dead_letter_run(company_id="company_alpha")
    reason = "Replay after provider credentials were rotated and verified."

    replay = client.post(
        f"/admin/execution/runs/{run_id}/replay",
        json={"reason": reason},
        params=_execution_scope(instance_id),
        headers=operator_headers,
    )

    assert replay.status_code == 200
    replay_payload = replay.json()["replay"]
    assert replay_payload["run_id"] == run_id
    assert replay_payload["run_state"] == "queued"
    assert replay_payload["deduplicated"] is False
    assert replay_payload["audit"]["instance_id"] == instance_id
    assert replay_payload["audit"]["company_id"] == "company_alpha"

    detail = client.get(
        f"/admin/execution/runs/{run_id}",
        params=_execution_scope(instance_id),
        headers=operator_headers,
    )
    assert detail.status_code == 200
    run = detail.json()["run"]
    assert run["state"] == "queued"
    assert run["commands"][0]["response_snapshot"]["replay_reason"] == reason
    assert run["attempts"][0]["attempt_no"] == 2

    replay_audit = next(
        item
        for item in get_governance_service().list_audit_events(limit=20, company_id="company_alpha")
        if item.action == "execution_run_replay" and item.target_id == run_id
    )
    assert replay_audit.company_id == "company_alpha"


def test_admin_execution_replay_replays_original_outcome_for_matching_idempotency_key() -> None:
    client = TestClient(app)
    bootstrap_headers = _admin_headers(client)
    instance_id = _create_instance(client, bootstrap_headers, instance_id="instance_alpha", company_id="company_alpha")
    headers = {
        **bootstrap_headers,
        "Idempotency-Key": "idem_api_replay_1",
        "X-Request-Id": "req_replay_api_1",
    }
    run_id = _seed_dead_letter_run(company_id="company_alpha")
    reason = "Replay after provider credentials were rotated and verified."

    first = client.post(
        f"/admin/execution/runs/{run_id}/replay",
        json={"reason": reason},
        params=_execution_scope(instance_id),
        headers=headers,
    )
    second = client.post(
        f"/admin/execution/runs/{run_id}/replay",
        json={"reason": reason},
        params=_execution_scope(instance_id),
        headers=headers,
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json() == first.json()
    assert second.headers["X-ForgeFrame-Idempotent-Replay"] == "true"
    assert second.headers["Idempotency-Key"] == "idem_api_replay_1"
    assert second.headers["X-ForgeFrame-Request-Id"] == "req_replay_api_1"
    assert second.headers["X-ForgeFrame-Correlation-Id"] == "req_replay_api_1"
    assert second.headers["X-ForgeFrame-Causation-Id"] == "req_replay_api_1"

    detail = client.get(
        f"/admin/execution/runs/{run_id}",
        params=_execution_scope(instance_id),
        headers=bootstrap_headers,
    )
    assert detail.status_code == 200
    retry_commands = [item for item in detail.json()["run"]["commands"] if item["command_type"] == "retry"]
    assert len(retry_commands) == 1

    replay_audits = [
        item
        for item in get_governance_service().list_audit_events(limit=20, company_id="company_alpha")
        if item.action == "execution_run_replay" and item.target_id == run_id
    ]
    assert len(replay_audits) == 1


def test_admin_execution_replay_rejects_idempotency_fingerprint_mismatch() -> None:
    client = TestClient(app)
    bootstrap_headers = _admin_headers(client)
    instance_id = _create_instance(client, bootstrap_headers, instance_id="instance_alpha", company_id="company_alpha")
    headers = {**bootstrap_headers, "Idempotency-Key": "idem_api_replay_conflict"}
    run_id = _seed_dead_letter_run(company_id="company_alpha")

    first = client.post(
        f"/admin/execution/runs/{run_id}/replay",
        json={"reason": "Replay after provider credentials were rotated and verified."},
        params=_execution_scope(instance_id),
        headers=headers,
    )
    second = client.post(
        f"/admin/execution/runs/{run_id}/replay",
        json={"reason": "Replay after provider credentials were manually cancelled instead."},
        params=_execution_scope(instance_id),
        headers=headers,
    )

    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["error"]["type"] == "idempotency_fingerprint_mismatch"

    detail = client.get(
        f"/admin/execution/runs/{run_id}",
        params=_execution_scope(instance_id),
        headers=bootstrap_headers,
    )
    assert detail.status_code == 200
    commands = detail.json()["run"]["commands"]
    assert [command["command_type"] for command in commands] == ["retry", "create"]


def test_admin_execution_replay_without_idempotency_key_is_deduplicated() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_alpha", company_id="company_alpha")
    run_id = _seed_dead_letter_run(company_id="company_alpha")
    reason = "Replay after provider credentials were rotated and verified."

    first = client.post(
        f"/admin/execution/runs/{run_id}/replay",
        json={"reason": reason},
        params=_execution_scope(instance_id),
        headers=headers,
    )
    duplicate = client.post(
        f"/admin/execution/runs/{run_id}/replay",
        json={"reason": reason},
        params=_execution_scope(instance_id),
        headers=headers,
    )

    assert first.status_code == 200
    assert duplicate.status_code == 200
    assert first.json()["replay"]["deduplicated"] is False
    assert duplicate.json()["replay"]["deduplicated"] is True
    assert duplicate.json()["replay"]["command_id"] == first.json()["replay"]["command_id"]
    assert duplicate.json()["replay"]["attempt_id"] == first.json()["replay"]["attempt_id"]

    detail = client.get(
        f"/admin/execution/runs/{run_id}",
        params=_execution_scope(instance_id),
        headers=headers,
    )
    assert detail.status_code == 200
    run = detail.json()["run"]
    retry_commands = [item for item in run["commands"] if item["command_type"] == "retry"]
    assert run["state"] == "queued"
    assert len(retry_commands) == 1
    assert retry_commands[0]["response_snapshot"]["replay_reason"] == reason

    replay_audits = [item for item in get_governance_service().list_audit_events(limit=20, company_id="company_alpha") if item.action == "execution_run_replay"]
    assert len(replay_audits) == 2
    assert replay_audits[0].metadata["deduplicated"] is True
    assert replay_audits[1].metadata["deduplicated"] is False
    assert all(item.metadata["reason"] == reason for item in replay_audits)


def test_admin_execution_replay_without_idempotency_key_allows_new_terminal_attempt() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_alpha", company_id="company_alpha")
    run_id = _seed_dead_letter_run(company_id="company_alpha")
    reason = "Replay after provider credentials were rotated and verified."

    first = client.post(
        f"/admin/execution/runs/{run_id}/replay",
        json={"reason": reason},
        params=_execution_scope(instance_id),
        headers=headers,
    )
    assert first.status_code == 200

    _dead_letter_next_attempt(company_id="company_alpha", run_id=run_id, worker_key="worker_replay")

    second = client.post(
        f"/admin/execution/runs/{run_id}/replay",
        json={"reason": reason},
        params=_execution_scope(instance_id),
        headers=headers,
    )

    assert second.status_code == 200
    assert second.json()["replay"]["deduplicated"] is False
    assert second.json()["replay"]["command_id"] != first.json()["replay"]["command_id"]

    detail = client.get(
        f"/admin/execution/runs/{run_id}",
        params=_execution_scope(instance_id),
        headers=headers,
    )
    assert detail.status_code == 200
    run = detail.json()["run"]
    retry_commands = [item for item in run["commands"] if item["command_type"] == "retry"]
    assert run["state"] == "queued"
    assert run["attempts"][0]["attempt_no"] == 3
    assert len(retry_commands) == 2
    assert all(item["response_snapshot"]["replay_reason"] == reason for item in retry_commands)


def test_admin_execution_replay_rejects_read_only_impersonation_sessions() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    instance_id = _create_instance(client, admin_headers, instance_id="instance_alpha", company_id="company_alpha")
    run_id = _seed_dead_letter_run(company_id="company_alpha")
    impersonation_headers = _impersonation_headers(client)

    replay = client.post(
        f"/admin/execution/runs/{run_id}/replay",
        json={"reason": "Replay after provider credentials were rotated and verified."},
        params=_execution_scope(instance_id),
        headers=impersonation_headers,
    )

    assert replay.status_code == 403
    assert replay.json()["detail"] == "impersonation_session_read_only"

    detail = client.get(
        f"/admin/execution/runs/{run_id}",
        params=_execution_scope(instance_id),
        headers=admin_headers,
    )
    assert detail.status_code == 200
    run = detail.json()["run"]
    assert run["state"] == "dead_lettered"
    assert run["attempts"][0]["attempt_no"] == 1
    assert len(run["commands"]) == 1
    assert run["commands"][0]["command_type"] == "create"
    assert "replay_reason" not in (run["commands"][0]["response_snapshot"] or {})


def test_admin_execution_reads_allow_read_only_impersonation_sessions() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    instance_id = _create_instance(client, admin_headers, instance_id="instance_alpha", company_id="company_alpha")
    run_id = _seed_dead_letter_run(company_id="company_alpha")
    impersonation_headers = _impersonation_headers(client)

    listing = client.get(
        "/admin/execution/runs",
        params=_execution_scope(instance_id, state="dead_lettered"),
        headers=impersonation_headers,
    )

    assert listing.status_code == 200
    runs = listing.json()["runs"]
    assert any(item["run_id"] == run_id for item in runs)

    detail = client.get(
        f"/admin/execution/runs/{run_id}",
        params=_execution_scope(instance_id),
        headers=impersonation_headers,
    )

    assert detail.status_code == 200
    run = detail.json()["run"]
    assert run["run_id"] == run_id
    assert run["state"] == "dead_lettered"
    assert run["attempts"][0]["attempt_no"] == 1


def test_full_harness_export_requires_admin_and_keeps_redacted_exports_available() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    provider_key = f"secure-harness-export-{uuid4().hex[:8]}"

    created = client.put(
        f"/admin/providers/harness/profiles/{provider_key}",
        headers=admin_headers,
        json={
            "provider_key": provider_key,
            "label": "Secure Harness Export Profile",
            "integration_class": "openai_compatible",
            "endpoint_base_url": "https://example.invalid/v1",
            "auth_scheme": "bearer",
            "auth_value": "full-export-secret",
            "models": ["model-a"],
            "request_mapping": {
                "headers": {
                    "Authorization": "Bearer nested-full-export-secret",
                    "X-Custom": "keep",
                }
            },
        },
    )
    assert created.status_code == 200

    admin_full_export = client.get(
        "/admin/providers/harness/export?redact_secrets=false",
        headers=admin_headers,
    )
    assert admin_full_export.status_code == 200
    admin_profile = next(
        item["profile"]
        for item in admin_full_export.json()["snapshot"]["profiles"]
        if item["provider_key"] == provider_key
    )
    assert admin_full_export.json()["snapshot"]["redacted"] is False
    assert admin_profile["auth_value"] == "full-export-secret"
    assert admin_profile["request_mapping"]["headers"]["Authorization"] == "Bearer nested-full-export-secret"

    operator_full_export = client.get(
        "/admin/providers/harness/export?redact_secrets=false",
        headers=_operator_headers(client),
    )
    assert operator_full_export.status_code == 403
    assert operator_full_export.json()["error"]["type"] == "admin_role_required"

    operator_redacted_export = client.get(
        "/admin/providers/harness/export?redact_secrets=true",
        headers=_operator_headers(client),
    )
    assert operator_redacted_export.status_code == 200
    assert "full-export-secret" not in operator_redacted_export.text
    assert "nested-full-export-secret" not in operator_redacted_export.text
    operator_profile = next(
        item["profile"]
        for item in operator_redacted_export.json()["snapshot"]["profiles"]
        if item["provider_key"] == provider_key
    )
    assert operator_redacted_export.json()["snapshot"]["redacted"] is True
    assert operator_profile["auth_value"] == "***redacted***"
    assert operator_profile["request_mapping"]["headers"]["Authorization"] == "***redacted***"

    impersonation_headers = _impersonation_headers(client, role="admin")
    impersonation_full_export = client.get(
        "/admin/providers/harness/export?redact_secrets=false",
        headers=impersonation_headers,
    )
    assert impersonation_full_export.status_code == 403
    assert impersonation_full_export.json()["error"]["type"] == "impersonation_session_read_only"

    impersonation_redacted_export = client.get(
        "/admin/providers/harness/export?redact_secrets=true",
        headers=impersonation_headers,
    )
    assert impersonation_redacted_export.status_code == 200
    assert "full-export-secret" not in impersonation_redacted_export.text
    assert "nested-full-export-secret" not in impersonation_redacted_export.text
    impersonation_profile = next(
        item["profile"]
        for item in impersonation_redacted_export.json()["snapshot"]["profiles"]
        if item["provider_key"] == provider_key
    )
    assert impersonation_profile["auth_value"] == "***redacted***"
    assert impersonation_profile["request_mapping"]["headers"]["Authorization"] == "***redacted***"


def test_admin_execution_runs_are_filtered_to_request_company_scope() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    alpha_instance_id = _create_instance(client, headers, instance_id="instance_alpha", company_id="company_alpha")
    _create_instance(client, headers, instance_id="instance_beta", company_id="company_beta")
    alpha_run_id = _seed_dead_letter_run(company_id="company_alpha")
    beta_run_id = _seed_dead_letter_run(company_id="company_beta")

    listing = client.get(
        "/admin/execution/runs",
        params=_execution_scope(alpha_instance_id, state="dead_lettered"),
        headers=headers,
    )

    assert listing.status_code == 200
    runs = listing.json()["runs"]
    assert any(item["run_id"] == alpha_run_id for item in runs)
    assert all(item["run_id"] != beta_run_id for item in runs)


def test_admin_execution_detail_and_replay_do_not_cross_company_boundaries() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    alpha_instance_id = _create_instance(client, headers, instance_id="instance_alpha", company_id="company_alpha")
    beta_instance_id = _create_instance(client, headers, instance_id="instance_beta", company_id="company_beta")
    beta_run_id = _seed_dead_letter_run(company_id="company_beta")

    detail = client.get(
        f"/admin/execution/runs/{beta_run_id}",
        params=_execution_scope(alpha_instance_id),
        headers=headers,
    )

    assert detail.status_code == 404
    assert detail.json()["error"]["type"] == "run_not_found"

    replay = client.post(
        f"/admin/execution/runs/{beta_run_id}/replay",
        json={"reason": "Replay after provider credentials were rotated and verified."},
        params=_execution_scope(alpha_instance_id),
        headers=headers,
    )

    assert replay.status_code == 404
    assert replay.json()["error"]["type"] == "run_not_found"

    beta_detail = client.get(
        f"/admin/execution/runs/{beta_run_id}",
        params=_execution_scope(beta_instance_id),
        headers=headers,
    )

    assert beta_detail.status_code == 200
    beta_run = beta_detail.json()["run"]
    assert beta_run["state"] == "dead_lettered"
    assert beta_run["attempts"][0]["attempt_no"] == 1


def test_admin_execution_routes_require_explicit_company_scope() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_alpha", company_id="company_alpha")
    run_id = _seed_dead_letter_run(company_id="company_alpha")

    listing = client.get("/admin/execution/runs", headers=headers)
    assert listing.status_code == 400
    assert listing.json()["detail"] == "execution_instance_scope_required"

    detail = client.get(f"/admin/execution/runs/{run_id}", headers=headers)
    assert detail.status_code == 400
    assert detail.json()["detail"] == "execution_instance_scope_required"

    replay = client.post(
        f"/admin/execution/runs/{run_id}/replay",
        json={"reason": "Replay after provider credentials were rotated and verified."},
        headers=headers,
    )
    assert replay.status_code == 400
    assert replay.json()["detail"] == "execution_instance_scope_required"

    scoped = client.get(
        "/admin/execution/runs",
        params=_execution_scope(instance_id, state="dead_lettered"),
        headers=headers,
    )
    assert scoped.status_code == 200

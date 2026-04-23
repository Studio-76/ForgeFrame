import os
from uuid import uuid4

from fastapi.testclient import TestClient

from conftest import admin_headers as shared_admin_headers, login_headers_allowing_password_rotation
from app.execution.dependencies import get_execution_transition_service, get_execution_worker_service
from app.main import app


def _login_headers(client: TestClient, *, username: str, password: str) -> dict[str, str]:
    return login_headers_allowing_password_rotation(client, username=username, password=password)


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


def _create_instance(client: TestClient, headers: dict[str, str], *, instance_id: str, company_id: str) -> str:
    response = client.post(
        "/admin/instances/",
        headers=headers,
        json={
            "instance_id": instance_id,
            "display_name": instance_id,
            "tenant_id": instance_id,
            "company_id": company_id,
            "deployment_mode": "restricted_eval",
            "exposure_mode": "local_only",
        },
    )
    assert response.status_code == 201
    return response.json()["instance"]["instance_id"]


def _execution_scope(instance_id: str) -> dict[str, str]:
    return {"instanceId": instance_id}


def _seed_leased_run(*, company_id: str) -> tuple[str, str]:
    service = get_execution_transition_service()
    worker = get_execution_worker_service()
    created = service.admit_create(
        company_id=company_id,
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key=f"idem_leased_{uuid4().hex}",
        request_fingerprint_hash=f"fp_leased_{uuid4().hex}",
        run_kind="provider_dispatch",
    )
    worker.start_worker(
        company_id=company_id,
        worker_key="worker_alpha",
        execution_lane="background_agentic",
        instance_id="instance_alpha",
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
    worker.heartbeat_worker(
        company_id=company_id,
        worker_key="worker_alpha",
        instance_id="instance_alpha",
        execution_lane="background_agentic",
        worker_state="busy",
        active_attempts=1,
        current_run_id=claim.run_id,
        current_attempt_id=claim.attempt_id,
        lease_token=claim.lease_token,
        clear_error=True,
    )
    return created.run_id, claim.attempt_id


def test_execution_queue_dispatch_and_operator_action_endpoints() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_alpha", company_id="company_alpha")
    run_id, attempt_id = _seed_leased_run(company_id="company_alpha")

    queue_listing = client.get("/admin/execution/queues", headers=headers, params=_execution_scope(instance_id))
    assert queue_listing.status_code == 200
    assert any(item["execution_lane"] == "background_agentic" for item in queue_listing.json()["lanes"])
    assert any(item["run_id"] == run_id for item in queue_listing.json()["runs"])

    dispatch = client.get("/admin/execution/dispatch", headers=headers, params=_execution_scope(instance_id))
    assert dispatch.status_code == 200
    assert dispatch.json()["dispatch"]["leased_attempts"][0]["attempt_id"] == attempt_id
    assert dispatch.json()["dispatch"]["workers"][0]["worker_state"] == "busy"
    assert dispatch.json()["dispatch"]["workers"][0]["current_attempt_id"] == attempt_id

    interrupt = client.post(
        f"/admin/execution/runs/{run_id}/interrupt",
        headers=headers,
        params=_execution_scope(instance_id),
        json={"reason": "Interrupt before upstream damage spreads."},
    )
    assert interrupt.status_code == 200
    assert interrupt.json()["action"]["operator_state"] == "interrupted"

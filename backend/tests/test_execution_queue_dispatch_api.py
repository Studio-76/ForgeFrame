from datetime import UTC, datetime, timedelta
from uuid import uuid4

from conftest import admin_headers as shared_admin_headers
from conftest import login_headers_allowing_password_rotation
from fastapi.testclient import TestClient

from app.execution.dependencies import (
    get_execution_transition_service,
    get_execution_worker_service,
)
from app.main import app
from app.storage.execution_repository import RunAttemptORM, RunORM


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
    suffix = uuid4().hex
    created = service.admit_create(
        company_id=company_id,
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key=f"idem_leased_{suffix}",
        request_fingerprint_hash=f"fp_leased_{suffix}",
        run_kind="provider_dispatch",
    )
    worker.start_worker(
        company_id=company_id,
        worker_key="worker_alpha",
        execution_lane="background_agentic",
        instance_id="instance_alpha",
    )
    lease_token = f"lease_queue_dispatch_{suffix}"
    current_time = datetime.now(tz=UTC)
    with service._session_factory() as session, session.begin():  # noqa: SLF001 - test-only state shaping
        run = session.get(RunORM, created.run_id)
        attempt = session.get(RunAttemptORM, created.attempt_id)
        assert run is not None
        assert attempt is not None
        run.state = "executing"
        run.operator_state = "waiting_external"
        run.current_step_key = "provider_call"
        run.updated_at = current_time
        run.result_summary = {
            "routing": {
                "selected_target_key": "openai_api::gpt-4.1-mini",
            },
        }
        attempt.attempt_state = "executing"
        attempt.operator_state = "waiting_external"
        attempt.lease_status = "leased"
        attempt.worker_key = "worker_alpha"
        attempt.lease_token = lease_token
        attempt.lease_acquired_at = current_time
        attempt.lease_expires_at = current_time + timedelta(seconds=60)
        attempt.started_at = current_time
        attempt.updated_at = current_time
    worker.heartbeat_worker(
        company_id=company_id,
        worker_key="worker_alpha",
        instance_id="instance_alpha",
        execution_lane="background_agentic",
        worker_state="busy",
        active_attempts=1,
        current_run_id=created.run_id,
        current_attempt_id=created.attempt_id,
        lease_token=lease_token,
        clear_error=True,
    )
    return created.run_id, created.attempt_id


def _expire_leased_attempt(*, run_id: str, attempt_id: str) -> None:
    service = get_execution_transition_service()
    expired_at = datetime.now(tz=UTC) - timedelta(minutes=2)
    with service._session_factory() as session, session.begin():  # noqa: SLF001 - test-only state shaping
        run = session.get(RunORM, run_id)
        attempt = session.get(RunAttemptORM, attempt_id)
        assert run is not None
        assert attempt is not None
        run.updated_at = expired_at
        attempt.lease_expires_at = expired_at
        attempt.last_heartbeat_at = expired_at
        attempt.updated_at = expired_at


def _seed_quarantined_backlog_run(*, company_id: str, age_hours: int = 48) -> str:
    service = get_execution_transition_service()
    suffix = uuid4().hex
    created = service.admit_create(
        company_id=company_id,
        actor_type="agent",
        actor_id="agent_backend",
        idempotency_key=f"idem_quarantined_queue_{suffix}",
        request_fingerprint_hash=f"fp_quarantined_queue_{suffix}",
        run_kind="provider_dispatch",
        issue_id="FOR-QUEUE",
    )
    anchor = datetime.now(tz=UTC) - timedelta(hours=age_hours)
    with service._session_factory() as session, session.begin():  # noqa: SLF001 - test-only state shaping
        run = session.get(RunORM, created.run_id)
        attempt = session.get(RunAttemptORM, created.attempt_id)
        assert run is not None
        assert attempt is not None
        run.state = "dead_lettered"
        run.operator_state = "quarantined"
        run.status_reason = "terminal_failure"
        run.updated_at = anchor
        run.result_summary = {
            "routing": {
                "selected_target_key": "openai_api::gpt-4.1-mini",
            },
        }
        attempt.attempt_state = "dead_lettered"
        attempt.operator_state = "quarantined"
        attempt.lease_status = "released"
        attempt.scheduled_at = anchor
        attempt.started_at = anchor
        attempt.finished_at = anchor
        attempt.last_error_code = "provider_authentication_error"
        attempt.last_error_detail = "credentials rejected by upstream"
        attempt.updated_at = anchor
    return created.run_id


def test_execution_queue_dispatch_and_operator_action_endpoints() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_alpha", company_id="company_alpha")
    run_id, attempt_id = _seed_leased_run(company_id="company_alpha")

    queue_listing = client.get("/admin/execution/queues", headers=headers, params=_execution_scope(instance_id))
    assert queue_listing.status_code == 200
    assert any(item["execution_lane"] == "background_agentic" for item in queue_listing.json()["lanes"])
    assert any(item["run_id"] == run_id for item in queue_listing.json()["runs"])

    dispatch = client.get(
        "/admin/execution/dispatch",
        headers=headers,
        params=_execution_scope(instance_id),
    )
    assert dispatch.status_code == 200
    dispatch_payload = dispatch.json()["dispatch"]
    assert any(item["attempt_id"] == attempt_id for item in dispatch_payload["leased_attempts"])
    leased_attempt = next(item for item in dispatch_payload["leased_attempts"] if item["attempt_id"] == attempt_id)
    assert leased_attempt["selected_target_key"] == "openai_api::gpt-4.1-mini"
    assert any(item["worker_state"] == "busy" for item in dispatch_payload["workers"])
    assert any(item["current_attempt_id"] == attempt_id for item in dispatch_payload["workers"])

    interrupt = client.post(
        f"/admin/execution/runs/{run_id}/interrupt",
        headers=headers,
        params=_execution_scope(instance_id),
        json={"reason": "Interrupt before upstream damage spreads."},
    )
    assert interrupt.status_code == 200
    assert interrupt.json()["action"]["operator_state"] == "interrupted"


def test_execution_dispatch_surfaces_expired_leases_for_reconciliation() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_alpha", company_id="company_alpha")
    run_id, attempt_id = _seed_leased_run(company_id="company_alpha")
    _expire_leased_attempt(run_id=run_id, attempt_id=attempt_id)

    dispatch = client.get(
        "/admin/execution/dispatch",
        headers=headers,
        params=_execution_scope(instance_id),
    )

    assert dispatch.status_code == 200
    dispatch_payload = dispatch.json()["dispatch"]
    stalled_attempt = next(item for item in dispatch_payload["stalled_attempts"] if item["attempt_id"] == attempt_id)
    assert stalled_attempt["run_id"] == run_id
    assert stalled_attempt["selected_target_key"] == "openai_api::gpt-4.1-mini"


def test_execution_queue_filters_explain_waiting_rows() -> None:
    client = TestClient(app)
    headers = _admin_headers(client)
    instance_id = _create_instance(client, headers, instance_id="instance_alpha", company_id="company_alpha")
    run_id = _seed_quarantined_backlog_run(company_id="company_alpha")

    queue_listing = client.get(
        "/admin/execution/queues",
        headers=headers,
        params={
            **_execution_scope(instance_id),
            "execution_lane": "background_agentic",
            "state": "quarantined",
            "target": "openai_api::gpt-4.1-mini",
            "age": "24h",
        },
    )

    assert queue_listing.status_code == 200
    lane = next(item for item in queue_listing.json()["lanes"] if item["execution_lane"] == "background_agentic")
    assert lane["quarantined_runs"] >= 1
    assert lane["running_runs"] >= 0
    assert lane["longest_wait_seconds"] >= 24 * 3600
    row = next(item for item in queue_listing.json()["runs"] if item["run_id"] == run_id)
    assert row["selected_target_key"] == "openai_api::gpt-4.1-mini"
    assert "Quarantined" in row["wait_reason"]
    assert row["next_allowed_action"] == "Replay or restart on Execution Review"
    assert row["wait_age_seconds"] >= 24 * 3600

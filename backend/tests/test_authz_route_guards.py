from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.authz import (
    ActorScope,
    ImpersonationContext,
    RequestActor,
    TenantBoundTarget,
    build_route_guard,
    get_route_policy,
)
from app.authz.route_guards import RouteGuardHTTPException


def _actor(
    *,
    principal_type: str = "human",
    principal_id: str = "principal_1",
    tenant_id: str | None = "tenant_a",
    role_keys: list[str] | None = None,
    permission_keys: list[str] | None = None,
    membership_state: str | None = "active",
    project_ids: list[str] | None = None,
    workspace_ids: list[str] | None = None,
    environment_ids: list[str] | None = None,
    production_environment_ids: list[str] | None = None,
    task_ids: list[str] | None = None,
    run_ids: list[str] | None = None,
    queue_ids: list[str] | None = None,
    policy_flags: list[str] | None = None,
) -> RequestActor:
    return RequestActor(
        principal_type=principal_type,  # type: ignore[arg-type]
        principal_id=principal_id,
        credential_id="cred_1",
        auth_method="bearer_token",
        credential_state="active",
        tenant_id=tenant_id,
        role_keys=role_keys or [],
        scope=ActorScope(
            permission_keys=permission_keys or [],
            project_ids=project_ids or [],
            workspace_ids=workspace_ids or [],
            environment_ids=environment_ids or [],
            production_environment_ids=production_environment_ids or [],
            task_ids=task_ids or [],
            run_ids=run_ids or [],
            queue_ids=queue_ids or [],
        ),
        membership_state=membership_state,  # type: ignore[arg-type]
        request_id="req_test_guard",
        policy_flags=policy_flags or [],
    )


def _make_client(actor: RequestActor | None) -> TestClient:
    app = FastAPI()

    @app.exception_handler(RouteGuardHTTPException)
    def handle_route_guard_exception(_request: Request, exc: RouteGuardHTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, dict) else {}
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "type": detail.get("code") or "forbidden",
                    "message": detail.get("message") or "Forbidden.",
                    "details": detail.get("details") or {},
                    "request_id": detail.get("requestId"),
                }
            },
        )

    def resolve_actor(_request: Request) -> RequestActor | None:
        return actor

    def resolve_target(request: Request) -> TenantBoundTarget | None:
        path = request.url.path
        params = request.path_params
        if path.startswith("/api/v1/tenants/"):
            tenant_id = params["tenant_id"]
            return TenantBoundTarget(resource_type="tenant", resource_id=tenant_id, tenant_id=tenant_id)
        if path.startswith("/api/v1/projects/"):
            project_id = params["project_id"]
            if project_id != "proj_a":
                return None
            return TenantBoundTarget(
                resource_type="project",
                resource_id=project_id,
                tenant_id="tenant_a",
                project_id=project_id,
            )
        if path.startswith("/api/v1/workspaces/"):
            workspace_id = params["workspace_id"]
            if workspace_id != "ws_a":
                return None
            return TenantBoundTarget(
                resource_type="workspace",
                resource_id=workspace_id,
                tenant_id="tenant_a",
                project_id="proj_a",
                workspace_id=workspace_id,
            )
        if path.startswith("/api/v1/environments/"):
            environment_id = params["environment_id"]
            if environment_id != "env_prod":
                return None
            return TenantBoundTarget(
                resource_type="environment",
                resource_id=environment_id,
                tenant_id="tenant_a",
                project_id="proj_a",
                workspace_id="ws_a",
                environment_id=environment_id,
                state_flags=["production"],
            )
        if path.startswith("/api/v1/tasks/"):
            task_id = params["task_id"]
            if task_id != "task_a":
                return None
            return TenantBoundTarget(
                resource_type="task",
                resource_id=task_id,
                tenant_id="tenant_a",
                project_id="proj_a",
                workspace_id="ws_a",
                task_id=task_id,
                queue_id="queue_a",
            )
        if path.startswith("/api/v1/runs/"):
            run_id = params["run_id"]
            if run_id != "run_a":
                return None
            return TenantBoundTarget(
                resource_type="run",
                resource_id=run_id,
                tenant_id="tenant_a",
                project_id="proj_a",
                workspace_id="ws_a",
                task_id="task_a",
                run_id=run_id,
            )
        if path.startswith("/api/v1/service-accounts/"):
            service_account_id = params["service_account_id"]
            return TenantBoundTarget(
                resource_type="service_account",
                resource_id=service_account_id,
                tenant_id="tenant_a",
            )
        if path == "/api/v1/audit-events":
            tenant_id = request.query_params.get("tenantId", "tenant_a")
            return TenantBoundTarget(resource_type="audit_event", resource_id=tenant_id, tenant_id=tenant_id)
        if path == "/api/v1/webhooks/provider-events:ingest":
            return TenantBoundTarget(
                resource_type="webhook_endpoint",
                resource_id="webhook_a",
                tenant_id="tenant_a",
            )
        return None

    @app.get("/api/v1/tenants/{tenant_id}")
    def tenant_read(_context=Depends(build_route_guard(policy=get_route_policy("tenant.read"), resolve_actor=resolve_actor, resolve_target=resolve_target))) -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/v1/projects/{project_id}")
    def project_read(_context=Depends(build_route_guard(policy=get_route_policy("project.read"), resolve_actor=resolve_actor, resolve_target=resolve_target))) -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/v1/workspaces/{workspace_id}:pause")
    def workspace_pause(_context=Depends(build_route_guard(policy=get_route_policy("workspace.pause"), resolve_actor=resolve_actor, resolve_target=resolve_target))) -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/v1/environments/{environment_id}:lock")
    def environment_lock(_context=Depends(build_route_guard(policy=get_route_policy("environment.lock"), resolve_actor=resolve_actor, resolve_target=resolve_target))) -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/v1/tasks/{task_id}:claim")
    def task_claim(_context=Depends(build_route_guard(policy=get_route_policy("task.claim"), resolve_actor=resolve_actor, resolve_target=resolve_target))) -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/v1/runs/{run_id}:cancel")
    def run_cancel(_context=Depends(build_route_guard(policy=get_route_policy("run.cancel"), resolve_actor=resolve_actor, resolve_target=resolve_target))) -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/v1/service-accounts/{service_account_id}:rotate-key")
    def rotate_service_account_key(_context=Depends(build_route_guard(policy=get_route_policy("service_account.rotate_key"), resolve_actor=resolve_actor, resolve_target=resolve_target))) -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/v1/audit-events")
    def audit_events(_context=Depends(build_route_guard(policy=get_route_policy("tenant.audit.read"), resolve_actor=resolve_actor, resolve_target=resolve_target))) -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/v1/webhooks/provider-events:ingest")
    def webhook_ingest(_context=Depends(build_route_guard(policy=get_route_policy("webhook.ingest"), resolve_actor=resolve_actor, resolve_target=resolve_target))) -> dict[str, str]:
        return {"status": "ok"}

    return TestClient(app)


def test_missing_auth_on_tenant_read_returns_401() -> None:
    client = _make_client(None)

    response = client.get("/api/v1/tenants/tenant_a", headers={"x-request-id": "req_missing_auth"})

    assert response.status_code == 401
    error = response.json()["error"]
    assert error["type"] == "unauthenticated"
    assert error["request_id"] == "req_missing_auth"


def test_cross_tenant_tenant_read_returns_404() -> None:
    client = _make_client(_actor(role_keys=["tenant_admin"], tenant_id="tenant_b"))

    response = client.get("/api/v1/tenants/tenant_a")

    assert response.status_code == 404
    assert response.json()["error"]["type"] == "not_found"


def test_same_tenant_project_read_without_scope_returns_403() -> None:
    client = _make_client(_actor(role_keys=["auditor"], tenant_id="tenant_a"))

    response = client.get("/api/v1/projects/proj_a")

    assert response.status_code == 403
    error = response.json()["error"]
    assert error["type"] == "forbidden"
    assert error["details"]["reason"] == "scope_mismatch"


def test_same_tenant_project_read_in_scope_returns_200() -> None:
    client = _make_client(_actor(role_keys=["contributor"], tenant_id="tenant_a", project_ids=["proj_a"]))

    response = client.get("/api/v1/projects/proj_a")

    assert response.status_code == 200


def test_workspace_pause_by_contributor_returns_403() -> None:
    client = _make_client(_actor(role_keys=["contributor"], tenant_id="tenant_a", workspace_ids=["ws_a"]))

    response = client.post("/api/v1/workspaces/ws_a:pause")

    assert response.status_code == 403
    error = response.json()["error"]
    assert error["type"] == "forbidden"
    assert error["details"]["reason"] == "missing_permission"
    assert error["details"]["missingPermissionKeys"] == ["workspace.pause"]


def test_environment_lock_without_production_scope_returns_403() -> None:
    client = _make_client(
        _actor(
            role_keys=["tenant_admin"],
            tenant_id="tenant_a",
            environment_ids=["env_prod"],
        )
    )

    response = client.post("/api/v1/environments/env_prod:lock")

    assert response.status_code == 403
    assert response.json()["error"]["details"]["reason"] == "scope_mismatch"


def test_task_claim_by_authorized_agent_returns_200() -> None:
    client = _make_client(
        _actor(
            principal_type="agent",
            principal_id="agent_a",
            tenant_id="tenant_a",
            membership_state=None,
            permission_keys=["task.assign"],
            workspace_ids=["ws_a"],
            queue_ids=["queue_a"],
        )
    )

    response = client.post("/api/v1/tasks/task_a:claim")

    assert response.status_code == 200


def test_task_claim_by_cross_tenant_agent_returns_404() -> None:
    client = _make_client(
        _actor(
            principal_type="agent",
            principal_id="agent_b",
            tenant_id="tenant_b",
            membership_state=None,
            permission_keys=["task.assign"],
            workspace_ids=["ws_a"],
            queue_ids=["queue_a"],
        )
    )

    response = client.post("/api/v1/tasks/task_a:claim")

    assert response.status_code == 404
    assert response.json()["error"]["type"] == "not_found"


def test_run_cancel_without_run_or_task_scope_returns_403() -> None:
    client = _make_client(
        _actor(
            principal_type="service",
            principal_id="svc_a",
            tenant_id="tenant_a",
            membership_state=None,
            permission_keys=["run.cancel"],
            workspace_ids=["ws_a"],
        )
    )

    response = client.post("/api/v1/runs/run_a:cancel")

    assert response.status_code == 403
    assert response.json()["error"]["details"]["reason"] == "scope_mismatch"


def test_service_account_rotation_without_fresh_auth_returns_403() -> None:
    client = _make_client(_actor(role_keys=["tenant_owner"], tenant_id="tenant_a"))

    response = client.post("/api/v1/service-accounts/svcacct_a:rotate-key")

    assert response.status_code == 403
    error = response.json()["error"]
    assert error["type"] == "forbidden"
    assert error["details"]["reason"] == "policy_guard_failed"
    assert error["details"]["guard"] == "fresh_auth_required"


def test_service_account_rotation_by_read_only_impersonation_returns_403() -> None:
    actor = _actor(
        role_keys=["tenant_owner"],
        tenant_id="tenant_a",
        policy_flags=["fresh_auth"],
    )
    actor.impersonation = ImpersonationContext(
        real_principal_type="human",
        real_principal_id="admin_root",
        reason="support_reproduction",
        expires_at="2026-04-21T12:00:00+00:00",
        read_only=True,
    )
    client = _make_client(actor)

    response = client.post("/api/v1/service-accounts/svcacct_a:rotate-key")

    assert response.status_code == 403
    error = response.json()["error"]
    assert error["type"] == "forbidden"
    assert error["details"]["reason"] == "policy_guard_failed"
    assert error["details"]["guard"] == "impersonation_read_only"


def test_audit_read_by_contributor_returns_403() -> None:
    client = _make_client(_actor(role_keys=["contributor"], tenant_id="tenant_a"))

    response = client.get("/api/v1/audit-events?tenantId=tenant_a")

    assert response.status_code == 403
    error = response.json()["error"]
    assert error["type"] == "forbidden"
    assert error["details"]["reason"] == "missing_permission"
    assert error["details"]["missingPermissionKeys"] == ["tenant.audit.read"]


def test_webhook_ingest_with_invalid_signature_returns_401() -> None:
    client = _make_client(None)

    response = client.post("/api/v1/webhooks/provider-events:ingest", headers={"x-request-id": "req_bad_webhook"})

    assert response.status_code == 401
    error = response.json()["error"]
    assert error["type"] == "unauthenticated"
    assert error["request_id"] == "req_bad_webhook"

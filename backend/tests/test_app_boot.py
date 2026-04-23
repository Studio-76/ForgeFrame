import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app, create_app
from app.readiness import StartupValidationError
from app.settings.config import get_settings


def test_app_boots_and_root_endpoint_serves_the_control_plane_shell() -> None:
    client = TestClient(app)
    response = client.get("/")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "ForgeFrame Control Plane" in response.text


def test_unknown_non_api_route_falls_back_to_the_control_plane_shell() -> None:
    client = TestClient(app)
    response = client.get("/operators/ingress")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "ForgeFrame Control Plane" in response.text


def test_target_routes_are_registered() -> None:
    client = TestClient(app)

    health_response = client.get("/health")
    models_response = client.get("/v1/models")
    auth_bootstrap_response = client.get("/admin/auth/bootstrap")
    admin_response = client.get("/admin/settings/")

    assert health_response.status_code == 200
    assert models_response.status_code == 200
    assert auth_bootstrap_response.status_code == 200
    assert auth_bootstrap_response.json()["bootstrap"] == {
        "message": "Sign in to inspect bootstrap posture.",
    }
    assert admin_response.status_code == 401


def test_admin_audit_history_routes_disable_response_model_generation() -> None:
    audit_history_paths = {
        "/admin/logs/audit-events",
        "/admin/logs/audit-events/{event_id}",
    }
    registered_routes = {
        route.path: route
        for route in app.routes
        if isinstance(route, APIRoute) and route.path in audit_history_paths
    }

    assert set(registered_routes) == audit_history_paths
    for route in registered_routes.values():
        assert route.response_model is None
        assert route.response_field is None


def test_startup_validation_fails_fast_for_invalid_storage_contract(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("FORGEFRAME_HARNESS_STORAGE_BACKEND", raising=False)
    monkeypatch.delenv("FORGEFRAME_HARNESS_POSTGRES_URL", raising=False)
    monkeypatch.setenv("FORGEGATE_HARNESS_STORAGE_BACKEND", "postgresql")
    monkeypatch.setenv("FORGEGATE_HARNESS_POSTGRES_URL", "sqlite:///tmp/forgegate.db")
    get_settings.cache_clear()

    with pytest.raises((StartupValidationError, ValidationError)):
        with TestClient(create_app()):
            pass


def test_startup_validation_fails_fast_for_insecure_bootstrap_admin_password(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD", raising=False)
    monkeypatch.setenv("FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD", "forgegate-admin")
    get_settings.cache_clear()

    with pytest.raises(StartupValidationError):
        with TestClient(create_app()):
            pass

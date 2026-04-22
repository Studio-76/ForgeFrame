import os

from fastapi.testclient import TestClient

from app.main import app


def _login(client: TestClient, username: str, password: str) -> dict[str, object]:
    response = client.post(
        "/admin/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 201
    return response.json()


def _admin_headers(client: TestClient) -> dict[str, str]:
    login = _login(client, "admin", os.environ["FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD"])
    headers = {"Authorization": f"Bearer {login['access_token']}"}
    if login["user"]["must_rotate_password"] is True:
        rotate = client.post(
            "/admin/auth/rotate-password",
            headers=headers,
            json={
                "current_password": os.environ["FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD"],
                "new_password": os.environ["FORGEGATE_BOOTSTRAP_ADMIN_PASSWORD"],
            },
        )
        assert rotate.status_code == 200
    return headers


def _create_operator(client: TestClient, headers: dict[str, str], *, username: str, password: str) -> str:
    response = client.post(
        "/admin/security/users",
        headers=headers,
        json={
            "username": username,
            "display_name": f"{username} operator",
            "role": "operator",
            "password": password,
        },
    )
    assert response.status_code == 201
    return response.json()["user"]["user_id"]


def test_admin_reset_keeps_password_rotation_required_until_self_rotation_finishes() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    user_id = _create_operator(
        client,
        admin_headers,
        username="rotation-target",
        password="Initial-Operator-123",
    )

    reset_response = client.post(
        f"/admin/security/users/{user_id}/rotate-password",
        headers=admin_headers,
        json={"new_password": "Temp-Operator-456"},
    )
    assert reset_response.status_code == 200
    assert reset_response.json()["user"]["must_rotate_password"] is True

    login = _login(client, "rotation-target", "Temp-Operator-456")
    assert login["user"]["must_rotate_password"] is True
    user_headers = {"Authorization": f"Bearer {login['access_token']}"}

    me_response = client.get("/admin/auth/me", headers=user_headers)
    assert me_response.status_code == 200
    assert me_response.json()["user"]["must_rotate_password"] is True

    dashboard_response = client.get("/admin/dashboard/", headers=user_headers)
    assert dashboard_response.status_code == 403
    assert dashboard_response.json()["detail"] == "password_rotation_required"

    providers_response = client.get("/admin/providers/", headers=user_headers)
    assert providers_response.status_code == 403
    assert providers_response.json()["detail"] == "password_rotation_required"

    logout_response = client.post("/admin/auth/logout", headers=user_headers)
    assert logout_response.status_code == 200


def test_self_rotation_clears_password_rotation_gate_for_current_session() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    user_id = _create_operator(
        client,
        admin_headers,
        username="rotation-finish",
        password="Initial-Operator-123",
    )

    reset_response = client.post(
        f"/admin/security/users/{user_id}/rotate-password",
        headers=admin_headers,
        json={"new_password": "Temp-Operator-456", "must_rotate_password": True},
    )
    assert reset_response.status_code == 200

    login = _login(client, "rotation-finish", "Temp-Operator-456")
    user_headers = {"Authorization": f"Bearer {login['access_token']}"}

    rotate_response = client.post(
        "/admin/auth/rotate-password",
        headers=user_headers,
        json={
            "current_password": "Temp-Operator-456",
            "new_password": "Final-Operator-789",
        },
    )
    assert rotate_response.status_code == 200
    assert rotate_response.json()["user"]["must_rotate_password"] is False

    me_response = client.get("/admin/auth/me", headers=user_headers)
    assert me_response.status_code == 200
    assert me_response.json()["user"]["must_rotate_password"] is False

    dashboard_response = client.get("/admin/dashboard/", headers=user_headers)
    assert dashboard_response.status_code == 200


def test_admin_reset_rejects_clearing_password_rotation_requirement() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    user_id = _create_operator(
        client,
        admin_headers,
        username="rotation-reset-reject",
        password="Initial-Operator-123",
    )

    reset_response = client.post(
        f"/admin/security/users/{user_id}/rotate-password",
        headers=admin_headers,
        json={"new_password": "Temp-Operator-456", "must_rotate_password": False},
    )

    assert reset_response.status_code == 422


def test_admin_profile_update_rejects_clearing_password_rotation_requirement() -> None:
    client = TestClient(app)
    admin_headers = _admin_headers(client)
    user_id = _create_operator(
        client,
        admin_headers,
        username="rotation-update-reject",
        password="Initial-Operator-123",
    )

    update_response = client.patch(
        f"/admin/security/users/{user_id}",
        headers=admin_headers,
        json={"must_rotate_password": False},
    )

    assert update_response.status_code == 422

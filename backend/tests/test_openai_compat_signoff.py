import os

from fastapi.testclient import TestClient

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


def test_openai_compatibility_signoff_reports_evidence_without_false_green() -> None:
    client = TestClient(app)

    chat_response = client.post(
        "/v1/chat/completions",
        json={"messages": [{"role": "user", "content": "compat chat"}]},
    )
    assert chat_response.status_code == 200

    with client.stream(
        "POST",
        "/v1/chat/completions",
        json={"messages": [{"role": "user", "content": "compat chat stream"}], "stream": True},
    ) as chat_stream:
        assert chat_stream.status_code == 200
        assert "[DONE]" in "".join(chat_stream.iter_text())

    responses_response = client.post(
        "/v1/responses",
        json={
            "input": [
                {"type": "message", "role": "user", "content": [{"type": "input_text", "text": "compat responses"}]},
                {"type": "function_call_output", "call_id": "tool_prev", "output": "prior output"},
            ],
        },
    )
    assert responses_response.status_code == 200

    with client.stream(
        "POST",
        "/v1/responses",
        json={"input": "compat responses stream", "stream": True},
    ) as responses_stream:
        assert responses_stream.status_code == 200
        body = "".join(responses_stream.iter_text())
        assert "response.completed" in body

    missing_model = client.post(
        "/v1/responses",
        json={"input": "compat error", "model": "missing-model-for-signoff"},
    )
    assert missing_model.status_code == 404

    signoff = client.get(
        "/admin/providers/openai-compatibility/signoff",
        headers=_admin_headers(client),
    )

    assert signoff.status_code == 200
    payload = signoff.json()
    summary = payload["summary"]
    rows = {item["corpus_class"]: item for item in payload["rows"]}

    assert summary["total_checks"] == 13
    assert summary["overall_status"] == "partial"
    assert summary["signoff_claimable"] is False

    assert rows["chat_simple"]["status"] == "supported"
    assert rows["streaming_chat"]["status"] == "supported"
    assert rows["responses_simple"]["status"] == "partial"
    assert rows["responses_input_items"]["status"] == "partial"
    assert rows["streaming_responses"]["status"] == "partial"
    assert rows["error_semantics"]["status"] == "supported"
    assert rows["unsupported_partial_fields"]["status"] == "supported"
    assert rows["files"]["status"] == "unsupported"
    assert rows["embeddings"]["status"] == "unsupported"
    assert "translation layer" in rows["responses_simple"]["raw_diff_summary"]

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


def test_provider_control_plane_exposes_v9_provider_catalog_seed() -> None:
    client = TestClient(app)
    response = client.get("/admin/providers/", headers=_admin_headers(client))

    assert response.status_code == 200
    payload = response.json()
    catalog = {item["provider_id"]: item for item in payload["provider_catalog"]}
    summary = payload["provider_catalog_summary"]

    assert len(catalog) >= 40
    assert summary["total_providers"] == len(catalog)

    openai = catalog["openai"]
    assert openai["provider_class"] == "openai_compatible"
    assert openai["runtime_provider_binding"] == "openai_api"
    assert any(
        item["evidence_class"] == "docs_declared" and item["status"] == "observed"
        for item in openai["evidence_log"]
    )
    assert any(
        item["evidence_class"] == "repo_observed" and item["status"] == "observed"
        for item in openai["evidence_log"]
    )

    azure = catalog["azure_openai"]
    assert azure["source_kind"] == "api_matrix"
    assert azure["maturity_status"] == "adapter-ready-without-live-proof"
    assert azure["product_axis_binding"] == "openai_compatible_generic"
    assert azure["live_signoff_status"] == "blocked-by-live-evidence"
    assert "live probe" in azure["missing_evidence"]
    assert any(
        item["evidence_class"] == "repo_observed"
        and item["source_kind"] == "repo_harness_template"
        and item["source_ref"] == "openai_provider_azure_openai"
        for item in azure["evidence_log"]
    )

    copilot = catalog["github_copilot"]
    assert copilot["provider_class"] == "oauth_cli_bridge"
    assert copilot["oauth_target_binding"] == "github_copilot"
    assert copilot["maturity_status"] == "bridge-only"

    anthropic = catalog["anthropic"]
    assert anthropic["runtime_provider_binding"] == "anthropic"
    assert anthropic["maturity_status"] == "adapter-ready-without-live-proof"
    assert any(
        item["evidence_class"] == "repo_observed"
        and item["source_kind"] in {"repo_runtime", "repo_runtime_binding"}
        and item["source_ref"] == "runtime:anthropic"
        for item in anthropic["evidence_log"]
    )

    bedrock = catalog["bedrock"]
    assert bedrock["provider_class"] == "bedrock_converse"
    assert bedrock["runtime_provider_binding"] == "bedrock"
    assert bedrock["maturity_status"] == "adapter-ready-without-live-proof"
    assert any(
        item["evidence_class"] == "repo_observed"
        and item["source_kind"] in {"repo_runtime", "repo_runtime_binding"}
        and item["source_ref"] == "runtime:bedrock"
        for item in bedrock["evidence_log"]
    )

    nous = catalog["nous"]
    assert nous["provider_class"] == "openai_compatible_aggregator"
    assert nous["maturity_status"] == "adapter-ready-without-live-proof"
    assert any(
        item["evidence_class"] == "repo_observed"
        and item["source_ref"] == "openai_provider_nous"
        for item in nous["evidence_log"]
    )

    opencode_zen = catalog["opencode_zen"]
    assert opencode_zen["provider_class"] == "openai_compatible_aggregator"
    assert opencode_zen["product_axis_binding"] == "openai_compatible_generic"
    assert opencode_zen["maturity_status"] == "adapter-ready-without-live-proof"

    minimax = catalog["minimax"]
    assert minimax["provider_class"] == "openai_compatible"
    assert minimax["product_axis_binding"] == "openai_compatible_generic"
    assert minimax["maturity_status"] == "adapter-ready-without-live-proof"
    assert any(
        item["evidence_class"] == "repo_observed"
        and item["source_kind"] == "repo_harness_template"
        and item["source_ref"] == "openai_provider_minimax"
        for item in minimax["evidence_log"]
    )

    nous_oauth = catalog["nous_oauth"]
    assert nous_oauth["provider_class"] == "oauth_account_runtime"
    assert nous_oauth["oauth_target_binding"] == "nous_oauth"
    assert nous_oauth["product_axis_binding"] == "nous_oauth"
    assert nous_oauth["maturity_status"] == "onboarding-only"

    qwen_oauth = catalog["qwen_oauth"]
    assert qwen_oauth["provider_class"] == "oauth_account_runtime"
    assert qwen_oauth["oauth_target_binding"] == "qwen_oauth"
    assert qwen_oauth["product_axis_binding"] == "qwen_oauth"
    assert qwen_oauth["maturity_status"] == "onboarding-only"

    for provider_id in ("localai", "llama_cpp", "llama_cpp_python", "vllm"):
        row = catalog[provider_id]
        assert row["provider_class"] == "openai_compatible_local"
        assert row["product_axis_binding"] == provider_id
        assert row["maturity_status"] == "adapter-ready-without-live-proof"
        assert any(
            item["evidence_class"] == "repo_observed"
            and item["source_kind"] == "repo_harness_template"
            and item["source_ref"] == f"openai_provider_{provider_id}"
            for item in row["evidence_log"]
        )

    assert summary["blocked_live_signoffs"] >= 1


def test_provider_catalog_attaches_local_reference_paths() -> None:
    client = TestClient(app)
    response = client.get("/admin/providers/", headers=_admin_headers(client))

    assert response.status_code == 200
    catalog = {item["provider_id"]: item for item in response.json()["provider_catalog"]}

    claude = catalog["claude_code"]
    assert any(path.endswith("reference/Provider/API-ClaudeCode.md") for path in claude["local_reference_paths"])
    assert any("reference/Oauth/ClaudeCode" in path for path in claude["local_reference_paths"])

    openrouter = catalog["openrouter"]
    assert any(path.endswith("reference/Provider/API-OpenRouter.md") for path in openrouter["local_reference_paths"])

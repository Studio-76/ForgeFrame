import http.client
import importlib.util
from pathlib import Path
from threading import Thread

from fastapi.testclient import TestClient

from conftest import admin_headers as shared_admin_headers
from app.ingress.service import IngressTlsStatus, TlsCertificateStatus, build_ingress_tls_status
from app.main import app
from app.settings.config import Settings


def _admin_headers(client: TestClient) -> dict[str, str]:
    return shared_admin_headers(client)


def _base_settings(**overrides: object) -> Settings:
    defaults: dict[str, object] = {
        "bootstrap_admin_password": "ForgeFrame-Test-Admin-Secret-123",
        "harness_storage_backend": "file",
        "control_plane_storage_backend": "file",
        "observability_storage_backend": "file",
        "governance_storage_backend": "file",
        "instances_storage_backend": "file",
        "public_fqdn": "forgeframe.example.com",
        "public_https_host": "0.0.0.0",
        "public_https_port": 443,
        "public_http_helper_host": "0.0.0.0",
        "public_http_helper_port": 80,
        "public_admin_base": "/admin",
        "public_tls_mode": "integrated_acme",
        "public_tls_cert_path": "/etc/forgeframe/tls/live/fullchain.pem",
        "public_tls_key_path": "/etc/forgeframe/tls/live/privkey.pem",
        "public_tls_webroot_path": "/var/lib/forgeframe/acme-webroot",
        "public_tls_state_path": "/var/lib/forgeframe/tls",
        "public_tls_last_error_path": "/var/lib/forgeframe/tls/last_error.txt",
        "public_tls_acme_email": "ops@example.com",
    }
    defaults.update(overrides)
    return Settings(**defaults)


def _certificate_status(*, present: bool = True) -> TlsCertificateStatus:
    return TlsCertificateStatus(
        present=present,
        certificate_path="/etc/forgeframe/tls/live/fullchain.pem",
        key_path="/etc/forgeframe/tls/live/privkey.pem",
        issuer="CN=Let's Encrypt",
        subject="CN=forgeframe.example.com",
        valid_from="Apr 23 00:00:00 2026 GMT",
        valid_to="Jul 22 23:59:59 2026 GMT",
        last_issued_at="2026-04-23T00:00:00+00:00",
        last_renewed_at="2026-04-23T00:00:00+00:00",
        renewal_due_at="2026-06-22T23:59:59+00:00",
        days_remaining=90,
        last_error=None,
    )


def _load_acme_helper_module():
    script_path = Path(__file__).resolve().parents[2] / "scripts" / "serve-acme-http.py"
    spec = importlib.util.spec_from_file_location("serve_acme_http", script_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_build_ingress_tls_status_requires_integrated_acme_for_normative_mode(monkeypatch) -> None:
    settings = _base_settings(public_tls_mode="manual")
    monkeypatch.setattr("app.ingress.service._resolve_dns", lambda fqdn, port: (True, ["203.0.113.10"]))
    monkeypatch.setattr("app.ingress.service._load_certificate_status", lambda current: _certificate_status())
    monkeypatch.setattr("app.ingress.service.has_integrated_tls_automation", lambda repo_root: True)

    status = build_ingress_tls_status(settings)

    assert status.mode_classification == "limited_exception"
    assert "tls_mode_not_integrated_acme" in status.blockers


def test_build_ingress_tls_status_reports_normative_public_https_only_when_all_contracts_hold(monkeypatch) -> None:
    settings = _base_settings()
    monkeypatch.setattr("app.ingress.service._resolve_dns", lambda fqdn, port: (True, ["203.0.113.10"]))
    monkeypatch.setattr("app.ingress.service._load_certificate_status", lambda current: _certificate_status())
    monkeypatch.setattr("app.ingress.service.has_integrated_tls_automation", lambda repo_root: True)

    status = build_ingress_tls_status(settings)

    assert status.mode_classification == "normative_public_https"
    assert status.blockers == []
    assert status.public_origin == "https://forgeframe.example.com"


def test_ingress_admin_api_requires_auth_and_returns_operator_truth(monkeypatch) -> None:
    client = TestClient(app)
    expected = IngressTlsStatus(
        fqdn="forgeframe.example.com",
        public_origin="https://forgeframe.example.com",
        frontend_root_path="/",
        runtime_api_base="/v1",
        admin_api_base="/admin",
        public_https_host="0.0.0.0",
        public_https_port=443,
        public_http_helper_host="0.0.0.0",
        public_http_helper_port=80,
        tls_mode="integrated_acme",
        acme_directory_url="https://acme-v02.api.letsencrypt.org/directory",
        acme_webroot_path="/var/lib/forgeframe/acme-webroot",
        integrated_tls_automation=True,
        dns_resolves=True,
        resolved_addresses=["203.0.113.10"],
        certificate=_certificate_status(),
        mode_classification="normative_public_https",
        blockers=[],
        checked_at="2026-04-23T00:00:00+00:00",
    )
    monkeypatch.setattr("app.api.admin.ingress.build_ingress_tls_status", lambda settings: expected)

    unauthorized = client.get("/admin/ingress/tls")
    assert unauthorized.status_code == 401

    response = client.get("/admin/ingress/tls", headers=_admin_headers(client))
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["mode_classification"] == "normative_public_https"
    assert payload["certificate"]["issuer"] == "CN=Let's Encrypt"


def test_ingress_admin_api_exposes_certificate_renewal_result(monkeypatch) -> None:
    client = TestClient(app)
    monkeypatch.setattr(
        "app.api.admin.ingress.run_tls_renewal",
        lambda settings: {
            "status": "failed",
            "command": ["bash", "renew-certificates.sh"],
            "stderr": "certbot failed",
            "exit_code": 1,
        },
    )

    response = client.post("/admin/ingress/tls/renew", headers=_admin_headers(client))

    assert response.status_code == 200
    assert response.json()["renewal"]["status"] == "failed"
    assert response.json()["renewal"]["stderr"] == "certbot failed"


def test_acme_http_helper_only_serves_challenges_and_redirects_other_paths(tmp_path) -> None:
    module = _load_acme_helper_module()
    module.WEBROOT = tmp_path
    module.FQDN = "forgeframe.example.com"
    challenge = tmp_path / "token-123"
    challenge.write_text("challenge-proof", encoding="utf-8")
    server = module.ThreadingHTTPServer(("127.0.0.1", 0), module.AcmeHelperHandler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        challenge_connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=5)
        challenge_connection.request("GET", "/.well-known/acme-challenge/token-123")
        challenge_response = challenge_connection.getresponse()
        assert challenge_response.status == 200
        assert challenge_response.read().decode("utf-8") == "challenge-proof"
        challenge_connection.close()

        redirect_connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=5)
        redirect_connection.request("GET", "/v1/models")
        redirect_response = redirect_connection.getresponse()
        assert redirect_response.status == 301
        assert redirect_response.getheader("Location") == "https://forgeframe.example.com/v1/models"
        redirect_connection.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)

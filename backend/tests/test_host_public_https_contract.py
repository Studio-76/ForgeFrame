from pathlib import Path

import pytest

from app.settings.config import Settings


ROOT = Path(__file__).resolve().parents[2]


def _file_backend_settings(**overrides: object) -> Settings:
    defaults: dict[str, object] = {
        "bootstrap_admin_password": "ForgeFrame-Test-Admin-Secret-123",
        "harness_storage_backend": "file",
        "control_plane_storage_backend": "file",
        "observability_storage_backend": "file",
        "governance_storage_backend": "file",
        "instances_storage_backend": "file",
    }
    defaults.update(overrides)
    return Settings(**defaults)


def test_settings_reject_placeholder_public_https_contract_values_for_integrated_acme() -> None:
    with pytest.raises(ValueError, match="FORGEFRAME_PUBLIC_FQDN"):
        _file_backend_settings(
            public_tls_mode="integrated_acme",
            public_fqdn="replace-with-public-fqdn.example.invalid",
            public_tls_acme_email="ops@example.com",
        )

    with pytest.raises(ValueError, match="FORGEFRAME_PUBLIC_TLS_ACME_EMAIL"):
        _file_backend_settings(
            public_tls_mode="integrated_acme",
            public_fqdn="forgeframe.example.com",
            public_tls_acme_email="replace-with-acme-email@example.invalid",
        )


def test_host_env_example_defaults_to_normative_public_https_contract() -> None:
    env_example = (ROOT / "deploy" / "env" / "forgeframe-host.env.example").read_text(encoding="utf-8")

    assert "FORGEFRAME_PUBLIC_FQDN=replace-with-public-fqdn.example.invalid" in env_example
    assert "FORGEFRAME_PUBLIC_TLS_MODE=integrated_acme" in env_example
    assert "FORGEFRAME_PUBLIC_TLS_ACME_EMAIL=replace-with-acme-email@example.invalid" in env_example


def test_bootstrap_driver_wires_public_https_services_before_normative_smoke() -> None:
    bootstrap_script = (ROOT / "scripts" / "bootstrap-forgeframe.sh").read_text(encoding="utf-8")

    assert "forgeframe-http-helper.service" in bootstrap_script
    assert 'bash "$ROOT_DIR/scripts/renew-certificates.sh"' in bootstrap_script
    assert "forgeframe-public.service forgeframe-acme.timer" in bootstrap_script
    assert "Normative bootstrap path is blocked" in bootstrap_script


def test_host_smoke_defaults_to_public_https_origin_and_same_origin_checks() -> None:
    host_smoke_script = (ROOT / "scripts" / "host-smoke.sh").read_text(encoding="utf-8")

    assert 'printf \'https://%s\\n\' "$FORGEFRAME_PUBLIC_FQDN"' in host_smoke_script
    assert "Normative host smoke requires FORGEFRAME_PUBLIC_TLS_MODE=integrated_acme" in host_smoke_script
    assert 'ROOT_URL="${BASE_URL}/"' in host_smoke_script
    assert 'MODELS_URL="${BASE_URL}/v1/models"' in host_smoke_script
    assert "Root UI did not return an HTML shell." in host_smoke_script

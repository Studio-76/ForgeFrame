"""Shared public surface constants for runtime, UI, and deployment posture."""

from __future__ import annotations

from pathlib import Path

FRONTEND_MOUNT_PATH = "/"
ROOT_SURFACE_KIND = "spa"
NORMATIVE_UI_ROOT_PATH = "/"
NORMATIVE_API_BASE = "/v1"
NORMATIVE_ADMIN_BASE = "/admin"
NORMATIVE_HTTPS_HOST = "0.0.0.0"
NORMATIVE_HTTPS_PORT = 443
NORMATIVE_HTTP_HELPER_PORT = 80
ACME_CHALLENGE_PREFIX = "/.well-known/acme-challenge/"
PUBLIC_FQDN_PLACEHOLDERS = frozenset(
    {
        "",
        "replace-with-public-fqdn.example.invalid",
        "forgeframe.example.invalid",
    }
)
PUBLIC_ACME_EMAIL_PLACEHOLDERS = frozenset(
    {
        "",
        "replace-with-acme-email@example.invalid",
        "ops@example.invalid",
    }
)


def _normalized_public_value(value: str | None) -> str:
    return (value or "").strip().lower()


def is_placeholder_public_fqdn(value: str | None) -> bool:
    normalized = _normalized_public_value(value)
    return normalized in PUBLIC_FQDN_PLACEHOLDERS or normalized.startswith("replace-with-")


def is_placeholder_acme_email(value: str | None) -> bool:
    normalized = _normalized_public_value(value)
    return normalized in PUBLIC_ACME_EMAIL_PLACEHOLDERS or normalized.startswith("replace-with-")


def has_configured_public_fqdn(value: str | None) -> bool:
    return not is_placeholder_public_fqdn(value)


def has_configured_public_acme_email(value: str | None) -> bool:
    return not is_placeholder_acme_email(value)


def resolve_repo_relative_path(repo_root: Path, configured_path: str) -> Path:
    path = Path(configured_path)
    if path.is_absolute():
        return path
    return repo_root / path


def has_linux_host_installation_artifacts(repo_root: Path) -> bool:
    install_script = repo_root / "scripts" / "install-forgeframe.sh"
    systemd_dir = repo_root / "deploy" / "systemd"
    required_paths = (
        install_script,
        repo_root / "deploy" / "env" / "forgeframe-host.env.example",
        systemd_dir / "forgeframe-api.service",
        systemd_dir / "forgeframe-retention.service",
        systemd_dir / "forgeframe-retention.timer",
    )
    return all(path.exists() for path in required_paths)


def has_integrated_tls_automation(repo_root: Path) -> bool:
    required_paths = (
        repo_root / "scripts" / "forgeframe-acme.sh",
        repo_root / "scripts" / "renew-certificates.sh",
        repo_root / "deploy" / "systemd" / "forgeframe-acme.service",
        repo_root / "deploy" / "systemd" / "forgeframe-acme.timer",
    )
    return all(path.exists() for path in required_paths)

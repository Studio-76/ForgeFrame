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

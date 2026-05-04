"""Ingress / TLS runtime truth and operator actions."""

from __future__ import annotations

import os
import socket
import ssl
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.public_surface import (
    FRONTEND_MOUNT_PATH,
    NORMATIVE_ADMIN_BASE,
    NORMATIVE_API_BASE,
    NORMATIVE_HTTP_HELPER_PORT,
    NORMATIVE_HTTPS_HOST,
    NORMATIVE_HTTPS_PORT,
    ROOT_SURFACE_KIND,
    has_configured_public_acme_email,
    has_configured_public_fqdn,
    has_integrated_tls_automation,
)
from app.settings.config import Settings


class TlsCertificateStatus(BaseModel):
    present: bool
    certificate_path: str
    key_path: str
    trust_state: Literal["missing", "self_signed", "public_ca", "unknown"] = "unknown"
    issuer: str | None = None
    subject: str | None = None
    valid_from: str | None = None
    valid_to: str | None = None
    last_issued_at: str | None = None
    last_renewed_at: str | None = None
    renewal_due_at: str | None = None
    days_remaining: int | None = None
    last_error: str | None = None


class IngressTlsStatus(BaseModel):
    fqdn: str | None = None
    public_origin: str | None = None
    frontend_root_path: str
    runtime_api_base: str
    admin_api_base: str
    public_https_host: str
    public_https_port: int
    public_http_helper_host: str
    public_http_helper_port: int
    tls_mode: str
    acme_directory_url: str
    acme_webroot_path: str
    integrated_tls_automation: bool
    dns_resolves: bool
    resolved_addresses: list[str] = Field(default_factory=list)
    certificate: TlsCertificateStatus
    mode_classification: Literal["normative_public_https", "limited_exception"]
    renewal_supported: bool
    renewal_allowed: bool
    renewal_blocked_reason: str | None = None
    blockers: list[str] = Field(default_factory=list)
    checked_at: str


def _read_last_error(settings: Settings) -> str | None:
    """Read the latest TLS issuance error from the configured state directory.

    :param settings: Runtime settings for ingress and TLS.
    :type settings: Settings
    :return: Last recorded error message when available.
    :rtype: str | None
    """
    state_root = Path(settings.public_tls_state_path).resolve(strict=False)
    last_error_path = Path(settings.public_tls_last_error_path).resolve(strict=False)
    if state_root not in last_error_path.parents:
        return "tls_last_error_path_outside_state_root"
    if not last_error_path.exists() or not last_error_path.is_file():
        return None
    return last_error_path.read_text(encoding="utf-8").strip() or None


def _load_certificate_status(settings: Settings) -> TlsCertificateStatus:
    cert_path = Path(settings.public_tls_cert_path)
    key_path = Path(settings.public_tls_key_path)
    last_error = _read_last_error(settings)
    if not cert_path.exists() or not key_path.exists():
        return TlsCertificateStatus(
            present=False,
            certificate_path=str(cert_path),
            key_path=str(key_path),
            trust_state="missing",
            last_error=last_error,
        )

    try:
        decoded = ssl._ssl._test_decode_cert(str(cert_path))  # type: ignore[attr-defined]
    except Exception as exc:  # pragma: no cover - depends on local cert material
        return TlsCertificateStatus(
            present=False,
            certificate_path=str(cert_path),
            key_path=str(key_path),
            trust_state="unknown",
            last_error=f"{type(exc).__name__}: {exc}",
        )

    def _join_name(parts: Any) -> str | None:
        if not parts:
            return None
        pairs: list[str] = []
        for item in parts:
            if isinstance(item, (list, tuple)) and len(item) == 1 and isinstance(item[0], (list, tuple)):
                item = item[0]
            if isinstance(item, (list, tuple)) and len(item) >= 2:
                pairs.append(f"{item[0]}={item[1]}")
        return ", ".join(pairs) if pairs else str(parts)

    valid_from = decoded.get("notBefore")
    valid_to = decoded.get("notAfter")
    expires_at = None
    renewal_due_at = None
    if isinstance(valid_to, str):
        expires_at = datetime.strptime(valid_to, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
        renewal_due_at = (expires_at - timedelta(days=max(1, settings.public_tls_renewal_window_days))).isoformat()
    cert_updated_at = datetime.fromtimestamp(cert_path.stat().st_mtime, tz=timezone.utc).isoformat()

    return TlsCertificateStatus(
        present=True,
        certificate_path=str(cert_path),
        key_path=str(key_path),
        trust_state=("self_signed" if decoded.get("issuer") and decoded.get("subject") and decoded.get("issuer") == decoded.get("subject") else "public_ca"),
        issuer=_join_name(decoded.get("issuer")),
        subject=_join_name(decoded.get("subject")),
        valid_from=valid_from,
        valid_to=valid_to,
        last_issued_at=valid_from,
        last_renewed_at=cert_updated_at,
        renewal_due_at=renewal_due_at,
        days_remaining=((expires_at - datetime.now(tz=timezone.utc)).days if expires_at is not None else None),
        last_error=last_error,
    )


def _resolve_dns(fqdn: str | None, port: int) -> tuple[bool, list[str]]:
    if not fqdn:
        return False, []
    try:
        results = socket.getaddrinfo(fqdn, port, type=socket.SOCK_STREAM)
    except OSError:
        return False, []
    addresses = sorted({str(item[4][0]) for item in results if item[4]})
    return bool(addresses), addresses


def build_ingress_tls_status(settings: Settings) -> IngressTlsStatus:
    configured_fqdn = settings.public_fqdn.strip() if has_configured_public_fqdn(settings.public_fqdn) else ""
    dns_resolves, resolved_addresses = _resolve_dns(configured_fqdn or None, settings.public_https_port)
    certificate = _load_certificate_status(settings)
    repo_root = Path(__file__).resolve().parents[3]
    integrated_tls = has_integrated_tls_automation(repo_root)
    blockers: list[str] = []
    if FRONTEND_MOUNT_PATH != "/":
        blockers.append("root_ui_not_served_on_slash")
    if ROOT_SURFACE_KIND != "spa":
        blockers.append("root_surface_not_spa")
    if settings.api_base != NORMATIVE_API_BASE:
        blockers.append("runtime_api_base_not_normative")
    if settings.public_admin_base != NORMATIVE_ADMIN_BASE:
        blockers.append("admin_api_base_not_normative")
    if settings.public_https_host != NORMATIVE_HTTPS_HOST or settings.public_https_port != NORMATIVE_HTTPS_PORT:
        blockers.append("public_https_listener_not_normative")
    if settings.public_http_helper_port != NORMATIVE_HTTP_HELPER_PORT:
        blockers.append("port80_helper_not_normative")
    if settings.public_tls_mode == "disabled":
        blockers.append("tls_mode_disabled")
    elif settings.public_tls_mode != "integrated_acme":
        blockers.append("tls_mode_not_integrated_acme")
    if not configured_fqdn:
        blockers.append("public_fqdn_missing")
    if settings.public_tls_mode == "integrated_acme" and not has_configured_public_acme_email(settings.public_tls_acme_email):
        blockers.append("public_tls_acme_email_missing")
    if configured_fqdn and not dns_resolves:
        blockers.append("public_fqdn_dns_unresolved")
    if not integrated_tls:
        blockers.append("integrated_tls_automation_missing")
    if not certificate.present:
        blockers.append("certificate_material_missing")

    renewal_supported = integrated_tls
    renewal_blocked_reason: str | None = None
    if settings.public_tls_mode != "integrated_acme":
        renewal_blocked_reason = "tls_mode_not_integrated_acme"
    elif not configured_fqdn:
        renewal_blocked_reason = "public_fqdn_missing"
    elif not has_configured_public_acme_email(settings.public_tls_acme_email):
        renewal_blocked_reason = "public_tls_acme_email_missing"
    elif not dns_resolves:
        renewal_blocked_reason = "public_fqdn_dns_unresolved"
    elif settings.public_http_helper_port != NORMATIVE_HTTP_HELPER_PORT:
        renewal_blocked_reason = "port80_helper_not_normative"
    elif not integrated_tls:
        renewal_blocked_reason = "integrated_tls_automation_missing"
    renewal_allowed = renewal_blocked_reason is None

    public_origin = None
    if configured_fqdn:
        public_origin = f"https://{configured_fqdn}"

    return IngressTlsStatus(
        fqdn=configured_fqdn or None,
        public_origin=public_origin,
        frontend_root_path=FRONTEND_MOUNT_PATH,
        runtime_api_base=settings.api_base,
        admin_api_base=settings.public_admin_base,
        public_https_host=settings.public_https_host,
        public_https_port=settings.public_https_port,
        public_http_helper_host=settings.public_http_helper_host,
        public_http_helper_port=settings.public_http_helper_port,
        tls_mode=settings.public_tls_mode,
        acme_directory_url=settings.public_tls_acme_directory_url,
        acme_webroot_path=settings.public_tls_webroot_path,
        integrated_tls_automation=integrated_tls,
        dns_resolves=dns_resolves,
        resolved_addresses=resolved_addresses,
        certificate=certificate,
        mode_classification="normative_public_https" if not blockers else "limited_exception",
        renewal_supported=renewal_supported,
        renewal_allowed=renewal_allowed,
        renewal_blocked_reason=renewal_blocked_reason,
        blockers=blockers,
        checked_at=datetime.now(tz=timezone.utc).isoformat(),
    )


def run_tls_renewal(settings: Settings) -> dict[str, Any]:
    status = build_ingress_tls_status(settings)
    script = Path(__file__).resolve().parents[3] / "scripts" / "renew-certificates.sh"
    command = ["bash", str(script)]
    if not status.renewal_allowed:
        return {
            "status": "blocked",
            "command": command,
            "blocked_reason": status.renewal_blocked_reason,
            "details": (f"Certificate renewal is unavailable until the integrated ACME contract is satisfied: {status.renewal_blocked_reason}."),
        }
    try:
        completed = subprocess.run(
            command,
            text=True,
            capture_output=True,
            check=False,
            env={
                **os.environ,
                "FORGEFRAME_ENV_FILE": os.environ.get("FORGEFRAME_ENV_FILE", ""),
            },
        )
    except FileNotFoundError as exc:  # pragma: no cover - depends on host shell
        return {
            "status": "blocked",
            "command": command,
            "details": f"{type(exc).__name__}: {exc}",
        }
    return {
        "status": "ok" if completed.returncode == 0 else "failed",
        "command": command,
        "stdout": completed.stdout.strip(),
        "stderr": completed.stderr.strip(),
        "exit_code": completed.returncode,
    }

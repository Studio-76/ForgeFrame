"""Bootstrap-readiness behavior for the control plane."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from app.control_plane import ControlPlaneBootstrapCheck, ControlPlaneBootstrapReadinessReport
from app.public_surface import (
    FRONTEND_MOUNT_PATH,
    ROOT_SURFACE_KIND,
    NORMATIVE_HTTPS_HOST,
    NORMATIVE_HTTPS_PORT,
    has_configured_public_fqdn,
    has_integrated_tls_automation,
    has_linux_host_installation_artifacts,
    resolve_repo_relative_path,
)
from app.tenancy import TenantFilterRequiredError
from app.ingress.service import build_ingress_tls_status


class ControlPlaneBootstrapDomainMixin:
    def _build_bootstrap_readiness_report(self) -> ControlPlaneBootstrapReadinessReport:
        checked_at = datetime.now(tz=UTC).isoformat()
        root_dir = Path(__file__).resolve().parents[4]
        containerized_runtime = root_dir == Path("/app")
        frontend_dist_path = resolve_repo_relative_path(root_dir, self._settings.frontend_dist_path)
        frontend_index = frontend_dist_path / "index.html"
        host_install_script = root_dir / "scripts" / "install-forgeframe.sh"
        host_smoke_script = root_dir / "scripts" / "host-smoke.sh"
        host_backup_restore_smoke = root_dir / "scripts" / "host-backup-restore-smoke.sh"
        upgrade_proof_script = root_dir / "scripts" / "recovery-upgrade-proof.py"
        systemd_dir = root_dir / "deploy" / "systemd"
        host_env_template = root_dir / "deploy" / "env" / "forgeframe-host.env.example"
        ingress_status = build_ingress_tls_status(self._settings)
        observability_filter_required = False
        try:
            observability_aggregates = self._analytics.aggregate(window_seconds=24 * 3600)
        except TenantFilterRequiredError:
            observability_filter_required = True
            observability_aggregates = {
                "event_count": 0,
                "health_event_count": 0,
                "error_event_count": 0,
            }
        checks = [
            ControlPlaneBootstrapCheck(
                id="host_install_script",
                ok=host_install_script.exists(),
                details=str(host_install_script),
            ),
            ControlPlaneBootstrapCheck(
                id="host_env_template",
                ok=host_env_template.exists(),
                details=str(host_env_template),
            ),
            ControlPlaneBootstrapCheck(
                id="systemd_runtime_units",
                ok=(
                    (systemd_dir / "forgeframe-api.service").exists()
                    and (systemd_dir / "forgeframe-retention.service").exists()
                    and (systemd_dir / "forgeframe-retention.timer").exists()
                ),
                details=str(systemd_dir),
            ),
            ControlPlaneBootstrapCheck(
                id="postgres_url",
                ok=bool(self._settings.harness_postgres_url.strip()),
                details="FORGEFRAME_HARNESS_POSTGRES_URL",
            ),
            ControlPlaneBootstrapCheck(
                id="harness_storage_backend",
                ok=self._settings.harness_storage_backend == "postgresql",
                details=self._settings.harness_storage_backend,
            ),
            ControlPlaneBootstrapCheck(
                id="control_plane_storage_backend",
                ok=self._settings.control_plane_storage_backend == "postgresql",
                details=self._settings.control_plane_storage_backend,
            ),
            ControlPlaneBootstrapCheck(
                id="observability_storage_backend",
                ok=self._settings.observability_storage_backend == "postgresql",
                details=self._settings.observability_storage_backend,
            ),
            ControlPlaneBootstrapCheck(
                id="governance_storage_backend",
                ok=self._settings.governance_storage_backend == "postgresql",
                details=self._settings.governance_storage_backend,
            ),
            ControlPlaneBootstrapCheck(
                id="migration_runner",
                ok=(root_dir / "scripts" / "apply-storage-migrations.py").exists(),
                details=str(root_dir / "scripts" / "apply-storage-migrations.py"),
            ),
            ControlPlaneBootstrapCheck(
                id="backup_restore_automation",
                ok=(
                    (root_dir / "scripts" / "backup-forgeframe.sh").exists()
                    and (root_dir / "scripts" / "restore-forgeframe.sh").exists()
                    and host_backup_restore_smoke.exists()
                ),
                details="scripts/backup-forgeframe.sh + scripts/restore-forgeframe.sh + scripts/host-backup-restore-smoke.sh",
            ),
            ControlPlaneBootstrapCheck(
                id="upgrade_recovery_proof_driver",
                ok=upgrade_proof_script.exists(),
                details=str(upgrade_proof_script),
            ),
            ControlPlaneBootstrapCheck(
                id="host_smoke_driver",
                ok=host_smoke_script.exists(),
                details=str(host_smoke_script),
            ),
            ControlPlaneBootstrapCheck(
                id="observability_signal_path",
                ok=(
                    not observability_filter_required
                    and
                    int(observability_aggregates["event_count"]) > 0
                    and int(observability_aggregates["health_event_count"]) > 0
                ),
                details=(
                    "tenant_filter_required"
                    if observability_filter_required
                    else (
                        f"runtime_events_24h={observability_aggregates['event_count']} "
                        f"health_events_24h={observability_aggregates['health_event_count']}"
                    )
                ),
            ),
            ControlPlaneBootstrapCheck(
                id="observability_error_path",
                ok=(not observability_filter_required) and int(observability_aggregates["error_event_count"]) > 0,
                details=(
                    "tenant_filter_required"
                    if observability_filter_required
                    else f"errors_24h={observability_aggregates['error_event_count']}"
                ),
            ),
            ControlPlaneBootstrapCheck(
                id="app_port",
                ok=bool(str(self._settings.port).strip()),
                details=str(self._settings.port),
            ),
            ControlPlaneBootstrapCheck(
                id="frontend_dist",
                ok=frontend_index.exists(),
                details=str(frontend_index),
            ),
            ControlPlaneBootstrapCheck(
                id="root_ui_on_slash",
                ok=FRONTEND_MOUNT_PATH == "/" and ROOT_SURFACE_KIND == "spa",
                details=f"root_surface={ROOT_SURFACE_KIND};frontend_mount_path={FRONTEND_MOUNT_PATH}",
            ),
            ControlPlaneBootstrapCheck(
                id="same_origin_runtime_api",
                ok=self._settings.api_base.startswith("/") and self._settings.public_admin_base.startswith("/"),
                details=f"runtime={self._settings.api_base};admin={self._settings.public_admin_base}",
            ),
            ControlPlaneBootstrapCheck(
                id="public_fqdn_configured",
                ok=bool(has_configured_public_fqdn(self._settings.public_fqdn)),
                details=self._settings.public_fqdn.strip() or "missing",
            ),
            ControlPlaneBootstrapCheck(
                id="public_dns_resolution",
                ok=ingress_status.dns_resolves,
                details=",".join(ingress_status.resolved_addresses) if ingress_status.resolved_addresses else "unresolved",
            ),
            ControlPlaneBootstrapCheck(
                id="public_https_listener",
                ok=(
                    self._settings.public_https_host == NORMATIVE_HTTPS_HOST
                    and self._settings.public_https_port == NORMATIVE_HTTPS_PORT
                    and self._settings.public_tls_mode == "integrated_acme"
                ),
                details=f"{self._settings.public_https_host}:{self._settings.public_https_port};mode={self._settings.public_tls_mode}",
            ),
            ControlPlaneBootstrapCheck(
                id="port80_certificate_helper",
                ok=self._settings.public_http_helper_port == 80 and self._settings.public_tls_mode == "integrated_acme",
                details=f"{self._settings.public_http_helper_host}:{self._settings.public_http_helper_port}",
            ),
            ControlPlaneBootstrapCheck(
                id="certificate_material",
                ok=ingress_status.certificate.present,
                details=ingress_status.certificate.certificate_path,
            ),
            ControlPlaneBootstrapCheck(
                id="tls_mode_classification",
                ok=ingress_status.mode_classification == "normative_public_https",
                details=ingress_status.mode_classification,
            ),
            ControlPlaneBootstrapCheck(
                id="tls_certificate_management",
                ok=has_integrated_tls_automation(root_dir),
                details=(
                    "integrated_tls_automation_present"
                    if has_integrated_tls_automation(root_dir)
                    else "integrated_tls_automation_missing"
                ),
            ),
            ControlPlaneBootstrapCheck(
                id="linux_host_installation",
                ok=has_linux_host_installation_artifacts(root_dir),
                details=(
                    "linux_host_installation_artifacts_present"
                    if has_linux_host_installation_artifacts(root_dir)
                    else "missing_install_script_or_systemd_units"
                ),
            ),
        ]
        ready = all(item.ok for item in checks)
        next_steps = [
            "Run scripts/install-forgeframe.sh on the Linux host, populate forgeframe.env with reachable PostgreSQL URLs, and enable the installed systemd units.",
            "Populate /etc/forgeframe/forgeframe.env with the real public FQDN, ACME operator email, reachable PostgreSQL URLs, and bootstrap credentials before enabling public services.",
            "Enable forgeframe-http-helper.service, issue certificates with scripts/renew-certificates.sh, and then start forgeframe-public.service plus forgeframe-acme.timer on the Linux host.",
            "Keep the operator UI on / and /v1 plus /admin on the same HTTPS origin; any HTTP-only or local-only exposure stays a classified exception, not the default product path.",
            "Treat compose/bootstrap scripts as an alternative path only; they no longer prove the normative Linux-host deployment.",
            "Capture a pre-upgrade checkpoint with scripts/recovery-upgrade-proof.py before releases and import the post-upgrade no-loss report into Recovery / Backup / Restore.",
            "After the public HTTPS origin exists, rerun host-smoke plus host-backup-restore-smoke end to end.",
        ]
        return ControlPlaneBootstrapReadinessReport(
            ready=ready,
            checks=checks,
            next_steps=next_steps,
            checked_at=checked_at,
        )

    def bootstrap_readiness_report(self) -> dict[str, object]:
        report = self._build_bootstrap_readiness_report()
        self._last_bootstrap_readiness = report
        self._persist_state()
        return {"status": "ok", **report.model_dump()}

    def get_last_bootstrap_readiness(self) -> ControlPlaneBootstrapReadinessReport | None:
        return (
            self._last_bootstrap_readiness.model_copy(deep=True)
            if self._last_bootstrap_readiness
            else None
        )

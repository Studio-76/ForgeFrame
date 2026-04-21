"""Bootstrap-readiness behavior for the control plane."""

from __future__ import annotations

import os
from datetime import UTC, datetime
from pathlib import Path

from app.control_plane import ControlPlaneBootstrapCheck, ControlPlaneBootstrapReadinessReport


class ControlPlaneBootstrapDomainMixin:
    def _build_bootstrap_readiness_report(self) -> ControlPlaneBootstrapReadinessReport:
        checked_at = datetime.now(tz=UTC).isoformat()
        root_dir = Path(__file__).resolve().parents[4]
        env_compose = root_dir / ".env.compose"
        compose_file = root_dir / "docker" / "docker-compose.yml"
        containerized_runtime = root_dir == Path("/app")
        checks = [
            ControlPlaneBootstrapCheck(
                id="compose_file",
                ok=compose_file.exists() or containerized_runtime,
                details=str(compose_file) if compose_file.exists() else ("containerized_runtime" if containerized_runtime else str(compose_file)),
            ),
            ControlPlaneBootstrapCheck(
                id="env_compose",
                ok=env_compose.exists() or containerized_runtime,
                details=str(env_compose) if env_compose.exists() else ("containerized_runtime" if containerized_runtime else str(env_compose)),
            ),
            ControlPlaneBootstrapCheck(
                id="postgres_url",
                ok=bool(self._settings.harness_postgres_url.strip()),
                details="FORGEGATE_HARNESS_POSTGRES_URL",
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
                id="app_port",
                ok=bool(str(self._settings.port).strip()),
                details=str(self._settings.port),
            ),
            ControlPlaneBootstrapCheck(
                id="docker_host_hint",
                ok=bool(os.environ.get("DOCKER_HOST") or os.path.exists("/var/run/docker.sock")),
                details=os.environ.get("DOCKER_HOST", "/var/run/docker.sock"),
            ),
        ]
        ready = all(item.ok for item in checks[:-1])
        next_steps = [
            "Run ./scripts/bootstrap-forgegate.sh for docker-first setup including storage migrations.",
            "For non-docker recovery, run python3 scripts/apply-storage-migrations.py against the configured PostgreSQL target.",
            "Use ./scripts/compose-smoke.sh to verify harness + control-plane path.",
            "Open /app/ and verify provider probes, security bootstrap and bridge profile sync from the control plane.",
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

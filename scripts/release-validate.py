#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import platform
import shutil
import subprocess
import sys
import tempfile
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"
DEFAULT_REPORT_PATH = Path(tempfile.gettempdir()) / "forgeframe-release-validation.json"
REPORT_PATH = Path(os.environ.get("FORGEFRAME_RELEASE_REPORT_PATH", str(DEFAULT_REPORT_PATH)))
SKIP_COMMANDS = os.environ.get("FORGEFRAME_RELEASE_VALIDATE_SKIP_COMMANDS") == "1"

sys.path.insert(0, str(ROOT_DIR / "backend"))

from app.public_surface import (  # noqa: E402
    FRONTEND_MOUNT_PATH,
    has_integrated_tls_automation,
    has_linux_host_installation_artifacts,
)
from app.settings.config import get_settings  # noqa: E402
from app.ingress.service import build_ingress_tls_status  # noqa: E402

RUNTIME_CONTRACT_BACKEND_TESTS = [
    "backend/tests/test_runtime_core.py",
    "backend/tests/test_runtime_route_policies.py",
    "backend/tests/test_runtime_auth_boundary.py",
    "backend/tests/test_external_openai_path.py",
]
ROUTING_QUEUE_BACKEND_TESTS = [
    "backend/tests/test_routing_admin_api.py",
    "backend/tests/test_routing_service.py",
    "backend/tests/test_execution_queue_dispatch_api.py",
    "backend/tests/test_execution_background_worker.py",
    "backend/tests/test_execution_operator_fabric.py",
]
WORK_INTERACTION_BACKEND_TESTS = [
    "backend/tests/test_conversations_inbox_admin_api.py",
    "backend/tests/test_tasking_delivery_admin_api.py",
    "backend/tests/test_knowledge_memory_admin_api.py",
    "backend/tests/test_assistant_profiles_admin_api.py",
    "backend/tests/test_workspaces_artifacts_admin_api.py",
]
OPERATOR_SURFACE_FRONTEND_TESTS = [
    "tests/observability-pages.test.tsx",
    "tests/setup-module-pages.test.tsx",
    "tests/routing-page.test.tsx",
    "tests/queues-page.test.tsx",
    "tests/dispatch-page.test.tsx",
    "tests/work-interaction-pages.test.tsx",
]


@dataclass
class StepResult:
    id: str
    status: str
    source: str
    details: str
    command: list[str] | None = None
    exit_code: int | None = None


def _passed(step_id: str, details: str, *, command: list[str] | None = None) -> StepResult:
    return StepResult(id=step_id, status="passed", source="internal", details=details, command=command)


def _failed(step_id: str, details: str, *, command: list[str] | None = None, exit_code: int | None = None) -> StepResult:
    return StepResult(
        id=step_id,
        status="failed",
        source="internal_product_gap",
        details=details,
        command=command,
        exit_code=exit_code,
    )


def _blocked(step_id: str, details: str, *, source: str, command: list[str] | None = None) -> StepResult:
    return StepResult(id=step_id, status="blocked", source=source, details=details, command=command)


def _run_command(step_id: str, command: list[str], *, cwd: Path | None = None) -> StepResult:
    try:
        completed = subprocess.run(
            command,
            cwd=str(cwd) if cwd is not None else None,
            text=True,
            capture_output=True,
            check=False,
        )
    except FileNotFoundError as exc:
        return _blocked(step_id, f"missing_command:{exc}", source="external_dependency", command=command)

    if completed.returncode == 0:
        return _passed(step_id, "command_completed", command=command)

    details = completed.stderr.strip() or completed.stdout.strip() or f"exit_code={completed.returncode}"
    return _failed(step_id, details, command=command, exit_code=completed.returncode)


def _gate(step_id: str, ok: bool, success_details: str, failure_details: str) -> StepResult:
    if ok:
        return _passed(step_id, success_details)
    return _failed(step_id, failure_details)


def _linux_shell_step(step_id: str, script_name: str) -> StepResult:
    command = ["bash", str(SCRIPTS_DIR / script_name)]
    if SKIP_COMMANDS:
        return _blocked(step_id, "skipped_by_release_validate_skip_commands", source="operator_override", command=command)
    if platform.system() != "Linux":
        return _blocked(step_id, "linux_host_required_for_this_release_gate", source="unsupported_host", command=command)
    if shutil.which("bash") is None:
        return _blocked(step_id, "bash_not_available", source="external_dependency", command=command)
    return _run_command(step_id, command, cwd=ROOT_DIR)


def _python_driver_step(step_id: str, script_name: str, *, args: list[str] | None = None) -> StepResult:
    command = [sys.executable, str(SCRIPTS_DIR / script_name), *(args or [])]
    if SKIP_COMMANDS:
        return _blocked(
            step_id,
            "skipped_by_release_validate_skip_commands",
            source="operator_override",
            command=command,
        )
    return _run_command(step_id, command, cwd=ROOT_DIR)


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _build_report(steps: list[StepResult]) -> dict[str, object]:
    failed = any(step.status == "failed" for step in steps)
    blocked = any(step.status == "blocked" for step in steps)
    status = "failed" if failed else ("blocked" if blocked else "passed")
    return {
        "status": status,
        "checked_at": datetime.now(tz=timezone.utc).isoformat(),
        "host": {
            "platform": platform.system(),
            "platform_release": platform.release(),
            "python": sys.executable,
            "bash_available": shutil.which("bash") is not None,
            "docker_available": shutil.which("docker") is not None,
            "npm_available": shutil.which("npm") is not None,
        },
        "steps": [asdict(step) for step in steps],
    }


def _public_ingress_mode_step() -> StepResult:
    injected_defaults = {
        "FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD": os.environ.get("FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD", "release-validate-placeholder"),
        "FORGEFRAME_HARNESS_POSTGRES_URL": os.environ.get("FORGEFRAME_HARNESS_POSTGRES_URL", "postgresql://forgeframe:test@127.0.0.1:5432/forgeframe"),
        "FORGEFRAME_CONTROL_PLANE_POSTGRES_URL": os.environ.get("FORGEFRAME_CONTROL_PLANE_POSTGRES_URL", "postgresql://forgeframe:test@127.0.0.1:5432/forgeframe"),
        "FORGEFRAME_OBSERVABILITY_POSTGRES_URL": os.environ.get("FORGEFRAME_OBSERVABILITY_POSTGRES_URL", "postgresql://forgeframe:test@127.0.0.1:5432/forgeframe"),
        "FORGEFRAME_GOVERNANCE_POSTGRES_URL": os.environ.get("FORGEFRAME_GOVERNANCE_POSTGRES_URL", "postgresql://forgeframe:test@127.0.0.1:5432/forgeframe"),
        "FORGEFRAME_INSTANCES_POSTGRES_URL": os.environ.get("FORGEFRAME_INSTANCES_POSTGRES_URL", "postgresql://forgeframe:test@127.0.0.1:5432/forgeframe"),
    }
    prior_values = {key: os.environ.get(key) for key in injected_defaults}
    try:
        os.environ.update(injected_defaults)
        get_settings.cache_clear()
        status = build_ingress_tls_status(get_settings())
    except Exception as exc:
        return _failed("public_ingress_mode_classification", f"ingress_status_unavailable:{type(exc).__name__}:{exc}")
    finally:
        for key, value in prior_values.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        get_settings.cache_clear()

    if status.mode_classification == "normative_public_https":
        return _passed("public_ingress_mode_classification", "normative_public_https")
    detail = ",".join(status.blockers) if status.blockers else "none_reported"
    return _failed(
        "public_ingress_mode_classification",
        f"mode={status.mode_classification};blockers={detail}",
    )


def main() -> int:
    start_script = _read_text(SCRIPTS_DIR / "start-forgeframe.sh")
    bootstrap_script = _read_text(SCRIPTS_DIR / "bootstrap-forgeframe.sh")
    install_script = _read_text(SCRIPTS_DIR / "install-forgeframe.sh")
    backup_script = _read_text(SCRIPTS_DIR / "backup-forgeframe.sh")
    restore_script = _read_text(SCRIPTS_DIR / "restore-forgeframe.sh")
    public_start_script = SCRIPTS_DIR / "start-public-forgeframe.sh"
    http_helper_script = SCRIPTS_DIR / "start-http-helper.sh"

    steps = [
        _gate(
            "release_driver_portability",
            all((SCRIPTS_DIR / name).exists() for name in ("test-backend.py", "test-frontend.py", "release-validate.py")),
            "python_release_drivers_present",
            "python_release_drivers_missing",
        ),
        _gate(
            "linux_host_installation_artifacts",
            has_linux_host_installation_artifacts(ROOT_DIR),
            "linux_host_installation_artifacts_present",
            "missing_install_script_or_systemd_units",
        ),
        _gate(
            "host_native_bootstrap_driver",
            "docker compose" not in bootstrap_script and "docker compose" not in install_script,
            "bootstrap_driver_is_host_native",
            "bootstrap_driver_still_depends_on_compose",
        ),
        _gate(
            "host_native_recovery_scripts",
            "docker compose" not in backup_script and "docker compose" not in restore_script,
            "backup_restore_scripts_are_host_neutral",
            "backup_restore_scripts_still_depend_on_compose",
        ),
        _gate(
            "integrated_tls_automation_artifacts",
            has_integrated_tls_automation(ROOT_DIR),
            "integrated_tls_automation_present",
            "integrated_tls_automation_missing",
        ),
        _gate(
            "public_listener_drivers",
            public_start_script.exists() and http_helper_script.exists(),
            "public_listener_drivers_present",
            "public_listener_drivers_missing",
        ),
        _gate(
            "public_ui_root_contract",
            FRONTEND_MOUNT_PATH == "/",
            "ui_mounted_on_root",
            f"ui_mounted_on_{FRONTEND_MOUNT_PATH}_instead_of_root",
        ),
        _gate(
            "public_https_port_contract",
            '${FORGEFRAME_PORT:-8000}' not in start_script and '${FORGEFRAME_APP_PORT:-8000}' not in bootstrap_script,
            "release_scripts_do_not_default_to_port_8000",
            "release_scripts_still_default_to_port_8000",
        ),
        _public_ingress_mode_step(),
        _gate(
            "bootstrap_origin_contract",
            "http://127.0.0.1" not in bootstrap_script and "/app/" not in bootstrap_script,
            "bootstrap_uses_normative_https_origin_contract",
            "bootstrap_still_targets_http_localhost_and_/app",
        ),
        _python_driver_step(
            "runtime_contract_release_gates",
            "test-backend.py",
            args=RUNTIME_CONTRACT_BACKEND_TESTS,
        ),
        _python_driver_step(
            "routing_queue_release_gates",
            "test-backend.py",
            args=ROUTING_QUEUE_BACKEND_TESTS,
        ),
        _python_driver_step(
            "work_interaction_release_gates",
            "test-backend.py",
            args=WORK_INTERACTION_BACKEND_TESTS,
        ),
        _python_driver_step(
            "operator_surface_release_gates",
            "test-frontend.py",
            args=["--skip-build", *OPERATOR_SURFACE_FRONTEND_TESTS],
        ),
        _python_driver_step("backend_tests", "test-backend.py"),
        _python_driver_step("frontend_tests", "test-frontend.py"),
        _linux_shell_step("host_smoke", "host-smoke.sh"),
        _linux_shell_step("host_backup_restore_smoke", "host-backup-restore-smoke.sh"),
    ]

    report = _build_report(steps)
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"release_report={REPORT_PATH}")
    return 0 if report["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())

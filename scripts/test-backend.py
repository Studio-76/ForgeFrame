#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
DEFAULT_VENV_DIR = Path(tempfile.gettempdir()) / "forgeframe-backend-test-venv"
VENV_DIR = Path(os.environ.get("FORGEFRAME_BACKEND_TEST_VENV", str(DEFAULT_VENV_DIR)))


def _venv_python(venv_dir: Path) -> Path:
    if os.name == "nt":
        return venv_dir / "Scripts" / "python.exe"
    return venv_dir / "bin" / "python"


def _run(command: list[str], *, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=str(cwd) if cwd is not None else None,
        text=True,
        check=False,
    )


def backend_env_current() -> bool:
    venv_python = _venv_python(VENV_DIR)
    if not venv_python.exists():
        return False

    check_script = (
        "from importlib.util import find_spec\n"
        "from pathlib import Path\n"
        "import sys\n"
        "expected = Path(sys.argv[1]).resolve()\n"
        "spec = find_spec('app.main')\n"
        "if spec is None or spec.origin is None:\n"
        "    raise SystemExit(1)\n"
        "origin = Path(spec.origin).resolve()\n"
        "if expected not in origin.parents:\n"
        "    raise SystemExit(1)\n"
    )
    result = _run([str(venv_python), "-c", check_script, str(BACKEND_DIR)], cwd=ROOT_DIR)
    return result.returncode == 0


def refresh_backend_env() -> None:
    venv_python = _venv_python(VENV_DIR)
    if not venv_python.exists():
        subprocess.run([sys.executable, "-m", "venv", str(VENV_DIR)], check=True)
        venv_python = _venv_python(VENV_DIR)

    subprocess.run(
        [str(venv_python), "-m", "pip", "install", "-e", f"{BACKEND_DIR}[dev]"],
        check=True,
    )


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run ForgeFrame backend tests inside the managed backend test venv.")
    parser.add_argument(
        "pytest_args",
        nargs="*",
        help="Optional pytest selectors or arguments. Defaults to backend/tests when omitted.",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    if not backend_env_current():
        print(f"Refreshing backend test environment in {VENV_DIR}", file=sys.stderr)
        refresh_backend_env()

    if not backend_env_current():
        print(f"Backend test environment is still not aligned with {BACKEND_DIR}", file=sys.stderr)
        return 1

    venv_python = _venv_python(VENV_DIR)
    completed = subprocess.run(
        [str(venv_python), "-m", "pytest", *(args.pytest_args or ["backend/tests"])],
        cwd=str(ROOT_DIR),
        check=False,
    )
    return completed.returncode


if __name__ == "__main__":
    raise SystemExit(main())

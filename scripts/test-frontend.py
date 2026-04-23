#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
FRONTEND_DIR = ROOT_DIR / "frontend"


def _run(command: list[str]) -> int:
    completed = subprocess.run(command, cwd=str(FRONTEND_DIR), check=False)
    return completed.returncode


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run ForgeFrame frontend tests and build from a portable Python entrypoint.")
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="Run the selected frontend tests without executing the production build afterwards.",
    )
    parser.add_argument(
        "test_args",
        nargs="*",
        help="Optional frontend test selectors passed through to npm test.",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    if shutil.which("npm") is None:
        print("npm is required", file=sys.stderr)
        return 127

    if not (FRONTEND_DIR / "node_modules").exists():
        if _run(["npm", "ci"]) != 0:
            return 1

    test_command = ["npm", "run", "test"]
    if args.test_args:
        test_command.extend(["--", *args.test_args])
    if _run(test_command) != 0:
        return 1
    if args.skip_build:
        return 0
    return _run(["npm", "run", "build"])


if __name__ == "__main__":
    raise SystemExit(main())

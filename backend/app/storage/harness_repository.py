"""Storage abstraction for harness data to ease future DB migration."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class HarnessStoragePaths:
    profiles_path: Path
    runs_path: Path

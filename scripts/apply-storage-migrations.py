from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.settings.config import get_settings
from app.storage.migrator import apply_storage_migrations, storage_postgres_targets


def main() -> int:
    settings = get_settings()
    targets = storage_postgres_targets(settings)
    if not targets:
        print(json.dumps({"status": "skipped", "reason": "no_postgresql_storage_targets"}, indent=2))
        return 0

    try:
        reports = [apply_storage_migrations(target) for target in targets]
    except ValueError as exc:
        print(json.dumps({"status": "error", "reason": str(exc)}, indent=2), file=sys.stderr)
        return 1
    print(json.dumps({"status": "ok", "reports": reports}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

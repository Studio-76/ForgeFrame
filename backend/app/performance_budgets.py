"""Practical performance budgets for the ForgeFrame backend.

All thresholds are configurable at import time via optional environment
variables.  Defaults are based on the baseline measurements taken during
the backend hard-optimisation pass (May 2026, Python 3.14.4).

Measured baselines (2026-05-06):
  - App import time: ~3.1 s
  - App create (import + lifespan): ~4.2 s
  - RSS memory after startup: ~604 MB
  - Largest import contributors: providers.py (126 ms), security_admin (32 ms),
    routing (18 ms), skills (17 ms), notifications (16 ms)

Usage::

    from app.performance_budgets import (
        check_startup_budget,
        check_query_count_budget,
        BUDGETS,
    )

    # At CI time:
    budgets = BUDGETS
    assert check_startup_budget(startup_seconds), "Startup exceeds budget"
"""

from __future__ import annotations

import os
from typing import Any


def _env(key: str, default: float) -> float:
    raw = os.environ.get(f"FORGEFRAME_PERF_BUDGET_{key}")
    if raw is not None:
        try:
            return float(raw)
        except (ValueError, TypeError):
            pass
    return default


# ---------------------------------------------------------------------------
# Budget definitions — based on measured baselines with 20% headroom
# ---------------------------------------------------------------------------

BUDGETS: dict[str, dict[str, Any]] = {
    "startup": {
        "description": "App import + lifespan startup (seconds)",
        "p95": _env("STARTUP_P95", 5.0),
        "p99": _env("STARTUP_P99", 6.0),
        "unit": "seconds",
    },
    "import_time": {
        "description": "App module import time (seconds)",
        "p95": _env("IMPORT_P95", 4.0),
        "p99": _env("IMPORT_P99", 5.0),
        "unit": "seconds",
    },
    "memory": {
        "description": "RSS memory after startup (MB)",
        "p95": _env("MEMORY_P95", 700.0),
        "p99": _env("MEMORY_P99", 800.0),
        "unit": "MB",
    },
    "request_latency": {
        "description": "Request latency for critical endpoints (milliseconds)",
        "p95": _env("REQUEST_P95", 500.0),
        "p99": _env("REQUEST_P99", 2000.0),
        "unit": "ms",
    },
    "query_count": {
        "description": "SQL queries per critical endpoint",
        "per_endpoint": _env("QUERY_COUNT_PER_ENDPOINT", 25),
        "unit": "queries",
    },
    "slow_query": {
        "description": "Slow SQL query threshold (milliseconds)",
        "threshold_ms": _env("SLOW_QUERY_THRESHOLD", 100.0),
        "unit": "ms",
    },
    "serialization": {
        "description": "Pydantic model_dump serialization time for large responses (milliseconds)",
        "p95": _env("SERIALIZATION_P95", 50.0),
        "p99": _env("SERIALIZATION_P99", 200.0),
        "unit": "ms",
    },
    "state_machine": {
        "description": "State-machine validator construction + validation (milliseconds)",
        "p95": _env("STATE_MACHINE_P95", 5.0),
        "p99": _env("STATE_MACHINE_P99", 20.0),
        "unit": "ms",
    },
}


def check_startup_budget(startup_seconds: float) -> bool:
    """Check startup time against the p99 budget.

    :param startup_seconds: Measured startup time in seconds.
    :returns: True when within budget.
    """
    budget = BUDGETS["startup"]["p99"]
    return startup_seconds <= budget


def check_import_time_budget(import_seconds: float) -> bool:
    """Check module import time against the p99 budget.

    :param import_seconds: Measured import time in seconds.
    :returns: True when within budget.
    """
    budget = BUDGETS["import_time"]["p99"]
    return import_seconds <= budget


def check_memory_budget(memory_mb: float) -> bool:
    """Check memory usage against the p99 budget.

    :param memory_mb: Measured RSS memory in MB.
    :returns: True when within budget.
    """
    budget = BUDGETS["memory"]["p99"]
    return memory_mb <= budget


def check_query_count_budget(query_count: int) -> bool:
    """Check per-endpoint query count against the per-endpoint budget.

    :param query_count: Measured SQL query count for one endpoint.
    :returns: True when within budget.
    """
    budget = int(BUDGETS["query_count"]["per_endpoint"])
    return query_count <= budget


def budget_summary() -> str:
    """Return a human-readable markdown summary of all budgets."""
    lines = ["## Performance Budgets\\n", "| Budget | Description | p95 | p99 | Unit |\\n", "|-------|-------------|-----|-----|------|\\n"]
    for key, cfg in BUDGETS.items():
        p95 = cfg.get("p95", "—")
        p99 = cfg.get("p99", "—")
        unit = cfg["unit"]
        lines.append(f"| {key} | {cfg['description']} | {p95} | {p99} | {unit} |\\n")
    lines.append("\\n*Set via `FORGEFRAME_PERF_BUDGET_<KEY>=<value>` env vars.*\\n")
    return "".join(lines)


def check_all_budgets(
    startup_s: float,
    import_s: float,
    memory_mb: float,
) -> dict[str, bool]:
    """Run all applicable budget checks and return results.

    :param startup_s: Measured app create time in seconds.
    :param import_s: Measured import time in seconds.
    :param memory_mb: Measured RSS memory in MB.
    :returns: Mapping of check name to pass/fail.
    """
    return {
        "startup": check_startup_budget(startup_s),
        "import_time": check_import_time_budget(import_s),
        "memory": check_memory_budget(memory_mb),
    }

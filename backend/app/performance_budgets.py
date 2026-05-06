"""Practical performance budgets for the ForgeFrame backend.

All thresholds are configurable at import time via optional environment
variables.  Defaults are based on the baseline measurements taken during
the backend hard-optimisation pass (May 2026).

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
# Budget definitions
# ---------------------------------------------------------------------------

BUDGETS: dict[str, dict[str, Any]] = {
    "startup": {
        "description": "App import + lifespan startup (seconds)",
        "p95": _env("STARTUP_P95", 4.0),
        "p99": _env("STARTUP_P99", 5.0),
        "unit": "seconds",
    },
    "memory": {
        "description": "RSS memory after startup (MB)",
        "p95": _env("MEMORY_P95", 120.0),
        "p99": _env("MEMORY_P99", 150.0),
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
        "per_endpoint": _env("QUERY_COUNT_PER_ENDPOINT", 20),
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

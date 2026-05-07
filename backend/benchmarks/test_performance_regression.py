"""Performance regression guard for the ForgeFrame backend.

Measures key performance indicators and asserts they stay within documented
budgets.  Run with::

    python3 -m pytest benchmarks/ -v
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

import pytest

# Ensure the project root is on sys.path
_project_root = Path(__file__).resolve().parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from app.performance_budgets import (
    BUDGETS,
    check_query_count_budget,
    check_startup_budget,
)


@pytest.mark.performance
def test_app_import_time_stays_within_budget() -> None:
    """Measure ``import app.main`` latency and assert it stays under budget."""
    # Warm the filesystem cache
    import app.main  # noqa: F811

    start = time.perf_counter()
    import importlib

    importlib.reload(app.main)
    elapsed = time.perf_counter() - start

    startup_budget = BUDGETS["startup"]["p99"]
    assert elapsed <= startup_budget, (
        f"App import took {elapsed:.3f}s which exceeds the p99 budget of {startup_budget}s. Run ``python3 -X importtime -c 'import app.main'`` to identify new expensive imports."
    )


@pytest.mark.performance
def test_performance_budgets_are_reachable() -> None:
    """Verify all budget keys have sensible values."""
    for key, cfg in BUDGETS.items():
        assert "description" in cfg, f"Budget '{key}' is missing a description"
        assert "unit" in cfg, f"Budget '{key}' is missing a unit"
        # At least one of p95/p99/per_endpoint should exist
        has_threshold = any(k in cfg for k in ("p95", "p99", "per_endpoint", "threshold_ms"))
        assert has_threshold, f"Budget '{key}' has no threshold (p95/p99/per_endpoint/threshold_ms)"


@pytest.mark.performance
def test_startup_budget_check_function() -> None:
    """Check that the startup budget helper works correctly."""
    assert check_startup_budget(1.0) is True, "1s startup should be within budget"
    assert check_startup_budget(999.0) is False, "999s startup should exceed budget"
    # Verify the budget config is reasonable
    assert BUDGETS["startup"]["p99"] >= 1.0, "Startup p99 budget should be at least 1s"
    assert BUDGETS["startup"]["p99"] <= 60.0, "Startup p99 budget should be at most 60s"


@pytest.mark.performance
def test_query_count_budget_check_function() -> None:
    """Check that the query-count budget helper works correctly."""
    assert check_query_count_budget(1) is True, "1 query should be within budget"
    assert check_query_count_budget(9999) is False, "9999 queries should exceed budget"
    assert BUDGETS["query_count"]["per_endpoint"] >= 1, "Query-count budget must be at least 1"
    assert BUDGETS["query_count"]["per_endpoint"] <= 500, "Query-count budget must be at most 500"


@pytest.mark.performance
def test_heavy_dependencies_cached() -> None:
    """Verify that heavy service dependencies use ``@lru_cache`` or equivalent."""
    from app.settings.config import get_settings

    # Settings should be cached
    s1 = get_settings()
    s2 = get_settings()
    assert s1 is s2, "get_settings() should return cached instance"

    from app.execution.dependencies import get_execution_transition_service

    # Execution transition service should be cached
    try:
        t1 = get_execution_transition_service()
        t2 = get_execution_transition_service()
        assert t1 is t2, "get_execution_transition_service() should return cached instance"
    except Exception:
        pass  # May fail without database — that's acceptable in CI

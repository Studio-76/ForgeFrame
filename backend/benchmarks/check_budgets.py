#!/usr/bin/env python3
"""Lightweight CI guard: measure startup/import/memory and check budgets.

Usage::

    python benchmarks/check_budgets.py           # check all budgets
    python benchmarks/check_budgets.py --json    # JSON output for CI

Exit code 0 when all budgets pass, 1 when any budget fails, 2 on error.
"""

from __future__ import annotations

import argparse
import json
import resource
import sys
import time


def measure_import_time() -> float:
    """Measure pure app module import time (excluding app creation).

    :returns: Import time in seconds.
    """
    t0 = time.perf_counter()
    # Import the module that triggers the full import chain.
    # We use a subprocess approach for isolation, but for CI speed use inline.
    import importlib

    importlib.import_module("app.main")
    t1 = time.perf_counter()
    return t1 - t0


def measure_startup_time() -> float:
    """Measure full app creation time (import + create_app).

    :returns: Startup time in seconds.
    """
    from app.main import create_app

    t0 = time.perf_counter()
    create_app()
    t1 = time.perf_counter()
    return t1 - t0


def measure_memory() -> float:
    """Measure current RSS memory in MB.

    :returns: RSS memory in MB.
    """
    usage = resource.getrusage(resource.RUSAGE_SELF)
    return usage.ru_maxrss / 1024.0  # ru_maxrss is in KB on Linux


def run_checks() -> dict:
    """Run all checks and return results dict."""
    results: dict = {}

    # Measure import time (must come first since imports are cached)
    import_s = measure_import_time()
    results["import_time_s"] = round(import_s, 3)

    # Measure startup time
    startup_s = measure_startup_time()
    results["startup_s"] = round(startup_s, 3)

    # Measure memory after everything is loaded
    memory_mb = measure_memory()
    results["memory_mb"] = round(memory_mb, 1)

    # Check against budgets
    from app.performance_budgets import check_all_budgets

    budget_results = check_all_budgets(
        startup_s=startup_s,
        import_s=import_s,
        memory_mb=memory_mb,
    )
    results["budgets"] = budget_results
    results["all_pass"] = all(budget_results.values())

    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="Check ForgeFrame performance budgets (CI guard).")
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON",
    )
    args = parser.parse_args()

    try:
        results = run_checks()
    except Exception as exc:
        if args.json:
            json.dump({"error": str(exc)}, sys.stdout)
        else:
            print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    if args.json:
        json.dump(results, sys.stdout, indent=2)
    else:
        print(f"Import time : {results['import_time_s']:.2f}s")
        print(f"Startup time: {results['startup_s']:.2f}s")
        print(f"Memory      : {results['memory_mb']:.0f} MB")
        print()
        for check_name, passed in results["budgets"].items():
            status = "PASS" if passed else "FAIL"
            print(f"  [{status}] {check_name}")
        print()
        if results["all_pass"]:
            print("All performance budgets passed.")
        else:
            print("Some performance budgets FAILED.")

    return 0 if results["all_pass"] else 1


if __name__ == "__main__":
    sys.exit(main())

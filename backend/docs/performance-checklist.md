# Backend Performance Checklist

Use this checklist when reviewing or contributing performance-sensitive
changes to the ForgeFrame backend.

## Before Merging

- [ ] **Import time** — Does the change add new top-level imports? Check
      ``python3 -X importtime -c "import app.main" 2>&1 | tail -5``.  If the
      cumulative import time increases by more than 50ms, consider lazy imports.
- [ ] **Startup time** — Does the change add work to ``create_app()`` or
      the lifespan hook?  Measure with ``time python3 -c "import app.main"``.
- [ ] **Per-request allocations** — Does the change allocate objects inside a
      route handler or dependency that could be created once and reused?
      Watch for repeated ``Machine`` construction, ``SessionFactory`` creation,
      or heavy ``BaseModel`` construction.
- [ ] **N+1 queries** — Does the change loop over ORM results and access
      relationships or joined data?  Load everything in one query.
- [ ] **Query count** — Is the new endpoint making more than 15 SQL queries
      per request?  Consider eager-loading or batch queries.
- [ ] **Slow queries** — Are any queries not using an index?  Check
      ``EXPLAIN ANALYZE`` on hot WHERE / JOIN / ORDER BY clauses.
- [ ] **Serialisation** — Does the change call ``model_dump(mode="json")``
      on a deeply nested model inside a list comprehension?  Consider
      serialising once to ``dict`` and reusing, or using ``model_dump`` with
      ``exclude`` / ``include`` to skip unused fields.
- [ ] **Async blocking** — Does the change add a synchronous ``time.sleep()``,
      blocking I/O, or CPU-bound work in an ``async def`` route?  Move it to
      ``run_in_executor`` or a background task.
- [ ] **Middleware** — Is the new middleware running on every request?
      Verify it is not doing expensive work on lightweight routes (health
      checks, static files).
- [ ] **Logging** — Are ``f"..."`` strings or ``json.dumps()`` used in logging
      statements that run on hot paths?  Use ``%s``-style lazy formatting.
- [ ] **State machine** — Is ``ExecutionStateMachineValidator`` being
      constructed more than once per request?  It uses per-thread caching
      via ``threading.local()`` — verify the cache is hit.
- [ ] **Connection pool** — Are you adding a new ``create_engine()`` call?
      Configure ``pool_size``, ``max_overflow``, and ``pool_recycle``
      appropriately.  Each engine adds up to 15 concurrent connections.

## Budgets (configurable via ``FORGEFRAME_PERF_BUDGET_*``)

| Metric | p99 Budget | How to Measure |
|--------|-----------|----------------|
| App import + startup | 5 s | ``time python3 -c "import app.main"`` |
| RSS memory after startup | 150 MB | ``python3 -c "import os,app.main; print(open(f'/proc/{os.getpid()}/status').read().split('VmRSS:')[1].split()[0])"`` |
| Request p99 latency | 2000 ms | ``python3 -m pytest benchmarks/ -k perf -v`` |
| Query count / endpoint | 20 | Add ``sqlalchemy.engine`` logging at INFO |
| Slow query threshold | 100 ms | Add SQL timing listener |
| State-machine validation | 20 ms | Internal timer in ``check_transition_allowed`` |
| Response serialisation | 200 ms | Profile ``model_dump(mode="json")`` on large collections |

## Severity Guide

- **Critical** — Import time > 10 s, per-request query count > 100,
      memory > 500 MB, any N+1 in a hot path.
- **Warning** — Import time > 6 s, per-request query count > 30,
      slow queries > 200 ms, serialisation > 500 ms.
- **Notice** — Marginal increases within budget that affect cold-start
      latency but not steady-state throughput.

## Running the Guard

```bash
python3 -m pytest benchmarks/ -v
```

The CI guard runs on every PR and fails when budgets are exceeded.
Set custom budgets via:

```bash
export FORGEFRAME_PERF_BUDGET_STARTUP_P95=3.0
python3 -m pytest benchmarks/ -v
```

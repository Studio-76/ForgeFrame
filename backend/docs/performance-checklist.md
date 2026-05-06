# Backend Performance Checklist (PR Review)

Before merging backend changes, verify:

## Import / Startup
- [ ] Import time does not regress (check `python -X importtime -c "from app.main import create_app"`)
- [ ] New module imports are deferred to function scope when possible
- [ ] No heavy work (DB queries, network calls, file I/O) happens at import time

## Database
- [ ] New endpoints do not introduce N+1 query patterns
- [ ] Eager loading (`joinedload`, `selectinload`) used only when related data is actually needed
- [ ] Projection queries used where full ORM objects are unnecessary
- [ ] Connection pool settings remain appropriate for expected load
- [ ] Sessions are properly closed (context managers or `finally` blocks)

## Pydantic
- [ ] Response models defined with `response_model` for OpenAPI schema generation and validation
- [ ] `TypeAdapter` reused for repeated validation of the same schema
- [ ] Expensive computed fields (`@computed_field`) have `@cached_property` or precomputation
- [ ] Nested model serialization is not deeper than necessary

## Async
- [ ] Async routes (`async def`) contain no blocking I/O (sync DB, file, network, CPU-heavy ops)
- [ ] Blocking work uses `run_in_executor` or is moved to background tasks
- [ ] No unbounded concurrency (task/thread spawning without limits)
- [ ] Background tasks do not starve request handlers

## State Machine
- [ ] No rebuilding of `transitions.Machine` instances per request (use per-thread cache)
- [ ] Guards contain no database or network calls
- [ ] Transition semantics unchanged by optimization

## Logging / Observability
- [ ] Debug/trace logs guarded by level check (`if logger.isEnabledFor(...)`)
- [ ] No large payload logging on hot paths
- [ ] Diagnostic/snapshot/evidence payloads built only when requested
- [ ] Structured log fields use lazy interpolation

## Performance Budgets
- [ ] Run `python benchmarks/check_budgets.py` and confirm budgets pass
- [ ] If budget increase is needed, document the reason in the PR

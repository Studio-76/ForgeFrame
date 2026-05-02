# ForgeFrame Backend State Machine Plan

**Status:** Phase plan for task execution  
**Spec:** `reference/state-machine/SPEC_State-Machine.md`  
**Evaluation:** `reference/state-machine/EVA_STATE_MACHINE.md`  

---

## 1. Objective

Introduce a formal `pytransitions/transitions` state-machine layer for the ForgeFrame backend execution lifecycle without changing external API behavior or persistence schema during the first phase.

The plan is intentionally incremental:

1. define and test the machine in isolation,
2. run it beside the existing `ExecutionTransitionService`,
3. retire ad-hoc guards only after evidence shows equivalence.

---

## 2. Phase Overview

| Phase | Name | Outcome | Stop/Go Gate |
|---|---|---|---|
| 1a | Standalone execution machine | Dependency, machine module, tests, diagram | Standalone tests and execution smoke regressions pass. |
| 1b | Parallel validation | Existing service logs machine mismatches without behavior changes | One sprint or agreed validation window with no unresolved mismatches. |
| 1c | Delegation/swap-over | Service delegates transition authority to machine | Product/engineering accepts validation evidence. |
| 2 | Evaluation | Decide whether to expand, stop, or refine | Written evaluation references logs, bugs caught, test impact, DX. |
| 3 | Optional tasks notification machine | Only if Phase 2 approves expansion | Separate spec update required. |

---

## 3. Phase 1a: Standalone Execution Machine

### Goals

- Add `transitions` as a backend dependency.
- Create `backend/app/execution/state_machine.py`.
- Encode existing run/operator/attempt state lists from `models.py`.
- Encode explicit transition tables for the core execution paths.
- Add standalone tests for valid transitions, invalid transitions, and guards.
- Produce a diagram artifact under `reference/state-machine/`.

### Implementation notes

- Prefer a small adapter model instead of attaching a machine directly to ORM objects in first pass.
- Keep callbacks side-effect free in Phase 1a.
- Keep transition tables as constants that tests can inspect.
- Use named exports only.
- Add Sphinx-style docstrings to public Python classes/functions.
- Keep line length aligned with backend Ruff configuration where practical.

### Candidate module shape

```text
backend/app/execution/state_machine.py
├── ExecutionTransitionName = Literal[...] or StrEnum-compatible constants
├── RUN_STATE_MACHINE_STATES
├── RUN_OPERATOR_STATE_MACHINE_STATES
├── RUN_STATE_TRANSITIONS
├── RUN_OPERATOR_STATE_TRANSITIONS
├── ExecutionTransitionContext
├── ExecutionStateSnapshot
├── ExecutionStateDecision
├── ExecutionStateMachine
└── build_execution_state_diagram()
```

Use the simplest structure that satisfies the spec. Do not over-abstract before tests reveal repetition.

### Verification

```bash
cd backend
.venv/bin/python -m pytest tests/test_execution_state_machine.py -v
.venv/bin/python -m pytest tests/test_execution_models.py tests/test_execution_transitions.py -v
```

---

## 4. Phase 1b: Parallel Validation

### Goals

- Integrate the state machine into `ExecutionTransitionService` as non-authoritative validation.
- Preserve existing service behavior as the source of truth.
- Log mismatches with enough context for follow-up fixes.
- Extend tests to prove validation does not alter existing outcomes.

### Integration pattern

1. Existing service method loads run/attempt and performs current checks.
2. State-machine validator receives a snapshot of pre-transition state and proposed operation context.
3. Existing service computes and applies its current transition.
4. Validator compares expected destination with actual destination.
5. Mismatches emit structured warnings; they do not fail the command in Phase 1b.

### Initial service methods to validate

Start with high-value, lower-risk methods:

1. `claim_next_attempt`
2. `mark_attempt_executing`
3. `request_cancel`
4. `complete_attempt_success`
5. `record_attempt_failure`

Defer approval, quarantine, and restart paths until the first five paths are stable.

### Verification

```bash
cd backend
.venv/bin/python -m pytest tests/test_execution_state_machine.py tests/test_execution_transitions.py -v
.venv/bin/python -m pytest tests/test_execution_background_worker.py tests/test_execution_admin_api.py -v
```

---

## 5. Phase 1c: Swap-Over

### Entry criteria

- Phase 1b validation window completed.
- Mismatch logs reviewed and either resolved or explicitly accepted.
- Full backend test suite passes.
- The transition table matches all known service outcomes.

### Goals

- Make the state machine authoritative for selected transitions.
- Replace duplicated ad-hoc guard membership checks where the state machine now owns the rule.
- Keep service methods responsible for persistence, idempotency, outbox, timestamps, and versioning.

### Non-goals

- Do not collapse service methods into one generic transition endpoint.
- Do not remove domain-specific error messages that API callers rely on.
- Do not expand to non-execution modules in the same task.

### Verification

```bash
cd backend
.venv/bin/python -m pytest -v
```

---

## 6. Phase 2: Evaluation

Create a short evaluation document after Phase 1c or after the agreed validation window if the swap-over is deferred.

Required evidence:

- number and type of mismatches found,
- bugs prevented or clarified,
- test additions/removals,
- developer experience notes,
- performance or latency observations if available,
- recommendation: expand, stop, or refine.

Expansion to `tasks/` notifications requires a separate task and a spec update.

---

## 7. Risk Register

| Risk | Mitigation |
|---|---|
| ORM state desync | Phase 1a is side-effect free; Phase 1b compares after existing service outcomes. |
| Callback side effects reorder transactions | No persistence side effects in callbacks during Phase 1. |
| Async behavior changes service semantics | Start with synchronous `Machine`; only adopt `AsyncMachine` with concrete need and tests. |
| HSM complexity hides orthogonal-state bugs | Keep run and operator dimensions separate in Phase 1. |
| Queued transitions mask failures | Do not use `queued=True` unless callbacks fire triggers; document if enabled. |
| Dependency drift | Pin a bounded dependency range in `backend/pyproject.toml`. |
| Diagram tooling pulls system dependencies into runtime | Treat diagrams as docs/dev tooling only. |

---

## 8. Task Creation Rules

When creating implementation tasks from this plan:

- Use title format `ForgeFrame: <short title>`.
- Each task must reference this plan and the spec.
- Each task must define exact files to create or modify.
- Each task must include verification commands.
- Each task must be small enough to complete and commit independently.
- AGENTS.md may be updated with durable project facts but must not be committed.

---

## 9. First Phase Task Set

The first phase should be split into these tasks:

1. `ForgeFrame: Add transitions dependency and execution machine skeleton`
2. `ForgeFrame: Encode execution run and operator transition tables`
3. `ForgeFrame: Add execution state machine tests and diagram artifact`
4. `ForgeFrame: Add non-authoritative execution transition validation`
5. `ForgeFrame: Review Phase 1 validation evidence and prepare swap-over tasks`

The task template in `reference/state-machine/TASK-TEMPLATE_State-Machine.md` must be used for subsequent phase task creation.

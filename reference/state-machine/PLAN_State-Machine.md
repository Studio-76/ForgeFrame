# ForgeFrame Backend State Machine Plan

**Status:** Phase plan for task execution
**Spec:** `reference/state-machine/SPEC_State-Machine.md`
**Evaluation:** `reference/state-machine/EVA_STATE_MACHINE.md`
**Backend audit:** Service/storage/admin/worker/tests re-read on 2026-05-03

---

## 1. Objective

Introduce a formal `pytransitions/transitions` state-machine validation layer for the ForgeFrame backend execution lifecycle without changing external API behavior or persistence schema during the first phase.

If `EVA_STATE_MACHINE.md` conflicts with this plan or `SPEC_State-Machine.md`, the spec and this plan are authoritative for implementation.

The plan is intentionally incremental:

1. define and test side-effect-free transition/coordination/attempt contracts in isolation,
2. run feature-flagged validation beside the existing `ExecutionTransitionService`,
3. review mismatch evidence and fix or accept compatibility gaps,
4. delegate authority only after the validation window proves the machine matches the intended service contract.

---

## 2. Phase Overview

| Phase | Name | Outcome | Stop/Go Gate |
|---|---|---|---|
| 1a | Standalone execution validator | Dependency, runtime flag, machine module, transition/effect constants, tests, Mermaid diagram | Standalone tests and execution smoke regressions pass. |
| 1b | Feature-flagged parallel validation | Existing service logs machine mismatches without behavior changes | Agreed validation window with no unresolved critical mismatches and acceptable overhead. |
| 1c | Delegation/swap-over | Service delegates selected transition authority to machine | Product/engineering accepts validation evidence and compatibility-gap decisions. |
| 2 | Evaluation | Decide whether to expand, stop, or refine | Written evaluation references logs, bugs caught, test impact, DX, and performance. |
| 3 | Optional tasks notification machine | Only if Phase 2 approves expansion | Separate spec update required. |

---

## 3. Phase 1a: Standalone Execution Validator

### Goals

- Add `transitions` as a backend dependency with a bounded range.
- Add a safe runtime validation setting (`FORGEFRAME_EXECUTION_STATE_MACHINE_VALIDATION_ENABLED`).
- Create `backend/app/execution/state_machine.py`.
- Encode existing run/operator/attempt state lists from `models.py`.
- Encode explicit run-state transition tables for SPEC §7.1.
- Encode explicit operator-state-only transition tables for SPEC §7.2.
- Encode trigger-aware run/operator target constants from SPEC §6.5.
- Encode mandatory attempt-effect constants from SPEC §6.4.
- Add creation validators for `admit_create` and `restart_run_from_scratch`.
- Add non-state-operation validators for `renew_attempt_lease` and `escalate_run`.
- Add standalone tests for valid transitions, invalid transitions, guards, attempt effects, creation validation, non-state-operation validation, feature-flag behavior, and diagram generation.
- Produce a Mermaid diagram artifact under `reference/state-machine/`.

### Implementation notes

- Prefer a small private adapter model instead of attaching a machine directly to ORM objects.
- Use two separate `Machine` instances or factories on the same adapter model:
  - run-state validation uses `model_attribute="run_state"`,
  - operator-state-only validation uses `model_attribute="operator_state"`.
- Do not model `admit_create` as a run transition. It is an initialization validator.
- Do not model `restart_run_from_scratch` as a transition on the source run. Validate source state dimensions are unchanged and the new run starts correctly.
- Keep callbacks side-effect free in Phase 1a.
- Keep transition tables, target maps, attempt effects, and declared-but-unreached states as constants that tests can inspect.
- Include guard-level diagnostic output in validation result types.
- Use named exports only.
- Add Sphinx-style docstrings to public Python classes/functions.
- Keep line length aligned with backend Ruff configuration where practical.
- Do not import diagram extensions from request-time service code.

### Candidate module shape

```text
backend/app/execution/state_machine.py
├── ExecutionTrigger = Literal[...] — triggers from SPEC §7.1–§7.2
├── ExecutionCreationOperation = Literal["admit_create", "restart_run_from_scratch"]
├── RUN_STATE_MACHINE_STATES — from RUN_STATES
├── OPERATOR_STATE_MACHINE_STATES — from RUN_OPERATOR_STATES
├── DECLARED_UNREACHED_RUN_STATES — {"cancelled", "compensated"}
├── RUN_STATE_TRANSITIONS — triggers from SPEC §7.1
├── OPERATOR_STATE_TRANSITIONS — pause/resume from SPEC §7.2
├── RUN_OPERATOR_TARGETS_BY_TRIGGER — trigger-aware map from SPEC §6.5
├── RUN_TO_OPERATOR_RESUME_MAP — resume helper compatibility map
├── ATTEMPT_EFFECTS_BY_TRIGGER — required effects from SPEC §6.4
├── ExecutionTransitionContext — guard context dataclass (SPEC §8.1)
├── ExecutionStateSnapshot — pre-transition persisted state snapshot
├── ExecutionStateDecision — expected run/operator/attempt/lease destinations
├── ExecutionValidationResult — decision + guard results + mismatch category + validation error
├── ExecutionStateMachineValidator — side-effect-free public validator wrapper
│   ├── _run_machine: Machine      # model_attribute="run_state"
│   └── _operator_machine: Machine  # model_attribute="operator_state"
└── build_execution_state_diagram() — Mermaid export from transition/effect constants
```

### Verification

```bash
cd backend
.venv/bin/python -m pytest tests/test_execution_state_machine.py -v
.venv/bin/python -m pytest tests/test_execution_models.py tests/test_execution_transitions.py -v
```

---

## 4. Phase 1b: Feature-Flagged Parallel Validation

### Goals

- Integrate the validator into `ExecutionTransitionService` as non-authoritative validation.
- Keep validation disabled unless the runtime flag enables it.
- Preserve existing service behavior as the source of truth.
- Log mismatches and validator exceptions with enough context for follow-up fixes.
- Extend tests to prove validation does not alter successful outcomes, conflict outcomes, idempotent replays, or batch reconciliation behavior.

### Global integration pattern

1. Check the runtime validation flag. If disabled, do nothing.
2. Capture a pre-transition `ExecutionStateSnapshot` before the existing service mutates state.
3. Execute the existing service logic unchanged.
4. Build the actual service outcome from mutated ORM state or command result snapshot.
5. Invoke the validator inside a broad exception-safety wrapper.
6. Log mismatches or validator exceptions as structured non-fatal events.
7. Return the existing service result unchanged.

### Idempotency and conflict rules

- If `_find_command_or_raise_conflict` returns an existing command, do not fire a fresh transition validation.
- If an insert-race recovery returns an existing completed command, do not fire a fresh transition validation.
- If the existing service raises a business conflict before mutation, preserve the exception. Optional validation of rejected paths belongs in standalone state-machine tests, not production Phase 1b request handling.
- Fingerprint conflicts remain authoritative idempotency errors and are not machine mismatches.

### Initial service methods to validate

Integrate in waves to preserve reviewability and isolate failure modes.

**Wave 1 — worker hot path and common commands**

1. `claim_next_attempt` / `claim_attempt`
2. `mark_attempt_executing`
3. `complete_attempt_success`
4. `record_attempt_failure`
5. `request_cancel`

**Wave 2 — approval, quarantine, interrupt, reconciliation**

6. `open_approval`
7. `decide_approval`
8. `interrupt_run`
9. `quarantine_run`
10. `reconcile_expired_leases` — validate per eligible attempt, not per batch

**Wave 3 — operator-state-only, retry/restart/create, non-state operations**

11. `pause_run` — operator-state machine only; run state must remain unchanged
12. `resume_run` — operator-state machine only; validate resume target and fallback behavior
13. `admit_retry`
14. `admit_create` — creation validator only
15. `restart_run_from_scratch` — creation validator for new run and no-transition validator for source run
16. `renew_attempt_lease` — non-state-operation validator
17. `escalate_run` — non-state-operation validator

### Integration pattern for run-state triggers

For SPEC §7.1 triggers:

1. Capture run, current attempt, lease, approval, and command context before mutation.
2. Existing service performs current checks and state mutation.
3. Validator fires the run-state trigger against the pre-state snapshot.
4. Validator compares expected run/operator/attempt/lease destinations with actual service destinations.
5. Mismatches include whether the source was stricter than the current service authority (SPEC §5 compatibility finding).

### Integration pattern for operator-state-only triggers

For `pause_run` and `resume_run`:

1. Existing service loads run/attempt and performs current checks.
2. Validator receives the pre-transition snapshot.
3. The operator-state machine is consulted; the run-state machine is not.
4. Existing service computes and applies the operator-state change.
5. Validator compares expected target operator state with actual service outcome.
6. Validator confirms `run.state` and `attempt.attempt_state` were preserved.

### Integration pattern for creation validators

For `admit_create`:

1. Existing service creates command, run, attempt, and outbox.
2. Validator checks initial run/operator/attempt/lease state and command snapshot.
3. No run-state machine trigger fires.

For `restart_run_from_scratch`:

1. Capture the source run/attempt state dimensions before mutation.
2. Existing service creates the new run/attempt/outbox and updates source metadata.
3. Validator checks the new run/attempt initialization.
4. Validator checks the source run did not transition state/operator/current-attempt dimensions.

### Integration pattern for reconciliation batch

For `reconcile_expired_leases`:

1. Service queries all expired in-flight leased attempts.
2. For each eligible attempt+run pair, capture a snapshot before mutation.
3. Each validation invocation uses an independent adapter/model.
4. Mismatches are logged per attempt with the specific `attempt_id`.
5. The batch result remains the existing `LeaseReconcileResult` list.

### Phase 1b verification

```bash
cd backend
.venv/bin/python -m pytest tests/test_execution_state_machine.py tests/test_execution_transitions.py tests/test_execution_operator_fabric.py -v
.venv/bin/python -m pytest tests/test_execution_background_worker.py tests/test_execution_admin_api.py tests/test_execution_queue_dispatch_api.py -v
```

---

## 5. Phase 1c: Swap-Over

### Entry criteria

- Phase 1b validation window completed.
- Mismatch logs reviewed and either resolved or explicitly accepted.
- Each compatibility finding from SPEC §5 has a written decision.
- Full backend test suite passes.
- The transition/effect tables match all accepted service outcomes.
- Performance evidence shows validation overhead is acceptable or optimized.

### Goals

- Make the state machine authoritative for selected transitions.
- Replace duplicated ad-hoc guard membership checks where the state machine now owns the rule.
- Keep service methods responsible for persistence, idempotency, outbox, timestamps, leases, approvals, worker heartbeats, and response snapshots.

### Non-goals

- Do not collapse service methods into one generic transition endpoint.
- Do not remove domain-specific error messages that API callers rely on.
- Do not expand to non-execution modules in the same task.
- Do not simultaneously fix unrelated execution bugs unless they are explicit blockers for authority transfer.

### Verification

```bash
cd backend
.venv/bin/python -m pytest -v
```

---

## 6. Phase 2: Evaluation

Create a short evaluation document after Phase 1c or after the agreed validation window if swap-over is deferred.

Required evidence:

- number and type of mismatches found,
- compatibility findings accepted vs fixed,
- bugs prevented or clarified,
- test additions/removals,
- developer experience notes,
- performance/latency observations,
- recommendation: expand, stop, or refine.

Expansion to `tasks/` notifications requires a separate task and a spec update.

---

## 7. Risk Register

| Risk | Mitigation |
|---|---|
| Machine table is stricter than current service behavior | Phase 1b logs source-authority gaps separately; Phase 1c requires explicit decisions. |
| Validator accidentally changes behavior | Feature flag, no-op disabled path, exception safety wrapper, and tests for unchanged outcomes. |
| ORM state desync | Phase 1a is side-effect free; Phase 1b compares after existing service outcomes. |
| Callback side effects reorder transactions | No persistence side effects in callbacks during Phase 1. |
| Async behavior changes service semantics | Start with synchronous `Machine`; only adopt `AsyncMachine` with concrete need and tests. |
| HSM complexity hides orthogonal-state bugs | Keep run and operator dimensions in separate flat `Machine` instances with distinct `model_attribute` values. |
| Attempt-state bugs remain invisible | Encode mandatory attempt effects and log attempt/replacement mismatches. |
| Approval link lifecycle remains stale | Log closed-current/open-cancel approval consistency warnings; require Phase 1c decision. |
| Operator-state-only triggers produce false run-state mismatches | Use the operator-state machine for `pause`/`resume` and assert run state is unchanged. |
| Batch reconciliation state leaks across iterations | Each loop iteration uses independent adapter state; tests validate per-attempt isolation. |
| Validator construction hurts worker hot-path performance | Runtime flag, no diagram imports, benchmark evidence, and model-reuse rules. |
| Shared machine/adapter causes cross-request state bleed | Do not share mutable adapters; remove temporary models in `finally` if using long-lived machines. |
| Queued transitions mask failures | Do not use `queued=True` unless callbacks fire triggers; document if enabled. |
| Dependency drift | Pin a bounded dependency range in `backend/pyproject.toml`. |
| Diagram tooling pulls system dependencies into runtime | Use Mermaid-first export; keep graph imports out of service paths. |

---

## 8. Task Creation Rules

When creating implementation tasks from this plan:

- Use title format `ForgeFrame StateMachine: <phase>-<task_number> <title>` (e.g., `ForgeFrame StateMachine: 1a-01 Add transitions dependency and validation flag`).
- Each task must reference this plan and the spec.
- Each task must define exact files to create or modify.
- Each task must include verification commands.
- Each task must be small enough to complete and commit independently when a commit is explicitly requested.
- AGENTS.md may be updated with durable project facts but must not be committed.

---

## 9. First Phase Task Set

The first phase should be split into these tasks:

1. `ForgeFrame StateMachine: 1a-01 Add transitions dependency and validation runtime flag`
2. `ForgeFrame StateMachine: 1a-02 Add execution state-machine validator skeleton`
3. `ForgeFrame StateMachine: 1a-03 Encode run/operator transition tables and trigger-aware coordination`
4. `ForgeFrame StateMachine: 1a-04 Encode attempt effects, creation validators, and non-state validators`
5. `ForgeFrame StateMachine: 1a-05 Add standalone tests and Mermaid diagram artifact`
6. `ForgeFrame StateMachine: 1b-01 Wire feature-flagged validation for worker hot-path wave`
7. `ForgeFrame StateMachine: 1b-02 Wire validation for approval, interrupt, quarantine, and reconciliation wave`
8. `ForgeFrame StateMachine: 1b-03 Wire validation for operator-only, create/retry/restart, and non-state operations`
9. `ForgeFrame StateMachine: 1b-04 Review Phase 1 validation evidence and prepare swap-over decisions`

Task 3 must include trigger-aware operator targets instead of a single run-to-operator map. Task 4 must include retry source-attempt vs replacement-attempt behavior. Task 5 must cover feature flag, validator exception safety, idempotent replay, creation validation, operator-only triggers, batch reconciliation isolation, and diagram generation without Graphviz. Tasks 6–8 must be feature-flagged, non-fatal, and behavior-preserving.

The task template in `reference/state-machine/TASK-TEMPLATE_State-Machine.md` must be used for subsequent phase task creation.

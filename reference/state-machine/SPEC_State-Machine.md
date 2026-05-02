# ForgeFrame Backend State Machine Specification

**Status:** Implementation specification  
**Scope:** Backend `execution/` module, Phase 1 only  
**Decision:** Use `pytransitions/transitions` for a formal execution lifecycle state machine  
**Source evaluation:** `reference/state-machine/EVA_STATE_MACHINE.md`  

---

## 1. Purpose

ForgeFrame currently enforces execution lifecycle rules with ad-hoc guard sets and inline service checks. Phase 1 introduces a formal state-machine boundary for `backend/app/execution/` so run transitions are explicit, testable, diagrammable, and safe to validate in parallel before replacing existing transition logic.

This specification is the source of truth for Phase 1 planning and task creation. Implementation tasks must reference this file and `reference/state-machine/PLAN_State-Machine.md`.

---

## 2. Non-Goals

- Do not migrate low-complexity modules (`skills/`, `agents/`, `learning/`, `workspaces/`, `conversations/`, `approvals/`) in Phase 1.
- Do not change public API response shapes in Phase 1.
- Do not change execution persistence schema in Phase 1 unless tests prove a required compatibility gap.
- Do not remove existing ad-hoc guards until parallel validation has produced a clean evidence window.
- Do not introduce a frontend dependency or UI change for this backend phase.

---

## 3. Library Decision

Use `transitions` from `pytransitions/transitions`.

### Required dependency policy

- Add the dependency to `backend/pyproject.toml` with an explicit bounded range.
- Prefer the latest stable `0.9.x` release available during implementation.
- Capture the chosen version in implementation notes and tests.

### Required library configuration

The first implementation must start with flat `Machine` unless async callbacks are proven necessary in code. Use these defaults unless a task explicitly documents a concrete reason to differ:

```python
Machine(
    model=model,
    states=states,
    transitions=transitions,
    initial=current_state,
    model_attribute="state",
    send_event=True,
    auto_transitions=False,
    ignore_invalid_triggers=False,
)
```

Use `AsyncMachine` only if a transition callback must await asynchronous work. Existing `ExecutionTransitionService` methods are synchronous SQLAlchemy transaction methods, so Phase 1 should keep side effects synchronous unless implementation evidence says otherwise.

Use `HierarchicalMachine` only after flat-machine validation proves a nested or parallel state model is required. `RunState` and `RunOperatorState` are orthogonal dimensions today; Phase 1 must preserve that separation rather than forcing an HSM prematurely.

Use `queued=True` only if callbacks fire additional transitions. If enabled, document that queued trigger calls return enqueue success rather than final transition success.

---

## 4. Domain Scope

### Primary owner

`backend/app/execution/` owns Phase 1.

### Existing source contracts

- `backend/app/execution/models.py`
  - `RUN_STATES`
  - `RunState`
  - `RUN_OPERATOR_STATES`
  - `RunOperatorState`
  - `RUN_ATTEMPT_STATES`
  - command and outbox literal contracts
- `backend/app/execution/service.py`
  - `ExecutionTransitionService`
  - current guard sets: `_TERMINAL_RUN_STATES`, `_CLAIMABLE_ATTEMPT_STATES`, `_RETRYABLE_RUN_STATES`, `_TERMINAL_OPERATOR_STATES`, `_CLAIMABLE_OPERATOR_STATES`, `_IN_FLIGHT_ATTEMPT_STATES`
- `backend/app/storage/execution_repository.py`
  - string columns and check constraints for persisted state
- `backend/tests/test_execution_transitions.py`
  - existing behavioral regression coverage

### Phase 1 target files

- Create `backend/app/execution/state_machine.py`.
- Create `backend/tests/test_execution_state_machine.py`.
- Modify `backend/pyproject.toml` to add `transitions`.
- Modify `backend/app/execution/service.py` only for opt-in dual validation after the standalone machine tests pass.
- Create generated or manually exported diagram documentation under `reference/state-machine/`.

---

## 5. State Model

### Run states

Phase 1 must model the existing `RUN_STATES` exactly:

| State | Category | Notes |
|---|---|---|
| `queued` | active | Waiting for dispatch/claim. |
| `dispatching` | active | Claimed or being prepared for execution. |
| `executing` | active | Worker is executing a run step. |
| `waiting_on_approval` | blocked | Human or policy approval is open. |
| `cancel_requested` | active/terminal-pending | Cancel command accepted; worker/compensation may still need cleanup. |
| `retry_backoff` | delayed | Retry scheduled after failure or timeout. |
| `compensating` | active cleanup | Compensation is running. |
| `succeeded` | terminal | Successful completion. |
| `failed` | terminal/retryable | Failed and may be replayed/retried depending on command policy. |
| `cancelled` | terminal | Cancel completed. |
| `timed_out` | terminal/retryable | Lease/deadline timeout reconciled. |
| `compensated` | terminal/retryable | Compensation completed. |
| `dead_lettered` | terminal/retryable/quarantine | No automatic progress expected. |

### Operator states

Phase 1 must preserve existing `RUN_OPERATOR_STATES` as a separate validation dimension:

`admitted`, `leased`, `executing`, `waiting_external`, `waiting_on_approval`, `paused`, `interrupted`, `retry_scheduled`, `completed`, `quarantined`, `failed`, `cancel_requested`, `compensating`.

### Attempt states

`RunAttemptState` mirrors `RunState`. Phase 1 may either:

1. model attempt transitions in the same file with separate transition tables, or
2. defer full attempt-machine ownership while adding explicit tests that run and attempt states remain synchronized for existing service paths.

The plan chooses option 1 for standalone validation and option 2 for service integration if the first implementation would become too invasive.

---

## 6. Transition Contract

Transition names must be command-style verbs. A first implementation must cover these observed service operations:

| Service operation | Required machine trigger(s) | Key state effects |
|---|---|---|
| `admit_create` | `admit_create` | New run starts as `queued`; operator starts as `admitted`; attempt starts as `queued`. |
| `claim_next_attempt` | `claim_attempt` | Run/attempt move toward `dispatching`; operator moves to `leased`. |
| `mark_attempt_executing` | `start_execution` | Run/attempt move to `executing`; operator becomes `executing` or `waiting_external` based on step. |
| `open_approval` | `open_approval` | Run/attempt/operator move to `waiting_on_approval`; approval outbox is emitted by service. |
| `decide_approval` resume | `resume_after_approval` | Run/attempt return to executable flow. |
| `decide_approval` reject/fail | `reject_after_approval` | Run/attempt move to failed/cancel/compensation path per disposition. |
| `complete_attempt_success` | `complete_success` | Run/attempt move to `succeeded`; operator moves to `completed`; terminal timestamp set by service. |
| `record_attempt_failure` retryable | `record_retryable_failure` | Run/attempt move to `retry_backoff` or `failed` depending retry budget. |
| `record_attempt_failure` terminal | `record_terminal_failure` | Run/attempt move to `failed` or `dead_lettered`; operator moves to `failed` or `quarantined`. |
| `request_cancel` | `request_cancel` | Non-terminal runs move to `cancel_requested`; operator moves to `cancel_requested`. |
| `pause_run` | `pause` | Operator moves to `paused`; run state remains compatible with current service behavior. |
| `resume_run` | `resume` | Operator state is restored from run state. |
| `interrupt_run` | `interrupt` | Operator moves to `interrupted` without violating run terminal rules. |
| `quarantine_run` | `quarantine` | Operator moves to `quarantined`; run state remains compatible with current service behavior. |
| `escalate_run` | `escalate` | Operator and/or command metadata updated without invalid run-state mutation. |
| `restart_run_from_scratch` | `restart_from_scratch` | Eligible terminal/retryable runs create fresh attempt and return to `queued`. |
| `admit_retry` | `admit_retry` | Eligible failed/timed-out/compensated/dead-lettered runs return to `queued` or `retry_backoff`. |
| `reconcile_expired_leases` | `expire_lease` | In-flight attempts become `timed_out` or `dead_lettered` according to existing policy. |

The implementation may split a service operation into more than one machine trigger when the existing behavior has distinct state effects. Each split must be documented in `state_machine.py` and covered by tests.

---

## 7. Guard Contract

Guards must be named positively and must not perform database writes.

Required guard groups:

- `is_non_terminal_run`
- `is_cancellable_run`
- `is_claimable_attempt`
- `is_retryable_run`
- `has_retry_budget`
- `has_valid_lease`
- `has_open_approval`
- `can_restart_from_scratch`
- `can_expire_lease`

Guards may read a provided context object that contains run, attempt, command, retry, lease, and approval metadata. Guards must return `bool`; they must not raise for expected business conflicts. The service boundary remains responsible for converting invalid trigger attempts into `RunTransitionConflictError` with stable messages.

---

## 8. Side-Effect Contract

During Phase 1, state-machine callbacks must not own persistence side effects directly. The service layer remains responsible for:

- database transaction boundaries,
- idempotency command creation/replay,
- outbox inserts,
- version increments,
- timestamps,
- lease token mutation,
- approval link mutation,
- retry scheduling.

The state machine may return a transition decision object or mutate an in-memory adapter model. The service applies mutations only after existing validation has accepted the transition during parallel mode.

This keeps old behavior authoritative while the machine proves equivalence.

---

## 9. Parallel Validation Contract

Phase 1b must compare existing service decisions with the new state-machine decision without changing externally visible behavior.

Required behavior:

- Existing service logic remains source of truth.
- Machine validation runs before or after existing checks in a way that cannot commit extra writes.
- Mismatches are logged as warnings with run ID, attempt ID, trigger, current states, expected machine destination, existing destination, and command ID when available.
- Mismatches must not crash production paths during the validation window.
- Unit tests must cover a mismatch logger path without relying on noisy logs.

Do not retire existing guard sets until a follow-up task explicitly performs Phase 1c.

---

## 10. Observability Requirements

State-machine validation logs must include:

- `run_id`,
- `attempt_id` when available,
- `command_id` when available,
- trigger name,
- current run/operator/attempt state,
- proposed destination state,
- existing service destination state,
- validation outcome.

Logs must never include secrets, provider payloads, raw request bodies, OAuth tokens, or credential material.

---

## 11. Testing Requirements

Create backend tests close to the change:

- `backend/tests/test_execution_state_machine.py` for standalone transition tables, guards, invalid triggers, and destination decisions.
- Extend existing execution transition tests only when dual validation is wired into `ExecutionTransitionService`.

Minimum coverage:

- every state listed in `RUN_STATES` is registered in the run machine,
- every state listed in `RUN_OPERATOR_STATES` is registered in the operator machine or explicit validator,
- happy path: queued → dispatching → executing → succeeded,
- approval path: executing → waiting_on_approval → executing,
- cancel path from at least two non-terminal states,
- invalid cancel from a terminal state,
- retry-budget accepted path,
- retry-budget exhausted path,
- lease-expiry path,
- dead-letter path,
- diagram generation smoke test if diagram tooling is implemented in code.

Required verification commands for implementation tasks:

```bash
cd backend
.venv/bin/python -m pytest tests/test_execution_state_machine.py -v
.venv/bin/python -m pytest tests/test_execution_models.py tests/test_execution_transitions.py tests/test_execution_background_worker.py tests/test_execution_admin_api.py -v
.venv/bin/python -m pytest -v
```

If the virtualenv is unavailable, use `python -m pytest ...` and document the environment difference.

---

## 12. Diagram Requirements

Phase 1 must produce a durable diagram artifact under `reference/state-machine/`.

Acceptable forms:

1. generated Mermaid markdown from `transitions`/`GraphMachine`, or
2. a manually maintained Mermaid diagram exported from the same transition table constants.

The diagram must be considered documentation, not runtime behavior. Do not require Graphviz system packages for normal backend startup.

---

## 13. Acceptance Criteria

Phase 1a is complete when:

- `transitions` is added to backend dependencies with a bounded version range,
- `backend/app/execution/state_machine.py` exists with explicit transition tables,
- standalone state-machine tests pass,
- no API or persistence schema change is introduced,
- a diagram artifact exists under `reference/state-machine/`.

Phase 1b is complete when:

- `ExecutionTransitionService` runs dual validation for agreed transition operations,
- mismatch logging is structured and non-fatal,
- existing execution regression tests pass,
- at least one test proves mismatches are surfaced without changing service outcomes.

Phase 1c is complete only when a later task confirms the parallel validation window was clean and delegates transition authority to the state machine.

---

## 14. References

- Evaluation: `reference/state-machine/EVA_STATE_MACHINE.md`
- Backend contracts: `backend/app/execution/models.py`
- Current transition service: `backend/app/execution/service.py`
- Current regression suite: `backend/tests/test_execution_transitions.py`
- Library docs: `pytransitions/transitions` README and changelog, current 0.9.x line

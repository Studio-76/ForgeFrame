# ForgeFrame Backend State Machine Specification

**Status:** Implementation specification
**Scope:** Backend `execution/` module, Phase 1 only
**Decision:** Use `pytransitions/transitions` for a formal execution lifecycle validator
**Source evaluation:** `reference/state-machine/EVA_STATE_MACHINE.md`
**Source audit:** Re-read `backend/app/execution/`, `backend/app/storage/execution_repository.py`, execution admin/API/worker callers, and current execution tests on 2026-05-03.

---

## 1. Purpose

ForgeFrame currently enforces execution lifecycle rules with ad-hoc guard sets, SQL compare-and-set updates, and inline service checks. Phase 1 introduces a formal state-machine boundary for `backend/app/execution/` so run transitions are explicit, testable, diagrammable, and safe to validate beside the existing implementation before any authority is transferred.

This specification is the source of truth for Phase 1 planning and task creation. Implementation tasks must reference this file and `reference/state-machine/PLAN_State-Machine.md`.

The enterprise goal is not just to encode the happy path. The implementation must surface mismatches between these four layers:

1. persisted `RunORM` state,
2. persisted `RunAttemptORM` state,
3. approval/lease/idempotency side conditions,
4. the outcome the existing `ExecutionTransitionService` actually applies.

---

## 2. Non-Goals

- Do not migrate low-complexity modules (`skills/`, `agents/`, `learning/`, `workspaces/`, `conversations/`, `approvals/`) in Phase 1.
- Do not change public API response shapes in Phase 1.
- Do not change execution persistence schema in Phase 1 unless tests prove a required compatibility gap. In-memory adapter models are allowed and are not persistence schema changes.
- Do not remove or weaken existing SQL compare-and-set/version checks in Phase 1.
- Do not remove existing ad-hoc guards until parallel validation has produced a clean evidence window and Phase 1c is explicitly approved.
- Do not make stricter state-machine guards authoritative in Phase 1b. If a guard gap is discovered, create a separate bug-fix task and preserve current behavior until that task is accepted.
- Do not introduce a frontend dependency or UI change for this backend phase.
- Do not require Graphviz, pygraphviz, or system packages for normal backend startup.

---

## 3. Library Decision

Use `transitions` from `pytransitions/transitions`.

If `EVA_STATE_MACHINE.md` conflicts with this specification on `AsyncMachine`, queued mode, diagram tooling, or migration sequencing, this specification is authoritative for implementation tasks.

### 3.1. Required dependency policy

- Add the dependency to `backend/pyproject.toml` with an explicit bounded range.
- Prefer `transitions>=0.9.2,<1.0` so the Mermaid diagram backend is available without Graphviz.
- Capture the chosen version in implementation notes and tests.
- Do not import graph/diagram extensions from request-time service paths.

### 3.2. Required library configuration

The first implementation must start with flat `Machine` unless async callbacks are proven necessary in code. Use these defaults unless a task explicitly documents a concrete reason to differ:

```python
Machine(
    model=model,
    states=states,
    transitions=transitions,
    initial=current_state,
    model_attribute=model_attribute,
    send_event=True,
    auto_transitions=False,
    ignore_invalid_triggers=False,
)
```

Use `AsyncMachine` only if a transition callback must await asynchronous work. Existing `ExecutionTransitionService` methods are synchronous SQLAlchemy transaction methods, so Phase 1 must keep validation synchronous unless implementation evidence says otherwise.

Use `HierarchicalMachine` only after flat-machine validation proves a nested or parallel state model is required. `RunState` and `RunOperatorState` are orthogonal dimensions today; Phase 1 must preserve that separation rather than forcing an HSM prematurely.

Use `queued=True` only if callbacks fire additional triggers. If enabled, document that queued trigger calls return enqueue success rather than final transition success. Phase 1 should not need queued mode.

`transitions` attaches trigger helper methods to the model. The implementation must keep the adapter private, avoid trigger-name reuse across machines, and invoke transitions through an explicit validator wrapper rather than exposing raw model methods to service code.

### 3.3. Runtime validation controls

Phase 1b validation must be gated by a runtime setting:

```text
FORGEFRAME_EXECUTION_STATE_MACHINE_VALIDATION_ENABLED
```

Required behavior:

- Default is disabled unless a test or local/dev configuration explicitly enables it.
- The disabled path is a no-op and must not construct machines, evaluate guards, or emit validation logs.
- Validation failures, invalid machine triggers, and unexpected validator exceptions are non-fatal in Phase 1b.
- The setting must be injectable or test-controllable without mutating global process state.
- If validation overhead exceeds the budget in §9.6, operators can disable the feature without redeploying code.

---

## 4. Domain Scope

### 4.1. Primary owner

`backend/app/execution/` owns Phase 1.

### 4.2. Existing source contracts

- `backend/app/execution/models.py`
  - `RUN_STATES`
  - `RunState`
  - `RUN_OPERATOR_STATES`
  - `RunOperatorState`
  - `RUN_ATTEMPT_STATES`
  - command, lease, approval, external-call, worker, and outbox literal contracts
- `backend/app/execution/service.py`
  - `ExecutionTransitionService`
  - current guard sets: `_TERMINAL_RUN_STATES`, `_CLAIMABLE_ATTEMPT_STATES`, `_RETRYABLE_RUN_STATES`, `_TERMINAL_OPERATOR_STATES`, `_CLAIMABLE_OPERATOR_STATES`, `_IN_FLIGHT_ATTEMPT_STATES`
  - command idempotency and insert-race recovery
  - synchronous SQLAlchemy transaction ownership
- `backend/app/storage/execution_repository.py`
  - string columns, check constraints, indexes, and composite foreign keys for persisted state
- `backend/app/execution/admin_service.py`
  - replay/operator/reconciliation wrappers and approval-wait filtering
- `backend/app/execution/worker_service.py`
  - background worker claim/execute/complete/failure paths
- `backend/app/responses/service.py`
  - background response admission via `admit_create`
- `backend/app/approvals/service.py`
  - shared approval decisions routed to `decide_approval`
- `backend/tests/test_execution_*.py`
  - current behavioral regression coverage

### 4.3. Phase 1 target files

- Create `backend/app/execution/state_machine.py`.
- Create `backend/tests/test_execution_state_machine.py`.
- Modify `backend/pyproject.toml` to add `transitions`.
- Modify `backend/app/settings/config.py` to add the validation feature flag.
- Modify `backend/app/execution/dependencies.py` only if validator construction/config injection requires it.
- Modify `backend/app/execution/service.py` only for opt-in dual validation after standalone machine tests pass.
- Create generated or manually exported diagram documentation under `reference/state-machine/`.

---

## 5. Current-Service Compatibility Findings

The state-machine implementation must be based on the real service, not on an idealized lifecycle. The following current behaviors are compatibility facts for Phase 1b:

1. `claim_attempt` is currently attempt-authoritative. `_claim_query` filters claimable attempt state/operator state and schedule, while `_claim_attempt` updates the run by version and does not include a run-state predicate.
2. `complete_attempt_success` is currently attempt/lease-authoritative. It validates attempt ownership, lease token, and in-flight attempt state, but does not check `run.state` or `run.current_attempt_id` before setting the run to `succeeded`.
3. `decide_approval` is currently approval-link-authoritative. It checks that the approval link is open, but does not require the run/attempt to still be `waiting_on_approval` before applying the decision.
4. `decide_approval` currently does not clear `run.current_approval_link_id` after approval or rejection.
5. `request_cancel` can move a `waiting_on_approval` run to `cancel_requested` without closing the approval link.
6. Retryable failure mutates two attempts: the source attempt becomes `failed`/`failed`, while a replacement current attempt is initialized as `retry_backoff`/`retry_scheduled` or `queued`/`admitted`.
7. Terminal failure leaves the source attempt as `dead_lettered`/`quarantined`, not `failed`.
8. Lease reconciliation sets run `timed_out`/`quarantined` and attempt `timed_out`/`interrupted`; `LeaseReconcileResult.reconciled_to_state` currently reports the operator destination (`quarantined`).
9. `quarantine_run` accepts every operator state except already `quarantined`, including `completed` and `failed` operator states.
10. `cancelled` and `compensated` are declared states but no inspected `ExecutionTransitionService` path currently produces them.

Phase 1b mismatch logging must distinguish a service-equivalence mismatch from a stricter-enterprise-invariant warning. Phase 1c must not proceed until each compatibility finding above is either accepted as intended behavior or resolved by a separate service bug-fix task.

---

## 6. State Model

### 6.1. Run states

Phase 1 must model the existing `RUN_STATES` exactly:

| State | Category | Current production source |
|---|---|---|
| `queued` | active | create, approval resume, retry admission, immediate retry |
| `dispatching` | active | claim |
| `executing` | active | worker start |
| `waiting_on_approval` | blocked | approval open |
| `cancel_requested` | active/terminal-pending | cancel, approval reject→cancel, interrupt |
| `retry_backoff` | delayed | retryable failure with delay |
| `compensating` | active cleanup | approval reject→compensate |
| `succeeded` | terminal | successful attempt completion |
| `failed` | terminal/retryable | approval reject→fail |
| `cancelled` | terminal | declared, currently not produced by inspected service paths |
| `timed_out` | terminal/retryable | lease reconciliation |
| `compensated` | terminal/retryable | declared, currently not produced by inspected service paths |
| `dead_lettered` | terminal/retryable/quarantine | terminal failure, quarantine |

### 6.2. Operator states

Phase 1 must preserve existing `RUN_OPERATOR_STATES` as a separate validation dimension:

`admitted`, `leased`, `executing`, `waiting_external`, `waiting_on_approval`, `paused`, `interrupted`, `retry_scheduled`, `completed`, `quarantined`, `failed`, `cancel_requested`, `compensating`.

### 6.3. Dual-machine architecture for orthogonal dimensions

`transitions` supports multiple independent state dimensions on the same model object via distinct `model_attribute` values. Phase 1 must use **two separate `Machine` instances** attached to the same private adapter model:

- **Run-state machine** with `model_attribute="run_state"` — validates triggers that change `run.state`.
- **Operator-state machine** with `model_attribute="operator_state"` — validates triggers that only change `operator_state` (`pause` and `resume`).

Each trigger fires on exactly one machine. A trigger must never fire on both machines simultaneously. For run-state triggers, operator-state correctness is validated through trigger-aware coordination constants (§6.5), not by firing a second operator-machine transition.

The adapter model must expose `run_state` and `operator_state` as mutable attributes. It must not be an ORM object.

### 6.4. Attempt effects are mandatory

Attempt state cannot be optional in Phase 1. The implementation does **not** need a third `Machine` unless tests prove it is simpler, but it must encode expected attempt effects as inspectable constants and include attempt outcomes in validation decisions.

Required attempt-effect fields for decisions:

- `target_attempt_state: str | None`
- `target_attempt_operator_state: str | None`
- `source_attempt_state: str | None`
- `source_attempt_operator_state: str | None`
- `replacement_attempt_state: str | None`
- `replacement_attempt_operator_state: str | None`
- `target_lease_status: str | None`

Required attempt effects:

| Trigger / operation | Source attempt effect | Replacement/current attempt effect |
|---|---|---|
| `admit_create` | n/a | new attempt initialized `queued` / `admitted`, lease `not_leased` |
| `claim_attempt` | current attempt → `dispatching` / `leased`, lease `leased` | none |
| `start_execution` | current attempt → `executing` / service-chosen `executing` or `waiting_external`, lease `leased` | none |
| `open_approval` | current attempt → `waiting_on_approval` / `waiting_on_approval`, lease `released` | none |
| `resume_after_approval` | current attempt → `queued` / `admitted`, lease `released` | none |
| `reject_approval_cancel` | current attempt → `cancel_requested` / `cancel_requested` | none |
| `reject_approval_compensate` | current attempt → `compensating` / `compensating` | none |
| `reject_approval_fail` | current attempt → `failed` / `failed` | none |
| `complete_success` | current attempt → `succeeded` / `completed`, lease `released` | none |
| `record_retryable_failure_delayed` | source attempt → `failed` / `failed`, lease `released` | new current attempt `retry_backoff` / `retry_scheduled` |
| `record_retryable_failure_immediate` | source attempt → `failed` / `failed`, lease `released` | new current attempt `queued` / `admitted` |
| `record_terminal_failure` | source attempt → `dead_lettered` / `quarantined`, lease `released` | none |
| `request_cancel` | current attempt → `cancel_requested` / `cancel_requested` | none |
| `admit_retry` | previous terminal attempt unchanged | new current attempt `queued` / `admitted` |
| `interrupt` | current attempt → `cancel_requested` / `interrupted`, lease `released` | none |
| `quarantine` | current attempt → `dead_lettered` / `quarantined`, lease `released` | none |
| `expire_lease` | current attempt → `timed_out` / `interrupted`, lease `expired` | none |
| `pause` | attempt state unchanged, attempt operator → `paused` | none |
| `resume` | attempt state unchanged, attempt operator → resume target | none |
| `restart_run_from_scratch` | source run's attempts unchanged | new run gets new attempt `queued` / `admitted` |

### 6.5. Trigger-aware run/operator coordination

A single run-state-to-operator-state map is insufficient because some run states have multiple valid operator pairings. Phase 1 must encode trigger-aware operator targets.

Required normal targets:

| Trigger | Target run state | Valid target operator state(s) |
|---|---|---|
| `claim_attempt` | `dispatching` | `leased` |
| `start_execution` | `executing` | `executing`, `waiting_external` |
| `open_approval` | `waiting_on_approval` | `waiting_on_approval` |
| `resume_after_approval` | `queued` | `admitted` |
| `reject_approval_cancel` | `cancel_requested` | `cancel_requested` |
| `reject_approval_compensate` | `compensating` | `compensating` |
| `reject_approval_fail` | `failed` | `failed` |
| `complete_success` | `succeeded` | `completed` |
| `record_retryable_failure_delayed` | `retry_backoff` | `retry_scheduled` |
| `record_retryable_failure_immediate` | `queued` | `admitted` |
| `record_terminal_failure` | `dead_lettered` | `quarantined` |
| `request_cancel` | `cancel_requested` | `cancel_requested` |
| `admit_retry` | `queued` | `admitted` |
| `interrupt` | `cancel_requested` | `interrupted` |
| `quarantine` | `dead_lettered` | `quarantined` |
| `expire_lease` | `timed_out` | `quarantined` |

The `_operator_state_for_resume` helper remains a separate operator-only mapping:

| Run state | Resume target operator state |
|---|---|
| `queued` | `admitted` |
| `dispatching` | `leased` |
| `executing` | `waiting_external` |
| `waiting_on_approval` | `waiting_on_approval` |
| `cancel_requested` | `cancel_requested` |
| `retry_backoff` | `retry_scheduled` |
| `compensating` | `compensating` |
| `succeeded` | `completed` |
| `failed` | `failed` |
| `dead_lettered` | `quarantined` |

Current service compatibility note: `_operator_state_for_resume(raw_state)` falls back to `"admitted"` for unlisted states such as `timed_out`, `cancelled`, and `compensated`. The validator must model this fallback as compatibility behavior and log `resume_operator_fallback` when it is used.

---

## 7. Transition Contract

Transition names must be command-style verbs. Each trigger fires on exactly one machine — either the run-state machine or the operator-state machine, never both simultaneously.

### 7.1. Run-state transitions

These triggers fire on the run-state machine and change `run.state`. The operator target is validated with §6.5.

| Service operation | Machine trigger | Intended source contract | Target run state | Current service authority |
|---|---|---|---|---|
| `claim_next_attempt` / `claim_attempt` | `claim_attempt` | run `queued` or `retry_backoff`; attempt claimable; schedule due | `dispatching` | attempt CAS + run version |
| `mark_attempt_executing` | `start_execution` | run/attempt `dispatching`; lease token matches; not paused | `executing` | run and attempt state checks |
| `open_approval` | `open_approval` | run/attempt `executing` | `waiting_on_approval` | run and attempt state checks |
| `decide_approval` approved | `resume_after_approval` | open approval link and run/attempt `waiting_on_approval` | `queued` | approval-link status only |
| `decide_approval` rejected/cancel | `reject_approval_cancel` | open approval link and run/attempt `waiting_on_approval` | `cancel_requested` | approval-link status only |
| `decide_approval` rejected/compensate | `reject_approval_compensate` | open approval link and run/attempt `waiting_on_approval` | `compensating` | approval-link status only |
| `decide_approval` rejected/fail | `reject_approval_fail` | open approval link and run/attempt `waiting_on_approval` | `failed` | approval-link status only |
| `complete_attempt_success` | `complete_success` | run in `{dispatching, executing, cancel_requested, compensating}`; current attempt in-flight; lease token matches | `succeeded` | attempt state + lease token |
| `record_attempt_failure` retryable with delay | `record_retryable_failure_delayed` | run/attempt `dispatching` or `executing`; current attempt; lease token; retryable and budget remains | `retry_backoff` | run/attempt state + lease token |
| `record_attempt_failure` retryable without delay | `record_retryable_failure_immediate` | run/attempt `dispatching` or `executing`; current attempt; lease token; retryable and budget remains | `queued` | run/attempt state + lease token |
| `record_attempt_failure` terminal | `record_terminal_failure` | run/attempt `dispatching` or `executing`; current attempt; lease token; not retryable or no budget remains | `dead_lettered` | run/attempt state + lease token |
| `request_cancel` | `request_cancel` | any non-terminal run except `cancel_requested` | `cancel_requested` | run state |
| `admit_retry` | `admit_retry` | run in `{failed, timed_out, compensated, dead_lettered}` | `queued` | run state |
| `interrupt_run` | `interrupt` | any non-terminal operator state | `cancel_requested` | operator state |
| `quarantine_run` | `quarantine` | any operator state except `quarantined` | `dead_lettered` | operator state |
| `reconcile_expired_leases` | `expire_lease` | attempt in-flight; lease status `leased`; lease expired; run operator not terminal | `timed_out` | query filter + terminal-operator skip |

The `Intended source contract` column is the enterprise invariant. The `Current service authority` column documents what the existing service actually checks today. Phase 1b logs gaps between them; Phase 1c must not silently convert those gaps into behavior changes.

### 7.2. Operator-state-only operations

These triggers fire on the operator-state machine and change `operator_state` without changing `run.state`. The run-state machine must not receive these triggers.

| Service operation | Machine trigger | Guard condition | Target operator state | Notes |
|---|---|---|---|---|
| `pause_run` | `pause` | `operator_state` not terminal and not `paused`; attempt not in-flight | `paused` | Run state is preserved. In-flight attempts must be interrupted instead. |
| `resume_run` | `resume` | `operator_state == "paused"`; no open/current approval link | mapped by §6.5 resume table or retry wake gate | Run state is preserved. If `run.state == "retry_backoff"` and `next_wakeup_at > now`, target remains `retry_scheduled`. |

### 7.3. Creation commands and initialization validators

These operations create entities rather than transitioning an existing source run. They must be validated, but not modeled as run-state transitions on the source entity.

| Service operation | Behavior | Machine involvement |
|---|---|---|
| `admit_create` | Creates a new `RunORM` and `RunAttemptORM` with `queued` / `admitted`. | Validate initial run, operator, attempt, lease, command snapshot, and outbox values after creation. Do not fire a run transition. |
| `restart_run_from_scratch` | Creates a new run and attempt with `queued` / `admitted`; source run only receives metadata updates. | Validate the new run's initial state. Validate the source run did not change `state`, `operator_state`, `current_attempt_id`, or existing attempts. |

### 7.4. Non-state-changing operations

These service methods perform lease management, metadata updates, or reads without changing run or operator state. Neither machine receives a trigger.

| Service operation | What it does | Required validation |
|---|---|---|
| `renew_attempt_lease` | Updates `lease_expires_at` and `last_heartbeat_at`. | Confirm no run/attempt state dimension changes. |
| `escalate_run` | Changes `execution_lane` and `status_reason`. | Confirm no run/attempt/operator state dimension changes. |
| `fetch_run` | Read-only lookup. | None. |

---

## 8. Guard Contract

Guards must be named positively and must not perform database writes. Guards receive a context object (see §8.1) and return `bool`. They must not raise for expected business conflicts; the service boundary converts invalid trigger attempts into `RunTransitionConflictError` with stable messages.

### 8.1. Guard context object

Guards receive a typed context dataclass with these fields available for conditional checks:

- `run_id: str | None`
- `attempt_id: str | None`
- `current_attempt_id: str | None`
- `run_state: str`
- `operator_state: str`
- `attempt_state: str | None`
- `attempt_operator_state: str | None`
- `attempt_lease_token: str | None`
- `provided_lease_token: str | None`
- `attempt_no: int | None`
- `active_attempt_no: int`
- `max_attempts: int | None`
- `retry_count: int | None`
- `retryable: bool | None`
- `retry_delay_seconds: int | None`
- `lease_status: str | None`
- `scheduled_at: datetime | None`
- `lease_expires_at: datetime | None`
- `next_wakeup_at: datetime | None`
- `now: datetime | None`
- `current_approval_link_id: str | None`
- `approval_gate_status: str | None`
- `approval_resume_disposition: str | None`
- `has_open_approval: bool`
- `has_in_flight_attempt: bool`
- `service_chosen_operator_state: str | None`

### 8.2. Required guards

| Guard name | Attached to trigger(s) | Condition |
|---|---|---|
| `is_claimable_run` | `claim_attempt` | `run_state ∈ {"queued", "retry_backoff"}` |
| `is_claimable_attempt` | `claim_attempt` | `attempt_state ∈ {"queued", "retry_backoff"}` and `attempt_operator_state ∈ {"admitted", "retry_scheduled"}` |
| `is_claimable_wakeup_due` | `claim_attempt` | `scheduled_at is None OR now is None OR scheduled_at <= now` |
| `is_not_paused` | `start_execution` | `operator_state != "paused"` and `attempt_operator_state != "paused"` |
| `is_executing` | `open_approval` | `run_state == "executing" AND attempt_state == "executing"` |
| `has_open_approval_gate` | `resume_after_approval`, `reject_approval_*` | `approval_gate_status == "open"` |
| `is_waiting_on_approval` | `resume_after_approval`, `reject_approval_*` | `run_state == "waiting_on_approval" AND attempt_state == "waiting_on_approval"` |
| `is_current_attempt` | lease-bound triggers, approval triggers | `current_attempt_id == attempt_id` when both are present |
| `is_in_flight_attempt` | `complete_success`, `expire_lease` | `attempt_state ∈ {"dispatching", "executing", "cancel_requested", "compensating"}` |
| `is_recordable_failure` | `record_retryable_failure_*`, `record_terminal_failure` | `run_state ∈ {"dispatching", "executing"} AND attempt_state ∈ {"dispatching", "executing"}` |
| `is_cancellable_run` | `request_cancel` | `run_state ∉ _TERMINAL_RUN_STATES AND run_state != "cancel_requested"` |
| `is_retryable_run` | `admit_retry` | `run_state ∈ {"failed", "timed_out", "compensated", "dead_lettered"}` |
| `is_retryable_and_has_budget` | `record_retryable_failure_*` | `retryable is True AND active_attempt_no + 1 <= max_attempts` |
| `is_terminal_failure_destination` | `record_terminal_failure` | `retryable is not True OR active_attempt_no + 1 > max_attempts` |
| `has_valid_lease_token` | `start_execution`, `complete_success`, `record_*`, `renew_attempt_lease` | `attempt_lease_token == provided_lease_token` and both are non-empty |
| `has_expired_lease` | `expire_lease` | `lease_status == "leased" AND lease_expires_at is not None AND now is not None AND lease_expires_at < now` |
| `is_not_quarantined` | `quarantine` | `operator_state != "quarantined"` |
| `is_operator_pausable` | `pause` | `operator_state ∉ _TERMINAL_OPERATOR_STATES AND operator_state != "paused"` |
| `is_operator_resumable` | `resume` | `operator_state == "paused" AND not has_open_approval AND current_approval_link_id is None` |
| `is_interruptible` | `interrupt` | `operator_state ∉ _TERMINAL_OPERATOR_STATES` |
| `is_valid_service_chosen_operator_state` | `start_execution`, retry triggers, `resume` | `service_chosen_operator_state` belongs to the trigger's valid target set |

### 8.3. Guard design rules

1. Guards must not reference ORM objects or database state. They receive a context dataclass populated by the service before validation.
2. Compound checks in service code must be modeled as single named guards.
3. Guards that depend on attempt metadata must receive that metadata through the context object.
4. Guard names must use positive, descriptive predicates. Avoid negative names like `_not_terminal`.
5. Guard failure detail must be retained in validation results as `guard_results: dict[str, bool]` or an equivalent typed structure.

---

## 9. Side-Effect and Parallel Validation Contract

### 9.1. Side-effect ownership

During Phase 1, state-machine callbacks must not own persistence side effects directly. The service layer remains responsible for:

- database transaction boundaries,
- SQL compare-and-set/version checks,
- idempotency command creation/replay,
- outbox inserts,
- timestamps,
- lease token mutation,
- approval link mutation,
- retry scheduling,
- response snapshots and worker heartbeats.

The state machine may return a transition decision object or mutate an in-memory adapter model. The service applies mutations only through existing code paths during Phase 1b.

### 9.2. Validation timing

Phase 1b must compare existing service decisions with the new state-machine decision without changing externally visible behavior.

Required behavior:

- Existing service logic remains source of truth.
- Capture a pre-transition snapshot before the existing service mutates state.
- Let the existing service compute/apply its current outcome.
- Compare the machine decision with the actual service outcome after mutation or after command-result construction.
- Do not commit extra writes for validation.
- Do not run transition validation for idempotent command replay as if it were a new transition. Existing/deduplicated commands may validate their stored snapshot separately, but must not fire a transition trigger.

### 9.3. Exception safety

Mismatches and validator exceptions must not crash production paths during Phase 1b.

Required behavior:

- Catch `transitions.MachineError` and all unexpected validator exceptions at the service integration boundary.
- Log validator exceptions with traceback and structured transition context.
- Return the existing service outcome unchanged.
- Tests must prove a forced validator exception is non-fatal when validation is enabled.

### 9.4. Mismatch categories

Structured mismatch logs must classify at least these categories:

- `invalid_trigger`
- `guard_failed`
- `run_state_mismatch`
- `operator_state_mismatch`
- `attempt_state_mismatch`
- `replacement_attempt_mismatch`
- `lease_status_mismatch`
- `current_attempt_mismatch`
- `approval_link_mismatch`
- `creation_initial_state_mismatch`
- `non_state_operation_mutated_state`
- `resume_operator_fallback`
- `validator_exception`

### 9.5. Approval-link lifecycle validation

Phase 1b must log approval-link lifecycle mismatches without changing behavior:

- `open_approval` should leave `current_approval_link_id` pointing at an open link.
- `decide_approval` currently leaves `current_approval_link_id` set after the link closes. This is compatibility behavior, but the validator must log it as a closed-current-approval consistency warning.
- `request_cancel` from `waiting_on_approval` currently does not close the approval link. This is compatibility behavior, but the validator must log it as an open-approval-cancel consistency warning.
- Phase 1c requires an explicit decision: either formalize retained historical links or clear/close them in a service bug-fix task.

### 9.6. Performance budget and concurrency rules

Phase 1b validation must add no database queries and must not import diagram tooling on request paths.

Performance requirements:

- Target p95 validator overhead: ≤5 ms per transition invocation on a developer machine for representative snapshots.
- Batch lease reconciliation must avoid O(n) machine-construction overhead if benchmarks show material cost. Reusing machines is allowed only if temporary models are removed in `finally` and no mutable adapter is shared across requests.
- If a long-lived/shared machine is used in the cached `ExecutionTransitionService`, the implementation must prove thread safety or use a synchronization strategy. A simpler per-validation adapter is acceptable if it stays within budget.
- If the budget is exceeded, Phase 1b validation remains disabled by default and an optimization task is required before production enablement.

### 9.7. Batch reconciliation contract

`reconcile_expired_leases` operates on multiple expired attempts in a single transaction. The validator must be invoked once per eligible attempt in the reconciliation loop — not once for the entire batch. Each invocation must be independent and must not carry adapter state from the previous iteration.

Required behavior:

- The service iterates over attempts with `lease_status == "leased"`, in-flight `attempt_state`, and `lease_expires_at < now`.
- For each attempt, the service skips runs whose `operator_state` is terminal.
- The validator receives each non-skipped attempt+run pair and validates `expire_lease`.
- Expected run target: `state="timed_out"`, `operator_state="quarantined"`.
- Expected attempt target: `attempt_state="timed_out"`, `operator_state="interrupted"`, `lease_status="expired"`.
- Mismatches are logged per attempt, not per batch.

---

## 10. Observability Requirements

State-machine validation logs must include:

- validation enabled/disabled state,
- `run_id`,
- `attempt_id` when available,
- replacement attempt ID when available,
- `command_id` when available,
- trigger name,
- mismatch category,
- current run/operator/attempt state,
- proposed run/operator/attempt destination state,
- existing service destination state,
- relevant approval link ID/status,
- relevant lease status and lease expiry,
- guard results or guard failure name,
- validation outcome,
- exception class/message and traceback for validator exceptions.

Logs must never include secrets, provider payloads, raw request bodies, OAuth tokens, credential material, or full response bodies.

Unit tests must cover mismatch logging without relying on noisy global logs; use a logger spy, caplog, or injected recorder.

---

## 11. Testing Requirements

Create backend tests close to the change:

- `backend/tests/test_execution_state_machine.py` for standalone transition tables, guards, invalid triggers, destination decisions, attempt effects, and diagram export.
- Extend existing execution transition tests only when dual validation is wired into `ExecutionTransitionService`.

Minimum standalone coverage:

- every state listed in `RUN_STATES` is registered in the run machine,
- every state listed in `RUN_OPERATOR_STATES` is registered in the operator machine or explicit validator,
- declared-but-currently-unreached states (`cancelled`, `compensated`) are registered but not given invented production paths,
- every trigger-aware run ⇔ operator target from §6.5 is validated,
- every attempt effect from §6.4 is validated,
- happy path: queued → dispatching → executing → succeeded,
- approval path: executing → waiting_on_approval → queued,
- approval reject paths: waiting_on_approval → cancel_requested, compensating, failed,
- approval-link stale-current warning after decision,
- cancel path from at least two non-terminal states, including `waiting_on_approval`,
- invalid cancel from terminal states,
- retry-budget accepted path with delayed backoff,
- retry-budget accepted path with no backoff delay,
- retry-budget exhausted or non-retryable path to dead letter,
- source-attempt failure plus replacement-attempt initialization,
- operator-state-only pause and resume do not change run state,
- invalid pause from terminal operator state,
- invalid resume from non-paused state,
- resume fallback for unlisted run states is modeled and logged,
- lease-expiry path validates run and attempt targets,
- quarantine from completed/failed operator states is modeled as current compatibility behavior,
- interrupt path to `cancel_requested` / `interrupted`,
- `escalate_run` and `renew_attempt_lease` do not fire machine triggers and do not mutate state dimensions,
- `admit_create` validates initial state without firing a transition,
- `restart_run_from_scratch` does not fire a run-state transition on the source run,
- feature flag disabled path is a no-op,
- feature flag enabled path logs mismatches non-fatally,
- forced validator exception is non-fatal,
- idempotent command replay does not fire a fresh transition,
- Mermaid diagram generation smoke test works without Graphviz system packages,
- lightweight performance smoke validates the §9.6 budget or records an actionable skip reason.

Required verification commands for implementation tasks:

```bash
cd backend
.venv/bin/python -m pytest tests/test_execution_state_machine.py -v
.venv/bin/python -m pytest tests/test_execution_models.py tests/test_execution_transitions.py tests/test_execution_operator_fabric.py tests/test_execution_background_worker.py tests/test_execution_admin_api.py tests/test_execution_queue_dispatch_api.py -v
.venv/bin/python -m pytest -v
```

If the virtualenv is unavailable, use `python -m pytest ...` and document the environment difference.

---

## 12. Diagram Requirements

Phase 1 must produce a durable diagram artifact under `reference/state-machine/`.

Required approach:

1. Prefer Mermaid generated from the same transition/effect constants used by tests.
2. If `transitions` graph extensions are used, set `graph_engine="mermaid"` and keep that code out of runtime service imports.
3. Do not require Graphviz system packages for normal backend startup or normal test execution.

The diagram is documentation, not runtime behavior.

---

## 13. Acceptance Criteria

Phase 1a is complete when:

- `transitions` is added to backend dependencies with a bounded version range,
- runtime validation configuration exists and defaults safely,
- `backend/app/execution/state_machine.py` exists with:
  - two separate `Machine` instances or factories for run-state and operator-state validation,
  - explicit run-state transition tables for all triggers in §7.1,
  - explicit operator-state transition tables for all triggers in §7.2,
  - trigger-aware run/operator target constants (§6.5),
  - mandatory attempt-effect constants (§6.4),
  - creation validators for `admit_create` and `restart_run_from_scratch`,
  - non-state-operation validators for `renew_attempt_lease` and `escalate_run`,
  - a typed `ExecutionTransitionContext` dataclass for guards (§8.1),
  - a typed decision/result dataclass that includes run/operator/attempt targets, guard results, validation errors, and mismatch category,
- standalone state-machine tests cover all relevant items in §11,
- no API or persistence schema change is introduced,
- a Mermaid diagram artifact exists under `reference/state-machine/`.

Phase 1b is complete when:

- `ExecutionTransitionService` runs feature-flagged dual validation for all run-state transitions (§7.1), operator-state-only operations (§7.2), creation validators (§7.3), and non-state-operation validators (§7.4),
- validation is disabled by default and test-controllable,
- mismatch logging is structured and non-fatal,
- validator exceptions are structured and non-fatal,
- operator, attempt, approval-link, lease, and current-attempt mismatches are logged with the same severity as run-state mismatches,
- existing execution regression tests pass,
- at least one test proves mismatches are surfaced without changing service outcomes,
- at least one test proves batch reconciliation produces per-attempt mismatch logs,
- at least one test proves idempotent replay does not fire fresh validation,
- performance budget evidence is recorded.

Phase 1c is complete only when a later task confirms the validation window was clean or all mismatches were accepted/fixed, then explicitly delegates transition authority to the state machine. Phase 1c must include a human-reviewed decision for each compatibility finding in §5.

---

## 14. References

- Evaluation: `reference/state-machine/EVA_STATE_MACHINE.md`
- Backend contracts: `backend/app/execution/models.py`
- Current transition service: `backend/app/execution/service.py`
- Persistence schema: `backend/app/storage/execution_repository.py`
- Current regression suite: `backend/tests/test_execution_*.py`
- Library docs: `pytransitions/transitions` README and changelog, current `0.9.x` line

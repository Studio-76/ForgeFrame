# ForgeFrame State Machine Task Template

Use this template when creating the next phase of state-machine tasks. The agent creating tasks must read the spec and plan first, then produce small, verifiable tasks in Task Manager.

---

## Required Reading

Before creating tasks, read these files in full:

1. `reference/state-machine/SPEC_State-Machine.md`
2. `reference/state-machine/PLAN_State-Machine.md`
3. `reference/state-machine/EVA_STATE_MACHINE.md`
4. Current implementation files touched by the previous phase
5. Current tests for the touched backend module

If `EVA_STATE_MACHINE.md` conflicts with the spec or plan, treat the spec and plan as authoritative. The EVA document is historical evaluation context, not the implementation contract.

For Phase 1 execution work, also read the current code paths before tasking or implementation:

- `backend/app/execution/models.py`
- `backend/app/execution/service.py`
- `backend/app/storage/execution_repository.py`
- `backend/app/execution/admin_service.py`
- `backend/app/execution/worker_service.py`
- `backend/app/responses/service.py`
- `backend/app/approvals/service.py`
- `backend/tests/test_execution_*.py`

---

## Task Title Format

Use:

```text
ForgeFrame StateMachine: <phase>-<task_number> <task_name>
```

Where `<phase>` is one of `1a`, `1b`, `1c`, `2`, and `<task_number>` is a zero-padded two-digit number within that phase.

Examples:

- `ForgeFrame StateMachine: 1a-01 Add transitions dependency and validation flag`
- `ForgeFrame StateMachine: 1a-03 Encode run/operator transition tables`
- `ForgeFrame StateMachine: 1b-01 Wire worker hot-path validation`
- `ForgeFrame StateMachine: 1c-01 Promote selected guards to authoritative validation`

---

## Task Description Template

```markdown
Implement <phase and objective> for the ForgeFrame backend execution state-machine migration.

Source documents:
- `reference/state-machine/SPEC_State-Machine.md`
- `reference/state-machine/PLAN_State-Machine.md`
- `reference/state-machine/EVA_STATE_MACHINE.md`

Source code to re-read before editing:
- `<path>`
- `<path>`

Scope:
- In: <exact behavior/files included>
- Out: <explicit non-goals>

Expected files:
- `<path>` — <CREATE/MODIFY/REFERENCE>

Behavior requirements:
- <requirement 1>
- <requirement 2>
- <requirement 3>

Enterprise safety requirements:
- Preserve public API shape and persistence schema unless this task explicitly says otherwise.
- Preserve existing service behavior in Phase 1b; validation is advisory only.
- Do not introduce persistence side effects into state-machine callbacks.
- Do not bypass SQL compare-and-set/version/idempotency behavior.
- Keep validator exceptions non-fatal when running in Phase 1b.
- Keep diagram/GraphMachine imports out of request-time service paths.

Verification:
- `<command 1>`
- `<command 2>`

Completion requirements:
- All verification commands pass or failures are documented as pre-existing.
- Commit only if the user/task explicitly requests a commit.
- If committed, use a concise conventional commit message and update Task Manager with the commit ID.
- Update `AGENTS.md` only if a durable project fact changed; do not commit `AGENTS.md`.
```

---

## Enterprise Invariant Checklist

Every implementation task must explicitly preserve or test these invariants when relevant:

- No public API response-shape changes in Phase 1.
- No execution persistence schema changes in Phase 1.
- Existing `ExecutionTransitionService` remains authoritative until Phase 1c.
- Feature-flag disabled path is a true no-op for Phase 1b validation.
- Idempotent command replay does not fire a fresh transition validation.
- Validator exceptions do not change service outcomes in Phase 1b.
- Run-state, operator-state, attempt-state, replacement-attempt, lease-status, current-attempt, and approval-link mismatches are distinguishable.
- `admit_create` is an initialization validator, not a run transition.
- `restart_run_from_scratch` does not transition the source run.
- Retry failure distinguishes source-attempt mutation from replacement-attempt initialization.
- `pause`/`resume` use the operator-state machine only and preserve `run.state`.
- `reconcile_expired_leases` validates each eligible attempt independently.
- `renew_attempt_lease` and `escalate_run` do not fire state-machine triggers and must not mutate state dimensions.
- Diagram generation works without Graphviz system packages.

---

## Task Splitting Checklist

Create separate tasks when work crosses any of these boundaries:

- dependency/configuration changes,
- new state-machine module design,
- run-state transition table encoding,
- operator-state transition table encoding,
- trigger-aware run/operator coordination encoding,
- attempt-effect encoding,
- creation validators (`admit_create`, `restart_run_from_scratch`),
- non-state-operation validators (`renew_attempt_lease`, `escalate_run`),
- service integration by wave,
- batch reconciliation integration,
- operator-state-only trigger integration (`pause`, `resume`),
- tests,
- generated or maintained diagrams,
- validation evidence review,
- authoritative swap-over,
- cleanup/removal of old guards.

Do not combine Phase 1b validation and Phase 1c swap-over in one task.
Do not combine feature-flagged production integration with authority transfer.
Do not combine run-state and operator-state machine wiring with service integration unless the service method count is low (≤3) and tests are included.

---

## Required Task Fields

Each Task Manager task must include:

- objective,
- exact files to modify or create,
- implementation guide,
- dependencies on earlier tasks,
- verification criteria,
- out-of-scope list,
- reference to the spec and plan,
- explicit enterprise invariant checklist items that apply,
- rollback/disable plan for Phase 1b runtime validation.

---

## First-Phase Seed Tasks

If no implementation tasks exist yet, create these first.

### 1. ForgeFrame StateMachine: 1a-01 Add transitions dependency and validation runtime flag

Add a bounded `transitions>=0.9.2,<1.0` dependency to `backend/pyproject.toml`. Add `execution_state_machine_validation_enabled: bool = False` to backend settings and document the environment variable `FORGEFRAME_EXECUTION_STATE_MACHINE_VALIDATION_ENABLED`. Do not wire service validation yet.

Expected files:

- `backend/pyproject.toml` — MODIFY
- `backend/app/settings/config.py` — MODIFY
- tests covering settings behavior if an existing settings test file is available — MODIFY

Verification:

```bash
cd backend
.venv/bin/python -m pytest tests/test_execution_models.py -v
```

### 2. ForgeFrame StateMachine: 1a-02 Add execution state-machine validator skeleton

Create `backend/app/execution/state_machine.py` with typed context, snapshot, decision, and validation-result dataclasses. Add a side-effect-free `ExecutionStateMachineValidator` wrapper. Include no service integration and no persistence writes.

Expected files:

- `backend/app/execution/state_machine.py` — CREATE
- `backend/tests/test_execution_state_machine.py` — CREATE

Verification:

```bash
cd backend
.venv/bin/python -m pytest tests/test_execution_state_machine.py -v
```

### 3. ForgeFrame StateMachine: 1a-03 Encode run/operator transition tables and trigger-aware coordination

Populate explicit run-state and operator-state transition tables from SPEC §7.1–§7.2. Create two separate `Machine` instances or factories using distinct `model_attribute` values (`"run_state"` and `"operator_state"`). Encode trigger-aware operator targets from SPEC §6.5; do not use a single run-state-to-operator-state map for all transitions. Keep tables aligned with `backend/app/execution/models.py` literals.

Expected files:

- `backend/app/execution/state_machine.py` — MODIFY
- `backend/tests/test_execution_state_machine.py` — MODIFY

Verification:

```bash
cd backend
.venv/bin/python -m pytest tests/test_execution_state_machine.py -v
```

### 4. ForgeFrame StateMachine: 1a-04 Encode attempt effects, creation validators, and non-state validators

Encode mandatory attempt effects from SPEC §6.4, including source-attempt vs replacement-attempt behavior for retryable failures. Add initialization validators for `admit_create` and `restart_run_from_scratch`. Add non-state validators for `renew_attempt_lease` and `escalate_run` that assert state dimensions are unchanged.

Expected files:

- `backend/app/execution/state_machine.py` — MODIFY
- `backend/tests/test_execution_state_machine.py` — MODIFY

Verification:

```bash
cd backend
.venv/bin/python -m pytest tests/test_execution_state_machine.py -v
```

### 5. ForgeFrame StateMachine: 1a-05 Add standalone tests and Mermaid diagram artifact

Create comprehensive tests for: all registered states, declared-but-unreached states, every run-state transition, operator-state-only triggers, trigger-aware coordination, attempt effects, guards, retry budget behavior, approval paths, stale approval-link warnings, creation-command classification, non-state operations, idempotent replay classification, validator exception result shaping, and diagram generation. Add a durable Mermaid artifact under `reference/state-machine/` generated from the same constants or manually kept in sync.

Expected files:

- `backend/tests/test_execution_state_machine.py` — MODIFY
- `reference/state-machine/<diagram>.md` — CREATE

Verification:

```bash
cd backend
.venv/bin/python -m pytest tests/test_execution_state_machine.py -v
.venv/bin/python -m pytest tests/test_execution_transitions.py tests/test_execution_operator_fabric.py -v
```

### 6. ForgeFrame StateMachine: 1b-01 Wire feature-flagged validation for worker hot-path wave

Wire non-authoritative validation into `claim_next_attempt` / `claim_attempt`, `mark_attempt_executing`, `complete_attempt_success`, `record_attempt_failure`, and `request_cancel`. The feature flag must disable all validator work by default. When enabled, mismatches and validator exceptions must be structured and non-fatal.

Expected files:

- `backend/app/execution/service.py` — MODIFY
- `backend/tests/test_execution_transitions.py` — MODIFY
- `backend/tests/test_execution_background_worker.py` — MODIFY if needed

Verification:

```bash
cd backend
.venv/bin/python -m pytest tests/test_execution_state_machine.py tests/test_execution_transitions.py -v
.venv/bin/python -m pytest tests/test_execution_background_worker.py -v
```

### 7. ForgeFrame StateMachine: 1b-02 Wire validation for approval, interrupt, quarantine, and reconciliation wave

Wire non-authoritative validation into `open_approval`, `decide_approval`, `interrupt_run`, `quarantine_run`, and `reconcile_expired_leases`. Batch reconciliation must validate each eligible attempt independently. Approval-link lifecycle mismatches must be logged but must not change current behavior.

Expected files:

- `backend/app/execution/service.py` — MODIFY
- `backend/tests/test_execution_transitions.py` — MODIFY
- `backend/tests/test_execution_operator_fabric.py` — MODIFY
- `backend/tests/test_execution_admin_api.py` — MODIFY if needed

Verification:

```bash
cd backend
.venv/bin/python -m pytest tests/test_execution_state_machine.py tests/test_execution_transitions.py tests/test_execution_operator_fabric.py -v
.venv/bin/python -m pytest tests/test_execution_admin_api.py tests/test_execution_queue_dispatch_api.py -v
```

### 8. ForgeFrame StateMachine: 1b-03 Wire validation for operator-only, create/retry/restart, and non-state operations

Wire non-authoritative validation into `pause_run`, `resume_run`, `admit_retry`, `admit_create`, `restart_run_from_scratch`, `renew_attempt_lease`, and `escalate_run`. `pause`/`resume` must use the operator-state machine only. Creation operations must validate initial state without firing source-run transitions. Idempotent replays must not fire fresh transition validation.

Expected files:

- `backend/app/execution/service.py` — MODIFY
- `backend/tests/test_execution_transitions.py` — MODIFY
- `backend/tests/test_execution_operator_fabric.py` — MODIFY

Verification:

```bash
cd backend
.venv/bin/python -m pytest tests/test_execution_state_machine.py tests/test_execution_transitions.py tests/test_execution_operator_fabric.py -v
.venv/bin/python -m pytest tests/test_execution_background_worker.py tests/test_execution_admin_api.py -v
```

### 9. ForgeFrame StateMachine: 1b-04 Review Phase 1 validation evidence and prepare swap-over decisions

Review mismatch evidence, validator exception logs, performance notes, and developer feedback from Phase 1b. Create follow-up tasks for Phase 1c only if the evidence supports promotion to authoritative transition validation. Each SPEC §5 compatibility finding must be marked accepted, fixed, or blocked.

Expected files:

- `reference/state-machine/<phase-1-evaluation>.md` — CREATE or MODIFY
- Task Manager records — UPDATE

Verification:

```bash
cd backend
.venv/bin/python -m pytest -v
```

---

## Follow-Up Decision Rules

- If mismatches exist, create bug-fix or compatibility-decision tasks before swap-over tasks.
- If approval-link lifecycle behavior remains ambiguous, do not proceed to Phase 1c for approval transitions.
- If async callbacks become necessary, create a research task specifically for `AsyncMachine` behavior and cancellation semantics.
- If hierarchical states become necessary, update the spec before creating HSM implementation tasks.
- If validation overhead exceeds the SPEC budget, create an optimization task and keep production validation disabled.
- If Phase 1 produces little value or high complexity, create an evaluation task recommending stop/refine rather than expansion.

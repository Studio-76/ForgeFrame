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

---

## Task Title Format

Use:

```text
ForgeFrame: <short action-oriented title>
```

Examples:

- `ForgeFrame: Add execution state machine skeleton`
- `ForgeFrame: Wire non-authoritative transition validation`
- `ForgeFrame: Promote execution machine to authoritative guard source`

---

## Task Description Template

```markdown
Implement <phase and objective> for the ForgeFrame backend execution state-machine migration.

Source documents:
- `reference/state-machine/SPEC_State-Machine.md`
- `reference/state-machine/PLAN_State-Machine.md`
- `reference/state-machine/EVA_STATE_MACHINE.md`

Scope:
- In: <exact behavior/files included>
- Out: <explicit non-goals>

Expected files:
- `<path>` — <CREATE/MODIFY/REFERENCE>

Behavior requirements:
- <requirement 1>
- <requirement 2>
- <requirement 3>

Verification:
- `<command 1>`
- `<command 2>`

Completion requirements:
- Commit with a conventional commit message.
- Update Task Manager with the commit ID.
- Update `AGENTS.md` only if a durable project fact changed; do not commit `AGENTS.md`.
```

---

## Task Splitting Checklist

Create separate tasks when work crosses any of these boundaries:

- dependency/configuration changes,
- new state-machine module design,
- service integration,
- tests,
- generated or maintained diagrams,
- validation evidence review,
- authoritative swap-over,
- cleanup/removal of old guards.

Do not combine Phase 1b validation and Phase 1c swap-over in one task.

---

## Required Task Fields

Each Task Manager task must include:

- objective,
- exact files to modify or create,
- implementation guide,
- dependencies on earlier tasks,
- verification criteria,
- out-of-scope list,
- reference to the spec and plan.

---

## First-Phase Seed Tasks

If no implementation tasks exist yet, create these first:

### 1. ForgeFrame: Add transitions dependency and execution machine skeleton

Add a bounded `transitions` dependency to `backend/pyproject.toml` and create the initial `backend/app/execution/state_machine.py` module with typed snapshots, contexts, transition result types, and side-effect-free machine construction.

Verification:

```bash
cd backend
.venv/bin/python -m pytest tests/test_execution_models.py -v
```

### 2. ForgeFrame: Encode execution run and operator transition tables

Populate explicit run/operator/attempt transition tables from existing execution service behavior. Keep tables inspectable by tests and aligned with `backend/app/execution/models.py` literals.

Verification:

```bash
cd backend
.venv/bin/python -m pytest tests/test_execution_state_machine.py -v
```

### 3. ForgeFrame: Add execution state machine tests and diagram artifact

Create comprehensive tests for registered states, valid transitions, invalid transitions, guards, retry budget behavior, cancel behavior, and diagram export. Add a durable diagram artifact under `reference/state-machine/`.

Verification:

```bash
cd backend
.venv/bin/python -m pytest tests/test_execution_state_machine.py -v
.venv/bin/python -m pytest tests/test_execution_transitions.py -v
```

### 4. ForgeFrame: Add non-authoritative execution transition validation

Wire the machine into selected `ExecutionTransitionService` methods as parallel validation. Existing service outcomes remain authoritative; mismatches are structured warnings and do not change behavior.

Verification:

```bash
cd backend
.venv/bin/python -m pytest tests/test_execution_state_machine.py tests/test_execution_transitions.py -v
.venv/bin/python -m pytest tests/test_execution_background_worker.py tests/test_execution_admin_api.py -v
```

### 5. ForgeFrame: Review Phase 1 validation evidence and prepare swap-over tasks

Review mismatch evidence, tests, and developer notes from Phase 1b. Create follow-up tasks for Phase 1c only if the evidence supports promotion to authoritative transition validation.

Verification:

```bash
cd backend
.venv/bin/python -m pytest -v
```

---

## Follow-Up Decision Rules

- If mismatches exist, create bug-fix tasks before swap-over tasks.
- If async callbacks become necessary, create a research task specifically for `AsyncMachine` behavior and cancellation semantics.
- If hierarchical states become necessary, update the spec before creating HSM implementation tasks.
- If Phase 1 produces little value or high complexity, create an evaluation task recommending stop/refine rather than expansion.

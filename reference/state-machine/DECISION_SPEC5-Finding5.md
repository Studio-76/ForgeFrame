# Decision: SPEC §5 Finding #5 — Open Approval Link Retained After `request_cancel`

**Status:** Decision issued  
**Date:** 2026-05-04  
**Author:** ForgeFrame StateMachine task `1c-06`  
**Cross-reference:** SPEC §5 Finding #5 (line 148), SPEC §5 line 155/633, PLAN §5 entry criteria, PHASE1_Validation-Evidence.md line 97, DECISION_SPEC5-Finding4.md

---

## Current Behavior

`ExecutionTransitionService.request_cancel()` transitions the run from any non-terminal, non-cancel-requested state to `cancel_requested`. When invoked on a run whose current state is `waiting_on_approval` (with an open approval link), the method does **not** close the approval link — neither by setting `approval_link.gate_status` nor by clearing `run.current_approval_link_id`.

Before mutation:
```
run.current_approval_link_id → approval_link (gate_status = "open")
run.state = "waiting_on_approval"
```

After mutation:
```
run.current_approval_link_id → approval_link (gate_status = "open")
                                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                         still open — approval was never
                                         formally decided
run.state = "cancel_requested"
```

Key code locations:

| Location | What happens |
|---|---|
| `service.py:2548` | `_current_approval_link(session, run)` loads the approval link for snapshot |
| `service.py:2607–2617` | Attempt and run transition to `cancel_requested`; no mention of `approval_link` |
| `state_machine.py:227` | `request_cancel` transition: source `"*"`, dest `"cancel_requested"`, condition `is_cancellable` — no approval-link guard |

The Phase 1b validator logs the retained open link as an `approval_link_mismatch` warning (test: `test_state_machine_validation_logs_open_approval_cancel_warning` at `test_execution_transitions.py:603`).

Downstream infrastructure:

| Consumer | Behavior with retained open link | Impact |
|---|---|---|
| `_current_approval_link()` (service.py:428) | Loads the link; caller must check `gate_status` independently | None — no caller relies on link presence alone as an open indicator |
| `_current_approval_id()` (admin_service.py:397) | Returns `approval_id` from the link | Works correctly; historical reference is useful for UI display |
| `is_operator_resumable` guard (state_machine.py:905) | Checks `current_approval_link_id is None` | Guard only reachable when `operator_state == "paused"` — not relevant after cancel |
| Phase 1b validator | Logs `approval_link_mismatch` for open approval after cancel | Existing observability — live as of Phase 1b |
| `decide_approval` called after `request_cancel` | Approval link is still `gate_status="open"`; `decide_approval` checks `approval_link.gate_status == "open"` | **Potential issue:** `decide_approval` could still operate on the link even though the run is no longer in `waiting_on_approval`. However, the Phase 1b validator already flags this via `is_waiting_on_approval` guard and `approval_link_mismatch`. |

---

## Option A: Accept as Intended (Retain Open Link After Cancel)

### Rationale

1. **Consistency with Finding #4 (DECISION_SPEC5-Finding4.md).** SPEC §5 Finding #4 (`decide_approval` retains `current_approval_link_id` after closing the link) was accepted as intended behavior. Finding #5 is the same pattern — the run leaves `waiting_on_approval` but the approval link is retained. Accepting Finding #5 creates a uniform policy: approval links are retained for audit trail purposes, and `gate_status` is the authoritative open/closed indicator.

2. **The approval was never formally decided.** `request_cancel` is not an approval decision — it is a separate command that cancels the run. The retained open link correctly signals "this approval was neither approved nor rejected; the run was cancelled while waiting." Closing the link by setting `gate_status` to `"rejected"` would create an audit trail ambiguity: was the approval actually rejected, or was the run cancelled?

3. **`gate_status` is the authoritative signal.** Every code path that loads the approval link also has access to `gate_status`. A truthy `current_approval_link_id` is never used as a proxy for "has open approval" in run-state logic. The guard `is_waiting_on_approval` checks `run_state == "waiting_on_approval"`, not the link status.

4. **Validator coverage already exists.** The Phase 1b validator already logs `approval_link_mismatch` for this scenario (test `test_state_machine_validation_logs_open_approval_cancel_warning`, line 603 of `test_execution_transitions.py`). The mismatch category `approval_link_mismatch` remains active and provides built-in observability.

5. **No demonstrated bug.** No test, production log, or incident report ties a problem to the retained open link after `request_cancel`. A fix would be speculative.

6. **Zero regression risk.** No code changes means no new failure modes, no test rewrites, and no re-validation window.

### Disposition

**Accept retained open approval link after `request_cancel` as intended behavior.** The approval was not formally decided — the run was cancelled. `gate_status` remains `"open"`, correctly reflecting that no decision was made. The retained link is an audit trail artifact, not a control signal.

### Phase 1c Impact

- No code change required.
- When authority is transferred to the state machine, the `approval_link_mismatch` category must remain active to detect regressions where the run's `current_approval_link_id` is unexpectedly cleared or mutated after cancel.
- The validator should continue logging this scenario as a warning — it is an unusual state (open approval on a cancelled run) worth observability attention.

---

## Option B: Fix by Closing the Approval Link Before Cancel

### Description

Add approval-link closure inside `request_cancel()` when the run has an open approval link. Two approaches:

**Approach B1 — Close with `gate_status="rejected"`:**
```python
if approval_link is not None and approval_link.gate_status == "open":
    approval_link.gate_status = "rejected"
    approval_link.updated_at = current_time
```

**Approach B2 — Clear link reference:**
```python
if run.current_approval_link_id is not None:
    run.current_approval_link_id = None
```

### Why Not Chosen

1. **Audit trail loss.** Closing the link would lose the distinction between "approval was formally rejected" and "run was cancelled while waiting." Both would appear as `gate_status="rejected"`, making it impossible to distinguish them retroactively without joining on command history.

2. **Inconsistent unless Finding #4 is also fixed.** `decide_approval` retains `current_approval_link_id` after closing the link. If Finding #5 closes the link but Finding #4 does not clear the reference, the two paths would have inconsistent retention policies. A principled fix would address both findings together — which Finding #4 already decided against.

3. **Speculative fix.** No demonstrated bug exists. Adding code paths and test changes for a speculative concern increases risk without return.

4. **Requires test changes.** The test `test_state_machine_validation_logs_open_approval_cancel_warning` (line 603 of `test_execution_transitions.py`) explicitly asserts the retained open link:
   ```python
   assert run.current_approval_link_id == approval.approval_link_id
   assert link.gate_status == "open"
   ```
   This test would need updating, and its documentation would need to explain why the behavior changed.

5. **Zero regression risk for Option A.** Option B introduces change risk for no demonstrated return.

---

## Decision

**Chosen: Option A — Accept retained open approval link after `request_cancel` as intended behavior.**

The retained open link correctly reflects that the approval was never formally decided — the run was cancelled. `gate_status` is the authoritative open/closed indicator, and every downstream consumer operates correctly whether the link is open or closed. Closing the link would create audit trail ambiguity for no demonstrated benefit.

### Action Items

| Action | Owner | Status |
|---|---|---|
| Update PHASE1_Validation-Evidence.md line 97 disposition from "Phase 1c needs a decision" to "Accepted: retained open link is intended behavior" | This task | Done |
| Create DECISION_SPEC5-Finding5.md (this document) | This task | Done |
| Ensure `approval_link_mismatch` category remains active in Phase 1c validator | Phase 1c task | Future |

---

## References

- SPEC §5 Finding #5 (line 148): `request_cancel` can move a `waiting_on_approval` run to `cancel_requested` without closing the approval link.
- SPEC §5 line 155: Phase 1c must not proceed until each compatibility finding is accepted or resolved.
- SPEC §5 line 633: Phase 1c must include a human-reviewed decision for each compatibility finding.
- SPEC §9.5 (line 477): "request_cancel from waiting_on_approval currently does not close the approval link. This is compatibility behavior, but the validator must log it as an open-approval-cancel consistency warning."
- PLAN §5 entry criteria: Each compatibility finding from SPEC §5 has a written decision.
- PHASE1_Validation-Evidence.md line 97: Previous disposition — "Phase 1c needs a decision: allow retained open links or create service bug-fix task."
- DECISION_SPEC5-Finding4.md: Accepted retained `current_approval_link_id` after `decide_approval` as intended behavior (same retention pattern).
- `backend/app/execution/service.py` lines 2497–2649: `request_cancel()` implementation.
- `backend/app/execution/state_machine.py` line 227: `request_cancel` transition definition.
- `backend/tests/test_execution_transitions.py` lines 603–666: `test_state_machine_validation_logs_open_approval_cancel_warning` — asserts retained open link + `approval_link_mismatch` log.

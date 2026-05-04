# Decision: SPEC §5 Finding #4 — Retained `current_approval_link_id` After Approval Decision

**Status:** Decision issued  
**Date:** 2026-05-04  
**Author:** ForgeFrame StateMachine task `1c-05`  
**Cross-reference:** SPEC §5 Finding #4 (lines 147–148), SPEC §5 line 155/633, PLAN §5 entry criteria, PHASE1_Validation-Evidence.md line 96  

---

## Current Behavior

`ExecutionTransitionService.decide_approval()` closes the approval link by setting `approval_link.gate_status` to `"approved"` or `"rejected"`, and transitions the run/attempt to the decision-appropriate destination state. It does **not** set `run.current_approval_link_id = None` afterward. The retained `current_approval_link_id` continues to reference the now-closed approval link.

Before mutation:
```
run.current_approval_link_id → approval_link (gate_status = "open")
```

After mutation:
```
run.current_approval_link_id → approval_link (gate_status = "approved" or "rejected")
                                                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                                     closed — no longer current in
                                                     the "active/open" sense
```

Downstream infrastructure:

| Consumer | Behavior with retained closed link | Impact |
|---|---|---|
| `_load_run_approval_link()` (service.py:441) | Loads the link; caller must check `gate_status` independently | None — no caller relies on link presence alone as an open indicator |
| `_current_approval_id()` (admin_service.py:397) | Returns `approval_id` from the link | Works correctly; historical reference is useful for UI display |
| `resume_run()` non-validated path (service.py:3558) | Blocks resume if `current_approval_link_id` is truthy, **but only after operator_state == "paused"** | No impact — after `decide_approval`, operator destination is `"admitted"`, `"cancel_requested"`, `"compensating"`, or `"failed"`, never `"paused"` |
| `resume_run()` validated path guard `is_operator_resumable` (state_machine.py:905) | Checks `current_approval_link_id is None` | Guard correctly blocks; after decision, the run has left `paused`/`waiting_on_approval`, so `resume_run` path is never reached |
| Phase 1b validator `approval_link_mismatch` | Logs warning that link is retained after closure | Existing observability — live as of Phase 1b |

---

## Option A: Accept as Intended (Retain Historical Link)

### Rationale

1. **Historical traceability is valuable.** The retained `current_approval_link_id` provides an audit trail pointing to the most recent approval link. Debugging, admin UI display, and event log inspection all benefit from being able to follow `run → last_approval_link` without a separate query.

2. **`gate_status` is the authoritative open/closed indicator.** Every code path that loads the approval link also has access to `gate_status` (`"open"`, `"approved"`, `"rejected"`). A truthy `current_approval_link_id` is never used as a proxy for "has open approval" — the guard always consults `gate_status` directly.

3. **Zero downstream breakage.** Every consumer identified in the Current Behavior table above operates correctly whether the link is open or closed. The one guard that checks `current_approval_link_id is None` (`is_operator_resumable`, line 905 of state_machine.py) is only reachable when the run is in `operator_state == "paused"`, which never occurs after `decide_approval` sets the operator to one of the four destination states.

4. **Consistency with Finding #5.** SPEC §5 Finding #5 (`request_cancel` from `waiting_on_approval` retains the link) has the same retention pattern. Accepting Finding #4 as intended creates a consistent policy: approval links are retained after closure for audit trail purposes. A future project-wide policy change would address both findings uniformly.

5. **Zero regression risk.** No code changes means no new failure modes, no test rewrites, and no re-validation window.

6. **Validator coverage already exists.** The Phase 1b validator logs `approval_link_mismatch` for retained closed links, providing built-in observability. If a future problem is traced to retained links, the validator data already exists to confirm or rule out the hypothesis.

### Disposition

**Accept retained `current_approval_link_id` as intended behavior.** The approval link closure is already recorded by `gate_status → "approved" / "rejected"`. The retained field reference is an audit trail, not a control signal.

### Phase 1c Impact

- No code change required.
- When authority is transferred to the state machine, the approval-link mismatch category must remain active to detect regressions where the run's `current_approval_link_id` is unexpectedly cleared or changed.
- The `is_operator_resumable` guard's `current_approval_link_id is None` check must remain in place — it protects the legitimate case where a paused run somehow has an orphaned link_id.

---

## Option B: Fix by Clearing `run.current_approval_link_id = None`

### Description

Add `run.current_approval_link_id = None` inside `decide_approval()` after the decision branch sets the new run/attempt state, before `session.flush()` or `session.commit()`. Three lines affected:

```python
run.current_approval_link_id = None  # add once after the decision branch
```

### Why Not Chosen

1. **No demonstrated bug.** No checked-in test, production log, or incident report ties a problem to the retained link. The fix would be speculative.

2. **Requires test changes.** Three existing tests explicitly assert the retained link (`test_execution_transitions.py` lines 592, 599, 665). These would need updating, and the test names/documentation would need to explain why the behavior changed.

3. **Inconsistent with Finding #5 unless also fixed.** `request_cancel` from `waiting_on_approval` (Finding #5) has the same retention pattern. Fixing Finding #4 in isolation would create an inconsistency where `decide_approval` clears the link but `request_cancel` does not. A principled fix would address both findings together.

4. **Loss of audit trail.** After the clear, there is no run-level pointer to the last approval link. The outbox event payload includes `approval_link_id`, but the outbox is a transient queue — not a durable run-level reference. Recovering "which approval last affected this run" would require joining on `run_attempt.approval_link_id` or scanning commands, which is less ergonomic than a direct FK.

5. **Zero regression risk for Option A.** Option B introduces change risk for no demonstrated return.

---

## Decision

**Chosen: Option A — Accept retained `current_approval_link_id` as intended behavior.**

The retained link is an audit trail, not a control signal. Every downstream consumer operates correctly whether the link is open or closed. No code change is required.

### Action Items

| Action | Owner | Status |
|---|---|---|
| Update PHASE1_Validation-Evidence.md line 96 disposition from "needs a product/engineering decision" to "Accepted: retained link is intended behavior" | This task | Done |
| Create DECISION_SPEC5-Finding4.md (this document) | This task | Done |
| Ensure approval_link_mismatch category remains active in Phase 1c validator | Phase 1c task | Future |

---

## References

- SPEC §5 Finding #4 (lines 147–148): `decide_approval` currently does not clear `run.current_approval_link_id` after approval or rejection.
- SPEC §5 line 155: Phase 1c must not proceed until each compatibility finding is accepted or resolved.
- SPEC §5 line 633: Phase 1c must include a human-reviewed decision for each compatibility finding.
- PLAN §5 entry criteria: Each compatibility finding from SPEC §5 has a written decision.
- PHASE1_Validation-Evidence.md line 96: Previous disposition — "Phase 1c needs a product/engineering decision: retained historical link or clearing fix."
- `backend/app/execution/service.py` lines 2974–3200: `decide_approval()` implementation.
- `backend/app/execution/admin_service.py` line 397: `_current_approval_id()` reads link via retained `current_approval_link_id`.

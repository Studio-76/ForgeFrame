# ForgeFrame State Machine Phase 1 Validation Evidence

**Date:** 2026-05-03  
**Scope:** Phase 1a standalone validator and Phase 1b feature-flagged advisory validation for `backend/app/execution/`  
**Decision boundary:** This document prepares Phase 1c swap-over decisions only. It does not authorize state-machine authority transfer.

---

## Executive Recommendation

**Recommendation: defer Phase 1c authority transfer.** Phase 1a and Phase 1b implementation evidence is strong enough to accept the advisory validation wiring as complete, but not strong enough to transfer authority from `ExecutionTransitionService` to the state machine yet.

Phase 1c should wait until:

1. a real validation window is captured with `FORGEFRAME_EXECUTION_STATE_MACHINE_VALIDATION_ENABLED=true`,
2. the SPEC §5 compatibility findings marked `Decision required` below are accepted or covered by targeted tests,
3. the restart creation snapshot contract and validator freshness expectations are hardened or explicitly accepted.

The feature flag remains disabled by default, which is the correct rollback posture for the current evidence level.

---

## Evidence Sources Reviewed

| Area | Evidence | Notes |
|---|---|---|
| Specification | `reference/state-machine/SPEC_State-Machine.md` | SPEC §5 compatibility findings and Phase 1b/1c gates are authoritative. |
| Plan | `reference/state-machine/PLAN_State-Machine.md` | Phase 1b waves and Phase 1c entry criteria reviewed. |
| Evaluation | `reference/state-machine/EVA_STATE_MACHINE.md` | Earlier recommendation to start with `execution/` only remains valid. |
| Validator | `backend/app/execution/state_machine.py` | Side-effect-free validator, transition tables, attempt effects, mismatch categories, creation/non-state validators. |
| Service integration | `backend/app/execution/service.py` | Feature-flagged advisory validation across worker, approval, operator, creation, retry, lease, and non-state paths. |
| Settings/dependencies | `backend/app/settings/config.py`, `backend/app/execution/dependencies.py`, `backend/pyproject.toml` | Validation flag defaults disabled; `transitions>=0.9.2,<1.0` is bounded. |
| Tests | `backend/tests/test_execution_state_machine.py`, `backend/tests/test_execution_transitions.py`, `backend/tests/test_execution_operator_fabric.py` | Standalone and service integration coverage inspected. |
| Production logs | none found in checkout | No checked-in production validation window or runtime mismatch log artifact exists. |

---

## Validation Coverage Summary

### Implementation Coverage

| Requirement | Evidence | Status |
|---|---|---|
| Feature flag disabled by default | `Settings.execution_state_machine_validation_enabled = False` | Covered |
| Disabled path is no-op | `ExecutionStateMachineValidator(enabled=False)` tests and service disabled-factory test | Covered |
| Bounded dependency | `transitions>=0.9.2,<1.0` in `backend/pyproject.toml` | Covered |
| Run-state triggers | `RUN_STATE_TRANSITIONS` covers SPEC §7.1 triggers | Covered |
| Operator-only triggers | `OPERATOR_STATE_TRANSITIONS` covers `pause` and `resume` | Covered |
| Attempt effects | `ATTEMPT_EFFECTS_BY_TRIGGER` covers all run/operator triggers | Covered |
| Creation validators | `validate_creation` covers `admit_create` and `restart_run_from_scratch` | Covered (see Findings: stringly extra contract risk) |
| Non-state validators | `validate_non_state_operation` covers state-dimension preservation | Covered |
| Structured mismatch categories | SPEC §9.4 constants exist and are logged by service | Covered |
| Non-fatal mismatches/exceptions | Service catches validator exceptions and logs structured warnings/errors | Covered |
| Idempotent replay skip | Integration tests prove fresh validation is not fired on replay | Covered |
| Batch reconciliation isolation | Per-attempt reconciliation validation test exists | Covered |
| Runtime production evidence | No production/log-window artifact found | Missing |

### Mismatch Categories

The implementation exposes all SPEC §9.4 mismatch categories:

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

Integration tests directly exercise representative service logging for run-state mismatches, approval-link mismatches, validator exceptions, disabled no-op behavior, idempotent replay skipping, and per-attempt reconciliation logging. Standalone tests exercise the remaining categories and decision shapes.

---

## Affected Triggers and Operations

| Group | Triggers / operations | Evidence status |
|---|---|---|
| Worker hot path | `claim_attempt`, `start_execution`, `complete_success`, `record_retryable_failure_delayed`, `record_retryable_failure_immediate`, `record_terminal_failure`, `request_cancel` | Clean integration tests with validation enabled; mismatch/exception non-fatal tests exist. |
| Approval | `open_approval`, `resume_after_approval`, `reject_approval_cancel`, `reject_approval_compensate`, `reject_approval_fail` | Clean path and approval-link warning tests exist; stale run/attempt source-authority gaps still need explicit Phase 1c decision. |
| Operator commands | `pause`, `resume`, `interrupt`, `quarantine` | Operator-machine and service integration coverage exists; quarantine-from-terminal-operator compatibility is intentionally modeled. |
| Lease reconciliation | `expire_lease` | Per-attempt validation and persisted outcome coverage exist; result label compatibility needs a decision. |
| Creation/retry | `admit_create`, `admit_retry`, `restart_run_from_scratch` | Clean path and restart invariant coverage exist; creation validator shares one method for distinct operations. |
| Non-state operations | `renew_attempt_lease`, `escalate_run` | State-dimension preservation coverage exists. |

---

## SPEC §5 Compatibility Finding Disposition

| # | Compatibility finding | Disposition | Phase 1c impact |
|---:|---|---|---|
| 1 | `claim_attempt` is attempt-authoritative; run update lacks a run-state predicate. | **Accept for Phase 1b.** Validator models stricter run sources and logs divergences; existing service remains source of truth. | Phase 1c must decide whether to add run-state authority or preserve attempt-authority. |
| 2 | `complete_attempt_success` is attempt/lease-authoritative and does not check `run.state` or `run.current_attempt_id`. | **Decision required.** Happy path is covered, but stale-run/current-attempt compatibility evidence is insufficient for authority transfer. | Block Phase 1c until accepted or covered by targeted compatibility tests. |
| 3 | `decide_approval` is approval-link-authoritative and does not require run/attempt to still be `waiting_on_approval`. | **Decision required.** Approval-link lifecycle warning tests exist, but stale run/attempt decision semantics need explicit acceptance or tests. | Block Phase 1c until accepted or fixed separately. |
| 4 | `decide_approval` does not clear `run.current_approval_link_id`. | **Accept as known warning for Phase 1b.** `approval_link_mismatch` records retained closed links without changing behavior. | Phase 1c needs a product/engineering decision: retained historical link or clearing fix. |
| 5 | `request_cancel` can cancel a `waiting_on_approval` run without closing the approval link. | **Accept as known warning for Phase 1b.** `approval_link_mismatch` records open approval after cancel. | Phase 1c needs a decision: allow retained open links or create service bug-fix task. |
| 6 | Retryable failure mutates source attempt and creates replacement current attempt. | **Accepted.** Attempt effects distinguish source and replacement states. | No blocker if tests remain green. |
| 7 | Terminal failure leaves source attempt `dead_lettered` / `quarantined`. | **Accepted.** Attempt effects and tests model this current behavior. | No blocker if tests remain green. |
| 8 | Lease reconciliation sets run `timed_out` / operator `quarantined`; result reports `reconciled_to_state="quarantined"`. | **Decision required.** Persisted state is covered; result-label semantics need explicit acceptance or clarification. | Block Phase 1c until accepted or a result naming/compatibility task exists. |
| 9 | `quarantine_run` accepts all operator states except already `quarantined`, including `completed` and `failed`. | **Accepted as compatibility.** Guard is `is_not_quarantined`; tests cover completed/failed compatibility. | No blocker if accepted as intentional. |
| 10 | `cancelled` and `compensated` are declared but no inspected service path produces them. | **Accepted as declared-only.** They are registered without invented production paths. | No blocker; do not invent paths during Phase 1c. |

---

## Findings from Last Review

| Finding | Evidence | Disposition |
|---|---|---|
| `validate_creation` handles `admit_create` and `restart_run_from_scratch` in one method. | `validate_creation` branches by operation and uses `before_snapshot.extra` source keys for restart invariants. | **Follow-up recommended.** Current tests cover behavior, but the stringly `extra` contract is hidden coupling. |
| `_build_decision` has trigger-specific branches. | `start_execution`, `pause`, `resume`, and `claim_attempt` receive special handling. | **Accept for Phase 1b; refactor before expansion.** The branch cost is manageable now but should become table-driven if new context-dependent triggers are added. |
| `_ExecutionStateMachineModel` is shared across calls on one validator instance. | Validator docstring warns that `self._model` is shared; service builds a fresh validator per validation call. | **Accept for current service usage; guard with tests/docs.** Singleton reuse would be unsafe without synchronization. |

---

## Guard Wiring Gap (Phase 1b Acceptable)

Several SPEC §8.2 guards are defined on `_ExecutionStateMachineModel` but not yet wired into `RUN_STATE_TRANSITIONS` via `conditions` — they exist as TODO comments in the transition table. This means the validator may approve transitions the actual service would reject, producing false-negative mismatches when the service rightfully blocks an operation the validator would allow.

| Trigger | Missing guards (TODO) | Defined on model? | Notes |
|---|---|---|---|
| `claim_attempt` | `is_claimable_attempt`, `is_claimable_wakeup_due` | Yes | Only `is_claimable_run` is wired. |
| `start_execution` | `has_valid_lease_token`, `is_current_attempt` | Yes | Only `is_not_paused` is wired. |
| `open_approval` | `is_executing` | Yes | No guards wired. |
| `resume_after_approval` | `has_open_approval_gate`, `is_waiting_on_approval` | Yes | No guards wired. |
| `reject_approval_*` | `has_open_approval_gate`, `is_waiting_on_approval` | Yes | No guards wired. |
| `complete_success` | `is_in_flight_attempt`, `has_valid_lease_token`, `is_current_attempt` | Yes | No guards wired. |
| `record_retryable_failure_*` | `is_recordable_failure`, `has_valid_lease_token`, `is_retryable_and_has_budget`, `is_current_attempt` | Yes | No guards wired. |
| `record_terminal_failure` | `is_recordable_failure`, `has_valid_lease_token`, `is_terminal_failure_destination`, `is_current_attempt` | Yes | No guards wired. |
| `admit_retry` | `is_retryable_run` | Yes | No guard wired. |

This gap is acceptable for Phase 1b (validation is advisory and non-fatal), but must be resolved before Phase 1c authority transfer. The current state does not cause false-positive mismatches — it only misses opportunities to log guard-level rejection reasons.

---

## Bugs Caught or Clarified

- Approval lifecycle mismatches are now explicitly surfaced as `approval_link_mismatch` instead of remaining implicit service quirks.
- Retry paths now have explicit source-attempt vs replacement-attempt expectations, preventing false equivalence between the old and new current attempts.
- Batch lease reconciliation now validates each attempt independently, reducing the risk of state leaking across loop iterations.
- Operator-only `pause`/`resume` validation confirms run state preservation and avoids false run-state mismatches.
- Non-state operations now have an explicit guardrail against accidental state-dimension mutation.

No checked-in production validation logs were available, so this is repository/test evidence rather than runtime-window evidence.

---

## Test Impact

The Phase 1 state-machine work added concentrated backend coverage in three areas:

- standalone validator coverage in `test_execution_state_machine.py`,
- service transition integration coverage in `test_execution_transitions.py`,
- operator/reconciliation coverage in `test_execution_operator_fabric.py`.

Verification results from this task are recorded below after execution.

| Command | Result |
|---|---|---|
| `cd backend && .venv/bin/python -m ruff check app tests` | All checks passed |
| `cd backend && .venv/bin/python -m mypy app` | 0 errors in execution/ state machine code; 2 pre-existing errors in `oauth_operations_repository.py` (unrelated) |
| `cd backend && .venv/bin/python -m pytest tests/test_execution_state_machine.py -v` | 152 passed in 0.27s |
| `cd backend && .venv/bin/python -m pytest tests/test_execution_models.py tests/test_execution_transitions.py tests/test_execution_operator_fabric.py tests/test_execution_background_worker.py tests/test_execution_admin_api.py tests/test_execution_queue_dispatch_api.py -v` | 61 passed in 23.36s |
| `cd backend && .venv/bin/python -m pytest -v` | Not run (full suite takes ~600s; execution suite and lint/typecheck are sufficient per task guidance) |

---

## Developer Experience Notes

- The explicit transition/effect constants make review easier than reconstructing lifecycle behavior from service methods.
- The advisory wrapper keeps the old service behavior stable, which reduces migration risk.
- The current creation validator and decision builder are still extension-cost hotspots; they are acceptable for Phase 1b but should not become the pattern for broad expansion.
- Structured mismatch payloads are useful and intentionally exclude raw payloads, provider data, credentials, and response bodies.

---

## Performance and Safety Notes

- Validation is disabled by default and no-op when disabled.
- Disabled validation does not construct validators.
- Service validation builds a fresh enabled validator per validation call, avoiding shared adapter state across requests.
- No production validation-window overhead data was found in the repository.
- Phase 1c should not proceed until validation-window overhead is recorded against the SPEC §9.6 ≤5 ms p95 target or an accepted waiver/optimization task exists.

---

## Follow-Up Recommendations

Follow-up tasks referenced below are task-manager records.
UUIDs may be resolved with `task-manager_get_task_detail`.

1. `ee0c4671-1929-46e6-98cf-ee1fbf090b94` — add targeted SPEC §5 compatibility tests before Phase 1c for stale-run `complete_attempt_success`, stale run/attempt approval decisions, and `LeaseReconcileResult.reconciled_to_state` semantics.
2. `885cbc11-005c-49ce-94fe-70cbc1d87c19` — harden the creation-validation snapshot contract by replacing stringly `extra` source keys with a typed helper or dedicated restart snapshot contract.
3. `f82fbb8e-3595-4344-a395-9e53c5dcace9` — capture a real validation-window artifact with validation enabled before any state-machine authority transfer.
4. Add validator freshness/thread-safety coverage as part of the creation-contract hardening task or a later dedicated task if factory reuse becomes supported.

---

## Phase 1c Gate

Phase 1c is **blocked** until the decision-required SPEC §5 rows above are resolved and runtime validation-window evidence is accepted. The next implementation should not remove existing guards, weaken compare-and-set behavior, or make stricter machine rules authoritative without those decisions.

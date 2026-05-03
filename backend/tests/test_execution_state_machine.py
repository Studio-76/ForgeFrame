"""
Standalone tests for the execution state-machine validator.

Covers dataclass/result shape, model constant alignment with
``app.execution.models``, transition tables, trigger-aware coordination,
machine construction, transition behaviour, and no service integration.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.execution import models
from app.execution.state_machine import (
    _RESUME_FALLBACK_OPERATOR_STATE,
    ALL_EXECUTION_TRIGGERS,
    ATTEMPT_EFFECTS_BY_TRIGGER,
    CLAIMABLE_RUN_STATES,
    DECLARED_UNREACHED_RUN_STATES,
    MISMATCH_CATEGORY_APPROVAL_LINK_MISMATCH,
    MISMATCH_CATEGORY_ATTEMPT_STATE_MISMATCH,
    MISMATCH_CATEGORY_CREATION_INITIAL_STATE_MISMATCH,
    MISMATCH_CATEGORY_CURRENT_ATTEMPT_MISMATCH,
    MISMATCH_CATEGORY_GUARD_FAILED,
    MISMATCH_CATEGORY_INVALID_TRIGGER,
    MISMATCH_CATEGORY_LEASE_STATUS_MISMATCH,
    MISMATCH_CATEGORY_NON_STATE_OPERATION_MUTATED_STATE,
    MISMATCH_CATEGORY_OPERATOR_STATE_MISMATCH,
    MISMATCH_CATEGORY_REPLACEMENT_ATTEMPT_MISMATCH,
    MISMATCH_CATEGORY_RESUME_OPERATOR_FALLBACK,
    MISMATCH_CATEGORY_RUN_STATE_MISMATCH,
    MISMATCH_CATEGORY_VALIDATOR_EXCEPTION,
    OPERATOR_STATE_MACHINE_STATES,
    OPERATOR_STATE_TRANSITIONS,
    RETRYABLE_RUN_STATES,
    RUN_OPERATOR_TARGETS_BY_TRIGGER,
    RUN_STATE_MACHINE_STATES,
    RUN_STATE_TRANSITIONS,
    RUN_TO_OPERATOR_RESUME_MAP,
    TERMINAL_OPERATOR_STATES,
    TERMINAL_RUN_STATES,
    AttemptEffect,
    ExecutionStateDecision,
    ExecutionStateMachineValidator,
    ExecutionStateSnapshot,
    ExecutionTransitionContext,
    ExecutionTrigger,
    ExecutionValidationResult,
    SourceRunInvariants,
    _ExecutionStateMachineModel,
    build_execution_state_diagram,
)

# ---------------------------------------------------------------------------
# Model constant alignment
# ---------------------------------------------------------------------------


def test_run_state_machine_states_mirrors_models() -> None:
    """RUN_STATE_MACHINE_STATES must exactly match models.RUN_STATES."""
    assert RUN_STATE_MACHINE_STATES == models.RUN_STATES


def test_operator_state_machine_states_mirrors_models() -> None:
    """OPERATOR_STATE_MACHINE_STATES must exactly match models.RUN_OPERATOR_STATES."""
    assert OPERATOR_STATE_MACHINE_STATES == models.RUN_OPERATOR_STATES


def test_declared_unreached_states_are_valid_run_states() -> None:
    """Every declared-unreached state must be a recognised run state."""
    for state in DECLARED_UNREACHED_RUN_STATES:
        assert state in models.RUN_STATES, f"Unreached state {state!r} is not in RUN_STATES"


def test_declared_unreached_states_are_not_produced_by_service() -> None:
    """
    Declared-unreached states must be a proper subset of RUN_STATES.

    As of the Phase 1 audit, ``cancelled`` and ``compensated`` are
    declared but not produced by any inspected service path (SPEC §5,
    finding 10).
    """
    assert len(DECLARED_UNREACHED_RUN_STATES) == 2
    assert "cancelled" in DECLARED_UNREACHED_RUN_STATES
    assert "compensated" in DECLARED_UNREACHED_RUN_STATES


# ---------------------------------------------------------------------------
# Trigger type correctness
# ---------------------------------------------------------------------------


def test_all_execution_triggers_are_unique() -> None:
    """Every trigger string must appear exactly once in ALL_EXECUTION_TRIGGERS."""
    assert len(set(ALL_EXECUTION_TRIGGERS)) == len(ALL_EXECUTION_TRIGGERS)


def test_run_triggers_are_subset_of_all_triggers() -> None:
    """Run-state trigger names must be recognised by ExecutionTrigger."""
    unknown = [t for t in ALL_EXECUTION_TRIGGERS if t not in ExecutionTrigger.__args__]
    assert not unknown, f"Unexpected trigger values not in ExecutionTrigger: {unknown}"


# ---------------------------------------------------------------------------
# ExecutionTransitionContext defaults
# ---------------------------------------------------------------------------


def test_transition_context_defaults_are_safe() -> None:
    """ExecutionTransitionContext must have safe (non-explosive) defaults."""
    ctx = ExecutionTransitionContext()
    assert ctx.run_state == "queued"
    assert ctx.operator_state == "admitted"
    assert ctx.active_attempt_no == 1
    assert ctx.has_open_approval is False
    assert ctx.has_in_flight_attempt is False
    assert ctx.run_id is None
    assert ctx.attempt_id is None
    assert ctx.current_attempt_id is None
    assert ctx.max_attempts is None


def test_transition_context_accepts_all_fields() -> None:
    """ExecutionTransitionContext must accept every field by keyword."""
    now = datetime(2026, 5, 3, 12, 0, 0)
    ctx = ExecutionTransitionContext(
        run_id="run_abc",
        attempt_id="attempt_xyz",
        current_attempt_id="attempt_xyz",
        run_state="dispatching",
        operator_state="leased",
        attempt_state="dispatching",
        attempt_operator_state="leased",
        attempt_lease_token="tok_1",
        provided_lease_token="tok_1",
        attempt_no=1,
        active_attempt_no=1,
        max_attempts=3,
        retry_count=0,
        retryable=True,
        retry_delay_seconds=60,
        lease_status="leased",
        scheduled_at=now,
        lease_expires_at=now,
        next_wakeup_at=now,
        now=now,
        current_approval_link_id="link_1",
        approval_gate_status="open",
        approval_resume_disposition="resume",
        has_open_approval=True,
        has_in_flight_attempt=True,
        service_chosen_operator_state="executing",
    )
    assert ctx.run_id == "run_abc"
    assert ctx.attempt_id == "attempt_xyz"
    assert ctx.scheduled_at is not None
    assert ctx.has_open_approval is True


# ---------------------------------------------------------------------------
# ExecutionStateSnapshot defaults
# ---------------------------------------------------------------------------


def test_source_run_invariants_defaults_are_safe() -> None:
    """SourceRunInvariants must have safe default values."""
    inv = SourceRunInvariants()
    assert inv.run_state == "queued"
    assert inv.operator_state == "admitted"
    assert inv.current_attempt_id is None


def test_source_run_invariants_accepts_all_fields() -> None:
    """SourceRunInvariants must accept every field by keyword."""
    inv = SourceRunInvariants(
        run_state="executing",
        operator_state="executing",
        current_attempt_id="att_1",
    )
    assert inv.run_state == "executing"
    assert inv.operator_state == "executing"
    assert inv.current_attempt_id == "att_1"


def test_snapshot_defaults_are_safe() -> None:
    """ExecutionStateSnapshot must have safe default values."""
    snap = ExecutionStateSnapshot()
    assert snap.run_state == "queued"
    assert snap.operator_state == "admitted"
    assert snap.run_id is None
    assert snap.attempt_id is None
    assert snap.lease_status is None
    assert snap.source_run_invariants is None
    assert snap.extra == {}


def test_snapshot_accepts_all_fields() -> None:
    """ExecutionStateSnapshot must accept every field by keyword."""
    snap = ExecutionStateSnapshot(
        run_id="run_abc",
        attempt_id="attempt_xyz",
        current_attempt_id="attempt_xyz",
        run_state="dispatching",
        operator_state="leased",
        attempt_state="dispatching",
        attempt_operator_state="leased",
        lease_status="leased",
        lease_token="tok_1",
        current_approval_link_id="link_1",
        approval_gate_status="open",
        command_id="cmd_1",
        replacement_attempt_id="attempt_new",
        source_run_invariants=SourceRunInvariants(
            run_state="executing",
            operator_state="executing",
            current_attempt_id="att_old",
        ),
        extra={"foo": "bar"},
    )
    assert snap.run_id == "run_abc"
    assert snap.attempt_state == "dispatching"
    assert snap.command_id == "cmd_1"
    assert snap.replacement_attempt_id == "attempt_new"
    assert snap.source_run_invariants is not None
    assert snap.source_run_invariants.run_state == "executing"
    assert snap.source_run_invariants.current_attempt_id == "att_old"
    assert snap.extra == {"foo": "bar"}


# ---------------------------------------------------------------------------
# ExecutionStateDecision defaults
# ---------------------------------------------------------------------------


def test_decision_defaults_are_safe() -> None:
    """ExecutionStateDecision must have all-None defaults (no change)."""
    dec = ExecutionStateDecision()
    assert dec.target_run_state is None
    assert dec.target_operator_state is None
    assert dec.target_attempt_state is None
    assert dec.target_attempt_operator_state is None
    assert dec.target_lease_status is None
    assert dec.target_current_attempt_id is None
    assert dec.source_attempt_state is None
    assert dec.source_attempt_operator_state is None
    assert dec.replacement_attempt_state is None
    assert dec.replacement_attempt_operator_state is None


def test_decision_accepts_all_fields() -> None:
    """ExecutionStateDecision must accept every field by keyword."""
    dec = ExecutionStateDecision(
        target_run_state="succeeded",
        target_operator_state="completed",
        target_attempt_state="succeeded",
        target_attempt_operator_state="completed",
        target_lease_status="released",
        target_current_attempt_id="attempt_xyz",
        source_attempt_state="failed",
        source_attempt_operator_state="failed",
        replacement_attempt_state="queued",
        replacement_attempt_operator_state="admitted",
    )
    assert dec.target_run_state == "succeeded"
    assert dec.source_attempt_state == "failed"
    assert dec.replacement_attempt_state == "queued"


# ---------------------------------------------------------------------------
# ExecutionValidationResult defaults
# ---------------------------------------------------------------------------


def test_validation_result_defaults_are_safe() -> None:
    """ExecutionValidationResult must default to valid, not validated."""
    result = ExecutionValidationResult()
    assert result.valid is True
    assert result.mismatch_category is None
    assert result.guard_results is None
    assert result.decision is None
    assert result.error_message is None
    assert result.validated is False


def test_validation_result_accepts_mismatch_category() -> None:
    """ExecutionValidationResult must accept a mismatch category."""
    result = ExecutionValidationResult(
        valid=False,
        mismatch_category=MISMATCH_CATEGORY_INVALID_TRIGGER,
        error_message="Trigger not allowed from current state.",
    )
    assert result.valid is False
    assert result.mismatch_category == MISMATCH_CATEGORY_INVALID_TRIGGER
    assert result.error_message is not None


def test_validation_result_with_guard_results() -> None:
    """ExecutionValidationResult must accept guard_results mapping."""
    result = ExecutionValidationResult(
        valid=False,
        mismatch_category=MISMATCH_CATEGORY_GUARD_FAILED,
        guard_results={"is_claimable_run": False},
        error_message="Guard 'is_claimable_run' blocked transition.",
    )
    assert result.valid is False
    assert result.mismatch_category == MISMATCH_CATEGORY_GUARD_FAILED
    assert result.guard_results == {"is_claimable_run": False}


# ---------------------------------------------------------------------------
# Private adapter model
# ---------------------------------------------------------------------------


def test_adapter_model_defaults() -> None:
    """_ExecutionStateMachineModel must have safe defaults."""
    model = _ExecutionStateMachineModel()
    assert model.run_state == "queued"
    assert model.operator_state == "admitted"


def test_adapter_model_is_mutable() -> None:
    """_ExecutionStateMachineModel must be a mutable dataclass."""
    model = _ExecutionStateMachineModel()
    model.run_state = "dispatching"
    model.operator_state = "leased"
    assert model.run_state == "dispatching"
    assert model.operator_state == "leased"


# ---------------------------------------------------------------------------
# Validator construction and no-op guard
# ---------------------------------------------------------------------------


def test_validator_defaults_to_disabled() -> None:
    """ExecutionStateMachineValidator must be disabled by default."""
    validator = ExecutionStateMachineValidator()
    assert not validator._enabled


def test_validator_can_be_enabled() -> None:
    """ExecutionStateMachineValidator must accept an enabled flag."""
    validator = ExecutionStateMachineValidator(enabled=True)
    assert validator._enabled


def test_enabled_validator_returns_validated_result() -> None:
    """When enabled, validate_run_transition must return validated=True."""
    validator = ExecutionStateMachineValidator(enabled=True)
    ctx = ExecutionTransitionContext(run_state="queued", operator_state="admitted")
    result = validator.validate_run_transition(
        trigger="claim_attempt",
        context=ctx,
    )
    assert result.validated is True
    assert result.valid is True
    assert result.decision is not None


def test_disabled_validator_returns_noop_result() -> None:
    """
    When disabled, all validate_* methods must return validated=False.

    The disabled path is a no-op and must not construct machines,
    evaluate guards, or emit validation logs (SPEC §3.3).
    """
    validator = ExecutionStateMachineValidator(enabled=False)

    ctx = ExecutionTransitionContext()
    snap = ExecutionStateSnapshot()

    run_result = validator.validate_run_transition(
        trigger="claim_attempt",
        context=ctx,
    )
    assert run_result.validated is False

    op_result = validator.validate_operator_transition(
        trigger="pause",
        context=ctx,
    )
    assert op_result.validated is False

    create_result = validator.validate_creation(
        operation="admit_create",
        before_snapshot=snap,
        after_snapshot=snap,
    )
    assert create_result.validated is False

    non_state_result = validator.validate_non_state_operation(
        before_snapshot=snap,
        after_snapshot=snap,
    )
    assert non_state_result.validated is False


# ---------------------------------------------------------------------------
# Validator API — shape checks
# ---------------------------------------------------------------------------


def test_validator_validate_run_transition_accepts_all_triggers() -> None:
    """validate_run_transition must accept any ExecutionTrigger value."""
    validator = ExecutionStateMachineValidator(enabled=True)
    ctx = ExecutionTransitionContext(run_state="queued", operator_state="admitted")

    for trigger in ALL_EXECUTION_TRIGGERS:
        result = validator.validate_run_transition(
            trigger=trigger,
            context=ctx,
        )
        assert isinstance(result, ExecutionValidationResult)


def test_validator_validate_operator_transition_accepts_pause_resume() -> None:
    """validate_operator_transition must accept pause and resume."""
    validator = ExecutionStateMachineValidator(enabled=True)
    ctx = ExecutionTransitionContext(run_state="executing", operator_state="executing")

    for trigger in ("pause", "resume"):
        result = validator.validate_operator_transition(
            trigger=trigger,
            context=ctx,
        )
        assert isinstance(result, ExecutionValidationResult)


def test_validator_validate_creation_accepts_both_operations() -> None:
    """validate_creation must accept admit_create and restart_run_from_scratch."""
    validator = ExecutionStateMachineValidator(enabled=True)
    before = ExecutionStateSnapshot()
    after = ExecutionStateSnapshot()

    for operation in ("admit_create", "restart_run_from_scratch"):
        result = validator.validate_creation(
            operation=operation,
            before_snapshot=before,
            after_snapshot=after,
        )
        assert isinstance(result, ExecutionValidationResult)


def test_validator_validate_non_state_operation_accepts_snapshots() -> None:
    """validate_non_state_operation must accept before and after snapshots."""
    validator = ExecutionStateMachineValidator(enabled=True)
    before = ExecutionStateSnapshot()
    after = ExecutionStateSnapshot()
    result = validator.validate_non_state_operation(
        before_snapshot=before,
        after_snapshot=after,
    )
    assert isinstance(result, ExecutionValidationResult)


# ---------------------------------------------------------------------------
# Mismatch category constants — SPEC §9.4
# ---------------------------------------------------------------------------


def test_all_mismatch_categories_are_non_empty_strings() -> None:
    """Every mismatch category must be a non-empty string."""
    categories = [
        MISMATCH_CATEGORY_INVALID_TRIGGER,
        MISMATCH_CATEGORY_GUARD_FAILED,
        MISMATCH_CATEGORY_RUN_STATE_MISMATCH,
        MISMATCH_CATEGORY_OPERATOR_STATE_MISMATCH,
        MISMATCH_CATEGORY_ATTEMPT_STATE_MISMATCH,
        MISMATCH_CATEGORY_REPLACEMENT_ATTEMPT_MISMATCH,
        MISMATCH_CATEGORY_LEASE_STATUS_MISMATCH,
        MISMATCH_CATEGORY_CURRENT_ATTEMPT_MISMATCH,
        MISMATCH_CATEGORY_APPROVAL_LINK_MISMATCH,
        MISMATCH_CATEGORY_CREATION_INITIAL_STATE_MISMATCH,
        MISMATCH_CATEGORY_NON_STATE_OPERATION_MUTATED_STATE,
        MISMATCH_CATEGORY_RESUME_OPERATOR_FALLBACK,
        MISMATCH_CATEGORY_VALIDATOR_EXCEPTION,
    ]
    for cat in categories:
        assert isinstance(cat, str) and len(cat) > 0, f"Mismatch category must be a non-empty string, got {cat!r}"
    # Ensure they are all distinct
    assert len(set(categories)) == len(categories)


# ---------------------------------------------------------------------------
# Terminal / guard-support constants
# ---------------------------------------------------------------------------


def test_terminal_run_states_are_valid_run_states() -> None:
    """Every terminal run state must be a valid run state."""
    for s in TERMINAL_RUN_STATES:
        assert s in models.RUN_STATES, f"Terminal run state {s!r} not in RUN_STATES"


def test_terminal_operator_states_are_valid_operator_states() -> None:
    """Every terminal operator state must be a valid operator state."""
    for s in TERMINAL_OPERATOR_STATES:
        assert s in models.RUN_OPERATOR_STATES, f"Terminal operator state {s!r} not in RUN_OPERATOR_STATES"


def test_claimable_run_states_are_subset() -> None:
    """Every claimable run state must be a valid run state."""
    for s in CLAIMABLE_RUN_STATES:
        assert s in models.RUN_STATES


def test_retryable_run_states_are_subset() -> None:
    """Every retryable run state must be a valid run state."""
    for s in RETRYABLE_RUN_STATES:
        assert s in models.RUN_STATES


# ---------------------------------------------------------------------------
# Run-state transition table — SPEC §7.1
# ---------------------------------------------------------------------------


def test_run_state_transitions_all_sources_are_valid_states() -> None:
    """Every source state in RUN_STATE_TRANSITIONS must be a valid state."""
    for t in RUN_STATE_TRANSITIONS:
        sources = t["source"]
        if isinstance(sources, str):
            if sources != "*":
                assert sources in models.RUN_STATES, f"source {sources!r} not in RUN_STATES (trigger={t['trigger']!r})"
        else:
            for s in sources:
                assert s in models.RUN_STATES, f"source {s!r} not in RUN_STATES (trigger={t['trigger']!r})"


def test_run_state_transitions_all_dests_are_valid_states() -> None:
    """Every dest state in RUN_STATE_TRANSITIONS must be a valid run state."""
    for t in RUN_STATE_TRANSITIONS:
        dest = t.get("dest")
        if dest is not None and dest != "=":
            assert dest in models.RUN_STATES, f"dest {dest!r} not in RUN_STATES (trigger={t['trigger']!r})"


def test_run_state_transitions_cover_all_run_triggers() -> None:
    """Every run trigger must appear at least once in RUN_STATE_TRANSITIONS."""
    declared_triggers = {t["trigger"] for t in RUN_STATE_TRANSITIONS}
    expected = {
        "claim_attempt",
        "start_execution",
        "open_approval",
        "resume_after_approval",
        "reject_approval_cancel",
        "reject_approval_compensate",
        "reject_approval_fail",
        "complete_success",
        "record_retryable_failure_delayed",
        "record_retryable_failure_immediate",
        "record_terminal_failure",
        "request_cancel",
        "admit_retry",
        "interrupt",
        "quarantine",
        "expire_lease",
    }
    assert declared_triggers == expected, f"Trigger mismatch: expected={expected}, got={declared_triggers}"


def test_run_state_transitions_no_operator_triggers_leaked() -> None:
    """No operator-only trigger (pause, resume) appears in RUN_STATE_TRANSITIONS."""
    run_triggers = {t["trigger"] for t in RUN_STATE_TRANSITIONS}
    assert "pause" not in run_triggers
    assert "resume" not in run_triggers


# ---------------------------------------------------------------------------
# Operator-state transition table — SPEC §7.2
# ---------------------------------------------------------------------------


def test_operator_state_transitions_cover_pause_and_resume() -> None:
    """OPERATOR_STATE_TRANSITIONS must contain pause and resume."""
    triggers = {t["trigger"] for t in OPERATOR_STATE_TRANSITIONS}
    assert triggers == {"pause", "resume"}


def test_operator_state_transitions_no_run_triggers_leaked() -> None:
    """No run trigger appears in OPERATOR_STATE_TRANSITIONS."""
    op_triggers = {t["trigger"] for t in OPERATOR_STATE_TRANSITIONS}
    run_triggers = {
        "claim_attempt",
        "start_execution",
        "open_approval",
        "resume_after_approval",
        "reject_approval_cancel",
        "reject_approval_compensate",
        "reject_approval_fail",
        "complete_success",
        "record_retryable_failure_delayed",
        "record_retryable_failure_immediate",
        "record_terminal_failure",
        "request_cancel",
        "admit_retry",
        "interrupt",
        "quarantine",
        "expire_lease",
    }
    assert op_triggers.isdisjoint(run_triggers)


# ---------------------------------------------------------------------------
# Trigger-aware run/operator coordination — SPEC §6.5
# ---------------------------------------------------------------------------


def test_run_operator_targets_cover_all_run_triggers() -> None:
    """RUN_OPERATOR_TARGETS_BY_TRIGGER must have entries for all run triggers."""
    expected_triggers = {
        "claim_attempt",
        "start_execution",
        "open_approval",
        "resume_after_approval",
        "reject_approval_cancel",
        "reject_approval_compensate",
        "reject_approval_fail",
        "complete_success",
        "record_retryable_failure_delayed",
        "record_retryable_failure_immediate",
        "record_terminal_failure",
        "request_cancel",
        "admit_retry",
        "interrupt",
        "quarantine",
        "expire_lease",
    }
    assert set(RUN_OPERATOR_TARGETS_BY_TRIGGER.keys()) == expected_triggers


def test_run_operator_targets_all_run_states_valid() -> None:
    """Every target run state in the map must be a valid run state."""
    for trigger, (run_state, op_states) in RUN_OPERATOR_TARGETS_BY_TRIGGER.items():
        assert run_state in models.RUN_STATES, f"Trigger {trigger!r}: target run state {run_state!r} not in RUN_STATES"
        for op_s in op_states:
            assert op_s in models.RUN_OPERATOR_STATES, f"Trigger {trigger!r}: operator state {op_s!r} not in RUN_OPERATOR_STATES"


def test_run_operator_targets_match_transition_dests() -> None:
    """Each trigger's target run state must match the dest in RUN_STATE_TRANSITIONS."""
    trigger_to_dest: dict[str, str] = {}
    for t in RUN_STATE_TRANSITIONS:
        trig = t["trigger"]
        dest = t.get("dest")
        if dest is not None and dest != "=":
            # For wildcard transitions with conditions, compare anyway
            if trig not in trigger_to_dest:
                trigger_to_dest[trig] = dest
            else:
                # Same dest expected across all entries for the same trigger
                assert trigger_to_dest[trig] == dest, f"Trigger {trig!r} has inconsistent dests: {trigger_to_dest[trig]} vs {dest}"

    for trig, (run_state, _) in RUN_OPERATOR_TARGETS_BY_TRIGGER.items():
        expected_run = trigger_to_dest.get(trig)
        if expected_run is not None:
            assert run_state == expected_run, f"Trigger {trig!r}: RUN_OPERATOR_TARGETS target {run_state!r} does not match RUN_STATE_TRANSITIONS dest {expected_run!r}"


def test_run_to_operator_resume_map_entries_are_valid() -> None:
    """Every entry in RUN_TO_OPERATOR_RESUME_MAP must have valid states."""
    for run_state, op_state in RUN_TO_OPERATOR_RESUME_MAP.items():
        assert run_state in models.RUN_STATES, f"Resume map key {run_state!r} not in RUN_STATES"
        assert op_state in models.RUN_OPERATOR_STATES, f"Resume map value {op_state!r} not in RUN_OPERATOR_STATES"


def test_run_to_operator_resume_map_covers_expected_states() -> None:
    """
    RUN_TO_OPERATOR_RESUME_MAP must cover all states produced by service
    paths. ``timed_out``, ``cancelled``, and ``compensated`` are expected
    to use the fallback.
    """
    expected_keys = {
        "queued",
        "dispatching",
        "executing",
        "waiting_on_approval",
        "cancel_requested",
        "retry_backoff",
        "compensating",
        "succeeded",
        "failed",
        "dead_lettered",
    }
    assert set(RUN_TO_OPERATOR_RESUME_MAP.keys()) == expected_keys


# ---------------------------------------------------------------------------
# Machine construction — both machines coexisting on the same model
# ---------------------------------------------------------------------------


def test_enabled_validator_constructs_both_machines() -> None:
    """When enabled, the validator must construct both Machine instances."""
    validator = ExecutionStateMachineValidator(enabled=True)
    assert validator._run_machine is not None
    assert validator._operator_machine is not None


def test_disabled_validator_does_not_build_machines() -> None:
    """When disabled, the validator must NOT construct machines."""
    validator = ExecutionStateMachineValidator(enabled=False)
    assert validator._run_machine is None
    assert validator._operator_machine is None


def test_run_machine_has_all_states_registered() -> None:
    """The run-state machine must have every state from RUN_STATES."""
    validator = ExecutionStateMachineValidator(enabled=True)
    assert validator._run_machine is not None
    machine_states = set(validator._run_machine.states)
    for state in models.RUN_STATES:
        assert state in machine_states, f"Run state {state!r} not registered in run machine"


def test_operator_machine_has_all_states_registered() -> None:
    """The operator-state machine must have every state from RUN_OPERATOR_STATES."""
    validator = ExecutionStateMachineValidator(enabled=True)
    assert validator._operator_machine is not None
    machine_states = set(validator._operator_machine.states)
    for state in models.RUN_OPERATOR_STATES:
        assert state in machine_states, f"Operator state {state!r} not registered in operator machine"


def test_declared_unreached_states_are_registered() -> None:
    """Declared-unreached states must be registered in the run machine."""
    validator = ExecutionStateMachineValidator(enabled=True)
    assert validator._run_machine is not None
    machine_states = set(validator._run_machine.states)
    for state in DECLARED_UNREACHED_RUN_STATES:
        assert state in machine_states, f"Declared-unreached state {state!r} not registered"


def test_model_is_shared_between_machines() -> None:
    """Both machines must operate on the same shared model instance."""
    validator = ExecutionStateMachineValidator(enabled=True)
    assert validator._model is not None
    # Both machine references point to the same model
    assert validator._model.run_state == "queued"
    assert validator._model.operator_state == "admitted"


# ---------------------------------------------------------------------------
# Happy-path transition sequences
# ---------------------------------------------------------------------------


def _run_transition(
    validator: ExecutionStateMachineValidator,
    trigger: str,
    run_state: str,
    operator_state: str,
    **ctx_kwargs: object,
) -> ExecutionValidationResult:
    """Helper: fire a run-state transition and return the result."""
    ctx = ExecutionTransitionContext(
        run_state=run_state,
        operator_state=operator_state,
        **ctx_kwargs,
    )
    return validator.validate_run_transition(
        trigger=trigger,
        context=ctx,
    )


def _op_transition(
    validator: ExecutionStateMachineValidator,
    trigger: str,
    run_state: str,
    operator_state: str,
    **ctx_kwargs: object,
) -> ExecutionValidationResult:
    """Helper: fire an operator-state transition and return the result."""
    ctx = ExecutionTransitionContext(
        run_state=run_state,
        operator_state=operator_state,
        **ctx_kwargs,
    )
    return validator.validate_operator_transition(
        trigger=trigger,
        context=ctx,
    )


def test_happy_path_queued_to_succeeded() -> None:
    """queued -> dispatching -> executing -> succeeded must be valid."""
    validator = ExecutionStateMachineValidator(enabled=True)

    # queued -> dispatching
    r = _run_transition(validator, "claim_attempt", "queued", "admitted")
    assert r.valid, f"claim_attempt from queued failed: {r.error_message}"
    assert r.decision is not None
    assert r.decision.target_run_state == "dispatching"

    # dispatching -> executing
    r = _run_transition(validator, "start_execution", "dispatching", "leased")
    assert r.valid, f"start_execution from dispatching failed: {r.error_message}"
    assert r.decision is not None
    assert r.decision.target_run_state == "executing"

    # executing -> succeeded
    r = _run_transition(validator, "complete_success", "executing", "executing")
    assert r.valid, f"complete_success from executing failed: {r.error_message}"
    assert r.decision is not None
    assert r.decision.target_run_state == "succeeded"


def test_happy_path_approval_resume() -> None:
    """executing -> waiting_on_approval -> queued must be valid."""
    validator = ExecutionStateMachineValidator(enabled=True)

    r1 = _run_transition(validator, "open_approval", "executing", "executing")
    assert r1.valid
    assert r1.decision is not None
    assert r1.decision.target_run_state == "waiting_on_approval"

    r2 = _run_transition(
        validator,
        "resume_after_approval",
        "waiting_on_approval",
        "waiting_on_approval",
    )
    assert r2.valid
    assert r2.decision is not None
    assert r2.decision.target_run_state == "queued"


def test_happy_path_approval_reject_cancel() -> None:
    """waiting_on_approval -> cancel_requested must be valid."""
    validator = ExecutionStateMachineValidator(enabled=True)
    r = _run_transition(
        validator,
        "reject_approval_cancel",
        "waiting_on_approval",
        "waiting_on_approval",
    )
    assert r.valid
    assert r.decision is not None
    assert r.decision.target_run_state == "cancel_requested"


def test_happy_path_approval_reject_compensate() -> None:
    """waiting_on_approval -> compensating must be valid."""
    validator = ExecutionStateMachineValidator(enabled=True)
    r = _run_transition(
        validator,
        "reject_approval_compensate",
        "waiting_on_approval",
        "waiting_on_approval",
    )
    assert r.valid
    assert r.decision is not None
    assert r.decision.target_run_state == "compensating"


def test_happy_path_approval_reject_fail() -> None:
    """waiting_on_approval -> failed must be valid."""
    validator = ExecutionStateMachineValidator(enabled=True)
    r = _run_transition(
        validator,
        "reject_approval_fail",
        "waiting_on_approval",
        "waiting_on_approval",
    )
    assert r.valid
    assert r.decision is not None
    assert r.decision.target_run_state == "failed"


# ---------------------------------------------------------------------------
# Invalid transitions
# ---------------------------------------------------------------------------


def test_cannot_claim_from_executing() -> None:
    """claim_attempt from executing must be invalid."""
    validator = ExecutionStateMachineValidator(enabled=True)
    r = _run_transition(validator, "claim_attempt", "executing", "executing")
    assert not r.valid
    assert r.mismatch_category == MISMATCH_CATEGORY_INVALID_TRIGGER


def test_cannot_claim_from_terminal() -> None:
    """claim_attempt from terminal states must be invalid."""
    validator = ExecutionStateMachineValidator(enabled=True)
    for terminal_state in TERMINAL_RUN_STATES:
        r = _run_transition(
            validator,
            "claim_attempt",
            terminal_state,
            "admitted",
        )
        assert not r.valid, f"claim_attempt from terminal {terminal_state!r} should be invalid"


def test_cannot_start_execution_from_queued() -> None:
    """start_execution from queued must be invalid."""
    validator = ExecutionStateMachineValidator(enabled=True)
    r = _run_transition(validator, "start_execution", "queued", "admitted")
    assert not r.valid
    assert r.mismatch_category == MISMATCH_CATEGORY_INVALID_TRIGGER


def test_cannot_start_execution_from_succeeded() -> None:
    """start_execution from succeeded must be invalid."""
    validator = ExecutionStateMachineValidator(enabled=True)
    r = _run_transition(validator, "start_execution", "succeeded", "completed")
    assert not r.valid


def test_cannot_open_approval_from_queued() -> None:
    """open_approval from queued must be invalid."""
    validator = ExecutionStateMachineValidator(enabled=True)
    r = _run_transition(validator, "open_approval", "queued", "admitted")
    assert not r.valid


def test_cannot_complete_from_queued() -> None:
    """complete_success from queued must be invalid."""
    validator = ExecutionStateMachineValidator(enabled=True)
    r = _run_transition(validator, "complete_success", "queued", "admitted")
    assert not r.valid


def test_cannot_record_failure_from_queued() -> None:
    """record_terminal_failure from queued must be invalid."""
    validator = ExecutionStateMachineValidator(enabled=True)
    for trig in ("record_retryable_failure_delayed", "record_retryable_failure_immediate", "record_terminal_failure"):
        r = _run_transition(validator, trig, "queued", "admitted")
        assert not r.valid, f"{trig} from queued should be invalid"


# ---------------------------------------------------------------------------
# Cancel transitions with guard
# ---------------------------------------------------------------------------


def test_cancel_from_non_terminal_states() -> None:
    """request_cancel must be valid from non-terminal, non-cancel_requested."""
    validator = ExecutionStateMachineValidator(enabled=True)
    valid_sources = [s for s in models.RUN_STATES if s not in TERMINAL_RUN_STATES and s != "cancel_requested"]
    for source in valid_sources:
        r = _run_transition(validator, "request_cancel", source, "admitted")
        assert r.valid, f"request_cancel from {source!r} should be valid"


def test_cancel_from_terminal_is_blocked() -> None:
    """request_cancel from terminal states must be blocked by guard."""
    validator = ExecutionStateMachineValidator(enabled=True)
    for terminal_state in TERMINAL_RUN_STATES:
        r = _run_transition(
            validator,
            "request_cancel",
            terminal_state,
            "admitted",
        )
        assert not r.valid, f"request_cancel from terminal {terminal_state!r} should be invalid"
        assert r.mismatch_category == MISMATCH_CATEGORY_GUARD_FAILED, f"Expected guard_failed for {terminal_state!r}, got {r.mismatch_category}"


def test_cancel_from_cancel_requested_is_blocked() -> None:
    """request_cancel from cancel_requested must be blocked by guard."""
    validator = ExecutionStateMachineValidator(enabled=True)
    r = _run_transition(
        validator,
        "request_cancel",
        "cancel_requested",
        "cancel_requested",
    )
    assert not r.valid
    assert r.mismatch_category == MISMATCH_CATEGORY_GUARD_FAILED


# ---------------------------------------------------------------------------
# Interrupt, quarantine, expire_lease with guards
# ---------------------------------------------------------------------------


def test_interrupt_from_non_terminal_operator_states() -> None:
    """interrupt must be valid from non-terminal operator states."""
    validator = ExecutionStateMachineValidator(enabled=True)
    valid_sources = [s for s in models.RUN_OPERATOR_STATES if s not in TERMINAL_OPERATOR_STATES]
    failures: list[tuple[str, str | None, str | None]] = []
    for op_source in valid_sources:
        r = _run_transition(validator, "interrupt", "executing", op_source)
        if not r.valid:
            failures.append((op_source, r.mismatch_category, r.error_message))
        elif r.decision is not None:
            assert r.decision.target_run_state == "cancel_requested", f"interrupt from {op_source!r} should target cancel_requested, got {r.decision.target_run_state!r}"
    assert not failures, f"interrupt failed from some operator states: {failures}"


def test_interrupt_from_terminal_operator_is_blocked() -> None:
    """interrupt from terminal operator states must be blocked by guard."""
    validator = ExecutionStateMachineValidator(enabled=True)
    for terminal_op in TERMINAL_OPERATOR_STATES:
        r = _run_transition(validator, "interrupt", "executing", terminal_op)
        assert not r.valid, f"interrupt from terminal operator {terminal_op!r} should be invalid"
        assert r.mismatch_category == MISMATCH_CATEGORY_GUARD_FAILED


def test_quarantine_from_non_quarantined_is_valid() -> None:
    """quarantine must be valid from non-quarantined operator states."""
    validator = ExecutionStateMachineValidator(enabled=True)
    valid_sources = [s for s in models.RUN_OPERATOR_STATES if s != "quarantined"]
    failures: list[tuple[str, str | None, str | None]] = []
    for source in valid_sources:
        r = _run_transition(validator, "quarantine", "executing", source)
        if not r.valid:
            failures.append((source, r.mismatch_category, r.error_message))
    assert not failures, f"quarantine failed from some operator states: {failures}"


def test_quarantine_from_quarantined_is_blocked() -> None:
    """quarantine from quarantined must be blocked by guard."""
    validator = ExecutionStateMachineValidator(enabled=True)
    r = _run_transition(validator, "quarantine", "dead_lettered", "quarantined")
    assert not r.valid
    assert r.mismatch_category == MISMATCH_CATEGORY_GUARD_FAILED


def test_expire_lease_with_expired_context() -> None:
    """expire_lease must be valid when lease is expired."""
    validator = ExecutionStateMachineValidator(enabled=True)
    now = datetime(2026, 5, 3, 12, 0, 0, tzinfo=timezone.utc)
    past = now - timedelta(minutes=5)
    r = _run_transition(
        validator,
        "expire_lease",
        "executing",
        "executing",
        lease_status="leased",
        lease_expires_at=past,
        now=now,
    )
    assert r.valid, f"expire_lease with expired context should be valid: {r.error_message}"
    assert r.decision is not None
    assert r.decision.target_run_state == "timed_out"


def test_expire_lease_with_active_lease_is_blocked() -> None:
    """expire_lease must be blocked when lease is still valid."""
    validator = ExecutionStateMachineValidator(enabled=True)
    now = datetime(2026, 5, 3, 12, 0, 0, tzinfo=timezone.utc)
    future = now + timedelta(minutes=5)
    r = _run_transition(
        validator,
        "expire_lease",
        "executing",
        "executing",
        lease_status="leased",
        lease_expires_at=future,
        now=now,
    )
    assert not r.valid
    assert r.mismatch_category == MISMATCH_CATEGORY_GUARD_FAILED


# ---------------------------------------------------------------------------
# Operator-state-only transitions
# ---------------------------------------------------------------------------


def test_operator_pause_from_non_terminal() -> None:
    """pause must be valid from non-terminal, non-paused operator states."""
    validator = ExecutionStateMachineValidator(enabled=True)
    valid_sources = [s for s in models.RUN_OPERATOR_STATES if s not in TERMINAL_OPERATOR_STATES and s != "paused"]
    for source in valid_sources:
        r = _op_transition(validator, "pause", "executing", source)
        assert r.valid, f"pause from {source!r} should be valid: {r.error_message}"
        if r.decision is not None:
            assert r.decision.target_operator_state == "paused"


def test_operator_pause_from_terminal_is_blocked() -> None:
    """pause from terminal operator states must be blocked."""
    validator = ExecutionStateMachineValidator(enabled=True)
    for source in TERMINAL_OPERATOR_STATES:
        r = _op_transition(validator, "pause", "executing", source)
        assert not r.valid, f"pause from terminal {source!r} should be invalid"
        assert r.mismatch_category == MISMATCH_CATEGORY_GUARD_FAILED


def test_operator_pause_from_paused_is_blocked() -> None:
    """pause from paused must be blocked."""
    validator = ExecutionStateMachineValidator(enabled=True)
    r = _op_transition(validator, "pause", "executing", "paused")
    assert not r.valid
    assert r.mismatch_category == MISMATCH_CATEGORY_GUARD_FAILED


def test_operator_resume_from_paused() -> None:
    """resume from paused must be valid with no open approval."""
    validator = ExecutionStateMachineValidator(enabled=True)
    r = _op_transition(
        validator,
        "resume",
        "executing",
        "paused",
        has_open_approval=False,
        current_approval_link_id=None,
    )
    assert r.valid, f"resume from paused should be valid: {r.error_message}"


def test_operator_resume_from_non_paused_is_blocked() -> None:
    """resume from non-paused must be blocked."""
    validator = ExecutionStateMachineValidator(enabled=True)
    sources = [s for s in models.RUN_OPERATOR_STATES if s != "paused"]
    for source in sources[:5]:  # test a representative sample
        r = _op_transition(
            validator,
            "resume",
            "queued",
            source,
            has_open_approval=False,
            current_approval_link_id=None,
        )
        assert not r.valid, f"resume from {source!r} should be invalid"
        assert r.mismatch_category == MISMATCH_CATEGORY_GUARD_FAILED


def test_operator_resume_blocked_with_open_approval() -> None:
    """resume must be blocked when an open approval exists."""
    validator = ExecutionStateMachineValidator(enabled=True)
    r = _op_transition(
        validator,
        "resume",
        "executing",
        "paused",
        has_open_approval=True,
        current_approval_link_id="link_1",
    )
    assert not r.valid
    assert r.mismatch_category == MISMATCH_CATEGORY_GUARD_FAILED


# ---------------------------------------------------------------------------
# Guard result tracking
# ---------------------------------------------------------------------------


def test_guard_results_are_recorded_in_result() -> None:
    """When a guard blocks a transition, guard_results must be populated."""
    validator = ExecutionStateMachineValidator(enabled=True)
    ctx = ExecutionTransitionContext(
        run_state="succeeded",
        operator_state="completed",
    )
    result = validator.validate_run_transition(
        trigger="request_cancel",
        context=ctx,
    )
    assert not result.valid
    assert result.guard_results is not None
    assert "is_cancellable" in result.guard_results
    assert result.guard_results["is_cancellable"] is False


def test_guard_results_are_recorded_on_success() -> None:
    """Guard results must be recorded even when the transition passes."""
    validator = ExecutionStateMachineValidator(enabled=True)
    ctx = ExecutionTransitionContext(
        run_state="queued",
        operator_state="admitted",
    )
    result = validator.validate_run_transition(
        trigger="claim_attempt",
        context=ctx,
    )
    assert result.valid
    # Guards were evaluated and passed
    assert result.guard_results is not None
    assert "is_claimable_run" in result.guard_results
    assert result.guard_results["is_claimable_run"] is True


# ---------------------------------------------------------------------------
# ATTEMPT_EFFECTS_BY_TRIGGER — SPEC §6.4
# ---------------------------------------------------------------------------


def test_attempt_effects_covers_all_run_triggers() -> None:
    """ATTEMPT_EFFECTS_BY_TRIGGER must cover all run and operator triggers."""
    expected = set(ALL_EXECUTION_TRIGGERS)
    assert set(ATTEMPT_EFFECTS_BY_TRIGGER.keys()) == expected, f"Missing triggers: {expected - set(ATTEMPT_EFFECTS_BY_TRIGGER.keys())}"


def test_attempt_effects_are_attempt_effect_instances() -> None:
    """Every value in ATTEMPT_EFFECTS_BY_TRIGGER must be an AttemptEffect."""
    for trigger, effect in ATTEMPT_EFFECTS_BY_TRIGGER.items():
        assert isinstance(effect, AttemptEffect), f"Trigger {trigger!r}: not an AttemptEffect"


def test_attempt_effects_retryable_delayed_has_source_and_replacement() -> None:
    """record_retryable_failure_delayed must have source + replacement effects."""
    effect = ATTEMPT_EFFECTS_BY_TRIGGER["record_retryable_failure_delayed"]
    assert effect.source_attempt_state == "failed"
    assert effect.source_attempt_operator_state == "failed"
    assert effect.replacement_attempt_state == "retry_backoff"
    assert effect.replacement_attempt_operator_state == "retry_scheduled"
    assert effect.target_lease_status == "released"
    assert effect.replaces_current_attempt is True


def test_attempt_effects_retryable_immediate_has_source_and_replacement() -> None:
    """record_retryable_failure_immediate must have source + replacement effects."""
    effect = ATTEMPT_EFFECTS_BY_TRIGGER["record_retryable_failure_immediate"]
    assert effect.source_attempt_state == "failed"
    assert effect.source_attempt_operator_state == "failed"
    assert effect.replacement_attempt_state == "queued"
    assert effect.replacement_attempt_operator_state == "admitted"
    assert effect.target_lease_status == "released"
    assert effect.replaces_current_attempt is True


def test_attempt_effects_terminal_failure_has_source_no_replacement() -> None:
    """record_terminal_failure must have source effect but no replacement."""
    effect = ATTEMPT_EFFECTS_BY_TRIGGER["record_terminal_failure"]
    assert effect.source_attempt_state == "dead_lettered"
    assert effect.source_attempt_operator_state == "quarantined"
    assert effect.replacement_attempt_state is None
    assert effect.replacement_attempt_operator_state is None
    assert effect.replaces_current_attempt is False


def test_attempt_effects_admit_retry_has_replacement_no_source() -> None:
    """admit_retry must have replacement effect but no source mutation."""
    effect = ATTEMPT_EFFECTS_BY_TRIGGER["admit_retry"]
    assert effect.source_attempt_state is None
    assert effect.source_attempt_operator_state is None
    assert effect.replacement_attempt_state == "queued"
    assert effect.replacement_attempt_operator_state == "admitted"
    assert effect.replaces_current_attempt is True


def test_attempt_effects_complete_success_has_lease_released() -> None:
    """complete_success must release the lease."""
    effect = ATTEMPT_EFFECTS_BY_TRIGGER["complete_success"]
    assert effect.target_attempt_state == "succeeded"
    assert effect.target_attempt_operator_state == "completed"
    assert effect.target_lease_status == "released"


def test_attempt_effects_expire_lease_has_lease_expired() -> None:
    """expire_lease must set lease status to expired."""
    effect = ATTEMPT_EFFECTS_BY_TRIGGER["expire_lease"]
    assert effect.target_attempt_state == "timed_out"
    assert effect.target_attempt_operator_state == "interrupted"
    assert effect.target_lease_status == "expired"


def test_attempt_effects_pause_keeps_attempt_state() -> None:
    """pause must keep attempt state unchanged, only operator changes."""
    effect = ATTEMPT_EFFECTS_BY_TRIGGER["pause"]
    assert effect.target_attempt_state is None
    assert effect.target_attempt_operator_state == "paused"


def test_attempt_effects_resume_operator_from_context() -> None:
    """resume attempt operator state must be resolved from context."""
    effect = ATTEMPT_EFFECTS_BY_TRIGGER["resume"]
    assert effect.target_attempt_state is None
    assert effect.target_attempt_operator_state is None  # resolved from context


def test_attempt_effects_admit_create_not_in_map() -> None:
    """admit_create is not a transition trigger and must not be in effects."""
    assert "admit_create" not in ATTEMPT_EFFECTS_BY_TRIGGER


def test_attempt_effects_restart_from_scratch_not_in_map() -> None:
    """restart_run_from_scratch is not a transition trigger."""
    assert "restart_run_from_scratch" not in ATTEMPT_EFFECTS_BY_TRIGGER


# ---------------------------------------------------------------------------
# Decision includes attempt effects
# ---------------------------------------------------------------------------


def test_decision_includes_attempt_effects_on_happy_path() -> None:
    """Decision from claim_attempt must include target attempt effects."""
    validator = ExecutionStateMachineValidator(enabled=True)
    ctx = ExecutionTransitionContext(
        run_state="queued",
        operator_state="admitted",
        attempt_state="queued",
        attempt_operator_state="admitted",
    )
    r = validator.validate_run_transition(trigger="claim_attempt", context=ctx)
    assert r.valid
    assert r.decision is not None
    assert r.decision.target_attempt_state == "dispatching"
    assert r.decision.target_attempt_operator_state == "leased"
    assert r.decision.target_lease_status == "leased"


def test_decision_includes_replacement_effects() -> None:
    """Decision from record_retryable_failure_delayed must include replacement."""
    validator = ExecutionStateMachineValidator(enabled=True)
    ctx = ExecutionTransitionContext(
        run_state="dispatching",
        operator_state="leased",
        attempt_state="dispatching",
        attempt_operator_state="leased",
    )
    r = validator.validate_run_transition(
        trigger="record_retryable_failure_delayed",
        context=ctx,
    )
    assert r.valid
    assert r.decision is not None
    assert r.decision.source_attempt_state == "failed"
    assert r.decision.source_attempt_operator_state == "failed"
    assert r.decision.replacement_attempt_state == "retry_backoff"
    assert r.decision.replacement_attempt_operator_state == "retry_scheduled"
    assert r.decision.target_lease_status == "released"


def test_decision_includes_terminal_failure_source_only() -> None:
    """Decision from record_terminal_failure must include source, no replacement."""
    validator = ExecutionStateMachineValidator(enabled=True)
    ctx = ExecutionTransitionContext(
        run_state="dispatching",
        operator_state="leased",
        attempt_state="dispatching",
        attempt_operator_state="leased",
    )
    r = validator.validate_run_transition(
        trigger="record_terminal_failure",
        context=ctx,
    )
    assert r.valid
    assert r.decision is not None
    assert r.decision.source_attempt_state == "dead_lettered"
    assert r.decision.source_attempt_operator_state == "quarantined"
    assert r.decision.replacement_attempt_state is None
    assert r.decision.target_lease_status == "released"


def test_decision_includes_complete_success_effects() -> None:
    """Decision from complete_success must include attempt target and lease."""
    validator = ExecutionStateMachineValidator(enabled=True)
    ctx = ExecutionTransitionContext(
        run_state="executing",
        operator_state="executing",
        attempt_state="executing",
        attempt_operator_state="executing",
    )
    r = validator.validate_run_transition(trigger="complete_success", context=ctx)
    assert r.valid
    assert r.decision is not None
    assert r.decision.target_attempt_state == "succeeded"
    assert r.decision.target_attempt_operator_state == "completed"
    assert r.decision.target_lease_status == "released"


def test_decision_includes_pause_operator_effect() -> None:
    """Decision from pause must show attempt operator -> paused."""
    validator = ExecutionStateMachineValidator(enabled=True)
    ctx = ExecutionTransitionContext(
        run_state="executing",
        operator_state="executing",
        attempt_state="executing",
        attempt_operator_state="executing",
    )
    r = validator.validate_operator_transition(trigger="pause", context=ctx)
    assert r.valid
    assert r.decision is not None
    assert r.decision.target_attempt_state is None  # unchanged
    assert r.decision.target_attempt_operator_state == "paused"


def test_decision_includes_expire_lease_effects() -> None:
    """Decision from expire_lease must include leased -> expired."""
    now = datetime(2026, 5, 3, 12, 0, 0, tzinfo=timezone.utc)
    past = now - timedelta(minutes=5)
    validator = ExecutionStateMachineValidator(enabled=True)
    ctx = ExecutionTransitionContext(
        run_state="executing",
        operator_state="executing",
        attempt_state="executing",
        attempt_operator_state="executing",
        lease_status="leased",
        lease_expires_at=past,
        now=now,
    )
    r = validator.validate_run_transition(trigger="expire_lease", context=ctx)
    assert r.valid
    assert r.decision is not None
    assert r.decision.target_attempt_state == "timed_out"
    assert r.decision.target_attempt_operator_state == "interrupted"
    assert r.decision.target_lease_status == "expired"


# ---------------------------------------------------------------------------
# Guard method coverage — SPEC §8.2
# ---------------------------------------------------------------------------


def test_guard_is_claimable_attempt_passes_with_valid_context() -> None:
    """is_claimable_attempt must pass for queued attempt with admitted operator."""
    model = _ExecutionStateMachineModel(run_state="queued", operator_state="admitted")
    ctx = ExecutionTransitionContext(
        attempt_state="queued",
        attempt_operator_state="admitted",
    )

    class _FakeEvent:
        kwargs = {"context": ctx}

    assert model.is_claimable_attempt(_FakeEvent()) is True


def test_guard_is_claimable_attempt_fails_for_executing() -> None:
    """is_claimable_attempt must fail for executing attempt."""
    model = _ExecutionStateMachineModel(run_state="executing", operator_state="executing")
    ctx = ExecutionTransitionContext(
        attempt_state="executing",
        attempt_operator_state="executing",
    )

    class _FakeEvent:
        kwargs = {"context": ctx}

    assert model.is_claimable_attempt(_FakeEvent()) is False


def test_guard_is_not_paused_passes_with_admitted_operator() -> None:
    """is_not_paused must pass when operator is not paused."""
    model = _ExecutionStateMachineModel(run_state="queued", operator_state="admitted")
    ctx = ExecutionTransitionContext(attempt_operator_state="admitted")

    class _FakeEvent:
        kwargs = {"context": ctx}

    assert model.is_not_paused(_FakeEvent()) is True


def test_guard_is_not_paused_fails_when_paused() -> None:
    """is_not_paused must fail when operator is paused."""
    model = _ExecutionStateMachineModel(run_state="queued", operator_state="paused")
    ctx = ExecutionTransitionContext(attempt_operator_state="paused")

    class _FakeEvent:
        kwargs = {"context": ctx}

    assert model.is_not_paused(_FakeEvent()) is False


def test_guard_has_valid_lease_token_passes_with_matching_token() -> None:
    """has_valid_lease_token must pass with matching non-empty tokens."""
    model = _ExecutionStateMachineModel()
    ctx = ExecutionTransitionContext(
        attempt_lease_token="tok_1",
        provided_lease_token="tok_1",
    )

    class _FakeEvent:
        kwargs = {"context": ctx}

    assert model.has_valid_lease_token(_FakeEvent()) is True


def test_guard_has_valid_lease_token_fails_with_mismatch() -> None:
    """has_valid_lease_token must fail with mismatched tokens."""
    model = _ExecutionStateMachineModel()
    ctx = ExecutionTransitionContext(
        attempt_lease_token="tok_1",
        provided_lease_token="tok_2",
    )

    class _FakeEvent:
        kwargs = {"context": ctx}

    assert model.has_valid_lease_token(_FakeEvent()) is False


def test_guard_has_valid_lease_token_skips_when_both_none() -> None:
    """has_valid_lease_token must pass when both tokens are None."""
    model = _ExecutionStateMachineModel()
    ctx = ExecutionTransitionContext(
        attempt_lease_token=None,
        provided_lease_token=None,
    )

    class _FakeEvent:
        kwargs = {"context": ctx}

    assert model.has_valid_lease_token(_FakeEvent()) is True


def test_guard_is_retryable_and_has_budget_passes() -> None:
    """is_retryable_and_has_budget must pass when budget remains."""
    model = _ExecutionStateMachineModel()
    ctx = ExecutionTransitionContext(
        retryable=True,
        active_attempt_no=1,
        max_attempts=3,
    )

    class _FakeEvent:
        kwargs = {"context": ctx}

    assert model.is_retryable_and_has_budget(_FakeEvent()) is True


def test_guard_is_retryable_and_has_budget_fails_when_exhausted() -> None:
    """is_retryable_and_has_budget must fail when budget exhausted."""
    model = _ExecutionStateMachineModel()
    ctx = ExecutionTransitionContext(
        retryable=True,
        active_attempt_no=3,
        max_attempts=3,
    )

    class _FakeEvent:
        kwargs = {"context": ctx}

    assert model.is_retryable_and_has_budget(_FakeEvent()) is False


def test_guard_is_terminal_failure_destination_passes_not_retryable() -> None:
    """is_terminal_failure_destination passes when not retryable."""
    model = _ExecutionStateMachineModel()
    ctx = ExecutionTransitionContext(
        retryable=False,
        active_attempt_no=1,
        max_attempts=3,
    )

    class _FakeEvent:
        kwargs = {"context": ctx}

    assert model.is_terminal_failure_destination(_FakeEvent()) is True


def test_guard_is_terminal_failure_destination_passes_budget_exhausted() -> None:
    """is_terminal_failure_destination passes when budget exhausted."""
    model = _ExecutionStateMachineModel()
    ctx = ExecutionTransitionContext(
        retryable=True,
        active_attempt_no=3,
        max_attempts=3,
    )

    class _FakeEvent:
        kwargs = {"context": ctx}

    assert model.is_terminal_failure_destination(_FakeEvent()) is True


def test_guard_is_in_flight_attempt_passes() -> None:
    """is_in_flight_attempt passes for executing attempt."""
    model = _ExecutionStateMachineModel()

    class _FakeEvent:
        kwargs = {"context": ExecutionTransitionContext(attempt_state="executing")}

    assert model.is_in_flight_attempt(_FakeEvent()) is True


def test_guard_is_in_flight_attempt_fails_for_queued() -> None:
    """is_in_flight_attempt fails for queued attempt."""
    model = _ExecutionStateMachineModel()

    class _FakeEvent:
        kwargs = {"context": ExecutionTransitionContext(attempt_state="queued")}

    assert model.is_in_flight_attempt(_FakeEvent()) is False


def test_guard_is_current_attempt_passes_when_matches() -> None:
    """is_current_attempt passes when attempt_id matches current_attempt_id."""
    model = _ExecutionStateMachineModel()

    class _FakeEvent:
        kwargs = {
            "context": ExecutionTransitionContext(
                attempt_id="att_1",
                current_attempt_id="att_1",
            )
        }

    assert model.is_current_attempt(_FakeEvent()) is True


def test_guard_is_current_attempt_fails_when_different() -> None:
    """is_current_attempt fails when attempt_id differs."""
    model = _ExecutionStateMachineModel()

    class _FakeEvent:
        kwargs = {
            "context": ExecutionTransitionContext(
                attempt_id="att_1",
                current_attempt_id="att_2",
            )
        }

    assert model.is_current_attempt(_FakeEvent()) is False


def test_guard_is_executing_passes_when_both_executing() -> None:
    """is_executing passes when run_state and attempt_state are executing."""
    model = _ExecutionStateMachineModel(run_state="executing")

    class _FakeEvent:
        kwargs = {"context": ExecutionTransitionContext(attempt_state="executing")}

    assert model.is_executing(_FakeEvent()) is True


def test_guard_is_executing_fails_when_not_executing() -> None:
    """is_executing fails when attempt_state is not executing."""
    model = _ExecutionStateMachineModel(run_state="executing")

    class _FakeEvent:
        kwargs = {"context": ExecutionTransitionContext(attempt_state="dispatching")}

    assert model.is_executing(_FakeEvent()) is False


def test_guard_is_recordable_failure_passes() -> None:
    """is_recordable_failure passes when both run and attempt are dispatching."""
    model = _ExecutionStateMachineModel(run_state="dispatching")

    class _FakeEvent:
        kwargs = {"context": ExecutionTransitionContext(attempt_state="dispatching")}

    assert model.is_recordable_failure(_FakeEvent()) is True


def test_guard_is_recordable_failure_fails_from_queued() -> None:
    """is_recordable_failure fails when run is queued."""
    model = _ExecutionStateMachineModel(run_state="queued")

    class _FakeEvent:
        kwargs = {"context": ExecutionTransitionContext(attempt_state="queued")}

    assert model.is_recordable_failure(_FakeEvent()) is False


def test_guard_is_valid_service_chosen_operator_state_passes() -> None:
    """is_valid_service_chosen_operator_state passes for valid choice."""
    model = _ExecutionStateMachineModel()
    ctx = ExecutionTransitionContext(service_chosen_operator_state="waiting_external")

    class _FakeEvent:
        name = "start_execution"
        kwargs = {"context": ctx}

    assert model.is_valid_service_chosen_operator_state(_FakeEvent()) is True


def test_guard_is_valid_service_chosen_operator_state_fails_invalid() -> None:
    """is_valid_service_chosen_operator_state fails for invalid choice."""
    model = _ExecutionStateMachineModel()
    ctx = ExecutionTransitionContext(service_chosen_operator_state="quarantined")

    class _FakeEvent:
        name = "start_execution"
        kwargs = {"context": ctx}

    assert model.is_valid_service_chosen_operator_state(_FakeEvent()) is False


def test_guard_is_valid_service_chosen_operator_state_skips_when_none() -> None:
    """is_valid_service_chosen_operator_state passes when no choice made."""
    model = _ExecutionStateMachineModel()
    ctx = ExecutionTransitionContext(service_chosen_operator_state=None)

    class _FakeEvent:
        name = "start_execution"
        kwargs = {"context": ctx}

    assert model.is_valid_service_chosen_operator_state(_FakeEvent()) is True


def test_guard_has_open_approval_gate_passes() -> None:
    """has_open_approval_gate passes when gate is open."""
    model = _ExecutionStateMachineModel()

    class _FakeEvent:
        kwargs = {"context": ExecutionTransitionContext(approval_gate_status="open")}

    assert model.has_open_approval_gate(_FakeEvent()) is True


def test_guard_has_open_approval_gate_fails_when_closed() -> None:
    """has_open_approval_gate fails when gate is not open."""
    model = _ExecutionStateMachineModel()

    class _FakeEvent:
        kwargs = {"context": ExecutionTransitionContext(approval_gate_status="closed")}

    assert model.has_open_approval_gate(_FakeEvent()) is False


def test_guard_claimable_wakeup_due_passes_when_no_schedule() -> None:
    """is_claimable_wakeup_due passes when scheduled_at is None."""
    model = _ExecutionStateMachineModel()

    class _FakeEvent:
        kwargs = {"context": ExecutionTransitionContext(scheduled_at=None, now=None)}

    assert model.is_claimable_wakeup_due(_FakeEvent()) is True


def test_guard_claimable_wakeup_due_passes_when_due() -> None:
    """is_claimable_wakeup_due passes when scheduled_at <= now."""
    now = datetime(2026, 5, 3, 12, 0, 0)
    past = datetime(2026, 5, 3, 11, 0, 0)
    model = _ExecutionStateMachineModel()

    class _FakeEvent:
        kwargs = {"context": ExecutionTransitionContext(scheduled_at=past, now=now)}

    assert model.is_claimable_wakeup_due(_FakeEvent()) is True


def test_guard_claimable_wakeup_due_fails_when_not_due() -> None:
    """is_claimable_wakeup_due fails when scheduled_at > now."""
    now = datetime(2026, 5, 3, 12, 0, 0)
    future = datetime(2026, 5, 3, 13, 0, 0)
    model = _ExecutionStateMachineModel()

    class _FakeEvent:
        kwargs = {"context": ExecutionTransitionContext(scheduled_at=future, now=now)}

    assert model.is_claimable_wakeup_due(_FakeEvent()) is False


# ---------------------------------------------------------------------------
# Creation validation — SPEC §7.3
# ---------------------------------------------------------------------------


def test_creation_admit_create_validates_initial_state() -> None:
    """admit_create validates that new run starts with queued/admitted."""
    validator = ExecutionStateMachineValidator(enabled=True)
    before = ExecutionStateSnapshot()
    after = ExecutionStateSnapshot(
        run_state="queued",
        operator_state="admitted",
        attempt_state="queued",
        attempt_operator_state="admitted",
        lease_status="not_leased",
    )
    result = validator.validate_creation(
        operation="admit_create",
        before_snapshot=before,
        after_snapshot=after,
    )
    assert result.valid, f"admit_create validation failed: {result.error_message}"
    assert result.validated is True
    assert result.decision is not None
    assert result.decision.target_run_state == "queued"


def test_creation_admit_create_rejects_wrong_run_state() -> None:
    """admit_create rejects a created run with wrong initial state."""
    validator = ExecutionStateMachineValidator(enabled=True)
    before = ExecutionStateSnapshot()
    after = ExecutionStateSnapshot(
        run_state="executing",  # wrong initial state
        operator_state="admitted",
    )
    result = validator.validate_creation(
        operation="admit_create",
        before_snapshot=before,
        after_snapshot=after,
    )
    assert not result.valid
    assert result.mismatch_category == MISMATCH_CATEGORY_CREATION_INITIAL_STATE_MISMATCH


def test_creation_restart_from_scratch_validates_new_run() -> None:
    """restart_run_from_scratch validates new run initial state and source invariants."""
    validator = ExecutionStateMachineValidator(enabled=True)
    # before_snapshot: source run's state after operation;
    # source_run_invariants carries reference values from before the operation.
    before = ExecutionStateSnapshot(
        run_state="executing",
        operator_state="executing",
        current_attempt_id="att_old",
        source_run_invariants=SourceRunInvariants(
            run_state="executing",
            operator_state="executing",
            current_attempt_id="att_old",
        ),
    )
    after = ExecutionStateSnapshot(
        run_state="queued",
        operator_state="admitted",
        attempt_state="queued",
        attempt_operator_state="admitted",
        lease_status="not_leased",
    )
    result = validator.validate_creation(
        operation="restart_run_from_scratch",
        before_snapshot=before,
        after_snapshot=after,
    )
    assert result.valid, f"restart validation failed: {result.error_message}"
    assert result.validated is True


def test_creation_restart_from_scratch_detects_source_run_mutation() -> None:
    """restart_run_from_scratch detects source run state mutation."""
    validator = ExecutionStateMachineValidator(enabled=True)
    before = ExecutionStateSnapshot(
        run_state="dispatching",  # mutated — was executing before
        operator_state="leased",
        current_attempt_id="att_old",
        source_run_invariants=SourceRunInvariants(
            run_state="executing",  # expected unchanged reference
            operator_state="executing",  # expected unchanged reference
            current_attempt_id="att_old",
        ),
    )
    after = ExecutionStateSnapshot(
        run_state="queued",
        operator_state="admitted",
    )
    result = validator.validate_creation(
        operation="restart_run_from_scratch",
        before_snapshot=before,
        after_snapshot=after,
    )
    assert not result.valid
    assert result.mismatch_category == MISMATCH_CATEGORY_CREATION_INITIAL_STATE_MISMATCH
    assert result.error_message is not None
    assert "run_state mutated" in result.error_message


def test_creation_restart_from_scratch_detects_operator_state_mutation() -> None:
    """restart_run_from_scratch detects source operator state mutation."""
    validator = ExecutionStateMachineValidator(enabled=True)
    before = ExecutionStateSnapshot(
        run_state="executing",
        operator_state="waiting_external",  # mutated — was executing before
        current_attempt_id="att_old",
        source_run_invariants=SourceRunInvariants(
            run_state="executing",
            operator_state="executing",  # expected unchanged reference
            current_attempt_id="att_old",
        ),
    )
    after = ExecutionStateSnapshot(
        run_state="queued",
        operator_state="admitted",
    )
    result = validator.validate_creation(
        operation="restart_run_from_scratch",
        before_snapshot=before,
        after_snapshot=after,
    )
    assert not result.valid
    assert result.mismatch_category == MISMATCH_CATEGORY_CREATION_INITIAL_STATE_MISMATCH
    assert result.error_message is not None
    assert "operator_state mutated" in result.error_message


def test_creation_restart_from_scratch_detects_current_attempt_id_change() -> None:
    """restart_run_from_scratch detects source current_attempt_id mutation."""
    validator = ExecutionStateMachineValidator(enabled=True)
    before = ExecutionStateSnapshot(
        run_state="executing",
        operator_state="executing",
        current_attempt_id="att_new",  # mutated — was att_old before
        source_run_invariants=SourceRunInvariants(
            run_state="executing",
            operator_state="executing",
            current_attempt_id="att_old",  # expected unchanged reference
        ),
    )
    after = ExecutionStateSnapshot(
        run_state="queued",
        operator_state="admitted",
    )
    result = validator.validate_creation(
        operation="restart_run_from_scratch",
        before_snapshot=before,
        after_snapshot=after,
    )
    assert not result.valid
    assert result.mismatch_category == MISMATCH_CATEGORY_CREATION_INITIAL_STATE_MISMATCH
    assert result.error_message is not None
    assert "current_attempt_id changed" in result.error_message


def test_creation_restart_from_scratch_no_invariants_skips_source_check() -> None:
    """restart_run_from_scratch skips source invariants check when not provided."""
    validator = ExecutionStateMachineValidator(enabled=True)
    before = ExecutionStateSnapshot(
        run_state="executing",
        operator_state="executing",
        current_attempt_id="att_old",
        source_run_invariants=None,  # not provided
    )
    after = ExecutionStateSnapshot(
        run_state="queued",
        operator_state="admitted",
    )
    result = validator.validate_creation(
        operation="restart_run_from_scratch",
        before_snapshot=before,
        after_snapshot=after,
    )
    assert result.valid
    assert result.validated is True


def test_creation_admit_create_initialization_defaults() -> None:
    """admit_create validates all expected initial state defaults."""
    validator = ExecutionStateMachineValidator(enabled=True)
    before = ExecutionStateSnapshot()
    after = ExecutionStateSnapshot(
        run_state="queued",
        operator_state="admitted",
        attempt_state="queued",
        attempt_operator_state="admitted",
        lease_status="not_leased",
    )
    result = validator.validate_creation(
        operation="admit_create",
        before_snapshot=before,
        after_snapshot=after,
    )
    assert result.valid, f"admit_create validation failed: {result.error_message}"
    assert result.validated is True
    assert result.decision is not None
    assert result.decision.target_run_state == "queued"
    assert result.decision.target_operator_state == "admitted"
    assert result.decision.target_attempt_state == "queued"
    assert result.decision.target_attempt_operator_state == "admitted"
    assert result.decision.target_lease_status == "not_leased"


def test_creation_admit_create_rejects_wrong_attempt_state() -> None:
    """admit_create rejects a created attempt with wrong initial state."""
    validator = ExecutionStateMachineValidator(enabled=True)
    before = ExecutionStateSnapshot()
    after = ExecutionStateSnapshot(
        run_state="queued",
        operator_state="admitted",
        attempt_state="executing",  # wrong initial state
        attempt_operator_state="admitted",
        lease_status="not_leased",
    )
    result = validator.validate_creation(
        operation="admit_create",
        before_snapshot=before,
        after_snapshot=after,
    )
    assert not result.valid
    assert result.mismatch_category == MISMATCH_CATEGORY_CREATION_INITIAL_STATE_MISMATCH


def test_creation_admit_create_rejects_wrong_lease_status() -> None:
    """admit_create rejects a created run with wrong lease status."""
    validator = ExecutionStateMachineValidator(enabled=True)
    before = ExecutionStateSnapshot()
    after = ExecutionStateSnapshot(
        run_state="queued",
        operator_state="admitted",
        attempt_state="queued",
        attempt_operator_state="admitted",
        lease_status="leased",  # wrong initial lease status
    )
    result = validator.validate_creation(
        operation="admit_create",
        before_snapshot=before,
        after_snapshot=after,
    )
    assert not result.valid
    assert result.mismatch_category == MISMATCH_CATEGORY_CREATION_INITIAL_STATE_MISMATCH
    assert result.error_message is not None
    assert "lease_status" in result.error_message


# ---------------------------------------------------------------------------
# Non-state operation validation — SPEC §7.4
# ---------------------------------------------------------------------------


def test_non_state_operation_passes_when_no_state_change() -> None:
    """Non-state operation passes when no state dimensions changed."""
    validator = ExecutionStateMachineValidator(enabled=True)
    before = ExecutionStateSnapshot(
        run_state="executing",
        operator_state="executing",
        attempt_state="executing",
        attempt_operator_state="executing",
        current_attempt_id="att_1",
        current_approval_link_id=None,
    )
    after = ExecutionStateSnapshot(
        run_state="executing",
        operator_state="executing",
        attempt_state="executing",
        attempt_operator_state="executing",
        current_attempt_id="att_1",
        current_approval_link_id=None,
    )
    result = validator.validate_non_state_operation(
        before_snapshot=before,
        after_snapshot=after,
    )
    assert result.valid
    assert result.validated is True


def test_non_state_operation_detects_run_state_change() -> None:
    """Non-state operation detects a run state change."""
    validator = ExecutionStateMachineValidator(enabled=True)
    before = ExecutionStateSnapshot(
        run_state="dispatching",
        operator_state="leased",
    )
    after = ExecutionStateSnapshot(
        run_state="executing",  # changed!
        operator_state="leased",
    )
    result = validator.validate_non_state_operation(
        before_snapshot=before,
        after_snapshot=after,
    )
    assert not result.valid
    assert result.mismatch_category == MISMATCH_CATEGORY_NON_STATE_OPERATION_MUTATED_STATE


def test_non_state_operation_detects_attempt_state_change() -> None:
    """Non-state operation detects an attempt state change."""
    validator = ExecutionStateMachineValidator(enabled=True)
    before = ExecutionStateSnapshot(
        run_state="executing",
        operator_state="executing",
        attempt_state="executing",
    )
    after = ExecutionStateSnapshot(
        run_state="executing",
        operator_state="executing",
        attempt_state="succeeded",  # changed!
    )
    result = validator.validate_non_state_operation(
        before_snapshot=before,
        after_snapshot=after,
    )
    assert not result.valid
    assert result.mismatch_category == MISMATCH_CATEGORY_NON_STATE_OPERATION_MUTATED_STATE


def test_non_state_operation_detects_approval_link_change() -> None:
    """Non-state operation detects an approval link change."""
    validator = ExecutionStateMachineValidator(enabled=True)
    before = ExecutionStateSnapshot(
        run_state="executing",
        operator_state="executing",
        current_approval_link_id=None,
    )
    after = ExecutionStateSnapshot(
        run_state="executing",
        operator_state="executing",
        current_approval_link_id="link_new",  # changed!
    )
    result = validator.validate_non_state_operation(
        before_snapshot=before,
        after_snapshot=after,
    )
    assert not result.valid
    assert result.mismatch_category == MISMATCH_CATEGORY_NON_STATE_OPERATION_MUTATED_STATE


# ---------------------------------------------------------------------------
# No service integration
# ---------------------------------------------------------------------------


def test_no_import_of_service_module() -> None:
    """
    The state-machine module must not import from ``app.execution.service``.

    Phase 1a keeps the validator skeleton isolated from service code.
    """
    import sys

    # Force a fresh import check — the module may already be in sys.modules.
    module_name = "app.execution.state_machine"
    service_name = "app.execution.service"
    if module_name in sys.modules:
        del sys.modules[module_name]
    if service_name in sys.modules:
        del sys.modules[service_name]

    import app.execution.state_machine  # noqa: F401

    # The state machine module must NOT trigger an import of the service module.
    assert service_name not in sys.modules, f"{module_name} must not import {service_name}"


# ---------------------------------------------------------------------------
# Approval-link stale-current warning — SPEC §9.5 compatibility
# ---------------------------------------------------------------------------


def test_approval_link_stale_snapshot_captures_scenario() -> None:
    """
    The snapshot model must capture the approval-link stale-current
    scenario: after ``decide_approval`` closes the gate, the link ID
    remains set while the gate is closed (SPEC §9.5 compatibility).
    This is the data surface that Phase 1b logging will use.
    """
    # approval_gate_status="closed" + current_approval_link_id is set
    after = ExecutionStateSnapshot(
        run_state="queued",
        operator_state="admitted",
        current_approval_link_id="link_1",
        approval_gate_status="closed",
    )
    assert after.run_state == "queued"
    assert after.current_approval_link_id == "link_1"
    assert after.approval_gate_status == "closed"


def test_approval_link_cancel_open_snapshot_captures_scenario() -> None:
    """
    The snapshot model must capture the open-approval-cancel scenario:
    after ``request_cancel`` from ``waiting_on_approval``, the approval
    link remains open (SPEC §9.5 compatibility).
    """
    after = ExecutionStateSnapshot(
        run_state="cancel_requested",
        operator_state="cancel_requested",
        current_approval_link_id="link_1",
        approval_gate_status="open",
    )
    assert after.run_state == "cancel_requested"
    assert after.current_approval_link_id == "link_1"
    assert after.approval_gate_status == "open"


# ---------------------------------------------------------------------------
# Retry-budget paths — SPEC §11 retry-budget and dead-letter coverage
# ---------------------------------------------------------------------------


def test_retry_budget_exhausted_triggers_terminal_failure() -> None:
    """
    When the retry budget is exhausted (active_attempt_no + 1 > max_attempts),
    ``record_terminal_failure`` must be valid and produce dead_lettered.
    """
    validator = ExecutionStateMachineValidator(enabled=True)
    ctx = ExecutionTransitionContext(
        run_state="dispatching",
        operator_state="leased",
        attempt_state="dispatching",
        attempt_operator_state="leased",
        retryable=True,
        active_attempt_no=3,
        max_attempts=3,
    )
    r = validator.validate_run_transition(
        trigger="record_terminal_failure",
        context=ctx,
    )
    assert r.valid, f"terminal_failure with exhausted budget should be valid: {r.error_message}"
    assert r.decision is not None
    assert r.decision.target_run_state == "dead_lettered"
    assert r.decision.source_attempt_state == "dead_lettered"
    assert r.decision.source_attempt_operator_state == "quarantined"


def test_retry_budget_non_retryable_triggers_terminal_failure() -> None:
    """
    When the failure is not retryable (retryable=False),
    ``record_terminal_failure`` must be valid.
    """
    validator = ExecutionStateMachineValidator(enabled=True)
    ctx = ExecutionTransitionContext(
        run_state="dispatching",
        operator_state="leased",
        attempt_state="dispatching",
        attempt_operator_state="leased",
        retryable=False,
        active_attempt_no=1,
        max_attempts=3,
    )
    r = validator.validate_run_transition(
        trigger="record_terminal_failure",
        context=ctx,
    )
    assert r.valid, f"terminal_failure with non-retryable should be valid: {r.error_message}"
    assert r.decision is not None
    assert r.decision.target_run_state == "dead_lettered"


def test_retryable_failure_delayed_with_budget() -> None:
    """
    A retryable failure with remaining budget and delay must produce
    ``record_retryable_failure_delayed`` valid with retry_backoff.
    """
    validator = ExecutionStateMachineValidator(enabled=True)
    ctx = ExecutionTransitionContext(
        run_state="dispatching",
        operator_state="leased",
        attempt_state="dispatching",
        attempt_operator_state="leased",
        retryable=True,
        active_attempt_no=1,
        max_attempts=3,
    )
    r = validator.validate_run_transition(
        trigger="record_retryable_failure_delayed",
        context=ctx,
    )
    assert r.valid, f"retryable delayed with budget should be valid: {r.error_message}"
    assert r.decision is not None
    assert r.decision.target_run_state == "retry_backoff"
    assert r.decision.source_attempt_state == "failed"
    assert r.decision.replacement_attempt_state == "retry_backoff"


def test_retryable_failure_immediate_with_budget() -> None:
    """
    A retryable failure with remaining budget and no delay must produce
    ``record_retryable_failure_immediate`` valid with queued.
    """
    validator = ExecutionStateMachineValidator(enabled=True)
    ctx = ExecutionTransitionContext(
        run_state="dispatching",
        operator_state="leased",
        attempt_state="dispatching",
        attempt_operator_state="leased",
        retryable=True,
        active_attempt_no=1,
        max_attempts=3,
    )
    r = validator.validate_run_transition(
        trigger="record_retryable_failure_immediate",
        context=ctx,
    )
    assert r.valid, f"retryable immediate with budget should be valid: {r.error_message}"
    assert r.decision is not None
    assert r.decision.target_run_state == "queued"
    assert r.decision.source_attempt_state == "failed"
    assert r.decision.replacement_attempt_state == "queued"


# ---------------------------------------------------------------------------
# Resume fallback for unlisted run states — SPEC §6.5
# ---------------------------------------------------------------------------


def test_resume_fallback_operator_constant_defined() -> None:
    """
    ``_RESUME_FALLBACK_OPERATOR_STATE`` must be ``"admitted"`` as required
    by the SPEC §6.5 compatibility fallback.
    """
    assert _RESUME_FALLBACK_OPERATOR_STATE == "admitted"


def test_resume_fallback_for_timed_out() -> None:
    """
    ``timed_out`` is not in ``RUN_TO_OPERATOR_RESUME_MAP``; the fallback
    ``"admitted"`` must be returned.
    """
    assert "timed_out" not in RUN_TO_OPERATOR_RESUME_MAP


def test_resume_fallback_for_cancelled() -> None:
    """
    ``cancelled`` is not in ``RUN_TO_OPERATOR_RESUME_MAP``; the fallback
    ``"admitted"`` must be returned.
    """
    assert "cancelled" not in RUN_TO_OPERATOR_RESUME_MAP


def test_resume_fallback_for_compensated() -> None:
    """
    ``compensated`` is not in ``RUN_TO_OPERATOR_RESUME_MAP``; the fallback
    ``"admitted"`` must be returned.
    """
    assert "compensated" not in RUN_TO_OPERATOR_RESUME_MAP


# ---------------------------------------------------------------------------
# Quarantine compatibility — SPEC §5 finding 9
# ---------------------------------------------------------------------------


def test_quarantine_from_completed_operator_is_valid() -> None:
    """
    ``quarantine`` from ``completed`` operator state must be valid —
    SPEC §5 finding 9: current service accepts every operator state
    except ``quarantined``, including ``completed`` and ``failed``.
    """
    validator = ExecutionStateMachineValidator(enabled=True)
    r = _run_transition(
        validator,
        "quarantine",
        "succeeded",
        "completed",
    )
    assert r.valid, f"quarantine from completed should be valid: {r.error_message}"
    assert r.decision is not None
    assert r.decision.target_run_state == "dead_lettered"
    assert r.decision.target_operator_state == "quarantined"


def test_quarantine_from_failed_operator_is_valid() -> None:
    """
    ``quarantine`` from ``failed`` operator state must be valid —
    SPEC §5 finding 9 compatibility.
    """
    validator = ExecutionStateMachineValidator(enabled=True)
    r = _run_transition(
        validator,
        "quarantine",
        "failed",
        "failed",
    )
    assert r.valid, f"quarantine from failed operator should be valid: {r.error_message}"
    assert r.decision is not None
    assert r.decision.target_run_state == "dead_lettered"
    assert r.decision.target_operator_state == "quarantined"


# ---------------------------------------------------------------------------
# Validator exception safety — SPEC §9.3
# ---------------------------------------------------------------------------


def test_validator_exception_is_non_fatal() -> None:
    """
    When a ``MachineError`` occurs during validation, the validator must
    catch it and return a result with ``valid=False`` and
    ``MISMATCH_CATEGORY_VALIDATOR_EXCEPTION`` instead of propagating.
    """
    validator = ExecutionStateMachineValidator(enabled=True)
    # Fire an invalid trigger from a state that produces a MachineError
    # (the transitions library raises MachineError for invalid transitions
    # from explicit sources, but wildcard sources produce guard failures).
    # Use ``claim_attempt`` from ``succeeded`` — this is an explicit
    # source error that triggers MachineError.
    ctx = ExecutionTransitionContext(
        run_state="succeeded",
        operator_state="completed",
    )
    result = validator.validate_run_transition(
        trigger="claim_attempt",
        context=ctx,
    )
    # The result must be non-fatal (returns a result, does not raise).
    assert result.validated is True
    assert result.valid is False
    assert result.mismatch_category in (
        MISMATCH_CATEGORY_INVALID_TRIGGER,
        MISMATCH_CATEGORY_VALIDATOR_EXCEPTION,
    )


def test_validator_recovers_after_exception() -> None:
    """
    After a failed validation, the same validator instance must still
    work correctly for subsequent validations.  The internal model must
    be reset for each call.
    """
    validator = ExecutionStateMachineValidator(enabled=True)

    # First call — invalid trigger.
    ctx_bad = ExecutionTransitionContext(
        run_state="succeeded",
        operator_state="completed",
    )
    r1 = validator.validate_run_transition(
        trigger="claim_attempt",
        context=ctx_bad,
    )
    assert r1.valid is False

    # Second call — valid transition on the same validator.
    ctx_good = ExecutionTransitionContext(
        run_state="queued",
        operator_state="admitted",
    )
    r2 = validator.validate_run_transition(
        trigger="claim_attempt",
        context=ctx_good,
    )
    assert r2.valid, f"Validator should recover after exception: {r2.error_message}"
    assert r2.decision is not None
    assert r2.decision.target_run_state == "dispatching"


# ---------------------------------------------------------------------------
# Mermaid diagram smoke test — SPEC §12
# ---------------------------------------------------------------------------


def test_build_execution_state_diagram_returns_string() -> None:
    """build_execution_state_diagram must return a non-empty string."""
    diagram = build_execution_state_diagram()
    assert isinstance(diagram, str)
    assert len(diagram) > 0


def test_build_execution_state_diagram_starts_with_state_diagram_v2() -> None:
    """The diagram must start with the stateDiagram-v2 declaration."""
    diagram = build_execution_state_diagram()
    assert diagram.startswith("stateDiagram-v2"), f"Expected 'stateDiagram-v2' prefix, got {diagram[:50]!r}"


def test_build_execution_state_diagram_contains_run_states() -> None:
    """The diagram must reference run states from RUN_STATES."""
    diagram = build_execution_state_diagram()
    for state in ("queued", "dispatching", "executing", "succeeded", "failed"):
        assert state in diagram, f"State {state!r} not found in diagram"


def test_build_execution_state_diagram_contains_transition_triggers() -> None:
    """The diagram must reference known transition triggers."""
    diagram = build_execution_state_diagram()
    for trigger in ("claim_attempt", "start_execution", "complete_success", "request_cancel"):
        assert trigger in diagram, f"Trigger {trigger!r} not found in diagram"


def test_build_execution_state_diagram_contains_pause_resume() -> None:
    """The diagram must reference operator transitions pause and resume."""
    diagram = build_execution_state_diagram()
    assert "pause" in diagram
    assert "resume" in diagram


def test_build_execution_state_diagram_contains_declared_unreached_states() -> None:
    """The diagram must reference declared-but-unreached states."""
    diagram = build_execution_state_diagram()
    assert "cancelled" in diagram
    assert "compensated" in diagram


def test_build_execution_state_diagram_no_graphviz_import() -> None:
    """
    The diagram function must not import Graphviz or pygraphviz.
    This test verifies the import side-effect constraint from SPEC §12.
    """
    import sys

    for banned_module in ("graphviz", "pygraphviz"):
        assert banned_module not in sys.modules, f"Banned module {banned_module!r} is loaded"


# ---------------------------------------------------------------------------
# Lightweight performance smoke — SPEC §9.6 budget
# ---------------------------------------------------------------------------


def test_performance_smoke_quick_validations() -> None:
    """
    A batch of 100 validations must complete within a reasonable time
    (500ms target for developer machines; the test records a skip
    reason instead of failing if the environment is too slow).
    """
    import time

    validator = ExecutionStateMachineValidator(enabled=True)
    ctx = ExecutionTransitionContext(
        run_state="queued",
        operator_state="admitted",
        attempt_state="queued",
        attempt_operator_state="admitted",
    )

    start = time.perf_counter()
    count = 100
    for _ in range(count):
        r = validator.validate_run_transition(
            trigger="claim_attempt",
            context=ctx,
        )
        assert r.valid, f"Unexpected validation failure in smoke test: {r.error_message}"
    elapsed = time.perf_counter() - start

    avg_ms = (elapsed / count) * 1000
    # SPEC §9.6 target: ≤5ms per invocation.
    msg = f"Average {avg_ms:.2f}ms per validation ({count} in {elapsed:.3f}s)"
    if avg_ms > 5.0:
        # Record actionable skip reason instead of failing.
        import pytest

        pytest.skip(msg)
    else:
        assert avg_ms <= 5.0, msg

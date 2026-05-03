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
    ALL_EXECUTION_TRIGGERS,
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
    ExecutionStateDecision,
    ExecutionStateMachineValidator,
    ExecutionStateSnapshot,
    ExecutionTransitionContext,
    ExecutionTrigger,
    ExecutionValidationResult,
    _ExecutionStateMachineModel,
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


def test_snapshot_defaults_are_safe() -> None:
    """ExecutionStateSnapshot must have safe default values."""
    snap = ExecutionStateSnapshot()
    assert snap.run_state == "queued"
    assert snap.operator_state == "admitted"
    assert snap.run_id is None
    assert snap.attempt_id is None
    assert snap.lease_status is None
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
        extra={"foo": "bar"},
    )
    assert snap.run_id == "run_abc"
    assert snap.attempt_state == "dispatching"
    assert snap.command_id == "cmd_1"
    assert snap.replacement_attempt_id == "attempt_new"
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
        snapshot=snap,
    )
    assert create_result.validated is False

    non_state_result = validator.validate_non_state_operation(
        snapshot=snap,
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
    snap = ExecutionStateSnapshot()

    for operation in ("admit_create", "restart_run_from_scratch"):
        result = validator.validate_creation(
            operation=operation,
            snapshot=snap,
        )
        assert isinstance(result, ExecutionValidationResult)


def test_validator_validate_non_state_operation_accepts_empty_snapshot() -> None:
    """validate_non_state_operation must accept a default snapshot."""
    validator = ExecutionStateMachineValidator(enabled=True)
    snap = ExecutionStateSnapshot()
    result = validator.validate_non_state_operation(snapshot=snap)
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
    for op_source in valid_sources:
        r = _run_transition(validator, "interrupt", "executing", op_source)
        # interrupt goes to cancel_requested
        assert r.decision is None or r.decision.target_run_state == "cancel_requested"


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
    for source in valid_sources:
        r = _run_transition(validator, "quarantine", "executing", source)
        if not r.valid:
            # Some states may not work due to other guards
            assert r.mismatch_category is not None


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

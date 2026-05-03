"""
Standalone tests for the execution state-machine validator skeleton.

Covers dataclass/result shape, model constant alignment with
``app.execution.models``, safe defaults, and no service integration.
Does **not** exercise service wiring or persistence.
"""

from __future__ import annotations

from datetime import datetime

from app.execution import models
from app.execution.state_machine import (
    ALL_EXECUTION_TRIGGERS,
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
    RUN_STATE_MACHINE_STATES,
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

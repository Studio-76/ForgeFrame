"""
Execution state-machine validator module.

Provides typed public contracts, mismatch-category constants, and
a side-effect-free validator wrapper for the ForgeFrame execution
state machine (Phase 1a). This module does not integrate with
service code or write persistence during Phase 1.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

from app.execution.models import RUN_OPERATOR_STATES, RUN_STATES

# ---------------------------------------------------------------------------
# Trigger type — all run-state (§7.1) and operator-state-only (§7.2) triggers
# ---------------------------------------------------------------------------

_EXECUTION_RUN_TRIGGERS = (
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
)
"""Run-state triggers from SPEC §7.1."""

_EXECUTION_OPERATOR_TRIGGERS = (
    "pause",
    "resume",
)
"""Operator-state-only triggers from SPEC §7.2."""

ALL_EXECUTION_TRIGGERS = _EXECUTION_RUN_TRIGGERS + _EXECUTION_OPERATOR_TRIGGERS
"""All recognised execution triggers (run + operator)."""

ExecutionTrigger = Literal[
    # §7.1 run-state triggers
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
    # §7.2 operator-state-only triggers
    "pause",
    "resume",
]
"""
Literal type for every valid state-machine trigger.

Run-state triggers fire on the run-state ``Machine``; operator-state-only
triggers fire on the operator-state ``Machine``. No trigger fires on both
machines simultaneously.
"""

# ---------------------------------------------------------------------------
# Creation operations — SPEC §7.3
# ---------------------------------------------------------------------------

_EXECUTION_CREATION_OPERATIONS = (
    "admit_create",
    "restart_run_from_scratch",
)
"""Creation operations from SPEC §7.3."""

ExecutionCreationOperation = Literal[
    "admit_create",
    "restart_run_from_scratch",
]
"""
Literal type for creation operations.

These operations create new entities rather than transitioning an existing
source run. They must be validated but not modelled as run-state transitions.
"""

# ---------------------------------------------------------------------------
# State constants — mirrors :mod:`app.execution.models`
# ---------------------------------------------------------------------------

RUN_STATE_MACHINE_STATES: tuple[str, ...] = RUN_STATES
"""
Tuple of every valid run-state machine state.

Mirrors ``RUN_STATES`` from :mod:`app.execution.models`. Each entry must
be registered as a state in the run-state ``Machine``.
"""

OPERATOR_STATE_MACHINE_STATES: tuple[str, ...] = RUN_OPERATOR_STATES
"""
Tuple of every valid operator-state machine state.

Mirrors ``RUN_OPERATOR_STATES`` from :mod:`app.execution.models`. Each
entry must be registered as a state in the operator-state ``Machine``.
"""

DECLARED_UNREACHED_RUN_STATES: frozenset[str] = frozenset({"cancelled", "compensated"})
"""
Run states declared in ``RUN_STATES`` but not currently produced by any
inspected service path (SPEC §5, findings 10). They are registered so the
machine recognises them but are not given invented production paths.
"""

# ---------------------------------------------------------------------------
# Mismatch categories — SPEC §9.4
# ---------------------------------------------------------------------------

MISMATCH_CATEGORY_INVALID_TRIGGER: str = "invalid_trigger"
"""A trigger was fired that is not defined for the current state."""

MISMATCH_CATEGORY_GUARD_FAILED: str = "guard_failed"
"""One or more guard conditions returned ``False``."""

MISMATCH_CATEGORY_RUN_STATE_MISMATCH: str = "run_state_mismatch"
"""Expected run-state destination differs from the service outcome."""

MISMATCH_CATEGORY_OPERATOR_STATE_MISMATCH: str = "operator_state_mismatch"
"""Expected operator-state destination differs from the service outcome."""

MISMATCH_CATEGORY_ATTEMPT_STATE_MISMATCH: str = "attempt_state_mismatch"
"""Expected attempt-state destination differs from the service outcome."""

MISMATCH_CATEGORY_REPLACEMENT_ATTEMPT_MISMATCH: str = "replacement_attempt_mismatch"
"""Expected replacement-attempt initialisation differs from reality."""

MISMATCH_CATEGORY_LEASE_STATUS_MISMATCH: str = "lease_status_mismatch"
"""Expected lease-status outcome differs from the service outcome."""

MISMATCH_CATEGORY_CURRENT_ATTEMPT_MISMATCH: str = "current_attempt_mismatch"
"""Expected ``current_attempt_id`` change differs from reality."""

MISMATCH_CATEGORY_APPROVAL_LINK_MISMATCH: str = "approval_link_mismatch"
"""Expected approval-link lifecycle change differs from reality."""

MISMATCH_CATEGORY_CREATION_INITIAL_STATE_MISMATCH: str = "creation_initial_state_mismatch"
"""Created entity initial state differs from expected defaults."""

MISMATCH_CATEGORY_NON_STATE_OPERATION_MUTATED_STATE: str = "non_state_operation_mutated_state"
"""A non-state operation unexpectedly changed a state dimension."""

MISMATCH_CATEGORY_RESUME_OPERATOR_FALLBACK: str = "resume_operator_fallback"
"""Resume used the fallback operator target for an unlisted run state."""

MISMATCH_CATEGORY_VALIDATOR_EXCEPTION: str = "validator_exception"
"""An unexpected exception was raised during validation."""

_ALL_MISMATCH_CATEGORIES: tuple[str, ...] = (
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
)
"""
All recognised mismatch categories from SPEC §9.4.

Each category is a constant exported at module level for use in
validation results and structured log messages.
"""

# ---------------------------------------------------------------------------
# Guard context — SPEC §8.1
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ExecutionTransitionContext:
    """
    Guard-evaluation context populated by the service before validation.

    Guards receive this context and return ``bool``. All fields are
    read-only. Fields that are not yet available are left as ``None``.

    :param run_id: Unique identifier for the execution run
    :param attempt_id: Current attempt identifier
    :param current_attempt_id: ID of the currently active attempt
    :param run_state: Current run state value
    :param operator_state: Current operator state value
    :param attempt_state: Current attempt state value
    :param attempt_operator_state: Current attempt operator state value
    :param attempt_lease_token: Lease token held by the attempt
    :param provided_lease_token: Lease token provided by the caller
    :param attempt_no: Current attempt sequence number
    :param active_attempt_no: Active (latest) attempt sequence number
    :param max_attempts: Maximum allowed attempts for this run
    :param retry_count: Number of retries so far
    :param retryable: Whether the failure is retryable
    :param retry_delay_seconds: Base retry delay in seconds
    :param lease_status: Current lease status
    :param scheduled_at: Scheduled-at timestamp for the attempt
    :param lease_expires_at: Lease expiry timestamp
    :param next_wakeup_at: Next scheduled wake-up time
    :param now: Current wall-clock time used by the service
    :param current_approval_link_id: Open approval link ID (if any)
    :param approval_gate_status: Status of the approval gate
    :param approval_resume_disposition: Resume disposition for approval
    :param has_open_approval: Whether an open approval link exists
    :param has_in_flight_attempt: Whether an in-flight attempt exists
    :param service_chosen_operator_state: Operator state chosen by the
        service (may differ from the machine default)
    """

    run_id: str | None = None
    attempt_id: str | None = None
    current_attempt_id: str | None = None
    run_state: str = "queued"
    operator_state: str = "admitted"
    attempt_state: str | None = None
    attempt_operator_state: str | None = None
    attempt_lease_token: str | None = None
    provided_lease_token: str | None = None
    attempt_no: int | None = None
    active_attempt_no: int = 1
    max_attempts: int | None = None
    retry_count: int | None = None
    retryable: bool | None = None
    retry_delay_seconds: int | None = None
    lease_status: str | None = None
    scheduled_at: datetime | None = None
    lease_expires_at: datetime | None = None
    next_wakeup_at: datetime | None = None
    now: datetime | None = None
    current_approval_link_id: str | None = None
    approval_gate_status: str | None = None
    approval_resume_disposition: str | None = None
    has_open_approval: bool = False
    has_in_flight_attempt: bool = False
    service_chosen_operator_state: str | None = None


# ---------------------------------------------------------------------------
# Pre-transition snapshot — raw persisted state before mutation
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ExecutionStateSnapshot:
    """
    Pre-transition snapshot of persisted run/attempt/lease/approval state.

    Captured before the existing service mutates any state so the
    validator can compare expected vs. actual outcomes.

    :param run_id: Unique identifier for the execution run
    :param attempt_id: Current attempt identifier (may be ``None``)
    :param current_attempt_id: ID of the currently active attempt
    :param run_state: Run state value before mutation
    :param operator_state: Operator state value before mutation
    :param attempt_state: Attempt state value before mutation
    :param attempt_operator_state: Attempt operator state before mutation
    :param lease_status: Lease status before mutation
    :param lease_token: Lease token value before mutation
    :param current_approval_link_id: Approval link ID before mutation
    :param approval_gate_status: Approval gate status before mutation
    :param command_id: Command ID for the operation being validated
    :param replacement_attempt_id: New attempt ID (set after creation)
    :param extra: Additional service-provided context as key-value pairs
    """

    run_id: str | None = None
    attempt_id: str | None = None
    current_attempt_id: str | None = None
    run_state: str = "queued"
    operator_state: str = "admitted"
    attempt_state: str | None = None
    attempt_operator_state: str | None = None
    lease_status: str | None = None
    lease_token: str | None = None
    current_approval_link_id: str | None = None
    approval_gate_status: str | None = None
    command_id: str | None = None
    replacement_attempt_id: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Decision and result types
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ExecutionStateDecision:
    """
    Expected destination states after a validated transition or creation.

    Each field is the target value for the corresponding state dimension.
    ``None`` means the dimension is not expected to change.

    :param target_run_state: Expected run state after the transition
    :param target_operator_state: Expected operator state after the
        transition
    :param target_attempt_state: Expected attempt state after the
        transition
    :param target_attempt_operator_state: Expected attempt operator
        state after the transition
    :param target_lease_status: Expected lease status after the
        transition
    :param target_current_attempt_id: Expected ``current_attempt_id``
        after the transition
    :param source_attempt_state: Expected state of the source attempt
        after mutation (for retry/failure paths where the source attempt
        transitions while a replacement is created)
    :param source_attempt_operator_state: Expected operator state of
        the source attempt after mutation
    :param replacement_attempt_state: Expected state of a replacement
        attempt on creation
    :param replacement_attempt_operator_state: Expected operator state
        of a replacement attempt on creation
    """

    target_run_state: str | None = None
    target_operator_state: str | None = None
    target_attempt_state: str | None = None
    target_attempt_operator_state: str | None = None
    target_lease_status: str | None = None
    target_current_attempt_id: str | None = None
    source_attempt_state: str | None = None
    source_attempt_operator_state: str | None = None
    replacement_attempt_state: str | None = None
    replacement_attempt_operator_state: str | None = None


@dataclass(frozen=True)
class ExecutionValidationResult:
    """
    Outcome of a single state-machine validation call.

    ``valid`` is ``True`` when the validator approves the transition;
    ``mismatch_category`` is set (and ``valid`` is ``False``) when a
    mismatch is detected. ``guard_results`` captures per-guard outcomes
    for diagnostic logging.

    :param valid: Whether the validation passed
    :param mismatch_category: Mismatch category constant from SPEC §9.4,
        or ``None`` when ``valid`` is ``True``
    :param guard_results: Mapping of guard name to guard outcome, or
        ``None`` when no guards were evaluated
    :param decision: Expected destination states computed by the
        validator, or ``None`` when not applicable
    :param error_message: Human-readable error detail, or ``None``
    :param validated: Whether validation was actually performed (as
        opposed to skipped due to the feature flag)
    """

    valid: bool = True
    mismatch_category: str | None = None
    guard_results: dict[str, bool] | None = None
    decision: ExecutionStateDecision | None = None
    error_message: str | None = None
    validated: bool = False


# ---------------------------------------------------------------------------
# Private adapter model — holds run_state / operator_state for Machine
# ---------------------------------------------------------------------------


@dataclass
class _ExecutionStateMachineModel:
    """
    In-memory adapter for two orthogonal ``transitions.Machine`` instances.

    ``run_state`` is the model attribute for the run-state machine;
    ``operator_state`` is the model attribute for the operator-state
    machine. This model is never an ORM object and carries no
    persistence side effects.

    :param run_state: Current run state value
    :param operator_state: Current operator state value
    """

    run_state: str = "queued"
    operator_state: str = "admitted"


# ---------------------------------------------------------------------------
# Public validator — side-effect-free wrapper API
# ---------------------------------------------------------------------------


class ExecutionStateMachineValidator:
    """
    Side-effect-free validator for execution state-machine transitions.

    Provides the public API that the service layer calls during
    Phase 1b dual validation. Each ``validate_*`` method accepts a
    snapshot or context and returns an ``ExecutionValidationResult``.

    The validator does **not** construct ``transitions.Machine``
    instances or evaluate guards in the skeleton (Phase 1a-02). Those
    responsibilities are added in tasks 1a-03 and 1a-04.

    :param enabled: When ``False`` (default), all ``validate_*`` calls
        return immediately with ``validated=False``. The flag is
        injectable and test-controllable without global process state.
    """

    def __init__(self, enabled: bool = False) -> None:
        """
        Initialise the validator.

        :param enabled: Whether validation is active. Defaults to
            ``False`` for safe operation in Phase 1b.
        """
        self._enabled = enabled
        self._model = _ExecutionStateMachineModel()

    # -- Run-state transition validation (§7.1) ---------------------------

    def validate_run_transition(
        self,
        trigger: ExecutionTrigger,
        context: ExecutionTransitionContext,
    ) -> ExecutionValidationResult:
        """
        Validate a run-state trigger against the pre-transition context.

        When the validator is disabled this is a no-op returning
        ``validated=False``.

        :param trigger: The trigger to validate
        :param context: Pre-transition guard context
        :returns: Validation result
        """
        if not self._enabled:
            return ExecutionValidationResult(validated=False)
        # Skeleton: no machine constructed yet; pass through.
        return ExecutionValidationResult(
            valid=True,
            validated=True,
            decision=ExecutionStateDecision(),
        )

    # -- Operator-state-only transition validation (§7.2) ------------------

    def validate_operator_transition(
        self,
        trigger: ExecutionTrigger,
        context: ExecutionTransitionContext,
    ) -> ExecutionValidationResult:
        """
        Validate an operator-state-only trigger.

        Operator-state triggers (``pause``, ``resume``) must never fire on
        the run-state machine. When the validator is disabled this is a
        no-op returning ``validated=False``.

        :param trigger: The operator-state trigger to validate
        :param context: Pre-transition guard context
        :returns: Validation result
        """
        if not self._enabled:
            return ExecutionValidationResult(validated=False)
        # Skeleton: no machine constructed yet; pass through.
        return ExecutionValidationResult(
            valid=True,
            validated=True,
            decision=ExecutionStateDecision(),
        )

    # -- Creation validation (§7.3) ---------------------------------------

    def validate_creation(
        self,
        operation: ExecutionCreationOperation,
        snapshot: ExecutionStateSnapshot,
    ) -> ExecutionValidationResult:
        """
        Validate a creation operation's initial state.

        ``admit_create`` and ``restart_run_from_scratch`` create new
        entities rather than transitioning an existing source run.
        When the validator is disabled this is a no-op returning
        ``validated=False``.

        :param operation: The creation operation to validate
        :param snapshot: Pre-creation state snapshot
        :returns: Validation result
        """
        if not self._enabled:
            return ExecutionValidationResult(validated=False)
        # Skeleton: no validation logic yet; pass through.
        return ExecutionValidationResult(
            valid=True,
            validated=True,
            decision=ExecutionStateDecision(),
        )

    # -- Non-state-operation validation (§7.4) -----------------------------

    def validate_non_state_operation(
        self,
        snapshot: ExecutionStateSnapshot,
    ) -> ExecutionValidationResult:
        """
        Validate that a non-state operation did not mutate state dimensions.

        Operations such as ``renew_attempt_lease`` and ``escalate_run``
        must not change ``run_state``, ``operator_state``, or attempt
        state dimensions. When the validator is disabled this is a no-op
        returning ``validated=False``.

        :param snapshot: Pre-operation state snapshot
        :returns: Validation result
        """
        if not self._enabled:
            return ExecutionValidationResult(validated=False)
        # Skeleton: no comparison logic yet; pass through.
        return ExecutionValidationResult(
            valid=True,
            validated=True,
            decision=ExecutionStateDecision(),
        )

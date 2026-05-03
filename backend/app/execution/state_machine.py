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

from transitions import Machine, MachineError

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
# Terminal / guard-support constants — mirrors :mod:`app.execution.service`
# ---------------------------------------------------------------------------

TERMINAL_RUN_STATES: frozenset[str] = frozenset({
    "succeeded",
    "failed",
    "cancelled",
    "timed_out",
    "compensated",
    "dead_lettered",
})
"""
Run states considered terminal. Transitions from these states are not
allowed by guard conditions that enforce terminal-state exclusion.
"""

TERMINAL_OPERATOR_STATES: frozenset[str] = frozenset({
    "completed",
    "quarantined",
    "failed",
})
"""
Operator states considered terminal.
"""

CLAIMABLE_RUN_STATES: frozenset[str] = frozenset({"queued", "retry_backoff"})
"""
Run states from which ``claim_attempt`` is valid.
"""

RETRYABLE_RUN_STATES: frozenset[str] = frozenset({
    "failed",
    "timed_out",
    "compensated",
    "dead_lettered",
})
"""
Run states from which ``admit_retry`` is valid.
"""

# ---------------------------------------------------------------------------
# Run-state transition table — SPEC §7.1
# ---------------------------------------------------------------------------

RUN_STATE_TRANSITIONS: tuple[dict[str, Any], ...] = (
    # -- claim_attempt: queued or retry_backoff -> dispatching --
    {"trigger": "claim_attempt", "source": "queued", "dest": "dispatching", "conditions": "is_claimable_run"},
    {"trigger": "claim_attempt", "source": "retry_backoff", "dest": "dispatching", "conditions": "is_claimable_run"},
    # -- start_execution: dispatching -> executing --
    {"trigger": "start_execution", "source": "dispatching", "dest": "executing"},
    # -- open_approval: executing -> waiting_on_approval --
    {"trigger": "open_approval", "source": "executing", "dest": "waiting_on_approval"},
    # -- resume_after_approval: waiting_on_approval -> queued --
    {"trigger": "resume_after_approval", "source": "waiting_on_approval", "dest": "queued"},
    # -- reject_approval paths: waiting_on_approval -> termination --
    {"trigger": "reject_approval_cancel", "source": "waiting_on_approval", "dest": "cancel_requested"},
    {"trigger": "reject_approval_compensate", "source": "waiting_on_approval", "dest": "compensating"},
    {"trigger": "reject_approval_fail", "source": "waiting_on_approval", "dest": "failed"},
    # -- complete_success: multiple sources -> succeeded --
    {"trigger": "complete_success", "source": ["dispatching", "executing", "cancel_requested", "compensating"], "dest": "succeeded"},
    # -- record_retryable_failure_delayed: dispatching/executing -> retry_backoff --
    {"trigger": "record_retryable_failure_delayed", "source": ["dispatching", "executing"], "dest": "retry_backoff"},
    # -- record_retryable_failure_immediate: dispatching/executing -> queued --
    {"trigger": "record_retryable_failure_immediate", "source": ["dispatching", "executing"], "dest": "queued"},
    # -- record_terminal_failure: dispatching/executing -> dead_lettered --
    {"trigger": "record_terminal_failure", "source": ["dispatching", "executing"], "dest": "dead_lettered"},
    # -- request_cancel: any state with guard condition --
    {"trigger": "request_cancel", "source": "*", "dest": "cancel_requested", "conditions": "is_cancellable"},
    # -- admit_retry: retryable terminal -> queued --
    {"trigger": "admit_retry", "source": ["failed", "timed_out", "compensated", "dead_lettered"], "dest": "queued"},
    # -- interrupt: any operator state with guard --
    {"trigger": "interrupt", "source": "*", "dest": "cancel_requested", "conditions": "is_interruptible"},
    # -- quarantine: any operator state excluding quarantined --
    {"trigger": "quarantine", "source": "*", "dest": "dead_lettered", "conditions": "is_not_quarantined"},
    # -- expire_lease: in-flight with expired lease --
    {"trigger": "expire_lease", "source": "*", "dest": "timed_out", "conditions": "has_expired_lease"},
)
"""
Run-state transition table from SPEC §7.1.

Each entry declares a trigger, allowed source state(s), destination
state, and optional guard conditions. Transitions with ``source="*"``
match any state and rely on guard conditions for restriction.
"""

# ---------------------------------------------------------------------------
# Operator-state transition table — SPEC §7.2
# ---------------------------------------------------------------------------

OPERATOR_STATE_TRANSITIONS: tuple[dict[str, Any], ...] = (
    # -- pause: any pausable operator state -> paused --
    {"trigger": "pause", "source": "*", "dest": "paused", "conditions": "is_operator_pausable"},
    # -- resume: paused -> target from RUN_TO_OPERATOR_RESUME_MAP --
    {"trigger": "resume", "source": "*", "dest": "=", "conditions": "is_operator_resumable"},
)
"""
Operator-state-only transition table from SPEC §7.2.

Only ``pause`` and ``resume`` fire on the operator-state machine. Both
use guard conditions to restrict applicability. ``resume`` uses
``dest="="`` (stay in current state) because the actual destination is
determined dynamically by ``RUN_TO_OPERATOR_RESUME_MAP``.
"""

# ---------------------------------------------------------------------------
# Trigger-aware run/operator coordination — SPEC §6.5
# ---------------------------------------------------------------------------

# Each entry maps trigger -> (target_run_state, valid_operator_states).
# Triggers with multiple valid operator states use a tuple of options.
RUN_OPERATOR_TARGETS_BY_TRIGGER: dict[str, tuple[str, tuple[str, ...]]] = {
    "claim_attempt": ("dispatching", ("leased",)),
    "start_execution": ("executing", ("executing", "waiting_external")),
    "open_approval": ("waiting_on_approval", ("waiting_on_approval",)),
    "resume_after_approval": ("queued", ("admitted",)),
    "reject_approval_cancel": ("cancel_requested", ("cancel_requested",)),
    "reject_approval_compensate": ("compensating", ("compensating",)),
    "reject_approval_fail": ("failed", ("failed",)),
    "complete_success": ("succeeded", ("completed",)),
    "record_retryable_failure_delayed": (
        "retry_backoff",
        ("retry_scheduled",),
    ),
    "record_retryable_failure_immediate": ("queued", ("admitted",)),
    "record_terminal_failure": ("dead_lettered", ("quarantined",)),
    "request_cancel": ("cancel_requested", ("cancel_requested",)),
    "admit_retry": ("queued", ("admitted",)),
    "interrupt": ("cancel_requested", ("interrupted",)),
    "quarantine": ("dead_lettered", ("quarantined",)),
    "expire_lease": ("timed_out", ("quarantined",)),
}
"""
Trigger-aware run-state-to-operator-state coordination from SPEC §6.5.

Each trigger maps to a ``(target_run_state, valid_operator_states)``
tuple. The operator states tuple lists every valid operator-state
pairing for the target run state. ``start_execution`` has two valid
operator targets (``executing``, ``waiting_external``) because the
service may choose either depending on external-call requirements
at execution time.
"""

RUN_TO_OPERATOR_RESUME_MAP: dict[str, str] = {
    "queued": "admitted",
    "dispatching": "leased",
    "executing": "waiting_external",
    "waiting_on_approval": "waiting_on_approval",
    "cancel_requested": "cancel_requested",
    "retry_backoff": "retry_scheduled",
    "compensating": "compensating",
    "succeeded": "completed",
    "failed": "failed",
    "dead_lettered": "quarantined",
}
"""
Run-state-to-operator-state mapping for ``resume`` target from SPEC §6.5.

For run states not listed (``timed_out``, ``cancelled``,
``compensated``), the compatibility fallback is ``"admitted"``.  The
validator logs ``MISMATCH_CATEGORY_RESUME_OPERATOR_FALLBACK`` when the
fallback is used.
"""

_RESUME_FALLBACK_OPERATOR_STATE: str = "admitted"
"""
Fallback operator state for ``resume`` when the current run state is
not listed in ``RUN_TO_OPERATOR_RESUME_MAP``.
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

    Guard methods are bound to this model so ``transitions`` can
    evaluate ``conditions`` references. Each guard receives the
    transition event via ``send_event=True`` and accesses the
    ``ExecutionTransitionContext`` through ``event.kwargs["context"]``.

    :param run_state: Current run state value
    :param operator_state: Current operator state value
    """

    run_state: str = "queued"
    operator_state: str = "admitted"
    _context: ExecutionTransitionContext | None = None
    _guard_results: dict[str, bool] = field(default_factory=dict)

    # -- Guard methods (SPEC §8.2) -----------------------------------------

    def _record_guard(self, name: str, result: bool) -> bool:
        """Record a guard result and return it."""
        self._guard_results[name] = result
        return result

    def is_claimable_run(self, event: Any) -> bool:
        """
        Guard: run state must be claimable (queued or retry_backoff).

        :param event: Transition event with ``event.kwargs["context"]``
        :returns: ``True`` when the run state is claimable
        """
        return self._record_guard(
            "is_claimable_run",
            self.run_state in CLAIMABLE_RUN_STATES,
        )

    def is_cancellable(self, event: Any) -> bool:
        """
        Guard: run must not be terminal or already cancel_requested.

        :param event: Transition event
        :returns: ``True`` when the run can be cancelled
        """
        return self._record_guard(
            "is_cancellable",
            self.run_state not in TERMINAL_RUN_STATES and self.run_state != "cancel_requested",
        )

    def is_interruptible(self, event: Any) -> bool:
        """
        Guard: operator state must not be terminal.

        :param event: Transition event
        :returns: ``True`` when the operator can be interrupted
        """
        return self._record_guard(
            "is_interruptible",
            self.operator_state not in TERMINAL_OPERATOR_STATES,
        )

    def is_not_quarantined(self, event: Any) -> bool:
        """
        Guard: operator state must not already be quarantined.

        :param event: Transition event
        :returns: ``True`` when the run is not yet quarantined
        """
        return self._record_guard(
            "is_not_quarantined",
            self.operator_state != "quarantined",
        )

    def has_expired_lease(self, event: Any) -> bool:
        """
        Guard: lease must be expired (leased + past expiry).

        :param event: Transition event with context in ``event.kwargs``
        :returns: ``True`` when the lease has expired
        """
        ctx: ExecutionTransitionContext | None = event.kwargs.get("context")
        result = ctx is not None and ctx.lease_status == "leased" and ctx.lease_expires_at is not None and ctx.now is not None and ctx.lease_expires_at < ctx.now
        return self._record_guard("has_expired_lease", result)

    def is_operator_pausable(self, event: Any) -> bool:
        """
        Guard: operator state must not be terminal or already paused.

        :param event: Transition event
        :returns: ``True`` when the operator can be paused
        """
        return self._record_guard(
            "is_operator_pausable",
            self.operator_state not in TERMINAL_OPERATOR_STATES and self.operator_state != "paused",
        )

    def is_operator_resumable(self, event: Any) -> bool:
        """
        Guard: operator must be paused with no open approval.

        :param event: Transition event with context in ``event.kwargs``
        :returns: ``True`` when the operator can be resumed
        """
        ctx: ExecutionTransitionContext | None = event.kwargs.get("context")
        result = self.operator_state == "paused" and ctx is not None and not ctx.has_open_approval and ctx.current_approval_link_id is None
        return self._record_guard("is_operator_resumable", result)


# ---------------------------------------------------------------------------
# Public validator — side-effect-free wrapper API
# ---------------------------------------------------------------------------


class ExecutionStateMachineValidator:
    """
    Side-effect-free validator for execution state-machine transitions.

    Provides the public API that the service layer calls during
    Phase 1b dual validation. Each ``validate_*`` method accepts a
    snapshot or context and returns an ``ExecutionValidationResult``.

    When enabled, the validator constructs two ``transitions.Machine``
    instances on a private adapter model:

    - **Run-state machine** (``model_attribute="run_state"``) validates
      SPEC §7.1 triggers.
    - **Operator-state machine** (``model_attribute="operator_state"``)
      validates SPEC §7.2 triggers.

    :param enabled: When ``False`` (default), all ``validate_*`` calls
        return immediately with ``validated=False``. The flag is
        injectable and test-controllable without global process state.
    """

    def __init__(self, enabled: bool = False) -> None:
        """
        Initialise the validator and optionally build machines.

        When *enabled* is ``True``, both the run-state and operator-state
        machines are constructed on the private adapter model. Machines
        are never built when disabled (SPEC §3.3).

        :param enabled: Whether validation is active. Defaults to
            ``False`` for safe operation in Phase 1b.
        """
        self._enabled = enabled
        self._model = _ExecutionStateMachineModel()
        self._run_machine: Machine | None = None
        self._operator_machine: Machine | None = None
        self._run_machine_triggers: frozenset[str] = frozenset(
            _EXECUTION_RUN_TRIGGERS,
        )
        self._operator_machine_triggers: frozenset[str] = frozenset(
            _EXECUTION_OPERATOR_TRIGGERS,
        )

        if enabled:
            self._run_machine = Machine(
                model=self._model,
                states=list(RUN_STATE_MACHINE_STATES),
                transitions=list(RUN_STATE_TRANSITIONS),
                initial=self._model.run_state,
                model_attribute="run_state",
                send_event=True,
                auto_transitions=False,
                ignore_invalid_triggers=False,
            )
            self._operator_machine = Machine(
                model=self._model,
                states=list(OPERATOR_STATE_MACHINE_STATES),
                transitions=list(OPERATOR_STATE_TRANSITIONS),
                initial=self._model.operator_state,
                model_attribute="operator_state",
                send_event=True,
                auto_transitions=False,
                ignore_invalid_triggers=False,
            )

    # -- Internal: fire a trigger on a machine and build the result -------

    def _fire_and_build_result(
        self,
        trigger: ExecutionTrigger,
        context: ExecutionTransitionContext,
        machine: Machine,
        machine_triggers: frozenset[str],
        is_run_machine: bool,
    ) -> ExecutionValidationResult:
        """
        Reset the adapter model, fire *trigger*, and return the result.

        :param trigger: The trigger name to fire
        :param context: Current state and guard context
        :param machine: The ``transitions.Machine`` to fire on
        :param machine_triggers: Set of valid trigger names for this
            machine
        :param is_run_machine: ``True`` for run machine, ``False`` for
            operator machine (affects which state attribute to read for
            the decision)
        :returns: Validation result
        """
        # Reset the adapter to match the pre-transition context.
        self._model.run_state = context.run_state
        self._model.operator_state = context.operator_state
        self._model._context = context
        self._model._guard_results = {}

        if trigger not in machine_triggers:
            if is_run_machine:
                # Operator trigger fired on run machine — still valid,
                # just skip (each trigger fires on exactly one machine).
                return ExecutionValidationResult(
                    valid=True,
                    validated=True,
                    decision=ExecutionStateDecision(),
                )
            return ExecutionValidationResult(
                valid=False,
                validated=True,
                mismatch_category=MISMATCH_CATEGORY_INVALID_TRIGGER,
                error_message=(f"Trigger {trigger!r} is not valid for {'run' if is_run_machine else 'operator'}-state machine."),
            )

        trigger_method = getattr(self._model, trigger, None)
        if trigger_method is None:
            return ExecutionValidationResult(
                valid=False,
                validated=True,
                mismatch_category=MISMATCH_CATEGORY_INVALID_TRIGGER,
                error_message=(f"Trigger method {trigger!r} not found on model."),
            )

        try:
            trigger_method(context=context)
        except MachineError:
            guard_results = dict(self._model._guard_results) if self._model._guard_results else None
            failed = {k for k, v in self._model._guard_results.items() if not v} if self._model._guard_results else set()
            if failed:
                return ExecutionValidationResult(
                    valid=False,
                    validated=True,
                    mismatch_category=MISMATCH_CATEGORY_GUARD_FAILED,
                    guard_results=guard_results,
                    error_message=(f"Guard(s) blocked: {', '.join(sorted(failed))}"),
                )
            return ExecutionValidationResult(
                valid=False,
                validated=True,
                mismatch_category=MISMATCH_CATEGORY_INVALID_TRIGGER,
                guard_results=guard_results,
                error_message=(f"Trigger {trigger!r} not allowed from state {context.run_state if is_run_machine else context.operator_state!r}."),
            )
        except Exception as exc:
            return ExecutionValidationResult(
                valid=False,
                validated=True,
                mismatch_category=MISMATCH_CATEGORY_VALIDATOR_EXCEPTION,
                error_message=str(exc),
            )

        # Post-trigger guard check: transitions 0.9.x may silently swallow
        # guard failures on wildcard (source="*") transitions instead of
        # raising MachineError. Detect this case by inspecting recorded
        # guard outcomes after the call.
        guard_results = dict(self._model._guard_results) if self._model._guard_results else None
        failed_guards = {k for k, v in self._model._guard_results.items() if not v} if self._model._guard_results else set()
        if failed_guards:
            return ExecutionValidationResult(
                valid=False,
                validated=True,
                mismatch_category=MISMATCH_CATEGORY_GUARD_FAILED,
                guard_results=guard_results,
                error_message=(f"Guard(s) blocked: {', '.join(sorted(failed_guards))}"),
            )

        decision = ExecutionStateDecision(
            target_run_state=self._model.run_state,
            target_operator_state=self._model.operator_state,
        )
        return ExecutionValidationResult(
            valid=True,
            validated=True,
            decision=decision,
            guard_results=guard_results,
        )

    # -- Run-state transition validation (§7.1) ---------------------------

    def validate_run_transition(
        self,
        trigger: ExecutionTrigger,
        context: ExecutionTransitionContext,
    ) -> ExecutionValidationResult:
        """
        Validate a run-state trigger against the pre-transition context.

        When the validator is disabled this is a no-op returning
        ``validated=False``. The trigger is fired on the run-state
        machine; operator-only triggers are silently accepted (they
        fire on the operator machine instead).

        :param trigger: The trigger to validate
        :param context: Pre-transition guard context
        :returns: Validation result
        """
        if not self._enabled or self._run_machine is None:
            return ExecutionValidationResult(validated=False)
        return self._fire_and_build_result(
            trigger=trigger,
            context=context,
            machine=self._run_machine,
            machine_triggers=self._run_machine_triggers,
            is_run_machine=True,
        )

    # -- Operator-state-only transition validation (§7.2) ------------------

    def validate_operator_transition(
        self,
        trigger: ExecutionTrigger,
        context: ExecutionTransitionContext,
    ) -> ExecutionValidationResult:
        """
        Validate an operator-state-only trigger.

        Operator-state triggers (``pause``, ``resume``) fire on the
        operator-state machine. Run-state triggers passed here are
        silently accepted and produce a no-op decision. When the
        validator is disabled this is a no-op returning
        ``validated=False``.

        :param trigger: The operator-state trigger to validate
        :param context: Pre-transition guard context
        :returns: Validation result
        """
        if not self._enabled or self._operator_machine is None:
            return ExecutionValidationResult(validated=False)
        return self._fire_and_build_result(
            trigger=trigger,
            context=context,
            machine=self._operator_machine,
            machine_triggers=self._operator_machine_triggers,
            is_run_machine=False,
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

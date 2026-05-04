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
    {"trigger": "claim_attempt", "source": "queued", "dest": "dispatching", "conditions": ["is_claimable_run", "is_claimable_attempt", "is_claimable_wakeup_due"]},
    {"trigger": "claim_attempt", "source": "retry_backoff", "dest": "dispatching", "conditions": ["is_claimable_run", "is_claimable_attempt", "is_claimable_wakeup_due"]},
    # -- start_execution: dispatching -> executing --
    {"trigger": "start_execution", "source": "dispatching", "dest": "executing", "conditions": ["is_not_paused", "has_valid_lease_token"]},
    # -- open_approval: executing -> waiting_on_approval --
    {"trigger": "open_approval", "source": "executing", "dest": "waiting_on_approval", "conditions": ["is_executing"]},
    # -- resume_after_approval: waiting_on_approval -> queued --
    {"trigger": "resume_after_approval", "source": "waiting_on_approval", "dest": "queued", "conditions": ["has_open_approval_gate", "is_waiting_on_approval"]},
    # -- reject_approval paths: waiting_on_approval -> termination --
    {"trigger": "reject_approval_cancel", "source": "waiting_on_approval", "dest": "cancel_requested", "conditions": ["has_open_approval_gate", "is_waiting_on_approval"]},
    {"trigger": "reject_approval_compensate", "source": "waiting_on_approval", "dest": "compensating", "conditions": ["has_open_approval_gate", "is_waiting_on_approval"]},
    {"trigger": "reject_approval_fail", "source": "waiting_on_approval", "dest": "failed", "conditions": ["has_open_approval_gate", "is_waiting_on_approval"]},
    # -- complete_success: multiple sources -> succeeded --
    {
        "trigger": "complete_success",
        "source": ["dispatching", "executing", "cancel_requested", "compensating"],
        "dest": "succeeded",
        "conditions": ["is_in_flight_attempt", "has_valid_lease_token", "is_current_attempt"],
    },
    # -- record_retryable_failure_delayed: dispatching/executing -> retry_backoff --
    {
        "trigger": "record_retryable_failure_delayed",
        "source": ["dispatching", "executing"],
        "dest": "retry_backoff",
        "conditions": ["is_recordable_failure", "has_valid_lease_token", "is_retryable_and_has_budget", "is_current_attempt"],
    },
    # -- record_retryable_failure_immediate: dispatching/executing -> queued --
    {
        "trigger": "record_retryable_failure_immediate",
        "source": ["dispatching", "executing"],
        "dest": "queued",
        "conditions": ["is_recordable_failure", "has_valid_lease_token", "is_retryable_and_has_budget", "is_current_attempt"],
    },
    # -- record_terminal_failure: dispatching/executing -> dead_lettered --
    {
        "trigger": "record_terminal_failure",
        "source": ["dispatching", "executing"],
        "dest": "dead_lettered",
        "conditions": ["is_recordable_failure", "has_valid_lease_token", "is_terminal_failure_destination", "is_current_attempt"],
    },
    # -- request_cancel: any state with guard condition --
    {"trigger": "request_cancel", "source": "*", "dest": "cancel_requested", "conditions": "is_cancellable"},
    # -- admit_retry: retryable terminal -> queued --
    {"trigger": "admit_retry", "source": ["failed", "timed_out", "compensated", "dead_lettered"], "dest": "queued", "conditions": ["is_retryable_run"]},
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
# Attempt effects — SPEC §6.4
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class AttemptEffect:
    """
    Expected attempt-state effects for a single trigger.

    Each field represents the expected value of a state dimension after
    the transition completes. ``None`` means the dimension is not
    expected to change (or is not applicable to this trigger).

    :param target_attempt_state: Expected attempt state after transition
    :param target_attempt_operator_state: Expected attempt operator state
        after transition
    :param source_attempt_state: Expected state of the source attempt
        after mutation (for retry paths where the source attempt is
        mutated while a replacement is created)
    :param source_attempt_operator_state: Expected operator state of the
        source attempt after mutation
    :param replacement_attempt_state: Expected state of a replacement
        attempt on creation
    :param replacement_attempt_operator_state: Expected operator state
        of a replacement attempt on creation
    :param target_lease_status: Expected lease status after transition
    :param replaces_current_attempt: ``True`` when this trigger creates a
        new current attempt (replacing the existing one)
    """

    target_attempt_state: str | None = None
    target_attempt_operator_state: str | None = None
    source_attempt_state: str | None = None
    source_attempt_operator_state: str | None = None
    replacement_attempt_state: str | None = None
    replacement_attempt_operator_state: str | None = None
    target_lease_status: str | None = None
    replaces_current_attempt: bool = False


# Context-dependent triggers: ``start_execution`` uses
# ``service_chosen_operator_state`` to determine the attempt operator
# target; ``resume`` uses ``RUN_TO_OPERATOR_RESUME_MAP``; ``pause``
# always targets ``paused``; ``claim_attempt`` always targets ``leased``.
ATTEMPT_EFFECTS_BY_TRIGGER: dict[str, AttemptEffect] = {
    "claim_attempt": AttemptEffect(
        target_attempt_state="dispatching",
        target_attempt_operator_state="leased",
        target_lease_status="leased",
    ),
    "start_execution": AttemptEffect(
        target_attempt_state="executing",
        target_attempt_operator_state=None,  # resolved from context
        target_lease_status="leased",
    ),
    "open_approval": AttemptEffect(
        target_attempt_state="waiting_on_approval",
        target_attempt_operator_state="waiting_on_approval",
        target_lease_status="released",
    ),
    "resume_after_approval": AttemptEffect(
        target_attempt_state="queued",
        target_attempt_operator_state="admitted",
        target_lease_status="released",
    ),
    "reject_approval_cancel": AttemptEffect(
        target_attempt_state="cancel_requested",
        target_attempt_operator_state="cancel_requested",
    ),
    "reject_approval_compensate": AttemptEffect(
        target_attempt_state="compensating",
        target_attempt_operator_state="compensating",
    ),
    "reject_approval_fail": AttemptEffect(
        target_attempt_state="failed",
        target_attempt_operator_state="failed",
    ),
    "complete_success": AttemptEffect(
        target_attempt_state="succeeded",
        target_attempt_operator_state="completed",
        target_lease_status="released",
    ),
    "record_retryable_failure_delayed": AttemptEffect(
        source_attempt_state="failed",
        source_attempt_operator_state="failed",
        replacement_attempt_state="retry_backoff",
        replacement_attempt_operator_state="retry_scheduled",
        target_lease_status="released",
        replaces_current_attempt=True,
    ),
    "record_retryable_failure_immediate": AttemptEffect(
        source_attempt_state="failed",
        source_attempt_operator_state="failed",
        replacement_attempt_state="queued",
        replacement_attempt_operator_state="admitted",
        target_lease_status="released",
        replaces_current_attempt=True,
    ),
    "record_terminal_failure": AttemptEffect(
        source_attempt_state="dead_lettered",
        source_attempt_operator_state="quarantined",
        target_lease_status="released",
    ),
    "request_cancel": AttemptEffect(
        target_attempt_state="cancel_requested",
        target_attempt_operator_state="cancel_requested",
    ),
    "admit_retry": AttemptEffect(
        replacement_attempt_state="queued",
        replacement_attempt_operator_state="admitted",
        replaces_current_attempt=True,
    ),
    "interrupt": AttemptEffect(
        target_attempt_state="cancel_requested",
        target_attempt_operator_state="interrupted",
        target_lease_status="released",
    ),
    "quarantine": AttemptEffect(
        target_attempt_state="dead_lettered",
        target_attempt_operator_state="quarantined",
        target_lease_status="released",
    ),
    "expire_lease": AttemptEffect(
        target_attempt_state="timed_out",
        target_attempt_operator_state="interrupted",
        target_lease_status="expired",
    ),
    "pause": AttemptEffect(
        target_attempt_operator_state="paused",
    ),
    "resume": AttemptEffect(
        target_attempt_operator_state=None,  # resolved from context
    ),
}
"""
Mandatory attempt effects per SPEC §6.4.

Maps each trigger to the expected attempt-state, attempt-operator-state,
and lease-status outcomes. Triggers that produce a replacement attempt
set ``replacement_attempt_state`` and ``replacement_attempt_operator_state``
and mark ``replaces_current_attempt=True``.
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

# ---------------------------------------------------------------------------
# Guard failure messages — human-readable reasons for `check_transition_allowed`
# ---------------------------------------------------------------------------

_GUARD_FAILURE_MESSAGES: dict[str, str] = {
    "is_cancellable": "Run is in a terminal state or already cancel_requested.",
    "is_claimable_run": "Run is not in a claimable state (must be queued or retry_backoff).",
    "is_claimable_attempt": "Attempt is not in a claimable state.",
    "is_claimable_wakeup_due": "Attempt wake-up time has not yet arrived.",
    "is_not_paused": "Run or attempt is paused.",
    "is_executing": "Run is not in executing state.",
    "has_open_approval_gate": "Approval gate is not open.",
    "is_waiting_on_approval": "Run is not waiting on approval.",
    "is_current_attempt": "Attempt is not the current active attempt.",
    "is_in_flight_attempt": "Attempt is not in an in-flight state.",
    "is_recordable_failure": "Run or attempt is not in a recordable failure state.",
    "is_retryable_run": "Run is not in a retryable state.",
    "is_retryable_and_has_budget": "Failure is not retryable or no retry budget remains.",
    "is_terminal_failure_destination": "Failure is retryable with remaining budget (terminal destination not valid).",
    "has_valid_lease_token": "Lease token does not match the active worker claim.",
    "has_expired_lease": "Lease has not expired.",
    "is_not_quarantined": "Run is already quarantined.",
    "is_operator_pausable": "Operator state is terminal or already paused.",
    "is_operator_resumable": "Operator is not paused or has an open approval.",
    "is_interruptible": "Operator state is terminal.",
    "is_valid_service_chosen_operator_state": "Chosen operator state is not valid for this trigger.",
}

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
class SourceRunInvariants:
    """
    Source run state dimensions that must not change during a restart operation.

    Captured *before* the service mutates the source run so the validator
    can confirm the source run's state dimensions remain unchanged after
    the creation operation completes.

    :param run_state: Source run state value before the operation
    :param operator_state: Source run operator state before the operation
    :param current_attempt_id: Source run current attempt ID before the
        operation (may be ``None``)
    """

    run_state: str = "queued"
    operator_state: str = "admitted"
    current_attempt_id: str | None = None


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
    :param source_run_invariants: Source run invariants for restart
        validation, or ``None`` when not applicable
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
    source_run_invariants: SourceRunInvariants | None = None
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
        if ctx is None or ctx.lease_status != "leased" or ctx.lease_expires_at is None or ctx.now is None:
            return self._record_guard("has_expired_lease", False)
        # Normalise timezone-naive vs timezone-aware comparison
        # (one side may be offset-aware while the other is naive).
        expires: datetime = ctx.lease_expires_at
        now: datetime = ctx.now
        if (expires.tzinfo is None) != (now.tzinfo is None):
            expires = expires.replace(tzinfo=None)
            now = now.replace(tzinfo=None)
        result = expires < now
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

    # -- Additional guards (SPEC §8.2) -------------------------------------

    def is_claimable_attempt(self, event: Any) -> bool:
        """
        Guard: attempt must be in a claimable state.

        :param event: Transition event with context in ``event.kwargs``
        :returns: ``True`` when the attempt is claimable
        """
        ctx: ExecutionTransitionContext | None = event.kwargs.get("context")
        result = ctx is not None and ctx.attempt_state in ("queued", "retry_backoff") and ctx.attempt_operator_state in ("admitted", "retry_scheduled")
        return self._record_guard("is_claimable_attempt", result)

    def is_claimable_wakeup_due(self, event: Any) -> bool:
        """
        Guard: the scheduled wake-up time must be due or absent.

        :param event: Transition event with context in ``event.kwargs``
        :returns: ``True`` when the wake-up is due or no schedule exists
        """
        ctx: ExecutionTransitionContext | None = event.kwargs.get("context")
        result: bool
        if ctx is None or ctx.scheduled_at is None or ctx.now is None:
            result = True
        else:
            scheduled = ctx.scheduled_at
            now = ctx.now
            # Normalise timezone-naive vs timezone-aware comparison
            # (one side may be offset-aware while the other is naive).
            if (scheduled.tzinfo is None) != (now.tzinfo is None):
                scheduled = scheduled.replace(tzinfo=None)
                now = now.replace(tzinfo=None)
            result = scheduled <= now
        return self._record_guard("is_claimable_wakeup_due", result)

    def is_not_paused(self, event: Any) -> bool:
        """
        Guard: neither the run operator nor attempt operator is paused.

        :param event: Transition event with context in ``event.kwargs``
        :returns: ``True`` when neither operator is paused
        """
        ctx: ExecutionTransitionContext | None = event.kwargs.get("context")
        result = self.operator_state != "paused" and (ctx is None or ctx.attempt_operator_state != "paused")
        return self._record_guard("is_not_paused", result)

    def is_executing(self, event: Any) -> bool:
        """
        Guard: run state and attempt state must both be ``executing``.

        :param event: Transition event with context in ``event.kwargs``
        :returns: ``True`` when both run and attempt are executing
        """
        ctx: ExecutionTransitionContext | None = event.kwargs.get("context")
        result = self.run_state == "executing" and ctx is not None and ctx.attempt_state == "executing"
        return self._record_guard("is_executing", result)

    def has_open_approval_gate(self, event: Any) -> bool:
        """
        Guard: the approval gate must be open.

        :param event: Transition event with context in ``event.kwargs``
        :returns: ``True`` when the approval gate is open
        """
        ctx: ExecutionTransitionContext | None = event.kwargs.get("context")
        result = ctx is not None and ctx.approval_gate_status == "open"
        return self._record_guard("has_open_approval_gate", result)

    def is_waiting_on_approval(self, event: Any) -> bool:
        """
        Guard: run and attempt must be in the waiting-on-approval state.

        :param event: Transition event with context in ``event.kwargs``
        :returns: ``True`` when both are waiting on approval
        """
        ctx: ExecutionTransitionContext | None = event.kwargs.get("context")
        result = self.run_state == "waiting_on_approval" and ctx is not None and ctx.attempt_state == "waiting_on_approval"
        return self._record_guard("is_waiting_on_approval", result)

    def is_current_attempt(self, event: Any) -> bool:
        """
        Guard: the attempt ID must match the current attempt ID.

        :param event: Transition event with context in ``event.kwargs``
        :returns: ``True`` when the attempt is the current attempt
        """
        ctx: ExecutionTransitionContext | None = event.kwargs.get("context")
        result = ctx is not None and ctx.attempt_id is not None and ctx.current_attempt_id is not None and ctx.attempt_id == ctx.current_attempt_id
        return self._record_guard("is_current_attempt", result)

    def is_in_flight_attempt(self, event: Any) -> bool:
        """
        Guard: the attempt must be in an in-flight state.

        :param event: Transition event with context in ``event.kwargs``
        :returns: ``True`` when the attempt is in-flight
        """
        ctx: ExecutionTransitionContext | None = event.kwargs.get("context")
        result = ctx is not None and ctx.attempt_state is not None and ctx.attempt_state in ("dispatching", "executing", "cancel_requested", "compensating")
        return self._record_guard("is_in_flight_attempt", result)

    def is_recordable_failure(self, event: Any) -> bool:
        """
        Guard: run and attempt must be in a recordable failure state.

        :param event: Transition event with context in ``event.kwargs``
        :returns: ``True`` when a failure can be recorded
        """
        ctx: ExecutionTransitionContext | None = event.kwargs.get("context")
        result = self.run_state in ("dispatching", "executing") and ctx is not None and ctx.attempt_state in ("dispatching", "executing")
        return self._record_guard("is_recordable_failure", result)

    def is_retryable_run(self, event: Any) -> bool:
        """
        Guard: run must be in a retryable terminal state.

        :param event: Transition event
        :returns: ``True`` when the run can be retried
        """
        return self._record_guard(
            "is_retryable_run",
            self.run_state in RETRYABLE_RUN_STATES,
        )

    def is_retryable_and_has_budget(self, event: Any) -> bool:
        """
        Guard: the failure is retryable and budget remains.

        :param event: Transition event with context in ``event.kwargs``
        :returns: ``True`` when retryable with remaining budget
        """
        ctx: ExecutionTransitionContext | None = event.kwargs.get("context")
        result = ctx is not None and ctx.retryable is True and ctx.active_attempt_no is not None and ctx.max_attempts is not None and ctx.active_attempt_no + 1 <= ctx.max_attempts
        return self._record_guard("is_retryable_and_has_budget", result)

    def is_terminal_failure_destination(self, event: Any) -> bool:
        """
        Guard: the failure is terminal (not retryable or budget exhausted).

        :param event: Transition event with context in ``event.kwargs``
        :returns: ``True`` when the destination is terminal
        """
        ctx: ExecutionTransitionContext | None = event.kwargs.get("context")
        result = ctx is not None and (ctx.retryable is not True or (ctx.active_attempt_no is not None and ctx.max_attempts is not None and ctx.active_attempt_no + 1 > ctx.max_attempts))
        return self._record_guard("is_terminal_failure_destination", result)

    def has_valid_lease_token(self, event: Any) -> bool:
        """
        Guard: the provided lease token matches the attempt lease token.

        :param event: Transition event with context in ``event.kwargs``
        :returns: ``True`` when the lease token is valid
        """
        ctx: ExecutionTransitionContext | None = event.kwargs.get("context")
        if ctx is None:
            return self._record_guard("has_valid_lease_token", False)
        if ctx.attempt_lease_token is None and ctx.provided_lease_token is None:
            # Both are None — token not provided, skip validation.
            return self._record_guard("has_valid_lease_token", True)
        result = ctx.attempt_lease_token is not None and ctx.provided_lease_token is not None and ctx.attempt_lease_token == ctx.provided_lease_token
        return self._record_guard("has_valid_lease_token", result)

    def is_valid_service_chosen_operator_state(self, event: Any) -> bool:
        """
        Guard: the service-chosen operator state is valid for the trigger.

        Checks that ``service_chosen_operator_state`` belongs to the
        valid operator target set for the trigger being fired. Returns
        ``True`` when no operator state was chosen (None) so validation
        is not blocked in contexts where the service has not yet decided.

        :param event: Transition event with context in ``event.kwargs``
        :returns: ``True`` when the operator state is valid or not chosen
        """
        ctx: ExecutionTransitionContext | None = event.kwargs.get("context")
        if ctx is None or ctx.service_chosen_operator_state is None:
            return self._record_guard("is_valid_service_chosen_operator_state", True)
        trigger: str | None = getattr(event, "name", None)
        if trigger is not None and trigger in RUN_OPERATOR_TARGETS_BY_TRIGGER:
            _, valid_operator_states = RUN_OPERATOR_TARGETS_BY_TRIGGER[trigger]
            result = ctx.service_chosen_operator_state in valid_operator_states
            return self._record_guard("is_valid_service_chosen_operator_state", result)
        return self._record_guard("is_valid_service_chosen_operator_state", True)


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

        .. note::
           ``self._model`` is shared across all ``validate_*`` calls on
           the same validator instance.  For Phase 1b, either construct a
           new validator per request or add thread synchronisation (see
           SPEC §9.6 and PLAN §7 risk register).

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

        decision = self._build_decision(
            trigger=trigger,
            context=context,
        )
        return ExecutionValidationResult(
            valid=True,
            validated=True,
            decision=decision,
            guard_results=guard_results,
        )

    def _build_decision(
        self,
        trigger: ExecutionTrigger,
        context: ExecutionTransitionContext,
    ) -> ExecutionStateDecision:
        """
        Build a full :class:`ExecutionStateDecision` including attempt effects.

        Uses :data:`ATTEMPT_EFFECTS_BY_TRIGGER` to populate attempt-state,
        attempt-operator-state, replacement-attempt, and lease-status fields.
        Context-dependent fields (``start_execution`` operator state,
        ``resume`` operator state, ``pause`` operator state) are resolved
        from *context* or default lookup tables.

        :param trigger: The trigger that was fired
        :param context: Pre-transition guard context
        :returns: Fully populated decision
        """
        base = ATTEMPT_EFFECTS_BY_TRIGGER.get(trigger)
        base_attempt_state: str | None = None
        base_attempt_op_state: str | None = None
        base_source_state: str | None = None
        base_source_op_state: str | None = None
        base_replacement_state: str | None = None
        base_replacement_op_state: str | None = None
        base_lease: str | None = None
        if base is not None:
            base_attempt_state = base.target_attempt_state
            base_attempt_op_state = base.target_attempt_operator_state
            base_source_state = base.source_attempt_state
            base_source_op_state = base.source_attempt_operator_state
            base_replacement_state = base.replacement_attempt_state
            base_replacement_op_state = base.replacement_attempt_operator_state
            base_lease = base.target_lease_status

        # Resolve context-dependent attempt operator state targets.
        target_ato: str | None = base_attempt_op_state
        target_lease: str | None = base_lease

        if trigger == "start_execution":
            target_ato = context.service_chosen_operator_state or "executing"
            target_lease = "leased"
        elif trigger == "pause":
            target_ato = "paused"
        elif trigger == "resume":
            target_ato = RUN_TO_OPERATOR_RESUME_MAP.get(
                context.run_state,
                _RESUME_FALLBACK_OPERATOR_STATE,
            )
        elif trigger == "claim_attempt":
            target_ato = "leased"
            target_lease = "leased"

        # Resolve target operator state.
        # For run-state triggers, prefer the service-chosen operator state
        # when provided and valid; fall back to the first valid target.
        # For operator-only triggers (pause/resume), the model's
        # operator_state was already updated by the operator machine.
        op_targets = RUN_OPERATOR_TARGETS_BY_TRIGGER.get(trigger)
        target_op: str | None
        if op_targets is not None:
            chosen = context.service_chosen_operator_state
            valid_op_states = op_targets[1]
            if chosen is not None and chosen in valid_op_states:
                target_op = chosen
            else:
                target_op = valid_op_states[0]
        else:
            # Operator-only triggers: pause transitions the model to
            # "paused", but resume uses dest="=" so the model stays at
            # "paused" while the service computes the actual target
            # dynamically from RUN_TO_OPERATOR_RESUME_MAP.
            if trigger == "resume":
                target_op = context.service_chosen_operator_state or RUN_TO_OPERATOR_RESUME_MAP.get(
                    context.run_state,
                    _RESUME_FALLBACK_OPERATOR_STATE,
                )
            elif trigger == "pause":
                target_op = self._model.operator_state
            else:
                target_op = self._model.operator_state

        return ExecutionStateDecision(
            target_run_state=self._model.run_state,
            target_operator_state=target_op,
            target_attempt_state=base_attempt_state,
            target_attempt_operator_state=target_ato,
            source_attempt_state=base_source_state,
            source_attempt_operator_state=base_source_op_state,
            replacement_attempt_state=base_replacement_state,
            replacement_attempt_operator_state=base_replacement_op_state,
            target_lease_status=target_lease,
        )

    # -- Authoritative pre-check (§7.1 / Phase 1c) -----------------------

    def check_transition_allowed(
        self,
        trigger: ExecutionTrigger,
        context: ExecutionTransitionContext,
    ) -> tuple[bool, str | None]:
        """
        Check whether *trigger* is allowed from the current state.

        Run-state triggers (``claim_attempt``, ``start_execution``, etc.) fire
        on the run-state machine.  Operator-only triggers (``pause``,
        ``resume``) fire on the operator-state machine.  When validation is
        disabled this returns ``(True, None)``.  When a guard blocks the
        transition, returns ``(False, reason)`` where *reason* is a
        human-readable message identifying the blocking guard.

        :param trigger: The trigger to check
        :param context: Current state and guard context
        :returns: ``(allowed, reason)``
        :rtype: tuple[bool, str | None]
        """
        if not self._enabled or self._run_machine is None:
            return True, None

        # Operator-only triggers (pause, resume) fire on the operator
        # machine instead of the run-state machine.
        if trigger in self._operator_machine_triggers and trigger not in self._run_machine_triggers:
            machine = self._operator_machine
            machine_triggers = self._operator_machine_triggers
            is_run_machine = False
        else:
            machine = self._run_machine
            machine_triggers = self._run_machine_triggers
            is_run_machine = True

        result = self._fire_and_build_result(
            trigger=trigger,
            context=context,
            machine=machine,
            machine_triggers=machine_triggers,
            is_run_machine=is_run_machine,
        )

        if not result.valid:
            if result.mismatch_category == MISMATCH_CATEGORY_GUARD_FAILED and result.guard_results:
                failed = [k for k, v in result.guard_results.items() if not v]
                if failed:
                    reason = _GUARD_FAILURE_MESSAGES.get(
                        failed[0],
                        f"Guard blocked: {failed[0]}",
                    )
                    return False, reason
            return (
                False,
                result.error_message or f"Transition {trigger!r} not allowed from current state.",
            )
        return True, None

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
        before_snapshot: ExecutionStateSnapshot,
        after_snapshot: ExecutionStateSnapshot,
    ) -> ExecutionValidationResult:
        """
        Validate a creation operation's initial state.

        ``admit_create`` creates a new ``RunORM`` and ``RunAttemptORM``
        with initial state ``queued`` / ``admitted``. *after_snapshot*
        holds the new entity state; *before_snapshot* is not used.

        ``restart_run_from_scratch`` creates a new run and attempt with
        ``queued`` / ``admitted`` while the source run only receives
        metadata updates. The method validates:

        - the new run/attempt initial state in *after_snapshot*
        - the source run's state dimensions remain unchanged:
          *before_snapshot* main fields hold the source run's state
          *after* the operation, and
          ``before_snapshot.source_run_invariants`` holds the source
          run's state *before* the operation. They must match.

        When the validator is disabled this is a no-op returning
        ``validated=False``.

        :param operation: The creation operation to validate
        :param before_snapshot: For ``restart_run_from_scratch``, the
            source run's state after the operation (main fields) with
            expected pre-operation values in
            ``source_run_invariants``. Ignored for ``admit_create``.
        :param after_snapshot: The newly created entity's state
        :returns: Validation result
        """
        if not self._enabled:
            return ExecutionValidationResult(validated=False)

        # Admit-create: validate the new run/attempt initial state.
        if operation == "admit_create":
            mismatches: list[str] = []
            if after_snapshot.run_state != "queued":
                mismatches.append(f"run_state={after_snapshot.run_state!r} != 'queued'")
            if after_snapshot.operator_state != "admitted":
                mismatches.append(f"operator_state={after_snapshot.operator_state!r} != 'admitted'")
            if after_snapshot.attempt_state is not None and after_snapshot.attempt_state != "queued":
                mismatches.append(f"attempt_state={after_snapshot.attempt_state!r} != 'queued'")
            if after_snapshot.attempt_state is not None and after_snapshot.attempt_operator_state is not None and after_snapshot.attempt_operator_state != "admitted":
                mismatches.append(f"attempt_operator_state={after_snapshot.attempt_operator_state!r} != 'admitted'")
            if after_snapshot.lease_status is not None and after_snapshot.lease_status != "not_leased":
                mismatches.append(f"lease_status={after_snapshot.lease_status!r} != 'not_leased'")

            if mismatches:
                return ExecutionValidationResult(
                    valid=False,
                    validated=True,
                    mismatch_category=MISMATCH_CATEGORY_CREATION_INITIAL_STATE_MISMATCH,
                    error_message="; ".join(mismatches),
                    decision=ExecutionStateDecision(
                        target_run_state="queued",
                        target_operator_state="admitted",
                        target_attempt_state="queued",
                        target_attempt_operator_state="admitted",
                        target_lease_status="not_leased",
                    ),
                )
            return ExecutionValidationResult(
                valid=True,
                validated=True,
                decision=ExecutionStateDecision(
                    target_run_state="queued",
                    target_operator_state="admitted",
                    target_attempt_state="queued",
                    target_attempt_operator_state="admitted",
                    target_lease_status="not_leased",
                ),
            )

        # Restart-from-scratch: validate new-run init + source-run invariants.
        if operation == "restart_run_from_scratch":
            mismatches = []

            # Validate the new run/attempt initial state.
            if after_snapshot.run_state != "queued":
                mismatches.append(f"new run_state={after_snapshot.run_state!r} != 'queued'")
            if after_snapshot.operator_state != "admitted":
                mismatches.append(f"new operator_state={after_snapshot.operator_state!r} != 'admitted'")
            if after_snapshot.attempt_state is not None and after_snapshot.attempt_state != "queued":
                mismatches.append(f"new attempt_state={after_snapshot.attempt_state!r} != 'queued'")
            if after_snapshot.attempt_state is not None and after_snapshot.attempt_operator_state is not None and after_snapshot.attempt_operator_state != "admitted":
                mismatches.append(f"new attempt_operator_state={after_snapshot.attempt_operator_state!r} != 'admitted'")
            if after_snapshot.lease_status is not None and after_snapshot.lease_status != "not_leased":
                mismatches.append(f"new lease_status={after_snapshot.lease_status!r} != 'not_leased'")

            # Validate source-run invariants: state dimensions unchanged.
            invariants = before_snapshot.source_run_invariants
            if invariants is not None:
                if invariants.run_state != before_snapshot.run_state:
                    mismatches.append(f"source run_state mutated: {invariants.run_state!r} -> {before_snapshot.run_state!r}")
                if invariants.operator_state != before_snapshot.operator_state:
                    mismatches.append(f"source operator_state mutated: {invariants.operator_state!r} -> {before_snapshot.operator_state!r}")
                if invariants.current_attempt_id != before_snapshot.current_attempt_id:
                    mismatches.append(f"source current_attempt_id changed: {invariants.current_attempt_id!r} -> {before_snapshot.current_attempt_id!r}")

            if mismatches:
                return ExecutionValidationResult(
                    valid=False,
                    validated=True,
                    mismatch_category=MISMATCH_CATEGORY_CREATION_INITIAL_STATE_MISMATCH,
                    error_message="; ".join(mismatches),
                )
            return ExecutionValidationResult(
                valid=True,
                validated=True,
                decision=ExecutionStateDecision(
                    target_run_state="queued",
                    target_operator_state="admitted",
                    target_attempt_state="queued",
                    target_attempt_operator_state="admitted",
                    target_lease_status="not_leased",
                ),
            )

        return ExecutionValidationResult(
            valid=False,
            validated=True,
            mismatch_category=MISMATCH_CATEGORY_INVALID_TRIGGER,
            error_message=f"Unknown creation operation: {operation!r}",
        )

    # -- Non-state-operation validation (§7.4) -----------------------------

    def validate_non_state_operation(
        self,
        before_snapshot: ExecutionStateSnapshot,
        after_snapshot: ExecutionStateSnapshot,
    ) -> ExecutionValidationResult:
        """
        Validate that a non-state operation did not mutate state dimensions.

        Operations such as ``renew_attempt_lease`` and ``escalate_run``
        must not change ``run_state``, ``operator_state``, or attempt
        state dimensions. ``lease_status`` is allowed to change for
        lease-renewal operations.

        When the validator is disabled this is a no-op returning
        ``validated=False``.

        :param before_snapshot: Pre-operation state snapshot
        :param after_snapshot: Post-operation state snapshot
        :returns: Validation result
        """
        if not self._enabled:
            return ExecutionValidationResult(validated=False)

        mismatches: list[str] = []

        # Compare state dimensions that must not change.
        if before_snapshot.run_state != after_snapshot.run_state:
            mismatches.append(f"run_state changed: {before_snapshot.run_state!r} -> {after_snapshot.run_state!r}")
        if before_snapshot.operator_state != after_snapshot.operator_state:
            mismatches.append(f"operator_state changed: {before_snapshot.operator_state!r} -> {after_snapshot.operator_state!r}")
        if before_snapshot.attempt_state != after_snapshot.attempt_state:
            mismatches.append(f"attempt_state changed: {before_snapshot.attempt_state!r} -> {after_snapshot.attempt_state!r}")
        if before_snapshot.attempt_operator_state != after_snapshot.attempt_operator_state:
            mismatches.append(f"attempt_operator_state changed: {before_snapshot.attempt_operator_state!r} -> {after_snapshot.attempt_operator_state!r}")
        if before_snapshot.current_attempt_id != after_snapshot.current_attempt_id:
            mismatches.append(f"current_attempt_id changed: {before_snapshot.current_attempt_id!r} -> {after_snapshot.current_attempt_id!r}")
        if before_snapshot.current_approval_link_id != after_snapshot.current_approval_link_id:
            mismatches.append(f"current_approval_link_id changed: {before_snapshot.current_approval_link_id!r} -> {after_snapshot.current_approval_link_id!r}")

        if mismatches:
            return ExecutionValidationResult(
                valid=False,
                validated=True,
                mismatch_category=MISMATCH_CATEGORY_NON_STATE_OPERATION_MUTATED_STATE,
                error_message="; ".join(mismatches),
            )
        return ExecutionValidationResult(
            valid=True,
            validated=True,
            decision=ExecutionStateDecision(
                target_run_state=after_snapshot.run_state,
                target_operator_state=after_snapshot.operator_state,
            ),
        )


# ---------------------------------------------------------------------------
# Diagram generation — Mermaid stateDiagram-v2 from constants (SPEC §12)
# ---------------------------------------------------------------------------


def build_execution_state_diagram() -> str:
    """
    Build a Mermaid ``stateDiagram-v2`` string from transition/effect constants.

    Uses the same :data:`RUN_STATE_TRANSITIONS`,
    :data:`OPERATOR_STATE_TRANSITIONS`, and state constants that the
    validator uses — no Graphviz or system packages required.  The
    output is a documentation artifact, not a runtime dependency.

    .. code-block:: text

        stateDiagram-v2
            [*] --> queued : admit_create
            queued --> dispatching : claim_attempt
            ...

    :returns: A Mermaid ``stateDiagram-v2`` source string
    """
    lines: list[str] = ["stateDiagram-v2", ""]

    # -- Initial creation entry point --
    lines.append("    [*] --> queued : admit_create / restart_run_from_scratch")
    lines.append("")

    # -- Run-state transitions from explicit sources --
    # Deduplicate transitions that appear with identical (source, dest, trigger).
    seen: set[tuple[str, str, str]] = set()
    for t in RUN_STATE_TRANSITIONS:
        trigger: str = t["trigger"]
        sources: Any = t["source"]
        dest: Any = t.get("dest")
        if dest is None or dest == "=" or sources == "*":
            continue
        source_list: tuple[str, ...] = (sources,) if isinstance(sources, str) else tuple(sources)
        for src in source_list:
            key = (src, str(dest), trigger)
            if key not in seen:
                seen.add(key)
                lines.append(f"    {src} --> {dest} : {trigger}")

    # -- Wildcard transitions with conditions (source="*") --
    wildcard_entries: list[str] = []
    for t in RUN_STATE_TRANSITIONS:
        trigger = t["trigger"]
        sources = t["source"]
        dest = t.get("dest")
        conditions = t.get("conditions")
        if sources == "*" and dest is not None and dest != "=":
            cond_str = f" [{conditions}]" if conditions else ""
            wildcard_entries.append(f"    {trigger} --> {dest}{cond_str}")

    if wildcard_entries:
        lines.append("")
        lines.append('    %% Guard-conditional transitions (source="*")')
        lines.extend(wildcard_entries)

    # -- Operator-state transitions --
    op_seen: set[tuple[str, str, str]] = set()
    for t in OPERATOR_STATE_TRANSITIONS:
        trigger = t["trigger"]
        sources = t["source"]
        dest = t.get("dest")
        conditions = t.get("conditions")
        dest_str = "paused" if trigger == "pause" else "run-operator resume"
        cond_str = f" [{conditions}]" if conditions else ""
        key = (str(sources), dest_str, trigger)
        if key not in op_seen:
            op_seen.add(key)
            lines.append("")
            lines.append(f"    {trigger}{cond_str}")
            if trigger == "pause":
                lines.append("    (any pausable) --> paused : pause")
            elif trigger == "resume":
                lines.append("    paused --> (resume target) : resume")

    # -- Terminal/final states annotation --
    # Declared-unreached states are a subset of terminal states; emit each
    # state label once with a combined annotation comment.
    lines.append("")
    lines.append("    %% Terminal final run states")
    terminal_only = sorted(TERMINAL_RUN_STATES - DECLARED_UNREACHED_RUN_STATES)
    for state in terminal_only:
        lines.append(f"    state {state}")

    unreached = sorted(DECLARED_UNREACHED_RUN_STATES)
    if unreached:
        lines.append("")
        lines.append("    %% Declared-but-unreached terminal states (registered, no production path)")
        for state in unreached:
            lines.append(f"    state {state}")

    return "\n".join(lines) + "\n"

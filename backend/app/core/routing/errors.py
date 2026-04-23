"""Typed routing errors for Smart Execution Routing."""

from __future__ import annotations


class RoutingError(RuntimeError):
    def __init__(self, *, error_type: str, message: str):
        self.error_type = error_type
        super().__init__(message)


class RoutingBudgetExceededError(RoutingError):
    def __init__(self, message: str):
        super().__init__(error_type="routing_budget_exceeded", message=message)


class RoutingCircuitOpenError(RoutingError):
    def __init__(self, message: str):
        super().__init__(error_type="routing_circuit_open", message=message)


class RoutingNoCandidateError(RoutingError):
    def __init__(self, message: str):
        super().__init__(error_type="routing_no_candidate", message=message)

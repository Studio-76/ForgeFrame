"""Governance-layer errors that need stable API handling."""

from __future__ import annotations

from typing import Any


class RuntimeAuthorizationError(PermissionError):
    def __init__(
        self,
        *,
        status_code: int,
        error_type: str,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.status_code = status_code
        self.error_type = error_type
        self.details = details or {}
        super().__init__(message)


class GovernanceConflictError(RuntimeError):
    """Raised when a governance state transition cannot be applied."""


class GovernanceEligibilityError(RuntimeError):
    """Raised when governance policy blocks an action before state is created."""

    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        self.details = details or {}
        super().__init__(message)


class GovernanceNotFoundError(LookupError):
    """Raised when a governance record does not exist."""

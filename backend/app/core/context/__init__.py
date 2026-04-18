"""Context handling contracts for future prompt shaping."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ContextWindow:
    token_budget: int
    strategy: str = "passthrough"

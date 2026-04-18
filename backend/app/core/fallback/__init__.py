"""Fallback policy contracts for future resilience workflows."""

from dataclasses import dataclass


@dataclass(frozen=True)
class FallbackDecision:
    should_fallback: bool
    reason: str

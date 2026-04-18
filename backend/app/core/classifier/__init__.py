"""Classifier contracts for upcoming phase-4 routing sophistication."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ClassificationResult:
    label: str
    confidence: float


def default_classification() -> ClassificationResult:
    return ClassificationResult(label="unclassified", confidence=0.0)

"""Streaming contracts for future incremental response support."""

from dataclasses import dataclass


@dataclass(frozen=True)
class StreamChunk:
    delta: str
    done: bool = False

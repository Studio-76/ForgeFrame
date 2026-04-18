"""Tool-calling contracts for planned runtime feature expansion."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ToolCallEnvelope:
    call_id: str
    name: str
    arguments_json: str

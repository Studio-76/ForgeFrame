"""Runtime API schemas for OpenAI-compatible baseline endpoints."""

from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: Any = None


class ChatCompletionsRequest(BaseModel):
    model: str | None = None
    messages: list[ChatMessage] = Field(min_length=1)
    stream: bool = False
    tools: list[dict[str, Any]] = Field(default_factory=list)
    tool_choice: str | dict[str, Any] | None = None
    client: dict[str, str] = Field(default_factory=dict)


class ResponsesRequest(BaseModel):
    model: str | None = None
    input: Any
    instructions: str | None = None
    max_output_tokens: int | None = None
    temperature: float | None = None
    stream: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)
    client: dict[str, str] = Field(default_factory=dict)


class ErrorEnvelope(BaseModel):
    error: dict[str, Any]

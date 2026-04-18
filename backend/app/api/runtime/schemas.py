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
    client: dict[str, str] = Field(default_factory=dict)


class ErrorEnvelope(BaseModel):
    error: dict[str, Any]

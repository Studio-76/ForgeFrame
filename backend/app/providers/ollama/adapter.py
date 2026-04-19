"""Dedicated local Ollama adapter using OpenAI-compatible chat endpoints."""

from __future__ import annotations

import json
from collections.abc import Iterator

import httpx

from app.providers.base import (
    ChatDispatchRequest,
    ChatDispatchResult,
    ProviderBadRequestError,
    ProviderCapabilities,
    ProviderConfigurationError,
    ProviderStreamEvent,
    ProviderStreamInterruptedError,
    ProviderUpstreamError,
)
from app.settings.config import Settings
from app.usage.models import TokenUsage
from app.usage.service import UsageAccountingService


class OllamaAdapter:
    provider_name = "ollama"
    capabilities = ProviderCapabilities(
        streaming=True,
        tool_calling=False,
        vision=False,
        external=False,
        discovery_support=True,
        provider_axis="local_provider",
        auth_mechanism="none",
        verify_support=True,
        probe_support=True,
    )

    def __init__(self, settings: Settings):
        self._settings = settings
        self._usage = UsageAccountingService(settings)

    def is_ready(self) -> bool:
        return bool(self._settings.ollama_base_url.strip())

    def readiness_reason(self) -> str | None:
        if self.is_ready():
            return None
        return "FORGEGATE_OLLAMA_BASE_URL is required."

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        if not self.is_ready():
            raise ProviderConfigurationError(self.provider_name, self.readiness_reason() or "Ollama is not configured.")
        payload = {"model": request.model or self._settings.ollama_default_model, "messages": request.messages, "stream": False}
        data = self._post(payload)
        choice = data.get("choices", [{}])[0]
        message = choice.get("message", {})
        content = message.get("content", "")
        usage = self._usage_from_payload(data.get("usage", {}), request.messages, str(content))
        cost = self._usage.costs_for_provider(provider=self.provider_name, usage=usage)
        return ChatDispatchResult(
            model=str(data.get("model", request.model)),
            provider=self.provider_name,
            content=str(content),
            finish_reason=str(choice.get("finish_reason", "stop")),
            usage=usage,
            cost=cost,
            credential_type="local_runtime",
            auth_source="ollama_local",
        )

    def stream_chat_completion(self, request: ChatDispatchRequest) -> Iterator[ProviderStreamEvent]:
        if not self.is_ready():
            raise ProviderConfigurationError(self.provider_name, self.readiness_reason() or "Ollama is not configured.")
        payload = {"model": request.model or self._settings.ollama_default_model, "messages": request.messages, "stream": True}
        yield from self._stream(payload, request.messages)

    def _endpoint(self) -> str:
        return f"{self._settings.ollama_base_url.rstrip('/')}/chat/completions"

    def _post(self, payload: dict) -> dict:
        try:
            response = httpx.post(self._endpoint(), json=payload, timeout=self._settings.ollama_timeout_seconds)
        except httpx.RequestError as exc:
            raise ProviderUpstreamError(self.provider_name, f"Ollama network error: {exc}") from exc
        self._raise_for_status(response)
        return response.json()

    def _stream(self, payload: dict, messages: list[dict]) -> Iterator[ProviderStreamEvent]:
        chunks: list[str] = []
        finish_reason = "stop"
        usage: TokenUsage | None = None
        saw_done = False
        try:
            with httpx.stream("POST", self._endpoint(), json=payload, timeout=self._settings.ollama_timeout_seconds) as response:
                self._raise_for_status(response)
                for raw_line in response.iter_lines():
                    if not raw_line or not raw_line.startswith("data:"):
                        continue
                    line = raw_line.removeprefix("data:").strip()
                    if line == "[DONE]":
                        saw_done = True
                        break
                    payload = json.loads(line)
                    choice = payload.get("choices", [{}])[0]
                    content = choice.get("delta", {}).get("content", "")
                    if content:
                        chunks.append(str(content))
                        yield ProviderStreamEvent(event="delta", delta=str(content))
                    if choice.get("finish_reason"):
                        finish_reason = str(choice["finish_reason"])
                    if payload.get("usage"):
                        usage = self._usage_from_payload(payload["usage"], messages, "".join(chunks))
        except httpx.RequestError as exc:
            raise ProviderStreamInterruptedError(self.provider_name, f"Ollama stream network error: {exc}") from exc
        except json.JSONDecodeError as exc:
            raise ProviderStreamInterruptedError(self.provider_name, "Ollama stream returned invalid JSON chunk.") from exc
        if not saw_done:
            raise ProviderStreamInterruptedError(self.provider_name, "Ollama stream ended without done marker.")
        final_usage = usage or self._usage.usage_from_prompt_completion(messages, "".join(chunks))
        final_cost = self._usage.costs_for_provider(provider=self.provider_name, usage=final_usage)
        yield ProviderStreamEvent(event="done", finish_reason=finish_reason, usage=final_usage, cost=final_cost)

    def _usage_from_payload(self, usage_payload: dict, messages: list[dict], content: str) -> TokenUsage:
        if usage_payload:
            input_tokens = int(usage_payload.get("prompt_tokens", usage_payload.get("input_tokens", 0)))
            output_tokens = int(usage_payload.get("completion_tokens", usage_payload.get("output_tokens", 0)))
            total_tokens = int(usage_payload.get("total_tokens", input_tokens + output_tokens))
            return TokenUsage(input_tokens=input_tokens, output_tokens=output_tokens, total_tokens=total_tokens)
        return self._usage.usage_from_prompt_completion(messages, content)

    def _raise_for_status(self, response: httpx.Response) -> None:
        if response.status_code in {400, 404, 422}:
            raise ProviderBadRequestError(self.provider_name, f"Ollama rejected request ({response.status_code}): {response.text[:500]}")
        if response.status_code >= 500:
            raise ProviderUpstreamError(self.provider_name, f"Ollama upstream error ({response.status_code}): {response.text[:500]}")
        if response.status_code >= 300:
            raise ProviderUpstreamError(self.provider_name, f"Unexpected Ollama response ({response.status_code}): {response.text[:500]}")

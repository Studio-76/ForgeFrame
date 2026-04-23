"""Dedicated local Ollama adapter using OpenAI-compatible chat endpoints."""

from __future__ import annotations

import json
from collections.abc import Iterator
from datetime import datetime
from time import monotonic

import httpx

from app.providers.base import (
    ProviderAuthenticationError,
    ChatDispatchRequest,
    ChatDispatchResult,
    ProviderBadRequestError,
    ProviderCapabilities,
    ProviderConflictError,
    ProviderConfigurationError,
    ProviderPayloadTooLargeError,
    ProviderProtocolError,
    ProviderRateLimitError,
    ProviderRequestTimeoutError,
    ProviderModelNotFoundError,
    ProviderResourceGoneError,
    ProviderStreamEvent,
    ProviderStreamInterruptedError,
    ProviderTimeoutError,
    ProviderUnavailableError,
    ProviderUnsupportedFeatureError,
    ProviderUnsupportedMediaTypeError,
    ProviderUpstreamError,
    openai_compatible_response_controls,
)
from app.request_metadata import forgeframe_request_metadata_headers
from app.settings.config import Settings
from app.usage.models import TokenUsage
from app.usage.service import UsageAccountingService


class OllamaAdapter:
    provider_name = "ollama"
    # Keep one short-lived probe snapshot so status readers stay consistent
    # without pinning a failed startup probe for the life of the process.
    _READINESS_CACHE_TTL_SECONDS = 1.0
    capabilities = ProviderCapabilities(
        streaming=True,
        tool_calling=False,
        tool_calling_level="none",
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
        self._readiness_state: tuple[bool, str | None] | None = None
        self._readiness_checked_at: float | None = None

    def is_ready(self) -> bool:
        return self._resolve_readiness_state()[0]

    def readiness_reason(self) -> str | None:
        return self._resolve_readiness_state()[1]

    def _resolve_readiness_state(self) -> tuple[bool, str | None]:
        now = monotonic()
        if self._readiness_state is not None and self._readiness_checked_at is not None:
            if now - self._readiness_checked_at < self._READINESS_CACHE_TTL_SECONDS:
                return self._readiness_state

        readiness_state = self._probe_readiness_state()
        # Start the cache TTL when the probe result is committed so immediate
        # paired status reads share one snapshot even if the probe itself was slow.
        self._readiness_state = readiness_state
        self._readiness_checked_at = monotonic()
        return self._readiness_state

    def _probe_readiness_state(self) -> tuple[bool, str | None]:
        base_url = self._settings.ollama_base_url.strip()
        if not base_url:
            return False, "FORGEFRAME_OLLAMA_BASE_URL is required."

        probe_url = f"{base_url.rstrip('/')}/models"
        probe_timeout = max(1, min(self._settings.ollama_timeout_seconds, 5))
        try:
            response = httpx.get(probe_url, timeout=probe_timeout)
        except httpx.TimeoutException:
            return False, f"Ollama runtime endpoint probe timed out: {probe_url}"
        except httpx.RequestError as exc:
            return False, f"Ollama runtime endpoint is unreachable: {exc}"

        if response.status_code in {401, 403}:
            return (
                False,
                f"Ollama runtime endpoint rejected readiness probe ({response.status_code}).",
            )
        if response.status_code >= 500:
            return (
                False,
                f"Ollama runtime endpoint is unavailable ({response.status_code}).",
            )
        if response.status_code >= 300:
            return (
                False,
                f"Ollama runtime endpoint returned unexpected status {response.status_code}.",
            )

        return True, None

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        if not self.is_ready():
            raise ProviderConfigurationError(self.provider_name, self.readiness_reason() or "Ollama is not configured.")
        if getattr(request, "tools", []):
            raise ProviderUnsupportedFeatureError(self.provider_name, "tool_calling")
        payload = {"model": request.model or self._settings.ollama_default_model, "messages": request.messages, "stream": False}
        payload.update(openai_compatible_response_controls(request.response_controls))
        data = self._post(payload, request.request_metadata)
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
        if getattr(request, "tools", []):
            raise ProviderUnsupportedFeatureError(self.provider_name, "tool_calling")
        payload = {"model": request.model or self._settings.ollama_default_model, "messages": request.messages, "stream": True}
        payload.update(openai_compatible_response_controls(request.response_controls))
        yield from self._stream(payload, request.messages, request.request_metadata)

    def _endpoint(self) -> str:
        return f"{self._settings.ollama_base_url.rstrip('/')}/chat/completions"

    def _post(self, payload: dict, request_metadata: dict[str, str] | None = None) -> dict:
        request_headers = forgeframe_request_metadata_headers(request_metadata)
        try:
            response = httpx.post(
                self._endpoint(),
                json=payload,
                headers=request_headers or None,
                timeout=self._settings.ollama_timeout_seconds,
            )
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError(self.provider_name, f"Ollama request timed out: {exc}") from exc
        except httpx.RequestError as exc:
            raise ProviderUpstreamError(self.provider_name, f"Ollama network error: {exc}") from exc
        self._raise_for_status(response)
        headers = getattr(response, "headers", {}) or {}
        content_type = str(headers.get("content-type", ""))
        if content_type and "json" not in content_type.lower():
            raise ProviderProtocolError(self.provider_name, f"Ollama returned unexpected content-type '{content_type}'.")
        try:
            return response.json()
        except ValueError as exc:
            raise ProviderProtocolError(self.provider_name, "Ollama returned invalid JSON payload.") from exc

    def _stream(
        self,
        payload: dict,
        messages: list[dict],
        request_metadata: dict[str, str] | None = None,
    ) -> Iterator[ProviderStreamEvent]:
        chunks: list[str] = []
        finish_reason = "stop"
        usage: TokenUsage | None = None
        saw_done = False
        request_headers = forgeframe_request_metadata_headers(request_metadata)
        try:
            with httpx.stream(
                "POST",
                self._endpoint(),
                json=payload,
                headers=request_headers or None,
                timeout=self._settings.ollama_timeout_seconds,
            ) as response:
                if response.status_code >= 300:
                    response.read()
                self._raise_for_status(response)
                response_headers = getattr(response, "headers", {}) or {}
                content_type = str(response_headers.get("content-type", ""))
                if content_type and "text/event-stream" not in content_type.lower():
                    raise ProviderStreamInterruptedError(self.provider_name, f"Ollama stream returned unexpected content-type '{content_type}'.")
                for raw_line in response.iter_lines():
                    if not raw_line or not raw_line.startswith("data:"):
                        continue
                    line = raw_line.removeprefix("data:").strip()
                    if line == "[DONE]":
                        saw_done = True
                        break
                    try:
                        payload = json.loads(line)
                    except json.JSONDecodeError as exc:
                        raise ProviderStreamInterruptedError(self.provider_name, "Ollama stream returned invalid JSON chunk.") from exc
                    choice = payload.get("choices", [{}])[0]
                    content = choice.get("delta", {}).get("content", "")
                    if content:
                        chunks.append(str(content))
                        yield ProviderStreamEvent(event="delta", delta=str(content))
                    if choice.get("finish_reason"):
                        finish_reason = str(choice["finish_reason"])
                    if payload.get("usage"):
                        usage = self._usage_from_payload(payload["usage"], messages, "".join(chunks))
        except httpx.TimeoutException as exc:
            raise ProviderStreamInterruptedError(self.provider_name, f"Ollama stream timed out: {exc}") from exc
        except httpx.RequestError as exc:
            raise ProviderStreamInterruptedError(self.provider_name, f"Ollama stream network error: {exc}") from exc
        if not saw_done:
            raise ProviderStreamInterruptedError(self.provider_name, "Ollama stream ended without done marker.")
        final_usage = usage or self._usage.usage_from_prompt_completion(messages, "".join(chunks))
        final_cost = self._usage.costs_for_provider(provider=self.provider_name, usage=final_usage)
        yield ProviderStreamEvent(
            event="done",
            finish_reason=finish_reason,
            usage=final_usage,
            cost=final_cost,
            credential_type="local_runtime",
            auth_source="ollama_local",
        )

    def _usage_from_payload(self, usage_payload: dict, messages: list[dict], content: str) -> TokenUsage:
        if usage_payload:
            input_tokens = int(usage_payload.get("prompt_tokens", usage_payload.get("input_tokens", 0)))
            output_tokens = int(usage_payload.get("completion_tokens", usage_payload.get("output_tokens", 0)))
            total_tokens = int(usage_payload.get("total_tokens", input_tokens + output_tokens))
            return TokenUsage(input_tokens=input_tokens, output_tokens=output_tokens, total_tokens=total_tokens)
        return self._usage.usage_from_prompt_completion(messages, content)

    def _raise_for_status(self, response: httpx.Response) -> None:
        response_text = self._response_text(response)
        if response.status_code in {401, 403}:
            raise ProviderAuthenticationError(self.provider_name, f"Ollama authentication failed ({response.status_code}).")
        if response.status_code == 408:
            raise ProviderRequestTimeoutError(self.provider_name, f"Ollama request timeout ({response.status_code}): {response_text[:500]}")
        if response.status_code == 404:
            raise ProviderModelNotFoundError(self.provider_name, message=f"Ollama model/resource not found ({response.status_code}): {response_text[:500]}")
        if response.status_code in {400, 422}:
            raise ProviderBadRequestError(self.provider_name, f"Ollama rejected request ({response.status_code}): {response_text[:500]}")
        if response.status_code == 410:
            raise ProviderResourceGoneError(self.provider_name, f"Ollama resource gone ({response.status_code}): {response_text[:500]}")
        if response.status_code == 413:
            raise ProviderPayloadTooLargeError(self.provider_name, f"Ollama payload too large ({response.status_code}): {response_text[:500]}")
        if response.status_code == 415:
            raise ProviderUnsupportedMediaTypeError(self.provider_name, f"Ollama unsupported media type ({response.status_code}): {response_text[:500]}")
        if response.status_code == 409:
            raise ProviderConflictError(self.provider_name, f"Ollama conflict ({response.status_code}): {response_text[:500]}")
        if response.status_code == 429:
            retry_after = self._parse_retry_after_seconds(response.headers.get("retry-after"))
            raise ProviderRateLimitError(self.provider_name, f"Ollama rate limit reached ({response.status_code}): {response_text[:500]}", retry_after_seconds=retry_after)
        if response.status_code >= 500:
            if response.status_code == 503:
                raise ProviderUnavailableError(self.provider_name, f"Ollama unavailable ({response.status_code}): {response_text[:500]}")
            raise ProviderUpstreamError(self.provider_name, f"Ollama upstream error ({response.status_code}): {response_text[:500]}")
        if response.status_code >= 300:
            raise ProviderUpstreamError(self.provider_name, f"Unexpected Ollama response ({response.status_code}): {response_text[:500]}")

    @staticmethod
    def _response_text(response: httpx.Response) -> str:
        try:
            return response.text
        except httpx.ResponseNotRead:
            response.read()
            return response.text

    @staticmethod
    def _parse_retry_after_seconds(value: str | None) -> int | None:
        if not value:
            return None
        if value.isdigit():
            return int(value)
        try:
            retry_at = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
        delta = int((retry_at - datetime.now(tz=retry_at.tzinfo)).total_seconds())
        return delta if delta > 0 else 0

"""OpenAI API adapter with non-stream and stream runtime support."""

from __future__ import annotations

import inspect
import json
from collections.abc import Iterator
from datetime import datetime
from email.utils import parsedate_to_datetime
from urllib.parse import urlsplit

import httpx

from app.providers.base import (
    ChatDispatchRequest,
    ChatDispatchResult,
    ProviderAuthenticationError,
    ProviderBadRequestError,
    ProviderCapabilities,
    ProviderConflictError,
    ProviderConfigurationError,
    ProviderProtocolError,
    ProviderRateLimitError,
    ProviderRequestTimeoutError,
    ProviderModelNotFoundError,
    ProviderStreamEvent,
    ProviderStreamInterruptedError,
    ProviderTimeoutError,
    ProviderPayloadTooLargeError,
    ProviderResourceGoneError,
    ProviderUnavailableError,
    ProviderUnsupportedMediaTypeError,
    ProviderUpstreamError,
    openai_compatible_response_controls,
)
from app.providers.openai_streaming import (
    finalize_openai_tool_calls,
    merge_openai_tool_call_chunks,
)
from app.request_metadata import forgegate_request_metadata_headers
from app.settings.config import Settings
from app.usage.models import TokenUsage
from app.usage.service import UsageAccountingService


class OpenAIAPIAdapter:
    provider_name = "openai_api"
    capabilities = ProviderCapabilities(streaming=True, tool_calling=True, tool_calling_level="full", vision=True, external=True)

    def __init__(self, settings: Settings):
        self._settings = settings
        self._usage_accounting = UsageAccountingService(settings)

    def is_ready(self) -> bool:
        return self.readiness_reason() is None

    def readiness_reason(self) -> str | None:
        if not self._settings.openai_api_key.strip():
            return "FORGEGATE_OPENAI_API_KEY is required."
        if self._configured_base_url() is None:
            return "FORGEGATE_OPENAI_API_BASE_URL must be an absolute http(s) URL."
        return None

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        reason = self.readiness_reason()
        if reason:
            raise ProviderConfigurationError(self.provider_name, reason)

        payload = {
            "model": request.model,
            "messages": request.messages,
            "stream": False,
        }
        payload.update(openai_compatible_response_controls(request.response_controls))
        tools = getattr(request, "tools", [])
        if tools:
            payload["tools"] = tools
            tool_choice = getattr(request, "tool_choice", None)
            if tool_choice is not None:
                payload["tool_choice"] = tool_choice

        response_payload = self._call_post_chat_completion(payload, request.request_metadata)
        try:
            choices = response_payload["choices"]
            if not isinstance(choices, list) or not choices:
                raise TypeError("choices")
            first_choice = choices[0]
            if not isinstance(first_choice, dict):
                raise TypeError("choice")
            message = first_choice["message"]
            if not isinstance(message, dict):
                raise TypeError("message")
            content = message.get("content", "")
            tool_calls = message.get("tool_calls", [])
            finish_reason = first_choice.get("finish_reason", "stop")
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderUpstreamError(self.provider_name, f"Malformed response from OpenAI API: {response_payload}") from exc

        usage = self._usage_from_response(response_payload, request.messages, content)
        cost = self._usage_accounting.costs_for_provider(provider=self.provider_name, usage=usage)

        return ChatDispatchResult(
            model=response_payload.get("model", request.model),
            provider=self.provider_name,
            content=content if isinstance(content, str) else str(content),
            finish_reason=finish_reason,
            usage=usage,
            cost=cost,
            credential_type="api_key",
            auth_source="openai_api_key",
            tool_calls=tool_calls if isinstance(tool_calls, list) else [],
        )

    def stream_chat_completion(self, request: ChatDispatchRequest) -> Iterator[ProviderStreamEvent]:
        reason = self.readiness_reason()
        if reason:
            raise ProviderConfigurationError(self.provider_name, reason)

        payload = {
            "model": request.model,
            "messages": request.messages,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        payload.update(openai_compatible_response_controls(request.response_controls))
        tools = getattr(request, "tools", [])
        if tools:
            payload["tools"] = tools
            tool_choice = getattr(request, "tool_choice", None)
            if tool_choice is not None:
                payload["tool_choice"] = tool_choice

        yield from self._call_stream_chat_completion(payload, request.messages, request.request_metadata)

    def _call_post_chat_completion(self, payload: dict, request_metadata: dict[str, str]) -> dict:
        signature = inspect.signature(self._post_chat_completion)
        if "request_metadata" in signature.parameters:
            return self._post_chat_completion(payload, request_metadata=request_metadata)
        return self._post_chat_completion(payload)

    def _call_stream_chat_completion(
        self,
        payload: dict,
        messages: list[dict],
        request_metadata: dict[str, str],
    ) -> Iterator[ProviderStreamEvent]:
        signature = inspect.signature(self._stream_chat_completion)
        if "request_metadata" in signature.parameters:
            return self._stream_chat_completion(payload, messages, request_metadata=request_metadata)
        return self._stream_chat_completion(payload, messages)

    def _endpoint_and_headers(self, request_metadata: dict[str, str] | None = None) -> tuple[str, dict[str, str]]:
        base_url = self._configured_base_url()
        if base_url is None:  # pragma: no cover - guarded by readiness checks
            raise ProviderConfigurationError(
                self.provider_name,
                "FORGEGATE_OPENAI_API_BASE_URL must be an absolute http(s) URL.",
            )
        endpoint = f"{base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self._settings.openai_api_key}",
            "Content-Type": "application/json",
        }
        headers.update(forgegate_request_metadata_headers(request_metadata))
        return endpoint, headers

    def _configured_base_url(self) -> str | None:
        base_url = self._settings.openai_api_base_url.strip()
        parsed = urlsplit(base_url)
        host = parsed.hostname or ""
        if parsed.scheme not in {"http", "https"} or not host or any(char.isspace() for char in host):
            return None
        return base_url.rstrip("/")

    def _post_chat_completion(self, payload: dict, request_metadata: dict[str, str] | None = None) -> dict:
        endpoint, headers = self._endpoint_and_headers(request_metadata)

        try:
            response = httpx.post(
                endpoint,
                json=payload,
                headers=headers,
                timeout=self._settings.openai_timeout_seconds,
            )
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError(self.provider_name, f"OpenAI request timed out: {exc}") from exc
        except httpx.RequestError as exc:
            raise ProviderUpstreamError(self.provider_name, f"Network error while calling OpenAI API: {exc}") from exc

        self._raise_for_status(response)
        headers = getattr(response, "headers", {}) or {}
        content_type = str(headers.get("content-type", ""))
        if content_type and "json" not in content_type.lower():
            raise ProviderProtocolError(self.provider_name, f"OpenAI returned unexpected content-type '{content_type}'.")
        try:
            return response.json()
        except ValueError as exc:
            raise ProviderProtocolError(self.provider_name, "OpenAI returned invalid JSON payload.") from exc

    def _stream_chat_completion(
        self,
        payload: dict,
        messages: list[dict],
        request_metadata: dict[str, str] | None = None,
    ) -> Iterator[ProviderStreamEvent]:
        endpoint, headers = self._endpoint_and_headers(request_metadata)

        collected_text: list[str] = []
        final_usage: TokenUsage | None = None
        final_finish_reason: str | None = None
        tool_call_chunks: dict[int, dict[str, object]] = {}

        try:
            with httpx.stream(
                "POST",
                endpoint,
                json=payload,
                headers=headers,
                timeout=self._settings.openai_timeout_seconds,
            ) as response:
                self._raise_for_status(response)
                headers = getattr(response, "headers", {}) or {}
                content_type = str(headers.get("content-type", ""))
                if content_type and "text/event-stream" not in content_type.lower():
                    raise ProviderStreamInterruptedError(self.provider_name, f"OpenAI stream returned unexpected content-type '{content_type}'.")
                saw_done = False
                for raw_line in response.iter_lines():
                    if not raw_line:
                        continue
                    if not raw_line.startswith("data:"):
                        continue

                    line = raw_line.removeprefix("data:").strip()
                    if line == "[DONE]":
                        saw_done = True
                        break

                    try:
                        parsed_payload = json.loads(line)
                    except json.JSONDecodeError as exc:
                        raise ProviderStreamInterruptedError(
                            self.provider_name,
                            f"Failed to decode OpenAI stream chunk: {line}",
                        ) from exc

                    usage_payload = parsed_payload.get("usage")
                    if usage_payload:
                        final_usage = self._usage_from_payload(usage_payload)

                    choice = parsed_payload.get("choices", [{}])[0]
                    delta = choice.get("delta", {})

                    content_piece = delta.get("content", "")
                    if content_piece:
                        collected_text.append(content_piece)
                        yield ProviderStreamEvent(event="delta", delta=content_piece)
                    merge_openai_tool_call_chunks(tool_call_chunks, delta.get("tool_calls"))

                    finish_reason = choice.get("finish_reason")
                    if finish_reason:
                        final_finish_reason = finish_reason

                if not saw_done and final_finish_reason is None:
                    raise ProviderStreamInterruptedError(
                        self.provider_name,
                        "OpenAI stream ended without explicit completion signal.",
                    )

                usage = final_usage or self._usage_accounting.usage_from_prompt_completion(messages, "".join(collected_text))
                cost = self._usage_accounting.costs_for_provider(provider=self.provider_name, usage=usage)
                yield ProviderStreamEvent(
                    event="done",
                    finish_reason=final_finish_reason or "stop",
                    usage=usage,
                    cost=cost,
                    tool_calls=finalize_openai_tool_calls(tool_call_chunks),
                    credential_type="api_key",
                    auth_source="openai_api_key",
                )
        except httpx.TimeoutException as exc:
            raise ProviderStreamInterruptedError(self.provider_name, f"OpenAI stream timed out: {exc}") from exc
        except httpx.RequestError as exc:
            raise ProviderStreamInterruptedError(self.provider_name, f"Network error while streaming OpenAI API: {exc}") from exc

    def _usage_from_response(self, payload: dict, messages: list[dict], content: str) -> TokenUsage:
        usage_payload = payload.get("usage")
        if usage_payload:
            return self._usage_from_payload(usage_payload)
        return self._usage_accounting.usage_from_prompt_completion(messages, content)

    @staticmethod
    def _usage_from_payload(usage_payload: dict) -> TokenUsage:
        input_tokens = usage_payload.get("prompt_tokens", usage_payload.get("input_tokens", 0))
        output_tokens = usage_payload.get("completion_tokens", usage_payload.get("output_tokens", 0))
        total_tokens = usage_payload.get("total_tokens", input_tokens + output_tokens)
        return TokenUsage(
            input_tokens=int(input_tokens),
            output_tokens=int(output_tokens),
            total_tokens=int(total_tokens),
        )

    def _raise_for_status(self, response: httpx.Response) -> None:
        if response.status_code in (401, 403):
            raise ProviderAuthenticationError(self.provider_name, f"OpenAI authentication failed ({response.status_code}).")

        if response.status_code == 408:
            raise ProviderRequestTimeoutError(self.provider_name, f"OpenAI request timeout ({response.status_code}): {response.text[:500]}")
        if response.status_code == 404:
            raise ProviderModelNotFoundError(self.provider_name, message=f"OpenAI model/resource not found ({response.status_code}): {response.text[:500]}")
        if response.status_code in (400, 422):
            raise ProviderBadRequestError(self.provider_name, f"OpenAI rejected request ({response.status_code}): {response.text[:500]}")
        if response.status_code == 410:
            raise ProviderResourceGoneError(self.provider_name, f"OpenAI resource gone ({response.status_code}): {response.text[:500]}")
        if response.status_code == 413:
            raise ProviderPayloadTooLargeError(self.provider_name, f"OpenAI payload too large ({response.status_code}): {response.text[:500]}")
        if response.status_code == 415:
            raise ProviderUnsupportedMediaTypeError(self.provider_name, f"OpenAI media type unsupported ({response.status_code}): {response.text[:500]}")
        if response.status_code == 409:
            raise ProviderConflictError(self.provider_name, f"OpenAI conflict ({response.status_code}): {response.text[:500]}")
        if response.status_code == 429:
            retry_after = self._parse_retry_after_seconds(response.headers.get("retry-after"))
            raise ProviderRateLimitError(self.provider_name, f"OpenAI rate limit reached ({response.status_code}): {response.text[:500]}", retry_after_seconds=retry_after)

        if response.status_code >= 500:
            if response.status_code == 503:
                raise ProviderUnavailableError(self.provider_name, f"OpenAI temporarily unavailable ({response.status_code}): {response.text[:500]}")
            raise ProviderUpstreamError(self.provider_name, f"OpenAI upstream error ({response.status_code}): {response.text[:500]}")

        if response.status_code >= 300:
            raise ProviderUpstreamError(self.provider_name, f"Unexpected OpenAI response ({response.status_code}): {response.text[:500]}")

    @staticmethod
    def _parse_retry_after_seconds(value: str | None) -> int | None:
        if not value:
            return None
        if value.isdigit():
            return int(value)
        http_date = parsedate_to_datetime(value)
        if http_date is not None:
            delta = int((http_date - datetime.now(tz=http_date.tzinfo)).total_seconds())
            return delta if delta > 0 else 0
        try:
            retry_at = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
        delta = int((retry_at - datetime.now(tz=retry_at.tzinfo)).total_seconds())
        return delta if delta > 0 else 0

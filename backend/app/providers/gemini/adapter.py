"""Gemini adapter with OAuth/account semantics and partial runtime bridge."""

from __future__ import annotations

import json
from collections.abc import Iterator
from datetime import datetime
from urllib.parse import urlsplit

import httpx

from app.auth.oauth.gemini import resolve_gemini_auth_state
from app.providers.base import (
    ChatDispatchRequest,
    ChatDispatchResult,
    ProviderAuthenticationError,
    ProviderBadRequestError,
    ProviderCapabilities,
    ProviderConfigurationError,
    ProviderConflictError,
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
    ProviderUnsupportedMediaTypeError,
    ProviderUpstreamError,
    openai_compatible_response_controls,
)
from app.providers.openai_streaming import (
    finalize_openai_tool_calls,
    merge_openai_tool_call_chunks,
)
from app.request_metadata import forgeframe_request_metadata_headers
from app.settings.config import Settings
from app.usage.models import TokenUsage
from app.usage.service import UsageAccountingService


class GeminiAdapter:
    provider_name = "gemini"

    def __init__(self, settings: Settings):
        self._settings = settings
        self._usage = UsageAccountingService(settings)
        oauth_required = settings.gemini_auth_mode == "oauth"
        self.capabilities = ProviderCapabilities(
            streaming=settings.gemini_probe_enabled,
            tool_calling=True,
            tool_calling_level="partial",
            vision=True,
            external=True,
            oauth_required=oauth_required,
            discovery_support=True,
            provider_axis="oauth_account",
            auth_mechanism="hybrid_oauth_api_key",
            verify_support=True,
            probe_support=True,
        )

    def is_ready(self) -> bool:
        return self.readiness_reason() is None

    def readiness_reason(self) -> str | None:
        auth_state = resolve_gemini_auth_state(self._settings)
        if not auth_state.ready:
            if auth_state.auth_mode == "oauth":
                return "Gemini OAuth/account mode requires FORGEFRAME_GEMINI_OAUTH_ACCESS_TOKEN."
            return "Gemini API-key mode selected but FORGEFRAME_GEMINI_API_KEY is missing."
        if not self._settings.gemini_probe_enabled:
            return "Gemini runtime bridge is disabled. Enable FORGEFRAME_GEMINI_PROBE_ENABLED=true for beta runtime path."
        if self._configured_base_url() is None:
            return "FORGEFRAME_GEMINI_PROBE_BASE_URL must be an absolute http(s) URL."
        return None

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        reason = self.readiness_reason()
        if reason:
            raise ProviderConfigurationError(self.provider_name, reason)

        payload = {"model": request.model, "messages": request.messages, "stream": False}
        payload.update(openai_compatible_response_controls(request.response_controls))
        tools = getattr(request, "tools", [])
        if tools:
            payload["tools"] = tools
            tool_choice = getattr(request, "tool_choice", None)
            if tool_choice is not None:
                payload["tool_choice"] = tool_choice
        data = self._post(payload, request.request_metadata)
        choice = data.get("choices", [{}])[0]
        message = choice.get("message", {})
        content = str(message.get("content", ""))
        tool_calls = message.get("tool_calls", [])
        usage = self._usage_from_payload(data.get("usage", {}), request.messages, content)
        cost = self._usage.costs_for_provider(provider=self.provider_name, usage=usage, oauth_mode=(self._settings.gemini_auth_mode == "oauth"))
        return ChatDispatchResult(
            model=str(data.get("model", request.model)),
            provider=self.provider_name,
            content=content,
            finish_reason=str(choice.get("finish_reason", "stop")),
            usage=usage,
            cost=cost,
            credential_type="oauth_access_token" if self._settings.gemini_auth_mode == "oauth" else "api_key",
            auth_source="gemini_oauth_account_bridge" if self._settings.gemini_auth_mode == "oauth" else "gemini_api_key_bridge",
            tool_calls=tool_calls if isinstance(tool_calls, list) else [],
        )

    def stream_chat_completion(self, request: ChatDispatchRequest) -> Iterator[ProviderStreamEvent]:
        reason = self.readiness_reason()
        if reason:
            raise ProviderConfigurationError(self.provider_name, reason)
        payload = {"model": request.model, "messages": request.messages, "stream": True, "stream_options": {"include_usage": True}}
        payload.update(openai_compatible_response_controls(request.response_controls))
        tools = getattr(request, "tools", [])
        if tools:
            payload["tools"] = tools
            tool_choice = getattr(request, "tool_choice", None)
            if tool_choice is not None:
                payload["tool_choice"] = tool_choice
        yield from self._stream(payload, request.messages, request.request_metadata)

    def _endpoint_headers(self, request_metadata: dict[str, str] | None = None) -> tuple[str, dict[str, str]]:
        base_url = self._configured_base_url()
        if base_url is None:  # pragma: no cover - guarded by readiness checks
            raise ProviderConfigurationError(
                self.provider_name,
                "FORGEFRAME_GEMINI_PROBE_BASE_URL must be an absolute http(s) URL.",
            )
        endpoint = f"{base_url}/chat/completions"
        token = self._settings.gemini_oauth_access_token.strip() if self._settings.gemini_auth_mode == "oauth" else self._settings.gemini_api_key.strip()
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        headers.update(forgeframe_request_metadata_headers(request_metadata))
        return endpoint, headers

    def _configured_base_url(self) -> str | None:
        base_url = self._settings.gemini_probe_base_url.strip()
        parsed = urlsplit(base_url)
        host = parsed.hostname or ""
        if parsed.scheme not in {"http", "https"} or not host or any(char.isspace() for char in host):
            return None
        return base_url.rstrip("/")

    def _post(self, payload: dict, request_metadata: dict[str, str] | None = None) -> dict:
        endpoint, headers = self._endpoint_headers(request_metadata)
        try:
            response = httpx.post(endpoint, json=payload, headers=headers, timeout=self._settings.gemini_timeout_seconds)
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError(self.provider_name, f"Gemini request timed out: {exc}") from exc
        except httpx.RequestError as exc:
            raise ProviderUpstreamError(self.provider_name, f"Gemini request failed: {exc}") from exc
        self._raise_for_status(response)
        headers = getattr(response, "headers", {}) or {}
        content_type = str(headers.get("content-type", ""))
        if content_type and "json" not in content_type.lower():
            raise ProviderProtocolError(self.provider_name, f"Gemini returned unexpected content-type '{content_type}'.")
        try:
            return response.json()
        except ValueError as exc:
            raise ProviderProtocolError(self.provider_name, "Gemini returned invalid JSON payload.") from exc

    def _stream(
        self,
        payload: dict,
        messages: list[dict],
        request_metadata: dict[str, str] | None = None,
    ) -> Iterator[ProviderStreamEvent]:
        endpoint, headers = self._endpoint_headers(request_metadata)
        chunks: list[str] = []
        usage: TokenUsage | None = None
        finish_reason = "stop"
        saw_done = False
        tool_call_chunks: dict[int, dict[str, object]] = {}
        try:
            with httpx.stream("POST", endpoint, json=payload, headers=headers, timeout=self._settings.gemini_timeout_seconds) as response:
                self._raise_for_status(response)
                headers = getattr(response, "headers", {}) or {}
                content_type = str(headers.get("content-type", ""))
                if content_type and "text/event-stream" not in content_type.lower():
                    raise ProviderStreamInterruptedError(self.provider_name, f"Gemini stream returned unexpected content-type '{content_type}'.")
                for raw in response.iter_lines():
                    if not raw or not raw.startswith("data:"):
                        continue
                    line = raw.removeprefix("data:").strip()
                    if line == "[DONE]":
                        saw_done = True
                        break
                    try:
                        item = json.loads(line)
                    except json.JSONDecodeError as exc:
                        raise ProviderStreamInterruptedError(self.provider_name, "Gemini stream produced invalid JSON chunk.") from exc
                    choice = item.get("choices", [{}])[0]
                    delta_payload = choice.get("delta", {})
                    delta = delta_payload.get("content", "")
                    if delta:
                        chunks.append(str(delta))
                        yield ProviderStreamEvent(event="delta", delta=str(delta))
                    merge_openai_tool_call_chunks(tool_call_chunks, delta_payload.get("tool_calls"))
                    if choice.get("finish_reason"):
                        finish_reason = str(choice["finish_reason"])
                    if item.get("usage"):
                        usage = self._usage_from_payload(item["usage"], messages, "".join(chunks))
        except httpx.TimeoutException as exc:
            raise ProviderStreamInterruptedError(self.provider_name, f"Gemini stream timed out: {exc}") from exc
        except httpx.RequestError as exc:
            raise ProviderStreamInterruptedError(self.provider_name, f"Gemini stream failed: {exc}") from exc

        if not saw_done:
            raise ProviderStreamInterruptedError(self.provider_name, "Gemini stream ended without done marker.")
        final_usage = usage or self._usage.usage_from_prompt_completion(messages, "".join(chunks))
        final_cost = self._usage.costs_for_provider(provider=self.provider_name, usage=final_usage, oauth_mode=(self._settings.gemini_auth_mode == "oauth"))
        yield ProviderStreamEvent(
            event="done",
            finish_reason=finish_reason,
            usage=final_usage,
            cost=final_cost,
            tool_calls=finalize_openai_tool_calls(tool_call_chunks),
            credential_type="oauth_access_token" if self._settings.gemini_auth_mode == "oauth" else "api_key",
            auth_source="gemini_oauth_account_bridge" if self._settings.gemini_auth_mode == "oauth" else "gemini_api_key_bridge",
        )

    def _usage_from_payload(self, usage_payload: dict, messages: list[dict], content: str) -> TokenUsage:
        if usage_payload:
            input_tokens = int(usage_payload.get("prompt_tokens", usage_payload.get("input_tokens", 0)))
            output_tokens = int(usage_payload.get("completion_tokens", usage_payload.get("output_tokens", 0)))
            total_tokens = int(usage_payload.get("total_tokens", input_tokens + output_tokens))
            return TokenUsage(input_tokens=input_tokens, output_tokens=output_tokens, total_tokens=total_tokens)
        return self._usage.usage_from_prompt_completion(messages, content)

    def _raise_for_status(self, response: httpx.Response) -> None:
        if response.status_code in {401, 403}:
            raise ProviderAuthenticationError(self.provider_name, f"Gemini authentication failed ({response.status_code}).")
        if response.status_code == 408:
            raise ProviderRequestTimeoutError(self.provider_name, f"Gemini request timeout ({response.status_code}): {response.text[:500]}")
        if response.status_code == 404:
            raise ProviderModelNotFoundError(self.provider_name, message=f"Gemini model/resource not found ({response.status_code}): {response.text[:500]}")
        if response.status_code in {400, 422}:
            raise ProviderBadRequestError(self.provider_name, f"Gemini rejected request ({response.status_code}): {response.text[:500]}")
        if response.status_code == 410:
            raise ProviderResourceGoneError(self.provider_name, f"Gemini resource gone ({response.status_code}): {response.text[:500]}")
        if response.status_code == 413:
            raise ProviderPayloadTooLargeError(self.provider_name, f"Gemini payload too large ({response.status_code}): {response.text[:500]}")
        if response.status_code == 415:
            raise ProviderUnsupportedMediaTypeError(self.provider_name, f"Gemini unsupported media type ({response.status_code}): {response.text[:500]}")
        if response.status_code == 409:
            raise ProviderConflictError(self.provider_name, f"Gemini conflict ({response.status_code}): {response.text[:500]}")
        if response.status_code == 429:
            retry_after = self._parse_retry_after_seconds(response.headers.get("retry-after"))
            raise ProviderRateLimitError(self.provider_name, f"Gemini rate limit reached ({response.status_code}): {response.text[:500]}", retry_after_seconds=retry_after)
        if response.status_code >= 500:
            if response.status_code == 503:
                raise ProviderUnavailableError(self.provider_name, f"Gemini unavailable ({response.status_code}): {response.text[:500]}")
            raise ProviderUpstreamError(self.provider_name, f"Gemini upstream error ({response.status_code}): {response.text[:500]}")
        if response.status_code >= 300:
            raise ProviderUpstreamError(self.provider_name, f"Unexpected Gemini response ({response.status_code}): {response.text[:500]}")

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

"""OpenAI Codex adapter with partial runtime bridge (non-fake beta path)."""

import json
from collections.abc import Iterator

import httpx

from app.auth.oauth.openai import resolve_codex_auth_state
from app.providers.base import (
    ChatDispatchRequest,
    ChatDispatchResult,
    ProviderAuthenticationError,
    ProviderBadRequestError,
    ProviderCapabilities,
    ProviderConflictError,
    ProviderConfigurationError,
    ProviderNotImplementedError,
    ProviderProtocolError,
    ProviderRateLimitError,
    ProviderResourceGoneError,
    ProviderStreamEvent,
    ProviderStreamInterruptedError,
    ProviderTimeoutError,
    ProviderUnavailableError,
    ProviderUnsupportedMediaTypeError,
    ProviderPayloadTooLargeError,
    ProviderUnsupportedFeatureError,
    ProviderUpstreamError,
)
from app.settings.config import Settings
from app.usage.models import TokenUsage
from app.usage.service import UsageAccountingService


class OpenAICodexAdapter:
    provider_name = "openai_codex"

    def __init__(self, settings: Settings):
        self._settings = settings
        self._usage = UsageAccountingService(settings)
        oauth_required = settings.openai_codex_auth_mode == "oauth"
        self.capabilities = ProviderCapabilities(
            streaming=settings.openai_codex_bridge_enabled,
            tool_calling=True,
            vision=False,
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
        auth_state = resolve_codex_auth_state(self._settings)
        if not auth_state.ready:
            if auth_state.auth_mode == "oauth":
                return (
                    "OpenAI Codex requires OAuth access token for mode "
                    f"'{auth_state.oauth_mode}'. "
                    "Supported mode naming: browser callback, manual redirect completion, device/hosted code. "
                    "Only credential presence + readiness semantics are implemented in phase 5."
                )
            return "OpenAI Codex API-key mode selected but FORGEGATE_OPENAI_CODEX_API_KEY is missing."

        if self._settings.openai_codex_discovery_required and not self._settings.openai_codex_discovery_enabled:
            return "OpenAI Codex discovery is required but FORGEGATE_OPENAI_CODEX_DISCOVERY_ENABLED is false."
        if self._settings.openai_codex_bridge_enabled and not self._settings.openai_codex_base_url.strip():
            return "FORGEGATE_OPENAI_CODEX_BASE_URL is required when codex bridge is enabled."
        return None

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        reason = self.readiness_reason()
        if reason:
            raise ProviderConfigurationError(self.provider_name, reason)
        if not self._settings.openai_codex_bridge_enabled:
            raise ProviderNotImplementedError(self.provider_name)
        payload = {"model": request.model, "messages": request.messages, "stream": False}
        tools = getattr(request, "tools", [])
        if tools:
            payload["tools"] = tools
            tool_choice = getattr(request, "tool_choice", None)
            if tool_choice is not None:
                payload["tool_choice"] = tool_choice
        data = self._post(payload)
        choice = data.get("choices", [{}])[0]
        message = choice.get("message", {})
        content = str(message.get("content", ""))
        usage = self._usage_from_payload(data.get("usage", {}), request.messages, content)
        cost = self._usage.costs_for_provider(provider=self.provider_name, usage=usage, oauth_mode=(self._settings.openai_codex_auth_mode == "oauth"))
        return ChatDispatchResult(
            model=str(data.get("model", request.model)),
            provider=self.provider_name,
            content=content,
            finish_reason=str(choice.get("finish_reason", "stop")),
            usage=usage,
            cost=cost,
            credential_type="oauth_access_token" if self._settings.openai_codex_auth_mode == "oauth" else "api_key",
            auth_source="codex_oauth_account_bridge" if self._settings.openai_codex_auth_mode == "oauth" else "codex_api_key_bridge",
        )

    def stream_chat_completion(self, request: ChatDispatchRequest) -> Iterator[ProviderStreamEvent]:
        reason = self.readiness_reason()
        if reason:
            raise ProviderConfigurationError(self.provider_name, reason)
        if not self._settings.openai_codex_bridge_enabled:
            raise ProviderNotImplementedError(self.provider_name)
        if not self.capabilities.streaming:
            raise ProviderUnsupportedFeatureError(self.provider_name, "streaming")
        payload = {
            "model": request.model,
            "messages": request.messages,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        tools = getattr(request, "tools", [])
        if tools:
            payload["tools"] = tools
            tool_choice = getattr(request, "tool_choice", None)
            if tool_choice is not None:
                payload["tool_choice"] = tool_choice
        yield from self._stream(payload, request.messages)

    def _endpoint_headers(self) -> tuple[str, dict[str, str]]:
        endpoint = f"{self._settings.openai_codex_base_url.rstrip('/')}/chat/completions"
        auth_state = resolve_codex_auth_state(self._settings)
        token = self._settings.openai_codex_oauth_access_token.strip() if auth_state.auth_mode == "oauth" else self._settings.openai_codex_api_key.strip()
        return endpoint, {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def _post(self, payload: dict) -> dict:
        endpoint, headers = self._endpoint_headers()
        try:
            response = httpx.post(endpoint, json=payload, headers=headers, timeout=self._settings.openai_codex_timeout_seconds)
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError(self.provider_name, f"Codex bridge request timed out: {exc}") from exc
        except httpx.RequestError as exc:
            raise ProviderUpstreamError(self.provider_name, f"Codex bridge request failed: {exc}") from exc
        self._raise_for_status(response)
        try:
            return response.json()
        except ValueError as exc:
            raise ProviderProtocolError(self.provider_name, "Codex bridge returned invalid JSON payload.") from exc

    def _stream(self, payload: dict, messages: list[dict]) -> Iterator[ProviderStreamEvent]:
        endpoint, headers = self._endpoint_headers()
        chunks: list[str] = []
        usage: TokenUsage | None = None
        finish_reason = "stop"
        saw_done = False
        try:
            with httpx.stream("POST", endpoint, json=payload, headers=headers, timeout=self._settings.openai_codex_timeout_seconds) as response:
                self._raise_for_status(response)
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
                        raise ProviderStreamInterruptedError(self.provider_name, "Codex bridge stream produced invalid JSON chunk.") from exc
                    choice = item.get("choices", [{}])[0]
                    delta = choice.get("delta", {}).get("content", "")
                    if delta:
                        chunks.append(str(delta))
                        yield ProviderStreamEvent(event="delta", delta=str(delta))
                    if choice.get("finish_reason"):
                        finish_reason = str(choice["finish_reason"])
                    if item.get("usage"):
                        usage = self._usage_from_payload(item["usage"], messages, "".join(chunks))
        except httpx.TimeoutException as exc:
            raise ProviderStreamInterruptedError(self.provider_name, f"Codex bridge stream timed out: {exc}") from exc
        except httpx.RequestError as exc:
            raise ProviderStreamInterruptedError(self.provider_name, f"Codex bridge stream failed: {exc}") from exc
        if not saw_done:
            raise ProviderStreamInterruptedError(self.provider_name, "Codex bridge stream ended without done marker.")
        final_usage = usage or self._usage.usage_from_prompt_completion(messages, "".join(chunks))
        final_cost = self._usage.costs_for_provider(provider=self.provider_name, usage=final_usage, oauth_mode=(self._settings.openai_codex_auth_mode == "oauth"))
        yield ProviderStreamEvent(event="done", finish_reason=finish_reason, usage=final_usage, cost=final_cost)

    def _usage_from_payload(self, usage_payload: dict, messages: list[dict], content: str) -> TokenUsage:
        if usage_payload:
            input_tokens = int(usage_payload.get("prompt_tokens", usage_payload.get("input_tokens", 0)))
            output_tokens = int(usage_payload.get("completion_tokens", usage_payload.get("output_tokens", 0)))
            total_tokens = int(usage_payload.get("total_tokens", input_tokens + output_tokens))
            return TokenUsage(input_tokens=input_tokens, output_tokens=output_tokens, total_tokens=total_tokens)
        return self._usage.usage_from_prompt_completion(messages, content)

    def _raise_for_status(self, response: httpx.Response) -> None:
        if response.status_code in {401, 403}:
            raise ProviderAuthenticationError(self.provider_name, f"Codex authentication failed ({response.status_code}).")
        if response.status_code in {400, 404, 422}:
            raise ProviderBadRequestError(self.provider_name, f"Codex bridge rejected request ({response.status_code}): {response.text[:500]}")
        if response.status_code == 410:
            raise ProviderResourceGoneError(self.provider_name, f"Codex resource gone ({response.status_code}): {response.text[:500]}")
        if response.status_code == 413:
            raise ProviderPayloadTooLargeError(self.provider_name, f"Codex payload too large ({response.status_code}): {response.text[:500]}")
        if response.status_code == 415:
            raise ProviderUnsupportedMediaTypeError(self.provider_name, f"Codex unsupported media type ({response.status_code}): {response.text[:500]}")
        if response.status_code == 409:
            raise ProviderConflictError(self.provider_name, f"Codex bridge conflict ({response.status_code}): {response.text[:500]}")
        if response.status_code == 429:
            retry_after = int(response.headers.get("retry-after", "0")) if response.headers.get("retry-after", "").isdigit() else None
            raise ProviderRateLimitError(self.provider_name, f"Codex bridge rate limit reached ({response.status_code}): {response.text[:500]}", retry_after_seconds=retry_after)
        if response.status_code >= 500:
            if response.status_code == 503:
                raise ProviderUnavailableError(self.provider_name, f"Codex upstream unavailable ({response.status_code}): {response.text[:500]}")
            raise ProviderUpstreamError(self.provider_name, f"Codex upstream error ({response.status_code}): {response.text[:500]}")
        if response.status_code >= 300:
            raise ProviderUpstreamError(self.provider_name, f"Unexpected Codex bridge response ({response.status_code}): {response.text[:500]}")

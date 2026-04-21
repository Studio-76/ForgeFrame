"""Anthropic adapter with honest native messages runtime support."""

from __future__ import annotations

import json
from collections.abc import Iterator
from datetime import datetime

import httpx

from app.providers.base import (
    ChatDispatchRequest,
    ChatDispatchResult,
    ProviderAuthenticationError,
    ProviderBadRequestError,
    ProviderCapabilities,
    ProviderConflictError,
    ProviderConfigurationError,
    ProviderModelNotFoundError,
    ProviderPayloadTooLargeError,
    ProviderProtocolError,
    ProviderRateLimitError,
    ProviderRequestTimeoutError,
    ProviderResourceGoneError,
    ProviderStreamEvent,
    ProviderStreamInterruptedError,
    ProviderTimeoutError,
    ProviderUnavailableError,
    ProviderUnsupportedFeatureError,
    ProviderUnsupportedMediaTypeError,
    ProviderUpstreamError,
)
from app.settings.config import Settings
from app.usage.models import TokenUsage
from app.usage.service import UsageAccountingService


class AnthropicAdapter:
    provider_name = "anthropic"

    def __init__(self, settings: Settings):
        self._settings = settings
        self._usage = UsageAccountingService(settings)
        self.capabilities = ProviderCapabilities(
            streaming=True,
            tool_calling=True,
            tool_calling_level="partial",
            vision=True,
            external=True,
            discovery_support=True,
            provider_axis="openai_compatible_provider",
            auth_mechanism="api_key",
            verify_support=True,
            probe_support=True,
        )

    def is_ready(self) -> bool:
        return bool(self._settings.anthropic_api_key.strip())

    def readiness_reason(self) -> str | None:
        if self.is_ready():
            return None
        return "FORGEGATE_ANTHROPIC_API_KEY is required."

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        if not self.is_ready():
            raise ProviderConfigurationError(self.provider_name, self.readiness_reason() or "Anthropic is not configured.")
        payload = self._build_payload(request, stream=False)
        data = self._post(payload)
        content, tool_calls = self._extract_content(data.get("content", []))
        usage = self._usage_from_payload(data.get("usage", {}), request.messages, content)
        cost = self._usage.costs_for_provider(provider=self.provider_name, usage=usage)
        return ChatDispatchResult(
            model=str(data.get("model", request.model)),
            provider=self.provider_name,
            content=content,
            finish_reason=str(data.get("stop_reason", "stop") or "stop"),
            usage=usage,
            cost=cost,
            credential_type="api_key",
            auth_source="anthropic_api_key",
            tool_calls=tool_calls,
        )

    def stream_chat_completion(self, request: ChatDispatchRequest) -> Iterator[ProviderStreamEvent]:
        if not self.is_ready():
            raise ProviderConfigurationError(self.provider_name, self.readiness_reason() or "Anthropic is not configured.")
        payload = self._build_payload(request, stream=True)
        yield from self._stream(payload, request.messages)

    def _endpoint_and_headers(self) -> tuple[str, dict[str, str]]:
        endpoint = f"{self._settings.anthropic_base_url.rstrip('/')}/messages"
        return endpoint, {
            "x-api-key": self._settings.anthropic_api_key,
            "anthropic-version": self._settings.anthropic_version,
            "content-type": "application/json",
        }

    @staticmethod
    def _stringify_content(value: object) -> str:
        if isinstance(value, str):
            return value
        if isinstance(value, list):
            chunks: list[str] = []
            for item in value:
                if isinstance(item, dict) and item.get("type") in {"text", "input_text"}:
                    chunks.append(str(item.get("text", "")))
                else:
                    chunks.append(json.dumps(item, ensure_ascii=True))
            return "\n".join(chunk for chunk in chunks if chunk.strip()) or " "
        if isinstance(value, dict):
            return json.dumps(value, ensure_ascii=True)
        return str(value)

    def _build_payload(self, request: ChatDispatchRequest, *, stream: bool) -> dict[str, object]:
        system_messages: list[str] = []
        translated_messages: list[dict[str, object]] = []
        for item in request.messages:
            role = str(item.get("role", "user"))
            content = self._stringify_content(item.get("content", ""))
            if role == "system":
                system_messages.append(content)
                continue
            if role == "assistant":
                translated_messages.append({"role": "assistant", "content": content})
                continue
            translated_messages.append({"role": "user", "content": content})
        if not translated_messages:
            translated_messages = [{"role": "user", "content": " "}]
        payload: dict[str, object] = {
            "model": request.model or self._settings.anthropic_probe_model,
            "messages": translated_messages,
            "max_tokens": 1024,
            "stream": stream,
        }
        if system_messages:
            payload["system"] = "\n\n".join(part for part in system_messages if part.strip())
        if request.tools:
            payload["tools"] = [self._normalize_tool(tool) for tool in request.tools]
            tool_choice = self._normalize_tool_choice(request.tool_choice)
            if tool_choice is not None:
                payload["tool_choice"] = tool_choice
        return payload

    @staticmethod
    def _normalize_tool(tool: dict) -> dict[str, object]:
        function = tool.get("function", {})
        return {
            "name": str(function.get("name", "")),
            "description": str(function.get("description", "")),
            "input_schema": function.get("parameters", {"type": "object"}),
        }

    @staticmethod
    def _normalize_tool_choice(tool_choice: str | dict | None) -> dict[str, object] | None:
        if tool_choice is None or tool_choice == "none":
            return None
        if isinstance(tool_choice, str):
            if tool_choice == "auto":
                return {"type": "auto"}
            if tool_choice == "required":
                return {"type": "any"}
            raise ProviderUnsupportedFeatureError("anthropic", f"tool_choice:{tool_choice}")
        function = tool_choice.get("function", {})
        name = function.get("name")
        if not name:
            return None
        return {"type": "tool", "name": str(name)}

    def _post(self, payload: dict[str, object]) -> dict:
        endpoint, headers = self._endpoint_and_headers()
        try:
            response = httpx.post(endpoint, json=payload, headers=headers, timeout=self._settings.anthropic_timeout_seconds)
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError(self.provider_name, f"Anthropic request timed out: {exc}") from exc
        except httpx.RequestError as exc:
            raise ProviderUpstreamError(self.provider_name, f"Anthropic request failed: {exc}") from exc
        self._raise_for_status(response)
        try:
            return response.json()
        except ValueError as exc:
            raise ProviderProtocolError(self.provider_name, "Anthropic returned invalid JSON payload.") from exc

    def _stream(self, payload: dict[str, object], messages: list[dict]) -> Iterator[ProviderStreamEvent]:
        endpoint, headers = self._endpoint_and_headers()
        collected = ""
        usage = TokenUsage()
        finish_reason = "stop"
        saw_done = False
        current_event = ""
        try:
            with httpx.stream("POST", endpoint, json=payload, headers=headers, timeout=self._settings.anthropic_timeout_seconds) as response:
                self._raise_for_status(response)
                for raw_line in response.iter_lines():
                    if raw_line is None:
                        continue
                    line = raw_line.strip()
                    if not line:
                        continue
                    if line.startswith("event:"):
                        current_event = line.removeprefix("event:").strip()
                        continue
                    if not line.startswith("data:"):
                        continue
                    data_text = line.removeprefix("data:").strip()
                    if data_text == "[DONE]":
                        saw_done = True
                        break
                    try:
                        payload_item = json.loads(data_text)
                    except json.JSONDecodeError as exc:
                        raise ProviderStreamInterruptedError(self.provider_name, "Anthropic stream produced invalid JSON chunk.") from exc
                    event_type = current_event or str(payload_item.get("type", ""))
                    if event_type == "content_block_delta":
                        delta = str(payload_item.get("delta", {}).get("text", ""))
                        if delta:
                            collected += delta
                            yield ProviderStreamEvent(event="delta", delta=delta)
                    elif event_type == "message_delta":
                        finish_reason = str(payload_item.get("delta", {}).get("stop_reason", finish_reason) or finish_reason)
                        usage_payload = payload_item.get("usage", {})
                        usage = self._usage_from_payload(usage_payload, messages, collected, default=usage)
                    elif event_type == "message_start":
                        message = payload_item.get("message", {})
                        usage_payload = message.get("usage", {})
                        usage = self._usage_from_payload(usage_payload, messages, collected, default=usage)
                    elif event_type == "message_stop":
                        saw_done = True
                        break
        except httpx.TimeoutException as exc:
            raise ProviderStreamInterruptedError(self.provider_name, f"Anthropic stream timed out: {exc}") from exc
        except httpx.RequestError as exc:
            raise ProviderStreamInterruptedError(self.provider_name, f"Anthropic stream failed: {exc}") from exc

        if not saw_done:
            raise ProviderStreamInterruptedError(self.provider_name, "Anthropic stream ended without stop marker.")
        if usage.total_tokens == 0:
            usage = self._usage.usage_from_prompt_completion(messages, collected)
        cost = self._usage.costs_for_provider(provider=self.provider_name, usage=usage)
        yield ProviderStreamEvent(event="done", finish_reason=finish_reason, usage=usage, cost=cost)

    @staticmethod
    def _extract_content(content_blocks: object) -> tuple[str, list[dict]]:
        if not isinstance(content_blocks, list):
            return "", []
        text_parts: list[str] = []
        tool_calls: list[dict] = []
        for block in content_blocks:
            if not isinstance(block, dict):
                continue
            block_type = block.get("type")
            if block_type == "text":
                text_parts.append(str(block.get("text", "")))
            elif block_type == "tool_use":
                tool_calls.append(
                    {
                        "id": str(block.get("id", "")),
                        "type": "function",
                        "function": {
                            "name": str(block.get("name", "")),
                            "arguments": json.dumps(block.get("input", {}), ensure_ascii=True),
                        },
                    }
                )
        return "".join(text_parts).strip(), tool_calls

    def _usage_from_payload(
        self,
        usage_payload: object,
        messages: list[dict],
        content: str,
        *,
        default: TokenUsage | None = None,
    ) -> TokenUsage:
        if isinstance(usage_payload, dict) and usage_payload:
            input_tokens = int(usage_payload.get("input_tokens", default.input_tokens if default else 0))
            output_tokens = int(usage_payload.get("output_tokens", default.output_tokens if default else 0))
            total_tokens = int(usage_payload.get("total_tokens", input_tokens + output_tokens))
            return TokenUsage(input_tokens=input_tokens, output_tokens=output_tokens, total_tokens=total_tokens)
        return default or self._usage.usage_from_prompt_completion(messages, content)

    def _raise_for_status(self, response: httpx.Response) -> None:
        if response.status_code in {401, 403}:
            raise ProviderAuthenticationError(self.provider_name, f"Anthropic authentication failed ({response.status_code}).")
        if response.status_code == 408:
            raise ProviderRequestTimeoutError(self.provider_name, f"Anthropic request timeout ({response.status_code}): {response.text[:500]}")
        if response.status_code == 404:
            raise ProviderModelNotFoundError(self.provider_name, message=f"Anthropic model/resource not found ({response.status_code}): {response.text[:500]}")
        if response.status_code in {400, 422}:
            raise ProviderBadRequestError(self.provider_name, f"Anthropic rejected request ({response.status_code}): {response.text[:500]}")
        if response.status_code == 410:
            raise ProviderResourceGoneError(self.provider_name, f"Anthropic resource gone ({response.status_code}): {response.text[:500]}")
        if response.status_code == 413:
            raise ProviderPayloadTooLargeError(self.provider_name, f"Anthropic payload too large ({response.status_code}): {response.text[:500]}")
        if response.status_code == 415:
            raise ProviderUnsupportedMediaTypeError(self.provider_name, f"Anthropic unsupported media type ({response.status_code}): {response.text[:500]}")
        if response.status_code == 409:
            raise ProviderConflictError(self.provider_name, f"Anthropic conflict ({response.status_code}): {response.text[:500]}")
        if response.status_code == 429:
            retry_after = self._parse_retry_after_seconds(response.headers.get("retry-after"))
            raise ProviderRateLimitError(self.provider_name, f"Anthropic rate limit reached ({response.status_code}): {response.text[:500]}", retry_after_seconds=retry_after)
        if response.status_code >= 500:
            if response.status_code == 503:
                raise ProviderUnavailableError(self.provider_name, f"Anthropic unavailable ({response.status_code}): {response.text[:500]}")
            raise ProviderUpstreamError(self.provider_name, f"Anthropic upstream error ({response.status_code}): {response.text[:500]}")
        if response.status_code >= 300:
            raise ProviderUpstreamError(self.provider_name, f"Unexpected Anthropic response ({response.status_code}): {response.text[:500]}")

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

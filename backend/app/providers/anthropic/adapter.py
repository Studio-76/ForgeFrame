"""Anthropic adapter with honest native messages runtime support."""

from __future__ import annotations

import base64
import binascii
import json
import re
from collections.abc import Iterator
from datetime import datetime
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
from app.request_metadata import forgeframe_request_metadata_headers
from app.settings.config import Settings
from app.usage.models import TokenUsage
from app.usage.service import UsageAccountingService

_DATA_URL_PATTERN = re.compile(r"^data:(?P<media_type>image/[A-Za-z0-9.+-]+);base64,(?P<data>.+)$", re.DOTALL)


class AnthropicAdapter:
    provider_name = "anthropic"

    def __init__(self, settings: Settings):
        self._settings = settings
        self._usage = UsageAccountingService(settings)
        auth_mechanism = "bearer" if settings.anthropic_auth_mode == "bearer" else "api_key"
        self.capabilities = ProviderCapabilities(
            streaming=True,
            tool_calling=True,
            tool_calling_level="partial",
            vision=True,
            external=True,
            discovery_support=True,
            provider_axis="unmapped_native_runtime",
            auth_mechanism=auth_mechanism,
            verify_support=True,
            probe_support=True,
        )

    def is_ready(self) -> bool:
        return self.readiness_reason() is None

    def readiness_reason(self) -> str | None:
        if not self._active_auth_value().strip():
            if self._settings.anthropic_auth_mode == "bearer":
                return "FORGEFRAME_ANTHROPIC_BEARER_TOKEN is required when FORGEFRAME_ANTHROPIC_AUTH_MODE=bearer."
            return "FORGEFRAME_ANTHROPIC_API_KEY is required."
        if self._configured_base_url() is None:
            return "FORGEFRAME_ANTHROPIC_BASE_URL must be an absolute http(s) URL."
        return None

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        if not self.is_ready():
            raise ProviderConfigurationError(self.provider_name, self.readiness_reason() or "Anthropic is not configured.")
        payload = self._build_payload(request, stream=False)
        data = self._post(payload, request.request_metadata)
        content, tool_calls = self._extract_content(data.get("content", []))
        usage = self._usage_from_payload(data.get("usage", {}), request.messages, content)
        cost = self._usage.costs_for_provider(provider=self.provider_name, usage=usage)
        return ChatDispatchResult(
            model=str(data.get("model", request.model)),
            provider=self.provider_name,
            content=content,
            finish_reason=self._normalize_stop_reason(data.get("stop_reason", "stop")),
            usage=usage,
            cost=cost,
            credential_type="oauth_access_token" if self._settings.anthropic_auth_mode == "bearer" else "api_key",
            auth_source="anthropic_bearer_token" if self._settings.anthropic_auth_mode == "bearer" else "anthropic_api_key",
            tool_calls=tool_calls,
        )

    def stream_chat_completion(self, request: ChatDispatchRequest) -> Iterator[ProviderStreamEvent]:
        if not self.is_ready():
            raise ProviderConfigurationError(self.provider_name, self.readiness_reason() or "Anthropic is not configured.")
        payload = self._build_payload(request, stream=True)
        yield from self._stream(payload, request.messages, request.request_metadata)

    def _endpoint_and_headers(self, request_metadata: dict[str, str] | None = None) -> tuple[str, dict[str, str]]:
        base_url = self._configured_base_url()
        if base_url is None:  # pragma: no cover - guarded by readiness checks
            raise ProviderConfigurationError(
                self.provider_name,
                "FORGEFRAME_ANTHROPIC_BASE_URL must be an absolute http(s) URL.",
            )
        endpoint = f"{base_url}/messages"
        headers = {
            "anthropic-version": self._settings.anthropic_version,
            "content-type": "application/json",
        }
        if self._settings.anthropic_auth_mode == "bearer":
            headers["authorization"] = f"Bearer {self._active_auth_value()}"
        else:
            headers["x-api-key"] = self._active_auth_value()
        headers.update(forgeframe_request_metadata_headers(request_metadata))
        return endpoint, headers

    def _active_auth_value(self) -> str:
        if self._settings.anthropic_auth_mode == "bearer":
            return self._settings.anthropic_bearer_token.strip()
        return self._settings.anthropic_api_key.strip()

    def _configured_base_url(self) -> str | None:
        base_url = self._settings.anthropic_base_url.strip()
        parsed = urlsplit(base_url)
        host = parsed.hostname or ""
        if parsed.scheme not in {"http", "https"} or not host or any(char.isspace() for char in host):
            return None
        return base_url.rstrip("/")

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

    @classmethod
    def _content_to_text_blocks(cls, value: object) -> list[dict[str, str]]:
        if value is None:
            return []
        if isinstance(value, dict):
            block_type = value.get("type")
            if block_type in {"text", "input_text"}:
                text = str(value.get("text", ""))
                return [{"type": "text", "text": text}] if text.strip() else []
            nested_content = value.get("content")
            if isinstance(nested_content, list):
                return cls._content_to_text_blocks(nested_content)
        if isinstance(value, list):
            blocks: list[dict[str, str]] = []
            for item in value:
                blocks.extend(cls._content_to_text_blocks(item))
            return blocks
        text = cls._stringify_content(value)
        return [{"type": "text", "text": text}] if text.strip() else []

    @staticmethod
    def _validate_base64_image_data(data: str) -> None:
        try:
            base64.b64decode(data, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ProviderBadRequestError(
                AnthropicAdapter.provider_name,
                "Anthropic vision translation requires valid base64 image data.",
            ) from exc

    @classmethod
    def _image_source_from_url(cls, raw_url: object) -> dict[str, str]:
        url = str(raw_url or "").strip()
        if not url:
            raise ProviderBadRequestError(cls.provider_name, "Anthropic vision translation requires image_url.url.")
        data_url_match = _DATA_URL_PATTERN.match(url)
        if data_url_match is not None:
            media_type = data_url_match.group("media_type").strip()
            data = data_url_match.group("data").strip()
            cls._validate_base64_image_data(data)
            return {"type": "base64", "media_type": media_type, "data": data}
        return {"type": "url", "url": url}

    @classmethod
    def _normalize_image_source(cls, source: object) -> dict[str, str]:
        if not isinstance(source, dict):
            raise ProviderBadRequestError(cls.provider_name, "Anthropic image blocks require a source object.")
        source_type = str(source.get("type", "") or "").strip()
        if source_type == "url":
            url = str(source.get("url", "") or "").strip()
            if not url:
                raise ProviderBadRequestError(cls.provider_name, "Anthropic image URL sources require a url field.")
            return {"type": "url", "url": url}
        if source_type == "base64":
            media_type = str(source.get("media_type", "") or "").strip()
            data = str(source.get("data", "") or "").strip()
            if not media_type or not data:
                raise ProviderBadRequestError(
                    cls.provider_name,
                    "Anthropic base64 image sources require media_type and data.",
                )
            cls._validate_base64_image_data(data)
            return {"type": "base64", "media_type": media_type, "data": data}
        raise ProviderUnsupportedFeatureError(cls.provider_name, f"vision_source:{source_type or 'unknown'}")

    @classmethod
    def _normalize_openai_image_block(cls, block: dict[str, object]) -> dict[str, object]:
        if block.get("file_id") is not None:
            raise ProviderUnsupportedFeatureError(cls.provider_name, "vision:file_id")
        image_url = block.get("image_url", block.get("url"))
        if isinstance(image_url, dict):
            if image_url.get("file_id") is not None:
                raise ProviderUnsupportedFeatureError(cls.provider_name, "vision:file_id")
            image_url = image_url.get("url")
        return {"type": "image", "source": cls._image_source_from_url(image_url)}

    @classmethod
    def _content_to_anthropic_blocks(cls, value: object) -> list[dict[str, object]]:
        if value is None:
            return []
        if isinstance(value, dict):
            block_type = str(value.get("type", "") or "")
            if block_type in {"text", "input_text"}:
                text = str(value.get("text", ""))
                return [{"type": "text", "text": text}] if text.strip() else []
            if block_type in {"image_url", "input_image"}:
                return [cls._normalize_openai_image_block(value)]
            if block_type == "image":
                return [{"type": "image", "source": cls._normalize_image_source(value.get("source"))}]
            nested_content = value.get("content")
            if isinstance(nested_content, list):
                return cls._content_to_anthropic_blocks(nested_content)
        if isinstance(value, list):
            blocks: list[dict[str, object]] = []
            for item in value:
                blocks.extend(cls._content_to_anthropic_blocks(item))
            return blocks
        text = cls._stringify_content(value)
        return [{"type": "text", "text": text}] if text.strip() else []

    @classmethod
    def _normalize_tool_use_block(cls, tool_call: object) -> dict[str, object]:
        if not isinstance(tool_call, dict):
            raise ProviderBadRequestError(cls.provider_name, "Anthropic follow-up translation requires assistant tool_calls to be objects.")

        tool_call_id = str(tool_call.get("id", "") or "").strip()
        if not tool_call_id:
            raise ProviderBadRequestError(cls.provider_name, "Anthropic follow-up translation requires assistant tool_calls[].id.")

        function = tool_call.get("function", {})
        if not isinstance(function, dict):
            raise ProviderBadRequestError(cls.provider_name, "Anthropic follow-up translation requires assistant tool_calls[].function to be an object.")

        tool_name = str(function.get("name", "") or "").strip()
        if not tool_name:
            raise ProviderBadRequestError(cls.provider_name, "Anthropic follow-up translation requires assistant tool_calls[].function.name.")

        raw_arguments = function.get("arguments", "{}")
        if raw_arguments is None:
            parsed_arguments: object = {}
        elif isinstance(raw_arguments, str):
            stripped_arguments = raw_arguments.strip()
            try:
                parsed_arguments = {} if not stripped_arguments else json.loads(stripped_arguments)
            except json.JSONDecodeError as exc:
                raise ProviderBadRequestError(
                    cls.provider_name,
                    "Anthropic follow-up translation requires assistant tool_calls[].function.arguments to be valid JSON.",
                ) from exc
        elif isinstance(raw_arguments, dict):
            parsed_arguments = raw_arguments
        else:
            raise ProviderBadRequestError(
                cls.provider_name,
                "Anthropic follow-up translation requires assistant tool_calls[].function.arguments to be a JSON string or object.",
            )

        if not isinstance(parsed_arguments, dict):
            raise ProviderBadRequestError(
                cls.provider_name,
                "Anthropic follow-up translation requires assistant tool_calls[].function.arguments to decode to a JSON object.",
            )

        return {
            "type": "tool_use",
            "id": tool_call_id,
            "name": tool_name,
            "input": parsed_arguments,
        }

    @classmethod
    def _assistant_content(cls, message: dict[str, object]) -> str | list[dict[str, object]]:
        text_blocks = cls._content_to_text_blocks(message.get("content"))
        raw_tool_calls = message.get("tool_calls", [])
        if raw_tool_calls is None:
            raw_tool_calls = []
        if not isinstance(raw_tool_calls, list):
            raise ProviderBadRequestError(cls.provider_name, "Anthropic follow-up translation requires assistant tool_calls to be a list.")
        tool_blocks = [cls._normalize_tool_use_block(tool_call) for tool_call in raw_tool_calls]
        if tool_blocks:
            return [*text_blocks, *tool_blocks]
        if isinstance(message.get("content"), str) and len(text_blocks) == 1:
            return text_blocks[0]["text"]
        if text_blocks:
            return text_blocks
        return " "

    @classmethod
    def _normalize_tool_result_content(cls, value: object) -> str | list[dict[str, object]]:
        if isinstance(value, str):
            return value if value.strip() else " "
        text_blocks = cls._content_to_text_blocks(value)
        return text_blocks if text_blocks else " "

    @classmethod
    def _normalize_tool_result_block(cls, message: dict[str, object]) -> dict[str, object]:
        tool_call_id = str(message.get("tool_call_id", "") or "").strip()
        if not tool_call_id:
            raise ProviderBadRequestError(cls.provider_name, "Anthropic follow-up translation requires tool messages to include tool_call_id.")
        return {
            "type": "tool_result",
            "tool_use_id": tool_call_id,
            "content": cls._normalize_tool_result_content(message.get("content")),
        }

    def _build_payload(self, request: ChatDispatchRequest, *, stream: bool) -> dict[str, object]:
        system_messages: list[str] = []
        translated_messages: list[dict[str, object]] = []
        pending_tool_results: list[dict[str, object]] = []

        def _append_user_message(content: object) -> None:
            nonlocal pending_tool_results
            content_blocks = self._content_to_anthropic_blocks(content)
            if pending_tool_results:
                merged_blocks = [*pending_tool_results, *content_blocks]
                translated_messages.append({"role": "user", "content": merged_blocks if merged_blocks else " "})
                pending_tool_results = []
                return
            if isinstance(content, str):
                translated_messages.append({"role": "user", "content": content if content.strip() else " "})
                return
            if content_blocks:
                translated_messages.append({"role": "user", "content": content_blocks})
                return
            translated_messages.append({"role": "user", "content": " "})

        for item in request.messages:
            role = str(item.get("role", "user"))
            if role == "system":
                system_messages.append(self._stringify_content(item.get("content", "")))
                continue
            if role == "assistant":
                if pending_tool_results:
                    translated_messages.append({"role": "user", "content": pending_tool_results})
                    pending_tool_results = []
                translated_messages.append({"role": "assistant", "content": self._assistant_content(item)})
                continue
            if role == "tool":
                pending_tool_results.append(self._normalize_tool_result_block(item))
                continue
            _append_user_message(item.get("content"))
        if pending_tool_results:
            translated_messages.append({"role": "user", "content": pending_tool_results})
        if not translated_messages:
            translated_messages = [{"role": "user", "content": " "}]
        payload: dict[str, object] = {
            "model": request.model or self._settings.anthropic_probe_model,
            "messages": translated_messages,
            "max_tokens": 1024,
            "stream": stream,
        }
        if request.response_controls.get("max_output_tokens") is not None:
            payload["max_tokens"] = request.response_controls["max_output_tokens"]
        if request.response_controls.get("temperature") is not None:
            payload["temperature"] = request.response_controls["temperature"]
        if request.response_controls.get("metadata"):
            raise ProviderUnsupportedFeatureError(self.provider_name, "metadata")
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

    def _post(self, payload: dict[str, object], request_metadata: dict[str, str] | None = None) -> dict:
        endpoint, headers = self._endpoint_and_headers(request_metadata)
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

    def _stream(
        self,
        payload: dict[str, object],
        messages: list[dict],
        request_metadata: dict[str, str] | None = None,
    ) -> Iterator[ProviderStreamEvent]:
        endpoint, headers = self._endpoint_and_headers(request_metadata)
        collected = ""
        usage = TokenUsage()
        finish_reason = "stop"
        saw_done = False
        current_event = ""
        streamed_tool_calls: dict[int, dict[str, object]] = {}
        streamed_tool_inputs: dict[int, object] = {}
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
                    if event_type == "content_block_start":
                        self._capture_stream_tool_call_start(payload_item, streamed_tool_calls, streamed_tool_inputs)
                    elif event_type == "content_block_delta":
                        delta_payload = payload_item.get("delta", {})
                        delta_type = delta_payload.get("type") if isinstance(delta_payload, dict) else None
                        delta = ""
                        if isinstance(delta_payload, dict) and delta_type in {None, "text_delta"}:
                            delta = str(delta_payload.get("text", ""))
                        if delta:
                            collected += delta
                            yield ProviderStreamEvent(event="delta", delta=delta)
                        if isinstance(delta_payload, dict) and delta_type == "input_json_delta":
                            self._append_stream_tool_call_delta(payload_item, delta_payload, streamed_tool_calls)
                    elif event_type == "message_delta":
                        finish_reason = self._normalize_stop_reason(payload_item.get("delta", {}).get("stop_reason", finish_reason) or finish_reason)
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
        tool_calls = self._finalize_stream_tool_calls(streamed_tool_calls, streamed_tool_inputs)
        yield ProviderStreamEvent(
            event="done",
            finish_reason=finish_reason,
            usage=usage,
            cost=cost,
            tool_calls=tool_calls,
            credential_type="oauth_access_token" if self._settings.anthropic_auth_mode == "bearer" else "api_key",
            auth_source="anthropic_bearer_token" if self._settings.anthropic_auth_mode == "bearer" else "anthropic_api_key",
        )

    @staticmethod
    def _tool_arguments_json(value: object) -> str:
        return json.dumps(value if value is not None else {}, ensure_ascii=True, separators=(",", ":"))

    @staticmethod
    def _stream_block_index(raw_index: object, *, default: int) -> int:
        try:
            return int(raw_index)
        except (TypeError, ValueError):
            return default

    @classmethod
    def _capture_stream_tool_call_start(
        cls,
        payload_item: dict[str, object],
        streamed_tool_calls: dict[int, dict[str, object]],
        streamed_tool_inputs: dict[int, object],
    ) -> None:
        content_block = payload_item.get("content_block", {})
        if not isinstance(content_block, dict) or content_block.get("type") != "tool_use":
            return
        index = cls._stream_block_index(payload_item.get("index"), default=len(streamed_tool_calls))
        current = streamed_tool_calls.setdefault(
            index,
            {
                "id": "",
                "type": "function",
                "function": {"name": "", "arguments": ""},
            },
        )
        if content_block.get("id"):
            current["id"] = str(content_block.get("id"))
        function_payload = current.setdefault("function", {"name": "", "arguments": ""})
        if not isinstance(function_payload, dict):
            function_payload = {"name": "", "arguments": ""}
            current["function"] = function_payload
        if content_block.get("name"):
            function_payload["name"] = str(content_block.get("name"))
        if "input" in content_block:
            streamed_tool_inputs[index] = content_block.get("input")

    @classmethod
    def _append_stream_tool_call_delta(
        cls,
        payload_item: dict[str, object],
        delta_payload: dict[str, object],
        streamed_tool_calls: dict[int, dict[str, object]],
    ) -> None:
        partial_json = delta_payload.get("partial_json")
        if partial_json is None:
            return
        index = cls._stream_block_index(payload_item.get("index"), default=len(streamed_tool_calls))
        current = streamed_tool_calls.setdefault(
            index,
            {
                "id": "",
                "type": "function",
                "function": {"name": "", "arguments": ""},
            },
        )
        function_payload = current.setdefault("function", {"name": "", "arguments": ""})
        if not isinstance(function_payload, dict):
            function_payload = {"name": "", "arguments": ""}
            current["function"] = function_payload
        function_payload["arguments"] = f"{function_payload.get('arguments', '')}{partial_json}"

    @classmethod
    def _finalize_stream_tool_calls(
        cls,
        streamed_tool_calls: dict[int, dict[str, object]],
        streamed_tool_inputs: dict[int, object],
    ) -> list[dict[str, object]]:
        finalized: list[dict[str, object]] = []
        for index in sorted(streamed_tool_calls):
            call = streamed_tool_calls[index]
            function_payload = call.get("function", {})
            raw_arguments = ""
            tool_name = ""
            if isinstance(function_payload, dict):
                raw_arguments = str(function_payload.get("arguments", ""))
                tool_name = str(function_payload.get("name", ""))
            if raw_arguments.strip():
                try:
                    arguments = cls._tool_arguments_json(json.loads(raw_arguments))
                except json.JSONDecodeError:
                    arguments = raw_arguments
            else:
                arguments = cls._tool_arguments_json(streamed_tool_inputs.get(index))
            finalized.append(
                {
                    "id": str(call.get("id", "")),
                    "type": str(call.get("type", "function") or "function"),
                    "function": {
                        "name": tool_name,
                        "arguments": arguments,
                    },
                }
            )
        return finalized

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
                            "arguments": AnthropicAdapter._tool_arguments_json(block.get("input", {})),
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

    @staticmethod
    def _normalize_stop_reason(stop_reason: object) -> str:
        normalized = str(stop_reason or "stop")
        return {
            "end_turn": "stop",
            "stop_sequence": "stop",
            "tool_use": "tool_calls",
            "max_tokens": "length",
        }.get(normalized, normalized)

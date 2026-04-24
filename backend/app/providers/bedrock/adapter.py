"""Amazon Bedrock Converse adapter with honest SigV4 runtime semantics."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
from collections.abc import Iterable, Mapping
from datetime import UTC, datetime
from urllib.parse import parse_qsl, quote, urlsplit

import httpx

from app.providers.base import (
    ChatDispatchRequest,
    ChatDispatchResult,
    ProviderAuthenticationError,
    ProviderBadRequestError,
    ProviderCapabilities,
    ProviderConfigurationError,
    ProviderConflictError,
    ProviderModelNotFoundError,
    ProviderPayloadTooLargeError,
    ProviderProtocolError,
    ProviderRateLimitError,
    ProviderRequestTimeoutError,
    ProviderResourceGoneError,
    ProviderStreamEvent,
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


def _sha256_hex(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _sign(key: bytes, message: str) -> bytes:
    return hmac.new(key, message.encode("utf-8"), hashlib.sha256).digest()


class BedrockAdapter:
    provider_name = "bedrock"

    def __init__(self, settings: Settings):
        self._settings = settings
        self._usage = UsageAccountingService(settings)
        self.capabilities = ProviderCapabilities(
            streaming=False,
            tool_calling=False,
            vision=False,
            external=True,
            discovery_support=False,
            provider_axis="unmapped_native_runtime",
            auth_mechanism="aws_sigv4",
            verify_support=True,
            probe_support=True,
        )

    def is_ready(self) -> bool:
        return self.readiness_reason() is None

    def readiness_reason(self) -> str | None:
        if self._configured_base_url() is None:
            return "FORGEFRAME_BEDROCK_BASE_URL must be an absolute http(s) URL."
        if self._configured_region() is None:
            return "FORGEFRAME_BEDROCK_REGION is required or must be inferrable from FORGEFRAME_BEDROCK_BASE_URL."
        access_key_id, secret_access_key, _session_token = self._resolved_credentials()
        if not access_key_id or not secret_access_key:
            return (
                "Amazon Bedrock requires FORGEFRAME_BEDROCK_ACCESS_KEY_ID and FORGEFRAME_BEDROCK_SECRET_ACCESS_KEY "
                "or ambient AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY credentials."
            )
        return None

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        reason = self.readiness_reason()
        if reason:
            raise ProviderConfigurationError(self.provider_name, reason)
        if request.tools:
            raise ProviderUnsupportedFeatureError(self.provider_name, "tool_calling")

        payload = self._build_payload(request)
        data = self._post(model_id=request.model, payload=payload, request_metadata=request.request_metadata)
        content = self._extract_text_output(data)
        usage = self._usage_from_payload(data.get("usage", {}), request.messages, content)
        cost = self._usage.costs_for_provider(provider=self.provider_name, usage=usage)
        return ChatDispatchResult(
            model=request.model,
            provider=self.provider_name,
            content=content,
            finish_reason=self._normalize_stop_reason(str(data.get("stopReason", "stop") or "stop")),
            usage=usage,
            cost=cost,
            credential_type="aws_sigv4",
            auth_source="bedrock_sigv4",
        )

    def stream_chat_completion(self, request: ChatDispatchRequest) -> Iterable[ProviderStreamEvent]:
        del request
        raise ProviderUnsupportedFeatureError(self.provider_name, "streaming")

    def _resolved_credentials(self) -> tuple[str, str, str]:
        access_key_id = self._settings.bedrock_access_key_id.strip() or os.environ.get("AWS_ACCESS_KEY_ID", "").strip()
        secret_access_key = self._settings.bedrock_secret_access_key.strip() or os.environ.get("AWS_SECRET_ACCESS_KEY", "").strip()
        session_token = self._settings.bedrock_session_token.strip() or os.environ.get("AWS_SESSION_TOKEN", "").strip()
        return access_key_id, secret_access_key, session_token

    def _configured_base_url(self) -> str | None:
        base_url = self._settings.bedrock_base_url.strip()
        parsed = urlsplit(base_url)
        host = parsed.hostname or ""
        if parsed.scheme not in {"http", "https"} or not host or any(char.isspace() for char in host):
            return None
        return base_url.rstrip("/")

    def _configured_region(self) -> str | None:
        explicit = self._settings.bedrock_region.strip()
        if explicit:
            return explicit
        base_url = self._configured_base_url()
        if base_url is None:
            return None
        host = urlsplit(base_url).hostname or ""
        parts = host.split(".")
        if len(parts) >= 4 and parts[0] == "bedrock-runtime":
            return parts[1]
        return None

    def _endpoint(self, model_id: str) -> str:
        encoded_model_id = quote(model_id.strip(), safe="")
        return f"{self._configured_base_url()}/model/{encoded_model_id}/converse"

    @classmethod
    def _stringify_content(cls, value: object) -> str:
        if isinstance(value, str):
            return value
        if isinstance(value, list):
            chunks: list[str] = []
            for item in value:
                if isinstance(item, dict) and item.get("type") in {"text", "input_text"}:
                    chunks.append(str(item.get("text", "")))
                else:
                    chunks.append(json.dumps(item, ensure_ascii=True))
            return "\n".join(chunk for chunk in chunks if chunk.strip())
        if isinstance(value, dict):
            block_type = str(value.get("type", "") or "")
            if block_type in {"text", "input_text"}:
                return str(value.get("text", ""))
            return json.dumps(value, ensure_ascii=True)
        return str(value)

    @classmethod
    def _content_to_bedrock_blocks(cls, value: object) -> list[dict[str, str]]:
        if value is None:
            return []
        if isinstance(value, dict):
            block_type = str(value.get("type", "") or "")
            if block_type in {"text", "input_text"}:
                text = str(value.get("text", ""))
                return [{"text": text}] if text.strip() else []
            if block_type in {"image_url", "input_image"}:
                raise ProviderUnsupportedFeatureError(cls.provider_name, "vision")
            nested_content = value.get("content")
            if isinstance(nested_content, list):
                return cls._content_to_bedrock_blocks(nested_content)
        if isinstance(value, list):
            blocks: list[dict[str, str]] = []
            for item in value:
                blocks.extend(cls._content_to_bedrock_blocks(item))
            return blocks
        text = cls._stringify_content(value)
        return [{"text": text}] if text.strip() else []

    @classmethod
    def _normalize_message(cls, message: Mapping[str, object]) -> tuple[str | None, list[dict[str, str]]]:
        role = str(message.get("role", "user") or "user")
        if role == "system":
            return None, cls._content_to_bedrock_blocks(message.get("content"))
        if role not in {"user", "assistant", "tool"}:
            raise ProviderBadRequestError(cls.provider_name, f"Bedrock does not support message role '{role}'.")
        if role == "tool":
            tool_payload = {
                "tool_call_id": message.get("tool_call_id"),
                "name": message.get("name"),
                "content": message.get("content"),
            }
            return "user", [{"text": json.dumps(tool_payload, ensure_ascii=True)}]
        return role, cls._content_to_bedrock_blocks(message.get("content"))

    def _build_payload(self, request: ChatDispatchRequest) -> dict[str, object]:
        system_blocks: list[dict[str, str]] = []
        messages: list[dict[str, object]] = []
        for raw_message in request.messages:
            role, blocks = self._normalize_message(raw_message)
            if not blocks:
                continue
            if role is None:
                system_blocks.extend(blocks)
                continue
            messages.append({"role": role, "content": blocks})
        if not messages:
            raise ProviderBadRequestError(self.provider_name, "Bedrock requires at least one user or assistant message.")

        payload: dict[str, object] = {"messages": messages}
        if system_blocks:
            payload["system"] = system_blocks

        controls = openai_compatible_response_controls(request.response_controls)
        inference_config: dict[str, object] = {}
        if controls.get("temperature") is not None:
            inference_config["temperature"] = controls["temperature"]
        if controls.get("max_tokens") is not None:
            inference_config["maxTokens"] = controls["max_tokens"]
        if inference_config:
            payload["inferenceConfig"] = inference_config

        metadata = controls.get("metadata")
        if isinstance(metadata, dict) and metadata:
            payload["requestMetadata"] = {
                str(key): str(value)
                for key, value in metadata.items()
                if str(key).strip()
            }
        return payload

    def _post(
        self,
        *,
        model_id: str,
        payload: dict[str, object],
        request_metadata: dict[str, str] | None = None,
    ) -> dict[str, object]:
        endpoint = self._endpoint(model_id)
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        headers = self._signed_headers("POST", endpoint, body, request_metadata=request_metadata)
        try:
            response = httpx.post(endpoint, content=body, headers=headers, timeout=self._settings.bedrock_timeout_seconds)
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError(self.provider_name, f"Bedrock request timed out: {exc}") from exc
        except httpx.RequestError as exc:
            raise ProviderUpstreamError(self.provider_name, f"Bedrock request failed: {exc}") from exc
        self._raise_for_status(response, model_id=model_id)
        headers_map = getattr(response, "headers", {}) or {}
        content_type = str(headers_map.get("content-type", ""))
        if content_type and "json" not in content_type.lower():
            raise ProviderProtocolError(self.provider_name, f"Bedrock returned unexpected content-type '{content_type}'.")
        try:
            data = response.json()
        except ValueError as exc:
            raise ProviderProtocolError(self.provider_name, "Bedrock returned invalid JSON payload.") from exc
        if not isinstance(data, dict):
            raise ProviderProtocolError(self.provider_name, "Bedrock returned a non-object JSON payload.")
        return data

    def _signed_headers(
        self,
        method: str,
        url: str,
        body: bytes,
        *,
        request_metadata: dict[str, str] | None = None,
    ) -> dict[str, str]:
        access_key_id, secret_access_key, session_token = self._resolved_credentials()
        region = self._configured_region()
        if not access_key_id or not secret_access_key or region is None:  # pragma: no cover - guarded by readiness
            raise ProviderConfigurationError(self.provider_name, self.readiness_reason() or "Bedrock is not configured.")

        parsed = urlsplit(url)
        amz_now = datetime.now(tz=UTC)
        amz_date = amz_now.strftime("%Y%m%dT%H%M%SZ")
        date_stamp = amz_now.strftime("%Y%m%d")
        payload_hash = _sha256_hex(body)

        headers: dict[str, str] = {
            "content-type": "application/json",
            "host": parsed.netloc,
            "x-amz-content-sha256": payload_hash,
            "x-amz-date": amz_date,
        }
        if session_token:
            headers["x-amz-security-token"] = session_token
        headers.update(forgeframe_request_metadata_headers(request_metadata))

        canonical_uri = quote(parsed.path or "/", safe="/-_.~")
        canonical_querystring = "&".join(
            f"{quote(str(key), safe='-_.~')}={quote(str(value), safe='-_.~')}"
            for key, value in sorted(parse_qsl(parsed.query, keep_blank_values=True))
        )
        normalized_headers = {
            key.lower(): " ".join(str(value).strip().split())
            for key, value in headers.items()
        }
        signed_header_names = sorted(normalized_headers)
        canonical_headers = "".join(f"{name}:{normalized_headers[name]}\n" for name in signed_header_names)
        signed_headers = ";".join(signed_header_names)
        canonical_request = "\n".join(
            [
                method.upper(),
                canonical_uri,
                canonical_querystring,
                canonical_headers,
                signed_headers,
                payload_hash,
            ]
        )
        credential_scope = f"{date_stamp}/{region}/bedrock/aws4_request"
        string_to_sign = "\n".join(
            [
                "AWS4-HMAC-SHA256",
                amz_date,
                credential_scope,
                _sha256_hex(canonical_request.encode("utf-8")),
            ]
        )
        signing_key = _sign(_sign(_sign(_sign(f"AWS4{secret_access_key}".encode("utf-8"), date_stamp), region), "bedrock"), "aws4_request")
        signature = hmac.new(signing_key, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
        headers["Authorization"] = (
            "AWS4-HMAC-SHA256 "
            f"Credential={access_key_id}/{credential_scope}, "
            f"SignedHeaders={signed_headers}, "
            f"Signature={signature}"
        )
        return headers

    @staticmethod
    def _normalize_stop_reason(reason: str) -> str:
        return {
            "end_turn": "stop",
            "stop_sequence": "stop",
            "max_tokens": "length",
            "tool_use": "tool_calls",
        }.get(reason, reason or "stop")

    @classmethod
    def _extract_text_output(cls, payload: Mapping[str, object]) -> str:
        output = payload.get("output")
        if not isinstance(output, Mapping):
            raise ProviderProtocolError(cls.provider_name, "Bedrock response is missing output.")
        message = output.get("message")
        if not isinstance(message, Mapping):
            raise ProviderProtocolError(cls.provider_name, "Bedrock response is missing output.message.")
        content = message.get("content")
        if not isinstance(content, list):
            raise ProviderProtocolError(cls.provider_name, "Bedrock response is missing output.message.content.")
        chunks: list[str] = []
        for block in content:
            if isinstance(block, Mapping) and block.get("text") is not None:
                chunks.append(str(block.get("text", "")))
        return "".join(chunks)

    @staticmethod
    def _usage_from_payload(payload: object, messages: list[dict], content: str) -> TokenUsage:
        if isinstance(payload, Mapping):
            input_tokens = int(payload.get("inputTokens", 0) or 0)
            output_tokens = int(payload.get("outputTokens", 0) or 0)
            total_tokens = int(payload.get("totalTokens", input_tokens + output_tokens) or (input_tokens + output_tokens))
            return TokenUsage(input_tokens=input_tokens, output_tokens=output_tokens, total_tokens=total_tokens)
        approximate_prompt = sum(len(json.dumps(message, ensure_ascii=True)) for message in messages)
        approximate_completion = len(content)
        return TokenUsage(
            input_tokens=max(1, approximate_prompt // 4),
            output_tokens=max(1, approximate_completion // 4) if content else 0,
            total_tokens=max(1, (approximate_prompt // 4) + (approximate_completion // 4)),
        )

    def _raise_for_status(self, response: httpx.Response, *, model_id: str) -> None:
        if response.status_code < 400:
            return
        message = response.text[:300]
        if response.status_code == 400:
            raise ProviderBadRequestError(self.provider_name, message)
        if response.status_code in {401, 403}:
            raise ProviderAuthenticationError(self.provider_name, message)
        if response.status_code == 404:
            raise ProviderModelNotFoundError(self.provider_name, model=model_id, message=message)
        if response.status_code == 408:
            raise ProviderRequestTimeoutError(self.provider_name, message)
        if response.status_code == 409:
            raise ProviderConflictError(self.provider_name, message)
        if response.status_code == 410:
            raise ProviderResourceGoneError(self.provider_name, message)
        if response.status_code == 413:
            raise ProviderPayloadTooLargeError(self.provider_name, message)
        if response.status_code == 415:
            raise ProviderUnsupportedMediaTypeError(self.provider_name, message)
        if response.status_code == 429:
            raise ProviderRateLimitError(self.provider_name, message)
        if response.status_code in {500, 502, 503, 504}:
            raise ProviderUnavailableError(self.provider_name, message)
        raise ProviderUpstreamError(self.provider_name, message)

"""Internal deterministic baseline provider for phase-5 runtime proof paths."""

import hashlib
import json
from collections.abc import Iterator

from app.providers.base import (
    ChatDispatchRequest,
    ChatDispatchResult,
    EmbeddingDispatchRequest,
    EmbeddingDispatchResult,
    ProviderCapabilities,
    ProviderStreamEvent,
    ProviderUnsupportedFeatureError,
)
from app.settings.config import Settings
from app.usage.service import UsageAccountingService


class ForgeFrameBaselineAdapter:
    provider_name = "forgeframe_baseline"
    capabilities = ProviderCapabilities(streaming=True, tool_calling=False, vision=False, embeddings=True, external=False)

    def __init__(self, settings: Settings | None = None):
        self._settings = settings or Settings()
        self._usage_accounting = UsageAccountingService(self._settings)

    def is_ready(self) -> bool:
        return True

    def readiness_reason(self) -> str | None:
        return None

    def _build_response_text(self, request: ChatDispatchRequest) -> str:
        last_user_text = ""
        for message in reversed(request.messages):
            if message.get("role") == "user":
                content = message.get("content")
                if isinstance(content, str):
                    last_user_text = content.strip()
                else:
                    last_user_text = str(content)
                break

        if not last_user_text:
            last_user_text = "(empty user message)"

        response_format = request.response_controls.get("response_format")
        if isinstance(response_format, dict):
            format_type = str(response_format.get("type", "") or "")
            if format_type == "json_object":
                return json.dumps(
                    {
                        "reply": last_user_text,
                        "provider": self.provider_name,
                        "model": request.model,
                    },
                    ensure_ascii=True,
                    separators=(",", ":"),
                )
            if format_type == "json_schema":
                generated = self._generate_schema_object(response_format, last_user_text)
                return json.dumps(generated, ensure_ascii=True, separators=(",", ":"))

        return f"ForgeFrame baseline response: {last_user_text}"

    def _generate_schema_object(self, schema_payload: object, last_user_text: str) -> object:
        schema: dict[str, object] = {}
        if isinstance(schema_payload, dict):
            candidate = schema_payload.get("schema")
            if isinstance(candidate, dict):
                schema = candidate
            else:
                schema = schema_payload

        schema_type = schema.get("type")
        if schema_type == "array":
            item_schema = schema.get("items")
            return [self._generate_schema_object(item_schema, last_user_text)]
        if schema_type != "object":
            return {"reply": last_user_text}

        properties = schema.get("properties")
        if not isinstance(properties, dict) or not properties:
            return {"reply": last_user_text}

        payload: dict[str, object] = {}
        for key, raw_subschema in properties.items():
            subschema = raw_subschema if isinstance(raw_subschema, dict) else {}
            value_type = str(subschema.get("type", "") or "string")
            if value_type == "string":
                payload[key] = last_user_text if key == "reply" else f"{key}:{last_user_text}"
            elif value_type == "integer":
                payload[key] = 1
            elif value_type == "number":
                payload[key] = 1.0
            elif value_type == "boolean":
                payload[key] = True
            elif value_type == "array":
                item_schema = subschema.get("items")
                payload[key] = [self._generate_schema_object(item_schema, last_user_text)]
            elif value_type == "object":
                payload[key] = self._generate_schema_object(subschema, last_user_text)
            else:
                payload[key] = last_user_text
        return payload

    @staticmethod
    def _stringify_embedding_input(item: object) -> str:
        if isinstance(item, str):
            return item
        if isinstance(item, list):
            return " ".join(str(part) for part in item)
        return str(item)

    @staticmethod
    def _vector_for_text(text: str, *, dimensions: int) -> list[float]:
        digest = hashlib.sha256(text.encode("utf-8")).digest()
        values: list[float] = []
        for index in range(dimensions):
            byte = digest[index % len(digest)]
            values.append(round((byte / 255.0) * 2 - 1, 6))
        return values

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        if getattr(request, "tools", []):
            raise ProviderUnsupportedFeatureError(self.provider_name, "tool_calling")
        completion_text = self._build_response_text(request)
        usage = self._usage_accounting.usage_from_prompt_completion(request.messages, completion_text)
        cost = self._usage_accounting.costs_for_provider(provider=self.provider_name, usage=usage)
        return ChatDispatchResult(
            model=request.model,
            provider=self.provider_name,
            content=completion_text,
            finish_reason="stop",
            usage=usage,
            cost=cost,
            credential_type="internal",
            auth_source="internal",
        )

    def stream_chat_completion(self, request: ChatDispatchRequest) -> Iterator[ProviderStreamEvent]:
        if getattr(request, "tools", []):
            raise ProviderUnsupportedFeatureError(self.provider_name, "tool_calling")
        text = self._build_response_text(request)
        usage = self._usage_accounting.usage_from_prompt_completion(request.messages, text)
        cost = self._usage_accounting.costs_for_provider(provider=self.provider_name, usage=usage)

        for token in text.split(" "):
            yield ProviderStreamEvent(event="delta", delta=f"{token} ")
        yield ProviderStreamEvent(
            event="done",
            finish_reason="stop",
            usage=usage,
            cost=cost,
            credential_type="internal",
            auth_source="internal",
        )

    def create_embeddings(self, request: EmbeddingDispatchRequest) -> EmbeddingDispatchResult:
        dimensions = request.dimensions if isinstance(request.dimensions, int) and request.dimensions > 0 else 16
        embeddings = [
            self._vector_for_text(self._stringify_embedding_input(item), dimensions=dimensions)
            for item in request.input_items
        ]
        joined_input = "\n".join(self._stringify_embedding_input(item) for item in request.input_items)
        usage = self._usage_accounting.usage_from_prompt_completion(
            [{"role": "user", "content": joined_input}],
            "",
        )
        usage = usage.model_copy(update={"output_tokens": 0, "total_tokens": usage.input_tokens})
        cost = self._usage_accounting.costs_for_provider(provider=self.provider_name, usage=usage)
        return EmbeddingDispatchResult(
            model=request.model,
            provider=self.provider_name,
            embeddings=embeddings,
            usage=usage,
            cost=cost,
            credential_type="internal",
            auth_source="internal",
        )

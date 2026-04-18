"""OpenAI API adapter with first real external success path for phase 4."""

from __future__ import annotations

import httpx

from app.providers.base import (
    ChatDispatchRequest,
    ChatDispatchResult,
    ProviderAuthenticationError,
    ProviderBadRequestError,
    ProviderCapabilities,
    ProviderConfigurationError,
    ProviderUpstreamError,
)
from app.settings.config import Settings


class OpenAIAPIAdapter:
    provider_name = "openai_api"
    capabilities = ProviderCapabilities(streaming=False, tool_calling=False, vision=True, external=True)

    def __init__(self, settings: Settings):
        self._settings = settings

    def is_ready(self) -> bool:
        return bool(self._settings.openai_api_key.strip())

    def create_chat_completion(self, request: ChatDispatchRequest) -> ChatDispatchResult:
        if not self.is_ready():
            raise ProviderConfigurationError(
                self.provider_name,
                "FORGEGATE_OPENAI_API_KEY is required for OpenAI API usage.",
            )

        payload = {
            "model": request.model,
            "messages": request.messages,
            "stream": False,
        }

        response_payload = self._post_chat_completion(payload)
        try:
            message = response_payload["choices"][0]["message"]
            content = message.get("content", "")
            finish_reason = response_payload["choices"][0].get("finish_reason", "stop")
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderUpstreamError(self.provider_name, f"Malformed response from OpenAI API: {response_payload}") from exc

        return ChatDispatchResult(
            model=response_payload.get("model", request.model),
            provider=self.provider_name,
            content=content if isinstance(content, str) else str(content),
            finish_reason=finish_reason,
        )

    def _post_chat_completion(self, payload: dict) -> dict:
        base_url = self._settings.openai_api_base_url.rstrip("/")
        endpoint = f"{base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self._settings.openai_api_key}",
            "Content-Type": "application/json",
        }

        try:
            response = httpx.post(
                endpoint,
                json=payload,
                headers=headers,
                timeout=self._settings.openai_timeout_seconds,
            )
        except httpx.RequestError as exc:
            raise ProviderUpstreamError(self.provider_name, f"Network error while calling OpenAI API: {exc}") from exc

        if response.status_code in (401, 403):
            raise ProviderAuthenticationError(self.provider_name, f"OpenAI authentication failed ({response.status_code}).")

        if response.status_code in (400, 404, 422):
            raise ProviderBadRequestError(self.provider_name, f"OpenAI rejected request ({response.status_code}): {response.text[:500]}")

        if response.status_code >= 500:
            raise ProviderUpstreamError(self.provider_name, f"OpenAI upstream error ({response.status_code}): {response.text[:500]}")

        if response.status_code >= 300:
            raise ProviderUpstreamError(self.provider_name, f"Unexpected OpenAI response ({response.status_code}): {response.text[:500]}")

        return response.json()

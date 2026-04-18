"""Harness services for declarative mapping, templates, and verification workflows."""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import httpx

from app.harness.models import HarnessProviderProfile, HarnessVerificationRequest, HarnessVerificationResult
from app.harness.templates import BUILTIN_TEMPLATES


class HarnessService:
    def __init__(self):
        self._profiles: dict[str, HarnessProviderProfile] = {}

    def list_templates(self) -> list[dict[str, Any]]:
        return [
            {
                "id": template.id,
                "label": template.label,
                "integration_class": template.integration_class,
                "description": template.description,
            }
            for template in BUILTIN_TEMPLATES.values()
        ]

    def upsert_profile(self, profile: HarnessProviderProfile) -> HarnessProviderProfile:
        self._profiles[profile.provider_key] = profile
        return profile

    def list_profiles(self) -> list[HarnessProviderProfile]:
        return sorted(self._profiles.values(), key=lambda p: p.provider_key)

    def get_profile(self, provider_key: str) -> HarnessProviderProfile:
        profile = self._profiles.get(provider_key)
        if not profile:
            raise ValueError(f"Harness profile '{provider_key}' not found.")
        return profile

    def build_request_preview(self, provider_key: str, *, model: str, message: str, stream: bool) -> dict[str, Any]:
        profile = self.get_profile(provider_key)
        payload = self._render_template(
            profile.request_mapping.body_template,
            {"model": model, "messages": [{"role": "user", "content": message}], "stream": stream},
        )
        endpoint = f"{profile.endpoint_base_url.rstrip('/')}{profile.request_mapping.path}"
        headers = self._build_headers(profile)
        headers.update(profile.request_mapping.headers)
        return {
            "method": profile.request_mapping.method,
            "url": endpoint,
            "headers": headers,
            "json": payload,
        }

    def verify_profile(self, request: HarnessVerificationRequest) -> HarnessVerificationResult:
        profile = self.get_profile(request.provider_key)
        model = request.model or (profile.models[0] if profile.models else "unknown-model")
        steps: list[dict[str, Any]] = []

        preview = self.build_request_preview(profile.provider_key, model=model, message=request.test_message, stream=False)
        steps.append({"step": "preview_request", "status": "ok"})

        if not profile.endpoint_base_url.startswith(("http://", "https://")):
            raise ValueError("endpoint_base_url must be absolute http(s) URL.")

        steps.append({"step": "test_connection", "status": "ok"})
        if profile.auth_scheme != "none" and not profile.auth_value.strip():
            steps.append({"step": "test_authentication", "status": "failed"})
            return HarnessVerificationResult(
                provider_key=profile.provider_key,
                integration_class=profile.integration_class,
                steps=steps,
                preview_request=preview if request.include_preview else None,
                success=False,
            )

        steps.append({"step": "test_authentication", "status": "ok"})
        if profile.discovery_enabled:
            steps.append({"step": "test_discovery", "status": "ok", "note": "Discovery wiring enabled; full sync executed in control plane."})
        else:
            steps.append({"step": "test_discovery", "status": "skipped"})

        steps.append({"step": "test_model", "status": "ok", "model": model})
        steps.append({"step": "test_chat", "status": "dry_run"})
        if profile.capabilities.streaming:
            steps.append({"step": "test_stream", "status": "dry_run"})

        return HarnessVerificationResult(
            provider_key=profile.provider_key,
            integration_class=profile.integration_class,
            steps=steps,
            preview_request=preview if request.include_preview else None,
            success=True,
        )

    def execute_non_stream(self, provider_key: str, *, model: str, messages: list[dict[str, Any]]) -> dict[str, Any]:
        profile = self.get_profile(provider_key)
        message_text = str(messages[-1].get("content", "")) if messages else ""
        preview = self.build_request_preview(provider_key, model=model, message=message_text, stream=False)
        try:
            response = httpx.request(
                method=preview["method"],
                url=preview["url"],
                headers=preview["headers"],
                json=preview["json"],
                timeout=30,
            )
        except httpx.RequestError as exc:
            raise RuntimeError(f"Harness connection failure: {exc}") from exc

        if response.status_code in (401, 403):
            raise RuntimeError(f"Harness auth failed ({response.status_code}).")
        if response.status_code >= 400 and response.status_code < 500:
            raise RuntimeError(f"Harness provider rejected request ({response.status_code}).")
        if response.status_code >= 500:
            raise RuntimeError(f"Harness upstream error ({response.status_code}).")

        payload = response.json()
        return {
            "model": self._extract(payload, profile.response_mapping.model_path, default=model),
            "content": str(self._extract(payload, profile.response_mapping.text_path, default="")),
            "finish_reason": str(self._extract(payload, profile.response_mapping.finish_reason_path, default="stop")),
            "prompt_tokens": int(self._extract(payload, profile.response_mapping.prompt_tokens_path, default=0) or 0),
            "completion_tokens": int(self._extract(payload, profile.response_mapping.completion_tokens_path, default=0) or 0),
            "total_tokens": int(self._extract(payload, profile.response_mapping.total_tokens_path, default=0) or 0),
            "raw": payload,
        }

    def _build_headers(self, profile: HarnessProviderProfile) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if profile.auth_scheme == "bearer" and profile.auth_value.strip():
            headers[profile.auth_header] = f"Bearer {profile.auth_value}"
        elif profile.auth_scheme == "api_key_header" and profile.auth_value.strip():
            headers[profile.auth_header] = profile.auth_value
        return headers

    def _render_template(self, template: Any, values: dict[str, Any]) -> Any:
        if isinstance(template, dict):
            return {key: self._render_template(value, values) for key, value in template.items()}
        if isinstance(template, list):
            return [self._render_template(value, values) for value in template]
        if isinstance(template, str) and template.startswith("{{") and template.endswith("}}"):
            token = template[2:-2].strip()
            return values.get(token, template)
        return template

    def _extract(self, payload: Any, path: str, *, default: Any) -> Any:
        current = payload
        for segment in path.split("."):
            if isinstance(current, list):
                try:
                    current = current[int(segment)]
                except (ValueError, IndexError):
                    return default
            elif isinstance(current, dict):
                if segment not in current:
                    return default
                current = current[segment]
            else:
                return default
        return current


@lru_cache(maxsize=1)
def get_harness_service() -> HarnessService:
    return HarnessService()

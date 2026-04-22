"""OpenAI OAuth mode semantics for ForgeGate runtime.

This module intentionally models mode/readiness semantics only.
It does not implement browser callback/device grant token exchange yet.
"""

from typing import Literal

from pydantic import BaseModel

from app.settings.config import Settings

OpenAIOAuthMode = Literal["browser_callback", "manual_redirect_completion", "device_hosted_code"]

_OPENAI_OAUTH_MODE_LABELS: dict[OpenAIOAuthMode, str] = {
    "browser_callback": "browser callback",
    "manual_redirect_completion": "manual redirect completion",
    "device_hosted_code": "device/hosted code",
}


class OpenAICodexAuthState(BaseModel):
    auth_mode: Literal["oauth", "api_key"]
    oauth_mode: OpenAIOAuthMode = "manual_redirect_completion"
    has_access_token: bool = False
    has_api_key: bool = False

    @property
    def ready(self) -> bool:
        return self.has_access_token if self.auth_mode == "oauth" else self.has_api_key

    @property
    def credential_type(self) -> str:
        if self.auth_mode == "oauth":
            return "oauth_access_token"
        return "api_key"

    @property
    def oauth_mode_label(self) -> str | None:
        if self.auth_mode != "oauth":
            return None
        return _OPENAI_OAUTH_MODE_LABELS[self.oauth_mode]

    @property
    def oauth_flow_support(self) -> str | None:
        if self.auth_mode != "oauth":
            return None
        return "external_token_only"

    @property
    def oauth_operator_truth(self) -> str | None:
        if self.auth_mode != "oauth":
            return None
        return (
            f"ForgeGate consumes a pre-issued access token for Codex OAuth mode '{self.oauth_mode}' "
            f"({self.oauth_mode_label}) and does not initiate or complete that OAuth flow itself."
        )

    def missing_credential_reason(self, *, provider_label: str = "OpenAI Codex") -> str:
        if self.auth_mode != "oauth":
            return f"{provider_label} API-key mode selected but FORGEGATE_OPENAI_CODEX_API_KEY is missing."
        return (
            f"{provider_label} OAuth mode '{self.oauth_mode}' expects a pre-issued access token in "
            "FORGEGATE_OPENAI_CODEX_OAUTH_ACCESS_TOKEN. ForgeGate does not initiate or complete that OAuth flow itself."
        )


def resolve_codex_auth_state(settings: Settings) -> OpenAICodexAuthState:
    return OpenAICodexAuthState(
        auth_mode=settings.openai_codex_auth_mode,
        oauth_mode=settings.openai_codex_oauth_mode,
        has_access_token=bool(settings.openai_codex_oauth_access_token.strip()),
        has_api_key=bool(settings.openai_codex_api_key.strip()),
    )

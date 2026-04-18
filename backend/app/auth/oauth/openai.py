"""OpenAI OAuth mode semantics for ForgeGate runtime.

This module intentionally models mode/readiness semantics only.
It does not implement browser callback/device grant token exchange yet.
"""

from typing import Literal

from pydantic import BaseModel

from app.settings.config import Settings

OpenAIOAuthMode = Literal["browser_callback", "manual_redirect_completion", "device_hosted_code"]


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


def resolve_codex_auth_state(settings: Settings) -> OpenAICodexAuthState:
    return OpenAICodexAuthState(
        auth_mode=settings.openai_codex_auth_mode,
        oauth_mode=settings.openai_codex_oauth_mode,
        has_access_token=bool(settings.openai_codex_oauth_access_token.strip()),
        has_api_key=bool(settings.openai_codex_api_key.strip()),
    )

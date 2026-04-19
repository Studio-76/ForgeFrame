"""Gemini OAuth/account semantics for beta readiness modeling."""

from typing import Literal

from pydantic import BaseModel

from app.settings.config import Settings

GeminiAuthMode = Literal["oauth", "api_key"]


class GeminiAuthState(BaseModel):
    auth_mode: GeminiAuthMode
    has_access_token: bool = False
    has_api_key: bool = False

    @property
    def ready(self) -> bool:
        return self.has_access_token if self.auth_mode == "oauth" else self.has_api_key

    @property
    def credential_type(self) -> str:
        return "oauth_access_token" if self.auth_mode == "oauth" else "api_key"


def resolve_gemini_auth_state(settings: Settings) -> GeminiAuthState:
    return GeminiAuthState(
        auth_mode=settings.gemini_auth_mode,
        has_access_token=bool(settings.gemini_oauth_access_token.strip()),
        has_api_key=bool(settings.gemini_api_key.strip()),
    )

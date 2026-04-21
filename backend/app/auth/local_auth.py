"""Local auth helpers for ForgeGate admin and runtime security."""

from __future__ import annotations

import hashlib
import secrets
from hmac import compare_digest

from app.governance.models import AdminRole

_ROLE_ORDER: dict[AdminRole, int] = {
    "viewer": 0,
    "operator": 1,
    "admin": 2,
}


def new_secret_salt() -> str:
    return secrets.token_hex(16)


def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 200_000).hex()


def verify_password(password: str, *, salt: str, expected_hash: str) -> bool:
    return compare_digest(hash_password(password, salt), expected_hash)


def issue_session_token() -> str:
    return f"fgas_{secrets.token_urlsafe(32)}"


def issue_runtime_key_token() -> str:
    return f"fgk_{secrets.token_urlsafe(32)}"


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def role_allows(actual_role: AdminRole, required_role: AdminRole) -> bool:
    return _ROLE_ORDER[actual_role] >= _ROLE_ORDER[required_role]

"""Lightweight response-cache header middleware for read-heavy endpoints.

Adds ``Cache-Control: public, max-age=N, stale-while-revalidate=M`` headers
to GET / HEAD / OPTIONS responses.  Mutating endpoints (POST, PUT, PATCH,
DELETE) are not cached.

Enable via ``FORGEFRAME_RESPONSE_CACHE_SECONDS`` (default: 0 = disabled).
"""

from __future__ import annotations

import os
from typing import Any


def _cache_max_age() -> int:
    """Read cache TTL from environment (seconds).

    :returns: Cache-Control max-age in seconds, 0 if disabled.
    """
    raw = os.environ.get("FORGEFRAME_RESPONSE_CACHE_SECONDS", "0").strip()
    try:
        return max(0, int(raw))
    except (ValueError, TypeError):
        return 0


_CACHE_SECONDS: int = _cache_max_age()
_CACHE_ENABLED: bool = _CACHE_SECONDS > 0
_CACHE_HEADER_VALUE: str = f"public, max-age={_CACHE_SECONDS}, stale-while-revalidate={_CACHE_SECONDS * 2}"

_CACHEABLE_METHODS: frozenset[str] = frozenset({"GET", "HEAD", "OPTIONS"})
_NO_CACHE_HEADER: str = "no-store"


class ResponseCacheMiddleware:
    """ASGI middleware that adds Cache-Control headers to cacheable responses.

    Only adds headers when the response status is 2xx or 3xx and the request
    method is cacheable.  Purely additive — never strips existing headers.
    """

    def __init__(self, app: Any) -> None:
        self.app = app

    async def __call__(self, scope: Any, receive: Any, send: Any) -> None:
        if not _CACHE_ENABLED or scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "").upper()

        async def _send(message: Any) -> None:
            if message["type"] == "http.response.start":
                status = message.get("status", 200)
                headers: list[tuple[bytes, bytes]] = message.get("headers", [])
                existing = [h for h in headers if h[0] == b"cache-control"]
                if not existing and 200 <= status < 400 and method in _CACHEABLE_METHODS:
                    headers.append((b"cache-control", _CACHE_HEADER_VALUE.encode("ascii")))
                    message["headers"] = headers
            await send(message)

        await self.app(scope, receive, _send)


def response_cache_enabled() -> bool:
    """Whether response caching is enabled."""
    return _CACHE_ENABLED

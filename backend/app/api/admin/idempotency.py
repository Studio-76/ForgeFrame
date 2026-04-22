"""Shared idempotency-boundary helpers for admin routes."""

from __future__ import annotations

from fastapi import Request, status
from fastapi.responses import JSONResponse

from app.idempotency import get_request_envelope


def admin_error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"type": error_type, "message": message}})


def unsupported_idempotency_response(request: Request, *, message: str) -> JSONResponse | None:
    envelope = get_request_envelope(request)
    if envelope.idempotency_key is None:
        return None
    return admin_error(status.HTTP_400_BAD_REQUEST, "idempotency_not_supported", message)

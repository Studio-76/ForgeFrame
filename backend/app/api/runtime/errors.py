"""Public runtime error helpers for OpenAI-compatible client responses."""

from __future__ import annotations

from app.governance.errors import RuntimeAuthorizationError

_RUNTIME_AUTH_MESSAGES: dict[str, str] = {
    "forbidden": "Runtime key is not permitted to access this route.",
    "gateway_account_inactive": "Runtime key cannot access runtime APIs in its current state.",
    "invalid_runtime_key": "Runtime key is invalid or expired.",
    "missing_bearer": "Runtime requests must use Authorization: Bearer <api-key>.",
    "provider_not_allowed": "Requested model is not available for this runtime key.",
    "request_path_blocked": "Runtime request path is blocked for this API key.",
    "request_path_review_required": "Runtime request path requires review before execution.",
    "runtime_key_unbound": "Runtime key must be bound to a gateway account before it can access runtime APIs.",
    "runtime_auth_required": "Runtime authentication is required.",
}

_PUBLIC_RUNTIME_ERROR_CODE_MAP: dict[str, str] = {
    "background_admission_failed": "dispatch_blocked",
    "routing_budget_exceeded": "budget_exceeded",
    "routing_circuit_open": "circuit_open",
    "routing_no_candidate": "dispatch_blocked",
}

_PROVIDER_ERROR_MESSAGES: dict[str, str] = {
    "budget_exceeded": "Routing is blocked by the current ForgeFrame budget posture.",
    "circuit_open": "Routing is blocked because the relevant ForgeFrame target circuits are open.",
    "dispatch_blocked": "ForgeFrame could not admit this request onto any policy-compliant runtime path.",
    "queue_timeout": "ForgeFrame could not complete queue admission within the allowed window.",
    "provider_authentication_error": "Selected provider rejected ForgeFrame credentials.",
    "provider_bad_request": "Selected provider rejected the request.",
    "provider_configuration_error": "Selected provider is not configured for runtime use.",
    "provider_conflict": "Selected provider reported a request conflict.",
    "provider_model_not_found": "Selected provider could not find the requested model.",
    "provider_not_implemented": "Selected provider does not support this runtime operation.",
    "provider_not_ready": "Selected provider is not ready for runtime use.",
    "provider_payload_too_large": "Selected provider rejected the request payload as too large.",
    "provider_protocol_error": "Selected provider returned an invalid response.",
    "provider_rate_limited": "Selected provider rate limited the request.",
    "provider_request_timeout": "Selected provider request timed out.",
    "provider_resource_gone": "Selected provider reported that the requested resource is gone.",
    "provider_stream_interrupted": "Selected provider stream was interrupted.",
    "provider_timeout": "Selected provider timed out while processing the request.",
    "provider_unavailable": "Selected provider is temporarily unavailable.",
    "provider_unsupported_feature": "Requested runtime feature is not supported by the selected provider.",
    "provider_unsupported_media_type": "Selected provider rejected the request media type.",
    "provider_upstream_error": "Selected provider failed while processing the request.",
    "provider_validation_error": "Selected provider rejected the request payload.",
}


def public_runtime_error_code(error_type: str | None) -> str | None:
    if error_type is None:
        return None
    return _PUBLIC_RUNTIME_ERROR_CODE_MAP.get(error_type, error_type)


def public_runtime_auth_message(error_type: str | None) -> str:
    if error_type:
        return _RUNTIME_AUTH_MESSAGES.get(error_type, "Runtime request is not authorized.")
    return "Runtime request is not authorized."


def public_runtime_provider_message(error_type: str | None) -> str:
    normalized_error_type = public_runtime_error_code(error_type)
    if normalized_error_type:
        return _PROVIDER_ERROR_MESSAGES.get(normalized_error_type, "Selected provider failed while processing the request.")
    return "Selected provider failed while processing the request."


def public_runtime_exception_message(exc: Exception) -> str:
    if isinstance(exc, RuntimeAuthorizationError):
        return public_runtime_auth_message(exc.error_type)
    error_type = getattr(exc, "error_type", None)
    if isinstance(error_type, str):
        return public_runtime_provider_message(error_type)
    return public_runtime_provider_message(None)


def public_background_error_type(exc: Exception) -> str:
    error_text = str(exc).lower()
    if isinstance(exc, TimeoutError) or "timed out" in error_text or "timeout" in error_text:
        return "queue_timeout"
    return "dispatch_blocked"

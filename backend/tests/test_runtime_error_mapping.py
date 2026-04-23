from fastapi import status

from app.api.runtime.chat import _provider_exception_to_http
from app.api.runtime.errors import public_background_error_type, public_runtime_provider_message
from app.core.routing import RoutingBudgetExceededError, RoutingCircuitOpenError, RoutingNoCandidateError


def test_runtime_routing_errors_map_to_public_contract_codes() -> None:
    budget_status, budget_code, _, budget_message, budget_extra = _provider_exception_to_http(
        RoutingBudgetExceededError("budget posture")
    )
    assert budget_status == status.HTTP_429_TOO_MANY_REQUESTS
    assert budget_code == "budget_exceeded"
    assert budget_message == public_runtime_provider_message("budget_exceeded")
    assert budget_extra["retryable"] is False

    circuit_status, circuit_code, _, circuit_message, circuit_extra = _provider_exception_to_http(
        RoutingCircuitOpenError("circuits open")
    )
    assert circuit_status == status.HTTP_503_SERVICE_UNAVAILABLE
    assert circuit_code == "circuit_open"
    assert circuit_message == public_runtime_provider_message("circuit_open")
    assert circuit_extra["retryable"] is True

    dispatch_status, dispatch_code, _, dispatch_message, dispatch_extra = _provider_exception_to_http(
        RoutingNoCandidateError("no candidate")
    )
    assert dispatch_status == status.HTTP_503_SERVICE_UNAVAILABLE
    assert dispatch_code == "dispatch_blocked"
    assert dispatch_message == public_runtime_provider_message("dispatch_blocked")
    assert dispatch_extra == {}


def test_background_admission_errors_map_timeout_separately() -> None:
    assert public_background_error_type(TimeoutError("queue timed out")) == "queue_timeout"
    assert public_background_error_type(RuntimeError("background insert failed")) == "dispatch_blocked"

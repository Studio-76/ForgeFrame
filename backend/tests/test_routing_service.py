from app.control_plane import RoutingBudgetScopeRecord, RoutingBudgetStateRecord, RoutingCircuitStateRecord
from app.core.model_registry import ModelRegistry
from app.core.routing import (
    RoutingBudgetExceededError,
    RoutingCircuitOpenError,
    RoutingService,
)
from app.providers import ProviderRegistry
from app.providers.base import ChatDispatchResult
from app.settings.config import Settings, get_settings
from app.usage.analytics import ClientIdentity, get_usage_analytics_store
from app.usage.models import CostBreakdown, TokenUsage


def _routing_settings(**overrides: object) -> Settings:
    return Settings(
        default_model="forgeframe-baseline-chat-v1",
        default_provider="forgeframe_baseline",
        openai_api_enabled=True,
        openai_api_key="test-key",
        openai_codex_enabled=False,
        gemini_enabled=False,
        anthropic_enabled=False,
        generic_harness_enabled=False,
        ollama_enabled=False,
        **overrides,
    )


def _build_routing(settings: Settings) -> tuple[ModelRegistry, RoutingService]:
    registry = ModelRegistry(settings)
    providers = ProviderRegistry(settings)
    routing = RoutingService(registry, providers, settings)
    return registry, routing


def _persist_state(registry: ModelRegistry, mutator) -> None:
    state = registry._state.model_copy(deep=True)  # type: ignore[attr-defined]
    mutator(state)
    registry._state_repository.save_state(state)  # type: ignore[attr-defined]


def _load_state(registry: ModelRegistry, settings: Settings):
    return registry._state_repository.load_state(settings.bootstrap_tenant_id)  # type: ignore[attr-defined]


def test_routing_service_prefers_local_simple_lane_with_explainability() -> None:
    settings = _routing_settings()
    _, routing = _build_routing(settings)

    decision = routing.resolve_model(
        None,
        messages=[{"role": "user", "content": "Give me a short summary."}],
    )

    assert decision.classification == "simple"
    assert decision.policy_stage == "preferred"
    assert decision.execution_lane == "sync_interactive"
    assert decision.fallback_used is False
    assert decision.resolved_target.provider == "forgeframe_baseline"
    assert "default_simple_path" in decision.classification_rules
    assert decision.structured_explainability["selected_target"] == decision.resolved_target.target_key
    selected = next(candidate for candidate in decision.considered_candidates if candidate.selected)
    assert selected.target_key == decision.resolved_target.target_key
    assert selected.stage_eligible is True


def test_routing_service_prefers_queue_eligible_external_target_for_non_simple_requests() -> None:
    settings = _routing_settings()
    _, routing = _build_routing(settings)

    decision = routing.resolve_model(
        None,
        messages=[{"role": "user", "content": "Refactor this workflow."}],
        tools=[{"type": "function", "function": {"name": "plan"}}],
    )

    assert decision.classification == "non_simple"
    assert decision.policy_stage == "preferred"
    assert decision.execution_lane == "queued_background"
    assert decision.fallback_used is False
    assert decision.resolved_target.provider == "openai_api"
    assert "tool_calling_requires_non_simple" in decision.classification_rules
    selected = next(candidate for candidate in decision.considered_candidates if candidate.selected)
    assert selected.target_key == decision.resolved_target.target_key
    assert "non_simple_queue_match" in selected.reasons


def test_routing_service_uses_fallback_stage_when_preferred_non_simple_target_is_circuited() -> None:
    settings = _routing_settings()
    registry, _ = _build_routing(settings)

    def _mutate(state) -> None:
        non_simple_policy = next(
            policy for policy in state.routing_policies if policy.classification == "non_simple"
        )
        non_simple_policy.preferred_target_keys = ["openai_api::gpt-4.1-mini"]
        non_simple_policy.fallback_target_keys = ["openai_api::gpt-4.1"]
        non_simple_policy.escalation_target_keys = []
        state.routing_circuits = [
            RoutingCircuitStateRecord(
                target_key="openai_api::gpt-4.1-mini",
                state="open",
                reason="operator_test_open",
            )
        ]

    _persist_state(registry, _mutate)
    _, routing = _build_routing(settings)

    decision = routing.resolve_model(
        None,
        messages=[
            {"role": "user", "content": "step one"},
            {"role": "assistant", "content": "step two"},
            {"role": "user", "content": "step three"},
            {"role": "assistant", "content": "step four"},
            {"role": "user", "content": "step five"},
            {"role": "assistant", "content": "step six"},
        ],
    )

    assert decision.classification == "non_simple"
    assert decision.policy_stage == "fallback"
    assert decision.execution_lane == "queued_background"
    assert decision.fallback_used is True
    assert decision.resolved_target.provider == "openai_api"
    assert decision.resolved_target.target_key == "openai_api::gpt-4.1"
    preferred_candidate = next(
        candidate
        for candidate in decision.considered_candidates
        if candidate.target_key == "openai_api::gpt-4.1-mini"
    )
    assert "circuit_open:operator_test_open" in preferred_candidate.exclusion_reasons
    fallback_candidate = next(candidate for candidate in decision.considered_candidates if candidate.selected)
    assert fallback_candidate.target_key == decision.resolved_target.target_key


def test_routing_service_blocks_on_hard_budget_and_persists_blocked_decision() -> None:
    settings = _routing_settings()
    registry, _ = _build_routing(settings)

    _persist_state(
        registry,
        lambda state: setattr(
            state,
            "routing_budget_state",
            RoutingBudgetStateRecord(
                hard_blocked=True,
                blocked_cost_classes=[],
                reason="operator_budget_freeze",
            ),
        ),
    )
    registry, routing = _build_routing(settings)

    try:
        routing.resolve_model(
            None,
            messages=[{"role": "user", "content": "Budget should block this request."}],
        )
    except RoutingBudgetExceededError as exc:
        assert "budget posture" in str(exc)
    else:
        raise AssertionError("Expected routing budget hard block to raise.")

    stored = _load_state(registry, settings)
    assert stored is not None
    decision = stored.routing_decisions[-1]
    assert decision.error_type == "routing_budget_exceeded"
    assert decision.policy_stage == "blocked"
    assert decision.source == "runtime_dispatch"
    assert decision.structured_details["error_type"] == "routing_budget_exceeded"


def test_routing_service_blocks_requested_model_when_scoped_budget_soft_limit_is_exceeded(monkeypatch, tmp_path) -> None:
    events_path = tmp_path / "observability-events.jsonl"
    monkeypatch.setenv("FORGEFRAME_OBSERVABILITY_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEFRAME_OBSERVABILITY_EVENTS_PATH", str(events_path))
    get_settings.cache_clear()
    get_usage_analytics_store.cache_clear()

    settings = _routing_settings(
        observability_storage_backend="file",
        observability_events_path=str(events_path),
    )
    registry, _ = _build_routing(settings)
    analytics = get_usage_analytics_store()
    analytics.record_non_stream_result(
        ChatDispatchResult(
            model="gpt-4.1-mini",
            provider="openai_api",
            content="prior costly work",
            usage=TokenUsage(input_tokens=12, output_tokens=6, total_tokens=18),
            cost=CostBreakdown(actual_cost=3.5, hypothetical_cost=3.5, avoided_cost=0.0),
        ),
        client=ClientIdentity(tenant_id=settings.bootstrap_tenant_id),
        request_metadata={
            "instance_id": settings.bootstrap_tenant_id,
            "agent_id": "assistant-alpha",
        },
    )

    _persist_state(
        registry,
        lambda state: setattr(
            state,
            "routing_budget_state",
            RoutingBudgetStateRecord(
                hard_blocked=False,
                blocked_cost_classes=[],
                reason="scoped_budget_guardrail",
                scopes=[
                    RoutingBudgetScopeRecord(
                        scope_type="agent",
                        scope_key="assistant-alpha",
                        window="24h",
                        enabled=True,
                        soft_cost_limit=1.0,
                        soft_blocked_cost_classes=["high", "premium"],
                    )
                ],
            ),
        ),
    )
    registry, routing = _build_routing(settings)

    try:
        routing.resolve_model(
            "gpt-4.1-mini",
            route_context={
                "instance_id": settings.bootstrap_tenant_id,
                "agent_id": "assistant-alpha",
            },
        )
    except RoutingBudgetExceededError as exc:
        assert "budget" in str(exc)
    else:
        raise AssertionError("Expected scoped budget posture to block the high-cost requested model.")

    stored = _load_state(registry, settings)
    assert stored is not None
    decision = stored.routing_decisions[-1]
    assert decision.error_type == "routing_budget_exceeded"
    assert decision.raw_details["selection_basis"]["budget_matching_scopes"][0]["scope_key"] == "assistant-alpha"
    assert decision.raw_details["selection_basis"]["blocked_cost_classes"] == ["high", "premium"]

    get_settings.cache_clear()
    get_usage_analytics_store.cache_clear()


def test_routing_service_raises_circuit_error_for_requested_model_when_only_target_is_open() -> None:
    settings = _routing_settings()
    registry, _ = _build_routing(settings)

    _persist_state(
        registry,
        lambda state: setattr(
            state,
            "routing_circuits",
            [
                RoutingCircuitStateRecord(
                    target_key="openai_api::gpt-4.1-mini",
                    state="open",
                    reason="manual_breaker",
                )
            ],
        ),
    )
    registry, routing = _build_routing(settings)

    try:
        routing.resolve_model("gpt-4.1-mini")
    except RoutingCircuitOpenError as exc:
        assert "open circuits" in str(exc)
    else:
        raise AssertionError("Expected routing circuit-open failure for requested model.")

    stored = _load_state(registry, settings)
    assert stored is not None
    decision = stored.routing_decisions[-1]
    assert decision.requested_model == "gpt-4.1-mini"
    assert decision.error_type == "routing_circuit_open"
    assert decision.policy_stage == "blocked"

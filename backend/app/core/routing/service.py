"""Routing service baseline for phase-3 ForgeGate core."""

from app.core.model_registry.models import RuntimeModel
from app.core.model_registry import ModelRegistry
from app.core.routing.types import RouteCandidate, RouteDecision
from app.providers import ProviderRegistry
from app.settings.config import Settings
from app.storage.control_plane_repository import (
    ControlPlaneStateRepository,
    get_control_plane_state_repository,
)


class RoutingService:
    def __init__(
        self,
        registry: ModelRegistry,
        providers: ProviderRegistry,
        settings: Settings,
        state_repository: ControlPlaneStateRepository | None = None,
    ):
        self._registry = registry
        self._providers = providers
        self._settings = settings
        self._state_repository = state_repository or get_control_plane_state_repository(settings)

    def _health_index(self) -> dict[tuple[str, str], str]:
        state = self._state_repository.load_state()
        if not state:
            return {}
        return {
            (record.provider, record.model): record.status
            for record in state.health_records
        }

    @staticmethod
    def _cost_score(provider: str) -> int:
        return {
            "forgegate_baseline": 95,
            "ollama": 90,
            "generic_harness": 70,
            "gemini": 65,
            "openai_codex": 60,
            "openai_api": 45,
            "anthropic": 40,
        }.get(provider, 50)

    @staticmethod
    def _quality_score(provider: str) -> int:
        return {
            "openai_api": 95,
            "openai_codex": 90,
            "gemini": 84,
            "anthropic": 82,
            "generic_harness": 70,
            "ollama": 60,
            "forgegate_baseline": 35,
        }.get(provider, 50)

    @staticmethod
    def _latency_score(provider: str) -> int:
        return {
            "forgegate_baseline": 95,
            "ollama": 85,
            "generic_harness": 65,
            "openai_api": 60,
            "openai_codex": 58,
            "gemini": 56,
            "anthropic": 54,
        }.get(provider, 50)

    @staticmethod
    def _health_score(status: str) -> int:
        return {
            "healthy": 35,
            "discovery_only": 20,
            "degraded": 5,
            "unknown": 0,
            "unavailable": -30,
            "auth_failed": -35,
            "not_configured": -40,
            "probe_failed": -25,
        }.get(status, 0)

    @staticmethod
    def _availability_status(*, ready: bool, health_status: str) -> str:
        if not ready:
            return "unavailable"
        if health_status in {"unavailable", "auth_failed", "not_configured"}:
            return "unavailable"
        if health_status in {"probe_failed", "degraded"}:
            return "degraded"
        if health_status == "stale":
            return "stale"
        if health_status in {"healthy", "discovery_only"}:
            return "healthy"
        return "unknown"

    def _provider_status(self, provider: str) -> dict[str, object]:
        try:
            return self._providers.get_provider_status(provider)
        except ValueError:
            return {
                "ready": False,
                "readiness_reason": "provider_disabled_or_not_registered",
                "capabilities": {},
                "oauth_required": False,
                "discovery_supported": False,
            }

    def _evaluate_candidate(
        self,
        model: RuntimeModel,
        *,
        require_streaming: bool,
        require_tool_calling: bool,
        health_index: dict[tuple[str, str], str],
    ) -> RouteCandidate:
        provider_status = self._provider_status(model.provider)
        capabilities = provider_status.get("capabilities", {})
        reasons: list[str] = []
        capability_match = True
        if require_streaming and not capabilities.get("streaming", False):
            capability_match = False
            reasons.append("streaming_missing")
        if require_tool_calling and not capabilities.get("tool_calling", False):
            capability_match = False
            reasons.append("tool_calling_missing")

        health_status = health_index.get((model.provider, model.id), "unknown")
        ready = bool(provider_status.get("ready", False))
        cost_score = self._cost_score(model.provider)
        quality_score = self._quality_score(model.provider)
        latency_score = self._latency_score(model.provider)
        availability_status = self._availability_status(ready=ready, health_status=health_status)
        strategy = getattr(self._settings, "routing_strategy", "balanced")
        weights = {
            "balanced": {"quality": 1.0, "cost": 1.0, "latency": 1.0},
            "quality": {"quality": 1.5, "cost": 0.6, "latency": 0.8},
            "cost": {"quality": 0.7, "cost": 1.5, "latency": 0.9},
        }.get(strategy, {"quality": 1.0, "cost": 1.0, "latency": 1.0})
        score = 0
        if model.id == self._settings.default_model:
            score += 25
            reasons.append("default_model_preference")
        if model.provider == self._settings.default_provider:
            score += 15
            reasons.append("default_provider_preference")
        if ready:
            score += 30
            reasons.append("provider_ready")
        else:
            score -= 40
            reasons.append(f"provider_not_ready:{provider_status.get('readiness_reason', 'unknown')}")
        score += self._health_score(health_status)
        if health_status != "unknown":
            reasons.append(f"health:{health_status}")
        if capability_match:
            score += 20
        score += int((quality_score // 5) * weights["quality"])
        score += int((cost_score // 10) * weights["cost"])
        score += int((latency_score // 10) * weights["latency"])
        reasons.append(f"routing_strategy:{strategy}")
        reasons.append(f"availability:{availability_status}")

        return RouteCandidate(
            model_id=model.id,
            provider=model.provider,
            ready=ready,
            health_status=health_status,
            availability_status=availability_status,
            capability_match=capability_match,
            cost_score=cost_score,
            quality_score=quality_score,
            latency_score=latency_score,
            score=score,
            reasons=reasons,
        )

    def resolve_model(
        self,
        requested_model: str | None,
        *,
        stream: bool = False,
        tools: list[dict] | None = None,
    ) -> RouteDecision:
        health_index = self._health_index()
        require_tool_calling = bool(tools)
        if requested_model:
            model = self._registry.get_model(requested_model)
            if not model:
                raise ValueError(f"Unknown or inactive model: {requested_model}")
            candidate = self._evaluate_candidate(
                model,
                require_streaming=stream,
                require_tool_calling=require_tool_calling,
                health_index=health_index,
            )
            return RouteDecision(
                requested_model=requested_model,
                resolved_model=model,
                reason="requested_model_strict",
                requirement={"streaming": stream, "tool_calling": require_tool_calling},
                selection_basis={"selected_provider": model.provider, "selected_model": model.id},
                considered_candidates=[candidate],
            )

        candidates = [
            self._evaluate_candidate(
                model,
                require_streaming=stream,
                require_tool_calling=require_tool_calling,
                health_index=health_index,
            )
            for model in self._registry.list_active_models()
        ]
        healthy_states = {"healthy", "discovery_only", "unknown"}
        selectable = [
            candidate
            for candidate in candidates
            if candidate.capability_match
            and candidate.ready
            and (
                (not self._settings.routing_require_healthy and candidate.health_status not in {"unavailable", "auth_failed", "not_configured"})
                or (self._settings.routing_require_healthy and candidate.health_status in healthy_states)
            )
        ]
        if not selectable and self._settings.routing_allow_degraded_fallback:
            selectable = [
                candidate
                for candidate in candidates
                if candidate.capability_match and candidate.ready
            ]
        if not selectable:
            selectable = [candidate for candidate in candidates if candidate.capability_match]
        if not selectable:
            raise RuntimeError("No active models satisfy current routing requirements.")

        selected = max(
            selectable,
            key=lambda item: (item.score, item.quality_score, item.cost_score, item.model_id),
        )
        resolved_model = self._registry.get_model(selected.model_id)
        if resolved_model is None:
            raise RuntimeError(f"Resolved model '{selected.model_id}' disappeared from registry.")
        fallback_used = selected.model_id != self._settings.default_model
        return RouteDecision(
            requested_model=None,
            resolved_model=resolved_model,
            reason="smart_default_fallback" if fallback_used else "default_model",
            fallback_used=fallback_used,
            requirement={"streaming": stream, "tool_calling": require_tool_calling},
            selection_basis={
                "selected_provider": resolved_model.provider,
                "selected_model": resolved_model.id,
                "default_model": self._settings.default_model,
                "default_provider": self._settings.default_provider,
                "routing_strategy": self._settings.routing_strategy,
                "routing_require_healthy": self._settings.routing_require_healthy,
                "routing_allow_degraded_fallback": self._settings.routing_allow_degraded_fallback,
            },
            considered_candidates=sorted(
                candidates,
                key=lambda item: (item.score, item.quality_score, item.cost_score, item.model_id),
                reverse=True,
            ),
        )

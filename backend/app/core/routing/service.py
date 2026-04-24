"""Smart Execution Routing service with deterministic classification and explainability."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from app.control_plane import (
    ControlPlaneStateRecord,
    RoutingBudgetStateRecord,
    RoutingCircuitStateRecord,
    RoutingDecisionCandidateRecord,
    RoutingDecisionRecord,
    RoutingPolicyRecord,
)
from app.control_plane.routing_budget import evaluate_routing_budget_state
from app.control_plane.routing_defaults import (
    build_default_routing_policies,
    merge_routing_circuits,
    merge_routing_policies,
    normalize_routing_budget_state,
)
from app.core.classifier import ClassificationResult, classify_request
from app.core.model_registry import ModelRegistry
from app.core.model_registry.models import RuntimeModel, RuntimeTarget
from app.core.routing.errors import (
    RoutingBudgetExceededError,
    RoutingCircuitOpenError,
    RoutingNoCandidateError,
)
from app.core.routing.types import RouteCandidate, RouteDecision
from app.providers import ProviderRegistry
from app.settings.config import Settings
from app.storage.control_plane_repository import (
    ControlPlaneStateRepository,
    get_control_plane_state_repository,
)
from app.tenancy import DEFAULT_BOOTSTRAP_TENANT_ID, normalize_tenant_id

_HEALTHY_STATES = {"healthy", "discovery_only", "unknown"}
_UNUSABLE_STATES = {"unavailable", "auth_failed", "not_configured"}
_ROUTING_LEDGER_LIMIT = 100
_COST_CLASS_SCORE = {
    "baseline": 32,
    "low": 28,
    "medium": 18,
    "high": 8,
    "premium": 2,
}
_LATENCY_CLASS_SCORE = {
    "low": 22,
    "medium": 12,
    "high": 4,
}
_QUALITY_SCORE = {
    "openai_api": 95,
    "openai_codex": 90,
    "gemini": 86,
    "anthropic": 88,
    "generic_harness": 70,
    "ollama": 62,
    "forgeframe_baseline": 40,
}


class RoutingService:
    def __init__(
        self,
        registry: ModelRegistry,
        providers: ProviderRegistry,
        settings: Settings,
        state_repository: ControlPlaneStateRepository | None = None,
        *,
        instance_id: str | None = None,
    ):
        self._registry = registry
        self._providers = providers
        self._settings = settings
        self._state_repository = state_repository or get_control_plane_state_repository(settings)
        self._instance_id = normalize_tenant_id(
            instance_id,
            fallback_tenant_id=settings.bootstrap_tenant_id or DEFAULT_BOOTSTRAP_TENANT_ID,
        )

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(tz=UTC).isoformat()

    @staticmethod
    def _is_local_target(target: RuntimeTarget) -> bool:
        return target.product_axis in {"local_providers", "openai_compatible_clients"} or target.auth_type in {
            "internal",
            "local_none",
        }

    @staticmethod
    def _health_score(status: str) -> int:
        return {
            "healthy": 35,
            "discovery_only": 24,
            "degraded": -8,
            "unknown": 4,
            "stale": -18,
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

    def _load_state(self) -> ControlPlaneStateRecord:
        state = self._state_repository.load_state(self._instance_id)
        if state is None:
            state = ControlPlaneStateRecord(instance_id=self._instance_id)
        return self._ensure_routing_state(state)

    def _ensure_routing_state(self, state: ControlPlaneStateRecord) -> ControlPlaneStateRecord:
        default_policies = build_default_routing_policies(state.provider_targets)
        available_target_keys = [target.target_key for target in state.provider_targets]
        merged = state.model_copy(
            update={
                "routing_policies": merge_routing_policies(
                    default_policies,
                    state.routing_policies,
                    available_target_keys=available_target_keys,
                ),
                "routing_budget_state": normalize_routing_budget_state(state.routing_budget_state),
                "routing_circuits": merge_routing_circuits(
                    state.routing_circuits,
                    available_target_keys=available_target_keys,
                ),
            }
        )
        if merged.model_dump(mode="json") != state.model_dump(mode="json"):
            return self._state_repository.save_state(merged)
        return merged

    def _health_index(self, state: ControlPlaneStateRecord) -> dict[tuple[str, str], str]:
        return {
            (record.provider, record.model): record.status
            for record in state.health_records
        }

    def _provider_status(
        self,
        provider: str,
        *,
        status_cache: dict[str, dict[str, object]] | None = None,
    ) -> dict[str, object]:
        if status_cache is not None and provider in status_cache:
            return status_cache[provider]
        try:
            status = self._providers.get_provider_status(provider)
        except ValueError:
            status = {
                "ready": False,
                "readiness_reason": "provider_disabled_or_not_registered",
                "capabilities": {},
                "oauth_required": False,
                "discovery_supported": False,
            }
        if status_cache is not None:
            status_cache[provider] = status
        return status

    def _target_dispatchability(
        self,
        target: RuntimeTarget,
        *,
        require_streaming: bool,
        require_tool_calling: bool,
        require_vision: bool,
        require_embeddings: bool = False,
    ) -> tuple[bool, str | None]:
        try:
            adapter = self._providers.get(target.provider)
        except ValueError:
            return False, "provider_disabled_or_not_registered"
        dispatchability_check = getattr(adapter, "can_dispatch_model", None)
        if not callable(dispatchability_check):
            return True, None
        try:
            result = dispatchability_check(
                target.model_id,
                require_streaming=require_streaming,
                require_tool_calling=require_tool_calling,
                require_vision=require_vision,
                require_embeddings=require_embeddings,
            )
        except Exception:
            return False, "dispatchability_check_failed"
        if isinstance(result, tuple):
            can_dispatch, reason = result
            return bool(can_dispatch), reason
        return bool(result), None

    @staticmethod
    def _policy_for_classification(
        state: ControlPlaneStateRecord,
        classification_label: str,
    ) -> RoutingPolicyRecord:
        for policy in state.routing_policies:
            if policy.classification == classification_label:
                return policy
        return next(
            policy for policy in build_default_routing_policies(state.provider_targets)
            if policy.classification == classification_label
        )

    @staticmethod
    def _circuit_map(state: ControlPlaneStateRecord) -> dict[str, RoutingCircuitStateRecord]:
        return {circuit.target_key: circuit for circuit in state.routing_circuits}

    @staticmethod
    def _capability_match(exclusion_reasons: list[str]) -> bool:
        prefixes = (
            "streaming_missing",
            "tool_calling_missing",
            "vision_missing",
            "embeddings_missing",
            "model_dispatch_unavailable",
            "non_simple_capability_floor_not_met",
            "queue_eligibility_required",
        )
        return not any(
            reason == "target_disabled" or reason.startswith(prefixes)
            for reason in exclusion_reasons
        )

    def _evaluate_candidate(
        self,
        target: RuntimeTarget,
        *,
        classification: ClassificationResult,
        policy: RoutingPolicyRecord,
        budget_state: RoutingBudgetStateRecord,
        circuit_map: dict[str, RoutingCircuitStateRecord],
        require_streaming: bool,
        require_tool_calling: bool,
        require_vision: bool,
        required_capabilities: set[str] | None,
        health_index: dict[tuple[str, str], str],
        status_cache: dict[str, dict[str, object]] | None = None,
        strict_requested_model: bool = False,
    ) -> RouteCandidate:
        provider_status = self._provider_status(target.provider, status_cache=status_cache)
        ready = bool(provider_status.get("ready", False))
        health_status = health_index.get((target.provider, target.model_id), target.health_status or "unknown")
        availability_status = self._availability_status(ready=ready, health_status=health_status)
        reasons: list[str] = [f"classification:{classification.label}"]
        exclusion_reasons: list[str] = []

        if require_streaming and not target.stream_capable:
            exclusion_reasons.append("streaming_missing")
        if require_tool_calling and not target.tool_capable:
            exclusion_reasons.append("tool_calling_missing")
        if require_vision and not target.vision_capable:
            exclusion_reasons.append("vision_missing")
        for capability in sorted(required_capabilities or set()):
            provider_capability = bool(provider_status.get("capabilities", {}).get(capability, False))
            target_capability = bool(target.technical_capabilities.get(capability, False))
            model_capability = bool(target.model.capabilities.get(capability, False))
            if not (provider_capability or target_capability or model_capability):
                exclusion_reasons.append(f"{capability}_missing")
        if not target.enabled:
            exclusion_reasons.append("target_disabled")

        if classification.label == "non_simple" and str(
            target.execution_traits.get("task_complexity_floor", "")
        ) == "simple_only":
            exclusion_reasons.append("non_simple_capability_floor_not_met")

        if policy.require_queue_eligible and not target.queue_eligible:
            exclusion_reasons.append("queue_eligibility_required")

        if not strict_requested_model and not policy.allow_premium and target.cost_class == "premium":
            exclusion_reasons.append("premium_target_policy_blocked")

        blocked_cost_classes = {item.lower() for item in budget_state.blocked_cost_classes}
        if target.cost_class.lower() in blocked_cost_classes:
            exclusion_reasons.append(f"budget_blocked_cost_class:{target.cost_class}")

        circuit = circuit_map.get(target.target_key)
        if circuit is not None and circuit.state == "open":
            exclusion_reasons.append(f"circuit_open:{circuit.reason or 'operator_open'}")

        dispatchable, dispatch_reason = self._target_dispatchability(
            target,
            require_streaming=require_streaming,
            require_tool_calling=require_tool_calling,
            require_vision=require_vision,
            require_embeddings=bool(required_capabilities and "embeddings" in required_capabilities),
        )
        if not dispatchable:
            exclusion_reasons.append(f"model_dispatch_unavailable:{dispatch_reason or 'unknown'}")

        if not ready:
            exclusion_reasons.append(
                f"provider_not_ready:{provider_status.get('readiness_reason', 'unknown')}"
            )
        if self._settings.routing_require_healthy:
            if health_status not in _HEALTHY_STATES:
                exclusion_reasons.append(f"health_gate_failed:{health_status}")
        elif health_status in _UNUSABLE_STATES:
            exclusion_reasons.append(f"health_unusable:{health_status}")

        score = target.priority
        reasons.append(f"target_priority:{target.priority}")
        score += _QUALITY_SCORE.get(target.provider, 50) // 3
        reasons.append(f"quality_profile:{target.provider}")
        score += self._health_score(health_status)
        if health_status != "unknown":
            reasons.append(f"health:{health_status}")
        if ready:
            score += 30
            reasons.append("provider_ready")

        if self._is_local_target(target):
            if policy.prefer_local:
                score += 28
                reasons.append("policy_prefers_local")
            else:
                score += 4
        if policy.prefer_low_latency:
            score += _LATENCY_CLASS_SCORE.get(target.latency_class, 8)
            reasons.append(f"economic_profile_latency:{target.latency_class}")
        else:
            score += _COST_CLASS_SCORE.get(target.cost_class, 8)
            reasons.append(f"economic_profile_cost:{target.cost_class}")
        if classification.label == "simple" and target.cost_class in {"baseline", "low"}:
            score += 12
            reasons.append("simple_cost_floor_match")
        if classification.label == "non_simple" and target.queue_eligible:
            score += 10
            reasons.append("non_simple_queue_match")

        return RouteCandidate(
            target_key=target.target_key,
            model_id=target.model_id,
            provider=target.provider,
            label=target.label,
            priority=target.priority,
            ready=ready,
            health_status=health_status,
            availability_status=availability_status,
            queue_eligible=target.queue_eligible,
            cost_class=target.cost_class,
            latency_class=target.latency_class,
            capability_match=self._capability_match(exclusion_reasons),
            stage_eligible=False,
            selected=False,
            cost_score=_COST_CLASS_SCORE.get(target.cost_class, 8),
            quality_score=_QUALITY_SCORE.get(target.provider, 50),
            latency_score=_LATENCY_CLASS_SCORE.get(target.latency_class, 8),
            score=score,
            exclusion_reasons=exclusion_reasons,
            reasons=reasons,
        )

    @staticmethod
    def _sort_stage_candidates(
        candidates: list[RouteCandidate],
        stage_target_keys: list[str],
    ) -> list[RouteCandidate]:
        order_index = {key: index for index, key in enumerate(stage_target_keys)}
        if not order_index:
            return sorted(
                candidates,
                key=lambda item: (item.score, item.priority, item.quality_score, item.cost_score, item.model_id),
                reverse=True,
            )
        return sorted(
            candidates,
            key=lambda item: (
                -order_index.get(item.target_key, len(order_index)),
                item.score,
                item.priority,
                item.quality_score,
            ),
            reverse=True,
        )

    @staticmethod
    def _stage_candidates(
        candidates: list[RouteCandidate],
        *,
        target_keys: list[str],
        allow_unconfigured: bool,
    ) -> tuple[list[RouteCandidate], list[str]]:
        if not candidates:
            return [], []
        if target_keys:
            eligible_keys = [key for key in target_keys if any(item.target_key == key for item in candidates)]
            return [candidate for candidate in candidates if candidate.target_key in set(eligible_keys)], eligible_keys
        if allow_unconfigured:
            return list(candidates), [candidate.target_key for candidate in candidates]
        return [], []

    def _mark_stage_and_selection(
        self,
        candidates: list[RouteCandidate],
        *,
        stage_keys: list[str],
        selected_key: str | None,
    ) -> list[RouteCandidate]:
        updated: list[RouteCandidate] = []
        eligible_set = set(stage_keys)
        for candidate in candidates:
            payload = candidate.model_copy(
                update={
                    "stage_eligible": candidate.target_key in eligible_set,
                    "selected": candidate.target_key == selected_key,
                }
            )
            updated.append(payload)
        return updated

    def _append_routing_decision(
        self,
        state: ControlPlaneStateRecord,
        decision: RoutingDecisionRecord,
    ) -> None:
        updated_state = state.model_copy(
            update={
                "routing_decisions": [
                    *state.routing_decisions[-(_ROUTING_LEDGER_LIMIT - 1):],
                    decision,
                ]
            }
        )
        self._state_repository.save_state(updated_state)

    def _decision_candidates_payload(
        self,
        candidates: list[RouteCandidate],
    ) -> list[RoutingDecisionCandidateRecord]:
        return [
            RoutingDecisionCandidateRecord(
                target_key=candidate.target_key,
                provider=candidate.provider,
                model_id=candidate.model_id,
                label=candidate.label or f"{candidate.provider}::{candidate.model_id}",
                stage_eligible=candidate.stage_eligible,
                selected=candidate.selected,
                priority=candidate.priority,
                cost_class=candidate.cost_class,
                latency_class=candidate.latency_class,
                availability_status=candidate.availability_status,
                health_status=candidate.health_status,
                queue_eligible=candidate.queue_eligible,
                capability_match=candidate.capability_match,
                exclusion_reasons=list(candidate.exclusion_reasons),
                selection_reasons=list(candidate.reasons),
            )
            for candidate in candidates
        ]

    def _persist_blocked_decision(
        self,
        *,
        state: ControlPlaneStateRecord,
        requested_model: str | None,
        classification: ClassificationResult,
        policy: RoutingPolicyRecord,
        execution_lane: str,
        policy_stage: str,
        summary: str,
        error_type: str,
        candidates: list[RouteCandidate],
        selection_basis: dict[str, object],
        source: str,
    ) -> None:
        decision = RoutingDecisionRecord(
            decision_id=f"route_{uuid4().hex[:12]}",
            source=source,  # type: ignore[arg-type]
            instance_id=self._instance_id,
            requested_model=requested_model,
            selected_target_key=None,
            classification=classification.label,
            classification_summary=classification.summary,
            classification_rules=list(classification.rules),
            policy_stage=policy_stage,  # type: ignore[arg-type]
            execution_lane=execution_lane,  # type: ignore[arg-type]
            summary=summary,
            structured_details={
                "classification": classification.label,
                "policy_stage": policy_stage,
                "error_type": error_type,
                "request_path_policy": selection_basis.get("request_path_policy"),
                "candidate_count": len(candidates),
                "excluded_count": len([candidate for candidate in candidates if candidate.exclusion_reasons]),
            },
            raw_details={
                "policy": policy.model_dump(mode="json"),
                "selection_basis": selection_basis,
            },
            candidates=self._decision_candidates_payload(candidates),
            error_type=error_type,
            created_at=self._now_iso(),
        )
        self._append_routing_decision(state, decision)

    def _finalize_route_decision(
        self,
        *,
        state: ControlPlaneStateRecord,
        requested_model: str | None,
        classification: ClassificationResult,
        policy: RoutingPolicyRecord,
        policy_stage: str,
        selected_candidate: RouteCandidate,
        stage_keys: list[str],
        all_candidates: list[RouteCandidate],
        selection_basis: dict[str, object],
        source: str,
    ) -> RouteDecision:
        resolved_target = self._registry.get_target(selected_candidate.target_key)
        if resolved_target is None:
            raise RoutingNoCandidateError(
                f"Resolved target '{selected_candidate.target_key}' disappeared from registry."
            )
        reason = "requested_model_strict" if requested_model else f"smart_execution_{policy_stage}"
        fallback_used = requested_model is None and policy_stage != "preferred"
        summary = (
            f"{classification.label.replace('_', '-')} routing selected '{resolved_target.target_key}' "
            f"on the {policy_stage} stage."
        )
        if fallback_used:
            summary = (
                f"{classification.label.replace('_', '-')} routing had to leave the preferred path and selected "
                f"'{resolved_target.target_key}' on the {policy_stage} stage."
            )
        enriched_candidates = self._mark_stage_and_selection(
            all_candidates,
            stage_keys=stage_keys,
            selected_key=selected_candidate.target_key,
        )
        decision = RouteDecision(
            decision_id=f"route_{uuid4().hex[:12]}",
            instance_id=self._instance_id,
            requested_model=requested_model,
            resolved_model=resolved_target.model,
            resolved_target=resolved_target,
            reason=reason,
            policy=policy.display_name,
            policy_stage=policy_stage,
            classification=classification.label,
            classification_summary=classification.summary,
            classification_rules=list(classification.rules),
            execution_lane=policy.execution_lane,
            summary=summary,
            fallback_used=fallback_used,
            requirement=selection_basis.get("requirements", {}),
            selection_basis=selection_basis,
            structured_explainability={
                "classification": classification.label,
                "policy_stage": policy_stage,
                "selected_target": resolved_target.target_key,
                "execution_lane": policy.execution_lane,
                "request_path_policy": selection_basis.get("request_path_policy"),
                "fallback_used": fallback_used,
                "candidate_count": len(enriched_candidates),
                "excluded_count": len(
                    [candidate for candidate in enriched_candidates if candidate.exclusion_reasons]
                ),
            },
            raw_explainability={
                "policy": policy.model_dump(mode="json"),
                "selection_basis": selection_basis,
            },
            considered_candidates=enriched_candidates,
            created_at=self._now_iso(),
        )
        self._append_routing_decision(
            state,
            RoutingDecisionRecord(
                decision_id=decision.decision_id,
                source=source,  # type: ignore[arg-type]
                instance_id=self._instance_id,
                requested_model=requested_model,
                selected_target_key=resolved_target.target_key,
                classification=classification.label,
                classification_summary=classification.summary,
                classification_rules=list(classification.rules),
                policy_stage=policy_stage,  # type: ignore[arg-type]
                execution_lane=policy.execution_lane,  # type: ignore[arg-type]
                summary=summary,
                structured_details=decision.structured_explainability,
                raw_details=decision.raw_explainability,
                candidates=self._decision_candidates_payload(enriched_candidates),
                error_type=None,
                created_at=decision.created_at,
            ),
        )
        return decision

    def _candidate_pool(
        self,
        *,
        requested_model: str | None,
        allowed_providers: set[str] | None,
        route_context: dict[str, str] | None = None,
    ) -> list[RuntimeTarget]:
        targets = self._registry.list_active_targets()
        selected_request_path = str((route_context or {}).get("request_path_policy") or "smart_routing").strip().lower()
        pinned_target_key = str((route_context or {}).get("pinned_target_key") or "").strip() or None
        if selected_request_path == "local_only":
            targets = [target for target in targets if self._is_local_target(target)]
        if selected_request_path == "pinned_target":
            if pinned_target_key is None:
                raise RoutingNoCandidateError("Pinned-target runtime path is configured without a target binding.")
            target = self._registry.get_target(pinned_target_key)
            if target is None or not target.enabled:
                raise RoutingNoCandidateError(
                    f"Pinned target '{pinned_target_key}' is not active for this instance."
                )
            targets = [target]
        if allowed_providers is not None:
            targets = [target for target in targets if target.provider in allowed_providers]
        if requested_model is None:
            return targets
        if not self._registry.get_model(requested_model):
            raise ValueError(f"Unknown or inactive model: {requested_model}")
        matching = [target for target in targets if target.model_id == requested_model]
        if not matching:
            raise ValueError(f"No active target is registered for model: {requested_model}")
        return matching

    def _resolve_selectable_candidate(
        self,
        *,
        requested_model: str | None,
        classification: ClassificationResult,
        policy: RoutingPolicyRecord,
        candidates: list[RouteCandidate],
    ) -> tuple[str, list[str], RouteCandidate] | None:
        selectable = [candidate for candidate in candidates if not candidate.exclusion_reasons]
        if not selectable:
            return None
        if requested_model is not None:
            ordered = self._sort_stage_candidates(selectable, [])
            return "requested_model", [candidate.target_key for candidate in ordered], ordered[0]

        preferred_candidates, preferred_keys = self._stage_candidates(
            selectable,
            target_keys=policy.preferred_target_keys,
            allow_unconfigured=True,
        )
        if preferred_candidates:
            ordered = self._sort_stage_candidates(preferred_candidates, preferred_keys)
            return "preferred", preferred_keys, ordered[0]

        if policy.allow_fallback:
            fallback_candidates, fallback_keys = self._stage_candidates(
                selectable,
                target_keys=policy.fallback_target_keys,
                allow_unconfigured=False,
            )
            if fallback_candidates:
                ordered = self._sort_stage_candidates(fallback_candidates, fallback_keys)
                return "fallback", fallback_keys, ordered[0]

        if policy.allow_escalation:
            escalation_candidates, escalation_keys = self._stage_candidates(
                selectable,
                target_keys=policy.escalation_target_keys,
                allow_unconfigured=False,
            )
            if escalation_candidates:
                ordered = self._sort_stage_candidates(escalation_candidates, escalation_keys)
                return "escalation", escalation_keys, ordered[0]

        return None

    def _blocked_error_from_candidates(self, candidates: list[RouteCandidate]) -> tuple[str, str]:
        budget_blocked = any(
            any(reason.startswith("budget_") for reason in candidate.exclusion_reasons)
            for candidate in candidates
        )
        circuit_blocked = any(
            any(reason.startswith("circuit_open:") for reason in candidate.exclusion_reasons)
            for candidate in candidates
        )
        if budget_blocked:
            return (
                "routing_budget_exceeded",
                "Routing is blocked by the current budget posture for this instance.",
            )
        if circuit_blocked:
            return (
                "routing_circuit_open",
                "Routing is blocked because all relevant targets are behind open circuits.",
            )
        return (
            "routing_no_candidate",
            "No active targets satisfy the current routing requirements.",
        )

    def list_runtime_usable_models(
        self,
        *,
        stream: bool = False,
        tools: list[dict] | None = None,
        require_vision: bool = False,
        allowed_providers: set[str] | None = None,
        route_context: dict[str, str] | None = None,
    ) -> list[RuntimeModel]:
        state = self._load_state()
        health_index = self._health_index(state)
        classification = classify_request(
            [],
            tools=tools,
            require_vision=require_vision,
            stream=stream,
        )
        policy = self._policy_for_classification(state, classification.label)
        selected_request_path = str((route_context or {}).get("request_path_policy") or "smart_routing").strip().lower()
        if selected_request_path == "queue_background":
            policy = policy.model_copy(
                update={
                    "execution_lane": "queued_background",
                    "require_queue_eligible": True,
                }
            )
        budget_evaluation = evaluate_routing_budget_state(
            state.routing_budget_state,
            instance_id=self._instance_id,
            route_context=route_context,
        )
        budget_state = budget_evaluation.budget_state.model_copy(
            update={
                "blocked_cost_classes": list(budget_evaluation.blocked_cost_classes),
                "hard_blocked": budget_evaluation.hard_blocked,
            }
        )
        circuit_map = self._circuit_map(state)
        status_cache: dict[str, dict[str, object]] = {}
        usable_models: list[RuntimeModel] = []
        seen_model_ids: set[str] = set()
        candidates: list[tuple[RuntimeTarget, RouteCandidate]] = []
        for target in self._candidate_pool(
            requested_model=None,
            allowed_providers=allowed_providers,
            route_context=route_context,
        ):
            candidate = self._evaluate_candidate(
                target,
                classification=classification,
                policy=policy,
                budget_state=budget_state,
                circuit_map=circuit_map,
                require_streaming=stream,
                require_tool_calling=bool(tools),
                require_vision=require_vision,
                required_capabilities=None,
                health_index=health_index,
                status_cache=status_cache,
                strict_requested_model=False,
            )
            if budget_state.hard_blocked:
                candidate.exclusion_reasons.append("budget_hard_blocked")
            candidates.append((target, candidate))

        ordered_candidates = sorted(
            candidates,
            key=lambda item: (item[1].score, item[1].priority, item[1].quality_score, item[1].cost_score, item[1].model_id),
            reverse=True,
        )
        for target, candidate in ordered_candidates:
            if candidate.exclusion_reasons:
                continue
            if target.model_id in seen_model_ids:
                continue
            usable_models.append(target.model)
            seen_model_ids.add(target.model_id)
        return usable_models

    def resolve_model(
        self,
        requested_model: str | None,
        *,
        messages: list[dict] | None = None,
        stream: bool = False,
        tools: list[dict] | None = None,
        require_vision: bool = False,
        allowed_providers: set[str] | None = None,
        route_context: dict[str, str] | None = None,
        response_controls: dict[str, object] | None = None,
        required_capabilities: set[str] | None = None,
        decision_source: str = "runtime_dispatch",
    ) -> RouteDecision:
        state = self._load_state()
        health_index = self._health_index(state)
        classification = classify_request(
            messages or [],
            tools=tools,
            require_vision=require_vision,
            stream=stream,
            response_controls=response_controls,
        )
        policy = self._policy_for_classification(state, classification.label)
        selected_request_path = str((route_context or {}).get("request_path_policy") or "smart_routing").strip().lower()
        if selected_request_path == "queue_background":
            policy = policy.model_copy(
                update={
                    "execution_lane": "queued_background",
                    "require_queue_eligible": True,
                }
            )
        budget_evaluation = evaluate_routing_budget_state(
            state.routing_budget_state,
            instance_id=self._instance_id,
            route_context=route_context,
        )
        budget_state = budget_evaluation.budget_state.model_copy(
            update={
                "blocked_cost_classes": list(budget_evaluation.blocked_cost_classes),
                "hard_blocked": budget_evaluation.hard_blocked,
            }
        )
        circuit_map = self._circuit_map(state)
        status_cache: dict[str, dict[str, object]] = {}
        target_pool = self._candidate_pool(
            requested_model=requested_model,
            allowed_providers=allowed_providers,
            route_context=route_context,
        )

        all_candidates = [
            self._evaluate_candidate(
                target,
                classification=classification,
                policy=policy,
                budget_state=budget_state,
                circuit_map=circuit_map,
                require_streaming=stream,
                require_tool_calling=bool(tools),
                require_vision=require_vision,
                required_capabilities=required_capabilities,
                health_index=health_index,
                status_cache=status_cache,
                strict_requested_model=requested_model is not None,
            )
            for target in target_pool
        ]
        selection_basis = {
            "requirements": {
                "streaming": stream,
                "tool_calling": bool(tools),
                "vision": require_vision,
                "required_capabilities": sorted(required_capabilities or set()),
            },
            "policy": policy.model_dump(mode="json"),
            "budget_state": budget_state.model_dump(mode="json"),
            "budget_matching_scopes": [
                scope.model_dump(mode="json")
                for scope in budget_evaluation.matching_scopes
            ],
            "budget_anomalies": [
                anomaly.model_dump(mode="json")
                for anomaly in budget_state.anomalies
            ],
            "hard_budget_block_reason": budget_evaluation.hard_block_reason,
            "blocked_cost_classes": list(budget_evaluation.blocked_cost_classes),
            "open_circuits": [
                circuit.model_dump(mode="json")
                for circuit in circuit_map.values()
                if circuit.state == "open"
            ],
            "allowed_providers": sorted(allowed_providers) if allowed_providers is not None else None,
            "route_context": dict(route_context or {}),
            "request_path_policy": selected_request_path,
        }

        if budget_state.hard_blocked:
            blocked_candidates = [
                candidate.model_copy(
                    update={
                        "exclusion_reasons": [*candidate.exclusion_reasons, "budget_hard_blocked"]
                    }
                )
                for candidate in all_candidates
            ]
            summary = "Routing is hard-blocked by the current budget posture."
            if budget_evaluation.hard_block_reason:
                summary = f"{summary} Reason: {budget_evaluation.hard_block_reason}."
            self._persist_blocked_decision(
                state=state,
                requested_model=requested_model,
                classification=classification,
                policy=policy,
                execution_lane=policy.execution_lane,
                policy_stage="blocked",
                summary=summary,
                error_type="routing_budget_exceeded",
                candidates=blocked_candidates,
                selection_basis=selection_basis,
                source=decision_source,
            )
            raise RoutingBudgetExceededError(summary)

        resolved = self._resolve_selectable_candidate(
            requested_model=requested_model,
            classification=classification,
            policy=policy,
            candidates=all_candidates,
        )
        if resolved is None:
            error_type, message = self._blocked_error_from_candidates(all_candidates)
            self._persist_blocked_decision(
                state=state,
                requested_model=requested_model,
                classification=classification,
                policy=policy,
                execution_lane=policy.execution_lane,
                policy_stage="blocked",
                summary=message,
                error_type=error_type,
                candidates=all_candidates,
                selection_basis=selection_basis,
                source=decision_source,
            )
            if error_type == "routing_budget_exceeded":
                raise RoutingBudgetExceededError(message)
            if error_type == "routing_circuit_open":
                raise RoutingCircuitOpenError(message)
            raise RoutingNoCandidateError(message)

        policy_stage, stage_keys, selected_candidate = resolved
        selection_basis.update(
            {
                "policy_stage": policy_stage,
                "stage_target_keys": stage_keys,
                "selected_target": selected_candidate.target_key,
            }
        )
        return self._finalize_route_decision(
            state=state,
            requested_model=requested_model,
            classification=classification,
            policy=policy,
            policy_stage=policy_stage,
            selected_candidate=selected_candidate,
            stage_keys=stage_keys,
            all_candidates=all_candidates,
            selection_basis=selection_basis,
            source=decision_source,
        )

"""Routing policy, simulation, and explainability behavior for the control plane."""

from __future__ import annotations

from datetime import UTC, datetime

from app.api.admin.control_plane_models import (
    RoutingBudgetScopeUpdateRequest,
    RoutingBudgetUpdateRequest,
    RoutingCircuitUpdateRequest,
    RoutingPolicyUpdateRequest,
    RoutingSimulationRequest,
)
from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.control_plane import (
    RoutingBudgetScopeRecord,
    RoutingBudgetStateRecord,
    RoutingCircuitStateRecord,
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
from app.core.model_registry import ModelRegistry
from app.core.routing import (
    RoutingBudgetExceededError,
    RoutingCircuitOpenError,
    RoutingNoCandidateError,
    RoutingService,
)


class ControlPlaneRoutingDomainMixin:
    @staticmethod
    def _routing_now_iso() -> str:
        return datetime.now(tz=UTC).isoformat()

    def _available_target_keys(self) -> list[str]:
        return [target.target_key for target in self.list_provider_targets()]

    def _load_routing_policies(
        self,
        stored_policies: list[RoutingPolicyRecord] | None,
    ) -> dict[str, RoutingPolicyRecord]:
        target_records = self.list_provider_targets()
        policies = merge_routing_policies(
            build_default_routing_policies(target_records),
            stored_policies,
            available_target_keys=self._available_target_keys(),
        )
        return {policy.classification: policy for policy in policies}

    def _load_routing_budget_state(
        self,
        stored_budget: RoutingBudgetStateRecord | None,
    ) -> RoutingBudgetStateRecord:
        return normalize_routing_budget_state(stored_budget)

    def _load_routing_circuits(
        self,
        stored_circuits: list[RoutingCircuitStateRecord] | None,
    ) -> dict[str, RoutingCircuitStateRecord]:
        circuits = merge_routing_circuits(
            stored_circuits,
            available_target_keys=self._available_target_keys(),
        )
        return {circuit.target_key: circuit for circuit in circuits}

    def _load_routing_decisions(
        self,
        stored_decisions: list[RoutingDecisionRecord] | None,
    ) -> list[RoutingDecisionRecord]:
        decisions = list(stored_decisions or [])
        return sorted(decisions, key=lambda item: (item.created_at, item.decision_id))

    def _routing_registry(self) -> ModelRegistry:
        return ModelRegistry(
            self._settings,
            instance_id=self._instance.instance_id,
            state_repository=self._state_repository,
        )

    def _routing_service(self) -> RoutingService:
        return RoutingService(
            self._routing_registry(),
            self._providers,
            self._settings,
            self._state_repository,
            instance_id=self._instance.instance_id,
        )

    def _refresh_routing_state(self) -> None:
        self._routing_policies_state = self._load_routing_policies(
            list(getattr(self, "_routing_policies_state", {}).values()) or None
        )
        self._routing_budget_state = self._load_routing_budget_state(
            getattr(self, "_routing_budget_state", None)
        )
        self._routing_circuits_state = self._load_routing_circuits(
            list(getattr(self, "_routing_circuits_state", {}).values()) or None
        )

    def list_routing_policies(self) -> list[RoutingPolicyRecord]:
        return [
            self._routing_policies_state[key]
            for key in sorted(self._routing_policies_state.keys())
        ]

    def list_routing_circuits(self) -> list[RoutingCircuitStateRecord]:
        return [
            self._routing_circuits_state[key]
            for key in sorted(self._routing_circuits_state.keys())
        ]

    def list_routing_decisions(self, *, limit: int = 20) -> list[RoutingDecisionRecord]:
        decisions = sorted(
            self._routing_decisions_state,
            key=lambda item: (item.created_at, item.decision_id),
            reverse=True,
        )
        return decisions[: max(1, limit)]

    def routing_snapshot(self) -> dict[str, object]:
        policies = self.list_routing_policies()
        circuits = self.list_routing_circuits()
        decisions = self.list_routing_decisions(limit=20)
        open_circuits = [circuit for circuit in circuits if circuit.state == "open"]
        evaluated_budget = evaluate_routing_budget_state(
            self._routing_budget_state,
            instance_id=self._instance.instance_id,
        )
        classification_counts = {
            "simple": len([decision for decision in decisions if decision.classification == "simple"]),
            "non_simple": len([decision for decision in decisions if decision.classification == "non_simple"]),
        }
        return {
            "instance": self._instance.model_dump(mode="json"),
            "policies": [policy.model_dump(mode="json") for policy in policies],
            "budget": evaluated_budget.budget_state.model_dump(mode="json"),
            "circuits": [circuit.model_dump(mode="json") for circuit in circuits],
            "targets": self.provider_target_snapshot(),
            "recent_decisions": [decision.model_dump(mode="json") for decision in decisions],
            "summary": {
                "policy_count": len(policies),
                "open_circuits": len(open_circuits),
                "hard_budget_blocked": evaluated_budget.hard_blocked,
                "blocked_cost_classes": list(evaluated_budget.blocked_cost_classes),
                "budget_scope_count": len(evaluated_budget.budget_state.scopes),
                "budget_anomaly_count": len(evaluated_budget.budget_state.anomalies),
                "budget_matching_scope_count": len(evaluated_budget.matching_scopes),
                "recent_decision_count": len(decisions),
                "classification_counts": classification_counts,
            },
        }

    @staticmethod
    def _budget_scope_record(payload: RoutingBudgetScopeUpdateRequest) -> RoutingBudgetScopeRecord:
        return RoutingBudgetScopeRecord(
            scope_type=payload.scope_type,
            scope_key=payload.scope_key.strip(),
            window=payload.window,
            enabled=payload.enabled,
            soft_cost_limit=payload.soft_cost_limit,
            hard_cost_limit=payload.hard_cost_limit,
            soft_token_limit=payload.soft_token_limit,
            hard_token_limit=payload.hard_token_limit,
            soft_blocked_cost_classes=[
                value.strip()
                for value in payload.soft_blocked_cost_classes
                if value.strip()
            ],
            note=payload.note.strip() if payload.note and payload.note.strip() else None,
        )

    def update_routing_policy(
        self,
        classification: str,
        payload: RoutingPolicyUpdateRequest,
    ) -> RoutingPolicyRecord:
        policy = self._routing_policies_state.get(classification)
        if policy is None:
            raise ValueError(f"Routing policy '{classification}' is not managed for this instance.")
        available_target_keys = set(self._available_target_keys())
        if payload.execution_lane is not None:
            policy.execution_lane = payload.execution_lane
        if payload.prefer_local is not None:
            policy.prefer_local = payload.prefer_local
        if payload.prefer_low_latency is not None:
            policy.prefer_low_latency = payload.prefer_low_latency
        if payload.allow_premium is not None:
            policy.allow_premium = payload.allow_premium
        if payload.allow_fallback is not None:
            policy.allow_fallback = payload.allow_fallback
        if payload.allow_escalation is not None:
            policy.allow_escalation = payload.allow_escalation
        if payload.require_queue_eligible is not None:
            policy.require_queue_eligible = payload.require_queue_eligible

        for field_name, values in (
            ("preferred_target_keys", payload.preferred_target_keys),
            ("fallback_target_keys", payload.fallback_target_keys),
            ("escalation_target_keys", payload.escalation_target_keys),
        ):
            if values is None:
                continue
            normalized = []
            invalid = []
            for value in values:
                target_key = str(value).strip()
                if not target_key:
                    continue
                if target_key not in available_target_keys:
                    invalid.append(target_key)
                    continue
                if target_key not in normalized:
                    normalized.append(target_key)
            if invalid:
                raise ValueError(
                    f"Unknown routing targets in {field_name}: {', '.join(invalid)}"
                )
            setattr(policy, field_name, normalized)

        self._routing_policies_state[classification] = policy
        self._refresh_routing_state()
        self._persist_state()
        clear_runtime_dependency_caches()
        return self._routing_policies_state[classification]

    def update_routing_budget(
        self,
        payload: RoutingBudgetUpdateRequest,
    ) -> RoutingBudgetStateRecord:
        budget = self._routing_budget_state
        if payload.hard_blocked is not None:
            budget.hard_blocked = payload.hard_blocked
        if payload.blocked_cost_classes is not None:
            budget.blocked_cost_classes = [
                value.strip()
                for value in payload.blocked_cost_classes
                if value.strip()
            ]
        if payload.reason is not None:
            budget.reason = payload.reason.strip() or None
        if payload.scopes is not None:
            budget.scopes = [
                self._budget_scope_record(scope)
                for scope in payload.scopes
                if scope.scope_key.strip()
            ]
        budget.updated_at = self._routing_now_iso()
        self._routing_budget_state = evaluate_routing_budget_state(
            budget,
            instance_id=self._instance.instance_id,
        ).budget_state
        self._persist_state()
        clear_runtime_dependency_caches()
        return self._routing_budget_state

    def update_routing_circuit(
        self,
        target_key: str,
        payload: RoutingCircuitUpdateRequest,
    ) -> RoutingCircuitStateRecord:
        if target_key not in set(self._available_target_keys()):
            raise ValueError(f"Routing target '{target_key}' is not managed in this instance.")
        circuit = self._routing_circuits_state.get(
            target_key,
            RoutingCircuitStateRecord(target_key=target_key),
        )
        circuit.state = payload.state
        circuit.reason = payload.reason.strip() or None if payload.reason is not None else None
        circuit.updated_at = self._routing_now_iso()
        self._routing_circuits_state[target_key] = circuit
        self._routing_circuits_state = self._load_routing_circuits(
            list(self._routing_circuits_state.values())
        )
        self._persist_state()
        clear_runtime_dependency_caches()
        return self._routing_circuits_state[target_key]

    def _simulation_messages(self, payload: RoutingSimulationRequest) -> list[dict]:
        if payload.messages:
            return payload.messages
        prompt = (payload.prompt or "").strip() or "Simulate routing for a generic runtime request."
        return [{"role": "user", "content": prompt}]

    def _latest_admin_simulation_decision(self) -> RoutingDecisionRecord | None:
        for decision in reversed(self._routing_decisions_state):
            if decision.source == "admin_simulation":
                return decision
        return None

    def simulate_routing(
        self,
        payload: RoutingSimulationRequest,
    ) -> dict[str, object]:
        routing = self._routing_service()
        messages = self._simulation_messages(payload)
        response_controls: dict[str, object] = {}
        if payload.max_output_tokens is not None:
            response_controls["max_output_tokens"] = payload.max_output_tokens

        try:
            decision = routing.resolve_model(
                payload.requested_model,
                messages=messages,
                stream=payload.stream,
                tools=payload.tools,
                require_vision=payload.require_vision,
                response_controls=response_controls,
                decision_source="admin_simulation",
            )
        except (RoutingBudgetExceededError, RoutingCircuitOpenError, RoutingNoCandidateError) as exc:
            refreshed = self._state_repository.load_state(self._instance.instance_id)
            self._routing_decisions_state = self._load_routing_decisions(
                refreshed.routing_decisions if refreshed else []
            )
            latest = self._latest_admin_simulation_decision()
            return {
                "status": "blocked",
                "error": {"type": exc.error_type, "message": str(exc)},
                "decision": latest.model_dump(mode="json") if latest is not None else None,
            }

        refreshed = self._state_repository.load_state(self._instance.instance_id)
        self._routing_decisions_state = self._load_routing_decisions(
            refreshed.routing_decisions if refreshed else []
        )
        return {
            "status": "ok",
            "decision": decision.model_dump(mode="json"),
        }

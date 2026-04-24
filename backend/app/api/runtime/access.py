"""Runtime access helpers shared across runtime endpoints."""

from __future__ import annotations

from collections.abc import Iterable

from app.core.model_registry import ModelRegistry
from app.core.model_registry.models import RuntimeModel
from app.core.routing import RoutingService
from app.governance.errors import RuntimeAuthorizationError
from app.governance.models import RuntimeGatewayIdentity
from app.governance.service import GovernanceService
from app.harness.service import HarnessService, get_harness_service
from app.settings.config import Settings, get_settings


def allowed_provider_set(identity: RuntimeGatewayIdentity | None) -> set[str] | None:
    if identity is None or not identity.provider_bindings:
        return None
    return set(identity.provider_bindings)


def filter_runtime_models(
    models: Iterable[RuntimeModel],
    identity: RuntimeGatewayIdentity | None,
) -> list[RuntimeModel]:
    allowed = allowed_provider_set(identity)
    if allowed is None:
        return list(models)
    return [model for model in models if model.provider in allowed]


def list_public_runtime_models(
    *,
    routing: RoutingService,
    identity: RuntimeGatewayIdentity | None,
    stream: bool = False,
    tools: list[dict] | None = None,
    route_context: dict[str, str] | None = None,
) -> list[RuntimeModel]:
    models = routing.list_runtime_usable_models(
        stream=stream,
        tools=tools,
        allowed_providers=allowed_provider_set(identity),
        route_context=route_context,
    )
    return _filter_public_runtime_inventory(models, get_settings())


def list_public_runtime_model_ids(
    *,
    routing: RoutingService,
    identity: RuntimeGatewayIdentity | None,
    stream: bool = False,
    tools: list[dict] | None = None,
    route_context: dict[str, str] | None = None,
) -> list[str]:
    return [
        model.id
        for model in list_public_runtime_models(
            routing=routing,
            identity=identity,
            stream=stream,
            tools=tools,
            route_context=route_context,
        )
    ]


def ensure_runtime_model_access(
    *,
    requested_model: str | None,
    registry: ModelRegistry,
    identity: RuntimeGatewayIdentity | None,
    governance: GovernanceService,
) -> list[RuntimeModel]:
    visible_models = filter_runtime_models(registry.list_active_models(), identity)
    allowed = allowed_provider_set(identity)
    if allowed is None or identity is None:
        return visible_models

    if requested_model:
        model = registry.get_model(requested_model)
        if model is not None and model.provider not in allowed:
            governance.audit_runtime_provider_binding_denied(
                identity=identity,
                provider=model.provider,
                requested_model=requested_model,
            )
            raise RuntimeAuthorizationError(
                status_code=403,
                error_type="provider_not_allowed",
                message=f"Provider '{model.provider}' is not allowed for this runtime key.",
                details={
                    "provider": model.provider,
                    "provider_bindings": list(identity.provider_bindings),
                    "requested_model": requested_model,
                },
            )
        return visible_models

    if not visible_models:
        governance.audit_runtime_provider_binding_denied(
            identity=identity,
            provider=None,
            requested_model=None,
        )
        raise RuntimeAuthorizationError(
            status_code=403,
            error_type="provider_not_allowed",
            message="No active models are available within this runtime key's provider bindings.",
            details={
                "provider_bindings": list(identity.provider_bindings),
            },
        )

    return visible_models


def requested_model_blocked_by_disabled_public_bridge(
    *,
    requested_model: str | None,
    registry: ModelRegistry,
    settings: Settings,
) -> bool:
    if not requested_model:
        return False
    model = registry.get_model(requested_model)
    if model is None or model.provider != "openai_codex":
        return False
    return not settings.openai_codex_bridge_enabled


def _filter_public_runtime_inventory(
    models: Iterable[RuntimeModel],
    settings: Settings,
) -> list[RuntimeModel]:
    model_list = list(models)
    # Keep Codex on the internal runtime/control-plane axis, but do not
    # advertise it to public OpenAI-compatible clients until the bridge is live.
    # Anthropic may be operator-visible and explicitly dispatchable, but under
    # the current shipped product contract public `/v1/models` must keep it
    # hidden until product scope changes deliberately.
    # Generic harness profiles also stay off the public inventory until a live
    # OpenAI-compatible public runtime path has been proven for the exact model.
    harness = get_harness_service() if any(model.provider == "generic_harness" for model in model_list) else None
    generic_harness_public_model_ids = (
        _generic_harness_public_runtime_proof_model_ids(harness)
        if harness is not None
        else set()
    )
    return [
        model
        for model in model_list
        if not (
            (model.provider == "openai_codex" and not settings.openai_codex_bridge_enabled)
            or model.provider == "anthropic"
            or (
                model.provider == "generic_harness"
                and model.id not in generic_harness_public_model_ids
            )
        )
    ]


def _generic_harness_public_runtime_proof_model_ids(
    harness: HarnessService | None,
) -> set[str]:
    if harness is None:
        return set()

    # Keep inventory-only or draft harness profiles on the admin/control-plane
    # axis. Public `/v1/models` should only advertise generic harness models
    # when an enabled OpenAI-compatible profile has exact-model public runtime
    # evidence, not just a control-plane probe or a sibling-model success.
    eligible_profiles = [
        profile
        for profile in harness.list_profiles()
        if (
            profile.enabled
            and not profile.needs_attention
            and profile.integration_class == "openai_compatible"
        )
    ]
    if not eligible_profiles:
        return set()

    proven_model_ids: set[str] = set()
    for profile in eligible_profiles:
        eligible_model_ids = set(profile.models)
        if not eligible_model_ids:
            continue
        for run in harness.list_runs(
            provider_key=profile.provider_key,
            client_id="runtime",
            limit=None,
        ):
            if not run.success:
                continue
            if run.mode not in {"runtime_non_stream", "runtime_stream"}:
                continue
            if run.integration != "generic_harness" or not run.model:
                continue
            if run.model in eligible_model_ids:
                proven_model_ids.add(run.model)

    return proven_model_ids

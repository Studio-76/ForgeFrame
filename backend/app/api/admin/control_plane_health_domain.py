"""Health behavior for the admin control plane."""

from __future__ import annotations

from datetime import UTC, datetime

from app.api.admin.control_plane_models import HealthConfigUpdateRequest
from app.control_plane import HealthConfig, HealthStatusRecord
from app.usage.models import TokenUsage


class ControlPlaneHealthDomainMixin:
    def get_health_config(self) -> HealthConfig:
        return self._health_config

    def update_health_config(self, payload: HealthConfigUpdateRequest) -> HealthConfig:
        for field in [
            "provider_health_enabled",
            "model_health_enabled",
            "interval_seconds",
            "probe_mode",
            "selected_models",
        ]:
            value = getattr(payload, field)
            if value is not None:
                setattr(self._health_config, field, value)
        self._persist_state()
        return self._health_config

    def run_health_checks(self) -> dict[str, object]:
        now = datetime.now(tz=UTC).isoformat()
        check_type = self._health_config.probe_mode
        active_runtime_providers = {model.provider for model in self._registry.list_active_models()}
        for provider in self.list_providers():
            runtime_status = (
                self._providers.get_provider_status(provider.provider)
                if provider.provider in active_runtime_providers
                else None
            )
            for model in provider.managed_models:
                if self._health_config.selected_models and model.id not in self._health_config.selected_models:
                    continue
                key = self._health_record_key(provider.provider, model.id)
                status_record = HealthStatusRecord(
                    provider=provider.provider,
                    model=model.id,
                    check_type=check_type,
                    status="unknown",
                    last_check_at=now,
                )
                if not self._health_config.model_health_enabled:
                    status_record.status = "discovery_only"
                elif not provider.enabled:
                    status_record.status = "unavailable"
                    status_record.last_error = "provider_disabled"
                    self._analytics.record_health_check_error(
                        provider=provider.provider,
                        model=model.id,
                        check_type=check_type,
                        error_type="provider_disabled",
                    )
                elif not runtime_status:
                    status_record.status = "unknown"
                    status_record.last_error = "provider_not_wired"
                elif not runtime_status["ready"]:
                    status_record.status = "not_configured"
                    status_record.readiness_reason = str(runtime_status["readiness_reason"])
                    self._analytics.record_health_check_error(
                        provider=provider.provider,
                        model=model.id,
                        check_type=check_type,
                        error_type="not_configured",
                    )
                else:
                    status_record.status = "healthy" if check_type != "discovery" else "discovery_only"
                    status_record.last_success_at = now
                    self._record_health_check_cost(provider.provider, model.id, check_type)
                self._health_records[key] = status_record
                self._analytics.record_health_status(
                    provider=status_record.provider,
                    model=status_record.model,
                    check_type=status_record.check_type,
                    status=status_record.status,
                    readiness_reason=status_record.readiness_reason,
                    last_error=status_record.last_error,
                )
        self._persist_state()
        return {
            "status": "ok",
            "check_type": check_type,
            "checked_at": now,
            "health_records": [record.model_dump() for record in self._health_records.values()],
        }

    def _record_health_check_cost(self, provider: str, model: str, check_type: str) -> None:
        usage = TokenUsage(input_tokens=8, output_tokens=4, total_tokens=12)
        cost = self._usage_accounting.costs_for_provider(
            provider=provider,
            usage=usage,
            oauth_mode=(provider == "openai_codex"),
        )
        self._analytics.record_health_check(
            provider=provider,
            model=model,
            usage=usage,
            cost=cost,
            check_type=check_type,
            credential_type="health_probe",
            auth_source="control_plane",
        )
